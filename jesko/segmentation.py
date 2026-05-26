"""Nuclei-like object segmentation for c-Fos patches.

The score answers: how much of this patch looks like discrete, round, nucleus-sized
objects (good signal) vs long-line / diffuse artifacts (bad signal)?

Pipeline per patch:
  1. White top-hat with a disk slightly larger than a nucleus — flattens uneven
     background illumination and isolates small bright structures, doubling as
     an *adaptive* threshold without us having to tune a per-pixel one.
  2. Otsu threshold on the top-hat response.
  3. Drop 1-pixel components (noise).
  4. Classify each component by area + shape:
       - "nucleus"  if MIN_NUC <= area <= MAX_NUC, AND if area >= SHAPE_AREA
                    then also eccentricity < ECC_NUC and solidity > SOLID_NUC
                    (shape checks skipped on very small objects — their
                     eccentricity is unreliable)
       - "artifact" if area > MAX_NUC (saturated blobs / smears) OR
                    (area >= LINE_AREA AND eccentricity > ECC_ART)  (long lines)
       - else: unclassified ("other")

At 5 um/vox, a 10-15 um neuronal nucleus is ~2-3 voxels across → 3-10 px area.
Defaults below are tuned for that scale.
"""

from dataclasses import dataclass

import numpy as np
from skimage.filters import threshold_otsu
from skimage.measure import label, regionprops
from skimage.morphology import disk, remove_small_objects, white_tophat

TOPHAT_R   = 5       # background-removal disk radius (px), > a nucleus, < a region
MIN_NUC    = 2       # smallest area we still call a (tiny) nucleus
MAX_NUC    = 30      # bigger than this → not a single nucleus → artifact
SHAPE_AREA = 6       # only check shape on components at least this big
LINE_AREA  = 12      # only call it a "long line" if it's at least this big
ECC_NUC    = 0.85    # nucleus must be rounder than this (when checked)
ECC_ART    = 0.92    # long elongated thing → artifact (fibers, edges)
SOLID_NUC  = 0.7     # nucleus is solid (not C-shaped)
PATCH_AREA = 256 * 256


@dataclass
class SegResult:
    n_nuclei:           int
    n_artifacts:        int
    n_other:            int
    nucleus_area:       int
    artifact_area:      int
    nucleus_score:      float   # n_nuclei / (n_nuclei + n_artifacts), in [0, 1]
    nuclei_props:       list    # list of skimage RegionProperties (for viz)
    artifacts_props:    list
    other_props:        list
    label_image:        np.ndarray


def _safe_otsu(img):
    try:
        return threshold_otsu(img)
    except Exception:
        return img.mean() + img.std()


def segment_patch(patch_u16, tophat_r=TOPHAT_R) -> SegResult:
    """Run the segmentation pipeline on a single (256, 256) uint16 patch."""
    # white top-hat = original - opening(original, disk) ; pops bright spots smaller
    # than the disk while removing slowly-varying background → adaptive in effect
    tophat = white_tophat(patch_u16, footprint=disk(tophat_r))
    if tophat.max() == 0:
        mask = np.zeros_like(tophat, dtype=bool)
    else:
        thr = _safe_otsu(tophat)
        mask = tophat > thr
    mask = remove_small_objects(mask, max_size=1)  # drop 1-pixel speckles

    lbl = label(mask)
    nuclei, artifacts, other = [], [], []
    for r in regionprops(lbl):
        if r.area > MAX_NUC:
            artifacts.append(r)
            continue
        if r.area >= LINE_AREA and r.eccentricity > ECC_ART:
            artifacts.append(r)
            continue
        if r.area < MIN_NUC:
            other.append(r)  # still possible after morphology, count separately
            continue
        if r.area >= SHAPE_AREA:
            if r.eccentricity < ECC_NUC and r.solidity > SOLID_NUC:
                nuclei.append(r)
            else:
                other.append(r)
        else:
            # too small to trust shape stats — call it a (tiny) nucleus
            nuclei.append(r)

    n_n, n_a = len(nuclei), len(artifacts)
    nuc_area  = int(sum(r.area for r in nuclei))
    art_area  = int(sum(r.area for r in artifacts))
    score = n_n / max(n_n + n_a, 1)

    return SegResult(
        n_nuclei=n_n, n_artifacts=n_a, n_other=len(other),
        nucleus_area=nuc_area, artifact_area=art_area,
        nucleus_score=score,
        nuclei_props=nuclei, artifacts_props=artifacts, other_props=other,
        label_image=lbl,
    )


def score_row(patch_u16):
    """Return only the scalar features (for bulk scoring into a DataFrame)."""
    r = segment_patch(patch_u16)
    return {
        "n_nuclei":           r.n_nuclei,
        "n_artifacts":        r.n_artifacts,
        "nucleus_area_frac":  r.nucleus_area / PATCH_AREA,
        "artifact_area_frac": r.artifact_area / PATCH_AREA,
        "nucleus_score":      r.nucleus_score,
    }
