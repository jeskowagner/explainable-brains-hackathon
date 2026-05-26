import numpy as np
from scipy.stats import rankdata
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import normalize

from bucket_access.bucket_utils import list_files, read_h5_embeddings


def compute_diversity_scores(k: int = 20):
    """
    Load all Challenge A embeddings from the bucket and score each patch by
    how isolated it is in embedding space (mean distance to k nearest neighbors,
    then percentile-ranked into [0, 1]).

    Returns:
        diversity_score: (N_total,) float in [0, 1] — higher = more diverse
        scan_names:      (N_total,) array of source scan names (for grouping)
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

    X = normalize(embeddings, norm='l2', axis=1)

    nn = NearestNeighbors(n_neighbors=k + 1, metric='euclidean', n_jobs=-1)
    nn.fit(X)
    distances, _ = nn.kneighbors(X)
    mean_knn_dist = distances[:, 1:].mean(axis=1)

    diversity_score = (rankdata(mean_knn_dist) - 1) / (len(mean_knn_dist) - 1)
    return diversity_score, scan_names


if __name__ == '__main__':
    scores, scans = compute_diversity_scores()
    print(f'scored {len(scores)} patches across {len(np.unique(scans))} scans')
    print(f'min={scores.min():.3f}  median={np.median(scores):.3f}  max={scores.max():.3f}')
