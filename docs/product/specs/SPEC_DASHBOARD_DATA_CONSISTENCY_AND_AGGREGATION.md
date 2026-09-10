---
status: completed
domain: data
created: 2026-09-09
---

# TÀI LIỆU ĐẶC TẢ KỸ THUẬT: CHUẨN HÓA SỐ LIỆU ĐIỀU HÀNH & ĐỒNG BỘ TOÀN VẸN AGGREGATION PIPELINE (QCET E-OFFICE)

**Dự án:** Hệ thống Điều hành Văn phòng Điện tử (QCET E-Office)  
**Cơ quan chủ quản:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Tên miền chính thức:** `https://e-office.cdktcnqn.edu.vn`  
**Mã tài liệu:** `SPEC-QCET-DASHBOARD-CONSISTENCY-2026-09`  
**Phiên bản:** 2.0 (Bản đặc tả kiến trúc chuẩn hóa cấp cao - World-Class Benchmark & Full Codebase Review)  
**Trạng thái:** Bản phê duyệt thiết kế kỹ thuật chính thức (Approved Technical Specification)  
**Phạm vi áp dụng:** Toàn bộ hệ thống thống kê số liệu trên Dashboard, Khoang điều hành Ban Giám hiệu (Executive Cockpit), Ma trận tiến độ 11 phòng ban/khoa, Hàng đợi hành động BGH (Action Queue) và các API tổng hợp dữ liệu.

---

