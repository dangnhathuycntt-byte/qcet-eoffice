# Đặc Tả Thiết Kế (Design Spec): Tái Cấu Trúc UI/UX Bàn Làm Việc & Lịch Làm Việc (Anti-Slop Enterprise Redesign)

- **Ngày ban hành**: 2026-09-09
- **Trạng thái**: Dự thảo chờ phê duyệt
- **Dự án**: QCET E-Office
- **Mục tiêu**: Loại bỏ triệt để AI slop, thiết lập chuẩn mực giao diện điều hành công sở giáo dục cao cấp (Quiet UI / Single Source of Truth), đồng bộ hoá không gian Bàn làm việc (Workspace/Dashboard) và Lịch làm việc (Executive Calendar).

---

## 1. Bối Cảnh & Kiểm Toán Hiện Trạng (Audit & Problem Statement)

### 1.1. Hiện Trạng Bàn Làm Việc (`/`, `dashboard-zone.tsx`, `unified-adaptive-workspace.tsx`)
1. **Chồng chéo thẻ chỉ số (Redundant KPI Stacking)**:
   - Trong khoảng 200px dọc màn hình, xuất hiện đồng thời `ExecutiveStatStrip` (4 thẻ: Trường, Đơn vị, Cần xử lý, Hoàn thành) và ngay bên dưới là `ExecutiveActionCenter` (3 thẻ: Chờ BGH Phê duyệt, Vướng mắc & Trễ hạn, Kế hoạch chiến lược).
   - Thông tin về công việc trễ hạn và cần xử lý bị trùng lặp 2 lần với các con số tính toán phân mảnh, gây nhiễu nhận thức cho Ban Giám Hiệu.
2. **Vỡ layout khi phát sinh công việc (Layout Shift Bug)**:
   - Khi có `pendingTriageCount > 0` hoặc `escalatedReviewCount > 0`, `ExecutiveStatStrip` tự động `push()` thêm 1-2 thẻ vào lưới `grid-cols-2 lg:grid-cols-4 divide-x`, làm lưới 4 cột bị rớt thành 5 hoặc 6 thẻ lẻ loi, đường chia `divide-x` bị gãy.
3. **Dead Click (Tương tác chết)**:
   - Bấm vào các thẻ KPI của `ExecutiveStatStrip` hoặc `ExecutiveActionCenter` trên `DashboardZone` chỉ cập nhật state ngầm trong Context mà **không** có bất kỳ bảng dữ liệu hay tác vụ nào phản hồi bên dưới, khiến người dùng lầm tưởng giao diện bị đơ.
4. **Cảnh báo quá hạn 3 tầng (Alert Fatigue)**:
   - Xuất hiện cùng lúc `PriorOverdueBacklogBanner` ở đầu trang, banner trong `CascadingTaskTable`, và cảnh báo trong `UniversalActionQueue`. Người dùng bị quá tải bởi các cảnh báo màu đỏ/vàng cam.
5. **AI Slop & Mã nguồn rác (Dead Code)**:
   - Tệp `src/components/portal/bento-portal-hub.tsx` (>25KB, lồng ghép bento 12 cột rườm rà) và `executive-cockpit-workspace.tsx` (>2.400 dòng) không còn nằm trong luồng render thực tế nhưng vẫn tồn tại gây nặng bundle và rối loạn bảo trì.
   - Các hiệu ���ng viền phát sáng `ring-indigo-500/20`, chấm nhấp nháy `animate-pulse`, dải tag màu cầu vồng (rainbow tags) rải rác làm mất đi tính trang nghiêm của cơ quan hành chính.

### 1.2. Hiện Trạng Lịch Làm Việc (`/calendar`, calendar widgets)
1. **Điều hướng vòng lặp & Phân mảnh (Routing Fragment)**:
   - Truy cập `/calendar` bị redirect client-side về `/?view=calendar` gây chớp màn hình (flash of blank/spinner).
2. **Thiếu trải nghiệm Lịch điều hành chuẩn mực**:
   - Giao diện lịch hiện tại chỉ dừng lại ở các khối widget đơn sơ hoặc bảng danh sách tĩnh, thiếu chế độ Time-Grid tuần chuẩn (như Cron/Notion Calendar) để Ban Giám hiệu nắm bắt lịch họp, lịch công tác tuần và hạn chót đề án trọng điểm.
3. **Màu sắc và phân loại sự kiện lộn xộn**:
   - Thiếu bảng màu ngữ nghĩa có kiểm soát. Màu sự kiện xung đột với màu trạng thái công việc (xanh dương, xanh lá, hổ phách, đỏ hoa hồng).
