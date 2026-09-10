# BÁO CÁO NGHIÊN CỨU & ĐỀ XUẤT NÂNG CẤP UI/UX TYPOGRAPHY
## DỰ ÁN: HỆ THỐNG VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
**Đơn vị áp dụng:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Thời gian lập:** Tháng 09/2026  
**Chủ đề:** Tối ưu hóa kích thước phông chữ, khả năng hiển thị tiếng Việt và công thái học giao diện (Ergonomics)

---

## 1. TỔNG QUAN HIỆN TRẠNG & NGUYÊN NHÂN CỐT LÕI

### 1.1. Hiện trạng thị giác (Visual Pain Points)
Giao diện hiện tại của hệ thống QCET E-Office nhận phản hồi "chữ quá nhỏ, khó đọc, gây mỏi mắt sau thời gian ngắn sử dụng". Qua kiểm tra toàn bộ mã nguồn frontend, hệ thống ghi nhận **1.063 vị trí** sử dụng các lớp kích thước chữ siêu nhỏ (`text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-xs`).

### 1.2. Phân tích nguyên nhân kỹ thuật (Technical Root Causes)

1. **Lạm dụng Micro-typography (Chữ tí hon):**
   - Các bảng dữ liệu chính (`CascadingTaskTable`, `DocumentRegistryView`), thanh điều hướng (`AppSidebar`), bộ lọc, nút bấm và badge đếm số bị ép về kích thước 9px – 11px.
   - Thẻ `<table>` chính bao bọc bởi class `text-xs` (12px), khiến các phần tử con tiếp tục thu nhỏ xuống mức không thể đọc tự nhiên ở khoảng cách làm việc thông thường (50 – 70 cm).

2. **Xung đột giữa Font hình học (Plus Jakarta Sans) và Dấu tiếng Việt:**
   - Font `Plus Jakarta Sans` là font dạng Geometric Sans hiện đại, tối ưu cho tiếng Anh và các tiêu đề lớn.
   - Khi hiển thị tiếng Việt ở kích thước dưới 13px, khoảng cách giữa dấu thanh điệu (hỏi, ngã, sắc, huyền, nặng) và dấu nguyên âm (mũ ă, â, ê, ô, ơ, ư) bị dính cụm (diacritic collision), khiến mắt người dùng phải căng ra để phân biệt từ ngữ.

3. **Suy giảm độ tương phản (Contrast Decay):**
   - Các nhãn thông tin phụ sử dụng màu `muted-foreground` (`oklch(0.48 0.015 250)` ở Light mode) trên nền xám kính mờ (`glass-panel`).
   - Kết hợp cỡ chữ 10px với tỷ lệ tương phản ~3.1:1 đã vi phạm ngưỡng tối thiểu 4.5:1 của chuẩn quốc tế WCAG 2.1 AA.

4. **Lệch pha đối tượng sử dụng (Target Persona Mismatch):**
   - Giao diện đang học hỏi mật độ siêu đặc (ultra-dense) từ Linear / Plane.so vốn phục vụ kỹ sư phần mềm.
   - Đối tượng sử dụng thực tế của QCET bao gồm **Ban Giám hiệu, Trưởng phòng/khoa và Giảng viên** — nhóm người dùng cần sự rõ ràng, kích thước chữ đạt chuẩn thể thức văn bản, khoảng thở trực quan và các vùng bấm chạm đủ lớn.

---

## 2. KẾT QUẢ NGHIÊN CỨU TỪ CÁC HỆ THỐNG THIẾT KẾ & TIÊU CHUẨN

### 2.1. Nghiên cứu font chữ tiếng Việt (Vietnamese Typography)
- **Be Vietnam Pro:** Do nhóm nhà thiết kế Việt Nam (Lâm Bảo, Tony Lê, Nguyễn Việt Anh) phát triển và được Google Fonts chuẩn hóa.
- **Đặc tính nổi trội:** Sở hữu bộ ký tự *diacritics adaptive forms* — dấu thanh điệu được mở rộng góc đặt và giữ khoảng cách thông thoáng với thân chữ, đảm bảo dấu tiếng Việt không bị bết dính hay biến dạng dù hiển thị ở kích cỡ 12px – 14px.

### 2.2. Tiêu chuẩn phần mềm doanh nghiệp quốc tế
- **Ant Design (Alibaba Enterprise Design System):** 
  - Nâng kích thước chữ cơ sở (`baseFontSize`) từ 12px lên **14px** (line-height 22px) dựa trên nghiên cứu khoảng cách góc nhìn màn hình 50cm.
  - Quy định kích thước chữ sàn (`fontSizeSM`) là **12px** và chỉ dùng cho chú thích phụ.
- **IBM Carbon Design System:**
  - Bảng dữ liệu (`Data Table`) chuẩn hóa nội dung ô là **14px / 0.875rem** (`$body-short-01`), tiêu đề cột 14px SemiBold.
  - Chiều cao hàng phân bổ rõ ràng: Short (32px), Default (48px), Tall (64px). Tuyệt đối không dùng chữ 10–11px cho bảng biểu.

### 2.3. Quy định thể thức văn bản hành chính (Nghị định 30/2020/NĐ-CP)
- Cỡ chữ chuẩn trong văn bản hành chính nhà nước quy định từ **13pt đến 14pt**, giãn dòng đơn đến 1.5 lines.
- Cán bộ, lãnh đạo và giảng viên trong môi trường giáo dục đã quen với tỷ lệ đọc này. Việc đưa giao diện số về kích thước tương đồng (13.5px – 14px) giúp người dùng tiếp cận tự nhiên, không gặp rào cản tâm lý.

