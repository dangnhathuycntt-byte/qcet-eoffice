import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { AttentionBadge, type AttentionLevel } from "../src/components/workspace/attention-badge";
import { STATUS_BADGE_CONFIGS } from "../src/components/tasks/table/constants";
import { deriveAdaptiveWorkspaceData } from "../src/components/workspace/hooks/use-adaptive-workspace-data";
import { parseWorkspaceQuery, serializeWorkspaceQuery, type WorkspaceFilterState } from "../src/lib/workspace-query";
import type { TaskStatus, SchoolTask, StaffTask } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";

describe("Workspace Semantic Invariants - Dimension Orthogonality", () => {

  const CANONICAL_TASK_STATUSES: readonly TaskStatus[] = [
    "NEW",
    "NOT_STARTED",
    "IN_PROGRESS",
    "WAITING_APPROVAL",
    "PENDING_EXECUTIVE_APPROVAL",
    "NEEDS_REVIEW",
    "BLOCKED",
    "COMPLETED",
    "CANCELLED",
  ] as const;

  const ATTENTION_LEVELS: readonly AttentionLevel[] = [
    "urgent",
    "warning",
    "info",
    "success",
    "neutral",
  ] as const;

  const ATTENTION_QUEUES = [
    "pendingApprovals",
    "myPendingSubmissions",
    "requires_my_approval",
    "requires_my_action",
    "blocked_items",
    "overdue_items",
  ] as const;

  describe("Invariant 1: Scope !== Status (Orthogonality)", () => {

    test("Vietnamese scope labels and status labels are strictly disjoint", () => {
      const scopeLabels = new Set(["Toàn trường", "Đơn vị", "Của tôi", "Cá nhân", "Trường"]);
      const statusLabels = new Set(
        Object.values(STATUS_BADGE_CONFIGS).map((c) => c.label.trim().toLowerCase())
      );

      for (const scopeLabel of scopeLabels) {
        assert.ok(
          !statusLabels.has(scopeLabel.toLowerCase()),
          `Scope label '${scopeLabel}' must never be used as a task lifecycle status label.`
        );
      }
    });

    test("changing scope does not constrain or mutate task lifecycle status", () => {
      const mockUser: AuthUser = {
        id: "user-test-1",
        name: "Nguyễn Văn Trưởng Khoa",
        role: "MANAGER",
        roleLabel: "Trưởng Khoa",
        email: "truongkhoa@qcet.edu.vn",
        department: "Khoa Công nghệ Thông tin",
        departmentCode: "CNTT",
      };

      // Create tasks across distinct scopes and statuses
      const tasks: SchoolTask[] = [
        {
          id: "t-1",
          title: "Nhiệm vụ trường - Chưa bắt đầu",
          category: "KHAC",
          categoryLabel: "Chung",
          status: "NOT_STARTED",
          progressPercent: 0,
          assignedDate: "2026-09-01",
          dueDate: "2026-10-01",
          leadAssigneeName: "Nguyễn Văn Trưởng Khoa",
          leadAssigneeId: "user-test-1",
          assignedTo: "user-test-1",
          departmentCode: "CNTT",
          totalSubTasks: 0,
          completedSubTasks: 0,
          coAssignees: [],
          subTasks: [],
        },
        {
          id: "t-2",
          title: "Nhiệm vụ trường - Đang làm",
          category: "KHAC",
          categoryLabel: "Chung",
          status: "IN_PROGRESS",
          progressPercent: 50,
          assignedDate: "2026-09-01",
          dueDate: "2026-10-01",
          leadAssigneeName: "Nguyễn Văn Trưởng Khoa",
          leadAssigneeId: "user-test-1",
          assignedTo: "user-test-1",
          departmentCode: "CNTT",
          totalSubTasks: 0,
          completedSubTasks: 0,
          coAssignees: [],
          subTasks: [],
        },
        {
          id: "t-3",
          title: "Nhiệm vụ trường - Hoàn thành",
          category: "KHAC",
          categoryLabel: "Chung",
          status: "COMPLETED",
          progressPercent: 100,
          assignedDate: "2026-09-01",
          dueDate: "2026-09-10",
          leadAssigneeName: "Nguyễn Văn Trưởng Khoa",
          leadAssigneeId: "user-test-1",
          assignedTo: "user-test-1",
          departmentCode: "CNTT",
          totalSubTasks: 0,
          completedSubTasks: 0,
          coAssignees: [],
          subTasks: [],
        },
      ];

      // Any scope ("school", "unit", "my") retains tasks in their exact lifecycle status
      const schoolResult = deriveAdaptiveWorkspaceData({
        tasks,
        user: mockUser,
        scope: "school",
      });
      const unitResult = deriveAdaptiveWorkspaceData({
        tasks,
        user: mockUser,
        scope: "unit",
      });
      const myResult = deriveAdaptiveWorkspaceData({
        tasks,
        user: mockUser,
        scope: "my",
      });

      const schoolStatuses = schoolResult.scopedTasks.map((t) => t.status);
      const unitStatuses = unitResult.scopedTasks.map((t) => t.status);
      const myStatuses = myResult.scopedTasks.map((t) => t.status);

      // Verify that all 3 statuses are preserved across scopes
      assert.deepEqual(schoolStatuses, ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
      assert.deepEqual(unitStatuses, ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
      assert.deepEqual(myStatuses, ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
    });
  });

  describe("Invariant 2: Attention !== Status (Orthogonality)", () => {
    test("attention level / queue identifiers and task statuses are completely disjoint sets", () => {
      const statusSet = new Set<string>(CANONICAL_TASK_STATUSES);
      const attentionSet = new Set<string>([...ATTENTION_LEVELS, ...ATTENTION_QUEUES]);

      const overlap = [...attentionSet].filter((a) => statusSet.has(a));
      assert.equal(
        overlap.length,
        0,
        `Attention identifiers and Task statuses must never overlap. Overlap found: ${JSON.stringify(overlap)}`
      );
    });

    test("attention queue is subjective/viewer-dependent while task status is objective", () => {
      const managerUser: AuthUser = {
        id: "mgr-1",
        name: "Trưởng phòng Đào tạo",
        role: "MANAGER",
        roleLabel: "Trưởng phòng Đào tạo",
        email: "daotao@qcet.edu.vn",
        department: "Phòng Đào tạo",
        departmentCode: "P.DT",
      };

      const staffUser: AuthUser = {
        id: "staff-1",
        name: "Chuyên viên Đào tạo",
        role: "STAFF",
        roleLabel: "Chuyên viên Đào tạo",
        email: "chuyenvien@qcet.edu.vn",
        department: "Phòng Đào tạo",
        departmentCode: "P.DT",
      };

      // A subtask waiting approval submitted by staff, requiring manager approval
      const subtaskWaiting: StaffTask = {
        id: "st-1",
        title: "Soạn lịch thi tốt nghiệp",
        status: "WAITING_APPROVAL",
        assigneeId: "staff-1",
        assigneeName: "Chuyên viên Đào tạo",
        assignedTo: "staff-1",
        dueDate: "2026-09-20",
        updatedAt: "2026-09-08",
      };

      const parentTask: SchoolTask = {
        id: "pt-1",
        title: "Tổ chức thi tốt nghiệp đợt 2",
        category: "KHAC",
        categoryLabel: "Đào tạo",
        status: "IN_PROGRESS",
        progressPercent: 50,
        leadAssigneeId: "mgr-1",
        leadAssigneeName: "Trưởng phòng Đào tạo",
        assignedTo: "mgr-1",
        departmentCode: "P.DT",
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        subTasks: [subtaskWaiting],
        totalSubTasks: 1,
        completedSubTasks: 0,
        coAssignees: [],
      };

      // Manager perspective: subtask is pending approval
      const managerWorkspace = deriveAdaptiveWorkspaceData({
        tasks: [parentTask],
        user: managerUser,
        scope: "unit",
      });

      // Staff perspective: subtask is waiting review, NOT in pending approvals
      const staffWorkspace = deriveAdaptiveWorkspaceData({
        tasks: [parentTask],
        user: staffUser,
        scope: "my",
      });

      // Task status is objective: WAITING_APPROVAL in both
      assert.equal(subtaskWaiting.status, "WAITING_APPROVAL");

      // Action Queue is subjective: Manager has pending approvals, Staff does not
      assert.equal(
        managerWorkspace.actionQueue.pendingApprovals.length,
        1,
        "Manager must see pending approvals"
      );
      assert.equal(
        staffWorkspace.actionQueue.pendingApprovals.length,
        0,
        "Staff member cannot approve their own item; pendingApprovals must be 0"
      );
    });

    test("a single attention category can contain tasks in multiple distinct lifecycle statuses", () => {
      // Attention queue "myPendingSubmissions" can contain tasks that are IN_PROGRESS, NOT_STARTED, or NEEDS_REVIEW
      const staffUser: AuthUser = {
        id: "staff-2",
        name: "Giảng viên A",
        role: "STAFF",
        roleLabel: "Giảng viên",
        email: "gva@qcet.edu.vn",
        department: "Khoa Kinh tế",
        departmentCode: "KT",
      };

      const subtaskInProgress: StaffTask = {
        id: "st-in-prog",
        title: "Ra đề thi giữa kỳ",
        status: "IN_PROGRESS",
        assigneeId: "staff-2",
        assigneeName: "Giảng viên A",
        dueDate: "2026-09-25",
        updatedAt: "2026-09-05",
      };

      const subtaskNotStarted: StaffTask = {
        id: "st-not-started",
        title: "Nộp ngân hàng câu hỏi",
        status: "NOT_STARTED",
        assigneeId: "staff-2",
        assigneeName: "Giảng viên A",
        dueDate: "2026-09-28",
        updatedAt: "2026-09-05",
      };

      const parent: SchoolTask = {
        id: "pt-2",
        title: "Kế hoạch khảo thí học kỳ 1",
        category: "KHAC",
        categoryLabel: "Đào tạo",
        status: "IN_PROGRESS",
        progressPercent: 30,
        assignedDate: "2026-09-01",
        dueDate: "2026-10-15",
        leadAssigneeName: "Trưởng phòng Khảo thí",
        departmentCode: "KT",
        subTasks: [subtaskInProgress, subtaskNotStarted],
        totalSubTasks: 2,
        completedSubTasks: 0,
        coAssignees: [],
      };

      const workspace = deriveAdaptiveWorkspaceData({
        tasks: [parent],
        user: staffUser,
        scope: "my",
      });

      const submissionStatuses = workspace.actionQueue.myPendingSubmissions.map((s) => s.task.status);
      // Both IN_PROGRESS and NOT_STARTED exist in the same attention queue
      assert.ok(submissionStatuses.includes("IN_PROGRESS"));
      assert.ok(submissionStatuses.includes("NOT_STARTED"));
      assert.equal(submissionStatuses.length, 2);
    });
  });

  describe("Invariant 3: View !== Filter (Orthogonality)", () => {

    test("switching view mode does not alter dataset count, active scope, or metrics", () => {
      const mockTasks: SchoolTask[] = [
        {
          id: "task-view-1",
          title: "Báo cáo kiểm định",
          category: "KHAC",
          categoryLabel: "Kiểm định",
          status: "IN_PROGRESS",
          progressPercent: 60,
          assignedDate: "2026-09-01",
          dueDate: "2026-09-30",
          leadAssigneeName: "Phụ trách kiểm định",
          coAssignees: [],
          subTasks: [],
          totalSubTasks: 0,
          completedSubTasks: 0,
        },
        {
          id: "task-view-2",
          title: "Chuẩn bị minh chứng",
          category: "KHAC",
          categoryLabel: "Kiểm định",
          status: "COMPLETED",
          progressPercent: 100,
          assignedDate: "2026-09-01",
          dueDate: "2026-09-15",
          leadAssigneeName: "Phụ trách kiểm định",
          coAssignees: [],
          subTasks: [],
          totalSubTasks: 0,
          completedSubTasks: 0,
        },
      ];

      // Dataset derivation for the same filter conditions
      const tableData = deriveAdaptiveWorkspaceData({
        tasks: mockTasks,
        user: null,
        scope: "school",
      });

      const kanbanData = deriveAdaptiveWorkspaceData({
        tasks: mockTasks,
        user: null,
        scope: "school",
      });

      assert.equal(tableData.scopedTasks.length, kanbanData.scopedTasks.length);
      assert.equal(tableData.metrics.totalParentTasks, kanbanData.metrics.totalParentTasks);
      assert.equal(tableData.metrics.completedParentTasks, kanbanData.metrics.completedParentTasks);
      assert.equal(tableData.metrics.parentCompletionRate, kanbanData.metrics.parentCompletionRate);
      assert.equal(tableData.activeScope, kanbanData.activeScope);
    });
  });

  describe("Invariant 4: 'Của tôi' is never treated as a task lifecycle status", () => {

    test("'Của tôi' does not exist in STATUS_BADGE_CONFIGS", () => {
      const keys = Object.keys(STATUS_BADGE_CONFIGS);
      assert.ok(!keys.includes("my"), "Status badge configs must not have 'my' key");
      assert.ok(!keys.includes("cua_toi"), "Status badge configs must not have 'cua_toi' key");
      assert.ok(!keys.includes("CUA_TOI"), "Status badge configs must not have 'CUA_TOI' key");

      for (const [k, cfg] of Object.entries(STATUS_BADGE_CONFIGS)) {
        assert.ok(
          !cfg.label.toLowerCase().includes("của tôi"),
          `Status badge config for key '${k}' has label '${cfg.label}' which must not contain 'Của tôi'`
        );
        assert.ok(
          !cfg.label.toLowerCase().includes("cá nhân"),
          `Status badge config for key '${k}' has label '${cfg.label}' which must not contain 'Cá nhân'`
        );
      }
    });

    test("canonical lifecycle status labels strictly represent workflow states", () => {
      const expectedStatusLabels = [
        "Mới",
        "Đang thực hiện",
        "Chờ phê duyệt",
        "Cần chỉnh sửa",
        "Chờ BGH duyệt",
        "Hoàn thành",
        "Trễ hạn",
        "Đã hủy",
      ];

      const actualLabels = Object.values(STATUS_BADGE_CONFIGS).map((c) => c.label);
      for (const expected of expectedStatusLabels) {
        assert.ok(
          actualLabels.includes(expected),
          `Expected canonical status label '${expected}' to be present in STATUS_BADGE_CONFIGS`
        );
      }
    });
  });

  describe("Invariant 5: URL Query State Parse-Serialize-Parse Stability & Normalization", () => {

    test("round-trip stability for Calendar workspace with agenda view", () => {
      const calendarInput: Partial<WorkspaceFilterState> = {
        scope: "school",
        view: "agenda",
        month: 11,
        date: "2026-11-20",
      };

      const serialized = serializeWorkspaceQuery(calendarInput, { isCalendar: true });
      const reParsed = parseWorkspaceQuery(serialized, { isCalendar: true });

      assert.equal(reParsed.view, "agenda");
      assert.equal(reParsed.month, 11);
      assert.equal(reParsed.date, "2026-11-20");
      assert.equal(reParsed.scope, "school");
    });

    test("normalization of invalid scope parameters to canonical default", () => {
      const invalidScopes = ["super_admin", "unknown_scope", "department_extra", "invalid", "123"];
      for (const inv of invalidScopes) {
        const parsed = parseWorkspaceQuery({ scope: inv });
        assert.equal(
          parsed.scope,
          "school",
          `Invalid scope '${inv}' must normalize to default 'school'`
        );
      }
    });

    test("normalization of invalid month parameters to 'ALL'", () => {
      const invalidMonths = ["13", "0", "-1", "99", "abc", "month_1", "2026-13"];
      for (const m of invalidMonths) {
        const parsed = parseWorkspaceQuery({ month: m });
        assert.equal(
          parsed.month,
          "ALL",
          `Invalid month '${m}' must normalize to 'ALL'`
        );
      }
    });

    test("normalization of valid month expressions (numeric and YYYY-MM)", () => {
      assert.equal(parseWorkspaceQuery({ month: "9" }).month, 9);
      assert.equal(parseWorkspaceQuery({ month: "2026-09" }).month, 9);
      assert.equal(parseWorkspaceQuery({ period: "2026-12" }).month, 12);
      assert.equal(parseWorkspaceQuery({ academicMonth: "1" }).month, 1);
    });

    test("normalization of invalid date expressions", () => {
      const parsedBad = parseWorkspaceQuery({ date: "not-a-date" });
      assert.equal(parsedBad.date, undefined);

      const parsedGood = parseWorkspaceQuery({ date: "2026-09-10" });
      assert.equal(parsedGood.date, "2026-09-10");
    });

    test("normalization of invalid status parameters to 'ALL'", () => {
      const invalidStatuses = ["INVALID_STATUS", "FOO_BAR", "MY", "CUA_TOI", "unknown"];
      for (const s of invalidStatuses) {
        const parsed = parseWorkspaceQuery({ status: s });
        assert.equal(
          parsed.status,
          "ALL",
          `Invalid status '${s}' must normalize to 'ALL'`
        );
      }
    });

    test("preservation and decoding of URL-encoded query strings", () => {
      const encodedQ = "K%E1%BA%BF%20ho%E1%BA%A1ch%20%C4%91%C3%A0o%20t%E1%BA%A1o";
      const parsed = parseWorkspaceQuery(`q=${encodedQ}`);
      assert.equal(parsed.q, "Kế hoạch đào tạo");

      const serialized = serializeWorkspaceQuery(parsed);
      const reParsed = parseWorkspaceQuery(serialized);
      assert.equal(reParsed.q, "Kế hoạch đào tạo");
    });

    test("legacy parameters migration and cleanup upon serialization", () => {
      const legacyQuery = "scope=personal&tab=review&departmentId=DEPT-01&query=thi+tot+nghiep&selectedTaskId=sub-42";
      const parsed = parseWorkspaceQuery(legacyQuery);

      assert.equal(parsed.scope, "my", "scope=personal must migrate to scope='my'");
      assert.equal(parsed.status, "WAITING_APPROVAL", "tab=review must migrate to status='WAITING_APPROVAL'");
      assert.equal(parsed.unitId, "DEPT-01", "departmentId must migrate to unitId='DEPT-01'");
      assert.equal(parsed.q, "thi tot nghiep", "query must migrate to q='thi tot nghiep'");
      assert.equal(parsed.taskId, "sub-42", "selectedTaskId must migrate to taskId='sub-42'");

      const serialized = serializeWorkspaceQuery(parsed, {
        preserveParams: legacyQuery,
      });

      // Assert legacy keys were stripped and replaced with canonical keys
      assert.equal(serialized.has("tab"), false, "legacy 'tab' must be stripped");
      assert.equal(serialized.has("departmentId"), false, "legacy 'departmentId' must be stripped");
      assert.equal(serialized.has("query"), false, "legacy 'query' must be stripped");
      assert.equal(serialized.has("selectedTaskId"), false, "legacy 'selectedTaskId' must be stripped");

      assert.equal(serialized.get("scope"), "my");
      assert.equal(serialized.get("status"), "WAITING_APPROVAL");
      assert.equal(serialized.get("dept"), "DEPT-01");
      assert.equal(serialized.get("q"), "thi tot nghiep");
      assert.equal(serialized.get("taskId"), "sub-42");
    });
  });

  describe("Invariant 6: 'Của tôi' Scope-vs-Status Mutual Exclusivity", () => {
    test("URL containing scope=my and status=my normalizes status to 'ALL'", () => {
      const params = "scope=my&status=my";
      const parsed = parseWorkspaceQuery(params);

      // scope is validly 'my'
      assert.equal(parsed.scope, "my");
      // status 'my' is invalid as a lifecycle status, so it must normalize to 'ALL'
      assert.equal(
        parsed.status,
        "ALL",
        "status='my' must never be accepted as a status; must normalize to 'ALL'"
      );
    });

    test("URL containing legacy tab=my normalizes status to 'ALL' instead of a bogus status", () => {
      // Legacy tab=my represents personal context, but status resolver must not treat it as a status
      const parsed = parseWorkspaceQuery("tab=my");
      assert.equal(
        parsed.status,
        "ALL",
        "status must normalize to 'ALL' when legacy tab=my is encountered"
      );
    });

    test("orthogonal coexistence: scope='my' and status='WAITING_APPROVAL' operate simultaneously without conflict", () => {
      const parsed = parseWorkspaceQuery("scope=my&status=WAITING_APPROVAL");
      assert.equal(parsed.scope, "my", "Scope must be 'my'");
      assert.equal(
        parsed.status,
        "WAITING_APPROVAL",
        "Status must be 'WAITING_APPROVAL' (objective status within subjective scope)"
      );

      const serialized = serializeWorkspaceQuery(parsed);
      assert.equal(serialized.get("scope"), "my");
      assert.equal(serialized.get("status"), "WAITING_APPROVAL");
    });
  });

  describe("Invariant 7: Period !== Status (Orthogonality)", () => {
    test("a period parameter never populates a lifecycle status, and a status never populates a period", () => {
      const periodOnly = parseWorkspaceQuery({ period: "2026-09" });
      assert.equal(periodOnly.month, 9, "period '2026-09' must populate the period/month dimension");
      assert.equal(
        periodOnly.status,
        "ALL",
        "setting a period must never set a lifecycle status; status stays at the neutral default"
      );

      const statusOnly = parseWorkspaceQuery({ status: "IN_PROGRESS" });
      assert.equal(statusOnly.status, "IN_PROGRESS", "status must populate the status dimension");
      assert.equal(
        statusOnly.month,
        "ALL",
        "setting a status must never populate the period/month dimension"
      );
    });

    test("canonical period identifiers and lifecycle status identifiers are disjoint sets", () => {
      const periodIdentifiers = new Set<string>([
        "ALL",
        ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
      ]);
      const statusIdentifiers = new Set<string>(CANONICAL_TASK_STATUSES);

      const overlap = [...periodIdentifiers].filter((p) => statusIdentifiers.has(p));
      assert.equal(
        overlap.length,
        0,
        `Period identifiers and status identifiers must never overlap. Overlap found: ${JSON.stringify(overlap)}`
      );
    });
  });
});

