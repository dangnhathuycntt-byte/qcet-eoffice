# ĐẶC TẢ THIẾT KẾ KIẾN TRÚC UI/UX: LINEAR & PLANE.SO HYBRID WORKSPACE
## Tái Cấu Trúc Toàn Diện Phân Hệ Quản Lý Công Việc & Lịch Công Tác QCET E-Office

- **Mã tài liệu:** `SPEC-QCET-UIUX-2026-09-09`
- **Phiên bản:** 2.0 (Anti-Slop Enterprise Release)
- **Tác giả:** Đội ngũ Kiến trúc sư Hệ thống & UI/UX Công nghệ số QCET
- **Ngày lập:** 09/09/2026
- **Áp dụng cho:** `src/components/workspace/*`, `src/components/tasks/*`, `src/components/calendar/*`, `src/components/dashboard/*`

---

## 1. TỔNG QUAN & BỐI CẢNH (EXECUTIVE SUMMARY)

Hệ thống điều hành tác nghiệp số QCET E-Office phục vụ Ban Giám hiệu, Trưởng các Phòng/Khoa và Giảng viên/Chuyên viên. Qua quá trình vận hành thực tế và khảo sát giao diện, hệ thống ghi nhận hai điểm nghẽn nghiêm trọng về kiến trúc hiển thị:
1. **Phân hệ Quản lý công việc:** Ba tầng bộ lọc xếp chồng lãng phí ~220px chiều dọc; bố cục chia cột tĩnh `col-span-8 : col-span-4` làm bảng công việc bị co hẹp, các cột sống còn (Hạn chót/SLA, Mức độ ưu tiên, Trạng thái) bị ẩn hoặc cắt cụt bằng dấu ba chấm (`...`), hàng đợi thẩm định bên phải bị co rúm không đủ ngữ cảnh.
2. **Phân hệ Lịch công tác:** Bốn dải điều hướng chiếm tới 40% màn hình; ô ngày nhiều việc bị tràn ngập dòng chữ "+13 nhiệm vụ" mà không thể hiện được trực quan áp lực công việc; cột chi tiết bên phải chiếm 1/4 diện tích màn hình thành "không gian chết" khi chọn ngày trống.

**Mục tiêu thiết kế:** Chuyển đổi toàn diện sang mô hình **Full-width Canvas kết hợp Slide-Over Side-Sheet** theo chuẩn mực công thái học hiện đại của **Linear.app** và **Plane.so**, loại bỏ triệt để AI slop, đảm bảo chuẩn mực công sở hành chính giáo dục (Tailwind v4 Light-Only Standard).

---

## 2. NGUYÊN TẮC THIẾT KẾ BẤT BIẾN (DESIGN SYSTEM INVARIANTS)

1. **Light-Only Standard:** 100% giao diện vận hành trên chuẩn màu OKLCH công sở giáo dục. Tuyệt đối không thêm class `dark:`, khối `.dark` hoặc hook `useTheme`.
2. **Typography Floor & Hierarchy:**
   - Sàn font tối thiểu là 12px (`text-xs`). Tuyệt đối cấm các font siêu nhỏ `text-[9px]`, `text-[10px]`, `text-[11px]`.
   - Tiêu đề dùng font `Plus Jakarta Sans` với `line-height: 1.35; letter-spacing: -0.01em;` (cấm `tracking-tighter` để tránh dính dấu tiếng Việt).
   - Số liệu KPI, mã nhiệm vụ, ngày tháng SLA dùng font `JetBrains Mono` kèm thuộc tính `.tabular-nums`.
3. **Full-Width First (100% Canvas):** Bảng công việc và Lưới lịch tháng luôn chiếm 100% chiều ngang màn hình khả dụng (`w-full`), không bị bóp nghẹt bởi các sidebar tĩnh.
4. **Slide-Over Side-Sheet (Drawer):** Toàn bộ nghiệp vụ thẩm định, phê duyệt, xem chi tiết và nộp sản phẩm chuyển sang Side-Sheet trượt từ mép phải (độ rộng 520px - 600px), có backdrop mờ nhẹ, đóng bằng phím `Esc` hoặc click ngoài, bảo toàn ngữ cảnh làm việc bên dưới.