---

## 3. BẢNG ĐỐI CHIẾU QUY CHUẨN THIẾT KẾ MỚI

| Thành phần | Hiện trạng (Gây mỏi mắt) | Quy chuẩn mới (Ergonomic) | Ý nghĩa cải thiện |
| :--- | :--- | :--- | :--- |
| **Font chữ Body** | `Plus Jakarta Sans` | **`Be Vietnam Pro`** | Tách bạch dấu thanh tiếng Việt |
| **Nội dung Bảng (Table Rows)** | 10px – 12px (`text-xs`) | **14px (`text-sm`)** font-medium | Đọc lướt nhanh nội dung văn bản & công việc |
| **Mã công việc / Số công văn** | 10px – 11px | **12.5px – 13px tabular-nums** | Dễ đối soát mã hồ sơ, số hiệu văn bản |
| **Tiêu đề cột (Table Headers)** | 11px, `py-2.5` chật | **12.5px font-semibold uppercase**, `py-3.5` | Phân cấp thông tin rõ ràng |
| **Chiều cao Hàng (Row Height)** | 34px – 38px | **44px – 48px** | Chuột di chuyển và bấm chọn thoải mái |
| **Nút bấm (Buttons)** | `h-7.5` – `h-8.5` (30–34px) | **`h-9.5` – `h-10` (38–40px)** | Font 14px, icon 16px, chống click nhầm |
| **Ô nhập liệu / Dropdown** | `h-8.5` (34px), font 11px | **`h-10` (40px)**, font 14px | Chống tự động zoom trên thiết bị di động |
| **Menu Sidebar** | 12px, badge 10.5px | **14px**, badge 12px font-bold | Điều hướng nhẹ nhàng, dễ nhận diện mục chọn |
| **Cỡ chữ sàn (Floor Limit)** | 8px, 9px, 10px | **Chặn sàn: Tối thiểu 12px** | Triệt tiêu hoàn toàn chữ siêu nhỏ |

---

## 4. KẾ HOẠCH TRIỂN KHAI CHI TIẾT

### Giai đoạn 1: Thiết lập nền tảng Typography & Biến Theme
1. **Cấu hình Font chữ (`src/app/layout.tsx`):**
   - Bổ sung `Be_Vietnam_Pro` từ `next/font/google` với subsets `latin`, `vietnamese`.
   - Gán biến `--font-sans` cho `Be Vietnam Pro`, giữ `Plus Jakarta Sans` cho `--font-heading`.
2. **Cấu hình CSS Tokens (`src/app/globals.css`):**
   - Định nghĩa lại lớp kích thước cơ bản: body font scale mặc định 14px – 15px.
   - Nâng độ đậm màu cho `--muted-foreground` để tăng độ tương phản lên chuẩn WCAG AA (> 4.5:1).

### Giai đoạn 2: Chuẩn hóa Bộ Component Cơ Sở (`src/components/ui/`)
1. **`button.tsx`:** Nâng kích thước `size="default"` lên `h-10 px-4 text-sm`, `size="sm"` lên `h-8.5 px-3 text-xs font-semibold`.
2. **`badge.tsx`:** Điều chỉnh padding dọc, cỡ chữ tối thiểu 11.5px – 12px font-semibold.
3. **Input / Select / Search Bars:** Chuẩn hóa chiều cao 40px, cỡ chữ 14px, icon 16px.

### Giai đoạn 3: Đại tu các Phân hệ Trọng tâm
1. **Bảng phân cấp nhiệm vụ (`cascading-task-table.tsx`):**
   - Chuyển `table` từ `text-xs` sang `text-sm`.
   - Nâng tiêu đề nhiệm vụ lên 14px font-medium, màu text-foreground rõ nét.
   - Mã nhiệm vụ dùng `font-mono text-xs tabular-nums text-muted-foreground`.
   - Tăng padding `py-3.5` cho toàn bộ các hàng.
2. **Sổ văn bản Đến/Đi (`document-registry-view.tsx`):**
   - Trích yếu văn bản hiển thị 14px font-medium.
   - Số/Ký hiệu công văn hiển thị 13px font-mono.
3. **Thanh điều hướng Sidebar (`app-sidebar.tsx`) & Topbar (`app-topbar.tsx`):**
   - Nâng font menu items lên 13.5px – 14px, icon kích thước 18px.
   - Tăng padding giữa các mục để tạo khoảng nghỉ thị giác.

### Giai đoạn 4: Tùy chọn Mật độ Hiển thị (Display Density Toggle - Tùy chọn)
- Bổ sung công cụ chuyển đổi nhanh trên thanh công cụ:
  - **Mặc định (Dễ nhìn - Comfortable):** Hàng cao 48px, font 14px (khuyên dùng cho BGH và Giảng viên).
  - **Thu gọn (Compact):** Hàng cao 38px, font 13px (phục vụ bộ phận Văn thư xử lý khối lượng văn bản lớn).

---

## 5. TÀI LIỆU THAM KHẢO & NGUỒN NGHIÊN CỨU

1. **Be Vietnam Pro Typeface:** https://fonts.google.com/specimen/Be+Vietnam+Pro
2. **Ant Design Font & Data Table System:** https://ant.design/docs/spec/font/
3. **IBM Carbon Design System Data Table Sizing:** https://v10.carbondesignsystem.com/components/data-table/style/
4. **Nghị định số 30/2020/NĐ-CP về công tác văn thư:** https://vanban.vcci.com.vn/hm_content/uploads/van-ban/ND_30-2020-ND-CP_Phu_luc.pdf
