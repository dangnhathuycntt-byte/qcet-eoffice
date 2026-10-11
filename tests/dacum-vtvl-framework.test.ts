import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isDelegationActive } from "../src/lib/delegation-authority-engine";
import { mapPrismaTaskToSchoolTask } from "../src/lib/adapters/task-db-adapter";
import type { DelegationRule } from "../src/types/delegation";

describe("DACUM & VTVL Framework (Nghị định 106/2020 & Ma trận DACUM)", () => {

  describe("3. Delegation Authority Engine (Nghị định 30/2020 & Quyết định ủy quyền)", () => {
    const activeRule: DelegationRule = {
      id: "del-01",
      grantorId: "leader-k_cntt",
      grantorName: "TS. Nguyễn Ngọc Vinh",
      grantorRole: "MANAGER",
      granteeId: "deputy-k_cntt",
      granteeName: "ThS. Lê Hoàng Nam",
      granteeRole: "STAFF",
      departmentCode: "K_CNTT",
      scope: "DACUM_REVIEW_STEP1",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      status: "ACTIVE",
      reason: "Ủy quyền phụ trách chuyên môn và thẩm định DACUM đợt 1",
      documentRef: "142/QĐ-CĐKTCN",
      createdAt: "2026-09-01T00:00:00.000Z",
    };

    test("kiem tra hieu luc uy quyen theo moc thoi gian tham chieu", () => {
      assert.equal(isDelegationActive(activeRule, "2026-09-09"), true, "Phải active trong khoảng ngày");
      assert.equal(isDelegationActive(activeRule, "2026-08-30"), false, "Chưa đến ngày bắt đầu");
      assert.equal(isDelegationActive(activeRule, "2026-10-01"), false, "Đã trễ hạn");
    });
  });

  describe("4. Task DB Adapter DACUM Integration", () => {
    test("chuyen doi Prisma Task kem DacumTaskDef sang SchoolTask chuan xac", () => {
      const mockPrismaTask = {
        id: "task-dacum-101",
        code: "TSK-CNTT-01",
        title: "Thực hiện giờ giảng chuyên ngành Lập trình Web",
        description: "Giảng dạy thực hành môn Lập trình Web 60 tiết",
        status: "IN_PROGRESS",
        priority: "HIGH",
        progressPercent: 65,
        academicMonth: 9,
        dueDate: new Date("2026-09-30T17:00:00.000Z"),
        scope: "DEPARTMENT",
        leadUnit: { id: "k-cntt", name: "Khoa Công nghệ thông tin" },
        actors: [
          {
            userId: "user-1",
            role: "DRI",
            isPrimaryDRI: true,
            user: { id: "user-1", name: "Nguyễn Văn A" },
          },
        ],
        dacumTaskDefId: "task-def-b1",
        dacumTaskDef: {
          id: "task-def-b1",
          code: "B1",
          title: "Thực hiện giờ giảng lý thuyết và thực hành trên lớp",
          criteria: "Đúng đề cương, đánh giá theo thang rubric, ghi sổ đầu bài đầy đủ",
          tools: "Máy chiếu, slide bài giảng, phần mềm chuyên môn",
          requiredDeliverables: "Sổ lên lớp, đề cương môn học đã ký duyệt",
          standardHours: 240,
          duty: {
            id: "duty-b",
            code: "B",
            title: "Nhiệm vụ B: Giảng dạy và Đánh giá người học",
          },
        },
      };

      const schoolTask = mapPrismaTaskToSchoolTask(mockPrismaTask as any);

      assert.equal(schoolTask.id, "task-dacum-101");
      assert.equal(schoolTask.code, "TSK-CNTT-01");
      assert.equal(schoolTask.assignedTo, "Nguyễn Văn A");
      assert.equal(schoolTask.dacumTaskDefId, "task-def-b1");
      assert.ok(schoolTask.dacumTaskDef);
      assert.equal(schoolTask.dacumTaskDef?.code, "B1");
      assert.equal(schoolTask.dacumTaskDef?.standardHours, 240);
      assert.equal(schoolTask.dacumTaskDef?.dutyTitle, "Nhiệm vụ B: Giảng dạy và Đánh giá người học");
    });
  });
});
