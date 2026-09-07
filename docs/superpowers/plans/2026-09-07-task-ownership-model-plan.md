# Task Ownership Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Task Ownership Model: 1 DRI per task, multi-subtask assignment per person, 2-tier parent-child workspace presentation ("Tôi chủ trì" vs "Tôi tham gia"), workload visibility for DRIs, and task origin support (`SCHOOL` vs `SELF_INITIATED`).

**Architecture:** 
- Extend `SchoolTask` with `origin?: 'SCHOOL' | 'SELF_INITIATED'` and support backward compatibility.
- Build pure extraction, grouping, and workload aggregation utilities in `src/lib/task-ownership.ts`.
- Update `filterTasksByRole` in `src/lib/role-task-filter.ts` so STAFF users who are DRIs retain full subtask visibility, and co-assignees without subtasks are preserved with "Chờ phân công" state.
- Update `LecturerFocusWorkspace` to provide 2-tier visual cards (Parent Mission Context -> Grouped Subtasks) with "Tôi chủ trì" (DRI) and "Tôi tham gia" (Co-assignee) segment controls and DRI workload badges.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Lucide React, Node.js test runner (`tsx --test`).

**Spec:** [docs/superpowers/specs/2026-09-07-task-ownership-model-spec.md](docs/superpowers/specs/2026-09-07-task-ownership-model-spec.md)

## Global Constraints

- **Strict Anti-Slop (Zero Emojis):** No emojis in code, labels, or test files. Use Lucide icons instead.
- **Tailwind CSS v4:** Do not introduce `tailwind.config.js`. Use existing semantic tokens.
- **Build Safety Rule:** Do NOT run `next build` while dev server is running. Use `npm run typecheck` and `npm test` for validation.
- **1 DRI per SchoolTask:** `leadAssigneeName` is the single directly responsible individual regardless of organizational rank.
- **1 Assignee per SubTask:** `StaffTask.assigneeName` is 1 person, but 1 person can hold multiple sub-tasks under the same parent task.

---

### Task 1: Type Definitions for Task Origin & Grouped Workspace Views

**Files:**
- Modify: `src/types/dashboard.ts:1-125`
- Modify: `src/types/workspace.ts:1-100`
- Test: `tests/task-ownership-model.test.ts`

**Interfaces:**
- Consumes: Existing `SchoolTask`, `StaffTask`, `AuthUser` types.
- Produces: 
  * `TaskOrigin`: `'SCHOOL' | 'SELF_INITIATED'`
  * `SchoolTask.origin?: TaskOrigin`
  * `OwnershipRoleFilter`: `'ALL' | 'LEADING' | 'PARTICIPATING'`
  * `AssigneeWorkloadItem`: `{ assigneeName: string; count: number; completedCount: number }`
  * `GroupedParentTaskView`: structured representation of parent task + grouped subtasks + workload summary.

- [ ] **Step 1: Write failing test for type contracts and origin defaults**

Create `tests/task-ownership-model.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { TaskOrigin, SchoolTask } from "../src/types/dashboard";
import type { OwnershipRoleFilter, AssigneeWorkloadItem } from "../src/types/workspace";

describe("Task Ownership Model - Type Definitions", () => {
  test("supports TaskOrigin union values and backward compatibility", () => {
    const origin1: TaskOrigin = "SCHOOL";
    const origin2: TaskOrigin = "SELF_INITIATED";
    assert.equal(origin1, "SCHOOL");
    assert.equal(origin2, "SELF_INITIATED");

    const sampleTask: SchoolTask = {
      id: "task-test-1",
      title: "Nhiệm vụ kiểm thử",
      category: "CNTT",
      categoryLabel: "Công nghệ thông tin",
      leadAssigneeName: "Trần Hùng",
      coAssignees: ["Nguyễn Ngọc Vinh"],
      assignedDate: "2026-09-07",
      dueDate: "2026-09-24",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 0,
      origin: "SELF_INITIATED",
    };

    assert.equal(sampleTask.origin, "SELF_INITIATED");
  });

  test("validates OwnershipRoleFilter and AssigneeWorkloadItem structures", () => {
    const filters: OwnershipRoleFilter[] = ["ALL", "LEADING", "PARTICIPATING"];
    assert.equal(filters.length, 3);

    const workload: AssigneeWorkloadItem = {
      assigneeName: "Nguyễn Ngọc Vinh",
      count: 2,
      completedCount: 1,
    };
    assert.equal(workload.count, 2);
    assert.equal(workload.completedCount, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/task-ownership-model.test.ts`
Expected: FAIL due to missing `TaskOrigin`, `OwnershipRoleFilter`, or `AssigneeWorkloadItem`.