---

## 3. THIẾT KẾ CHI TIẾT: PHÂN HỆ QUẢN LÝ CÔNG VIỆC (TASK MANAGEMENT)

### 3.1. Dải Chỉ Số Mảnh (Slim Horizontal Metric Strip)
- **Vị trí:** Đặt ở đỉnh không gian làm việc, ngay dưới Header.
- **Kích thước & Trạng thái:** Thanh ngang mỏng (`h-12` đến `h-14`), gồm 5 ô chỉ số liền mạch:
  1. *Khối lượng toàn trường / Đơn vị:* Tổng số nhiệm vụ.
  2. *Chờ thẩm định / BGH phê duyệt:* Đổi màu vàng hổ phách nhạt khi có việc cần duyệt.
  3. *Đang triển khai:* Số nhiệm vụ đang tiến hành.
  4. *Quá hạn / Chậm tiến độ:* Đổi màu đỏ nhạt khi $> 0$.
  5. *Tỷ lệ hoàn thành:* Phần trăm kèm thanh mini-progress.
- **Tương tác:** Click vào từng ô chỉ số lập tức lọc bảng tác vụ tương ứng (Ví dụ: Click "Chờ thẩm định" $\rightarrow$ kích hoạt tab Chờ duyệt). Cho phép thu gọn/mở rộng dải này để người dùng tối đa hóa không gian đọc bảng.

### 3.2. Thanh Công Cụ Điều Khiển Hợp Nhất (Unified Linear Control Bar)
Thay thế hoàn toàn 3 tầng lọc và 4 dropdown `<select>` cũ bằng một thanh công cụ 1 dòng:
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [🔍 Tìm nhiệm vụ, mã, người chủ trì...  /]  [⚙️ Bộ lọc (2) ▾]  │  [Tất cả 149] [Đang làm 91] [Chờ duyệt 5] [Quá hạn 1] [Hoàn thành 13]  │  [⊞ Bảng | ☷ Kanban | 📅 Lịch] [⇕ Mật độ] │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
1. **Ô Tìm kiếm nhanh (Debounced Quick Search):**
   - Hỗ trợ phím tắt `/` hoặc `⌘K`.
   - Tìm kiếm tức thời theo Tên nhiệm vụ, Mã NV (`NV-2026-...`), Tên người chủ trì, Tên phòng ban.
2. **Nút Popover Đa Bộ Lọc (Multi-Filter Popover):**
   - Nút `Bộ lọc` hiển thị badge số lượng tiêu chí đang áp dụng (ví dụ: `Bộ lọc (2)`).
   - Khi click, popover mở ra gọn gàng với 3 nhóm chọn:
     - *Phòng ban / Khoa:* Danh sách 11+ đơn vị trực thuộc trường.
     - *Kỳ học thuật:* Lựa chọn Tháng 9/2026 $\rightarrow$ Tháng 8/2027 hoặc Cả năm.
     - *Danh mục:* DACUM / Chuyển đổi số / Báo cáo / CNTT...
     - Nút "Đặt lại bộ lọc" xuất hiện khi có ít nhất 1 bộ lọc khác mặc định.
3. **Thanh Tab Trạng Thái Tinh Gọn (Inline Segmented Pills):**
   - Nằm ngay giữa thanh công cụ: *Tất cả (149)* | *Đang làm (91)* | *Chờ duyệt (5)* | *Quá hạn (1)* | *Hoàn thành (13)*.
   - Badge số lượng sử dụng font mono tabular-nums.
4. **Bộ Chuyển Đổi Chế Độ Xem (View Switcher) & Mật Độ (Density):**
   - Chuyển đổi 1 chạm giữa: `Bảng` (Table) | `Kanban` | `Lịch` (Calendar).
   - Tùy chọn mật độ: `Gọn` (Compact - 38px/row) và `Chuẩn` (Comfortable - 52px/row).

### 3.3. Tái Thiết Kế Bảng Tác Vụ Full-Width Chuẩn Ergonomics
Trả lại 100% chiều ngang màn hình. Các cột được bố trí chặt chẽ, hiển thị đầy đủ thông tin:

