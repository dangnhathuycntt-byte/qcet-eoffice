---
status: historical-reference
note: QCET Plan Executor retired 2026-09-13. Runtime contract kept for history only; recoverable code at git tag backup/plan-executor-before-removal.
---

# QCET Plan Executor - Runtime Contract & Baseline Verification (T00)

**Date**: 2026-09-10  
**Environment**: Darwin 24.6.0 arm64 (Apple Silicon)  
**Node.js**: v22.23.2  
**Git**: 2.39.5 (Apple Git-154)  
**Harness**: Claude Code CLI with Ultracode Multi-Agent Workflow Engine enabled

---

## 1. Environment & Runtime Verification

### 1.1 Host Environment
- **OS**: Darwin MacBook-Pro-cua-Dang.local 24.6.0 (macOS arm64)
- **Node.js**: `v22.23.2`
- **Git**: `2.39.5 (Apple Git-154)`
- **Working Directory**: `/Users/dnhhuy/Projects/QCET/QCET Work`
- **Ultracode Status**: Active (workflow tool multi-agent orchestration authorized)

### 1.2 Workflow Execution Engine Capabilities
Verification completed via smoke test workflow (`Task ID: w17qg3z0x`, `Run ID: wf_c37f205b-f11`):
- **Dynamic Script Execution**: Supported via `Workflow({ script: "..." })`. Scripts are executed in an isolated JavaScript runtime with standard built-ins (`JSON`, `Math`, `Array`).
- **Forbidden Built-ins**: `Date.now()`, `Math.random()`, and argless `new Date()` are strictly forbidden in workflow scripts to ensure replay and resume determinism. Timestamps must be passed via `args`.
- **Concurrency & Scheduling**:
  - `pipeline(items, stage1, stage2, ...)` provides unblocked per-item chaining (item B can progress through stage 2 while item A is still in stage 1).
  - `parallel(thunks)` provides barrier synchronization (waits for all thunks to complete).
  - Concurrency is capped at `min(16, CPU - 2)`.
- **Lifecycle & Resume**:
  - Scripts automatically persist to `.claude/projects/.../workflows/scripts/*.js`.
  - State and agent results are journaled to `journal.jsonl`.
  - Resume supported via `resumeFromRunId`.

---

## 2. Hook Payload Specifications & Invariants

### 2.1 PreToolUse Hook (`pre-tool-use-ownership-guard`)
- **Configured Matcher**: `Write|Edit` (vulnerability identified: `NotebookEdit` is missing).
- **Execution**: Stdin JSON payload, stdout JSON response with exit code 0 (`allow`) or 2 (`block`).
- **Observed Payload Structure**:
```json
{
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/Users/dnhhuy/Projects/QCET/QCET Work/src/canonical.ts",
    "content": "..."
  },
  "cwd": "/Users/dnhhuy/Projects/QCET/QCET Work",
  "agent_id": "a683e6b5a5c0e23b6",
  "agent_type": "qcet-builder",
  "agent_role": "builder",
  "subagent_label": "shard-1:implement"
}
```
- **Response Format**:
  - Allow: `{ "decision": "allow" }` (Exit code 0)
  - Block: `{ "decision": "block", "reason": "...", "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "..." } }` (Exit code 2)

### 2.2 SubagentStop Hook (`subagent-stop-evidence-gate`)
- **Execution**: Invoked when subagent attempts to stop.
- **Enforcement**: Checks structured evidence for builder subagents (`status`, `changedFiles`, `testsRun`, `requirementsSatisfied`).
- **Bounceback Control**: Single bounceback limit per agent key tracked in `/tmp/qcet-subagent-bounceback-${sessionScope}.json`.

---

## 3. Supported, Unsupported, and Unverified Capabilities Matrix

| Capability | Status | Implementation Details / Constraints |
| :--- | :--- | :--- |
| Dynamic Workflow Scripts | **Supported** | Validated via `Workflow` tool and smoke execution. |
| Subagent Tool Access | **Supported** | `qcet-builder` has access to `Read`, `Edit`, `Write`, `Bash`, `Skill`, `NotebookEdit`. |
| Structured Output Schemas | **Supported** | Uses JSON schema validation at agent invocation layer. |
| Worktree Isolation | **Supported** | Via `git worktree add` CLI commands or `opts.isolation: 'worktree'`. |
| Script `Date.now()` / `Math.random()` | **Unsupported** | Throws error by design; timestamps must be injected via `args`. |
| Multi-level Workflow Nesting | **Unsupported** | Nesting depth capped at 1 level; child cannot spawn child workflow. |
| In-memory Workflow State Sharing | **Unsupported** | Workflow runtime has no direct Node `fs`/`process` access; sharing requires agent tool return or file disk. |
| Hook Interception of `NotebookEdit` | **Unsupported** *(Defect)* | Missing in `.claude/settings.json` matcher. Addressed in T03. |

---

## 4. Baseline Source Audit & Defect Reproductions (E03–E07)

### E03: Shared Global State File Race Condition
- **Root Cause**: Shard ownership was looked up in static `/tmp/qcet-active-shards.json` without session/run scoping. Concurrent runs or concurrent shards overwrite each other. In addition, when `/tmp/qcet-active-shards.json` contained a single shard, the hook applied it even to unmapped parent orchestrator calls.
- **Reproduction**: A stale `/tmp/qcet-active-shards.json` from a previous test run blocked the main agent from authoring `docs/plans/executor-runtime-contract.md`.
- **Remedy**: Scope state files by `QCET_RUN_ID` and `QCET_SESSION_ID` with atomic write operations and strict agent identity matching.

### E04: Worktree Branch & Path Collision
- **Root Cause**: Worktree directories use static branch names or collide under `.claude/worktrees/` without clean atomic cleanup on error or cancel.
- **Reproduction**: A failed run leaves orphaned worktrees and locked branches preventing subsequent branch creation.
- **Remedy**: Robust lifecycle manager with dedicated run prefix, trap cleanup, and worktree teardown assertions.

### E05: NotebookEdit Tool Ownership Guard Bypass
- **Root Cause**: `.claude/settings.json` hook matcher for `pre-tool-use-ownership-guard` only specifies `"Write|Edit"`. `NotebookEdit` can modify `.ipynb` files without triggering ownership checks.
- **Reproduction**: `NotebookEdit` invocation bypasses `pre-tool-use-ownership-guard`.
- **Remedy**: Update matcher to `"Write|Edit|NotebookEdit"` and handle `notebook_path` in `pre-tool-use-ownership-guard`.

### E06: Synthetic / Mock Metric Inflation in Telemetry
- **Root Cause**: Baseline benchmarks and run-telemetry scripts used fabricated durations and static numbers without verifying real agent execution times.
- **Reproduction**: Hardcoded metrics in benchmark templates.
- **Remedy**: Mandatory wall-clock timestamps from workflow run receipts, real agent token counts from `TaskOutput`, and strict verification before completion.

### E07: `toRepoRelativePath` Suffix-Matching Vulnerability
- **Root Cause**: In `.claude/hooks/path-matcher.cjs`, `matchesOwnership` checks `if (normFile.endsWith('/' + normPattern)) return true`. An external file like `/Users/dnhhuy/other-project/src/auth.ts` is falsely considered owned if `src/auth.ts` is owned.
- **Reproduction**: Evaluating an external absolute path against a repo-relative pattern returns `true`.
- **Remedy**: Require strict repo-root resolution. If a path is outside the repo root and worktree root, reject suffix matching immediately.
