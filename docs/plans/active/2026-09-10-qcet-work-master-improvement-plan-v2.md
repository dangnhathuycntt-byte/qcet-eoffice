# QCET WORK — MASTER IMPROVEMENT PLAN V2

## 🎯 Mục tiêu cuối cùng

Đưa QCET từ:
> **Một hệ thống quản lý công việc nhiều chức năng**

thành:
> **Enterprise workflow platform có domain rõ ràng, authorization chặt, workflow an toàn, dashboard action-first và production-ready.**

Không thay đổi công nghệ nếu chưa có bằng chứng cần thiết.
Stack hiện tại như **Next.js / React / Prisma / PostgreSQL** vẫn giữ nguyên.

==================================================
AGENT SAFETY RULES & UNIVERSAL INVARIANTS
==================================================
DO NOT:
- rewrite the application or stack without empirical proof
- introduce microservices, Redis, Kafka, event bus without proven necessity
- create a secondary authorization system or parallel task engines
- create a giant TaskClassification abstraction
- change business semantics during UI refactoring
- remove legacy behavior without regression tests
- assume documentation is always correct
- assume existing architecture is always correct
- treat a possible issue as a confirmed vulnerability
- silently resolve business conflicts

ALWAYS:
- inspect before editing
- establish evidence
- preserve confirmed correct behavior
- fix confirmed correctness/security issues
- add regression tests
- document behavior changes
- measure performance before optimization
- use server-side authorization
- enforce resource-level access control
- protect state transitions
- protect concurrent mutations
- keep attention separate from notification
- keep metrics separate from attention
- stop when business requirements conflict

==================================================
GATED EXECUTION (MILESTONE BY MILESTONE)
==================================================
Complete only ONE milestone at a time.
Flow: M0 -> STOP -> Review -> M1 -> STOP -> Review -> M2 ...
After each milestone output:
STATUS: PASS / BLOCKED / PARTIAL
FILES CHANGED: ...
TESTS: ...
BEHAVIOR CHANGES: ...
SECURITY IMPACT: ...
PERFORMANCE IMPACT: ...
KNOWN RISKS: ...
OPEN QUESTIONS: ...
NEXT MILESTONE: ...
STOP. Do not continue automatically.

---

# PHASE 0 — BASELINE & DISCOVERY

## M0 — Repository / Runtime Audit

### Mục tiêu
Hiểu **hệ thống thực sự đang chạy như thế nào**, không dựa hoàn toàn vào documentation.
**Không sửa code. Không refactor. Không đổi business logic. Không xóa legacy code.**

### 0.1 Architecture
Map:
```text
src/
├── app/
├── components/
├── server/
├── domain/
├── lib/
├── hooks/
└── ...
```
Xác định:
- UI layer
- server layer
- domain layer
- database layer
- authentication
- authorization
- notification
- file system
- background jobs
- external services

### 0.2 Task domain
Tìm toàn bộ:
```text
Task
TaskStatus
TaskState
Assignment
Delegation
Approval
Submission
Deadline
Workflow
```
Xác định nơi nào đang xử lý business rule.

### 0.3 API mutation map
Đặc biệt map:
```text
CREATE, UPDATE, DELETE, ASSIGN, SUBMIT, APPROVE, REJECT, DELEGATE, REVOKE, UPLOAD, DOWNLOAD
```
Cho từng API:
- Authentication
- Authorization
- Resource ownership
- Unit scope
- Workflow state
- Delegation
- Mutation
- Audit

### 0.4 Workspace map
Kiểm tra runtime usage của:
- `UnifiedAdaptiveWorkspace`
- `TaskManagementWorkspace`
- `PersonalWorkbench`
- `ExecutiveCockpitWorkspace`
- `DepartmentManagerWorkspace`
- `LecturerFocusWorkspace`
Không mặc định cái nào là canonical chỉ vì documentation nói vậy. Phân loại: CANONICAL, WRAPPER, DUPLICATE, LEGACY, UNKNOWN với bằng chứng usage.

### 0.5 Test baseline
Chạy:
```bash
npm test
npm run lint
npm run typecheck
npm run build
```
Kiểm tra:
- Test có được discover?
- Có bao nhiêu test?
- Test nào thực sự chạy?
- Có test bị skip?
- Có test giả?

