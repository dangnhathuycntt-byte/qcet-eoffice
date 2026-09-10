# BÁO CÁO TỔNG QUAN KIỂM TOÁN THIẾT KẾ GIAO DIỆN & KHỬ AI-SLOP
## HỆ THỐNG QUẢN TRỊ & ĐIỀU HÀNH ĐIỆN TỬ QCET E-OFFICE
**Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn**
*Lead Design Technologist & Frontend Architecture Report*

---

## 1. EXECUTIVE SUMMARY & ANTI-SLOP SCORECARD

### Tổng kết đánh giá
Hệ thống QCET E-Office đã thiết lập nền tảng công nghệ hiện đại với Tailwind CSS v4, bảng màu OKLCH Light-Only không gian màu mở rộng và phông chữ tiếng Việt chuẩn mực (*Be Vietnam Pro*). Tuy nhiên, sau các đợt tăng tốc tính năng bằng công cụ sinh mã AI, hệ thống đang bộc lộ hội chứng **"AI Mechanical Homogeneity" (Tính đồng dạng cơ học AI)** và suy giảm công thái học công vụ (Public Administration Ergonomics). 

Các biểu hiện cốt lõi bao gồm: **"Card-Soup Syndrome"** (hội chứng lạm dụng thẻ bọc thẻ), rò rỉ 209 trường hợp màu xanh lam/chàm mặc định (`blue-500`/`indigo-600`), hiệu ứng làm mờ kính giả tạo (`backdrop-blur`) trên nền văn phòng cần độ tương phản cao, và các hạt confetti ăn mừng kiểu ứng dụng trò chơi tiêu dùng (Consumer SaaS Gamification) đi ngược chuẩn mực hành chính nhà nước (Nghị định 30/2020/NĐ-CP).

---

### Bảng chấm điểm 7 Chiều AI-Slop (Sailop Benchmark 2025–2026)
*Thang điểm từ 0 đến 100 (Trong đó 0 = Nghệ thuật thủ công bậc thầy / Master Craft, 100 = Hoàn toàn là AI Slop rập khuôn).*

| Chiều đánh giá (Dimension) | Điểm Slop (0–100) | Đánh giá hiện trạng | Trọng tâm vi phạm kỹ thuật chính |
| :--- | :---: | :--- | :--- |
| **1. Color (Màu sắc)** | **62 / 100** | Khá nhiều điểm nghẽn | 209 vị trí rò rỉ `blue-500`/`indigo-600`; biến thể button `premium` mang dải màu gradient công nghệ generic; lỗi tương phản WCAG AA trên nhãn Amber (`text-amber-600` ~3.6:1) và biến `textMuted` (~2.6:1) trong `tokens.ts`. |
| **2. Typography (Kiểu chữ)** | **58 / 100** | Suy giảm công thái học | 79 trường hợp co ép khoảng cách chữ quá mức (`tracking-tight` -0.025em) gây dính dấu tiếng Việt; thiếu subset tiếng Việt cho font mã số (`JetBrains_Mono`); thiếu chỉ định `line-height >= 1.35` cho tiêu đề và thiếu `text-wrap: pretty`. |
| **3. Layout (Bố cục)** | **68 / 100** | Rập khuôn máy móc | Bố cục KPI 4 thẻ đối xứng thô cứng chiếm 130px; lưới chia đôi 50/50 cố định tại hàng đợi xử lý; chồng lớp 5 khối thông tin chiếm toàn bộ màn hình đầu tiên (Above-The-Fold), đẩy bảng công việc chính xuống dưới cuộn chuột. |
| **4. Animation (Chuyển động)** | **45 / 100** | Tương đối ổn, còn lỗi cục bộ | Lạm dụng `transition-all duration-300` trên thanh tiến độ, ô nhập liệu và card; hiệu ứng chấm tròn nhấp nháy (`animate-pulse`) vô tội vạ ngay cả với nhiệm vụ thường quy; thiếu phản hồi xúc giác tinh tế trên các nút quan trọng (`active:scale-[0.98]`). |
| **5. Components (Thành phần)** | **72 / 100** | Hội chứng "Card-Soup" | Lạm dụng `rounded-xl` (392 lần) và `rounded-2xl` (105 lần) trên các bảng dữ liệu chuyên dụng; bọc card lồng trong card (outer lane card bọc inner item card); nút bấm thiếu nhãn nổi chuẩn mực; popup confetti rải hạt đa sắc không phù hợp bối cảnh giáo dục đại học. |
| **6. Page Structure (Cấu trúc dòng chảy)** | **65 / 100** | Xung đột góc nhìn & dữ liệu | Trộn lẫn phân quyền hệ thống (`ADMIN`, `MANAGER`, `STAFF`) với phạm vi lọc công việc (`school`, `unit`, `my`); banner công bố vai trò chiếm 56px không cần thiết kèm nhãn mồ côi `Chuyển góc nhìn:` (do `RoleSwitcherPill` trả về `null`). |
| **7. Spacing & Rhythm (Nhịp điệu không gian)** | **55 / 100** | Rải rác bước nhảy lẻ | Xuất hiện các bước đệm lẻ ngoài lưới chuẩn 4px như `py-0.2` (0.8px, 23 lần), `h-8.5` (34px, 46 lần), `size-4.5` (18px, 12 lần); card trống thông báo (Empty state) phình to 160px nuốt trọn không gian thao tác. |

