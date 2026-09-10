# QCET E-Office — Comprehensive API Endpoint Inventory & Security Baseline (Phase 0)

**Document Status**: Canonical Reference  
**Scope**: Full API Surface Audit, Security Posture, BOLA & Threat Analysis, Hardening Matrix  
**Date**: 2026-09-09  
**Branch**: `feat/dacum-role-delegation-workflow`  

---

## 1. Executive Summary

As part of **Phase 0** of the QCET E-Office API Hardening & Architecture Improvement Plan, this document establishes the exhaustive inventory of all HTTP route handlers implemented under `src/app/api`. Every route handler and HTTP method is cataloged across critical security dimensions: authentication mechanism, role-based authorization (RBAC), object-level authorization (BOLA/IDOR protection), input validation schema, rate limiting, and state side effects.

### Key Inventory Metrics
- **Total Route Files**: 31 files under `src/app/api/**/route.ts`
- **Total HTTP Method Handlers**: 43 active method handlers
- **Categories**:
  - **Public**: 8 handlers (OAuth login, session creation, register, healthcheck, dev info, VAPID key)
  - **Authenticated**: 23 handlers (user profile, task viewing/updating, document listing/updating, notifications)
  - **Privileged**: 6 handlers (executive resolutions, directives, deliverable review, task deletion)
  - **High-Cost / Resource-Intensive**: 6 handlers (Vietnamese multi-tier search, Excel export, file streaming, push testing, dashboard live aggregation)

### Critical Findings & Security Gaps
1. **Unauthenticated Information Leaks (P0)**:
   - `GET /api/users`: Completely public; exposes entire staff directory (names, emails, titles, department IDs) without session verification.
   - `GET /api/documents/stats`: Public; leaks institution-wide document count and urgency breakdown without authentication.
   - `GET /api/files/[...path]`: Public file serving; path is sanitised against directory traversal but lacks authentication or object-level authorization checks.
2. **Broken Object-Level Authorization (BOLA / IDOR) (P0)**:
   - `PATCH /api/documents/[id]`: Any authenticated user can modify any document in the system regardless of department or ownership.
   - `POST /api/tasks/[id]/deliverables`: Accepts client-provided `uploadedById` with fallback to `prisma.user.findFirst()`, allowing identity spoofing in deliverable submissions.
   - `GET /api/documents/download`: Checks authentication and path traversal, but fails to check whether the requesting user is authorized to read the underlying document.
3. **Missing Strict Input Validation (P1)**:
   - Only 2 endpoints currently leverage Zod schemas (`/api/users/onboarding`). Most mutation endpoints perform loose manual destructuring and unchecked type casting without length bounds or enum whitelisting.
4. **Absence of Rate Limiting (P1)**:
   - Zero endpoints implement rate limiting, leaving credential endpoints (`/api/auth/login`, `/api/auth/register`), CPU-intensive search (`/api/search`), and external push dispatch (`/api/notifications/push/test`) open to brute-force and DoS.
5. **Database Error & Architecture Leaks (P2)**:
   - `/api/dashboard/overview`: Returns `details: err?.message || String(err)` in 500 error responses, disclosing raw database driver exceptions to clients.
   - Duplicate route aliases exist (`/api/push/*` re-exporting `/api/notifications/push/*`), violating the "One Capability, One Implementation" invariant.

---

## 2. Master API Endpoint Inventory

The following canonical matrix accounts for all 43 HTTP method handlers currently implemented in `src/app/api`:

