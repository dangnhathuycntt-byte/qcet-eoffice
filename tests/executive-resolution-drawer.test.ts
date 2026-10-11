// tests/executive-resolution-drawer.test.ts
import { describe, it, test } from "node:test";
import assert from "node:assert/strict";

describe("Executive Resolution Drawer Logic", () => {

  it("hỗ trợ nhận diện phím tắt Cmd+Enter và Ctrl+Enter", () => {
    const isCmdOrCtrlEnter = (e: { key: string; metaKey: boolean; ctrlKey: boolean }) =>
      e.key === "Enter" && (e.metaKey || e.ctrlKey);

    assert.equal(isCmdOrCtrlEnter({ key: "Enter", metaKey: true, ctrlKey: false }), true);
    assert.equal(isCmdOrCtrlEnter({ key: "Enter", metaKey: false, ctrlKey: true }), true);
    assert.equal(isCmdOrCtrlEnter({ key: "Enter", metaKey: false, ctrlKey: false }), false);
    assert.equal(isCmdOrCtrlEnter({ key: "Escape", metaKey: false, ctrlKey: false }), false);
  });

  it("nhận diện phím tắt Escape để đóng drawer", () => {
    const isEscapeKey = (e: { key: string }) => e.key === "Escape";

    assert.equal(isEscapeKey({ key: "Escape" }), true);
    assert.equal(isEscapeKey({ key: "Enter" }), false);
  });
});

describe("Executive Resolution Persistence Logic", () => {
  test("calculates new due date correctly when grantedDays is applied", () => {
    const currentDueDate = new Date("2026-09-20T00:00:00Z");
    const grantedDays = 7;
    const newDueDate = new Date(currentDueDate.getTime() + grantedDays * 24 * 60 * 60 * 1000);

    assert.strictEqual(newDueDate.toISOString().split("T")[0], "2026-09-27");
  });
});
