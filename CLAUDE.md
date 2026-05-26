# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A starter for the **Vibraint "Explainable Brains" hackathon** (Copenhagen, 2026-05-26, 16:00–20:00). Existing code: `bucket_access/` (S3 client for the Hetzner-hosted dataset) and `jesko/` (segmentation pipeline + Streamlit skeleton in progress). Everything else (selection algorithms, NLP integration, full UI) is being built across the sprint.

The repo ships two challenges, A and B, in parallel. **This team is targeting Challenge A only** (smart patch selection for label-efficient AI training on c-Fos brain scans). Ignore `CHALLENGE_B.md` and `challengeB/` bucket paths unless explicitly asked.

**Team-facing docs to read alongside this file:**
- `TEAM_PLAN.md` — per-person task split (Christos / Jesko / Nick / Meds), shared interface contracts, hour-by-hour budget.
- `ONBOARDING.md` — pitch, the four-moves argument, demo flow, Quick reference snippets.
- `challenge-a-plan` memory — strategic plan, why we are rejecting the vanilla PLIP+UMAP+k-means approach.
- `judging-criteria` memory — the seven scoring axes and how they reweight the plan.

## Setup and run

```bash
conda activate explainable-brains    # env is pre-built; do not recreate
```

There is **no build, no lint, no test suite, no CI**. The repo intentionally ships nothing to lint. Any tests / lints we add are ours.

For ad-hoc Python invocations prefer the direct interpreter — `/Users/s2221912/conda/envs/explainable-brains/bin/ipython` (or `.../python`) — rather than `conda activate ... && python`. Activation is only needed for tools that require it (e.g. `streamlit run`).

Streamlit UI:
```bash
streamlit run jesko/app.py     # current entry point; may be renamed
```

## Critical preconditions before any code runs

**Hetzner credentials are filled in** at `bucket_access/config.py` (as of commit `4e95fab`). Note: despite the comment in `.gitignore`, `config.py` is in fact tracked by git — the keys are in repository history. Acceptable for the hackathon per organiser policy; rotate after demos if the fork is made public.

`torch` and `transformers` are in `environment.yml` and the PLIP model (`vinid/plip`) is already cached locally — `CLIPModel.from_pretrained("vinid/plip")` resolves offline. See the `plip-local-loading` memory for preprocessing details.

## Architecture

The data layer is the only thing that exists. Everything below the `bucket_access/` line is to-be-built.

```
bucket_access/
  bucket_utils.py      S3 client (boto3 + s3fs) for Hetzner object storage
  config.py            credentials — placeholder "X" until filled in
challengeA/ (in bucket, not repo)
  patches/             12 × {scan}_patches.h5  + all_patches_metadata.csv
  embeddings/          12 × {scan}_embeddings.h5  (PLIP 512-d, L2 normalized)
  raw_whole_brain_data/  4 × ~5 GB volumes — DO NOT download in full
```

### `bucket_access/bucket_utils.py` — the data API

Four functions matter:

- `list_files(prefix)` — returns S3 keys
- `read_h5_patches(s3_key)` → `(patches, metadata, attrs)` where patches is `(N, 256, 256) uint16` and metadata is a pandas DataFrame
- `read_h5_embeddings(s3_key)` → `(embeddings, attrs)` where embeddings is `(N, 512) float32`, L2-normalized
- `read_h5_slice_remote(s3_key, z_range=, y_range=, x_range=)` — for the raw volumes, never read in full

### Index alignment (load-bearing invariant)

For a given scan, **patch row `i` in `patches.h5` corresponds exactly to row `i` in `embeddings.h5`**. There is no explicit join key — the array index *is* the key. Code that loads them separately must preserve order.

### Coordinate system

Patch metadata exposes `z0, y0, x0` (origin in the source brain volume) and `z_mid_absolute` (the actual Z slice that was extracted as the 2-D image). Patches are the middle slice of a `256×256×64` voxel subvolume at `5×5×5 µm` resolution. To show anatomical context for a selected patch, use `read_h5_slice_remote(volume_key, z_range=(z_mid_absolute, z_mid_absolute+1))` on the matching raw volume.

### Embedding caveat

The provided embeddings come from PLIP (`vinid/plip`), a CLIP-architecture model trained on **H&E pathology** (purple/pink stains), not fluorescence microscopy. Treat embedding-space similarity as informative but domain-mismatched — diversity sampling on these embeddings will happily select artifacts at the embedding-space periphery. See the `challenge-a-plan` memory for the quality-filter-first approach this implies.

