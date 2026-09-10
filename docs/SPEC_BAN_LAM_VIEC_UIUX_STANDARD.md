---
status: completed
domain: ux
created: 2026-09-09
---

# QUY CHUẨN THIẾT KẾ UI/UX BÀN LÀM VIỆC (EXECUTIVE WORKBENCH SPECIFICATION)
## HỆ THỐNG ĐIỀU HÀNH VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
**Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn**
*Mã tài liệu: SPEC-UIUX-WORKBENCH-2026-01 | Phiên bản: 2.0 (Official Standard)*

---

## 1. TỔNG QUAN & TẦM NHÌN THIẾT KẾ (EXECUTIVE PHILOSOPHY)

### 1.1. Bối cảnh & Mục tiêu Cốt lõi
Bàn làm việc (`/dashboard` / `Bàn làm việc`) là "Trung tâm chỉ huy số" (Executive Cockpit) dành cho Ban Giám hiệu, Trưởng các Phòng, Khoa, Trung tâm trực thuộc Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn. 

Mục tiêu thiết kế:
1. **Khắc kỷ công vụ (Administrative Dignity)**: Chấm dứt triệt để các phong cách hoạt họa, trò chơi hóa (gamification) hoặc giao diện SaaS tiêu dùng lòe loẹt. Thể hiện sự chuẩn mực, tin cậy, minh bạch theo tinh thần Nghị định 30/2020/NĐ-CP về công tác văn thư và điều hành hành chính giáo dục nghề nghiệp.
2. **Loại bỏ AI-Slop (Anti-Slop Craftsmanship)**: Xóa sổ các mẫu giao diện AI rập khuôn: không sọc màu trang trí trên nóc thẻ, không hộp vuông xám bọc icon, không nút gradient công nghệ neon, không card lồng card vô tận.
3. **Hiệu suất Nhận thức Cao (Zero Cognitive Friction)**: Lãnh đạo chỉ mất **dưới 3 giây** để nắm bắt 3 câu hỏi sống còn:
   - *Toàn trường có bao nhiêu việc đang chạy và tỷ lệ hoàn thành ra sao?*
   - *Hôm nay có bao nhiêu tờ trình/văn bản cần tôi ký duyệt ngay lập tức?*
   - *Đơn vị nào đang có điểm nghẽn hoặc trễ hạn cần đôn đốc chỉ đạo trực tiếp?*

### 1.2. Thước đo Công thái học (Taste Spectrum)
- **Độ đặc dữ liệu (Density): 8/10 (Cockpit Dense)** — Tối ưu hóa không gian hiển thị thông tin nghiệp vụ, giảm thiểu khoảng trống thừa thãi không mang giá trị điều hành.
- **Biến thiên bố cục (Variance): 5/10 (Balanced Administrative Hierarchy)** — Bố cục phân tầng mạch lạc: Thông tin vĩ mô trên đỉnh (Header + KPI Strip) → Phễu điều hành trung tâm (Action Center) → Bảng chi tiết thực thi (Cascading Table).
- **Cường độ chuyển động (Motion): 3/10 (Subtle & Restrained)** — Chuyển động nhẹ nhàng (150ms–200ms), không làm phân tâm người dùng; ưu tiên phản hồi tức thời.

---

## 2. HỆ MÀU SẮC & CHUẨN MỰC LIGHT-ONLY (COLOR CALIBRATION)

Hệ thống tuân thủ nghiêm ngặt chuẩn **Light-Only** (sử dụng không gian màu hiện đại OKLCH của Tailwind CSS v4). Tuyệt đối không hỗ trợ chế độ Dark Mode vì không phù hợp môi trường hành chính văn phòng ban ngày.

### 2.1. Bảng màu Nền tảng (Neutrals & Surfaces)
| Tên biến / Token | Giá trị HSL / OKLCH / Hex | Vai trò chức năng trong Bàn làm việc |
| :--- | :--- | :--- |
| **Canvas Background** | `#F8FAFC` (`slate-50`) | Nền chung toàn màn hình bàn làm việc |
| **Surface Card** | `#FFFFFF` (`white`) | Nền thẻ chỉ số, hàng đợi công việc, khối bảng |
| **Primary Text (Ink)** | `#0F172A` (`slate-900`) | Tiêu đề chính, số liệu KPI quan trọng, tên công việc |
| **Secondary Text** | `#64748B` (`slate-500`) | Chú thích, người chủ trì, thời hạn, nhãn danh mục |
| **Subtle Border** | `#E2E8F0` / `rgba(226,232,240,0.8)` | Đường kẻ phân cách, viền thẻ (1px mờ nhẹ) |
| **Hover Surface** | `#F1F5F9` (`slate-100/60`) | Nền hover khi di chuột qua thẻ tương tác, hàng bảng |

