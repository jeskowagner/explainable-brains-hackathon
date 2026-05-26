"""Hand-curated prompt list for PLIP text-encoder scoring.

Order matters: prompt_scores[i, :] corresponds to PROMPTS[i]. Reordering this
list silently reorders the score tensor and every downstream label.
"""

PROMPTS: list[str] = [
    # Signal (3)
    "dense c-Fos signal",
    "scattered c-Fos positive neurons",
    "sparse activity",

    # Anatomy (3)
    "fiber tract / white matter",
    "tissue edge",
    "cell body cluster",

    # Quality (2)
    "out of focus",
    "empty background",
]
