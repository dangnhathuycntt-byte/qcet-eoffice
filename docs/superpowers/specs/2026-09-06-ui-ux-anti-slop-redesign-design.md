# Đặc tả Thiết kế: Nâng cấp Toàn diện UI/UX QCET E-Office (Executive Precision & Anti-AI-Slop)

**Mã dự án:** QCET-EOFFICE-REDESIGN-2026  
**Ngày lập:** 06/09/2026  
**Trạng thái:** Approved by User  
**Định hướng thị giác:** Linear-grade Executive Workstation (Anti-AI-Slop, Zero Emoji, Refined Lucide Icons, Precision Typography)

---

## 1. Mục tiêu & Triết lý Thiết kế

### 1.1 Mục tiêu Cốt lõi
Nâng cấp toàn bộ trải nghiệm giao diện người dùng (UI) và tương tác người dùng (UX) của hệ thống Quản lý công việc & Điều hành điện tử Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET E-Office) lên chuẩn mực chuyên nghiệp, cao cấp:
1. **Loại bỏ 100% các thành phần mang tính "AI Slop"**: Triệt tiêu toàn bộ emoji trang trí (`🚀`, `📌`, `⚡`, `🎯`, `🔥`, v.v.), loại bỏ các dải màu gradient tím/xanh ngọc rẻ tiền, hiệu ứng đổ bóng mờ đen xì hoặc glassmorphism đục ngầu.
2. **Chuẩn hóa Iconography với Lucide Refined**: Giữ lại thư viện `lucide-react` nhưng thiết lập kỷ luật nghiêm ngặt: kích thước chuẩn 14px–16px, `strokeWidth={1.5}` (hoặc `1.25` cho icon phụ), màu đơn sắc thanh lịch (`text-muted-foreground` hoặc `text-foreground/70`), chỉ dùng màu ngữ nghĩa cho trạng thái khẩn thiết.
3. **Typography & Mật độ thông tin chuẩn xác**: Ứng dụng `tracking-tight` cho tiêu đề, `tabular-nums` cho toàn bộ số liệu, deadline, tiến độ và mã công việc.
4. **Trải nghiệm thao tác 1-click mượt mà**: Tối ưu hóa các nút tác vụ (Duyệt việc, Đôn đốc, Phân công, Giao việc nhanh) với phản hồi xúc giác nhẹ (`active:scale-[0.98]`), hiển thị theo ngữ cảnh hover.

---

## 2. Hệ thống Design Tokens & Visual Language (`globals.css`)

### 2.1 Bảng màu & Bề mặt (Palette & Surfaces)
* **Nền chính (Background)**:
  - *Light mode*: `oklch(0.985 0.003 250)` — màu ngà ấm rất nhẹ, dịu mắt, sang trọng, tránh trắng bệch 100% làm mỏi mắt khi làm việc lâu.
  - *Dark mode*: `oklch(0.14 0.015 250)` hoặc `#0b0f17` (Deep Slate / Onyx), chiều sâu cao, tránh đen tuyền `#000000`.
* **Thẻ & Bề mặt nổi (Cards & Elevation)**:
  - Bề mặt Card: Thuần khiết, viền hairline sắc sảo `border-border/60` (hoặc `border-white/5` trong Dark mode).
  - Đổ bóng (Shadows): Thay thế shadow thô bằng hệ đổ bóng đa tầng khuếch tán:
    ```css
    --shadow-subtle: 0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 3px 1px rgba(0, 0, 0, 0.02);
    --shadow-card: 0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 4px 12px 0 rgba(0, 0, 0, 0.03);
    --shadow-dropdown: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 24px -3px rgba(0, 0, 0, 0.06);
    ```
