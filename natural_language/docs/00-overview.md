# 00 — Overview of the natural-language stream

## What this stream is

Nick's work stream in the four-person split (TEAM_PLAN.md:123-175). The goal is to make the PLIP embedding space **interpretable** by scoring every patch against a small set of biology-anchored text prompts, and to expose a **free-text search** entry point so a judge can type `"dense c-Fos signal"` and see the top patches.

There are two consumer roles, both downstream of the same `prompt_scores` matrix:

1. **Tags for the justification panel.** Top-2 prompts per patch become a one-line label that Meds shows next to each selected patch ("looks like: dense c-Fos signal, scattered neurons"). This is what makes the demo *explainable* — judging criterion #5 and the literal name of the challenge.
2. **Free-text search box.** User types a query → we embed it with PLIP's text encoder → cosine similarity against the precomputed image embeddings → return the top-K patch indices. Meds wires this to a Streamlit text input. Optional: the same scores can re-weight Christos's selection.

## Why this matters

- PLIP has a text encoder living in the **same 512-d space** as the image embeddings the bucket gives us. Both sides are L2-normalised, so cosine similarity is just a dot product.
- This is the cheapest path to interpretability — no fine-tuning, no extra model, no training data. Pure inference.
- Two-for-one: the text prompts both label patches *and* enable text-guided search. One pipeline, two demo features.
- "Four-moves" position: this is **move #4** (interpretability) in the team's strategic plan. Move #1 is Jesko's quality filter, #2 is Christos's typiclust selection, #3 is the held-out coverage eval.

## What this stream is NOT

- Not a fine-tuning project. PLIP is used purely as a frozen encoder.
- Not a vision model. We do not train, distill, or alter PLIP.
- Not responsible for patch selection. That is Christos. We *describe* the patches he picks.
- Not responsible for the UI. That is Meds. We hand him a dict-like surface and a function.

## Domain-mismatch reality

PLIP was trained on **H&E pathology** (purple/pink stains), not fluorescence microscopy. The embeddings are usable but not perfect. Every prompt has to be sanity-checked by eyeballing its top-5 and bottom-5 patches. Prompts that don't visibly correspond to what they claim get pruned. **Better 4 good prompts than 10 noisy ones.** See `05-risks.md`.

## Contract (what this stream ships)

```python
prompt_scores: np.ndarray   # (P, N_total) float32 — cosine sim, prompts × patches
prompt_names:  list[str]    # length P, in the same order as prompt_scores rows
top_tags:      list[str]    # length N_total, one short tag per patch for the UI
def search_by_text(query: str, k: int = 50) -> np.ndarray: ...
```

Index space: `prompt_scores[:, i]` and `top_tags[i]` align with row `i` of `embeddings` (and `metadata`) as produced by `jesko/data.py:load_embeddings()`. This is the same global alignment the rest of the team relies on.

## Session-by-session execution map

This is the order we execute the docs in. Each later session reads the relevant doc as its primary input.

| Session | Driver doc | Output |
|---|---|---|
| 1 (this one) | — | Branch + downloaded cache + these 6 docs |
| 2 | `02-prompts.md` | Final ~6–10 prompt list, sanity-checked on 200 patches |
| 3 | `03-scoring.md` | `prompt_scores` for all ~7,500 patches + `top_tags` |
| 4 | `04-search.md` | `search_by_text()` + two demo queries chosen |
| 5 (slack) | `05-risks.md` | Polish, prune any prompts that misbehaved at scale |

If sessions 2–5 slip, the order to protect is: **prompts → scoring → search**. Prompts is the only step that requires human eyeballing, so it gates everything else.

## Out of scope this session

- No `.py` files in `natural_language/`.
- No PLIP loading.
- No prompt strings committed to code.
- No scoring runs.

This is **context-first**. Code follows the docs, not the other way around.

## Open questions

- Do we score against *all* patches, or only the post-quality-filter set Jesko produces? Defer to `01-data-pipeline.md` — current default is "all patches initially, swap to filtered when Jesko's `keep_mask` lands".
- How many prompts is the right number? Start with ~8, prune to ≤6 if any look unreliable. Decided in `02-prompts.md`.
- Do we expose the raw `prompt_scores` matrix to Meds, or only `top_tags`? Both. Meds may want raw scores for a "rank-by-prompt" filter. Decided in `03-scoring.md`.
