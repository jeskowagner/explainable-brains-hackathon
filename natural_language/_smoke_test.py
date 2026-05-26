"""Task A smoke test: prove PLIP text-encoder + image-embedding dot product
works end-to-end on 50 sample patches. ASCII-only prints.

Run:
    uv run -X utf8 python natural_language/_smoke_test.py

Fallback if `vinid/plip` HF download fails:
    Download the PLIP state dict from the official PLIP GitHub release
    (PathologyFoundation/plip), then load into a vanilla CLIP shell:

        from transformers import CLIPModel
        import torch
        model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        state = torch.load("plip.pt", map_location="cpu")
        model.load_state_dict(state, strict=False)

    Do NOT swap a different model silently.
"""

import time
from pathlib import Path

import numpy as np
import torch
from transformers import CLIPModel, CLIPProcessor

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache"
MODEL_ID = "vinid/plip"
SAMPLE_N = 50
PROMPT = "dense cell signal"


def main() -> None:
    rng = np.random.default_rng(0)

    embeddings = np.load(CACHE / "embeddings.npy")
    assert embeddings.dtype == np.float32
    assert embeddings.ndim == 2 and embeddings.shape[1] == 512
    n_total = embeddings.shape[0]
    sample_idx = rng.choice(n_total, size=SAMPLE_N, replace=False)
    sample_idx.sort()
    sample = embeddings[sample_idx]

    print(f"embeddings: shape={embeddings.shape} dtype={embeddings.dtype}")
    print(f"sampled {SAMPLE_N} rows (seeded rng=0)")

    t0 = time.perf_counter()
    model = CLIPModel.from_pretrained(MODEL_ID)
    processor = CLIPProcessor.from_pretrained(MODEL_ID)
    model.eval()
    t_load = time.perf_counter() - t0

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device: {device}")
    print(f"model load wall time: {t_load:.2f}s")

    t1 = time.perf_counter()
    inputs = processor(
        text=[PROMPT], return_tensors="pt", padding=True, truncation=True
    )
    with torch.no_grad():
        txt = model.get_text_features(**inputs)
    txt = txt / txt.norm(dim=-1, keepdim=True)
    sims = (txt.cpu().numpy() @ sample.T)[0]
    t_encode = time.perf_counter() - t1
    print(f"text encode + dot product wall time: {t_encode*1000:.1f}ms")

    order = np.argsort(-sims)[:5]
    print(f"prompt: {PROMPT!r}")
    print("top-5 (local sample idx, global row, score):")
    for local_i in order:
        global_row = int(sample_idx[local_i])
        print(f"  local={int(local_i):3d}  global={global_row:5d}  score={float(sims[local_i]):.4f}")


if __name__ == "__main__":
    main()
