# QCET E-Office — Data Retention & Lifecycle Management Policy

**Document Status**: Canonical Operational Reference  
**Scope**: Database Records, Audit Trails, File Storage, Cache Eviction, Pruning Schedules  
**Authority**: Quản trị mạng / Ban Giám hiệu, Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn   
**Last Updated**: 2026-09-09  

---

## 1. Objectives & Compliance Framework

Data retention in QCET E-Office is governed by Vietnamese institutional record-keeping laws (Law on Archives No. 01/2011/QH13), decree on personal data protection, and operational efficiency considerations.

The retention policy balances three requirements:
1. **Legal & Institutional Compliance**: Preserving permanent and multi-year records of executive resolutions, official documents, and administrative audit trails.
2. **Privacy & Data Minimization**: Enforcing automatic expiration for personal notifications, temporary files, and obsolete operational logs.
3. **Storage & Performance Optimization**: Preventing database bloat and disk exhaustion on on-premise infrastructure.

---

## 2. Authoritative Retention Matrix

| Data Entity / Store | Storage Location | Retention Period | Disposal / Pruning Mechanism | Legal / Operational Justification |
| :--- | :--- | :--- | :--- | :--- |
| **Institutional Audit Events (`AuditEvent`)** | PostgreSQL Database (`AuditEvent` table) | **5 Years** | Partition archival to cold storage | Statutory compliance for administrative actions & financial audit trails |
| **Official Documents (`Document`, `DocumentDirective`)** | PostgreSQL & Secure Storage (`PRIVATE_STORAGE_DIR`) | **Permanent / Indefinite** (or until archived) | Institutional archiving status (`archivedAt`) | National archives regulations for educational institutions |
| **Tasks & Deliverables (`Task`, `TaskDeliverable`)** | PostgreSQL & Uploads Directory (`UPLOADS_DIR`) | **3 Years** following task completion | Soft archive (`archivedAt`), then offline cold storage | Project accountability and DACUM curriculum verification |
| **In-App Notifications (`Notification`)** | PostgreSQL Database (`Notification` table) | **90 Days** | Automated daily cleanup cron job | Ephemeral user alert; records older than 90 days are redundant |
| **Idempotency Records (`IdempotencyRecord`)** | PostgreSQL Database (`IdempotencyRecord` table) | **7 Days** | Daily database maintenance job | Protects against duplicate submissions; state expires after 7 days |
| **Technical & Error Logs** | Server Filesystem (`/var/log/qcet/`, Docker logs) | **30 Days** | Logrotate with daily gzip compression & deletion | Diagnostic operational window; privacy minimization |
| **Temporary Files & Exports** | Local Filesystem (`TEMP_STORAGE_DIR`) | **24 Hours** | Hourly cleanup script (`tmpwatch` / find prune) | Ephemeral Excel/PDF generated reports |
| **Offline Sync Outbox** | Client Browser (IndexedDB `outbox` store) | **Until synced** or **7 Days max** | Client-side expiration & purge logic in `offline-sync.ts` | Mobile field operations; unsynced data older than 7 days requires conflict review |
| **User Sessions (`qcet_session`)** | Browser Cookie & Server JWT | **30 Days** (`maxAge: 2,592,000s`) | Automatic cookie expiration & JWT timestamp check | Balance between user convenience and credential security |

---

## 3. Automated Maintenance & Pruning Procedures

To enforce retention schedules deterministically, automated maintenance routines run on scheduled cron intervals on the production host:

### 3.1 Daily Database Pruning Job (`scripts/ops/prune-transient-data.sql`)
Runs daily at 02:00 ICT (UTC+7):

```sql
-- 1. Prune notifications older than 90 days that have been read
DELETE FROM "Notification"
WHERE "createdAt" < NOW() - INTERVAL '90 days'
  AND "read" = true;

-- 2. Prune all unread notifications older than 180 days
DELETE FROM "Notification"
WHERE "createdAt" < NOW() - INTERVAL '180 days';

-- 3. Prune idempotency records older than 7 days
DELETE FROM "IdempotencyRecord"
WHERE "createdAt" < NOW() - INTERVAL '7 days';

-- 4. VACUUM to reclaim space and update planner statistics
VACUUM ANALYZE "Notification";
VACUUM ANALYZE "IdempotencyRecord";
```

### 3.2 Ephemeral Export & Temp Storage Purge
Runs hourly via system cron:
```bash
# Purge files in TEMP_STORAGE_DIR older than 24 hours (1440 minutes)
find /app/storage/temp -type f -mmin +1440 -delete
```

### 3.3 AuditEvent Archival Strategy
Because `AuditEvent` records must be retained for 5 years, table partitioning by year (`createdAt`) is recommended once event counts exceed 1,000,000 rows. Annual partitions older than 5 years are exported to encrypted cold storage (pg_dump with AES-256) before dropping from the active operational database.

---

## 4. Archiving vs. Hard Deletion Invariant

In accordance with Core System Invariant 4 (`docs/plans/active/2026-09-09-database-architecture-hardening-plan.md`):
- **No Casual Deletion**: Business entities (`Task`, `Document`, `ExecutiveResolution`, `User`) must **never be hard-deleted** through regular user interfaces.
- **Soft Archive**: Entities implement `archivedAt` and `archivedById` timestamps. They are excluded from default queries via global filters but remain intact for institutional history and audit reviews.
