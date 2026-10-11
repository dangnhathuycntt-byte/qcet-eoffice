import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  resolveStaffLandingMode,
} from "../src/lib/unified-task-hub";
import type { AuthUser } from "../src/types/auth";

describe("Role-Adaptive Landing & Integration (Task 3)", () => {

  // --------------------------------------------------------------------------
  // 1. Role Landing Resolution Logic
  // --------------------------------------------------------------------------
  describe("1. Role Landing Mode Resolution", () => {
    test("Staff user role resolves default focus view when not expanded and no view query", () => {
      const mode = resolveStaffLandingMode({
        role: "STAFF",
        isExpanded: false,
        viewQuery: null,
      });
      assert.equal(mode, "STAFF_FOCUS", "STAFF should default to STAFF_FOCUS");
    });

    test("Staff user role resolves default focus view when view query is explicitly 'focus'", () => {
      const mode = resolveStaffLandingMode({
        role: "STAFF",
        isExpanded: false,
        viewQuery: "focus",
      });
      assert.equal(mode, "STAFF_FOCUS", "STAFF with view=focus should resolve to STAFF_FOCUS");
    });

    test("Staff user role resolves advanced view when toggled expanded", () => {
      const mode = resolveStaffLandingMode({
        role: "STAFF",
        isExpanded: true,
        viewQuery: null,
      });
      assert.equal(mode, "ADVANCED", "STAFF with isExpanded=true should resolve to ADVANCED");
    });

    test("Staff user role resolves advanced view when deep query parameter ?view=table is present", () => {
      const mode = resolveStaffLandingMode({
        role: "STAFF",
        isExpanded: false,
        viewQuery: "table",
      });
      assert.equal(mode, "ADVANCED", "Deep link ?view=table should override to ADVANCED");
    });

    test("Staff user role resolves advanced view for other view queries (kanban, calendar)", () => {
      assert.equal(
        resolveStaffLandingMode({ role: "STAFF", isExpanded: false, viewQuery: "kanban" }),
        "ADVANCED"
      );
      assert.equal(
        resolveStaffLandingMode({ role: "STAFF", isExpanded: false, viewQuery: "calendar" }),
        "ADVANCED"
      );
    });
  });
});
