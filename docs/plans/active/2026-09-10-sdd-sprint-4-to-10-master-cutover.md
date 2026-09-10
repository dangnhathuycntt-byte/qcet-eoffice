# QCET E-Office — Subagent-Driven Development (SDD) Execution Plan
## Sprints 4 → 10: Master Cutover & Production Hardening

**Document ID:** `QCET-SDD-2026-09-10-SPRINT-4-TO-10`  
**Prerequisites:** Sprint 1 / Gate 0 CLOSED, Sprint 2 / Identity & Authority CLOSED, Sprint 3 / Platform Correctness & Database Safety CLOSED.  
**Execution Model:** Subagent-Driven Execution (`general-purpose` execution worker, `data-reviewer`, `security-reviewer`, `ux-reviewer`, `verifier`). Tuân thủ nghiêm ngặt nguyên tắc **"Không vừa đá bóng vừa thổi còi"**: Mọi task sau khi execute bởi subagent implementation phải được verify và audit độc lập bởi specialized subagent (`verifier`, `security-reviewer`, `ux-reviewer`, `data-reviewer`).

---

# ARCHITECTURAL INVARIANTS & SUBAGENT ROLES

### 1. Universal Invariants
1. **One Capability, One Implementation**: Không xây dựng parallel engines, v2 facades, hay dual workflow.
2. **Server Truth Wins**: Cơ sở dữ liệu và session server là nguồn chân lý duy nhất.
3. **Never Invent Operational Data**: Dùng dữ liệu thật, không tạo mock/synthetic operational data.
4. **Never Weaken Security to Pass Tests**: Không bypass RBAC hay nới lỏng assertions.
5. **Never Claim Verification That Was Not Run**: Assertions đòi hỏi logs/proof thực tế.
6. **Preserve Unrelated Changes**: Giữ thay đổi tập trung, không đè code song song.

### 2. Specialized Subagent Roster
- `general-purpose`: Thẩm tra mã nguồn, xây dựng implementation, refactor code, viết domain commands, state machines, API endpoints.
- `verifier`: Chạy deterministic tests (`test:gate0`, `test:sprint2`, `test:sprint3`, v.v.), `typecheck`, `lint`, soát git diff, đối chiếu DoD.
- `security-reviewer`: Soát server-side RBAC, JWT validation, payload sanitization, Segregation of Duties (SoD), BOLA/IDOR, session revocation.
- `data-reviewer`: Kiểm tra tính toàn vẹn dữ liệu, quan hệ aggregate, parity backfill giữa legacy và V2, timezone ICT (UTC+7), không synthetic data.
- `ux-reviewer`: Kiểm tra Information Architecture, mobile ergonomics, 44px+ touch targets, Light-Only CSS standard, zero emojis, WCAG AA.

---

# SPRINT 4 — TASK V2 FULL CUTOVER

## 1. Goal & Architectural Target
Chấm dứt hoàn toàn việc UI gọi `PATCH /api/tasks/[id]` để thay đổi trạng thái workflow (`status`, `approved`, `review`). Chuyển dịch toàn bộ sang **Canonical Task Commands**, được điều khiển bởi **Task State Machine**, thẩm quyền qua **Unified Authorization Engine**, bảo vệ bởi **Atomic OCC** và **Transactional Idempotency**.

## 2. Workstreams & Subagent Assignments

### Workstream 4.1: Task Mutation Callers Inventory & Lock Generic PATCH
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Quét toàn bộ repository tìm các nơi gọi `PATCH /api/tasks` hoặc sửa đổi `status`, `approved`:
    - `src/hooks/use-task-mutations.ts`
    - `src/components/tasks/*` (TaskDetailSideSheet, TaskTable, TaskActions, TaskForm)
    - `src/components/calendar/*`
    - `src/components/dashboard/action-inbox.tsx`
    - `src/lib/pwa/offline-outbox.ts`
  - Khóa `PATCH /api/tasks/[id]`:
    - Chỉ cho phép cập nhật safe metadata: `title`, `description`, `priority`, và `dueDate` (nếu chính sách thẩm quyền cho phép).
    - Cấm tuyệt đối: `status`, `resolution`, `review`, `approval`, `assigneeId`, `actors`.
    - Trả lỗi `400 Bad Request` hoặc `422 Unprocessable Entity` với thông báo rõ ràng nếu payload chứa trường workflow state.