## Conditions and groupings

Brains are split:
- `G001` → **Control** (vehicle)
- `G002` → **Semaglutide**

`condition` is exposed both as an H5 file-level attr and as a column in `all_patches_metadata.csv`. Any selection / coverage analysis should stratify on this.

## Work streams

The sprint is split four ways. `TEAM_PLAN.md` is the authoritative per-person spec and shared-interface contract — read it before doing implementation work in any of these areas. Quick technical orientation per stream:

### Selection / diversity scoring (Christos)

- No file yet — will likely land as `selection.py` at repo root, or under a `christos/` subdir.
- Inputs: filtered embeddings (post Jesko quality filter) + metadata.
- Expected contract: `select(embeddings, n, method="typiclust") -> (selected_idx, scores, justifications)` plus a `reject(idx)` hook for the UI.
- **Cosine sim, not Euclidean** — embeddings are L2-normalised. Don't use `sklearn.cluster.KMeans` directly without normalising or switching to `SphericalKMeans` / cosine-based variants.
- The headline result is **leave-one-brain-out coverage**: train selection on 11 brains, measure max-min distance to held-out brain. Build this eval harness early — it's the killer slide.
- Watch out for tiny-cluster starvation: 50 picks across 12 brains ≈ 4 per brain; stratification on `condition` (G001 / G002) matters.

### Quality filter / nuclei segmentation (Jesko)

- `jesko/segmentation.py` is already implemented: white top-hat → Otsu threshold → component classification by area + eccentricity + solidity. Produces `n_nuclei`, `n_artifacts`, `nucleus_score`. See `score_row(patch_u16)` for the per-patch entry point.
- Thresholds (`TOPHAT_R=5`, `MIN_NUC=2`, `MAX_NUC=30`, ...) are tuned for **5 µm/vox**, ~10–15 µm nuclei (= 3–10 px area). Spot-check before bulk-running but don't drift far without a reason.
- Expected contract: `quality_df` (DataFrame, aligned with embeddings/metadata), `keep_mask` (bool), and `quality_score` (continuous in `[0, 1]`). The continuous score is consumed by Christos (selection weighting) and Meds (justification panel), not only the binary mask.
- Aim for 10–25% rejection. Strong G001/G002 keep-rate imbalance is a red flag (filter has a bias).
- Bulk scoring ~7,500 patches × ~50 ms ≈ 6 min single-threaded — parallelise with `joblib` if it pushes past that.

### Natural language / PLIP text prompts (Nick)

- No file yet — will likely land as `text_prompts.py` or under a `nick/` subdir.
- Use `CLIPModel` / `CLIPProcessor` from `transformers`, **not** any PLIP-specific class — PLIP shares CLIP architecture. Model ID `vinid/plip`.
- Both text and image embeddings live in the same 512-d space *after* L2-normalising. `txt_emb @ img_emb.T` is cosine similarity directly. **Always** normalise text outputs — the precomputed image embeddings already are.
- Expected contract: `prompt_scores` `(P, N)`, `top_tags` list of length N, `search_by_text(query, k) -> indices`.
- PLIP was trained on H&E pathology, not fluorescence — sanity-check every prompt by eyeballing its top-5 and bottom-5 patches. Prune prompts that don't visibly correspond to what they claim. Better 4 good prompts than 10 noisy ones.
- See the `plip-local-loading` memory for the uint16 → percentile-norm → PIL RGB image preprocessing (only needed for *new* inputs — text prompts, user-drawn ROIs — not for the bulk patches we already have embeddings for).

### UI / Streamlit (Meds)

- Entry point: `jesko/app.py` (current). Run with `streamlit run jesko/app.py`.
- Streamlit is in the env; Dash is not the chosen path even though both are available.
- **Cache aggressively.** `@st.cache_data` for the embedding + metadata load. `@st.cache_resource` for the PLIP model. Re-loading 7,500 patches on every interaction is the #1 performance trap.
- For per-patch anatomical context: `read_h5_slice_remote(volume_key, z_range=(z_mid, z_mid+1))` — but do it **lazily on click**, not pre-fetched for all selected patches. The fetch is network-bound and slow.
- For patch display, use the `patch_to_pil` percentile-normalise helper from the `plip-local-loading` memory — uint16 fluorescence patches won't render correctly with naive uint8 cast.
- The required panels are enumerated in `TEAM_PLAN.md`; don't reinvent the layout.

## Submission

Push to the user's fork before 18:55 on demo day. There is no PR — judges pull the fork URL the team shares.
