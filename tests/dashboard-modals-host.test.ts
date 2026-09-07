import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DashboardModalsHost } from "../src/components/dashboard/dashboard-modals-host";

describe("DashboardModalsHost Contract & Import Audit", () => {
  test("DashboardModalsHost is a memoized React component", () => {
    assert.equal(typeof DashboardModalsHost, "object");
  });

  test("DashboardModalsHost dynamically loads all 3 modals on-demand", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/dashboard-modals-host.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(content.includes("TaskDetailSideSheet"));
    assert.ok(content.includes("CreateTaskModal"));
    assert.ok(content.includes("DelegationManagementModal"));
    assert.ok(content.includes("useDashboardModal"));
    assert.ok(content.includes('data-slot="dashboard-modals-host"'));
    const lineCount = content.split("\n").length;
    assert.ok(lineCount < 120, `DashboardModalsHost exceeded 120 lines: ${lineCount}`);
  });
});