- **Audit/Reviewer:** `security-reviewer` (Kiểm tra xem PATCH có thể bị lợi dụng để leo thang trạng thái nhiệm vụ không).

### Workstream 4.2: Canonical Task Command API & State Machine
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Chuẩn hóa `src/server/tasks/task-command-service.ts` và `src/server/tasks/task-state-machine.ts`.
  - Bộ lệnh canonical (`Domain Commands`):
    - `POST /api/tasks/[id]/actions/start` -> Bắt đầu thực hiện (`NOT_STARTED` -> `IN_PROGRESS`)
    - `POST /api/tasks/[id]/actions/update-progress` -> Cập nhật tiến độ % (chỉ khi `IN_PROGRESS`)
    - `POST /api/tasks/[id]/actions/submit-result` -> Nộp kết quả/minh chứng (`IN_PROGRESS` -> `WAITING_APPROVAL`)
    - `POST /api/tasks/[id]/actions/review` -> Đánh giá sơ bộ
    - `POST /api/tasks/[id]/actions/request-revision` -> Yêu cầu hiệu chỉnh bổ sung (`WAITING_APPROVAL` -> `IN_PROGRESS`)
    - `POST /api/tasks/[id]/actions/approve` -> Phê duyệt hoàn thành (`WAITING_APPROVAL` -> `COMPLETED`)
    - `POST /api/tasks/[id]/actions/reassign` -> Chuyển giao người chịu trách nhiệm chính (DRI)
    - `POST /api/tasks/[id]/actions/cancel` -> Hủy nhiệm vụ (`CANCELLED` - terminal state)
  - Mọi action phải:
    1. Kiểm tra `AuthorizationContext` qua `UnifiedAuthorizationEngine`.
    2. Kiểm tra `If-Match` / `expectedVersion` qua OCC.
    3. Hỗ trợ `Idempotency-Key` qua `withIdempotency`.
    4. Ghi `AuditEvent` và `OutboxEvent` trong cùng một Prisma `$transaction`.
- **Audit/Reviewer:** `security-reviewer` (Kiểm tra SoD: DRI không được tự duyệt nhiệm vụ của mình).

### Workstream 4.3: Single Primary DRI Invariant & TaskActor Model
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Chuẩn hóa `TaskActor` là canonical model (`role: DRI`, `COLLABORATOR`, `REVIEWER`, `APPROVER`).
  - Đảm bảo bất biến: Mỗi nhiệm vụ có duy nhất 1 active primary DRI (`isPrimary: true`).
  - Đồng bộ tương thích ngược sang `TaskAssignee` (projection-only) cho đến Sprint 7.
  - Concurrency test: 2 requests `reassign` song song không bao giờ tạo ra 2 primary DRI.
- **Audit/Reviewer:** `data-reviewer` (Xác minh tính duy nhất của DRI và không có mâu thuẫn relation).

### Workstream 4.4: UI & PWA Semantic Outbox Cutover
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Cập nhật `src/hooks/use-task-mutations.ts` và toàn bộ Task UI components để gửi `intent` (`/actions/approve`, `/actions/submit-result`) thay vì gửi `status = COMPLETED`.
  - Nâng cấp PWA semantic outbox (`src/lib/pwa/offline-outbox.ts`):
    - Lưu: `operation`, `resourceId`, `baseVersion`, `payload`, `idempotencyKey`.
    - Phân định rõ: Offline chỉ cho phép draft, safe progress, submit-result khi đủ offline bundle. Online-only: approve, review, reassign, cancel.
- **Audit/Reviewer:** `ux-reviewer` (Kiểm tra UI phản hồi optimistic/error states và không có giật lag).

