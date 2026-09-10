import { test } from "node:test";
import assert from "node:assert/strict";
import { getActionQueueButtonMeta } from "../src/components/workspace/components/universal-action-queue";

test("action queue determines appropriate action label based on scope and role", () => {
  const schoolApproval = getActionQueueButtonMeta("school", "approval");
  assert.equal(schoolApproval.label, "Phê duyệt");

  const unitApproval = getActionQueueButtonMeta("unit", "approval");
  assert.equal(unitApproval.label, "Thẩm định L1");

  const staffSubmission = getActionQueueButtonMeta("my", "submission");
  assert.equal(staffSubmission.label, "Nộp minh chứng");
});
