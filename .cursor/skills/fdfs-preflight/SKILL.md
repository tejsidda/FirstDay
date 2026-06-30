---
name: fdfs-preflight
description: Run a quick preflight for FDFS changes. Use when finishing a bug fix, before committing, before opening a PR, or when the user asks for a sanity check/build check/deploy readiness check.
disable-model-invocation: true
---

# FDFS Preflight

## Purpose

Run a short, repeatable validation before calling a fix "done".

## Checklist

Use this exact order:

1. Search for unresolved merge markers:
   - `rg "^<<<<<<<|^=======|^>>>>>>>" src`
2. Verify TMDB search proxy path works:
   - `Invoke-WebRequest -Uri "http://localhost:3000/api/tmdb/search?q=inception" -UseBasicParsing`
3. Verify poster proxy path works:
   - `Invoke-WebRequest -Uri "http://localhost:3000/api/poster-proxy?url=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw500%2FgLvj9Z8dU8KmitYkPdJUiTwAqqn.jpg" -UseBasicParsing`
4. Run production build:
   - `npm run build`
5. If any step fails, fix and rerun only failed step(s), then rerun `npm run build`.

## Report Format

Return a concise report with:

- `merge_markers`: pass/fail
- `tmdb_search_api`: pass/fail
- `poster_proxy_api`: pass/fail
- `build`: pass/fail
- `blocking_issue`: short sentence or `none`

## Notes

- Do not print secrets from `.env.local`.
- Prefer root-cause fixes over temporary workarounds.
- If build fails from merge markers, resolve markers first before other debugging.