**Chỉ số AI-Slop Trung bình Hệ thống:** **60.7 / 100** (Cần lập tức thực hiện tái cấu trúc công thái học và thanh lọc văn phong).

---

## 2. NGUYÊN TẮC CÔNG THÁI HỌC CỔNG THÔNG TIN CÔNG VỤ ĐẠI HỌC (ACADEMIC & OFFICE ERGONOMICS)

### Nguyên tắc 1: Khắc kỷ công vụ (Administrative Dignity) thay vì Gamification tiêu dùng
- Loại bỏ triệt để các thủ thuật tâm lý tiêu dùng như hiệu ứng "Endowed Progress" (tự nhận hoàn thành 25% ảo), thanh tiến độ viên kẹo phân đoạn đa màu và hiệu ứng bắn pháo hoa giấy (Confetti).
- Giao diện giáo dục đại học/nghề nghiệp phải thể hiện tính trang nghiêm, minh bạch, lấy trách nhiệm công vụ làm trung tâm. Mọi tiến trình phải phản ánh đúng dữ liệu thực tế: bước thực hiện rõ ràng (*"Bước 1 / 4: Thiết lập thông báo tiếp nhận văn bản"*), danh xưng trân trọng (*"Kính chào Thầy/Cô"*), chức danh rõ ràng theo Luật Viên chức.

### Nguyên tắc 2: Tôn trọng ngôn ngữ học tiếng Việt & Bảo toàn dấu thanh (Vietnamese Typographic Clearance)
- Tiếng Việt có cấu trúc âm tiết đơn lập ghép với hệ thống dấu thanh đôi phức hợp (vừa có dấu mũ/móc vừa có dấu thanh sắc/huyền/hỏi/ngã/nặng: `ể`, `ễ`, `ệ`, `ở`, `ỡ`, `ợ`, `ứ`, `ừ`).
- **Khoảng cách chữ (Tracking):** Nghiêm cấm áp dụng `tracking-tight` (-0.025em) lên văn bản và tiêu đề tiếng Việt. Tiêu đề chỉ được dùng tối đa `-0.01em` và nội dung thường phải là `tracking-normal` để tránh các dấu trên đầu dính vào nhau hoặc dính vào ký tự kế cận.
- **Chiều cao dòng (Line-height):** Đảm bảo `line-height >= 1.35` cho tiêu đề và `1.5 - 1.6` cho văn bản nội dung. Bổ sung `py-1` đến `py-1.5` cho các nút bấm và nhãn để chống hiện tượng viền ngoài cắt cụt dấu mũ/nặng.
- **Ngắt dòng chống mồ côi (Orphan Elimination):** Tích hợp `text-wrap: balance` cho tiêu đề và `text-wrap: pretty` cho các đoạn văn chỉ đạo, ghi chú điều hành nhằm triệt tiêu hiện tượng từ đơn rơi xuống dòng mới.

### Nguyên tắc 3: Thiết kế đơn sắc ấm Light-Only & Phân cấp độ chói (Luminance Hierarchy)
- Thay thế hoàn toàn bóng đổ mờ nhòe (`box-shadow: 0 10px...`) và hiệu ứng kính mờ (`backdrop-blur`) bằng các bước chuyển đổi độ chói (Luminance Steps) chuẩn xác trên không gian màu OKLCH:
  - Nền toàn trang (Canvas Ground): `oklch(0.985 0.003 250)` (trắng ngà dịu mắt, chống lóa màn hình văn phòng).
  - Bề mặt tài liệu / bảng (Surface): `oklch(1.0 0 0)` (trắng tinh khiết).
  - Đường phân cách (Hairline Rule): 1px với viền chuẩn `oklch(0.92 0.005 250)`.