* **Màu Trạng thái Ngữ nghĩa (Semantic State Colors - Muted & Restrained)**:
  - *Hoàn thành (Completed)*: Xanh lục ngọc dịu (Muted Emerald) `bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20`
  - *Đang làm (In Progress)*: Xanh công sở (Slate Blue) `bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20`
  - *Chờ duyệt / Cần xử lý (Pending / Review)*: Hổ phách trầm (Warm Amber) `bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20`
  - *Quá hạn / Khẩn cấp (Overdue / Urgent)*: Đỏ đất nung (Terracotta / Crimson Rose) `bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20`

### 2.2 Typography Quy chuẩn
* **Tiêu đề**: Font sans-serif hiện đại, trọng lượng `font-semibold` (600), độ giãn chữ `tracking-[-0.02em]`, không dùng all-caps tràn lan.
* **Số liệu & Mã định danh**: Bắt buộc gắn `font-mono tabular-nums tracking-normal` cho:
  - Mã công việc (`QC-NV-2026-01`, `QC-CV-42`)
  - Ngày tháng hạn chót (`15/09/2026`, `23:59`)
  - Tỷ lệ phần trăm hoàn thành (`100%`, `45%`)
  - Bộ đếm số lượng công việc trong các Workbox
* **Văn bản nội dung**: `text-sm`, `leading-relaxed`, độ dài dòng tối đa không quá 75 ký tự (`max-w-prose`) để đảm bảo khả năng đọc quét nhanh.

---

## 3. Chi tiết Nâng cấp theo từng Khu vực Chức năng

### 3.1 Thanh điều hướng & Header (`src/components/navigation.tsx`)
1. **Kiểu dáng Header**: Giảm chiều cao xuống `h-14` thanh mảnh, viền đáy mỏng `border-b border-border/50`, hỗ trợ hiệu ứng blur nhẹ chuẩn xác `backdrop-blur-md bg-background/85`.
2. **Brand Mark**: Biểu tượng QCET sắc nét kèm text `QCET E-Office`, nhãn phân hệ dạng micro-badge `v1.2 Enterprise` màu xám trung tính.
3. **Live Clock**: Thay khung đồng hồ thô bằng typography tinh tế: icon Lucide `Clock` nét mảnh (13px, `strokeWidth={1.5}`) kèm giờ hiển thị font mono `tabular-nums`.
4. **Menu Điều hướng**: Tab điều hướng phẳng, hiệu ứng gạch chân hoặc pill nhẹ nhàng (indicator line), không bóng bẩy quá đà.
5. **Role Switcher & Action**: Nút "Giao việc mới" thiết kế chuẩn Linear với icon `Plus` (`strokeWidth={1.5}`), phím tắt hiển thị tinh gọn.

### 3.2 Màn hình Trang chủ Quản lý công việc (`src/app/page.tsx` & Dashboard components)
1. **Hộp việc Ban Giám hiệu & Đơn vị (Executive Workboxes)**:
   - Thay đổi toàn bộ các card workbox: Loại bỏ emoji, thay bằng typography rõ ràng kèm icon danh mục chuẩn.
   - Thêm đường accent line tinh tế ở viền trên hoặc cạnh trái của workbox biểu thị mức độ ưu tiên.
   - Số đếm công việc to bản, sắc nét với font mono.
2. **Bảng công việc phân cấp (`CascadingTaskTable`)**:
   - Khung bảng có phân cấp hàng rõ rệt giữa Nhiệm vụ cấp Trường (hàng mẹ, font medium, có thanh tiến độ mini) và Công việc Đơn vị (hàng con thụt lề có đường nối tree-guide mảnh).
   - Nút thao tác nhanh (Quick Action Buttons): Nút bấm dạng micro-ghost chỉ hiện rõ khi rê chuột vào dòng (`group-hover:opacity-100 opacity-60 transition-opacity`), giảm tải rác thị giác khi quét bảng.
3. **Thanh thống kê điều hành (`ExecutiveStatStrip`)**:
   - Thiết kế dạng dải chỉ số tối giản (stat strip), hiển thị các KPI: *Tổng nhiệm vụ*, *Đúng hạn*, *Quá hạn*, *Chờ duyệt* với các con số sắc nét kèm sparkline/micro-bar progress.
