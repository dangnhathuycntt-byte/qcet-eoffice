# Checkpoint: Phase 4 Batch 2 — 28/09/2026

## Tổng quan

Phase 4 Batch 2 hoàn thành 3 work stream: inbox auth, incoming doc detail actions, reusable overlays. TypeScript typecheck PASS — zero errors. Design lint violations đã fix (uppercase tracking-wide trên badge tiếng Việt).

## Đã hoàn thành

### 1. Inbox Auth Guards & CSRF ✅
- **File**: `src/components/inbox/inbox-view.tsx`
- 4 fetch calls được bổ sung `credentials: "include"`:
  - `fetchNotifications` (line 111)
  - `markAsRead` PATCH (line 202)
  - `markAllAsRead` PATCH (line 226)
  - Tasks fetch (line 265)
- 401/403 redirect tới `/login?returnTo=/inbox` trên main fetch

### 2. Incoming Document Detail Actions ✅
- **File**: `src/components/documents/incoming-document-detail-view.tsx` (718 dòng)
- 7 FSM action buttons wired tới API routes hiện có:
  - Trình lãnh đạo (Present) → VAN_THU, REGISTERED
  - Bút phê chỉ đạo (Direct) → BAN_GIAM_HIEU, PRESENTED
  - Phân công (Assign-unit) → TRUONG_PHONG, DIRECTED
  - Xử lý xong (Resolve) → CHUYEN_VIEN, UNIT_ASSIGNED_PERSON
  - Lưu hồ sơ (File) → VAN_THU, RESOLVED
  - Duyệt nội dung (Approve-content) → BAN_GIAM_HIEU, DIRECTED|UNIT_ASSIGNED_PERSON
  - Từ chối nội dung (Reject-content) → BAN_GIAM_HIEU, DIRECTED|UNIT_ASSIGNED_PERSON
- `executeAction()` helper, `pendingAction` state, loading indicators
- Attachments section với Paperclip/Download icons
- Empty states cho directives (PRESENTED) và unit assignments (DIRECTED)
- `DocumentAuditTimeline` component cho tiến trình luân chuyển
- Design lint fix: removed `uppercase tracking-wide` trên badge "Văn bản đến"

### 3. Reusable Overlays ✅
- **Files mới** (5 files tại `src/components/overlays/`):
  - `confirmation-overlay.tsx` — xác nhận hành động, variant default/destructive
  - `assignment-overlay.tsx` — phân công xử lý với instruction + deadline
  - `approval-overlay.tsx` — phê duyệt/từ chối với 3 mode (idle/approve/reject)
  - `direction-overlay.tsx` — bút phê chỉ đạo với instruction bắt buộc + deadline
  - `index.ts` — barrel export
- Sử dụng `@base-ui/react/dialog` API chính xác: `Dialog.Root`, `Dialog.Backdrop`, `Dialog.Popup`, `Dialog.Title`, `Dialog.Description`, `Dialog.Portal`, `Dialog.Close`
- Motion animation với `fadeVariants` + `motionTransition`
- Charcoal monochrome palette, `active:scale-[0.98]`, `strokeWidth={1.5}`

## Docs đã cập nhật
- `system-api-and-screens-execution-plan-2026-09-28.md`: Phase 4 items 2, 3, 6 marked [x]
- `page-template-traceability-matrix.md`: Ghi chú #1, #7, #8 cập nhật; Phase 4 Batch 2 summary

## Phase 4 còn lại

### Batch 3 (tiếp theo)
- [ ] Item 7: Validate responsive layouts, keyboard/focus, role-based pilot paths

### Blocked items
- Phase 0 items 4, 5, 6: RFC-04/05 owner decisions + provider selection
- Phase 3 item 5: FileObject backfill — chờ ClamAV
- Phase 0 item 3: Digital signature provider — chưa chọn

## Verification
- TypeScript: `npx tsc --noEmit` — 0 errors
- Design lint: No uppercase+tracking-wide on Vietnamese, no #000, no raw ease, strokeWidth={1.5}
- Chưa chạy `npm run build` (quy định dự án cấm)
- Chưa commit/push (chờ lệnh user)

## Phase 4 Summary (Batch 1 + Batch 2)

| Work item | Status | Batch |
|-----------|--------|-------|
| 1. Workbench consolidation | ✅ | 1 |
| 2. Inbox actions + auth | ✅ | 1+2 |
| 3. Incoming doc detail | ✅ | 1+2 |
| 4. Dossier list/detail actions | ✅ | 1 |
| 5. Calendar/meeting pilot | ✅ | 1 |
| 6. Reusable overlays | ✅ | 2 |
| 7. Responsive + keyboard validation | ☐ | 3 |

**6/7 items hoàn thành.** Item 7 là validation pass, không phải coding work.

---
*Checkpoint tự động — phiên làm việc đêm 28/09/2026*