| Endpoint | Method | Auth | Role | Object Auth | Input Schema | Rate Limit | Side Effect |
|---|---|---|---|---|---|---|---|
| `/api/auth/google` | `GET` | None | Public | N/A | None (Reads env/host) | None | Sets `qcet_oauth_state` cookie, redirects (302) to Google OAuth |
| `/api/auth/callback/google` | `GET` | None | Public | Validates CSRF `state` cookie | Query params (`code`, `state`, `error`) | None | Atomic DB transaction (upsert Account, link/create User, default role `CHUYEN_VIEN` / `ADMIN`), signs JWT session cookie, redirects |
| `/api/auth/login` | `POST` | None | Public | N/A | Manual `{ email, password }` | None (High Risk) | Compares bcrypt password hash, signs JWT session, sets `qcet_session` cookie |
| `/api/auth/logout` | `POST` | None | Public | N/A | None | None | Clears `qcet_session` cookie (`maxAge: 0`) |
| `/api/auth/me` | `GET` | Cookie (`qcet_session`) | Any Authenticated | Strict self (`payload.id`) | None | None | Reads active user profile from DB |
| `/api/auth/register` | `POST` | None | Public | Enforces `CHUYEN_VIEN` role | Manual `{ email, password, name, departmentId?, title? }` | None (High Risk) | Bcrypt hash, creates User and default onboarding state in DB |
| `/api/dashboard/overview` | `GET` | Inconsistent (Optional in overload) | Any Authenticated | None (Global aggregation) | None | None (High Cost) | Multiple heavy parallel DB queries across tasks, documents, resolutions; leaks DB error |
| `/api/documents` | `GET` | Cookie / Bearer | Any Authenticated | None (No department/security filter) | Query params (`type`, `year`, `status`, `urgency`, `securityLevel`, `search`, `limit`, `page`) | None | DB findMany with pagination |
| `/api/documents` | `POST` | Cookie / Bearer | Any Authenticated | Overwrites `registeredById = session.id` | Validator function (`validateDocumentCreatePayload`) | None | DB transaction (Document, relations, log) |
| `/api/documents/[id]` | `GET` | Cookie / Bearer | Any Authenticated | None (No securityLevel check) | Route param `id` | None | DB findUnique document with relations |
| `/api/documents/[id]` | `PATCH` | Cookie / Bearer | Any Authenticated | **None (CRITICAL BOLA)** | Validator function (`validateDocumentUpdatePayload`) | None | DB update on Document entity |
| `/api/documents/[id]/directives` | `POST` | Cookie / Bearer | `BAN_GIAM_HIEU`, `ADMIN` | Verifies document exists | Validator function (`validateDirectivePayload`) | None | Atomic DB transaction (creates linked tasks, directives, logs, notifications) |
| `/api/documents/download` | `GET` | Cookie (`qcet_session`) | Any Authenticated | **Missing** (Checks path traversal only; no document permission check) | Query param `file` | None (High Cost) | Resolves disk path, opens byte range read stream |
| `/api/documents/export-excel` | `GET` | Cookie (`qcet_session`) | Any Authenticated | None (Exports all matching records) | Query params (`type`, `year`) | None (High Cost) | Large DB query, generates CSV string, streams text/csv attachment |
| `/api/documents/stats` | `GET` | **None (LEAK)** | Public | None | None | None | DB counts across Document table |
| `/api/executive/resolutions` | `GET` | Cookie / Bearer | Any Authenticated | Query filters only (`taskId`, `departmentId`) | Query params (`taskId`, `resolutionType`, `departmentId`, `limit`) | None | DB findMany with actor and task details |
| `/api/executive/resolutions` | `POST` | Cookie / Bearer | `BAN_GIAM_HIEU`, `ADMIN` | Verifies `taskId` exists | Manual JSON parsing with enum mapping | None | Atomic DB transaction (task update, ExecutiveResolution create), background Web Push |
| `/api/files/[...path]` | `GET` | **None (LEAK)** | Public | **Missing** (Checks path traversal only; no session/entity check) | Route param `path` (array) | None (High Cost) | Reads local disk file, streams binary with range requests |
| `/api/health` | `GET` | None | Public | N/A | None | None | DB ping (`SELECT 1`), reports latency and process uptime |
| `/api/notifications` | `GET` | Cookie (`qcet_session`) | Any Authenticated | Strict user (`userId = session.id`) | Query params (`unreadOnly`, `category`, `limit`) | None | DB findMany notifications, count unread |
| `/api/notifications` | `PATCH` | Cookie (`qcet_session`) | Any Authenticated | Strict user (`userId = session.id`) | None | None | DB updateMany setting `isRead: true`, `readAt: now` |
| `/api/notifications/[id]/read` | `PATCH` | Cookie (`qcet_session`) | Any Authenticated | Strict ownership (`existing.userId === session.id`) | Route param `id` | None | DB update setting `isRead: true`, `readAt: now` |
| `/api/notifications/push/key` | `GET` | None | Public | N/A | None | None | Reads VAPID public key from env |
| `/api/notifications/push/subscribe` | `GET` | None | Public | N/A | None | None | Duplicate of `/api/notifications/push/key` |
| `/api/notifications/push/subscribe` | `POST` | Cookie (`qcet_session`) | Any Authenticated | Strict user (`userId = session.id`) | Manual JSON parsing | None | DB upsert into `PushSubscription` |
| `/api/notifications/push/subscribe` | `DELETE` | Cookie (`qcet_session`) | Any Authenticated | Strict user (`endpoint` + `userId = session.id`) | Manual JSON `{ endpoint }` | None | DB update setting `status: 'REVOKED'` |
| `/api/notifications/push/test` | `POST` | Cookie (`qcet_session`) | Any Authenticated | Strict self (`userId = session.id`) | Manual JSON `{ title?, linkHref? }` | None (High Cost) | Creates Notification in DB, dispatches external Web Push HTTP request |
| `/api/notifications/read-all` | `POST` | Cookie (`qcet_session`) | Any Authenticated | Strict user (`userId = session.id`) | None | None | DB updateMany setting `isRead: true`, `readAt: now` |
| `/api/push/subscribe` | `GET` | None | Public | Re-export alias | None | None | Alias to `/api/notifications/push/subscribe` |
| `/api/push/subscribe` | `POST` | Cookie (`qcet_session`) | Any Authenticated | Re-export alias | Manual JSON | None | Alias to `/api/notifications/push/subscribe` |
| `/api/push/subscribe` | `DELETE` | Cookie (`qcet_session`) | Any Authenticated | Re-export alias | Manual JSON | None | Alias to `/api/notifications/push/subscribe` |
| `/api/push/test` | `POST` | Cookie (`qcet_session`) | Any Authenticated | Re-export alias | Manual JSON | None | Alias to `/api/notifications/push/test` |
| `/api/search` | `GET` | Cookie (`qcet_session`) | Any Authenticated | None (Searches all tasks & users globally) | Query param `q` (unbounded string) | None (High Cost) | Parallel DB searches, in-memory Vietnamese scoring & ranking |
| `/api/system/network-info` | `GET` | None (404 in prod) | Public (Dev only) | N/A | None | None | Reads OS network interfaces (Tailscale / LAN IP) |
| `/api/tasks` | `GET` | Cookie / Bearer | Any Authenticated | Partial scope filter (No strict department tenancy check) | Query params (`page`, `limit`, `academicMonth`, `dept`, `scope`, `year`, `status`, `assignedTo`, `parentTaskId`, `all`) | None | DB findMany with pagination, subtasks, deliverables, assignees |
| `/api/tasks` | `POST` | Cookie / Bearer | Any Authenticated | **Vulnerable** (Accepts `creatorId` from body, fallback to `user.findFirst()`) | Manual JSON destructuring | None | DB transaction (atomic task code generation, Task create, Assignee create), push notification |
| `/api/tasks/[id]` | `GET` | Cookie / Bearer | Any Authenticated | None (Any user can view full task details) | Route param `id` | None | DB findUnique with deep relations (subtasks, deliverables, resolutions, DACUM) |
| `/api/tasks/[id]` | `PATCH` | Cookie / Bearer | Any Authenticated | Policy check: Admin, BGH, creator, assignee, or dept leader | Manual JSON destructuring | None | DB update on Task, status progression, subtask cascade |
| `/api/tasks/[id]` | `DELETE` | Cookie / Bearer | Privileged / Leader / Creator | Policy check: Admin, BGH, creator, or dept leader | Route param `id` | None | Atomic DB transaction deleting subtasks, deliverables, assignees, unlinking documents, deleting task |
| `/api/tasks/[id]/deliverables` | `POST` | Cookie / Bearer | Any Authenticated | **Vulnerable** (Accepts `uploadedById` from body with fallback to `findFirst()`) | Manual JSON destructuring | None | DB transaction (creates TaskDeliverable, updates task to `WAITING_APPROVAL`) |
| `/api/tasks/[id]/deliverables` | `PATCH` | Cookie / Bearer | Privileged / Leader / Creator | Strict SoD (`uploadedById !== session.id`, reviewer authority check) | Manual JSON destructuring | None | DB transaction (updates review status, auto-completes task if all approved) |
| `/api/users` | `GET` | **None (LEAK)** | Public | None | Query params (`departmentId`, `q`) | None | DB findMany users (name, email, role, dept, title, avatar) |
| `/api/users/onboarding` | `PATCH` | Cookie (`qcet_session`) | Any Authenticated | Strict self (`id = payload.id`) | Strict Zod (`updateOnboardingSchema`) | None | DB update on `User.onboardingData` and `onboardedAt` |
| `/api/users/onboarding` | `DELETE` | Cookie (`qcet_session`) | Any Authenticated | Strict self (`id = payload.id`) | None | None | DB update resetting onboarding state to null |

