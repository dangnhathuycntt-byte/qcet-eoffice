# Kế Hoạch Triển Khai: Hệ Thống Điều Hành Phân Cấp 3 Cấp (Role-Adaptive Cockpit)

> **Mục tiêu:** Tái cấu trúc trang chủ điều hành, giải quyết triệt để vấn đề "BGH vào thấy ngập việc" bằng việc bổ sung Executive Action Center, Ma trận Tiến độ Khoa/Phòng và tối ưu bộ lọc cho từng vai trò.

---

## Global Constraints
- Zero emojis in UI / code (100% anti-slop rule).
- Dùng Lucide icons với `strokeWidth={1.5}`.
- Font số luôn dùng `font-mono tabular-nums`.
- Các màu trạng thái tuân thủ chuẩn Enterprise: Slate/Indigo/Amber/Emerald/Rose.
- Mọi logic phải có unit test đi kèm và đạt 100% test pass.

---

## Danh Sách Nhiệm Vụ (Tasks)

### Task 1: Xây dựng Helper & Logic Tổng hợp Ma trận Điều hành BGH
- **Mục tiêu:** Tạo file `src/lib/executive-matrix-aggregator.ts` để tính toán:
  1. Thống kê hành động nhanh của BGH (`ExecutiveActionStats`):
     - `pendingSchoolApprovalCount`: Các nhiệm vụ cấp Trường có tiến độ 100% nhưng trạng thái chưa là COMPLETED, hoặc có subtask cần duyệt.
     - `blockedTasksCount`: Số tác vụ bị `BLOCKED` (vướng mắc).
     - `overdueTasksCount`: Số tác vụ quá hạn (`isTaskPastDue`).
     - `strategicActiveCount`: Số nhiệm vụ cấp Trường đang triển khai (`IN_PROGRESS`).
  2. Thống kê theo Khoa/Phòng (`DepartmentHealthSummary[]`):
     - Duyệt qua từng phòng ban theo danh mục `DEPARTMENT_OPTIONS`.
     - Tính tổng số nhiệm vụ cấp trường & cấp đơn vị của phòng ban.
     - Tính % tiến độ trung bình của phòng ban.
     - Đếm số việc trễ hạn và số việc bị vướng mắc của phòng ban đó.
- **Files tạo/chỉnh sửa:**
  - `src/lib/executive-matrix-aggregator.ts`
  - `tests/executive-matrix-aggregator.test.ts`
- **Kiểm thử:** Viết unit test kiểm tra logic tính toán với mock tasks.

---

### Task 2: Xây dựng UI Component `ExecutiveActionCenter` & `DepartmentProgressMatrix`
- **Mục tiêu:** 
  1. Tạo component `src/components/dashboard/executive-action-center.tsx`:
     - 3 thẻ tương tác: "Chờ BGH Phê duyệt / Nghiệm thu", "Cảnh báo Vướng mắc & Trễ hạn", "Nhiệm vụ Chiến lược Đang chạy".
     - Hỗ trợ click để kích hoạt bộ lọc tương ứng.
  2. Tạo component `src/components/dashboard/department-progress-matrix.tsx`:
     - Grid hiển thị danh sách các Khoa/Phòng.
     - Thẻ mỗi đơn vị gồm: Tên đơn vị, Trưởng đơn vị, Tiến độ %, Badge cảnh báo nếu có trễ hạn/vướng mắc.
     - Khi click thẻ đơn vị: kích hoạt `onSelectDepartment(deptId)` và highlight thẻ được chọn.
- **Files tạo/chỉnh sửa:**
  - `src/components/dashboard/executive-action-center.tsx`
  - `src/components/dashboard/department-progress-matrix.tsx`
  - `tests/executive-components.test.ts`
- **Kiểm thử:** Render test và kiểm tra sự kiện click / class highlight.

---

### Task 3: Tích hợp Executive Cockpit vào `src/app/page.tsx` và Tinh chỉnh Bảng Nhiệm vụ
- **Mục tiêu:**
  1. Trong `src/app/page.tsx`:
     - Nhận biết vai trò BGH: `const isExecutive = user?.role === 'ADMIN';`
     - Khi là BGH:
       - Hiển thị `ExecutiveActionCenter` và `DepartmentProgressMatrix` phía trên bảng công việc.
       - Tích hợp bộ lọc từ `ExecutiveActionCenter` (`PENDING_APPROVAL`, `BLOCKED_OVERDUE`, `STRATEGIC`) vào `filterTasksHub`.
  2. Trong `src/components/dashboard/cascading-task-table.tsx`:
     - Khi ở góc nhìn BGH (`isExecutiveView`), mặc định không mở rộng (`expandedTasks` rỗng), hiển thị gọn gàng danh mục nhiệm vụ chiến lược cấp Trường.
     - Giúp BGH quan sát trực quan toàn bộ trường mà không bị rối mắt bởi hàng trăm tác vụ con.
- **Files tạo/chỉnh sửa:**
  - `src/app/page.tsx`
  - `src/components/dashboard/cascading-task-table.tsx`
  - `src/lib/unified-task-hub.ts`
  - `tests/executive-dashboard-integration.test.ts`
- **Kiểm thử:** Đảm bảo trang chính biên dịch tốt, kiểm thử tích hợp đầy đủ.

---

### Task 4: Kiểm Thử Toàn Diện, Audit Anti-slop & Xác Minh Trên Trình Duyệt
- **Mục tiêu:**
  - Chạy toàn bộ test suite (`npm test`).
  - Kiểm tra Next.js production build (`npm run build`).
  - Dùng MCP Browser preview để xác minh thực tế giao diện BGH vs Trưởng phòng vs Nhân viên.
- **Files tạo/chỉnh sửa:**
  - Chạy các test audit và chụp màn hình xác minh.
