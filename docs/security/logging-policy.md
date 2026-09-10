# QCET E-Office — Logging & Telemetry Policy

**Document Status**: Canonical Security Reference  
**Scope**: Server-Side Logging, Client Telemetry, Sanitization Rules, Audit Logging, Retention  
**Compliance Baseline**: OWASP Logging & Monitoring Cheat Sheet, ISO/IEC 27001  
**Last Updated**: 2026-09-09  

---

## 1. Principles & Objectives

Logging in QCET E-Office serves three essential purposes:
1. **Operational Diagnostics**: Facilitating rapid root-cause analysis of system faults, API errors, and service degradations.
2. **Security & Forensic Auditing**: Recording critical administrative actions, authorization decisions, and access to confidential institutional assets.
3. **Data Privacy & Invariant Enforcement**: Guaranteeing that personal information and credentials are never stored in unstructured technical logs.

---

## 2. Forbidden Log Attributes (The Never-Log List)

In compliance with OWASP guidelines and system privacy invariants, the following attributes **must never appear in plaintext within log files, console streams, or telemetry sinks**:

| Category | Forbidden Attributes | Threat & Impact |
| :--- | :--- | :--- |
| **Authentication Secrets** | `password`, `passwordHash`, `tempPassword`, `pin`, `otp` | Credential harvesting; identity impersonation |
| **Tokens & Sessions** | `AUTH_SECRET`, `JWT_SECRET`, `access_token`, `refresh_token`, `bearer`, `jwt`, `cookie` (`qcet_session`) | Session hijacking; privilege escalation |
| **Infrastructure Secrets** | `DATABASE_URL`, PostgreSQL credentials, Redis URLs, connection strings | Full database compromise |
| **Cryptographic Material** | `VAPID_PRIVATE_KEY`, PEM/RSA/EC private keys, certificates | Identity spoofing; forgery of signed assertions |
| **Personal Identifiers (PII)** | Citizen ID (`CCCD`, `CMND`), social security, personal banking details, credit card (`cvv`/`pan`) | Identity theft; regulatory privacy violations |
| **Direct Request Headers** | `Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization` | Replay attacks; session compromise |

---

## 3. Automated Sanitization Engine

QCET E-Office enforces automated, multi-tier redaction through canonical sanitizers before any log entry reaches disk or console output:

### 3.1 Implementation Architecture
- **Server Logging**: Managed exclusively by `src/telemetry/server.ts` (`serverLogger`).
- **Sanitization Core**: Implemented in `src/telemetry/sanitize.ts` (`sanitizeLogContext`, `sanitizeString`, `sanitizeUrl`).
- **Circular Reference & Deep Object Protection**: Uses `WeakSet` traversal and a configurable depth limit (default: 10 levels) to prevent memory exhaustion or stack overflows during error serialization.

### 3.2 Redaction Behavior
1. **Key Matching**: Any key matching normalized sensitive stems (e.g. `password`, `secret`, `token`, `apikey`, `cccd`, `cmnd`, `cookie`, `databaseurl`) is replaced with `[REDACTED]`.
2. **URL Parameter Redaction**: Query string parameters in logged URLs matching sensitive patterns (e.g., `?token=...&code=...`) are replaced with `[REDACTED]`.
3. **Regex Pattern Sweeps**:
   - **Database URLs**: `postgres://...` -> `[REDACTED_DATABASE_URL]`
   - **Bearer Tokens**: `Bearer eyJ...` -> `Bearer [REDACTED_TOKEN]`
   - **Raw JWTs**: `eyJ...` -> `[REDACTED_JWT]`
   - **PEM Private Keys**: `-----BEGIN PRIVATE KEY...` -> `[REDACTED_PRIVATE_KEY]`
   - **Emails**: Replaced with `[REDACTED_EMAIL]` (unless explicit diagnostic opt-out is configured)
   - **Vietnamese Phone Numbers**: Replaced with `[REDACTED_PHONE]`

---

## 4. Standardized Log Format & Permitted Contexts

All server logs emitted by `serverLogger` are serialized as structured JSON objects:

```json
{
  "timestamp": "2026-09-09T14:32:00.123Z",
  "level": "info",
  "message": "Task deliverable submitted successfully",
  "context": {
    "requestId": "req_cuid1234567890",
    "actorId": "usr_cuid9876543210",
    "action": "DELIVERABLE_SUBMIT",
    "entityType": "TaskDeliverable",
    "entityId": "deliv_cuid5555555555",
    "taskId": "task_cuid4444444444",
    "durationMs": 42
  },
  "environment": "production"
}
```

### Permitted Log Attributes:
- **Timestamp**: ISO 8601 UTC string (`new Date().toISOString()`).
- **Log Level**: Standardized hierarchy: `debug`, `info`, `warn`, `error`.
- **Request / Correlation ID**: Unique identifier for tracing requests across micro-operations.
- **Actor Identity**: CUID of the authenticated user (`actorId`). **Never user passwords or tokens.**
- **Action & Entity**: Machine-readable action code and entity metadata (e.g. `entityType: "Task"`, `entityId: "..."`).
- **Execution Metrics**: Elapsed milliseconds, payload size bytes, affected row counts.
- **Sanitized Errors**: Error class name, safe sanitized error message, and redacted stack trace.

---

## 5. Distinction: Technical Logs vs. Immutable Audit Trail

QCET E-Office strictly decouples unstructured technical diagnostic logs from authoritative business audit events:

| Characteristic | Technical Operational Logs (`serverLogger`) | Institutional Audit Trail (`AuditEvent`) |
| :--- | :--- | :--- |
| **Primary Destination** | `stdout` / `stderr` / Docker log stream | Dedicated PostgreSQL table (`AuditEvent`) |
| **Primary Audience** | System administrators & DevOps engineers | School Leadership (`BAN_GIAM_HIEU`), Auditors, Inspectors |
| **Storage Mechanism** | Rotated text files / Systemd journald | Relational database records with foreign keys & indexes |
| **Transaction Boundary** | Non-transactional (fire-and-forget) | **Atomic with business transaction** (`prisma.$transaction`) |
| **Retention Period** | **30 days** | **5 years** (Institutional compliance requirement) |
| **Content Scope** | HTTP requests, performance metrics, errors | State transitions, approvals, delegations, directives |

---

## 6. Retention, Archival & Access Control

1. **Log Rotation**:
   - Production Docker containers configure log-driver rotation (`max-size: 50m`, `max-file: 10`).
   - Log files on host systems are compressed daily using `gzip` and deleted automatically after 30 days.
2. **Access Restrictions**:
   - Log directories and files are restricted to system administrators with POSIX permissions `0640` (owned by `qcet:adm`).
   - Technical logs must never be exposed via unauthenticated HTTP endpoints or browser consoles in production.
3. **Tamper Evidence**:
   - `AuditEvent` records are append-only. The database user role configured for standard application execution possesses `INSERT` and `SELECT` privileges on `AuditEvent`, with `UPDATE` and `DELETE` revoked.
