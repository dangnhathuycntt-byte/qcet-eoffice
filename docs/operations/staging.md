# QCET E-Office — Staging Environment & Sanitization Policy

**Document Status**: Canonical Operational Reference  
**Scope**: Staging Infrastructure, Environmental Parity, Data Sanitization, Promotion Gates  
**Authority**: Quản trị mạng / Ban Giám hiệu, Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn   
**Last Updated**: 2026-09-09  

---

## 1. Purpose & Core Principles

The Staging environment (`staging.e-office.cdktcnqn.edu.vn`) serves as the final pre-production validation gate for QCET E-Office. Its primary mission is to catch regressions, performance degradations, migration errors, and security misconfigurations in an environment that faithfully mirrors production.

### Core Principles:
1. **Strict Production Parity**: Staging runs identical versions of system dependencies (Node.js 22 LTS, PostgreSQL 16+, Docker containerization, reverse proxy topology).
2. **Zero Unmasked Production PII**: Under no circumstances may raw production database dumps containing unmasked faculty/staff PII (CCCD, phone numbers, password hashes, salary details) be loaded into Staging.
3. **Isolated Identity & Secrets**: Staging maintains completely independent cryptographic keys, OAuth credentials, and database passwords from Production.

---

## 2. Environmental Parity Specifications

| Architectural Dimension | Production (`production`) | Staging (`staging`) | Parity Requirement |
| :--- | :--- | :--- | :--- |
| **Node.js Engine** | Node 22 LTS | Node 22 LTS | Exact version match |
| **Database Engine** | PostgreSQL 16+ | PostgreSQL 16+ | Exact engine & extension match |
| **Application Runtime** | Next.js Standalone Container | Next.js Standalone Container | Identical build artifact |
| **Reverse Proxy** | Nginx with TLS 1.3 | Nginx with TLS 1.3 | Identical configuration & rate limits |
| **Storage Subsystem** | POSIX Mounted Volume | POSIX Mounted Volume | Identical boundary isolation |
| **Domain & Host** | `e-office.cdktcnqn.edu.vn` | `staging.e-office.cdktcnqn.edu.vn` | Separate DNS & TLS certs |
| **OAuth Providers** | Google Workspace (Production) | Google Workspace (Staging App) | Isolated client IDs |

---

## 3. Data Sanitization & Anonymization Policy

To comply with Vietnamese privacy standards (Decree 13/2023/ND-CP on Personal Data Protection) and institutional regulations:

### 3.1 Prohibited Data in Staging
- Real Citizen Identification Numbers (`CCCD`, `CMND`).
- Real phone numbers and personal home addresses of school employees.
- Authentic production password hashes (`passwordHash`).
- Real banking or payroll numbers.
- Production session tokens and JWT secrets.

### 3.2 Permitted Data Strategies for Staging
1. **Synthetic Canonical Seeds (Preferred)**:
   - Populated via `npm run db:seed`.
   - Uses standardized test departments (Phòng Đào tạo, Phòng Tổ chức cán bộ, Ban Giám hiệu) and role personas with standardized test credentials.
2. **Sanitized Production Snapshot (When load/scale testing)**:
   - When scale testing requires real operational volume, database dumps must pass through an automated anonymization pipeline before import into Staging:
     ```sql
     -- Anonymization Script executed during staging DB restore
     UPDATE "User"
     SET
       "email" = CONCAT('user_', "id", '@staging.cdktcnqn.edu.vn'),
       "phone" = '0900000000',
       "passwordHash" = '$2a$12$e8Y6lR...standard_staging_bcrypt_hash...',
       "citizenId" = '001000000000';
     ```

---

## 4. Staging Validation & Promotion Gates

Before any build artifact is approved for promotion to the Production environment, it must pass the following verification gates in Staging:

### Gate 1: Database Migration Dry-Run
- Run `npx prisma migrate deploy` against the Staging database.
- Confirm that the migration completes with zero deadlocks and zero downtime for read traffic.

### Gate 2: End-to-End Authentication & Role Verification
- Verify login flow with test accounts for each institutional role:
  - `BAN_GIAM_HIEU`: Can view executive dashboard and issue resolutions.
  - `TRUONG_PHONG`: Can access unit tasks and approve deliverables.
  - `CHUYEN_VIEN`: Can view assigned tasks and submit deliverables.
- Confirm session cookies carry `HttpOnly`, `SameSite=Lax`, and `Secure` flags.

### Gate 3: Task & Document Workflow Validation
- Create and assign a task across departments.
- Submit a deliverable attachment and verify streaming retrieval.
- Review and approve the deliverable; confirm state transitions cleanly.

### Gate 4: Security & Health Check Probe
- Query `/api/system/network-info` and `/api/runtime-config`.
- Validate that zero secrets or database strings appear in response payloads.
- Verify security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options).

---

## 5. Teardown & Maintenance

- The Staging database is reset to fresh synthetic seeds on the first Monday of each month to prevent stale data accumulation.
- Ephemeral test uploads in Staging (`/app/uploads`) are purged weekly via automated cron job.
