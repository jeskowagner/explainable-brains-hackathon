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