- Trạng thái màu (Status Chroma) phải tiết chế, nhã nhặn: Không dùng màu dạ quang (neon). Trạng thái chờ/chậm dùng sắc hổ phách trầm (`amber-700` hoặc `oklch(0.38 0.09 70)`) đạt độ tương phản chuẩn WCAG AA >= 4.5:1.

### Nguyên tắc 4: Mật độ thông tin chuẩn khoang lái điều hành (Cockpit-Ready Density)
- Xóa bỏ hội chứng "Card-Soup": Không bọc từng chỉ số vào một chiếc hộp riêng biệt. Nhóm các dữ liệu cùng phân cấp vào một mặt phẳng thống nhất sử dụng đường kẻ tóc (`divide-y divide-border/60`) hoặc dải dữ liệu một hàng (Inline Telemetry Strip).
- Giữ nguyên tắc ưu tiên dữ liệu nghiệp vụ: Bảng nhiệm vụ chính và hàng đợi phê duyệt phải luôn hiển thị ngay trong tầm mắt đầu tiên (Above-The-Fold) trên màn hình làm việc chuẩn 14 inch (độ phân giải 1366x768 hoặc 1920x1080).

### Nguyên tắc 5: Thẩm quyền hành chính chuẩn mực theo Nghị định 30/2020/NĐ-CP & Mô hình DACUM
- Giao diện phải phản ánh đúng cơ chế phân quyền nhà trường: Ban Giám hiệu (chỉ đạo, phê duyệt, giám sát chiến lược), Trưởng đơn vị (phân công, thẩm định minh chứng DACUM, hậu kiểm), và Giảng viên/Viên chức (chủ trì, phối hợp, nộp minh chứng, tự nghiệm thu nhiệm vụ thường quy).
- Sử dụng các trường dữ liệu hành chính chuẩn: Số/Ký hiệu văn bản, trích yếu nội dung, ngày ban hành, thời hạn xử lý, đơn vị chủ trì, đơn vị phối hợp, và bút phê chỉ đạo.

---

## 3. CÁC LỖ HỔNG GIAO DIỆN & TỬ HUYỆT AI CỤ THỂ TRONG MÃ NGUỒN

### Khu vực 1: Kiểu chữ & Khoảng cách chữ Tiếng Việt (Typography & Tracking)

#### Vi phạm 1: Cưỡng chế co chữ tiêu cực (`tracking-tight`) trên toàn hệ thống
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/globals.css:148` & 79 vị trí trong `src/` (như `src/app/portal/page.tsx:122, 143`, `src/app/tasks/page.tsx:385`).
- **Hiện trạng:**
  ```css
  /* globals.css:148 */
  h1, h2, h3, h4, h5, h6 {
    letter-spacing: -0.025em; /* Lỗi dính dấu tiếng Việt */
  }
  ```
- **Hậu quả:** Dấu mũ và dấu hỏi/ngã/sắc của các từ như `Quản trị`, `Kế hoạch`, `Nhiệm vụ`, `Thẩm định` dính chặt vào nhau và đè lên thân chữ cái liền kề trên màn hình độ phân giải tiêu chuẩn 1080p.
- **Giải pháp khắc phục:**
  ```css
  /* Sửa thành: */
  h1, h2, h3, h4, h5, h6 {
    letter-spacing: -0.01em;
    line-height: 1.35;
    text-wrap: balance;
  }
  ```

#### Vi phạm 2: Thiếu subset Tiếng Việt cho font Monospace định danh văn bản
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/layout.tsx:24-28`
- **Hiện trạng:**
  ```typescript
  const fontMono = JetBrains_Mono({
    subsets: ["latin"], // Thiếu subset vietnamese
    variable: "--font-mono",
  });
  ```
- **Hậu quả:** Khi mã văn bản hoặc mã đơn vị có ký tự tiếng Việt (ví dụ: `ĐV-01`, `KHTC-2026/QĐ`), trình duyệt buộc phải lấy glyph từ font hệ thống để hiển thị chữ `Đ`, gây lệch dòng đáy (Baseline shift) và biến dạng thị giác.
- **Giải pháp khắc phục:** Thay bằng font hỗ trợ đầy đủ tiếng Việt hoặc cấu hình fallback font đơn cách chuẩn.

---

### Khu vực 2: Màu sắc & Tương phản trợ năng (Color & WCAG Contrast)

