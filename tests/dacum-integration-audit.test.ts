import { test, describe } from "node:test";
import assert from "node:assert/strict";

import type { AuthUser } from "../src/types/auth";
import type {
  SchoolTask,
  StaffTask,
  DeliverableItem,
  CollaborationRequest,
} from "../src/types/dashboard";
import {
  canAssignStaffTask,
  validateDeliverableSubmission,
  transitionStaffTaskStatus,
  calculateSchoolTaskRollup,
  processTriageDecision,
  evaluateReviewEscalation,
  screenDeliverablesWithAI,
} from "../src/lib/dacum-workflow-engine";

describe("DACUM 3-Tier Workflow End-to-End Integration & Audit", () => {
  // Key Actors in the 3-Tier Hierarchy (Nghị định 232/2026/NĐ-CP)
  const hieuTruongBGH: AuthUser = {
    id: "user-bgh-01",
    name: "Ban Giám Hiệu QCET",
    email: "bgh@qcet.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
  };

  const chuyenVienVinh: AuthUser = {
    id: "user-staff-vinh",
    name: "Nguyễn Ngọc Vinh",
    email: "vinh.nn@qcet.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
  };

  test("BGH Emergency Direct Assignment Bypass adheres to Decree 232 logging", () => {
    const directAdminAssign = canAssignStaffTask(
      hieuTruongBGH,
      chuyenVienVinh.departmentCode,
      true // isEmergencyBypass
    );
    assert.equal(directAdminAssign.allowed, true);
    assert.equal(directAdminAssign.isBypassWarning, true);
    assert.ok(
      directAdminAssign.reason?.includes("Chỉ đạo khẩn cấp từ Ban Giám hiệu")
    );
  });
});

