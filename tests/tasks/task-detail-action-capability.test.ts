import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  TaskDetailSideSheet,
  deriveTaskDetailCapabilities,
  resolveTaskAssigneeId,
  isTaskCompletedLifecycle,
} from "../../src/components/dashboard/task-detail-side-sheet";
import type { AuthUser } from "../../src/types/auth";
import type { StaffTask, SchoolTask } from "../../src/types/dashboard";

/**
 * Shard p2-detail — Task Detail decision capability + truthful history.
 *
 * These tests pin the decision-first contract of the rebuilt detail surface:
 * C2/C11 (one capability result drives the entry point), T20 (capability-driven
 * review: reviewers review, submitters never approve, completed shows no review
 * CTA), T07 (no lifecycle bypass via generic status UI), T16 (reading order),
 * T17 (single consolidated child CTA) and T18 (audit vs derived truthfulness).
 */

const adminUser: AuthUser = {
  id: "admin-1",
  name: "Hiệu trưởng",
  email: "bgh@cdktcnqn.edu.vn",
  role: "ADMIN",
  roleLabel: "Ban Giám hiệu",
  department: "Ban Giám hiệu",
  departmentCode: "BGH",
};

const managerUser: AuthUser = {
  id: "manager-1",
  name: "Trần Hùng",
  email: "daotao@cdktcnqn.edu.vn",
  role: "MANAGER",
  roleLabel: "Trưởng phòng Đào tạo",
  department: "Phòng Đào tạo & QLKH",
  departmentCode: "DAO_TAO",
};

const staffUser: AuthUser = {
  id: "staff-1",
  name: "Lê Văn A",
  email: "anlv@cdktcnqn.edu.vn",
  role: "STAFF",
  roleLabel: "Chuyên viên Đào tạo",
  department: "Phòng Đào tạo & QLKH",
  departmentCode: "DAO_TAO",
};

function staffTask(overrides: Partial<StaffTask> = {}): StaffTask {
  return {
    id: "t1",
    title: "Biên soạn tài liệu",
    assigneeName: "Lê Văn A",
    assigneeId: "staff-1",
    status: "IN_PROGRESS",
    dueDate: "2026-09-25",
    parentSchoolTaskId: "s1",
    departmentCode: "DAO_TAO",
    updatedAt: "",
    ...overrides,
  };
}

describe("Task Detail capability — T20 capability-driven review", () => {
  test("a non-assignee reviewer with authority receives review capability on a submitted task", () => {
    const task = staffTask({ status: "NEEDS_REVIEW", assigneeId: "staff-1" });
    const caps = deriveTaskDetailCapabilities(task, managerUser);

    assert.equal(caps.lifecycle, "WAITING_APPROVAL");
    assert.equal(caps.isTerminal, false);
    assert.equal(caps.canApprove, true, "a non-assignee unit reviewer may approve");
    assert.equal(caps.canReject, true);
  });

  test("the submitter/assignee never receives approval capability even with approval authority (SoD)", () => {
    // A unit head (MANAGER) who is also the assigned executor must not self-approve.
    const task = staffTask({ status: "NEEDS_REVIEW", assigneeId: managerUser.id });
    const caps = deriveTaskDetailCapabilities(task, managerUser);

    assert.equal(caps.canApprove, false, "assignee cannot self-approve (SoD)");
    assert.equal(caps.canReject, false, "assignee cannot self-reject (SoD)");
  });

  test("a plain submitter without approval authority cannot approve", () => {
    const task = staffTask({ status: "NEEDS_REVIEW", assigneeId: staffUser.id });
    const caps = deriveTaskDetailCapabilities(task, staffUser);

    assert.equal(caps.canApprove, false);
    assert.equal(caps.canReject, false);
  });

  test("a completed task exposes no review capability even for an authorized reviewer", () => {
    const task = staffTask({ status: "COMPLETED", assigneeId: "staff-1" });
    const caps = deriveTaskDetailCapabilities(task, managerUser);

    assert.equal(caps.lifecycle, "COMPLETED");
    assert.equal(caps.isTerminal, true);
    assert.equal(caps.canApprove, false, "completed task shows no review CTA");
    assert.equal(caps.canReject, false);
    assert.equal(isTaskCompletedLifecycle(task), true);
  });
});

