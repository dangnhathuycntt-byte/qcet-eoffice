import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateDeliverableSubmission } from "../src/components/portal/submit-deliverable-modal";

describe("Task 5: Workspace Action Queue & DACUM Review", () => {
  it("universal-action-queue.tsx does NOT contain hardcoded BGH approval string", () => {
    const filePath = path.resolve(__dirname, "../src/components/workspace/components/universal-action-queue.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(
      !content.includes('reviewedByName: "BGH"'),
      "Must not hardcode reviewedByName: 'BGH'"
    );
  });

  it("validateDeliverableSubmission rejects invalid URLs like '#' or 'javascript:'", () => {
    const res1 = validateDeliverableSubmission("Báo cáo", "#");
    assert.equal(res1.isValid, false);
    assert.ok(res1.error?.includes("URL") || res1.error?.includes("giao thức"));

    const res2 = validateDeliverableSubmission("Báo cáo", "javascript:alert(1)");
    assert.equal(res2.isValid, false);
    assert.ok(res2.error?.includes("giao thức http:// hoặc https://"));

    const resFtp = validateDeliverableSubmission("Báo cáo", "ftp://ftp.example.com/file.zip");
    assert.equal(resFtp.isValid, false);
    assert.ok(resFtp.error?.includes("giao thức http:// hoặc https://"));

    const resData = validateDeliverableSubmission("Báo cáo", "data:text/html,test");
    assert.equal(resData.isValid, false);

    const resMalformed = validateDeliverableSubmission("Báo cáo", "random-domain-without-protocol.com");
    assert.equal(resMalformed.isValid, false);

    const res3 = validateDeliverableSubmission("Báo cáo", "https://drive.google.com/file/123");
    assert.equal(res3.isValid, true);
    assert.equal(res3.error, undefined);

    const resHttp = validateDeliverableSubmission("Báo cáo", "http://example.edu.vn/document");
    assert.equal(resHttp.isValid, true);
  });

  it("validateDeliverableSubmission enforces non-empty deliverable title", () => {
    const emptyName = validateDeliverableSubmission("", "https://example.com");
    assert.equal(emptyName.isValid, false);
    assert.ok(emptyName.error?.includes("tên minh chứng"));

    const whitespaceName = validateDeliverableSubmission("   ", "https://example.com");
    assert.equal(whitespaceName.isValid, false);

    const validNoUrl = validateDeliverableSubmission("Báo cáo DACUM kỳ 1");
    assert.equal(validNoUrl.isValid, true);
  });

  it("unified-adaptive-workspace.tsx integrates ReviewActionDialog passing session user identity", () => {
    const filePath = path.resolve(__dirname, "../src/components/workspace/unified-adaptive-workspace.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(
      content.includes("ReviewActionDialog"),
      "UnifiedAdaptiveWorkspace must import and connect ReviewActionDialog"
    );
    assert.ok(
      content.includes("reviewerName={user.name}"),
      "ReviewActionDialog must receive logged-in user name as reviewerName"
    );
    assert.ok(
      content.includes("reviewerRole={effectiveReviewerRole}"),
      "ReviewActionDialog must receive effective reviewer role from context/user"
    );
  });

  it("unified-adaptive-workspace.tsx integrates SubmitDeliverableModal for deliverables", () => {
    const filePath = path.resolve(__dirname, "../src/components/workspace/unified-adaptive-workspace.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(
      content.includes("SubmitDeliverableModal"),
      "UnifiedAdaptiveWorkspace must import and connect SubmitDeliverableModal"
    );
  });
});
