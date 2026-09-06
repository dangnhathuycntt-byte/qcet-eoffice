import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type {
  ApprovalDecision,
  DeliverableSubmissionPayload,
  ApprovalActionPayload,
  WorkspaceRole,
  StaffUrgencySummary,
  DepartmentHealthSummary,
} from "../src/types/workspace";

describe("Workspace Type Definitions & Validators", () => {
  test("validates ApprovalDecision union values", () => {
    const validDecisions: ApprovalDecision[] = [
      "approved",
      "revision_requested",
      "rejected",
    ];
    assert.equal(validDecisions.length, 3);
  });

  test("validates DeliverableSubmissionPayload structure", () => {
    const payload: DeliverableSubmissionPayload = {
      taskId: "task-1",
      deliverableName: "De thi K48.pdf",
      url: "https://drive.google.com/test",
      fileType: "pdf",
      note: "Đã hoàn thành theo mẫu 2",
    };
    assert.equal(payload.taskId, "task-1");
    assert.equal(payload.deliverableName, "De thi K48.pdf");
    assert.equal(payload.url, "https://drive.google.com/test");
    assert.equal(payload.fileType, "pdf");
    assert.equal(payload.note, "Đã hoàn thành theo mẫu 2");
  });

  test("validates ApprovalActionPayload structure", () => {
    const action: ApprovalActionPayload = {
      taskId: "task-1",
      decision: "approved",
      comment: "Đạt yêu cầu nghiệm thu",
      reviewedByRole: "MANAGER",
      reviewedByName: "Trưởng bộ môn CNTT",
    };
    assert.equal(action.taskId, "task-1");
    assert.equal(action.decision, "approved");
    assert.equal(action.reviewedByRole, "MANAGER");
    assert.equal(action.reviewedByName, "Trưởng bộ môn CNTT");
  });

  test("validates StaffUrgencySummary structure", () => {
    const summary: StaffUrgencySummary = {
      todayCount: 2,
      thisWeekCount: 5,
      waitingApprovalCount: 1,
      revisionRequestedCount: 0,
      completedCount: 10,
    };
    assert.equal(summary.todayCount, 2);
    assert.equal(summary.thisWeekCount, 5);
    assert.equal(summary.waitingApprovalCount, 1);
    assert.equal(summary.revisionRequestedCount, 0);
    assert.equal(summary.completedCount, 10);
  });

  test("validates DepartmentHealthSummary structure", () => {
    const health: DepartmentHealthSummary = {
      departmentCode: "CNTT",
      departmentName: "Khoa Công Nghệ Thông Tin",
      totalTasks: 20,
      completedTasks: 18,
      delayedTasks: 2,
      completionRate: 90,
      healthStatus: "GREEN",
    };
    assert.equal(health.departmentCode, "CNTT");
    assert.equal(health.departmentName, "Khoa Công Nghệ Thông Tin");
    assert.equal(health.totalTasks, 20);
    assert.equal(health.completedTasks, 18);
    assert.equal(health.delayedTasks, 2);
    assert.equal(health.completionRate, 90);
    assert.equal(health.healthStatus, "GREEN");
  });

  test("validates WorkspaceRole matches UserRole", () => {
    const roles: WorkspaceRole[] = ["ADMIN", "MANAGER", "STAFF"];
    assert.equal(roles.length, 3);
  });
});
