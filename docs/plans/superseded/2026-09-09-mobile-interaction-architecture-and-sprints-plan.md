---
status: superseded
domain: ux
created: 2026-09-09
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Kế Hoạch Triển Khai Kiến Trúc Interaction Mobile Toàn Diện QCET E-Office

> **Mã kế hoạch:** PLAN-MOBILE-INTERACTION-2026-09-09  
> **Chuẩn tham chiếu:** Material Adaptive, Android Navigation Bar, Apple HIG (iOS 18), Linear Mobile Interaction Architecture, WCAG 2.2 AA (Target Size 2.5.8, Focus Not Obscured 2.4.11).  
> **Nguyên tắc cốt lõi:** Light-Only, Zero Anti-Slop, 100% Type-Safe, Một nguồn chân lý duy nhất (Single Source of Truth) cho Safe-Area và Navigation.

---

## 1. Mục Tiêu & Kiến Trúc Tương Tác Mobile

### 1.1. Vấn đề cốt lõi cần giải quyết
1. **P0.1 - Xóa bỏ Double/Triple Bottom Clearance:**
   - Hiện `AppShell` (`pb-20 md:pb-8`), `UnifiedAdaptiveWorkspace` (`pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]`), và `TaskManagementWorkspace` đang cộng dồn tạo ra khoảng trống >160px ở chân trang.
   - Giải pháp: Chỉ `AppShell` sở hữu khoảng đệm đáy di động:
     ```css
     padding-bottom: calc(var(--mobile-nav-height, 56px) + env(safe-area-inset-bottom, 0px) + 12px);
     ```
     Các workspace, pages, table con đều đưa về `pb-0` / normal spacing.
2. **P0.2 - Chuẩn hóa Bottom Navigation thành 4 Destinations:**
   - Loại bỏ nút `+` ở chính giữa thanh điều hướng đáy.
   - Loại bỏ nút `Thêm` (Menu drawer) khỏi thanh điều hướng đáy.
   - 4 Destination cố định: **[ Tổng quan (`/`) | Nhiệm vụ (`/tasks`) | Văn bản (`/documents`) | Lịch (`/calendar`) ]**.
   - `Thông báo` chuyển lên biểu tượng chuông (Bell) tại `AppTopbar` có badge đếm số lượng chưa đọc.
   - `Tổ chức`, `Cài đặt`, `Cài PWA`, `Hồ sơ cá nhân`, `Đăng xuất` chuyển vào Profile Drawer / Menu tại `AppTopbar`.
3. **P0.3 - Tương Tác Bàn Phím Ảo (Virtual Keyboard Coordination):**
   - Kết nối `useVirtualKeyboard` với `AppShell` và `MobileBottomNav`.
   - Khi bàn phím ảo mở (`isKeyboardOpen === true`), thanh `MobileBottomNav` tự động ẩn (`hidden` hoặc `translate-y-full`) để không che khuất các input hoặc nút bấm gửi dữ liệu form.
4. **P1.1 - Mobile Task Feed Thay Thế Bảng Ngang (Compact Viewport < 640px):**
   - Không render `TaskTableToolbar` dày đặc trên mobile.
   - Thay vào đó là `MobileTaskHeader`: Tìm kiếm gọn + Horizontal Filter Chips (`[Tất cả]` `[Của tôi]` `[Chờ duyệt]`) + Nút `[Bộ lọc]` mở `BottomSheet` đa tiêu chí (Đơn vị, Trạng thái, Tháng) + Nút `[Sắp xếp]`.
   - Card nhiệm vụ trực quan: Mã việc, Trạng thái, Tiêu đề, Đơn vị, Người phụ trách, Thanh tiến độ %, Hạn chót. Tap toàn card để mở Full-screen Detail.
5. **P1.2 - Full-Screen Task Detail Trên Mobile:**
   - Không dùng modal/drawer 560px co nhỏ trên mobile. Khi tap vào task, chuyển sang trang/view chi tiết toàn màn hình có nút quay lại (`←`), thông tin đầy đủ và Bottom Action contextual theo vai trò:
     - Chuyên viên: `[Nộp báo cáo]`
     - Trưởng phòng: `[Yêu cầu sửa]` `[Duyệt]`
     - BGH: `[Yêu cầu sửa]` `[Phê duyệt]`
     - Bình thường: `[Cập nhật tiến độ]`
     - Nút `⋯` chứa các tác vụ phụ.
6. **P1.3 - Workbench Mobile Attention-First (`/`):**
   - Không hiển thị 8 thẻ KPI desktop thu nhỏ.
   - Thứ tự ưu tiên: Việc cần chú ý (Chờ duyệt, Quá hạn) → Nhiệm vụ của tôi → Lịch công tác hôm nay → Thông báo mới.

