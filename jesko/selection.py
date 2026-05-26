"""Diversity-aware patch selection for Challenge A.

Pipeline (per the team's agreed design):

  1. k-means(K=N) on the PLIP 512-d embeddings (L2-normalised → Euclidean ≡ cosine).
  2. Within each cluster, rank by *typicality* (mean cosine sim to k-NN within
     cluster) and take the top-3 candidates.
  3. Among those 3, pick the one with the highest quality weight w_i.

  - No condition stratification — picks are globally diverse; surface the
    emergent G001/G002 mix in the UI rather than forcing balance.
  - Quality is a soft prior (tiebreaker among the top-3 typicality candidates),
    not a primary driver.
  - `cfos_activity_score` is deliberately NOT folded into the quality weight —
    low c-Fos is biological signal (inactive region), not bad data.

Public surface (matches the TEAM_PLAN contract):
    select(embeddings, meta, n)            -> (selected_idx, scores, justifications)
    diversity_scores(emb, selected_idx)    -> dict
    leave_one_brain_out(emb, meta, n)      -> pd.DataFrame
    compute_quality_weight(meta)           -> (N,) float in [0, 1]
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import rankdata
from sklearn.cluster import KMeans

QUALITY_COLS = ["sharpness", "snr", "local_contrast", "foreground_fraction"]
QUALITY_NEG  = ["n_artifacts"]   # higher = worse, sign-flipped before combining


def compute_quality_weight(meta: pd.DataFrame) -> np.ndarray:
    """Per-patch quality weight in [0, 1] from organiser metrics + n_artifacts.

    Does NOT include `cfos_activity_score`: low c-Fos is biologically meaningful,
    not bad data. Composite = z-score each feature, mean, percentile-rank.
    """
    cols = [c for c in QUALITY_COLS if c in meta.columns]
    assert cols, f"meta is missing all quality columns {QUALITY_COLS}"
    feats = meta[cols].to_numpy(dtype=float)

    for c in QUALITY_NEG:
        if c in meta.columns:
            feats = np.column_stack([feats, -meta[c].to_numpy(dtype=float)])

    z = (feats - feats.mean(0)) / (feats.std(0) + 1e-9)
    composite = z.mean(axis=1)
    return ((rankdata(composite) - 1) / max(len(composite) - 1, 1)).astype(np.float32)


def _typicality_in_cluster(emb_c: np.ndarray, k_nn: int) -> np.ndarray:
    """Mean cosine similarity to k nearest neighbours within the cluster.

    emb_c assumed L2-normalised, so emb_c @ emb_c.T = cosine sim.
    """
    n = len(emb_c)
    if n <= 1:
        return np.zeros(n, dtype=np.float32)
    sim = emb_c @ emb_c.T
    np.fill_diagonal(sim, -np.inf)
    k = min(k_nn, n - 1)
    top_k = np.partition(sim, -k, axis=1)[:, -k:]
    return top_k.mean(axis=1).astype(np.float32)


def typiclust_select(
    emb: np.ndarray,
    n: int = 50,
    w: np.ndarray | None = None,
    k_nn: int = 10,
    top_m: int = 3,
    random_state: int = 0,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Typiclust-style selection.

    Returns
    -------
    selected_idx : (n,) int  — indices into emb's rows
    cluster_labels : (N,) int  — k-means label for every patch
    typicality : (N,) float  — within-cluster typicality score for every patch
    """
    if w is None:
        w = np.ones(len(emb), dtype=np.float32)

    km = KMeans(n_clusters=n, random_state=random_state, n_init=10)
    labels = km.fit_predict(emb)

    typ = np.zeros(len(emb), dtype=np.float32)
    for c in range(n):
        idx_c = np.where(labels == c)[0]
        if len(idx_c) == 0:
            continue
        typ[idx_c] = _typicality_in_cluster(emb[idx_c], k_nn)

    selected = []
    for c in range(n):
        idx_c = np.where(labels == c)[0]
        if len(idx_c) == 0:
            continue
        m = min(top_m, len(idx_c))
        top_idx = idx_c[np.argsort(-typ[idx_c])[:m]]
        selected.append(int(top_idx[np.argmax(w[top_idx])]))

    return np.asarray(selected, dtype=int), labels, typ


def diversity_scores(emb: np.ndarray, selected_idx: np.ndarray) -> dict:
    """Three set-level diversity scores on L2-normalised emb."""
    sel = emb[selected_idx]
    sim_all_to_sel = emb @ sel.T
    nn_d = 1.0 - sim_all_to_sel.max(axis=1)

    mask = np.ones(len(emb), dtype=bool)
    mask[selected_idx] = False

    K_S = sel @ sel.T / max(len(selected_idx), 1)
    eigvals = np.linalg.eigvalsh(K_S)
    eigvals = eigvals[eigvals > 1e-12]
    vendi = float(np.exp(-(eigvals * np.log(eigvals)).sum()))

    return {
        "max_min":  float(nn_d[mask].max()),
        "mean_nn":  float(nn_d[mask].mean()),
        "vendi":    vendi,
        "n":        int(len(selected_idx)),
    }


