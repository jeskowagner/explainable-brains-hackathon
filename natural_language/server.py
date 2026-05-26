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
