# natural_language/ — task index

Stream owner: Nick. Goal: text-to-patch search over the 7264 c-Fos brain patches.

Frontend consumer: **Node.js / JavaScript** (not Streamlit — ignore Streamlit references in `TEAM_PLAN.md`). All bulk outputs ship as JSON or `.npy`. Live search exposed via a small Python HTTP server.

## Five parallel task containers

Each task is a self-contained brief for a fresh Claude Code window. No task imports another's *code* during the parallel phase. The human sanity-check step is the only sync point.

| Task | What it builds | Parallel with | Depends on |
|------|----------------|---------------|------------|
| [A — PLIP bootstrap](task-A-plip-bootstrap.md) | Download weights + smoke test on 50 patches | B, C, D, E | nothing |
| [B — Prompts](task-B-prompts.md) | `prompts.py` with PROMPTS list (v1) | A, C, D, E | nothing |
| [C — Scoring code](task-C-scoring.md) | `score.py` (`score_prompts`, `make_top_tags`, `save_outputs`) | A, B, D, E | nothing at write time |
| [D — Search code](task-D-search.md) | `search.py` (`load_plip_for_search`, `search_by_text`) | A, B, C, E | nothing at write time |
| [E — API handoff](task-E-api-handoff.md) | `api.py`, `server.py`, `README.md` for the JS frontend | A, B, C, D | nothing |

## Post-parallel sequence

1. Run the Task A smoke test → confirm PLIP loads end-to-end.
2. Run Task C `score_prompts` once with Task B prompts → produce raw `prompt_scores`.
3. **Human sanity check** (~30 min, time-boxed) — eyeball top-5/bottom-5 per prompt, prune anything that doesn't visibly correspond.
4. Re-run Task C with pruned prompt list → write final `cache/prompt_scores.npy`, `cache/top_tags.json`, `cache/prompt_names.json`.
5. Start `natural_language/server.py` → smoke-test the `/search` endpoint with `curl`.
6. Hand off to frontend.

## How to spawn a task window

Open a fresh Claude Code session at the project root. Paste:

> Execute Task X from `natural_language/docs/`. Read these three files first:
> 1. `TEAM_PLAN.md` (ignore Streamlit references — the frontend is Node.js).
> 2. `natural_language/docs/CONTEXT.md` (shared technical brief).
> 3. `natural_language/docs/task-X-<name>.md` (your task).
>
> Then execute. Do not touch files outside `natural_language/`.

Substitute the actual task letter and filename.

## Shared brief

[`CONTEXT.md`](CONTEXT.md) — data shapes, math, output contract, hard rules, top 5 risks. Every task window reads this.
