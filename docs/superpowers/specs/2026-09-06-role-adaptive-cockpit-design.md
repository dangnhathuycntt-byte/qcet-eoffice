# Đặc tả Thiết kế: Hệ thống Điều hành Phân cấp 3 Cấp (Role-Adaptive Cockpit)

## 1. Bối cảnh & Vấn đề giải quyết
Hiện tại, khi Ban Giám hiệu (Hiệu trưởng/BGH) đăng nhập vào hệ thống, giao diện mặc định đang hiển thị bảng tổng hợp dồn toàn bộ hàng trăm nhiệm vụ và tác vụ con của các đơn vị (Information Overload). Điều này khiến BGH gặp khó khăn trong việc nắm bắt nhanh các nhiệm vụ chiến lược, điểm nghẽn và những công việc thực sự cần BGH phê duyệt.

Mục tiêu thiết kế:
- Tái cấu trúc trải nghiệm theo 3 vai trò phân cấp rõ ràng (BGH - Trưởng đơn vị - Nhân viên).
- Cung cấp **Executive Cockpit (Khoang điều hành Ban Giám hiệu)**: Giúp BGH nắm bắt sức khỏe toàn trường trong 30 giây, chỉ tập trung vào việc cần phê duyệt và điểm nghẽn của các khoa/phòng.
- Giữ nguyên luồng xử lý chi tiết cho Trưởng đơn vị (`UNIT_TASKS`) và Nhân viên (`MY_TASKS`).

---

## 2. Kiến trúc 3 Góc nhìn Phân cấp (Role-Adaptive Cockpits)

### 2.1. Góc nhìn Ban Giám hiệu (Hiệu trưởng - `ADMIN`)
Khi người dùng có vai trò `ADMIN`:
1. **Executive Action Center (Hộp việc Hành động Nhanh của BGH)**:
   - Thẻ 1: **Chờ BGH Phê duyệt / Nghiệm thu Cấp Trường**: Các nhiệm vụ cấp Trường đã đạt 100% hoặc các đề xuất cần BGH phê duyệt.
   - Thẻ 2: **Điểm nghẽn & Cảnh báo Trễ hạn**: Các nhiệm vụ cấp đơn vị bị báo cáo `BLOCKED` hoặc quá hạn cần BGH chỉ đạo xử lý.
   - Thẻ 3: **Nhiệm vụ Chiến lược Đang chạy**: Tổng số nhiệm vụ cấp trường trọng tâm đang triển khai.
2. **Department Progress Matrix (Ma trận Tiến độ Khoa / Phòng)**:
   - Hiển thị danh sách các thẻ trực quan cho từng Khoa/Phòng (Phòng Đào tạo, Khoa CNTT, Phòng Hành chính, v.v.).
   - Mỗi thẻ hiển thị: Tên đơn vị, Trưởng đơn vị, Số lượng nhiệm vụ, Thanh tiến độ %, Số lượng trễ hạn/vướng mắc.
   - Khi BGH bấm vào một Khoa/Phòng: Bảng lọc ngay lập tức theo Khoa/Phòng đó (`selectedDepartment = deptId`).
3. **Danh mục Nhiệm vụ Chiến lược Cấp Trường**:
   - Mặc định chỉ hiển thị danh sách `SchoolTask` (Nhiệm vụ cấp Trường), ẩn hoàn toàn các việc con của nhân viên trừ khi BGH chủ động bấm mở rộng hàng để soi chi tiết.

### 2.2. Góc nhìn Trưởng đơn vị (Trưởng Khoa/Phòng - `MANAGER`)
- Mặc định vào tab `UNIT_TASKS` (Công việc Đơn vị của mình).
- Phân loại: *Việc đơn vị chủ trì*, *Phiếu phối hợp liên đơn vị*, *Việc cần Trưởng phòng nghiệm thu*.
- Theo dõi phân bổ tải công việc của từng nhân viên trong đơn vị.

### 2.3. Góc nhìn Nhân viên (Chuyên viên / Giảng viên - `STAFF`)
- Mặc định vào tab `MY_TASKS` (Việc của tôi).
- Chỉ hiển thị danh sách tác vụ được giao trực tiếp cho cá nhân.
- Tác vụ thường quy: Tự bấm hoàn thành 1-click.
- Tác vụ trọng điểm / DACUM: Bắt buộc đính kèm link minh chứng và nộp Trưởng phòng duyệt.

---

## 3. Thiết kế Kỹ thuật & Component Mới

### 3.1. Component `ExecutiveActionCenter`
- File: `src/components/dashboard/executive-action-center.tsx`
- Nhận props: `tasks: SchoolTask[]`, `onSelectFilter: (filter: 'PENDING_APPROVAL' | 'BLOCKED_OVERDUE' | 'STRATEGIC') => void`, `activeFilter: string`.
- Tính toán chính xác các con số từ `SchoolTask` và `StaffTask`.

### 3.2. Component `DepartmentProgressMatrix`
- File: `src/components/dashboard/department-progress-matrix.tsx`
- Nhận props: `tasks: SchoolTask[]`, `selectedDepartment: string`, `onSelectDepartment: (dept: string) => void`.
- Tính toán thống kê theo từng phòng ban: Tổng số việc, Tiến độ trung bình, Việc trễ hạn, Việc bị vướng mắc (`BLOCKED`).

### 3.3. Tối ưu hóa `UnifiedTaskHubContent` (`src/app/page.tsx`) & `cascading-task-table.tsx`
- Bổ sung cờ `isExecutiveView = user?.role === 'ADMIN'`.
- Khi `isExecutiveView` kích hoạt:
  - Hiển thị `ExecutiveActionCenter` và `DepartmentProgressMatrix` phía trên bảng công việc.
  - Bảng nhiệm vụ tự động co gọn mặc định (`defaultExpanded: false`), tập trung vào tiến độ chiến lược cấp trường.
- Bổ sung bộ lọc cho `activeFilter` từ Action Center.

---

## 4. Kế hoạch Kiểm thử & Tiêu chuẩn Anti-Slop
- 100% tuân thủ thiết kế Anti-slop: Không dùng emoji trang trí, dùng Lucide icons với `strokeWidth={1.5}`, dùng font số `font-mono tabular-nums`.
- Viết unit test cho:
  1. `ExecutiveActionCenter` (đếm đúng số việc chờ duyệt, số việc blocked, số việc trễ hạn).
  2. `DepartmentProgressMatrix` (tổng hợp đúng tiến độ theo từng phòng ban).
  3. Lọc theo vai trò BGH trong `UnifiedTaskHub`.
