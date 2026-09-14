import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { canUserApproveTask } from "../src/lib/delegation-authority-engine";
import type { DelegationRule } from "../src/types/delegation";

describe("Task 3: Stanford Authority Delegation UI Integration Tests", () => {
  describe("4. Business Logic Validation: canUserApproveTask", () => {
    const mockDelegations: DelegationRule[] = [
      {
        id: "del-cntt-001",
        grantorId: "staff-vinh-nn",
        grantorName: "TS. Nguyễn Ngọc Vinh",
        grantorRole: "MANAGER",
        granteeId: "staff-pho-lv",
        granteeName: "ThS. Lê Văn Phó",
        granteeRole: "STAFF",
        departmentCode: "K_CNTT",
        scope: "DACUM_REVIEW_STEP1",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        status: "ACTIVE",
        reason: "Ủy quyền thẩm định DACUM",
        createdAt: "2026-09-01T08:00:00Z",
      },
    ];

    test("can bo duoc uy quyen (Le Van Pho) co quyen duyet nhiem vu cua don vi", () => {
      const result = canUserApproveTask({
        actor: {
          id: "staff-pho-lv",
          name: "ThS. Lê Văn Phó",
          role: "STAFF",
          departmentCode: "K_CNTT",
        },
        task: {
          id: "task-dacum-01",
          departmentCode: "K_CNTT",
          assigneeId: "staff-another-person",
        },
        activeDelegations: mockDelegations,
      });

      assert.equal(result.allowed, true);
      assert.equal(result.isDelegated, true);
      assert.equal(result.rule?.grantorName, "TS. Nguyễn Ngọc Vinh");
    });

    test("vi pham Separation of Duties khi chinh nguoi thuc hien tu duyet", () => {
      const result = canUserApproveTask({
        actor: {
          id: "staff-pho-lv",
          name: "ThS. Lê Văn Phó",
          role: "STAFF",
          departmentCode: "K_CNTT",
        },
        task: {
          id: "task-dacum-02",
          departmentCode: "K_CNTT",
          assigneeId: "staff-pho-lv",
        },
        activeDelegations: mockDelegations,
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason || "", /Separation of Duties/);
    });

    test("truong don vi khong the tu duyet viec do chinh minh thuc hien (Separation of Duties)", () => {
      const result = canUserApproveTask({
        actor: {
          id: "staff-vinh-nn",
          name: "TS. Nguyễn Ngọc Vinh",
          role: "MANAGER",
          departmentCode: "K_CNTT",
        },
        task: {
          id: "task-dacum-manager-own",
          departmentCode: "K_CNTT",
          assigneeId: "staff-vinh-nn",
        },
        activeDelegations: mockDelegations,
      });

      assert.equal(result.allowed, false);
      assert.match(result.reason || "", /Separation of Duties/);
    });
  });
});
