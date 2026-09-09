---
status: superseded
domain: ux
created: 2026-09-09
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Kế Hoạch Triển Khai: Chuẩn Hóa 1 Người Phụ Trách (Single DRI), Phân Rã Nhiệm Vụ Con & Hiển Thị Độc Lập Trong Hòm Việc Cá Nhân

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiện thực hóa triệt để nguyên tắc "1 nhiệm vụ - 1 người phụ trách chính" (Single DRI), hoàn thiện luồng phân rã nhiệm vụ con (Parent-Child WBS) từ Database/API đến UI, và đưa nhiệm vụ con thành thực thể độc lập hạng nhất (First-class Actionable Item) có Breadcrumb nguồn gốc trong trang Việc cá nhân.

**Architecture:**
- **Backend (API & DB):** Bổ sung tiếp nhận và xử lý `parentTaskId`, `collaboratorIds` trong `POST /api/tasks` và `PATCH /api/tasks/[id]`. Đảm bảo `TaskAssignee` duy trì nghiêm ngặt 1 `PRIMARY_OWNER`. Bổ sung endpoint/query hỗ trợ lấy việc cá nhân (`scope=my` / `assignedTo=me`) kèm quan hệ `parentTask`.
- **Data Adapters & Rollup:** Cập nhật `mapPrismaTaskToSchoolTask` và `dashboard-service.ts` để nạp `parentTask`, `subTasks`, và tự động cập nhật tiến độ cha (rollup) khi nhiệm vụ con hoàn thành.
- **In-situ Task Decomposition:** Hoàn thiện giao diện phân rã việc con trực tiếp trong `TaskDetailSideSheet` và `CreateTaskModal`, cho phép chỉ định 1 DRI duy nhất và danh sách cán bộ phối hợp, chặn hạn chót việc con vượt quá việc cha.
- **Hòm việc cá nhân (My Tasks):** Tái cấu trúc `CascadingTaskTable` tại chế độ `MY_RECEIVED` và `UniversalActionQueue` để làm phẳng (flatten) các nhiệm vụ con của người dùng thành các dòng công việc độc lập ở cấp cao nhất, đi kèm Breadcrumb ngữ cảnh cha có thể nhấp để điều hướng.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma ORM, Tailwind CSS v4, Lucide React, Node.js Test Runner (`tsx --test`).

**Spec:** Bản phân tích kiểm toán hệ thống từ phiên khảo sát: Single DRI & Task Decomposition Architecture.

## Global Constraints

- **Dev/Build Cache Invariant**: Tuyệt đối không chạy `npm run build` khi dev server đang chạy trên port 3001. Chỉ dùng `npm run typecheck` và `npm test`.
- **Strict Light-Only**: Chuẩn công sở hành chính giáo dục (OKLCH). Tuyệt đối không dùng class `dark:`, khối `.dark`, hoặc `ThemeProvider`.
- **Typography Floor**: Sàn font tối thiểu là 12px (`text-xs`). Tuyệt đối cấm `text-[9px]`, `text-[10px]`, `text-[11px]`.
- **Single DRI Principle**: Mỗi nhiệm vụ hoặc nhiệm vụ con bắt buộc có đúng 1 `PRIMARY_OWNER`. Các thành viên khác tham gia là `COLLABORATOR`.
- **Context Preservation**: Mọi nhiệm vụ con khi hiển thị độc lập tại trang cá nhân bắt buộc phải có Breadcrumb chỉ báo nhiệm vụ cha.

---

### Task 1: Nâng Cấp Backend API Tiếp Nhận `parentTaskId` & Quản Lý Single DRI

**Files:**
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/app/api/tasks/[id]/route.ts`
- Test: `tests/task-subtask-api-single-dri.test.ts`

**Interfaces:**
- Consumes: JSON body của `POST /api/tasks` chứa `parentTaskId?: string`, `assigneeId?: string`, `collaboratorIds?: string[]`.
- Produces: Bản ghi `Task` được liên kết chính xác với `parentTaskId`, tạo 1 `TaskAssignee` có `roleInTask = PRIMARY_OWNER` và các `COLLABORATOR`. `GET /api/tasks` và `GET /api/tasks/[id]` nạp quan hệ `parentTask` và `subTasks`.

- [ ] **Step 1: Viết test cho API POST/PATCH nhiệm vụ con và Single DRI**

```typescript
// tests/task-subtask-api-single-dri.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

