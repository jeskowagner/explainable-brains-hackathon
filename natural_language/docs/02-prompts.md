# 02 — Prompt set v1

## Intent

A small, hand-curated set of natural-language phrases. Each prompt is embedded once via PLIP's text encoder, then dotted against the precomputed image embeddings to give one row of `prompt_scores`. Quality of this list directly determines explainability quality.

## Starting list (~8 prompts)

Three buckets. Numbers picked deliberately small — we will prune to ≤6 if any look unreliable.

### Signal (3)
- `"dense c-Fos signal"`
- `"scattered c-Fos positive neurons"`
- `"sparse activity"`

Rationale: the dataset is c-Fos brain scans. These prompts mirror the kind of finding a neuroscientist would call out — high activity, distributed activity, near-zero activity.

### Anatomy (3)
- `"fiber tract / white matter"`
- `"tissue edge"`
- `"cell body cluster"`

Rationale: anatomical context is the second axis a domain expert wants. Tissue-edge fires on the brain boundary, white-matter on bands of fibres, cell-body-cluster on dense soma regions. All three are visually distinct in fluorescence even though PLIP saw them as H&E.

### Quality (2)
- `"out of focus"`
- `"empty background"`

Rationale: doubles as a sanity check on Jesko's filter. The top patches by `"out of focus"` should heavily overlap Jesko's rejects. If they don't, either PLIP is blind to focus in fluorescence, or Jesko's filter is biased — either is a finding.

## Prompt phrasing rules

- Short, concrete phrases. **Not** sentences. PLIP was trained on alt-text style captions.
- Lowercase, no trailing punctuation. The pathology corpus is mostly lowercase noun-phrases.
- Avoid bucket-leaking words (don't put "dense" in two prompts in different buckets unless on purpose).
- Avoid hedges ("possibly", "looks like") — they confuse cosine similarity.
- One concept per prompt. Compound prompts (`"dense c-Fos in white matter"`) score badly because PLIP averages instead of conjoining.

## Sanity-check protocol

This is the only step in the entire stream that requires a human eye. We must do it before we trust any of these prompts.

For each prompt:

1. Score it against a 200-patch random subsample of `emb` (no need to bulk-score the full 7,500 for the eyeball).
2. Pull the **top-5** patches by score → render with `patch_to_uint8()` → look at them.
3. Pull the **bottom-5** patches by score → render → look at them.
4. Ask: *does the top-5 visibly correspond to what the prompt claims? Does the bottom-5 visibly NOT correspond?*

Decision rule per prompt:

| Top-5 looks right? | Bottom-5 looks wrong? | Action |
|---|---|---|
| yes | yes | Keep |
| yes | meh | Keep, note "weak negative pole" |
| meh | yes | Demote — still usable for `top_tags` but not for `search_by_text` |
| no | no | **Drop** |

Better 4 good prompts than 10 noisy ones.

## Calibration: G001 vs G002

After pruning, spot-check that no prompt is biased to one condition. Pull the top-20 patches per prompt, count `condition` split. A ~50/50 split (matching the corpus balance) is healthy. A 19/1 split is a red flag — the prompt may be picking up scan-acquisition artifacts rather than biology.

## Storage

The final prompt list lives as a Python literal in `natural_language/prompts.py` (created in session 2). One module-level constant:

```python
PROMPTS: list[str] = [...]   # the surviving prompts, in display order
```

Order matters: `prompt_scores[i, :]` is the i-th prompt in this list. Reordering the list silently reorders the scoring tensor.

## What we deliberately are not doing

- No prompt engineering with templates ("a photo of X", "histopathology image of Y"). PLIP's pathology bias means generic templates hurt more than they help. Plain noun-phrases score best in our setup.
- No prompt-tuning / soft prompts. No fine-tuning of any kind.
- No multi-language prompts.
- No prompts that reference scan metadata (`"G002 mouse brain"`) — that leaks ground truth.

## Open questions

- Should we include a `"high c-Fos"` prompt as well as `"dense c-Fos signal"`? Likely redundant — decide after sanity check.
- Should anatomy prompts use mouse-specific terms (`"corpus callosum"`, `"cortex layer 5"`)? Risky — PLIP was not trained on rodent neuroanatomy text. Default: stay generic.
- Do we want a prompt for `"artifact"` directly? Already implicit via `"out of focus"` and `"empty background"`; adding a third might dilute. Decide after sanity check.
- For `top_tags` display: do we use the prompt verbatim or a shortened form? See `03-scoring.md`.
