---
status: superseded
domain: ux
created: 2026-09-09
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Kế Hoạch Triển Khai: Cải Tiến Toàn Diện UI/UX Executive Dashboard (Anti-Slop & BGH Ergonomics)

> **Mục tiêu:** Tái cấu trúc Information Architecture và trải nghiệm người dùng của Executive Dashboard từ trang cuộn 3000px phân mảnh thành bảng điều khiển điều hành 1-2 khung nhìn (viewports) chuẩn mực công sở hành chính giáo dục, giải quyết triệt để các mâu thuẫn số liệu, lỗi phân trang, nhiễu thị giác nút thao tác, và giải phóng không gian chân trang.

---

## 1. Bối cảnh & Các vấn đề trọng yếu cần giải quyết

1. **Xung đột và bất hợp lý logic số liệu Tầng 1:**
   - Thẻ tiến độ toàn trường hiển thị 40% nhưng chú thích ghi "Hoàn tất 3/107 (3%)" gây hoang mang cho BGH (không rõ 40% là tiến độ khối lượng hay lỗi tính toán).
   - Thẻ "Công việc Đơn vị: 0" chiếm 1 ô lớn dù rỗng.
   - Hai hàng KPI rời rạc (4 thẻ dài phía trên + 3 thẻ vuông phía dưới) gây lãng phí không gian.
2. **Bố cục phân mảnh & kéo dài (Endless Scroll 3000px):**
   - Ma trận 11 đơn vị dạng 11 thẻ vuông chiếm 4 hàng lớn, khó so sánh ai làm tốt, ai đang tắc nghẽn.
   - Chân trang hiển thị toàn bộ 20 mục hạn chót và nhật ký hoạt động máy móc dài vô tận.
3. **Nhiễu thị giác & Lỗi phân trang Tầng 3 (Bảng nhiệm vụ):**
   - Lỗi phân trang: `DEFAULT_PAGE_SIZE = 15` nhưng mảng chọn kích thước trang là `[10, 20, 50, 100]`, dẫn đến hiển thị "1 - 15" trong khi dropdown hiện "10 / trang".
   - Nút "Duyệt nhanh" xuất hiện trên tất cả các dòng `IN_PROGRESS` thay vì chỉ xuất hiện khi nhiệm vụ đang chờ duyệt (`WAITING_APPROVAL` hoặc `needsReview`).
   - Nút "+ Việc con" lặp lại trên mọi dòng.
   - Cột Tên nhiệm vụ và Đơn vị bị bó hẹp trong khi SLA và Ưu tiên thừa chỗ.
   - Cột người chủ trì (DRI) dài dòng chức vụ làm chật bảng.

---

## 2. Thiết kế chi tiết theo 4 Tầng Điều Hành

### Tầng 1: Dải KPI Điều Hành 5 Chỉ Số Duy Nhất (Single Consolidated Strip)
- **Tệp tin tác động:**
  - `src/components/dashboard/executive-stat-strip.tsx`
  - `src/components/dashboard/dashboard-zone.tsx`
- **Thay đổi:**
  - Gom toàn bộ 2 hàng thẻ KPI thành 1 hàng 5 thẻ duy nhất:
    1. `Tổng nhiệm vụ cấp Trường`: Số lượng tổng (kèm phân rã: X đang làm · Y chưa bắt đầu).
    2. `Chờ BGH phê duyệt`: Highlight cảnh báo Amber nếu $> 0$ (cho phép click để lọc nhanh danh sách chờ duyệt).
    3. `Vướng mắc & Trễ hạn`: Highlight cảnh báo Rose nếu $> 0$ (cho phép click để lọc danh sách trễ).
    4. `Nhiệm vụ trọng tâm`: Số lượng nhiệm vụ chiến lược năm học.
    5. `Tiến độ thực hiện toàn trường`: Hiển thị thanh tiến độ 40% kèm chú thích minh bạch: **"Khối lượng thực hiện: 40% (Đã nghiệm thu: 3/107 ~ 3%)"**.
  - Xóa bỏ hoàn toàn thẻ rỗng `Công việc Đơn vị: 0` trên giao diện BGH.
  - Loại bỏ khối 3 thẻ vuông trùng lặp bên dưới (`ExecutiveActionCenter`), tích hợp gọn gàng danh sách 1-2 việc chỉ đạo cấp bách (Executive Emergency Strip) ngay dưới dải KPI.

### Tầng 2: Xếp hạng tiến độ 11 Đơn vị dạng Thanh ngang (Ranking Bar Chart)
- **Tệp tin tác động:**
  - `src/components/dashboard/department-progress-matrix.tsx`
- **Thay đổi:**
  - Chế độ hiển thị mặc định: **Thanh ngang xếp hạng (Ranking Bar Chart)** thay vì lưới 11 card vuông.
  - Sắp xếp thông minh: Các đơn vị có việc trễ hạn/vướng mắc được đẩy lên đầu (kèm badge cảnh báo), tiếp theo là xếp theo tiến độ từ cao xuống thấp.
  - Mỗi hàng đơn vị hiển thị: Tên khoa/phòng, Trưởng đơn vị, Thanh tiến độ màu động ($\ge 80\%$ Xanh lá, $50-79\%$ Vàng, $< 50\%$ Đỏ hồng), chỉ số Hoàn thành / Đang làm / Trễ.
  - **Tương tác lọc & Nút Reset:** Click vào 1 đơn vị để lọc bảng nhiệm vụ Tầng 3; hiển thị trạng thái `Active` rõ ràng kèm nút **"Xem toàn trường (Reset)"** để BGH quay lại trạng thái ban đầu trong 1 click.
  - Giữ lại nút toggle sang dạng Bảng rút gọn (Compact Table) cho người dùng muốn xem dạng bảng số liệu chi tiết.

