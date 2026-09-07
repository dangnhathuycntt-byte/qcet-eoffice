# TÀI LIỆU THIẾT KẾ KỸ THUẬT: TÁI CẤU TRÚC KHOANG ĐIỀU HÀNH BAN GIÁM HIỆU (EXECUTIVE RESOLUTION HUB)

**Dự án:** QCET E-Office - Hệ thống Điều hành & Văn phòng số  
**Đơn vị áp dụng:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Ngày lập:** 07/09/2026  
**Trạng thái:** Đã phê duyệt thiết kế (Approved)  
**Tác giả:** QCET Engineering Team & Claude Superpowers  

---

## 1. BỐI CẢNH & MỤC TIÊU CÔNG THÁI HỌC (3–5 GIÂY ĐIỀU HÀNH)

### 1.1. Hiện trạng & Điểm nghẽn thị giác
1. **Trùng lặp 2 tầng Header:** `page.tsx` hiển thị tiêu đề lớn `Khoang Điều Hành Ban Giám Hiệu (Executive Cockpit)` cùng các nút bấm, trong khi component con `executive-cockpit-workspace.tsx` lại hiển thị thêm một header thứ hai với lời chào `Xin chào, {user.name}`, badge và cụm nút trùng lặp.
2. **Thiếu thứ bậc thị giác KPI:** 4 thẻ chỉ số dàn hàng ngang có trọng lượng thị giác tương đương nhau, làm loãng sự chú ý của Lãnh đạo đối với các điểm nghẽn nghiêm trọng.
3. **Card nhiệm vụ cồng kềnh (~140px):** Trưng bày mã kỹ thuật `staff-task-xxx`, chứa khối văn bản nguyên nhân dài dòng và thiếu phân cấp.
4. **Hành động thiếu thực quyền:** Nút `[Tháo gỡ ngay]` hiện tại chỉ mở modal xem chi tiết nhiệm vụ thông thường, không cung cấp công cụ chỉ đạo hay tháo gỡ ách tắc cho BGH.
5. **Lãng phí khoảng trắng bên phải:** Danh sách điểm nghẽn chiếm 100% chiều rộng, trong khi Radar 11 đơn vị bị giấu trong Tab thứ 3.

### 1.2. Mục tiêu thiết kế mới
- **Thời gian nắm bắt thông tin:** 3 đến 5 giây để trả lời ngay: *Cháy ở đâu? Ai làm trễ? Tôi cần tháo gỡ hay phê duyệt gì ngay bây giờ?*
- **Triệt tiêu 2 header thành 1:** Thanh điều hành duy nhất cao ~56px.
- **Hero KPI Card:** Thẻ "Điểm nghẽn cần tháo gỡ" chiếm ưu thế thị giác tuyệt đối (Visual Dominance).
- **Executive Task Card:** Chiều cao tối ưu ~90px, ẩn mã vé, nổi bật tình trạng quá hạn và đơn vị.
- **Executive Resolution Drawer:** 4 phương án tháo gỡ khẩn cấp kèm cơ chế **Optimistic Update** phản hồi tức thì.
- **Bố cục 2 vùng (70/30):** Cột trái danh sách việc tắc nghẽn, Cột phải Mini-radar 11 đơn vị kèm nút `[⚡ Đôn đốc tất cả]`.

---

## 2. THIẾT KẾ CHI TIẾT CÁC THÀNH PHẦN (COMPONENT ARCHITECTURE)

