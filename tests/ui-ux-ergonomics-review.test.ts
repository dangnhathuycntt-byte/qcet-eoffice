import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("UI/UX & A11Y Ergonomics Audit Suite", () => {
  const reviewDialogPath = path.join(
    process.cwd(),
    "src/components/portal/review-action-dialog.tsx"
  );
  const submitModalPath = path.join(
    process.cwd(),
    "src/components/portal/submit-deliverable-modal.tsx"
  );
  const adaptiveStripPath = path.join(
    process.cwd(),
    "src/components/workspace/components/adaptive-metric-strip.tsx"
  );
  const scopeHeaderPath = path.join(
    process.cwd(),
    "src/components/workspace/components/adaptive-scope-header.tsx"
  );
  const actionQueuePath = path.join(
    process.cwd(),
    "src/components/workspace/components/universal-action-queue.tsx"
  );
  const workspacePath = path.join(
    process.cwd(),
    "src/components/workspace/unified-adaptive-workspace.tsx"
  );

  test("review-action-dialog.tsx: accessible radiogroup, error alerts, character counters and light-only tokens", () => {
    const code = fs.readFileSync(reviewDialogPath, "utf-8");

    // Accessible radiogroup
    assert.ok(code.includes('role="radiogroup"'), "Must implement role=radiogroup");
    assert.ok(code.includes('role="radio"'), "Each decision option must implement role=radio");
    assert.ok(code.includes('aria-checked={isSelected}'), "Must set aria-checked for screen readers");
    assert.ok(code.includes('id="decision-group-label"'), "Must have group label id");
    assert.ok(code.includes('aria-labelledby="decision-group-label"'), "Radiogroup must reference group label");

    // Monospace tabular-nums character counter
    assert.ok(code.includes("font-mono tabular-nums"), "Character count must have font-mono tabular-nums");

    // Error alert semantics
    assert.ok(code.includes('role="alert"'), "Validation errors must have role=alert");
    assert.ok(code.includes('aria-live="polite"'), "Validation errors must be polite live regions");

    // Light-only compliance
    assert.ok(!code.includes("dark:"), "Must not contain dark: theme classes");
  });

  test("submit-deliverable-modal.tsx: accessible upload dropzone, keyboard listeners and alerts", () => {
    const code = fs.readFileSync(submitModalPath, "utf-8");

    // Dropzone accessibility
    assert.ok(code.includes('role="button"'), "Dropzone must have role=button");
    assert.ok(code.includes("tabIndex={0}"), "Dropzone must be focusable with tabIndex 0");
    assert.ok(code.includes('aria-label="Khu vực tải lên tệp minh chứng'), "Must have explicit aria-label");
    assert.ok(code.includes("e.key === \"Enter\" || e.key === \" \""), "Must support Enter and Space key activation");
    assert.ok(code.includes("focus-visible:ring-2"), "Must show visible focus ring");

    // Error banner accessibility
    assert.ok(code.includes('role="alert"'), "Error banner must have role=alert");
    assert.ok(code.includes('aria-live="polite"'), "Error banner must have aria-live=polite");

    // Light-only compliance
    assert.ok(!code.includes("dark:"), "Must not contain dark: theme classes");
  });

  test("adaptive-metric-strip.tsx: safe number formatting, selectable numbers, and accessible labels", () => {
    const code = fs.readFileSync(adaptiveStripPath, "utf-8");

    assert.ok(code.includes("formatRate"), "Must have formatRate helper for rate percentages");
    assert.ok(code.includes("select-text"), "Number digits must allow text selection");
    assert.ok(code.includes("aria-label={cardAriaLabel}"), "Must have cardAriaLabel");
    assert.ok(code.includes('role={isInteractive ? "button" : "region"}'), "Must distinguish interactive vs region");
    assert.ok(!code.includes("dark:"), "Must not contain dark: theme classes");
  });

  test("adaptive-scope-header.tsx: tabs pattern accessibility and keyboard focus ergonomics", () => {
    const code = fs.readFileSync(scopeHeaderPath, "utf-8");

    assert.ok(code.includes('role="tablist"'), "Header navigation must have role=tablist");
    assert.ok(code.includes('role="tab"'), "Each scope option must have role=tab");
    assert.ok(code.includes("aria-selected={isActive}"), "Must have aria-selected attribute");
    assert.ok(code.includes("focus-visible:ring-2"), "Must have visible focus ring");
    assert.ok(!code.includes("dark:"), "Must not contain dark: theme classes");
  });

  test("universal-action-queue.tsx: urgent alert banners and ergonomic touch target controls", () => {
    const code = fs.readFileSync(actionQueuePath, "utf-8");

    assert.ok(code.includes('role="alert"'), "Overdue warning must have role=alert");
    assert.ok(code.includes('aria-live="polite"'), "Overdue warning must have aria-live=polite");
    assert.ok(code.includes("min-h-[44px]") || code.includes("min-h-[30px]"), "Action buttons must have minimum touch height");
    assert.ok(code.includes("aria-expanded={isApprovalsExpanded}"), "Accordion toggles must specify aria-expanded");
    assert.ok(!code.includes("dark:"), "Must not contain dark: theme classes");
  });

  test("unified-adaptive-workspace.tsx: semantic aside region for context banners", () => {
    const code = fs.readFileSync(workspacePath, "utf-8");

    assert.ok(code.includes("<aside"), "Context banner must use semantic aside tag");
    assert.ok(code.includes('role="region"'), "Context banner must define role=region");
    assert.ok(code.includes('aria-label="Thông tin ngữ cảnh không gian làm việc"'), "Context banner must have aria-label");
    assert.ok(!code.includes("dark:"), "Must not contain dark: theme classes");
  });
});