### Tầng 3: Tinh chỉnh Bảng nhiệm vụ & Khắc phục triệt để lỗi phân trang
- **Tệp tin tác động:**
  - `src/components/tasks/table/constants.ts`
  - `src/components/tasks/table/components/task-row.tsx`
  - `src/components/tasks/table/components/task-table-header.tsx`
  - `src/components/tasks/table/components/task-pagination-bar.tsx`
  - `src/components/tasks/table/modular-cascading-task-table.tsx`
- **Thay đổi:**
  - **Đồng bộ phân trang:** Thiết lập `DEFAULT_PAGE_SIZE = 10` (đồng bộ với `DEFAULT_PAGE_SIZES = [10, 20, 50, 100]`), chấm dứt triệt để lỗi lệch số liệu "Hiển thị 1 - 15 nhưng dropdown chọn 10 / trang".
  - **Khử nhiễu nút thao tác:**
    - `Duyệt nhanh`: Chỉ hiển thị khi `task.status === "WAITING_APPROVAL"` hoặc `task.approvalStatus === "PENDING"` hoặc `task.needsReview === true`.
    - `+ Việc con`: Không xuất hiện cố định tràn lan trên mọi dòng. Đưa vào Task Detail Drawer hoặc menu thao tác cuối dòng.
  - **Tái phân bổ độ rộng cột (Column Ergonomics):**
    - Cột `Nhiệm vụ cấp Trường`: Mở rộng tối đa (`min-w-[280px]`, chiếm phần không gian thừa).
    - Cột `Đơn vị & Danh mục`: Đạt `w-44`.
    - Cột `Chủ trì (DRI)`: Hiển thị Avatar tròn nhỏ + Họ tên viết gọn, chức vụ đưa vào tooltip để nhường không gian cho nội dung.
    - Cột `Thời hạn & SLA`: Thu gọn vừa vặn `w-28`.
    - Cột `Ưu tiên`: Thu gọn `w-20`.

### Chân trang: Top 5 Hạn chót & Ngăn kéo Nhật ký (Drawer)
- **Tệp tin tác động:**
  - `src/components/dashboard/upcoming-deadlines-widget.tsx`
  - `src/components/dashboard/activity-feed-widget.tsx`
  - `src/components/dashboard/dashboard-zone.tsx`
- **Thay đổi:**
  - `Hạn chót 7 ngày tới`: Thu gọn danh sách hiển thị đúng **5 nhiệm vụ sát hạn nhất**, có nút bấm *"Xem tất cả (X việc)"* để mở Drawer hoặc Modal danh sách đầy đủ.
  - `Nhật ký hoạt động`: Chuyển thành Drawer trượt ra (hoặc nút bấm *"Nhật ký vận hành"* ở góc Header/Widget), không còn chiếm hẳn 1 cột 20 dòng gây kéo dài trang vô ích.

---

## 3. Kế hoạch kiểm thử & Đảm bảo chất lượng (QA Plan)

1. **Unit & Logic Tests:**
   - Cập nhật và bổ sung tests cho `executive-stat-strip.test.ts`: kiểm tra 5 thẻ KPI hợp nhất, kiểm tra nhãn minh bạch "Khối lượng thực hiện vs Đã nghiệm thu".
   - Cập nhật tests cho `department-progress-matrix.test.ts`: kiểm tra chế độ Ranking Bar, tương tác click-to-filter và nút reset về toàn trường.
   - Cập nhật tests cho `task-pagination-bar.test.ts` & `cascading-task-table.test.ts`: kiểm tra đồng bộ pageSize 10, hiển thị đúng 1 - 10 / 21.
   - Kiểm tra điều kiện render của nút "Duyệt nhanh": chỉ render khi `WAITING_APPROVAL`.
2. **Quality Gates:**
   - `npm run typecheck` - 0 lỗi TypeScript.
   - `npm test` - toàn bộ test suites xanh (pass 100%).
   - Kiểm tra giao diện qua test DOM snapshot / visual assertions.

---

## 4. Các bước triển khai tuần tự

- [ ] **Bước 1:** Tinh chỉnh hằng số và logic phân trang trong `src/components/tasks/table/constants.ts` và `task-pagination-bar.tsx`.
- [ ] **Bước 2:** Cập nhật `src/components/tasks/table/components/task-row.tsx` và `task-table-header.tsx` để tối ưu độ rộng cột, chỉ hiện "Duyệt nhanh" khi chờ duyệt, tinh gọn cột DRI.
- [ ] **Bước 3:** Cập nhật `src/components/dashboard/executive-stat-strip.tsx` để tạo dải 5 KPI hợp nhất, xóa thẻ rỗng, làm rõ tiến độ khối lượng vs nghiệm thu.
- [ ] **Bước 4:** Tối ưu hóa `src/components/dashboard/department-progress-matrix.tsx` với giao diện Ranking Bar trực quan, click-to-filter và nút Reset.
- [ ] **Bước 5:** Rút gọn chân trang trong `upcoming-deadlines-widget.tsx` (Top 5 + Drawer xem tất cả) và `activity-feed-widget.tsx` / `dashboard-zone.tsx` (Drawer mở nhật ký).
- [ ] **Bước 6:** Tích hợp đồng bộ trong `src/components/dashboard/dashboard-zone.tsx`.
- [ ] **Bước 7:** Cập nhật unit tests, ch���y `npm run typecheck` và `npm test` để xác nhận tất cả pass.
