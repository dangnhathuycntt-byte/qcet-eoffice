# Wave 0 Baseline (shard-baseline)

Owner: qcet-builder (shard-baseline)
Owned path: `artifacts/ux-v5-1/baseline/**`
Plan anchors: §8 WAVE 0 — BASELINE; §42 T91 side-by-side evidence.

This directory holds the immutable **before** image for the World-Class UX V5.1
side-by-side comparison (§42 T91). It was produced before any UX V5.1 code mutation.

## Contents

| Path | What it is |
|---|---|
| `git-snapshot.txt` | Verbatim branch/HEAD/`log -5`/node/npm, the full `git status --porcelain` list, and the PRESERVE-ONLY dirty-file list. |
| `env-disposal-proof.txt` | Proof that `npm test` targets the disposable `qcet_test` DB (never the dev `qcet_eoffice` DB). |
| `browser-probe.txt` | Measured headless-Chromium capability + the authenticated same-data capture proof. |
| `states/BASELINE-STATES.md` | The full state matrix with routes, capture methods, and status. |
| `states/<route>/<state>/baseline.<vp>.png` | The 28 captured frames (14 states × 1440x900 + 390x844). |
| `states/<route>/<state>/notes.md` | Per-state provenance (route, method, auth, same-data conditions). |
| `tools/capture-baseline.mjs` | Thin delegating shim -> canonical `scripts/capture-baseline.mjs`. |
| `tools/auth-proxy.mjs` | Read-only same-origin proxy that injects the session cookie (non-GET dropped). |
| `tools/env-probe.mjs` | Read-only DATABASE_URL disposal probe. |
| `tools/git-snapshot.mjs` | Regenerates `git-snapshot.txt` from the live tree. |
| `tools/inspect-dom.mjs` | Debug helper: evaluates JS against the authenticated page. |

## Status

- Immutable baseline metadata: **complete** (`git-snapshot.txt`).
- DATABASE_URL disposal proof: **PASS** (`env-disposal-proof.txt`).
- Same-data screenshots: **COMPLETE** — 28 frames at 1440x900 and 390x844 for 14 states
  (`/`, `/tasks` default|table|kanban|detail|create-task|bulk-selection, `/calendar`,
  calendar create-event modal, `/notifications`, `/documents`, `/org`, command-search,
  offline). No frame was fabricated.
  Headless Chromium 152 is present and works with `--no-sandbox`.

## Reproduce

```
# 1. Prove the test DB is disposable (before any full npm test)
node artifacts/ux-v5-1/baseline/tools/env-probe.mjs

# 2. Re-capture the immutable metadata snapshot
node artifacts/ux-v5-1/baseline/tools/git-snapshot.mjs

# 3. Capture all same-data frames (requires the app server on :3000)
node scripts/capture-baseline.mjs
node scripts/capture-baseline.mjs --only=tasks/table,shell/offline
```

The capture is READ-ONLY toward the app database: the auth-proxy forwards only
GET/HEAD/OPTIONS.
