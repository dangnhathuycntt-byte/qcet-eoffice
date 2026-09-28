# Đối chiếu Kế hoạch — Phase 0 Documentation Deliverables

> **Lưu ý trạng thái Phase 0:** Các deliverable tài liệu của Phase 0 (route inventory, page-template traceability, plan reconciliation) đã hoàn thành. Tuy nhiên, 2 items Phase 0 vẫn BLOCKED chờ quyết định bên ngoài: (1) RFC-04/RFC-05 decision gate — chờ Owner; (2) Digital-signature provider choice — chưa chọn nhà cung cấp. Phase 0 **chưa hoàn thành** cho đến khi 2 quyết định này được giải quyết.

| Trường     | Giá trị |
| ---------- | ------- |
| Ngày lập   | 28/09/2026 |
| Phạm vi    | Đối chiếu 3 nguồn: implementation-plan-v1.md (10 phase, 41 issues), system-api-and-screens-execution-plan (7 phase), và trạng thái codebase thực tế |
| Nguồn 1    | `docs/architecture/implementation-plan-v1.md` — kế hoạch kiến trúc backend (Phase 0–9, 41 work items) |
| Nguồn 2    | `docs/plans/active/system-api-and-screens-execution-plan-2026-09-28.md` — kế hoạch triển khai API & giao diện (Phase 0–6, 22 templates) |
| Nguồn 3    | Codebase thực tế tại HEAD `38425d5f` plus 188 uncommitted paths (28/09/2026; 97 modified, 89 untracked, 2 deleted) |
| API inventory | [`api-inventory-current-2026-09.md`](../../architecture/api-inventory-current-2026-09.md) — 98 route files, 131 declared route/method pairs, 133 exported handlers; security labels là triage sơ bộ |

---

## 1. Tổng quan cấu trúc hai kế hoạch

| Chiều       | implementation-plan-v1.md | execution-plan-2026-09-28 |
| ----------- | ------------------------- | ------------------------- |
| Số phase    | 10 (Phase 0–9)            | 7 (Phase 0–6)             |
| Work items  | 41 issues (WI-0.1 → WI-9.4) | ~19 task groups |
| Trọng tâm   | Backend architecture, domain canonicalization, security, schema migration | API endpoint hardening, UI page templates, end-to-end pilot workflows |
| Phase model | Sequential with parallel tracks (Phase 4–6) | Sequential with dependency graph |

**Mối quan hệ:** Hai kế hoạch **bổ sung** lẫn nhau. Implementation plan v1 phủ **kiến trúc nền tảng** (security, domain, migration); execution plan phủ **deliverable triển khai** (API routes, page templates, end-to-end acceptance). Không có kế hoạch nào thay thế kế hoạch kia.

---

## 2. Work items trong implementation-plan-v1.md KHÔNG có trong execution plan

Đây là các hạng mục backend/architecture không tạo ra page template hoặc API endpoint mới — đúng ý đồ thiết kế.

### Phase 1 — Security & Correctness (7 work items)

| WI | Mô tả | Tính chất |
| -- | ----- | --------- |
| WI-1.1 | SoD guard unification | Backend security — không có UI riêng |
| WI-1.2 | Role-set compat patch | Backend correctness fix |
| WI-1.3 | File authorization audit | Backend security |
| WI-1.4a/b | User directory RFC-08 | Backend policy + RFC |
| WI-1.5a/b | Dossier read policy RFC-09 | Backend policy + RFC |
| WI-1.6 | Doc/dossier auth audit | Backend security audit |
| WI-1.7 | Security debt triage | Backend triage |

### Phase 2 — Semantic Contracts (2 work items)

| WI | Mô tả | Tính chất |
| -- | ----- | --------- |
| WI-2.1 | Domain contract deduplication | Backend refactoring |
| WI-2.2 | Status normalizer | Backend canonical logic |

### Phase 3 — Organization & Authority (3 work items)

| WI | Mô tả | Tính chất |
| -- | ----- | --------- |
| WI-3.1 | RFC-02 (Department→OrgUnit) | Backend architecture analysis |
| WI-3.2 | RFC-03 (Delegation consolidation) | Backend architecture analysis |
| WI-3.3 | Domain Authority interface | Backend authorization |

### Phase 4 — Task Domain (3 work items)

