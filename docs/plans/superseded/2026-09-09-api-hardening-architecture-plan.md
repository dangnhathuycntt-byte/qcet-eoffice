---
status: superseded
domain: architecture
created: 2026-09-09
superseded_by: 2026-09-09-remaining-source-improvement-master-plan.md
---

# QCET E-Office — API Hardening & Architecture Improvement Plan

## 1. API hiện tại

API tree đã thấy:

```text
/api
├── auth/
│   ├── callback/google
│   ├── google
│   ├── login
│   ├── logout
│   ├── me
│   └── register
│
├── dashboard/
│   └── overview
│
├── tasks/
│   ├── route
│   └── [id]/
│       ├── route
│       └── deliverables
│
├── documents/
│   ├── route
│   ├── stats
│   ├── export-excel
│   ├── download
│   └── [id]/
│       ├── route
│       └── directives
│
├── executive/
│   └── resolutions
│
├── notifications/
│   ├── route
│   ├── read-all
│   ├── [id]/read
│   └── push/
│       ├── key
│       ├── subscribe
│       └── test
│
├── users/
│   ├── route
│   └── onboarding
│
├── files/[...]
├── search
├── health
└── system/network-info
```

Đây là API surface tương đối lớn và đã chứa:
authentication, authorization, workflow mutations, files, notifications, search, export, administration.
Vì vậy phải coi mỗi Route Handler như một **public HTTP boundary**.

---

## 2. Target Architecture

Mỗi mutation endpoint cuối cùng nên có flow:
```text
HTTP Request
     │
     ▼
Request Context (requestId, authenticated session, client metadata)
     │
     ▼
Content-Type / Size Validation
     │
     ▼
Zod Input Contract
     │
     ▼
Authorization (function-level, object-level, property-level)
     │
     ▼
Domain Command / Query
     │
     ▼
Transaction (database state, audit event, outbox event)
     │
     ▼
DTO Mapper
     │
     ▼
Canonical API Response
```

Route Handler phải mỏng, đóng vai trò HTTP adapter.

---

## Global Constraints
1. **One Capability, One Implementation**: Never create parallel engines (no `api-v2/` duplicates).
2. **Role Is Not Scope**: Role defines authority; Scope defines dataset filter (`school`, `unit`, `personal`).
3. **Server Truth Wins**: Session and DB are authoritative. No client trust.
4. **Never Weaken Security to Pass Tests**: Server-side RBAC and object-level authorization strictly enforced.
5. **No Blind Prisma Spread**: Never spread `request.json()` or unbounded bodies directly into `prisma.*`.
6. **No Raw Prisma Models**: Cherry-pick and map fields through DTOs, stripping secrets/hashes/tokens.

---

## Tasks Breakdown (Organized in Waves)

### Task 1: API Inventory Documentation (Phase 0)
- **Files**: `docs/architecture/api-inventory.md`
- **Goal**: Full endpoint inventory of all existing `/api` routes with Method, Auth, Role, Object Auth, Input Schema, Rate Limit, and Side Effect. Categorize into Public, Authenticated, Privileged, High-cost.
- **Verification**: Ensure every route in `src/app/api` is accounted for.

### Task 2: Standard Error Contract & Error Abstraction (Phases 5 & 6)
- **Files**: `src/server/api/errors.ts`, `src/server/api/response.ts`
- **Goal**: Standard error shape `{ error: { code, message, fieldErrors?, requestId } }`. Define typed error classes: `ApiError`, `AuthenticationError`, `AuthorizationError`, `ValidationError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `PayloadTooLargeError`, `UnsupportedMediaTypeError`. Provide `toApiErrorResponse(error, requestId)` and response helpers with proper HTTP status codes.
- **Verification**: Unit tests covering error class instantiation and HTTP serialization mapping.

### Task 3: Central API Request Context & Auth Extraction (Phase 1)
- **Files**: `src/server/api/request-context.ts`
- **Goal**: Extract `ApiRequestContext` (`requestId`, `user`, `ip`, `userAgent`, `scope`). Provide helpers `getApiContext(req)`, `requireAuthenticated(ctx)`, `requireRole(ctx, roles)`. Generate and attach `X-Request-ID`.
- **Verification**: Unit tests verifying request ID propagation, unauthenticated/authenticated extraction, and role check failure/success.

### Task 4: Shared Input Contracts with Strict Limits (Phases 3, 4 & 9)
- **Files**: `src/contracts/common.ts`, `src/contracts/auth.ts`, `src/contracts/tasks.ts`, `src/contracts/documents.ts`, `src/contracts/notifications.ts`, `src/contracts/users.ts`
- **Goal**: Zod schemas for input validation with explicit bounds (max lengths, pagination limits, array bounds, enum restrictions). Command schemas for mutations preventing mass assignment.
- **Verification**: Unit tests validating bounded string lengths, invalid enums, oversized arrays, and schema rejections.

### Task 5: Authorization Policy Layer - Function & Object Level (Phase 2)
- **Files**: `src/server/policies/task-policy.ts`, `src/server/policies/document-policy.ts`, `src/server/policies/notification-policy.ts`, `src/server/policies/user-policy.ts`, `src/server/policies/executive-policy.ts`, `src/server/policies/index.ts`
- **Goal**: Pure authorization policies:
  - Task: `canReadTask(user, task)`, `canUpdateTask(user, task)`, `canApproveTask(user, task)`, `canSubmitDeliverable(user, task)`
  - Document: `canReadDocument(user, doc)`, `canDirectDocument(user, doc)`
  - Notification: `canReadNotification(user, notif)`
  - User & Executive policies.
- **Verification**: Unit tests exercising role + department/assignee boundaries (e.g. Manager A accessing Department B's task, Staff reading another user's notification).

### Task 6: CSRF Protection & Security Headers (Phase 7)
- **Files**: `src/server/security/csrf.ts`
- **Goal**: CSRF verification for state-changing HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`). Validate `Sec-Fetch-Site` and `Origin` against allowed origins for cookie-authenticated sessions. Safe bypass for internal webhooks/tokens.
- **Verification**: Unit tests testing same-origin, cross-origin browser requests, and safe methods.

