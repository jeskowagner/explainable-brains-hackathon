# Task A — PLIP bootstrap

## Pre-reading (mandatory, in order)

1. `TEAM_PLAN.md` at project root — ignore Streamlit references; frontend is Node.js.
2. `natural_language/docs/CONTEXT.md` — shared technical brief.

## What this task is

Download PLIP weights and prove the text-encoder + image-embedding dot product works end-to-end on 50 sample patches. This task unblocks the human sanity-check step downstream.

## Parallel with

B, C, D, E. No code dependency on any of them. Pure infrastructure.

## Build

Create `natural_language/_smoke_test.py`:

- Load `cache/embeddings.npy`, take a random sample of 50 rows (seeded, `np.random.default_rng(0)`).
- Load PLIP: `CLIPModel.from_pretrained("vinid/plip")` and matching `CLIPProcessor`. Downloads ~400 MB if not in HF cache.
- Embed one text prompt: `"dense cell signal"` (chosen for being unambiguous and domain-neutral).
- L2-normalize the text features manually.
- Cosine similarity vs the 50 patches.
- Print:
  - wall time for model load
  - wall time for text encode + dot product
  - device (`cpu` expected)
  - top-5 indices and their scores
- ASCII-only prints. No unicode glyphs.

Run once:
```
uv run -X utf8 python natural_language/_smoke_test.py
```

## Done criteria

1. Script runs without error.
2. Top-5 scores are in a plausible cosine range (roughly 0.10 to 0.40 — encoder is domain-mismatched, so don't expect 0.9).
3. Wall time printed (latency budget reference for task D).
4. PLIP weights now present in `C:\Users\nick\.cache\huggingface\hub\` — verify with `dir`.

## If PLIP download fails

Hugging Face Hub may be unreachable or rate-limited. Fallback:

1. Download the PLIP state dict from the official PLIP GitHub release (`PathologyFoundation/plip`).
2. Load into a vanilla CLIP shell:
   ```python
   from transformers import CLIPModel
   import torch

   model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
   state = torch.load("plip.pt", map_location="cpu")
   model.load_state_dict(state, strict=False)
   ```
3. Document the fallback path inside `natural_language/_smoke_test.py` as a commented block. Do NOT swap a different model silently.

If both paths fail, write a short note to `natural_language/docs/STATUS.md` and stop. The whole stream is gated on a working PLIP.

## Don't

- Don't write `score.py`, `search.py`, or `prompts.py`. Those belong to other tasks.
- Don't bulk-score all 7264 patches here — just the 50.
- Don't pin a model revision yet (defer to task C).
- Don't print unicode.
- Don't add a `requirements.txt` or modify `pyproject.toml`. `transformers` and `torch` are already installed.