describe("DACUM Full 6-Phase E2E Lifecycle: AI Review, Triage Queue, and Escalation", () => {
  // Actors
  const bghAdmin: AuthUser = {
    id: "user-bgh-admin",
    name: "Nguyen Van Thanh",
    email: "thanh.nv@qcet.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giam hieu",
    department: "Ban Giam hieu",
    departmentCode: "BGH",
  };

  const truongKhoaCNTT: AuthUser = {
    id: "user-mgr-cntt-e2e",
    name: "Le Hoang Nam",
    email: "nam.lh@qcet.edu.vn",
    role: "MANAGER",
    roleLabel: "Truong khoa",
    department: "Khoa Cong nghe thong tin",
    departmentCode: "CNTT",
  };

  const staffVinh: AuthUser = {
    id: "user-staff-vinh-e2e",
    name: "Tran Ngoc Vinh",
    email: "vinh.tn@qcet.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyen vien",
    department: "Khoa Cong nghe thong tin",
    departmentCode: "CNTT",
  };

  test("Phase 1-6: Cross-dept triage, AI review, escalation, approval, and rollup lifecycle", () => {
    // --- Phase 1: Cross-dept task created -> enters PENDING_TRIAGE ---
    const crossDeptTask: StaffTask = {
      id: "staff-task-e2e-triage-01",
      title: "Phat trien module API lien thong CSDL tuyen sinh",
      assigneeName: "",
      status: "NEW",
      dueDate: "2026-09-20",
      parentSchoolTaskId: "school-task-e2e-01",
      updatedAt: new Date("2026-09-01").toISOString(),
      requiresReview: true,
      departmentCode: "CNTT",
      triageStatus: "PENDING_TRIAGE",
      triageSourceDept: "DAO_TAO",
      triageRequestedBy: "Truong Phong Dao Tao",
    };

    assert.equal(crossDeptTask.triageStatus, "PENDING_TRIAGE");
    assert.equal(crossDeptTask.triageSourceDept, "DAO_TAO");
    assert.equal(crossDeptTask.departmentCode, "CNTT");
    assert.equal(crossDeptTask.status, "NEW");

    // --- Phase 2: Target dept head accepts via processTriageDecision -> IN_PROGRESS ---
    const triageResult = processTriageDecision(
      crossDeptTask,
      "ACCEPT",
      truongKhoaCNTT,
      {
        targetAssigneeId: staffVinh.id,
        targetAssigneeName: staffVinh.name,
        internalDueDate: "2026-09-18",
      }
    );

    assert.equal(triageResult.success, true);
    assert.ok(triageResult.updatedTask);
    const acceptedTask = triageResult.updatedTask!;
    assert.equal(acceptedTask.triageStatus, "ACCEPTED");
    assert.equal(acceptedTask.status, "IN_PROGRESS");
    assert.equal(acceptedTask.assigneeName, staffVinh.name);
    assert.equal(acceptedTask.internalDueDate, "2026-09-18");

    // --- Phase 3: Staff submits deliverables -> NEEDS_REVIEW, aiReview generated, escalation SLA initialized ---
    const deliverables: DeliverableItem[] = [
      {
        id: "del-api-src",
        name: "Ma nguon API lien thong CSDL tuyen sinh",
        url: "https://git.qcet.edu.vn/cntt/api-tuyen-sinh",
        fileType: "repository",
        submittedAt: new Date("2026-09-15").toISOString(),
      },
      {
        id: "del-swagger-doc",
        name: "Tai lieu tich hop Swagger API",
        url: "https://docs.qcet.edu.vn/swagger/tuyen-sinh-api",
        fileType: "document",
        submittedAt: new Date("2026-09-15").toISOString(),
      },
      {
        id: "del-security-report",
        name: "Bao cao kiem thu bao mat",
        url: "https://docs.qcet.edu.vn/security/tuyen-sinh-pentest",
        fileType: "pdf",
        submittedAt: new Date("2026-09-15").toISOString(),
      },
    ];

    const submitResult = transitionStaffTaskStatus(
      acceptedTask,
      "NEEDS_REVIEW",
      staffVinh,
      {
        deliverables,
        notes: "Da hoan thanh 3 san pham minh chung theo yeu cau phoi hop. De nghi lanh dao don vi tham dinh va nghiem thu.",
      }
    );

    assert.equal(submitResult.success, true);
    assert.ok(submitResult.updatedTask);
    const reviewTask = submitResult.updatedTask!;
    assert.equal(reviewTask.status, "NEEDS_REVIEW");
    assert.equal(reviewTask.deliverables?.length, 3);

    // Verify AI review was auto-generated
    assert.ok(reviewTask.aiReview, "aiReview must be generated when transitioning to NEEDS_REVIEW");
    assert.ok(reviewTask.aiReview!.analyzedAt, "aiReview must have analyzedAt timestamp");
    assert.ok(
      ["CLEAN", "NEEDS_ATTENTION", "HIGH_RISK"].includes(reviewTask.aiReview!.status),
      "aiReview status must be a valid AIRiskStatus"
    );
    assert.ok(
      ["QUICK_APPROVE", "REQUEST_CHANGES", "MANUAL_INSPECT"].includes(reviewTask.aiReview!.suggestedAction),
      "aiReview suggestedAction must be a valid AISuggestedAction"
    );
    assert.ok(typeof reviewTask.aiReview!.complianceScore === "number");
    assert.ok(reviewTask.aiReview!.complianceScore >= 0 && reviewTask.aiReview!.complianceScore <= 100);

    // Verify escalation SLA was initialized
    assert.ok(reviewTask.escalation, "escalation metadata must be initialized on NEEDS_REVIEW");
    assert.ok(reviewTask.escalation!.submittedForReviewAt, "submittedForReviewAt must be set");
    assert.ok(reviewTask.escalation!.reviewDeadline, "reviewDeadline must be set");
    assert.equal(reviewTask.escalation!.isEscalated, false, "Must not be escalated immediately");

    // Verify SLA deadline is ~48h from submission
    const submittedAt = new Date(reviewTask.escalation!.submittedForReviewAt!).getTime();
    const deadline = new Date(reviewTask.escalation!.reviewDeadline!).getTime();
    const slaHoursActual = (deadline - submittedAt) / (1000 * 3600);
    assert.ok(
      slaHoursActual >= 47.9 && slaHoursActual <= 48.1,
      `SLA deadline must be ~48h from submission, got ${slaHoursActual}h`
    );

    // --- Phase 4: 48h+ passes -> evaluateReviewEscalation triggers isEscalated=true ---
    const futureTime = new Date(deadline + 60 * 60 * 1000); // 1h past deadline
    const escalatedTask = evaluateReviewEscalation(reviewTask, futureTime);

    assert.equal(escalatedTask.escalation?.isEscalated, true, "Must be escalated after deadline");
    assert.ok(escalatedTask.escalation?.escalatedAt, "escalatedAt must be set");
    assert.equal(escalatedTask.escalation?.escalatedToRole, "ADMIN");
    assert.ok(
      escalatedTask.escalation?.escalationNote?.includes("Trễ hạn thẩm định") ||
      escalatedTask.escalation?.escalationNote?.includes("Qua han tham dinh"),
      "Escalation note must reference overdue review"
    );

    // Verify non-escalated case within SLA window
    const withinSlaTime = new Date(submittedAt + 24 * 3600 * 1000); // 24h in, still within 48h
    const notEscalated = evaluateReviewEscalation(reviewTask, withinSlaTime);
    assert.equal(notEscalated.escalation?.isEscalated, false, "Must NOT escalate within SLA window");

    // --- Phase 5: BGH ADMIN quick approval -> COMPLETED ---
    const approvalResult = transitionStaffTaskStatus(
      escalatedTask,
      "COMPLETED",
      bghAdmin
    );

    assert.equal(approvalResult.success, true);
    assert.ok(approvalResult.updatedTask);
    const completedTask = approvalResult.updatedTask!;
    assert.equal(completedTask.status, "COMPLETED");

    // --- Phase 6: calculateSchoolTaskRollup verifies rollup ---
    const schoolTask: SchoolTask = {
      id: "school-task-e2e-01",
      title: "Chuyen doi so cong tac Tuyen sinh va Quan ly Dao tao 2026",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyen doi so",
      leadAssigneeName: "Truong Phong Dao Tao",
      coAssignees: [truongKhoaCNTT.name],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      subTasks: [completedTask],
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 0,
    };

    const rollup = calculateSchoolTaskRollup(schoolTask);
    assert.equal(rollup.progressPercent, 100, "All sub-tasks completed -> 100%");
    assert.equal(rollup.completedSubTasks, 1);
    assert.equal(rollup.totalSubTasks, 1);
    assert.equal(
      rollup.calculatedStatus,
      "PENDING_EXECUTIVE_APPROVAL",
      "School task at 100% with IN_PROGRESS status rolls up to PENDING_EXECUTIVE_APPROVAL"
    );

    // Verify COMPLETED school task stays COMPLETED at 100%
    const completedSchoolTask: SchoolTask = { ...schoolTask, status: "COMPLETED" };
    const completedRollup = calculateSchoolTaskRollup(completedSchoolTask);
    assert.equal(completedRollup.calculatedStatus, "COMPLETED");
    assert.equal(completedRollup.progressPercent, 100);
  });

  test("Triage rejection requires mandatory reason", () => {
    const pendingTask: StaffTask = {
      id: "staff-task-triage-reject",
      title: "Kiem thu bao mat he thong",
      assigneeName: "",
      status: "NEW",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "school-task-e2e-01",
      updatedAt: new Date("2026-09-01").toISOString(),
      departmentCode: "CNTT",
      triageStatus: "PENDING_TRIAGE",
    };

    const bghActor: AuthUser = {
      id: "user-bgh-admin",
      name: "Nguyen Van Thanh",
      email: "thanh.nv@qcet.edu.vn",
      role: "ADMIN",
      roleLabel: "Ban Giam hieu",
      department: "Ban Giam hieu",
      departmentCode: "BGH",
    };

    // Reject without reason must fail
    const noReasonResult = processTriageDecision(pendingTask, "REJECT", bghActor, {});
    assert.equal(noReasonResult.success, false);
    assert.ok(noReasonResult.error?.toLowerCase().includes("lý do") || noReasonResult.error?.toLowerCase().includes("ly do"));

    // Reject with reason must succeed
    const withReasonResult = processTriageDecision(pendingTask, "REJECT", bghActor, {
      rejectionReason: "Khoa CNTT khong co nhan su phu hop trong thoi gian yeu cau.",
    });
    assert.equal(withReasonResult.success, true);
    assert.equal(withReasonResult.updatedTask?.triageStatus, "REJECTED");
    assert.equal(withReasonResult.updatedTask?.status, "BLOCKED");
  });

  test("Staff cannot self-approve DACUM-required task to COMPLETED", () => {
    const reviewTask: StaffTask = {
      id: "staff-task-self-approve",
      title: "Xay dung ngan hang de thi",
      assigneeName: "Tran Ngoc Vinh",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "school-task-e2e-01",
      updatedAt: new Date("2026-09-10").toISOString(),
      requiresReview: true,
      departmentCode: "CNTT",
    };

    const staffActor: AuthUser = {
      id: "user-staff-vinh-e2e",
      name: "Tran Ngoc Vinh",
      email: "vinh.tn@qcet.edu.vn",
      role: "STAFF",
      roleLabel: "Chuyen vien",
      department: "Khoa Cong nghe thong tin",
      departmentCode: "CNTT",
    };

    const selfApprove = transitionStaffTaskStatus(reviewTask, "COMPLETED", staffActor);
    assert.equal(selfApprove.success, false);
    assert.ok(selfApprove.error?.includes("DACUM"));
  });

  test("screenDeliverablesWithAI produces valid summary structure", () => {
    const task: StaffTask = {
      id: "staff-task-ai-screen",
      title: "Bao cao kiem thu bao mat he thong",
      assigneeName: "Tran Ngoc Vinh",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "school-task-e2e-01",
      updatedAt: new Date("2026-09-14").toISOString(),
      deliverables: [
        { id: "d1", name: "Bao cao kiem thu", url: "https://docs.qcet.edu.vn/test-report", fileType: "pdf" },
      ],
      deliverableDescription: "Da hoan thanh kiem thu bao mat theo quy dinh nghi dinh 232 va bao cao nghiem thu.",
    };

    const review = screenDeliverablesWithAI(task);
    assert.ok(review.analyzedAt);
    assert.ok(typeof review.complianceScore === "number");
    assert.ok(review.complianceScore >= 0 && review.complianceScore <= 100);
    assert.ok(["CLEAN", "NEEDS_ATTENTION", "HIGH_RISK"].includes(review.status));
    assert.ok(["QUICK_APPROVE", "REQUEST_CHANGES", "MANUAL_INSPECT"].includes(review.suggestedAction));
    assert.ok(typeof review.executiveSummary === "string" && review.executiveSummary.length > 0);
    assert.ok(Array.isArray(review.dacumCriteriaMatched));
    assert.ok(Array.isArray(review.flags));
  });
});