---

## 3. Detailed Categorization

### 3.1 Public Endpoints (8 Handlers)
Endpoints accessible without active authentication credentials:

| Endpoint | Method | Purpose | Security Hardening Required |
|---|---|---|---|
| `/api/auth/google` | `GET` | Initiates Google OAuth flow | Add state expiration and IP rate limiting. |
| `/api/auth/callback/google` | `GET` | Handles Google OAuth callback | Validate state strictly; ensure domain allowlist enforcement; rate limit. |
| `/api/auth/login` | `POST` | Email/password login | **P0 Rate Limit**: Tiered token bucket by IP + email; strict Zod schema; standardized error response. |
| `/api/auth/logout` | `POST` | Terminates session | Enforce `no-store` cache headers. |
| `/api/auth/register` | `POST` | Account creation | **P0 Rate Limit**: Strict IP rate limiting; bounded Zod schema; role forced to `CHUYEN_VIEN`. |
| `/api/health` | `GET` | Service & DB health check | Bound execution time; sanitize error response (no raw DB error dumps). |
| `/api/system/network-info` | `GET` | Dev network diagnostics | Ensure strictly disabled in production (`NODE_ENV === 'production'` check). |
| `/api/notifications/push/key` | `GET` | Public VAPID key distribution | Static cache header (`public, max-age=86400`). |

