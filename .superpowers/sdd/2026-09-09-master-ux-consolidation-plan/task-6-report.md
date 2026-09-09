# Báo Cáo Nhiệm Vụ 6: Tối Ưu Hóa & Rút Gọn Dashboard Điều Hành BGH (Phase 6)

## 1. Mục Tiêu & Phạm Vi (Objective & Scope)
- Rút gọn toàn bộ dashboard điều hành Ban Giám hiệu (BGH) vừa vặn trong 1–2 màn hình (desktop viewport), chấm dứt tình trạng cuộn trang vô tận.
- Tinh gọn thành thanh 5 KPI chuẩn mực: `Tổng nhiệm vụ`, `Chờ duyệt`, `Trễ / vướng`, `Trọng tâm`, `Tiến độ toàn trường`.
- Xây dựng Hàng đợi Chú ý (Attention Queue) chọn lọc 5–7 mục cấp thiết nhất (chờ phê duyệt, vướng mắc, trễ hạn) với liên kết trực tiếp vào `/tasks?taskId=...`.
- Ma trận tiến độ đơn vị (`DepartmentProgressMatrix`) bổ sung chế độ xếp hạng (ranking) tinh gọn với thanh tiến độ, số lượng hoàn thành/trễ hạn và link điều hướng trực tiếp sang `/tasks?scope=school&dept=<deptId>`.
- Thu gọn widget hạn chót sắp tới (`UpcomingDeadlinesWidget`) và nhật ký hoạt động (`ActivityFeedWidget`) hiển thị mặc định 5 mục với liên kết xem đầy đủ tại `/tasks`.
- Tuyệt đối tuân thủ tiêu chuẩn Anti-slop, Light-Only (0 class `dark:`, 0 emoji trang trí).

## 2. Các Tệp Được Sửa Đổi & Tạo Mới (Files Changed)
- `src/components/dashboard/executive-stat-strip.tsx`:
  - Chuẩn hóa thành 5 KPI cốt lõi: `Tổng nhiệm vụ`, `Chờ duyệt`, `Trễ / vướng`, `Trọng tâm`, `Tiến độ toàn trường`.
  - Thiết kế unified stat strip, mật độ dữ liệu cao, font số học `tabular-nums font-mono`.
- `src/components/dashboard/department-progress-matrix.tsx`:
  - Thêm helper `getDepartmentTasksUrl(deptId)` điều hướng sang `/tasks?scope=school&dept=...`.
  - Tích hợp chế độ `ranking` hiển thị danh sách đơn vị tinh gọn, có thanh tiến độ OKLCH sắc thái, thông tin hoàn tất/trễ hạn.
  - Hỗ trợ click điều hướng hoặc chọn lọc phản hồi tức thì.
- `src/components/dashboard/upcoming-deadlines-widget.tsx`:
  - Giới hạn hiển thị 5 mục gần nhất, thêm link `viewAllHref` sang `/tasks?filter=upcoming`.
  - Nút mở rộng/thu gọn và liên kết xem trên bảng nhiệm vụ.
- `src/components/dashboard/activity-feed-widget.tsx`:
  - Giới hạn hiển thị 5 mục gần nhất, thêm link `auditLogHref` sang `/tasks?view=audit`.
- `src/components/dashboard/executive-cockpit-workspace.tsx`:
  - Tạo không gian buồng lái điều hành (Executive Cockpit Workspace) gọn gàng trong 1–2 viewport.
  - Tích hợp Hàng đợi Chú ý BGH (Attention Queue) với thuật toán ưu tiên (Pending Approval -> Blocked -> Overdue -> High Priority In Progress).
  - Bố trí lưới 2 cột cân bằng: Cột trái (Attention Queue + Tiến độ đơn vị), Cột phải (Hạn chót sắp tới + Nhật ký điều hành).
- `tests/executive-dashboard-streamlining.test.ts`:
  - Bộ 15 bài kiểm tra tự động bao phủ 5 khía cạnh của Phase 6:
    1. 5 KPI Strip chính xác nhãn, giá trị và không có emoji.
    2. Hàng đợi Chú ý ưu tiên đúng các mục cần hành động, loại trừ task đã xong, deep link đúng URL.
    3. Ma trận đơn vị tạo đúng URL `/tasks?scope=school&dept=...`, sắp xếp theo tiến độ và trễ hạn.
    4. Widget hạn chót và nhật ký xử lý dữ liệu và link đúng.
    5. Kiểm định Light-Only & Anti-Slop (0 class `dark:`, 0 emoji trang trí).

## 3. Kết Quả Kiểm Tra (Verification & Test Results)
- TypeScript Typecheck (`npm run typecheck`):
  - Exit code: 0 (Không phát hiện bất kỳ lỗi TypeScript nào).
- Executive Dashboard Tests (`tests/executive-dashboard-streamlining.test.ts`):
  - 15/15 tests passed across 6 test suites.
- Full Project Test Suite (`npm test`):
  - 273/273 tests passed across 96 suites.
  - 0 failures, 0 cancelled, 0 skipped.

## 4. Tình Trạng Hoàn Thành (Status)
- **Status**: DONE