### Workstream 4.5: Sprint 4 Verification & Quality Gate
- **Assigned Subagent:** `verifier`
- **Suite:**
  - `tests/task-v2-commands.test.ts`: Kiểm tra toàn bộ 8 canonical commands, state machine transitions, invalid transitions.
  - `tests/task-v2-sod-concurrency.test.ts`: DRI submit, collaborator không thể submit thay DRI, DRI không thể tự duyệt, concurrency reassign.
  - `npm run test:sprint3 && npm run typecheck && npm run lint`.
- **DoD:**
  - [x] Không còn code frontend nào gửi `status: COMPLETED` qua `PATCH`.
  - [x] State machine là nơi duy nhất quyết định chuyển dịch trạng thái Task.
  - [x] Single DRI invariant được đảm bảo.
  - [x] Tất cả các lệnh đều chạy qua OCC + Idempotency + Transactional Outbox.

---

# SPRINT 5 — DOCUMENT V2 FULL CUTOVER

## 1. Goal & Architectural Target
Xây dựng một workflow engine duy nhất cho văn bản đến và văn bản đi. Phân loại bảo mật (`PUBLIC`, `INTERNAL`, `RESTRICTED`, `CONFIDENTIAL`) được tôn trọng xuyên suốt mọi endpoint, query, attachment và xuất bản. Khóa generic PATCH trên Document.

## 2. Workstreams & Subagent Assignments

### Workstream 5.1: Incoming & Outgoing Document State Machines
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - `IncomingDocumentStateMachine`:
    `RECEIVED` -> `REGISTERED` -> `PRESENTED` (Trình BGH) -> `DIRECTED` (B��t phê/Chỉ đạo) -> `ASSIGNED_TO_UNIT` -> `IN_PROGRESS` -> `RESOLVED` -> `FILED` -> `ARCHIVED`.
  - `OutgoingDocumentStateMachine`:
    `DRAFT` -> `CONTENT_REVIEW` -> `FORMAT_CHECK` -> `READY_TO_SIGN` -> `SIGNED` -> `NUMBERED` (Văn thư cấp số) -> `ORGANIZATION_SIGNED` (Đóng dấu cơ quan) -> `ISSUED` (Ban hành) -> `FILED` -> `ARCHIVED`.
  - Khóa `PATCH /api/documents/[id]`: Cấm set trực tiếp `status`, `signedAt`, `signer`, `documentNumber`, `issuedAt`.
- **Audit/Reviewer:** `security-reviewer` (Audit SoD: Người soạn thảo khác người duyệt nội dung, người ký khác văn thư đóng dấu).

### Workstream 5.2: Atomic Registration Numbering & Concurrency Safety
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Xóa bỏ hoàn toàn pattern nguy hiểm `SELECT MAX(number) + 1` không khóa.
  - Xây dựng atomic counter allocation sử dụng PostgreSQL sequence hoặc transaction-safe locking table (`SELECT ... FOR UPDATE`).
  - Đảm bảo hàng chục requests đăng ký văn bản đồng thời không bao giờ bị trùng số hoặc thất thoát số văn bản.
- **Audit/Reviewer:** `data-reviewer` (Test concurrency hàng chục worker xin cấp số liên tục).

### Workstream 5.3: Attachment Classification & Immutable Official Version
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Văn bản đã ký/ban hành (`SIGNED`, `ISSUED`): Nội dung, metadata và attachments trở thành bất biến (`immutable`). Bất kỳ hiệu chỉnh nào phải tạo version mới hoặc văn bản đính chính.
  - Attachment Security: Thừa kế mức độ bảo mật của văn bản cha (`parent.classification`). Ngăn chặn tuyệt đối lỗ hổng public URL cho attachment của văn bản `RESTRICTED` hoặc `CONFIDENTIAL`.
- **Audit/Reviewer:** `security-reviewer` (Kiểm tra BOLA/IDOR và thừa kế phân loại bảo mật file download).

