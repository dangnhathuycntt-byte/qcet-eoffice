# QCET E-Office — Rollback & Recovery Strategy

**Document Status**: Canonical Operational Reference  
**Scope**: Production Rollback Procedures, Schema Migration Invariants, Disaster Recovery  
**Authority**: Quản trị mạng / Ban Giám hiệu, Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn   
**Last Updated**: 2026-09-09  

---

## 1. Principles of Safe Rollback

Rollbacks in enterprise systems are high-pressure operations where hasty actions often compound damage. QCET E-Office adopts three fundamental principles:

1. **Rollback to Prior Immutable Artifact**: Rollback is accomplished by switching traffic back to the previously verified container image tag or standalone build, never by hot-patching production code.
2. **Expand -> Migrate -> Contract Database Invariant**: All database schema modifications must be backward-compatible with the immediately preceding application version. Database rollbacks (destructive `DROP COLUMN`, `DROP TABLE`) are strictly prohibited during emergency application rollbacks.
3. **Automated Incident Flagging**: Any rollback event automatically triggers a post-incident review and an audit trail entry.

---

## 2. Database Migration Invariant: Expand -> Migrate -> Contract

To ensure that the application can be safely rolled back to a previous build without database incompatibility, schema migrations must follow the three-phase **Expand -> Migrate -> Contract** lifecycle:

```
PHASE 1: EXPAND
  - Add new nullable columns, new tables, or new indexes.
  - Old code continues to run safely (ignores new fields).
  - Deploy Release N.
         │
         ▼
PHASE 2: MIGRATE
  - Backfill data from old structures to new structures.
  - New code reads and writes both or defaults smoothly.
  - System operates stably.
         │
         ▼
PHASE 3: CONTRACT (Next Release N+1)
  - Deprecate old columns or drop obsolete legacy constraints.
  - Executed only after Release N has proven stable in production.
```

### Critical Rules for Database Migrations:
- **Never rename columns directly**: Add the new column, dual-write if necessary, backfill, and drop the old column in a subsequent release.
- **Never add `NOT NULL` without a default value**: Adding a non-null constraint without a default breaks the previous application version immediately if a rollback is triggered.
- **Prisma Migrations Rule**: Production only executes `npx prisma migrate deploy`. Never run `prisma db push` in production.

---

## 3. Emergency Rollback Decision Matrix

| Severity | Incident Symptoms | Action Trigger |
| :--- | :--- | :--- |
| **P1 - CRITICAL** | API 500 error rate > 5%; authentication failure across all users; database transaction deadlock | Immediate rollback to previous container version within 5 minutes |
| **P2 - HIGH** | Core subsystem failure (e.g. Task deliverables cannot be submitted; Document directives fail); regression affecting department heads | Evaluate rollback vs. hotfix deployment within 30 minutes |
| **P3 - MEDIUM** | Visual styling regression; non-critical telemetry failure; minor export formatting bug | No rollback; schedule hotfix patch for regular deployment window |

---

## 4. Rollback Execution Runbook

### Step 1: Identify Prior Stable Container Image
Review the deployment registry or Docker host tags to identify the previously verified release tag (e.g., `qcet-eoffice:v1.0.0` prior to `v1.0.1`):
```bash
docker images | grep qcet-eoffice
```

### Step 2: Stop Faulty Release & Re-Launch Prior Image
Stop the current production container and start the previous container image:
```bash
# 1. Stop and remove the faulty container
docker stop qcet-eoffice-app
docker rm qcet-eoffice-app

# 2. Re-launch the previous stable image
docker run -d \
  --name qcet-eoffice-app \
  --restart always \
  -p 127.0.0.1:3001:3001 \
  --env-file /etc/qcet/production.env \
  -v /var/qcet/uploads:/app/uploads \
  -v /var/qcet/storage:/app/storage \
  qcet-eoffice:v1.0.0
```

### Step 3: Validate Restored Service
Verify restored service health immediately:
```bash
# Verify system network endpoint
curl -f -s http://127.0.0.1:3001/api/system/network-info

# Verify runtime configuration endpoint
curl -f -s http://127.0.0.1:3001/api/runtime-config

# Verify reverse proxy response
curl -I https://e-office.cdktcnqn.edu.vn/login
```

### Step 4: Verify Database State
Since the Expand -> Migrate -> Contract rule was followed, the database schema remains fully compatible with `v1.0.0`. No database rollback or SQL restoration is required.

---

## 5. Post-Rollback Verification & Post-Mortem

1. **Verify Session Integrity**: Confirm that existing user sessions remain valid without unexpected logouts.
2. **Review Incident Logs**: Collect error traces from the failed container using `docker logs qcet-eoffice-app-failed > /var/log/qcet/incident-<timestamp>.log`.
3. **Conduct Post-Mortem**:
   - Determine why automated CI/Staging checks did not catch the defect.
   - Author regression tests in `tests/` reproducing the failure before re-attempting deployment.
