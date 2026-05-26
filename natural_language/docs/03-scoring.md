# 03 — Scoring: from prompts to `prompt_scores` and `top_tags`

## Intent

Take the final prompt list from `02-prompts.md` and the embeddings from `01-data-pipeline.md` and produce:

- `prompt_scores: (P, N) float32` — cosine similarity, every prompt × every patch
- `top_tags: list[str]` of length N — a one-line human-readable label per patch

These two are the entire output of the scoring step. They get cached to disk under `cache/` and consumed by `04-search.md` and by Meds' UI.

## The math

PLIP shares CLIP architecture. Both encoders project to the same 512-d space:

```
text_emb:  (P, 512)   # from CLIPModel.get_text_features(**inputs)
img_emb:   (N, 512)   # from cache/embeddings.npy (already L2-normalised)

# normalise text — critical
text_emb = text_emb / text_emb.norm(dim=-1, keepdim=True)

# cosine similarity = dot product after normalisation
prompt_scores = text_emb @ img_emb.T   # (P, N) float32
```

That is the whole thing. ~3 lines of real work. No softmax, no temperature, no logit_scale — those would be the CLIP zero-shot classification head, which we are not building.

## The normalisation gotcha

The image embeddings on disk are **already L2-normalised** (per the bucket producer). The text embeddings coming out of `CLIPModel.get_text_features` **are not**. Forgetting to normalise text gives a tensor that still looks reasonable but has the wrong scale, and top-K rankings shift in non-obvious ways.

**Rule:** every time we call `get_text_features`, the very next line normalises. No exceptions.

## Model loading

```python
from transformers import CLIPModel, CLIPProcessor

MODEL_ID = "vinid/plip"
model     = CLIPModel.from_pretrained(MODEL_ID)
processor = CLIPProcessor.from_pretrained(MODEL_ID)
model.eval()
```

- Use `CLIPModel` and `CLIPProcessor`, **not** any PLIP-specific class. There isn't one in `transformers`.
- First load on this Windows box pulls ~400 MB from Hugging Face Hub (PLIP weights not cached locally — verified). Allow network.
- Inference-only — no gradient, no training.

## Compute budget

- 8 prompts × 7,500 patches × 512-d → trivial. Single dot product on CPU, under a second.
- The cost is the *text encoder forward pass* — 8 calls of `get_text_features`. Also trivial.
- We do **not** re-embed images. Bucket embeddings are authoritative.

## `top_tags` derivation

For each patch `i`:

1. Look at `prompt_scores[:, i]` — its score against each of the P prompts.
2. Take the top-K prompts (K=2 by default).
3. Format into a single short string: `"dense c-Fos signal, scattered neurons"`.

```python
def make_top_tags(prompt_scores: np.ndarray, prompt_names: list[str], k: int = 2) -> list[str]:
    """For each patch column, format the top-k prompt names by score into one string."""
    ...
```

(Signature only — implementation lives in session 3.)

Tag display rules:

- Prompts are listed in **descending score order**.
- Separator: `", "`.
- No score values in the tag string (Meds can show scores separately if he wants).
- If the top prompt's score is below an "uninformative" floor (say, < 0.05 absolute), output `"(no strong tag)"`. Prevents misleading labels on noise patches.

## Cache layout

After scoring:

- `cache/prompt_scores.npy` — `(P, N) float32`
- `cache/prompt_names.txt` — one prompt per line, same order as `prompt_scores` rows
- `cache/top_tags.txt` — one tag per line, same order as `embeddings.npy` rows

All three are derived data — re-creatable from the prompt list + embeddings. We commit none of them.

## What this step does NOT do

- Does not filter by `keep_mask`. We score everything; filtering happens at display time.
- Does not produce per-cluster summaries. That is selection's concern.
- Does not embed images. That was done in the bucket upstream.
- Does not handle ambiguous prompts. Pruning happened in session 2 (`02-prompts.md`).

## Open questions

- Top-K for `top_tags` — is K=2 the right default, or is K=1 cleaner? Tradeoff: K=1 is punchier, K=2 catches the "this patch is on the boundary of two concepts" case. Decide after seeing real outputs.
- Do we want a per-prompt threshold for "this tag fires on this patch" so that a tag string can include 0, 1, 2 tags depending on confidence? More honest but more code. Defer.
- Do we expose `prompt_scores` raw to Meds, or only the formatted `top_tags`? Raw is small, ship both.
- Do we need batch-text-encoding for the 8 prompts, or one-by-one? Either is fine at this scale. Default to a single batched call.
