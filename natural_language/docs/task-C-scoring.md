# Task C — Scoring code

## Pre-reading (mandatory, in order)

1. `TEAM_PLAN.md` at project root — ignore Streamlit references; frontend is Node.js.
2. `natural_language/docs/CONTEXT.md` — shared technical brief (especially the math section).

## What this task is

Write the code that turns prompts + image embeddings into `prompt_scores` and `top_tags`. Code only — do not bulk-run yet (the actual run waits until task A is done and task B has finalized the prompt list).

## Parallel with

A, B, D, E. No code-time dependency on any other task.

## Build

Create `natural_language/score.py`:

```python
"""Scoring: prompts x image embeddings -> prompt_scores and top_tags."""

import json
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache"


def score_prompts(
    prompt_names: list[str],
    model,            # transformers.CLIPModel
    processor,        # transformers.CLIPProcessor
    image_embeddings: np.ndarray,  # (N, 512) float32, already L2-normalized
) -> np.ndarray:
    """Return (P, N) float32 cosine-similarity matrix."""
    assert image_embeddings.ndim == 2 and image_embeddings.shape[1] == 512
    assert image_embeddings.dtype == np.float32

    inputs = processor(
        text=prompt_names, return_tensors="pt", padding=True, truncation=True
    )
    with torch.no_grad():
        txt = model.get_text_features(**inputs)
    # MUST normalize text features (see CONTEXT.md hard rule #4).
    txt = txt / txt.norm(dim=-1, keepdim=True)

    scores = (txt.cpu().numpy() @ image_embeddings.T).astype(np.float32)
    assert scores.shape == (len(prompt_names), image_embeddings.shape[0])
    return scores


def make_top_tags(
    prompt_scores: np.ndarray,   # (P, N)
    prompt_names: list[str],     # length P
    k: int = 2,
    min_score: float = 0.05,
) -> list[str]:
    """One short label per patch, joining top-k prompts by descending score.

    Patches whose best prompt scores below `min_score` get the neutral label
    "(no strong tag)" to avoid misleading the UI on noise patches.
    """
    P, N = prompt_scores.shape
    assert P == len(prompt_names)

    out: list[str] = []
    for i in range(N):
        col = prompt_scores[:, i]
        if col.max() < min_score:
            out.append("(no strong tag)")
            continue
        top_idx = np.argsort(-col)[:k]
        out.append(", ".join(prompt_names[j] for j in top_idx))
    assert len(out) == N
    return out


def save_outputs(
    prompt_scores: np.ndarray,
    prompt_names: list[str],
    top_tags: list[str],
    cache_dir: Path = CACHE,
) -> None:
    """Write outputs in both binary (npy) and JSON forms.

    JSON-friendly outputs so the Node.js frontend can read them directly.
    """
    assert prompt_scores.shape[0] == len(prompt_names)
    assert prompt_scores.shape[1] == len(top_tags)

    cache_dir.mkdir(exist_ok=True)
    np.save(cache_dir / "prompt_scores.npy", prompt_scores)
    with open(cache_dir / "prompt_names.json", "w", encoding="utf-8") as f:
        json.dump(prompt_names, f, ensure_ascii=False, indent=2)
    with open(cache_dir / "top_tags.json", "w", encoding="utf-8") as f:
        json.dump(top_tags, f, ensure_ascii=False, indent=2)

    print(f"wrote prompt_scores.npy shape={prompt_scores.shape}")
    print(f"wrote prompt_names.json prompts={len(prompt_names)}")
    print(f"wrote top_tags.json patches={len(top_tags)}")
```

## Done criteria

- `natural_language/score.py` exists with the three functions above.
- All defensive asserts present at module boundaries.
- ASCII-only prints (no unicode glyphs).
- Importable without side effects — no top-level model loading, no top-level file reads beyond constants.
- Type hints on every public signature.

## Notes for the spawned window

- Top-K default is 2. K=1 is punchier but K=2 catches "this patch is on the boundary of two concepts".
- The `min_score=0.05` floor is conservative; tuned later if needed.
- Do NOT add a `if __name__ == "__main__"` block. The bulk run is driven by a separate verification step after the human sanity check.

## Don't

- Don't import from `natural_language.prompts` here. The caller passes `prompt_names` in.
- Don't load PLIP at module level.
- Don't filter by quality mask. Score everything; filtering happens downstream.
- Don't apply CLIP's `logit_scale` or softmax — we want raw cosine, not zero-shot classification.
- Don't write to anywhere other than `cache/`.
