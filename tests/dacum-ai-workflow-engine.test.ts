import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { StaffTask, SchoolTask } from "../src/types/dashboard";
import { screenDeliverablesWithAI } from "../src/lib/dacum-workflow-engine";

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
