# 04 — Free-text patch search

## Intent

Expose a single function:

```python
def search_by_text(query: str, k: int = 50) -> np.ndarray:
    """Return the top-k indices into emb/meta, ranked by cosine similarity to `query`."""
```

This is the entry point Meds wires to a Streamlit text input. Typed query → embedded once → top-k patches displayed. The whole demo "type and see" moment depends on this being snappy.

## Why this matters separately from `top_tags`

`top_tags` is precomputed — a fixed vocabulary of P prompts. `search_by_text` is **runtime, open-vocabulary** — judges can type anything. The two surfaces serve different demo moments:

- `top_tags` proves: "we can describe what we picked." (Interpretability for a fixed selection.)
- `search_by_text` proves: "we can find what you ask for." (Interactive discoverability.)

## Algorithm

Exactly the same math as `03-scoring.md`, run on a single query:

```python
def search_by_text(query: str, k: int = 50) -> np.ndarray:
    inputs = processor(text=[query], return_tensors="pt", padding=True, truncation=True)
    with torch.no_grad():
        t = model.get_text_features(**inputs)
    t = t / t.norm(dim=-1, keepdim=True)        # (1, 512), normalised
    sims = (t.cpu().numpy() @ embeddings.T)[0]  # (N,)
    return np.argsort(-sims)[:k]                # top-k descending
```

(Signature only — full implementation in session 4.)

## Latency target

- Text encode: ~20–80 ms on CPU for a single query (tiny model, single token sequence). Acceptable.
- Cosine sim: dot product of `(1, 512) @ (512, N=7500)` → microseconds. Free.
- Top-K sort: `argsort` over 7,500 floats → sub-millisecond.

Total round trip: well under 200 ms. Snappy enough for live demo with no caching tricks needed.

## Caching the encoder

The model and processor must be loaded **once** for the whole Streamlit session. Meds uses `@st.cache_resource` on the loader function. We provide the loader; he caches it.

```python
def load_plip_for_search() -> tuple[CLIPModel, CLIPProcessor, np.ndarray]:
    """Return (model, processor, embeddings) ready for search. Slow first call."""
    ...
```

The `embeddings` returned here is the cached `cache/embeddings.npy` so the search function has its right-hand-side preloaded.

## What `search_by_text` should NOT do

- Should not re-rank by quality score, brain, or condition. Pure cosine ranking. Filters are Meds' UI concern, layered on top.
- Should not de-duplicate by scan. A judge searching for `"tissue edge"` may legitimately want 5 patches from the same brain if they are the closest matches.
- Should not return scores by default. Caller can opt in via a parameter if needed.
- Should not handle the empty query. Meds' UI guards against it before calling.

## Integration with Christos's selection (optional, lower priority)

`prompt_scores` could re-weight Christos's typiclust pick:

```python
final_score = typiclust_score - alpha * artifact_prompt_score
```

This biases away from patches that score high on `"out of focus"` / `"empty background"`. **Implement only if time permits and Christos's coverage table does not already look strong.** Risks tying our reliability to PLIP's domain mismatch on quality prompts.

## Demo queries to lock in

Two queries get rehearsed for the demo:

1. **Anchored**: `"dense c-Fos signal"` — proves the obvious case works. Top results should look biologically convincing to a neuroscientist judge.
2. **Creative**: TBD. Candidates:
   - `"cells near a tissue boundary"` — tests compositional generalisation
   - `"image with a few bright spots"` — tests visual-pattern phrasing
   - `"sparse activation in cortex"` — tests anatomical reasoning (will probably underperform — PLIP is rodent-blind)

Choose the creative query at session 4 based on what actually returns visually sensible results during testing. The query that looks most impressive without us having to apologise wins.

## What this step does NOT do

- No fuzzy matching, no synonyms, no spell correction. Cosine sim only.
- No multi-query / boolean combinators (`"A AND NOT B"`).
- No saved-query history. Each query is independent.
- No prompt rewriting or template wrapping.

## Open questions

- Should `k` default to 50 or to something smaller (10–20) so the grid stays scannable? Decide based on Meds' grid layout.
- Should we expose a sibling `search_by_text_with_scores(query, k)` that also returns the similarity scores? Useful for "this match is strong vs weak" colouring in the UI. Decide once we see Meds' panel design.
- Do we need a sanity guardrail for queries that score uniformly low (no patch above ~0.1)? Could return an empty array with a message. Defer until we hit it in practice.
