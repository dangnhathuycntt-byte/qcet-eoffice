# Đặc tả Thiết kế: Trung tâm Quản lý Công việc Hợp nhất (QCET Unified Task Hub)

**Mã dự án:** QCET-TASK-HUB-2026  
**Ngày lập:** 06/09/2026  
**Trạng thái:** Approved by User  
**Định hướng thiết kế:** Chuyên tâm cho quản lý công việc (Focus-driven Workstation), Tinh gọn điều hướng, Hợp nhất góc nhìn theo mô hình Linear/Notion E-Office.

---

## 1. Mục tiêu & Bối cảnh

### 1.1 Vấn đề hiện tại
* Hệ thống QCET E-Office bị phân mảnh trên 3 đường dẫn rời rạc: `/` (Trang chủ), `/tasks` (Nhiệm vụ cấp Trường), `/unit-tasks` (Công việc Đơn vị), cùng màn hình `/calendar` tách biệt.
* Người dùng (Ban Giám hiệu, Trưởng đơn vị, Cán bộ giảng viên) bị phân tâm và bối rối khi lựa chọn nơi theo dõi và xử lý công việc hàng ngày.
* Chuyển đổi giữa chế độ xem danh sách (Table), bảng Kanban và Lịch công tác đòi hỏi phải di chuyển giữa các trang khác nhau, làm gián đoạn dòng công việc (flow of work).

### 1.2 Giải pháp Đột phá: Unified Task Hub
* Gom toàn bộ hoạt động quản lý công việc vào **Một Trung tâm duy nhất (`/`)**.
* Phân tầng trải nghiệm tự nhiên:
  1. **Không gian cá nhân (My Focus):** Mở app là thấy ngay việc của bản thân, không cần tìm kiếm.
  2. **Không gian tổ chức (Org Scope):** Chuyển đổi linh hoạt giữa Việc của tôi, Cấp Trường, Cấp Đơn vị chỉ với 1 click.
  3. **Chuyển đổi góc nhìn trực quan (View Switcher):** Xem dạng Bảng cây phân cấp (Table), Bảng Kanban, hoặc Lịch công tác (Calendar) ngay trên cùng một trang.
* Tối giản thanh điều hướng toàn hệ thống từ 5 mục cồng kềnh xuống còn **4 mục trọng tâm**.

---

## 2. Kiến trúc Điều hướng & Định tuyến (Information Architecture)

### 2.1 Tái cấu trúc Menu Điều hướng (`src/components/navigation.tsx`)
Menu chính của hệ thống được tinh giản thành:
1. **Quản lý công việc (`/`)**: Trục làm việc chính hàng ngày, tích hợp toàn bộ các phạm vi (Cá nhân, Trường, Đơn vị) và góc nhìn (Table, Kanban, Calendar).
2. **Cơ cấu & Danh bạ (`/org`)**: Sơ đồ tổ chức toàn trường, danh bạ 300+ cán bộ giảng viên và ủy quyền/giao việc nhanh 1-click.
3. **Báo cáo & Phân tích (`/dashboard`)**: Trung tâm chỉ số KPI điều hành, phân tích tỷ lệ hoàn thành, tắc nghẽn công việc dành cho BGH và Lãnh đạo.
4. **Thông báo (`/notifications`)**: Danh sách thông báo cập nhật, cảnh báo tiến độ và nhắc việc.

### 2.2 Cơ chế Chuyển tiếp & Tương thích ngược (Backward Compatibility Redirects)
Các route cũ `/tasks`, `/unit-tasks`, `/calendar` sẽ tự động chuyển hướng về `/` kèm URL query params:
* `/tasks` $\rightarrow$ `/?scope=school`
* `/unit-tasks` $\rightarrow$ `/?scope=unit`
* `/calendar` $\rightarrow$ `/?view=calendar`

---

## 3. Cấu trúc Giao diện Trung tâm Quản lý Công việc (`src/app/page.tsx`)

Màn hình được thiết kế theo cấu trúc dọc 3 tầng chuẩn Linear:

```
+-----------------------------------------------------------------------------------+
| Top Navigation: Logo | Search Cmd+K | Live Clock | Role Switcher | + Giao việc mới|
+-----------------------------------------------------------------------------------+
| TẦNG 1: EXECUTIVE WORKBOXES & STAT STRIP                                          |
| [ Khẩn cấp & Quá hạn ] [ Cần tôi xử lý ] [ Tôi đã giao ] [ Đã hoàn thành ]        |
+-----------------------------------------------------------------------------------+
| TẦNG 2: UNIFIED CONTROL TOOLBAR                                                    |
| Phạm vi: [Việc của tôi] [Cấp Trường] [Cấp Đơn vị ▾]                               |
| Góc nhìn: [Danh sách phân tầng]  [Bảng Kanban]  [Lịch công tác]                   |
| Bộ lọc: [Ưu tiên ▾] [Trạng thái ▾] [Tìm kiếm nhanh...]                             |
+-----------------------------------------------------------------------------------+
| TẦNG 3: WORK CANVAS & INTERACTIVE SURFACE                                         |
| (Tự động hiển thị linh hoạt theo View Switcher đã chọn):                          |
| - Nếu chọn Danh sách: Bảng cây phân cấp (Cấp trường -> Đơn vị), 1-click actions   |
| - Nếu chọn Kanban: Lưới 4 cột (Chờ xử lý, Đang làm, Đang xem xét, Hoàn thành)    |
| - Nếu chọn Lịch: Lưới lịch tháng/tuần với deadline trực quan                      |
+-----------------------------------------------------------------------------------+
| SLIDE-OVER DRAWER: TaskDetailSideSheet (Trượt ra khi nhấp vào bất kỳ công việc)   |
+-----------------------------------------------------------------------------------+
```

