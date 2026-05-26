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
   cfos_activity_score      per-patch          everything the
   per patch          prompt scores      judges actually see
```

The whole point: **filter → score-and-select → explain → demo**. Each work stream feeds the next; nobody works in isolation.

---

## Christos — Diversity scoring & selection

**Goal:** Given the 512-d PLIP embeddings of all patches (with Jesko's `cfos_activity_score` attached as a per-patch weight), produce (a) one or more diversity *scores* we can put on screen and (b) the *selection* algorithm that picks the final N patches.

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
- `embeddings: (N, 512) float32, L2-normalized` — all 7,264 patches (no rejection happens upstream)
- `metadata: pandas DataFrame` — `scan_name`, `condition`, `z0/y0/x0`, `z_mid_absolute`, plus Jesko's c-Fos columns (`n_cfos_puncta`, `cfos_activity_score`, ...) already merged in by `load_embeddings()`

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
- Vanilla farthest-point sampling will happily pick artifacts at the embedding-space periphery. Weight by `cfos_activity_score` (or sample probabilities ∝ `cfos_activity_score`) so low-quality patches get downranked without being dropped — patches are *never* removed from the dataset.
- 50 picks across 12 brains ≈ ~4 per brain. If Typiclust starves a brain entirely, surface that — may want condition-stratified selection.

---

## Jesko — c-Fos puncta segmentation

**Goal:** Continuous per-patch `cfos_activity_score` (in `[0, 1]`) plus interpretable count features (`n_cfos_puncta`, `n_artifacts`, ...) that downstream consumers can *weight by*. **Every patch stays in the dataset — no binary rejection, no `keep_mask`.**

**Why it matters:** Diversity samplers naively select artifacts at the embedding-space periphery. A continuous quality signal lets Christos downweight those without throwing them away, lets Meds explain *why* each pick was favoured, and keeps the held-out-brain coverage story honest (you can't compare coverage if half the dataset is gone).

**Current state:** `jesko/segmentation.py` ships a hybrid two-detector pipeline. **c-Fos+ puncta** via LoG blob detection (`skimage.feature.blob_log`, sigma 1–3, threshold 0.01) — multi-scale, intensity-robust to blur. **Artifacts** (long lines, fiber tracts) via white top-hat → Otsu → eccentricity + size cap. Produces `n_cfos_puncta`, `n_artifacts`, `cfos_area_frac`, `cfos_purity` per patch. `data.compute_segmentation()` runs it across all 12 brains in parallel (~50 s on 10 cores) and caches at `cache/segmentation.parquet`. `load_embeddings()` auto-merges the c-Fos columns into the metadata DataFrame.

**What remains:**

1. **Verify the cache is current.** If thresholds in `segmentation.py` change, run `compute_segmentation(refresh=True)` to rebuild. ~40 s parallel.

2. **`cfos_activity_score` definition.** Already implemented: log-rescaled `n_cfos_puncta` anchored so the 95th-percentile count maps to 1.0. Median ≈ 0.66 on the current data; min 0, max 1. Computed inside `compute_segmentation()`.

3. **Sanity check** — colour the dashboard PCA by `cfos_activity_score` and confirm low-score patches visibly look worse than high-score ones. Pull side-by-side samples at low / medium / high `cfos_activity_score` (e.g. 10th / 50th / 90th percentile) for the demo grid. Per-condition `n_cfos_puncta` distribution should be roughly balanced across G001 vs G002 — a heavy skew means the segmenter is condition-biased.

**Outputs (the contract):**
```python
segmentation_df: pd.DataFrame   # rows aligned with embeddings/metadata, columns:
                           # n_cfos_puncta, n_artifacts, cfos_purity,
                           # cfos_area_frac, artifact_area_frac,
                           # cfos_activity_score (continuous, [0,1])
cfos_activity_score: np.ndarray  # (N_total,) float in [0,1] — continuous signal
                           # for downstream weighting / display
```

**Definition of done:**
- `segmentation_df` cached and loadable via `data.load_embeddings()` (auto-merges c-Fos columns into metadata).
- A 2-by-N grid of low-vs-medium-vs-high `cfos_activity_score` sample patches saved for the demo (Meds can drop it in).
- Per-condition `n_cfos_puncta` median roughly equal across G001 vs G002.

**Watch out:**
- LoG and top-hat thresholds in `segmentation.py` are tuned for 5 µm/vox, ~10–15 µm c-Fos+ nuclei. Spot-check the dashboard overlay before changing. `LOG_THRESHOLD` (currently 0.01) is the main blob-detection sensitivity dial — lower = catches more dim puncta, higher = stricter.
- Never produce a `keep_mask`. Patches with `cfos_activity_score == 0` are still kept; consumers weight them down rather than dropping them.

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
- Negative prompts (`"out of focus"`) double as a sanity check — high prompt score for "out of focus" should correlate with high `n_artifacts` from Jesko. (Do *not* expect correlation with low `cfos_activity_score` — a patch with no c-Fos signal is biologically inactive, not technically bad.)

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
segmentation_df: pd.DataFrame   # auto-merged into metadata by data.load_embeddings()
                            # columns include: n_cfos_puncta, n_artifacts, cfos_activity_score
# (no keep_mask — every patch stays; weight by cfos_activity_score, don't filter)

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
| `segmentation_df`        | `pd.DataFrame` (`n_cfos_puncta`, `n_artifacts`, `cfos_area_frac`, `cfos_activity_score`, ...) | Jesko | Christos, Meds      |
| `cfos_activity_score`     | `(N,) float in [0,1]`               | Jesko       | Christos, Meds      |
| `selected_idx`      | `(K,) int`                          | Christos    | Meds                |
| `scores`            | `dict[str, float]`                  | Christos    | Meds                |
| `justifications`    | `list[str]`, length K               | Christos    | Meds                |
| `prompt_scores`     | `(P, N) float`                      | Nick        | Meds, Christos opt. |
| `top_tags`          | `list[str]`, length N               | Nick        | Meds                |
| `search_by_text`    | `Callable[[str, int], np.ndarray]`  | Nick        | Meds                |

All index spaces are aligned: row `i` of `embeddings`, `metadata`, `segmentation_df`, `prompt_scores[:, i]`, `top_tags[i]` is the same patch.

---

## Hour-by-hour budget

Working ugly end-to-end by hour 2. Polish after.

| Hour    | Christos                                | Jesko                               | Nick                                  | Meds                                       |
|---------|------------------------------------------|--------------------------------------|----------------------------------------|---------------------------------------------|
| 0–1     | Typiclust skeleton on a single brain    | Bulk-score all 12 brains             | Prompt set v1, sanity-check on 200 patches | Skeleton Streamlit: UMAP + patch viewer    |
| 1–2     | Run across all 12, expose `select(...)` | `cfos_activity_score` finalised, sanity grid | Full prompt scoring + `top_tags`     | Selection grid + condition colouring        |
| 2–3     | Coverage scores, `reject(idx)` hook     | Optional: alt quality features (e.g. embedding-density bonus) | `search_by_text`, demo queries chosen  | Justification panel + reject-and-resample  |
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