### 2.2. Nhóm Màu Chỉ báo Nghiệp vụ (Semantic Signals)
*Nguyên tắc: Độ bão hòa màu luôn khống chế dưới 80%, không dùng hiệu ứng bóng sáng dạ quang (no glow).*
- **Primary / Brand Navy** (`#0284C7` / `sky-600`): Dùng cho nút hành động chính, trạng thái đang chọn (Active Scope).
- **Warning Amber** (`#D97706` / `amber-600`): Dành cho nhiệm vụ cần duyệt, thẩm định (`bg-amber-500/10 text-amber-700 border-amber-500/20`).
- **Urgent / Danger Rose** (`#E11D48` / `rose-600`): Cảnh báo điểm nghẽn, trễ hạn tiến độ (`bg-rose-500/10 text-rose-700 border-rose-500/20`).
- **Success Emerald** (`#059669` / `emerald-600`): Nhiệm vụ hoàn thành, tiến độ thông suốt (`bg-emerald-500/10 text-emerald-700 border-emerald-500/20`).

---

## 3. KIẾN TRÚC TYPOGRAPHY & TIẾNG VIỆT CÔNG VỤ (TYPOGRAPHY CLEARANCE)

### 3.1. Phông chữ Chỉ định (Font Stacks)
- **Heading / Display**: `font-heading` (`Be Vietnam Pro`, sans-serif) — Tối ưu tuyệt đối cho hệ thống dấu thanh tiếng Việt phức hợp (`ể`, `ễ`, `ệ`, `ở`, `ỡ`, `ợ`, `ứ`, `ừ`).
- **Body & Controls**: `font-sans` (`Be Vietnam Pro`, system-ui) — Rõ ràng, dễ đọc ở kích thước nhỏ (12px–14px).
- **Tabular / Metric Values**: `tabular-nums` trên `font-heading` — Các con số KPI luôn giữ cùng chiều rộng để không bị rung giật khi dữ liệu nhảy số.
- **CẤM**: Font `Inter` cho ngữ cảnh cao cấp; cấm dùng font `font-mono` cho các nhãn chữ tiếng Việt thông thường.

### 3.2. Quy chuẩn Khoảng cách & Ngắt dòng
- **Tracking**: Tuyệt đối không dùng `tracking-tight` (-0.025em) trên văn bản tiếng Việt có dấu. Chỉ dùng `tracking-normal` hoặc tối đa `-0.01em` trên tiêu đề lớn.
- **Leading (Line-height)**: Đảm bảo tối thiểu `line-height >= 1.35` cho tiêu đề và `1.5 - 1.6` cho nội dung mô tả nhiệm vụ.
- **Cân bằng dòng**: Áp dụng `text-balance` trên tiêu đề trang và `text-pretty` trên văn bản dài để triệt tiêu từ đơn rơi dòng (mồ côi chữ).

---

## 4. CHI TIẾT CẤU TRÚC 3 KHỐI NỘI DUNG CHÍNH (COMPONENT SPECS)

### 4.1. Khối 1: Header Phân khu & Bộ lọc Kỳ báo cáo
- **Huy hiệu Phân khu**: `<span className="px-2.5 py-0.5 rounded-lg font-sans font-medium text-xs bg-primary/10 text-primary border border-primary/20">Phân khu Điều hành</span>`.
- **Tiêu đề Trang**: `<h1 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">Dashboard Điều Hành & Báo Cáo KPI</h1>`.
- **Bộ lọc Kỳ báo cáo & Phạm vi**:
  - Tích hợp liền khối: `ScopeSwitcher` + `GlobalMonthSelector` + Nút `Làm mới dữ liệu`.
  - Nút bấm đồng bộ chiều cao `h-9` với viền `border-border/80`, shadow `shadow-2xs`.

