from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import rankdata
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler, normalize

from bucket_access.bucket_utils import download_file, list_files, read_h5_embeddings

META_COLS = [
    'mean_intensity', 'std_intensity', 'sharpness',
    'snr', 'local_contrast', 'foreground_fraction',
]


def _knn_score(X: np.ndarray, k: int):
    nn = NearestNeighbors(n_neighbors=k + 1, metric='euclidean', n_jobs=-1)
    nn.fit(X)
    d, _ = nn.kneighbors(X)
    mean_d = d[:, 1:].mean(axis=1)
    rank = (rankdata(mean_d) - 1) / (len(mean_d) - 1)
    return mean_d, rank


def compute_diversity_scores(k: int = 20, meta_csv: str = 'all_patches_metadata.csv'):
    """
    Per-patch diversity scores across all 12 Challenge A scans.

    Returns a DataFrame aligned with the stacked embedding order
    (sorted scan_name, then patch_idx within each scan). Columns:

      scan_name, condition, patch_idx
      diversity_plip         — k-NN distance in PLIP space, percentile-ranked globally
      diversity_plip_strat   — same, but ranked within each condition (G001 vs G002)
      diversity_meta         — k-NN distance in z-scored metadata space, ranked globally
      mean_knn_dist_plip     — raw mean k-NN distance (PLIP) — preserves magnitude
      mean_knn_dist_meta     — raw mean k-NN distance (metadata)

    Agreement between diversity_plip and diversity_meta = genuinely novel patches.
    Disagreement = isolation likely driven by domain-mismatch artifacts in PLIP space.
    """
    all_emb, all_scan = [], []
    for key in sorted(list_files('challengeA/embeddings/')):
        if not key.endswith('_embeddings.h5'):
            continue
        emb, attrs = read_h5_embeddings(key)
        all_emb.append(emb)
        all_scan.append(np.full(emb.shape[0], attrs['scan_name']))

    embeddings = np.vstack(all_emb)
    scan_names = np.concatenate(all_scan)

    if not Path(meta_csv).exists():
        download_file('challengeA/patches/all_patches_metadata.csv', meta_csv)
    meta = pd.read_csv(meta_csv).sort_values(['scan_name', 'patch_idx']).reset_index(drop=True)

    assert len(meta) == len(embeddings), f'length mismatch: meta={len(meta)} emb={len(embeddings)}'
    assert (meta['scan_name'].to_numpy() == scan_names).all(), 'scan_name order mismatch between CSV and embeddings'

    conditions = meta['condition'].to_numpy()

    X_plip = normalize(embeddings, norm='l2', axis=1)
    plip_dist, plip_rank = _knn_score(X_plip, k)

    plip_rank_strat = np.zeros_like(plip_rank)
    for cond in np.unique(conditions):
        mask = conditions == cond
        plip_rank_strat[mask] = (rankdata(plip_dist[mask]) - 1) / (mask.sum() - 1)

    M = StandardScaler().fit_transform(meta[META_COLS].to_numpy())
    meta_dist, meta_rank = _knn_score(M, k)

    return pd.DataFrame({
        'scan_name': scan_names,
        'condition': conditions,
        'patch_idx': meta['patch_idx'].to_numpy(),
        'diversity_plip': plip_rank,
        'diversity_plip_strat': plip_rank_strat,
        'diversity_meta': meta_rank,
        'mean_knn_dist_plip': plip_dist,
        'mean_knn_dist_meta': meta_dist,
    })


if __name__ == '__main__':
    df = compute_diversity_scores()
    print(f'scored {len(df)} patches across {df["scan_name"].nunique()} scans, '
          f'{df["condition"].nunique()} conditions')
    print(df.groupby('condition')[['diversity_plip', 'diversity_plip_strat', 'diversity_meta']]
            .agg(['mean', 'std']).round(3))
    corr = df[['diversity_plip', 'diversity_meta']].corr().iloc[0, 1]
    print(f'\nPLIP↔metadata diversity correlation: {corr:.3f}  '
          f'(low = signals are complementary, high = redundant)')
