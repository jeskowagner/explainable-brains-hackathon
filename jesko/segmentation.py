"""c-Fos+ punctate-signal segmentation for c-Fos patches.

We detect bright punctate structures that correspond to **c-Fos-positive**
nuclei — i.e. active neurons that have expressed c-Fos. Cells that are *not*
c-Fos+ are invisible in this stain, so the count is a measure of *activity*,
not of patch quality. **Absence of signal is itself biologically meaningful**
(an inactive region), so don't read low counts as "bad data".

Naming convention:
  - `cfos_puncta`         : bright blobs detected by LoG (one per c-Fos+ nucleus)
  - `artifacts`           : long-line / fiber-tract elongated structures (top-hat path)
  - `cfos_activity_score` : continuous in [0, 1], log-rescaled `n_cfos_puncta`,
                            anchored so the 95th-pctl count maps to 1.0

Pipeline per patch (two-detector hybrid):

  1. **c-Fos+ punctum detection — Laplacian-of-Gaussian (LoG) blob detection.**
     `skimage.feature.blob_log` finds bright blobs at multiple scales (sigma 1–3),
     intensity-robust to blur because the LoG response is normalized. Returns
     a list of (y, x, sigma) — we estimate per-blob area from sigma.

  2. **Artifact detection — white top-hat + shape filter.**
     White top-hat (disk radius `TOPHAT_R`) flattens background and isolates
     small bright structures. Otsu × `THR_FACTOR` gives a sensitive threshold.
     We then *only* keep components that look like long lines (high
     eccentricity, large area) — those are the fiber tracts / edge artifacts
     LoG can't catch because it's looking for round things. Big saturated
     blobs (area > `MAX_VALID`) are dropped entirely.

LoG is used because the previous top-hat-based detection systematically
under-counted in blurry / low-sharpness patches (a blurry punctum has lower peak
intensity → fell below Otsu's threshold). LoG's multi-scale, normalized response
is much less sharpness-sensitive.

At 5 µm/vox, a 10–15 µm neuronal nucleus is ~2–3 voxels across → 3–10 px area;
sigma 1–3 covers radii ≈ 1.4–4.2 px.
"""

from dataclasses import dataclass

import numpy as np
from skimage.feature import blob_log
from skimage.filters import threshold_otsu
from skimage.measure import label, regionprops
from skimage.morphology import disk, remove_small_objects, white_tophat

# LoG (nucleus) parameters
LOG_MIN_SIGMA = 1.0
LOG_MAX_SIGMA = 3.0
LOG_NUM_SIGMA = 3
LOG_THRESHOLD = 0.01     # lower = more sensitive; chosen by visual sweep on patch 5956

# Top-hat (artifact) parameters
TOPHAT_R   = 5       # background-removal disk radius (px), > a nucleus, < a region
THR_FACTOR = 0.5     # Otsu × this; sensitive enough to find long-line artifacts
MAX_VALID  = 100     # any component bigger than this is dropped entirely
LINE_AREA  = 12      # smallest component to call a "long line" artifact
ECC_ART    = 0.92    # long elongated component → artifact (fibers, edges)
PATCH_AREA = 256 * 256


class _Blob:
    """Minimal skimage-RegionProperties-compatible object for a LoG-detected c-Fos+ punctum.

    Exposes the attributes consumed by the patch viewer (`centroid`, `bbox`) and
    by the score aggregator (`area`).
    """
    __slots__ = ("centroid", "area", "bbox", "sigma", "eccentricity", "solidity")

    def __init__(self, y, x, sigma):
        # blob_log returns the (y, x, sigma) of a Gaussian-detected blob; the
        # detected radius is ~ sqrt(2) * sigma for a 2-D LoG kernel.
        radius = float(np.sqrt(2) * sigma)
        self.centroid = (float(y), float(x))
        self.area = int(np.pi * radius * radius)
        # bbox in (min_row, min_col, max_row, max_col) skimage convention
        self.bbox = (int(y - radius), int(x - radius), int(y + radius + 1), int(x + radius + 1))
        self.sigma = float(sigma)
        self.eccentricity = 0.0   # LoG only finds circular blobs
        self.solidity = 1.0


@dataclass
class SegResult:
    n_cfos_puncta:      int      # c-Fos+ blobs detected by LoG
    n_artifacts:        int      # long-line artifacts detected by top-hat + shape
    n_other:            int
    cfos_area:          int      # sum of c-Fos+ punctum areas (px)
    artifact_area:      int
    cfos_purity:        float    # n_cfos_puncta / (n_cfos_puncta + n_artifacts), in [0, 1]
    cfos_props:         list     # list[_Blob], one per c-Fos+ punctum
    artifacts_props:    list     # list[skimage.measure.RegionProperties]
    other_props:        list
    label_image:        np.ndarray  # the artifact-detection mask (top-hat path)