4. **Không phát hiện xung đột lịch (Schedule Collision)**:
   - Chưa có chỉ báo trực quan khi 2 cuộc họp hoặc sự kiện trùng khung giờ.

---

## 2. Nguyên Tắc Thiết Kế Cốt Lõi (Core Principles)

1. **Quiet UI & High Information Density**:
   - Loại bỏ toàn bộ gradient trang trí vô nghĩa, viền glow và các box bento lồng nhau vô tận.
   - Sử dụng đường kẻ mảnh chuẩn sắc nét (`border-border`, 1px solid OKLCH), nền trắng thuần khiết (`bg-card`), nền trang màu xám ấm điều hành (`bg-background: oklch(0.985 0.003 250)`).
2. **Single Source of Truth (Một nguồn sự thật duy nhất cho KPI)**:
   - Hợp nhất toàn bộ chỉ số vào một dải `ExecutiveStatStrip` tinh chuẩn duy nhất gồm đúng 4 cột cố định.
   - Khi có việc khẩn cấp phát sinh (Chờ BGH duyệt, Trễ hạn, Cần thẩm định), các chỉ báo sẽ hiển thị trực quan dưới dạng badge tích hợp ngay bên trong thẻ liên quan, tuyệt đối không chèn thêm thẻ làm vỡ lưới.
3. **Action-Oriented & Click-to-Resolve (Tương tác tức thì)**:
   - Mọi cú click vào thẻ KPI hoặc mục hành động đều kích hoạt phản hồi tức thì: mở Drawer/Modal phê duyệt nhanh hoặc cuộn/lọc chính xác bảng công việc tương ứng.
4. **Light-Only & Typography Floor Bất Di Bất Dịch**:
   - Không hỗ trợ Dark mode (`@custom-variant dark (&:not(*));`).
   - Font chữ: `Plus Jakarta Sans` (Heading), `Be Vietnam Pro` (Body text), `JetBrains Mono` (Số liệu & mốc giờ).
   - Tuyệt đối không sử dụng cỡ chữ dưới 12px (`text-xs`). Các số liệu thời gian và tiến độ luôn dùng `.tabular-nums`.

---

## 3. Kiến Trúc Chi Tiết: Bàn Làm Việc (Command Center Workspace)

### 3.1. Bố Cục Trang Bàn Làm Việc (`src/components/dashboard/zones/dashboard-zone.tsx`)

Bố cục trang gồm 4 phân tầng có trật tự rõ ràng từ trên xuống dưới:

```
+-------------------------------------------------------------------------+
| 1. Page Header & Scope Context (Tuần đào tạo, Lọc khối/đơn vị, Nút tạo)   |
+-------------------------------------------------------------------------+
| 2. Single Source of Truth KPI Strip (4 Cột cố định, Tabular Nums)        |
|    [ Toàn trường ] | [ Cần BGH duyệt ] | [ Vướng mắc / Trễ ] | [ Hoàn tất ]  |
+-------------------------------------------------------------------------+
| 3. Split Command Panel (Tỷ lệ 7:5 trên Desktop)                         |
|    - Cột Trái (7): Urgent Action Inbox (Danh sách việc cần BGH xử lý ngay)|
|    - Cột Phải (5): Department Health Matrix (Tiến độ 11 Đơn vị/Phòng ban)|
+-------------------------------------------------------------------------+
| 4. Focus Workspace / Cascading Task Table (Bảng nhiệm vụ liên thông)   |
|    (Tự động đồng bộ và lọc theo thẻ KPI hoặc đơn vị được chọn ở trên)   |
+-------------------------------------------------------------------------+
```

### 3.2. Thiết Kế Lại Dải Chỉ Số `ExecutiveStatStrip`
- **Cấu trúc 4 ô KPI cố định (`grid grid-cols-2 lg:grid-cols-4`)**:
  1. **Nhiệm vụ Toàn trường**: Tổng số nhiệm vụ đang hoạt động trong kỳ. Nhấp vào hiển thị toàn bộ nhiệm vụ.
  2. **Chờ BGH Xử lý**: Gộp các đề xuất cần phê duyệt (`pendingApproval`), báo cáo cần thẩm định (`escalatedReview`). Đi kèm badge màu hổ phách (`oklch(0.74 0.17 75)`). Nhấp vào kích hoạt bộ lọc xem ngay danh sách chờ duyệt.
  3. **Vướng mắc & Trễ hạn**: Tổng số nhiệm vụ quá hạn hoặc bị đánh dấu nghẽn tiến độ. Đi kèm badge hoa hồng (`oklch(0.63 0.22 25)`). Nhấp vào hiển thị danh sách rủi ro.
  4. **Tỷ lệ Hoàn thành**: Phần trăm tiến độ chung và số lượng nhiệm vụ đã nghiệm thu (`oklch(0.68 0.17 150)`).
