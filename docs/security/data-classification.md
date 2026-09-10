# QCET E-Office — Data Classification & Protection Policy

**Document Status**: Canonical Governance Reference  
**Scope**: Institutional Data Assets, Classification Tiers, Handling Controls, Security Matrices  
**Authority**: Quản trị mạng / Ban Giám hiệu, Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn   
**Last Updated**: 2026-09-09  

---

## 1. Executive Summary & Purpose

The QCET E-Office platform manages administrative, operational, academic, and executive records for the **Quang Ninh College of Economic and Technology** (Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn ).

This document establishes the official **Data Classification Framework** and **Handling Policies**. All subsystems, backend APIs, client interfaces, database schemas, backup pipelines, and caching layers must adhere strictly to the rules defined herein.

---

## 2. Classification Tiers

All data created, processed, transmitted, or stored within QCET E-Office is categorized into four distinct classification tiers:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PUBLIC (Công khai)                                       │
│    Course catalog, public announcements, static UI assets    │
├─────────────────────────────────────────────────────────────┤
│ 2. INTERNAL (Nội bộ)                                        │
│    Department schedules, non-sensitive task metadata, directory│
├─────────────────────────────────────────────────────────────┤
│ 3. CONFIDENTIAL (Bảo mật)                                   │
│    PII (CCCD, email, phone), personal evaluations, sealed docs│
├─────────────────────────────────────────────────────────────┤
│ 4. SECURITY SENSITIVE (Tuyệt mật hệ thống)                  │
│    JWT signing keys, database passwords, session tokens, VAPID│
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Tier 1: Public (Công khai)
- **Definition**: Information intended for general consumption without restriction. Unauthorized disclosure poses zero risk to institutional operations, reputation, or individuals.
- **Representative Entities**:
  - Public institutional website assets, icons, typography, and PWA manifests.
  - Public school announcements and press releases.
  - Academic course catalog, institutional accreditation disclosures, and school overview.
  - Public academic calendar dates (holidays, semester start/end dates).
- **Access Boundary**: Accessible anonymously without authentication.

### 2.2 Tier 2: Internal (Nội bộ)
- **Definition**: Information intended exclusively for QCET faculty, staff, and leadership. Disclosure outside the institution could cause minor operational disruptions or administrative inconvenience.
- **Representative Entities**:
  - Organizational hierarchy (`OrganizationalUnit`, `Department`, `OrganizationalBody`).
  - Unit-level work schedules, non-sensitive task titles, and operational milestones.
  - Institutional telephone/email directory for staff and faculty.
  - DACUM duty and task definitions (`DacumDuty`, `DacumTaskDef`, `JobCatalogItem`).
- **Access Boundary**: Authenticated QCET session required (`qcet_session` JWT). Role-Based Access Control (RBAC) enforces scope (`school` vs `unit` vs `personal`).

### 2.3 Tier 3: Confidential (Bảo mật)
- **Definition**: Sensitive institutional records, Personally Identifiable Information (PII), executive deliberations, or legal records whose unauthorized disclosure could cause significant regulatory, financial, legal, or reputational harm.
- **Representative Entities**:
  - User Personally Identifiable Information: Citizen Identity numbers (`CCCD`/`CMND`), personal phone numbers, home addresses, compensation details.
  - Staff performance reviews, DACUM evaluations, disciplinary records, and personnel assignments.
  - Confidential official documents (`Document`), executive directives (`DocumentDirective`), and executive resolutions (`ExecutiveResolution`).
  - Private task attachments, deliverables pending review, and sealed academic exams.
- **Access Boundary**: Authenticated session with strict role and ownership verification. Scoped to authorized recipients, department heads, or executive leadership (`BAN_GIAM_HIEU`, `ADMIN`).

### 2.4 Tier 4: Security Sensitive (Tuyệt mật hệ thống)
- **Definition**: Cryptographic keys, credentials, and system authentication artifacts that grant control or privileged access to infrastructure, persistence, or communication channels.
- **Representative Entities**:
  - Application secrets: `AUTH_SECRET`, `JWT_SECRET`, session signing keys.
  - Infrastructure credentials: `DATABASE_URL`, PostgreSQL master passwords, Redis connection strings.
  - Third-party secrets: `GOOGLE_CLIENT_SECRET`, `VAPID_PRIVATE_KEY`, Notion integration tokens.
  - Active user session tokens (`qcet_session` cookie contents), OAuth refresh tokens, and password hashes (`passwordHash` in Prisma).