### Workstream 5.4: Document UI Migration to Available Actions
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - UI nút bấm (`src/components/documents/*`) được render động từ server DTO `availableActions` (được tính bằng `UnifiedAuthorizationEngine`), không tự đoán trạng thái hay dựa vào role ở client.
- **Audit/Reviewer:** `ux-reviewer` (Accessibility WCAG AA, Light-Only, không emojis).

### Workstream 5.5: Sprint 5 Verification & Quality Gate
- **Assigned Subagent:** `verifier`
- **Suite:**
  - `tests/document-v2-workflow.test.ts`: Incoming + Outgoing state machines, availableActions.
  - `tests/document-numbering-concurrency.test.ts`: Cấp số đồng thời không trùng.
  - `tests/document-attachment-security.test.ts`: Kiểm tra rò rỉ attachment có phân loại bảo mật.
  - `npm run typecheck && npm run lint`.
- **DoD:**
  - [x] Một workflow engine chuẩn xác cho văn bản đến và đi.
  - [x] Cấp số văn bản an toàn tuyệt đối trước concurrency.
  - [x] Văn bản sau khi ký là bất biến.
  - [x] Không còn generic PATCH bypass workflow trên Document.

---

# SPRINT 6 — ORGANIZATION ADMINISTRATION & DOSSIER

## 1. Goal & Architectural Target
Chuyển hóa Organization V2 models (`OrganizationalUnit`, `PositionDefinition`, `PositionAssignment`, `ResponsibilityArea`, `PortfolioAssignment`, `DelegationGrant`) thành hệ thống quản trị hành chính thực thụ có hiệu lực theo thời gian (effective-dated), và hoàn thiện vòng đời Hồ sơ công việc (Dossier).

## 2. Workstreams & Subagent Assignments

### Workstream 6.1: Organizational Unit & Structure Management
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - `OrganizationalUnitService`: Tạo, sửa metadata, di chuyển phân cấp hành chính (parent-child), kích hoạt/vô hiệu hóa.
  - Cấm hard-delete đơn vị đã có lịch sử công tác hoặc nhiệm vụ liên kết.
- **Audit/Reviewer:** `data-reviewer` (Kiểm tra toàn vẹn phân cấp cây tổ chức 16 đơn vị QCET).

### Workstream 6.2: Position, Assignment & Portfolio Lifecycle
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Phân định rõ: `PositionDefinition` (chức danh tiêu chuẩn) vs `PositionAssignment` (bổ nhiệm nhân sự cụ thể).
  - Nghiệp vụ b��� nhiệm: Bổ nhiệm chính thức, giao quyền/phụ trách, điều động, miễn nhiệm, hết hạn.
  - Mọi phân công đều có `effectiveFrom`, `effectiveTo`, `sourceDecision`, `isCurrent`. Không ghi đè lịch sử.
  - Quản lý mảng công tác (`ResponsibilityArea`): 11 mảng phụ trách theo QĐ 420; phân công BGH qua `PortfolioAssignment`.
- **Audit/Reviewer:** `security-reviewer` (Kiểm tra quyền hạn hành chính: SYSTEM_ADMIN không tự ý bổ nhiệm trừ khi có thẩm quyền tường minh).

### Workstream 6.3: Delegation Grant Administration & Lifecycle
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Quản lý vòng đời `DelegationGrant`: Ủy quyền, giới hạn phạm vi, đặt thời hạn hiệu lực, thu hồi (`revoke`).
  - Kiểm tra xung đột: Ngăn chặn ủy quyền vượt quá thẩm quyền của người ủy quyền; vô hiệu hóa ủy quyền khi người ủy quyền hết nhiệm kỳ; ngăn chặn ủy quyền vòng tròn.
- **Audit/Reviewer:** `security-reviewer` (Thẩm định ngăn chặn privilege escalation qua ủy quyền).

