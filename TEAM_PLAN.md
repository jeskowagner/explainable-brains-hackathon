# Team plan — Challenge A

Vibraint Explainable Brains hackathon, Copenhagen. **Sprint window: 2026-05-26, 16:00–20:00. Demos at 18:55.**

This is the per-person task split. For the *why* behind the overall approach see `ONBOARDING.md`; for the data API and conventions see `CLAUDE.md`.

---

## The pipeline at a glance

```
              ┌──────────────┐
              │  Christos    │  diversity scoring + selection
              │  (selection) │  → "pick N patches that cover the
              └──────┬───────┘    distribution well"
                     │ selected_indices, scores
                     ▼
  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │   Jesko      │   │     Nick     │   │     Meds     │
  │ (quality     │──▶│ (text-prompt │──▶│  (Streamlit  │
  │  filter)     │   │  semantics)  │   │   UI / UX)   │
  └──────────────┘   └──────────────┘   └──────────────┘
   keep_mask          per-patch          everything the
   per patch          prompt scores      judges actually see
```

The whole point: **filter → score-and-select → explain → demo**. Each work stream feeds the next; nobody works in isolation.

---

## Christos — Diversity scoring & selection

**Goal:** Given the 512-d PLIP embeddings of all surviving patches (post quality filter), produce (a) one or more diversity *scores* we can put on screen and (b) the *selection* algorithm that picks the final N patches.

**Why it matters:** This is the methodological core. Diversity scoring is also what powers the killer slide — "our 50 picks cover a held-out brain better than random or k-means picks 500".

**Recommended approach (in priority order):**

1. **Typiclust / ProbCover-style selection** (the hero algorithm).
   - Cluster the surviving embeddings into K clusters (K = budget, e.g. 50).
   - From each cluster pick the *densest* (most typical) point — typically the one with highest mean cosine sim to its k nearest neighbours within the cluster.
   - ~30 lines. Beats k-means/coreset on label-efficiency benchmarks.

2. **Diversity score(s)** to report alongside any selection:
   - **Coverage / max-min distance**: for each non-selected patch, distance to nearest selected. Report the *worst* (max) — i.e. the least-covered point. Lower = better coverage.
   - **Mean nearest-selected distance** — softer, less artifact-sensitive than max-min.
   - **Vendi score** (effective number of distinct items, exp of entropy of similarity matrix eigenvalues). Single scalar, nice for the demo slide.
   - **Pairwise mean cosine distance** within selection — naive but cheap and intuitive.

3. **The killer evaluation** — *held-out-brain coverage*:
   - Train selection on 11 brains, leave out 1.
   - Report coverage of the held-out brain (max-min distance) for: our method @ N=50, random @ N=50, k-means @ N=50, random @ N=500.
   - Repeat across the 12 leave-one-out splits → mean ± std.

**Inputs:**
- `embeddings: (M, 512) float32, L2-normalized` — only the patches surviving Jesko's filter
- `metadata: pandas DataFrame` — `scan_name`, `condition`, `z0/y0/x0`, `z_mid_absolute`, quality columns

**Outputs (the contract):**
```python
selected_idx: np.ndarray   # (N,) int — indices into the *filtered* set
scores: dict               # {"max_min": float, "mean_nn": float, "vendi": float, ...}
per_patch_justification: list[str]  # length N, one short sentence each
                                    # e.g. "anchor of cluster 7; 12% from nearest selected"
```

**Definition of done:**
- A function `select(embeddings, n, method="typiclust") -> (selected_idx, scores, justifications)`.
- The held-out-brain table can be filled in (a function or notebook that produces the row of numbers).
- Cosine sim, not Euclidean — embeddings are L2-normalized.

**Watch out:**
- Vanilla farthest-point sampling without a quality filter will happily pick artifacts. Always run on the filtered set.
- 50 picks across 12 brains ≈ ~4 per brain. If Typiclust starves a brain entirely, surface that — may want condition-stratified selection.

---

## Jesko — Quality filter / nuclei segmentation

**Goal:** Per-patch boolean `keep_mask` that rejects low-quality / artifact patches before diversity sampling.

