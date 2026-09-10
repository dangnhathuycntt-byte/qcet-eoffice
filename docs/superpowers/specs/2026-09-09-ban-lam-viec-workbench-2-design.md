# ĐẶC TẢ KIẾN TRÚC & THIẾT KẾ: BÀN LÀM VIỆC ĐIỀU HÀNH 2.0 (QCET WORKBENCH 2.0)
**Dự án:** QCET E-Office (Hệ thống Điều hành & Quản lý Nhiệm vụ Trường CĐ Kỹ thuật Công nghệ Quy Nhơn)  
**Tài liệu:** Technical Architecture & UX Specification  
**Ngày:** 2026-09-09  
**Tác giả:** Chief Product & System Architect, QCET E-Office  
**Trạng thái:** Sẵn sàng phê duyệt & Triển khai (Ready for Review & Implementation)

---

## 1. TỔNG QUAN & BỐI CẢNH VẤN ĐỀ (PROBLEM STATEMENT)

### 1.1. Hiện Trạng Trang "Bàn Làm Việc" (Route `/`)
Trang "Bàn làm việc" (`href: "/"`, `zone: "dashboard"`) là cửa ngõ đầu tiên và quan trọng nhất của toàn bộ hệ thống QCET E-Office, phục vụ 3 nhóm đối tượng:
1. **Ban Giám hiệu (Hiệu trưởng & các Phó Hiệu trưởng)**: Cần bức tranh tổng thể 11 đơn vị, điểm nghẽn học vụ và hàng đợi phê duyệt tờ trình/minh chứng chiến lược.
2. **Trưởng/Phó Phòng, Khoa, Trung tâm (11 Đơn vị)**: Cần điều phối công việc nội bộ đơn vị, thẩm định minh chứng cấp 1 của giảng viên, phân công nhiệm vụ con và theo dõi tiến độ tháng.
3. **Giảng viên & Chuyên viên**: Cần không gian tập trung cho các công việc cá nhân có hạn chót trong tuần, nộp minh chứng và theo dõi đánh giá năng lực DACUM.

Mặc dù hệ thống đã phát triển phân hệ `UnifiedAdaptiveWorkspace` (tại `src/components/workspace/`), phiên bản này mới chỉ được đưa vào làm trang đáp của kho nhiệm vụ `/tasks` (`tasks-focus-landing.tsx`). Trong khi đó, **Bàn làm việc chính tại trang chủ (`/`) vẫn đang chạy trên kiến trúc `DashboardZone` cũ**, dẫn đến sự chia cắt sâu sắc về mặt trải nghiệm và kỹ thuật.

---

### 1.2. 5 Điểm Nghẽn Kỹ Thuật Cốt Lõi Được Xác Nhận Từ Phiên Rà Soát

#### [Điểm nghẽn 1] Phân mảnh cấu trúc điều hành giữa `DashboardZone` và `UnifiedAdaptiveWorkspace`
- **Bản chất**: Cùng một thực thể nghiệp vụ nhưng bị chia làm hai luồng độc lập:
  - `DashboardZone` (route `/`) phụ thuộc `DashboardStateProvider`, quản lý lọc công việc theo chu kỳ tháng học vụ (`selectedAcademicMonth` $\to$ `monthScopedBaseTasks` $\to$ `activeWorkbox` $\to$ `reactiveTasks`).
  - `UnifiedAdaptiveWorkspace` (route `/tasks`) được trang bị `UniversalActionQueue` và `AdaptiveScopeHeader`, phân rã theo 3 phạm vi (`school` | `unit` | `my`) nhưng hoàn toàn tách biệt với bộ lọc tháng học vụ.
- **Hậu quả**: Phân mảnh mô hình phạm vi (Dual Scope Model: `TaskScope` đối đầu `WorkspaceScope`). Người dùng ở Bàn làm việc chính không có `UniversalActionQueue` để duyệt hồ sơ, nộp minh chứng hay đôn đốc nhanh mà bắt buộc phải chuyển sang trang `/tasks`.