- **Loại bỏ**: Cơ chế `items.push(...)` gây vỡ lưới 4 cột.
- **Tương tác**: Click vào từng ô sẽ emit sự kiện `onSelectFilter(key)`, chuyển trực tiếp trạng thái sang bảng nhiệm vụ bên dưới với hiệu ứng focus m��ợt mà, loại bỏ triệt để hiện tượng Dead Click.

### 3.3. Tích Hợp `Urgent Action Inbox` Thay Thế Cho Các Khối Rời Rạc
- Thay vì phân tán thành 3 thẻ của `ExecutiveActionCenter` và 1 danh sách của `UpcomingDeadlinesWidget`, gom thành một **Inbox Điều Hành Tập Trung**:
  - Mỗi mục trong Inbox có đầy đủ thông tin nhưng gọn gàng: Tiêu đề, Đơn vị chủ trì, Hạn chót, Mức độ ưu tiên.
  - Cung cấp nút thao tác nhanh: **Phê duyệt nhanh (Quick Approve)**, **Xem hồ sơ/sản phẩm**, hoặc **Giao chỉ đạo**.
  - Rút ngắn thời gian ra quyết định của lãnh đạo trường từ 5 bước xuống 1 bước.

### 3.4. Dọn Dẹp Mã Nguồn Rác & Bento AI Slop
- Loại bỏ hoàn toàn sự phụ thuộc vào `src/components/portal/bento-portal-hub.tsx` và dọn các đoạn comment giả AST trong `src/app/page.tsx`.
- Refactor `src/components/portal/executive-cockpit-workspace.tsx` hoặc chuyển đổi hoàn toàn sang kiến trúc nhẹ `unified-adaptive-workspace.tsx`.

---

## 4. Kiến Trúc Chi Tiết: Lịch Làm Việc (Executive Calendar & Schedule)

### 4.1. Hợp Nhất Tuyến Đường (Route Consolidation)
- Biến `/calendar` thành route chính thức, độc lập, có SSR metadata và hỗ trợ đầy đủ thanh công cụ điều hướng.
- Không dùng client-side redirect lén lút về `/?view=calendar`.
- Đồng bộ query params hai chiều: `/?view=calendar` và `/calendar` chia sẻ cùng component nền tảng `ExecutiveCalendarWorkspace`.

### 4.2. Chế Độ Xem Đa Tầng (Multi-View Temporal Architecture)
Cung cấp 3 chế độ xem thông minh, chuyển đổi nhanh qua phím tắt hoặc segment tab:
1. **Lưới Tuần Làm Việc (Week Grid View - Chuẩn Cron/Notion Calendar)**:
   - Cột mốc giờ (`07:00` đến `18:00`) cố định bên trái rộng `56px`, căn phải bằng font số `JetBrains Mono` (`tabular-nums`).
   - 7 cột tương ứng từ Thứ Hai đến Chủ Nhật, hiển thị rõ ngày và đánh dấu nổi bật `Hôm nay` (với chỉ báo đường kẻ đỏ thời gian thực).
   - Các khối sự kiện (Cuộc họp giao ban, Lịch tiếp đoàn, Hội thảo khoa học) được tính toán vị trí theo thời gian thực (top/height theo phút).
   - **Xử lý xung đột (Collision Handling)**: Khi 2 sự kiện trùng giờ, tự động chia đôi chiều rộng cột (`w-1/2 left-0`, `w-1/2 left-1/2`) và hiển thị cảnh báo viền sọc cảnh giác.
2. **Nghị Sự Tuần (Executive Agenda List View)**:
   - Tối ưu cho việc in ấn hoặc xem trên thiết bị di động / iPad của Ban Giám hiệu.
   - Nhóm sự kiện theo từng ngày, liệt kê tuần tự theo giờ, có trạng thái chuẩn bị tài liệu họp đi kèm.
3. **Lưới Tháng & Lịch Năm Học (Academic Month Grid)**:
   - Hiển thị tổng quan tháng kết hợp các mốc học thuật: Tuần thi, Kỳ nghỉ lễ, Hạn nộp điểm, Tuyển sinh.

### 4.3. Tích Hợp Nhiệm Vụ & Hạn Chót (Task Deadlines Integration)
- Lịch làm việc không chỉ chứa các cuộc họp mà còn tích hợp thông minh các **Hạn chót đề án/nhiệm vụ (Deliverable Deadlines)**:
  - Hiển thị ở thanh trên cùng (All-day / Milestones strip).
  - Phân biệt rõ icon: Icon lịch hẹn (Lịch công tác) vs Icon hồ sơ (Hạn nộp sản phẩm).
  - Có bộ lọc bật/tắt hiển thị: `[x] Lịch họp Ban Giám hiệu` | `[x] Lịch công tác đơn vị` | `[x] Hạn chót nhiệm vụ trọng điểm`.

