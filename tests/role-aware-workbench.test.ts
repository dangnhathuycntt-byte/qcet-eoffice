import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SmartWorkbox,
  computeSmartWorkboxCounts,
  getSmartWorkboxNavigationUrl,
} from "../src/components/workspace/smart-workbox";
import {
  PersonalWorkbench,
  buildRoleAttentionQueue,
  computeStaffWorkloadDistribution,
} from "../src/components/dashboard/personal-workbench";
import type { SchoolTask } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";
import { getSystemReferenceDateStr } from "../src/lib/unified-task-hub";

// Mock reference date (2026-09-06 is standard QCET reference date)
const REF_DATE = getSystemReferenceDateStr(); // "2026-09-06"

// Sample Mock Tasks
const mockTasks: SchoolTask[] = [
  {
    id: "task-overdue-staff",
    code: "NV-001",
    title: "Nộp báo cáo rà soát chuẩn đầu ra",
    description: "Rà soát đề cương chi tiết môn học",
    status: "IN_PROGRESS",
    priority: "URGENT",
    dueDate: "2026-09-04", // Past due relative to 2026-09-06
    leadAssigneeName: "Trần Thị Lan",
    assignedTo: "Trần Thị Lan",
    department: "Khoa CNTT",
    departmentCode: "CNTT",
    progressPercent: 40,
    academicMonth: 9,
    subTasks: [],
  },
  {
    id: "task-today-staff",
    code: "NV-002",
    title: "Cập nhật hệ thống học liệu số",
    description: "Tải bài giảng lên hệ thống LMS",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueDate: "2026-09-06", // Due today
    leadAssigneeName: "Trần Thị Lan",
    assignedTo: "Trần Thị Lan",
    department: "Khoa CNTT",
    departmentCode: "CNTT",
    progressPercent: 70,
    academicMonth: 9,
    subTasks: [],
  },
  {
    id: "task-waiting-review-staff",
    code: "NV-003",
    title: "Minh chứng tổ chức hội thảo AI",
    description: "Hồ sơ thanh quyết toán và biên bản hội thảo",
    status: "WAITING_APPROVAL",
    priority: "NORMAL",
    dueDate: "2026-09-10",
    leadAssigneeName: "Trần Thị Lan",
    assignedTo: "Trần Thị Lan",
    department: "Khoa CNTT",
    departmentCode: "CNTT",
    progressPercent: 90,
    academicMonth: 9,
    subTasks: [],
  },
  {
    id: "task-manager-approval",
    code: "NV-004",
    title: "Đề xuất mua sắm trang thiết bị Lab viễn thông",
    description: "Danh mục thiết bị thực hành mạng",
    status: "WAITING_APPROVAL",
    priority: "URGENT",
    dueDate: "2026-09-08",
    leadAssigneeName: "Nguyễn Văn Hùng",
    assignedTo: "Nguyễn Văn Hùng",
    department: "Khoa CNTT",
    departmentCode: "CNTT",
    progressPercent: 85,
    academicMonth: 9,
    subTasks: [],
  },
  {
    id: "task-executive-approval",
    code: "NV-005",
    title: "Kế hoạch chiến lược chuyển đổi số toàn trường 2026-2030",
    description: "Tờ trình phê duyệt đề án số hóa đào tạo",
    status: "PENDING_EXECUTIVE_APPROVAL",
    priority: "URGENT",
    dueDate: "2026-09-15",
    leadAssigneeName: "Lê Hoàng Nam",
    assignedTo: "Lê Hoàng Nam",
    department: "Trung tâm CNTT & TT",
    departmentCode: "TT_CNTT",
    progressPercent: 95,
    academicMonth: 9,
    subTasks: [],
  },
  {
    id: "task-completed",
    code: "NV-006",
    title: "Tổng kết công tác tuyển sinh đợt 1",
    description: "Báo cáo số liệu trúng tuyển",
    status: "COMPLETED",
    priority: "NORMAL",
    dueDate: "2026-09-02",
    leadAssigneeName: "Trần Thị Lan",
    assignedTo: "Trần Thị Lan",
    department: "Khoa CNTT",
    departmentCode: "CNTT",
    progressPercent: 100,
    academicMonth: 9,
    subTasks: [],
  },
] as unknown as SchoolTask[];

