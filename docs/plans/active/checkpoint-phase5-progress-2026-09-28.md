# Checkpoint: Phase 5 Progress — 28/09/2026

## Tổng quan

Phase 5 — Full system modules and external integrations — **hoàn thành 3/6 items** (3 còn lại BLOCKED chờ quyết định bên ngoài). TypeScript typecheck PASS — zero errors.

## Phase 5 Summary

| # | Work item | Status | Ghi chú |
|---|-----------|--------|---------|
| 1 | Outgoing-document lifecycle | ⛔ BLOCKED | Scope decision pending |
| 2 | Digital-signature provider | ⛔ BLOCKED | Chưa chọn nhà cung cấp |
| 3 | Internal-document workflow | ⛔ BLOCKED | Numbering/authority rules chưa accepted |
| 4 | Meeting governance | ✅ | Resolution creation form, minutes, linked tasks |
| 5 | Delegation, notification, search, reports | ✅ | Focus-visible, touch targets, CSV export, pagination |
| 6 | ACL enforcement on aggregation APIs | ✅ | `buildDocumentReadWhere` applied to stats route |

## Chi tiết các thay đổi

### #4 — Meeting governance (complete)
- **File**: `src/components/meetings/meeting-detail-view.tsx`
- Thêm inline resolution creation form với:
  - Title input (required), content textarea (required)
  - Code input (optional), deadline date input (optional)
  - Lead unit select (from departments), lead user select (from personnel)
  - Create linked task checkbox + conditional task title input
  - Error display, Ban hành/Hủy buttons
- Sử dụng `CreateMeetingResolutionSchema` từ `@/contracts/meeting.ts`
- API endpoint: `POST /api/meetings/[id]/resolutions`

### #5 — Administration & utility modules (complete)

#### Delegation registry (`delegation-registry-view.tsx`)
- Focus-visible trên search input, refresh button, status filter tabs
- Touch targets `min-h-[44px] sm:min-h-0` trên filter tabs
- Responsive column hiding (`hidden md:table-cell`) trên cột "Hiệu lực từ" và "Hiệu lực đến"
- Pagination: `PAGE_SIZE=20` + "Xem thêm (N còn lại)" button

#### Notification center (`notification-center.tsx`)
- Focus-visible trên 6 interactive elements:
  - "Đánh dấu tất cả đã đọc" button
  - Refresh button
  - Filter tab buttons (Tất cả / Chưa đọc)
  - "Xem thêm" load-more button
  - Per-notification "mark as read" button (+ `focus-visible:opacity-100`)
  - NotificationCenterRow Link
- Touch targets trên buttons

#### Global search (`global-search-view.tsx`)
- Focus-visible trên 6 interactive elements:
  - Search input, clear button, retry button
  - Tab buttons (3 tabs)
  - Task result Links, document result Links
- Touch targets trên retry button, tab buttons

#### Reports/export (`reports-overview-view.tsx`)
- CSV export: `handleExport` callback builds CSV from `ALL_ROWS` with BOM prefix
- Download button icon (`lucide-react` Download icon)
- `isExporting` loading state
- Focus-visible trên refresh button, retry button

### #6 — ACL enforcement on aggregation APIs (complete)

#### Audit kết quả

| API Route | Auth | ACL Scoping | Status |
|---|---|---|---|
| `api/search/route.ts` | ✅ `requireAuthenticated` + rate limit | ✅ `buildTaskReadWhere` + classification filter | OK |
| `api/dashboard/overview/route.ts` | ✅ `requireAuthenticated` | ✅ department-scoped for non-admin | OK |
| `api/notifications/route.ts` | ✅ `requireAuthenticated` | ✅ `userId: authUser.id` | OK |
| `api/delegations/route.ts` | ✅ `requireAuthenticated` | ✅ `loadAuthorizationContext` | OK |
| `api/documents/stats/route.ts` | ✅ `requireAuthenticated` | ✅ `buildDocumentReadWhere` (MỚI) | **Fixed** |

#### Fix applied: `documents/stats/route.ts`
- Import `buildDocumentReadWhere` từ `@/server/policies/document-policy`
- Thay `activeFilter = { archivedAt: null }` → `baseFilter = { AND: [{ archivedAt: null }, aclWhere] }`
- Non-admin users chỉ thấy document counts họ có quyền truy cập (registered by, lead user, unit-scoped, linked task, directives)
- Admin/VAN_THU/BGH vẫn thấy all non-confidential documents (TUYET_MAT excluded)

