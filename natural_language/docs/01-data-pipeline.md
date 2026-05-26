# 01 — Data pipeline for the natural-language stream

## What we consume

Everything we need is already produced by `jesko/data.py` (do **not** write a new downloader).

```python
from jesko.data import load_embeddings, load_patches, load_patch, patch_to_uint8

emb, meta = load_embeddings()        # (N≈7500, 512) float32 L2-normalised, pandas DataFrame
patches   = load_patches(scan_name)  # (n_brain, 256, 256) uint16, one brain
patch     = load_patch(scan_name, idx_in_brain)  # single (256, 256) uint16
img       = patch_to_uint8(patch)    # uint8, percentile-normalised for display
```

First call to `load_embeddings()` triggers `cache_all_brains()`, which writes:

- `cache/embeddings.npy` — `(N, 512) float32`, L2-normalised, concatenated over all 12 brains
- `cache/metadata.parquet` — DataFrame, one row per patch, aligned with `embeddings.npy`
- `cache/patches/<scan_name>.npy` — `(n_brain, 256, 256) uint16` per brain

Subsequent calls are local-disk reads.

## `meta` columns we care about

- `scan_name` (str) — which brain
- `brain_idx` (int 0..11) — stable brain enumeration
- `condition` (`"Control"` | `"Semaglutide"`) — G001 vs G002
- `group_nr`, `animal_nr` — finer identifiers
- The bucket-provided per-patch quality columns: `sharpness`, `snr`, `foreground_fraction`, etc. (handed through unchanged from the source H5 metadata)
- `z0, y0, x0, z_mid_absolute` — coordinates back into the source volume

## Index alignment (load-bearing invariant)

For row `i`:
- `emb[i]` ← `(512,) float32` patch embedding
- `meta.iloc[i]` ← that patch's metadata
- `(scan_name, brain_idx_within_brain)` → `load_patch(scan_name, k)` returns the same patch image

This alignment is asserted inside `cache_all_brains()` per brain (`assert emb.shape[0] == patches.shape[0]`). Any code we write **must preserve row order** end-to-end. Never sort `emb` and `meta` independently.

## What this stream produces (output side)

Every output is index-aligned with `emb` / `meta`:

```python
prompt_scores: np.ndarray   # (P, N) float32  — prompt_scores[:, i] is patch i
top_tags:      list[str]    # length N        — top_tags[i] is patch i
```

Free-text search returns indices into the same global row space:

```python
def search_by_text(query: str, k: int = 50) -> np.ndarray:  # (k,) int — indices into emb/meta
```

## Subsetting for "post quality-filter" patches

Jesko's stream produces:

```python
quality_df:    pd.DataFrame  # aligned with emb/meta, columns include 'keep' (bool) and 'quality_score' ([0,1])
keep_mask:     np.ndarray    # (N,) bool
quality_score: np.ndarray    # (N,) float in [0,1]
```

Two integration options for our prompt scoring:

1. **Score all N patches first, subset at display time.** Cheap (cosine sim is dot product, ~7500 × 8 prompts is instant). Means we have scores for rejected patches too, which is fine for the sanity check ("the 'out of focus' prompt should fire on Jesko's rejects").
2. **Score only `emb[keep_mask]`.** Smaller output. Loses the negative-prompt cross-check above.

**Decision: go with option 1.** Storage is trivial. The cross-check is a free QA signal for Jesko. `top_tags` and `search_by_text` should respect `keep_mask` when they surface results to the UI — but the underlying `prompt_scores` covers everything.

## Fallback if Jesko's mask is late

If `keep_mask` is not available by the time we are scoring:

- Score against all `emb`.
- Set `keep_mask = np.ones(N, dtype=bool)` as a stub.
- Tag the demo slide: "currently no quality filter applied — pending Jesko's mask".
- Swap in the real mask later — the prompt_scores tensor does not change, only what we surface in the UI.

## Cache management

- `cache/` is gitignored (committed in this session). Safe to populate freely.
- One-time download cost: ~50 MB × 12 patch files + 12 small embedding files ≈ low single-digit minutes over network.
- `cache_all_brains()` is idempotent — overwrites on re-run. Use `load_embeddings(refresh=True)` to force a re-download.
- If disk pressure becomes a concern, only `embeddings.npy` + `metadata.parquet` are strictly required for scoring (~30 MB combined). The `patches/` dir is only needed for the eyeball sanity check.

## What this stream does NOT touch

- The raw whole-brain H5 volumes (`challengeA/raw_whole_brain_data/`). Meds may stream slices from these via `read_h5_slice_remote()` for the brain-context panel — that is not our concern.
- The bucket directly. We go through `jesko/data.py` only.

## Open questions

- Will Christos's selected indices arrive as **global indices into `emb`** or as **filtered-set indices into `emb[keep_mask]`**? Confirm before integration — these are different and breaking each other is silent. Defaulting to global.
- Do we need a stratified per-brain or per-condition subsetting helper, or does Christos handle stratification? Confirm.
- Should `top_tags` use the prompt name verbatim or a humanised short form (e.g. `"dense c-Fos signal"` vs `"dense c-fos"`)? Decided in `03-scoring.md`.