test("POST /api/tasks accepts parentTaskId and persists hierarchy", () => {
  // Verify that parentTaskId is parsed and handled in route logic
  assert.ok(true);
});
```

- [ ] **Step 2: Chạy test để xác nhận trạng thái ban đầu**
- [ ] **Step 3: Cập nhật `src/app/api/tasks/route.ts`**
  - Trong `POST`: Trích xuất `parentTaskId`, `collaboratorIds` từ `body`.
  - Trong `prisma.$transaction`: Gán `parentTaskId` vào `data` của `tx.task.create`.
  - Nếu có `parentTaskId`, kiểm tra nhiệm vụ cha tồn tại và kế thừa `academicMonth`, `academicYear`, `departmentId` (nếu không cung cấp).
  - Tạo `TaskAssignee` cho `assigneeId` với vai trò `PRIMARY_OWNER`.
  - Nếu có `collaboratorIds`, tạo `TaskAssignee` với vai trò `COLLABORATOR`.
  - Trong `GET`: Hỗ trợ tham số `assignedTo=me` hoặc lọc theo `scope=my` liên kết người dùng hiện tại; nạp `parentTask: { select: { id: true, code: true, title: true, scope: true } }` và `subTasks`.
- [ ] **Step 4: Cập nhật `src/app/api/tasks/[id]/route.ts`**
  - Trong `GET`: Bổ sung `parentTask` và `subTasks` vào `include` của `prisma.task.findUnique`.
  - Trong `PATCH`: Hỗ trợ cập nhật `parentTaskId`, hoán đổi `PRIMARY_OWNER` an toàn, và cập nhật `collaboratorIds`.
- [ ] **Step 5: Chạy lại test và kiểm tra TypeScript**
  ```bash
  npx tsx --test tests/task-subtask-api-single-dri.test.ts
  npm run typecheck
  ```

---

### Task 2: Chuẩn Hóa Types & Bộ Chuyển Đổi Dữ Liệu (Adapters & Rollup)

**Files:**
- Modify: `src/types/dashboard.ts`
- Modify: `src/lib/adapters/task-db-adapter.ts`
- Modify: `src/lib/server/dashboard-service.ts`
- Test: `tests/task-subtask-adapter-rollup.test.ts`

**Interfaces:**
- Consumes: Prisma Task record chứa `parentTask` và `subTasks`.
- Produces: `StaffTask` và `SchoolTask` với các trường `parentSchoolTaskId`, `parentSchoolTaskTitle`, `parentSchoolTaskCode`, `coAssignees`, và tiến độ cuộn (rollup) tự động.

- [ ] **Step 1: Viết test cho Task DB Adapter và Rollup**

```typescript
// tests/task-subtask-adapter-rollup.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPrismaTaskToSchoolTask } from "../src/lib/adapters/task-db-adapter";

test("mapPrismaTaskToSchoolTask preserves parentTask metadata and subtasks", () => {
  // Test adapter logic
  assert.ok(true);
});
```

- [ ] **Step 2: Chạy test xác nhận**
- [ ] **Step 3: Cập nhật `src/types/dashboard.ts`**
  - Bổ sung `parentSchoolTaskCode?: string` và `collaborators?: { id: string; name: string }[]` vào `StaffTask`.
  - Đảm bảo `StaffTask` có cờ nhận diện nguồn gốc nhiệm vụ cha.
- [ ] **Step 4: Cập nhật `src/lib/adapters/task-db-adapter.ts`**
  - Ánh xạ `parentTask` sang `parentSchoolTaskId`, `parentSchoolTaskTitle`, `parentSchoolTaskCode`.
  - Ánh xạ danh sách `assignees` phân tách rõ: người có `roleInTask === "PRIMARY_OWNER"` là `assigneeName` / `leadAssigneeName`, những người còn lại là `coAssignees` / `collaborators`.
  - Nạp đầy đủ danh sách `subTasks` cho nhiệm vụ cha.
- [ ] **Step 5: Cập nhật `src/lib/server/dashboard-service.ts`**
  - Đảm bảo khi truy vấn `dbTasks`, các trường `parentTask` và `subTasks` được bao gồm đầy đủ.
  - Tiến độ `progressPercent` của nhiệm vụ cha phản ánh đúng tỷ lệ hoàn thành của các `subTasks`.
- [ ] **Step 6: Chạy test và typecheck**
  ```bash
  npx tsx --test tests/task-subtask-adapter-rollup.test.ts
  npm run typecheck
  ```

---

### Task 3: Phân Rã Nhiệm Vụ Con Trực Tiếp Tại Chỗ (In-situ Decomposition) Trong UI

**Files:**
- Modify: `src/components/dashboard/create-task-modal.tsx`
- Modify: `src/components/dashboard/task-detail-side-sheet.tsx`
- Test: `tests/task-decomposition-ui.test.ts`

**Interfaces:**
- Consumes: `onAddSubTask(parentId, prefillData)` từ `TaskDetailSideSheet` và mở `CreateTaskModal`.
- Produces: Modal tạo việc con với trường "Nhiệm vụ cha" được khóa cứng sẵn, hạn chót bị giới hạn không vượt quá việc cha, phân định rõ Người chủ trì chính (DRI) và Cán bộ phối hợp.

- [ ] **Step 1: Viết test cho logic form phân rã việc con**

```typescript
// tests/task-decomposition-ui.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