- [ ] **Step 3: Update `src/types/dashboard.ts` and `src/types/workspace.ts`**

In `src/types/dashboard.ts`:
```typescript
export type TaskOrigin = 'SCHOOL' | 'SELF_INITIATED';

export interface SchoolTask {
  id: string;
  title: string;
  category: TaskCategory;
  categoryLabel: string;
  leadAssigneeName: string;
  leadAssigneeId?: string;
  leadAssigneeAvatar?: string;
  leadDepartment?: string;
  leadDepartmentCode?: string;
  leadDepartmentId?: string;
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
  origin?: TaskOrigin;
  completionReport?: {
    summary: string;
    submittedBy: string;
    submittedAt: string;
    reportUrl?: string;
  };
}
```

In `src/types/workspace.ts`:
```typescript
export type OwnershipRoleFilter = 'ALL' | 'LEADING' | 'PARTICIPATING';

export interface AssigneeWorkloadItem {
  assigneeName: string;
  assigneeId?: string;
  count: number;
  completedCount: number;
}

export interface GroupedParentTaskView {
  parentTask: SchoolTask;
  isLeading: boolean;
  isParticipating: boolean;
  isAwaitingAssignment: boolean;
  workloads: AssigneeWorkloadItem[];
  userSubTasks: StaffTask[];
  allSubTasks: StaffTask[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/task-ownership-model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/dashboard.ts src/types/workspace.ts tests/task-ownership-model.test.ts
git commit -m "feat(tasks): add TaskOrigin and GroupedParentTaskView type contracts"
```

---

### Task 2: Core Pure Logic for Task Ownership & 2-Tier Grouping

**Files:**
- Create: `src/lib/task-ownership.ts`
- Test: `tests/task-ownership-model.test.ts`

**Interfaces:**
- Consumes: `SchoolTask`, `StaffTask`, `AuthUser`, `OwnershipRoleFilter`, `GroupedParentTaskView`, `AssigneeWorkloadItem`.
- Produces:
  * `calculateAssigneeWorkloads(subTasks: StaffTask[]): AssigneeWorkloadItem[]`
  * `groupSchoolTasksForWorkspace(tasks: SchoolTask[], user: AuthUser, ownershipFilter?: OwnershipRoleFilter): GroupedParentTaskView[]`
  * `filterGroupedTasks(groups: GroupedParentTaskView[], options: { ownershipFilter: OwnershipRoleFilter; statusFilter?: string; searchTerm?: string }): GroupedParentTaskView[]`

- [ ] **Step 1: Write failing tests for workload aggregation and grouping logic**

