// tests/dacum-ai-workflow-types.test.ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type {
  StaffTask,
  AIReviewSummary,
  EscalationMeta,
  TriageStatus,
  AIRiskStatus,
  AISuggestedAction,
} from "../src/types/dashboard";

describe("DACUM AI Workflow Types Verification", () => {
  test("defines all required AI review and escalation types cleanly", () => {
    const aiReview: AIReviewSummary = {
      status: "CLEAN",
      executiveSummary: "Minh chung day du theo chuan DACUM.",
      complianceScore: 95,
      dacumCriteriaMatched: ["De cuong chi tiet", "Bien ban hop bo mon"],
      flags: [{ type: "INFO", message: "Da nop dung han." }],
      suggestedAction: "QUICK_APPROVE",
      analyzedAt: new Date().toISOString(),
      suggestedFeedback: "Nghiem thu dat yeu cau.",
    };

    const escalation: EscalationMeta = {
      submittedForReviewAt: new Date().toISOString(),
      reviewDeadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      isEscalated: false,
    };

    const task: StaffTask = {
      id: "test-task-01",
      title: "Xay dung ngan hang de thi mon Mang may tinh",
      assigneeName: "Nguyen Van A",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-30",
      parentSchoolTaskId: "school-task-01",
      updatedAt: new Date().toISOString(),
      triageStatus: "ACCEPTED",
      aiReview,
      escalation,
    };

    assert.equal(task.aiReview?.status, "CLEAN");
    assert.equal(task.escalation?.isEscalated, false);
    assert.equal(task.triageStatus, "ACCEPTED");
  });
});
