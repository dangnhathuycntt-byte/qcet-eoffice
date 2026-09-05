# Kế Hoạch Triển Khai: Quy Trình Giao Việc & Phân Cấp DACUM 3 Cấp (QCET Work)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai hệ thống giao việc phân tầng 3 cấp (BGH -> Trưởng phòng -> Nhân viên) chuẩn hóa theo Nghị định 232/2026/NĐ-CP và phương pháp phân rã công việc DACUM (Duty -> Task -> Deliverables), ngăn chặn giao việc vượt cấp và chặn hoàn thành hình thức thiếu minh chứng.

**Architecture:** Mở rộng mô hình thực thể dữ liệu phân cấp (`SchoolTask`, `StaffTask`, `CollaborationRequest`, `DeliverableItem`), xây dựng engine kiểm tra phân quyền và luân chuyển trạng thái công việc (`dacum-workflow-engine.ts`), tích hợp cơ chế phiếu phối hợp liên phòng ban (`collaboration-manager.ts`), và nâng cấp giao diện Modal giao việc (`create-task-modal.tsx`) cùng Side-sheet chi tiết tác vụ (`task-detail-side-sheet.tsx`).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Lucide React (stroke width 1.5), Node.js Test Runner (`node:test`, `node:assert/strict` via `tsx`).

**Spec:** `docs/superpowers/specs/2026-09-06-role-delegation-workflow-design.md`

## Global Constraints

- **Quy tắc không emoji (Anti-slop):** Tuyệt đối không dùng emoji trang trí trong code, UI, thông báo, nhãn, dữ liệu mock; chỉ dùng icon Lucide (stroke-width 1.5).
- **Tabular figures:** Các số liệu tiến độ, đếm số lượng, ngày tháng bắt buộc sử dụng `font-variant-numeric: tabular-nums` (`tabular-nums` trong Tailwind).
- **Ràng buộc thẩm quyền (RBAC):** Trưởng phòng không được giao việc trực tiếp cho nhân viên phòng khác; phải thông qua Phiếu phối hợp. Nhân viên không được tự bấm hoàn thành (`COMPLETED`) mà bắt buộc nộp minh chứng sang `NEEDS_REVIEW`.
- **Ràng buộc thời hạn:** `StaffTask.internalDueDate` luôn $\le$ `SchoolTask.dueDate`.

---

### Task 1: Mở rộng Model & Kiểu Dữ Liệu DACUM / NĐ 232

**Files:**
- Modify: `src/types/dashboard.ts`
- Test: `tests/dacum-types.test.ts`

**Interfaces:**
- Consumes: `UserRole`, `AuthUser` từ `src/types/auth.ts`
- Produces:
  - `DeliverableItem` interface
  - Mở rộng `TaskStatus = 'NEW' | 'IN_PROGRESS' | 'BLOCKED' | 'NEEDS_REVIEW' | 'COMPLETED'`
  - Mở rộng `StaffTask` (`deliverables`, `deliverableDescription`, `vtvlRole`, `blockedReason`, `rejectionReason`, `internalDueDate`)
  - Mở rộng `SchoolTask` (`leadDepartmentCode`, `coDepartmentCodes`, `executiveCriteria`, `completionReport`, `status: 'IN_PROGRESS' | 'PENDING_EXECUTIVE_APPROVAL' | 'COMPLETED'`)
  - `CollaborationRequest` interface (`id`, `schoolTaskId`, `fromDeptCode`, `toDeptCode`, `requestedBy`, `dueDate`, `status`)

- [ ] **Step 1: Viết test kiểm tra tính toàn vẹn kiểu dữ liệu và giá trị mặc định**

Tạo file `tests/dacum-types.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type {
  StaffTask,
  SchoolTask,
  DeliverableItem,
  CollaborationRequest,
  TaskStatus,
} from "../src/types/dashboard";

describe("DACUM & Decree 232 Types Specification", () => {
  test("StaffTask supports all 5 statuses and deliverable attachments", () => {
    const validStatuses: TaskStatus[] = [
      "NEW",
      "IN_PROGRESS",
      "BLOCKED",
      "NEEDS_REVIEW",
      "COMPLETED",
    ];
    assert.equal(validStatuses.length, 5);

    const deliverable: DeliverableItem = {
      id: "deliv-1",
      name: "Dự thảo Quy chế đào tạo số 2026",
      url: "https://drive.google.com/file/d/example",
      fileType: "pdf",
      submittedAt: "2026-09-06T10:00:00Z",
    };

    const task: StaffTask = {
      id: "staff-task-1",
      title: "Biên soạn dự thảo quy chế đào tạo số",
      assigneeName: "Nguyễn Ngọc Vinh",
      assigneeAvatar: undefined,
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-15",
      internalDueDate: "2026-09-12",
      parentSchoolTaskId: "school-task-101",
      updatedAt: "2026-09-06T10:00:00Z",
      deliverables: [deliverable],
      deliverableDescription: "Đã hoàn thiện bản dự thảo 12 trang xin ý kiến BGH",
      vtvlRole: "Chuyên viên Quản lý Đào tạo",
    };

    assert.equal(task.status, "NEEDS_REVIEW");
    assert.equal(task.deliverables?.length, 1);
    assert.equal(task.vtvlRole, "Chuyên viên Quản lý Đào tạo");
  });

  test("SchoolTask supports PENDING_EXECUTIVE_APPROVAL status and lead/co-departments", () => {
    const schoolTask: SchoolTask = {
      id: "school-task-101",
      title: "Chuyển đổi số công tác Tuyển sinh năm 2026",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Trần Hùng",
      leadDepartment: "Phòng Đào tạo & QLKH",
      leadDepartmentCode: "DAO_TAO",
      coAssignees: ["Trần Văn An"],
      coDepartments: ["Khoa Công nghệ thông tin"],
      coDepartmentCodes: ["CNTT"],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "PENDING_EXECUTIVE_APPROVAL",
      subTasks: [],
      totalSubTasks: 3,
      completedSubTasks: 3,
      progressPercent: 100,
      executiveCriteria: "Hệ thống nộp hồ sơ online hoạt động ổn định + Quyết định ban hành",
    };

    assert.equal(schoolTask.status, "PENDING_EXECUTIVE_APPROVAL");
    assert.equal(schoolTask.leadDepartmentCode, "DAO_TAO");
    assert.deepEqual(schoolTask.coDepartmentCodes, ["CNTT"]);
  });

  test("CollaborationRequest adheres to inter-departmental format", () => {
    const request: CollaborationRequest = {
      id: "collab-req-01",
      schoolTaskId: "school-task-101",
      schoolTaskTitle: "Chuyển đổi số công tác Tuyển sinh năm 2026",
      fromDeptCode: "DAO_TAO",
      fromDeptName: "Phòng Đào tạo & QLKH",
      toDeptCode: "CNTT",
      toDeptName: "Khoa Công nghệ thông tin",
      requestedBy: "Trần Hùng",
      description: "Cần lập trình viên hỗ trợ đồng bộ API CSDL tuyển sinh",
      requiredDeliverables: "Mã nguồn API + Tài liệu tích hợp Swagger",
      dueDate: "2026-09-20",
      status: "PENDING",
      createdAt: "2026-09-06T08:00:00Z",
    };

    assert.equal(request.fromDeptCode, "DAO_TAO");
    assert.equal(request.toDeptCode, "CNTT");
    assert.equal(request.status, "PENDING");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại trước khi bổ sung type**

Run: `npx tsx --test tests/dacum-types.test.ts`
Expected: FAIL do thiếu các trường mới trong interface.

- [ ] **Step 3: Cập nhật `src/types/dashboard.ts` để bổ sung đầy đủ kiểu**

Mở `src/types/dashboard.ts`, cập nhật:
```typescript
export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'BLOCKED' | 'NEEDS_REVIEW' | 'COMPLETED';