**Why it matters:** "Less is more" is in the brief. Other teams will skip this and their diversity samplers will dutifully select edge artifacts. Quality-filter-first is move #1 of our four moves.

**Current state:** `jesko/segmentation.py` already implements a classical nuclei segmenter — white top-hat → Otsu → component classification by area + eccentricity + solidity. Produces `n_nuclei`, `n_artifacts`, `nucleus_score` per patch.

**What remains:**

1. **Bulk-score every patch** across all 12 brains. Concat into a quality DataFrame (rows aligned with the embeddings).
   - ~7,500 patches × ~50 ms/patch ≈ 6 min single-threaded. Parallelise across cores if it's longer.

2. **Produce a continuous per-patch `quality_score`** in `[0, 1]`, not just a binary mask.
   - The nuclei count (`n_nuclei`, `nucleus_score`) is the strongest input — patches with many well-formed nuclei score high; patches dominated by artifacts or with zero nuclei score low.
   - Combine with `metadata.sharpness`, `metadata.foreground_fraction` as sanity backstops (e.g. weighted sum, then squash to `[0, 1]`).
   - Downstream consumers want this as a *score*, not just a filter — Christos can weight selection by it (a high-quality typical point beats a marginal one at the same density), and Meds shows it in the justification panel.

3. **Then threshold to get `keep_mask`** for the hard-reject step.
   - Aim for 10–25% rejection. Optionally pair with embedding-density outlier rejection (drop patches in the lowest-density 5% of PLIP space) — catches artifacts the classical filter misses.

4. **Sanity check** — pull 10 patches from the kept set and 10 from the rejected set, render side-by-side. The rejected ones should *look* obviously worse. Also spot-check a few high-`quality_score` vs low-`quality_score` patches *within* the kept set — the gradient should be visible.

**Outputs (the contract):**
```python
quality_df: pd.DataFrame   # rows aligned with embeddings/metadata, columns:
                           # n_nuclei, n_artifacts, nucleus_score,
                           # nucleus_area_frac, artifact_area_frac,
                           # quality_score (continuous, [0,1]), keep (bool)
keep_mask:     np.ndarray  # (N_total,) bool — quality_df["keep"].values
quality_score: np.ndarray  # (N_total,) float in [0,1] — continuous signal
                           # for downstream weighting / display
```

**Definition of done:**
- `keep_mask` is in memory / on disk and consumable by Christos.
- A 2-by-N grid of kept-vs-rejected sample patches saved for the demo (Meds can drop it in).
- Per-condition keep rate (G001 vs G002) is roughly equal — a heavy imbalance would mean the filter is biased.

**Watch out:**
- The current thresholds in `segmentation.py` are tuned for 5 µm/vox and ~10–15 µm nuclei. Spot-check before bulk-running.
- Don't be too aggressive — losing >40% of patches kills downstream diversity. Aim for 10–25% rejection unless data clearly justifies more.

---

## Nick — Natural language element

**Goal:** Make the embedding space *interpretable* by scoring each patch against biology-anchored text prompts, and enable *text-guided selection* ("show me patches that look like dense c-Fos signal").

