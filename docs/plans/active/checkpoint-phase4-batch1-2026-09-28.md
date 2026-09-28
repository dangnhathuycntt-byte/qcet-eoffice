# Checkpoint: Phase 4 Batch 1 — 28/09/2026

## Tổng quan

Phase 4 Batch 1 triển khai thành công 5 work stream song song + 1 verify pass. Tổng thời gian workflow: ~3.5 phút. Toàn bộ typecheck PASS, zero errors.

## Đã hoàn thành

### 1. Dossier Detail Action Buttons ✅
- **File**: `src/components/dossiers/dossier-detail-view.tsx` (711 dòng)
- 6 action buttons wired tới API routes hiện có:
  - Đóng hồ sơ (Close) → `POST /api/dossiers/{id}/actions/close`
  - Đánh dấu sẵn sàng lưu trữ → `POST /api/dossiers/{id}/actions/mark-ready-for-archive`
  - Nộp lưu trữ → `POST /api/dossiers/{id}/actions/submit-archive`
  - Chấp nhận lưu trữ → `POST /api/dossiers/{id}/actions/accept-archive`
  - Từ chối lưu trữ → `POST /api/dossiers/{id}/actions/reject-archive`
  - Hoàn tất lưu trữ → `POST /api/dossiers/{id}/actions/finalize-archive`
- Role-based visibility theo FSM states + user role
- Loading states, CSRF credentials, error handling, router.refresh()
- Design lint fix: removed `uppercase tracking-wide` on Vietnamese headings

### 2. Server-side Auth Guards ✅
- **Files**: `src/app/documents/page.tsx`, `src/app/inbox/page.tsx`, `src/app/dossiers/page.tsx`
- Dual-path auth pattern (NextAuth + JWT fallback)
- Redirect to `/login?returnTo=...` khi chưa authenticated
- `export const dynamic = "force-dynamic"`

### 3. Loading/Error Boundaries ✅
- **Files mới** (4 files):
  - `src/app/dossiers/[id]/loading.tsx` (28 dòng)
  - `src/app/dossiers/[id]/error.tsx` (34 dòng)
  - `src/app/documents/incoming/[id]/loading.tsx` (28 dòng)
  - `src/app/documents/incoming/[id]/error.tsx` (34 dòng)
- Skeleton animation, charcoal monochrome palette
- Error boundary with reset button, Vietnamese labels
- AlertCircle icon strokeWidth={1.5}, active:scale-[0.98]

### 4. Meeting Detail Action Buttons ✅
- **File**: `src/components/meetings/meeting-detail-view.tsx` (554 dòng)
- 3 action buttons + cancel:
  - Bắt đầu họp (Hold) → `POST /api/meetings/{id}/actions/hold`
  - Soạn biên bản (Draft Minutes) → `POST /api/meetings/{id}/actions/draft-minutes`
  - Duyệt biên bản (Confirm Minutes) → `POST /api/meetings/{id}/actions/confirm-minutes`
- `currentUser` prop threaded từ server component
- Role-based + organizer-based visibility

### 5. Dashboard Workbench ✅
- **Files**: `src/app/dashboard/page.tsx` (40 dòng), `src/components/dashboard/workbench-router.tsx` (125 dòng)
- Thay thế redirect stub bằng real workbench page
- Dual-path auth guard
- Role-based greeting (Chào buổi sáng/chiều/tối + role label)
- 4 stat cards (placeholder "—" chờ API wiring)
- 4 zone navigation cards (Nhiệm vụ, Văn bản, Lịch công tác, Hồ sơ)
- Motion fade animation với canonical tokens

## Docs đã cập nhật
- `system-api-and-screens-execution-plan-2026-09-28.md`: Phase 4 items 1, 4, 5 marked [x]; items 2, 3 marked partial
- `page-template-traceability-matrix.md`: Template #1 → exists; stats 17 exists / 2 needs-enhancement / 3 needs-creation

## Phase 4 còn lại

### Batch 2 (tiếp theo)
- [ ] Item 2 (partial): Hoàn thiện inbox actions + 401/403 error handling trong client fetch
- [ ] Item 3 (partial): Incoming document detail — attachments rendering, direction timeline, empty states
- [ ] Item 6: Reusable overlays (assignment, approval, direction, confirmation)
- [ ] Item 7: Responsive layout + keyboard/focus validation

### Blocked items
- Phase 0 items 4, 5, 6: RFC-04/05 owner decisions + provider selection
- Phase 3 item 5: FileObject backfill — chờ ClamAV

## Verification
- TypeScript: `npx tsc --noEmit` — 0 errors
- Design lint: No raw ease, no uppercase+tracking-wide on Vietnamese, no #000, strokeWidth={1.5}
- Chưa chạy `npm run build` (quy định dự án cấm)
- Chưa commit/push (chờ lệnh user)

---
*Checkpoint tự động — phiên làm việc đêm 28/09/2026*
