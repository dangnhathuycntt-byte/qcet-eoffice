# QCET Plan Executor V2.3 Build Wave

**Execution runtime:** current installed `/qcet-plan-executor` under Ultracode.

**Master plan:** `docs/superpowers/plans/2026-09-11-qcet-plan-executor-v23-final.md`

**Scope:** Execute **Tasks 0 through 13 only** from the master plan. Task 14 is explicitly out of scope for this workflow run and MUST NOT be treated as a missing requirement.

**Reason:** this run modifies `.claude/workflows/qcet-plan-executor.js` itself. The current Dynamic Workflow process keeps the script version it loaded at launch, so final live validation must occur in a fresh workflow invocation after the V2.3 code has landed.

## Requirements

1. Read the master plan and architecture spec before calibration.
2. Preserve the master plan task dependency DAG.
3. Apply TDD and commit boundaries exactly as specified for Tasks 0-13.
4. Do not execute the live smoke/freeze steps from Task 14.
5. Finish by running:

```bash
npm run test:executor
npm run test:executor:faults
npm run executor:canary
npm run build:executor
npm run verify
git diff --check
```

6. Return `READY_FOR_V23_RELAUNCH` only when Tasks 0-13 are implemented and the commands above all pass.
7. Return BLOCKED with concrete evidence for any unresolved failure.