4. **Side-sheet Chi tiết Công việc (`TaskDetailSideSheet`)**:
   - Làm lại header sạch sẽ, nút đóng rõ ràng, phân vùng thông tin logic (Tổng quan -> Nhân sự phối hợp -> Tiến độ -> Lịch sử cập nhật).

### 3.3 Màn hình Nhiệm vụ cấp Trường & Đơn vị (`/tasks`, `/unit-tasks`)
1. **Thanh công cụ lọc (Filter & View Toolbar)**:
   - Thiết kế dạng single toolbar tích hợp: Tìm kiếm tức thì, Lọc phòng ban (Department dropdown), Lọc trạng thái, và Bộ chuyển đổi góc nhìn (Table View vs. Kanban View).
2. **Bảng Kanban (`TaskKanbanBoard`)**:
   - Cột Kanban: Header tối giản không màu mè, hiển thị tên trạng thái kèm badge đếm số lượng hình tròn nhỏ `rounded-full px-2 py-0.5 text-xs font-mono`.
   - Thẻ Kanban (Card): Viền mỏng, padding 12px hợp lý, thanh tiến độ 2px ở chân thẻ, tag nhãn đơn vị rõ ràng, avatar nhân sự tinh tế.

### 3.4 Màn hình Lịch công tác (`/calendar` - `CalendarMonthView`)
1. Lưới lịch 7 cột với đường kẻ siêu mảnh `border-border/40`.
2. Ô ngày: Số ngày căn góc phải font mono, ngày hiện tại có vòng tròn indicator thanh lịch.
3. Thẻ sự kiện lịch: Loại bỏ các màu gradient gắt gỏng; sử dụng màu nền dịu kèm status dot 6px phía trước tiêu đề.

### 3.5 Màn hình Cơ cấu tổ chức & Cây nhân sự (`/org` - `OrganizationTree`)
1. Nhánh cây cơ cấu có đường nối (connectors) rõ nét, không bị gãy vỡ.
2. Thẻ phòng ban/khoa & Thẻ cán bộ: Hiển thị chức vụ, học hàm học vị chính xác, trang trọng.
3. Tích hợp nút ủy quyền / giao việc nhanh (1-click delegate) trực tiếp từ danh bạ nhân sự.

### 3.6 Trạng thái Rỗng & Phản hồi (Empty States & Micro-interactions)
1. **Empty States**: Không dùng hình minh họa hoạt hình AI lỏ. Dùng 1 icon Lucide thanh lịch (như `Inbox` hoặc `CheckCircle2` nét 1.5px), dòng thông điệp súc tích và 1 nút hành động hữu ích.
2. **Transitions**: Chuẩn hóa toàn bộ hiệu ứng chuyển đổi: `transition-all duration-150 ease-out`, phản hồi nút bấm `active:scale-[0.98]`.

---

## 4. Kế hoạch Kiểm thử & Tiêu chuẩn Nghiệm thu (Verification & Acceptance)

1. **Anti-Slop Audit Checklist**:
   - [ ] 0% emoji xuất hiện trong code và giao diện người dùng.
   - [ ] 100% icon Lucide được chuẩn hóa `strokeWidth={1.5}` hoặc `1.25` và kích thước nhất quán (14–16px).
   - [ ] 100% số liệu, deadline, mã định danh hiển thị font `tabular-nums`.
   - [ ] Không còn gradient tím/xanh AI hoặc bóng đen mờ đục.
2. **Kiểm thử Kỹ thuật**:
   - Chạy lệnh `npm run typecheck` đảm bảo không phát sinh lỗi TypeScript.
   - Chạy `npm run build` đảm bảo ứng dụng biên dịch thành công 100%.
   - Chạy preview kiểm tra độ mượt mà, phản hồi trên màn hình Desktop và Tablet.