| WI | Mô tả | Tính chất |
| -- | ----- | --------- |
| WI-4.1 | RFC-01 (TaskAssignee→TaskActor) | Backend domain canonicalization |
| WI-4.2 | RFC-06 (Scope vs OriginLevel) | Backend domain boundary |
| WI-4.3 | OVERDUE remediation | Backend lifecycle logic |

### Phase 5 — Document Domain (3 work items)

| WI | Mô tả | Tính chất |
| -- | ----- | --------- |
| WI-5.1 | Document status 2-tier sync | Backend schema sync |
| WI-5.2 | RFC-04 (Document domain location) | Backend architecture (PROPOSED) |
| WI-5.3 | RFC-05 (JSON/Text relations) | Backend schema normalization (PROPOSED) |

### Phase 6 — Meeting & Dossier FSM (6 work items)

| WI | Mô tả | Tính chất |
| -- | ----- | --------- |
| WI-6.1a-c | Meeting FSM formalization | Backend state machine |
| WI-6.2a-c | Dossier FSM formalization | Backend state machine |

### Phase 7 — Platform (6 work items)

| WI | Mô tả | Tính chất |
| -- | ----- | --------- |
| WI-7.1 | RFC-07 Action Inbox separation | Backend infrastructure |
| WI-7.2 | Notification schema evolution | Backend schema |
| WI-7.3 | UnitWorkAssignment vocabulary | Backend vocabulary |
| WI-7.4 | Outbox infrastructure | Backend messaging |
| WI-7.5 | FileObject model | Backend file handling |
| WI-7.6 | API RFC 9457 standards | Backend API contract |

### Phase 8–9 — Migration & Legacy Removal (8 work items)

| WI | Mô tả | Tính chất |
| -- | ----- | --------- |
| WI-8.1–8.4 | Migration tracks (Expand/Backfill) | Schema migration |
| WI-9.1–9.4 | Legacy removal (Contract/Drop) | Schema cleanup |

**Kết luận:** 38/41 work items từ implementation plan v1 là backend-only — đúng ý đồ. Execution plan không cần phủ lại chúng.

---

## 3. Templates/features trong execution plan KHÔNG có trong implementation-plan-v1.md

9 page templates trong execution plan (22 templates) không có work item tường minh trong implementation plan:

| # | Template | API hỗ trợ hiện có | Khoảng trống |
|---|----------|--------------------|-------------|
| 1 | Bàn làm việc (Workbench) | `GET /api/dashboard/overview` | Workbench đã triển khai trong execution plan; implementation-plan-v1 không có UI work item riêng |
| 15 | Soạn thảo VB đi (Compose) | `POST /api/documents/outgoing` | Compose page đã có; backend plan không có work item UI riêng |
| 16 | Văn bản nội bộ (Internal Doc) | Tab submission hiện có | **BLOCKED** — scope, numbering và authority chưa quyết định |
| 17 | Quản lý Ủy quyền | `GET/POST /api/delegations` | Trang đã có; WI-3.2 chỉ phân tích backend, không có UI work item |
| 18 | Quản trị Tài khoản | `GET /api/users`, `POST /api/auth/register` | Chưa có page; cần chốt RBAC provisioning UI |
| 19 | Trung tâm Thông báo | `GET /api/notifications` | Trang đã có; WI-7.1/7.2 phủ backend/schema, không phải UI |
| 20 | Tìm kiếm Toàn cục | `GET /api/search` | Trang đã có; không có UI work item trong implementation-plan-v1 |
| 21 | Nhật ký Vận hành | Audit logs theo từng tài liệu | Thiếu global API và UI work item |
| 22 | Báo cáo & Xuất dữ liệu | `GET /api/documents/export-excel`, `GET /api/documents/stats` | Trang và API đã có; backend plan không có UI work item riêng |

**Đề xuất:** Bổ sung 9 work items UI này vào Phase 5 hoặc Phase 6 của execution plan sau khi backend foundation ổn định.

---

## 4. Đối chiếu với trạng thái codebase thực tế

### 4.1 API Coverage

| Metric | Giá trị (HEAD `38425d5f` + 188 uncommitted paths) |
| ------ | ------------------------------- |
| Tổng số tệp `route.ts` | 98 |
| Tổng route/method pairs | 131 |
| Tổng exported handlers | 133 (bao gồm NextAuth GET/POST) |
| Số domain cấp cao | 24 |