Append to `tests/task-ownership-model.test.ts`:
```typescript
import {
  calculateAssigneeWorkloads,
  groupSchoolTasksForWorkspace,
  filterGroupedTasks,
} from "../src/lib/task-ownership";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";

describe("Task Ownership Logic - Workload and Grouping", () => {
  const staffUser: AuthUser = {
    id: "user-huy",
    name: "Đặng Nhật Huy",
    email: "huydn@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên",
    department: "CNTT",
    departmentCode: "CNTT",
  };

  const sampleTasks: SchoolTask[] = [
    {
      id: "school-1",
      title: "Lễ Khai giảng năm học 2026 - 2027",
      category: "TRUYEN_THONG",
      categoryLabel: "Truyền thông",
      leadAssigneeName: "Trần Hùng",
      coAssignees: ["Đặng Nhật Huy", "Mai Thị Xuân", "Lê Văn Anh"],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-07",
      status: "IN_PROGRESS",
      origin: "SCHOOL",
      totalSubTasks: 4,
      completedSubTasks: 2,
      progressPercent: 50,
      subTasks: [
        {
          id: "sub-1",
          title: "Chụp ảnh sự kiện",
          assigneeName: "Đặng Nhật Huy",
          status: "COMPLETED",
          dueDate: "2026-09-05",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-05",
        },
        {
          id: "sub-2",
          title: "Quay phim toàn cảnh",
          assigneeName: "Đặng Nhật Huy",
          status: "IN_PROGRESS",
          dueDate: "2026-09-05",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-05",
        },
        {
          id: "sub-3",
          title: "Thiết kế banner sân khấu",
          assigneeName: "Mai Thị Xuân",
          status: "COMPLETED",
          dueDate: "2026-09-04",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-04",
        },
        {
          id: "sub-4",
          title: "Viết bài đăng website",
          assigneeName: "Mai Thị Xuân",
          status: "IN_PROGRESS",
          dueDate: "2026-09-05",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-05",
        },
      ],
    },
    {
      id: "school-2",
      title: "Xây dựng Sổ tay sinh viên điện tử 2026",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Đặng Nhật Huy",
      coAssignees: ["Trần Hùng"],
      assignedDate: "2026-09-02",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      origin: "SELF_INITIATED",
      totalSubTasks: 2,
      completedSubTasks: 0,
      progressPercent: 0,
      subTasks: [
        {
          id: "sub-5",
          title: "Soạn thảo cấu trúc thông tin",
          assigneeName: "Đặng Nhật Huy",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15",
          parentSchoolTaskId: "school-2",
          updatedAt: "2026-09-02",
        },
        {
          id: "sub-6",
          title: "Duyệt nội dung sư phạm",
          assigneeName: "Trần Hùng",
          status: "IN_PROGRESS",
          dueDate: "2026-09-20",
          parentSchoolTaskId: "school-2",
          updatedAt: "2026-09-02",
        },
      ],
    },
    {
      id: "school-3",
      title: "Kiểm định chất lượng định kỳ",
      category: "BAO_CAO",
      categoryLabel: "Báo cáo",
      leadAssigneeName: "Trần Hùng",
      coAssignees: ["Đặng Nhật Huy"],
      assignedDate: "2026-09-03",
      dueDate: "2026-09-25",
      status: "IN_PROGRESS",
      origin: "SCHOOL",
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 0,
      subTasks: [
        {
          id: "sub-7",
          title: "Tổng hợp biểu mẫu phòng ban",
          assigneeName: "Trần Hùng",
          status: "IN_PROGRESS",
          dueDate: "2026-09-20",
          parentSchoolTaskId: "school-3",
          updatedAt: "2026-09-03",
        },
      ],
    },
  ];

  test("calculateAssigneeWorkloads aggregates task counts per person", () => {
    const workloads = calculateAssigneeWorkloads(sampleTasks[0].subTasks);
    assert.equal(workloads.length, 2);
    
    const huyWork = workloads.find((w) => w.assigneeName === "Đặng Nhật Huy");
    assert.ok(huyWork);
    assert.equal(huyWork.count, 2);
    assert.equal(huyWork.completedCount, 1);

    const maiWork = workloads.find((w) => w.assigneeName === "Mai Thị Xuân");
    assert.ok(maiWork);
    assert.equal(maiWork.count, 2);
    assert.equal(maiWork.completedCount, 1);
  });

  test("groupSchoolTasksForWorkspace correctly groups tasks for staff member", () => {
    const groups = groupSchoolTasksForWorkspace(sampleTasks, staffUser);
    assert.equal(groups.length, 3);

    // Task 1: Huy is participating, has 2 subtasks
    const g1 = groups.find((g) => g.parentTask.id === "school-1");
    assert.ok(g1);
    assert.equal(g1.isLeading, false);
    assert.equal(g1.isParticipating, true);
    assert.equal(g1.isAwaitingAssignment, false);
    assert.equal(g1.userSubTasks.length, 2);
    assert.equal(g1.allSubTasks.length, 4);

    // Task 2: Huy is DRI (leading)
    const g2 = groups.find((g) => g.parentTask.id === "school-2");
    assert.ok(g2);
    assert.equal(g2.isLeading, true);
    assert.equal(g2.isParticipating, false);
    assert.equal(g2.isAwaitingAssignment, false);
    assert.equal(g2.userSubTasks.length, 1);
    assert.equal(g2.allSubTasks.length, 2);
    assert.equal(g2.workloads.length, 2);

    // Task 3: Huy is co-assignee with NO subtasks (Awaiting Assignment)
    const g3 = groups.find((g) => g.parentTask.id === "school-3");
    assert.ok(g3);
    assert.equal(g3.isLeading, false);
    assert.equal(g3.isParticipating, true);
    assert.equal(g3.isAwaitingAssignment, true);
    assert.equal(g3.userSubTasks.length, 0);
  });

  test("filters grouped tasks by LEADING vs PARTICIPATING", () => {
    const allGroups = groupSchoolTasksForWorkspace(sampleTasks, staffUser);

    const leadingOnly = filterGroupedTasks(allGroups, { ownershipFilter: "LEADING" });
    assert.equal(leadingOnly.length, 1);
    assert.equal(leadingOnly[0].parentTask.id, "school-2");

    const participatingOnly = filterGroupedTasks(allGroups, { ownershipFilter: "PARTICIPATING" });
    assert.equal(participatingOnly.length, 2);
    const partIds = participatingOnly.map((g) => g.parentTask.id);
    assert.ok(partIds.includes("school-1"));
    assert.ok(partIds.includes("school-3"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/task-ownership-model.test.ts`
Expected: FAIL with module not found `../src/lib/task-ownership`.