### Task 7: Business Flow Rate Limiting & Payload Guards (Phases 8 & 9)
- **Files**: `src/server/security/rate-limit.ts`, `src/server/api/validation.ts`
- **Goal**: Endpoint-specific rate limiter with tiered limits:
  - Auth (login/register): tight limit per IP + account/email.
  - Search: per user / per IP limit + query length cap.
  - Push test / high-cost operations: tight admin-only limits.
  - Content-Type enforcement (`application/json` check) and payload size limit check (`413 Payload Too Large`).
- **Verification**: Unit tests checking rate limit throttling, window expiry, and payload limit rejections.

### Task 8: Response DTO Mappers & Data Sanitization (Phase 15)
- **Files**: `src/server/dto/user-dto.ts`, `src/server/dto/task-dto.ts`, `src/server/dto/document-dto.ts`, `src/server/dto/notification-dto.ts`
- **Goal**: DTO mappers ensuring zero raw Prisma leakage. Strip password hashes, internal secrets, OAuth tokens, and unnecessary relational details.
- **Verification**: Unit tests asserting sensitive fields are absent from mapped DTO output.

### Task 9: Refactor Auth & User Routes with Security Boundary
- **Files**: `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/auth/me/route.ts`, `src/app/api/users/route.ts`, `src/app/api/users/onboarding/route.ts`
- **Goal**: Apply request context, rate limiting, Zod validation, DTO mapping, error contract, and cache headers (`private, no-store`).
- **Verification**: Automated tests for auth routes (valid/invalid credentials, rate limiting, DTO output).

### Task 10: Refactor Task Routes with Object Auth, OCC & Transactions (Phases 2, 3, 11, 13)
- **Files**: `src/app/api/tasks/route.ts`, `src/app/api/tasks/[id]/route.ts`, `src/app/api/tasks/[id]/deliverables/route.ts`, `src/server/tasks/commands.ts`, `src/server/tasks/queries.ts`
- **Goal**:
  - GET: Paginated query with max 100 items clamp, server filters, task-policy read check.
  - POST / PATCH: Zod command input, object authorization check, optimistic concurrency control via `updatedAt` / `version`, atomic transactions with audit trail.
- **Verification**: Tests checking BOLA protection (403 on unowned/unauthorized task), OCC conflict (409 on stale update), and successful mutation.

### Task 11: Refactor Document Routes & Directives with Security Boundary
- **Files**: `src/app/api/documents/route.ts`, `src/app/api/documents/[id]/route.ts`, `src/app/api/documents/[id]/directives/route.ts`, `src/app/api/documents/stats/route.ts`
- **Goal**: Object-level authorization for documents and directives, transactional directive addition, input validation, and pagination.
- **Verification**: Automated tests for document authorization and directive creation.

### Task 12: Refactor Notifications, Executive & High-Cost Endpoints
- **Files**: `src/app/api/notifications/route.ts`, `src/app/api/notifications/read-all/route.ts`, `src/app/api/notifications/[id]/read/route.ts`, `src/app/api/executive/resolutions/route.ts`, `src/app/api/notifications/push/test/route.ts`
- **Goal**:
  - Notification ownership check (User A cannot mark User B's notification as read -> 404/403).
  - Executive resolution function-level RBAC (`ADMIN` / `BGH` only).
  - Protect `push/test` (disable or restrict to Admin).
- **Verification**: Security tests for notification tampering and privilege escalation.

### Task 13: File API Hardening & Secure Download (Phase 10)
- **Files**: `src/app/api/files/[...path]/route.ts`, `src/app/api/documents/download/route.ts`
- **Goal**: Prevent path traversal (`../`), enforce MIME allowlists, safe `Content-Disposition`, `X-Content-Type-Options: nosniff`, and authorization checks before serving file.
- **Verification**: Security tests verifying path traversal attempts (`../../etc/passwd`) are blocked with 400/403.

### Task 14: Comprehensive API Security & Concurrency Test Suite (Phases 29 & 30)
- **Files**: `tests/security/api/bola.test.ts`, `tests/security/api/csrf.test.ts`, `tests/security/api/rate-limit.test.ts`, `tests/security/api/property-auth.test.ts`, `tests/security/api/concurrency.test.ts`
- **Goal**: Dedicated automated test suite verifying OWASP API top risks: BOLA, Mass Assignment, CSRF, Rate Limiting, and Concurrency.
- **Verification**: Run `npm test` across all new and existing test suites.