// Mock Users
const staffUser: AuthUser = {
  id: "usr-staff",
  name: "Trần Thị Lan",
  email: "lan.tt@qcet.edu.vn",
  role: "STAFF",
  roleLabel: "Giảng viên",
  department: "Khoa CNTT",
  departmentCode: "CNTT",
};

const managerUser: AuthUser = {
  id: "usr-manager",
  name: "Phạm Văn Minh",
  email: "minh.pv@qcet.edu.vn",
  role: "MANAGER",
  roleLabel: "Trưởng khoa",
  department: "Khoa CNTT",
  departmentCode: "CNTT",
};

const executiveUser: AuthUser = {
  id: "usr-exec",
  name: "GS.TS Nguyễn Văn Hiệu",
  email: "hieu.nv@qcet.edu.vn",
  role: "ADMIN",
  roleLabel: "Hiệu trưởng",
  department: "Ban Giám hiệu",
  departmentCode: "BGH",
};

describe("Role-Aware Home Workbench & Smart Workbox (Phase 7)", () => {
  describe("1. Smart Workbox Pure Counts Computation", () => {
    test("computeSmartWorkboxCounts accurately calculates counters for Staff user", () => {
      const counts = computeSmartWorkboxCounts({
        tasks: mockTasks,
        user: staffUser,
        roleScope: "my",
        referenceDate: REF_DATE,
      });

      // Staff user has 3 active tasks: task-overdue-staff, task-today-staff, task-waiting-review-staff (task-completed is excluded)
      assert.equal(counts.myCount, 3, "Staff active tasks count must be 3");
      // 1 task waiting review submitted by staff
      assert.equal(counts.waitingApprovalCount, 1, "Staff awaiting review count must be 1");
      // 2 in-progress tasks waiting submission (NV-001 and NV-002)
      assert.equal(counts.pendingSubmissionCount, 2, "Staff pending submission count must be 2");
      // 1 task overdue (NV-001 due 2026-09-04)
      assert.equal(counts.overdueCount, 1, "Staff overdue count must be 1");
    });

    test("computeSmartWorkboxCounts accurately calculates counters for Manager user in unit", () => {
      const counts = computeSmartWorkboxCounts({
        tasks: mockTasks,
        user: managerUser,
        roleScope: "unit",
        referenceDate: REF_DATE,
      });

      // Unit CNTT has tasks: NV-001, NV-002, NV-003, NV-004 active (NV-006 completed)
      assert.ok(counts.myCount >= 4, "Manager unit active tasks count must include unit tasks");
      // Unit has 2 tasks waiting approval: NV-003 and NV-004
      assert.equal(counts.waitingApprovalCount, 2, "Manager unit waiting approval count must be 2");
      // Unit has 1 overdue task: NV-001
      assert.equal(counts.overdueCount, 1, "Manager unit overdue count must be 1");
    });

    test("computeSmartWorkboxCounts accurately calculates counters for Executive user", () => {
      const counts = computeSmartWorkboxCounts({
        tasks: mockTasks,
        user: executiveUser,
        roleScope: "school",
        referenceDate: REF_DATE,
      });

      // Executive waiting approval: includes NV-003, NV-004, NV-005 (total 3)
      assert.equal(counts.waitingApprovalCount, 3, "Executive school-wide waiting approval count must be 3");
      // School overdue: NV-001 is overdue
      assert.equal(counts.overdueCount, 1, "School-wide overdue count must be 1");
    });
  });

  describe("2. Smart Workbox Navigation URLs", () => {
    test("getSmartWorkboxNavigationUrl generates correct pre-filtered URLs for all 4 filters", () => {
      // 1. My tasks
      const myUrl = getSmartWorkboxNavigationUrl("my", "my");
      assert.equal(myUrl, "/tasks?scope=my&status=my");

      // 2. Waiting approval
      const approvalUrlStaff = getSmartWorkboxNavigationUrl("waiting_approval", "my");
      assert.equal(approvalUrlStaff, "/tasks?scope=my&status=waiting_approval&workbox=review");

      const approvalUrlManager = getSmartWorkboxNavigationUrl("waiting_approval", "unit", "CNTT");
      assert.equal(approvalUrlManager, "/tasks?scope=unit&status=waiting_approval&workbox=review&dept=CNTT");

      const approvalUrlExec = getSmartWorkboxNavigationUrl("waiting_approval", "school");
      assert.equal(approvalUrlExec, "/tasks?scope=school&status=waiting_approval&workbox=review");

      // 3. Pending submission
      const subUrl = getSmartWorkboxNavigationUrl("pending_submission", "unit", "CNTT");
      assert.equal(subUrl, "/tasks?scope=unit&status=pending_submission&workbox=pending_submission&dept=CNTT");

      // 4. Overdue
      const overdueUrl = getSmartWorkboxNavigationUrl("overdue", "my");
      assert.equal(overdueUrl, "/tasks?scope=my&status=overdue&workbox=overdue");
    });
  });

  describe("3. Role-Aware Attention Queue Priorities", () => {
    test("Staff Attention Queue prioritizes overdue tasks first, then tasks due today", () => {
      const queue = buildRoleAttentionQueue({
        tasks: mockTasks,
        user: staffUser,
        role: "STAFF",
        referenceDate: REF_DATE,
        limit: 7,
      });

      assert.ok(queue.length > 0, "Staff attention queue must not be empty");
      assert.ok(queue.length <= 7, "Staff attention queue must cap at 7 items");
      // First item must be the overdue task (NV-001)
      assert.equal(queue[0].id, "task-overdue-staff");
      assert.equal(queue[0].actionType, "OVERDUE");
      // Second item must be the task due today (NV-002)
      assert.equal(queue[1].id, "task-today-staff");
      assert.equal(queue[1].actionType, "TODAY");
      // Completed tasks must be excluded
      assert.equal(queue.some((item: any) => item.id === "task-completed"), false);
    });

    test("Manager Attention Queue prioritizes pending unit approvals (L1 sign-off)", () => {
      const queue = buildRoleAttentionQueue({
        tasks: mockTasks,
        user: managerUser,
        role: "MANAGER",
        referenceDate: REF_DATE,
        limit: 7,
      });

      assert.ok(queue.length > 0, "Manager attention queue must not be empty");
      // First items should include waiting approval (NV-004 or NV-003) or overdue (NV-001)
      const approvalItems = queue.filter((item: any) => item.actionType === "APPROVAL");
      assert.ok(approvalItems.length >= 1, "Must contain approval items for manager");
      assert.ok(approvalItems.some((item: any) => item.id === "task-manager-approval"));
    });

    test("Executive Attention Queue prioritizes school-wide approvals and critical roadblocks", () => {
      const queue = buildRoleAttentionQueue({
        tasks: mockTasks,
        user: executiveUser,
        role: "EXECUTIVE",
        referenceDate: REF_DATE,
        limit: 7,
      });

      assert.ok(queue.length > 0, "Executive attention queue must not be empty");
      // Must contain executive approval item NV-005
      const execApproval = queue.find((item: any) => item.id === "task-executive-approval");
      assert.ok(execApproval, "Must find task-executive-approval in executive attention queue");
      assert.equal(execApproval?.actionType, "APPROVAL");
    });
  });

  describe("4. Staff Workload Distribution for Manager", () => {
    test("computeStaffWorkloadDistribution groups unit tasks by assignee accurately", () => {
      const workload = computeStaffWorkloadDistribution({
        tasks: mockTasks,
        departmentCode: "CNTT",
        referenceDate: REF_DATE,
      });

      assert.ok(Array.isArray(workload), "Must return an array of workload items");
      const lanWorkload = workload.find((w) => w.name === "Trần Thị Lan");
      assert.ok(lanWorkload, "Must find workload for Trần Thị Lan");
      assert.equal(lanWorkload?.totalTasks, 4); // NV-001, NV-002, NV-003, NV-006
      assert.equal(lanWorkload?.overdueTasks, 1); // NV-001
      assert.equal(lanWorkload?.completedTasks, 1); // NV-006
      assert.equal(lanWorkload?.inProgressTasks, 2); // NV-001, NV-002 (NV-003 is WAITING_APPROVAL)
    });
  });

  describe("5. Smart Workbox & Personal Workbench Component Rendering", () => {
    test("SmartWorkbox renders 4 counter cards with tabular-nums and proper links", () => {
      const html = renderToStaticMarkup(
        React.createElement(SmartWorkbox, {
          tasks: mockTasks,
          user: staffUser,
          roleScope: "my",
          referenceDate: REF_DATE,
        })
      );

      assert.ok(html.includes("Của tôi"), "Must render Của tôi card");
      assert.ok(html.includes("Chờ tôi duyệt"), "Must render Chờ tôi duyệt card");
      assert.ok(html.includes("Chờ nộp báo cáo"), "Must render Chờ nộp báo cáo card");
      assert.ok(html.includes("Quá hạn"), "Must render Quá hạn card");
      assert.ok(html.includes("font-mono"), "Must use font-mono for counts");
      assert.ok(html.includes("tabular-nums"), "Must use tabular-nums for counts");
      assert.ok(html.includes("/tasks?scope=my"), "Must link to /tasks");
    });

    test("PersonalWorkbench renders unified role-aware layout for Staff, Manager, and Executive", () => {
      // Staff view
      const staffHtml = renderToStaticMarkup(
        React.createElement(PersonalWorkbench, {
          tasks: mockTasks,
          user: staffUser,
          role: "STAFF",
          referenceDate: REF_DATE,
        })
      );
      assert.ok(staffHtml.includes("Bàn làm việc Cá nhân"), "Staff view must show personal role badge");
      assert.ok(staffHtml.includes("data-slot=\"personal-workbench\""), "Must have personal-workbench slot");
      assert.ok(staffHtml.includes("CẦN XỬ LÝ"), "Must have ACTION-first attention queue heading");

      // Manager view
      const managerHtml = renderToStaticMarkup(
        React.createElement(PersonalWorkbench, {
          tasks: mockTasks,
          user: managerUser,
          role: "MANAGER",
          referenceDate: REF_DATE,
        })
      );
      assert.ok(managerHtml.includes("Bàn làm việc Quản lý"), "Manager view must show manager role badge");
      assert.ok(managerHtml.includes("Phân bổ công việc nhân sự") || managerHtml.includes("Trần Thị Lan"), "Manager view must include staff workload section");

      // Executive view
      const execHtml = renderToStaticMarkup(
        React.createElement(PersonalWorkbench, {
          tasks: mockTasks,
          user: executiveUser,
          role: "EXECUTIVE",
          referenceDate: REF_DATE,
        })
      );
      assert.ok(execHtml.includes("Bàn làm việc Điều hành"), "Executive view must show executive role badge");
    });

    test("Anti-slop & Light-Only Standard invariants: 0 dark: classes and 0 decorative emojis", () => {
      const html = renderToStaticMarkup(
        React.createElement(PersonalWorkbench, {
          tasks: mockTasks,
          user: managerUser,
          role: "MANAGER",
          referenceDate: REF_DATE,
        })
      );

      assert.equal(html.includes("dark:"), false, "Must not contain dark: classes");
      // Check for common decorative emojis
      const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
      assert.equal(emojiPattern.test(html), false, "Must not contain decorative emojis");
    });
  });
});
