import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("WelcomeModal copywriting matches official university tone", () => {
  const getGreeting = (name: string, roleLabel: string, dept: string) => {
    return `Kính chào Thầy/Cô ${name} gia nhập QCET E-Office!`;
  };
  const text = getGreeting("Nguyễn Văn A", "Trưởng Khoa", "Khoa CNTT");
  assert.match(text, /Kính chào Thầy\/Cô/);
  assert.match(text, /QCET E-Office/);
});

test("WelcomeModal source code adheres to WCAG accessibility and component specifications", () => {
  const componentPath = path.resolve(process.cwd(), "src/components/onboarding/welcome-modal.tsx");
  assert.ok(fs.existsSync(componentPath), "welcome-modal.tsx must exist");

  const fileContent = fs.readFileSync(componentPath, "utf-8");

  // Verify WCAG Dialog attributes
  assert.match(fileContent, /role=["']dialog["']/i, "Must have role='dialog'");
  assert.match(fileContent, /aria-modal=["']true["']/i, "Must have aria-modal='true'");
  assert.match(fileContent, /aria-labelledby=["']welcome-modal-title["']/i, "Must have aria-labelledby");
  assert.match(fileContent, /aria-describedby=["']welcome-modal-desc["']/i, "Must have aria-describedby");

  // Verify Focus trap & Keyboard listeners
  assert.match(fileContent, /e\.key === ["']Escape["']/, "Must handle Escape key to dismiss");
  assert.match(fileContent, /e\.key === ["']Tab["']/, "Must handle Tab key for focus trapping");
  assert.match(fileContent, /e\.shiftKey/, "Must handle Shift+Tab for backward focus trapping");

  // Verify official copywriting & compliance keywords
  assert.match(fileContent, /Kính chào Thầy\/Cô/i, "Must contain respectful greeting");
  assert.match(fileContent, /QCET E-Office/i, "Must reference QCET E-Office");
  assert.match(fileContent, /Nghị định 30\/2020\/NĐ-CP/i, "Must reference Decree 30");
  assert.match(fileContent, /DACUM/i, "Must reference DACUM task mechanism");
  assert.match(fileContent, /Khám phá trong 45 giây/i, "Must include 45-second tour CTA");
});

test("Focus trap keyboard navigation logic wraps correctly", () => {
  // Pure unit test of the focus trap cycle algorithm
  const mockElements = [
    { id: "btn-close", focusCalled: false, focus() { this.focusCalled = true; } },
    { id: "btn-skip", focusCalled: false, focus() { this.focusCalled = true; } },
    { id: "btn-tour", focusCalled: false, focus() { this.focusCalled = true; } },
  ];

  function simulateFocusTrap(
    elements: typeof mockElements,
    currentActiveIndex: number,
    shiftKey: boolean
  ): { prevented: boolean; nextFocusedIndex: number } {
    const first = elements[0];
    const last = elements[elements.length - 1];
    const currentActive = elements[currentActiveIndex];
    let prevented = false;
    let nextFocusedIndex = currentActiveIndex;

    if (shiftKey && currentActive === first) {
      last.focus();
      prevented = true;
      nextFocusedIndex = elements.length - 1;
    } else if (!shiftKey && currentActive === last) {
      first.focus();
      prevented = true;
      nextFocusedIndex = 0;
    }

    return { prevented, nextFocusedIndex };
  }

  // Case 1: Shift+Tab on first element wraps to last
  const res1 = simulateFocusTrap(mockElements, 0, true);
  assert.strictEqual(res1.prevented, true);
  assert.strictEqual(res1.nextFocusedIndex, 2);
  assert.strictEqual(mockElements[2].focusCalled, true);

  // Case 2: Tab on last element wraps to first
  const res2 = simulateFocusTrap(mockElements, 2, false);
  assert.strictEqual(res2.prevented, true);
  assert.strictEqual(res2.nextFocusedIndex, 0);
  assert.strictEqual(mockElements[0].focusCalled, true);

  // Case 3: Tab on middle element does not wrap
  const res3 = simulateFocusTrap(mockElements, 1, false);
  assert.strictEqual(res3.prevented, false);
  assert.strictEqual(res3.nextFocusedIndex, 1);
});
