import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 3: Mobile Modal Bottom Sheet Ergonomics", () => {
  const bottomSheet = fs.readFileSync(
    path.join(process.cwd(), "src/components/ui/bottom-sheet.tsx"),
    "utf8"
  );
  const reviewDialog = fs.readFileSync(
    path.join(process.cwd(), "src/components/portal/review-action-dialog.tsx"),
    "utf8"
  );
  const submitModal = fs.readFileSync(
    path.join(process.cwd(), "src/components/portal/submit-deliverable-modal.tsx"),
    "utf8"
  );

  it("ui/bottom-sheet.tsx uses 90dvh instead of 90vh", () => {
    assert.match(bottomSheet, /max-h-\[90dvh\]/);
  });

  it("review-action-dialog.tsx morphs to bottom sheet on mobile (< sm)", () => {
    assert.match(reviewDialog, /items-end sm:items-center/);
    assert.match(reviewDialog, /rounded-t-2xl sm:rounded-2xl/);
    assert.match(reviewDialog, /max-h-\[90dvh\]/);
  });

  it("submit-deliverable-modal.tsx morphs to bottom sheet on mobile (< sm)", () => {
    assert.match(submitModal, /items-end sm:items-center/);
    assert.match(submitModal, /rounded-t-2xl sm:rounded-2xl/);
    assert.match(submitModal, /max-h-\[90dvh\]/);
  });

  it("submit-deliverable-modal.tsx uses updated formal academic microcopy", () => {
    assert.match(submitModal, /Gửi hồ sơ thẩm định/);
    assert.doesNotMatch(submitModal, /Gửi Trưởng đơn vị duyệt/);
  });
});