- [ ] **Step 3: Implement `src/lib/task-ownership.ts`**

Create `src/lib/task-ownership.ts`:
```typescript
import { SchoolTask, StaffTask } from "../types/dashboard";
import { AuthUser } from "../types/auth";
import {
  AssigneeWorkloadItem,
  GroupedParentTaskView,
  OwnershipRoleFilter,
} from "../types/workspace";
import { matchesUser } from "./role-task-filter";

/**
 * Calculates workload distribution (total tasks and completed count) per assignee.
 */
export function calculateAssigneeWorkloads(
  subTasks: StaffTask[] = []
): AssigneeWorkloadItem[] {
  const map = new Map<string, { count: number; completedCount: number; assigneeId?: string }>();

  for (const st of subTasks) {
    const key = st.assigneeName.trim();
    if (!key) continue;

    const current = map.get(key) || { count: 0, completedCount: 0, assigneeId: st.assigneeId };
    current.count += 1;
    if (st.status === "COMPLETED") {
      current.completedCount += 1;
    }
    if (st.assigneeId && !current.assigneeId) {
      current.assigneeId = st.assigneeId;
    }
    map.set(key, current);
  }

  return Array.from(map.entries()).map(([assigneeName, data]) => ({
    assigneeName,
    assigneeId: data.assigneeId,
    count: data.count,
    completedCount: data.completedCount,
  }));
}

/**
 * Groups school tasks into 2-tier parent views for a given user.
 */
export function groupSchoolTasksForWorkspace(
  tasks: SchoolTask[] = [],
  user: AuthUser
): GroupedParentTaskView[] {
  if (!tasks || tasks.length === 0 || !user) return [];

  const results: GroupedParentTaskView[] = [];

  for (const task of tasks) {
    const isLeading = matchesUser(task.leadAssigneeName, user);
    const isCoAssignee = Boolean(
      task.coAssignees && task.coAssignees.some((ca) => matchesUser(ca, user))
    );

    const userSubTasks = (task.subTasks || []).filter(
      (st) =>
        (st.assigneeId && st.assigneeId === user.id) ||
        matchesUser(st.assigneeName, user)
    );

    // User is relevant if they are DRI, in coAssignees, or have assigned subtasks
    const isRelevant = isLeading || isCoAssignee || userSubTasks.length > 0;
    if (!isRelevant) continue;

    const isParticipating = !isLeading && (isCoAssignee || userSubTasks.length > 0);
    const isAwaitingAssignment = isParticipating && userSubTasks.length === 0;
    const workloads = calculateAssigneeWorkloads(task.subTasks || []);

    results.push({
      parentTask: task,
      isLeading,
      isParticipating,
      isAwaitingAssignment,
      workloads,
      userSubTasks,
      allSubTasks: task.subTasks || [],
    });
  }

  return results;
}

/**
 * Filters grouped tasks by ownership filter (ALL, LEADING, PARTICIPATING),
 * status filter, and optional search term.
 */
export function filterGroupedTasks(
  groups: GroupedParentTaskView[],
  options: {
    ownershipFilter: OwnershipRoleFilter;
    statusFilter?: string;
    searchTerm?: string;
  }
): GroupedParentTaskView[] {
  const { ownershipFilter, statusFilter, searchTerm } = options;
  const normalizedSearch = searchTerm?.trim().toLowerCase() || "";

  return groups.filter((group) => {
    // 1. Ownership Filter
    if (ownershipFilter === "LEADING" && !group.isLeading) return false;
    if (ownershipFilter === "PARTICIPATING" && !group.isParticipating) return false;

    // 2. Search Term Matching
    if (normalizedSearch) {
      const matchParent =
        group.parentTask.title.toLowerCase().includes(normalizedSearch) ||
        group.parentTask.leadAssigneeName.toLowerCase().includes(normalizedSearch) ||
        group.parentTask.categoryLabel.toLowerCase().includes(normalizedSearch);

      const relevantSubTasks = group.isLeading
        ? group.allSubTasks
        : group.userSubTasks;

      const matchSub = relevantSubTasks.some((st) =>
        st.title.toLowerCase().includes(normalizedSearch) ||
        st.assigneeName.toLowerCase().includes(normalizedSearch)
      );

      if (!matchParent && !matchSub) return false;
    }

    // 3. Status Filter (if provided and not ALL)
    if (statusFilter && statusFilter !== "ALL") {
      if (statusFilter === "COMPLETED") {
        return group.parentTask.status === "COMPLETED";
      }
      if (statusFilter === "IN_PROGRESS") {
        return group.parentTask.status === "IN_PROGRESS";
      }
      // If filtering by subtask criteria like NEEDS_REVIEW, check relevant subtasks
      const relevantSubTasks = group.isLeading
        ? group.allSubTasks
        : group.userSubTasks;
      return relevantSubTasks.some((st) => st.status === statusFilter);
    }

    return true;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/task-ownership-model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/task-ownership.ts tests/task-ownership-model.test.ts
git commit -m "feat(tasks): implement pure task ownership grouping and workload calculation"
```

