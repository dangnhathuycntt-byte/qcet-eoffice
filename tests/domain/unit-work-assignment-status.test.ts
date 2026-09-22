/**
 * Test Suite: UnitWorkAssignment Controlled Vocabulary & State Management (WI-7.3 / Issue #88)
 */

import * as nodeTest from "node:test";
import assert from "node:assert/strict";
import {
  UNIT_WORK_ASSIGNMENT_STATUSES,
  UnitWorkAssignmentStatusValues,
  isValidUnitWorkAssignmentStatus,
  assertUnitWorkAssignmentStatus,
  canTransitionUnitAssignment,
  assertUnitAssignmentTransition,
  ALLOWED_UNIT_ASSIGNMENT_TRANSITIONS,
  TERMINAL_UNIT_ASSIGNMENT_STATUSES,
} from "../../src/domain/documents/unit-assignment-status";
import { ValidationError, InvalidTransitionError } from "../../src/server/api/errors";

const describe: any = (globalThis as any).describe || nodeTest.describe;
const it: any = (globalThis as any).it || (globalThis as any).test || nodeTest.it;

describe("WI-7.3: UnitWorkAssignment Controlled Vocabulary", () => {
  describe("1. Controlled Vocabulary Definition", () => {
    it("defines exactly 4 canonical statuses", () => {
      assert.deepEqual(UNIT_WORK_ASSIGNMENT_STATUSES, [
        "ASSIGNED",
        "IN_PROGRESS",
        "RESOLVED",
        "CANCELLED",
      ]);
    });

    it("UnitWorkAssignmentStatusValues constants match vocabulary", () => {
      assert.equal(UnitWorkAssignmentStatusValues.ASSIGNED, "ASSIGNED");
      assert.equal(UnitWorkAssignmentStatusValues.IN_PROGRESS, "IN_PROGRESS");
      assert.equal(UnitWorkAssignmentStatusValues.RESOLVED, "RESOLVED");
      assert.equal(UnitWorkAssignmentStatusValues.CANCELLED, "CANCELLED");
    });
  });

  describe("2. Status Validation & Assertion", () => {
    it("isValidUnitWorkAssignmentStatus returns true for allowed values", () => {
      assert.equal(isValidUnitWorkAssignmentStatus("ASSIGNED"), true);
      assert.equal(isValidUnitWorkAssignmentStatus("IN_PROGRESS"), true);
      assert.equal(isValidUnitWorkAssignmentStatus("RESOLVED"), true);
      assert.equal(isValidUnitWorkAssignmentStatus("CANCELLED"), true);
    });

    it("isValidUnitWorkAssignmentStatus returns false for arbitrary strings or non-strings", () => {
      assert.equal(isValidUnitWorkAssignmentStatus("UNKNOWN"), false);
      assert.equal(isValidUnitWorkAssignmentStatus("TODO"), false);
      assert.equal(isValidUnitWorkAssignmentStatus(null), false);
      assert.equal(isValidUnitWorkAssignmentStatus(undefined), false);
      assert.equal(isValidUnitWorkAssignmentStatus(123), false);
    });

    it("assertUnitWorkAssignmentStatus returns valid status", () => {
      assert.equal(assertUnitWorkAssignmentStatus("ASSIGNED"), "ASSIGNED");
    });

    it("assertUnitWorkAssignmentStatus throws ValidationError with code INVALID_UNIT_ASSIGNMENT_STATUS", () => {
      assert.throws(
        () => assertUnitWorkAssignmentStatus("INVALID_STATUS"),
        (err: any) => {
          assert.ok(err instanceof ValidationError);
          assert.equal(err.code, "INVALID_UNIT_ASSIGNMENT_STATUS");
          return true;
        }
      );
    });
  });

  describe("3. Permitted Transitions & State Machine", () => {
    it("allows ASSIGNED -> IN_PROGRESS, RESOLVED, CANCELLED", () => {
      assert.equal(canTransitionUnitAssignment("ASSIGNED", "IN_PROGRESS"), true);
      assert.equal(canTransitionUnitAssignment("ASSIGNED", "RESOLVED"), true);
      assert.equal(canTransitionUnitAssignment("ASSIGNED", "CANCELLED"), true);
    });

    it("allows IN_PROGRESS -> RESOLVED, CANCELLED", () => {
      assert.equal(canTransitionUnitAssignment("IN_PROGRESS", "RESOLVED"), true);
      assert.equal(canTransitionUnitAssignment("IN_PROGRESS", "CANCELLED"), true);
    });

    it("prohibits backward transitions to ASSIGNED", () => {
      assert.equal(canTransitionUnitAssignment("IN_PROGRESS", "ASSIGNED"), false);
      assert.equal(canTransitionUnitAssignment("RESOLVED", "ASSIGNED"), false);
    });

    it("prohibits outgoing transitions from terminal states (RESOLVED, CANCELLED)", () => {
      for (const terminal of TERMINAL_UNIT_ASSIGNMENT_STATUSES) {
        for (const target of UNIT_WORK_ASSIGNMENT_STATUSES) {
          assert.equal(canTransitionUnitAssignment(terminal, target), false);
        }
      }
    });

    it("assertUnitAssignmentTransition does not throw for valid transition", () => {
      assert.doesNotThrow(() => {
        assertUnitAssignmentTransition("ASSIGNED", "IN_PROGRESS");
      });
    });

    it("assertUnitAssignmentTransition throws InvalidTransitionError for disallowed transition", () => {
      assert.throws(
        () => assertUnitAssignmentTransition("RESOLVED", "IN_PROGRESS", "assign-123"),
        (err: any) => {
          assert.ok(err instanceof InvalidTransitionError);
          assert.ok(err.message.includes("assign-123"));
          return true;
        }
      );
    });
  });
});
