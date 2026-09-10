import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { useVirtualKeyboard, scrollActiveInputIntoView } from "@/hooks/use-virtual-keyboard";

describe("Mobile Forms & Virtual Keyboard Suite", () => {
  test("useVirtualKeyboard hook exports valid contract", () => {
    assert.strictEqual(typeof useVirtualKeyboard, "function");
    assert.strictEqual(typeof scrollActiveInputIntoView, "function");
  });

  test("create-task-modal.tsx uses sticky action dock and adaptive drawer", () => {
    const modalPath = path.resolve(process.cwd(), "src/components/dashboard/create-task-modal.tsx");
    const content = fs.readFileSync(modalPath, "utf-8");
    assert.ok(content.includes("sticky bottom-0") && content.includes("safe-area-inset-bottom"));
    assert.ok(content.includes("h-[100dvh]") && content.includes("sm:h-auto"));
    assert.ok(content.includes("min-h-[44px]"));
    assert.ok(content.includes("text-base sm:text-xs"));
    assert.ok(content.includes("scrollActiveInputIntoView"));
  });

  test("review-action-dialog.tsx enforces touch ergonomics and sticky safe actions", () => {
    const dialogPath = path.resolve(process.cwd(), "src/components/portal/review-action-dialog.tsx");
    const content = fs.readFileSync(dialogPath, "utf-8");
    assert.ok(content.includes("min-h-[44px]"));
    assert.ok(content.includes("pb-safe") || content.includes("safe-area-inset-bottom"));
    assert.ok(content.includes("scrollActiveInputIntoView"));
    assert.ok(content.includes("useVirtualKeyboard"));
    assert.ok(content.includes("min-h-[56px]")); // radiogroup touch targets
  });

  test("submit-deliverable-modal.tsx optimizes mobile submission ergonomics", () => {
    const submitModalPath = path.resolve(process.cwd(), "src/components/portal/submit-deliverable-modal.tsx");
    const content = fs.readFileSync(submitModalPath, "utf-8");
    assert.ok(content.includes("min-h-[44px]"));
    assert.ok(content.includes("sticky bottom-0"));
    assert.ok(content.includes("pb-safe") || content.includes("safe-area-inset-bottom"));
    assert.ok(content.includes("scrollActiveInputIntoView"));
    assert.ok(content.includes("text-base sm:text-xs"));
  });

  test("user-profile-modal.tsx includes inputMode tel and sticky footer", () => {
    const profilePath = path.resolve(process.cwd(), "src/components/auth/user-profile-modal.tsx");
    const content = fs.readFileSync(profilePath, "utf-8");
    assert.ok(content.includes('inputMode="tel"'));
    assert.ok(content.includes("sticky bottom-0") || content.includes("border-t"));
  });
});