#### [Điểm nghẽn 2] Phân mảnh nguồn chân lý (Dual Source of Truth) & Re-render dây chuyền
- **State phân đôi**: `zone`, `scope`, `view`, `dept`, `month` được đồng bộ lên URL qua `use-url-params-sync.ts`; trong khi các bộ lọc tác nghiệp quan trọng (`activeWorkbox`, `executiveFilter`, `selectedCategory`, `selectedPriority`, `searchQuery`) lại lưu local state trong `use-task-filters.ts`. Khi người dùng F5 hoặc chia sẻ URL, các tiêu chí lọc tác vụ bị xóa sạch về mặc định.
- **Monolithic Context Re-render**: `DashboardDataContext` trong `dashboard-context.tsx` duy trì hơn 30 thuộc tính trong một `dataValue` với mảng phụ thuộc 31 biến. Mỗi ký tự gõ vào ô tìm kiếm làm thay đổi con trỏ tham chiếu, ép buộc toàn bộ các widget con (`ExecutiveStatStrip`, `DepartmentProgressMatrix`, `CascadingTaskTable`, v.v.) re-render đồng loạt.
- **Khớp nối lỏng qua DOM Event Bus**: Việc mở chi tiết công việc hoặc modal tạo việc phụ thuộc vào `window.addEventListener("qcet:open-task-detail", ...)`, phá vỡ luồng dữ liệu một chiều của React và gây khó khăn cho việc viết unit test.

#### [Điểm nghẽn 3] Tính toán trùng lặp & phân kỳ dữ liệu `reactiveTasks`
- Trong `use-task-filters.ts`, hệ thống chạy một pipeline nặng để tính toán `filteredTasks` (qua `filterTasksHub`).
- Tuy nhiên tại `dashboard-zone.tsx` (dòng 60-63), component lại **hoàn toàn bỏ qua** `filteredTasks` và tự định nghĩa hàm riêng `filterDashboardReactiveTasks`. Hàm lọc riêng này chỉ xử lý 4 trạng thái cơ bản, bỏ qua `NEEDS_REVIEW`, `searchQuery`, `priority`, `category` và `executiveFilter`.
- **Kết quả**: Số liệu hiển thị trên thanh thống kê (`ExecutiveStatStrip`) đếm theo một công thức, nhưng bảng danh sách nhiệm vụ (`CascadingTaskTable`) bên dưới lại lọc theo một công thức khác, gây lệch pha dữ liệu trực tiếp trước mắt người dùng.

#### [Điểm nghẽn 4] Bất đồng bộ mốc thời gian tham chiếu (Temporal Inconsistency)
- Thay vì tập trung tính toán thời gian qua một service tham chiếu hệ thống, các mốc ngày tháng bị hardcode trực tiếp thành chuỗi ở nhiều file khác nhau:
  - `use-dashboard-state.ts` (dòng 45, 48): `t.dueDate <= "2026-09-08"` và `const todayStr = "2026-09-06"`.
  - `use-task-mutations.ts` (dòng 215, 322): `const todayStr = "2026-09-06"` và `const todayStr = "2026-09-04"`.
  - `unified-task-hub.ts` (dòng 14): `export const TODAY_ISO = "2026-09-04"`.
- Hậu quả: Gây lệch pha giữa tính hạn chót, trạng thái trễ hạn (overdue), bộ đếm huy hiệu trên Sidebar (`setBadgeCounts`) và báo cáo học kỳ.

#### [Điểm nghẽn 5] Quá tải nhận thức chiều dọc (Vertical Cognitive Fatigue)
- Trên màn hình chuẩn 1440x900px, `DashboardZone` của Ban Giám hiệu xếp chồng 6 khối giao diện lớn nối tiếp nhau theo trục dọc (`StatStrip` $\to$ `BacklogBanner` $\to$ `ActionCenter` $\to$ `DepartmentMatrix` $\to$ `CascadingTaskTable` $\to$ `WidgetsGrid`). Lãnh đạo phải cuộn qua 3-4 màn hình mới thấy được chi tiết bảng tác vụ.
- Thiếu thanh chỉ báo bộ lọc tổng hợp (`Active Filter Breadcrumbs`), khiến người dùng mất phương hướng không rõ bảng dữ liệu bên dưới đang phản hồi theo tiêu chí nào khi kết hợp bấm thẻ thống kê và chọn phòng ban.

