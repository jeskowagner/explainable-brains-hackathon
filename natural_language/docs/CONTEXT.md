# Shared context for the natural-language stream

Read this before starting any task in this directory.

## What this stream produces

A text-to-patch search layer over 7264 c-Fos brain patches. Three deliverables:

1. `prompt_scores`: `(P, N)` float32 cosine-similarity matrix (P prompts × N patches).
2. `top_tags`: length-N list of short human-readable labels per patch.
3. `search_by_text(query, k)`: takes a typed query, returns top-k patch indices.

Frontend is **Node.js / JavaScript**. Ignore Streamlit references in `TEAM_PLAN.md`. All outputs must be either:
- JSON files (frontend reads at startup), or
- A Python function exposed via the HTTP server in `natural_language/server.py` (task E).

## Data we consume

```python
from jesko.data import load_embeddings

emb, meta = load_embeddings()
# emb:  (7264, 512) float32, L2-normalized, one row per patch
# meta: pd.DataFrame, 7264 rows, same row order
```

Cache files (already populated on this machine):
- `cache/embeddings.npy` — `(7264, 512)` float32
- `cache/metadata.parquet` — 7264 rows
- `cache/patches/<scan>.npy` — 12 files, `(n_brain, 256, 256)` uint16

Row `i` of `emb`, `meta`, and every output (`prompt_scores[:, i]`, `top_tags[i]`) refers to the same patch. This alignment is sacred — never sort one without sorting all.

Condition split (verified): Control 3618, Semaglutide 3646.

## The math

PLIP shares CLIP architecture. Text and image encoders project to the same 512-d space. Both vectors must be L2-normalized for cosine similarity to equal dot product:

```python
img = emb                                   # already normalized
txt = model.get_text_features(**inputs)
txt = txt / txt.norm(dim=-1, keepdim=True)  # MUST normalize manually
scores = txt @ img.T                        # (P, N)
```

`get_text_features` does NOT auto-normalize. Forgetting this line is the #1 silent bug — rankings shift but everything still "looks fine".

## Model loading

```python
from transformers import CLIPModel, CLIPProcessor

MODEL_ID  = "vinid/plip"
model     = CLIPModel.from_pretrained(MODEL_ID)
processor = CLIPProcessor.from_pretrained(MODEL_ID)
model.eval()
```

Use `CLIPModel`, not any PLIP-specific class (there isn't one). First load on this machine downloads ~400 MB from Hugging Face Hub — see task A.

## Domain caveat

PLIP was trained on H&E pathology slides (purple/pink stains). Our patches are uint16 fluorescence microscopy. Cosine similarity is informative but biased. Prompts must be eyeballed before trust.

## Output contract (frozen)

```python
prompt_scores:   np.ndarray, (P, N) float32   # cache/prompt_scores.npy
prompt_names:    list[str], length P          # cache/prompt_names.json
top_tags:        list[str], length N          # cache/top_tags.json
search_by_text:  (query: str, k: int) -> np.ndarray  # natural_language.api
```

JSON writes use:
```python
import json
with open("cache/top_tags.json", "w", encoding="utf-8") as f:
    json.dump(top_tags, f, ensure_ascii=False, indent=2)
```

The frontend consumes `prompt_names.json` and `top_tags.json` at startup, then calls the `/search` HTTP endpoint for live queries. `prompt_scores.npy` is Python-only (kept for selection-stream reweighting and debugging).

## Hard rules

1. **No Streamlit.** Frontend is Node.js. Outputs are JSON or HTTP endpoints, not Streamlit widgets.
2. **No fine-tuning.** PLIP is a frozen encoder. Inference only.
3. **No image re-embedding.** Use `cache/embeddings.npy` as-is.
4. **Always L2-normalize text features** immediately after `get_text_features`.
5. **Preserve row order.** Never sort `emb` without sorting `meta` identically.
6. **Run Python via `uv run -X utf8 python ...`** on this Windows box — cp1253 console crashes on unicode glyphs in `print()`.
7. **No unicode glyphs** (`✓`, `→`, etc.) in new code. ASCII only in prints.
8. **Defensive asserts** at every module boundary. Example:
   `assert prompt_scores.shape[1] == len(emb) == len(meta) == len(top_tags)`.

## Top 5 risks

1. **PLIP HF download fails.** ~400 MB, not in local HF cache. Fallback: PLIP GitHub release weights loaded into `openai/clip-vit-base-patch32` shell. Task A handles.
2. **Domain mismatch undiscovered.** A prompt that looks right may not fire correctly on fluorescence. Mitigation: human eyeball gate after task C.
3. **Index misalignment.** Silent corruption if any code resets index or sorts unilaterally. Defensive asserts at every boundary.
4. **Forgetting to L2-normalize text features.** Causes silent rank corruption. Every `get_text_features` call is immediately followed by `/ .norm(...)`.
5. **Time overrun on sanity check.** Time-box: 30 min. Better 4 good prompts than 10 noisy.

## Reference

- Project root: `c:\Users\nick\Desktop\Projects\hackathon\explainable-brains-hackathon`
- Python invocation: `uv run -X utf8 python ...`
- Data loader: `jesko/data.py` (already implemented, do not modify)
- HF cache dir: `C:\Users\nick\.cache\huggingface\hub\`