### Workstream 6.4: Dossier Lifecycle & Institutional Archive
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Vòng đời Hồ sơ công việc: `OPEN` -> `ACTIVE` -> `CLOSED` -> `READY_FOR_ARCHIVE` -> `SUBMITTED` -> `ACCEPTED` -> `ARCHIVED`.
  - Quan hệ hồ sơ: Liên kết nhiệm vụ, kết quả, văn bản liên quan, nghị quyết cuộc họp, minh chứng.
  - Đóng hồ sơ: Không cho phép đóng nếu còn nhiệm vụ chưa hoàn thành hoặc thiếu minh chứng bắt buộc theo quy định.
- **Audit/Reviewer:** `data-reviewer` (Kiểm tra tính toàn vẹn quan hệ giữa dossier và các domain entities).

### Workstream 6.5: Sprint 6 Verification & Quality Gate
- **Assigned Subagent:** `verifier`
- **Suite:**
  - `tests/organization-v2-admin.test.ts`: Bổ nhiệm, điều động, phân công mảng, ủy quyền và thu hồi.
  - `tests/dossier-lifecycle.test.ts`: Mở hồ sơ, nạp văn bản/nhiệm vụ, kiểm tra ràng buộc khi đóng và nộp lưu trữ.
  - `npm run typecheck && npm run lint`.
- **DoD:**
  - [x] Cơ cấu tổ chức và bổ nhiệm quản lý đầy đủ lịch sử effective-dated.
  - [x] Phân công phụ trách mảng và ủy quyền hoạt động độc lập, không hardcode.
  - [x] Vòng đời hồ sơ công việc khép kín và an toàn.

---

# SPRINT 7 — LEGACY DATA CUTOVER & REMOVAL

## 1. Goal & Architectural Target
Chấm dứt hoàn toàn kiến trúc song song (Dual Architecture). Xóa bỏ vĩnh viễn các models và khái niệm legacy: `Department`, `TaskAssignee`, `DacumDelegation`, `DocumentDirective`, `ExecutiveResolution`, và role-based authorization cũ. Thực hiện theo mô hình chuẩn **Expand / Migrate / Contract**.

## 2. Workstreams & Subagent Assignments

### Workstream 7.1: Legacy Reference Inventory & Canonical Mapping
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Quét toàn bộ codebase lập danh mục mọi reference đến legacy models:
    - `Department` -> `OrganizationalUnit`
    - `TaskAssignee` (`PRIMARY_OWNER`, `COLLABORATOR`) -> `TaskActor` (`DRI`, `COLLABORATOR`)
    - `DacumDelegation` -> `DelegationGrant`
    - `DocumentDirective` -> V2 Document Workflow & Tasks
    - `ExecutiveResolution` -> `MeetingResolution` & Task Actions
  - Phân loại rõ: `READ`, `WRITE`, `MAPPER`, `TEST`, `DEAD CODE`.
- **Audit/Reviewer:** `data-reviewer` (Xác nhận 100% mapping ngữ nghĩa chính xác).

### Workstream 7.2: Backfill Data Migrations (Prisma Data Migrations)
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Tạo các scripts di chuyển dữ liệu trong `prisma/data-migrations/`:
    - `backfill-department-to-units.ts`
    - `backfill-assignees-to-actors.ts`
    - `backfill-dacum-to-delegation-grants.ts`
  - Yêu cầu: Hoàn toàn idempotent, có thể chạy lại an toàn, có chế độ dry-run, có log trước/sau.
- **Audit/Reviewer:** `data-reviewer` (Chạy script và lập Parity Report: Legacy rows vs V2 rows, kiểm tra 0 mismatch).

### Workstream 7.3: Switch Reads & Writes to V2 (Stop Dual Writes)
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Chuyển 100% read queries sang V2 models.
  - Ngừng hoàn toàn việc ghi vào các bảng legacy (Zero business dual write).
  - Biến các legacy endpoints thành projection-only hoặc chuyển hướng.
- **Audit/Reviewer:** `security-reviewer` & `verifier` (Kiểm tra không còn bất kỳ mutation nào chạm vào legacy tables).

