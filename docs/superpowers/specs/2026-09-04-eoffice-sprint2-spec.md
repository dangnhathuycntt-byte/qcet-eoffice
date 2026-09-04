# QCET E-Office Sprint 2 Design Spec: Tasks Kanban, Create Task Modal, Calendar & Org Hierarchy

**Date:** 2026-09-04  
**Project:** QCET E-Office (Hệ thống Văn phòng Điều hành Điện tử - Trường Cao đẳng Kinh tế - Kỹ thuật Cần Thơ)  
**Aesthetic:** Twenty CRM Clean Slate & Zinc (Light Mode Priority, hairline 1px borders, solid charcoal action surface `#18181B`)

---

## 1. Overview & Objectives

Sprint 2 expands QCET E-Office from the Executive Dashboard into full operational workspaces:
1. **Modal Tạo & Giao việc (`CreateTaskModal`):** Cho phép BGH giao nhiệm vụ cấp trường hoặc Lãnh đạo Đơn vị phân rã việc con cho nhân viên.
2. **Trang Quản lý Công việc (`/tasks`):** Hỗ trợ chuyển đổi 2 chế độ xem: **[Bảng phân cấp (Table)]** và **[Bảng Kanban (Board)]** với 4 cột trạng thái.
3. **Trang Lịch công tác (`/calendar`):** Lưới lịch Tháng / Tuần hiển thị các mốc sự kiện và deadline toàn trường.
4. **Trang Cơ cấu Tổ chức (`/org`):** Sơ đồ cây các Phòng/Khoa/Trung tâm và danh bạ nhân sự trực thuộc.

---

## 2. Component & Architecture Specifications

### 2.1 Modal Tạo & Giao việc (`src/components/dashboard/create-task-modal.tsx`)
* **Trigger:** Nút `+ Giao việc` ở Topbar, Header bảng hoặc phím tắt.
* **Fields:**
  * Cấp độ nhiệm vụ: `TRUONG` (Nhiệm vụ cấp Trường) | `DON_VI` (Công việc Đơn vị).
  * Tiêu đề công vi���c (Title).
  * Danh mục / Mảng công tác (`CHUYEN_DOI_SO`, `TRUYEN_THONG`, `CNTT`, `ATTT`, `THU_VIEN`, `BAO_CAO`, `KHAC`).
  * Người chủ trì (Lead Assignee) & Cán bộ phối hợp (Co-assignees).
  * Hạn hoàn thành (Due Date).
  * Mô tả chi tiết & yêu cầu kết quả.
* **UX:** Dialog modal với backdrop mờ nhẹ, bo góc `rounded-lg` (8px), nút xác nhận đen đặc `#18181B`.

### 2.2 Trang Quản lý Công việc & Kanban Board (`src/app/tasks/page.tsx`, `src/components/tasks/task-kanban-board.tsx`)
* **View Switcher:** Nút toggle `Table` vs `Kanban` trên thanh công cụ.
* **Kanban Columns (4 cột chuẩn Twenty):**
  1. `Mới 🆕` (`bg-red-50/40`, viền `border-red-200/60`)
  2. `Đang thực hiện 🔨` (`bg-blue-50/40`, viền `border-blue-200/60`)
  3. `Cần chỉnh sửa ⚠️` (`bg-amber-50/40`, viền `border-amber-200/60`)
  4. `Hoàn thành 👍` (`bg-emerald-50/40`, viền `border-emerald-200/60`)
* **Kanban Card:** Tiêu đề, badge danh mục, avatar người phụ trách, ngày hết hạn, thanh tiến độ (nếu là việc trường) hoặc nhãn việc trường cha (nếu là việc con), nút chuyển trạng thái nhanh.

### 2.3 Trang Lịch công tác (`src/app/calendar/page.tsx`, `src/components/calendar/calendar-month-view.tsx`)
* **Lưới lịch Tháng:** Hiển thị 7 cột (Thứ 2 ➔ Chủ nhật), ô ngày nổi bật ngày hiện tại, hiển thị các chip sự kiện / deadline có màu tương ứng theo danh mục.
* **Bảng chi tiết ngày:** Click vào ô ngày sẽ hiển thị danh sách các đầu việc đến hạn trong ngày ở panel bên cạnh.

### 2.4 Trang Cơ cấu Tổ chức & Nhân sự (`src/app/org/page.tsx`, `src/components/org/organization-tree.tsx`)
* **Sơ đồ cây Đơn vị:**
  * Ban Giám hiệu (Hiệu trưởng, các Phó Hiệu trưởng)
  * Các Phòng chức năng (Đào tạo & QLKH, Hành chính - Quản trị, Kế hoạch - Tài chính, Khảo thí & ĐBCL, CTHSSV...)
  * Các Khoa chuyên môn (Khoa CNTT, Khoa Kinh tế, Khoa Kỹ thuật Công nghệ...)
  * Các Trung tâm (Trung tâm Truyền thông & Số hóa, Trung tâm Ngoại ngữ - Tin học...)
* **Danh bạ cán bộ:** Click vào đơn vị sẽ lọc danh sách viên chức, hiển thị chức vụ, email, số điện thoại nội bộ và các nhiệm vụ đang phụ trách.

---

## 3. Global Constraints

* **Twenty CRM Aesthetic:** Nền Canvas `#FBFBFB`, Thẻ `#FFFFFF`, viền hairline `#E4E4E7`, nút đen đặc `#18181B`.
* **Geometry:** `rounded-lg` (8px) cho container/cards, `rounded-md` (6px) cho controls/buttons/badges.
* **Terminology:** Tiếng Việt chuẩn quản trị trường cao đẳng/đại học (BGH, Phòng, Khoa, Trung tâm, Cán bộ chủ trì).
* **Test Coverage:** TDD nghiêm ngặt, kiểm tra mọi helper và component logic trước khi commit.
