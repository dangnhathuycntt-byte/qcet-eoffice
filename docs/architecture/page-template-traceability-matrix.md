# Ma trận Truy vết Giao diện — 22 Page Templates

| Trường     | Giá trị                                                        |
| ---------- | -------------------------------------------------------------- |
| Mã số      | PAGE-TEMPLATE-TRACEABILITY-MATRIX                              |
| Ngày lập   | 28/09/2026                                                     |
| Phase      | 0 — Baseline, Decisions, and Pilot Contract                    |
| Deliverable| Phase 0 work item: "Map each of the 22 target page templates…" |

---

## 1. Mục đích

Ánh xạ toàn bộ 22 page template mục tiêu của hệ thống QCET eOffice đến route hiện có/cần tạo, vai trò truy cập, query/command chính, trạng thái hiện tại, và các phụ thuộc cần thiết. Đây là deliverable thuộc Phase 0 của `system-api-and-screens-execution-plan-2026-09-28.md`.

---

## 2. Quy ước trạng thái

| Trạng thái          | Ý nghĩa                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| `exists`            | Route, component, và API đều hoạt động — cần kiểm tra chất lượng/bảo mật |
| `needs-enhancement` | Route hoặc component đã có nhưng cần bổ sung tính năng hoặc UX           |
| `needs-creation`    | Chưa có route hoặc component — cần tạo mới hoàn toàn                     |

---

## 3. Ma trận Truy vết

### 3.1 Pilot Scope (13 templates — triển khai ưu tiên)