def _safe_otsu(img):
    try:
        return threshold_otsu(img)
    except Exception:
        return img.mean() + img.std()


def _detect_cfos_puncta_log(patch_u16):
    """LoG blob detection on normalized [0, 1] image; returns list[_Blob] of c-Fos+ puncta."""
    peak = float(patch_u16.max())
    if peak <= 0:
        return []
    norm = patch_u16.astype(np.float32) / peak
    blobs = blob_log(
        norm,
        min_sigma=LOG_MIN_SIGMA, max_sigma=LOG_MAX_SIGMA, num_sigma=LOG_NUM_SIGMA,
        threshold=LOG_THRESHOLD,
    )
    return [_Blob(y, x, s) for (y, x, s) in blobs]


def _detect_artifacts_tophat(patch_u16, tophat_r=TOPHAT_R, thr_factor=THR_FACTOR):
    """Top-hat → Otsu → keep only long-line / oversized components. Returns
    (artifact_props, label_image_for_viz)."""
    tophat = white_tophat(patch_u16, footprint=disk(tophat_r))
    if tophat.max() == 0:
        return [], np.zeros_like(patch_u16, dtype=np.int32)

    thr = _safe_otsu(tophat) * thr_factor
    mask = tophat > thr
    mask = remove_small_objects(mask, max_size=1)

    # drop components above MAX_VALID entirely (saturated tissue regions)
    lbl0 = label(mask)
    big = [r.label for r in regionprops(lbl0) if r.area > MAX_VALID]
    if big:
        mask = mask.copy()
        mask[np.isin(lbl0, big)] = False

    lbl = label(mask)
    artifacts = [
        r for r in regionprops(lbl)
        if r.area >= LINE_AREA and r.eccentricity > ECC_ART and r.area <= MAX_VALID
    ]
    return artifacts, lbl


def segment_patch(patch_u16) -> SegResult:
    """Run the hybrid segmentation pipeline on a single (256, 256) uint16 patch."""
    cfos = _detect_cfos_puncta_log(patch_u16)
    artifacts, lbl = _detect_artifacts_tophat(patch_u16)

    n_c, n_a = len(cfos), len(artifacts)
    cfos_area = int(sum(b.area for b in cfos))
    art_area  = int(sum(r.area for r in artifacts))
    purity = n_c / max(n_c + n_a, 1)

    return SegResult(
        n_cfos_puncta=n_c, n_artifacts=n_a, n_other=0,
        cfos_area=cfos_area, artifact_area=art_area,
        cfos_purity=purity,
        cfos_props=cfos, artifacts_props=artifacts, other_props=[],
        label_image=lbl,
    )


def score_row(patch_u16):
    """Return only the scalar features (for bulk scoring into a DataFrame)."""
    r = segment_patch(patch_u16)
    return {
        "n_cfos_puncta":      r.n_cfos_puncta,
        "n_artifacts":        r.n_artifacts,
        "cfos_area_frac":     r.cfos_area / PATCH_AREA,
        "artifact_area_frac": r.artifact_area / PATCH_AREA,
        "cfos_purity":        r.cfos_purity,
    }


def score_all_patches(meta, load_patches, n_jobs=-1, verbose=True):
    """Bulk-score every patch in `meta`. Returns a DataFrame aligned with meta's rows.

    Loads one brain's patches at a time (so we don't OOM), then parallel-scores
    rows within that brain.
    """
    import time
    import pandas as pd
    from joblib import Parallel, delayed

    out = [None] * len(meta)
    scans = list(meta.groupby("scan_name", sort=False).groups.items())
    t_start = time.time()
    for i, (scan_name, idx) in enumerate(scans):
        patches = load_patches(scan_name)
        rows_meta = meta.loc[idx]
        results = Parallel(n_jobs=n_jobs)(
            delayed(score_row)(patches[int(r.patch_idx)]) for r in rows_meta.itertuples()
        )
        for pos, r in zip(idx, results):
            out[pos] = r
        if verbose:
            elapsed = time.time() - t_start
            print(f"  [{i+1:2d}/{len(scans)}] {scan_name[:30]}… ({len(idx)} patches, {elapsed:.1f}s)")

    df = pd.DataFrame(out)
    return df
