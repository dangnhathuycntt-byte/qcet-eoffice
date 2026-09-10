import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  QCET_DACUM_CHARTS,
  QCET_VTVL_ROLES,
  getDacumDutiesByChartCode,
  getDacumTaskByCode,
  getVtvlRoleByCode,
  calculateTotalDacumHours,
  type DacumChartItem,
  type DacumDutyItem,
  type VtvlRoleItem,
} from "../src/lib/dacum-definitions";
import {
  isDelegationActive,
  canPerformAction,
  resolveSignerDesignation,
} from "../src/lib/delegation-authority-engine";
import { mapPrismaTaskToSchoolTask } from "../src/lib/adapters/task-db-adapter";
import type { DelegationRule } from "../src/types/delegation";

describe("DACUM & VTVL Framework (Nghị định 106/2020 & Ma trận DACUM)", () => {
  describe("1. DACUM Matrix & Occupational Analysis", () => {
    test("ma tran DACUM Khoa CNTT va Khoa Co khi co day du Nhiem vu va Cong viec", () => {
      assert.ok(QCET_DACUM_CHARTS.length >= 2, "Phải có ít nhất 2 bảng biểu DACUM");

      const cnttChart = QCET_DACUM_CHARTS.find((c: DacumChartItem) => c.code === "DACUM_CNTT_2026");
      assert.ok(cnttChart, "Bảng DACUM CNTT phải tồn tại");
      assert.equal(cnttChart.targetRole, "Giảng viên CNTT");
      assert.ok(cnttChart.duties.length >= 4, "Phải có ít nhất 4 nhiệm vụ cốt lõi (Duty)");

      const allTasks = cnttChart.duties.flatMap((d: DacumDutyItem) => d.tasks);
      assert.ok(allTasks.length >= 8, "Phải có ít nhất 8 công việc (Tasks)");

      // Kiểm tra công việc chuẩn mực giảng dạy và đánh giá
      const b1 = getDacumTaskByCode("DACUM_CNTT_2026", "B1");
      assert.ok(b1, "Công việc B1 (Giảng dạy trực tiếp) phải tồn tại");
      assert.equal(b1.code, "B1");
      assert.ok(b1.standardHours > 0, "Phải có định mức giờ chuẩn");
      assert.ok(b1.criteria && b1.criteria.length > 0, "Phải có tiêu chuẩn đánh giá");
      assert.ok(b1.requiredDeliverables && b1.requiredDeliverables.length > 0, "Phải có minh chứng/sản phẩm bàn giao");
    });

    test("tinh tong dinh muc gio chuan DACUM chinh xac", () => {
      const totalHours = calculateTotalDacumHours("DACUM_CNTT_2026");
      assert.ok(totalHours >= 500, `Tổng giờ chuẩn phải đạt định mức năm giảng dạy (thực tế: ${totalHours})`);
    });

    test("tim kiem Duty va Task theo ma dinh danh", () => {
      const duties = getDacumDutiesByChartCode("DACUM_CNTT_2026");
      assert.ok(duties.length > 0);
      assert.equal(duties[0].code, "A");

      const taskA1 = getDacumTaskByCode("DACUM_CNTT_2026", "A1");
      assert.ok(taskA1);
      assert.match(taskA1.title, /đề cương/i);
    });
  });

  describe("2. VTVL Catalog theo Nghi dinh 106/2020 & Thong tu 12/2022", () => {
    test("danh muc VTVL chia dung 4 nhom vi tri viec lam phap ly", () => {
      const groups = new Set(QCET_VTVL_ROLES.map((r: VtvlRoleItem) => r.category));
      assert.ok(groups.has("Lãnh đạo, quản lý"), "Nhóm lãnh đạo quản lý");
      assert.ok(groups.has("Nghiệp vụ chuyên ngành"), "Nhóm chuyên môn giảng dạy/nghiên cứu");
      assert.ok(groups.has("Nghiệp vụ chuyên môn dùng chung"), "Nhóm kế toán/hành chính/nhân sự");
      assert.ok(groups.has("Hỗ trợ, phục vụ"), "Nhóm văn thư/CNTT hỗ trợ/kỹ thuật");
    });

    test("truy xuat VTVL Role theo ma dinh danh", () => {
      const lecturer = getVtvlRoleByCode("VTVL_GV_CHUYEN_NGANH");
      assert.ok(lecturer);
      assert.equal(lecturer.title, "Giảng viên chuyên ngành");
      assert.equal(lecturer.standardRank, "Giảng viên (hạng III) - V.07.01.03");
      assert.ok(lecturer.requiredDuties.length >= 3);

      const dean = getVtvlRoleByCode("VTVL_TRUONG_KHOA");
      assert.ok(dean);
      assert.equal(dean.category, "Lãnh đạo, quản lý");
    });
  });

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
      assert.equal(isDelegationActive(activeRule, "2026-10-01"), false, "Đã quá hạn");
    });

    test("kiem tra quyen thuc thi theo pham vi (Scope)", () => {
      // Đúng người, đúng đơn vị, đúng quyền
      const allowed = canPerformAction({
        user: { id: "deputy-k_cntt", role: "STAFF" },
        requiredScope: "DACUM_REVIEW_STEP1",
        departmentCode: "K_CNTT",
        delegations: [activeRule],
        referenceDate: "2026-09-09",
      });
      assert.equal(allowed, true);

      // Sai đơn vị -> từ chối
      const deniedDept = canPerformAction({
        user: { id: "deputy-k_cntt", role: "STAFF" },
        requiredScope: "DACUM_REVIEW_STEP1",
        departmentCode: "K_CK",
        delegations: [activeRule],
        referenceDate: "2026-09-09",
      });
      assert.equal(deniedDept, false);

      // Vượt quá phạm vi ủy quyền
      const deniedScope = canPerformAction({
        user: { id: "deputy-k_cntt", role: "STAFF" },
        requiredScope: "FULL_DEPARTMENT_APPROVAL",
        departmentCode: "K_CNTT",
        delegations: [activeRule],
        referenceDate: "2026-09-09",
      });
      assert.equal(deniedScope, false);
    });

    test("chuan hoa the thuc ky thua lenh / ky thay (KT./TL.) theo Nghi dinh 30/2020", () => {
      // Ký thay Trưởng khoa: KT. TRƯỞNG KHOA
      const designation = resolveSignerDesignation({
        grantorRole: "Trưởng khoa",
        granteeName: "ThS. Lê Hoàng Nam",
        delegation: activeRule,
      });
      assert.equal(designation.prefix, "KT. TRƯỞNG KHOA");
      assert.equal(designation.signerName, "ThS. Lê Hoàng Nam");
      assert.equal(designation.documentRef, "142/QĐ-CĐKTCN");

      // Ký thừa lệnh Hiệu trưởng (BGH ủy quyền Trưởng phòng Đào tạo)
      const bghRule: DelegationRule = {
        id: "del-02",
        grantorId: "rector",
        grantorName: "ThS. Phạm Văn Tường",
        grantorRole: "ADMIN",
        granteeId: "dean-training",
        granteeName: "ThS. Lê Hoàng Nam",
        granteeRole: "MANAGER",
        departmentCode: "P_DT",
        scope: "DOCUMENT_SIGN_LEVEL2",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        status: "ACTIVE",
        reason: "Ủy quyền ký giấy xác nhận đào tạo",
        documentRef: "88/QĐ-CĐKTCN",
        createdAt: "2026-09-01T00:00:00.000Z",
      };

      const rectorDesignation = resolveSignerDesignation({
        grantorRole: "Hiệu trưởng",
        granteeName: "ThS. Lê Hoàng Nam",
        delegation: bghRule,
      });
      assert.equal(rectorDesignation.prefix, "TL. HIỆU TRƯỞNG");
      assert.equal(rectorDesignation.documentRef, "88/QĐ-CĐKTCN");
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
        department: { name: "Khoa Công nghệ thông tin" },
        assignees: [
          {
            roleInTask: "PRIMARY_OWNER",
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