## Blocked items (KHÔNG thực thi)

| # | Item | Lý do |
|---|------|-------|
| 1 | Outgoing-document | Scope decision pending |
| 2 | Digital signature | Chưa chọn nhà cung cấp |
| 3 | Internal-document | Numbering/authority/visibility rules chưa accepted |
| — | Account/permission admin (#18) | `needs-enhancement`: read-only directory delivered; provisioning BLOCKED chờ RBAC design |
| — | Audit/operations log (#21) | ✅ Global audit API + AuditLogView + contract tests triển khai (28/09/2026, phiên 3) |

## Provider-Neutral Contract Tests (28/09/2026, phiên 2)

Bổ sung 3 test file provider-neutral — 105 tests mới, tất cả pass, typecheck clean.

| Test File | Tests | Pass | Mô tả |
|-----------|-------|------|--------|
| `digital-signature-adapter-contract.test.ts` | 13 | 13 | Factory stub, mock provider, interface completeness, sign→verify lifecycle |
| `outgoing-state-machine-contract.test.ts` | 60 | 60 | Tất cả transition hợp lệ/không hợp lệ, SoD assertions, immutability, status mapping |
| `digital-signature-service-extended.test.ts` | 32 | 32 | Edge cases: canonicalizeData, hash determinism, date boundaries, verification limits |
| **Subtotal** | **105** | **105** | |

**Fixes chỉ trên test (0 thay đổi source):**
- Double-cast `as unknown as Record<string, unknown>` cho TS2352 trên `DocumentSignaturePayload`
- Import type `OutgoingDocumentStatus` thay cho `any` trong state machine tests

**Tổng test coverage Phase 5:**
- Contract tests trước đó: 493 pass; current user/admin/date contracts add 10 passing cases
- Security tests: 199 pass
- Provider-neutral contract tests mới: 105 pass
- Audit log contract tests: 28 pass (real authorization engine behavior)
- **Tổng: 835 pass, 0 fail** (aggregated); latest focused admin/date set: 79/79 pass

## Verification
- TypeScript: `npx tsc --noEmit` — 0 errors
- Design lint: Tuân thủ charcoal monochrome, focus-visible rings, touch targets
- ACL: Tất cả aggregation endpoints đã enforce document/task read policies

## Trạng thái Phase 5

Phase 5 đã hoàn thành tất cả work items khả thi + provider-neutral adapter boundaries có contract tests. 3 items còn lại bị BLOCKED bởi quyết định ngoại vi (nhà cung cấp chữ ký số, scope documents, RBAC design). Khi nhà cung cấp được chọn, chỉ cần implement `DigitalSignatureProvider` — interface contract đã được xác minh.

### Admin Screens Implementation (28/09/2026, phiên 3)

| Component | File | Status | Ghi chú |
|-----------|------|--------|---------|
| Audit Log API | src/app/api/audit-logs/route.ts | ✅ | loadAuthorizationContext + canonical authorize('system.audit.view'); SYSTEM_ADMIN and HIEU_TRUONG institutional authority granted; no beforeData/afterData/metadata |
| Audit Log Contract | src/contracts/audit-logs.ts | ✅ | Zod schema + safe DTO |
| Audit Log Screen | src/app/admin/audit/page.tsx | ✅ | Server page + AuditLogView client component |
| User Directory Screen | src/app/admin/users/page.tsx | ✅ | Read-only, role filter, pagination with server-side count, provisioning documented |
| Contract Tests | tests/audit-log-api-contract.test.ts | ✅ | 28 tests: schema validation, DTO safety, capability, pagination, real `authorize()` engine (SYSTEM_ADMIN, HIEU_TRUONG institutional authority, SoP, deactivated account) |

Matrix reconciliation: 18 `exists`, 3 `needs-enhancement`, 1 `needs-creation`. Template #18 is partial (`needs-enhancement`); template #21 is delivered (`exists`).

Remaining gates:
- Account/permission admin provisioning: BLOCKED (RBAC design chưa quyết, Owner-level decision)
- Audit log detail view: Không triển khai (beforeData/afterData/metadata KHÔNG serialize)

---
*Checkpoint cập nhật — phiên làm việc 28/09/2026 (phiên 4: defect fixes A–E)*
