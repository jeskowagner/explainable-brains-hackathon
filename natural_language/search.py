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