export type TaskCategory =
  | 'CHUYEN_DOI_SO'
  | 'TRUYEN_THONG'
  | 'CNTT'
  | 'ATTT'
  | 'THU_VIEN'
  | 'BAO_CAO'
  | 'KHAC';

export interface DeliverableItem {
  id: string;
  name: string;
  url?: string;
  fileType?: string;
  submittedAt?: string;
}

export interface StaffTask {
  id: string;
  title: string;
  assigneeName: string;
  assigneeAvatar?: string;
  status: TaskStatus;
  dueDate: string;
  internalDueDate?: string;
  parentSchoolTaskId: string;
  updatedAt: string;
  deliverables?: DeliverableItem[];
  deliverableDescription?: string;
  vtvlRole?: string;
  blockedReason?: string;
  rejectionReason?: string;
}

export interface SchoolTask {
  id: string;
  title: string;
  category: TaskCategory;
  categoryLabel: string;
  leadAssigneeName: string;
  leadAssigneeAvatar?: string;
  leadDepartment?: string;
  leadDepartmentCode?: string;
  coAssignees: string[];
  coDepartments?: string[];
  coDepartmentCodes?: string[];
  assignedDate: string;
  dueDate: string;
  status: 'IN_PROGRESS' | 'PENDING_EXECUTIVE_APPROVAL' | 'COMPLETED';
  subTasks: StaffTask[];
  totalSubTasks: number;
  completedSubTasks: number;
  progressPercent: number;
  executiveCriteria?: string;
  completionReport?: {
    summary: string;
    submittedBy: string;
    submittedAt: string;
    reportUrl?: string;
  };
}

export interface CollaborationRequest {
  id: string;
  schoolTaskId: string;
  schoolTaskTitle: string;
  fromDeptCode: string;
  fromDeptName: string;
  toDeptCode: string;
  toDeptName: string;
  requestedBy: string;
  description: string;
  requiredDeliverables: string;
  dueDate: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  assignedStaffIds?: string[];
  createdAt: string;
}
```

- [ ] **Step 4: Chạy lại test xác nhận thành công**

Run: `npx tsx --test tests/dacum-types.test.ts`
Expected: PASS toàn bộ 3 tests.

- [ ] **Step 5: Commit task 1**

```bash
git add src/types/dashboard.ts tests/dacum-types.test.ts
git commit -m "feat(types): expand dacum and decree 232 task and deliverable models"
```

---

### Task 2: Xây Dựng DACUM Workflow Engine & Bộ Quy Tắc Phân Quyền (RBAC Engine)

**Files:**
- Create: `src/lib/dacum-workflow-engine.ts`
- Test: `tests/dacum-workflow-engine.test.ts`

**Interfaces:**
- Consumes: `AuthUser`, `UserRole`, `StaffTask`, `SchoolTask`, `DeliverableItem`
- Produces:
  - `canAssignStaffTask(actor: AuthUser, targetUserDeptCode: string, isEmergencyBypass?: boolean): { allowed: boolean; reason?: string; isBypassWarning?: boolean }`
  - `validateDueDate(internalDueDate: string, schoolTaskDueDate: string): { valid: boolean; error?: string }`
  - `validateDeliverableSubmission(task: StaffTask, deliverables: DeliverableItem[], notes?: string): { valid: boolean; error?: string }`
  - `transitionStaffTaskStatus(task: StaffTask, newStatus: TaskStatus, actor: AuthUser, payload?: { rejectionReason?: string; blockedReason?: string; deliverables?: DeliverableItem[] }): { success: boolean; updatedTask?: StaffTask; error?: string }`
  - `calculateSchoolTaskRollup(schoolTask: SchoolTask): { progressPercent: number; completedSubTasks: number; totalSubTasks: number; calculatedStatus: 'IN_PROGRESS' | 'PENDING_EXECUTIVE_APPROVAL' | 'COMPLETED' }`

- [ ] **Step 1: Viết test cho toàn bộ logic workflow engine**

Tạo `tests/dacum-workflow-engine.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  canAssignStaffTask,
  validateDueDate,
  validateDeliverableSubmission,
  transitionStaffTaskStatus,
  calculateSchoolTaskRollup,
} from "../src/lib/dacum-workflow-engine";
import type { AuthUser } from "../src/types/auth";
import type { StaffTask, SchoolTask, DeliverableItem } from "../src/types/dashboard";

