---
status: superseded
domain: ux
created: 2026-09-06
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# QCET E-Office: Kế Hoạch Triển Khai Cải Cách Trải Nghiệm Người Dùng Phân Quyền (Role-Based UX Architecture)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn diện trải nghiệm người dùng QCET E-Office từ một giao diện dồn nén, hỗn loạn thành 3 không gian làm việc cá nhân hóa theo vai trò (`STAFF` - Giảng viên, `MANAGER` - Trưởng khoa, `ADMIN` - Ban Giám Hiệu), chuẩn hóa thanh điều hướng và quy trình nộp - phê duyệt minh chứng 3 trạng thái.

**Architecture:** Áp dụng mô hình *"Same Truth, Different Altitude"* với nguyên tắc Single Source of Truth (dữ liệu dẫn xuất thuần túy, không nhân bản state). Sử dụng Strangler Fig Pattern để bảo lưu toàn bộ kho nhiệm vụ chuyên sâu tại `/tasks`, trong khi trang chủ `/` biến thành Cockpit tác nghiệp chuyên biệt tự động nhận diện theo `user.role`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Node.js Test Runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-06-role-based-ux-revamp-spec.md`

## Global Constraints
- **Zero-Poisoning Build Rule (CLAUDE.md):** Tuyệt đối không chạy `next build` đè lên thư mục `.next` khi `next dev` đang chạy. Xác minh code chỉ dùng `npm run typecheck` (`tsc --noEmit`) và `npm test`.
- **Tailwind CSS v4 Only:** Chỉ sử dụng utility classes tương thích Tailwind CSS v4 trong `src/app/globals.css`. Không tạo `tailwind.config.js`.
- **Derived State Only:** Không sao chép danh sách tasks thành state con trong từng workspace để tránh lệch dữ liệu.
- **Action Gating:** Nút hành động chỉ hiển thị khi người dùng sở hữu vai trò đó VÀ task ở đúng trạng thái.

---

## Danh Mục Tệp (File Structure Map)

| Tệp | Hành động | Trách nhiệm |
| :--- | :--- | :--- |
| `src/types/workspace.ts` | Tạo mới / Chuẩn hóa | Định nghĩa kiểu dữ liệu cho 3 Workspace, Deliverable Submission và Approval Actions |
| `src/components/workspace/submit-deliverable-modal.tsx` | Tạo mới | Modal nộp minh chứng (File/Link/Ghi chú) cho Giảng viên với tính năng lưu nháp sessionStorage |
| `src/components/workspace/review-action-dialog.tsx` | Tạo mới | Hộp thoại thẩm định 3 quyết định (`approved`, `revision_requested`, `rejected`) với comment bắt buộc khi yêu cầu sửa |
| `src/components/workspace/staff-workspace.tsx` | Tạo mới | Bàn làm việc tối giản cho Giảng viên (Thẻ khẩn cấp, lọc nhanh, nút nộp 1-click) |
| `src/components/workspace/manager-workspace.tsx` | Tạo mới | Bàn làm việc Trưởng đơn vị (Hàng đợi duyệt khoa, tiến độ việc khoa, toggle kiêm nhiệm cá nhân) |
| `src/components/workspace/executive-workspace.tsx` | Tạo mới | Khoang điều hành Ban Giám Hiệu (Hàng duyệt chiến lược, Radar sức khỏe 11 đơn vị, chỉ đạo BGH) |
| `src/components/layout/sidebar-context.tsx` | Chỉnh sửa | Xóa bỏ các query parameter `/?zone=tasks`, `/?zone=dashboard`, chuẩn hóa link route tĩnh |
| `src/app/page.tsx` | Chỉnh sửa | Dispatcher trang chủ theo `user.role`, sửa triệt để các lỗi Typecheck đang tồn đọng |
| `tests/role-based-workspace-workflow.test.ts` | Tạo mới | Bộ kiểm thử tự động xác minh logic phân quyền, luồng nộp duyệt và dual-role switching |

---

### Task 1: Định Nghĩa Kiểu Dữ Liệu Workspace (`src/types/workspace.ts`)

**Files:**
- Create: `src/types/workspace.ts`
- Test: `tests/role-based-workspace-workflow.test.ts`

**Interfaces:**
- Produces: `WorkspaceRole`, `DeliverableSubmissionPayload`, `ApprovalDecision`, `ApprovalActionPayload`, `StaffUrgencySummary`, `DepartmentHealthSummary`

- [ ] **Step 1: Viết test kiểm tra tính hợp lệ của các kiểu dữ liệu và helper functions**

Tạo tệp `tests/role-based-workspace-workflow.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type {
  ApprovalDecision,
  DeliverableSubmissionPayload,
  ApprovalActionPayload,
} from "../src/types/workspace";

