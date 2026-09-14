import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  canUserApproveTask,
  recordDelegatedApproval,
  isDelegationActive,
} from "../src/lib/delegation-authority-engine";
import {
  validateDelegationForm,
  type DelegationFormData,
} from "../src/components/dashboard/delegation-management-modal";
import type { DelegationRule, ApprovalAuditLog } from "../src/types/delegation";

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

    test("Self-Delegation Prevention: Khong the lap uy quyen cho chinh ban than nguoi uy quyen", () => {
      const selfDelegationForm: DelegationFormData = {
        granteeName: "TS. Nguyen Ngoc Vinh",
        granteeRole: "MANAGER",
        scope: "DACUM_REVIEW_STEP1",
        startDate: "2025-03-01",
        endDate: "2025-03-31",
        reason: "Tu uy quyen nghiem thu",
      };

      const errors = validateDelegationForm(
        selfDelegationForm,
        "TS. Nguyen Ngoc Vinh"
      );
      assert.ok(errors.granteeName, "Phai chan tu uy quyen cho chinh minh");
      assert.match(
        errors.granteeName,
        /phân lập thẩm quyền/i
      );
    });
  });

  describe("4. Quy chuan Quan tri Stanford & Nghi dinh 232: Audit Trail Integrity", () => {
    const activeDelegationRule: DelegationRule = {
      id: "del-audit-232",
      grantorId: "grantor-id-vinh",
      grantorName: "TS. Nguyen Ngoc Vinh",
      grantorRole: "MANAGER",
      granteeId: "grantee-id-anh",
      granteeName: "ThS. Le Van A",
      granteeRole: "STAFF",
      departmentCode: "K_CNTT",
      scope: "DACUM_REVIEW_STEP1",
      startDate: "2025-03-01",
      endDate: "2025-03-31",
      status: "ACTIVE",
      reason: "Uy quyen tham dinh theo Nghi dinh 232",
      createdAt: "2025-03-01T08:00:00.000Z",
    };

    test("Moi lan duyet qua uy quyen phai ghi lai day du ID va ten cua ca grantor va grantee", () => {
      const auditLog: ApprovalAuditLog = recordDelegatedApproval({
        taskId: "task-dacum-101",
        action: "APPROVE_DACUM_STEP1",
        actor: {
          id: activeDelegationRule.granteeId,
          name: activeDelegationRule.granteeName,
          role: activeDelegationRule.granteeRole,
        },
        rule: activeDelegationRule,
        notes: "Xac nhan dat tieu chuan ky nang DACUM cap khoa",
      });

      // Kiem tra flag uy quyen
      assert.equal(auditLog.isDelegated, true);

      // Kiem tra day du ID va ten cua Grantee (nguoi thuc hien duyet)
      assert.equal(auditLog.performedByUserId, "grantee-id-anh");
      assert.equal(auditLog.performedByUserName, "ThS. Le Van A");
      assert.equal(auditLog.performedByUserRole, "STAFF");

      // Kiem tra day du ID va ten cua Grantor (nguoi uy quyen)
      assert.equal(auditLog.delegatedByGrantorId, "grantor-id-vinh");
      assert.equal(auditLog.delegatedByGrantorName, "TS. Nguyen Ngoc Vinh");

      // Kiem tra audit log metadata
      assert.equal(auditLog.taskId, "task-dacum-101");
      assert.equal(auditLog.action, "APPROVE_DACUM_STEP1");
      assert.ok(auditLog.timestamp);
      assert.equal(auditLog.notes, "Xac nhan dat tieu chuan ky nang DACUM cap khoa");
    });

    test("Audit trail ap dung cho ca REJECT_DACUM_STEP1 va APPROVE_SCHOOL_TASK qua uy quyen", () => {
      const rejectLog = recordDelegatedApproval({
        taskId: "task-dacum-102",
        action: "REJECT_DACUM_STEP1",
        actor: {
          id: activeDelegationRule.granteeId,
          name: activeDelegationRule.granteeName,
          role: activeDelegationRule.granteeRole,
        },
        rule: activeDelegationRule,
        notes: "Yeu cau bo sung danh muc ky nang con thieu",
      });

      assert.equal(rejectLog.isDelegated, true);
      assert.equal(rejectLog.performedByUserId, "grantee-id-anh");
      assert.equal(rejectLog.performedByUserName, "ThS. Le Van A");
      assert.equal(rejectLog.delegatedByGrantorId, "grantor-id-vinh");
      assert.equal(rejectLog.delegatedByGrantorName, "TS. Nguyen Ngoc Vinh");

      const approveSchoolLog = recordDelegatedApproval({
        taskId: "task-school-201",
        action: "APPROVE_SCHOOL_TASK",
        actor: {
          id: activeDelegationRule.granteeId,
          name: activeDelegationRule.granteeName,
          role: activeDelegationRule.granteeRole,
        },
        rule: activeDelegationRule,
      });

      assert.equal(approveSchoolLog.isDelegated, true);
      assert.equal(approveSchoolLog.performedByUserId, "grantee-id-anh");
      assert.equal(approveSchoolLog.delegatedByGrantorId, "grantor-id-vinh");
    });

    test("Duyet truc tiep khong qua uy quyen ghi nhan isDelegated = false va khong co thong tin grantor", () => {
      const directLog = recordDelegatedApproval({
        taskId: "task-dacum-103",
        action: "APPROVE_DACUM_STEP1",
        actor: {
          id: "mgr-direct-01",
          name: "TS. Nguyen Ngoc Vinh",
          role: "MANAGER",
        },
      });

      assert.equal(directLog.isDelegated, false);
      assert.equal(directLog.performedByUserId, "mgr-direct-01");
      assert.equal(directLog.performedByUserName, "TS. Nguyen Ngoc Vinh");
      assert.equal(directLog.delegatedByGrantorId, undefined);
      assert.equal(directLog.delegatedByGrantorName, undefined);
    });
  });
});
