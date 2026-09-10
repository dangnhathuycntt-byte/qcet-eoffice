# QCET E-Office - Database Architecture & Operations Runbook

## Document Metadata
- **System**: QCET E-Office (Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh)
- **Document ID**: RUNBOOK-DB-2026-01
- **Target RDBMS**: PostgreSQL 15+
- **ORM & Driver**: Prisma ORM 5.x / 6.x with `@prisma/client`
- **Status**: Canonical Operational Standard
- **Scope**: Production, Staging, and Disaster Recovery Environments

---

## 1. PostgreSQL Database Architecture Topology

QCET E-Office enforces a strictly layered data architecture. The database is the authoritative source of truth ("Server Truth Wins"). Client state and optimistic UI updates must yield to the database state at all times.

```
+-----------------------------------------------------------------------------------+
|                              APPLICATION LAYER                                    |
|   Next.js App Router  /  API Route Handlers  /  Server Actions  /  PWA Mobile API |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                             DOMAIN SERVICES LAYER                                 |
|  TaskService  |  AuditService  |  OutboxDispatcher  |  Idempotency  |  Search     |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                         TRANSACTION BOUNDARY (Prisma)                             |
|   - prisma.$transaction(async (tx) => { ... })                                    |
|   - Optimistic Concurrency Control (OCC version checks)                           |
|   - Atomic Sequence Counters (Task / Document registration)                       |
|   - Outbox Event & Audit Log Enqueue                                              |
|   - Isolation Level: Read Committed (Default) / Serializable                      |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                            POSTGRESQL DATABASE ENGINE                             |
|  - Check Constraints (Valid dates, non-negative numbers, self-parent prevention)  |
|  - Foreign Key Constraints (CASCADE / RESTRICT referential integrity)             |
|  - Indexes: B-Tree (Lookup/Sort), GIN (Full-Text Search), pg_trgm (Fuzzy)         |
|  - Partial Indexes (WHERE read_at IS NULL, WHERE archived_at IS NULL)             |
|  - Transactional Outbox Table ("outbox_events")                                   |
|  - Immutable Audit Log Table ("audit_events")                                     |
|  - Distributed Idempotency Store ("idempotency_records")                          |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                             STORAGE & WAL ARCHITECTURE                            |
|  - Write-Ahead Log (WAL) Continuous Archiving (RPO <= 15 min)                     |
|  - Physical Base Backups + pgBackRest / wal-g Repository                          |
|  - Automated Tablespace & Autovacuum Daemon                                       |
+-----------------------------------------------------------------------------------+
```

### Architectural Responsibilities by Layer

1. **Application Layer**: Validates client input schemas via Zod, verifies session authentication tokens, extracts user authority (Role) and data boundaries (Scope).
2. **Domain Services Layer**: Encapsulates institutional workflows (Task delegation, Deliverable reviews, Document issuance). Enforces business invariants and idempotency checks before invoking the database.
3. **Transaction Boundary**: Guarantees atomic state mutations across multiple tables. Ensures that if any step in a business operation fails, all associated writes (including audit events and outbox messages) roll back cleanly. External network I/O (push dispatch, email, 3rd party webhooks) is strictly forbidden inside this boundary.
4. **PostgreSQL Database Engine**: Enforces relational integrity, check constraints, unique constraints, and high-performance search indices.
5. **Storage & WAL Architecture**: Delivers point-in-time recovery, continuous archiving, and crash safety.

---

## 2. Recovery Point Objective (RPO) & Recovery Time Objective (RTO)

### Service Level Objectives (SLO)

| Objective | Metric Target | Technical Enforcement Mechanism | Validation Cadence |
| :--- | :--- | :--- | :--- |
| **RPO** (Recovery Point Objective) | **<= 15 minutes** | Continuous Write-Ahead Log (WAL) archiving to remote object storage with archive timeout configured to 900 seconds (15 minutes). | Continuous automated monitoring |
| **RTO** (Recovery Time Objective) | **<= 2 hours** | Automated base backup fetch + parallel WAL replay to target point-in-time on standby compute infrastructure. | Monthly disaster recovery drill |

### Failure Scenarios and Recovery Matrix