### 3.1 Tầng 1: Hộp việc E-Office Tức thì (Instant Workboxes)
* 4 Card trạng thái thông minh với số liệu `font-mono tabular-nums`:
  1. **Khẩn cấp & Quá hạn (Red Accent):** Các công việc có `isUrgent = true` hoặc deadline trước ngày hiện tại mà chưa hoàn thành.
  2. **Cần tôi xử lý (Amber/Blue Accent):** Công việc mà người dùng đăng nhập là người chủ trì/thực hiện chính.
  3. **Tôi đã giao (Slate Accent):** Công việc do người dùng tạo hoặc giao cho cấp dưới, đang theo dõi tiến độ.
  4. **Đã hoàn thành (Emerald Accent):** Các công việc đã nghiệm thu.
* **Tương tác Filter-on-Click:** Bấm vào bất kỳ hộp việc nào sẽ kích hoạt bộ lọc tương ứng ngay trên Bảng hiển thị bên dưới.

### 3.2 Tầng 2: Thanh điều khiển hợp nhất (Unified Toolbar)
* **Scope Switcher (Phạm vi):**
  * `my-tasks`: Chỉ hiển thị các công việc liên quan trực tiếp đến người dùng đang đăng nhập.
  * `school-tasks`: Hiển thị toàn bộ các nhiệm vụ trọng tâm cấp Trường (BGH chỉ đạo).
  * `unit-tasks`: Hiển thị công việc phân rã theo Khoa/Phòng/Trung tâm (hỗ trợ dropdown chọn đơn vị cụ thể).
* **View Mode Switcher (Góc nhìn):**
  * `table`: Chế độ Bảng phân tầng phân cấp cha - con (`CascadingTaskTable`).
  * `kanban`: Bảng Kanban 4 cột (`TaskKanbanBoard`).
  * `calendar`: Lịch tháng deadline (`CalendarMonthView`).
* **Quick Search & Bộ lọc bổ trợ:** Lọc theo Mức độ ưu tiên (`Urgent`, `High`, `Normal`), Trạng thái và Danh mục (`Đào tạo`, `Hành chính`, `Tài chính`, v.v.).

### 3.3 Tầng 3: Khung hiển thị công việc (Work Canvas)
* Tự động phản hồi theo View Mode và Scope đã chọn:
  * Trong chế độ `table`: Hiển thị tiến độ `%`, thời hạn, người phụ trách, các nút thao tác 1-click xuất hiện tinh tế khi rê chuột (bắt đầu làm, cập nhật tiến độ, hoàn thành).
  * Trong chế độ `kanban`: Các card công việc hiển thị gọn gàng, hỗ trợ chuyển trạng thái trực tiếp.
  * Trong chế độ `calendar`: Hiển thị mật độ công việc theo từng ngày trong tháng.

### 3.4 Drawer Chi tiết Công việc (`TaskDetailSideSheet`)
* Mở ra từ cạnh phải màn hình khi nhấp vào bất kỳ công việc nào ở cả 3 chế độ (Table, Kanban, Calendar).
* Cho phép xem tài liệu nghiệm thu, biên bản đính kèm, cập nhật % tiến độ, bổ sung người phối hợp và trao đổi công việc nội bộ mà không làm mất trang làm việc hiện tại.

---

## 4. Mô hình Dữ liệu & Quy tắc Phân quyền (Role-Based Filtering)

1. **Hiệu trưởng / Phó Hiệu trưởng (Ban Giám hiệu):**
   * Mặc định xem được toàn bộ Nhiệm vụ cấp Trường và phân bổ tiến độ của tất cả các Khoa/Phòng.
   * Có quyền tạo Nhiệm vụ cấp Trường và giao thẳng cho các Trưởng đơn vị.
2. **Trưởng Phòng / Trưởng Khoa / Giám đốc Trung tâm:**
   * Không gian cá nhân tập trung vào: Nhiệm vụ BGH giao cho phòng mình + Công việc nội bộ phòng ban.
   * Có quyền phân rã nhiệm vụ cấp trường thành các công việc con và giao cho chuyên viên/giảng viên.
3. **Chuyên viên / Giảng viên:**
   * Tập trung 100% vào hộp việc cá nhân (`my-tasks`).
   * Cập nhật báo cáo tiến độ, nộp minh chứng nghiệm thu công việc.
4. **Cơ chế Rollup Tiến độ tự động:**
   * Khi các công việc đơn v��� (con) được cập nhật %, hệ thống tự động tính toán trung bình có trọng số để cập nhật % tiến độ của Nhiệm vụ cấp Trường (cha).

---

## 5. Kế hoạch Triển khai Kỹ thuật

1. **Giai đoạn 1: Chuẩn hóa Navigation & Routing**
   * Cập nhật `src/components/navigation.tsx` thành 4 mục menu chính.
   * Thiết lập redirect từ `/tasks`, `/unit-tasks`, `/calendar` về `/`.
2. **Giai đoạn 2: Tích hợp Bộ điều khiển Unified Task Hub vào `src/app/page.tsx`**
   * Tích hợp Scope Switcher (`my-tasks` | `school-tasks` | `unit-tasks`).
   * Tích hợp View Switcher (`table` | `kanban` | `calendar`).
   * Kết nối Hộp việc thông minh (Filter-on-click) với danh sách công việc.
3. **Giai đoạn 3: Kiểm thử & Nghiệm thu**
   * Kiểm tra đầy đủ phản hồi của 3 góc nhìn (Table, Kanban, Calendar).
   * Kiểm tra chuyển đổi các vai trò (BGH, Trưởng phòng, Chuyên viên).
   * Đảm bảo `npm run build` và `npm run typecheck` đạt 100% không có lỗi.
