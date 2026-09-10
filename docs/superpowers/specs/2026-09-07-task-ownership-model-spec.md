# Task Ownership Model — Design Spec
**Date:** 2026-09-07  
**Branch:** feat/dacum-role-delegation-workflow  
**Status:** Draft

---

## 1. Vấn đề

Hệ thống hiện tại không có mô hình rõ ràng cho:
- **1 nhiệm vụ — 1 người chủ trì — nhiều người cùng làm**: không phân biệt được ai chịu trách nhiệm cuối cùng vs ai tham gia thực hiện.
- **Nhiệm vụ tự phát sinh**: cá nhân/đơn vị tự tạo task không thuộc hoạt động chung nào từ BGH, nhưng vẫn cần visible trong hệ thống.
- **Workspace cá nhân thiếu ngữ cảnh**: người làm sub-task chỉ thấy "Chụp ảnh", không biết chụp cho sự kiện nào.

---

## 2. Quyết định thiết kế

### 2.1 Nguyên tắc cốt lõi

| Nguyên tắc | Lý do |
| :--- | :--- |
| **1 DRI (Directly Responsible Individual) duy nhất mỗi task** | Ngăn "bystander effect" — không ai nghĩ mình phải làm khi có nhiều người cùng chịu trách nhiệm |
| **Mỗi sub-task có đúng 1 người phụ trách** | Accountability rõ ràng ở cấp thực thi — 1 người có thể phụ nhiều sub-tasks, nhưng mỗi sub-task không được giao cho nhiều người cùng lúc |
| **DRI không phụ thuộc chức vụ tổ chức** | Bất kỳ ai (giảng viên, chuyên viên, trưởng phòng) đều có thể là DRI của một nhiệm vụ cụ thể |
| **Mọi task đều visible trong hệ thống** | Không có "private task" — mọi công việc đều thuộc hệ thống quản lý của trường |

### 2.2 Cấu trúc nhiệm vụ

```
SchoolTask (Nhiệm vụ)
├── leadAssigneeName: string        ← DRI: 1 người chịu trách nhiệm cuối cùng
├── coAssignees: string[]           ← Danh sách tham gia phối hợp
├── origin: 'SCHOOL' | 'SELF_INITIATED'  ← [MỚI] Nguồn gốc tạo task
└── subTasks: StaffTask[]           ← Công việc chi tiết
    └── assigneeName: string        ← 1 người / 1 sub-task (đích danh)
```

**`origin` field:**
- `SCHOOL` — BGH tạo và giao xuống (top-down), như hiện tại
- `SELF_INITIATED` — Cá nhân hoặc đơn vị tự tạo (bottom-up), không cần BGH phê duyệt để tạo

### 2.3 Vai trò trong mỗi nhiệm vụ (độc lập với chức vụ tổ chức)

| Vai trò trong task | Ai đảm nhận | Quyền hạn |
| :--- | :--- | :--- |
| **Xử lý chính (DRI)** | Bất kỳ ai | Chịu trách nhiệm tiến độ chung, phân công sub-tasks, báo cáo kết quả |
| **Người ph���i hợp** | Danh sách trong `coAssignees[]` | Nhận thông báo, thực hiện sub-task được giao |
| **Người thực hiện sub-task** | 1 người cụ thể (có thể phụ nhiều sub-tasks) | Hoàn thành đầu việc cụ thể, nộp kết quả |

---

## 3. UX — Workspace cá nhân ("My Tasks")

### 3.1 Nguyên tắc hiển thị

**Luôn hiển thị 2 tầng** — tên nhiệm vụ cha (ngữ cảnh) trước, sau đó mới là đầu việc cụ thể:

```
📂 Lễ Khai giảng năm học 2026–2027         DRI: Trần Hùng
   Hạn: 07/09 · Truyền thông · 100%
   └─ 📸 Chụp ảnh      Hạn: 05/09  [Hoàn thành ✓]
   └─ 🎬 Quay phim     Hạn: 05/09  [Hoàn thành ✓]
```

Không bao giờ hiển thị sub-task đơn độc không có header nhiệm vụ cha.

### 3.2 Phân loại tab trong workspace cá nhân

**Tab "Tôi chủ trì"** — những task mình là DRI:
- Hiển thị toàn bộ sub-tasks của cả nhóm (để điều phối và theo dõi)
- Tiến độ rollup tự động từ % sub-tasks hoàn thành

**Tab "Tôi tham gia"** — những task mình trong `coAssignees[]`:
- Hiển thị tên task cha (ngữ cảnh) + tên DRI
- Chỉ hiển thị sub-tasks được giao cho bản thân
- Nếu chưa có sub-task nào: hiển thị badge "Chờ phân công" — không ẩn task

### 3.3 Nhóm sub-tasks của cùng 1 người trong 1 nhiệm vụ