---

### Task 3: Update Role-Based Filtering for DRI & Co-Assignee Visibility

**Files:**
- Modify: `src/lib/role-task-filter.ts:79-102`
- Test: `tests/task-ownership-model.test.ts`

**Interfaces:**
- Consumes: `SchoolTask`, `AuthUser`, `matchesUser`.
- Produces: Updated `filterTasksByRole` maintaining DRI full-task visibility and co-assignee "chờ phân công" visibility for `STAFF`.

- [ ] **Step 1: Write failing test for STAFF DRI and Co-Assignee retention in `filterTasksByRole`**

Append to `tests/task-ownership-model.test.ts`:
```typescript
import { filterTasksByRole } from "../src/lib/role-task-filter";

describe("Role Task Filter - STAFF DRI and Co-Assignee Support", () => {
  const staffMember: AuthUser = {
    id: "user-vinh",
    name: "Nguyễn Ngọc Vinh",
    email: "vinhnn@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên CNTT",
    department: "Khoa CNTT",
    departmentCode: "CNTT",
  };

  const tasksList: SchoolTask[] = [
    // Task where Vinh is DRI (leadAssigneeName), with team members doing subtasks
    {
      id: "task-vinh-dri",
      title: "Triển khai hệ thống E-Office",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Nguyễn Ngọc Vinh",
      coAssignees: ["Trần Hùng"],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      origin: "SELF_INITIATED",
      totalSubTasks: 2,
      completedSubTasks: 1,
      progressPercent: 50,
      subTasks: [
        {
          id: "sub-t1",
          title: "Cấu hình Server",
          assigneeName: "Trần Hùng",
          status: "COMPLETED",
          dueDate: "2026-09-10",
          parentSchoolTaskId: "task-vinh-dri",
          updatedAt: "2026-09-05",
        },
        {
          id: "sub-t2",
          title: "Kiểm thử bảo mật",
          assigneeName: "Trần Hùng",
          status: "IN_PROGRESS",
          dueDate: "2026-09-20",
          parentSchoolTaskId: "task-vinh-dri",
          updatedAt: "2026-09-05",
        },
      ],
    },
    // Task where Vinh is co-assignee, but no sub-task assigned yet
    {
      id: "task-vinh-coassignee",
      title: "Chuẩn bị Đại hội Đoàn trường",
      category: "KHAC",
      categoryLabel: "Khác",
      leadAssigneeName: "Trần Hùng",
      coAssignees: ["Nguyễn Ngọc Vinh"],
      assignedDate: "2026-09-05",
      dueDate: "2026-09-28",
      status: "IN_PROGRESS",
      origin: "SCHOOL",
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 0,
      subTasks: [
        {
          id: "sub-t3",
          title: "Soạn văn kiện",
          assigneeName: "Trần Hùng",
          status: "IN_PROGRESS",
          dueDate: "2026-09-20",
          parentSchoolTaskId: "task-vinh-coassignee",
          updatedAt: "2026-09-05",
        },
      ],
    },
  ];

  test("STAFF sees tasks where they are DRI (retaining all subtasks for coordination)", () => {
    const filtered = filterTasksByRole(tasksList, staffMember);
    const driTask = filtered.find((t) => t.id === "task-vinh-dri");
    assert.ok(driTask, "STAFF must see task where they are leadAssigneeName (DRI)");
    assert.equal(driTask.subTasks.length, 2, "DRI must retain all subtasks for coordination");
  });

  test("STAFF sees tasks where they are in coAssignees even with zero assigned subtasks", () => {
    const filtered = filterTasksByRole(tasksList, staffMember);
    const coTask = filtered.find((t) => t.id === "task-vinh-coassignee");
    assert.ok(coTask, "STAFF must see task where they are in coAssignees");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/task-ownership-model.test.ts`
Expected: FAIL because `filterTasksByRole` currently filters out any task where `userSubTasks.length === 0`.

- [ ] **Step 3: Update `filterTasksByRole` in `src/lib/role-task-filter.ts`**

