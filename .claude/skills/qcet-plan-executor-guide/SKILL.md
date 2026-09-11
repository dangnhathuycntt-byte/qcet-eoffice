---
name: qcet-plan-executor-guide
description: "Reference guide for the QCET Plan Executor workflow. The executable entrypoint is /qcet-plan-executor (workflow). Use this skill only to understand the executor's phases and conventions."
---

# QCET Plan Executor (`/qcet-plan-executor`)

Execute an implementation plan with high speed and deterministic quality control using the QCET Ultracode multi-agent workflow engine.

## Usage

```bash
/qcet-plan-executor <path-to-plan-file.md>
```

Or call the workflow via the Workflow tool:
```json
{
  "name": "qcet-plan-executor",
  "args": {
    "planPath": "/path/to/plan.md",
    "budget": "high",
    "worktreeIsolation": "auto"
  }
}
```

Or with custom budget override:
```json
{
  "name": "qcet-plan-executor",
  "args": {
    "planPath": "/path/to/plan.md",
    "budget": {
      "profile": "high",
      "maxConcurrentAgents": 8,
      "maxAgents": 128
    },
    "worktreeIsolation": "auto"
  }
}
```

## Workflow Phases

1. **Calibrate**: Parse plan into an actionable DAG manifest of independent shards with strict file boundaries (`owns` and `antiOwns`).
2. **Recon**: Run read-only reconnaissance to analyze existing contracts, schemas, and tests.
3. **Implement**: Execute implementation across independent shards in parallel using isolated git worktrees.
4. **Verify**: Adversarially verify each shard against negative assertions and edge cases.
5. **Repair**: Apply targeted fixes for verified defect findings.
6. **Integration Review**: Multi-perspective review across all integrated changes (contracts, security, UX, invariants).
7. **Integration Repair**: Resolve integration issues with bounded repair rounds.
8. **Global Validation**: Run full TypeScript check, architectural linter, and targeted test suite.
9. **Release Gate**: Deterministic code evaluation of release readiness.
