import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 4: Touch Targets & Workspace Ergonomics", () => {
  const actionQueuePath = path.join(process.cwd(), "src/components/workspace/components/universal-action-queue.tsx");
  const scopeHeaderPath = path.join(process.cwd(), "src/components/workspace/components/adaptive-scope-header.tsx");
  const metricStripPath = path.join(process.cwd(), "src/components/workspace/components/adaptive-metric-strip.tsx");
  const workspaceRootPath = path.join(process.cwd(), "src/components/workspace/unified-adaptive-workspace.tsx");
  const topbarPath = path.join(process.cwd(), "src/components/layout/app-topbar.tsx");

  const actionQueue = fs.readFileSync(actionQueuePath, "utf8");
  const scopeHeader = fs.readFileSync(scopeHeaderPath, "utf8");
  const metricStrip = fs.readFileSync(metricStripPath, "utf8");
  const workspaceRoot = fs.readFileSync(workspaceRootPath, "utf8");
  const topbar = fs.readFileSync(topbarPath, "utf8");

  it("universal-action-queue.tsx enforces min-h-[44px] touch-manipulation on action buttons", () => {
    assert.match(actionQueue, /min-h-\[44px\]/);
    assert.doesNotMatch(actionQueue, /min-h-\[30px\]/);
  });

  it("universal-action-queue.tsx standardizes academic microcopy", () => {
    assert.doesNotMatch(actionQueue, /Duyệt nhanh/);
    assert.match(actionQueue, /Phê duyệt/);
    assert.doesNotMatch(actionQueue, /Giao việc/);
    assert.match(actionQueue, /Phân công/);
    assert.doesNotMatch(actionQueue, /Không có tác vụ nào cần xử lý khẩn cấp/);
    assert.match(actionQueue, /Không có nhiệm vụ cần xử lý gấp/);
    assert.doesNotMatch(actionQueue, /Nhiệm vụ cá nhân cần nộp/);
    assert.match(actionQueue, /Nhiệm vụ cần nộp hồ sơ minh chứng/);
  });

  it("adaptive-scope-header.tsx enforces min-h-[44px] on mobile scope tabs", () => {
    assert.match(scopeHeader, /min-h-\[44px\]/);
    assert.match(scopeHeader, /touch-manipulation/);
  });

  it("adaptive-scope-header.tsx hides top-right create task button on mobile", () => {
    assert.match(scopeHeader, /hidden\s+sm:inline-flex/);
  });

  it("adaptive-metric-strip.tsx avoids backdrop-blur-xs and uses solid card styling and updated copy", () => {
    assert.doesNotMatch(metricStrip, /backdrop-blur-xs/);
    assert.match(metricStrip, /bg-card\s+border\s+border-border\/70/);
    assert.doesNotMatch(metricStrip, /Hồ sơ chờ bạn phê duyệt/);
    assert.match(metricStrip, /Hồ sơ chờ Thầy\/Cô phê duyệt/);
    assert.doesNotMatch(metricStrip, /Tiến độ khoa/);
    assert.match(metricStrip, /Tiến độ đơn vị/);
  });

  it("unified-adaptive-workspace.tsx sets safe bottom padding for iOS Home Bar", () => {
    assert.match(workspaceRoot, /pb-\[calc\(5\.\d+rem\+env\(safe-area-inset-bottom/);
  });

  it("app-topbar.tsx enforces min-h-[44px] min-w-[44px] touch target on icon buttons", () => {
    assert.match(topbar, /min-h-\[44px\]\s+min-w-\[44px\]/);
  });
});
