"""Export cache/ → frontend/data/ for the HiFi prototype.

Writes:
  frontend/data/scatter.json      — all UMAP points + indices of the 200 picks
  frontend/data/selection.json    — 200 stratified-random picks + metrics
  frontend/data/focused.json      — full detail block for the first pick
  frontend/data/patches/<i>.png   — 256-px percentile-normalized PNG per pick

Run:
  python tools/build_frontend_data.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from jesko.data import load_patches, patch_to_uint8  # noqa: E402
from jesko.selection import (  # noqa: E402
    compute_quality_weight, make_justifications, typiclust_select,
)

CACHE = ROOT / "cache"
OUT   = ROOT / "frontend" / "data"
PNGS  = OUT / "patches"
N_PICKS = 200
THUMB_PX = 256
SEED = 0


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    PNGS.mkdir(parents=True, exist_ok=True)

    meta = pd.read_parquet(CACHE / "metadata.parquet")
    seg  = pd.read_parquet(CACHE / "segmentation.parquet")
    meta = pd.concat([meta.reset_index(drop=True), seg.reset_index(drop=True)], axis=1)
    umap = np.load(CACHE / "umap_nn15_md0.1.npy")
    assert len(meta) == len(umap), f"meta {len(meta)} != umap {len(umap)}"

    # ── scatter (all 7264 points, normalized to a 800x460 viewbox like the mock) ──
    VB_W, VB_H, PAD = 800, 460, 30
    x = umap[:, 0]
    y = umap[:, 1]
    x_n = (x - x.min()) / (x.max() - x.min() + 1e-9)
    y_n = (y - y.min()) / (y.max() - y.min() + 1e-9)
    sx = PAD + x_n * (VB_W - 2 * PAD)
    sy = PAD + (1.0 - y_n) * (VB_H - 2 * PAD)   # flip y so up is +
    cond_short = meta["condition"].map({"Control": "C", "Semaglutide": "S"}).values
    points = [
        {"x": round(float(sx[i]), 2), "y": round(float(sy[i]), 2), "c": str(cond_short[i])}
        for i in range(len(meta))
    ]

    # ── Typiclust selection: real picks from jesko/selection.py ──
    emb = np.load(CACHE / "embeddings.npy")
    assert len(emb) == len(meta), f"emb {len(emb)} != meta {len(meta)}"
    w = compute_quality_weight(meta)
    sel_arr, cluster_labels, typicality = typiclust_select(
        emb, n=N_PICKS, w=w, random_state=SEED,
    )
    # per-pick justifications + cosine distance to nearest other pick (deltaNN)
    just_list = make_justifications(sel_arr, cluster_labels, typicality, w, emb)
    sel_emb = emb[sel_arr]
    sim_sel = sel_emb @ sel_emb.T
    np.fill_diagonal(sim_sel, -np.inf)
    delta_nn_arr = 1.0 - sim_sel.max(axis=1)
    sel_info = {
        int(idx): {
            "cluster":       int(cluster_labels[idx]),
            "typicality":    float(typicality[idx]),
            "delta_nn":      float(delta_nn_arr[k]),
            "justification": str(just_list[k]),
            "quality":       float(w[idx]),
        }
        for k, idx in enumerate(sel_arr.tolist())
    }
    selected = sorted(sel_info.keys())
    assert len(selected) == N_PICKS

    # ── selection.json: per-pick metadata + per-patch metrics ──
    def _pick_row(i):
        r = meta.iloc[i]
        cfos_act = float(r["cfos_activity_score"])
        sharp_n  = float(np.clip(r["sharpness"] / 5.0, 0, 1))   # rough normalize for the bar viz
        snr_n    = float(np.clip(r["snr"] / 10.0, 0, 1))
        fg_n     = float(np.clip(r["foreground_fraction"], 0, 1))
        contrast_n = float(np.clip(r["local_contrast"] / 100.0, 0, 1))
        return {
            "i":        int(i),
            "id":       f"P-{i:05d}",
            "c":        "C" if r["condition"] == "Control" else "S",
            "brain":    f"Brain {int(r['brain_idx']):02d}",
            "brain_idx": int(r["brain_idx"]),
            "scan":     str(r["scan_name"]),
            "patch_in_brain": int(r["patch_idx"]),
            "condition": str(r["condition"]),
            "z":        int(r["z_mid_absolute"]),
            "y":        int(r["y0"]),
            "x":        int(r["x0"]),
            "cluster":  sel_info[i]["cluster"],
            "deltaNN":  sel_info[i]["delta_nn"],
            "img":      f"data/patches/{i}.png",
            "seed":     int(i),
            "density":  float(np.clip(cfos_act, 0.3, 1.2)),
            "metrics": {
                "cfos_activity_score": cfos_act,
                "sharpness_norm":      sharp_n,
                "snr_norm":            snr_n,
                "foreground_frac":     fg_n,
                "contrast_norm":       contrast_n,
                "n_cfos_puncta":       int(r["n_cfos_puncta"]),
                "n_artifacts":         int(r["n_artifacts"]),
            },
            "weights": [
                {"key": "cfos_activity", "val": cfos_act},
                {"key": "sharpness",     "val": sharp_n},
                {"key": "snr",           "val": snr_n},
                {"key": "foreground",    "val": fg_n},
                {"key": "contrast",      "val": contrast_n, "accent": True},
            ],
            "tags": [
                {"name": f"brain {int(r['brain_idx']):02d}", "primary": True},
                {"name": f"{int(r['n_cfos_puncta'])} c-Fos+ puncta", "score": cfos_act},
                {"name": f"{int(r['n_artifacts'])} artifacts",
                 "score": float(np.clip(int(r["n_artifacts"]) / 100, 0, 1))},
            ],
            "justification": sel_info[i]["justification"],
        }

    picks = [_pick_row(i) for i in selected]

    # ── focused.json: first pick (kept for legacy bootstrap) ──
    focused = picks[0]

    # ── PNGs: load each brain's patches once, slice out the picks for that brain ──
    print(f"rendering {N_PICKS} patch PNGs → {PNGS}")
    by_scan: dict[str, list[int]] = {}
    for i in selected:
        by_scan.setdefault(str(meta.iloc[i]["scan_name"]), []).append(i)
    for scan_name, idxs in by_scan.items():
        patches = load_patches(scan_name)   # (n_brain, 256, 256) uint16
        for gi in idxs:
            pat = patches[int(meta.iloc[gi]["patch_idx"])]
            img = Image.fromarray(patch_to_uint8(pat)).convert("L")
            if img.size != (THUMB_PX, THUMB_PX):
                img = img.resize((THUMB_PX, THUMB_PX), Image.BILINEAR)
            img.save(PNGS / f"{gi}.png", optimize=True)
        print(f"  · {scan_name[:50]:50s} {len(idxs):3d} patches")

    # ── write JSON ──
    (OUT / "scatter.json").write_text(json.dumps({
        "viewbox": [VB_W, VB_H],
        "points":  points,
        "selected": selected,
    }))
    (OUT / "selection.json").write_text(json.dumps(picks))
    (OUT / "focused.json").write_text(json.dumps(focused))

    print(f"✓ wrote frontend/data/scatter.json   ({len(points)} points, {len(selected)} selected)")
    print(f"✓ wrote frontend/data/selection.json ({len(picks)} picks)")
    print(f"✓ wrote frontend/data/focused.json")
    print(f"✓ wrote {N_PICKS} PNGs in frontend/data/patches/")


if __name__ == "__main__":
    main()
