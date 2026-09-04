# DESIGN SPECIFICATION: QCET WORK UI/UX SYNCHRONIZATION
**Dự án:** QCET Work (Cổng Quản trị & Điều hành Văn phòng Điện tử)  
**Mục tiêu:** Xóa bỏ giao diện cũ, đồng bộ 100% Design System & Visual Shell theo chuẩn `dashboard-chamcong` (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn)  
**Ngày lập:** 2026-09-04  
**Trạng thái:** Chờ phê duyệt (Pending Review)

---

## 1. Tổng Quan & Triết Lý Thiết Kế (Overview & Philosophy)

Hệ thống **QCET Work** là Cổng Quản trị & Điều hành Văn phòng Điện tử (E-Office) phục vụ Ban Giám hiệu (BGH), Trưởng các Đơn vị (Khoa, Phòng, Trung tâm), Chuyên viên và Nhân viên.

Thiết kế mới loại bỏ hoàn toàn phong cách đơn sắc tối giản cũ, đồng bộ hóa triệt để với ngôn ngữ thiết kế điều hành của dự án `dashboard-chamcong`:
- **Executive & Information-First:** Nắm bắt toàn bộ tình hình công việc trường, nhiệm vụ đơn vị, chỉ số quá hạn và tiến độ trong vòng 3 giây.
- **Visual Scannability:** Phân tầng trực quan thông qua nhận diện màu sắc trạng thái đồng bộ, nhãn chỉ số to đậm, phông chữ số liệu đều cột (`tabular-nums`).
- **Glassmorphism & Depth:** Hiệu ứng nền đa tầng `radial-gradient` cố định, lớp mờ kính `backdrop-blur-xl`, viền mảnh sắc nét `border-border/50` và hệ thống bóng đổ cao cấp (`shadow-card`, `shadow-premium`, `shadow-glow-primary`).
- **Adaptive Responsive:** Hỗ trợ hoàn hảo từ máy tính để bàn độ phân giải lớn (tối đa `max-w-[1440px]`), máy tính bảng, đến điện thoại thông minh (thanh điều hướng đáy `MobileNav`).

---

## 2. Hệ Thống Màu Sắc & Tokens (Color System & Tokens)

Hệ thống áp dụng không gian màu **OKLCH** tương thích với Tailwind CSS v4, tối ưu hóa cho cả **Light Mode** và **Dark Mode**.

### 2.1. Bảng Màu Cơ Bản (`globals.css`)

| Token | Light Mode (OKLCH) | Dark Mode (OKLCH) | Mục đích sử dụng |
| :--- | :--- | :--- | :--- |
| `background` | `oklch(0.985 0.003 250)` | `oklch(0.12 0.018 250)` | Nền trang tổng thể |
| `card` | `oklch(1 0 0)` | `oklch(0.16 0.018 250)` | Nền thẻ Bento, thống kê, bảng biểu |
| `foreground` | `oklch(0.145 0.015 250)` | `oklch(0.98 0.003 250)` | Chữ hiển thị chính |
| `muted` | `oklch(0.965 0.005 250)` | `oklch(0.20 0.015 250)` | Nền khối phụ, thanh bộ lọc, hover |
| `muted-foreground` | `oklch(0.48 0.015 250)` | `oklch(0.65 0.015 250)` | Chữ phụ, nhãn chỉ số |
| `border` | `oklch(0.915 0.006 250)` | `oklch(0.24 0.015 250)` | Viền thẻ, đường phân cách |
| `primary` | `oklch(0.42 0.18 250)` | `oklch(0.70 0.18 250)` | Sapphire Blue thương hiệu QCET |

### 2.2. Màu Nhận Diện Trạng Thái Công Việc (Task Status Palette)

| Trạng Thái Task | Màu Chủ Đạo | Classes Tailwind CSS | Ý Nghĩa Thể Hiện |
| :--- | :--- | :--- | :--- |
| **Đang thực hiện** (`IN_PROGRESS`) | Sapphire Blue | `bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20` | Đang trong tiến trình triển khai |
| **Đã hoàn thành** (`COMPLETED`) | Emerald Green | `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20` | Hoàn thành đúng hạn / đạt yêu cầu |
| **Cảnh báo Quá hạn** (`OVERDUE`) | Crimson Rose | `bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20` | Nhiệm vụ đã quá hạn xử lý (High Priority) |
| **Cần duyệt / Chỉnh sửa** (`NEEDS_REVIEW`)| Warm Amber | `bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20` | Chờ BGH hoặc Trưởng đơn vị duyệt lại |
| **Mới tiếp nhận** (`NEW`) | Purple Violet | `bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20` | Nhiệm vụ mới giao, chưa kích hoạt làm |

---

## 3. Kiểu Chữ & Tài Nguyên (Typography & Assets)

### 3.1. Phông Chữ Hiển Thị (`layout.tsx`)
- Font chính: **Plus Jakarta Sans** (Google Fonts nạp qua `next/font/google`), subsets `["latin", "vietnamese"]`.
- Font phụ trợ: **JetBrains Mono** (`--font-mono`) cho mã định danh nhiệm vụ, đồng hồ số và chỉ số đếm.
- Class `.tabular-nums`: Bắt buộc trên mọi số liệu phần trăm, số lượng và ngày giờ để chống giật chữ khi re-render.