---

## 2. BÀI HỌC TỪ BENCHMARK QUỐC TẾ & CHUẨN MỰC HÀNH CHÍNH

Qua rà soát thực tế từ các hệ thống quản trị đại học (EAB Edify, HigherED360, Ellucian) và các nền tảng năng suất chuẩn mực (Linear, Superhuman, Notion, ClickUp 3.0):

1. **Action-Oriented Cockpit (Quản trị theo Ngoại lệ - MBE)**:
   - Dashboard của lãnh đạo cấp trường không phải là nơi xem số liệu tĩnh (Static Vanity Metrics) mà là **Trung tâm ra quyết định**.
   - Nguyên lý **Nhịp thở 10 giây (10-Second Executive Pulse)**: Trong 10 giây đầu tiên khi mở máy, lãnh đạo phải nắm được:
     1. Có bao nhiêu tờ trình/minh chứng đang tắc nghẽn cần tôi duyệt hôm nay?
     2. Đơn vị nào đang có tỷ lệ trễ hạn vượt ngưỡng an toàn (>15%)?
     3. Ai là cá nhân chịu trách nhiệm duy nhất (DRI) cho từng nút thắt và nguyên nhân nghẽn là gì?
2. **Zero-Inbox Action Queue & One-Touch Triage**:
   - Tách bạch hoàn toàn giữa **"Hàng đợi hành động tức thì"** (Action Queue) và **"Kho dữ liệu tổng thể"** (Task Table).
   - Bộ 4 thao tác xử lý một chạm (One-Touch Triage):
     - Phê duyệt nhanh kèm bút phê (Quick Approve with Note).
     - Yêu cầu giải trình / hiệu chỉnh (Request Revision) tự động trả về cấp dưới.
     - Đôn đốc trực tiếp (Nudge DRI) qua Push Notification.
     - Ủy quyền / Giao việc con (Delegate / Subtask Rollup).
3. **Early Warning System (EWS) cho 11 Đơn vị**:
   - Bổ sung chế độ **Compact Table View** bên cạnh dạng Grid Cards cho `DepartmentProgressMatrix`, hỗ trợ sắp xếp tức thì đơn vị có nguy cơ trễ hạn cao nhất lên đầu bảng, có tóm tắt lý do nghẽn cụ thể (Narrative Blocker Context).
4. **Chuẩn hóa Hành chính Giáo dục Việt Nam (Nghị định 30/2020/NĐ-CP & Nghị định 232)**:
   - Hệ thống nhiệm vụ gắn chặt với Tờ trình, Bút phê chỉ đạo và Học kỳ I/II Năm học 2026-2027 thay vì chỉ dùng tháng dương lịch thuần túy.

---

## 3. KIẾN TRÚC MỤC TIÊU "BÀN LÀM VIỆC 2.0" (QCET WORKBENCH 2.0)

### 3.1. Bản Vẽ Bố Cục Tổng Thể (Desktop 1440px Wireframe)

```
+==================================================================================================+
| APP TOPBAR & CONTEXTUAL SCOPE BAR:                                                               |
| [QCET WORK] | [Toàn trường / Đơn vị / Của tôi] | [Học kỳ I - Năm học 2026-2027 | Tháng 9] | Cmd+K  |
+==================================================================================================+
| PHÂN KHU 1: DYNAMIC COMMAND & METRIC STRIP (4 Thẻ KPI động thích ứng theo vai trò)                |
| +-------------------+ +-------------------+ +-------------------+ +----------------------------+ |
| | [1] TỔNG NHIỆM VỤ | | [2] NÚT THẮT KHẨN | | [3] CHỜ PHÊ DUYỆT | | [4] TIẾN ĐỘ & TUÂN THỦ DACUM| |
| | 128 Nhiệm vụ      | | 06 Quá hạn (Rose) | | 12 Hồ sơ (Amber)  | | 84.5% Hoàn thành (Emerald) | |
| +-------------------+ +-------------------+ +-------------------+ +----------------------------+ |
+==================================================================================================+
| BỐ CỤC CHIA ĐÔI ĐIỀU HÀNH CHIẾN LƯỢC (SPLIT-COCKPIT GRID: 45% TRÁI - 55% PHẢI)                    |
+---------------------------------------------------+----------------------------------------------+
| PHÂN KHU 2: UNIVERSAL ACTION QUEUE & TRIAGE       | PHÂN KHU 3: DEPARTMENT HEALTH MATRIX & RADAR |
| [Tab: Chờ duyệt (12)] [Tab: Cần nộp (4)] [Ủy quyền]| [Chế độ: Bảng tổng hợp | Lưới 11 Đơn vị]    |
| - - - - - - - - - - - - - - - - - - - - - - - - - | - - - - - - - - - - - - - - - - - - - - - -  |
| * HỒ SƠ 1: Đề án mở ngành AI (Khoa CNTT)          | Đơn vị        Tiến độ    Trễ hạn  Đánh giá   |
|   DRI: TS. Nguyễn Văn A | Hạn: Hôm nay 17:00       | Khoa CNTT     [====- 88%]  01     On-Track   |
|   Minh chứng: 03 file PDF | DACUM: 92/100         | Khoa Điện     [===-  65%]  03     At-Risk    |
|   [Phê duyệt ngay] [Yêu cầu sửa] [Bút phê chỉ đạo] | Phòng Đào tạo [====- 90%]  00     Tốt        |
| - - - - - - - - - - - - - - - - - - - - - - - - - | Phòng TCKT    [==--- 50%]  02     Điểm nghẽn |
| * HỒ SƠ 2: Nghiệm thu Lab Cơ điện tử (P.QT-TB)    | (Xem chi tiết 11 đơn vị & lý do nghẽn)      |
|   DRI: ThS. Trần B | Quá hạn 2 ngày (Rose)        +----------------------------------------------+
|   [Xem minh chứng] [Đôn đốc DRI] [Mở Drawer]      | PHÂN KHU 4: SMART AGENDA & AUDIT LOG         |
|                                                   | [Lịch tuần trọng điểm] [Dòng nhật ký bút phê]|
+---------------------------------------------------+----------------------------------------------+
| THANH BỘ LỌC ĐANG CHẠY (ACTIVE FILTER BREADCRUMB):                                                |
| Đang xem: [Toàn trường] > [Khoa CNTT] > [Trễ hạn & Cần duyệt] (8 việc) ------- [Xóa toàn bộ lọc]  |
+==================================================================================================+
| PHÂN KHU 5: CASCADING TASK GRID (Bảng nhiệm vụ liên thông phản ứng - Tree Table)                  |
| [Tên nhiệm vụ / Nhiệm vụ con] | [Đơn vị chủ trì / DRI] | [Hạn định] | [Tiến độ] | [Thao tác]     |
+==================================================================================================+
```

---

### 3.2. Thiết Kế Chi Tiết 5 Phân Khu Chức Năng

#### Phân khu 1: Dynamic Command & Metric Strip
- **Vị trí**: Nằm ngay dưới Contextual Scope Bar.
- **Đặc điểm**: Tự động tính toán và điều chỉnh 4 thẻ KPI theo vai trò người dùng:
  - **Ban Giám hiệu (School Scope)**:
    1. `Khối lượng nhiệm vụ năm học`: Tổng số nhiệm vụ cấp trường và tỷ lệ phân bổ.
    2. `Nút thắt quá hạn trường (Rose)`: Số lượng nhiệm vụ quá hạn vượt mức an toàn, nhấp vào để lọc danh sách ngay lập tức.
    3. `Hồ sơ chờ BGH phê duyệt (Amber)`: Các tờ trình, đề án đã qua thẩm định đơn vị cần Ban Giám hiệu ký duyệt.
    4. `Tiến độ chung & Tuân thủ DACUM (Emerald)`: % hoàn thành toàn trường và điểm chuẩn hóa năng lực học vụ.
  - **Trưởng Khoa/Phòng (Unit Scope)**:
    1. `Tổng việc đơn vị`: Nhiệm vụ đơn vị chủ trì hoặc phối hợp thực hiện.
    2. `Nhiệm vụ nội bộ trễ hạn`: Cảnh báo các đầu việc chậm trễ của giảng viên/chuyên viên trong đơn vị.
    3. `Chờ Trưởng đơn vị thẩm định`: Các minh chứng chuyên viên nộp lên cần Trưởng đơn vị duyệt trước khi trình BGH.
    4. `Tiến độ công tác tháng`: Tỷ lệ hoàn thành nhiệm vụ theo kỳ học vụ của đơn vị.
  - **Giảng viên & Chuyên viên (My Scope)**:
    1. `Nhiệm vụ được giao`: Danh sách công việc cá nhân chịu trách nhiệm chính (DRI) hoặc phối hợp.
    2. `Hạn chót trong 48h`: Nhắc việc khẩn cấp cần hoàn thành trước khi quá hạn.
    3. `Minh chứng đã nộp chờ duyệt`: Trạng thái thẩm định của các báo cáo đã nộp.
    4. `Điểm tích lũy KPI cá nhân`: Điểm số DACUM hoàn thành thực tế.

#### Phân khu 2: Universal Action Queue & Triage Center (45% Cột Trái)
- **Vị trí**: Đặt song song với Phân khu 3 trong bố cục Split-Cockpit Grid.
- **Tính năng**:
  - Hàng đợi hành động 3 tab: `[Chờ phê duyệt]` | `[Cần nộp minh chứng]` | `[Theo dõi / Ủy quyền]`.
  - **Sửa lỗi lệch ngữ nghĩa (Semantic Clarification)**:
    - Đối với Trưởng đơn vị: Nút **"Thẩm định L1"** (kích hoạt `ReviewActionDialog` để duyệt hoặc trả về) được tách biệt hoàn toàn với nút **"Phân rã / Giao việc con"** (mở `CreateTaskModal` chế độ tạo subtask).
  - **One-Touch Triage**:
    - Nút `Phê duyệt ngay` (Approve): Ký duyệt tức thì kèm bút phê ngắn.
    - Nút `Yêu cầu sửa đổi` (Request Revision): Trả hồ sơ kèm lý do, tự động gửi Web Push cho người nộp.
    - Nút `Đôn đốc DRI` (Nudge): Gửi thông báo nhắc nhở tức thì cho cá nhân phụ trách nhiệm vụ bị tắc nghẽn.
    - Nút `Mở Drawer thẩm định`: Xem toàn bộ lịch sử, văn bản đính kèm, thang đo DACUM chuẩn Nghị định 232.

#### Phân khu 3: Department Health Matrix & Early Warning Radar (55% Cột Phải)
- **Vị trí**: Cột bên phải, đối xứng với Action Queue, dành cho Ban Giám hiệu (và hiển thị ma trận phối hợp nội bộ cho Trưởng phòng/khoa).
- **Tính năng mới**:
  - **Công tắc 2 chế độ hiển thị**:
    1. `Compact Table View (Mặc định)`: Dạng bảng danh bạ hành chính 11 đơn vị:
       - Cột: Đơn vị | Người đứng đầu (Trưởng đơn vị) | Tiến độ % (Mini SVG Ring) | Đang làm | Trễ hạn | Tình trạng rủi ro.
       - Hỗ trợ click vào tiêu đề cột "Trễ hạn" để sắp xếp các đơn vị có rủi ro cao nhất lên trên đầu.
    2. `Grid Cards View`: Dạng lưới 11 thẻ card trực quan truyền thống.
  - **Narrative Blocker Context**: Hiển thị tóm tắt ngắn gọn nguyên nhân nghẽn (ví dụ: *"Chờ thẩm định dự toán tài chính"*, *"Chưa nộp đề cương chi tiết"*) thay vì chỉ là con số vô tri.
  - **Tương tác 1 chạm**: Bấm vào đơn vị bất kỳ sẽ kích hoạt bộ lọc cho bảng nhiệm vụ bên dưới (`selectedDepartment = dept.code`).

#### Phân khu 4: Smart Agenda & Audit Log (Bên dưới Phân khu 3)
- **Lịch tuần trọng điểm**: Dự báo các mốc bàn giao trong 7 ngày tới, gắn nhãn SLA đếm ngược (`Còn 4 giờ`, `Hôm nay 17:00`, `Ngày mai`).
- **Nhật ký điều hành (Audit Trail)**: Dòng sự kiện thời gian thực ghi nhận các quyết định phê duyệt, giao việc và nộp minh chứng.

#### Phân khu 5: Cascading Task Grid & Active Filter Breadcrumb
- **Active Filter Breadcrumbs**: Nằm ngay trên đầu bảng, hiển thị rõ chuỗi bộ lọc đang chạy:  
  `Đang lọc: [Toàn trường] > [Khoa CNTT] > [Trễ hạn & Chờ duyệt] (8 việc) ---- [Xóa bộ lọc]`
- **Bảng nhiệm vụ phân tầng (Cascading Task Table)**:
  - Hiển thị cấu trúc cha - con (`parentTaskId` $\to$ `subtasks`), tiến độ rollup chuẩn xác.
  - Đồng bộ 100% với `filterTasksHub`, loại bỏ hoàn toàn hiện tượng lệch số liệu với thanh thống kê.

---

## 4. QUY CHUẨN KỸ THUẬT & ĐỒNG BỘ DỮ LIỆU

### 4.1. Chuẩn Hóa Engine Thời Gian Tham Chiếu Hệ Thống
- Tuyệt đối loại bỏ các chuỗi ngày tĩnh (`"2026-09-04"`, `"2026-09-06"`, `"2026-09-08"`).
- Toàn bộ logic kiểm tra quá hạn, đồng bộ badge và tính toán SLA phải sử dụng tập trung qua:
  ```typescript
  import { getSystemReferenceDate, isTaskPastDue } from "@/lib/unified-task-hub";
  
  const systemDate = getSystemReferenceDate();
  const isOverdue = isTaskPastDue(task.dueDate, systemDate);
  ```

### 4.2. Hợp Nhất Mô Hình Phạm Vi (Scope Unification)
- Đồng nhất `TaskScope` và `WorkspaceScope`:
  ```typescript
  export type WorkspaceScope = "school" | "unit" | "my";
  ```
- Bộ chuyển đổi hai chiều chuẩn giữa URL param (`all`, `unit`, `personal`) và `WorkspaceScope`:
  - `all` $\leftrightarrow$ `school` (Toàn trường)
  - `unit` $\leftrightarrow$ `unit` (Đơn vị)
  - `personal` $\leftrightarrow$ `my` (Cá nhân)

### 4.3. Loại Bỏ Hàm Lọc Phân Kỳ & Hợp Nhất Đường Ống Lọc
- Xóa bỏ `filterDashboardReactiveTasks` trong `dashboard-zone.tsx`.
- Toàn bộ việc lọc tác vụ hiển thị tại `DashboardZone` được cấp trực tiếp từ `filteredTasks` của `useTaskFilters`, đảm bảo các tiêu chí: `scope`, `academicMonth`, `department`, `workbox`, `executiveFilter`, `searchQuery`, `priority`, `category` được tính toán nhất quán.

### 4.4. Tối Ưu Hóa Re-render trong `DashboardStateProvider`
- Tách `DashboardDataContext` thành 2 context chuyên biệt:
  1. `DashboardBaseDataContext`: Chứa dữ liệu thô ít thay đổi (`tasks`, `upcoming`, `activities`, `stats`).
  2. `DashboardFilterContext`: Chứa trạng thái lọc động (`searchQuery`, `activeWorkbox`, `selectedDepartment`, `selectedAcademicMonth`).
- Sử dụng `useDeferredValue` cho `searchQuery` để tránh nghẽn luồng giao diện khi người dùng nhập từ khóa.
- Thay thế hoàn toàn `window.CustomEvent` bằng các callback props đồng bộ và state trực tiếp trong Context.

---

## 5. LỘ TRÌNH TRIỂN KHAI THEO 3 GIAI ĐOẠN (ROADMAP)

### Giai Đoạn 1: Tối Ưu Kiến Trúc State & Hợp Nhất Dữ Liệu (Core Engine Unification)
1. Chuẩn hóa `getSystemReferenceDate()` và `isTaskPastDue()` trong `use-dashboard-state.ts`, `use-task-mutations.ts`, và `unified-task-hub.ts`.
2. Hợp nhất `TaskScope` và `WorkspaceScope`.
3. Xóa hàm lọc riêng `filterDashboardReactiveTasks`, chuyển `DashboardZone` sang sử dụng `filteredTasks` chuẩn hóa.
4. Tích hợp `UniversalActionQueue` vào `DashboardZone`.

### Giai Đoạn 2: Tái Cấu Trúc Bố Cục Split-Cockpit & Nâng Cấp Giao Diện (UX Elevation)
1. Tái cấu trúc layout của `DashboardZone`: Thiết lập lưới Split-Cockpit Grid (45% trái cho `UniversalActionQueue`, 55% phải cho `DepartmentProgressMatrix`).
2. Bổ sung chế độ **Compact Table View** kèm tính năng sắp xếp rủi ro cho `DepartmentProgressMatrix`.
3. Tách bạch rõ quyền của Trưởng đơn vị trong `UniversalActionQueue`: "Thẩm định L1" vs "Giao việc con".
4. Bổ sung thanh chỉ báo `Active Filter Breadcrumbs` trên đầu bảng nhiệm vụ.

### Giai Đoạn 3: Phím Tắt Điều Hành, Command Palette & Dọn Dẹp Mã Nguồn (Refinement & Pruning)
1. Bổ sung bộ phím tắt điều hành một chạm (1: Duyệt, 2: Yêu cầu sửa, N: Đôn đốc).
2. Xóa bỏ hơn 5.000 dòng mã nguồn thừa của các `Legacy*Workspace` trong các file portal để thu gọn kích thước bundle.
3. Chạy toàn bộ test suites (`npm run typecheck`, `npm test`) đảm bảo độ tin cậy tuyệt đối và tuân thủ chuẩn Light-Only Tailwind CSS v4.

---

## 6. DANH MỤC TỆP CẦN ĐIỀU CHỈNH VÀ CHIẾN LƯỢC KIỂM THỬ

### 6.1. Danh Mục Tệp Chỉnh Sửa
1. `src/hooks/use-dashboard-state.ts`: Chuẩn hóa mốc thời gian tham chiếu và đồng bộ huy hiệu.
2. `src/hooks/use-task-filters.ts`: Tối ưu hóa pipeline lọc và đồng bộ trạng thái.
3. `src/components/dashboard/dashboard-context.tsx`: Tách context giảm re-render, chuẩn hóa scope.
4. `src/components/dashboard/zones/dashboard-zone.tsx`: Áp dụng bố cục Split-Cockpit, nhúng Action Queue, xóa hàm lọc phân kỳ.
5. `src/components/workspace/components/universal-action-queue.tsx`: Tách quyền Thẩm định L1 vs Giao việc, thêm One-Touch Triage.
6. `src/components/dashboard/department-progress-matrix.tsx`: Thêm chế độ Compact Table View và Narrative Blocker Context.
7. `src/lib/unified-task-hub.ts`: Bổ sung helper đồng bộ hóa và lọc thống nhất.

### 6.2. Chiến Lược Kiểm Thử (Quality Assurance)
1. `npm run typecheck` (`tsc --noEmit`): Đảm bảo 0 lỗi TypeScript, không lạm dụng `any`.
2. `npm test` (`tsx --test tests/**/*.test.ts`): Toàn bộ các bài test về lọc nhiệm vụ, phân rã subtask, quyền hạn BGH/Trưởng khoa/Giảng viên đều pass.
3. **Quy tắc Build & Cache**: Tuân thủ nghiêm ngặt `CLAUDE.md`, không chạy `next build` đè lên khi dev server đang chạy; giữ vững chuẩn mực **Light-Only (OKLCH)**.

---
*Tài liệu được lưu trữ tại `docs/superpowers/specs/2026-09-09-ban-lam-viec-workbench-2-design.md` và sẵn sàng để tiến hành lập kế hoạch chi tiết (Implementation Plan).*
