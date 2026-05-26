# 05 — Risks and mitigations

Risks ordered by likelihood × impact. Highest first.

## 1. PLIP domain mismatch (H&E pathology vs fluorescence)

**Risk:** PLIP's training distribution is purple/pink stained pathology slides. Our patches are uint16 fluorescence microscopy. Cosine similarity in this space is informative but biased — prompts that *should* fire on a feature may not, and prompts that should *not* fire might. Several biology prompts may quietly produce nonsense.

**Mitigation:**
- Sanity-check protocol in `02-prompts.md` — eyeball top-5 / bottom-5 per prompt. Prune anything that does not visibly correspond.
- Treat the prompt list as **empirical, not aspirational** — only commit prompts that survive the eyeball.
- Negative-prompt cross-check against Jesko's `keep_mask`. If `"out of focus"` does not heavily overlap rejects, the prompt is unreliable.
- If multiple biology prompts fail, fall back to fewer but stronger prompts. Better 4 good than 10 noisy.

## 2. PLIP cache miss on first run

**Risk:** `vinid/plip` is **not** present in this Windows machine's HF hub cache (verified — `C:\Users\nick\.cache\huggingface\hub\` does not contain `vinid--plip`). First `CLIPModel.from_pretrained("vinid/plip")` call will hit Hugging Face Hub for ~400 MB.

**Mitigation:**
- Trigger the first load in a low-stakes script before demo time, not live during the demo.
- Verify network access from this machine before session 3.
- If HF rate-limits or is unreachable, fall back: PLIP can be obtained from the official PLIP GitHub releases as a state dict and loaded into a vanilla CLIP architecture (`openai/clip-vit-base-patch32` shell). Documented as a contingency, not a default.

## 3. Unicode console crashes on Windows

**Risk:** Multiple files (`bucket_access/bucket_utils.py` print statements) emit `✓` (`✓`) which the Windows console encodes as cp1253 by default and crashes. Already observed in this session — `cache_all_brains()` failed mid-download until we re-ran with `python -X utf8`.

**Mitigation:**
- Always invoke Python via `uv run python -X utf8 ...` on this Windows box, or set `$env:PYTHONUTF8 = "1"` for the session.
- Any new Python scripts in `natural_language/` should avoid emitting unicode glyphs in `print(...)` to be safe across teammate machines.

## 4. Index misalignment between embeddings, metadata, and prompt scores

**Risk:** The whole stream relies on row `i` meaning the same patch across `emb`, `meta`, `prompt_scores`, `top_tags`. Any sort, filter, or reindex that drops one side will silently misalign labels.

**Mitigation:**
- Treat all four as a frozen tuple. Never sort one without sorting the others identically.
- When subsetting for display, subset by mask or by integer index — never by reset_index.
- Defensive assertions at session-3 entry: `assert prompt_scores.shape[1] == len(emb) == len(meta) == len(top_tags)`.

## 5. Bucket bandwidth / Hetzner latency

**Risk:** Initial download via `cache_all_brains()` is ~12 × 50 MB patches + 12 small embeddings over Hetzner S3. On a slow connection or if Hetzner is degraded, this stalls everything.

**Mitigation:**
- Download is one-time and cached locally. Done in this session, not on the demo day.
- If a partial download is interrupted, `cache_all_brains()` is idempotent — re-run picks up.
- For the *embeddings* alone (~24 MB total), downloading is fast even on poor connections. If `cache/embeddings.npy` is present, scoring works without patches; only the eyeball sanity check needs the patch files.

## 6. Prompts that look fine on G001 but break on G002 (or vice versa)

**Risk:** A prompt may pass the sanity check on a random 200-patch sample dominated by one condition, then perform poorly on the other. Could leak as accidental condition prediction or just produce uneven explainability.

**Mitigation:**
- Stratify the sanity-check sample by `condition` (~100 G001 + 100 G002).
- After scoring all 7,500, spot-check the top-20 patches per prompt and look at condition split. ~50/50 is healthy. 19/1 is a red flag (drop the prompt or document the bias).

## 7. Time budget overrun

**Risk:** The hackathon clock is 16:00–20:00 with demos at 18:55. The natural-language stream is allocated H0–H3 in the TEAM_PLAN budget. Sanity-checking prompts in session 2 is the easiest place to overrun (it is the only step requiring human eyeballing).

**Mitigation:**
- Strict time-box on session 2: 60 minutes max for prompt sanity check. Stop pruning at the bell.
- Cut order if behind: **drop `search_by_text` integration first**, keep `top_tags`. Tags are what the per-patch justification panel needs; search is the cherry on top.
- The held-out coverage eval (Christos) is the headline result. Do not let our stream block his.

## 8. Streamlit caching errors

**Risk:** PLIP model and processor are not trivially picklable, and Streamlit's `@st.cache_resource` can choke on objects with non-default state. Meds will hit this, not us — but if our `load_plip_for_search()` returns a brittle tuple, it propagates.

**Mitigation:**
- Keep the loader function self-contained: returns `(model, processor, embeddings)` with no closures over locals.
- Document the cache decorator pattern in `04-search.md` for Meds to apply on his side.
- Test the loader from a plain Python REPL before handing it to Streamlit.

## 9. PLIP weights changed upstream

**Risk:** `vinid/plip` on Hugging Face Hub is an unpinned model. If the upstream maintainer revises the weights between now and demo time, behaviour changes silently.

**Mitigation:**
- Once loaded, the HF cache directory keeps the resolved snapshot. Do not delete it after first run.
- For maximum reproducibility, pin the model revision via `from_pretrained(..., revision="<sha>")` in session 3 code. Cheap defensive step.

## Cross-references

- Domain mismatch interacts with prompt quality → `02-prompts.md`
- Index alignment interacts with all consumers → `01-data-pipeline.md`, `03-scoring.md`
- PLIP cache miss is a one-time concern → `03-scoring.md`
- Time budget interacts with the team's overall sprint plan → `TEAM_PLAN.md` (hour-by-hour table)