Nguồn số liệu: [`api-inventory-current-2026-09.md`](../../architecture/api-inventory-current-2026-09.md), được đối chiếu với route exports trong worktree. Bản [`api-inventory.md`](../../architecture/api-inventory.md) là snapshot ngày 09/09 (31 route files/43 handlers), không dùng làm inventory hiện hành. Nhãn auth/authorization/validation trong inventory mới là phân loại sơ bộ, không thay thế audit hành vi từng route.

### 4.2 Page routes đã tồn tại

| Route | Template tương ứng | Trạng thái |
| ----- | ------------------- | ---------- |
| `src/app/tasks/page.tsx` | #2 Task Hub | Hoạt động |
| `src/app/tasks/[id]/page.tsx` | #3 Task Detail | Hoạt động |
| `src/app/inbox/page.tsx` | #4 Inbox | Hoạt động |
| `src/app/documents/page.tsx` | #5 + #7 (tabs inbox/outbox/submission) | Hoạt động — cần enhancement |
| `src/app/documents/incoming/[id]/page.tsx` | #6 Incoming Document Detail | Hoạt động |
| `src/app/documents/outgoing/[id]/page.tsx` | #8 Outgoing Doc Detail | Hoạt động |
| `src/app/documents/outgoing/compose/page.tsx` | #15 Outgoing Compose | Hoạt động |
| `src/app/calendar/page.tsx` | #9 Calendar | Hoạt động |
| `src/app/calendar/meetings/[id]/page.tsx` | #14 Meeting Detail | Hoạt động |
| `src/app/org/page.tsx` | #10 Organization | Hoạt động |
| `src/app/dossiers/page.tsx`, `src/app/dossiers/[id]/page.tsx` | #11–12 Dossier List/Detail | Hoạt động |
| `src/app/dashboard/page.tsx` | #1 Workbench/Dashboard | WorkbenchRouter đã triển khai |
| `src/app/delegations/page.tsx`, `src/app/notifications/page.tsx`, `src/app/search/page.tsx`, `src/app/reports/page.tsx` | #17, #19, #20, #22 | Hoạt động |
| `src/app/settings/page.tsx` | #13 Settings | Hoạt động |

Toàn bộ app hiện có **25 `page.tsx` routes**. Xem [`page-template-traceability-matrix.md`](../../architecture/page-template-traceability-matrix.md) để biết mapping và trạng thái đủ 22 templates.

### 4.3 Tình trạng hiện tại và phần còn thiếu

| Bất nhất | Chi tiết | Mức độ |
| -------- | -------- | ------ |
| Workbench, Incoming Detail, Dossier List/Detail, Meeting Detail, Outgoing Compose | Các route và screens đã có trong worktree; xem bảng 4.2 | Đã triển khai; một số dữ liệu/flows vẫn phụ thuộc API hoặc quyết định ở Phase 5 |
| Internal Document | Tab submission hiện có; workflow riêng chưa được xác định | **BLOCKED** — chờ quyết định scope, numbering và thẩm quyền |
| Account/Permission Admin | `src/app/admin/users/page.tsx` đã tạo (read-only `UserDirectoryView`) | Read-only directory exists; provisioning BLOCKED chờ RBAC design |
| Audit/Operations Log | `src/app/admin/audit/page.tsx` + `GET /api/audit-logs` đã triển khai | ✅ Resolved (28/09/2026, phiên 3) |
| Registry văn bản đến/đi | Hai tab đã có trong `src/app/documents/page.tsx` | Cần enhancement theo acceptance criteria của execution plan |