| Failure Scenario | Impact | Primary Recovery Mechanism | Target RPO | Target RTO |
| :--- | :--- | :--- | :--- | :--- |
| **Storage / Hardware Failure** | Complete node loss | Promote warm standby or restore base backup + WAL replay | <= 15 min | <= 1 hour |
| **Accidental Data Drop / Human Error** | Corrupted or deleted tables | Point-in-Time Recovery (PITR) to timestamp immediately prior to incident | <= 15 min | <= 2 hours |
| **Silent Logical Corruption** | Invalid application mutations | Selective restore to isolated staging environment + surgical SQL backfill | Incident specific | <= 4 hours |
| **Host Operating System Crash** | Unplanned server reboot | PostgreSQL crash recovery via local WAL replay on startup | 0 min (committed data) | <= 5 minutes |

### Scheduled Disaster Recovery Drills

1. **Cadence**: First Sunday of each calendar month at 02:00 ICT (UTC+7).
2. **Environment**: Isolated Disaster Recovery (DR) sandbox environment mimicking production storage topology.
3. **Drill Procedure**:
   - Operator restores the latest physical base backup.
   - Operator configures PITR target to a specific timestamp in the past 24 hours.
   - PostgreSQL replays WAL segments up to target time and promotes to primary.
   - Automated test suite runs against the restored database to verify:
     - Task sequences and counts match the expected state.
     - Document registration numbers are contiguous.
     - Audit logs are intact and tamper-free.
   - Recovery completion time and data divergence are logged in the quarterly audit ledger.

---

## 3. Backup & Recovery Strategy

QCET E-Office operates a dual-tier backup strategy combining logical dumps for administrative agility and physical backups with continuous WAL archiving for disaster recovery.

```
                    +-----------------------------+
                    |   PostgreSQL Primary Node   |
                    +-----------------------------+
                                   |
         +-------------------------+-------------------------+
         |                                                   |
         v (Daily 01:00 ICT)                                 v (Continuous / 15m)
+-----------------------+                           +-----------------------+
|     pg_dump -Fc       |                           | WAL Archiving         |
|  Logical Snapshot     |                           | (pgBackRest / wal-g)  |
+-----------------------+                           +-----------------------+
         |                                                   |
         v                                                   v
+-----------------------+                           +-----------------------+
| Local Encrypted Store |                           | Off-site Cloud Object |
| Retain: 30 days       |                           | Retain: 90 days       |
+-----------------------+                           +-----------------------+
```

### 3.1. Logical Backups (`pg_dump -Fc`)

Logical backups capture table schemas and records in PostgreSQL custom format (`-Fc`), enabling parallel restores and single-table extraction.

#### Daily Backup Automation Script (`/usr/local/bin/qcet-db-dump.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

# Configuration
DB_NAME="${DB_NAME:-qcet_eoffice}"
DB_USER="${DB_USER:-qcet_admin}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="/var/backups/qcet/logical"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"
LOG_FILE="/var/log/qcet/db-backup.log"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}" "$(dirname "${LOG_FILE}")"

echo "[$(date -Iseconds)] Starting logical backup of ${DB_NAME} to ${BACKUP_FILE}..." >> "${LOG_FILE}"

# Execute custom-format compressed backup with bloat reduction
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="${BACKUP_FILE}" \
  "${DB_NAME}" 2>> "${LOG_FILE}"

# Calculate checksum
sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"

# Prune archives older than retention window
find "${BACKUP_DIR}" -name "${DB_NAME}_*.dump*" -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date -Iseconds)] Backup completed successfully. Size: $(du -h "${BACKUP_FILE}" | cut -f1)" >> "${LOG_FILE}"
```

#### Crontab Entry for Logical Backup
```cron
# Run daily logical backup at 01:00 Indochina Time (UTC+7)
0 1 * * * /usr/local/bin/qcet-db-dump.sh >/dev/null 2>&1
```

---

### 3.2. Physical Backups & Continuous WAL Archiving

Physical backups capture raw data files (`pg_basebackup`) combined with continuous streaming of Write-Ahead Log (WAL) records. This provides zero-data-loss capabilities and Point-in-Time Recovery.

#### PostgreSQL WAL Configuration (`postgresql.conf`)

```ini
# WAL Level and Archiving
wal_level = replica
archive_mode = on
archive_command = 'pgbackrest --stanza=qcet archive-push %p'
archive_timeout = 900          # Force segment switch every 15 minutes to satisfy RPO <= 15m

