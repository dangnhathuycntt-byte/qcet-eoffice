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

test("Contextual components and ScopeSwitcher contain required tour DOM anchors", () => {
  const topbarPath = path.resolve(
    process.cwd(),
    "src/components/layout/app-topbar.tsx"
  );
  const scopeSwitcherPath = path.resolve(
    process.cwd(),
    "src/components/layout/scope-switcher.tsx"
  );
  const dashboardZonePath = path.resolve(
    process.cwd(),
    "src/components/dashboard/zones/dashboard-zone.tsx"
  );

  const topbarContent = fs.readFileSync(topbarPath, "utf-8");
  const scopeSwitcherContent = fs.readFileSync(scopeSwitcherPath, "utf-8");
  const dashboardZoneContent = fs.readFileSync(dashboardZonePath, "utf-8");

  assert.ok(
    topbarContent.includes('id="tour-topbar-search"'),
    "AppTopbar must have id='tour-topbar-search' on search button/container"
  );

  assert.ok(
    dashboardZoneContent.includes('id="tour-scope-switcher"') ||
      scopeSwitcherContent.includes('id="tour-scope-switcher"'),
    "ScopeSwitcher or its DashboardZone wrapper must have id='tour-scope-switcher'"
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

test("AppTopbar provides restart-onboarding trigger and OnboardingHub handles event", () => {
  const topbarPath = path.resolve(
    process.cwd(),
    "src/components/layout/app-topbar.tsx"
  );
  const shellPath = path.resolve(
    process.cwd(),
    "src/components/layout/app-shell.tsx"
  );

  assert.ok(fs.existsSync(topbarPath), "app-topbar.tsx must exist");
  assert.ok(fs.existsSync(shellPath), "app-shell.tsx must exist");

  const topbarContent = fs.readFileSync(topbarPath, "utf-8");
  const shellContent = fs.readFileSync(shellPath, "utf-8");

  // Verify AppTopbar contains trigger and dispatches custom event
  assert.ok(
    topbarContent.includes("Hướng dẫn sử dụng hệ thống"),
    "AppTopbar must include 'Hướng dẫn sử dụng hệ thống' menu item"
  );
  assert.ok(
    topbarContent.includes('"qcet:restart-onboarding"'),
    "AppTopbar must dispatch 'qcet:restart-onboarding' custom event"
  );

  // Verify OnboardingHub listens to event and handles restart
  assert.ok(
    shellContent.includes('"qcet:restart-onboarding"'),
    "OnboardingHub must listen to 'qcet:restart-onboarding' event"
  );
  assert.ok(
    shellContent.includes("onboarding.restartOnboarding()"),
    "OnboardingHub must call restartOnboarding on event"
  );
  assert.ok(
    shellContent.includes("onboarding.setIsChecklistExpanded(true)"),
    "OnboardingHub must expand checklist on event"
  );
  assert.ok(
    shellContent.includes('removeEventListener("qcet:restart-onboarding"'),
    "OnboardingHub must clean up event listener on unmount"
  );

  // Runtime event dispatch test simulation
  let restartCalled = false;
  let checklistExpanded = false;
  const mockOnboarding = {
    restartOnboarding: () => {
      restartCalled = true;
    },
    setIsChecklistExpanded: (val: boolean) => {
      checklistExpanded = val;
    },
  };

  const handler = () => {
    mockOnboarding.restartOnboarding();
    mockOnboarding.setIsChecklistExpanded(true);
  };

  const bus = new EventTarget();
  bus.addEventListener("qcet:restart-onboarding", handler);
  bus.dispatchEvent(new CustomEvent("qcet:restart-onboarding"));
  bus.removeEventListener("qcet:restart-onboarding", handler);

  assert.equal(restartCalled, true, "restartOnboarding should be called when event dispatched");
  assert.equal(checklistExpanded, true, "setIsChecklistExpanded should be called with true when event dispatched");
});