Edit `src/lib/role-task-filter.ts`:
```typescript
  // STAFF role:
  // 1. If staff is DRI (leadAssigneeName), they see the task with all subtasks for coordination.
  // 2. If staff is coAssignee without subtasks, they see the task in observing/awaiting assignment mode.
  // 3. If staff has assigned subtasks, they see the task filtered down to their subtasks.
  const result: SchoolTask[] = [];
  for (const task of tasks) {
    const isLead = matchesUser(task.leadAssigneeName, user);
    const isCoAssignee = Boolean(
      task.coAssignees && task.coAssignees.some((ca) => matchesUser(ca, user))
    );
    const userSubTasks = (task.subTasks || []).filter((sub) =>
      matchesUser(sub.assigneeName, user)
    );

    if (isLead) {
      // DRI retains full task with all subtasks
      result.push({ ...task });
    } else if (userSubTasks.length > 0) {
      // Participant with assigned subtasks: filtered to user's subtasks, with recalculated rollup
      const totalSubTasks = userSubTasks.length;
      const completedSubTasks = userSubTasks.filter(
        (st) => st.status === "COMPLETED"
      ).length;
      const progressPercent =
        totalSubTasks > 0
          ? Math.round((completedSubTasks / totalSubTasks) * 100)
          : task.status === "COMPLETED"
          ? 100
          : 0;

      result.push({
        ...task,
        subTasks: userSubTasks,
        totalSubTasks,
        completedSubTasks,
        progressPercent,
      });
    } else if (isCoAssignee) {
      // Co-assignee awaiting assignment: preserve task with empty subtasks for staff view
      result.push({
        ...task,
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: task.status === "COMPLETED" ? 100 : 0,
      });
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/task-ownership-model.test.ts`
Expected: PASS

Run all existing tests: `npm test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/role-task-filter.ts tests/task-ownership-model.test.ts
git commit -m "fix(filter): allow STAFF to see tasks as DRI and observing co-assignees"
```

---

### Task 4: Enrich Mock Data with Task Origin & Multi-Subtask Ownership

**Files:**
- Modify: `src/lib/mock-dashboard-data.ts:67-170`
- Test: `tests/task-ownership-model.test.ts`

**Interfaces:**
- Consumes: `SchoolTask`, `SeedTaskDefinition`, `TaskOrigin`.
- Produces: Mock data containing `origin: 'SCHOOL'` and `origin: 'SELF_INITIATED'`, with realistic cases of:
  * 1 DRI with multiple subtasks assigned to the same person (e.g. 2 photo/video tasks to 1 staff).
  * 1 person in `coAssignees` waiting for assignment.

- [ ] **Step 1: Write test verifying mock data contains `origin` and multi-subtask assignment**

Append to `tests/task-ownership-model.test.ts`:
```typescript
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";

describe("Mock Dashboard Data - Origin and Ownership Cases", () => {
  test("mock payload includes both SCHOOL and SELF_INITIATED tasks", () => {
    const payload = getMockDashboardPayload();
    const schoolOrigins = payload.schoolTasks.map((t) => t.origin || "SCHOOL");

    assert.ok(schoolOrigins.includes("SCHOOL"), "Must contain SCHOOL origin tasks");
    assert.ok(schoolOrigins.includes("SELF_INITIATED"), "Must contain SELF_INITIATED origin tasks");
  });

  test("mock payload contains a task with multiple subtasks assigned to the same individual", () => {
    const payload = getMockDashboardPayload();
    const hasMultipleSubTasksForSamePerson = payload.schoolTasks.some((task) => {
      const counts: Record<string, number> = {};
      for (const st of task.subTasks) {
        counts[st.assigneeName] = (counts[st.assigneeName] || 0) + 1;
        if (counts[st.assigneeName] > 1) return true;
      }
      return false;
    });

    assert.equal(hasMultipleSubTasksForSamePerson, true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/task-ownership-model.test.ts`
Expected: FAIL on missing `SELF_INITIATED` tasks in mock data.

- [ ] **Step 3: Update `src/lib/mock-dashboard-data.ts`**

