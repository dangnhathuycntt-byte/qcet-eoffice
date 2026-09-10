import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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

const EMOJI_REGEX = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

describe("Task 4: Anti-Slop Delegation Workflow & Stanford Governance Compliance", () => {
  const targetFiles = [
    "src/types/delegation.ts",
    "src/lib/delegation-authority-engine.ts",
    "src/components/dashboard/delegation-management-modal.tsx",
    "src/components/dashboard/department-grouped-task-view.tsx",
    "src/components/dashboard/task-detail-side-sheet.tsx",
  ];

  describe("1. Zero-Emoji Strict Anti-Slop Audit (EMOJI_REGEX)", () => {
    targetFiles.forEach((relPath) => {
      test(`Quet va khang dinh 0% emoji trong ${relPath}`, () => {
        const fullPath = path.resolve(process.cwd(), relPath);
        assert.ok(fs.existsSync(fullPath), `File phai ton tai: ${relPath}`);

        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        const violations: string[] = [];

        lines.forEach((line, idx) => {
          if (EMOJI_REGEX.test(line)) {
            violations.push(`${relPath}:${idx + 1}: ${line.trim()}`);
          }
        });

        assert.equal(
          violations.length,
          0,
          `Phat hien emoji tai:\n${violations.join("\n")}`
        );
      });
    });
  });

  describe("2. Lucide Icons Visual Standards (strokeWidth={1.5} hoac size constraint)", () => {
    const modalPath = path.resolve(
      process.cwd(),
      "src/components/dashboard/delegation-management-modal.tsx"
    );

    test("Tat ca icon Lucide trong delegation-management-modal.tsx phai co strokeWidth={1.5} hoac size", () => {
      const content = fs.readFileSync(modalPath, "utf-8");
      const iconNames = [
        "X",
        "ShieldAlert",
        "Calendar",
        "UserCheck",
        "Plus",
        "AlertCircle",
        "Trash2",
      ];

      for (const icon of iconNames) {
        const tagRegex = new RegExp(`<${icon}\\b([^>]*)\\/?>`, "g");
        const matches = [...content.matchAll(tagRegex)];
        assert.ok(
          matches.length > 0,
          `Modal phai su dung icon ${icon} tu lucide-react`
        );

        matches.forEach((match, idx) => {
          const props = match[1];
          const hasStrokeWidth = /strokeWidth=\{1\.5\}/.test(props);
          const hasSizeClassOrProp =
            /size-\d+(\.\d+)?/.test(props) || /size=\{[^}]+\}/.test(props);

          assert.ok(
            hasStrokeWidth || hasSizeClassOrProp,
            `Icon <${icon} #${idx + 1}> trong delegation-management-modal.tsx phai co strokeWidth={1.5} hoac size: ${match[0]}`
          );
        });
      }
    });

    test("Khong ton tai icon Lucide nao su dung default strokeWidth day hoac thieu chuan hoa", () => {
      const content = fs.readFileSync(modalPath, "utf-8");
      // Kiem tra khong co strokeWidth={2} hoac lon hon trong component modal
      assert.equal(
        /strokeWidth=\{[2-9](\.\d+)?\}/.test(content),
        false,
        "Khong duoc su dung strokeWidth >= 2 cho cac micro-icons"
      );
    });
  });

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

  describe("5. Date Formatting Standards: font-mono tabular-nums", () => {
    test("delegation-management-modal.tsx su dung font-mono tabular-nums cho ngay thang va ma so", () => {
      const filePath = path.resolve(
        process.cwd(),
        "src/components/dashboard/delegation-management-modal.tsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      assert.match(
        content,
        /font-mono\s+tabular-nums/,
        "Modal uy quyen phai co class font-mono tabular-nums"
      );

      // Kiem tra date input start va end
      assert.match(
        content,
        /font-mono\s+tabular-nums[^"]*startDate|startDate[^"]*font-mono\s+tabular-nums|w-full\s+font-mono\s+tabular-nums/,
        "Truong nhap ngay bat dau va ket thuc phai co font-mono tabular-nums"
      );

      // Kiem tra hien thi khoang thoi gian hieu luc {del.startDate} - {del.endDate}
      assert.match(
        content,
        /font-mono\s+tabular-nums[^>]*>[^<]*\{del\.startDate\}\s*-\s*\{del\.endDate\}/,
        "Hien thi khoang ngay hieu luc phai co font-mono tabular-nums"
      );
    });

    test("department-grouped-task-view.tsx su dung font-mono tabular-nums cho chi so va thoi gian", () => {
      const filePath = path.resolve(
        process.cwd(),
        "src/components/dashboard/department-grouped-task-view.tsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      assert.match(
        content,
        /font-mono\s+tabular-nums/,
        "Department grouped view phai co font-mono tabular-nums"
      );
    });

    test("task-detail-side-sheet.tsx su dung font-mono tabular-nums cho moc thoi gian va audit logs", () => {
      const filePath = path.resolve(
        process.cwd(),
        "src/components/dashboard/task-detail-side-sheet.tsx"
      );
      const content = fs.readFileSync(filePath, "utf-8");

      assert.match(
        content,
        /font-mono[^"]*tabular-nums|tabular-nums[^"]*font-mono/,
        "Task detail side sheet phai su dung font-mono tabular-nums cho audit log va thoi gian"
      );
    });
  });
});
