# Onboarding — Challenge A team

Vibraint Explainable Brains hackathon, Copenhagen. **Sprint window: 2026-05-26, 16:00–20:00. Demos at 18:55.** Read this first; `CLAUDE.md` has the architectural detail.

---

## The pitch (read this aloud at kickoff)

> Most teams will do PLIP → UMAP → k-means → clickable scatter. That's the floor — and it has three problems: PLIP was trained on H&E pathology, not fluorescence, so embedding similarity isn't quite biological similarity. Vanilla diversity sampling happily picks artifacts because they sit at the embedding-space periphery. And nobody actually measures whether their selection generalises.
>
> Our angle, four moves:
> 1. **Quality-filter before diversity-sample** — the brief literally tells us to.
> 2. **Use PLIP's text encoder** to give the embedding interpretable axes ("dense c-Fos", "fiber tract", "edge") — and we get the text-guided extension basically for free.
> 3. **Density-aware selection (Typiclust)**, not k-means.
> 4. **UI as a labelling workflow** — reject-and-resample, per-patch justification, brain context — not just a scatter plot.
>
> The killer slide: hold out one brain, show our 50 picks cover it better than random or k-means picks 500. That's what turns a demo into a result.

PLIP = `vinid/plip`, a CLIP-architecture vision-language model. 512-d embeddings, L2-normalized, image and text in the same space.

---

## The four moves — one paragraph each

**1. Quality filter as a *signal*, not a gate.** The brief says "less is more". Every other team will read past that. We score each patch with a nuclei-segmentation pipeline (LoG blob detection for nuclei, top-hat + shape filter for long-line / fiber-tract artifacts) and produce a continuous `quality_score` per patch. Selection downstream *weights by* this score so artifacts get downranked — but **no patches are ever dropped**. This keeps the held-out-brain coverage evaluation honest and lets the UI explain *why* each pick was favoured.

**2. PLIP text-prompt axes.** PLIP's text encoder lives in the same 512-d space as the image embeddings. Score each patch against biology prompts ("dense c-Fos signal", "scattered neurons", "fiber tract", "tissue edge", "out of focus"). Patches become interpretable profiles. The UMAP gets meaningful axes. **Text-guided selection (the extension) becomes a 30-line addition.**

**3. Typiclust-style selection.** Diversity weighted by local density. Provably outperforms k-means / coreset on label-efficiency benchmarks. ~30 lines. Most teams won't know this exists.

**4. UI as labelling workflow.** Reject-and-resample loop. Per-patch justification ("selected because: anchors cluster 7 / aligns with 'dense signal' / 12% from nearest selected"). Coverage report. **Brain context** — each patch has `(z0, y0, x0)`; pull a thin slice from the raw volume via `read_h5_slice_remote(...)` and show where in the brain the patch sits. Other teams will skip this because it requires touching the raw volumes.

**The killer slide.** Train selection on 11 brains, measure coverage on the 12th — vs random vs k-means. One row of numbers turns the demo into a result.

---

## Hour-by-hour budget

Working ugly end-to-end by hour 2. Polish after.

| Hour | Goal |
|------|------|
| 0–1 | Load all 12 brains' embeddings + metadata. Quality filter + Typiclust selection. Print top-N indices to console. |
| 1–2 | Minimal Streamlit: UMAP scatter coloured by condition + clicked-patch viewer + selected-patch grid. Ugly is fine. |
| 2–3 | PLIP text prompts → interpretable axes + text-guided reweighting. Reject-and-resample loop. |
| 3–3.5 | Per-patch justification, coverage table, brain-context slice. |
| 3.5–4 | Held-out-brain quantitative table. Polish. Demo rehearsal. |

**If anything slips, protect the held-out evaluation over polish.** Quantitative results beat polish at judging.

---

## What's already decided — don't re-litigate