| # | Template | Route hiện có | Route cần tạo | Vai trò | Query chính | Command chính | Trạng thái | Phụ thuộc |
|---|----------|---------------|----------------|---------|-------------|---------------|------------|-----------|
| 1 | **Bàn làm việc** (Workbench/Dashboard) | `src/app/dashboard/page.tsx` + `src/components/dashboard/workbench-router.tsx` | Không — đã tạo | BGH, Trưởng đơn vị, Chuyên viên | `GET /api/dashboard/overview` | N/A (read-only aggregation) | exists | `workbench-router.tsx` (role-based greeting + zone placeholders); stat cards chờ API wiring |
| 2 | **Task Hub** (Nhiệm vụ) | `src/app/tasks/page.tsx` | Không | All authenticated | `GET /api/tasks` (view=related\|unit\|all\|approval) | `POST /api/tasks` | exists | `task-management-workspace.tsx`, `cascading-task-table.tsx`, `unified-task-hub-client.tsx` |
| 3 | **Task Detail** (Chi tiết nhiệm vụ) | `src/app/tasks/[id]/page.tsx` | Không | All authenticated (filtered by authorization) | `GET /api/tasks/[id]` | `POST /api/tasks/[id]/actions/*` (approve, update-status, submit-result, v.v.) | exists | `task-detail-page.tsx`, `src/components/tasks/detail/*` |
| 4 | **Inbox / Hộp công việc** | `src/app/inbox/page.tsx` | Không | All authenticated | `GET /api/me/inbox` | `POST /api/tasks/[id]/actions/*` | exists | `inbox-view.tsx`, `action-inbox.tsx`; RFC-07 (Action Inbox separation) ảnh hưởng tương lai |
| 5 | **Sổ văn bản đến** (Incoming Document Registry) | `src/app/documents/page.tsx` (tab=inbox) | Không — tab trong `DocumentRegistryView` | Văn thư, Trưởng đơn vị, BGH | `GET /api/documents/incoming` | `POST /api/documents/[id]/actions/*` (assign-unit, direct, approve-content, v.v.) | exists | `document-registry-view.tsx`, `document-table.tsx`, `document-filter-bar.tsx`; Phase 1 ACL hardening ✅ (`buildDocumentReadWhere`); 6/6 registry tests pass |
| 6 | **Chi tiết VB đến** (Incoming Document Detail) | `src/app/documents/incoming/[id]/page.tsx` | Không | Văn thư, Trưởng đơn vị, BGH, Chuyên viên (assigned) | `GET /api/documents/incoming/[id]` | `POST /api/documents/[id]/actions/*` (resolve, direct, file, approve-content/format, sign) | exists | Pattern A server component; `incoming-document-detail-view.tsx`; Phase 1 ACL |
| 7 | **Sổ văn bản đi** (Outgoing Document Registry) | `src/app/documents/page.tsx` (tab=outbox) | Không — tab trong `DocumentRegistryView` | Văn thư, Trưởng đơn vị, BGH, Chuyên viên soạn thảo | `GET /api/documents/outgoing` | `POST /api/documents/outgoing` | exists | `document-registry-view.tsx` (tab 'outbox'); Phase 1 outgoing ACL ✅ (`buildDocumentReadWhere`); shared filter/table/pagination functional |
| 8 | **Chi tiết VB đi** (Outgoing Document Detail) | `src/app/documents/outgoing/[id]/page.tsx` | Không | Văn thư, Trưởng đơn vị, BGH, Chuyên viên soạn thảo | `GET /api/documents/outgoing/[id]` | `POST /api/documents/outgoing/[id]/actions/deliver`, `POST /api/documents/[id]/actions/*` (sign, approve, issue, assign-number) | exists | `outgoing-document-detail-view.tsx`, `outgoing-action-panel.tsx`, `outgoing-workflow-stepper.tsx` |
| 9 | **Lịch công tác** (Calendar) | `src/app/calendar/page.tsx` | Không | All authenticated | `GET /api/tasks` (calendar view), `GET /api/meetings` | `POST /api/meetings` | exists | `calendar-client.tsx`, `src/components/calendar/` |
| 10 | **Cơ cấu tổ chức** (Organization) | `src/app/org/page.tsx` | Không | All authenticated (read), Admin (write) | `GET /api/departments`, `GET /api/organization/bodies` | `POST /api/organization/bodies`, `PUT /api/organization/bodies/[id]` | exists | `OrganizationTree`; RFC-02 (Department→OrgUnit) ảnh hưởng tương lai |
| 11 | **Hồ sơ công việc** (Dossier List) | `src/app/dossiers/page.tsx` | Không | Văn thư, Trưởng đơn vị, Chuyên viên (assigned) | `GET /api/dossiers` | `POST /api/dossiers` | exists | Pattern B; `dossier-list-view.tsx`; Phase 3 dossier FSM formalization |
| 12 | **Chi tiết Hồ sơ** (Dossier Detail) | `src/app/dossiers/[id]/page.tsx` | Không | Văn thư, Trưởng đơn vị, Chuyên viên (assigned), Lưu trữ viên | `GET /api/dossiers/[id]`, `GET /api/dossiers/[id]/items` | `POST /api/dossiers/[id]/actions/*` (close, submit-archive, accept-archive, finalize-archive, reject-archive, mark-ready-for-archive) | exists | Pattern A; `dossier-detail-view.tsx`; Phase 3 dossier lifecycle formalization (RFC-11) |
| 13 | **Cài đặt Hệ thống** (Settings) | `src/app/settings/page.tsx` | Không | All authenticated (personal), System Admin (system) | `GET /api/runtime-config` | `PUT /api/runtime-config` | exists | `pwa-health-settings.tsx`, `maintenance-view.tsx` |

### 3.2 Later Scope (9 templates — triển khai mở rộng sau pilot)