---

## 2. Lộ Trình Sprints Chi Tiết

### Sprint M0: Structural Fixes & Core Navigation (P0)
- **Tệp chỉnh sửa:**
  - `src/lib/navigation/canonical-navigation-registry.ts`
  - `src/components/layout/app-shell.tsx`
  - `src/components/layout/mobile-bottom-nav.tsx`
  - `src/components/layout/mobile-menu-drawer.tsx`
  - `src/components/layout/app-topbar.tsx`
  - `src/components/workspace/unified-adaptive-workspace.tsx`
  - `src/components/tasks/task-management-workspace.tsx`
- **Nội dung:**
  1. Cập nhật `CANONICAL_ROUTES`:
     - `desk` (`/`): `mobilePlacement: "bottom-bar"`, order 1
     - `tasks` (`/tasks`): `mobilePlacement: "bottom-bar"`, order 2
     - `documents` (`/documents`): `mobilePlacement: "bottom-bar"`, order 3
     - `calendar` (`/calendar`): `mobilePlacement: "bottom-bar"`, order 4
     - `notifications` (`/notifications`): `mobilePlacement: "top-bar"`, order 5
     - `org`, `settings`: `mobilePlacement: "drawer"`, order 6, 7
  2. Tinh chỉnh `mobile-bottom-nav.tsx`:
     - Render đúng 4 tab `grid grid-cols-4`: Tổng quan, Nhiệm vụ, Văn bản, Lịch.
     - Ẩn khi `isKeyboardOpen` từ `useVirtualKeyboard`.
     - Loại bỏ nút `+` ở giữa và nút `Thêm`.
     - Chuẩn hóa touch targets min 44px (48px).
  3. Cập nhật `app-topbar.tsx`:
     - Hiển thị Notification Bell trên cả mobile lẫn desktop với touch target 44px và badge thông báo chưa đọc.
     - Nhấn vào Bell trên mobile mở thông báo hoặc điều hướng `/notifications`.
     - Thêm nút Avatar/Profile trigger mở `MobileProfileDrawer` chứa lối tắt: Tổ chức, Cài đặt, Cài PWA, Đổi mật khẩu, Đăng xuất.
  4. Chuẩn hóa Bottom Clearance trong `app-shell.tsx` và xóa bỏ double clearance trong `unified-adaptive-workspace.tsx`.
  5. Cập nhật các test suites: `tests/mobile-bottom-nav.test.ts`, `tests/scope-switcher-mobile.test.ts`, `tests/mobile-viewport-e2e.test.ts`, `tests/canonical-routes.test.ts`, `tests/navigation-single-source-of-truth.test.ts`.

### Sprint M1: Mobile Task Workspace & Task Feed
- **Tệp chỉnh sửa & tạo mới:**
  - `src/components/tasks/mobile/mobile-task-header.tsx` (tạo mới)
  - `src/components/tasks/mobile/mobile-task-filter-sheet.tsx` (tạo mới)
  - `src/components/tasks/mobile/mobile-task-feed.tsx` (tạo mới)
  - `src/components/tasks/mobile/mobile-task-card.tsx` (tạo mới / nâng cấp)
  - `src/components/tasks/mobile/mobile-task-detail-view.tsx` (tạo mới)
  - `src/components/workspace/unified-adaptive-workspace.tsx`
  - `src/components/tasks/table/modular-cascading-task-table.tsx`
- **Nội dung:**
  1. Tích hợp `MobileTaskHeader`:
     - Ô tìm kiếm nhỏ gọn có nút xóa nhanh.
     - Chip lọc nhanh dạng trượt ngang: `[Tất cả]`, `[Của tôi]`, `[Chờ duyệt]`, `[Quá hạn]`.
     - Nút `[Bộ lọc]` hiển thị số lượng bộ lọc đang chọn, tap mở `MobileTaskFilterSheet`.
  2. Xây dựng `MobileTaskFilterSheet` (sử dụng `BottomSheet`):
     - Lựa chọn Đơn vị phòng ban (dropdown/chips).
     - Lựa chọn Trạng thái (dropdown/chips).
     - Lựa chọn Tháng kế hoạch (dropdown/chips).
     - Nút `Đặt lại` và `Áp dụng`.
  3. Xây dựng `MobileTaskFeed`:
     - Hiển thị danh sách card nhiệm vụ tối ưu hóa cho màn hình cảm ứng.
     - Nhấn vào bất kỳ đâu trên card → kích hoạt `taskId` trên URL / mở `MobileTaskDetailView`.
  4. Xây dựng `MobileTaskDetailView`:
     - Chiếm toàn màn hình trên mobile (`< 640px`), có nút `← Quay lại`.
     - Hiển thị đầy đủ: Mã việc, Trạng thái, Tiêu đề, Mô tả, Người phụ trách, Đơn vị, Tiến độ %, Hạn chót, Công việc con (Subtasks).
     - Sticky bottom dock chứa Contextual Actions theo role.