### 2.1. Thanh Điều Hành Duy Nhất (Single Executive Header ~56px)
- **Vị trí:** Tích hợp trực tiếp tại đỉnh của Khoang Điều hành BGH; loại bỏ hoàn toàn khối header ngoài trong `page.tsx` khi `isExecutive = true`.
- **Cấu trúc:**
  ```text
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │ KHOANG ĐIỀU HÀNH BGH                                         [ + Giao nhiệm vụ ] │
  │ TS. Nguyễn Văn Hiệu · 11 đơn vị · 5 điểm nghẽn · 44 chờ duyệt    [ Kho nhiệm vụ ] │
  │                                                                       [ Làm mới ]│
  └──────────────────────────────────────────────────────────────────────────────────┘
  ```
  - **Bên trái:**
    - Tiêu đề chính: `KHOANG ĐIỀU HÀNH BGH` (font-extrabold, 16px, uppercase, tracking-tight).
    - Dòng ngữ cảnh điều hành: `{user.name} · {metrics.totalDepartmentsCount} đơn vị · {metrics.bottlenecksCount} điểm nghẽn · {metrics.pendingInstitutionalApprovalCount} chờ duyệt` (font-medium 13px, màu `text-muted-foreground`, dấu chấm phân cách `text-muted-foreground/40`).
  - **Bên phải:**
    - Nút `[+ Giao nhiệm vụ]` (Button primary, kích thước 38px, icon `Plus`, kích hoạt modal tạo nhiệm vụ BGH).
    - Nút `[Kho nhiệm vụ]` (Button outline, icon `Layers`, liên kết `/tasks`).
    - Nút `[Làm mới]` (Button outline icon `RefreshCw`, xoay khi đang refresh).

---

### 2.2. Thứ Bậc Thị Giác KPI Strip (Visual Dominance)

Bố cục lưới 4 cột (responsive 1 cột trên mobile, 2 cột trên tablet, 4 cột trên desktop):
```text
  ┌───────────────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │ ⚠ 5                   │  │ 44          │  │ 31%         │  │ 212         │
  │ ĐIỂM NGHẼN CẦN THÁO GỠ│  │ CHỜ DUYỆT   │  │ TIẾN ĐỘ     │  │ NHIỆM VỤ    │
  │ 🔴 3 đơn vị bị ảnh hưởng│ │ Chờ BGH ký  │  │ 92/304 việc │  │ Đang chạy    │
  └───────────────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
   ▲ Hero KPI (Visual Dominant)
```

1. **Thẻ 1 - Hero KPI Card (Điểm nghẽn cần tháo gỡ):**
   - **Trạng thái có điểm nghẽn (> 0):**
     - Nền: `bg-rose-500/[0.06]` (Dark mode: `bg-rose-500/[0.1]`).
     - Viền: `border-rose-500/50` với glow `ring-1 ring-rose-500/20`.
     - Số lượng: `text-3xl font-black text-rose-600 dark:text-rose-400`.
     - Tiêu đề: `ĐIỂM NGHẼN CẦN THÁO GỠ` (font-bold text-xs uppercase tracking-wider text-rose-700 dark:text-rose-300).
     - Subtitle động: `🔴 {delayedDeptsCount} đơn vị bị ảnh hưởng`.
   - **Trạng thái giải tỏa hết điểm nghẽn (Zero-Bottleneck State = 0):**
     - Nền: `bg-emerald-500/[0.06]`, viền `border-emerald-500/40`, ring `ring-1 ring-emerald-500/20`.
     - Số lượng: `0` (`text-emerald-600 dark:text-emerald-400`).
     - Subtitle: `🟢 Tiến độ toàn trường thông suốt`.
2. **Thẻ 2 - Hồ sơ chờ duyệt (Secondary Neutral):**
   - Số lượng: `{pendingApprovals}` (28px font-bold text-foreground).
   - Tiêu đề: `HỒ SƠ CHỜ DUYỆT`, Subtitle: `Chờ BGH thẩm định & ký`.
3. **Thẻ 3 - Tiến độ toàn trường (Secondary Neutral):**
   - Số lượng: `{completionRate}%` (28px font-bold text-foreground).
   - Tiêu đề: `TIẾN ĐỘ TOÀN TRƯỜNG`, Subtitle: `{completed}/{total} việc hoàn thành`.
4. **Thẻ 4 - Nhiệm vụ đang chạy (Secondary Neutral):**
   - Số lượng: `{activeTasks}` (28px font-bold text-foreground).
   - Tiêu đề: `NHIỆM VỤ ĐANG CHẠY`, Subtitle: `11 đơn vị triển khai`.

---

### 2.3. Bố Cục 2 Vùng (70% Trái - 30% Phải)

