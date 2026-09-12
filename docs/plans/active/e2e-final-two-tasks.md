# E2E Final Two Tasks

## Task 1: Fix test 61 (verifyTreatmentFidelity Arm B/C transcript requirement)

Update `tests/executor/live-benchmark-harness.test.ts` test "verifyTreatmentFidelity validates Arm A, Arm B, and Arm C invariants" to match the two-tier contract:
- Arm B/C calls without transcript must assert valid=false, reason='HARNESS_NOT_INVOKED'
- Arm B/C calls with a mock transcript containing Skill invocation must assert valid=true when artifact evidence is also present
- Do not weaken any assertion; update tests to the current intended contract

## Task 2: Guarantee terminal gate-verdict.json in executor workflow

In `.claude/workflows/qcet-plan-executor.js`:
- Wrap final release skeptic in try/catch → synthesize deterministic BLOCKED if it fails
- Always attempt to persist gate-verdict.json
- Emit explicit RELEASE_GATE_PERSIST_FAILURE if persist fails (not log-only)
- Do not redesign executor

## Verification

Run: npm run test:executor (require 166/166 pass), npm run typecheck, git diff --check
Only when 166/166 pass: npm run test:executor:e2e
Do not run benchmark B/C.
