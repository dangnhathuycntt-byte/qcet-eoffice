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
  - Hỗ trợ rendering 5 KPI khi `isExecutive || executiveStats` với fallback mượt mà từ `stats` cơ bản khi `executiveStats` chưa khởi tạo xong.
- `src/components/dashboard/zones/dashboard-zone.tsx`:
  - Truyền đầy đủ `isExecutive={isExecutive}` và `executiveStats={executiveStats}` sang `<ExecutiveStatStrip />`.
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
  - Khắc phục Anti-slop ở trạng thái trống (empty state): loại bỏ icon enclosure tròn khổ lớn (`rounded-full bg-emerald-500/10`), thay bằng banner thông báo ngang tối giản, thanh lịch, chuẩn mực hành chính.
  - Bố trí lưới 2 cột cân bằng: Cột trái (Attention Queue + Tiến độ đơn vị), Cột phải (Hạn chót sắp tới + Nhật ký điều hành).
- `tests/executive-dashboard-streamlining.test.ts`:
  - Bộ 18 bài kiểm tra tự động bao phủ toàn diện:
    1. 5 KPI Strip chính xác nhãn, giá trị và không có emoji.
    2. Hỗ trợ view 5-KPI khi `isExecutive={true}` không có `executiveStats`, và 4-KPI cho non-executive.
    3. Hàng đợi Chú ý ưu tiên đúng các mục cần hành động, loại trừ task đã xong, deep link đúng URL.
    4. Ma trận đơn vị tạo đúng URL `/tasks?scope=school&dept=...`, sắp xếp theo tiến độ và trễ hạn.
    5. Widget hạn chót và nhật ký xử lý dữ liệu và link đúng.
    6. Kiểm định Light-Only & Anti-Slop (0 class `dark:`, 0 emoji trang trí, 0 icon enclosure tròn cồng kềnh trong empty state).

## 3. Xử Lý Phản Hồi Đánh Giá (Review Feedback Resolutions)
1. **5-KPI Strip Điều Hành (`executive-stat-strip.tsx`)**:
   - Chuyển `isExecutiveView = Boolean(isExecutive || executiveStats)` thay vì `&&`.
   - Bổ sung logic fallback trong `getExecutiveStatCardData` để khi `executiveStats` vắng mặt vẫn hiển thị đúng 5 KPI tương ứng (`needsReviewTasksCount`, `overdueTasksCount`, 0 trọng tâm, và `averageSchoolProgressPercent`).
2. **Dashboard Zone (`dashboard-zone.tsx`)**:
   - Đảm bảo truyền đủ props `isExecutive={isExecutive}` và `executiveStats={executiveStats}` xuống `<ExecutiveStatStrip />`.
3. **Anti-Slop Trạng Thái Rỗng Attention Queue (`executive-cockpit-workspace.tsx`)**:
   - Loại bỏ hoàn toàn khối hình tròn màu to `h-10 w-10 rounded-full bg-emerald-500/10`.
   - Thay thế bằng khung thông báo ngang nhỏ gọn, viền `border-emerald-500/20` mỏng, nền `bg-emerald-50/40`, icon `CheckCircle2` kích thước 16px thanh thoát.
4. **Kiểm Thử Tự Động (`tests/executive-dashboard-streamlining.test.ts`)**:
   - Thêm test case xác thực `isExecutive={true}` không có `executiveStats` hiển thị chính xác 5 KPI.
   - Thêm test case kiểm định loại bỏ icon enclosure tròn ở empty state.

## 4. Kết Quả Kiểm Tra (Verification & Test Results)
- TypeScript Typecheck (`npm run typecheck`):
  - Exit code: 0 (Không có lỗi TypeScript nào).
- Executive Dashboard Tests (`tests/executive-dashboard-streamlining.test.ts`):
  - 18/18 tests passed across 6 test suites (100% pass).
- Full Project Test Suite (`npm test`):
  - 329/329 tests passed across 109 suites.
  - 0 failures, 0 cancelled, 0 skipped.

## 5. Tình Trạng Hoàn Thành (Status)
- **Status**: DONE
- **Commit**: `25fa1d20b5be42543950a121dcce6315ed8e3b71` (`fix(dashboard): resolve executive 5-kpi strip rendering and attention queue anti-slop`)