In `src/lib/mock-dashboard-data.ts`:
1. Add `origin?: TaskOrigin;` to `SeedTaskDefinition`.
2. Explicitly assign `origin: 'SCHOOL'` to default institutional tasks.
3. Add a realistic `SELF_INITIATED` task, for example:
```typescript
  {
    title: "Xây dựng Sổ tay sinh viên điện tử năm 2026",
    category: "CHUYEN_DOI_SO",
    leadName: "Nguyễn Ngọc Vinh",
    coAssignees: ["Trần Hùng", "Mai Đinh Thị Xuân"],
    assignedDate: "2026-09-02",
    dueDate: "2026-09-30",
    origin: "SELF_INITIATED",
    subTaskTitles: [
      {
        title: "Thu thập tài liệu và quy chế đào tạo mới",
        assigneeName: "Nguyễn Ngọc Vinh",
        status: "COMPLETED",
        dueDate: "2026-09-10",
      },
      {
        title: "Thiết kế giao diện tra cứu trên Zalo Mini App",
        assigneeName: "Nguyễn Ngọc Vinh",
        status: "IN_PROGRESS",
        dueDate: "2026-09-20",
      },
      {
        title: "Soạn thảo nội dung chuyên mục Đoàn - Hội",
        assigneeName: "Mai Đinh Thị Xuân",
        status: "IN_PROGRESS",
        dueDate: "2026-09-22",
      },
    ],
  },
```
4. Map `origin: seed.origin || "SCHOOL"` into the resulting `SchoolTask` objects in `getMockDashboardPayload()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/task-ownership-model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock-dashboard-data.ts tests/task-ownership-model.test.ts
git commit -m "feat(mock): add SELF_INITIATED tasks and multi-subtask assignment examples"
```

---

### Task 5: 2-Tier Workspace Component in `LecturerFocusWorkspace`

**Files:**
- Modify: `src/components/portal/lecturer-focus-workspace.tsx`
- Test: `tests/task-ownership-model.test.ts`

**Interfaces:**
- Consumes: `groupSchoolTasksForWorkspace`, `filterGroupedTasks`, `GroupedParentTaskView`, `OwnershipRoleFilter`.
- Produces:
  * Segmented tabs: "Tất cả công việc", "Tôi chủ trì (DRI)", "Tôi tham gia (Phối hợp)".
  * 2-Tier card rendering:
    - Tier 1: Parent task card header with Category, DRI info, Progress bar, Due date badge, Origin badge (`Tự khởi xướng` vs `BGH giao`).
    - DRI Workload Breakdown: Chips showing `[Người]: [N] việc` for fast coordination.
    - Tier 2: Subtasks list grouped cleanly underneath the parent header.
    - If user is co-assignee with 0 subtasks: render "Chờ phân công nhiệm vụ cụ thể" notification block.
  * Preserves existing submit deliverable modals and quick status change actions.

- [ ] **Step 1: Write test verifying static rendering of 2-tier cards and workload badges**

Append to `tests/task-ownership-model.test.ts`:
```typescript
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LecturerFocusWorkspace } from "../src/components/portal/lecturer-focus-workspace";

describe("LecturerFocusWorkspace - 2-Tier Rendering and Workload Badges", () => {
  const mockUser: AuthUser = {
    id: "user-huy",
    name: "Đặng Nhật Huy",
    email: "huydn@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên CNTT",
    department: "Khoa CNTT",
    departmentCode: "CNTT",
  };

  const tasks: SchoolTask[] = [
    {
      id: "school-100",
      title: "Lễ Khai giảng năm học 2026 - 2027",
      category: "TRUYEN_THONG",
      categoryLabel: "Truyền thông",
      leadAssigneeName: "Trần Hùng",
      coAssignees: ["Đặng Nhật Huy"],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-07",
      status: "IN_PROGRESS",
      origin: "SCHOOL",
      totalSubTasks: 2,
      completedSubTasks: 1,
      progressPercent: 50,
      subTasks: [
        {
          id: "sub-101",
          title: "Chụp ảnh sự kiện",
          assigneeName: "Đặng Nhật Huy",
          status: "COMPLETED",
          dueDate: "2026-09-05",
          parentSchoolTaskId: "school-100",
          updatedAt: "2026-09-05",
        },
        {
          id: "sub-102",
          title: "Quay phim bế mạc",
          assigneeName: "Đặng Nhật Huy",
          status: "IN_PROGRESS",
          dueDate: "2026-09-05",
          parentSchoolTaskId: "school-100",
          updatedAt: "2026-09-05",
        },
      ],
    },
    {
      id: "school-200",
      title: "Sổ tay sinh viên điện tử",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Đặng Nhật Huy",
      coAssignees: ["Mai Thị Xuân"],
      assignedDate: "2026-09-02",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      origin: "SELF_INITIATED",
      totalSubTasks: 2,
      completedSubTasks: 0,
      progressPercent: 0,
      subTasks: [
        {
          id: "sub-201",
          title: "Soạn cấu trúc tài liệu",
          assigneeName: "Đặng Nhật Huy",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15",
          parentSchoolTaskId: "school-200",
          updatedAt: "2026-09-02",
        },
        {
          id: "sub-202",
          title: "Biên tập mỹ thuật",
          assigneeName: "Mai Thị Xuân",
          status: "IN_PROGRESS",
          dueDate: "2026-09-20",
          parentSchoolTaskId: "school-200",
          updatedAt: "2026-09-02",
        },
      ],
    },
  ];

  test("renders 2-tier parent header and subtasks under single container", () => {
    const html = renderToStaticMarkup(
      React.createElement(LecturerFocusWorkspace, {
        user: mockUser,
        tasks: tasks,
        referenceDate: "2026-09-06",
      })
    );

    // Verifies Parent Task Title is present
    assert.ok(html.includes("Lễ Khai giảng năm học 2026 - 2027"));
    assert.ok(html.includes("Sổ tay sinh viên điện tử"));

    // Verifies Sub-tasks are rendered
    assert.ok(html.includes("Chụp ảnh sự kiện"));
    assert.ok(html.includes("Quay phim bế mạc"));

    // Verifies Segmented Ownership filters
    assert.ok(html.includes("Tôi chủ trì") || html.includes("Chủ trì"));
    assert.ok(html.includes("Tôi tham gia") || html.includes("Tham gia"));

    // Verifies origin badge
    assert.ok(html.includes("Tự khởi xướng") || html.includes("Cá nhân đề xuất"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/task-ownership-model.test.ts`
