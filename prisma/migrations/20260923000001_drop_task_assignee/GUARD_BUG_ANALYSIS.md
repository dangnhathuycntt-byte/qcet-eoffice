# Guard Bug Analysis: `20260923000001_drop_task_assignee`

## Status
**FAILED/PENDING** — blocked since 2026-09-29. Do NOT rewrite this file's checksum or mark it applied.

## Root Cause: Raw Text Comparison Bug

The guard in `migration.sql` line 28:

```sql
AND act."role"::text = ta."role_in_task"::text
```

This compares `task_actors.role` (a `TaskActorRole` enum) with `task_assignees.role_in_task`
(an `AssigneeRole` enum) as raw text strings.

The enum values are **semantically equivalent but textually different**:

| `task_assignees.role_in_task` | `task_actors.role` | Raw text match? |
|-------------------------------|--------------------|-----------------|
| `PRIMARY_OWNER`               | `DRI`              | ❌ FALSE        |
| `COLLABORATOR`                | `COLLABORATOR`     | ✅ TRUE         |

**Result**: All 145 `PRIMARY_OWNER` rows in `task_assignees` will ALWAYS be counted as
"unmigrated" even when `task_actors` has a correctly backfilled `DRI` row for every one of them.
`unmigrated` will report ≥145, causing `RAISE EXCEPTION` and migration failure — regardless of
whether the backfill ran successfully.

## Why a Later Additive Migration Cannot Fix This

Prisma applies migrations in strict creation-time order. When `20260923000001` is in
FAILED/PENDING state, Prisma stops and will not apply any subsequent migration
(`20260923000002`, `20260923000005`, etc.). A new migration `20260923000006_fix_guard`
**will never execute** while `20260923000001` remains blocked.

## Forward-Correction Path (No Checksum Rewrite)

The forward path requires a **DBA-applied SQL script** executed manually (outside Prisma)
after the following conditions are met:

1. ✅ Backfill APPLIED and verified (parity=0, idempotency PASS, DRI invariant PASS)
2. 🔲 Tracker 174 Stage B: dual-write active, observation window started
3. 🔲 Tracker 174 Stage C: observation window completed (≥N days)
4. 🔲 Old app retired or dual-write confirmed safe

The DBA script is: `../forward_drop_task_assignee.sql`

After running the DBA script manually, mark the migration resolved in Prisma:
```bash
# Only after DBA script succeeds and task_assignees is confirmed dropped:
npx prisma migrate resolve --applied 20260923000001_drop_task_assignee
# Then resume normal migration:
npx prisma migrate deploy
```

This does NOT rewrite the checksum of `migration.sql`. It marks `20260923000001` as
applied in `_prisma_migrations` AFTER the equivalent DDL has been manually executed.
The `migration.sql` file remains as the historical record of original intent.
