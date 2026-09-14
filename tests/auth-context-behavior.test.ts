import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveDemoUserByRole, validateLoginForm } from "../src/lib/login-helpers";
import {
  isExecutive,
  isManager,
  isStaff,
  canCreateSchoolTask,
  canAssignUnitTask,
  canSelfAssignTask,
} from "../src/lib/auth/roles";
import {
  filterTasksByRole,
  filterUpcomingByRole,
  matchesUser,
} from "../src/lib/role-task-filter";
import { SchoolTask, UpcomingItem } from "../src/types/dashboard";
import type { UserRole } from "../src/types/auth";

describe("Task 3: Authentication Session Management & Removal of Auto-Login Demo", () => {
  describe("1. Role Checkers and Task Filters handle unauthenticated (null/undefined) safely", () => {
    test("isExecutive, isManager, isStaff return false for null and undefined", () => {
      assert.strictEqual(isExecutive(null), false);
      assert.strictEqual(isExecutive(undefined), false);

      assert.strictEqual(isManager(null), false);
      assert.strictEqual(isManager(undefined), false);

      assert.strictEqual(isStaff(null), false);
      assert.strictEqual(isStaff(undefined), false);
    });

    test("permission helpers return false for null/undefined user", () => {
      assert.strictEqual(canCreateSchoolTask(null), false);
      assert.strictEqual(canCreateSchoolTask(undefined), false);

      assert.strictEqual(canAssignUnitTask(null), false);
      assert.strictEqual(canAssignUnitTask(undefined), false);

      assert.strictEqual(canSelfAssignTask(null), false);
      assert.strictEqual(canSelfAssignTask(undefined), false);
    });

    test("matchesUser returns false for null/undefined user", () => {
      assert.strictEqual(matchesUser("Nguyễn Ngọc Vinh", null), false);
      assert.strictEqual(matchesUser("Ban Giám hiệu", undefined), false);
      assert.strictEqual(matchesUser(undefined, null), false);
    });

    test("filterTasksByRole returns empty array or safe non-confidential tasks for unauthenticated user", () => {
      const sampleTasks: SchoolTask[] = [
        {
          id: "task-1",
          title: "Báo cáo thường niên",
          category: "BAO_CAO",
          categoryLabel: "Báo cáo",
          assignedDate: "2026-09-01",
          coAssignees: [],
          status: "IN_PROGRESS",
          dueDate: "2026-10-01",
          leadAssigneeName: "Trần Hùng",
          progressPercent: 50,
          totalSubTasks: 2,
          completedSubTasks: 1,
          subTasks: [
            {
              id: "sub-1",
              title: "Thu thập số liệu",
              assigneeName: "Nguyễn Ngọc Vinh",
              status: "COMPLETED",
              dueDate: "2026-09-20",
              parentSchoolTaskId: "task-1",
              updatedAt: "2026-09-20T00:00:00Z",
            },
          ],
        },
      ];

      const resultNull = filterTasksByRole(sampleTasks, null);
      assert.deepStrictEqual(resultNull, []);

      const resultUndefined = filterTasksByRole(sampleTasks, undefined);
      assert.deepStrictEqual(resultUndefined, []);
    });

    test("filterUpcomingByRole returns empty array for unauthenticated user", () => {
      const sampleUpcoming: UpcomingItem[] = [
        {
          id: "up-1",
          title: "Họp giao ban",
          dueDate: "2026-09-10",
          assigneeName: "Trần Hùng",
          level: "Trường",
        },
      ];

      assert.deepStrictEqual(filterUpcomingByRole(sampleUpcoming, null), []);
      assert.deepStrictEqual(filterUpcomingByRole(sampleUpcoming, undefined), []);
    });
  });

  describe("2. resolveDemoUserByRole does not default to Principal (BGH)", () => {
    test("returns undefined when role is invalid or does not match", () => {
      // Must not fall back to DEFAULT_DEMO_USERS[0]
      const invalidRole = "NON_EXISTENT_ROLE" as unknown as UserRole;
      const result = resolveDemoUserByRole(invalidRole);
      assert.strictEqual(result, undefined);
    });
  });

});