Expected: FAIL because `LecturerFocusWorkspace` does not yet render ownership tabs or 2-tier parent containers.

- [ ] **Step 3: Update `src/components/portal/lecturer-focus-workspace.tsx`**

1. Import `groupSchoolTasksForWorkspace`, `filterGroupedTasks`, `calculateAssigneeWorkloads` from `@/lib/task-ownership`.
2. Add `ownershipFilter` state (`'ALL' | 'LEADING' | 'PARTICIPATING'`).
3. Compute `groupedTasks = React.useMemo(() => groupSchoolTasksForWorkspace(tasks, user), [tasks, user])`.
4. Filter grouped tasks using `filterGroupedTasks(groupedTasks, { ownershipFilter, statusFilter: activeFilter, searchTerm })`.
5. Render Ownership Segmented Control (Tabs) right above or next to the status filters:
   - "Tất cả" (count)
   - "Tôi chủ trì (DRI)" (count of `g.isLeading`)
   - "Tôi tham gia" (count of `g.isParticipating`)
6. In the task list area, map over `filteredGroupedTasks`:
   - Render **Tier 1 (Nhiệm vụ cha / Hoạt động chung)**:
     * Header with Parent title, Category label, DRI indicator (`Chủ trì: [leadAssigneeName]`), Due date badge, and Progress bar.
     * If `origin === 'SELF_INITIATED'`: display badge "Tự khởi xướng" (`border-amber-500/30 text-amber-700 bg-amber-500/10`).
     * If user is DRI: display Workload Summary Chips: `workloads.map(w => w.assigneeName + " (" + w.count + " việc)")`.
   - Render **Tier 2 (Danh sách công việc chi tiết)**:
     * If `group.isAwaitingAssignment`: Render a compact card with an alert icon: "Bạn đang trong danh sách phối hợp. Đang chờ người chủ trì phân công công việc chi tiết."
     * Else: Render sub-tasks belonging to user (or all sub-tasks if user is DRI). Keep existing Deliverable submission button, rejection alert, and status badge.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/task-ownership-model.test.ts`
Expected: PASS

Run all workspace tests:
`npm test`
Expected: ALL PASS

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/portal/lecturer-focus-workspace.tsx tests/task-ownership-model.test.ts
git commit -m "feat(portal): implement 2-tier workspace with ownership segmentation and DRI workload visibility"
```

---

### Task 6: Visual Preview & Verification Audit

**Files:**
- Test: `tests/task-ownership-model.test.ts`
- Verification: `npm run typecheck`, `npm test`

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All suites green.

- [ ] **Step 2: Run strict anti-slop audit for zero emojis**

Run:
```bash
node -e '
const fs = require("fs");
const files = [
  "src/types/dashboard.ts",
  "src/types/workspace.ts",
  "src/lib/task-ownership.ts",
  "src/lib/role-task-filter.ts",
  "src/lib/mock-dashboard-data.ts",
  "src/components/portal/lecturer-focus-workspace.tsx",
  "tests/task-ownership-model.test.ts"
];
const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
let found = 0;
files.forEach(f => {
  if (!fs.existsSync(f)) return;
  const content = fs.readFileSync(f, "utf-8");
  content.split("\n").forEach((line, idx) => {
    if (emojiRegex.test(line)) {
      console.error(`Emoji violation in ${f}:${idx+1}: ${line.trim()}`);
      found++;
    }
  });
});
if (found > 0) process.exit(1);
console.log("Anti-slop audit passed: 0 emojis found.");
'
```
Expected: "Anti-slop audit passed: 0 emojis found."

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "chore(audit): verify zero-emoji compliance and full test suite green for task ownership model"
```