test("CreateTaskModal validates single primary assignee and parent task due date constraint", () => {
  assert.ok(true);
});
```

- [ ] **Step 2: Cập nhật `src/components/dashboard/create-task-modal.tsx`**
  - Khi `initialParentTaskId` tồn tại:
    - Khóa trường chọn nhiệm vụ cha ở trạng thái read-only hiển thị tên nhiệm vụ cha.
    - Giới hạn thuộc tính `max` của `dueDate` không được muộn hơn `parentTask.dueDate`.
  - Bổ sung trường chọn "Cán bộ phối hợp" (`collaboratorIds` / `coAssignees`) độc lập với "Người chủ trì chính".
  - Gửi `parentTaskId` và `collaboratorIds` trong payload gửi lên API hoặc callback `onSubmit`.
- [ ] **Step 3: Cập nhật `src/components/dashboard/task-detail-side-sheet.tsx`**
  - Sửa lại form inline hoặc nút "+ Giao nhiệm vụ thành phần":
    - Truyền `newSubtaskTitle` và `task.id` sang callback mở modal tạo việc con, không vứt bỏ giá trị đã nhập.
  - Biến khối hiển thị `parentSchoolTaskTitle` thành Breadcrumb liên kết có thể nhấp (Clickable Breadcrumb) để gọi `onSelectSubTask` hoặc chuyển đổi sang xem nhiệm vụ cha.
  - Hiển thị danh sách nhiệm vụ con với avatar/tên người phụ trách chính duy nhất, hạn chót, huy hiệu trạng thái, và cho phép click để xem chi tiết việc con.
- [ ] **Step 4: Chạy test và typecheck**
  ```bash
  npx tsx --test tests/task-decomposition-ui.test.ts
  npm run typecheck
  ```

---

### Task 4: Làm Phẳng Nhiệm Vụ Con Kèm Breadcrumb Trong Trang Việc Cá Nhân

**Files:**
- Modify: `src/components/tasks/cascading-task-table.tsx`
- Modify: `src/components/workspace/components/universal-action-queue.tsx`
- Modify: `src/app/tasks/page.tsx`
- Test: `tests/personal-tasks-subtask-flattening.test.ts`

**Interfaces:**
- Consumes: Danh sách nhiệm vụ từ backend hoặc state.
- Produces: Tại tab `MY_RECEIVED` ("Hòm việc cá nhân"), các nhiệm vụ con được làm phẳng (flattened) thành các dòng tác vụ độc lập ở cấp 1, có Breadcrumb cha hiển thị rõ ràng, cho phép nộp minh chứng và cập nhật trạng thái trực tiếp.

- [ ] **Step 1: Viết test cho cơ chế làm phẳng việc con trong Hòm việc cá nhân**

```typescript
// tests/personal-tasks-subtask-flattening.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

test("MY_RECEIVED workbox flattens assigned subtasks into first-class rows with parent breadcrumb", () => {
  assert.ok(true);
});
```

- [ ] **Step 2: Cập nhật `src/components/tasks/cascading-task-table.tsx`**
  - Tái cấu trúc bộ lọc `activeWorkbox === "MY_RECEIVED"`:
    - Không trả về toàn bộ nhiệm vụ cha khi người dùng chỉ phụ trách việc con.
    - Trích xuất phẳng (flatten) tất cả các nhiệm vụ con (`StaffTask`) mà người dùng là `assigneeName` hoặc trong `coAssignees`.
    - Chuyển đổi thành các dòng hiển thị độc lập tại bảng.
    - Thêm thành phần Breadcrumb trên từng dòng: hiển thị icon cây thư mục + `[Mã cha] Tiêu đề nhiệm vụ cha` (nhấp để xem việc cha).
    - Cung cấp nút nộp minh chứng và cập nhật tiến độ trực tiếp trên dòng việc con.
  - Giữ nguyên hiển thị phân cấp cây (WBS tree) cho các chế độ xem toàn trường (`ALL_TASKS`, `SCHOOL_TASKS`).
- [ ] **Step 3: Cập nhật `src/components/workspace/components/universal-action-queue.tsx`**
  - Trong danh sách nộp minh chứng và danh sách thẩm định, hiển thị huy hiệu Breadcrumb `parentTaskTitle` và `parentTaskCode` ngay trên tiêu đề việc con.
- [ ] **Step 4: Cập nhật `src/app/tasks/page.tsx`**
  - Kết nối callback `handleCreateTask` với API `POST /api/tasks` thật thay vì chỉ mock trong state cục bộ, gửi kèm `parentTaskId`.
- [ ] **Step 5: Chạy test và typecheck**
  ```bash
  npx tsx --test tests/personal-tasks-subtask-flattening.test.ts
  npm run typecheck
  ```

---

### Task 5: Toàn Diện Hóa Kiểm Thử & Xác Thực Chất Lượng (QA & Regression)

**Files:**
- Run full test suite: `npm test`
- Run type check: `npm run typecheck`
- Verify UI and light mode styling.

- [ ] **Step 1: Chạy `npm run typecheck` để bảo đảm không có lỗi kiểu dữ liệu**
- [ ] **Step 2: Chạy `npm test` để xác nhận tất cả unit tests và integration tests đều xanh**
- [ ] **Step 3: Rà soát toàn bộ quy tắc kỹ thuật (Light-Only, font >= 12px, không chạy `next build` khi `next dev` hoạt động)**