### Workstream 7.4: Contract Migration (Schema Clean Up)
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Tạo Prisma migration: Xóa bỏ các foreign keys cũ, drop các bảng và cột obsolete (`Department`, `TaskAssignee`, `DacumDelegation`).
  - Dọn dẹp `prisma/schema.prisma` sạch sẽ.
  - Chạy `db:drift:check` và `db:migrate:test-fresh`.
- **Audit/Reviewer:** `verifier` (Xác nhận migration contract deploy thành công trên fresh và existing databases).

### Workstream 7.5: Sprint 7 Verification & Quality Gate
- **Assigned Subagent:** `verifier`
- **Suite:**
  - `npm run test:gate0 && npm run test:sprint2 && npm run test:sprint3`.
  - `npm run db:drift:check && npm run db:migrate:test-fresh && npm run db:migrate:test-upgrade`.
  - `npm run typecheck && npm run lint`.
- **DoD:**
  - [x] Không còn khái niệm `Department` hay `TaskAssignee` trong runtime.
  - [x] Parity đạt 100%, không mất mát dữ liệu nghiệp vụ.
  - [x] Schema database chỉ chứa V2 canonical tables.

---

# SPRINT 8 — ROUTING, ACTION INBOX & UX INTEGRATION

## 1. Goal & Architectural Target
Hợp nhất toàn diện kiến trúc tương tác người dùng. Chuẩn hóa routing, chuyển hướng sạch các legacy URLs (`/?zone=`, `/dashboard`, `/portal`), hoàn thiện **Action Inbox V2** dựa trên quyền hạn thực tế, và loại bỏ hoàn toàn các role-specific workspaces rời rạc.

## 2. Workstreams & Subagent Assignments

### Workstream 8.1: Canonical Routing & Legacy Redirects
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Chuẩn hóa URL maps:
    - `/` -> Workbench
    - `/tasks` -> Task Workspace
    - `/documents` -> Document Workspace
    - `/calendar` -> Lịch công tác
    - `/org` -> Cơ cấu tổ chức
    - `/notifications` -> Thông báo
    - `/settings` -> Cài đặt
  - Xóa bỏ mọi nơi tạo link `/?zone=tasks`, `/?zone=calendar` trong push, Service Worker, Action Inbox, mobile menu.
  - Thiết lập 301/308 redirects vĩnh viễn cho legacy routes (`/dashboard` -> `/`, `/unit-tasks` -> `/tasks?scope=unit`, `/?zone=*` -> canonical path).
- **Audit/Reviewer:** `ux-reviewer` (Kiểm tra tính nhất quán của navigation và deep-linking).

### Workstream 8.2: Action Inbox V2 (Capability-Driven)
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Xóa bỏ logic cũ `if (user.role === 'ADMIN')`.
  - Xây dựng query Action Inbox tập trung: Lấy danh sách nhiệm vụ cần duyệt, văn bản cần chỉ đạo, báo cáo cần xử lý dựa trên `UnifiedAuthorizationEngine` và `availableActions`.
  - Mỗi item trong Action Inbox có: `resourceType`, `resourceId`, `requiredAction`, `priority`, `deadline`, `reasonWhyMe`, `href`.
- **Audit/Reviewer:** `security-reviewer` (Kiểm tra không rò rỉ items thuộc thẩm quyền của người khác vào Action Inbox).

### Workstream 8.3: Unified Workspaces (Eliminate Role-Specific Workspaces)
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Loại bỏ các workspaces phân mảnh: `ExecutiveWorkspace`, `ManagerWorkspace`, `DepartmentManagerWorkspace`, `StaffWorkspace`.
  - Hợp nhất thành 1 `TaskWorkspace` và 1 `DocumentWorkspace` duy nhất có khả năng tự thích ứng hiển thị theo thẩm quyền và ngữ cảnh.
- **Audit/Reviewer:** `ux-reviewer` (Kiểm tra giao diện Light-Only, responsive di động, touch target >= 44px, không có emojis).