| STT | Cột | Độ rộng gợi ý | Kiểu hiển thị | Quy tắc hiển thị & Cảnh báo |
| :---: | :--- | :---: | :--- | :--- |
| 1 | **Chọn** | `w-10` | Checkbox | Chọn hàng loạt để giao việc, đổi trạng thái. |
| 2 | **Mã NV** | `w-28` | Mono `text-xs text-muted-foreground` | Ví dụ: `NV-2026-09-006`. |
| 3 | **Tiêu đề nhiệm vụ** | `min-w-[280px] flex-1` | Text semibold, không truncate quá mức | Hiển thị 2 dòng khi cần, nhãn `[x/y]` khi có việc con. Click mở Side-Sheet. |
| 4 | **Đơn vị & Danh mục** | `w-44` | Tag đơn vị + Badge DACUM | Phòng ban rõ ràng (ví dụ: *Phòng TC-ĐBCL*), màu danh mục dịu mắt. |
| 5 | **Chủ trì (DRI)** | `w-48` | Avatar tròn + Họ tên + Chức danh | Nhận diện người chịu trách nhiệm duy nhất (Single DRI). |
| 6 | **Hạn chót / SLA** | `w-32` | Badge màu trạng thái thời gian | 🔴 Quá hạn (nền đỏ nhạt, text đỏ đậm, `Trễ X ngày`)<br>🟡 Sắp đến hạn $\le 48h$ (nền hổ phách, text cam)<br>⚪ Bình thường (font mono ngày tháng). |
| 7 | **Mức độ ưu tiên** | `w-24` | Icon trực quan + Nhãn | 🔴 Khẩn cấp • 🟡 Cao • 🔵 Trung bình • ⚪ Thấp. |
| 8 | **Trạng thái** | `w-32` | Badge viên thuốc OKLCH | 🟡 Chờ duyệt BGH • 🔵 Đang thực hiện • 🟢 Hoàn thành. |
| 9 | **Tiến độ** | `w-28` | Mini-progress bar + `%` | Thanh phần trăm hoàn thành và nút "Duyệt nhanh" / "Đôn đốc". |

---

## 4. THIẾT KẾ CHI TIẾT: PHÂN HỆ LỊCH CÔNG TÁC (EXECUTIVE CALENDAR)

### 4.1. Tinh Gọn Header & Tích Hợp Chu Kỳ Vận Hành 25-24
Gom dải 12 tháng học thuật và banner chu kỳ 25-24 thành một thanh điều hướng tinh gọn ở đầu trang:
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [📅 Lịch Công Tác & Hạn Chót BGH]                                            [+ Thêm sự kiện / Việc mới] │
│ ◄ Tháng 9 / 2026 (25/08 - 24/09) ►  [Tháng hiện tại]  •  21 hạn chót  •  Chốt số liệu ngày 24 hàng tháng  │
│ [Bộ lọc: Tất cả | Cấp trường | Đơn vị]  [Danh mục ▾]                       [🔍 Lọc lịch công tác...]   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
- Loại bỏ dải 12 nút bấm tháng cồng kềnh; chuyển sang dropdown chọn tháng nhanh hoặc 2 nút mũi tên `◄` `►` kèm nút "Tháng hiện tại".
- Giữ nguyên hiển thị chuẩn chu kỳ học thuật QCET: `25/08/2026 - 24/09/2026`.

### 4.2. Lưới Lịch Tháng Full-Width & Thanh Capsule Trực Quan
- Mở rộng lưới 7 cột chiếm trọn 100% chiều ngang màn hình (`w-full`), loại bỏ cột dead space bên phải.
- **Hiển thị tác vụ trong ô ngày dạng Event Capsules:**
  - Cấp Trường / BGH: Thanh nền xanh tím đậm nhạt với đường viền bên trái (`border-l-2 border-indigo-500 bg-indigo-50/70 text-indigo-900`).
  - Cấp ��ơn vị: Thanh nền xám slate (`border-l-2 border-slate-400 bg-slate-50 text-slate-800`).
  - Hạn chót quá hạn / khẩn: Thanh nền hổ phách đỏ (`border-l-2 border-rose-500 bg-rose-50 text-rose-800`).