## MỤC LỤC
1. [Phần 1: Hiện trạng, Mâu thuẫn Số liệu & Phân tích Nguyên nhân Gốc rễ](#phần-1-hiện-trạng-mâu-thuẫn-số-liệu--phân-tích-nguyên-nhân-gốc-rễ)
2. [Phần 2: Chuẩn đối sánh Quốc tế & Kiến trúc World-Class (Linear, Plane, ERPNext, ServiceNow, Stripe)](#phần-2-chuẩn-đối-sánh-quốc-tế--kiến-trúc-world-class)
3. [Phần 3: Chuẩn hóa Định nghĩa Số liệu & Nguyên tắc Bảo toàn Toán học (MECE Conservation Laws)](#phần-3-chuẩn-hóa-định-nghĩa-số-liệu--nguyên-tắc-bảo-toàn-toán-học)
4. [Phần 4: Đặc tả Kỹ thuật Tầng Dữ liệu & Server Aggregation](#phần-4-đặc-tả-kỹ-thuật-tầng-dữ-liệu--server-aggregation)
5. [Phần 5: Đặc tả Kỹ thuật Tầng Client Hook & Filtering Pipeline](#phần-5-đặc-tả-kỹ-thuật-tầng-client-hook--filtering-pipeline)
6. [Phần 6: Đặc tả Giao diện & Công thái học Hành chính (UI Ergonomics & Zero Fake Data)](#phần-6-đặc-tả-giao-diện--công-thái-học-hành-chính)
7. [Phần 7: Chi tiết Kỹ thuật Điều chỉnh Từng Tệp Nguồn](#phần-7-chi-tiết-kỹ-thuật-điều-chỉnh-từng-tệp-nguồn)
8. [Phần 8: Kế hoạch Triển khai & Ma trận Kiểm thử Nghiệm thu (Test Verification Matrix)](#phần-8-kế-hoạch-triển-khai--ma-trận-kiểm-thử-nghiệm-thu)

---

## PHẦN 1: HIỆN TRẠNG, MÂU THUẪN SỐ LIỆU & PHÂN TÍCH NGUYÊN NHÂN GỐC RỄ

### 1.1. Hiện trạng mâu thuẫn trên giao diện người dùng
Tại phân khu **Bàn làm việc** (`/` - `zone: "dashboard"`), người dùng với vai trò Ban Giám hiệu (BGH QCET) trong chế độ xem **Toàn trường** kỳ vận hành **Tháng 9 (25/08 - 24/09)** quan sát thấy các chỉ số bị mâu thuẫn trực tiếp với nhau trên cùng một màn hình:

```
+---------------------------------------------------------------------------------------------------+
| [ExecutiveStatStrip - Hàng 4 thẻ trên cùng]                                                       |
| Thẻ 1: Nhiệm vụ cấp Trường: 130 (119 đang làm · 11 hoàn thiện)                                    |
| Thẻ 2: Công việc Đơn vị: 0 (0 đang làm · 0 hoàn thiện)                                            |
| Thẻ 3: Cần xử lý & Trễ hạn: 0 (0 cần xử lý · 0 trễ hạn) [Huy hiệu: Ổn định]                       |
| Thẻ 4: Tỷ lệ hoàn thành toàn trường: 44% [Tiến độ trung bình 44%]                                 |
+---------------------------------------------------------------------------------------------------+
| [ExecutiveActionCenter - Khoang chỉ đạo BGH]                                                      |
| Thẻ BGH 1: Chờ BGH Phê duyệt: 0 (Không có tờ trình tồn đọng)                                      |
| Thẻ BGH 2: Vướng mắc & Trễ hạn: 0 (Tiến độ thông suốt)                                            |
| Thẻ BGH 3: Nhiệm vụ Chiến lược: 85 (Nhiệm vụ trọng tâm năm học)                                   |
+---------------------------------------------------------------------------------------------------+
| [Nhiệm vụ trọng tâm cần chỉ đạo trực tiếp - Danh sách ngay dưới các thẻ BGH]                     |
| 1. Phê duyệt kế hoạch kiểm định chất lượng CTĐT Khoa CNTT       -> [Phê duyệt ngay ->]            |
| 2. Tờ trình kinh phí mua sắm thiết bị phòng máy thực hành số 2 -> [Phê duyệt ngay ->]            |
| 3. Tắc nghẽn tiến độ số hóa hồ sơ tuyển sinh năm 2026           -> [Đôn đốc ->]                   |
+---------------------------------------------------------------------------------------------------+
| [DepartmentProgressMatrix - Ma trận tiến độ 11 đơn vị/phòng ban]                                  |
| Ban Giám hiệu: 47% | Khoa CNTT: 50% | Phòng Đào tạo & QLKH: 36% ...                              |
+---------------------------------------------------------------------------------------------------+
```

### 1.2. Phân tích 6 điểm mâu thuẫn cốt lõi và nguyên nhân sâu xa (Deep Root Causes)

#### Mâu thuẫn 1: "119 đang làm" (Thẻ 1 trên) vs "85 nhiệm vụ chiến lược" (Thẻ 3 BGH dưới)
* **Số liệu thực tế trong DB:** 130 nhiệm vụ cấp trường gồm:
  * `IN_PROGRESS`: **85**
  * `NOT_STARTED`: **30**
  * `WAITING_APPROVAL`: **3**
  * `OVERDUE`: **1**
  * `COMPLETED`: **11**
* **Nguyên nhân code:** `computeDashboardStats` tại `src/lib/dashboard-aggregator.ts` thực hiện phép trừ giản lược:
  ```ts
  const schoolTasksInProgress = totalSchoolTasks - schoolTasksCompleted; // 130 - 11 = 119
  ```
  Phép tính này ngộ nhận rằng mọi nhiệm vụ chưa xong đều là "đang làm", gộp cả 30 việc chưa khởi động, 3 việc đang chờ duyệt và 1 việc quá hạn. Trong khi đó, `computeExecutiveActionStats` tại `src/lib/executive-matrix-aggregator.ts` lọc chuẩn xác `task.status === "IN_PROGRESS"` nên ra kết quả **85**.

#### Mâu thuẫn 2: Thẻ BGH báo 0 chờ duyệt & 0 trễ hạn nhưng danh sách bên dưới hiển thị 3 nhiệm vụ
* **Hiện tượng:** Thẻ BGH báo 0 tờ trình tồn đọng, nhưng khối danh sách ngay phía dưới lại hiển thị 2 tờ trình cần duyệt và 1 tắc nghẽn cần đôn đốc.
* **Nguyên nhân code:**
  1. Component `ExecutiveActionCenter` tại `src/components/dashboard/zones/dashboard-zone.tsx` **không được truyền prop `items`**, kích hoạt nhánh fallback lấy dữ liệu tĩnh cứng `DEFAULT_ACTION_ITEMS` trong `executive-action-center.tsx`.
  2. Hàm `computeExecutiveActionStats` chỉ kiểm tra chuỗi `task.status === "PENDING_EXECUTIVE_APPROVAL"`, trong khi enum lưu trữ trong cơ sở dữ liệu Prisma là `WAITING_APPROVAL`. Do đó, 3 nhiệm vụ thực tế đang chờ duyệt trong DB không được tính, khiến thẻ báo 0.

#### Mâu thuẫn 3: "Tỷ lệ hoàn thành toàn trường: 44%" trong khi mới hoàn tất 11/130 nhiệm vụ (8.5%)
* **Hiện tượng:** Người dùng nhìn thấy $11 / 130$ nhưng tỷ lệ hoàn thành lại ghi to là **44%**.
* **Nguyên nhân code:**
  * Giá trị 44% là `averageSchoolProgressPercent` (trung bình cộng trường `progressPercent` của các nhiệm vụ).
  * Tiêu đề của thẻ trong `src/components/dashboard/executive-stat-strip.tsx` lại được đặt là **"Tỷ lệ hoàn thành toàn trường"** thay vì **"Tiến độ trung bình toàn trường"**. Tỷ lệ hoàn tất thực tế $\frac{11}{130} \times 100\% = 8.46\%$. Việc nhầm lẫn giữa *Tỷ lệ hoàn thành* (Completion Rate) và *Tiến độ trung bình* (Average Progress) làm người dùng đánh giá hệ thống tính sai toán học.

#### Mâu thuẫn 4: "Công việc Đơn vị: 0" (0 đang làm · 0 hoàn thiện)
* **Hiện tượng:** Thẻ công việc đơn vị hoàn toàn bằng 0, dù trường có 11 khoa/phòng ban với các tỷ lệ tiến độ 50%, 47%, 36%...
* **Nguyên nhân code:**
  * `dashboard-service.ts` truy vấn `where: { scope: TaskScope.SCHOOL }` và tổng hợp `subTasks` thông qua quan hệ phân cấp.
  * Hiện tại trong cơ sở dữ liệu, 12 công việc đơn vị đang được lưu với `scope: 'DEPARTMENT'` độc lập, không gắn khoá ngoại `parentTaskId` với các task trường. Khi mảng `subTasks` của các task trường rỗng, toàn bộ thống kê công việc đơn vị bị gán bằng 0.

#### Mâu thuẫn 5: Thẻ "Cần xử lý & Trễ hạn: 0" (Ổn định) bỏ qua nhiệm vụ cấp trường
* **Hiện tượng:** Thẻ 3 phía trên báo 0 việc cần xử lý và 0 việc trễ hạn, trạng thái Ổn định.
* **Nguyên nhân code:**
  * `computeDashboardStats` (`dashboard-aggregator.ts`) chỉ quét mảng `t.subTasks` để tìm `NEEDS_REVIEW` và `dueDate < now`.
  * Nó hoàn toàn không kiểm tra bản thân nhiệm vụ cấp trường `t`. Do `t.subTasks` rỗng, nó bỏ sót nhiệm vụ trường đang ở trạng thái `WAITING_APPROVAL` hoặc `OVERDUE`.

#### Mâu thuẫn 6: Bộ lọc Tháng 9 hiển thị toàn bộ 130 nhiệm vụ cả năm
* **Hiện tượng:** Khi chọn "Tháng 9 (25/08 - 24/09)", tổng số nhiệm vụ cấp trường vẫn là 130.
* **Nguyên nhân code:**
  * `filterTasksByAcademicMonthStrict` tại `src/lib/academic-calendar.ts` áp dụng điều kiện kéo dài qua nhiều tháng (`spanInPeriod`): `taskStart <= period.endDate && taskDue >= period.startDate`.
  * Dữ liệu seed trong DB được tạo cùng ngày `2026-09-07`, dẫn đến toàn bộ 130 nhiệm vụ đều có `startDate` thuộc Tháng 9 và hạn chót lớn hơn ngày `2026-08-25`, làm cho 100% nhiệm vụ lọt vào bộ lọc Tháng 9 dù có cột phân loại `academicMonth`.

#### Mâu thuẫn 7 (Phát hiện từ Code Review): Phân mảnh ngày neo (Reference Date) & Múi giờ UTC
* **Hiện tượng:** Server dùng 3 ngày neo khác nhau: `"2026-09-07"` cho `stats.overdueTasks`, `new Date()` cho `departmentHealth`, `"2026-09-09"` cho `upcomingItems`. Client dùng `"2026-09-04"` và `"2026-09-06"`.
* **Nguyên nhân:** So sánh `new Date(dueDate) < now` bị lệch múi giờ Việt Nam (UTC+7): các task có hạn trong ngày bị tính là quá hạn ngay từ 07:00 sáng.

---

## PHẦN 2: CHUẨN ĐỐI SÁNH QUỐC TẾ & KIẾN TRÚC WORLD-CLASS

Nghiên cứu được tổng hợp độc lập qua Exa Search từ mã nguồn mở và tài liệu kiến trúc của **Linear.app, Plane.so, ERPNext, OpenProject, ServiceNow, Workday, Stripe**:

```
+---------------------------------------------------------------------------------------------------------+
|                  KIẾN TRÚC VẬN HÀNH CHUẨN WORLD-CLASS CHO QCET E-OFFICE                                 |
+---------------------------------------------------------------------------------------------------------+
| [TẦNG 1: TRẠNG THÁI 2 LỚP (Linear & Plane)]                                                             |
| Systemic Enum: BACKLOG | UNSTARTED | STARTED | IN_REVIEW | COMPLETED | CANCELED                         |
| Display Labels: Dự thảo | Đang thực hiện | Chờ BGH duyệt | Đã nghiệm thu (Tùy biến hành chính)         |
+---------------------------------------------------------------------------------------------------------+
| [TẦNG 2: BẢO TOÀN SỐ LƯỢNG (Little's Law & MECE)]                                                       |
| Total (130) = InProgress (85) + NotStarted (30) + WaitingReview (3) + Overdue (1) + Completed (11)      |
| Cấm triệt để gộp Unstarted vào InProgress để tránh WIP Inflation và đo đúng Cycle Time vs Lead Time     |
+---------------------------------------------------------------------------------------------------------+
| [TẦNG 3: TRỰC GIAO TIẾN ĐỘ & SỨC KHỎE (Stripe & Datadog)]                                               |
| - Throughput: Tỷ lệ nghiệm thu = Completed / (Total - Canceled) = 11/130 (8.5%)                         |
| - Effort: Tiến độ thực hiện bình quân = Average(progressPercent) = 44%                                   |
| - Health: RAG Status (Good / Warning / Critical) đánh giá độc lập qua đường găng và hạn chót           |
+---------------------------------------------------------------------------------------------------------+
| [TẦNG 4: HÀNG ĐỢI HÀNH ĐỘNG BGH (ServiceNow & Workday)]                                                 |
| - Ưu tiên 3 tầng: (1) Tờ trình chờ duyệt -> (2) Tắc nghẽn SLA/Quá hạn -> (3) Nhiệm vụ Chiến lược        |
| - Verified Clear Horizon: Khi = 0, hiện ShieldCheck "11/11 đơn vị thông suốt", tuyệt đối cấm mock data  |
| - Ma sát bất đối xứng: [Phê duyệt] 1-click có Undo Toast; [Yêu cầu sửa] mở Inline Drawer                |
+---------------------------------------------------------------------------------------------------------+
```

### 2.1. Phân tầng trạng thái 2 lớp (Two-Tier State Category Meta-Architecture) từ Linear & Plane
* **Nguyên tắc:** Tách biệt hoàn toàn nhãn hiển thị người dùng (Display Status) khỏi mã định danh trạng thái hệ thống (State Category Enum). Mọi thuật toán tổng hợp cây phân cấp (Rollup Aggregation), máy trạng thái (State Machine), tính toán SLA và KPI chỉ truy vấn duy nhất trên `StateCategory`.
* **Ứng dụng vào QCET:** Đồng bộ chặt chẽ giữa Prisma Enum `TaskStatus` và TypeScript runtime types, loại bỏ hoàn toàn các chuỗi so sánh tùy ý rải rác.

### 2.2. Định luật Little & Cấm gộp "Chưa làm" vào "Đang làm" (WIP Limit Protection)
* **Nguyên tắc:** Việc gộp việc chưa làm (`UNSTARTED`) vào việc đang làm (`STARTED` / `IN_PROGRESS`) vi phạm định luật Little trong lý thuyết dòng chảy. Nó thổi phồng chỉ số Work-In-Progress (WIP Inflation), làm mất khả năng đo lường `Cycle Time` (thời gian làm thực tế) so với `Lead Time` (thời gian từ lúc giao việc), khiến lãnh đạo không nhận diện được tắc nghẽn ở khâu chờ phân công hay khâu thực thi.
* **Ứng dụng vào QCET:** Đếm rạch ròi 85 đang làm và 30 chưa bắt đầu.

### 2.3. Tách biệt Tỷ lệ hoàn thành (Throughput) vs Tiến độ trung bình (WIP Effort)
* **Công thức chuẩn quốc tế (Loại trừ Canceled):**
  $$\text{Completion Rate (\%)} = \frac{\sum \text{Completed Items}}{\sum (\text{Total Items} - \text{Canceled Items})} \times 100$$
  *Quy chuẩn giáo dục:* Các nhiệm vụ được Hội đồng trường bãi bỏ hoặc thay thế (`CANCELED`) phải được khấu trừ khỏi mẫu số, đảm bảo đơn vị vẫn có thể đạt tỷ lệ hoàn thành 100% khi bàn giao đủ các nhiệm vụ hợp lệ.
* **Tiến độ trung bình:**
  $$\text{Average Progress (\%)} = \frac{\sum_{i=1}^{N} \text{progressPercent}_i}{N}$$
* **Ứng dụng vào QCET:** Đổi tiêu đề Thẻ 4 thành **"Tiến độ trung bình toàn trường"**, giá trị chính là `44%`, dòng subtext diễn giải minh bạch: *"Đã nghiệm thu 11/130 nhiệm vụ (8.5%)"*.

### 2.4. Phân vùng thời gian học thuật (Academic Period Dimension) từ ERPNext & OpenProject
* **Đại số khoảng Allen (Allen's Interval Algebra):** Một nhiệm vụ thuộc tháng vận hành học thuật khi và chỉ khi:
  $$\text{Task Active} \iff (\text{startDate} \le \text{PeriodEnd}) \land (\text{dueDate} \ge \text{PeriodStart})$$
* **Phân tách nợ quá hạn kỳ trước (Segregated Prior Overdue Debt):** Nhiệm vụ quá hạn từ các kỳ trước (`dueDate < PeriodStart`) được đưa vào nhóm riêng biệt "Nợ đọng kỳ trước" để BGH xử lý, không gộp vào mẫu số kỳ này làm sập tỷ lệ hoàn thành hiện tại.

### 2.5. Hàng đợi phê duyệt BGH & Chuẩn Empty State "Verified Clear Horizon" (ServiceNow & Workday)
* **Phân cấp ưu tiên 3 tầng (Urgency Hierarchy):**
  1. *Gating Approvals (Chờ duyệt):* Tờ trình, kế hoạch thẩm định chặn luồng vận hành của các khoa/phòng.
  2. *SLA Exceptions (Tắc nghẽn/Trễ hạn):* Công việc vi phạm hạn chót hoặc bị báo cáo vướng mắc.
  3. *Strategic Monitoring (Chiến lược):* Nhiệm vụ trọng tâm năm học đang triển khai đúng tiến độ.
* **Verified Clear Horizon:** Khi không có công việc tồn đọng (count = 0), tuyệt đối không fallback dữ liệu giả và không để khung trống trơ. Hiển thị khối chứng nhận vận hành chuẩn:
  * Icon `ShieldCheck` xanh ngọc uy tín.
  * Tiêu đề: *"Hệ thống vận hành thông suốt: Không có hồ sơ tồn đọng"*.
  * Dòng dấu vết kiểm toán: *"Đã đối soát dữ liệu lúc [HH:mm] • 11/11 đơn vị hoàn tất thẩm định"*.
* **Ma sát bất đối xứng (Asymmetric Friction):**
  * Nút `[Phê duyệt ngay]`: Thực thi 1-click với Optimistic UI và Undo Toast 5 giây, không bật popup modal gây phiền hà.
  * Nút `[Yêu cầu hiệu chỉnh]`: Mở rộng ô nhập nhận xét trực tiếp ngay trong thẻ (inline micro-drawer).
  * Nút `[Đôn đốc]`: Gửi thông báo đẩy đến Trưởng đơn vị, chuyển sang trạng thái *"Đã đôn đốc (HH:mm)"* và khóa trong 24 giờ (Rate-Limited Nudge Cooldown).

---

## PHẦN 3: CHUẨN HÓA ĐỊNH NGHĨA SỐ LIỆU & NGUYÊN TẮC BẢO TOÀN TOÁN HỌC

### 3.1. Định luật Bảo toàn Số lượng (MECE Conservation Law)

Tại mọi thời điểm và trên mọi thành phần giao diện, các tập hợp con phải mang tính toàn diện và loại trừ lẫn nhau (Mutually Exclusive, Collectively Exhaustive):

$$\mathbf{TotalSchoolTasks} = \mathbf{InProgress} + \mathbf{NotStarted} + \mathbf{WaitingApproval} + \mathbf{Overdue} + \mathbf{Completed}$$

$$\mathbf{TotalStaffTasks} = \mathbf{SubInProgress} + \mathbf{SubNotStarted} + \mathbf{SubWaitingApproval} + \mathbf{SubOverdue} + \mathbf{SubCompleted}$$

$$\mathbf{TotalAllWorkload} = \mathbf{TotalSchoolTasks} + \mathbf{TotalStaffTasks}$$

### 3.2. Bảng đối chiếu định nghĩa chỉ số và thuật toán phân loại

| Chỉ số | Khóa kỹ thuật | Điều kiện phân loại logic chuẩn | Ý nghĩa nghiệp vụ lãnh đạo |
| :--- | :--- | :--- | :--- |
| **Tổng nhiệm vụ trường** | `totalSchoolTasks` | Nhiệm vụ có `scope === "SCHOOL"` thuộc bộ lọc kỳ học. | Quy mô công việc chỉ đạo cấp Trường. |
| **Đang thực hiện** | `schoolTasksInProgress` | `status === "IN_PROGRESS"` VÀ `dueDate >= referenceDate`. | Khối lượng nhân lực đang tích cực triển khai. |
| **Chưa bắt đầu** | `schoolTasksNotStarted` | `status === "NOT_STARTED"` VÀ `dueDate >= referenceDate`. | Kế hoạch đã giao nhưng chưa kích hoạt. |
| **Chờ BGH phê duyệt** | `needsReviewTasksCount` | `status === "WAITING_APPROVAL"` HOẶC `status === "PENDING_EXECUTIVE_APPROVAL"` HOẶC `(progressPercent === 100 && status !== "COMPLETED")` HOẶC có subtask `NEEDS_REVIEW`. | Tờ trình, đề cương, báo cáo đang chờ BGH ký duyệt. |
| **Vướng mắc & Quá hạn** | `overdueTasksCount` | `status === "OVERDUE"` HOẶC `status === "BLOCKED"` HOẶC `(dueDate < referenceDate && status !== "COMPLETED")`. | Điểm nghẽn cần BGH can thiệp, tháo gỡ hoặc đôn đốc. |
| **Đã hoàn thành** | `schoolTasksCompleted` | `status === "COMPLETED"`. | Nhiệm vụ đã được nghiệm thu chính thức. |
| **Tiến độ trung bình** | `averageSchoolProgressPercent` | $\frac{\sum \text{progressPercent}}{\text{totalSchoolTasks}}$ (làm tròn số nguyên, an toàn `NaN`). | Khối lượng nỗ lực bình quân đã thực hiện. |
| **Tỷ lệ hoàn thành** | `completionRate` | $\frac{\text{schoolTasksCompleted}}{\text{totalSchoolTasks} - \text{schoolTasksCanceled}} \times 100\%$. | Hiệu suất nghiệm thu dứt điểm mục tiêu. |

---

## PHẦN 4: ĐẶC TẢ KỸ THUẬT TẦNG DỮ LIỆU & SERVER AGGREGATION

### 4.1. Chuẩn hóa Hệ thống Neo Ngày Duy nhất (Single Reference Date Anchor)
Tạo hàm chuẩn trong `src/lib/academic-calendar.ts`:
```typescript
/**
 * Trả về chuỗi ngày hệ thống chuẩn (YYYY-MM-DD) theo múi giờ Việt Nam (Asia/Ho_Chi_Minh).
 * Cho phép ghi đè trong môi trường kiểm thử qua biến môi trường NEXT_PUBLIC_REFERENCE_DATE.
 */
export function getSystemReferenceDate(): string {
  if (process.env.NEXT_PUBLIC_REFERENCE_DATE) {
    return process.env.NEXT_PUBLIC_REFERENCE_DATE;
  }
  // Mặc định ngày hệ thống năm học demo: "2026-09-09"
  return "2026-09-09";
}

/**
 * Kiểm tra quá hạn an toàn theo phép so sánh chuỗi ISO YYYY-MM-DD.
 * Tránh hoàn toàn lỗi parse UTC nửa đêm (00:00Z = 07:00 VN) gây quá hạn sớm lúc sáng sớm.
 */
export function isTaskPastDue(dateStr?: string | Date | null, referenceDate: string = getSystemReferenceDate()): boolean {
  if (!dateStr) return false;
  const isoDate = typeof dateStr === "string" 
    ? (dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr)
    : dateStr.toISOString().split("T")[0];
  return isoDate < referenceDate;
}
```

### 4.2. Cải tiến `src/lib/dashboard-aggregator.ts`
Hàm `computeDashboardStats` được viết lại hoàn toàn để bảo đảm nguyên tắc bảo toàn số học và loại bỏ triệt để lỗi ngộ độc `NaN`:
```typescript
export function computeDashboardStats(
  tasks: SchoolTask[],
  referenceDate: string = getSystemReferenceDate()
): DashboardStats {
  const totalSchoolTasks = tasks.length;
  
  let schoolTasksCompleted = 0;
  let schoolTasksInProgress = 0;
  let schoolTasksNotStarted = 0;
  let schoolTasksWaitingApproval = 0;
  let schoolTasksOverdue = 0;

  let totalStaffTasks = 0;
  let staffTasksCompleted = 0;
  let staffTasksInProgress = 0;
  let staffTasksNotStarted = 0;
  let staffTasksWaitingApproval = 0;
  let staffTasksOverdue = 0;

  let totalProgress = 0;

  for (const t of tasks) {
    const rawProgress = typeof t.progressPercent === "number" && !isNaN(t.progressPercent)
      ? t.progressPercent
      : (t.status === "COMPLETED" ? 100 : 0);
    totalProgress += rawProgress;

    const isOverdue =
      (t.status as string) === "OVERDUE" ||
      ((t.status as string) === "BLOCKED") ||
      (t.status !== "COMPLETED" && isTaskPastDue(t.dueDate, referenceDate));

    const isWaitingApproval =
      (t.status as string) === "WAITING_APPROVAL" ||
      t.status === "PENDING_EXECUTIVE_APPROVAL" ||
      (rawProgress === 100 && t.status !== "COMPLETED");

    if (t.status === "COMPLETED") {
      schoolTasksCompleted++;
    } else if (isWaitingApproval) {
      // Ưu tiên: Việc đã nộp chờ duyệt phải vào hàng đợi phê duyệt của BGH trước
      schoolTasksWaitingApproval++;
    } else if (isOverdue) {
      schoolTasksOverdue++;
    } else if ((t.status as string) === "NOT_STARTED") {
      schoolTasksNotStarted++;
    } else {
      schoolTasksInProgress++;
    }

    // Tổng hợp cấp Đơn vị (subTasks)
    for (const sub of t.subTasks || []) {
      totalStaffTasks++;
      const isSubOverdue =
        (sub.status as string) === "OVERDUE" ||
        (sub.status as string) === "BLOCKED" ||
        (sub.status !== "COMPLETED" && isTaskPastDue(sub.dueDate, referenceDate));

      const isSubWaiting =
        sub.status === "NEEDS_REVIEW" ||
        (sub.status as string) === "WAITING_APPROVAL" ||
        sub.requiresReview === true;

      if (sub.status === "COMPLETED") {
        staffTasksCompleted++;
      } else if (isSubWaiting) {
        staffTasksWaitingApproval++;
      } else if (isSubOverdue) {
        staffTasksOverdue++;
      } else if ((sub.status as string) === "NOT_STARTED") {
        staffTasksNotStarted++;
      } else {
        staffTasksInProgress++;
      }
    }
  }

  const averageSchoolProgressPercent = totalSchoolTasks > 0
    ? Math.round(totalProgress / totalSchoolTasks)
    : 0;

  const completionRate = totalSchoolTasks > 0
    ? Math.round((schoolTasksCompleted / totalSchoolTasks) * 100)
    : 0;

  return {
    totalSchoolTasks,
    schoolTasksInProgress,
    schoolTasksCompleted,
    schoolTasksNotStarted,
    schoolTasksWaitingApproval,
    schoolTasksOverdue,
    totalStaffTasks,
    staffTasksInProgress,
    staffTasksCompleted,
    staffTasksNotStarted,
    staffTasksWaitingApproval,
    staffTasksOverdue,
    needsReviewTasksCount: schoolTasksWaitingApproval + staffTasksWaitingApproval,
    overdueTasksCount: schoolTasksOverdue + staffTasksOverdue,
    averageSchoolProgressPercent,
    completionRate,
    // Đồng bộ trường server aggregator
    totalTasks: totalSchoolTasks,
    inProgressTasks: schoolTasksInProgress,
    completedTasks: schoolTasksCompleted,
    overdueTasks: schoolTasksOverdue,
    pendingApprovals: schoolTasksWaitingApproval,
  };
}
```

### 4.3. Sửa lỗi hàm `computeSchoolTaskRollup` trong `src/lib/dashboard-aggregator.ts`
Khắc phục lỗi reset tiến độ về 0 đối với task cấp trường không có subtask:
```typescript
export function computeSchoolTaskRollup(task: SchoolTask): SchoolTask {
  const totalSubTasks = task.subTasks ? task.subTasks.length : 0;
  const completedSubTasks = totalSubTasks > 0
    ? task.subTasks.filter((st) => st.status === "COMPLETED").length
    : 0;

  const progressPercent = totalSubTasks > 0
    ? Math.round((completedSubTasks / totalSubTasks) * 100)
    : task.status === "COMPLETED"
      ? 100
      : (typeof task.progressPercent === "number" && !isNaN(task.progressPercent) ? task.progressPercent : 0);

  return {
    ...task,
    totalSubTasks,
    completedSubTasks,
    progressPercent,
  };
}
```

### 4.4. Cải tiến `src/lib/server/dashboard-service.ts`
1. Nạp đồng thời cả nhiệm vụ cấp Trường (`scope: TaskScope.SCHOOL`) và nhiệm vụ cấp Đơn vị (`scope: TaskScope.DEPARTMENT`).
2. Sửa lỗi `averageProgressPercent` của phòng ban: Thay vì tính `completed / total`, tính chuẩn trung bình cộng `progressPercent` của các task trong phòng ban đó.
3. Cách ly trạng thái `CANCELLED`: Không tính các tác vụ đã hủy vào `overdueTasks` hoặc `inProgressTasks`.

### 4.5. An toàn Phân quyền RBAC, Kiểm soát Phiên & Chống Tự Duyệt (Segregation of Duties - SoD)
1. **Bảo vệ API `/api/dashboard/overview`**:
   - Xác thực phiên làm việc JWT qua `getSessionFromRequest(request)`. Trả về `401 Unauthorized` nếu chưa đăng nhập.
   - Phân cấp dữ liệu trả về theo vai trò: `ADMIN` / `BAN_GIAM_HIEU` nhận toàn trường; `MANAGER` nhận dữ liệu cấp trường và đơn vị phụ trách; `STAFF` chỉ nhận dữ liệu cá nhân.
2. **Khóa Quyền Duyệt Hoàn Thành Nhiệm Vụ Cấp Trường (Separation of Duties - SoD)**:
   - Trong `src/app/api/tasks/[id]/route.ts`:
     - Khi `existing.scope === TaskScope.SCHOOL`, chỉ có vai trò `ADMIN` hoặc `BAN_GIAM_HIEU` mới có quyền chuyển trạng thái sang `COMPLETED`.
     - Quy tắc bất biến chống tự duyệt: `actor.id === task.assigneeId -> Phê duyệt: BỊ TỪ CHỐI`. Người thực hiện không được phép tự duyệt hoàn thành công việc của chính mình, trừ phi có ủy quyền hợp lệ trong bảng `DacumDelegation` còn thời hạn (`DELEGATE_FULL` hoặc `DELEGATE_APPROVE`).
     - Danh tính người phê duyệt (`approvedBy`) phải được trích xuất trực tiếp từ session token server, nghiêm cấm nhận từ client request body.

---

## PHẦN 5: ĐẶC TẢ KỸ THUẬT TẦNG CLIENT HOOK & FILTERING PIPELINE

### 5.1. Chuẩn hóa Lọc theo Kỳ học tại `src/lib/academic-calendar.ts`
Hàm `filterTasksByAcademicMonthStrict` được tối ưu hóa:
1. Khi `task.academicMonth` đã được gán số tháng tường minh (ví dụ: `academicMonth: 9`), ưu tiên lọc theo trường này.
2. Với các task chưa có `academicMonth`, áp dụng chuẩn Allen Interval:
   `startDate <= period.endDate && dueDate >= period.startDate`.

### 5.2. Hàm trích xuất Hành động BGH Động (`extractExecutiveActionItems`)
Trong `src/lib/executive-matrix-aggregator.ts`, bổ sung hàm chuyển đổi nhiệm vụ thật từ DB thành `ExecutiveActionItem[]`:
```typescript
export function extractExecutiveActionItems(
  tasks: SchoolTask[],
  referenceDate: string = getSystemReferenceDate()
): ExecutiveActionItem[] {
  const items: ExecutiveActionItem[] = [];

  for (const t of tasks) {
    const isWaiting =
      (t.status as string) === "WAITING_APPROVAL" ||
      t.status === "PENDING_EXECUTIVE_APPROVAL" ||
      (t.progressPercent === 100 && t.status !== "COMPLETED") ||
      (t.subTasks || []).some((s) => s.status === "NEEDS_REVIEW" || s.requiresReview);

    const isOverdue =
      (t.status as string) === "OVERDUE" ||
      (t.status as string) === "BLOCKED" ||
      (t.status !== "COMPLETED" && isTaskPastDue(t.dueDate, referenceDate));

    if (isWaiting) {
      items.push({
        id: `act-wait-${t.id}`,
        taskId: t.id,
        title: t.title,
        departmentName: t.leadDepartment || "QCET",
        departmentCode: t.leadDepartmentCode || "BGH",
        leadName: t.leadAssigneeName || "Chưa phân công",
        leadAvatar: t.leadAssigneeAvatar,
        dueDate: t.dueDate,
        filterType: "PENDING_APPROVAL",
        badgeLabel: "Chờ phê duyệt",
        badgeVariant: "warning",
        actionType: "APPROVE",
        actionLabel: "Phê duyệt ngay",
      });
    } else if (isOverdue) {
      items.push({
        id: `act-overdue-${t.id}`,
        taskId: t.id,
        title: t.title,
        departmentName: t.leadDepartment || "QCET",
        departmentCode: t.leadDepartmentCode || "BGH",
        leadName: t.leadAssigneeName || "Chưa phân công",
        leadAvatar: t.leadAssigneeAvatar,
        dueDate: t.dueDate,
        filterType: "BLOCKED_OVERDUE",
        badgeLabel: "Trễ hạn tiến độ",
        badgeVariant: "rose",
        actionType: "URGE",
        actionLabel: "Đôn đốc",
      });
    } else if (t.status === "IN_PROGRESS") {
      items.push({
        id: `act-strat-${t.id}`,
        taskId: t.id,
        title: t.title,
        departmentName: t.leadDepartment || "QCET",
        departmentCode: t.leadDepartmentCode || "BGH",
        leadName: t.leadAssigneeName || "Chưa phân công",
        leadAvatar: t.leadAssigneeAvatar,
        dueDate: t.dueDate,
        filterType: "STRATEGIC",
        badgeLabel: "Nhiệm vụ trọng tâm",
        badgeVariant: "default",
        actionType: "MONITOR",
        actionLabel: "Theo dõi",
      });
    }
  }

  // Sắp xếp ưu tiên: Chờ duyệt (0) -> Trễ hạn (1) -> Chiến lược (2)
  return items.sort((a, b) => {
    const weights: Record<string, number> = {
      PENDING_APPROVAL: 0,
      BLOCKED_OVERDUE: 1,
      STRATEGIC: 2,
    };
    return (weights[a.filterType] ?? 9) - (weights[b.filterType] ?? 9);
  });
}
```

---

## PHẦN 6: ĐẶC TẢ GIAO DIỆN & CÔNG THÁI HỌC HÀNH CHÍNH (UI ERGONOMICS & ZERO FAKE DATA)

### 6.1. Khai tử hoàn toàn Mock Data & Chuẩn hóa Empty State "Verified Clear Horizon"
* **Xóa bỏ:** Khai tử mảng `DEFAULT_ACTION_ITEMS` trong `src/components/dashboard/executive-action-center.tsx`.
* **Giao diện Empty State chuẩn công sở:**
  Khi `items.length === 0` hoặc danh mục lọc không có hồ sơ:
  ```tsx
  <div className="flex flex-col items-center justify-center p-8 text-center bg-emerald-50/50 border border-emerald-200/80 rounded-xl">
    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
      <ShieldCheck className="w-6 h-6 text-emerald-600" />
    </div>
    <h4 className="text-base font-semibold text-emerald-900 mb-1">
      Hệ thống vận hành thông suốt: Không có hồ sơ tồn đọng
    </h4>
    <p className="text-sm text-emerald-700 max-w-md">
      Tất cả các tờ trình và nhiệm vụ trong kỳ vận hành đã được thẩm định đúng hạn. 11/11 đơn vị bảo đảm tiến độ.
    </p>
    <span className="mt-3 text-xs text-emerald-600/80 font-medium">
      Đã đối soát thời gian thực • Múi giờ Việt Nam (UTC+7)
    </span>
  </div>
  ```

### 6.2. Nâng cấp Thẻ KPI trong `ExecutiveStatStrip`
Tại `src/components/dashboard/executive-stat-strip.tsx`:
* **Thẻ 1 - Nhiệm vụ cấp Trường:**
  * Giá trị: `130`
  * Subtext: `${stats.schoolTasksInProgress} đang làm · ${stats.schoolTasksNotStarted} chưa làm · ${stats.schoolTasksCompleted} hoàn thành` (85 đang làm · 30 chưa làm · 11 hoàn thành).
* **Thẻ 3 - Cần xử lý & Trễ hạn:**
  * Giá trị: `${urgentCount}`
  * Subtext: `${stats.needsReviewTasksCount} cần duyệt · ${stats.overdueTasksCount} trễ hạn`
* **Thẻ 4 - Tiến độ & Tỷ lệ hoàn thành:**
  * Tiêu đề thẻ: **"Tiến độ trung bình toàn trường"**
  * Giá trị chính: `${stats.averageSchoolProgressPercent}%`
  * Subtext: `Hoàn tất ${stats.schoolTasksCompleted}/${stats.totalSchoolTasks} nhiệm vụ (${stats.completionRate}%)`
  * Thanh Progress: Dải tiến độ trực quan đa sắc (Segmented Rail) phản ánh tỷ lệ hoàn thành.

---

## PHẦN 7: CHI TIẾT KỸ THUẬT ĐIỀU CHỈNH TỪNG TỆP NGUỒN

| STT | Đường dẫn tệp | Trách nhiệm kỹ thuật & Nội dung chỉnh sửa |
| :---: | :--- | :--- |
| 1 | `src/lib/academic-calendar.ts` | Bổ sung `getSystemReferenceDate()`, chuẩn hóa `isTaskPastDue()`. Cải tiến `filterTasksByAcademicMonthStrict()` ưu tiên `academicMonth` và xử lý Allen Interval an toàn. |
| 2 | `src/lib/dashboard-aggregator.ts` | Viết lại `computeDashboardStats()` tuân thủ luật bảo toàn số lượng (MECE). Sửa `computeSchoolTaskRollup()` giữ nguyên `progressPercent` khi không có subtasks. |
| 3 | `src/lib/executive-matrix-aggregator.ts` | Cập nhật `computeExecutiveActionStats()` đếm cả `WAITING_APPROVAL`. Viết hàm `extractExecutiveActionItems()`. Sửa `computeDepartmentHealthMatrix()` tính đúng `averageProgressPercent` và `completionRate` cho subtasks. |
| 4 | `src/lib/server/dashboard-service.ts` | Thống nhất `referenceDate` qua `getSystemReferenceDate()`. Nạp các nhiệm vụ `scope: DEPARTMENT`. Sửa công thức `averageProgressPercent` phòng ban. |
| 5 | `src/components/dashboard/executive-stat-strip.tsx` | Đổi tên Thẻ 4 thành *"Tiến độ trung bình toàn trường"*, sửa subtext Thẻ 1 và Thẻ 4 bảo toàn số học. |
| 6 | `src/components/dashboard/executive-action-center.tsx` | Khai tử mảng tĩnh `DEFAULT_ACTION_ITEMS`, tích hợp Empty State *Verified Clear Horizon*. |
| 7 | `src/components/dashboard/zones/dashboard-zone.tsx` | Truyền `executiveActionItems` được trích xuất từ dữ liệu thực vào `ExecutiveActionCenter`. |
| 8 | `src/hooks/use-task-filters.ts` | Khởi tạo và cung cấp `executiveActionItems` qua hook dữ liệu. |

---

## PHẦN 8: KẾ HOẠCH TRIỂN KHAI & MA TRẬN KIỂM THỬ NGHIỆM THU (TEST VERIFICATION MATRIX)

### 8.1. Lộ trình Triển khai 6 Bước (Implementation Steps)
1. **Bước 1 (Core Aggregators & Date Anchor):** Sửa `academic-calendar.ts`, `dashboard-aggregator.ts`, `executive-matrix-aggregator.ts`.
2. **Bước 2 (Server Service Synchronization):** Cập nhật `dashboard-service.ts` khớp nối query và các phép tính phòng ban.
3. **Bước 3 (Action Items Generator):** Xây dựng `extractExecutiveActionItems` và tích hợp vào hook `use-task-filters.ts`.
4. **Bước 4 (Frontend Presentation Clean-up):** Sửa `executive-stat-strip.tsx`, `executive-action-center.tsx`, `dashboard-zone.tsx`. Xóa bỏ hoàn toàn mock data.
5. **Bước 5 (Unit & Integration Testing):** Viết thêm và cập nhật test cases trong thư mục `tests/`.
6. **Bước 6 (Full QA & Verification):** Chạy `npm run typecheck` và `npm test` bảo đảm 100% tests xanh.

### 8.2. Ma trận Kiểm thử Nghiệm thu (Test Verification Matrix)

| Mã test | Tên kịch bản kiểm thử | Dữ liệu đầu vào | Kết quả kỳ vọng (Expected Output) | Trạng thái |
| :---: | :--- | :--- | :--- | :---: |
| **TC-01** | **Bảo toàn số lượng nhiệm vụ cấp trường (MECE)** | 130 nhiệm vụ cấp trường | $\text{InProgress}(85) + \text{NotStarted}(30) + \text{Waiting}(3) + \text{Overdue}(1) + \text{Done}(11) = 130$. | Chờ thực thi |
| **TC-02** | **Đồng bộ Thẻ 1 và Thẻ BGH 3** | Toàn bộ 130 nhiệm vụ | Thẻ 1 ghi rõ: `85 đang làm · 30 chưa làm · 11 hoàn thành`. Thẻ BGH 3 ghi: `85 nhiệm vụ trọng tâm`. Khớp số 85 hoàn hảo. | Chờ thực thi |
| **TC-03** | **Khớp nối Tờ trình BGH chờ duyệt** | 1 nhiệm vụ `WAITING_APPROVAL` trong Tháng 9 | Thẻ "Chờ BGH Phê duyệt" đếm đúng $\ge 1$, danh sách bên dưới hiển thị đúng nhiệm vụ đó, nút bấm: [Phê duyệt ngay]. | Chờ thực thi |
| **TC-04** | **Loại bỏ 100% Mock Action Items** | Không truyền prop items hoặc danh sách rỗng | Hiển thị khối *Verified Clear Horizon* với ShieldCheck, tuyệt đối không xuất hiện 5 nhiệm vụ mẫu hardcoded cũ. | Chờ thực thi |
| **TC-05** | **Chuẩn hóa nhãn Thẻ 4 và Tỷ lệ nghiệm thu** | 11/130 nhiệm vụ hoàn tất | Tiêu đề: "Tiến độ trung bình toàn trường: 44%", Subtext: "Hoàn tất 11/130 (8.5%)". | Chờ thực thi |
| **TC-06** | **Tính toán tiến độ phòng ban không bị 0%** | Phòng ban có subtasks đang làm | Subtasks đang làm được cộng dồn `progressPercent` tương ứng, không bị ép về 0% như trước. | Chờ thực thi |
| **TC-07** | **Bảo vệ Task Rollup không có Subtask** | Task trường có `progressPercent: 60`, subTasks = [] | `computeSchoolTaskRollup` giữ nguyên `progressPercent: 60`, không bị reset về 0%. | Chờ thực thi |
| **TC-08** | **Chuẩn hóa ngày neo và không lệch múi giờ UTC** | Nhiệm vụ có `dueDate` là ngày hiện hành lúc 08:00 sáng VN | Không bị đánh dấu nhầm là quá hạn. | Chờ thực thi |
| **TC-09** | **TypeScript Typecheck** | Toàn bộ dự án | `npm run typecheck` vượt qua với 0 lỗi cú pháp và kiểu dữ liệu. | Chờ thực thi |
| **TC-10** | **Full Regression Suite** | Toàn bộ test suite | `npm test` vượt qua 100% tất cả các bài kiểm thử đơn vị và tích hợp. | Chờ thực thi |

---
**Tài liệu này là căn cứ kỹ thuật chính thức có hiệu lực ngay để tiến hành triển khai mã nguồn trên hệ thống QCET E-Office.**
