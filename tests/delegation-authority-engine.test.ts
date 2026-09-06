import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isDelegationActive,
  canUserApproveTask,
  recordDelegatedApproval,
} from "../src/lib/delegation-authority-engine";
import type { DelegationRule } from "../src/types/delegation";

describe("Stanford Authority Delegation Engine", () => {
  const baseActiveRule: DelegationRule = {
    id: "del-001",
    grantorId: "mgr-01",
    grantorName: "Tran Hung",
    grantorRole: "MANAGER",
    granteeId: "staff-01",
    granteeName: "Le Van A",
    granteeRole: "STAFF",
    departmentCode: "DAO_TAO",
    scope: "DACUM_REVIEW_STEP1",
    startDate: "2025-03-01",
    endDate: "2025-03-31",
    status: "ACTIVE",
    reason: "Uy quyen tham dinh DACUM dot 1 trong thoi gian di cong tac",
    createdAt: "2025-03-01T08:00:00.000Z",
  };

  describe("1. isDelegationActive", () => {
    test("xac thuc dung theo ngay bat dau, ket thuc va trang thai", () => {
      // Trong khoang hop le
      assert.equal(isDelegationActive(baseActiveRule, "2025-03-15"), true);
      // Bien bat dau
      assert.equal(isDelegationActive(baseActiveRule, "2025-03-01"), true);
      // Bien ket thuc
      assert.equal(isDelegationActive(baseActiveRule, "2025-03-31"), true);
      // Truoc khoang thoi gian
      assert.equal(isDelegationActive(baseActiveRule, "2025-02-28"), false);
      // Sau khoang thoi gian
      assert.equal(isDelegationActive(baseActiveRule, "2025-04-01"), false);
      // Ho tro Date object
      assert.equal(
        isDelegationActive(baseActiveRule, new Date("2025-03-15T12:00:00Z")),
        true
      );

      // Trang thai khong phai ACTIVE
      const expiredRule: DelegationRule = { ...baseActiveRule, status: "EXPIRED" };
      assert.equal(isDelegationActive(expiredRule, "2025-03-15"), false);

      const revokedRule: DelegationRule = { ...baseActiveRule, status: "REVOKED" };
      assert.equal(isDelegationActive(revokedRule, "2025-03-15"), false);
    });
  });

  describe("2. canUserApproveTask - Self-Approval Prevention", () => {
    test("chan nguoi thuc hien tu phe duyet cong viec cua chinh minh", () => {
      const task = {
        id: "task-001",
        departmentCode: "DAO_TAO",
        assigneeId: "staff-01",
      };

      // Can bo duoc uy quyen nhung la nguoi thuc hien
      const delegatedStaff = {
        id: "staff-01",
        name: "Le Van A",
        role: "STAFF",
        departmentCode: "DAO_TAO",
      };

      const result = canUserApproveTask({
        actor: delegatedStaff,
        task,
        activeDelegations: [baseActiveRule],
        referenceDate: "2025-03-15",
      });

      assert.equal(result.allowed, false);
      assert.equal(
        result.reason,
        "Theo quy định quản trị và phân lập nhiệm vụ (Separation of Duties), người thực hiện không được tự phê duyệt công việc của mình."
      );

      // Truong phong nhung la nguoi truc tiep thuc hien nhiem vu
      const managerActor = {
        id: "mgr-01",
        name: "Tran Hung",
        role: "MANAGER",
        departmentCode: "DAO_TAO",
      };
      const taskAssignedToManager = {
        id: "task-002",
        departmentCode: "DAO_TAO",
        assigneeId: "mgr-01",
      };

      const managerSelfApproval = canUserApproveTask({
        actor: managerActor,
        task: taskAssignedToManager,
        activeDelegations: [],
        referenceDate: "2025-03-15",
      });

      assert.equal(managerSelfApproval.allowed, false);
      assert.equal(
        managerSelfApproval.reason,
        "Theo quy định quản trị và phân lập nhiệm vụ (Separation of Duties), người thực hiện không được tự phê duyệt công việc của mình."
      );
    });
  });

  describe("3. canUserApproveTask - Direct Approval by Manager and Admin", () => {
    test("cho phep Manager cua phong ban phe duyet truc tiep", () => {
      const task = {
        id: "task-001",
        departmentCode: "DAO_TAO",
        assigneeId: "staff-02",
      };

      const manager = {
        id: "mgr-01",
        name: "Tran Hung",
        role: "MANAGER",
        departmentCode: "DAO_TAO",
      };

      const result = canUserApproveTask({
        actor: manager,
        task,
        activeDelegations: [],
        referenceDate: "2025-03-15",
      });

      assert.equal(result.allowed, true);
      assert.equal(result.isDelegated, false);
    });

    test("cho phep Admin phe duyet moi phong ban", () => {
      const task = {
        id: "task-001",
        departmentCode: "DAO_TAO",
        assigneeId: "staff-02",
      };

      const admin = {
        id: "admin-01",
        name: "BGH QCET",
        role: "ADMIN",
        departmentCode: "BGH",
      };

      const result = canUserApproveTask({
        actor: admin,
        task,
        activeDelegations: [],
        referenceDate: "2025-03-15",
      });

      assert.equal(result.allowed, true);
      assert.equal(result.isDelegated, false);
    });

    test("tu choi khi Manager phong ban khac co gang phe duyet truc tiep", () => {
      const task = {
        id: "task-001",
        departmentCode: "DAO_TAO",
        assigneeId: "staff-02",
      };

      const otherManager = {
        id: "mgr-cntt",
        name: "Nguyen Van B",
        role: "MANAGER",
        departmentCode: "CNTT",
      };

      const result = canUserApproveTask({
        actor: otherManager,
        task,
        activeDelegations: [],
        referenceDate: "2025-03-15",
      });

      assert.equal(result.allowed, false);
      assert.equal(
        result.reason,
        "Bạn không có quyền phê duyệt công việc này hoặc thời gian ủy quyền đã hết hiệu lực."
      );
    });
  });

  describe("4. canUserApproveTask - Delegated Authority Approval", () => {
    test("cho phep can bo duoc uy quyen hop le phe duyet thay mat", () => {
      const task = {
        id: "task-001",
        departmentCode: "DAO_TAO",
        assigneeId: "staff-02", // Nguoi thuc hien la staff khac
      };

      const delegatedStaff = {
        id: "staff-01",
        name: "Le Van A",
        role: "STAFF",
        departmentCode: "DAO_TAO",
      };

      // Uy quyen DACUM_REVIEW_STEP1
      const resultStep1 = canUserApproveTask({
        actor: delegatedStaff,
        task,
        activeDelegations: [baseActiveRule],
        referenceDate: "2025-03-15",
      });

      assert.equal(resultStep1.allowed, true);
      assert.equal(resultStep1.isDelegated, true);
      assert.equal(resultStep1.rule?.id, "del-001");

      // Uy quyen FULL_DEPARTMENT_APPROVAL
      const fullDeptRule: DelegationRule = {
        ...baseActiveRule,
        id: "del-002",
        scope: "FULL_DEPARTMENT_APPROVAL",
      };

      const resultFull = canUserApproveTask({
        actor: delegatedStaff,
        task,
        activeDelegations: [fullDeptRule],
        referenceDate: "2025-03-15",
      });

      assert.equal(resultFull.allowed, true);
      assert.equal(resultFull.isDelegated, true);
      assert.equal(resultFull.rule?.id, "del-002");
    });
  });

  describe("5. canUserApproveTask - Rejection on Ineligible Delegation", () => {
    const task = {
      id: "task-001",
      departmentCode: "DAO_TAO",
      assigneeId: "staff-02",
    };

    const staffActor = {
      id: "staff-01",
      name: "Le Van A",
      role: "STAFF",
      departmentCode: "DAO_TAO",
    };

    test("tu choi khi uy quyen da het han thoi gian", () => {
      const result = canUserApproveTask({
        actor: staffActor,
        task,
        activeDelegations: [baseActiveRule],
        referenceDate: "2025-04-05", // Ngay sau khi het han 2025-03-31
      });

      assert.equal(result.allowed, false);
      assert.equal(
        result.reason,
        "Bạn không có quyền phê duyệt công việc này hoặc thời gian ủy quyền đã hết hiệu lực."
      );
    });

    test("tu choi khi uy quyen thuoc phong ban khac", () => {
      const differentDeptRule: DelegationRule = {
        ...baseActiveRule,
        departmentCode: "KHOA_CNTT",
      };

      const result = canUserApproveTask({
        actor: staffActor,
        task,
        activeDelegations: [differentDeptRule],
        referenceDate: "2025-03-15",
      });

      assert.equal(result.allowed, false);
      assert.equal(
        result.reason,
        "Bạn không có quyền phê duyệt công việc này hoặc thời gian ủy quyền đã hết hiệu lực."
      );
    });

    test("tu choi khi pham vi uy quyen khong phu hop (vi du: TASK_ASSIGNMENT)", () => {
      const assignmentScopeRule: DelegationRule = {
        ...baseActiveRule,
        scope: "TASK_ASSIGNMENT",
      };

      const result = canUserApproveTask({
        actor: staffActor,
        task,
        activeDelegations: [assignmentScopeRule],
        referenceDate: "2025-03-15",
      });

      assert.equal(result.allowed, false);
      assert.equal(
        result.reason,
        "Bạn không có quyền phê duyệt công việc này hoặc thời gian ủy quyền đã hết hiệu lực."
      );
    });
  });

  describe("6. recordDelegatedApproval", () => {
    test("tao dung vet kiem toan ApprovalAuditLog khi duoc uy quyen", () => {
      const auditLog = recordDelegatedApproval({
        taskId: "task-dacum-101",
        action: "APPROVE_DACUM_STEP1",
        actor: {
          id: "staff-01",
          name: "Le Van A",
          role: "STAFF",
        },
        rule: baseActiveRule,
        timestamp: "2025-03-15T10:30:00.000Z",
        notes: "Phe duyet thay mat Truong phong Tran Hung theo quyen uy quyen",
      });

      assert.equal(auditLog.taskId, "task-dacum-101");
      assert.equal(auditLog.action, "APPROVE_DACUM_STEP1");
      assert.equal(auditLog.performedByUserId, "staff-01");
      assert.equal(auditLog.performedByUserName, "Le Van A");
      assert.equal(auditLog.performedByUserRole, "STAFF");
      assert.equal(auditLog.isDelegated, true);
      assert.equal(auditLog.delegatedByGrantorId, "mgr-01");
      assert.equal(auditLog.delegatedByGrantorName, "Tran Hung");
      assert.equal(auditLog.timestamp, "2025-03-15T10:30:00.000Z");
      assert.equal(
        auditLog.notes,
        "Phe duyet thay mat Truong phong Tran Hung theo quyen uy quyen"
      );
    });

    test("tao dung vet kiem toan ApprovalAuditLog khi phe duyet truc tiep khong uy quyen", () => {
      const auditLog = recordDelegatedApproval({
        taskId: "task-dacum-102",
        action: "APPROVE_DACUM_STEP1",
        actor: {
          id: "mgr-01",
          name: "Tran Hung",
          role: "MANAGER",
        },
      });

      assert.equal(auditLog.taskId, "task-dacum-102");
      assert.equal(auditLog.action, "APPROVE_DACUM_STEP1");
      assert.equal(auditLog.performedByUserId, "mgr-01");
      assert.equal(auditLog.performedByUserName, "Tran Hung");
      assert.equal(auditLog.performedByUserRole, "MANAGER");
      assert.equal(auditLog.isDelegated, false);
      assert.equal(auditLog.delegatedByGrantorId, undefined);
      assert.equal(auditLog.delegatedByGrantorName, undefined);
      assert.ok(auditLog.timestamp);
    });
  });
});