### M0 Output
Tạo: `docs/architecture/2026-09-qcet-baseline.md`
Bao gồm:
1. Runtime architecture
2. Task domain map
3. API mutation map
4. Authorization execution path
5. Workspace map
6. Test baseline
7. Build/typecheck/lint baseline
8. Known risks
9. Unknowns / contradictions

### EXIT CRITERIA M0
- [ ] Runtime architecture understood
- [ ] Task APIs mapped
- [ ] Authorization path traced
- [ ] Main workspace runtime verified
- [ ] Test discovery verified
- [ ] Build baseline known
- [ ] No major unknown hidden

---

# PHASE 1 — BUSINESS CONTRACT

## M1 — Canonical Business Model
Đây là bước nền tảng. Không tạo một `TaskClassification` khổng lồ.
Thay vào đó:
```text
Task
├── Lifecycle
├── Actor Relationship
├── Capability
├── Deadline
├── Attention
└── Metrics
```

### M1.1 Lifecycle
Xác định chính xác:
`DRAFT`, `ASSIGNED`, `IN_PROGRESS`, `SUBMITTED`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `COMPLETED`, `CANCELLED`...
Không được tự đoán state. Nếu `Code ≠ Documentation ≠ Business requirement` -> STOP + report conflict.

### M1.2 Actor Relationship
Định nghĩa:
`creator`, `owner`, `assignee`, `reviewer`, `approver`, `delegate`, `watcher`, `manager`.
Một user có thể có nhiều relationship với cùng task.

### M1.3 Capability
Không dùng role trực tiếp làm business action.
Định nghĩa:
`CAN_VIEW`, `CAN_EDIT`, `CAN_ASSIGN`, `CAN_SUBMIT`, `CAN_APPROVE`, `CAN_REJECT`, `CAN_DELEGATE`, `CAN_DELETE`, `CAN_DOWNLOAD`.
Logic:
`User + Role + Relationship + Unit + Task state + Delegation + Context -> Capability`.
Authorization server-side, failure must fail safely (OWASP).

---

# PHASE 2 — SECURITY

## M2 — Authorization Matrix
Tạo matrix chính thức: Actor vs Scope vs View/Edit/Submit/Approve/Delegate.
Đây sẽ là Business contract + test contract.

## M3 — Authorization Implementation Audit
Audit từng mutation.
Flow chuẩn:
`Request -> Authentication -> Load actor -> Load resource -> Check scope -> Check relationship -> Check delegation -> Check workflow state -> Resolve capability -> Mutation -> Audit`.
Tất cả security-critical authorization phải ở server.

### M3.1 Cross-resource security
Test User A truy cập Task B, File B, Unit B, Approval B -> reject nếu không có quyền.

### M3.2 Session freshness
Kiểm tra logout, account switch, user locked, role downgraded, unit changed, permission revoked, delegation revoked/expired.
Không được có fallback làm tăng quyền khi DB/session failure.

---

# PHASE 3 — WORKFLOW CORRECTNESS

## M4 — State Transition Engine
Workflow kiểm soát server-side: `currentState`, `actor`, `capability`, `transition`, `resource`, `version`.

### M4.1 Invalid transition
Test: APPROVED -> SUBMIT, COMPLETED -> EDIT, CANCELLED -> APPROVE, DRAFT -> APPROVE -> reject.

## M5 — Concurrency
Áp dụng cho critical mutations: `approve`, `reject`, `submit`, `assign`, `delegate`, `revoke`, `complete`.
Tránh: lost update, double mutation, stale state, invalid transition (dùng DB transaction, optimistic concurrency / version column).

## M6 — Idempotency
Xác định mutation nào retry-sensitive (POST approve, submit, delegate). Không tạo hai hành động khi retry.

---

# PHASE 4 — CANONICAL DOMAIN

## M7 — Task Domain
Sau khi business/security/workflow rõ ràng:
`src/domain/tasks/`:
- `lifecycle.ts`
- `relationships.ts`
- `capabilities.ts`
- `deadlines.ts`
- `transitions.ts`
- `attention.ts`
- `metrics.ts`
- `index.ts`
Một business rule -> một canonical implementation.

## M8 — Remove Duplicate Business Logic
Search toàn repo tìm status checks, deadline calculations, permission checks, role checks, assignment checks, approval rules, delegation rules bị trùng lặp.
Migrate callers dần dần, có tests, không xóa vội.

