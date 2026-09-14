import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { SchoolTask } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";
import { computeDashboardStats } from "../src/lib/dashboard-aggregator";
import { computeExecutiveActionStats } from "../src/lib/executive-matrix-aggregator";
import { getStatCardData, getExecutiveStatCardData } from "../src/components/dashboard/executive-stat-strip";
import { computeSmartWorkboxCounts } from "../src/lib/workspace-metrics-aggregator";
import { getSystemReferenceDateStr } from "../src/lib/unified-task-hub";

const REF_DATE = getSystemReferenceDateStr(); // "2026-09-06"

const mockSchoolTasks: SchoolTask[] = [
  {
    id: "task-01",
    code: "NV-001",
    title: "Nhiệm vụ 1: Chờ phê duyệt toàn trường",
    status: "WAITING_APPROVAL",
    priority: "URGENT",
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
    id: "task-02",
    code: "NV-002",
    title: "Nhiệm vụ 2: Quá hạn thực hiện",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dueDate: "2026-09-04", // Past due relative to 2026-09-06
    leadAssigneeName: "Nguyễn Văn Hùng",
    assignedTo: "Nguyễn Văn Hùng",
    department: "Khoa CNTT",
    departmentCode: "CNTT",
    progressPercent: 30,
    academicMonth: 9,
    subTasks: [],
  },
  {
    id: "task-03",
    code: "NV-003",
    title: "Nhiệm vụ 3: Đang thực hiện bình thường",
    status: "IN_PROGRESS",
    priority: "NORMAL",
    dueDate: "2026-09-20",
    leadAssigneeName: "Lê Hoàng Nam",
    assignedTo: "Lê Hoàng Nam",
    department: "Trung tâm CNTT & TT",
    departmentCode: "TT_CNTT",
    progressPercent: 50,
    academicMonth: 9,
    subTasks: [],
  },
  {
    id: "task-04",
    code: "NV-004",
    title: "Nhiệm vụ 4: Đã hoàn tất",
    status: "COMPLETED",
    priority: "NORMAL",
    dueDate: "2026-09-01",
    leadAssigneeName: "Trần Thị Lan",
    assignedTo: "Trần Thị Lan",
    department: "Khoa CNTT",
    departmentCode: "CNTT",
    progressPercent: 100,
    academicMonth: 9,
    subTasks: [],
  },
] as unknown as SchoolTask[];

const executiveUser: AuthUser = {
  id: "usr-exec",
  name: "Hiệu trưởng",
  email: "hieutruong@qcet.edu.vn",
  role: "ADMIN",
  roleLabel: "Hiệu trưởng",
  department: "Ban Giám hiệu",
  departmentCode: "BGH",
};

describe("Phase 5 & Phase 6 Audit Verification", () => {
  describe("1. Metric Parity Between ExecutiveStatStrip and SmartWorkbox", () => {
    test("Executive scope: Waiting Approval count matches between ExecutiveStatStrip and SmartWorkbox", () => {
      const stats = computeDashboardStats(mockSchoolTasks);
      const executiveStats = computeExecutiveActionStats(mockSchoolTasks, REF_DATE);
      const cards = getExecutiveStatCardData(stats, executiveStats);

      const pendingApprovalCard = cards.find((c) => c.id === "pending-approval");
      assert.ok(pendingApprovalCard, "pending-approval card must exist in executive strip");
      assert.equal(pendingApprovalCard.value, "1", "ExecutiveStatStrip shows 1 pending approval");

      const smartCounts = computeSmartWorkboxCounts({
        tasks: mockSchoolTasks,
        user: executiveUser,
        roleScope: "school",
        referenceDate: REF_DATE,
      });

      assert.equal(
        smartCounts.waitingApprovalCount,
        Number(pendingApprovalCard.value),
        "SmartWorkbox waitingApprovalCount must match ExecutiveStatStrip pending approval card value"
      );
    });

    test("Executive scope: Overdue counts align between ExecutiveStatStrip and SmartWorkbox", () => {
      const executiveStats = computeExecutiveActionStats(mockSchoolTasks, REF_DATE);
      const smartCounts = computeSmartWorkboxCounts({
        tasks: mockSchoolTasks,
        user: executiveUser,
        roleScope: "school",
        referenceDate: REF_DATE,
      });

      assert.equal(
        smartCounts.overdueCount,
        executiveStats.overdueTasksCount,
        "SmartWorkbox overdueCount must match ExecutiveActionStats overdueTasksCount"
      );
    });
  });
});
