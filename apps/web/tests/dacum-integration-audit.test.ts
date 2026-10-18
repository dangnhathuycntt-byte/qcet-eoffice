import { test, describe } from "node:test";
import assert from "node:assert/strict";

import type { AuthUser } from "@qcet/contracts/types/auth";
import type {
  SchoolTask,
  StaffTask,
  DeliverableItem,
  CollaborationRequest,
} from "@qcet/contracts/types/dashboard";
import { validateDeliverableSubmission, transitionStaffTaskStatus, screenDeliverablesWithAI } from "../src/lib/dacum-workflow-engine";

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
