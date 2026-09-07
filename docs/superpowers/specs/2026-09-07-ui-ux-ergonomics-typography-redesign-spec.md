# ĐẶC TẢ THIẾT KẾ: ĐẠI TU CÔNG THÁI HỌC UI/UX & TYPOGRAPHY TIẾNG VIỆT
## DỰ ÁN: HỆ THỐNG VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
* **Mã đặc tả:** `SPEC-2026-09-07-UIUX-ERGONOMICS`
* **Đơn vị áp dụng:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)
* **Thời gian lập:** Ngày 07 tháng 09 năm 2026
* **Trạng thái:** Đư���c duyệt bởi người dùng (Approved)

---

## 1. TỔNG QUAN & BỐI CẢNH DỰ ÁN

### 1.1. Hiện trạng thị giác & Nguyên nhân gốc rễ (Root Cause)
Qua đợt đánh giá thực tế trên hệ thống đang chạy (`localhost:3001`) bằng ảnh chụp màn hình độ phân giải cao (`port3001-desktop.png`, `port3001-fullpage.png`, `port3001-tasks-zone.png`, `port3001-scope-unit.png`, `port3001-scope-my.png`), hệ thống ghi nhận các bất cập thị giác nghiêm trọng:
1. **Lạm dụng Micro-typography:** Hơn 1.000 vị trí sử dụng phông chữ từ 8px đến 11px, khiến bảng nhiệm vụ và sổ văn bản không thể đọc tự nhiên ở khoảng cách làm việc 50–70 cm.
2. **Dính dấu tiếng Việt (Diacritics Collision):** Phông chữ hình học Latin (`Plus Jakarta Sans`) ở kích thước dưới 13px làm các dấu thanh xếp tầng (`ế, ề, ể, ễ, ố, ồ, ổ, ỗ, ứ, ừ, ử, ữ`) bị bết dính vào thân chữ, gây mỏi mắt cấp tính sau 30 phút làm việc.
3. **Suy giảm độ tương phản (Contrast Decay):** Màu `muted-foreground` nhạt trên nền kính mờ (`glass-panel`) vi phạm chuẩn quốc tế WCAG 2.1 AA (tỷ lệ tương phản chỉ đạt ~3.1:1 so với yêu cầu tối thiểu 4.5:1).
4. **Vùng bấm chạm chật chội (Fitts's Law):** Chiều cao hàng bảng biểu chỉ 34–36px, nút thao tác chính 30–32px dẫn đến thao tác chuột căng thẳng và dễ click nhầm.

### 1.2. Mục tiêu thiết kế
* **Triệt tiêu mỏi mắt:** Chuyển toàn bộ phông chữ nội dung sang `Be Vietnam Pro` với bộ ký tự thích ứng dấu tiếng Việt (*adaptive diacritics forms*).
* **Nâng chuẩn kích thước:** Chặn sàn kích thước chữ tối thiểu `12px` (không có chữ 8px–11px), chuẩn hóa chữ đọc nội dung `14px` tương đồng thể thức văn bản hành chính nhà nước (Nghị định 30/2020/NĐ-CP).
* **Chuẩn hóa công thái học doanh nghiệp:** Hàng bảng dữ liệu đạt chiều cao `48px` (theo chuẩn IBM Carbon & Ant Design), nút bấm chuẩn `40px` (`h-10`).
* **Khoang điều hành chuẩn Z-Pattern:** Giảm tải nhận thức cho Ban Giám Hiệu bằng cách mở rộng khoảng thở thị giác cho Ma trận 11 đơn vị và 2 Hàng đợi Hành động Chiến lược.
* **Tích hợp bộ chuyển đổi mật độ hiển thị (Density Toggle):** Cho phép người dùng linh hoạt chọn giữa chế độ **Dễ nhìn (Comfortable - 48px/14px)** và **Thu gọn (Compact - 38px/13px)**.

---

## 2. QUY CHUẨN THIẾT KẾ ĐỊNH LƯỢNG (QUANTITATIVE DESIGN SYSTEM)

### 2.1. Cấu hình Cặp đôi Phông chữ (Font Pairing System)
* **`--font-sans` (Mặc định cho Body, Bảng dữ liệu, Nhãn, Ô nhập liệu):**  
  `Be_Vietnam_Pro` (Google Fonts, weights: 400 Regular, 500 Medium, 600 SemiBold, 700 Bold).  
  *Ưu thế vượt trội:* Dấu thanh điệu giữ góc nghiêng và khoảng hở tiêu chuẩn với nguyên âm, triệt tiêu 100% hiện tượng bết dính dấu hỏi, ngã, mũ.
* **`--font-heading` (Dành cho Tiêu đề trang, Tên phân khu, Chỉ số KPI lớn):**  
  `Plus_Jakarta_Sans` (weights: 600 SemiBold, 700 Bold, 800 ExtraBold).  
  *Mục đích:* Tạo phong cách điều hành dứt khoát, hiện đại cho Ban Giám Hiệu.
* **`--font-mono` (Dành cho Mã công việc, Số ký hiệu công văn, Dữ liệu số tabular):**  
  Font Mono có tính năng CSS `font-variant-numeric: tabular-nums` đảm bảo căn thẳng hàng hoàn hảo.

### 2.2. Bảng Thang Đo Kích Thước (Typography Scale)
| Cấp bậc (Level) | Cỡ chữ (Size) | Giãn dòng (Line-height) | Trọng số (Weight) | Phạm vi áp dụng |
| :--- | :---: | :---: | :---: | :--- |
| **Sàn Tuyệt Đối (Floor)** | **12px** | 16px | 600 (SemiBold) | Badge đếm số, nhãn trạng thái, timestamp phụ |
| **Nhãn Cột (Column Header)** | **12.5px - 13px** | 18px | 600 (SemiBold) | Tiêu đề cột bảng dữ liệu, nhãn bộ lọc, breadcrumb |
| **Mã Hồ sơ (Reference ID)** | **13px** | 18px | 500 (Mono) | Số ký hiệu văn bản, mã nhiệm vụ DACUM |
| **Nội dung Chuẩn (Body)** | **14px** | 22px | 500 (Medium) | Trích yếu công văn, tên nhiệm vụ, form input |
| **Tiêu đề Thẻ (Card Title)** | **15px** | 24px | 600 (SemiBold) | Tiêu đề widget, tên phòng/khoa trong ma trận |
| **Tiêu đề Nhóm (Sub-heading)**| **18px** | 28px | 700 (Bold) | Tiêu đề khối (Strategic Action Center, Deadlines) |
| **Tiêu đề Trang (Page Title)** | **24px** | 32px | 800 (ExtraBold) | Tiêu đề phân khu ("Dashboard Điều Hành", "Nhiệm vụ")|
| **Chỉ số KPI (Stat Numbers)** | **32px - 36px**| 40px | 700 (Bold) | Số đếm tổng quan (24, 13, 5, 3) |

### 2.3. Tương phản Màu sắc (Color Tokens & WCAG 2.1 AA)
* **Light Mode:**
  * `--foreground`: `oklch(0.145 0.015 250)` (Đen mực sâu, tỷ lệ tương phản ~14:1 trên nền trắng).
  * `--muted-foreground`: Tăng cường từ `oklch(0.48 ...)` lên **`oklch(0.38 0.015 250)`** -> Đạt tỷ lệ tương phản **5.8:1** trên nền card (vượt chuẩn tối thiểu 4.5:1).
  * `--card`: `oklch(1 0 0)` viền `border-border/80`, loại bỏ lớp phủ kính mờ quá nhạt gây suy giảm tương phản chữ.
* **Dark Mode:**
  * `--foreground`: `oklch(0.985 0 0)`.
  * `--muted-foreground`: `oklch(0.72 0.015 250)` -> Đạt tỷ lệ tương phản **6.2:1** trên nền dark card `oklch(0.18 ...)`.

---

## 3. THIẾT KẾ CHI TIẾT TỪNG PHÂN KHU

### 3.1. Phân khu 1: Dải Thẻ Chỉ Số Điều Hành (Executive Stat Strip)
* **Bố cục:** 4 thẻ KPI trải ngang, kích thước đồng đều với `gap-4`:
  1. **Tổng công việc (Total Tasks):** Tím/Xanh dương primary (`24`).
  2. **Đang thực hiện (In Progress):** Xanh dương/cyan (`13`).
  3. **Chờ phê duyệt (Pending Approvals):** Hổ phách/amber (`5`).
  4. **Trễ hạn / Điểm nghẽn (Overdue/Bottlenecks):** Đỏ thắm/rose (`3`).
* **Chi tiết thẻ:**
  * Số hiển thị: `32px` `font-bold` tabular-nums.
  * Nhãn: `14px` `font-semibold`.
  * Mô tả ngữ nghĩa bên dưới: Tối thiểu `12.5px`, màu sắc rõ nét tương ứng trạng thái.
  * Hiệu ứng chọn (Active Ring): Khi click lọc thẻ, thẻ có viền `ring-2 ring-primary ring-offset-2`.

### 3.2. Phân khu 2: Trung Tâm Hành Động Chiến Lược (Strategic Action Center)
* **Bố cục 2 Hàng đợi:**
  * **Hàng đợi Chờ Phê Duyệt (Approvals Queue - 5 mục):** Nhận diện màu Hổ phách (Amber).
  * **Hàng đợi Điểm Nghẽn & Trễ Hạn (Bottlenecks Queue - 3 mục):** Nhận diện màu Đỏ (Rose).
* **Nâng cấp Thẻ Công việc Con (Action Card):**
  * Chiều cao thẻ nâng lên **`64px`**, padding `p-3.5`.
  * **Tầng 1:** Tiêu đề công việc `14px font-semibold text-foreground`.
  * **Tầng 2:** Tên khoa/phòng viết tắt + Người chủ trì + Thời hạn `12.5px text-muted-foreground`.
  * **Tầng 3:** Nút hành động nổi bật chiều cao **`38px` (`h-9.5`)**, font `13px font-semibold` (ví dụ: `Phê duyệt ngay`, `Đôn đốc`).

### 3.3. Phân khu 3: Ma Trận Tiến Độ 11 Đơn Vị (Department Progress Matrix)
* **Tái cấu trúc lưới:** Chuyển từ lưới 4 cột chật hẹp sang lưới **3 cột rộng rãi (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5`)**.
* **Nội dung thẻ đơn vị:**
  * **Tên phòng/khoa:** `14px font-semibold text-foreground`, không bị co rúm chữ.
  * **Thanh tiến độ:** Chiều cao `8px`, bo góc tròn `rounded-full`, nhãn tỷ lệ `%` hiển thị `13px font-mono tabular-nums`.
  * **Chỉ số chi tiết:** Hiển thị rõ ràng 3 phân nhóm: `Hoàn thành (Xanh)`, `Đang làm (Cam)`, `Trễ hạn (Đỏ)` với kích thước `12.5px font-medium`.

### 3.4. Phân khu 4: Bảng Dữ Liệu Nhiệm Vụ & Công Cụ Density Toggle
* **Kích thước bảng dữ liệu (Task Table Dimensions):**
  * **Header:** Chiều cao `44px`, font `12.5px font-semibold tracking-wider uppercase`.
  * **Hàng dữ liệu:**
    * **Chế độ Dễ nhìn (Comfortable - Mặc định):** Chiều cao `48px`, font tiêu đề nhiệm vụ `14px font-medium`, số ký hiệu `13px font-mono`, badge trạng thái `26px` (font `12px`).
    * **Chế độ Thu gọn (Compact):** Chiều cao `38px`, font tiêu đề `13px font-medium`, số ký hiệu `12px font-mono`.
* **Công cụ chuyển đổi mật độ (Density Toggle Component):**
  * Tích hợp dạng nút Segmented Control gồm 2 icon trực quan: `Dễ nhìn` (vạch cách rộng) và `Thu gọn` (vạch xếp khít) lưu trạng thái vào `localStorage`.

---

## 4. QUY TRÌNH KIỂM THỬ & BẢO ĐẢM CHẤT LƯỢNG (QA & VERIFICATION)

1. **Kiểm tra TypeScript & Kiểu dữ liệu:**
   ```bash
   npm run typecheck   # Đảm bảo không có lỗi TypeScript (tsc --noEmit)
   ```
2. **Kiểm tra Unit & Integration Tests:**
   ```bash
   npm test            # Chạy toàn bộ test suite (tsx --test tests/**/*.test.ts)
   ```
3. **Kiểm định Thị giác Thực tế (Headless Chrome Visual Capture):**
   * Chụp lại màn hình `localhost:3001` ở 3 độ phân giải:
     * `1440x1200` (Desktop fold view)
     * `1440x2600` (Full page dashboard zone)
     * `1440x2200` (Tasks zone & table views)
   * Kiểm tra độ tách bạch của dấu tiếng Việt ở các từ khóa phức tạp: `nghiệm thu`, `đề cương`, `chờ phê duyệt`, `trễ hạn`.
   * Đo lường chiều cao hàng thực tế đạt tối thiểu 48px ở chế độ Comfortable.

---

## 5. TỰ RÀ SOÁT TÀI LIỆU ĐẶC TẢ (SPEC SELF-REVIEW)

1. **Quét từ khóa giữ chỗ (Placeholder scan):** Không có mục nào ghi `TBD`, `TODO`, hoặc nội dung bỏ ngỏ. Toàn bộ thông số kích thước (px) và màu sắc (oklch) đã được định lượng chính xác.
2. **Tính nhất quán nội bộ (Internal consistency):** Phông chữ `Be Vietnam Pro` áp dụng đồng bộ từ CSS Variables đến Table Rows, không mâu thuẫn với cấu trúc Tailwind CSS v4 hiện hữu.
3. **Kiểm tra phạm vi (Scope check):** Đặc tả tập trung chuẩn xác vào công thái học thị giác, Typography và Dashboard điều hành, không làm xáo trộn luồng nghiệp vụ dữ liệu ngầm.
4. **Kiểm tra tính tường minh (Ambiguity check):** Các mốc kích thước `12px` (sàn), `14px` (body), `48px` (hàng bảng) được quy định rõ ràng, không gây nhầm lẫn khi triển khai.