Ma trận 22 templates hiện ghi nhận **18 exists, 3 needs-enhancement, 1 needs-creation**. Template tạo mới cần quyết định là Internal Document đang chờ chốt scope. Account Admin (#18) có read-only directory nhưng provisioning BLOCKED chờ RBAC design; Audit/Operations (#21) đã có API và màn hình read-only.

---

## 5. Phase mapping giữa hai kế hoạch

| implementation-plan-v1 Phase | execution-plan Phase | Mối quan hệ |
| ---------------------------- | -------------------- | ------------ |
| Phase 0 (Architecture Docs) | Phase 0 (Baseline, decisions) | **Trùng** — cùng scope |
| Phase 1 (Security) | Phase 1 (Security blockers) | **Trùng** — execution plan tường minh hóa từng endpoint |
| Phase 2 (Semantic Contracts) | Phase 2 (Canonical pipeline) | **Bổ sung** — execution plan thêm UI refactoring cho directive/assignment |
| Phase 3 (Organization & Authority) | Phase 3 (Dossier & file foundation) | **Bổ sung** — implementation plan phủ Org/Authority; execution plan phủ Dossier FSM |
| Phase 4 (Task Domain) | Phase 4 (Pilot screens) | **Bổ sung** — implementation plan canonicalize domain; execution plan triển khai UI pilot |
| Phase 5 (Document Domain) | Phase 5 (Full scope) | **Bổ sung** — implementation plan phủ domain; execution plan phủ UI mở rộng |
| Phase 6 (Meeting & Dossier) | Phase 5 (Full scope) | **Gộp** — execution plan gộp meeting/dossier UI vào Phase 5 |
| Phase 7 (Platform) | Phase 5 (Full scope) | **Gộp** — platform infrastructure |
| Phase 8–9 (Migration) | Phase 6 (Migration cutover) | **Tương ứng** — execution plan gộp lại thành 1 phase |

---

## 6. Khuyến nghị

### 6.1 Đã hoàn tất trong Phase 4

1. Incoming Document Detail page (template #6) đã có tại `src/app/documents/incoming/[id]/page.tsx`.
2. Workbench route (template #1) đã có tại `/dashboard` và dùng `WorkbenchRouter`.

### 6.2 Cần bổ sung work items

3. Execution plan đã bao phủ phạm vi màn hình mở rộng; implementation-plan-v1 theo dõi kiến trúc backend và không liệt kê từng template UI.
4. ~~Global audit API/page còn thiếu cho template #21~~ — ✅ Resolved: `GET /api/audit-logs` + `AuditLogView` đã triển khai (28/09/2026, phiên 3).
5. Account/Permission Admin template #18 có read-only `UserDirectoryView`; provisioning vẫn BLOCKED chờ RBAC design. Reports/Export template #22 đã có route giao diện và API liên quan.

### 6.3 Không cần hành động

6. **38 backend work items** từ implementation plan v1 — đúng ý đồ không tạo UI riêng. Các UI template sẽ tiêu thụ (consume) kết quả của chúng.
7. **RFC-04, RFC-05** — giữ trạng thái PROPOSED. ⛔ **BLOCKED** — chặn Phase 0 completion (decision gate) và downstream schema normalization/relocation work trong Phase 5+. Không tự ý Accept/Reject.
8. **3 quyết định trì hoãn** (chữ ký số, kênh phân phối, văn bản nội bộ) — adapter/placeholder đã có trong code.

---

## 7. Kết luận

Hai kế hoạch (implementation plan v1 và execution plan) phủ **đúng** hai mặt của hệ thống: kiến trúc nền tảng (backend) và deliverable triển khai (API + UI). Không có xung đột — chỉ có khoảng trống cần bổ sung:

- Các template đã triển khai được ghi nhận trong ma trận truy vết; những phần còn thiếu được nêu rõ ở bảng 4.3 và vẫn là blocker/phạm vi chưa quyết.
- Phase 0 documentation deliverables đã hoàn thành, nhưng Phase 0 tổng thể vẫn BLOCKED bởi RFC-04/RFC-05 và quyết định nhà cung cấp chữ ký số.

Worktree có 98 API route files, 131 declared route/method pairs, 133 exported handlers và 25 `page.tsx` routes. Các counts lấy từ current inventory và code worktree; 1 template `needs-creation` cùng 3 `needs-enhancement` được liệt kê trong traceability matrix. Những phần triển khai phụ thuộc quyết định vẫn được để mở.

**Trạng thái Phase 0:** Deliverable tài liệu (route inventory, traceability matrix, plan reconciliation) — ✅ hoàn thành. Quyết định ngoại vi (RFC-04/05 decision gate, digital-signature provider) — ⛔ BLOCKED chờ Owner. Route/method inventory source hiện hành là `api-inventory-current-2026-09.md`; bản cũ đã được gắn nhãn snapshot lịch sử.

---

*Tài liệu đối chiếu này là Phase 0 documentation deliverable (4/6 items hoàn thành; 2 items BLOCKED chờ quyết định bên ngoài).*
*Ngày lập: 28/09/2026*