def make_justifications(
    selected_idx: np.ndarray,
    cluster_labels: np.ndarray,
    typicality: np.ndarray,
    w: np.ndarray,
    emb: np.ndarray,
) -> list[str]:
    """One short sentence per selected patch — feeds Meds' justification panel."""
    sel = emb[selected_idx]
    sim_sel = sel @ sel.T
    np.fill_diagonal(sim_sel, -np.inf)
    nearest_other = 1.0 - sim_sel.max(axis=1)

    out = []
    for k, i in enumerate(selected_idx):
        c = int(cluster_labels[i])
        out.append(
            f"Anchor of cluster {c} (typicality {typicality[i]:.2f}); "
            f"quality rank {w[i] * 100:.0f}%; "
            f"{nearest_other[k]:.2f} cos-dist to nearest other pick"
        )
    return out


def select(
    embeddings: np.ndarray,
    meta: pd.DataFrame,
    n: int = 50,
    method: str = "typiclust",
    k_nn: int = 10,
    top_m: int = 3,
    random_state: int = 0,
) -> tuple[np.ndarray, dict, list[str]]:
    """Public contract — matches TEAM_PLAN §Christos.

    Returns (selected_idx, scores, justifications).
    """
    if method != "typiclust":
        raise NotImplementedError(f"method={method!r} not implemented yet")

    w = compute_quality_weight(meta)
    selected_idx, labels, typ = typiclust_select(
        embeddings, n=n, w=w, k_nn=k_nn, top_m=top_m, random_state=random_state,
    )
    scores = diversity_scores(embeddings, selected_idx)
    justifications = make_justifications(selected_idx, labels, typ, w, embeddings)
    return selected_idx, scores, justifications


# ---------- Killer evaluation: leave-one-brain-out coverage ----------

def _coverage_of_held_out(emb_held: np.ndarray, picks_emb: np.ndarray) -> dict:
    """How well does `picks_emb` cover `emb_held` in cosine space?"""
    sim = emb_held @ picks_emb.T
    nn_d = 1.0 - sim.max(axis=1)
    return {"max_min": float(nn_d.max()), "mean_nn": float(nn_d.mean())}


def leave_one_brain_out(
    emb: np.ndarray,
    meta: pd.DataFrame,
    n: int = 50,
    random_state: int = 0,
) -> pd.DataFrame:
    """Hold out each brain in turn; train selection on the other 11; measure coverage.

    Methods compared:
      - typiclust @ n       (ours)
      - kmeans     @ n      (pick patch nearest each centroid)
      - random     @ n      (uniform sample)
      - random     @ 5n     (5× the budget, gives an "effort baseline")

    Returns long-form DataFrame: [held_out_brain, method, max_min, mean_nn].
    """
    rng = np.random.default_rng(random_state)
    rows = []

    for held in sorted(meta["brain_idx"].unique()):
        train_mask = (meta["brain_idx"] != held).to_numpy()
        train_idx = np.where(train_mask)[0]
        held_idx  = np.where(~train_mask)[0]

        emb_train  = emb[train_idx]
        emb_held   = emb[held_idx]
        meta_train = meta.iloc[train_idx].reset_index(drop=True)

        # typiclust
        w_train = compute_quality_weight(meta_train)
        sel_t, _, _ = typiclust_select(emb_train, n=n, w=w_train, random_state=random_state)

        # k-means centroids → nearest train patch per centroid
        km = KMeans(n_clusters=n, random_state=random_state, n_init=10).fit(emb_train)
        sel_k = km.transform(emb_train).argmin(axis=0)

        # random budgets
        sel_r1 = rng.choice(len(emb_train), size=n, replace=False)
        sel_r5 = rng.choice(len(emb_train), size=5 * n, replace=False)

        for name, sel in [
            ("typiclust",   sel_t),
            ("kmeans",      sel_k),
            (f"random_{n}",  sel_r1),
            (f"random_{5*n}", sel_r5),
        ]:
            cov = _coverage_of_held_out(emb_held, emb_train[sel])
            rows.append({"held_out_brain": int(held), "method": name, **cov})

    return pd.DataFrame(rows)


def summarise_lobo(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate leave-one-brain-out across the 12 folds → mean ± std per method."""
    g = df.groupby("method")
    out = pd.DataFrame({
        "max_min_mean": g["max_min"].mean(),
        "max_min_std":  g["max_min"].std(),
        "mean_nn_mean": g["mean_nn"].mean(),
        "mean_nn_std":  g["mean_nn"].std(),
    })
    return out.sort_values("max_min_mean")
