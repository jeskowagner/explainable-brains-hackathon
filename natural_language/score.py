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
        txt_out = model.get_text_features(**inputs)
    # transformers >=5 wraps the tensor in BaseModelOutputWithPooling.
    txt = txt_out.pooler_output if hasattr(txt_out, "pooler_output") else txt_out
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