#### Vi phạm 1: Rò rỉ dải màu xanh công nghệ generic (`blue-500`/`indigo-600`) & Nút "Premium" AI
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/ui/button.tsx:21-22` & 209 vị trí khác trong `src/app/portal/page.tsx`, `src/app/tasks/page.tsx`.
- **Hiện trạng:**
  ```tsx
  /* button.tsx:21-22 */
  premium:
    "border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-card hover:shadow-card-hover",
  ```
- **Hậu quả:** Mẫu nút mang đậm dấu ấn AI generator (dải gradient xanh tím thương mại), phá vỡ bảng màu OKLCH thể chế chuẩn của Nhà trường (`--primary: oklch(0.42 0.18 250)`).
- **Giải pháp khắc phục:** Thay thế biến thể `premium` bằng biến thể thể chế trang trọng:
  ```tsx
  institutional:
    "border-transparent bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary/95 active:scale-[0.98]",
  ```

#### Vi phạm 2: Lỗi tương phản nghiêm trọng trên nhãn Amber và token chữ mờ
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/ui/badge.tsx:26` & `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/tokens.ts:10, 105`
- **Hiện trạng:**
  - `badge.tsx:26`: `amber: "bg-amber-500/10 text-amber-600 border-amber-500/20"` -> Tỷ lệ tương phản chỉ đạt **~3.6:1**.
  - `tokens.ts:10`: `textMuted: "oklch(0.65 0.015 250)"` -> Tỷ lệ tương phản chỉ đạt **~2.6:1** trên nền trắng (thất bại hoàn toàn so với yêu cầu WCAG AA 4.5:1).
- **Giải pháp khắc phục:**
  - Chuyển `badge.tsx` sang `text-amber-700` (`#B45309`, tương phản ~5.1:1).
  - Đồng bộ `tokens.ts` với `globals.css`: đặt lại `textMuted: "oklch(0.38 0.015 250)"` (đạt tương phản ~6.7:1).

---

### Khu vực 3: Bố cục & Lạm dụng thẻ bọc (Layout & Card Proliferation)

#### Vi phạm 1: Dải KPI 4 hộp cồng kềnh ngốn diện tích
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/adaptive-metric-strip.tsx:201-259`
- **Hiện trạng:** Dùng lưới `grid grid-cols-2 lg:grid-cols-4 gap-3`, mỗi chỉ số bị đóng khung trong card viền dày `p-3.5 rounded-xl border bg-card/80 flex flex-col justify-between`, tiêu tốn 110-130px chiều cao chỉ để hiển thị 4 con số đơn giản.
- **Hậu quả:** Đẩy bảng tác vụ chính ra khỏi màn hình làm việc chuẩn, làm chậm thao tác điều hành của lãnh đạo.
- **Giải pháp khắc phục:** Tinh gọn thành thanh đo lường nội tuyến đơn hàng (Inline Metric Strip) cao 40px (`h-10`), kết hợp vạch ngăn đứng mảnh (`divide-x divide-border/60`), hiển thị số liệu dạng `font-mono tabular-nums`.

#### Vi phạm 2: Thẻ trống (Empty state) phình to 160px gây phản tác dụng
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/universal-action-queue.tsx:56-75`
- **Hiện trạng:** Khi hàng đợi trống (không có hồ sơ chờ duyệt), hệ thống hiển thị một khối card khổng lồ cao 160px với icon tròn xanh to tướng và hai đoạn văn mô tả dài dòng.
- **Hậu quả:** Người dùng hoàn thành hết việc lại bị một khối giao diện rỗng chắn hết tầm nhìn xuống danh sách công việc.
- **Giải pháp khắc phục:** Khi hàng đợi trống, tự động thu gọn thành một dải thông báo thanh mảnh cao 36px hoặc ẩn hoàn toàn để nhường không gian cho bảng dữ liệu tác vụ.

#### Vi phạm 3: Lỗi giao diện chết - Nhãn mồ côi "Chuyển góc nhìn:"
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/role-viewpoint-banner.tsx:76-80` & `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/role-switcher-pill.tsx:43-45`
- **Hiện trạng:**
  ```tsx
  /* role-viewpoint-banner.tsx */
  <span className="text-xs text-muted-foreground hidden md:inline font-medium">
    Chuyển góc nhìn:
  </span>
  <RoleSwitcherPill />
  ```
  Trong khi đó `RoleSwitcherPill` được định nghĩa trả về `null`.
- **Hậu quả:** Màn hình desktop xuất hiện chữ `"Chuyển góc nhìn:"` trơ trọi kèm một khoảng trống vô nghĩa bên cạnh.
- **Giải pháp khắc phục:** Xóa bỏ hoàn toàn cụm nhãn thừa này hoặc tích hợp trực tiếp bộ chọn phạm vi điều hành `ScopeSwitcher`.

---

### Khu vực 4: Biểu mẫu, Hộp thoại & Chất liệu giao diện (Forms, Modals & Materiality)

#### Vi phạm 1: Lỗi dùng Placeholder thay cho Label & Mờ quá mức
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/dashboard/create-task-modal.tsx:625-638, 649-656`
- **Hiện trạng:** Ô nhập tiêu đề và mô tả công việc không hề có thẻ `<label>` hoặc `aria-label`. Placeholder bị dùng thay thế cho nhãn trường và áp dụng lớp làm mờ quá mức `placeholder:text-muted-foreground/40` (tương phản chỉ còn ~2.4:1).
- **Hậu quả:** Khi người dùng bắt đầu gõ, ngữ cảnh nhận diện ô biến mất; người dùng lớn tuổi mắt kém không đọc được văn bản gợi ý.
- **Giải pháp khắc phục:**
  ```tsx
  <label htmlFor="task-title-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
    Tiêu đề nhiệm vụ <span className="text-destructive">*</span>
  </label>
  <input
    id="task-title-input"
    className="placeholder:text-muted-foreground/75 ..."
  />
  ```