```text
  ┌───────────────────────────────────────────────────┬──────────────────────┐
  │  ĐIỂM NGHẼN CẦN BGH THÁO GỠ (5)                   │ TỔNG QUAN 11 ĐƠN VỊ  │
  │                                                   │                      │
  │  ┌─────────────────────────────────────────────┐  │ CNTT          🔴 2   │
  │  │ 🔴 QUÁ HẠN 3 NGÀY                      CNTT │  │ Phòng Đào tạo 🟢     │
  │  │                                             │  │ Phòng QTTB    🟡 1   │
  │  │ Lập danh sách HSSV diện miễn giảm học phí   │  │ Khoa Cơ khí   🟢     │
  │  │ Lê Hoàng Nam · Hạn 01/09/2026               │  │ Khoa Điện     🟡 1   │
  │  │                                             │  │ Khoa KT-DL    🟢     │
  │  │                     [Đôn đốc]   [ Tháo gỡ ] │  │ ...                  │
  │  └─────────────────────────────────────────────┘  │                      │
  │                                                   │ [⚡ Đôn đốc tất cả]  │
  └───────────────────────────────────────────────────┴──────────────────────┘
```

#### Vùng Trái (70%): Danh sách Card Điểm Nghẽn Tinh Gọn (~90px)
- **Độ cao:** ~90px – 96px, bo góc `rounded-xl`, viền mảnh `border-border/70` hoặc `border-rose-500/30`.
- **Dòng 1:**
  - Trái: Badge `🔴 QUÁ HẠN {N} NGÀY` (hoặc `🔴 ĐANG BỊ TẮC NGHẼN`).
  - Phải: Badge đơn vị `CNTT`, `Phòng Đào tạo`...
- **Dòng 2:** Tiêu đề nhiệm vụ rõ nét (14px font-semibold, `text-foreground`, `line-clamp-1` hoặc `line-clamp-2`).
- **Dòng 3:**
  - Trái: `{assigneeName} · Hạn {dueDate}` (12.5px, `text-muted-foreground`).
  - Phải: Cụm nút:
    - `[Đôn đốc]`: Outline button 32px, phát thông báo đôn đốc tức thì qua Toast.
    - `[Tháo gỡ]`: Button solid Rose/Indigo, mở ngay Drawer Tháo gỡ Điểm nghẽn.

#### Vùng Phải (30%): Mini-Radar Sức Khỏe 11 Đơn Vị
- **Tiêu đề khối:** `TỔNG QUAN 11 ĐƠN VỊ` cùng nút hành động `[⚡ Đôn đốc tất cả]`.
- **Danh sách 11 đơn vị chuẩn QCET:**
  - Hiển thị tên đơn vị ngắn gọn (`Khoa CNTT`, `Phòng Đào tạo`, `Khoa Cơ khí`, `Phòng QTTB`, `Khoa Điện`...).
  - Chấm màu phân loại trực quan:
    - `🔴 {N}`: Có N công việc đang quá hạn hoặc tắc nghẽn.
    - `🟡 {N}`: Có N công việc sắp đến hạn trong 48h.
    - `🟢`: Tất cả đúng tiến độ, không có ách tắc.
  - Tương tác: Bấm vào hàng của đơn vị sẽ lọc nhanh danh sách điểm nghẽn của đơn vị đó; bấm lại để xem tất cả.

---

### 2.4. Drawer "Tháo Gỡ Điểm Nghẽn" (Executive Resolution Drawer)

- **Component:** `ExecutiveResolutionDrawer` (Sheet từ phải sang, rộng 480px–520px).
- **Phím tắt nhanh (Executive Hotkeys):**
  - `Esc`: Đóng Drawer ngay lập tức.
  - `Cmd + Enter` (hoặc `Ctrl + Enter`): Xác nhận chỉ đạo tháo gỡ ngay khi đang focus tại ô bút phê.