| # | Template | Route hiện có | Route cần tạo | Vai trò | Query chính | Command chính | Trạng thái | Phụ thuộc |
|---|----------|---------------|----------------|---------|-------------|---------------|------------|-----------|
| 14 | **Chi tiết cuộc họp** (Meeting Detail) | `src/app/calendar/meetings/[id]/page.tsx` | Không | BGH, Trưởng đơn vị, Thư ký cuộc họp, Participants | `GET /api/meetings/[id]`, `GET /api/meetings/[id]/participants`, `GET /api/meetings/[id]/resolutions` | `POST /api/meetings/[id]/actions/*` (hold, draft-minutes, confirm-minutes), `POST /api/meetings/[id]/resolutions` | exists | Pattern A; `meeting-detail-view.tsx`; Phase 3 meeting FSM formalization (RFC-10) |
| 15 | **Soạn thảo VB đi** (Outgoing Document Compose) | `src/app/documents/outgoing/compose/page.tsx` | Không | Chuyên viên soạn thảo, Trưởng đơn vị | `GET /api/departments`, `GET /api/users` | `POST /api/documents/outgoing`, `PUT /api/documents/outgoing/[id]` | exists | Pattern B; `compose-outgoing-document-form.tsx`; Plate.js editor integration |
| 16 | **Văn bản nội bộ** (Internal Document Workflow) | `src/app/documents/page.tsx` (tab=submission) | Không — dùng registry tab hiện có | All authenticated | `GET /api/documents?type=TO_TRINH_NOI_BO` | `POST /api/documents/[id]/actions/submit-content-review`, `approve-content` | exists | Owner authorized conservative defaults: institutional numbering, submit→approve, dept+leadership ACL. Registry tab "Tờ trình duyệt" functional; 6/6 contract tests. Feature-gated `internalDocuments`. |
| 17 | **Quản lý Ủy quyền** (Delegation Admin) | `src/app/delegations/page.tsx` | Không | BGH, Trưởng đơn vị | `GET /api/delegations` | `POST /api/delegations`, `POST /api/delegations/[id]/revoke` | exists | Pattern B; `delegation-registry-view.tsx`; RFC-03 (Delegation Consolidation) |
| 18 | **Quản trị Tài khoản & Phân quyền** (Account/Permission Admin) | `src/app/admin/users/page.tsx` | Không — đã tạo | System Admin, BGH | `GET /api/users` | N/A (read-only directory; provisioning BLOCKED) | needs-enhancement | `UserDirectoryView` client component; read-only user list delivered; account/permission provisioning BLOCKED chờ RBAC design (Owner-level decision); RFC-08 (User Directory Policy) |
| 19 | **Trung tâm Thông báo** (Notification Center) | `src/app/notifications/page.tsx` | Không | All authenticated | `GET /api/notifications` | `POST /api/notifications/[id]/read`, `POST /api/notifications/read-all` | exists | Pattern B; `notification-center.tsx`; RFC-07 |
| 20 | **Tìm kiếm Toàn cục** (Global Search) | `src/app/search/page.tsx` | Không | All authenticated | `GET /api/search` | N/A (read-only) | exists | Pattern B; `global-search-view.tsx`; search với tabs nhiệm vụ/văn bản/nhân sự |
| 21 | **Nhật ký Vận hành** (Audit/Operations Log) | `src/app/admin/audit/page.tsx` | Không — đã tạo | System Admin, BGH | `GET /api/audit-logs` | N/A (read-only) | exists | `AuditLogView` client component; `loadAuthorizationContext` + `authorize('system.audit.view')`; global audit API route tại `src/app/api/audit-logs/route.ts`; contract tests tại `tests/audit-log-api-contract.test.ts` |
| 22 | **Báo cáo & Xuất dữ liệu** (Reports/Export) | `src/app/reports/page.tsx` | Không | BGH, Trưởng đơn vị, Văn thư | `GET /api/documents/stats`, `GET /api/documents/export-excel`, `GET /api/documents/download` (batch) | `POST /api/documents/download` (batch download) | exists | Pattern B; `reports-overview-view.tsx`; stat cards dashboard |

---

## 4. Thống kê tổng hợp