- **Chỉ báo áp lực công việc (Workload Intensity Indicator):**
  - Góc trên ô ngày hiển thị badge số lượng việc dạng pill tròn mono: ví dụ `[ 16 ]`.
  - Nếu $> 5$ việc: Ô ngày có viền trên đổi màu nhẹ thể hiện ngày cao điểm.
- **Hover Card / Popover Xem Nhanh:**
  - Khi rê chuột vào ô ngày (hoặc vào nút `+X nhiệm vụ`), một Popover nổi lên hiển thị danh sách đầy đủ tất cả nhiệm vụ trong ngày với trạng thái, người chủ trì và hạn chót.
  - Người dùng không cần click chuyển ngày hay cuộn chuột để biết ngày đó có những việc gì.

---

## 5. THIẾT KẾ CHI TIẾT: SLIDE-OVER SIDE-SHEET (DRAWER PHÊ DUYỆT & CHI TIẾT)

Khi click vào bất kỳ hàng nào trên Bảng hoặc ô sự kiện trên Lịch, một **Side-Sheet trượt mượt mà từ mép phải** (chiều rộng 540px trên màn hình desktop, 100% trên mobile):

### Cấu Trúc Khung Trượt (Drawer Structure):
1. **Header Khung Trượt:**
   - Mã nhiệm vụ (`NV-2026-09-006`) + Badge Trạng thái + Badge Mức độ ưu tiên.
   - Nút Đóng `X` và phím tắt `Esc`.
2. **Nội Dung Chính (Scrollable Canvas):**
   - **Tiêu đề nhiệm vụ:** Cỡ chữ 18px font heading đậm, rõ ràng.
   - **Thông tin điều hành:**
     - Người chủ trì (DRI): Avatar, Họ tên, Đơn vị, Chức vụ.
     - Đơn vị phụ trách chính & Các đơn vị phối hợp.
     - Hạn chót & SLA: Ngày bắt đầu, Ngày đến hạn, Số ngày còn lại.
     - Chu kỳ học thuật: Tháng vận hành tương ứng.
   - **Mô tả & Sản phẩm bàn giao (Deliverables):**
     - Mô tả chi tiết yêu cầu công việc.
     - Danh sách file đính kèm, liên kết nghiệm thu sản phẩm số hóa.
   - **Khối Thẩm Định BGH / Phê Duyệt Cấp Trưởng:**
     - Hiển thị nổi bật khi nhiệm vụ ở trạng thái `WAITING_APPROVAL` hoặc `NEEDS_REVIEW`.
     - Trường nhập "Ý kiến chỉ đạo / Ghi chú phản hồi".
     - Hai nút hành động lớn:
       - 🟢 **Phê duyệt hoàn thành** (Button primary màu ngọc bích emerald).
       - 🟠 **Yêu cầu chỉnh sửa / Trả lại** (Button outline màu cam hổ phách).
   - **Danh sách nhiệm vụ con (Subtasks Tree):**
     - Hiển thị danh sách các việc phân rã cho các chuyên viên với checkbox tiến độ trực ti��p.

---

## 6. KẾ HOẠCH BẢO ĐẢM KỸ THUẬT (ENGINEERING VERIFICATION)

1. **Tuân thủ Engineering Rules:**
   - Không chạy `next build` đè lên `.next` khi dev server đang mở.
   - Giữ nguyên các tệp facade re-export (`src/components/tasks/cascading-task-table.tsx`, `src/components/dashboard/cascading-task-table.tsx`) để bảo toàn 100% các bài unit test hiện có.
2. **Tiêu chuẩn kiểm thử:**
   - `npx tsc --noEmit` đạt 0 lỗi.
   - `npm test` vượt qua toàn bộ 2017+ tests.
   - Viết bổ sung test cases kiểm định hành vi của Unified Toolbar, Full-Width Table và Slide-Over Side-Sheet.

---

Bản đặc tả thiết kế này là kim chỉ nam duy nhất để triển khai mã nguồn trong bước tiếp theo.