#### Vi phạm 2: Độ mờ hậu cảnh (Backdrop blur) quá yếu gây nhiễu thị giác
- **Vị trí:** Xuất hiện tại 6 modal chính (`review-action-dialog.tsx:304`, `create-task-modal.tsx:532`, `submit-deliverable-modal.tsx:406`...) với lớp `backdrop-blur-xs`.
- **Hiện trạng:** `backdrop-blur-xs` trong Tailwind v4 chỉ tương đương 2px độ mờ.
- **Hậu quả:** Các dòng chữ, số liệu và đường kẻ của bảng công việc phía sau đâm xuyên qua lớp phủ đen, tạo nên một mớ hỗn độn thị giác khi mở modal.
- **Giải pháp khắc phục:** Nâng cấp đồng loạt lên `backdrop-blur-sm` (4px) hoặc `backdrop-blur-md` (8px).

---

### Khu vực 5: Văn phong Hành chính & Vi ngữ Công vụ (Administrative Microcopy)

#### Vi phạm 1: Chêm từ lóng công nghệ và ký hiệu thuật toán máy tính
- **Vị trí 1:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/portal/bento-portal-hub.tsx:397`
  - *Hiện trạng:* `"Lưới lịch công tác tháng/tuần tối ưu hóa O(1)..."`
  - *Sửa lại:* `"Lịch công tác tuần và tháng: Tự động tổng hợp và cập nhật tức thời các mốc báo cáo trọng tâm của Ban Giám hiệu."`
- **Vị trí 2:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/portal/page.tsx:238`
  - *Hiện trạng:* `"...phân trang tối ưu không giật lag."`
  - *Sửa lại:* `"...tra cứu và xử lý hồ sơ thông suốt."`