**Why it matters:** PLIP has a text encoder in the same 512-d space as the image embeddings. This is the cheapest path to interpretability (judging criterion #5, the literal name of the challenge). Two-for-one: the text prompts also enable the headline UI extension.

**Approach:**

1. **Curate a prompt set** (~6–10 prompts). Starting point:
   - Signal: `"dense c-Fos signal"`, `"scattered c-Fos positive neurons"`, `"sparse activity"`
   - Anatomy: `"fiber tract / white matter"`, `"tissue edge"`, `"cell body cluster"`
   - Quality: `"out of focus"`, `"blurry image"`, `"empty background"`
   - Iterate based on what gives clean separation on a 200-patch sample.

2. **Embed prompts → score every patch** (cosine similarity, since both are L2-normalized).
   ```python
   prompt_emb = model.get_text_features(...)         # (P, 512)
   prompt_emb /= prompt_emb.norm(dim=-1, keepdim=True)
   scores = prompt_emb @ embeddings.T                # (P, N)
   ```

3. **Two consumers of these scores:**
   - **Interpretable axes**: top-2 prompts per patch become a 1-line tag ("looks like: dense c-Fos signal, scattered neurons"). Goes into Meds' per-patch justification panel.
   - **Text-guided selection**: user types a free-form prompt → embed → cosine sim → top-K. Optional weighted-reweighting of Christos's selection.

4. **Domain-mismatch sanity check.** PLIP was trained on H&E pathology, not fluorescence. Verify each prompt does something sensible:
   - For each prompt, pull the top-5 and bottom-5 patches and eyeball them.
   - Drop prompts that don't visibly correspond to what you'd expect. Better 4 good prompts than 10 noisy ones.
   - Discuss with the team if a prompt is consistently surprising — may itself be a finding for the demo ("PLIP confuses X with Y").

**Outputs (the contract):**
```python
prompt_scores: np.ndarray    # (P, N_total) float — cosine sim, prompts × patches
prompt_names:  list[str]     # length P, in the same order
top_tags:      list[str]     # length N_total, one short tag per patch for the UI
```

Plus a function for free-form text-guided selection that Meds can wire to a text input box:
```python
def search_by_text(query: str, k: int = 50) -> np.ndarray:
    """Return top-k patch indices most similar to `query`."""
```

**Definition of done:**
- Prompt set finalized and pruned (no obviously broken ones).
- `top_tags` populated for every patch.
- `search_by_text` works on the live data.
- Two example queries documented for the demo ("dense c-Fos signal", and one creative one).

**Watch out:**
- Don't fine-tune anything. The model loads offline; just embed and score.
- Negative prompts (`"out of focus"`) double as a sanity check on the quality filter — high score here should correlate with Jesko's rejected set.

---

## Meds — UI / UX / Frontend

**Goal:** A Streamlit app that lets a non-expert (= the judges) drive the whole selection workflow without a manual, while exposing every "this is why" signal the other three produce.

**Why it matters:** Judging criteria #1 (usability), #3 (presentation), and #4 (quality of product) are all yours. We agreed early "ugly is fine" was wrong — aim for clean from iteration 1.

**Stack:** Streamlit (already in env). App entry point: `jesko/app.py` exists as a starter. Run with `streamlit run jesko/app.py` after `conda activate explainable-brains`.

**Required panels (priority order):**

1. **Embedding view** — UMAP scatter of all patches, coloured by condition (G001 control = blue, G002 semaglutide = orange). Selected patches highlighted. Clicking a point → loads it into the patch viewer.
2. **Patch viewer** — the clicked patch (`patch_to_pil` from `plip-local-loading` memory) + its metadata (scan, condition, z/y/x, quality scores, top prompt tags from Nick).
3. **Selection grid** — the N selected patches as a clickable thumbnail grid.
4. **Per-patch justification panel** — one sentence per selected patch:
   `"Anchor of cluster 7. Aligned with 'dense c-Fos signal' (0.31). 12% from nearest selected."`
   Combines Christos's justification + Nick's top tag.
5. **Reject-and-resample** — click a selected patch → "reject" → it's removed and the selector re-runs to fill the slot. Christos exposes a `reject(idx)` hook for this.
6. **Coverage report** — small table at the top: `N selected`, `coverage score`, `% from each condition`, `% from each brain`. Updates live.
7. **Brain context slice** — for each selected patch, a thin slice from the raw volume showing where it sits anatomically. Uses `read_h5_slice_remote(volume_key, z_range=(z_mid_absolute, z_mid_absolute+1))`. **Differentiator** — other teams won't touch raw volumes.
8. **Text-prompt search box** — wire Nick's `search_by_text(query)` to a Streamlit text input.

**Inputs (the contract — what every other person hands you):**
```python
# From Jesko:
quality_df: pd.DataFrame
keep_mask:  np.ndarray

# From Christos:
selected_idx: np.ndarray
scores:       dict
justifications: list[str]
def reject(idx): ...   # mutates selection in place

# From Nick:
prompt_scores: np.ndarray
top_tags:      list[str]
def search_by_text(query: str, k: int = 50) -> np.ndarray: ...
```

**Definition of done:**
- A judge can open the app and produce a coherent selection + understand why each patch was picked, in under 2 minutes, with no spoken guidance.
- All seven panels are wired and don't crash on edge cases (empty selection, reject all, etc.).
- One "this is the demo flow" path rehearsed end-to-end.

**Watch out:**
- Cache aggressively (`@st.cache_data` / `@st.cache_resource`) — re-loading 7,500 patches every interaction is a killer.
- The raw-volume slice fetch is slow (network-bound). Lazy-load on click, don't pre-fetch for all selected patches.
- Test in a real browser (not just code). Use `/run` and `/verify` skills.

---

## Shared interfaces — the contract

This is the single source of truth for how the four streams plug together. **If you change one of these names, tell the team.**

| Object              | Shape / type                        | Produced by | Consumed by         |
|---------------------|-------------------------------------|-------------|---------------------|
| `embeddings`        | `(N, 512) float32`, L2-normalized   | bucket      | Christos, Nick      |
| `metadata`          | `pd.DataFrame`                      | bucket      | everyone            |
| `quality_df`        | `pd.DataFrame` (incl. `keep`, `quality_score`) | Jesko | Christos, Meds      |
| `keep_mask`         | `(N,) bool`                         | Jesko       | Christos            |
| `quality_score`     | `(N,) float in [0,1]`               | Jesko       | Christos, Meds      |
| `selected_idx`      | `(K,) int`                          | Christos    | Meds                |
| `scores`            | `dict[str, float]`                  | Christos    | Meds                |
| `justifications`    | `list[str]`, length K               | Christos    | Meds                |
| `prompt_scores`     | `(P, N) float`                      | Nick        | Meds, Christos opt. |
| `top_tags`          | `list[str]`, length N               | Nick        | Meds                |
| `search_by_text`    | `Callable[[str, int], np.ndarray]`  | Nick        | Meds                |

All index spaces are aligned: row `i` of `embeddings`, `metadata`, `quality_df`, `prompt_scores[:, i]`, `top_tags[i]` is the same patch.

---

## Hour-by-hour budget

Working ugly end-to-end by hour 2. Polish after.

| Hour    | Christos                                | Jesko                               | Nick                                  | Meds                                       |
|---------|------------------------------------------|--------------------------------------|----------------------------------------|---------------------------------------------|
| 0–1     | Typiclust skeleton on a single brain    | Bulk-score all 12 brains             | Prompt set v1, sanity-check on 200 patches | Skeleton Streamlit: UMAP + patch viewer    |
| 1–2     | Run across all 12, expose `select(...)` | `keep_mask` finalised, sanity grid   | Full prompt scoring + `top_tags`       | Selection grid + condition colouring        |
| 2–3     | Coverage scores, `reject(idx)` hook     | Embedding-density outlier rejection  | `search_by_text`, demo queries chosen  | Justification panel + reject-and-resample  |
| 3–3.5   | Held-out-brain table                    | Help wherever                        | Help wherever                          | Brain-context slice + text search box       |
| 3.5–4   | Polish numbers slide                    | Polish quality slide                 | Polish demo queries                    | Demo rehearsal                              |

**If anything slips, protect the held-out evaluation over polish.** Quantitative results beat polish at judging.

---

## The killer slide

> "We held out one brain at a time. Our 50 picks cover the held-out brain better (lower worst-case distance) than random does with 500 picks, and better than k-means at every budget we tried."

One row of numbers. That's the whole slide. Christos owns producing it; everyone owns being able to say it.

---

## Quick reference

### Activate env
```bash
conda activate explainable-brains
```
(for ad-hoc Python use `/Users/s2221912/conda/envs/explainable-brains/bin/ipython` directly.)

### Load embeddings + metadata
See `ONBOARDING.md` → "Load all embeddings + metadata".

### Load PLIP
See `ONBOARDING.md` → "Load PLIP for text prompts".

### Run the UI
```bash
streamlit run jesko/app.py
```

---

## Submission

Push to the team fork before 18:55. Share the fork URL when we demo.
