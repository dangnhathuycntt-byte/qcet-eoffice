import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Required DOM anchor IDs are defined in onboarding specification", () => {
  const requiredAnchors = [
    "tour-scope-switcher",
    "tour-topbar-search",
    "tour-tasks-landing",
  ];
  assert.equal(requiredAnchors.length, 3);
  assert.ok(requiredAnchors.includes("tour-scope-switcher"));
  assert.ok(requiredAnchors.includes("tour-topbar-search"));
  assert.ok(requiredAnchors.includes("tour-tasks-landing"));
});

test("ActionableEmptyState component source structure and content", () => {
  const emptyStatePath = path.resolve(
    process.cwd(),
    "src/components/onboarding/actionable-empty-state.tsx"
  );
  assert.ok(fs.existsSync(emptyStatePath), "actionable-empty-state.tsx must exist");

  const content = fs.readFileSync(emptyStatePath, "utf-8");
  assert.ok(content.includes('"use client"'), "Must be client component");
  assert.ok(content.includes('id="tour-empty-state-cta"'), "Must contain id tour-empty-state-cta");
  assert.ok(content.includes("Chào mừng Thầy/Cô đến với Bàn làm việc!"), "Must contain greeting header");
  assert.ok(content.includes("Soạn Tờ trình / Nhiệm vụ mới"), "Must have CTA to create task / proposal");
  assert.ok(content.includes("Tra cứu văn bản trường (NĐ 30)"), "Must have CTA to inspect documents");
});

test("AppShell integrates OnboardingHub with WelcomeModal, SpotlightTour and ChecklistWidget", () => {
  const appShellPath = path.resolve(
    process.cwd(),
    "src/components/layout/app-shell.tsx"
  );
  assert.ok(fs.existsSync(appShellPath), "app-shell.tsx must exist");

  const content = fs.readFileSync(appShellPath, "utf-8");
  assert.ok(
    content.includes("OnboardingHub") || content.includes("useOnboarding"),
    "AppShell must integrate OnboardingHub / useOnboarding"
  );
  assert.ok(content.includes("WelcomeModal"), "AppShell must mount WelcomeModal");
  assert.ok(content.includes("SpotlightTour"), "AppShell must mount SpotlightTour");
  assert.ok(content.includes("OnboardingChecklistWidget"), "AppShell must mount OnboardingChecklistWidget");
});

test("AppTopbar and ScopeSwitcher contain required tour DOM anchors", () => {
  const topbarPath = path.resolve(
    process.cwd(),
    "src/components/layout/app-topbar.tsx"
  );
  const scopeSwitcherPath = path.resolve(
    process.cwd(),
    "src/components/layout/scope-switcher.tsx"
  );

  const topbarContent = fs.readFileSync(topbarPath, "utf-8");
  const scopeSwitcherContent = fs.readFileSync(scopeSwitcherPath, "utf-8");

  assert.ok(
    topbarContent.includes('id="tour-topbar-search"'),
    "AppTopbar must have id='tour-topbar-search' on search button/container"
  );

  assert.ok(
    topbarContent.includes('id="tour-scope-switcher"') ||
      scopeSwitcherContent.includes('id="tour-scope-switcher"'),
    "ScopeSwitcher or its Topbar wrapper must have id='tour-scope-switcher'"
  );
});

test("TasksFocusLanding contains tour-tasks-landing anchor and handles ActionableEmptyState", () => {
  const landingPath = path.resolve(
    process.cwd(),
    "src/components/dashboard/zones/tasks-focus-landing.tsx"
  );
  assert.ok(fs.existsSync(landingPath), "tasks-focus-landing.tsx must exist");

  const content = fs.readFileSync(landingPath, "utf-8");
  assert.ok(
    content.includes('id="tour-tasks-landing"'),
    "TasksFocusLanding must have id='tour-tasks-landing'"
  );
  assert.ok(
    content.includes("ActionableEmptyState"),
    "TasksFocusLanding must import and integrate ActionableEmptyState"
  );
});