### Sprint M2: Forms & Workflows Trên Mobile
- **Tệp chỉnh sửa:**
  - `src/components/dashboard/create-task-modal.tsx`
  - `src/components/dashboard/review-action-dialog.tsx`
  - `src/components/dashboard/submit-deliverable-modal.tsx`
- **Nội dung:**
  - Đảm bảo các modal tạo việc, duyệt việc, nộp báo cáo mở dưới dạng BottomSheet toàn màn hình (`h-[100dvh]` hoặc `max-h-[92dvh]`) trên mobile.
  - Sticky action buttons ở đáy modal luôn nằm trên bàn phím ảo, không bị che khuất.

### Sprint M3: Mobile Workbench Attention Feed (`/`)
- **Tệp chỉnh sửa:**
  - `src/components/dashboard/workbench-mobile-feed.tsx` (hoặc tích hợp vào trang chủ)
  - `src/app/page.tsx`
- **Nội dung:**
  - Thiết kế attention-first feed cho màn hình di động:
    1. Cần xử lý ngay (Khẩn / Chờ duyệt / Quá hạn).
    2. Nhiệm vụ của tôi trong ngày.
    3. Lịch công tác hôm nay.
    4. Thông báo mới nhất.
  - Tối ưu theo vai trò: BGH tập trung vào phê duyệt & cảnh báo đơn vị; Giảng viên/Chuyên viên tập trung vào deadline cá nhân & nộp minh chứng.

### Sprint M4: Calendar & Documents Mobile Refactor
- **Tệp chỉnh sửa:**
  - `src/components/calendar/calendar-adaptive-view.tsx`
  - `src/components/documents/document-management-workspace.tsx`
- **Nội dung:**
  - Calendar trên mobile mặc định là Agenda (Lịch biểu theo dòng thời gian ngày/tuần), bỏ month-grid 7 cột co rúm.
  - Documents trên mobile hiển thị card công văn, tap mở chi tiết hoặc trình đọc PDF to��n màn hình.

### Sprint M5: Organization Drill-Down & Actionable Notification Inbox
- **Tệp chỉnh sửa:**
  - `src/components/org/organization-tree.tsx`
  - `src/components/notifications/notification-center.tsx`
- **Nội dung:**
  - Org trên mobile: Drill-down theo danh mục cấp bậc (BGH → Phòng ban → Khoa → Cán bộ) thay vì vẽ sơ đồ cây ngang cồng kềnh.
  - Notifications trên mobile: Nhấn vào thông báo deep-link thẳng đến `/tasks?taskId=...` hoặc `/documents?docId=...`.

### Sprint M6: PWA & Onboarding Interruption Sequence
- **Tệp chỉnh sửa:**
  - `src/components/layout/app-shell.tsx`
  - `src/hooks/use-onboarding.ts`
- **Nội dung:**
  - Giới hạn tối đa 1 hộp thoại can thiệp chủ động mỗi phiên (session). Không chồng chéo Welcome → Tour → Install PWA → Push Notification.

### Sprint M7: Verification & Mobile Accessibility Quality Gate
- **Nội dung:**
  - Chạy toàn bộ test suites (`npm run typecheck`, `npm test`).
  - Đảm bảo 100% test mobile passed.
  - Kiểm tra giao diện ở các kích thước 320px, 360px, 375px, 390px, 412px, 430px.

---

## 3. Tiêu Chuẩn Hoàn Thành (Definition of Done)
1. **Double Padding:** Không còn hiện tượng cộng dồn padding đáy; màn hình mobile không có khoảng trắng >80px dưới cùng.
2. **Navigation:** Thanh điều hướng đáy 4 tab chuẩn mực `[Tổng quan | Nhiệm vụ | Văn bản | Lịch]`, không nút `+` giữa, không nút `Thêm`.
3. **Topbar:** Bell thông báo và Profile Drawer hoạt động hoàn hảo trên mobile.
4. **Task UX:** Trên mobile, từ `/tasks` người dùng chạm tối đa 2 lần để tới màn hình xử lý task.
5. **Quality Gates:** `npm run typecheck` đạt 0 lỗi; toàn bộ test suites mobile đạt pass 100%.