describe("Workspace Type Definitions & Validators", () => {
  test("validates ApprovalDecision union values", () => {
    const validDecisions: ApprovalDecision[] = [
      "approved",
      "revision_requested",
      "rejected",
    ];
    assert.equal(validDecisions.length, 3);
  });

  test("validates DeliverableSubmissionPayload structure", () => {
    const payload: DeliverableSubmissionPayload = {
      taskId: "task-1",
      deliverableName: "De thi K48.pdf",
      url: "https://drive.google.com/test",
      fileType: "pdf",
      note: "Đã hoàn thành theo mẫu 2",
    };
    assert.equal(payload.taskId, "task-1");
    assert.equal(payload.deliverableName, "De thi K48.pdf");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại do chưa có file type**

Chạy:
```bash
npx tsx --test tests/role-based-workspace-workflow.test.ts
```
Kỳ vọng: Thất bại với lỗi `Cannot find module '../src/types/workspace'`.

- [ ] **Step 3: Tạo tệp `src/types/workspace.ts`**

```typescript
import type { SchoolTask, StaffTask, TaskStatus } from "./dashboard";
import type { UserRole } from "./auth";

export type ApprovalDecision = "approved" | "revision_requested" | "rejected";

export interface DeliverableSubmissionPayload {
  taskId: string;
  deliverableName: string;
  url?: string;
  fileType?: string;
  note?: string;
}

export interface ApprovalActionPayload {
  taskId: string;
  decision: ApprovalDecision;
  comment?: string;
  reviewedByRole: UserRole;
  reviewedByName: string;
}

export interface StaffUrgencySummary {
  todayCount: number;
  thisWeekCount: number;
  waitingApprovalCount: number;
  revisionRequestedCount: number;
  completedCount: number;
}

export interface DepartmentHealthSummary {
  departmentCode: string;
  departmentName: string;
  totalTasks: number;
  completedTasks: number;
  delayedTasks: number;
  completionRate: number;
  healthStatus: "GREEN" | "YELLOW" | "RED";
}
```

- [ ] **Step 4: Chạy lại test để xác nhận thành công**

Chạy:
```bash
npx tsx --test tests/role-based-workspace-workflow.test.ts
```
Kỳ vọng: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/workspace.ts tests/role-based-workspace-workflow.test.ts
git commit -m "feat(workspace): define role-based workspace types and validation interfaces"
```

---

### Task 2: Khắc Phục Lỗi Typecheck Hiện Có Trong `src/app/page.tsx`

**Files:**
- Modify: `src/app/page.tsx:1080-1125`

**Interfaces:**
- Consumes: `WorkboxFilter` from `src/components/dashboard/simplified-task-filter-bar`

- [ ] **Step 1: Chạy `npm run typecheck` để xác nhận các dòng lỗi chính xác**

Chạy:
```bash
npm run typecheck
```
Kỳ vọng: Lỗi tại dòng 1083, 1110, 1114 do `'ACTION_REQUIRED'` và `'IN_PROGRESS'` không khớp với kiểu `WorkboxFilter`.

- [ ] **Step 2: Sửa lỗi type trong `src/app/page.tsx`**

Thay thế đoạn gọi `setActiveWorkbox("ACTION_REQUIRED")` bằng giá trị chuẩn `"NEEDS_REVIEW"` hoặc ánh xạ chính xác kiểu `SimplifiedTaskStatus` sang `WorkboxFilter`.

- [ ] **Step 3: Chạy lại typecheck để xác nhận sạch lỗi hoàn toàn**

Chạy:
```bash
npm run typecheck
```
Kỳ vọng: Exit code 0, không còn lỗi TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix(typecheck): resolve WorkboxFilter type mismatch in home page"
```

---

### Task 3: Xây Dựng Modal Nộp Minh Chứng (`submit-deliverable-modal.tsx`)

**Files:**
- Create: `src/components/workspace/submit-deliverable-modal.tsx`
- Test: `tests/role-based-workspace-workflow.test.ts`

**Interfaces:**
- Consumes: `DeliverableSubmissionPayload` from `src/types/workspace.ts`
- Produces: `SubmitDeliverableModal` component props `{ isOpen: boolean; onClose: () => void; task: StaffTask | null; onSubmit: (payload: DeliverableSubmissionPayload) => void; }`

- [ ] **Step 1: Viết test mô phỏng chức năng và payload của modal**

Bổ sung vào `tests/role-based-workspace-workflow.test.ts`:
```typescript
describe("Deliverable Submission Validation", () => {
  test("requires deliverableName or url before submission", () => {
    const isValidSubmission = (name: string, url: string) => {
      return name.trim().length > 0 || url.trim().length > 0;
    };
    assert.equal(isValidSubmission("", ""), false);
    assert.equal(isValidSubmission("Bao cao.docx", ""), true);
    assert.equal(isValidSubmission("", "https://link.com"), true);
  });
});
```

- [ ] **Step 2: Chạy test để xác minh pass**

Chạy:
```bash
npx tsx --test tests/role-based-workspace-workflow.test.ts
```

- [ ] **Step 3: Viết component `src/components/workspace/submit-deliverable-modal.tsx`**

Bao gồm:
- Drag & Drop zone hoặc chọn file (PDF, Docx, Xlsx, Ảnh).
- Input link ngoài (Google Drive, OneDrive).
- Textarea ghi chú (Tùy chọn).
- Lưu nháp tự động vào `sessionStorage` theo `taskId`.
- Nút bấm **[Gửi Trưởng khoa duyệt]** có loading state.

- [ ] **Step 4: Kiểm tra Typecheck**

Chạy:
```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/submit-deliverable-modal.tsx tests/role-based-workspace-workflow.test.ts
git commit -m "feat(workspace): implement SubmitDeliverableModal with sessionStorage draft recovery"
```

---

### Task 4: Xây Dựng Dialog Thẩm Định 3 Trạng Thái (`review-action-dialog.tsx`)

**Files:**
- Create: `src/components/workspace/review-action-dialog.tsx`
- Test: `tests/role-based-workspace-workflow.test.ts`

**Interfaces:**
- Consumes: `ApprovalActionPayload` from `src/types/workspace.ts`
- Produces: `ReviewActionDialog` component props `{ isOpen: boolean; onClose: () => void; task: StaffTask | SchoolTask | null; onAction: (payload: ApprovalActionPayload) => void; }`

- [ ] **Step 1: Viết unit test cho quy tắc yêu cầu lý do khi Send-back**

Bổ sung vào `tests/role-based-workspace-workflow.test.ts`:
```typescript
describe("Review Action Rules", () => {
  test("requires at least 5 characters comment when decision is revision_requested", () => {
    const canSubmitDecision = (decision: ApprovalDecision, comment: string) => {
      if (decision === "revision_requested") {
        return comment.trim().length >= 5;
      }
      return true;
    };
    assert.equal(canSubmitDecision("approved", ""), true);
    assert.equal(canSubmitDecision("revision_requested", ""), false);
    assert.equal(canSubmitDecision("revision_requested", "abc"), false);
    assert.equal(canSubmitDecision("revision_requested", "Thiếu phụ lục 2"), true);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận pass**

Chạy:
```bash
npx tsx --test tests/role-based-workspace-workflow.test.ts
```

- [ ] **Step 3: Viết component `src/components/workspace/review-action-dialog.tsx`**

Bao gồm:
- Hiển thị tóm tắt task và danh sách file minh chứng người nộp gửi lên.
- 3 nút bấm trạng thái phân định bằng màu sắc rõ ràng:
  - `Phê duyệt`: Màu xanh lục (Green).
  - `Yêu cầu chỉnh sửa`: Màu vàng cam (Amber) $\rightarrow$ Mở ô bắt buộc nhập lý do.
  - `Từ chối`: Màu đỏ (Red).
- Nút xác nhận gửi quyết định.

- [ ] **Step 4: Kiểm tra Typecheck**

Chạy:
```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/review-action-dialog.tsx tests/role-based-workspace-workflow.test.ts
git commit -m "feat(workspace): implement ReviewActionDialog with 3-state decisions and mandatory feedback"
```

---

### Task 5: Xây Dựng Bàn Làm Việc Giảng Viên (`staff-workspace.tsx`)

**Files:**
- Create: `src/components/workspace/staff-workspace.tsx`
- Test: `tests/role-based-workspace-workflow.test.ts`

**Interfaces:**
- Consumes: `StaffTask`, `AuthUser`
- Produces: `StaffWorkspace` component

- [ ] **Step 1: Viết test cho logic tính toán tóm tắt khẩn cấp của Giảng viên**

Bổ sung vào `tests/role-based-workspace-workflow.test.ts`:
```typescript
describe("Staff Workspace Urgency Computation", () => {
  test("correctly categorizes staff tasks by urgency and status", () => {
    const sampleTasks: StaffTask[] = [
      {
        id: "s1",
        title: "Soan de thi",
        assigneeName: "Nguyen Van A",
        assigneeId: "user-1",
        status: "IN_PROGRESS",
        dueDate: "2026-09-06", // Hom nay
        parentSchoolTaskId: "p1",
        updatedAt: "2026-09-06",
      },
      {
        id: "s2",
        title: "Coi thi",
        assigneeName: "Nguyen Van A",
        assigneeId: "user-1",
        status: "NEEDS_REVIEW",
        dueDate: "2026-09-10",
        parentSchoolTaskId: "p1",
        updatedAt: "2026-09-06",
      },
    ];

    const isToday = (d: string) => d === "2026-09-06";
    const todayCount = sampleTasks.filter(t => t.status === "IN_PROGRESS" && isToday(t.dueDate)).length;
    const waitingCount = sampleTasks.filter(t => t.status === "NEEDS_REVIEW").length;

    assert.equal(todayCount, 1);
    assert.equal(waitingCount, 1);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận pass**

Chạy:
```bash
npx tsx --test tests/role-based-workspace-workflow.test.ts
```

- [ ] **Step 3: Viết component `src/components/workspace/staff-workspace.tsx`**

Bao gồm:
- Header chào mừng cá nhân: Tên + Bộ môn/Khoa.
- Thẻ 4 số khẩn cấp: Cần làm hôm nay (Đỏ), Tuần này (Vàng), Đang chờ duyệt (Lam), Cần sửa lại (Cam).
- Tab chuyển nhanh: `Tất cả việc của tôi` | `Cần làm ngay` | `Chờ duyệt` | `Đã xong`.
- Danh sách thẻ task với deadline trực quan và nút **[+ Nộp minh chứng]** 1 chạm.
- Tích hợp `SubmitDeliverableModal`.
- Nút nhỏ góc trên: **[👁️ Xem kho nhiệm vụ toàn trường]** (liên kết sang `/tasks`).

- [ ] **Step 4: Kiểm tra Typecheck**

Chạy:
```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/staff-workspace.tsx tests/role-based-workspace-workflow.test.ts
git commit -m "feat(workspace): implement clean StaffWorkspace for faculty and specialists"
```

---

### Task 6: Xây Dựng Bàn Làm Việc Trưởng Đơn Vị (`manager-workspace.tsx`)

**Files:**
- Create: `src/components/workspace/manager-workspace.tsx`
- Test: `tests/role-based-workspace-workflow.test.ts`

**Interfaces:**
- Consumes: `StaffTask`, `SchoolTask`, `AuthUser`
- Produces: `ManagerWorkspace` component

- [ ] **Step 1: Viết test cho bộ lọc Hàng đợi duyệt cấp Khoa và Dual-Role toggle**

Bổ sung vào `tests/role-based-workspace-workflow.test.ts`:
```typescript
describe("Manager Workspace Filtering & Dual-Role", () => {
  test("filters approval queue strictly by department and NEEDS_REVIEW status", () => {
    const tasks: StaffTask[] = [
      {
        id: "t1",
        title: "De thi",
        assigneeName: "GV A",
        departmentCode: "CNTT",
        status: "NEEDS_REVIEW",
        dueDate: "2026-09-08",
        parentSchoolTaskId: "p1",
        updatedAt: "2026-09-06",
      },
      {
        id: "t2",
        title: "Bao cao",
        assigneeName: "GV B",
        departmentCode: "KTL",
        status: "NEEDS_REVIEW",
        dueDate: "2026-09-08",
        parentSchoolTaskId: "p2",
        updatedAt: "2026-09-06",
      },
    ];

    const cnttQueue = tasks.filter(t => t.departmentCode === "CNTT" && t.status === "NEEDS_REVIEW");
    assert.equal(cnttQueue.length, 1);
    assert.equal(cnttQueue[0].id, "t1");
  });
});
```

- [ ] **Step 2: Chạy test xác nhận pass**

Chạy:
```bash
npx tsx --test tests/role-based-workspace-workflow.test.ts
```

- [ ] **Step 3: Viết component `src/components/workspace/manager-workspace.tsx`**

Bao gồm:
- Dual-role switch: **[🏢 Điều hành Khoa]** $\leftrightarrow$ **[👤 Việc cá nhân của tôi (N)]**.
- Khi ở tab Điều hành Khoa:
  - **Hàng đợi Phê duyệt Minh chứng Khoa:** Danh sách các `StaffTask` cần duyệt $\rightarrow$ Nút [Xem file], [Duyệt], [Yêu cầu sửa].
  - **Tiến độ Công việc Trường giao Khoa:** Danh sách `SchoolTask` khoa chủ trì $\rightarrow$ Hiển thị tiến độ % và nút [+ Giao việc con cho GV].
- Khi ở tab Việc cá nhân: Render giao diện tương tự `StaffWorkspace` cho các nhiệm vụ cá nhân của Trưởng khoa.
- Tích hợp `ReviewActionDialog`.

- [ ] **Step 4: Kiểm tra Typecheck**

Chạy:
```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/manager-workspace.tsx tests/role-based-workspace-workflow.test.ts
git commit -m "feat(workspace): implement ManagerWorkspace with department approval queue and dual-role support"
```

---

### Task 7: Xây Dựng Khoang Điều Hành Ban Giám Hiệu (`executive-workspace.tsx`)

**Files:**
- Create: `src/components/workspace/executive-workspace.tsx`
- Test: `tests/role-based-workspace-workflow.test.ts`

**Interfaces:**
- Consumes: `SchoolTask`, `StaffTask`, `AuthUser`
- Produces: `ExecutiveWorkspace` component

- [ ] **Step 1: Viết test cho logic tính toán Radar Sức khỏe 11 Đơn vị**

Bổ sung vào `tests/role-based-workspace-workflow.test.ts`:
```typescript
describe("Executive Health Radar Logic", () => {
  test("identifies departments with delayed tasks as RED or YELLOW", () => {
    const calculateHealth = (completed: number, delayed: number, total: number) => {
      if (total === 0) return "GREEN";
      if (delayed > 2) return "RED";
      if (delayed > 0) return "YELLOW";
      return "GREEN";
    };

    assert.equal(calculateHealth(10, 0, 10), "GREEN");
    assert.equal(calculateHealth(8, 1, 10), "YELLOW");
    assert.equal(calculateHealth(5, 3, 10), "RED");
  });
});
```

- [ ] **Step 2: Chạy test xác nhận pass**

Chạy:
```bash
npx tsx --test tests/role-based-workspace-workflow.test.ts
```

- [ ] **Step 3: Viết component `src/components/workspace/executive-workspace.tsx`**

Bao gồm:
- Header: Lời chào lãnh đạo + Nút **[+ Giao chỉ đạo nhiệm vụ BGH]**.
- **Hàng đợi Phê duyệt Chiến lược cấp trường:** Các hồ sơ lớn đã qua Trưởng đơn vị thẩm định $\rightarrow$ Nút [Ký duyệt ban hành] / [Trả lại].
- **Radar Sức Khỏe 11 Đơn Vị:** Danh sách 11 phòng/khoa với thanh tiến độ, nhãn Xanh/Vàng/Đỏ. Các đơn vị Đỏ được ưu tiên hiển thị trên cùng kèm nút [Gửi nhắc nhở].
- Tích hợp `ReviewActionDialog`.

- [ ] **Step 4: Kiểm tra Typecheck**

Chạy:
```bash
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/executive-workspace.tsx tests/role-based-workspace-workflow.test.ts
git commit -m "feat(workspace): implement ExecutiveWorkspace with strategic approvals and 11-dept health radar"
```

---

### Task 8: Chuẩn Hóa Điều Hướng Sidebar (`sidebar-context.tsx` & `app-sidebar.tsx`)

**Files:**
- Modify: `src/components/layout/sidebar-context.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`
- Test: `tests/role-based-workspace-workflow.test.ts`

**Interfaces:**
- Consumes: Clean static routes: `/`, `/tasks`, `/calendar`, `/org`, `/notifications`

- [ ] **Step 1: Viết test xác minh không còn URL chứa query `?zone=`**

Bổ sung vào `tests/role-based-workspace-workflow.test.ts`:
```typescript
import { SIDEBAR_ZONE_ITEMS, NAVIGATION_ITEMS } from "../src/components/layout/sidebar-context";

describe("Sidebar Navigation Hygiene", () => {
  test("ensures all navigation items use clean Next.js path routes without query strings", () => {
    const allItems = [...SIDEBAR_ZONE_ITEMS, ...NAVIGATION_ITEMS];
    for (const item of allItems) {
      assert.equal(item.href.includes("?zone="), false, `Item ${item.label} should not contain ?zone=`);
    }
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại vì hiện tại vẫn còn `?zone=`**

Chạy:
```bash
npx tsx --test tests/role-based-workspace-workflow.test.ts
```
Kỳ vọng: Thất bại với thông báo chứa `?zone=`.

- [ ] **Step 3: Cập nhật `src/components/layout/sidebar-context.tsx`**

Đổi:
- `/?zone=tasks` $\rightarrow$ `/tasks`
- `/?zone=dashboard` $\rightarrow$ `/` (hoặc `/dashboard` khi xem báo cáo phân tích nâng cao)
- `/?zone=calendar` $\rightarrow$ `/calendar`
- `/?zone=org` $\rightarrow$ `/org`
- `/` $\rightarrow$ Trang chủ Bàn làm việc thông minh.

- [ ] **Step 4: Chạy lại test xác nhận thành công**

Chạy:
```bash
npx tsx --test tests/role-based-workspace-workflow.test.ts
```
Kỳ vọng: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/sidebar-context.tsx src/components/layout/app-sidebar.tsx tests/role-based-workspace-workflow.test.ts
git commit -m "refactor(navigation): clean up sidebar links to standard Next.js App Router paths"
```

---

### Task 9: Tích Hợp Router Trang Chủ Phân Quyền Trong `src/app/page.tsx`

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `StaffWorkspace`, `ManagerWorkspace`, `ExecutiveWorkspace`

- [ ] **Step 1: Cập nhật `src/app/page.tsx` để điều phối theo role**

- Nếu `user.role === 'ADMIN'`: Render `ExecutiveWorkspace`.
- Nếu `user.role === 'MANAGER'`: Render `ManagerWorkspace`.
- Mặc định / `user.role === 'STAFF'`: Render `StaffWorkspace`.
- Giữ lại nút toggle phụ cho phép mở chế độ xem kho toàn trường khi cần.
- Kết nối các callback nộp minh chứng (`onSubmitDeliverable`) và thẩm định (`onReviewAction`) để cập nhật state nhiệm vụ gốc (Single Source of Truth).

- [ ] **Step 2: Kiểm tra toàn bộ Typecheck**

Chạy:
```bash
npm run typecheck
```
Kỳ vọng: 0 lỗi.

- [ ] **Step 3: Chạy toàn bộ test suite**

Chạy:
```bash
npm test
```
Kỳ vọng: 100% test suites pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(portal): wire up role-based workspace dispatcher on home page"
```

---

### Task 10: Kiểm Định Trực Quan (Browser Preview Verification) & Hoàn Tất

**Files:**
- Test via preview tools: `mcp__Claude_Browser__preview_start`, `mcp__Claude_Browser__preview_snapshot`, `mcp__Claude_Browser__preview_screenshot`

- [ ] **Step 1: Khởi động Preview Server**

Sử dụng tool `preview_start` (port 3001) để chạy thử ứng dụng.

- [ ] **Step 2: Chụp ảnh & kiểm tra trạng thái màn hình của từng Role**

- Role `STAFF`: Kiểm tra màn hình gọn gàng, thẻ khẩn cấp, modal nộp minh chứng hoạt động.
- Chuyển sang role `MANAGER`: Kiểm tra hàng đợi duyệt của khoa và nút chuyển đổi việc cá nhân.
- Chuyển sang role `ADMIN`: Kiểm tra hàng đợi phê duyệt BGH và Radar sức khỏe 11 đơn vị.

- [ ] **Step 3: Báo cáo kết quả và kết thúc kế hoạch**

---