### 4.2. Khối 2: Dải KPI 4 Thẻ Điều Hành (`ExecutiveStatStrip`)
Bố cục lưới: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60 rounded-xl border border-border/70 bg-card overflow-hidden`.
- **Cấu trúc thẻ**: Là thẻ ngữ nghĩa tương tác `<button type="button" aria-pressed={isActive} aria-label="...">`.
- **Loại bỏ viền màu trên nóc**: Không còn sọc màu `h-[3px]` trên đỉnh.
- **Trạng thái Active**: Thể hiện qua `bg-primary/[0.04]` và viền nhấn nhẹ hoặc `ring-1 ring-primary/30`.
- **Icon**: Đặt trực tiếp cạnh tiêu đề với `size-4 shrink-0 text-muted-foreground strokeWidth={1.5}` (không dùng hộp vuông xám).
- **Thước đo tiến độ (Card 4)**: Thanh tiến độ có `aria-hidden="true"`, số phần trăm `tabular-nums font-semibold`.

### 4.3. Khối 3: Trung tâm Hành động & Phễu Xử lý (`ExecutiveActionCenter`)
Gồm 2 tầng liên hoàn:
#### Tầng trên — 3 Thẻ Lọc Tình Huống:
1. **Chờ BGH Phê duyệt**: Đếm số tờ trình/kế hoạch chờ thẩm định.
2. **Vướng mắc & Trễ hạn**: Đếm số nhiệm vụ có nguy cơ hoặc quá hạn.
3. **Nhiệm vụ Chiến lược**: Đếm số công việc trọng tâm năm học.
*Quy chuẩn*: Tương tác nhấp thẻ sẽ đồng bộ lọc hàng đợi bên dưới. Nhấp lại vào thẻ đang chọn sẽ quay về chế độ `ALL`.

#### Tầng dưới — Hàng đợi Nhiệm vụ Cần Chỉ đạo Trực tiếp:
- **Tiêu chuẩn hiển thị**: Tối đa `INITIAL_LIMIT = 5` mục đầu tiên khi vào trang.
- **Thanh cuộn an toàn**: Bọc container với `max-h-[460px] overflow-y-auto pr-1` để không đẩy bảng phân quyền xuống quá sâu.
- **Nút Xem thêm / Thu gọn**:
  - Khi danh sách > 5 items: Xuất hiện nút toàn chiều rộng `variant="ghost"`: `"Xem thêm N nhiệm vụ trong hàng đợi"` kèm icon `ChevronDown`.
  - Khi mở rộng: Nút chuyển thành `"Thu gọn danh sách"` kèm icon `ChevronUp`.
- **Nút Thao tác Tức thời**: Chiều cao `min-h-[44px] sm:min-h-[36px]` đạt chuẩn cảm ứng; nhãn động ("Phê duyệt ngay", "Theo dõi") kèm `aria-label` mô tả chi tiết công việc.

---

## 5. CÔNG THÁI HỌC CẢM ỨNG & TIÊU CHUẨN TRỢ NĂNG (WCAG 2.2 AA)

1. **Vùng chạm tối thiểu (Touch Targets)**: Mọi phần tử có thể nhấp (nút, tab, hàng chọn, ô tìm kiếm) đều có kích thước tương tác thực tế từ **44px × 44px** trở lên trên màn hình cảm ứng (< 768px).
2. **Điều hướng Bàn phím & Focus Ring**:
   - Mọi card lọc hỗ trợ phím `Tab`, `Enter`, `Space`.
   - Vòng chỉ báo tiêu điểm: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset`.
3. **Độc lập Màu sắc**: Thông tin cảnh báo nguy cấp luôn đi kèm biểu tượng (`AlertTriangle`), nhãn chữ rõ ràng và giá trị số đếm; không dựa đơn thuần vào màu sắc đỏ/vàng để thông báo trạng thái.
4. **Verified Clear Horizon (Trạng thái Rỗng Hoàn hảo)**:
   - Khi không có việc tồn đọng: Hiển thị icon `ShieldCheck` thanh nhã, tiêu đề *"Hàng đợi điều hành thông suốt"*, thông điệp *"Không có nhiệm vụ cần phê duyệt hoặc đôn đốc trực tiếp"*. Không để trống trơn hoặc dùng hình vẽ hoạt hình minh họa.

---

## 6. DANH MỤC CÁC HÌNH THỨC BỊ CẤM (ANTI-PATTERNS & BANNED AI SLOP)

- **CẤM 1**: Không dùng bất kỳ Emoji nào trong nhãn, tiêu đề, trạng thái hoặc thông báo của Bàn làm việc (thay thế bằng icon Lucide nét 1.5).
- **CẤM 2**: Không dùng sọc màu trang trí (`h-[2px]`, `h-[3px]`, `border-t-4`) trên nóc các thẻ KPI hoặc thẻ lọc.
- **CẤM 3**: Không bao bọc icon Lucide trong các hộp vuông xám/nền màu (`size-7 rounded-md bg-muted/60`).
- **CẤM 4**: Không dùng class `dark:` hoặc bất kỳ cơ chế chuyển theme tối nào trong hệ thống.
- **CẤM 5**: Không dùng chữ in hoa toàn bộ (`uppercase tracking-wider`) trên các tiêu đề phụ nội dung tiếng Việt dài.
- **CẤM 6**: Không đổ dữ liệu hàng đợi không giới hạn khiến thanh cuộn trang bị kéo dài bất tận.
- **CẤM 7**: Không dùng các hiệu ứng gradient rực rỡ neon (tím, hồng, xanh cyan kiểu SaaS tiêu dùng) trên nút bấm hoặc thẻ số liệu.

---

## 7. QUY TRÌNH KIỂM THỬ & DUYỆT ĐỔI MỚI (VERIFICATION PROTOCOL)

Mọi thay đổi trên màn hình Bàn làm việc đều phải vượt qua 3 cổng nghiệm thu:
1. `npm run typecheck`: Không có bất kỳ lỗi TypeScript nào (`tsc --noEmit`).
2. `npx tsx --test tests/dashboard*.test.ts tests/executive*.test.ts`: Toàn bộ 260+ tests phải Pass 100%.
3. **Kiểm tra trực quan (Visual Inspection)**:
   - Không vỡ layout trên desktop (1440px), laptop (1280px), tablet (768px), mobile (375px).
   - Kiểm tra contrast ratio đạt >= 4.5:1 (WCAG AA).
