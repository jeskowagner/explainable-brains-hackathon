"""Cached loading of the 12 Challenge A brains.

First call to `load_embeddings()` (or `load_patches()`) triggers a one-time
fetch from the Hetzner bucket into `cache/`. Subsequent calls are local-disk fast.

    emb, meta = load_embeddings()          # (N, 512) float32, DataFrame
    patches   = load_patches(scan_name)    # (n_brain, 256, 256) uint16

`meta` columns: original per-patch quality cols (sharpness, snr, ...) plus
`scan_name`, `brain_idx` (0..11), `condition` (Control|Semaglutide),
`group_nr`, `animal_nr`. Row i of `meta` aligns with row i of `emb`.
"""

from pathlib import Path

import numpy as np
import pandas as pd

from bucket_access.bucket_utils import (
    list_files, read_h5_embeddings, read_h5_patches,
)

CACHE_DIR       = Path(__file__).parent / "cache"
EMB_CACHE       = CACHE_DIR / "embeddings.npy"
META_CACHE      = CACHE_DIR / "metadata.parquet"
PCA_CACHE       = CACHE_DIR / "pca.npy"
PATCH_CACHE_DIR = CACHE_DIR / "patches"


def _scan_keys():
    keys = [k for k in list_files('challengeA/embeddings/') if k.endswith('.h5')]
    return sorted(keys)


def cache_all_brains():
    """Fetch all 12 brains from the bucket into `cache/`. Idempotent — overwrites."""
    CACHE_DIR.mkdir(exist_ok=True)
    PATCH_CACHE_DIR.mkdir(exist_ok=True)

    emb_keys = _scan_keys()
    assert len(emb_keys) == 12, f"expected 12 brains, found {len(emb_keys)}"

    all_emb, all_meta = [], []
    for brain_idx, emb_key in enumerate(emb_keys):
        scan_name = emb_key.split('/')[-1].replace('_embeddings.h5', '')
        pat_key   = f'challengeA/patches/{scan_name}_patches.h5'

        emb, _              = read_h5_embeddings(emb_key)
        patches, meta, attrs = read_h5_patches(pat_key)

        assert emb.shape[0] == patches.shape[0], f"index misalignment in {scan_name}"

        meta = meta.copy()
        meta['scan_name'] = scan_name
        meta['brain_idx'] = brain_idx
        meta['condition'] = attrs['condition']
        meta['group_nr']  = attrs['group_nr']
        meta['animal_nr'] = attrs['animal_nr']

        all_emb.append(emb.astype(np.float32))
        all_meta.append(meta)
        np.save(PATCH_CACHE_DIR / f'{scan_name}.npy', patches)
        print(f'  [{brain_idx+1:2d}/12] {attrs["condition"][:4]:4s} {scan_name} → {emb.shape[0]} patches')

    emb_arr = np.concatenate(all_emb, axis=0)
    meta_df = pd.concat(all_meta, ignore_index=True)

    np.save(EMB_CACHE, emb_arr)
    meta_df.to_parquet(META_CACHE)

    print(f'\n✓ Cached {len(emb_arr)} patches × 512-d across {len(emb_keys)} brains → {CACHE_DIR}')
    return emb_arr, meta_df


def load_embeddings(refresh=False):
    """Return (embeddings, metadata). Triggers one-time bucket fetch on first call."""
    if refresh or not EMB_CACHE.exists() or not META_CACHE.exists():
        return cache_all_brains()
    emb  = np.load(EMB_CACHE)
    meta = pd.read_parquet(META_CACHE)
    return emb, meta


def load_patches(scan_name):
    """Return (n, 256, 256) uint16 patches for one brain. Cache must already exist."""
    path = PATCH_CACHE_DIR / f'{scan_name}.npy'
    if not path.exists():
        raise FileNotFoundError(f"no cache for {scan_name}; run cache_all_brains() first")
    return np.load(path)


def load_patch(scan_name, patch_idx_in_brain):
    """Return a single (256, 256) uint16 patch by scan_name + per-brain row index."""
    return load_patches(scan_name)[patch_idx_in_brain]


def patch_to_uint8(patch_u16, lo_pct=1, hi_pct=99):
    """Percentile-normalize uint16 → uint8 for display. Handles fluorescence dynamic range."""
    lo, hi = np.percentile(patch_u16, [lo_pct, hi_pct])
    out = np.clip((patch_u16 - lo) / max(hi - lo, 1) * 255, 0, 255)
    return out.astype(np.uint8)


def compute_pca(n_components=2, refresh=False):
    """PCA-project the 7264 embeddings to (N, n_components). Cached. Returns (coords, explained_variance_ratio)."""
    from sklearn.decomposition import PCA

    var_cache = CACHE_DIR / f'pca_{n_components}d_var.npy'
    coords_cache = CACHE_DIR / f'pca_{n_components}d.npy'
    if not refresh and coords_cache.exists() and var_cache.exists():
        return np.load(coords_cache), np.load(var_cache)

    emb, _ = load_embeddings()
    pca = PCA(n_components=n_components, random_state=0)
    coords = pca.fit_transform(emb).astype(np.float32)
    var = pca.explained_variance_ratio_.astype(np.float32)
    np.save(coords_cache, coords)
    np.save(var_cache, var)
    print(f'✓ PCA {emb.shape} → {coords.shape}, explained variance: {var.sum()*100:.1f}%')
    return coords, var


def compute_umap(n_neighbors=15, min_dist=0.1, refresh=False):
    """UMAP-project the 7264 embeddings to (N, 2). Cached. Returns coords."""
    import umap

    coords_cache = CACHE_DIR / f'umap_nn{n_neighbors}_md{min_dist}.npy'
    if not refresh and coords_cache.exists():
        return np.load(coords_cache)

    emb, _ = load_embeddings()
    reducer = umap.UMAP(
        n_components=2, n_neighbors=n_neighbors, min_dist=min_dist,
        metric='cosine', random_state=0,
    )
    coords = reducer.fit_transform(emb).astype(np.float32)
    np.save(coords_cache, coords)
    print(f'✓ UMAP {emb.shape} → {coords.shape}  (n_neighbors={n_neighbors}, min_dist={min_dist}, metric=cosine)')
    return coords


if __name__ == '__main__':
    cache_all_brains()