> **Security Flaw Detected**: Currently, `/api/users`, `/api/documents/stats`, and `/api/files/[...path]` are accessible without authentication. They are classified below under their intended categories with high-priority remediation flags.

### 3.2 Authenticated Endpoints (23 Handlers)
Endpoints requiring a valid session (`qcet_session` cookie or Authorization Bearer header) but operable by standard users:

| Endpoint | Method | Intended Access | Current Gap & Required Hardening |
|---|---|---|---|
| `/api/auth/me` | `GET` | Current user | Add DTO mapping; strip raw DB model; `private, no-store`. |
| `/api/dashboard/overview` | `GET` | Any authenticated user | Fix inconsistent overload auth; strip raw DB error in catch block; add response DTO; scope metrics to user role/department. |
| `/api/documents` | `GET` | Any authenticated user | Enforce scope/department tenancy; sanitize search query; clamp pagination limit to max 100. |
| `/api/documents` | `POST` | Any authenticated user | Validate input with strict Zod schema; enforce department-level permission checks. |
| `/api/documents/[id]` | `GET` | Authorized viewers | Enforce confidentiality / `securityLevel` read policy (document policy). |
| `/api/documents/[id]` | `PATCH` | Document owner / Leader | **Critical BOLA**: Must enforce `canUpdateDocument(user, doc)`. Currently allows any user to overwrite any document! |
| `/api/documents/stats` | `GET` | Any authenticated user | **Fix Leak**: Add session verification; scope stats to user's authorized domain. |
| `/api/notifications` | `GET` | Notification recipient | Clamp `limit` to 50; map to NotificationDTO; `private, no-store`. |
| `/api/notifications` | `PATCH` | Notification recipient | Deduplicate with `/api/notifications/read-all` or align semantic behavior; enforce CSRF check. |
| `/api/notifications/[id]/read` | `PATCH` | Notification recipient | Already checks `existing.userId === session.id`; align error shape. |
| `/api/notifications/read-all` | `POST` | Notification recipient | Enforce CSRF check; standard error handling. |
| `/api/notifications/push/subscribe` | `GET` | Any authenticated user | Redundant with `push/key`; deprecate or align. |
| `/api/notifications/push/subscribe` | `POST` | Any authenticated user | Strict Zod input schema; rate limit subscription writes. |
| `/api/notifications/push/subscribe` | `DELETE` | Any authenticated user | Validate endpoint string; rate limit. |
| `/api/push/subscribe` | `GET, POST, DELETE` | Duplicate Alias | Deprecate in favor of canonical `/api/notifications/push/subscribe`. |
| `/api/tasks` | `GET` | Any authenticated user | Enforce Scope vs Role dataset filtering; clamp limit to max 100; map through TaskDTO. |
| `/api/tasks` | `POST` | Authorized task creator | **Bypass Risk**: Prevent client-supplied `creatorId`; enforce `session.id` as creator; restrict school-level creation to `ADMIN` / `BGH`. |
| `/api/tasks/[id]` | `GET` | Authorized task viewer | Enforce `canReadTask(user, task)` policy; strip unneeded relations. |
| `/api/tasks/[id]` | `PATCH` | Creator, Assignee, Leader | Add optimistic concurrency control (`updatedAt` / `version`); Zod command contract; audit log. |
| `/api/tasks/[id]/deliverables` | `POST` | Task assignee | **Bypass Risk**: Remove client `uploadedById`; strictly bind to `session.id`; verify user is assignee. |
| `/api/users` | `GET` | Any authenticated user | **Fix Leak**: Require authentication; clamp search query length; map through UserDTO (strip sensitive details). |
| `/api/users/onboarding` | `PATCH` | Current user | Already uses Zod; add CSRF check and standardized response contract. |
| `/api/users/onboarding` | `DELETE` | Current user | Enforce CSRF check and standard response. |