### Workstream 8.4: Sprint 8 Verification & Quality Gate
- **Assigned Subagent:** `verifier`
- **Suite:**
  - `tests/routing-canonical.test.ts`: Redirects, deep links, không còn query `?zone=`.
  - `tests/action-inbox-v2.test.ts`: Phân quyền hiển thị Action Inbox chính xác.
  - `npm run typecheck && npm run lint`.
- **DoD:**
  - [x] Một hệ thống định tuyến chuẩn xác.
  - [x] Action Inbox hiển thị đúng người, đúng việc theo quyền hạn thực tế.
  - [x] Không còn workspace phân mảnh theo role.

---

# SPRINT 9 — SOURCE & REPOSITORY CLEANUP

## 1. Goal & Architectural Target
Thực hiện dọn dẹp kho mã nguồn **sau khi kiến trúc nghiệp vụ đã chuẩn hóa**. Xóa bỏ toàn bộ artifact lịch sử (`.superpowers`, diff files, test logs), hợp nhất tài liệu, dọn dẹp re-export facades và tái cấu trúc các module lớn.

## 2. Workstreams & Subagent Assignments

### Workstream 9.1: Purge Historical Artifacts & Temporary Files
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Xóa bỏ các tệp rác lịch sử không phục vụ runtime:
    - Các file `.diff`, `.log`, `.old`, báo cáo tạm thời ở root.
    - Dọn dẹp `.superpowers/` chỉ giữ lại active execution plans.
    - Đảm bảo `/storage/private/` và `/uploads/` được `.gitignore` tuyệt đối.
- **Audit/Reviewer:** `security-reviewer` (Đảm bảo không có bí mật, private documents hoặc credentials bị lọt vào repo).

### Workstream 9.2: Documentation Consolidation
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Hợp nhất tài liệu kỹ thuật vào cây thư mục chuẩn:
    `docs/architecture/`, `docs/decisions/`, `docs/domain/`, `docs/operations/`, `docs/product/`, `docs/security/`, `docs/plans/active/`.
  - Lưu trữ (archive) các kế hoạch đã hoàn thành.
- **Audit/Reviewer:** `verifier` (Kiểm tra links tham chiếu giữa các tài liệu không bị đứt gãy).

### Workstream 9.3: Eliminate Re-export Facades & Decompose Overloaded Modules
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Quét và loại bỏ các facade shim trung gian: Cập nhật imports trực tiếp đến canonical owner và xóa facade files.
  - Tách nhỏ các UI components quá tải (god components > 800 lines): Tách thành controller hook, data mapper, sections, pure presentation.
- **Audit/Reviewer:** `verifier` (Chạy full typecheck và linter đảm bảo zero broken imports).

### Workstream 9.4: Sprint 9 Verification & Quality Gate
- **Assigned Subagent:** `verifier`
- **Suite:**
  - `npm run typecheck && npm run lint && npm test`.
- **DoD:**
  - [x] Dung lượng và cấu trúc repo gọn gàng, sạch sẽ.
  - [x] Không còn file thừa, facade thừa hay tài liệu lỗi thời.
  - [x] Toàn bộ test suite giữ nguyên 100% pass.

---

# SPRINT 10 — PRODUCTION READINESS & PILOT

## 1. Goal & Architectural Target
Kiểm chứng tính sẵn sàng vận hành thực tế của hệ thống QCET E-Office: CI/CD pipeline, Docker standalone build, reverse proxy readiness/liveness, sao lưu/phục hồi thảm họa (backup/restore drill), kiểm thử tải & concurrency, và UAT kịch bản thực tế.

## 2. Workstreams & Subagent Assignments

### Workstream 10.1: CI/CD Pipeline & Standalone Production Container
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Cấu hình GitHub Actions CI pipeline đầy đủ các gates: Validate schema, drift check, typecheck, lint, test gate0/sprint2/sprint3, production build.
  - Cấu hình `next.config.ts` với `output: 'standalone'`, xây dựng immutable container image có gắn Git SHA.
  - Thiết lập Graceful Shutdown (`SIGTERM`, `SIGINT`) đóng kết nối DB sạch sẽ.
