---
name: qcet-plan-executor
description: "Execute a QCET implementation plan with sharded parallel implementation, adversarial verification, bounded repair, integration review, and global proof via Ultracode Workflow."
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
    "worktreeIsolation": "auto",
    "maxRepairRounds": 2,
    "concurrency": 6,
    "lookaheadDepth": 1
  }
}
```

### Supported Arguments

- `planPath` (string, required): Absolute or repo-relative path to the plan markdown file.
- `worktreeIsolation` (`"auto"` | `"always"` | `"never"` | boolean, optional): Controls git worktree isolation. Defaults to `"auto"` (isolates only shards with potential cross-shard file overlap).
- `maxRepairRounds` (number, optional): Maximum defect repair rounds per shard (0, 1, or 2). Defaults to `2`.
- `concurrency` (number, optional): Maximum concurrent subagents. Defaults to `6`.
- `lookaheadDepth` (number, optional): Bounded pre-recon lookahead depth in the dependency DAG. Defaults to `1`.

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
