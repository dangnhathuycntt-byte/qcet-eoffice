import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  findDepartment,
  validateDelegationForm,
  DELEGATION_SCOPES,
  type DelegationFormData,
} from "../src/components/dashboard/delegation-management-modal";
import { QCET_DEPARTMENTS } from "../src/components/org/organization-tree";

describe("DelegationManagementModal Unit & Static Contract Tests", () => {
  describe("1. Department and Leader Resolution Logic", () => {
    test("tim dung truong don vi tu ma phong ban CNTT", () => {
      const dept = findDepartment("CNTT");
      assert.ok(dept, "Phải tìm thấy đơn vị từ mã CNTT");
      assert.equal(dept?.code, "K_CNTT");
      assert.equal(dept?.leaderName, "TS. Nguyễn Ngọc Vinh");
      assert.equal(dept?.leaderRole, "Trưởng khoa");
    });

    test("tim dung truong don vi tu ma chuan K_CNTT", () => {
      const dept = findDepartment("K_CNTT");
      assert.ok(dept);
      assert.equal(dept?.leaderName, "TS. Nguyễn Ngọc Vinh");
    });

    test("tim dung lanh dao BGH", () => {
      const dept = findDepartment("BGH");
      assert.ok(dept);
      assert.ok(
        dept?.leaderName === "ThS. Phạm Văn Tường" ||
        dept?.leaderName === "TS. Nguyễn Minh Tuấn"
      );
      assert.equal(dept?.leaderRole, "Hiệu trưởng");
    });

    test("tim dung cac don vi phong ban khac (HCQT, DCC)", () => {
      const hcqt = findDepartment("HCQT");
      assert.ok(hcqt);
      assert.equal(hcqt?.code, "P_HCQT");
      assert.ok(hcqt?.leaderName);

      const dcc = findDepartment("DCC");
      assert.ok(dcc);
      assert.ok(dcc?.code === "TT_STT" || dcc?.code === "TT_DCC");
      assert.ok(dcc?.leaderName);
    });

    test("tra ve undefined khi ma don vi khong hop le", () => {
      assert.equal(findDepartment(""), undefined);
      assert.equal(findDepartment("NON_EXISTING_CODE_XYZ"), undefined);
    });
  });

  describe("2. Form Validation & Separation of Duties", () => {
    const grantorName = "TS. Nguyễn Ngọc Vinh";

    test("bat loi khi thieu thong tin bat buoc", () => {
      const invalidData: DelegationFormData = {
        granteeName: "",
        granteeRole: "STAFF",
        scope: "DACUM_REVIEW_STEP1",
        startDate: "",
        endDate: "",
        reason: "",
      };

      const errors = validateDelegationForm(invalidData, grantorName);
      assert.ok(errors.granteeName, "Phải có lỗi thiếu tên người được ủy quyền");
      assert.ok(errors.startDate, "Phải có lỗi thiếu ngày bắt đầu");
      assert.ok(errors.endDate, "Phải có lỗi thiếu ngày kết thúc");
      assert.ok(errors.reason, "Phải có lỗi thiếu căn cứ lý do");
    });

    test("ngan chan tu uy quyen cho chinh minh (Self-Delegation Prevention)", () => {
      const selfDelegationData: DelegationFormData = {
        granteeName: "TS. Nguyễn Ngọc Vinh",
        granteeRole: "MANAGER",
        scope: "FULL_DEPARTMENT_APPROVAL",
        startDate: "2025-04-01",
        endDate: "2025-04-30",
        reason: "Di cong tac nuoc ngoai",
      };

      const errors = validateDelegationForm(selfDelegationData, grantorName);
      assert.ok(errors.granteeName, "Phải chặn người ủy quyền tự ủy quyền cho chính mình");
      assert.match(errors.granteeName, /phân lập thẩm quyền/i);
    });

    test("kiem tra tinh hop le cua khoang thoi gian hieu luc (startDate <= endDate)", () => {
      const invalidDatesData: DelegationFormData = {
        granteeName: "ThS. Tran Van B",
        granteeRole: "STAFF",
        scope: "TASK_ASSIGNMENT",
        startDate: "2025-05-10",
        endDate: "2025-05-01", // truoc startDate
        reason: "Phu trach cong viec khoa",
      };

      const errors = validateDelegationForm(invalidDatesData, grantorName);
      assert.ok(errors.endDate, "Phải báo lỗi khi ngày kết thúc sớm hơn ngày bắt đầu");
    });

    test("du lieu hop le vuot qua kiem tra khong co loi", () => {
      const validData: DelegationFormData = {
        granteeName: "ThS. Tran Van B",
        granteeRole: "STAFF",
        scope: "DACUM_REVIEW_STEP1",
        startDate: "2025-04-01",
        endDate: "2025-04-30",
        reason: "Uy quyen tham dinh ho so DACUM dot 1 nam 2025",
      };

      const errors = validateDelegationForm(validData, grantorName);
      assert.equal(Object.keys(errors).length, 0, "Không được có lỗi với dữ liệu hợp lệ");
    });
  });

  describe("3. Delegation Scope Configuration", () => {
    test("dinh nghia du 3 pham vi uy quyen chuan", () => {
      const scopeIds = DELEGATION_SCOPES.map((s) => s.id);
      assert.ok(scopeIds.includes("DACUM_REVIEW_STEP1"));
      assert.ok(scopeIds.includes("TASK_ASSIGNMENT"));
      assert.ok(scopeIds.includes("FULL_DEPARTMENT_APPROVAL"));
      assert.equal(scopeIds.length, 3);
    });
  });

  describe("4. Source Code Contract & Anti-Slop Audit", () => {
    const modalFilePath = path.resolve(
      __dirname,
      "../src/components/dashboard/delegation-management-modal.tsx"
    );
    const content = fs.readFileSync(modalFilePath, "utf-8");

    test("file bat dau bang 'use client'", () => {
      assert.match(content, /^["']use client["']/);
    });

    test("chua dinh nghia interface DelegationManagementModalProps chuan", () => {
      assert.match(content, /export interface DelegationManagementModalProps/);
      assert.match(content, /isOpen:\s*boolean/);
      assert.match(content, /onClose:\s*\(\)\s*=>\s*void/);
      assert.match(content, /departmentCode:\s*string/);
      assert.match(content, /delegations:\s*DelegationRule\[\]/);
      assert.match(content, /onSaveDelegation:\s*\(rule:\s*Omit<DelegationRule,\s*["']id["']\s*\|\s*["']createdAt["']>\)\s*=>\s*void/);
      assert.match(content, /onRevokeDelegation:\s*\(ruleId:\s*string\)\s*=>\s*void/);
    });

    test("nhap cac icon chuan tu lucide-react voi strokeWidth={1.5}", () => {
      const requiredIcons = [
        "X",
        "ShieldAlert",
        "Calendar",
        "UserCheck",
        "Plus",
        "AlertCircle",
        "Trash2",
      ];
      for (const icon of requiredIcons) {
        assert.ok(
          content.includes(icon),
          `Component phải import và sử dụng icon ${icon} từ lucide-react`
        );
      }
      assert.match(
        content,
        /strokeWidth=\{1\.5\}/,
        "Icon phải được cấu hình với strokeWidth={1.5}"
      );
    });

    test("tuyet doi 0% emoji trong file code", () => {
      const emojiRegex =
        /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F680}-\u{1F6C5}\u{1F6CB}-\u{1F6D0}\u{1F6E0}-\u{1F6E5}\u{1F6F0}-\u{1F6F3}]/gu;
      const matches = [...content.matchAll(emojiRegex)];
      assert.equal(
        matches.length,
        0,
        `Phat hien ${matches.length} emoji trong delegation-management-modal.tsx: ${matches
          .map((m) => m[0])
          .join(", ")}`
      );
    });

    test("chua nut goi onSaveDelegation va onRevokeDelegation", () => {
      assert.match(
        content,
        /onSaveDelegation\s*\(/,
        "Component phải có lời gọi đến onSaveDelegation"
      );
      assert.match(
        content,
        /onRevokeDelegation\s*\(/,
        "Component phải có lời gọi đến onRevokeDelegation"
      );
    });

    test("dinh dang so, ngay thang, ma don vi bang font-mono tabular-nums", () => {
      assert.match(
        content,
        /font-mono\s+tabular-nums/,
        "Component phải sử dụng font-mono tabular-nums cho mã và số liệu"
      );
    });
  });
});
