# Đặc Tả Kỹ Thuật: Loại Bỏ Hoàn Toàn Dark Theme - Chuẩn Hóa QCET E-Office Light-Only

## 1. Bối Cảnh & Mục Tiêu
- **Mục tiêu:** Loại bỏ hoàn toàn cơ chế Dark Theme (giao diện tối) và chuyển đổi toàn diện hệ thống QCET E-Office sang giao diện Sáng (Light-Only) thuần túy.
- **Lý do & Giá trị:**
  - **Nhất quán thương hiệu & Nghiệp vụ giáo dục:** QCET E-Office là cổng điều hành hành chính - giáo dục đại học, đòi hỏi sự chỉn chu, tương phản cao, trang nhã và rõ ràng trên các tài liệu, biểu mẫu, quy trình công việc.
  - **Tối ưu hiệu năng:** Loại bỏ `ThemeProvider` client-side context, giảm bundle size, loại bỏ nguy cơ Flash of Unstyled Content (FOUC) hoặc Hydration Mismatch liên quan đến theme `localStorage`.
  - **Đơn giản hóa mã nguồn:** Loại bỏ hơn 600 tiền tố `dark:*` dư thừa trong JSX, xóa bỏ hoàn toàn các khối CSS `.dark` ghi đè token trong `globals.css`.

---

## 2. Kiến Trúc Thay Đổi (System Architecture)

### 2.1. Cấu hình Tailwind v4 & CSS Variables (`src/app/globals.css`)
- **Vô hiệu hóa biến thể `dark:`:**
  - Thiết lập `@custom-variant dark (&:not(*));` để ngăn hoàn toàn việc Tailwind v4 tự động fallback về `@media (prefers-color-scheme: dark)`. Bất kỳ class `dark:` nào còn sót lại cũng sẽ không bao giờ được kích hoạt.
- **Dọn sạch CSS Tokens:**
  - Giữ nguyên `:root` với hệ màu OKLCH dành cho nền sáng hành chính:
    - Nền chính `--background: oklch(0.985 0.003 250);`
    - Thẻ card `--card: oklch(1 0 0);`
    - Màu chủ đạo `--primary: oklch(0.42 0.18 250);` (Sapphire Blue)
    - Viền `--border: oklch(0.915 0.006 250);`
    - Chữ `--foreground: oklch(0.145 0.015 250);`
  - Xóa sạch block `.dark { ... }` (dòng 96-135).
  - Xóa các rule dark chuyên biệt: `.dark body::before`, `.dark .glass-panel`, `.dark .glass-card`.

### 2.2. Root Layout & Viewport Metadata (`src/app/layout.tsx`)
- **Tháo gỡ ThemeProvider:**
  - Xóa import `ThemeProvider` từ `@/components/theme-provider`.
  - Xóa thẻ bọc `<ThemeProvider>` bao quanh `<AppShell>`.
- **Cập nhật Viewport:**
  - Cập nhật `colorScheme: "light"` (thay vì `"light dark"`).
  - Cập nhật `themeColor: "#fbfbfb"` dạng chuỗi đơn (hoặc màu thương hiệu), loại bỏ mảng media query `prefers-color-scheme: dark`.

### 2.3. Xóa bỏ Theme Provider & Clean Controls
- **Xóa file:** `src/components/theme-provider.tsx` (xóa hoàn toàn).
- **Loại bỏ nút chuyển Theme (Sun/Moon Toggle):**
  - `src/components/layout/app-topbar.tsx`: Xóa nút chuyển theme và hook `useTheme()`.
  - `src/components/layout/mobile-menu-drawer.tsx`: Xóa toggle Dark/Light và logic `localStorage.setItem("theme", ...)`.
  - `src/components/navigation.tsx`: Xóa nút bấm chuyển theme và hook `useTheme()`.
  - `src/app/portal/page.tsx`: Xóa nút bấm chuyển theme và hook `useTheme()`.

### 2.4. Design Tokens (`src/lib/tokens.ts`)
- Dọn dẹp `QCET_TOKENS.colors.dark` và `DESIGN_TOKENS.dark` (chuyển sang ánh xạ về light hoặc chuẩn hóa light-only).
- Cập nhật `QCET_TOKENS.statusColors` (xóa bỏ các class `dark:text-...`).

### 2.5. Quét dọn toàn bộ các class `dark:*` trong 59 UI Components
- Dọn sạch các class `dark:...` khỏi toàn bộ các component:
  - `src/components/dashboard/task-detail-side-sheet.tsx`
  - `src/components/documents/document-quick-entry-modal.tsx`
  - `src/components/portal/executive-cockpit-workspace.tsx`
  - `src/components/portal/lecturer-focus-workspace.tsx`
  - `src/components/documents/directive-action-panel.tsx`
  - `src/components/tasks/executive-department-command-center.tsx`
  - `src/components/dashboard/roles/staff-focus-view.tsx`
  - `src/components/dashboard/cascading-task-table.tsx`
  - `src/components/tasks/cascading-task-table.tsx`
  - `src/components/portal/department-manager-workspace.tsx`
  - `src/components/notifications/notification-popover.tsx`
  - `src/app/notifications/page.tsx`
  - Và các component còn lại trong danh sách 59 files đã kiểm kê.

---

## 3. Ràng Buộc Kiểm Thử & Verification (Test Contract Updates)
1. `tests/smoke-qcet-design-system.test.ts`:
   - Cập nhật test token: xác nhận hệ thống hoạt động theo chuẩn Light-Only OKLCH.
   - Cập nhật assertions của status colors không còn chuỗi `dark:text-...`.
   - Xác nhận `globals.css` không còn chứa CSS variable dark mode.
2. `tests/mobile-viewport-e2e.test.ts`:
   - Cập nhật test `Viewport themeColor` để kiểm tra `colorScheme === "light"` và `themeColor` chuẩn định dạng Light.
3. `tests/typography-tokens-contract.test.ts`:
   - Bỏ kiểm tra `--muted-foreground` trong block `.dark` (hoặc kiểm tra hợp đồng không còn `.dark`).
4. `tests/app-layout.test.ts`:
   - Cập nhật test assertions của Topbar: xác nhận theme toggle đã được gỡ bỏ và thanh công cụ tập trung vào: Quick Create Task, Notification Bell, Mobile App Install, User Profile & Role Switcher.
5. `tests/task-ownership-model.test.ts`:
   - Cập nhật chuỗi HTML mẫu tại dòng 544 không còn `dark:border-primary/30`.

---

## 4. Kế Hoạch Triển Khai (Execution Checklist)
- [ ] Task 1: Cấu hình `src/app/globals.css` (neutralize `@custom-variant dark`, xóa `.dark` rules).
- [ ] Task 2: Cập nhật `src/app/layout.tsx` (gỡ `ThemeProvider`, cập nhật viewport `light`).
- [ ] Task 3: Xóa file `src/components/theme-provider.tsx`.
- [ ] Task 4: Gỡ bỏ Theme Toggle tại `app-topbar.tsx`, `navigation.tsx`, `mobile-menu-drawer.tsx`, `portal/page.tsx`.
- [ ] Task 5: Cập nhật `src/lib/tokens.ts` (chuẩn hóa Light-only).
- [ ] Task 6: Quét sạch toàn bộ class `dark:*` trong 59 UI files.
- [ ] Task 7: Cập nhật 5 test suites tương ứng (`smoke-qcet-design-system`, `mobile-viewport-e2e`, `typography-tokens-contract`, `app-layout`, `task-ownership-model`).
- [ ] Task 8: Chạy `npm run typecheck` và `npm test` để xác nhận toàn bộ test passed (100% green).