- **Text-prompt extension, not draw-on-image.** Same query-embedding mechanism, much less risk in 4 hours.
- **PLIP locally is fine.** `torch` and `transformers` are in `environment.yml`. The model (`vinid/plip`, ~1 GB) is already in the HuggingFace cache — loads offline.
- **Streamlit, not Dash.** Both are in the env; Streamlit ships UI faster.
- **No custom self-supervised training.** No GPU, no time.
- **k-means is the baseline we're beating, not the goal.**

---

## Claude Code workflow during the sprint

Five skills, in this order:

1. `/run` — launches the Streamlit app so Claude can drive it. Use continuously.
2. `/verify` — actually exercises the UI in a browser. Critical because clustering/UMAP "looks right" failures are silent.
3. `/fewer-permission-prompts` — run around the 30-min mark. Scans your transcript and adds an allowlist for the bash/read calls you keep approving. Pays off for the remaining 3 hours.
4. `/code-review` — ~15 min before demo. Pre-submission diff pass.
5. `/init` is already done (`CLAUDE.md` is in the repo).

**Skip:** `/claude-api` (we're using PLIP for text prompts, not Claude API), `/security-review`, `/schedule`, `/loop`. Also skip MCP setup — `gh` CLI handles git, `boto3` handles the bucket, no MCP earns its setup time in a 4-hour sprint. Possible exception: a browser MCP if `/verify` can't read the Streamlit page on its own — check this first thing.

---

## Quick reference

### Load all embeddings + metadata

```python
from bucket_access.bucket_utils import list_files, read_h5_patches, read_h5_embeddings
import numpy as np, pandas as pd

all_emb, all_meta = [], []
for key in sorted(list_files('challengeA/embeddings/')):
    if not key.endswith('_embeddings.h5'): continue
    emb, attrs = read_h5_embeddings(key)
    scan = attrs['scan_name']
    # Read metadata from matching patches file
    patch_key = key.replace('embeddings/', 'patches/').replace('_embeddings.h5', '_patches.h5')
    _, meta, pattrs = read_h5_patches(patch_key)
    meta['scan_name'] = scan
    meta['condition'] = pattrs['condition']
    all_emb.append(emb)
    all_meta.append(meta)

embeddings = np.vstack(all_emb)              # (N_total, 512) L2-normalized
metadata   = pd.concat(all_meta, ignore_index=True)
```

Note: `read_h5_patches` downloads the full patch array too (~50 MB per file). If you only need metadata for selection, consider downloading `all_patches_metadata.csv` once and using that instead.

### Load PLIP for text prompts

```python
from transformers import CLIPModel, CLIPProcessor
import torch

model = CLIPModel.from_pretrained("vinid/plip")  # offline — already cached
processor = CLIPProcessor.from_pretrained("vinid/plip")
model.eval()

with torch.no_grad():
    inputs = processor(text=["dense c-Fos signal", "fiber tract", "tissue edge"],
                       return_tensors="pt", padding=True)
    txt_emb = model.get_text_features(**inputs)
    txt_emb = txt_emb / txt_emb.norm(dim=-1, keepdim=True)   # match L2-normalised image embs

# scores: rows = prompts, cols = patches
scores = txt_emb.numpy() @ embeddings.T
```

### Anatomical context for a selected patch

```python
from bucket_access.bucket_utils import read_h5_slice_remote

row = metadata.iloc[selected_patch_idx]
volume_key = f"challengeA/raw_whole_brain_data/{row['scan_name']}.h5"
context_slice = read_h5_slice_remote(volume_key, z_range=(int(row['z_mid_absolute']),
                                                          int(row['z_mid_absolute']) + 1))
```

---

## Open blocker

**Hetzner bucket credentials.** `bucket_access/config.py` ships with placeholder `"X"`. Until real keys are filled in, none of the bucket calls work. Get this from the organisers before 16:00.

---

## Submission

Push to your fork before 18:55. Share the fork URL when you demo.