describe("Task Detail capability — submit/edit projection", () => {
  test("the assignee may submit on an in-progress task; a non-assignee reviewer may not", () => {
    const task = staffTask({ status: "IN_PROGRESS", assigneeId: "staff-1" });

    const assigneeCaps = deriveTaskDetailCapabilities(task, staffUser);
    assert.equal(assigneeCaps.canSubmit, true);

    const reviewerCaps = deriveTaskDetailCapabilities(task, managerUser);
    assert.equal(reviewerCaps.canSubmit, false, "only the executor submits the deliverable");
  });

  test("BLOCKED maps to the in-progress lifecycle without losing submit capability", () => {
    const task = staffTask({ status: "BLOCKED", assigneeId: "staff-1" });
    const caps = deriveTaskDetailCapabilities(task, staffUser);

    assert.equal(caps.lifecycle, "IN_PROGRESS");
    assert.equal(caps.canSubmit, true);
  });

  test("OVERDUE keeps its overdue lifecycle token", () => {
    const task = staffTask({ status: "OVERDUE", assigneeId: "staff-1" });
    const caps = deriveTaskDetailCapabilities(task, staffUser);
    assert.equal(caps.lifecycle, "OVERDUE");
  });

  test("no actor yields an all-false capability matrix (fail closed)", () => {
    const task = staffTask({ status: "NEEDS_REVIEW" });
    const caps = deriveTaskDetailCapabilities(task, null);

    assert.equal(caps.canSubmit, false);
    assert.equal(caps.canApprove, false);
    assert.equal(caps.canReject, false);
    assert.equal(caps.matrix.CAN_VIEW, false);
  });
});

describe("Task Detail — assignee identity resolution (T24 identity by ID)", () => {
  test("prefers the stable assigneeId, never the display name", () => {
    const task = staffTask({ assigneeId: "staff-1" });
    assert.equal(resolveTaskAssigneeId(task, managerUser), "staff-1");
  });

  test("falls back to a name match only when no stable id is present", () => {
    const task = staffTask({ assigneeId: undefined, assigneeName: staffUser.name });
    assert.equal(resolveTaskAssigneeId(task, staffUser), staffUser.id);
    assert.equal(resolveTaskAssigneeId(task, managerUser), null);
  });
});

describe("Task Detail surface — truthful history render (T18)", () => {
  test("real server audit events render under 'Lịch sử'; derived facts under 'Mốc thông tin'", () => {
    const task = staffTask({ status: "IN_PROGRESS", assigneeId: "staff-1" });
    const html = renderToStaticMarkup(
      React.createElement(TaskDetailSideSheet, {
        task,
        currentUser: staffUser,
        isOpen: true,
        onClose: () => {},
        auditEvents: [
          {
            id: "audit-1",
            action: "TASK_CREATED",
            actorName: "Ban Giám hiệu",
            timestamp: "2026-09-01T08:00:00.000Z",
            description: "Khởi tạo nhiệm vụ",
          },
          {
            id: "audit-2",
            action: "DELIVERABLE_SUBMITTED",
            actorName: "Lê Văn A",
            timestamp: "2026-09-10T09:30:00.000Z",
          },
        ],
      })
    );

    const historyStart = html.indexOf('data-slot="detail-history"');
    const milestonesStart = html.indexOf('data-slot="detail-derived-milestones"');
    assert.ok(historyStart >= 0, "history section must render");
    assert.ok(milestonesStart > historyStart, "derived milestones must follow history");

    const historyHtml = html.slice(historyStart, milestonesStart);
    assert.ok(
      historyHtml.includes("Khởi tạo nhiệm vụ"),
      "real audit event text must render under Lịch sử"
    );
    assert.ok(
      historyHtml.includes("Ban Giám hiệu"),
      "real audit actor must render under Lịch sử"
    );
    assert.ok(
      historyHtml.includes("Nộp minh chứng"),
      "mapped audit action label must render under Lịch sử"
    );
    assert.ok(
      historyHtml.includes("2 bản ghi"),
      "history must reflect the real audit event count"
    );
    assert.ok(
      !historyHtml.includes("Chưa có bản ghi kiểm toán"),
      "no empty state may render when real events exist"
    );
  });

  test("absent audit events render a truthful empty state (no fabricated history)", () => {
    const task = staffTask({ status: "IN_PROGRESS", assigneeId: "staff-1" });
    const html = renderToStaticMarkup(
      React.createElement(TaskDetailSideSheet, {
        task,
        currentUser: staffUser,
        isOpen: true,
        onClose: () => {},
      })
    );

    const historyStart = html.indexOf('data-slot="detail-history"');
    const milestonesStart = html.indexOf('data-slot="detail-derived-milestones"');
    const historyHtml = html.slice(historyStart, milestonesStart);
    assert.ok(
      historyHtml.includes("Chưa có bản ghi kiểm toán"),
      "missing audit data must render the truthful empty state"
    );
  });
});