- **Vị trí 3:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/dashboard/create-task-modal.tsx:865`
  - *Hiện trạng:* `"Việc thường quy: Viên chức tự bấm hoàn thành nhiệm vụ (1-click) khi xong..."`
  - *Sửa lại:* `"Nhiệm vụ thường quy: Cán bộ trực tiếp xác nhận hoàn thành sau khi thực hiện; Trưởng đơn vị thực hiện hậu kiểm và giám sát tiến độ."`

#### Vi phạm 2: Sử dụng khẩu ngữ dân dã thay vì thuật ngữ công vụ chuẩn
- **Khẩu ngữ "việc con" / "đầu việc con"** (`cascading-task-table.tsx:944`, `department-manager-workspace.tsx:1123`): Chuyển toàn bộ thành **"Nhiệm vụ thành phần"** hoặc **"Nhiệm vụ nhánh"**.
- **Khẩu ngữ "Đang làm"** (`cascading-task-table.tsx:162`): Chuyển thành **"Đang thực hiện"**.
- **Khẩu ngữ "Tự xong"** (`task-detail-side-sheet.tsx:669`): Chuyển thành **"Tự nghiệm thu"**.
- **Đại từ xưng hô "Bạn" thiếu trang trọng** (`adaptive-metric-strip.tsx:121`, `task-detail-side-sheet.tsx:921`): Chuyển thành **"Quý Thầy/Cô"**, **"Cán bộ phụ trách"**, hoặc dùng câu vô nhân xưng hành chính.
- **Hậu tố giục giã "Ngay"** (`Vào bàn làm việc ngay`, `Bật thông báo ngay`): Chuyển thành mệnh lệnh công vụ gãy gọn: **"Truy cập Bàn làm việc"**, **"Kích hoạt thông báo công vụ"**.

---

## 4. KẾ HOẠCH HÀNH ĐỘNG TRIỂN KHAI (CONCRETE IMPLEMENTATION BLUEPRINT)

### Giai đoạn 1: Chuẩn hóa Token CSS, Không gian màu & Font chữ Tiếng Việt

1. **Cấu hình lại `@theme inline` trong `src/app/globals.css`:**
   - Điều chỉnh lại thang đo bán kính bo góc (Radius scale) để tạo phân cấp rõ ràng:
     ```css
     --radius-xs: 0.25rem;   /* 4px - Dành cho badge siêu nhỏ */
     --radius-sm: 0.375rem;  /* 6px - Dành cho input, button chuẩn */
     --radius-md: 0.5rem;    /* 8px - Dành cho thẻ điều khiển nhỏ */
     --radius-lg: 0.75rem;   /* 12px - Dành cho card nội dung chính */
     --radius-xl: 1rem;      /* 16px - Dành cho Modal dialogs */
     --radius-2xl: 1.25rem;  /* 20px - Dành cho Floating sheets lớn */
     ```
   - Xóa bỏ tình trạng định nghĩa `--radius-xl` và `--radius-2xl` trùng giá trị `1rem`.
   - Chuẩn hóa các biến bóng đổ (`--shadow-card`, `--shadow-dropdown`, `--shadow-subtle`) trực tiếp vào `@theme inline`, loại bỏ việc viết đè chuỗi bóng đổ phức tạp trong các file component con.

2. **Khắc phục triệt để Typographic Tracking & Line-Height trong `globals.css`:**
   - Đặt lại quy chuẩn kiểu chữ tiếng Việt:
     ```css
     @layer base {
       body {
         font-feature-settings: "cv02", "cv03", "cv04", "cv11";
         font-optical-sizing: auto;
         text-rendering: optimizeLegibility;
         -webkit-font-smoothing: antialiased;
       }
       h1, h2, h3, h4, h5, h6 {
         letter-spacing: -0.01em; /* Tuyệt đối không để -0.025em */
         line-height: 1.35;
         text-wrap: balance;
       }
       p, td, li {
         text-wrap: pretty;
       }
     }
     ```

3. **Cập nhật khai báo Font trong `src/app/layout.tsx`:**
   - Bổ sung cấu hình tải subset chuẩn và font display cho `Be_Vietnam_Pro` và font Monospace.

---

### Giai đoạn 2: Tinh gọn Bố cục & Thanh lọc Hội chứng "Card-Soup"

1. **Tái cấu trúc `AdaptiveMetricStrip` (`adaptive-metric-strip.tsx`):**
   - Chuyển đổi từ dạng lưới 4 card cồng kềnh sang dạng dải điều hành nội tuyến tích hợp (Compact Integrated Metric Strip):
   - Đưa chiều cao về `h-10` hoặc `h-11`, bố trí các chỉ số nằm ngang phân tách bằng vạch kẻ tóc `border-r border-border/60`.
   - Định dạng số liệu bằng `font-mono tabular-nums font-bold text-base` kèm nhãn tiêu đề nhỏ gọn bên cạnh. Giảm 65% diện tích chiếm dụng màn hình.

2. **Cải tiến `UniversalActionQueue` (`universal-action-queue.tsx`):**
   - Loại bỏ cấu trúc card lồng card (Card-ception). Outer lane chỉ đóng vai trò phân vùng với viền đơn 1px và nền mờ siêu nhẹ (`bg-muted/20`).
   - Xóa bỏ thẻ Empty State khổng lồ 160px; thay thế bằng trạng thái thu gọn tinh tế khi không có công việc tồn đọng.
   - Triệt tiêu hiệu ứng nhấp nháy `animate-pulse` trên các mục thông thường, chỉ giữ lại một chấm đỏ tĩnh viền sáng (`ring-2 ring-background`) cho cảnh báo trễ hạn khẩn cấp.

3. **Thu hồi Banner góc nhìn thừa thãi (`role-viewpoint-banner.tsx`):**
   - Loại bỏ nhãn mồ côi `Chuyển góc nhìn:` và component rỗng `RoleSwitcherPill`.
   - Thu nhỏ kích thước banner xuống dạng Breadcrumb công vụ tinh gọn hoặc tích hợp thông tin góc nhìn trực tiếp vào thanh tiêu đề `AppTopbar`.

---

### Giai đoạn 3: Chuẩn hóa Biểu mẫu, Nút bấm & Modal Dialogs

1. **Khắc phục toàn diện Form Accessibility:**
   - Rà soát `create-task-modal.tsx`, `delegation-management-modal.tsx`, `review-action-dialog.tsx`:
   - Bổ sung đầy đủ cặp liên kết `htmlFor` trên `<label>` và `id` trên các thẻ `<input>`, `<textarea>`, `<select>`.
   - Nâng độ tương phản của placeholder lên tối thiểu `placeholder:text-muted-foreground/75` (tương đương ~4.5:1).
   - Đảm bảo trường nhập liệu nào cũng có nhãn hiển thị bên ngoài, cấm dùng placeholder làm nhãn chính.

2. **Đồng bộ hóa phản hồi nút bấm (Button Tactile Feedback):**
   - Thay thế toàn bộ các lớp giật co rút thô thiển `active:scale-95` bằng chuẩn mực công sở tinh tế `active:scale-[0.98]` trong `button.tsx`, `create-task-modal.tsx` và các nút điều hướng.
   - Bổ sung trạng thái `active:scale-[0.98]` hoặc `active:bg-secondary` cho tất cả các nút hiện mới chỉ có `hover:`.

3. **Nâng cấp độ che phủ Modal Dialogs:**
   - Thay thế `backdrop-blur-xs` bằng `backdrop-blur-sm` trên toàn bộ các cửa sổ pop-up để ngăn chặn hiện tượng nhìn xuyên gây rối mắt.
   - Bọc toàn bộ modal bằng `createPortal(..., document.body)` để cô lập layer hiển thị.

---

### Giai đoạn 4: Thanh lọc Văn phong Hành chính & Xóa bỏ Gamification

1. **Khử hoàn toàn Gamification tiêu dùng:**
   - Xóa bỏ tệp `celebration-confetti.tsx` và mọi lời gọi kích hoạt bắn pháo hoa giấy.
   - Loại bỏ logic gán hoàn thành ảo 25% (`step-profile`) trong `onboarding-constants.ts`.
   - Tinh giản thanh tiến độ kẹo dẻo đa sắc thành chỉ báo bước dạng văn bản thanh lịch: `Bước X / Y`.

2. **Chuyển dịch toàn diện Từ vựng theo Bảng Ánh xạ Hành chính Giáo dục:**
   - Thực thi thay thế văn bản hàng loạt: `việc con` -> `nhiệm vụ thành phần`, `Đang làm` -> `Đang thực hiện`, `Tự xong` -> `Tự nghiệm thu`, `Trọng điểm (DACUM)` -> `Trọng tâm (Đánh giá theo DACUM)`, `Nhân viên` -> `Viên chức, Người lao động`.
   - Thay thế các thông báo lỗi kỹ thuật/cộc lốc bằng văn phong hành chính lịch sự, giải thích rõ nguyên nhân và hướng dẫn cán bộ cách xử lý.

---

## 5. BẢNG PHÂN LOẠI: HÀNH ĐỘNG NHANH (QUICK WINS) VS ĐỔI MỚI CHIẾN LƯỢC (STRATEGIC MILESTONES)

```
                       MA TRẬN ƯU TIÊN TRIỂN KHAI
  Tác động cao
       ▲
       │  [QW-1] Sửa Tracking Tiếng Việt        [SM-1] Tái thiết kế Bố cục Dải KPI
       │  [QW-2] Xóa Confetti & Gamification    [SM-2] Cấu trúc lại Dashboard Context
       │  [QW-3] Khắc phục Form Labels          [SM-3] Tinh gọn Hàng đợi Universal Queue
       │  [QW-4] Xóa nhãn "Chuyển góc nhìn:"
       │
       │  [QW-5] Tăng Backdrop-blur Modal       [SM-4] Hệ thống hóa Bộ Token Bán kính
       │  [QW-6] Thay thế vi ngữ khẩu ngữ       [SM-5] Chuẩn hóa 209 điểm màu Blue
       ▼
       └────────────────────────────────────────────────────────►
       Thấp                  Độ phức tạp kỹ thuật               Cao