| Metric                        | Giá trị |
| ----------------------------- | ------- |
| Tổng số template              | 22      |
| Tổng `page.tsx` routes trong app | 25 (bao gồm login/system/admin routes ngoài 22 templates) |
| Pilot scope                   | 13      |
| Later scope                   | 9       |
| Trạng thái `exists`           | 21      |
| Trạng thái `needs-enhancement`| 1       |
| Trạng thái `needs-creation`   | 0       |
| Blocked bởi quyết định chưa đưa ra | 0 |
| Blocked bởi RBAC phức tạp     | 1 (#18 Account Admin — read-only directory exists, provisioning chờ RBAC design) |

---

## 5. Sơ đồ phụ thuộc Template → Backend Phase

```
Phase 0 (baseline, docs)
  └── Phase 1 (security, ACL)
        ├── Templates 2-4 (Task Hub, Detail, Inbox) — exists, cần ACL audit
        ├── Templates 5, 7 (Doc registries) — exists, ACL enforced via buildDocumentReadWhere
        └── Phase 2 (semantic contracts)
              ├── Template 6 (Incoming Doc Detail) — exists; FSM actions delivered
              ├── Template 8 (Outgoing Doc Detail) — exists
              └── Phase 3 (dossier, meeting FSM)
                    ├── Templates 11-12 (Dossier List/Detail) — exists; lifecycle actions delivered
                    ├── Template 14 (Meeting Detail) — exists; governance actions delivered
                    └── Phase 4 (pilot screens)
                          ├── Templates 1, 9-10, 13 (Workbench, Calendar, Org, Settings) — exists
                          └── Phase 5 (full scope)
                                ├── Templates 15, 17, 19, 20, 22 — exists
                                ├── Template 18 — needs-enhancement (read-only directory delivered; provisioning blocked by RBAC)
                                ├── Template 21 — exists (read-only audit; canonical authorization grants apply)
                                ├── Template 16 — exists (conservative defaults: institutional numbering, submit→approve, dept+leadership ACL; feature-gated)
                                └── Phase 6 (migration, release)
```

---

## 6. Ghi chú quan trọng

1. **Template #6 (Chi tiết VB đến)** — đã tạo route `src/app/documents/incoming/[id]/page.tsx` và component detail view hoàn chỉnh: 718 dòng, FSM action buttons (present/direct/assign-unit/resolve/file/approve-content/reject-content), role-based visibility, attachments, direction/unit-assignment empty states, DocumentAuditTimeline, loading.tsx + error.tsx boundaries. *(28/09/2026)*
2. **Template #16 (Văn bản nội bộ)** bị chặn bởi quyết định phạm vi chưa đưa ra. Không lên lịch triển khai cho đến khi Decision Gate Phase 5 kết thúc.
3. **Template #21 (Audit Log)** — global audit API `GET /api/audit-logs` và screen `AuditLogView` đã triển khai. Canonical `authorize('system.audit.view')` grants access to SYSTEM_ADMIN and HIEU_TRUONG (institutional authority); ordinary users without that authority are denied. *(28/09/2026)*
4. **Template #18 (Account Admin)** — read-only `UserDirectoryView` đã triển khai tại `src/app/admin/users/page.tsx`; template ở trạng thái `needs-enhancement` vì create/update user và permission assignment vẫn BLOCKED chờ RBAC design. *(28/09/2026)*
5. **Template #1 (Bàn làm việc)** — đã thay thế redirect `/dashboard` → `/tasks` bằng `WorkbenchRouter` thật với dual-path auth, greeting theo persona, stat cards placeholder, zone navigation. *(28/09/2026)*
6. **9 templates mới tạo trong Phase 5** (28/09/2026): #6, #11, #12, #14, #15, #17, #19, #20, #22 — tất cả đã typecheck pass, dùng dual-path auth, charcoal monochrome palette, motion tokens canonical.
7. **Phase 4 Batch 1** (28/09/2026): Template #12 (Dossier Detail) có 6 action buttons wired; Template #14 (Meeting Detail) có 3 action buttons wired; Templates #4, #5, #11 có server-side auth guards; Templates #6, #12 có loading.tsx + error.tsx.
8. **Phase 4 Batch 2** (28/09/2026): Template #6 (Incoming Doc Detail) hoàn chỉnh FSM action buttons + attachments + empty states; Inbox auth guards (CSRF credentials + 401/403 redirect); 4 reusable overlays (ConfirmationOverlay, AssignmentOverlay, ApprovalOverlay, DirectionOverlay) tại `src/components/overlays/`.
9. **Admin Screens** (28/09/2026): Template #21 (Audit Log) — global `GET /api/audit-logs` API + `AuditLogView` read-only screen triển khai; canonical capability policy grants SYSTEM_ADMIN and HIEU_TRUONG access. Template #18 — read-only `UserDirectoryView` delivered and classified `needs-enhancement`; provisioning remains BLOCKED pending RBAC design. Contract tests: `tests/audit-log-api-contract.test.ts`.

---

*Tài liệu này là Phase 0 deliverable: "Map each of the 22 target page templates to its existing route/component…"*
*Ngày lập: 28/09/2026*
