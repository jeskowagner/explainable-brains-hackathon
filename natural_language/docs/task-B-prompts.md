# Task B — Prompts

## Pre-reading (mandatory, in order)

1. `TEAM_PLAN.md` at project root — ignore Streamlit references; frontend is Node.js.
2. `natural_language/docs/CONTEXT.md` — shared technical brief.

## What this task is

Write the initial list of natural-language prompts that get scored against every patch. Text-only work — no model loading, no scoring.

## Parallel with

A, C, D, E.

## Build

Create `natural_language/prompts.py`:

```python
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
```

## Phrasing rules (every prompt obeys all)

1. Short noun-phrase, not a sentence. PLIP trained on alt-text captions.
2. Lowercase, no trailing punctuation.
3. One concept per prompt. Compound prompts (`"dense c-Fos in white matter"`) score badly — PLIP averages instead of conjoining.
4. No hedges (`"possibly"`, `"looks like"`).
5. No prompts that name scan metadata (`"G002 mouse brain"`). Leaks ground truth.
6. No template wrapping (`"a photo of X"`, `"histopathology image of Y"`). Plain noun-phrases score best in our setup.

## Done criteria

- `natural_language/prompts.py` exists, importable.
- `PROMPTS` is a list of 6–10 strings, all obeying the phrasing rules.
- Module docstring states that order matters.

## Note for downstream

This list ships as **v1**. Final pruning happens after the human sanity check that runs once tasks A and C are both complete. Do not pre-prune based on your own taste — leave that to the eyeball gate.

## Don't

- Don't load PLIP. Don't score anything. Text-only.
- Don't add prompts that reference mouse-specific neuroanatomy (`"corpus callosum"`, `"cortex layer 5"`). PLIP was not trained on rodent text.
- Don't create more than 10 prompts. Better fewer, stronger.
- Don't put scores or thresholds in this file — those live in `score.py`.