- **Nội dung Drawer:**
  1. **Khối Tóm Tắt Nhiệm Vụ:**
     - Tiêu đề công việc (15px font-bold), Tên đơn vị, Cán bộ phụ trách, Hạn chót và Lý do vướng mắc.
  2. **4 Phương Án Quyết Định (Interactive Radio / Option Cards):**
     - **Phương án 1: Gia hạn tiến độ thêm**
       - Lựa chọn: `+ 3 ngày` (mặc định) hoặc `+ 7 ngày` (1 tuần).
       - Hành vi: Cập nhật `dueDate`, gỡ cờ quá hạn.
     - **Phương án 2: Giao nhân sự khác xử lý thay thế**
       - Nhập/chọn tên cán bộ thụ lý mới.
       - Hành vi: Cập nhật `assigneeName`, ghi nhận người chịu trách nhiệm mới.
     - **Phương án 3: Yêu cầu Trưởng đơn vị giải trình khẩn**
       - Chuyển trạng thái sang `WAITING_EXPLANATION` ("Chờ đơn vị giải trình"), phát lệnh thông báo trực tiếp đến Trưởng đơn vị.
     - **Phương án 4: Ban hành chỉ đạo trực tiếp của BGH**
       - Ô textarea nhập bút phê chỉ đạo (placeholder: "Ví dụ: Giao Phòng Đào tạo chủ trì phối hợp giải quyết dứt điểm trước 17h ngày mai").
       - Hành vi: Gỡ cờ `isBlocked = false`, lưu bút phê chỉ đạo vào lịch sử.
  3. **Cơ chế Phản hồi UI (Optimistic Update):**
     - Bấm `[Xác nhận chỉ đạo tháo gỡ]`:
       - Đóng Drawer tức thì (< 50ms).
       - Xóa nhiệm vụ đó khỏi danh sách hiển thị `bottlenecks`.
       - Giảm Hero KPI Card từ `5` xuống `4` (nếu hết việc thì chuyển sang Hero Zero-Bottleneck State `0`).
       - Cập nhật số đếm/chấm màu trên Mini-radar 11 đơn vị.
       - Hiển thị Toast thông báo thành công: *"Đã ban hành chỉ đạo tháo gỡ điểm nghẽn: [Tên nhiệm vụ]"*.

---

## 3. QUY HOẠCH MÃ NGUỒN & CÁC FILE LIÊN QUAN

1. **`src/components/portal/executive-resolution-drawer.tsx` (Mới):**
   - Component Drawer chuyên biệt cho luồng tháo gỡ điểm nghẽn của BGH, hỗ trợ 4 lựa chọn, phím tắt `Esc` và `Cmd/Ctrl + Enter`.
2. **`src/components/portal/executive-cockpit-workspace.tsx` (Tái cấu trúc):**
   - Tích hợp Single Executive Header (56px).
   - Tích hợp Hero KPI Card (Visual Dominance) & Zero-Bottleneck State.
   - Triển khai Bố cục 2 vùng (70% Điểm nghẽn tinh gọn, 30% Mini-radar 11 đơn vị).
   - Quản lý Optimistic State cho danh sách bottlenecks.
3. **`src/app/page.tsx` (Làm sạch):**
   - Loại bỏ hoàn toàn khối header ngoài khi `isExecutive = true`, nhường quyền hiển thị toàn bộ cho thanh điều hành tinh gọn của `ExecutiveCockpitWorkspace`.
4. **`tests/executive-resolution-hub.test.ts` (Mới):**
   - Kiểm thử tự động toàn diện:
     - Header duy nhất khi role BGH.
     - Hero KPI Card phản ánh đúng số lượng và visual hierarchy.
     - 4 phương án tháo gỡ cập nhật state chính xác.
     - Optimistic update giảm số đếm và cập nhật radar 11 đơn vị.

---

## 4. QUY TẮC ĐẢM BẢO CHẤT LƯỢNG (QA & BUILD INVARIANTS)
1. **Tuyệt đối không chạy `next build`** khi dev server đang chạy ở cổng 3001 (tuân thủ nguyên tắc tránh xung đột dev chunks trong `CLAUDE.md`).
2. Kiểm tra tính toàn vẹn kiểu dữ liệu bằng `npm run typecheck` (`tsc --noEmit`).
3. Chạy kiểm thử toàn bộ hệ thống bằng `npm test`.
4. Xác thực trực quan trên Browser Preview.