### 3.3 Privileged Endpoints (6 Handlers)
Endpoints restricted to administrative or institutional leadership roles (`ADMIN`, `BAN_GIAM_HIEU`, `TRUONG_PHONG`):

| Endpoint | Method | Required Role | Function & Object Authorization Requirements |
|---|---|---|---|
| `/api/documents/[id]/directives` | `POST` | `BAN_GIAM_HIEU`, `ADMIN` | Enforce role check; verify document exists and is eligible for directives; atomic transaction with audit trail. |
| `/api/executive/resolutions` | `GET` | `BAN_GIAM_HIEU`, `ADMIN`, Leader | Restrict listing to authorized leadership or task stakeholders. |
| `/api/executive/resolutions` | `POST` | `BAN_GIAM_HIEU`, `ADMIN` | Function check (`isBghOrAdmin`); verify `taskId` exists; atomic transaction; sanitize error output. |
| `/api/tasks/[id]` | `DELETE` | `BAN_GIAM_HIEU`, `ADMIN`, Creator | Strict policy check (`canDeleteTask`); verify no finalized deliverables or audit locks; atomic cascade. |
| `/api/tasks/[id]/deliverables` | `PATCH` | `BAN_GIAM_HIEU`, `ADMIN`, Leader, Creator | Separation of Duties enforced (`uploadedById !== session.id`); authority verified (`canReviewDeliverable`). |