### 3.2. Nhận Diện Thương Hiệu
- Sao chép tệp logo chuẩn: `/Users/dnhhuy/Projects/QCET/dashboard-chamcong/public/logo-qcet.png` vào thư mục `public/logo-qcet.png` của dự án `QCET Work`.

---

## 4. Kiến Trúc Điều Hướng & Shell (Executive Shell & Navigation)

### 4.1. Cấu Trúc Header (`DashboardHeader`)
- **Vị trí:** `sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-xs`.
- **Khối Thương Hiệu (Trái):**
  - Khối logo vuông bo cong `rounded-xl bg-card p-1 shadow-card border border-border/60`.
  - Tên trường: `TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHỆ QUY NHƠN`.
  - Tiêu đề hệ thống: `HỆ THỐNG QUẢN TRỊ & ĐIỀU HÀNH TẬP TRUNG (E-OFFICE)` kèm chấm xanh ping động.
- **Khối Công Cụ Điều Hành (Phải):**
  - **`LiveClock`**: Hiển thị giờ - phút - giây thời gian thực dạng `HH:mm:ss`.
  - **`ZoomToggle`**: Chuyển đổi cỡ chữ 100% ⇋ 120% (Chế độ đọc dễ dành cho Ban Giám hiệu).
  - **`RoleSwitcherPill`**: Cho phép chuyển đổi nhanh góc nhìn vai trò (BGH, Trưởng phòng, Chuyên viên, Nhân viên) với giao diện mờ kính sang trọng.
  - **Nút `Giao việc nhanh`**: Mở modal `CreateTaskModal`.
  - **`ThemeToggle`**: Chuyển đổi giao diện Sáng / Tối.
  - **User Avatar**: Thông tin nhân sự và lối tắt quản lý tài khoản.

### 4.2. Thanh Phân Hệ Điều Hướng (`SubNav / TabNav`)
- **Vị trí:** `sticky top-[60px] z-40 bg-background/70 backdrop-blur-xl border-b border-border/40`.
- **5 Phân Hệ:**
  1. Tổng quan (`/`)
  2. Nhiệm vụ cấp Trường (`/tasks`)
  3. Công việc Đơn vị (`/unit-tasks`)
  4. Lịch công tác (`/calendar`)
  5. Cơ cấu tổ chức (`/org`)
- **Giao diện di động (`MobileNav`):** Cố định chân màn hình `fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/90 backdrop-blur-lg border-t border-border/60`.

---

## 5. Chuẩn Hóa Bộ UI Components (`src/components/ui/`)

1. **`card.tsx`**: Đồng bộ Shadcn Base-Nova từ `dashboard-chamcong` với các biến khoảng cách `--card-spacing`, bo góc `rounded-xl`, đổ bóng `shadow-card`.
2. **`badge.tsx`**: Hỗ trợ đầy đủ biến thể màu trạng thái (`sapphire`, `emerald`, `amber`, `rose`, `violet`).
3. **`button.tsx`**: Cung cấp variant `default` (Sapphire Blue QCET), `secondary`, `outline`, `ghost`, `destructive`, `premium`.
4. **`drawer.tsx`**: Side-sheet trượt mượt mà từ lề phải dùng cho xem chi tiết nhiệm vụ và thao tác nhanh.
5. **`tabs.tsx`, `progress.tsx`, `select.tsx`, `table.tsx`**: Đồng bộ hoàn toàn mã nguồn từ `dashboard-chamcong`.

---

## 6. Tái Cấu Trúc Các Trang & Widget Nghiệp Vụ

1. **Trang Dashboard (`/`):**
   - Thay thế thẻ thống kê cũ bằng Bento `StatCards` chuẩn (Tổng task, Đang làm, Hoàn thành, Cảnh báo quá hạn có nhấp nháy đỏ).
   - Thiết kế lại `CascadingTaskTable` viền mảnh, thanh tiến độ ba màu.
   - Nâng cấp `UpcomingDeadlinesWidget` và `ActivityFeedWidget` theo chuẩn Bento Box.
2. **Trang Nhiệm Vụ Cấp Trường (`/tasks`) & Đơn Vị (`/unit-tasks`):**
   - Đồng bộ Kanban Board với cột màu chuẩn và kéo thả mượt mà.
   - Bổ sung `TaskDetailDrawer` xem chi tiết nhiệm vụ.
3. **Trang Lịch Công Tác (`/calendar`) & Cơ Cấu Tổ Chức (`/org`):**
   - Nâng cấp giao diện lưới lịch tháng, bảng sự kiện ngày.
   - Nâng cấp sơ đồ cây phòng ban và thẻ nhân sự.

---

## 7. Kế Hoạch Kiểm Thử & Xác Minh (Testing & Verification)

1. **Build & Typecheck:** Chạy `npm run typecheck` và `npm run build` đảm bảo không có lỗi biên dịch TypeScript.
2. **Kiểm tra hiển thị trực quan (Dev Preview):**
   - Kiểm tra hiển thị Light Mode và Dark Mode.
   - Kiểm tra chức năng `ZoomToggle` (100% ⇋ 120%).
   - Kiểm tra hiển thị Logo QCET và LiveClock.
   - Kiểm tra hoạt động của `RoleSwitcherPill` và điều hướng 5 phân hệ.
   - Kiểm tra giao diện trên cả Desktop (1440px) và Mobile (375px).
