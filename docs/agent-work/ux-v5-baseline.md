# UX V5.1 — Wave 0 Baseline (canonical record)

Owner: qcet-builder (shard `S-BASELINE`)
Kind: infrastructure
Plan anchors: §3 SOURCE BASELINE; §8 WAVE 0 — BASELINE; §31 HANDOFF TEMPLATE; §42 T91
Requirements: R-091 (invariants), R-092 (verification proof)

This is the packet-named canonical baseline record. It indexes the immutable
evidence; it does not restate it. The narrative audit and the integrator handoff
live alongside it as `docs/agent-work/audits/ux-v5-1-baseline.md` and
`docs/agent-work/handoffs/BASELINE.md`.

## Frozen reference point

- Branch `main`, HEAD `7363c4309007a776269f57cb3058bb64cf059c2e`
  (Merge branch `feat/ux-reconstruction-master-v3`).
- Runtime: node `v22.23.2`, npm `10.9.8`, Chromium `152.0.7977.82` (Debian 13).
- Dirty tree at capture: 107 entries, **54 PRESERVE-ONLY** (paths this lane does
  not own; never reverted, reformatted, or overwritten).
- Verbatim capture: `artifacts/ux-v5-1/baseline/git-snapshot.txt`.

## Evidence root — `artifacts/ux-v5-1/baseline/`

| Artifact | Purpose |
|---|---|
| `git-snapshot.txt` | Immutable branch/HEAD/`log -5`/node/npm + full `git status` + PRESERVE-ONLY list. |
| `env-disposal-proof.txt` | Proof `npm test` targets disposable `qcet_test` (dev `qcet_eoffice` is NOT disposable). |
| `browser-probe.txt` | Measured headless-Chromium capability + authenticated capture proof. |
| `states/BASELINE-STATES.md` | Full same-data state matrix (14 states). |
| `states/<route>/<state>/baseline.<vp>.png` | 28 frames (14 states × 1440x900 + 390x844), `file`-verified. |
| `states/<route>/<state>/notes.md` | Per-state provenance (route, method, auth, same-data conditions). |
| `tools/*.mjs` | Delegating capture shim, read-only auth proxy, env probe, snapshot generator, DOM inspector. |

Canonical capture driver: `scripts/capture-baseline.mjs` (the single capture engine —
no parallel implementation). Regeneration:

```
node artifacts/ux-v5-1/baseline/tools/env-probe.mjs     # prove disposable DB first
node artifacts/ux-v5-1/baseline/tools/git-snapshot.mjs  # refresh metadata
node scripts/capture-baseline.mjs                       # all states, both viewports
node scripts/capture-baseline.mjs --only=calendar/create-event
```

## Acceptance criteria disposition

| # | Criterion | Status |
|---|---|---|
| 1 | git/branch/HEAD/log/node/npm + exact dirty list recorded verbatim | PASS |
| 2 | Same-data screenshots @1440x900 & 390x844 for every §8 state incl. create event | PASS — 28 frames / 14 states |
| 3 | DATABASE_URL proven disposable before any full `npm test` | PASS (`env-disposal-proof.txt`) |
| 4 | No file under `src/**` or `tests/**` modified by this shard | PASS |

## Notes for candidate lanes

- Auth is a real `qcet_session` (seed `admin@cdktcnqn.edu.vn`, role ADMIN, dept BGH);
  the token is never persisted to any artifact. The read-only proxy forwards only
  GET/HEAD/OPTIONS, so a capture can never mutate the dataset.
- Same-data pin: viewports 1440x900 + 390x844 (zoom 100%), overlays dismissed via
  their own controls, task detail pinned to `cmtwgbysl002xi5nosto6ykr4` (NV-2026-09-006).
- Never reseed between baseline and candidate capture (drift invalidates §42.2).
- Do NOT mutate `artifacts/ux-v5-1/baseline/**` — it is the frozen before image.

## Residual note

The earlier-run narrative audit (`docs/agent-work/audits/ux-v5-1-baseline.md`) and
handoff (`docs/agent-work/handoffs/BASELINE.md`) still state "26 frames / 13 states"
and mark `calendar/create-event` as not captured; that state is now captured (this
record and `states/BASELINE-STATES.md` are authoritative). Those two files are outside
this shard's ownership and are left untouched per the preserve-unrelated-changes rule.