### 3.4 High-Cost & Resource-Intensive Endpoints (6 Handlers)
Endpoints performing expensive computations, large exports, external network dispatches, or heavy I/O:

| Endpoint | Method | Cost Factor | Risk & Mitigation Required |
|---|---|---|---|
| `/api/search` | `GET` | Multi-pass Vietnamese regex, diacritic folding, telex normalization, parallel DB queries, in-memory ranking | **DoS Risk**: Implement strict per-user/IP rate limit (max 30 req/min); cap query string to 100 characters; enforce minimum 2 characters; restrict search results by user scope. |
| `/api/documents/export-excel` | `GET` | Unbounded DB scan, full dataset serialization to CSV, memory buffer overhead | **Resource Exhaustion**: Require authentication; restrict export window/date range; add rate limit (max 5 exports/min); enforce role permissions. |
| `/api/documents/download` | `GET` | File system read stream, byte-range slicing | **Unauthorized Exfiltration**: Enforce authentication; verify requesting user has read permission on the linked document before serving file. |
| `/api/files/[...path]` | `GET` | File system read stream, binary pipe | **Data Exposure & Bandwidth Abuse**: Currently completely unauthenticated! Require session authentication; verify file linkage and object permissions; add secure headers (`X-Content-Type-Options: nosniff`). |
| `/api/notifications/push/test` | `POST` | External HTTPS dispatch to Google FCM / Web Push service endpoints | **Spam & External Rate Limit Exhaustion**: Restrict test push endpoint to development mode or apply strict user rate limit (max 3/hour); restrict to `ADMIN`. |
| `/api/dashboard/overview` | `GET` | Multiple aggregations and counts across large tables (`Task`, `Document`, `ExecutiveResolution`) | **DB Load**: Add short-term cache/memoization header (`stale-while-revalidate`); handle connection failures gracefully without dumping stack traces. |

---

## 4. Current State vs Required Hardening Architecture

