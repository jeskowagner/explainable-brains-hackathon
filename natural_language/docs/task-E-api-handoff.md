# Task E — API handoff for the Node.js frontend

## Pre-reading (mandatory, in order)

1. `TEAM_PLAN.md` at project root — ignore Streamlit references; frontend is Node.js.
2. `natural_language/docs/CONTEXT.md` — shared technical brief.

## What this task is

Define the single import surface the Python side exposes, *and* the HTTP bridge the Node.js frontend uses for live search. This is the contract between the natural-language stream and Meds' frontend.

## Parallel with

A, B, C, D.

## Build

### 1. `natural_language/api.py` — Python-side public surface

```python
"""Public surface for the natural-language stream.

Bulk outputs are JSON files in cache/ (frontend reads at startup).
Live search is served via HTTP — see natural_language/server.py.

Python callers import everything from here:

    from natural_language.api import PROMPT_NAMES, load_top_tags
    from natural_language.api import load_plip_for_search, search_by_text
"""

import json
from pathlib import Path

import numpy as np

from natural_language.prompts import PROMPTS as PROMPT_NAMES
from natural_language.search import load_plip_for_search, search_by_text

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache"


def load_prompt_scores() -> np.ndarray:
    """(P, N) float32 cosine-similarity matrix from disk."""
    return np.load(CACHE / "prompt_scores.npy")


def load_top_tags() -> list[str]:
    """Length-N list of one-line patch labels."""
    with open(CACHE / "top_tags.json", "r", encoding="utf-8") as f:
        return json.load(f)


__all__ = [
    "PROMPT_NAMES",
    "load_prompt_scores",
    "load_top_tags",
    "load_plip_for_search",
    "search_by_text",
]
```

### 2. `natural_language/server.py` — FastAPI bridge for Node.js

```python
"""HTTP bridge between the Python natural-language stream and the JS frontend.

Run with:
    uv run -X utf8 uvicorn natural_language.server:app --port 8765

Endpoints:
    GET  /health                         -> {"ok": true}
    POST /search                         -> {"indices": [int, ...]}
        body: {"query": str, "k": int = 50}
"""

from fastapi import FastAPI
from pydantic import BaseModel

from natural_language.search import load_plip_for_search, search_by_text

app = FastAPI()

# Load PLIP once at server startup — heavy import side effect is intentional here.
MODEL, PROCESSOR, EMBEDDINGS = load_plip_for_search()


class SearchRequest(BaseModel):
    query: str
    k: int = 50


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/search")
def search(req: SearchRequest) -> dict:
    indices = search_by_text(req.query, MODEL, PROCESSOR, EMBEDDINGS, k=req.k)
    return {"indices": indices.tolist()}
```

### 3. `natural_language/README.md` — frontend-facing documentation

```markdown
# natural_language — frontend integration

The natural-language stream ships two surfaces.

## 1. Bulk JSON outputs (frontend reads at startup)

| Path | Schema |
|------|--------|
| `cache/prompt_names.json` | `string[]`, length P |
| `cache/top_tags.json`     | `string[]`, length N — one label per patch |
| `cache/prompt_scores.npy` | float32 matrix `[P, N]` — Python-only, kept for debugging |

Row alignment: `top_tags[i]` corresponds to row `i` of `cache/embeddings.npy` and row `i` of `cache/metadata.parquet`. Use the same `i` everywhere.

`top_tags.json` example:
```json
[
  "dense c-Fos signal, scattered c-Fos positive neurons",
  "tissue edge, empty background",
  "(no strong tag)"
]
```

## 2. Live search HTTP endpoint

Start the server (Python side):
```
uv run -X utf8 uvicorn natural_language.server:app --port 8765
```

JS call:
```javascript
const resp = await fetch("http://localhost:8765/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: "dense c-Fos signal", k: 20 }),
});
const { indices } = await resp.json();   // number[], length k
// indices[j] is a row number into cache/embeddings.npy / cache/metadata.parquet
```

Latency target: under 200 ms round-trip on CPU.

## Mapping an index back to a patch

`indices[j]` is a global row number. To display the patch:

1. Read row `indices[j]` of `cache/metadata.parquet` → fields `scan_name`, `patch_idx` (within-brain row).
2. Load `cache/patches/<scan_name>.npy` → take row `patch_idx` → `(256, 256) uint16`.
3. Render to uint8 for display. Either:
   - frontend does the percentile normalization itself, or
   - Python serves a pre-rendered PNG via a `/patch/<i>` endpoint (out of scope here — add later if frontend asks).
```

## Done criteria

- `natural_language/api.py` importable. `__all__` lists the public surface.
- `natural_language/server.py` starts and `/health` returns `{"ok": true}`. Smoke test:
  ```
  uv run -X utf8 uvicorn natural_language.server:app --port 8765 &
  curl http://localhost:8765/health
  ```
- `natural_language/README.md` documents JSON schemas, HTTP contract, and the index-to-patch mapping.
- ASCII-only prints. No unicode.

## Notes

- `fastapi`, `uvicorn`, `pydantic` should already be in the env (verify with `uv pip list`). If absent, add to `pyproject.toml`.
- Model load at startup is heavy (~5–10 s) but happens once — fine for the demo.

## Don't

- Don't add caching middleware. Model is loaded once at startup; that's enough.
- Don't expose Python objects (DataFrames, numpy arrays) over HTTP. JSON only.
- Don't write a Streamlit wrapper. Frontend is Node.js.
- Don't add authentication. Local-only demo.
- Don't add CORS unless the frontend explicitly fails on it during integration. If needed, the smallest patch is:
  ```python
  from fastapi.middleware.cors import CORSMiddleware
  app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
  ```
