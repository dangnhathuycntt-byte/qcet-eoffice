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
    assert.ok(content.includes("sticky bottom-0") || content.includes("safe-area-inset-bottom"));
    assert.ok(content.includes("overflow-x-auto") || content.includes("no-scrollbar") || content.includes("scrollbar-none"));
  });

  test("user-profile-modal.tsx includes inputMode tel and sticky footer", () => {
    const profilePath = path.resolve(process.cwd(), "src/components/auth/user-profile-modal.tsx");
    const content = fs.readFileSync(profilePath, "utf-8");
    assert.ok(content.includes('inputMode="tel"'));
    assert.ok(content.includes("sticky bottom-0") || content.includes("border-t"));
  });
});