```

---

### Danh mục Hành động Nhanh (Quick Wins - Hoàn thành trong 1–2 ngày)

| Mã | Tác vụ cụ thể | Tệp tin tác động | Kết quả đạt được sau khi sửa |
| :---: | :--- | :--- | :--- |
| **QW-1** | Xóa bỏ `tracking-tight` (-0.025em) trên các thẻ Heading tiếng Việt | `src/app/globals.css:148` | Dấu tiếng Việt thông thoáng tức thì, triệt tiêu hiện tượng dính dấu thanh trên toàn bộ giao diện. |
| **QW-2** | Xóa bỏ thư viện Confetti và hiệu ứng bắn hạt đa màu | `src/components/onboarding/celebration-confetti.tsx`, `onboarding-checklist-widget.tsx` | Khôi phục tính trang nghiêm, chuẩn mực công sở hành chính cho luồng hướng dẫn ban đầu. |
| **QW-3** | Bổ sung `<label>` và tăng tương phản placeholder trong modal tạo việc | `src/components/dashboard/create-task-modal.tsx` | Đạt chuẩn tiếp cận WCAG AA (>= 4.5:1), bảo đảm trải nghiệm cho cán bộ lớn tuổi. |
| **QW-4** | Xóa nhãn mồ côi `Chuyển góc nhìn:` và import thừa của `RoleSwitcherPill` | `src/components/auth/role-viewpoint-banner.tsx:75-81` | Xóa sạch giao diện chết (dead UI) trên màn hình máy tính của lãnh đạo. |
| **QW-5** | Nâng cấp `backdrop-blur-xs` lên `backdrop-blur-sm` trên toàn bộ Dialogs | `review-action-dialog.tsx`, `create-task-modal.tsx`, `submit-deliverable-modal.tsx` | Nền modal dịu mắt, che chắn nội dung bảng biểu phía sau một cách tinh tế. |
| **QW-6** | Quét và thay thế các từ ngữ khẩu ngữ (`việc con`, `Đang làm`, `Tự xong`, `1-click`) | Toàn bộ các component trong `src/components/` | Chuẩn hóa 100% văn phong công vụ giáo dục đại học / nghề nghiệp. |

---

### Danh mục Cải tiến Chiến lược (Strategic Milestones - Triển khai theo Sprint)

| Cột mốc | Tên phân hệ | Mục tiêu kiến trúc & Trải nghiệm người dùng | Thời lượng ước tính |
| :---: | :--- | :--- | :---: |
| **SM-1** | **Tái thiết kế Dải đo lường Khoang lái (Cockpit Telemetry Strip)** | Chuyển đổi dải KPI từ 4 card cồng kềnh sang thanh đo lường ngang nội tuyến `h-10`. Giải phóng 80px chiều cao màn hình, đưa bảng tác vụ chính lên trên màn hình đầu tiên (Above-The-Fold). | **Sprint 1 (3 ngày)** |
| **SM-2** | **Tối ưu hóa Hiệu năng & Tách nhỏ Dashboard Context** | Chia nhỏ `DashboardDataContextValue` (27 thuộc tính) thành các sub-context độc lập: `WorkspaceFilterContext`, `WorkspaceStatsContext`, và `WorkspaceTaskContext`. Triệt tiêu hoàn toàn độ trễ gõ phím khi lọc bảng tác vụ. | **Sprint 1 (4 ngày)** |
| **SM-3** | **Tái cấu trúc Hàng đợi Thao tác Thống nhất (Universal Action Queue)** | Loại bỏ hiện tượng card bọc card, thiết kế lại lưới tự thích ứng theo khối lượng công việc thực tế (Asymmetric layout thay vì 50/50 cứng nhắc), thu gọn trạng thái trống rỗng thành thanh thông báo mảnh. | **Sprint 2 (5 ngày)** |
| **SM-4** | **Quy chuẩn hóa Bán kính Bo góc & Đổ bóng (Radius & Shadow Tokens)** | Cấu hình lại chuẩn xác `@theme inline` trong Tailwind v4. Rà soát và chuyển đổi 392 thẻ `rounded-xl` và 105 thẻ `rounded-2xl` về đúng cấp độ bo góc quy định theo kích thước component. | **Sprint 2 (4 ngày)** |
| **SM-5** | **Thanh lọc 209 thực thể Màu Blue Generic & Khử toàn bộ Slop Gradient** | Thay thế toàn bộ mã màu `blue-500`, `indigo-600` rò rỉ bằng các biến trạng thái ngữ nghĩa OKLCH (`bg-primary`, `bg-accent`, `bg-muted`). Xóa bỏ biến thể button `premium` gradient công nghệ rập khuôn. | **Sprint 3 (5 ngày)** |

---

## 6. KẾT LUẬN

Hệ thống **QCET E-Office** đang đứng trước cơ hội lớn để chuyển mình từ một sản phẩm có dấu ấn can thiệp cơ học của AI thành một **chuẩn mực thiết kế công vụ giáo dục hiện đại, chuẩn mực và tinh tế bậc nhất**. Bằng cách kiên quyết loại bỏ các khuôn mẫu AI rập khuôn, tôn trọng đặc thù ngôn ngữ học tiếng Việt và đặt tính trang nghiêm của công vụ lên hàng đầu, hệ thống sẽ mang lại trải nghiệm làm việc mượt mà, chuyên nghiệp và đầy tự hào cho tập thể cán bộ, giảng viên Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn.