# Đặc Tả Kỹ Thuật (Spec): Nâng Cấp Hệ Thống Lịch Quản Lý Công Tác & Điều Hành Công Việc (Work & Operations Schedule Engine)

- **Ngày ban hành**: 2026-09-09
- **Trạng thái**: Đã thống nhất định hướng (Ready for Implementation)
- **Hệ thống**: QCET E-Office (Trường Cao đẳng Kinh tế Kỹ thuật Cần Thơ)
- **Tập trung cốt lõi**: Quản lý điều hành tiến độ công việc, mốc nghiệm thu DACUM, phân công nhiệm vụ và giải quyết tồn đọng (Work & Task Execution Management — loại bỏ hoàn toàn các yếu tố in ấn, giấy tờ hình thức).

---

## 1. Bối Cảnh & Vấn Đề Cần Giải Quyết (Problem Statement)

Trang Lịch công tác hiện tại (`/calendar` và component `ExecutiveCalendarWorkspace`) đang gặp các hạn chế lớn khiến chưa đáp ứng được vai trò là **Trung tâm Chỉ huy Điều hành Công việc** của Ban Giám hiệu và Trưởng các đơn vị:

1. **Lẫn lộn Mock Data & Bỏ sót Dữ liệu Thực**:
   - Hệ thống vẫn sử dụng `DEFAULT_SAMPLE_EVENTS` (dữ liệu mẫu tĩnh) thay vì phản ánh 100% khối lượng nhiệm vụ thực tế từ Task Engine.
   - Khi có dữ liệu `tasks` từ API, hệ thống chỉ map sơ sài nhiệm vụ cha cấp trường (`SchoolTask`) với giờ giả định cố định `08:00 - 09:30`, bỏ sót toàn bộ:
     + Tiểu nhiệm vụ phân công cho giảng viên, chuyên viên (`subTasks`).
     + Hạn nộp sản phẩm nghiệm thu / minh chứng (`deliverables`).
2. **Thiếu Bộ Lọc Quản Trị Công Việc Thực Chiến**:
   - Chưa lọc được theo **11 Phòng/Khoa** của trường QCET (Phòng Đào tạo & QLKH, Phòng TCHC, Phòng KHTC, Khoa CNTT, Khoa Cơ điện, v.v.).
   - Chưa lọc theo **Người chịu trách nhiệm chính (DRI - Direct Responsible Individual)** hoặc người được phân công.
   - Chưa lọc theo **Mức độ khẩn / Tình trạng hạn chót** (Quá hạn, Sắp đến hạn < 48h, Đang thực hiện, Chờ duyệt sản phẩm, Đã hoàn thành).
3. **Vi phạm nguyên tắc "Zero Overdue Task Loss" (Mất dấu nhiệm vụ quá hạn)**:
   - Các nhiệm vụ bị trễ hạn từ tuần trước hoặc tháng trước không xuất hiện trên lưới tuần hiện tại, khiến lãnh đạo không thấy được các điểm nghẽn tồn đọng cần đôn đốc giải quyết ngay.
4. **Trải nghiệm Tác nghiệp còn thụ động (Passive UI)**:
   - Người dùng không thể cập nhật nhanh % tiến độ hoặc đổi trạng thái công việc trực tiếp từ lịch.
   - Chưa có thao tác đổi hạn chót nhanh (Quick Reschedule) khi cần gia hạn hoặc điều chuyển kế hoạch.

---

## 2. Mục Tiêu & Nguyên Tắc Thiết Kế (Core Objectives & Principles)

1. **100% Real Task Data (Dữ liệu Nhiệm vụ Thật)**:
   - Khai tử hoàn toàn `DEFAULT_SAMPLE_EVENTS`. Toàn bộ sự kiện trên lịch được tổng hợp tự động từ:
     - Mốc hoàn thành nhiệm vụ cấp Trường (`SchoolTask`).
     - Hạn chót nhiệm vụ phân công cấp Đơn vị (`StaffTask`/`SubTask`).
     - Hạn nộp sản phẩm nghiệm thu DACUM (`Deliverable`).
2. **Zero Overdue Task Loss (Không Bỏ Rơi Nhiệm Vụ Quá Hạn)**:
   - Cung cấp dải banner ghim cố định ở đầu trang: **"Nhiệm vụ tồn đọng cần xử lý gấp" (Prior Overdue Backlog)**, hiển thị danh sách các việc quá hạn kèm số ngày trễ và nút đôn đốc/mở chi tiết tức thì.
3. **Đa Chiều Quản Trị (Multi-Dimensional Scoping)**:
   - Hỗ trợ chuyển đổi mượt mà giữa: Toàn trường, Khối Phòng ban chức năng, Khối Khoa đào tạo, hoặc đích danh 1 đơn vị cụ thể.
   - Hỗ trợ lọc nhanh theo người phụ trách (DRI).
4. **Action-Oriented (Tác nghiệp Trực Tiếp)**:
   - Click vào bất kỳ thẻ công việc nào mở ngay `TaskDetailSideSheet` để: cập nhật % tiến độ, duyệt sản phẩm đầu ra, giao thêm việc hoặc gia hạn.
   - Click vào ô trống của bất kỳ ngày nào mở ngay `CreateTaskModal` với ngày đến hạn (`dueDate`) được điền sẵn theo ngày đã chọn.
5. **Đồng Bộ Chu Kỳ Tháng Hàn Lâm QCET**:
   - Tương thích hoàn toàn với `GlobalMonthSelector` (chu kỳ ngày 25 tháng trước đến ngày 24 tháng sau) và `getSystemReferenceDate` chuẩn UTC.

---

## 3. Thiết Kế Kiến Trúc & Luồng Dữ Liệu (Architecture & Data Transformation)

### 3.1. Bộ Chuyển Đổi Dữ Liệu Nhiệm Vụ Thành Thao Tác Lịch (`work-calendar-adapter.ts`)

Xây dựng module thuần túy (pure functions, testable) tại `src/lib/work-calendar-adapter.ts`:

```typescript
export type WorkItemType = "school_milestone" | "subtask" | "deliverable" | "urgent_overdue";

export interface WorkCalendarItem {
  id: string;
  sourceTaskId: string;
  parentSchoolTaskId?: string;
  title: string;
  code?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm nếu có, mặc định theo mốc ca
  type: WorkItemType;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "WAITING_APPROVAL" | "COMPLETED" | "OVERDUE";
  progressPercent: number;
  departmentId: string;
  departmentName: string;
  assigneeName: string;
  assigneeAvatar?: string;
  isOverdue: boolean;
  daysOverdue?: number;
  deliverableSummary?: string;
  dacumDutyCode?: string;
}

export interface WorkCalendarFilters {
  departmentId?: string | "ALL";
  assigneeName?: string | "ALL";
  itemType?: WorkItemType | "ALL";
  statusFilter?: "ALL" | "ACTIVE" | "OVERDUE" | "COMPLETED";
  searchQuery?: string;
}
```

### 3.2. Thuật toán Trích Xuất & Phân Loại
1. **Duyệt qua danh sách `SchoolTask[]`**:
   - Nếu `task.dueDate` hợp lệ -> Tạo 1 `WorkCalendarItem` loại `school_milestone`.
   - Duyệt tiếp `task.subTasks[]`:
     - Mỗi `subTask` có `dueDate` -> Tạo 1 `WorkCalendarItem` loại `subtask`.
   - Duyệt tiếp `task.deliverables[]`:
     - Mỗi `deliverable` có `dueDate` -> Tạo 1 `WorkCalendarItem` loại `deliverable`.
2. **Kiểm tra Trạng thái Quá hạn**:
   - Sử dụng `getSystemReferenceDate()` và `isTaskPastDue()` để xác định chính xác công việc bị trễ hạn so với mốc thời gian điều hành hiện tại.
3. **Lọc Dữ liệu (Filtering Engine)**:
   - Lọc theo phòng ban (khớp `departmentId` hoặc `assignedToDepartmentId`).
   - Lọc theo người phụ trách (khớp `leadAssigneeName` hoặc `assigneeName`).
   - Lọc theo loại công việc và trạng thái tiến độ.

---

## 4. Thiết Kế Giao Diện & Trải Nghiệm Người Dùng (UI/UX Design)

### 4.1. Bố Cục Trang `/calendar`

```
+--------------------------------------------------------------------------------------------------+
| BREADCRUMB: Bàn làm việc > Lịch Điều Hành & Tiến Độ Công Việc                                    |
| TIÊU ĐỀ: LỊCH ĐIỀU HÀNH CÔNG TÁC & TIẾN ĐỘ THỰC THI                                              |
| Phụ đề: Giám sát mốc nhiệm vụ trọng tâm, hạn nộp sản phẩm DACUM và phân bổ công việc các đơn vị  |
| HÀNH ĐỘNG: [Đồng bộ lại]  [+ Thêm nhiệm vụ / Mốc công tác]                                       |
+--------------------------------------------------------------------------------------------------+
| [CẢNH BÁO GHIM] ⚠️ TỒN ĐỌNG CẦN XỬ LÝ: Có 3 nhiệm vụ trễ hạn từ kỳ trước [Xem chi tiết v]         |
+--------------------------------------------------------------------------------------------------+
| BỘ LỌC CÔNG VIỆC:                                                                                |
| Đơn vị: [Tất cả 11 Đơn vị v] | Phụ trách: [Tất cả cán bộ v] | Loại: [Tất cả mốc v] | Tìm kiếm...  |
+--------------------------------------------------------------------------------------------------+
| ĐIỀU HƯỚNG THỜI GIAN:                                                                            |
| [< Tuần trước]  [Hôm nay]  [Tuần sau >]  | Tuần 38 (14/09 - 20/09/2026) | View: [Lưới tuần] [Danh sách] [Tháng]|
+--------------------------------------------------------------------------------------------------+
| KHUNG NHÌN LƯỚI KẾ HOẠCH TUẦN (WEEKLY WORK MATRIX):                                              |
|----------------+----------------+----------------+----------------+----------------+-------------|
| THỨ HAI (14/09)| THỨ BA (15/09) | THỨ TƯ (16/09) | THỨ NĂM (17/09)| THỨ SÁU (18/09)| THỨ BẢY...  |
|----------------+----------------+----------------+----------------+----------------+-------------|
| [NV Cấp Trường]| [Sản phẩm]     | [Nhiệm vụ]     | [NV Cấp Trường]| [Sản phẩm]     |             |
| Hoàn thành đề  | Nộp ma trận    | Lập dự trù     | Họp nghiệm thu | Báo cáo tiến độ|             |
| cương chi tiết | DACUM CNTT     | thiết bị E3    | chuẩn đầu ra   | tuyển sinh Đ1  |             |
| P. Đào tạo     | Khoa CNTT      | P. Quản trị TB | P. Đào tạo     | P. Tuyển sinh  |             |
| DRI: Thầy Nam  | DRI: Thầy Hà   | DRI: Thầy Dũng | DRI: Thầy Nam  | DRI: Cô Mai    |             |
| Tiến độ: 80%   | Tiến độ: 45%   | Tiến độ: 100%  | Tiến độ: 20%   | Tiến độ: 60%   |             |
| [Đang làm]     | [Khẩn cấp]     | [Hoàn thành]   | [Sắp đến hạn]  | [Đang làm]     |             |
+----------------+----------------+----------------+----------------+----------------+-------------+
```

### 4.2. Chi Tiết Thẻ Công Việc Trên Lịch (Work Card Component)
- **Huy hiệu Loại công việc (Type Badge)**:
  - `Mốc cấp Trường`: Badge màu xanh dương (`bg-blue-50 text-blue-700 border-blue-200`).
  - `Sản phẩm DACUM`: Badge màu tím (`bg-violet-50 text-violet-700 border-violet-200`).
  - `Việc Đơn vị / Chuyên viên`: Badge màu lục (`bg-emerald-50 text-emerald-700 border-emerald-200`).
  - `Quá hạn / Rủi ro`: Badge màu hoa hồng (`bg-rose-50 text-rose-700 border-rose-200`).
- **Nội dung thẻ**:
  - Mã nhiệm vụ (`font-mono text-[11px] font-semibold text-muted-foreground`).
  - Tiêu đề công việc (tối đa 2 dòng, rõ nét, dễ đọc).
  - Tên đơn vị phụ trách kèm icon tòa nhà.
  - Tên cán bộ đầu mối (DRI) kèm avatar thu nhỏ.
  - Thanh tiến độ mini (`Progress bar`) hiển thị % thực tế.
- **Tương tác**:
  - Hover: Hiển thị tooltip tóm tắt tiêu chí hoàn thành / sản phẩm cần nộp.
  - Click: Mở trực tiếp `TaskDetailSideSheet` để duyệt hoặc cập nhật.

### 4.3. Chế Độ Danh Sách Nghị Trình Tiến Độ (Work Agenda List View)
- Dành cho đối tượng muốn xem theo mạch thời gian dọc cuốn chiếu.
- Gom nhóm theo từng ngày trong tuần.
- Trong mỗi ngày, sắp xếp theo mức độ ưu tiên: Quá hạn -> Việc khẩn -> Việc bình thường -> Đã hoàn tất.
- Hiển thị đầy đủ mô tả công việc, danh sách sản phẩm bàn giao đính kèm.

### 4.4. Chế Độ Tháng Điều Hành Hàn Lâm (Academic Month View)
- Sử dụng component `CalendarMonthView` hiện có, đồng bộ dữ liệu chuyển đổi `WorkCalendarItem[]`.
- Đánh dấu rõ các ngày có mật độ công việc cao (High workload) và các ngày có sản phẩm trọng điểm cần nghiệm thu.

---

## 5. Kế Hoạch Triển Khai & Kiểm Thử (Implementation & Verification Plan)

### 5.1. Các Tệp Cần Xây Dựng & Chỉnh Sửa
1. **Tạo mới**: `src/lib/work-calendar-adapter.ts`
   - Chứa logic chuyển đổi dữ liệu từ `SchoolTask[]` sang `WorkCalendarItem[]`.
   - Chứa logic trích xuất công việc quá hạn kỳ trước (`getPriorOverdueWorkItems`).
   - Chứa logic lọc đa chiều (`filterWorkCalendarItems`).
2. **Tạo mới**: `tests/work-calendar-adapter.test.ts`
   - Bộ unit test kiểm tra tính toàn vẹn của dữ liệu chuyển đổi, không sót subtask, không sót deliverable, tính đúng ngày trễ hạn.
3. **Cập nhật**: `src/components/calendar/executive-calendar-workspace.tsx`
   - Xóa bỏ triệt để `DEFAULT_SAMPLE_EVENTS`.
   - Tiếp nhận `WorkCalendarItem[]` đã chuyển đổi từ `tasks`.
   - Bổ sung thanh lọc phòng ban và dải cảnh báo công việc quá hạn kỳ trước.
   - Nâng cấp giao diện hiển thị thẻ công việc với thanh tiến độ %, đơn vị và DRI.
4. **Cập nhật**: `src/app/calendar/page.tsx`
   - Kết nối dữ liệu sống từ API `/api/dashboard/overview`.
   - Truyền dữ liệu đầy đủ xuống `ExecutiveCalendarWorkspace`.
   - Xử lý mượt mà tương tác mở `CreateTaskModal` và `TaskDetailSideSheet`.

### 5.2. Tiêu Chí Nghiệm Thu (Acceptance Criteria)
- [ ] Không còn bất kỳ dữ liệu mẫu tĩnh (`sample events`) nào trên giao diện lịch.
- [ ] Mọi nhiệm vụ có `dueDate` (cả nhiệm vụ cha, subtasks và deliverables) đều hiển thị đúng ngày trên lịch.
- [ ] Thẻ công việc hiển thị đầy đủ: Tên việc, Đơn vị, DRI, % tiến độ, Badge loại việc.
- [ ] Bộ lọc theo Phòng ban (11 đơn vị) và theo Trạng thái tiến độ hoạt động chính xác tức thì.
- [ ] Banner "Nhiệm vụ tồn đọng cần xử lý gấp" xuất hiện khi có việc quá hạn và click vào xem được ngay.
- [ ] Click vào ngày trống mở modal tạo việc cho đúng ngày đó.
- [ ] Toàn bộ test suite chạy qua 100% (`npm test`).
- [ ] Không có lỗi TypeScript (`npm run typecheck`).
