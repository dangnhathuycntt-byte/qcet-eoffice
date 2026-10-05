import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Feature Guide Specification (Board FeatureGuide)", () => {
  const featureGuideSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/feature-guide/feature-guide.tsx"),
    "utf-8"
  );
  const docRegistrySource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/documents/document-registry-view.tsx"),
    "utf-8"
  );
  const tasksPageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/tasks/tasks-page-client.tsx"),
    "utf-8"
  );
  const delegationSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/delegations/delegation-registry-view.tsx"),
    "utf-8"
  );
  const appShellSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/layout/app-shell.tsx"),
    "utf-8"
  );
  const appSidebarSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/layout/app-sidebar.tsx"),
    "utf-8"
  );

  test("implements all 3 cards with exact design handoff copy and previews", () => {
    // Card 1: Văn bản đến
    assert.ok(
      featureGuideSource.includes("Ký ngay trên văn bản."),
      "Card 1 must have title 'Ký ngay trên văn bản.'"
    );
    assert.ok(
      featureGuideSource.includes("Đọc, bút phê và ký trên cùng một màn hình, không cần in ra."),
      "Card 1 must have description 'Đọc, bút phê và ký trên cùng một màn hình, không cần in ra.'"
    );
    assert.ok(
      featureGuideSource.includes("InboundDocumentPreview"),
      "Card 1 must use InboundDocumentPreview"
    );
    assert.ok(
      featureGuideSource.includes("Công văn đến · 214/CV-ĐT"),
      "Card 1 preview must include sample document code 'Công văn đến · 214/CV-ĐT'"
    );

    // Card 2: Nhiệm vụ
    assert.ok(
      featureGuideSource.includes("Việc gần hạn nằm trên cùng."),
      "Card 2 must have title 'Việc gần hạn nằm trên cùng.'"
    );
    assert.ok(
      featureGuideSource.includes("Việc trễ hạn và sắp đến hạn được xếp trước, không cần lọc."),
      "Card 2 must have description 'Việc trễ hạn và sắp đến hạn được xếp trước, không cần lọc.'"
    );
    assert.ok(
      featureGuideSource.includes("TaskSortPreview"),
      "Card 2 must use TaskSortPreview"
    );
    assert.ok(
      featureGuideSource.includes("Trễ 1 ngày"),
      "Card 2 preview must display overdue alert 'Trễ 1 ngày'"
    );

    // Card 3: Ủy quyền
    assert.ok(
      featureGuideSource.includes("Vắng mặt? Ủy quyền cho người khác."),
      "Card 3 must have title 'Vắng mặt? Ủy quyền cho người khác.'"
    );
    assert.ok(
      featureGuideSource.includes("Chọn người và thời gian. Họ xử lý thay bạn, bạn vẫn xem được."),
      "Card 3 must have description 'Chọn người và thời gian. Họ xử lý thay bạn, bạn vẫn xem được.'"
    );
    assert.ok(
      featureGuideSource.includes("DelegationPreview"),
      "Card 3 must use DelegationPreview"
    );
    assert.ok(
      featureGuideSource.includes("15–20/10"),
      "Card 3 preview must display delegation duration '15–20/10'"
    );
  });

  test("implements non-blocking dialog accessibility and mobile bottom anchoring", () => {
    // Non-blocking accessibility invariants
    assert.ok(
      featureGuideSource.includes('role="dialog"'),
      "FeatureGuideCard must have role='dialog'"
    );
    assert.ok(
      featureGuideSource.includes('aria-modal="false"'),
      "FeatureGuideCard must be non-modal (aria-modal='false') so background is interactable"
    );
    // Mobile bottom anchoring
    assert.ok(
      featureGuideSource.includes("fixed bottom-2") || featureGuideSource.includes("bottom-2"),
      "Mobile feature guide must sit at bottom of viewport"
    );
    // Animation timing (180ms ease-out)
    assert.ok(
      featureGuideSource.includes("duration-[180ms]") || featureGuideSource.includes("180ms"),
      "Must have 180ms transition duration"
    );
  });

  test("anchors the 3 feature guides to respective real screens", () => {
    // 1. Inbound document screen
    assert.ok(
      docRegistrySource.includes("InboundDocumentFeatureGuide"),
      "Document registry view must mount InboundDocumentFeatureGuide"
    );

    // 2. Tasks management screen
    assert.ok(
      tasksPageSource.includes("TaskSortFeatureGuide"),
      "Tasks page must mount TaskSortFeatureGuide"
    );

    // 3. Delegation screen
    assert.ok(
      delegationSource.includes("DelegationFeatureGuide"),
      "Delegation view must mount DelegationFeatureGuide"
    );
  });

  test("provides Help -> Guide modal to replay guides at any time", () => {
    assert.ok(
      featureGuideSource.includes("HelpGuideModal"),
      "Must export HelpGuideModal component"
    );
    assert.ok(
      appShellSource.includes("HelpGuideModal"),
      "AppShell must render HelpGuideModal"
    );
    assert.ok(
      appSidebarSource.includes("qcet:open-help-guide") || appSidebarSource.includes("Trợ giúp"),
      "Sidebar must provide trigger for Help -> Guide"
    );
  });
});