describe("DACUM Workflow & RBAC Engine", () => {
  const adminUser: AuthUser = {
    id: "admin-1",
    name: "Hiệu trưởng",
    email: "bgh@cdktcnqn.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
  };

  const managerDaoTao: AuthUser = {
    id: "manager-1",
    name: "Trần Hùng",
    email: "daotao@cdktcnqn.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng phòng Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  const staffDaoTao: AuthUser = {
    id: "staff-1",
    name: "Lê Văn A",
    email: "anlv@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  const staffCNTT: AuthUser = {
    id: "staff-2",
    name: "Nguyễn Ngọc Vinh",
    email: "vinhnn@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên CNTT",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
  };

  describe("Assignment Rules (Chống giao việc vượt cấp)", () => {
    test("Manager CAN assign to staff within their department", () => {
      const check = canAssignStaffTask(managerDaoTao, staffDaoTao.departmentCode);
      assert.equal(check.allowed, true);
    });

    test("Manager CANNOT assign directly to staff in another department", () => {
      const check = canAssignStaffTask(managerDaoTao, staffCNTT.departmentCode);
      assert.equal(check.allowed, false);
      assert.ok(check.reason?.includes("Phiếu yêu cầu phối hợp"));
    });

    test("Admin can assign anywhere; triggers bypass alert if direct to staff", () => {
      const normalCheck = canAssignStaffTask(adminUser, "DAO_TAO", false);
      assert.equal(normalCheck.allowed, true);

      const bypassCheck = canAssignStaffTask(adminUser, "CNTT", true);
      assert.equal(bypassCheck.allowed, true);
      assert.equal(bypassCheck.isBypassWarning, true);
    });
  });

  describe("Date Constraint Rules", () => {
    test("Internal due date earlier than or equal to school task due date is valid", () => {
      assert.equal(validateDueDate("2026-09-25", "2026-09-30").valid, true);
      assert.equal(validateDueDate("2026-09-30", "2026-09-30").valid, true);
    });

    test("Internal due date after school task due date is rejected", () => {
      const check = validateDueDate("2026-10-02", "2026-09-30");
      assert.equal(check.valid, false);
      assert.ok(check.error?.includes("không được vượt quá"));
    });
  });

  describe("Deliverable Submission Rules (Chống hoàn thành hình thức)", () => {
    const baseTask: StaffTask = {
      id: "task-1",
      title: "Viết báo cáo kiểm định",
      assigneeName: "Lê Văn A",
      status: "IN_PROGRESS",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "school-1",
      updatedAt: "2026-09-06T00:00:00Z",
    };

    test("Submitting to NEEDS_REVIEW fails if no deliverable or url provided", () => {
      const check = validateDeliverableSubmission(baseTask, [], "");
      assert.equal(check.valid, false);
      assert.ok(check.error?.includes("bắt buộc phải có sản phẩm minh chứng"));
    });

    test("Submitting with valid deliverable item succeeds", () => {
      const item: DeliverableItem = {
        id: "deliv-1",
        name: "Bao_cao_kiem_dinh.pdf",
        url: "https://drive.google.com/file/d/xyz",
      };
      const check = validateDeliverableSubmission(baseTask, [item], "Bản nộp đợt 1");
      assert.equal(check.valid, true);
    });
  });

  describe("Staff Task Status Transitions", () => {
    const task: StaffTask = {
      id: "task-1",
      title: "Thiết kế poster",
      assigneeName: "Lê Văn A",
      status: "IN_PROGRESS",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "school-1",
      updatedAt: "2026-09-06T00:00:00Z",
    };

    test("Staff cannot directly complete task without review", () => {
      const res = transitionStaffTaskStatus(task, "COMPLETED", staffDaoTao);
      assert.equal(res.success, false);
      assert.ok(res.error?.includes("Chỉ Trưởng phòng hoặc BGH mới có quyền nghiệm thu"));
    });

    test("Manager can approve NEEDS_REVIEW task to COMPLETED", () => {
      const reviewTask: StaffTask = { ...task, status: "NEEDS_REVIEW" };
      const res = transitionStaffTaskStatus(reviewTask, "COMPLETED", managerDaoTao);
      assert.equal(res.success, true);
      assert.equal(res.updatedTask?.status, "COMPLETED");
    });

    test("Manager can reject NEEDS_REVIEW task back to IN_PROGRESS with reason", () => {
      const reviewTask: StaffTask = { ...task, status: "NEEDS_REVIEW" };
      const res = transitionStaffTaskStatus(reviewTask, "IN_PROGRESS", managerDaoTao, {
        rejectionReason: "Hình ảnh mờ, cần thay đổi logo chuẩn trường",
      });
      assert.equal(res.success, true);
      assert.equal(res.updatedTask?.status, "IN_PROGRESS");
      assert.equal(res.updatedTask?.rejectionReason, "Hình ảnh mờ, cần thay đổi logo chuẩn trường");
    });

    test("Staff can flag task as BLOCKED with reason", () => {
      const res = transitionStaffTaskStatus(task, "BLOCKED", staffDaoTao, {
        blockedReason: "Chưa nhận được số liệu từ phòng Kế hoạch Tài chính",
      });
      assert.equal(res.success, true);
      assert.equal(res.updatedTask?.status, "BLOCKED");
      assert.equal(res.updatedTask?.blockedReason, "Chưa nhận được số liệu từ phòng Kế hoạch Tài chính");
    });
  });

  describe("School Task Rollup Calculation", () => {
    test("Calculates correct percentage and sets PENDING_EXECUTIVE_APPROVAL when 100% complete", () => {
      const schoolTask: SchoolTask = {
        id: "school-1",
        title: "Tổ chức hội thảo",
        category: "KHAC",
        categoryLabel: "Khác",
        leadAssigneeName: "Trần Hùng",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        totalSubTasks: 2,
        completedSubTasks: 2,
        progressPercent: 100,
        subTasks: [
          {
            id: "sub-1",
            title: "Thuê hội trường",
            assigneeName: "A",
            status: "COMPLETED",
            dueDate: "2026-09-15",
            parentSchoolTaskId: "school-1",
            updatedAt: "",
          },
          {
            id: "sub-2",
            title: "Mời diễn giả",
            assigneeName: "B",
            status: "COMPLETED",
            dueDate: "2026-09-20",
            parentSchoolTaskId: "school-1",
            updatedAt: "",
          },
        ],
      };

      const rollup = calculateSchoolTaskRollup(schoolTask);
      assert.equal(rollup.totalSubTasks, 2);
      assert.equal(rollup.completedSubTasks, 2);
      assert.equal(rollup.progressPercent, 100);
      assert.equal(rollup.calculatedStatus, "PENDING_EXECUTIVE_APPROVAL");
    });

    test("Keeps IN_PROGRESS when incomplete", () => {
      const schoolTask: SchoolTask = {
        id: "school-1",
        title: "Tổ chức hội thảo",
        category: "KHAC",
        categoryLabel: "Khác",
        leadAssigneeName: "Trần Hùng",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        totalSubTasks: 2,
        completedSubTasks: 1,
        progressPercent: 50,
        subTasks: [
          {
            id: "sub-1",
            title: "Thuê hội trường",
            assigneeName: "A",
            status: "COMPLETED",
            dueDate: "2026-09-15",
            parentSchoolTaskId: "school-1",
            updatedAt: "",
          },
          {
            id: "sub-2",
            title: "Mời diễn giả",
            assigneeName: "B",
            status: "IN_PROGRESS",
            dueDate: "2026-09-20",
            parentSchoolTaskId: "school-1",
            updatedAt: "",
          },
        ],
      };

      const rollup = calculateSchoolTaskRollup(schoolTask);
      assert.equal(rollup.progressPercent, 50);
      assert.equal(rollup.calculatedStatus, "IN_PROGRESS");
    });
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/dacum-workflow-engine.test.ts`
Expected: FAIL do chưa có file `src/lib/dacum-workflow-engine.ts`.

- [ ] **Step 3: Viết triển khai `src/lib/dacum-workflow-engine.ts`**

Tạo file `src/lib/dacum-workflow-engine.ts`:
```typescript
import type { AuthUser, UserRole } from "../types/auth";
import type {
  StaffTask,
  SchoolTask,
  DeliverableItem,
  TaskStatus,
} from "../types/dashboard";

export interface AssignmentCheckResult {
  allowed: boolean;
  reason?: string;
  isBypassWarning?: boolean;
}

export function canAssignStaffTask(
  actor: AuthUser,
  targetUserDeptCode: string,
  isEmergencyBypass: boolean = false
): AssignmentCheckResult {
  if (actor.role === "ADMIN") {
    return {
      allowed: true,
      isBypassWarning: isEmergencyBypass,
      reason: isEmergencyBypass
        ? "Chỉ đạo khẩn cấp từ Ban Giám hiệu: Hệ thống sẽ tự động gửi thông báo tới Lãnh đạo đơn vị quản lý nhân sự."
        : undefined,
    };
  }

  if (actor.role === "MANAGER") {
    if (actor.departmentCode === targetUserDeptCode) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason:
        "Theo Nghị định 232 và quy chế điều hành, Trưởng phòng không được giao việc trực tiếp cho nhân viên phòng khác. Vui lòng tạo Phiếu yêu cầu phối hợp gửi tới Lãnh đạo đơn vị tương ứng.",
    };
  }

  return {
    allowed: false,
    reason: "Chuyên viên/Nhân viên không có quyền giao việc.",
  };
}

export function validateDueDate(
  internalDueDate: string,
  schoolTaskDueDate: string
): { valid: boolean; error?: string } {
  if (!internalDueDate || !schoolTaskDueDate) {
    return { valid: true };
  }

  const internalTime = new Date(internalDueDate).getTime();
  const schoolTime = new Date(schoolTaskDueDate).getTime();

  if (internalTime > schoolTime) {
    return {
      valid: false,
      error: `Hạn chót công việc nội bộ (${internalDueDate}) không được vượt quá hạn chót của Nhiệm vụ cấp Trường (${schoolTaskDueDate}).`,
    };
  }

  return { valid: true };
}

export function validateDeliverableSubmission(
  task: StaffTask,
  deliverables: DeliverableItem[],
  notes?: string
): { valid: boolean; error?: string } {
  const hasItems = deliverables && deliverables.length > 0;
  const hasNotes = Boolean(notes && notes.trim().length > 0);

  if (!hasItems && !hasNotes) {
    return {
      valid: false,
      error:
        "Theo chuẩn DACUM và Nghị định 232, bắt buộc phải có sản phẩm minh chứng (đường dẫn tài liệu, tệp đính kèm hoặc mô tả kết quả) trước khi nộp duyệt.",
    };
  }

  return { valid: true };
}

export function transitionStaffTaskStatus(
  task: StaffTask,
  newStatus: TaskStatus,
  actor: AuthUser,
  payload?: {
    rejectionReason?: string;
    blockedReason?: string;
    deliverables?: DeliverableItem[];
    notes?: string;
  }
): { success: boolean; updatedTask?: StaffTask; error?: string } {
  const role = actor.role;

  // Rule 1: STAFF cannot directly complete task
  if (newStatus === "COMPLETED" && role === "STAFF") {
    return {
      success: false,
      error:
        "Chỉ Trưởng phòng hoặc BGH mới có quyền nghiệm thu hoàn thành công việc. Viên chức vui lòng nộp minh chứng để chuyển sang Chờ duyệt (NEEDS_REVIEW).",
    };
  }

  // Rule 2: Submitting to NEEDS_REVIEW requires deliverables
  if (newStatus === "NEEDS_REVIEW") {
    const deliverables = payload?.deliverables || task.deliverables || [];
    const notes = payload?.notes || task.deliverableDescription;
    const check = validateDeliverableSubmission(task, deliverables, notes);
    if (!check.valid) {
      return { success: false, error: check.error };
    }
  }

  // Rule 3: Rejection from NEEDS_REVIEW back to IN_PROGRESS requires reason
  if (task.status === "NEEDS_REVIEW" && newStatus === "IN_PROGRESS") {
    if (role !== "ADMIN" && role !== "MANAGER") {
      return {
        success: false,
        error: "Chỉ người quản lý mới có quyền trả lại công việc yêu cầu sửa đổi.",
      };
    }
  }

  const updatedTask: StaffTask = {
    ...task,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  if (payload?.rejectionReason) {
    updatedTask.rejectionReason = payload.rejectionReason;
  }
  if (payload?.blockedReason) {
    updatedTask.blockedReason = payload.blockedReason;
  }
  if (payload?.deliverables) {
    updatedTask.deliverables = payload.deliverables;
  }
  if (payload?.notes) {
    updatedTask.deliverableDescription = payload.notes;
  }

  return { success: true, updatedTask };
}

export function calculateSchoolTaskRollup(schoolTask: SchoolTask): {
  progressPercent: number;
  completedSubTasks: number;
  totalSubTasks: number;
  calculatedStatus: "IN_PROGRESS" | "PENDING_EXECUTIVE_APPROVAL" | "COMPLETED";
} {
  const subTasks = schoolTask.subTasks || [];
  const totalSubTasks = subTasks.length;

  if (totalSubTasks === 0) {
    return {
      progressPercent: schoolTask.status === "COMPLETED" ? 100 : 0,
      completedSubTasks: 0,
      totalSubTasks: 0,
      calculatedStatus: schoolTask.status,
    };
  }

  const completedSubTasks = subTasks.filter(
    (st) => st.status === "COMPLETED"
  ).length;
  const progressPercent = Math.round((completedSubTasks / totalSubTasks) * 100);

  let calculatedStatus: "IN_PROGRESS" | "PENDING_EXECUTIVE_APPROVAL" | "COMPLETED" =
    schoolTask.status;

  if (progressPercent === 100) {
    calculatedStatus =
      schoolTask.status === "COMPLETED"
        ? "COMPLETED"
        : "PENDING_EXECUTIVE_APPROVAL";
  } else {
    calculatedStatus = "IN_PROGRESS";
  }

  return {
    progressPercent,
    completedSubTasks,
    totalSubTasks,
    calculatedStatus,
  };
}
```

- [ ] **Step 4: Chạy lại test suite để kiểm tra tính đúng đắn**

Run: `npx tsx --test tests/dacum-workflow-engine.test.ts`
Expected: PASS toàn bộ test cases.

- [ ] **Step 5: Commit task 2**

```bash
git add src/lib/dacum-workflow-engine.ts tests/dacum-workflow-engine.test.ts
git commit -m "feat(engine): implement dacum workflow and rbac validation engine"
```

---

### Task 3: Quản Lý Phiếu Phối Hợp Liên Phòng Ban (`collaboration-manager.ts`)

**Files:**
- Create: `src/lib/collaboration-manager.ts`
- Test: `tests/collaboration-manager.test.ts`

**Interfaces:**
- Consumes: `CollaborationRequest`, `AuthUser`, `SchoolTask`, `StaffTask`
- Produces:
  - `createCollaborationRequest(params: Omit<CollaborationRequest, 'id' | 'createdAt' | 'status'>): CollaborationRequest`
  - `acceptCollaborationRequest(req: CollaborationRequest, manager: AuthUser, assignedStaffIds: string[]): { request: CollaborationRequest; subTasksToCreate: Partial<StaffTask>[] }`
  - `rejectCollaborationRequest(req: CollaborationRequest, reason: string): CollaborationRequest`
  - `getCollaborationRequestsForDepartment(requests: CollaborationRequest[], deptCode: string, mode: 'incoming' | 'outgoing'): CollaborationRequest[]`

- [ ] **Step 1: Viết test cho quản lý phiếu phối hợp**

Tạo `tests/collaboration-manager.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  createCollaborationRequest,
  acceptCollaborationRequest,
  rejectCollaborationRequest,
  getCollaborationRequestsForDepartment,
} from "../src/lib/collaboration-manager";
import type { AuthUser } from "../src/types/auth";
import type { CollaborationRequest } from "../src/types/dashboard";

describe("Collaboration Manager (Điều phối liên phòng ban)", () => {
  const managerCNTT: AuthUser = {
    id: "manager-cntt",
    name: "Võ Thị Mai",
    email: "cntt@cdktcnqn.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng khoa CNTT",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
  };

  test("createCollaborationRequest creates pending request with unique ID and timestamp", () => {
    const req = createCollaborationRequest({
      schoolTaskId: "st-101",
      schoolTaskTitle: "Tuyển sinh 2026",
      fromDeptCode: "DAO_TAO",
      fromDeptName: "Phòng Đào tạo",
      toDeptCode: "CNTT",
      toDeptName: "Khoa CNTT",
      requestedBy: "Trần Hùng",
      description: "Hỗ trợ cấu hình CSDL",
      requiredDeliverables: "Tài liệu kỹ thuật",
      dueDate: "2026-09-20",
    });

    assert.ok(req.id.startsWith("collab-"));
    assert.equal(req.status, "PENDING");
    assert.equal(req.fromDeptCode, "DAO_TAO");
    assert.equal(req.toDeptCode, "CNTT");
    assert.ok(req.createdAt);
  });

  test("acceptCollaborationRequest assigns internal staff and prepares subtasks", () => {
    const req: CollaborationRequest = {
      id: "collab-1",
      schoolTaskId: "st-101",
      schoolTaskTitle: "Tuyển sinh 2026",
      fromDeptCode: "DAO_TAO",
      fromDeptName: "Phòng Đào tạo",
      toDeptCode: "CNTT",
      toDeptName: "Khoa CNTT",
      requestedBy: "Trần Hùng",
      description: "Hỗ trợ cấu hình CSDL",
      requiredDeliverables: "Tài liệu kỹ thuật",
      dueDate: "2026-09-20",
      status: "PENDING",
      createdAt: "2026-09-06T00:00:00Z",
    };

    const result = acceptCollaborationRequest(req, managerCNTT, ["staff-vinh"]);
    assert.equal(result.request.status, "ACCEPTED");
    assert.deepEqual(result.request.assignedStaffIds, ["staff-vinh"]);
    assert.equal(result.subTasksToCreate.length, 1);
    assert.equal(result.subTasksToCreate[0].parentSchoolTaskId, "st-101");
  });

  test("rejectCollaborationRequest marks as REJECTED", () => {
    const req: CollaborationRequest = {
      id: "collab-1",
      schoolTaskId: "st-101",
      schoolTaskTitle: "Tuyển sinh 2026",
      fromDeptCode: "DAO_TAO",
      fromDeptName: "Phòng Đào tạo",
      toDeptCode: "CNTT",
      toDeptName: "Khoa CNTT",
      requestedBy: "Trần Hùng",
      description: "Hỗ trợ",
      requiredDeliverables: "Báo cáo",
      dueDate: "2026-09-20",
      status: "PENDING",
      createdAt: "2026-09-06T00:00:00Z",
    };

    const rejected = rejectCollaborationRequest(req, "Nhân sự khoa đang tập trung cao điểm thi tốt nghiệp");
    assert.equal(rejected.status, "REJECTED");
  });

  test("filters requests by department code for incoming and outgoing", () => {
    const requests: CollaborationRequest[] = [
      {
        id: "c1",
        schoolTaskId: "s1",
        schoolTaskTitle: "T1",
        fromDeptCode: "DAO_TAO",
        fromDeptName: "Đào tạo",
        toDeptCode: "CNTT",
        toDeptName: "CNTT",
        requestedBy: "A",
        description: "",
        requiredDeliverables: "",
        dueDate: "",
        status: "PENDING",
        createdAt: "",
      },
      {
        id: "c2",
        schoolTaskId: "s2",
        schoolTaskTitle: "T2",
        fromDeptCode: "CNTT",
        fromDeptName: "CNTT",
        toDeptCode: "TCKT",
        toDeptName: "Tài chính",
        requestedBy: "B",
        description: "",
        requiredDeliverables: "",
        dueDate: "",
        status: "PENDING",
        createdAt: "",
      },
    ];

    const incomingCNTT = getCollaborationRequestsForDepartment(requests, "CNTT", "incoming");
    assert.equal(incomingCNTT.length, 1);
    assert.equal(incomingCNTT[0].id, "c1");

    const outgoingCNTT = getCollaborationRequestsForDepartment(requests, "CNTT", "outgoing");
    assert.equal(outgoingCNTT.length, 1);
    assert.equal(outgoingCNTT[0].id, "c2");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/collaboration-manager.test.ts`
Expected: FAIL do chưa tạo file.

- [ ] **Step 3: Viết mã triển khai `src/lib/collaboration-manager.ts`**

Tạo file `src/lib/collaboration-manager.ts`:
```typescript
import type { AuthUser } from "../types/auth";
import type { CollaborationRequest, StaffTask } from "../types/dashboard";

export function createCollaborationRequest(
  params: Omit<CollaborationRequest, "id" | "createdAt" | "status">
): CollaborationRequest {
  const id = `collab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  return {
    ...params,
    id,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
}

export function acceptCollaborationRequest(
  req: CollaborationRequest,
  manager: AuthUser,
  assignedStaffIds: string[]
): {
  request: CollaborationRequest;
  subTasksToCreate: Partial<StaffTask>[];
} {
  const updatedRequest: CollaborationRequest = {
    ...req,
    status: "ACCEPTED",
    assignedStaffIds,
  };

  const subTasksToCreate: Partial<StaffTask>[] = assignedStaffIds.map((staffId) => ({
    title: `[Phối hợp: ${req.fromDeptName}] ${req.description}`,
    parentSchoolTaskId: req.schoolTaskId,
    dueDate: req.dueDate,
    internalDueDate: req.dueDate,
    status: "NEW",
    deliverableDescription: `Sản phẩm yêu cầu: ${req.requiredDeliverables}`,
    updatedAt: new Date().toISOString(),
  }));

  return {
    request: updatedRequest,
    subTasksToCreate,
  };
}

export function rejectCollaborationRequest(
  req: CollaborationRequest,
  _reason: string
): CollaborationRequest {
  return {
    ...req,
    status: "REJECTED",
  };
}

export function getCollaborationRequestsForDepartment(
  requests: CollaborationRequest[],
  deptCode: string,
  mode: "incoming" | "outgoing"
): CollaborationRequest[] {
  if (mode === "incoming") {
    return requests.filter((r) => r.toDeptCode === deptCode);
  }
  return requests.filter((r) => r.fromDeptCode === deptCode);
}
```

- [ ] **Step 4: Chạy lại test suite để kiểm tra**

Run: `npx tsx --test tests/collaboration-manager.test.ts`
Expected: PASS toàn bộ 4 tests.

- [ ] **Step 5: Commit task 3**

```bash
git add src/lib/collaboration-manager.ts tests/collaboration-manager.test.ts
git commit -m "feat(collab): implement cross-department collaboration request manager"
```

---

### Task 4: Nâng Cấp Modal Giao Việc (`create-task-modal.tsx`) Với Quy Tắc Phân Cấp & DACUM

**Files:**
- Modify: `src/components/dashboard/create-task-modal.tsx`
- Test: `tests/create-task-modal-validation.test.ts`

**Interfaces:**
- Consumes: `canAssignStaffTask`, `validateDueDate` từ `src/lib/dacum-workflow-engine.ts`
- Produces:
  - Form validation ngăn chặn gán nhân viên phòng khác cho vai trò `MANAGER`.
  - Hiển thị cờ cảnh báo `isBypassWarning` khi `ADMIN` giao việc trực tiếp cho nhân viên.
  - Bổ sung trường Sản phẩm đầu ra bắt buộc (`Required Deliverables`) và Vị trí việc làm (`VTVL`).

- [ ] **Step 1: Viết test cho logic validation trong Modal giao việc**

Tạo `tests/create-task-modal-validation.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getAllowedTaskLevelsForRole,
  canRoleSelectAssignee,
} from "../src/components/dashboard/create-task-modal";
import type { AuthUser } from "../src/types/auth";

describe("Create Task Modal Constraints & Helpers", () => {
  const adminUser: AuthUser = {
    id: "admin-1",
    name: "Hiệu trưởng",
    email: "bgh@cdktcnqn.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
  };

  const managerDaoTao: AuthUser = {
    id: "manager-1",
    name: "Trần Hùng",
    email: "daotao@cdktcnqn.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng phòng Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  test("Allowed task levels per role", () => {
    assert.deepEqual(getAllowedTaskLevelsForRole("ADMIN"), ["TRUONG", "DON_VI"]);
    assert.deepEqual(getAllowedTaskLevelsForRole("MANAGER"), ["DON_VI"]);
    assert.deepEqual(getAllowedTaskLevelsForRole("STAFF"), []);
  });

  test("canRoleSelectAssignee allows manager only for internal staff, prevents external staff", () => {
    // Manager assigning to own staff
    const internalCheck = canRoleSelectAssignee(managerDaoTao, "DAO_TAO");
    assert.equal(internalCheck.allowed, true);

    // Manager assigning to CNTT staff
    const externalCheck = canRoleSelectAssignee(managerDaoTao, "CNTT");
    assert.equal(externalCheck.allowed, false);
    assert.ok(externalCheck.message?.includes("Phiếu yêu cầu phối hợp"));

    // Admin assigning anywhere
    const adminCheck = canRoleSelectAssignee(adminUser, "CNTT");
    assert.equal(adminCheck.allowed, true);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/create-task-modal-validation.test.ts`
Expected: FAIL do hàm `canRoleSelectAssignee` chưa được định nghĩa và export trong `create-task-modal.tsx`.

- [ ] **Step 3: Cập nhật `src/components/dashboard/create-task-modal.tsx`**

Bổ sung:
1. Export hàm `canRoleSelectAssignee(user: AuthUser, targetDeptCode: string): { allowed: boolean; message?: string }`.
2. Trong form, kiểm tra khi Manager chọn người phụ trách không thuộc phòng mình thì hiển thị thông báo chuyển sang tạo Phiếu phối hợp.
3. Thêm trường nhập "Sản phẩm đầu ra đo lường được (Nghị định 232/DACUM)" và "Hạn chót nội bộ".

- [ ] **Step 4: Chạy lại test suite để kiểm tra**

Run: `npx tsx --test tests/create-task-modal-validation.test.ts`
Expected: PASS toàn bộ tests.

- [ ] **Step 5: Commit task 4**

```bash
git add src/components/dashboard/create-task-modal.tsx tests/create-task-modal-validation.test.ts
git commit -m "feat(modal): enforce dacum delegation rules and cross-dept guards in create task modal"
```

---

### Task 5: Nâng Cấp Side-Sheet Chi Tiết Tác Vụ (`task-detail-side-sheet.tsx`)

**Files:**
- Modify: `src/components/dashboard/task-detail-side-sheet.tsx`
- Test: `tests/task-detail-side-sheet.test.ts`

**Interfaces:**
- Consumes: `transitionStaffTaskStatus`, `validateDeliverableSubmission` từ `src/lib/dacum-workflow-engine.ts`
- Produces:
  - Giao diện nộp minh chứng cho Nhân viên: Nút nộp bị disable nếu chưa có file/link minh chứng.
  - Giao diện Duyệt cấp 1 cho Trưởng phòng: 2 nút "Nghiệm thu Đạt (`COMPLETED`)" và "Trả lại Yêu cầu Sửa (`IN_PROGRESS`)" kèm modal nhập lý do.
  - Giao diện Nghiệm thu cấp 2 cho Hiệu trưởng: Nút "Đóng Nhiệm vụ cấp Trường" khi status là `PENDING_EXECUTIVE_APPROVAL`.
  - Banner cảnh báo cản trở khi task có status `BLOCKED`.

- [ ] **Step 1: Viết test cho logic tương tác trong TaskDetailSideSheet**

Tạo `tests/task-detail-side-sheet.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  canUserReviewTask,
  canUserSubmitDeliverable,
  canUserCloseSchoolTask,
} from "../src/components/dashboard/task-detail-side-sheet";
import type { AuthUser } from "../src/types/auth";
import type { StaffTask, SchoolTask } from "../src/types/dashboard";

describe("Task Detail Side Sheet Role Permissions", () => {
  const adminUser: AuthUser = {
    id: "admin-1",
    name: "Hiệu trưởng",
    email: "bgh@cdktcnqn.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
  };

  const managerUser: AuthUser = {
    id: "manager-1",
    name: "Trần Hùng",
    email: "daotao@cdktcnqn.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng phòng Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  const staffUser: AuthUser = {
    id: "staff-1",
    name: "Lê Văn A",
    email: "anlv@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  test("canUserSubmitDeliverable allows only assignee when task is IN_PROGRESS or BLOCKED", () => {
    const task: StaffTask = {
      id: "t1",
      title: "Biên soạn tài liệu",
      assigneeName: "Lê Văn A",
      status: "IN_PROGRESS",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "s1",
      updatedAt: "",
    };

    assert.equal(canUserSubmitDeliverable(task, staffUser), true);
    assert.equal(canUserSubmitDeliverable(task, managerUser), false);

    const completedTask: StaffTask = { ...task, status: "COMPLETED" };
    assert.equal(canUserSubmitDeliverable(completedTask, staffUser), false);
  });

  test("canUserReviewTask allows manager and admin when status is NEEDS_REVIEW", () => {
    const task: StaffTask = {
      id: "t1",
      title: "Biên soạn tài liệu",
      assigneeName: "Lê Văn A",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "s1",
      updatedAt: "",
    };

    assert.equal(canUserReviewTask(task, managerUser), true);
    assert.equal(canUserReviewTask(task, adminUser), true);
    assert.equal(canUserReviewTask(task, staffUser), false);
  });

  test("canUserCloseSchoolTask allows only ADMIN when status is PENDING_EXECUTIVE_APPROVAL", () => {
    const schoolTask: SchoolTask = {
      id: "s1",
      title: "Tuyển sinh 2026",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Trần Hùng",
      coAssignees: [],
      assignedDate: "",
      dueDate: "",
      status: "PENDING_EXECUTIVE_APPROVAL",
      subTasks: [],
      totalSubTasks: 2,
      completedSubTasks: 2,
      progressPercent: 100,
    };

    assert.equal(canUserCloseSchoolTask(schoolTask, adminUser), true);
    assert.equal(canUserCloseSchoolTask(schoolTask, managerUser), false);
    assert.equal(canUserCloseSchoolTask(schoolTask, staffUser), false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/task-detail-side-sheet.test.ts`
Expected: FAIL do các hàm helper chưa được export trong `task-detail-side-sheet.tsx`.

- [ ] **Step 3: Cập nhật `src/components/dashboard/task-detail-side-sheet.tsx`**

1. Xuất các hàm helper: `canUserSubmitDeliverable`, `canUserReviewTask`, `canUserCloseSchoolTask`.
2. Tích hợp UI cho việc nộp minh chứng (URL input, mô tả sản phẩm), duyệt/trả lại của Trưởng phòng, và nghiệm thu đóng nhiệm vụ của Hiệu trưởng.
3. Đảm bảo tuân thủ 100% Anti-slop (không có emoji, stroke 1.5).

- [ ] **Step 4: Chạy lại test suite để kiểm tra**

Run: `npx tsx --test tests/task-detail-side-sheet.test.ts`
Expected: PASS toàn bộ tests.

- [ ] **Step 5: Commit task 5**

```bash
git add src/components/dashboard/task-detail-side-sheet.tsx tests/task-detail-side-sheet.test.ts
git commit -m "feat(side-sheet): integrate dacum deliverable submission and multi-tier approval actions"
```

---

### Task 6: Kiểm Thử Toàn Diện Hệ Thống (End-to-End Anti-Slop & Workflow Audit)

**Files:**
- Create: `tests/dacum-integration-audit.test.ts`
- Modify: `tests/executive-stat-strip.test.ts` (nếu cần cập nhật mock data)

- [ ] **Step 1: Viết test kịch bản toàn diện (End-to-End Journey)**

Tạo `tests/dacum-integration-audit.test.ts`:
Kiểm tra vòng đời trọn vẹn từ lúc:
1. BGH khởi tạo School Task giao cho Trưởng phòng Đào tạo.
2. Trưởng phòng Đào tạo gửi Phiếu phối hợp sang Trưởng khoa CNTT.
3. Trưởng khoa CNTT nhận phiếu và bổ việc cho Chuyên viên Vinh kèm hạn chót và yêu cầu minh chứng.
4. Chuyên viên Vinh thực hiện, nộp link minh chứng sang `NEEDS_REVIEW`.
5. Trưởng khoa CNTT kiểm tra và duyệt `COMPLETED`.
6. Hệ thống tự động tính rollup của School Task thành 100% và chuyển sang `PENDING_EXECUTIVE_APPROVAL`.
7. Hiệu trưởng kiểm tra hồ sơ tổng hợp và bấm duyệt đóng `COMPLETED`.
8. Kiểm tra toàn bộ mã nguồn không vi phạm quy tắc Anti-slop (zero emoji).

- [ ] **Step 2: Chạy toàn bộ test suite của dự án**

Run: `npm test`
Expected: Tất cả các file test (cũ và mới) đều PASS 100%.

- [ ] **Step 3: Chạy typecheck**

Run: `npm run typecheck`
Expected: Không có lỗi type TypeScript (`0 errors`).

- [ ] **Step 4: Commit task 6**

```bash
git add tests/dacum-integration-audit.test.ts tests/
git commit -m "test(audit): verify complete dacum 3-tier workflow lifecycle and zero emojis"
```
