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
