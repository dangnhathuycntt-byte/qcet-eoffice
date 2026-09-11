# QCET Executor Runs

This directory stores durable run ledgers, worktree witnesses, and atomic file claim locks for executions of the QCET Plan Executor (`/qcet-plan-executor`).

## Structure

Each execution run is stored in an isolated subdirectory:

```text
.claude/executor-runs/<sanitized-run-id>/
├── events.jsonl                  # Append-only bounded event log (SubagentStart, SubagentStop, PostToolUse)
├── manifest.json                 # Actionable DAG manifest and shard metadata
├── claims/                       # SHA-256 hashed file claim locks for concurrent shard safety
│   └── <sha256-relative-path>.json
└── shards/                       # Per-shard worktree witnesses and evidence packets
    └── <shardId>/
        ├── worktree.json         # Worktree witness (pinned base commit, worktree root, shardId)
        └── evidence.json         # Structured subagent completion evidence
```

## Security & Invariants

1. **Path Traversal Isolation**: Run IDs are strictly sanitized. Directory escape (`../`, root traversal, null bytes) is rejected.
2. **Bounded Logging**: No raw secrets, full prompts, or unbounded terminal outputs are stored.
3. **Atomic Writes**: All state mutations use atomic rename (`.tmp` -> final) to prevent corruption.
4. **First-Claim Ownership**: Concurrent file claims use exclusive creation (`wx`) to prevent race conditions across parallel builder worktrees.