describe("Task Detail surface — capability-driven submit & review (C2/T20)", () => {
  test("the assignee sees the submit form only on an active in-progress task", () => {
    const inProgress = staffTask({ status: "IN_PROGRESS", assigneeId: "staff-1" });
    const inProgressHtml = renderToStaticMarkup(
      React.createElement(TaskDetailSideSheet, {
        task: inProgress,
        currentUser: staffUser,
        isOpen: true,
        onClose: () => {},
        onStatusChange: () => {},
      })
    );
    assert.ok(
      inProgressHtml.includes('id="deliverable-form"'),
      "the assignee on an active task may submit"
    );

    const awaiting = staffTask({ status: "NEEDS_REVIEW", assigneeId: "staff-1" });
    const awaitingHtml = renderToStaticMarkup(
      React.createElement(TaskDetailSideSheet, {
        task: awaiting,
        currentUser: staffUser,
        isOpen: true,
        onClose: () => {},
        onStatusChange: () => {},
      })
    );
    assert.ok(
      !awaitingHtml.includes('id="deliverable-form"'),
      "the submit form must not be re-offered while the task awaits review"
    );
  });

  test("a non-assignee reviewer gets the approve CTA; the submitter never does (SoD)", () => {
    const task = staffTask({ status: "NEEDS_REVIEW", assigneeId: "staff-1" });

    const reviewerHtml = renderToStaticMarkup(
      React.createElement(TaskDetailSideSheet, {
        task,
        currentUser: managerUser,
        isOpen: true,
        onClose: () => {},
        onStatusChange: () => {},
      })
    );
    assert.ok(
      reviewerHtml.includes("Duyệt nhanh (Đạt chuẩn)") ||
        reviewerHtml.includes("Nghiệm thu Đạt (Hoàn thành)"),
      "a non-assignee unit reviewer must see an enabled approve CTA"
    );

    const submitterHtml = renderToStaticMarkup(
      React.createElement(TaskDetailSideSheet, {
        task,
        currentUser: staffUser,
        isOpen: true,
        onClose: () => {},
        onStatusChange: () => {},
      })
    );
    assert.ok(
      !submitterHtml.includes("Nghiệm thu Đạt (Hoàn thành)") &&
        !submitterHtml.includes("Duyệt nhanh (Đạt chuẩn)"),
      "the submitter must never receive an enabled approve CTA"
    );
    assert.ok(
      submitterHtml.includes("Nghiệm thu Đạt (Vô hiệu hóa)"),
      "the submitter sees the explicit SoD-disabled review affordance"
    );
  });
});

describe("Task Detail surface — structural contract (source invariants)", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/task-detail-side-sheet.tsx"),
    "utf8"
  );

  test("T17: exactly one consolidated child CTA ('Thêm việc con') and no rejected drift", () => {
    const count = source.split("Thêm việc con").length - 1;
    assert.equal(count, 1, "the detail surface must render exactly one child CTA");

    for (const drift of ["Phân rã", "Phân rã ngay", "Giao nhanh"]) {
      assert.ok(!source.includes(drift), `rejected drift label must not appear: ${drift}`);
    }
  });

  test("T07: the generic lifecycle status control is removed (no bypass)", () => {
    assert.ok(!source.includes('id="status-select"'), "generic status <select> must be gone");
    assert.ok(!source.includes("status-select"), "no status-select control may remain");
  });

  test("T16: reading order is title -> status/deadline -> owner/unit -> requirement -> evidence -> action -> child tasks -> timeline", () => {
    const order = [
      'data-slot="detail-title"',
      'data-slot="detail-status-deadline"',
      'data-slot="detail-owner-unit"',
      'data-slot="detail-requirement"',
      'data-slot="detail-evidence"',
      'data-slot="detail-context-action"',
      'data-slot="detail-child-tasks"',
      'data-slot="detail-history"',
      'data-slot="detail-derived-milestones"',
    ];
    const positions = order.map((slot) => source.indexOf(slot));
    for (let i = 0; i < positions.length; i += 1) {
      assert.ok(positions[i] >= 0, `missing detail section: ${order[i]}`);
      if (i > 0) {
        assert.ok(
          positions[i] > positions[i - 1],
          `section ${order[i]} must follow ${order[i - 1]}`
        );
      }
    }
  });

  test("T18: real audit events feed 'Lịch sử'; derived facts feed 'Mốc thông tin'", () => {
    assert.ok(source.includes('data-slot="detail-history"'));
    assert.ok(source.includes("Lịch sử"), "history section header");
    assert.ok(source.includes("auditEvents"), "history renders real server audit events");
    assert.ok(
      source.includes("Chưa có bản ghi kiểm toán"),
      "empty state must be truthful rather than fabricating events"
    );
    assert.ok(source.includes('data-slot="detail-derived-milestones"'));
    assert.ok(source.includes("Mốc thông tin"), "derived milestone section header");
  });

  test("T20: the review CTA is gated by capability, not by role alone", () => {
    assert.ok(
      !source.includes('user?.role === "STAFF"') && !source.includes("user?.role === 'STAFF'"),
      "the detail surface must not branch on raw role for the mobile action bar"
    );
    assert.ok(
      source.includes("capabilities.canApprove") || source.includes("canReview"),
      "review actions must be driven by the derived capability"
    );
  });
});