---

## 5. Quy Chuẩn Màu Sắc Ngữ Nghĩa & Thành Phần Giao Diện (Design System Spec)

| Loại Thực Thể | Token OKLCH Nền | Token OKLCH Chữ & Viền | Ý Nghĩa / Ngữ Cảnh Sử Dụng |
| :--- | :--- | :--- | :--- |
| **Lịch họp BGH / Trọng thể** | `bg-blue-500/10` | `text-blue-700 border-blue-500/20` | Các sự kiện cấp Trường, họp định kỳ BGH, tiếp đối tác |
| **Hạn nộp Đề án / Sản phẩm** | `bg-violet-500/10` | `text-violet-700 border-violet-500/20` | Hạn chót giao nộp tài liệu DACUM, nghiệm thu chương trình |
| **Sự kiện Học thuật / Sinh viên** | `bg-emerald-500/10` | `text-emerald-700 border-emerald-500/20` | Lịch thi, khai giảng, bế giảng, bảo vệ khóa luận |
| **Việc Khẩn / Quá Hạn** | `bg-rose-500/10` | `text-rose-700 border-rose-500/20` | Sự kiện khẩn cấp, nhắc việc trễ hạn nghiêm trọng |
| **Lịch Nội bộ Đơn vị** | `bg-zinc-500/10` | `text-zinc-700 border-zinc-500/20` | Sinh hoạt chuyên môn các khoa, họp nội bộ phòng ban |

*Ghi chú: Toàn bộ màu chữ đều đã được kiểm toán độ tương phản trên nền trắng đạt tối thiểu 5.0:1 (vượt tiêu chuẩn WCAG AA 4.5:1).*

---

## 6. Kế Hoạch Triển Khai & Kiểm Thử (Implementation & Verification Strategy)

### 6.1. Trình Tự Thực Hiện (Phased Rollout)
1. **Giai đoạn 1: Dọn dẹp AI Slop & Khử Dead Code**:
   - Gỡ bỏ `bento-portal-hub.tsx` và dọn các comment che mắt test trong `src/app/page.tsx`.
   - Chuẩn hóa lại các interface chia sẻ giữa Dashboard và Workspace.
2. **Giai đoạn 2: Tái cấu trúc Bàn làm việc (Dashboard Zone Redesign)**:
   - Thiết kế lại `ExecutiveStatStrip` thành 4 cột kiên cố, chuẩn hóa reactive filtering, xóa bỏ hoàn toàn hiện tượng dead-click.
   - Xây dựng lại `UrgentActionInbox` gom gọn các luồng phê duyệt và cảnh báo khẩn.
   - Tinh gọn `DepartmentProgressMatrix` với thanh tiến độ mảnh thanh lịch.
3. **Giai đoạn 3: Hiện đại hóa Lịch làm việc (Executive Calendar Engine)**:
   - Xây dựng component `ExecutiveCalendarWorkspace` với chế độ Week Time-Grid và Agenda.
   - Nâng cấp route `/calendar` thành trang độc lập đầy đủ tính năng.
   - Tích hợp dữ liệu từ `academic-calendar.ts` và danh sách công việc/hạn chót thực tế.
4. **Giai đoạn 4: Đánh giá chất lượng toàn diện (QA & Verification)**:
   - Chạy `npm run typecheck`.
   - Chạy `npm test` cập nhật các bộ kiểm thử tự động.
   - Xác thực visual trên trình duyệt không còn bất kỳ dấu hiệu AI slop.

### 6.2. Tiêu Chí Nghiệm Thu (Acceptance Criteria)
- [ ] Không còn bất kỳ thẻ nào bị lệch hoặc nhảy layout khi số lượng công việc cần duyệt thay đổi.
- [ ] Bấm vào bất kỳ chỉ số KPI nào trên Bàn làm việc đều kích hoạt lọc và điều hướng dữ liệu chính xác ở bảng bên dưới.
- [ ] Không còn tồn tại 3 tầng banner cảnh báo trễ hạn đè nhau.
- [ ] Tuyến đường `/calendar` hiển thị mượt mà không bị chuyển hướng chớp nháy.
- [ ] Lịch làm việc có chế độ xem tuần dạng lưới thời gian chuẩn xác, có hiển thị xung đột lịch.
- [ ] Toàn bộ code tuân thủ nghiêm ngặt chuẩn Light-Only và không có lỗi TypeScript.
