import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  canBulkTransition,
  filterBulkTransitionTargets,
} from "../../src/domain/tasks/bulk-lifecycle-capability";
import type {
  TaskActorContract,
  TaskEntityContract,
} from "../../src/domain/tasks/contract";
import type { TaskStatus } from "../../src/types/dashboard";

/**
 * Plan P0-07 / R-T07-bulk: a bulk lifecycle action may be offered only when it
 * is valid for the ENTIRE selection. Before this gate existed,
 * `batch-action-bar.tsx` always offered "Hoàn thành" plus a free status
 * dropdown, so an actor could bulk-approve a selection containing tasks they
 * had no authority over.
 *
 * These tests exercise the aggregation layer only; every per-task verdict comes
 * from the canonical engine (evaluateTaskCapabilityMatrix), which owns approval
 * authority and the SoD anti-self-approval rule.
 */

/** Unit head of dept-1: holds approval authority inside their own unit only. */
const unitHead: TaskActorContract = {
  id: "u-head",
  role: "TRUONG_PHONG",
  departmentId: "dept-1",
};

const staff: TaskActorContract = {
  id: "u-staff",
  role: "STAFF",
  departmentId: "dept-1",
};

const task = (
  id: string,
  overrides: Partial<TaskEntityContract> = {}
): TaskEntityContract => ({
  id,
  status: "WAITING_APPROVAL",
  createdById: "u-maker",
  departmentId: "dept-1",
  ...overrides,
});

describe("P0-07 bulk lifecycle capability", () => {
  describe("selection guards", () => {
    it("withholds every transition for an empty selection", () => {
      const verdict = canBulkTransition([], "COMPLETED", unitHead);
      assert.equal(verdict.allowed, false);
      assert.equal(verdict.reason, "no-selection");
    });

    it("withholds every transition without an authenticated actor", () => {
      const verdict = canBulkTransition([task("t-1")], "COMPLETED", null);
      assert.equal(verdict.allowed, false);
      assert.deepEqual(verdict.blockedTaskIds, ["t-1"]);
      assert.equal(verdict.reason, "no-authenticated-actor");
    });
  });

  describe("approval-bearing targets", () => {
    it("allows COMPLETED when the actor may approve EVERY selected task", () => {
      const verdict = canBulkTransition(
        [task("t-1"), task("t-2")],
        "COMPLETED",
        unitHead
      );
      assert.equal(verdict.allowed, true);
      assert.deepEqual(verdict.blockedTaskIds, []);
      assert.equal(verdict.reason, null);
    });

    it("REGRESSION: withholds COMPLETED when even ONE selected task is not approvable", () => {
      // The authority-laundering case: a unit head may approve inside dept-1 but
      // not dept-9. Selecting both must withhold the batch entirely.
      const verdict = canBulkTransition(
        [task("t-mine"), task("t-foreign", { departmentId: "dept-9" })],
        "COMPLETED",
        unitHead
      );
      assert.equal(verdict.allowed, false);
      assert.deepEqual(verdict.blockedTaskIds, ["t-foreign"]);
      assert.equal(verdict.reason, "selection-lacks-capability");
    });

    it("REGRESSION: Segregation of Duties withholds approval of one's own task", () => {
      const verdict = canBulkTransition(
        [task("t-own", { createdById: "u-head" })],
        "COMPLETED",
        unitHead
      );
      assert.equal(verdict.allowed, false);
      assert.deepEqual(verdict.blockedTaskIds, ["t-own"]);
    });

    it("withholds COMPLETED for a plain staffer entirely", () => {
      const verdict = canBulkTransition([task("t-1")], "COMPLETED", staff);
      assert.equal(verdict.allowed, false);
      assert.deepEqual(verdict.blockedTaskIds, ["t-1"]);
    });
  });

  describe("ordinary write targets", () => {
    it("allows IN_PROGRESS for a creator of the selection", () => {
      const verdict = canBulkTransition(
        [task("t-mine", { status: "IN_PROGRESS", createdById: "u-staff" })],
        "IN_PROGRESS",
        staff
      );
      assert.equal(verdict.allowed, true);
    });

    it("withholds IN_PROGRESS when the actor has no edit authority", () => {
      const verdict = canBulkTransition(
        [task("t-foreign", { status: "IN_PROGRESS", departmentId: "dept-9" })],
        "IN_PROGRESS",
        staff
      );
      assert.equal(verdict.allowed, false);
      assert.deepEqual(verdict.blockedTaskIds, ["t-foreign"]);
    });
  });

  describe("filterBulkTransitionTargets", () => {
    it("returns only targets valid for the whole selection", () => {
      const candidates: TaskStatus[] = [
        "IN_PROGRESS",
        "WAITING_APPROVAL",
        "NEEDS_REVIEW",
        "COMPLETED",
      ];

      // A staffer on their own in-progress task: may edit, may not approve.
      const forStaff = filterBulkTransitionTargets(
        [task("t-mine", { status: "IN_PROGRESS", createdById: "u-staff" })],
        candidates,
        staff
      );
      assert.ok(forStaff.includes("IN_PROGRESS"));
      assert.ok(
        !forStaff.includes("COMPLETED"),
        "must not offer COMPLETED to an actor without approval authority"
      );
      assert.ok(
        !forStaff.includes("NEEDS_REVIEW"),
        "must not offer NEEDS_REVIEW to an actor without rejection authority"
      );

      // A unit head on an approvable task inside their own unit: may approve.
      const forHead = filterBulkTransitionTargets(
        [task("t-1")],
        candidates,
        unitHead
      );
      assert.ok(forHead.includes("COMPLETED"));
    });
  });
});