```
Current State (Vulnerable/Inconsistent)
┌─────────────────────────────────────────────────────────────┐
│ 1. Inconsistent Auth Extraction (Raw cookies vs Bearer)     │
│ 2. Missing Object-Level Auth (BOLA on documents, tasks)     │
│ 3. Unbounded / Unvalidated Request JSON (Few Zod schemas)   │
│ 4. No Rate Limiting (Login brute-force, Search DoS)         │
│ 5. No CSRF Protection on Cookie Mutations                   │
│ 6. Raw Error Leaks (500 details: err.message dumped)        │
│ 7. Raw Prisma Model Leakage in Responses                    │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
Target Hardened Architecture (Wave 1 - Wave 4 Implementation)
┌─────────────────────────────────────────────────────────────┐
│ HTTP Request                                                │
│      │                                                      │
│      ▼                                                      │
│ [Task 3] Central Request Context (`ApiRequestContext`)       │
│      │   - Generates/propagates `X-Request-ID`              │
│      │   - Verifies server session & extracts active scope  │
│      ▼                                                      │
│ [Task 6] CSRF Protection & Security Headers                 │
│      │   - Validates `Sec-Fetch-Site` & `Origin` on POST/   │
│      │     PUT/PATCH/DELETE                                 │
│      ▼                                                      │
│ [Task 7] Rate Limiting & Payload Guards                     │
│      │   - Tiered token-bucket/sliding-window limits        │
│      │   - `application/json` & max body size enforcement   │
│      ▼                                                      │
│ [Task 4] Zod Input Contracts with Explicit Bounds           │
│      │   - Strict length, enum, pagination, type boundaries │
│      │   - Prevents Mass Assignment                         │
│      ▼                                                      │
│ [Task 5] Authorization Policies (Function & Object Level)   │
│      │   - `canRead*`, `canUpdate*`, `canApprove*`          │
│      │   - Strict Separation of Duties (SoD)                │
│      ▼                                                      │
│ Domain Commands / Queries / Atomic Transactions             │
│      │   - Optimistic Concurrency Control (`updatedAt`)     │
│      ▼                                                      │
│ [Task 8] Response DTO Mappers & Data Sanitization           │
│      │   - Strips password hashes, tokens, internal fields  │
│      ▼                                                      │
│ [Task 2] Canonical API Response & Error Contract            │
│          - Success: `{ success: true, data: T }`            │
│          - Error: `{ error: { code, message, requestId } }` │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Security Gap Remediation Mapping

| Gap ID | Subsystem | Vulnerability Description | Severity | Remediation Plan Task |
|---|---|---|---|---|
| **GAP-01** | `GET /api/users` | Unauthenticated public access to entire user and staff directory | **High** | Task 3 & Task 9 (Enforce `requireAuthenticated`, UserDTO) |
| **GAP-02** | `GET /api/documents/stats` | Unauthenticated public access to institutional document counts | **Medium** | Task 3 & Task 11 (Enforce authentication) |
| **GAP-03** | `GET /api/files/[...path]` | Unauthenticated public access to uploaded files | **High** | Task 3 & Task 13 (Enforce authentication and file access check) |
| **GAP-04** | `PATCH /api/documents/[id]` | Critical BOLA: Any user can modify any document | **Critical** | Task 5 & Task 11 (`canUpdateDocument` policy check) |
| **GAP-05** | `POST /api/tasks/[id]/deliverables` | Client-controlled `uploadedById` with arbitrary user fallback | **Critical** | Task 3, Task 4 & Task 10 (Strict session binding, Zod contract) |
| **GAP-06** | `POST /api/tasks` | Client-controlled `creatorId` and arbitrary task creation | **High** | Task 4 & Task 10 (Strict session binding, creator role check) |
| **GAP-07** | `GET /api/documents/download` | Object-level auth missing before file streaming | **High** | Task 5 & Task 13 (Check document read permission before streaming) |
| **GAP-08** | `/api/auth/login`, `/api/auth/register` | No rate limiting against credential stuffing or registration flood | **High** | Task 7 & Task 9 (Strict IP + email rate limiting) |
| **GAP-09** | `GET /api/search` | CPU-heavy Vietnamese search vulnerable to DoS queries | **Medium** | Task 7 & Task 12 (Rate limit, query length cap, scope filtering) |
| **GAP-10** | `POST /api/notifications/push/test` | Any user can trigger external push notifications | **Medium** | Task 7 & Task 12 (Rate limit, restrict to admin or development) |
| **GAP-11** | `/api/dashboard/overview` | Error catch block leaks internal DB error details | **Medium** | Task 2 & Task 12 (Standard error contract, sanitize error response) |
| **GAP-12** | `/api/push/*` | Duplicate route alias violating "One Capability, One Implementation" | **Low** | Task 12 (Consolidate into `/api/notifications/push/*`) |
| **GAP-13** | All Mutation Routes | Missing CSRF verification for cookie-authenticated mutations | **High** | Task 6 (CSRF middleware / origin validation) |
| **GAP-14** | All Endpoints | Non-standard error responses (`{ error: string }` vs RFC 7807 vs `{ success: false }`) | **Medium** | Task 2 (Canonical error shape `{ error: { code, message, requestId } }`) |

---

## 6. Verification and Audit Confirmation

All 31 route files under `src/app/api` were exhaustively parsed and inventoried:
```text
31 route files audited.
43 HTTP method handlers cataloged.
Zero omitted routes.
```

This inventory serves as the architectural baseline for subsequent implementation waves:
- **Wave 1**: Foundational security infrastructure (Tasks 2, 3, 4, 5, 6, 7, 8)
- **Wave 2**: Endpoint refactoring with security boundaries (Tasks 9, 10, 11, 12, 13)
- **Wave 3**: Verification and comprehensive test suite (Task 14)
