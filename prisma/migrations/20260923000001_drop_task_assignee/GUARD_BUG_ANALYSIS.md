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

## psql `\set` vs PostgreSQL GUC: Bug in Original `forward_drop_task_assignee.sql`

The original version of `forward_drop_task_assignee.sql` used:
```sql
\set backfill_verified 'no'
-- ...
DO $$ BEGIN
  IF current_setting('backfill_verified') <> 'yes' THEN ...
```

**This is incorrect.** `\set` creates a *psql client variable*, not a PostgreSQL GUC
parameter. `current_setting('backfill_verified')` reads the GUC namespace and raises:
```
ERROR: unrecognized configuration parameter "backfill_verified"
```
This error occurs even when the `\set` variable is set to `'yes'`. The gate fires with an
unexpected exception instead of the intended `STOP:` message. If psql is run without
`-v ON_ERROR_STOP=1`, psql may continue past this error — **the DROP could execute without
any gate verification**.

**Correct mechanism:** psql variable interpolation with `:'varname'` syntax:
```sql
\set backfill_verified 'no'
DO $$ BEGIN
  IF :'backfill_verified' <> 'yes' THEN
    RAISE EXCEPTION 'STOP: backfill_verified=%', :'backfill_verified';
  END IF;
END $$;
```
`:'backfill_verified'` expands at parse time to a quoted SQL string literal (`'no'`).
This is evaluated as a constant by the DO block — no GUC lookup. With
`-v ON_ERROR_STOP=1` on the psql command line, any unset variable causes psql to exit 1
immediately (fail-closed). Combined with `BEGIN`/`COMMIT`, any EXCEPTION in a gate
check rolls back the entire transaction and the DROP never runs.

The corrected `forward_drop_task_assignee.sql` also adds:
- `BEGIN;` / `COMMIT;` wrapping the parity check and DROP (atomic + rollback on failure)
- `LOCK TABLE task_assignees, task_actors IN ACCESS EXCLUSIVE MODE` (consistent snapshot)
- `SET LOCAL lock_timeout = '10s'` (abort if blocked, never wait indefinitely)
- `SET LOCAL statement_timeout = '60s'` (hard ceiling)
- Removed empty `20261007000001_fix_drop_task_assignee_guard/` directory (additive
  migration that can never run while `20260923000001` is FAILED/PENDING)

## Additional Bugs Found in PR #176 Rewrite (Fixed in PR #177)

### Bug 3: `:'varname'` NOT interpolated inside DO `$$...$$` dollar-quoted bodies

PR #176 rewrote the gate using psql variable interpolation (`:'var'`). This works at the
**outer SQL parse level**, but the content of a `DO $$ ... $$` block is a **string literal**
to the SQL parser — psql does NOT substitute `:'var'` inside dollar-quoted strings.

```sql
-- BUG (PR #176): psql does not interpolate inside $$ body
DO $$
BEGIN
  IF :'backfill_verified' <> 'yes' THEN  -- PL/pgSQL syntax error
    RAISE EXCEPTION '...', :'backfill_verified';  -- also broken
  END IF;
END $$;
```

PostgreSQL receives `IF :'backfill_verified' <> 'yes'` as literal PL/pgSQL text and
raises a syntax error immediately.

**Fix (PR #177):** Publish CLI variables into PostgreSQL session parameters at the outer SQL
level (where interpolation works), then read them via `current_setting()` inside the DO block:

```sql
-- Step 1: interpolation at outer SQL level (works here)
SET myapp.backfill_verified = :'backfill_verified';

-- Step 2: read from session parameter inside DO (works inside $$ body)
DO $$
BEGIN
  IF current_setting('myapp.backfill_verified') <> 'yes' THEN
    RAISE EXCEPTION 'STOP: backfill_verified=%.', current_setting('myapp.backfill_verified');
  END IF;
END $$;
```

The `myapp.*` namespace is a valid PostgreSQL custom GUC namespace; `current_setting()`
reads it correctly inside PL/pgSQL bodies.

### Bug 4: `\set var 'no'` in script body OVERRIDES CLI `-v var=yes`

PR #176 added `\set backfill_verified 'no'` at the top of the script, commenting:
"they are overridden by -v on the command line." This was **backwards and wrong**.

psql processes CLI `-v` **before** the script. `\set` inside the script runs **after**
CLI `-v` and **overwrites** it. So `-v backfill_verified=yes` on the CLI is immediately
overwritten to `'no'` by `\set backfill_verified 'no'` in the script body.

**Fix (PR #177):** Remove all `\set` defaults from the script. Without `\set`, if the
operator omits a required `-v` variable, psql encounters an unset variable at
`SET myapp.backfill_verified = :'backfill_verified'` and exits with "undefined variable" error
(fail-closed, correct behaviour). The `\set ON_ERROR_STOP on` metacommand is retained at the
top as a defensive measure.

### Bug 5: `set -e` / `set -euo pipefail` in bash + `VAR=$(cmd) || EXIT=$?` pattern

The `backfill-rebac.yml` workflow uses `set -euo pipefail`. The psql capture patterns:

```bash
INSERTED=$(docker run ... 2>"$PSQL_STDERR" | tr -d '[:space:]')
PSQL_EXIT=$?
```

With `set -e`, if `docker run` (psql) exits non-zero, the `$()` subshell exits non-zero.
In bash with `set -e`, a `VAR=$(...)` assignment where `$(...)` fails causes the outer shell
to exit **without** reaching `PSQL_EXIT=$?` or the subsequent stderr-print block.
This silently loses the psql error message.

**Fix (PR #177):** Pre-initialize `PSQL_EXIT=0` and use `|| PSQL_EXIT=$?` to prevent
`set -e` from firing on the assignment:

```bash
PSQL_EXIT=0
INSERTED=$(docker run ... 2>"$PSQL_STDERR" | tr -d '[:space:]') || PSQL_EXIT=$?
# Now PSQL_EXIT is captured; if [ -s "$PSQL_STDERR" ] runs; error message is printed.
```

Evidence: Run `37607140486` (failure) — idempotency step printed `count=705` then exited 3
with no stderr output, because the `set -e` exit bypassed the `if [ -s "$PSQL_STDERR2" ]`
block. Both INSERT capture sites fixed with the `|| PSQL_EXIT=...` pattern.
