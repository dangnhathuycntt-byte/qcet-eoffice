import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { StaffTask, SchoolTask } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";
import {
  screenDeliverablesWithAI,
  processTriageDecision,
} from "../src/lib/dacum-workflow-engine";

describe("DACUM AI Executive Review Assistant", () => {
  const mockSchoolTask: SchoolTask = {
    id: "school-task-01",
    title: "Chuyển đổi số giáo trình năm 2026",
    category: "CHUYEN_DOI_SO",
    categoryLabel: "Chuyển đổi số",
    leadAssigneeName: "Trưởng phòng Đào tạo",
    assignedDate: "2026-09-01",
    dueDate: "2026-09-30",
    status: "IN_PROGRESS",
    subTasks: [],
    totalSubTasks: 1,
    completedSubTasks: 0,
    progressPercent: 0,
    coAssignees: [],
  };

  test("scores HIGH_RISK and REQUEST_CHANGES when deliverables are missing or trivial", () => {
    const task: StaffTask = {
      id: "task-01",
      title: "Biên soạn đề cương",
      assigneeName: "Chuyên viên A",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "school-task-01",
      updatedAt: new Date().toISOString(),
      deliverables: [],
      deliverableDescription: "Xong rồi",
    };

    const review = screenDeliverablesWithAI(task, mockSchoolTask);
    assert.equal(review.status, "HIGH_RISK");
    assert.equal(review.suggestedAction, "REQUEST_CHANGES");
    assert.ok(review.complianceScore < 60);
    assert.ok(review.flags.some((f) => f.type === "CRITICAL"));
  });

  test("scores CLEAN and QUICK_APPROVE when deliverables are comprehensive and match DACUM criteria", () => {
    const task: StaffTask = {
      id: "task-02",
      title: "Biên soạn giáo trình Mạng máy tính theo DACUM",
      assigneeName: "Giảng viên B",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-20",
      parentSchoolTaskId: "school-task-01",
      updatedAt: new Date().toISOString(),
      deliverables: [
        {
          id: "deliv-1",
          name: "Giao_trinh_Mang_may_tinh_2026.pdf",
          url: "https://storage.qcet.edu.vn/giao-trinh.pdf",
        },
        {
          id: "deliv-2",
          name: "Bien_ban_nghiem_thu_to_bo_mon.pdf",
          url: "https://storage.qcet.edu.vn/bien-ban.pdf",
        },
      ],
      deliverableDescription:
        "Hoàn thành toàn bộ đề cương chi tiết, giáo trình 120 trang và biên bản nghiệm thu cấp khoa.",
    };

    const review = screenDeliverablesWithAI(task, mockSchoolTask);
    assert.equal(review.status, "CLEAN");
    assert.equal(review.suggestedAction, "QUICK_APPROVE");
    assert.ok(review.complianceScore >= 85);
    assert.ok(review.dacumCriteriaMatched.length >= 2);
  });

  test("flags WARNING when internal due date is within 24 hours of school task deadline", () => {
    const task: StaffTask = {
      id: "task-03",
      title: "Báo cáo tổng kết",
      assigneeName: "Chuyên viên C",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-30",
      parentSchoolTaskId: "school-task-01",
      updatedAt: new Date().toISOString(),
      deliverables: [
        { id: "deliv-3", name: "Bao_cao.pdf", url: "https://storage/bc.pdf" },
      ],
      deliverableDescription: "Báo cáo tổng kết hoàn chỉnh 20 trang.",
    };

    const review = screenDeliverablesWithAI(
      task,
      mockSchoolTask,
      new Date("2026-09-29T12:00:00Z")
    );
    assert.ok(
      review.flags.some(
        (f) => f.type === "WARNING" && f.message.includes("Nhiệm vụ cấp Trường")
      )
    );
  });
});

describe("Cross-Department Triage Queue Processing", () => {
  const managerCNTT: AuthUser = {
    id: "user-mgr-cntt",
    name: "Truong khoa CNTT",
    email: "cntt@qcet.edu.vn",
    role: "MANAGER",
    roleLabel: "Truong khoa",
    department: "Khoa CNTT",
    departmentCode: "K_CNTT",
  };

  const staffOtherDept: AuthUser = {
    id: "user-staff-khac",
    name: "Nhan vien khac",
    email: "staff@qcet.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyen vien",
    department: "Phong Khac",
    departmentCode: "P_KHAC",
  };

  const pendingTriageTask: StaffTask = {
    id: "task-triage-01",
    title: "Phoi hop cu giang vien coi thi tuyen sinh",
    assigneeName: "Chua phan cong",
    status: "NEW",
    dueDate: "2026-10-05",
    parentSchoolTaskId: "school-task-01",
    updatedAt: new Date().toISOString(),
    triageStatus: "PENDING_TRIAGE",
    triageSourceDept: "P_KHTC",
  };

  test("rejects triage action if actor is not MANAGER or ADMIN of target department", () => {
    const result = processTriageDecision(
      pendingTriageTask,
      "ACCEPT",
      staffOtherDept,
      { targetAssigneeId: "staff-01", targetAssigneeName: "Le Van B" }
    );
    assert.equal(result.success, false);
    assert.ok(result.error?.includes("tham quyen"));
  });

  test("successfully accepts triage and reassigns task to internal staff", () => {
    const result = processTriageDecision(
      pendingTriageTask,
      "ACCEPT",
      managerCNTT,
      {
        targetAssigneeId: "staff-cntt-01",
        targetAssigneeName: "Nguyen Van C",
        internalDueDate: "2026-10-04",
      }
    );
    assert.equal(result.success, true);
    assert.equal(result.updatedTask?.triageStatus, "ACCEPTED");
    assert.equal(result.updatedTask?.status, "IN_PROGRESS");
    assert.equal(result.updatedTask?.assigneeName, "Nguyen Van C");
    assert.equal(result.updatedTask?.internalDueDate, "2026-10-04");
  });

  test("requires rejectionReason when declining a triage request", () => {
    const resultNoReason = processTriageDecision(
      pendingTriageTask,
      "REJECT",
      managerCNTT,
      {}
    );
    assert.equal(resultNoReason.success, false);
    assert.ok(resultNoReason.error?.includes("ly do"));

    const resultValid = processTriageDecision(
      pendingTriageTask,
      "REJECT",
      managerCNTT,
      { rejectionReason: "Trung lich bao ve do an tot nghiep." }
    );
    assert.equal(resultValid.success, true);
    assert.equal(resultValid.updatedTask?.triageStatus, "REJECTED");
    assert.equal(resultValid.updatedTask?.status, "BLOCKED");
  });
});