- **Access Boundary**: Restricted exclusively to server-side memory and secure runtime environment variables. **Never accessible to client runtimes, browser storage, or unencrypted logs.**

---

## 3. Data Handling & Protection Policy Matrix

| Policy Dimension | Tier 1: Public | Tier 2: Internal | Tier 3: Confidential | Tier 4: Security Sensitive |
| :--- | :--- | :--- | :--- | :--- |
| **Cache-Control (HTTP)** | `public, max-age=86400, s-maxage=604800` (CDN/Edge permitted) | `private, no-cache` (Browser only) | `private, no-store, max-age=0, must-revalidate` | `no-store, no-cache, must-revalidate, private` |
| **Browser Storage** | `localStorage`, `CacheStorage`, IndexedDB | In-memory React state, transient IndexedDB cache | In-memory React state only; IndexedDB permitted only if encrypted with session key | **STRICTLY PROHIBITED** in browser storage, cookies (except HttpOnly), or client memory |
| **Offline PWA Sync** | Pre-cached via Service Worker | Encrypted IndexedDB outbox (7-day TTL) | Ephemeral in-memory only; cleared upon tab close or logout | **STRICTLY PROHIBITED** from offline storage |
| **Logging & Telemetry** | Logged freely in operational logs | Metadata logged; PII masked via `sanitizeLogContext` | Entity ID logged only; payloads, names, attachments strictly redacted | **STRICTLY FORBIDDEN**; detected secrets trigger automatic redaction & security alerts |
| **Export Controls** | Unrestricted download | Authenticated staff export (CSV, XLSX) | Requires Department Head / Executive approval; logged in `AuditEvent` | **NO EXPORT PERMITTED** under any circumstance |
| **Encryption at Rest** | Optional (Standard filesystem) | Standard filesystem / PostgreSQL table space | AES-256 database / filesystem encryption (`PRIVATE_STORAGE_DIR`) | AES-256 / KMS / Encrypted Vault; salted bcrypt for passwords |
| **Encryption in Transit** | TLS 1.2+ / HTTPS | TLS 1.3 enforced; HSTS enabled | TLS 1.3 enforced; HSTS with 1-year preload | TLS 1.3 internal loopback / mutual TLS |
| **Backup Retention** | 30 days | 1 year (monthly archives) | 5 years (encrypted, off-site secondary) | Ephemeral; recovered via secure disaster recovery vault |

---

## 4. Operational Invariants & Implementation Controls

### 4.1 Client Inlining Guard (`NEXT_PUBLIC_*`)
- Under no circumstances may Tier 3 (Confidential) or Tier 4 (Security Sensitive) attributes be prefixed with `NEXT_PUBLIC_`.
- The build-time validator `src/config/env.client.ts` strictly rejects any forbidden keys (e.g. `DATABASE_URL`, `AUTH_SECRET`, `JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, `VAPID_PRIVATE_KEY`).

### 4.2 Storage Partitioning
- **Public / Temporary Storage** (`TEMP_STORAGE_DIR`): Used for generated reports and transient file downloads. Purged automatically after 24 hours.
- **Operational Attachments** (`UPLOADS_DIR`): Task attachments and public circulars. Access gated via `/api/files/[id]` with role checks.
- **Confidential Repository** (`PRIVATE_STORAGE_DIR`): Restricted filesystem path with POSIX permissions `0700`. Files served only via streaming route handlers verifying explicit ownership.

### 4.3 Redaction and Telemetry Sanitization
- All server and client logs pass through `src/telemetry/sanitize.ts`.
- Any field matching sensitive stems (`password`, `token`, `secret`, `jwt`, `cccd`, `cmnd`, `cookie`, `database_url`) is replaced with `[REDACTED]`.

---

## 5. Violation & Incident Response

1. **Accidental Exposure**: Any accidental leakage of Tier 3 or Tier 4 data to client bundles, logs, or unauthenticated endpoints must be reported immediately to the Network Administration team (`admin@cdktcnqn.edu.vn`).
2. **Immediate Remediation**:
   - Invalidate compromised session tokens or rotate cryptographic secrets immediately (see `docs/security/secrets.md`).
   - Purge affected reverse proxy caches and log archives.
   - Record incident details in the institutional security log.
