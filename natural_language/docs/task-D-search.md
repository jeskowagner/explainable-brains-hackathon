# Task D — Search code

## Pre-reading (mandatory, in order)

1. `TEAM_PLAN.md` at project root — ignore Streamlit references; frontend is Node.js.
2. `natural_language/docs/CONTEXT.md` — shared technical brief.

## What this task is

Expose live, open-vocabulary text search. Judge types a query → top-k patch indices returned. This becomes the live "type-and-see" demo moment.

## Parallel with

A, B, C, E. No code-time dependency on any of them.

## Build

Create `natural_language/search.py`:

```python
"""Free-text patch search via PLIP text encoder."""

from pathlib import Path

import numpy as np
import torch
from transformers import CLIPModel, CLIPProcessor

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache"
MODEL_ID = "vinid/plip"


def load_plip_for_search() -> tuple[CLIPModel, CLIPProcessor, np.ndarray]:
    """Load PLIP and the precomputed image embeddings.

    Returns a flat tuple (model, processor, embeddings). No closures over
    locals — safe to wrap with any external caching layer (FastAPI startup,
    long-lived script, etc.).
    """
    model = CLIPModel.from_pretrained(MODEL_ID)
    processor = CLIPProcessor.from_pretrained(MODEL_ID)
    model.eval()

    embeddings = np.load(CACHE / "embeddings.npy")
    assert embeddings.dtype == np.float32
    assert embeddings.ndim == 2 and embeddings.shape[1] == 512

    return model, processor, embeddings


def search_by_text(
    query: str,
    model: CLIPModel,
    processor: CLIPProcessor,
    embeddings: np.ndarray,
    k: int = 50,
) -> np.ndarray:
    """Return top-k indices into `embeddings`, ranked by cosine similarity."""
    inputs = processor(
        text=[query], return_tensors="pt", padding=True, truncation=True
    )
    with torch.no_grad():
        t = model.get_text_features(**inputs)
    # MUST normalize text features (see CONTEXT.md hard rule #4).
    t = t / t.norm(dim=-1, keepdim=True)

    sims = (t.cpu().numpy() @ embeddings.T)[0]   # (N,)
    return np.argsort(-sims)[:k]
```

## Latency budget

- Text encode: 20–80 ms on CPU for a single query.
- Dot product `(1, 512) @ (512, 7264)`: microseconds.
- Top-K argsort over 7264 floats: sub-millisecond.

Round trip well under 200 ms — snappy enough for live use without caching tricks.

## Done criteria

- `natural_language/search.py` exists with both functions.
- `load_plip_for_search` returns a flat 3-tuple, no closures.
- `search_by_text` normalizes text features immediately after `get_text_features`.
- ASCII-only prints (none expected in this module, but no unicode if added).
- Importable without side effects.

## Don't

- Don't re-rank by quality, brain, or condition. Pure cosine. Filtering is the frontend's concern.
- Don't deduplicate by scan — a query may legitimately want multiple patches from the same brain.
- Don't return scores by default. If E needs them, add a `return_scores: bool` parameter later — keep the default surface minimal.
- Don't handle the empty-query case. Caller (frontend / server) guards before calling.
- Don't load PLIP at module level. Lazy via `load_plip_for_search` only.