# Checkpoint Tuning
checkpoint_timeout = 15min
max_wal_size = 16GB
min_wal_size = 2GB
checkpoint_completion_target = 0.9
```

#### pgBackRest Stanza Configuration (`/etc/pgbackrest/pgbackrest.conf`)

```ini
[global]
repo1-type=s3
repo1-s3-endpoint=s3.ap-southeast-1.amazonaws.com
repo1-s3-bucket=qcet-eoffice-db-backups
repo1-s3-region=ap-southeast-1
repo1-path=/pgbackrest
repo1-retention-full=4
repo1-retention-diff=14
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=ENV:PGBACKREST_CIPHER_PASS
process-max=4
log-level-console=info
log-level-file=detail
start-fast=y
compress-type=zst
compress-level=3

[qcet]
pg1-path=/var/lib/postgresql/15/main
pg1-user=postgres
```

#### Physical Backup Schedule
- **Weekly Full Backup**: Sunday 00:00 ICT (`pgbackrest --stanza=qcet --type=full backup`)
- **Daily Differential Backup**: Monday through Saturday 00:00 ICT (`pgbackrest --stanza=qcet --type=diff backup`)
- **Continuous Archive**: Every WAL 16MB boundary or maximum 15 minutes via `archive_timeout`.

---

### 3.3. Point-in-Time Recovery (PITR) Procedure

When accidental data loss or logical corruption occurs, execute PITR to restore the database to an exact second before the incident.

#### Step-by-Step Restoration Runbook

1. **Step 1: Declare Incident & Lock Workflows**
   - Alert operations team.
   - Route application traffic to a maintenance splash page.
   - Terminate active web/worker instances to halt all database mutations.

2. **Step 2: Identify Target Recovery Timestamp**
   - Query `audit_events` or application logs to determine the exact timestamp of the damaging operation in Indochina Time (`UTC+7`).
   - Example target: `2026-09-09 14:22:15+07`.

3. **Step 3: Provision Target Standby Host**
   - Provision a staging or replacement database host matching production CPU, RAM, and NVMe disk specifications.
   - Install matching PostgreSQL version (e.g., PostgreSQL 15.x).
   - Ensure the PostgreSQL service is stopped:
     ```bash
     sudo systemctl stop postgresql
     ```

4. **Step 4: Clean Data Directory and Restore Base Backup**
   ```bash
   # Remove existing data directory
   sudo rm -rf /var/lib/postgresql/15/main/*

   # Restore latest consistent base backup from archive
   sudo -u postgres pgbackrest --stanza=qcet \
     --type=time \
     --target="2026-09-09 14:22:15+07" \
     --target-action=promote \
     restore
   ```

5. **Step 5: Configure Recovery Target Signal (Standard PostgreSQL PITR)**
   If executing recovery manually without `pgBackRest`:
   - Create signal file:
     ```bash
     sudo -u postgres touch /var/lib/postgresql/15/main/recovery.signal
     ```
   - Append recovery settings to `/var/lib/postgresql/15/main/postgresql.auto.conf`:
     ```ini
     restore_command = 'cp /var/backups/qcet/wal_archive/%f %p'
     recovery_target_time = '2026-09-09 14:22:15+07'
     recovery_target_action = 'promote'
     ```

6. **Step 6: Start PostgreSQL and Monitor Replay**
   ```bash
   sudo systemctl start postgresql
   sudo tail -f /var/log/postgresql/postgresql-15-main.log
   ```
   Look for:
   - `starting point-in-time recovery to 2026-09-09 14:22:15+07`
   - `redo starts at ...`
   - `recovery stopping at restore point or timestamp ...`
   - `database system was not properly shut down; automatic recovery in progress`
   - `archive recovery complete; promoted to primary`

7. **Step 7: Data Sanity & Integrity Verification**
   Connect to the recovered instance and execute data validation queries:
   ```sql
   -- Verify latest transaction state
   SELECT id, code, status, updated_at FROM tasks ORDER BY updated_at DESC LIMIT 5;

   -- Verify audit log boundary
   SELECT id, action, entity_type, created_at FROM audit_events ORDER BY created_at DESC LIMIT 5;

   -- Verify outbox event continuity
   SELECT id, event_type, status, created_at FROM outbox_events ORDER BY created_at DESC LIMIT 5;
   ```

8. **Step 8: Application Cutover**
   - Update `DATABASE_URL` in application runtime environment (`.env.production`).
   - Run health check endpoint: `GET /api/health`.
   - Remove maintenance splash page and resume traffic.

---

## 4. Autovacuum & Database Health Monitoring

### 4.1. Autovacuum Architecture & Tuning for High-Churn Tables

In QCET E-Office, certain tables experience extreme transaction churn:
- `outbox_events`: Continuously inserted, polled, updated to `COMPLETED`, and pruned.
- `notifications`: Frequent bulk creation, state updates (`read_at`), and status queries.
- `audit_events`: Heavy append volume.
- `tasks`: Frequent status transitions, assignments, and OCC version increments.

Default PostgreSQL autovacuum settings (triggering vacuum only after 20% of table rows are modified) lead to massive table bloat on large tables. The parameters below configure aggressive vacuuming and analyze thresholds.

#### High-Churn Table Tuning SQL (`prisma/migrations/autovacuum_tuning.sql`)

```sql
-- ============================================================================
-- QCET E-Office: Table-Level Autovacuum Tuning for High-Churn Workflows
-- ============================================================================

-- 1. Transactional Outbox: Extreme row churn; must be vacuumed promptly
ALTER TABLE "outbox_events" SET (
  autovacuum_vacuum_scale_factor = 0.02,     -- Trigger vacuum after 2% row changes
  autovacuum_vacuum_threshold = 200,         -- Base minimum changed rows
  autovacuum_analyze_scale_factor = 0.01,    -- Trigger analyze after 1% row changes
  autovacuum_analyze_threshold = 100,
  autovacuum_vacuum_cost_limit = 1000,       -- Allow higher I/O budget for vacuuming
  autovacuum_vacuum_cost_delay = 2           -- Shorter throttle pause (2ms)
);

-- 2. Notifications: High update churn on read status and dismissals
ALTER TABLE "notifications" SET (
  autovacuum_vacuum_scale_factor = 0.05,     -- Trigger vacuum after 5% row changes
  autovacuum_vacuum_threshold = 500,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 250,
  autovacuum_vacuum_cost_limit = 800,
  autovacuum_vacuum_cost_delay = 2
);

-- 3. Tasks: Core operational entities with frequent OCC mutations
ALTER TABLE "tasks" SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 500,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 250
);

-- 4. Idempotency Records: Short-lived records with frequent TTL deletes
ALTER TABLE "idempotency_records" SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 300,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 150
);

-- 5. Audit Events: High-volume append; focus on frequent statistics updates
ALTER TABLE "audit_events" SET (
  autovacuum_vacuum_scale_factor = 0.10,
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold = 500
);
```

---

### 4.2. Concrete SQL Health Monitoring Queries

#### Query 1: Dead Tuples and Autovacuum Status
Identify tables accumulating dead tuples and verify autovacuum execution.

```sql
SELECT
  schemaname,
  relname AS table_name,
  n_live_tup AS live_tuples,
  n_dead_tup AS dead_tuples,
  CASE
    WHEN n_live_tup > 0
    THEN ROUND((n_dead_tup::numeric / (n_live_tup + n_dead_tup)::numeric) * 100, 2)
    ELSE 0
  END AS dead_tuple_ratio_pct,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze,
  vacuum_count,
  autovacuum_count
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 15;
```

#### Query 2: Active, Idle, and Blocked Connection Telemetry
Inspect database connection distribution and identify blocking locks.

```sql
SELECT
  datname AS database_name,
  state,
  COUNT(*) AS total_connections,
  COUNT(*) FILTER (WHERE wait_event IS NOT NULL) AS waiting_connections,
  MAX(NOW() - state_change) AS max_duration_in_current_state
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY datname, state
ORDER BY total_connections DESC;
```

#### Query 3: Long-Running Transactions and Blocking Locks
Detect transactions holding locks longer than 30 seconds.

```sql
SELECT
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement,
  NOW() - blocked_activity.query_start AS blocked_duration
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

#### Query 4: Table and Index Bloat Estimation
Estimate disk bloat caused by dead space.

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename) - pg_relation_size(schemaname || '.' || tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
LIMIT 15;
```

#### Query 5: Transaction ID (XID) Wraparound Safety Margin
Ensure the database is not approaching the 2-billion transaction wraparound emergency.

```sql
SELECT
  datname,
  age(datfrozenxid) AS current_xid_age,
  2147483648 - age(datfrozenxid) AS remaining_xids_before_wraparound,
  ROUND(100.0 * age(datfrozenxid) / 2147483648, 2) AS xid_consumption_pct
FROM pg_database
WHERE datname = current_database();
```

---

### 4.3. `pg_stat_statements` Configuration & Query Profiling

The `pg_stat_statements` module tracks execution statistics of all SQL queries executed by the system.

#### Enabling the Extension in `postgresql.conf`

```ini
shared_preload_libraries = 'pg_stat_statements'

# pg_stat_statements settings
pg_stat_statements.max = 10000
pg_stat_statements.track = all
pg_stat_statements.save = on
```

Initialize in the database:
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

#### Top Slow Queries by Total Execution Time
```sql
SELECT
  ROUND(total_exec_time::numeric, 2) AS total_time_ms,
  calls,
  ROUND(mean_exec_time::numeric, 2) AS mean_time_ms,
  ROUND(stddev_exec_time::numeric, 2) AS stddev_time_ms,
  ROUND((100.0 * total_exec_time / SUM(total_exec_time) OVER ())::numeric, 2) AS pct_total_time,
  query
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 10;
```

#### Cache Hit Ratio Query (Target: >= 99%)
```sql
SELECT
  ROUND(SUM(heap_blks_hit) / (SUM(heap_blks_hit) + SUM(heap_blks_read)) * 100, 2) AS buffer_cache_hit_ratio_pct
FROM pg_statio_user_tables
WHERE (heap_blks_hit + heap_blks_read) > 0;
```

---

## 5. Connection Management & Pooling

### 5.1. Invariant: Single PrismaClient per Process

QCET E-Office strictly enforces a single, shared `PrismaClient` instance per Node.js process (`src/lib/prisma.ts`).
Spawning multiple `PrismaClient` instances inside handlers exhausts database connection pools, leads to excessive memory consumption, and breaks connection lifecycle tracking.

```typescript
// Canonical Prisma singleton pattern in src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Guarantee singleton across hot reloads and container lifecycle
globalForPrisma.prisma = prisma;

export default prisma;
```

---

### 5.2. Connection Pool Sizing Formula

PostgreSQL processes each backend connection as an isolated operating system process. Setting database pool sizes excessively high degrades performance through CPU context switching and disk I/O contention.

The canonical sizing formula is:

$$\text{Max Connections} = ((\text{CPU Cores} \times 2) + \text{Effective Spindle Count})$$

#### Practical Sizing for QCET Infrastructure

| Hardware Specification | PostgreSQL Server Cores | Storage Type | Recommended Max Connections | Prisma `connection_limit` |
| :--- | :--- | :--- | :--- | :--- |
| **Small Deployment** (Single VPS) | 4 vCPU | NVMe SSD (= 1 spindle) | 9 - 12 connections | `connection_limit=10` |
| **Medium Deployment** (Production) | 8 vCPU | Dedicated NVMe Array (= 2 spindles) | 18 - 22 connections | `connection_limit=20` |
| **Cluster Deployment** (Multiple App Nodes) | 16 vCPU | SAN / High-IOPS Cloud SSD | 34 - 40 connections | Managed via PgBouncer |

---

### 5.3. PgBouncer Transaction Pooling Setup

When scaling horizontal application nodes (e.g. multiple Next.js PM2 workers or container replicas), use PgBouncer in **transaction pooling** mode between the application instances and PostgreSQL.

```
+---------------------+    +---------------------+
| Next.js Instance #1 |    | Next.js Instance #2 |
+---------------------+    +---------------------+
           \                  /
            v                v
     +------------------------------+
     |   PgBouncer Connection Pool  |
     |   (Pool Mode: Transaction)   |
     +------------------------------+
                    | (Max 25 Server Connections)
                    v
     +------------------------------+
     |   PostgreSQL Database Engine |
     +------------------------------+
```

#### Production Configuration (`/etc/pgbouncer/pgbouncer.ini`)

```ini
[databases]
qcet_eoffice = host=127.0.0.1 port=5432 dbname=qcet_eoffice

[pgbouncer]
logfile = /var/log/postgresql/pgbouncer.log
pidfile = /var/run/postgresql/pgbouncer.pid
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

# Connection Pool Settings
pool_mode = transaction
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
max_client_conn = 500
max_db_connections = 30

# Session Sanitization
server_reset_query = DISCARD ALL
server_check_query = SELECT 1
server_check_delay = 30
max_user_connections = 100

# Timeouts
server_idle_timeout = 600
client_idle_timeout = 0
query_timeout = 120
```

#### Prisma Connection String Configuration with PgBouncer
When connecting through PgBouncer in transaction mode, add `?pgbouncer=true` and specify connection limits:

```env
# Standard Application Connection (via PgBouncer Port 6432)
DATABASE_URL="postgresql://qcet_user:password@10.0.1.10:6432/qcet_eoffice?schema=public&pgbouncer=true&connection_limit=10"

# Direct Connection for Migrations ONLY (Bypassing PgBouncer, Port 5432)
DIRECT_URL="postgresql://qcet_admin:password@10.0.1.10:5432/qcet_eoffice?schema=public"
```

---

## 6. Migration Discipline: Zero-Downtime Expand-and-Contract Pattern

### 6.1. CI/CD Invariants

1. **Absolute Prohibition**:
   - `prisma migrate dev` is **STRICTLY PROHIBITED** in staging, pre-production, and production pipelines.
   - `prisma db push` is **STRICTLY PROHIBITED** outside local developer test sandboxes.
2. **Canonical Production Command**:
   - Every deployment must execute `prisma migrate deploy` exclusively.
   - All migration scripts must be committed and reviewed as immutable files under `prisma/migrations/`.

---

### 6.2. The 4-Phase Zero-Downtime Expand-and-Contract Architecture

Whenever modifying the database schema (e.g. renaming columns, changing data types, or splitting tables), teams must execute the 4-phase zero-downtime expand-and-contract pattern across release milestones.

```
Phase A: Expand         Phase B: Dual-Write & Backfill     Phase C: Contract Read      Phase D: Contract Cleanup
+-----------------+     +-------------------------------+   +--------------------+     +-----------------------+
| Add new column  | --> | App writes to BOTH columns.   |-->| App reads exclusively|-->| Drop deprecated       |
| (NULL or default|     | Background worker backfills   |   | from new column.   |     | column & clean code.  |
| No breaking DDL |     | legacy records.               |   | Verify stability.  |     | Migration completes.  |
+-----------------+     +-------------------------------+   +--------------------+     +-----------------------+
```

#### Detailed Phase Walkthrough (Example: Migrating `Task.description` to `Task.summary_content`)

1. **Phase A: Expand (Release N)**
   - Add the new column `summary_content String?` to `schema.prisma`.
   - The column **must be nullable** or have a deterministic server default.
   - Run `prisma migrate deploy`.
   - Existing application code continues running undisturbed.

2. **Phase B: Dual-Write & Backfill (Release N+1)**
   - Update domain services (`TaskService`) to write incoming data to **both** `description` and `summary_content`.
   - Reads still originate from `description`.
   - Run an asynchronous backfill script to populate `summary_content` for historical records:
     ```sql
     UPDATE "tasks"
     SET "summary_content" = "description"
     WHERE "summary_content" IS NULL AND "description" IS NOT NULL;
     ```

3. **Phase C: Contract Read (Release N+2)**
   - Switch all read paths to query `summary_content`.
   - Verify metrics, search functionality, and reports.
   - Continue dual-writing to `description` as a safety net.

4. **Phase D: Contract Cleanup (Release N+3)**
   - Stop dual-writing; remove `description` from domain services and Prisma schema.
   - Deploy migration dropping the deprecated column:
     ```sql
     ALTER TABLE "tasks" DROP COLUMN "description";
     ```

---

### 6.3. Migration Safety Gates & Checklist

Before merging any pull request that includes schema migrations, the engineering team must satisfy this checklist:

- [ ] **Lock Safety**: The migration contains zero statements acquiring `ACCESS EXCLUSIVE` locks on large tables for prolonged intervals.
- [ ] **Non-Blocking Indexes**: All new indexes on tables with > 10,000 rows are created using `CREATE INDEX CONCURRENTLY` in dedicated SQL migration steps.
- [ ] **Default Values**: Columns added with `NOT NULL` specify a `DEFAULT` value to prevent table rewrites in PostgreSQL 11+.
- [ ] **Reversibility**: An explicit rollback SQL script is authored and tested in the PR.
- [ ] **Foreign Key Safety**: Adding foreign keys is performed using `NOT VALID` followed by `VALIDATE CONSTRAINT` to avoid holding locks during table scans:
  ```sql
  ALTER TABLE "task_assignees"
  ADD CONSTRAINT "task_assignees_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  NOT VALID;

  ALTER TABLE "task_assignees"
  VALIDATE CONSTRAINT "task_assignees_user_id_fkey";
  ```

---

## 7. Security, Auditing & Operational Compliance

### 7.1. Immutability of `audit_events`

The `audit_events` table is the legal and institutional ledger of record for QCET E-Office. Tampering with audit logs is strictly prevented at the database engine level.

#### Database Trigger Preventing Modifications (`prisma/migrations/audit_immutability.sql`)

```sql
-- ============================================================================
-- QCET E-Office: Immutability Enforcement for Audit Trail
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'PERMISSION DENIED: Table audit_events is strictly append-only. UPDATE and DELETE operations are forbidden.'
    USING ERRCODE = '55000'; -- Object not in prerequisite state
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_events_immutable ON "audit_events";

CREATE TRIGGER trg_audit_events_immutable
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_tampering();
```

---

### 7.2. Outbox Processing Lifecycle & Dead-Letter Queue (DLQ)

The Transactional Outbox pattern (`outbox_events`) decouples external side effects (push notifications, emails, external webhooks) from primary transactions.

#### Event State Machine
- `PENDING`: Enqueued atomically with the primary transaction. Available for processing when `available_at <= NOW()`.
- `PROCESSING`: Claimed by a dispatcher worker using `FOR UPDATE SKIP LOCKED`.
- `COMPLETED`: Successfully delivered to external recipient; marked with `processed_at = NOW()`.
- `FAILED`: Exceeded `maxRetries` (5 attempts); moved to Dead-Letter Queue (DLQ) for operator inspection.

#### DLQ Health Monitoring Query
```sql
SELECT
  id,
  event_type,
  aggregate_type,
  aggregate_id,
  attempts,
  last_error,
  created_at
FROM outbox_events
WHERE status = 'FAILED'
ORDER BY created_at DESC
LIMIT 20;
```

#### Worker Polling Pattern (`FOR UPDATE SKIP LOCKED`)
```sql
-- Safely claim up to 10 pending events without concurrency collisions
UPDATE outbox_events
SET status = 'PROCESSING'
WHERE id IN (
  SELECT id
  FROM outbox_events
  WHERE status = 'PENDING'
    AND available_at <= NOW()
  ORDER BY available_at ASC
  LIMIT 10
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

---

### 7.3. Idempotency Lifecycle & TTL Maintenance

Mobile devices and PWA clients operate under unreliable network conditions and may retry requests. The `idempotency_records` table prevents duplicate mutations.

- **Unique Constraint**: `@@unique([userId, operation, key])`.
- **Status Codes**: Returns cached responses for `COMPLETED` requests without re-executing. Rejects concurrent in-flight requests with HTTP 409 Conflict.
- **TTL Window**: Records have a default time-to-live of 24 hours (`expires_at = NOW() + INTERVAL '24 hours'`).

#### Automated Pruning Cron Query
Run every hour to reclaim storage space:

```sql
DELETE FROM idempotency_records
WHERE expires_at < NOW();
```

---

## 8. Operational Quick Reference Checklist

| Operational Task | Canonical Command / Script | Frequency |
| :--- | :--- | :--- |
| **Verify Backup Health** | `pgbackrest --stanza=qcet check` | Daily automated alert |
| **Inspect Dead Tuples** | Run Query 1 from Section 4.2 | Daily / On-demand |
| **Review Top Slow Queries** | Run pg_stat_statements query from Section 4.3 | Weekly performance review |
| **Check Connection Pressure** | Run Query 2 from Section 4.2 | Real-time APM telemetry |
| **Purge Expired Idempotency Keys** | `DELETE FROM idempotency_records WHERE expires_at < NOW();` | Hourly cron |
| **Investigate Failed Outbox Events** | Run DLQ Query from Section 7.2 | Alert on count > 0 |
| **Execute Disaster Recovery Drill** | Section 3.3 Runbook | Monthly (1st Sunday) |