---

# PHASE 5 — ATTENTION SYSTEM

## M9 — Attention Engine
Hệ thống phải biết **user cần làm gì**, không chỉ biết task đang ở trạng thái gì.
Input: Task, Actor, Authorization Context, Current Time, Business Facts.
Output: `{ taskId, priority, reasons: ["OVERDUE", "PENDING_APPROVAL"], primaryAction: "APPROVE" }`.
Tách biệt: Attention ≠ Notification ≠ Metrics.

## M10 — Action Queue
Một task có 5 lý do vẫn chỉ xuất hiện 1 lần trên Action Queue với primary action rõ ràng.

---

# PHASE 6 — DASHBOARD / UX

## M11 — Dashboard Information Architecture
Cấu trúc:
- HEADER
- 🔥 CẦN BẠN XỬ LÝ (Attention)
- 📋 CÔNG VIỆC CỦA TÔI
- ⚠️ RỦI RO / QUÁ HẠN
- 📊 TIẾN ĐỘ
- 🕘 HOẠT ĐỘNG

## M12 — Remove Duplicate Cards
Phân định rõ Fact vs Attention vs Metric vs Action. Loại bỏ cards trùng lặp.

## M13 — Role-aware UX
Shared domain -> Shared components -> Role-aware composition (Staff vs Manager vs Executive).

---

# PHASE 7 — MOBILE

## M14 — Responsive / Mobile
Mobile IA ưu tiên: Task, Status, Deadline, Primary Action.
Test viewports: 375, 390, 430, 768, 1024, 1440.

---

# PHASE 8 — PERFORMANCE

## M15 �� Performance Audit
Đo trước, tối ưu sau: TTFB, FCP, LCP, INP, API latency, DB query count, N+1, payload size, bundle size, hydration, render count.
M15.1 Database: indexes, N+1, large joins, pagination.
M15.2 Next.js: Server vs Client Components, Suspense, parallel fetching.
M15.3 Caching: tránh cache nhầm dữ liệu user-specific, permission-sensitive.

---

# PHASE 9 — OBSERVABILITY

## M16 — Structured Logging
Structured log events: authorization denied, invalid transition, concurrency conflict, mutation failure, slow query, notification failure, file access denied.

---

# PHASE 10 — ACCESSIBILITY

## M17 — Accessibility
Audit: keyboard, focus, ARIA, contrast, screen reader, modal focus, WCAG 2.2 AA target size >= 24x24px.

---

# PHASE 11 — TESTING

## M18 — Unit Tests
Lifecycle, Transitions, Capabilities, Deadlines, Attention, Metrics.

## M19 — Integration Tests
API authorization, Resource ownership, Unit scope, Delegation, Workflow, DB mutation, File authorization.

## M20 — E2E
Happy paths & full flow (Login -> Create -> Assign -> Edit -> Submit -> Approve -> Complete, Reject, Delegate, Revoke, Upload, Download, Logout).

## M21 — Negative E2E (Bắt buộc)
Cross-user, cross-unit, unauthorized approve/submit, expired/revoked delegation, wrong state transition, double approve, stale mutation.

---

# PHASE 12 — PRODUCTION HARDENING

## M22 — Production Gate
Code gate (typecheck, lint, build).
Tests gate (Unit, Integration, E2E, Negative E2E, Auth Matrix, Concurrency).
Database gate (Migrations, rollback strategy, indexes).
Security gate (Auth, Authz, CSRF/headers, DTO filtering, session invalidation).
PWA & Release gate.

---

# SUMMARY ROADMAP & PRIORITIES
**P0 — Phải làm:**
1. M0 Baseline
2. M1 Business Contract
3. M2–M3 Authorization
4. M4 Workflow
5. M5 Concurrency
6. M18–M21 Security/Regression Tests

**P1 — Nâng chất lượng lõi:**
7. M7 Canonical Task Domain
8. M8 Remove Duplicate Logic
9. M9–M10 Attention Engine
10. M11–M13 Dashboard/Workspace

**P2 — Polish / Hardening:**
11. Mobile (M14)
12. Performance (M15)
13. Observability (M16)
14. Accessibility (M17)
15. Production Hardening (M22)
