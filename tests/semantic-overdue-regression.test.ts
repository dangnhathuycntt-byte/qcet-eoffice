/**
 * Semantic Overdue Regression Tests — Task 1 (Phase 1)
 *
 * Verifies the 4 canonical overdue cases across all presentation-layer helpers
 * that were previously using hardcoded "2026-09-04" date comparisons.
 *
 * Reference date is injected explicitly so tests are deterministic regardless
 * of getSystemReferenceDate() wall-clock output.
 *
 * Helpers under test:
 *   - isTaskOverdue / isTaskPastDue  (src/lib/academic-calendar.ts) — canonical SSoT
 *   - getStatusDotClass              (src/components/calendar/calendar-month-view.tsx)
 *   - getStatusLabel                 (src/components/calendar/calendar-month-view.tsx)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  isTaskOverdue,
  isTaskPastDue,
} from "../src/lib/academic-calendar";

import {
  getStatusDotClass,
  getStatusLabel,
} from "../src/components/calendar/calendar-month-view";

// Fixed anchor — injected into all helpers; never relies on wall-clock.
const REF = "2026-09-10";
const DUE_YESTERDAY = "2026-09-09";
const DUE_TODAY = "2026-09-10";
const DUE_FUTURE = "2026-09-15";

// ---------------------------------------------------------------------------
// Canonical domain helper: isTaskOverdue
// ---------------------------------------------------------------------------
describe("isTaskOverdue — canonical domain SSoT", () => {
  test("due yesterday + active status => overdue", () => {
    assert.equal(isTaskOverdue("IN_PROGRESS", DUE_YESTERDAY, REF), true);
  });

  test("due today + active status => not overdue", () => {
    assert.equal(isTaskOverdue("IN_PROGRESS", DUE_TODAY, REF), false);
  });

  test("due future + active status => not overdue", () => {
    assert.equal(isTaskOverdue("IN_PROGRESS", DUE_FUTURE, REF), false);
  });

  test("due yesterday + COMPLETED => not active overdue", () => {
    assert.equal(isTaskOverdue("COMPLETED", DUE_YESTERDAY, REF), false);
  });

  test("due yesterday + CANCELLED => not active overdue", () => {
    assert.equal(isTaskOverdue("CANCELLED", DUE_YESTERDAY, REF), false);
  });

  test("due yesterday + NEW status => overdue", () => {
    assert.equal(isTaskOverdue("NEW", DUE_YESTERDAY, REF), true);
  });

  test("due yesterday + NEEDS_REVIEW => overdue", () => {
    assert.equal(isTaskOverdue("NEEDS_REVIEW", DUE_YESTERDAY, REF), true);
  });

  test("explicit OVERDUE status + future due => overdue (status field wins)", () => {
    assert.equal(isTaskOverdue("OVERDUE", DUE_FUTURE, REF), true);
  });

  test("no dueDate + active => not overdue (no dueDate means no deadline breach)", () => {
    assert.equal(isTaskOverdue("IN_PROGRESS", undefined, REF), false);
  });
});

// ---------------------------------------------------------------------------
// Canonical domain helper: isTaskPastDue (kanban delegate)
// ---------------------------------------------------------------------------
describe("isTaskPastDue — kanban delegate", () => {
  test("due yesterday => past due", () => {
    assert.equal(isTaskPastDue(DUE_YESTERDAY, REF), true);
  });

  test("due today => not past due", () => {
    assert.equal(isTaskPastDue(DUE_TODAY, REF), false);
  });

  test("due future => not past due", () => {
    assert.equal(isTaskPastDue(DUE_FUTURE, REF), false);
  });

  test("no dueDate => not past due", () => {
    assert.equal(isTaskPastDue(undefined, REF), false);
  });

  test("ISO datetime string is normalized to date-only before comparison", () => {
    assert.equal(isTaskPastDue("2026-09-09T23:59:59.000Z", REF), true);
    assert.equal(isTaskPastDue("2026-09-10T00:00:00.000Z", REF), false);
  });
});

// ---------------------------------------------------------------------------
// Calendar presentation: getStatusDotClass
// ---------------------------------------------------------------------------
describe("getStatusDotClass — calendar presentation (referenceDate injected)", () => {
  test("due yesterday + IN_PROGRESS => rose (overdue) dot", () => {
    const cls = getStatusDotClass("IN_PROGRESS", DUE_YESTERDAY, REF);
    assert.ok(cls.includes("rose"), `Expected rose class, got: ${cls}`);
  });

  test("due today + IN_PROGRESS => blue (active, not overdue) dot", () => {
    const cls = getStatusDotClass("IN_PROGRESS", DUE_TODAY, REF);
    assert.ok(cls.includes("blue"), `Expected blue class, got: ${cls}`);
  });

  test("due future + IN_PROGRESS => blue (active, not overdue) dot", () => {
    const cls = getStatusDotClass("IN_PROGRESS", DUE_FUTURE, REF);
    assert.ok(cls.includes("blue"), `Expected blue class, got: ${cls}`);
  });

  test("due yesterday + COMPLETED => emerald (completed) dot, not rose", () => {
    const cls = getStatusDotClass("COMPLETED", DUE_YESTERDAY, REF);
    assert.ok(cls.includes("emerald"), `Expected emerald class, got: ${cls}`);
    assert.ok(!cls.includes("rose"), `Must not include rose for completed task: ${cls}`);
  });

  test("due yesterday + NEW => rose (overdue) dot", () => {
    const cls = getStatusDotClass("NEW", DUE_YESTERDAY, REF);
    assert.ok(cls.includes("rose"), `Expected rose class, got: ${cls}`);
  });
});

// ---------------------------------------------------------------------------
// Calendar presentation: getStatusLabel
// ---------------------------------------------------------------------------
describe("getStatusLabel — calendar presentation (referenceDate injected)", () => {
  test("due yesterday + IN_PROGRESS => 'Quá hạn'", () => {
    const label = getStatusLabel("IN_PROGRESS", DUE_YESTERDAY, REF);
    assert.equal(label, "Quá hạn");
  });

  test("due today + IN_PROGRESS => 'Đang thực hiện' (not overdue)", () => {
    const label = getStatusLabel("IN_PROGRESS", DUE_TODAY, REF);
    assert.equal(label, "Đang thực hiện");
  });

  test("due future + IN_PROGRESS => 'Đang thực hiện' (not overdue)", () => {
    const label = getStatusLabel("IN_PROGRESS", DUE_FUTURE, REF);
    assert.equal(label, "Đang thực hiện");
  });

  test("due yesterday + COMPLETED => 'Đã hoàn thành' (not overdue)", () => {
    const label = getStatusLabel("COMPLETED", DUE_YESTERDAY, REF);
    assert.equal(label, "Đã hoàn thành");
  });

  test("due yesterday + NEEDS_REVIEW => 'Quá hạn'", () => {
    const label = getStatusLabel("NEEDS_REVIEW", DUE_YESTERDAY, REF);
    assert.equal(label, "Quá hạn");
  });
});
