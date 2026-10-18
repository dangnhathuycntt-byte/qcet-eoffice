import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { canUserApproveTask, isDelegationActive } from "../src/lib/delegation-authority-engine";
import type { DelegationRule, ApprovalAuditLog } from "@qcet/contracts/types/delegation";

describe("Task 4: Delegation Workflow & Governance Compliance", () => {
  describe("3. Quy chuan Quan tri Stanford & Nghi dinh 232: Separation of Duties", () => {
    const activeDelegationRule: DelegationRule = {
      id: "del-stanford-001",
      grantorId: "usr-dean-01",
      grantorName: "TS. Nguyen Ngoc Vinh",
      grantorRole: "MANAGER",
      granteeId: "usr-staff-01",
      granteeName: "ThS. Le Van A",
      granteeRole: "STAFF",
      departmentCode: "K_CNTT",
      scope: "DACUM_REVIEW_STEP1",
      startDate: "2025-03-01",
      endDate: "2025-03-31",
      status: "ACTIVE",
      reason: "Uy quyen tham dinh DACUM dot 1 theo Nghi dinh 232",
      createdAt: "2025-03-01T08:00:00.000Z",
    };

    test("Khi actor la assignee, moi no luc tu duyet deu tra ve allowed = false (Can bo duoc uy quyen)", () => {
      const task = {
        id: "task-001",
        departmentCode: "K_CNTT",
        assigneeId: "usr-staff-01", // Actor chinh la assignee
      };

      const actor = {
        id: "usr-staff-01",
        name: "ThS. Le Van A",
        role: "STAFF",
        departmentCode: "K_CNTT",
      };

      const result = canUserApproveTask({
        actor,
        task,
        activeDelegations: [activeDelegationRule],
        referenceDate: "2025-03-15",
      });

      assert.equal(result.allowed, false);
      assert.ok(result.reason);
      assert.match(
        result.reason,
        /Separation of Duties|người thực hiện không được tự phê duyệt/i
      );
    });

    test("Khi actor la assignee, Truong don vi (MANAGER) cung khong duoc tu duyet viec cua minh", () => {
      const task = {
        id: "task-002",
        departmentCode: "K_CNTT",
        assigneeId: "usr-dean-01", // Truong don vi la assignee
      };

      const actor = {
        id: "usr-dean-01",
        name: "TS. Nguyen Ngoc Vinh",
        role: "MANAGER",
        departmentCode: "K_CNTT",
      };

      const result = canUserApproveTask({
        actor,
        task,
        activeDelegations: [],
        referenceDate: "2025-03-15",
      });

      assert.equal(result.allowed, false);
      assert.ok(result.reason);
      assert.match(
        result.reason,
        /Separation of Duties|người thực hiện không được tự phê duyệt/i
      );
    });

    test("Khi actor la assignee, Lanh dao truong (ADMIN) cung phai tuan thu Separation of Duties", () => {
      const task = {
        id: "task-003",
        departmentCode: "BGH",
        assigneeId: "usr-admin-01", // Admin chinh la assignee
      };

      const actor = {
        id: "usr-admin-01",
        name: "TS. Nguyen Minh Tuan",
        role: "ADMIN",
      };

      const result = canUserApproveTask({
        actor,
        task,
        activeDelegations: [],
        referenceDate: "2025-03-15",
      });

      assert.equal(result.allowed, false);
      assert.ok(result.reason);
      assert.match(
        result.reason,
        /Separation of Duties|người thực hiện không được tự phê duyệt/i
      );
    });

    test("Khi actor co pham vi FULL_DEPARTMENT_APPROVAL nhung la assignee van phai bi tu choi", () => {
      const fullScopeRule: DelegationRule = {
        ...activeDelegationRule,
        id: "del-stanford-002",
        scope: "FULL_DEPARTMENT_APPROVAL",
      };

      const task = {
        id: "task-004",
        departmentCode: "K_CNTT",
        assigneeId: "usr-staff-01",
      };

      const actor = {
        id: "usr-staff-01",
        name: "ThS. Le Van A",
        role: "STAFF",
        departmentCode: "K_CNTT",
      };

      const result = canUserApproveTask({
        actor,
        task,
        activeDelegations: [fullScopeRule],
        referenceDate: "2025-03-15",
      });

      assert.equal(result.allowed, false);
    });

    test("Khi actor KHONG phai la assignee, quy trinh uy quyen cho phep phe duyet hop le", () => {
      const task = {
        id: "task-005",
        departmentCode: "K_CNTT",
        assigneeId: "usr-different-person-02", // Khong phai actor
      };

      const actor = {
        id: "usr-staff-01",
        name: "ThS. Le Van A",
        role: "STAFF",
        departmentCode: "K_CNTT",
      };

      const result = canUserApproveTask({
        actor,
        task,
        activeDelegations: [activeDelegationRule],
        referenceDate: "2025-03-15",
      });

      assert.equal(result.allowed, true);
      assert.equal(result.isDelegated, true);
      assert.equal(result.rule?.id, "del-stanford-001");
    });
  });
});