Khi Huy được giao nhiều sub-tasks trong cùng 1 nhiệm vụ, workspace **nhóm chúng lại dưới 1 header** — không tách thành nhiều dòng rời:

```
📂 Lễ Khai giảng 2026–2027         DRI: Trần Hùng
   └─ 📸 Chụp ảnh      Hạn: 05/09  [Hoàn thành ✓]
   └─ 🎬 Quay phim     Hạn: 05/09  [Hoàn thành ✓]   ← Cùng Huy, cùng task cha
```

Không bao giờ hiển thị:
```
📂 Lễ Khai giảng 2026–2027  └─ 📸 Chụp ảnh   ← lặp header cha
📂 Lễ Khai giảng 2026–2027  └─ 🎬 Quay phim  ← lặp header cha
```

**Workload visibility cho DRI:** Khi xem tab "Tôi chủ trì", DRI thấy số lượng sub-tasks mỗi người đang gánh — hiển thị badge đếm bên cạnh tên người thực hiện:

```
📂 Làm sổ tay sinh viên 2026        DRI: Huy
   ├─ Mai     (2 việc)  Viết nội dung · Biên tập
   ├─ Anh     (1 việc)  Thiết kế bìa
   └─ Huy     (1 việc)  Duyệt bản in
```

### 3.4 Trường hợp đặc biệt

| Trường hợp | Hiển thị |
| :--- | :--- |
| Người phối hợp có sub-task | Task cha (ngữ cảnh) + sub-task của mình |
| Người phối hợp chưa có sub-task | Task cha + badge "Chờ phân công" |
| DRI xem task của mình | Task cha + toàn bộ sub-tasks cả nhóm |
| Task `SELF_INITIATED` do mình tạo | Hiện ở tab "Tôi chủ trì", không có badge đặc biệt |

---

## 4. Data Model Changes

### 4.1 Thay đổi `SchoolTask` trong `src/types/dashboard.ts`

Thêm field `origin`:

```typescript
export type TaskOrigin = 'SCHOOL' | 'SELF_INITIATED';

export interface SchoolTask {
  // ... existing fields ...
  origin?: TaskOrigin;  // undefined = 'SCHOOL' (backward compatible)
}
```

Không cần thêm field nào khác — cấu trúc hiện tại (`leadAssigneeName`, `coAssignees[]`, `subTasks[]`) đã đủ.

### 4.2 Không thay đổi `filterTasksByRole`

Logic lọc hiện tại trong `src/lib/role-task-filter.ts` đã xử lý visibility đúng theo role hierarchy:
- `ADMIN` → thấy tất cả
- `MANAGER` → thấy task liên quan đến đơn vị
- `STAFF` → thấy task liên quan đến bản thân

`SELF_INITIATED` tasks tự động visible đúng theo logic này mà không cần thay đổi.

---

## 5. Component Changes

### 5.1 `LecturerFocusWorkspace` (`src/components/portal/lecturer-focus-workspace.tsx`)

- Thêm tab filter `"LEADING"` | `"PARTICIPATING"` vào `LecturerFilterTab`
- Khi render task list: luôn group sub-tasks dưới header của task cha tương ứng
- Không hiển thị sub-task mồ côi (không có parent context)

### 5.2 `DepartmentManagerWorkspace` (`src/components/portal/department-manager-workspace.tsx`)

- DRI xem task của mình: hiển thị toàn bộ sub-tasks cả nhóm (không lọc theo assignee)
- Thêm khả năng tạo `SELF_INITIATED` task từ workspace

### 5.3 Mock data (`src/lib/mock-dashboard-data.ts`)

- Thêm `origin` field vào các task mẫu hiện có (`SCHOOL`)
- Thêm ít nhất 2 task mẫu `SELF_INITIATED` để test

---

## 6. Visibility & Permissions

| Ai | Thấy gì |
| :--- | :--- |
| `ADMIN` (BGH) | Tất cả tasks (cả `SCHOOL` lẫn `SELF_INITIATED`) |
| `MANAGER` (Trưởng đơn vị) | Tasks của đơn vị mình + tasks mình là DRI hoặc coAssignee |
| `STAFF` (Giảng viên/Chuyên viên) | Tasks mình là DRI hoặc có sub-task được giao |

Không cần thêm bảng phân quyền mới — role-based filtering hiện tại đã đủ.

---

## 7. Không nằm trong scope này

- UI tạo `SELF_INITIATED` task (separate feature)
- Notification system cho coAssignees
- Workflow phê duyệt cho `SELF_INITIATED` task
- Real-time progress sync

---

## 8. Testing

- `filterTasksByRole` với task `SELF_INITIATED` — verify visibility đúng theo role
- Workspace render: sub-task luôn có header task cha
- Tab "Tôi chủ trì" / "Tôi tham gia" — filter đúng theo `leadAssigneeName` vs `coAssignees`
- Badge "Chờ phân công" xuất hiện khi user trong `coAssignees[]` nhưng không có sub-task nào