- **Audit/Reviewer:** `verifier` (Kiểm tra tính tái lập của container build).

### Workstream 10.2: Health, Observability & Structured Logging
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - `/api/health/live`: Kiểm tra process sống (không truy vấn nặng).
  - `/api/health/ready`: Kiểm tra kết nối PostgreSQL, storage, schema migrations, critical config.
  - Structured Logging: Bổ sung requestId, duration, route, action, resourceId. Cấm log mật khẩu, token JWT, payload văn bản mật.
- **Audit/Reviewer:** `security-reviewer` (Kiểm tra leak dữ liệu nhạy cảm trong logs).

### Workstream 10.3: Disaster Recovery & Backup Verification Drill
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Script sao lưu: `scripts/backup-db.sh` (`pg_dump` format custom) và sao lưu tệp đính kèm `storage/private`.
  - Restore drill tự động: Tạo database mới từ bản dump, khởi động app image và kiểm tra tính toàn vẹn dữ liệu.
- **Audit/Reviewer:** `data-reviewer` (Xác thực dữ liệu phục hồi nguyên vẹn 100%).

### Workstream 10.4: End-to-End Pilot UAT Scenarios & Chaos Tests
- **Assigned Subagent:** `general-purpose`
- **Scope:**
  - Kịch bản UAT đầu-cuối:
    1. Task: Giao việc -> Thực hiện -> Nộp minh chứng -> Thẩm định -> Phê duyệt -> Nạp hồ sơ.
    2. Incoming Document: Tiếp nhận -> Trình BGH -> Bút phê -> Phân công -> Giải quyết -> Lưu trữ.
    3. Outgoing Document: Soạn thảo -> Duyệt nội dung -> Kiểm tra thể thức -> Ký duyệt -> Đóng dấu/cấp số -> Ban hành.
    4. Meeting: Họp giao ban -> Kết luận cuộc họp -> Tự động sinh nhiệm vụ.
    5. Organization: Bổ nhiệm -> Giao mảng phụ trách -> Ủy quyền -> Thu hồi -> Phản ánh tức thì vào quyền hạn.
  - Outbox Chaos Test: Giả lập worker crash, network failure, đảm bảo không mất event và xử lý trùng lặp an toàn.
- **Audit/Reviewer:** `security-reviewer` & `verifier` (Thực thi toàn bộ kịch bản và xuất biên bản nghiệm thu).

### Workstream 10.5: Master Cutover Pilot Gate
- **Assigned Subagent:** `verifier`
- **Suite:**
  - Kiểm tra toàn bộ Checklist Master Definition of Done:
    - [x] Sprint 1 đến Sprint 9 CLOSED.
    - [x] Typecheck 0 errors.
    - [x] Lint 0 warnings/errors.
    - [x] Test suite 100% pass.
    - [x] Fresh DB & Upgrade DB pass.
    - [x] Backup & Restore drill pass.
    - [x] Security regression matrix pass.
- **DoD:**
  - Hệ thống chính thức sẵn sàng cho vận hành Pilot tại Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn .

---

# DEPENDENCY CHAIN & EXECUTION PROTOCOL

```text
SPRINT 3: Platform Correctness & DB Safety (CLOSED)
      ↓
SPRINT 4: Task V2 Full Cutover
      ↓
SPRINT 5: Document V2 Full Cutover
      ↓
SPRINT 6: Organization Administration + Dossier
      ↓
SPRINT 7: Legacy Data Cutover & Removal
      ↓
SPRINT 8: Routing + Action Inbox + UX Integration
      ↓
SPRINT 9: Source & Repository Cleanup
      ↓
SPRINT 10: Production Readiness & Pilot
```

**Nguyên tắc vận hành:**
- Mỗi Sprint mở đầu bằng snapshot git sạch.
- Các workstreams trong một sprint được dispatch song song cho các subagents phù hợp.
- Cuối mỗi sprint, `verifier` và `security-reviewer` độc lập kiểm chứng và lập Closure Report trước khi bước sang Sprint tiếp theo.
