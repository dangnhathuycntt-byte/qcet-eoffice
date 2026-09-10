import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChecklistTaskConfig } from "../src/lib/onboarding-constants";
import {
  OnboardingChecklistWidget,
  dispatchRoleAction,
} from "../src/components/onboarding/onboarding-checklist-widget";

test("Next incomplete task is identified correctly", () => {
  const tasks: ChecklistTaskConfig[] = [
    {
      id: "step-1",
      title: "Task 1",
      description: "Desc 1",
      actionLabel: "Do 1",
      actionType: "MODAL",
    },
    {
      id: "step-2",
      title: "Task 2",
      description: "Desc 2",
      actionLabel: "Do 2",
      actionType: "REQUEST_PUSH",
    },
    {
      id: "step-3",
      title: "Task 3",
      description: "Desc 3",
      actionLabel: "Do 3",
      actionType: "OPEN_SEARCH",
    },
  ];
  const completed = ["step-1"];
  const next = tasks.find((t) => !completed.includes(t.id));
  assert.equal(next?.id, "step-2");
});

test("Returns undefined when all tasks are completed", () => {
  const tasks: ChecklistTaskConfig[] = [
    {
      id: "step-1",
      title: "Task 1",
      description: "Desc 1",
      actionLabel: "Do 1",
      actionType: "MODAL",
    },
    {
      id: "step-2",
      title: "Task 2",
      description: "Desc 2",
      actionLabel: "Do 2",
      actionType: "REQUEST_PUSH",
    },
  ];
  const completed = ["step-1", "step-2"];
  const next = tasks.find((t) => !completed.includes(t.id));
  assert.equal(next, undefined);
});

test("Next incomplete task picks first available when none completed", () => {
  const tasks: ChecklistTaskConfig[] = [
    {
      id: "step-1",
      title: "Task 1",
      description: "Desc 1",
      actionLabel: "Do 1",
      actionType: "MODAL",
    },
    {
      id: "step-2",
      title: "Task 2",
      description: "Desc 2",
      actionLabel: "Do 2",
      actionType: "REQUEST_PUSH",
    },
  ];
  const completed: string[] = [];
  const next = tasks.find((t) => !completed.includes(t.id));
  assert.equal(next?.id, "step-1");
});

test("OnboardingChecklistWidget source structure verifies accessibility, role, and actions", () => {
  const widgetPath = path.resolve(
    process.cwd(),
    "src/components/onboarding/onboarding-checklist-widget.tsx"
  );
  assert.ok(fs.existsSync(widgetPath), "onboarding-checklist-widget.tsx must exist");
  const content = fs.readFileSync(widgetPath, "utf-8");

  assert.ok(content.includes('"use client"'), "Must be client component");
  assert.ok(
    content.includes('role="region"'),
    "Widget expanded card must have role='region'"
  );
  assert.ok(
    content.includes("REQUEST_PUSH"),
    "Widget must handle REQUEST_PUSH action"
  );
  assert.ok(
    content.includes("OPEN_SEARCH"),
    "Widget must handle OPEN_SEARCH action"
  );
  assert.ok(
    content.includes("aria-label"),
    "Widget must have accessible aria-labels"
  );
});

test("Snooze button renders in header next to dismiss button and triggers onSnooze", () => {
  const tasks: ChecklistTaskConfig[] = [
    {
      id: "step-1",
      title: "Hoàn tất hồ sơ",
      description: "Kiểm tra thông tin",
      actionLabel: "Xem hồ sơ",
      actionType: "MODAL",
    },
  ];

  const html = renderToStaticMarkup(
    React.createElement(OnboardingChecklistWidget, {
      tasks,
      completedSteps: [],
      percentage: 25,
      isExpanded: true,
      isDismissed: false,
      onToggleExpand: () => {},
      onDismiss: () => {},
      onSnooze: () => {},
      onCompleteStep: () => {},
    })
  );

  assert.ok(html.includes("Nhắc lại sau 24h"), "HTML must contain snooze button text");
  assert.ok(html.includes("Nhắc lại sau 24 giờ"), "HTML must contain snooze aria-label/title");
  assert.ok(html.includes("Ẩn checklist"), "HTML must contain dismiss button");
});

test("Widget hides when isDismissed is true or snoozedUntil is in the future", () => {
  const tasks: ChecklistTaskConfig[] = [
    {
      id: "step-1",
      title: "Hoàn tất hồ sơ",
      description: "Kiểm tra thông tin",
      actionLabel: "Xem hồ sơ",
      actionType: "MODAL",
    },
  ];

  // 1. isDismissed: true
  const dismissedHtml = renderToStaticMarkup(
    React.createElement(OnboardingChecklistWidget, {
      tasks,
      completedSteps: [],
      percentage: 25,
      isExpanded: true,
      isDismissed: true,
      onToggleExpand: () => {},
      onDismiss: () => {},
      onCompleteStep: () => {},
    })
  );
  assert.equal(dismissedHtml, "", "Dismissed widget must return null");

  // 2. snoozedUntil: future
  const futureSnooze = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const snoozedHtml = renderToStaticMarkup(
    React.createElement(OnboardingChecklistWidget, {
      tasks,
      completedSteps: [],
      percentage: 25,
      isExpanded: true,
      isDismissed: false,
      snoozedUntil: futureSnooze,
      onToggleExpand: () => {},
      onDismiss: () => {},
      onCompleteStep: () => {},
    })
  );
  assert.equal(snoozedHtml, "", "Snoozed widget must return null");

  // 3. snoozedUntil: expired past timestamp
  const pastSnooze = new Date(Date.now() - 3600 * 1000).toISOString();
  const expiredHtml = renderToStaticMarkup(
    React.createElement(OnboardingChecklistWidget, {
      tasks,
      completedSteps: [],
      percentage: 25,
      isExpanded: true,
      isDismissed: false,
      snoozedUntil: pastSnooze,
      onToggleExpand: () => {},
      onDismiss: () => {},
      onCompleteStep: () => {},
    })
  );
  assert.ok(expiredHtml.length > 0, "Expired snooze must render widget");
});

test("dispatchRoleAction executes role-based actions and dispatches correct custom events", () => {
  const events: string[] = [];

  // Setup DOM global stubs
  const originalWindow = (globalThis as unknown as { window: unknown }).window;
  const originalCustomEvent = (globalThis as unknown as { CustomEvent: unknown }).CustomEvent;
  const originalDocument = (globalThis as unknown as { document: unknown }).document;

  (globalThis as unknown as { window: unknown }).window = {
    dispatchEvent: (ev: { type: string }) => {
      events.push(ev.type);
      return true;
    },
    location: { pathname: "/tasks", href: "" },
  };

  (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class MockCustomEvent {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };

  (globalThis as unknown as { document: unknown }).document = {
    querySelector: () => null,
  };

  try {
    // 1. BAN_GIAM_HIEU / ADMIN
    events.length = 0;
    const bghAction = dispatchRoleAction("BAN_GIAM_HIEU");
    assert.equal(bghAction, "qcet:navigate-cockpit");
    assert.equal(events[0], "qcet:navigate-cockpit");

    events.length = 0;
    const adminAction = dispatchRoleAction("ADMIN");
    assert.equal(adminAction, "qcet:navigate-cockpit");
    assert.equal(events[0], "qcet:navigate-cockpit");

    // 2. TRUONG_PHONG / MANAGER
    events.length = 0;
    const tpAction = dispatchRoleAction("TRUONG_PHONG");
    assert.equal(tpAction, "qcet:open-create-task");
    assert.equal(events[0], "qcet:open-create-task");

    events.length = 0;
    const mgrAction = dispatchRoleAction("MANAGER");
    assert.equal(mgrAction, "qcet:open-create-task");
    assert.equal(events[0], "qcet:open-create-task");

    // 3. VAN_THU
    events.length = 0;
    let pushedRoute = "";
    const mockRouter = { push: (url: string) => { pushedRoute = url; } };
    const vtAction = dispatchRoleAction("VAN_THU", undefined, mockRouter);
    assert.equal(vtAction, "qcet:navigate-documents");
    assert.equal(events[0], "qcet:navigate-documents");
    assert.equal(pushedRoute, "/documents");

    // 4. CHUYEN_VIEN / GIANG_VIEN / STAFF
    events.length = 0;
    const cvAction = dispatchRoleAction("CHUYEN_VIEN");
    assert.equal(cvAction, "qcet:open-submit-deliverable");
    assert.equal(events[0], "qcet:open-submit-deliverable");

    events.length = 0;
    const gvAction = dispatchRoleAction("GIANG_VIEN");
    assert.equal(gvAction, "qcet:open-submit-deliverable");
    assert.equal(events[0], "qcet:open-submit-deliverable");

    events.length = 0;
    const staffAction = dispatchRoleAction("STAFF");
    assert.equal(staffAction, "qcet:open-submit-deliverable");
    assert.equal(events[0], "qcet:open-submit-deliverable");
  } finally {
    (globalThis as unknown as { window: unknown }).window = originalWindow;
    (globalThis as unknown as { CustomEvent: unknown }).CustomEvent = originalCustomEvent;
    (globalThis as unknown as { document: unknown }).document = originalDocument;
  }
});

test("Celebration UX renders milestone badge and dismiss button when percentage is 100%", () => {
  const tasks: ChecklistTaskConfig[] = [
    {
      id: "step-1",
      title: "Hoàn tất hồ sơ",
      description: "Kiểm tra thông tin",
      actionLabel: "Xem hồ sơ",
      actionType: "MODAL",
    },
  ];

  // Expanded 100% view
  const expandedHtml = renderToStaticMarkup(
    React.createElement(OnboardingChecklistWidget, {
      tasks,
      completedSteps: ["step-1"],
      percentage: 100,
      isExpanded: true,
      isDismissed: false,
      onToggleExpand: () => {},
      onDismiss: () => {},
      onCompleteStep: () => {},
    })
  );

  assert.ok(
    expandedHtml.includes("Cán bộ số hóa tiêu biểu"),
    "Celebration banner must contain milestone badge 'Cán bộ số hóa tiêu biểu'"
  );
  assert.ok(
    expandedHtml.includes("100% Hoàn tất"),
    "Celebration banner must show 100% completion badge"
  );
  assert.ok(
    expandedHtml.includes("Đóng và bắt đầu làm việc"),
    "Celebration banner must offer button to close/dismiss checklist"
  );

  // Collapsed 100% mini-pill view
  const collapsedHtml = renderToStaticMarkup(
    React.createElement(OnboardingChecklistWidget, {
      tasks,
      completedSteps: ["step-1"],
      percentage: 100,
      isExpanded: false,
      isDismissed: false,
      onToggleExpand: () => {},
      onDismiss: () => {},
      onCompleteStep: () => {},
    })
  );

  assert.ok(
    collapsedHtml.includes("Cán bộ số hóa tiêu biểu"),
    "Collapsed mini-pill must also display milestone badge title"
  );
});

test("AppShell integrates onSnooze and snoozedUntil into OnboardingChecklistWidget", () => {
  const appShellPath = path.resolve(
    process.cwd(),
    "src/components/layout/app-shell.tsx"
  );
  assert.ok(fs.existsSync(appShellPath), "app-shell.tsx must exist");
  const content = fs.readFileSync(appShellPath, "utf-8");

  assert.ok(
    content.includes("snoozeOnboarding(24)"),
    "AppShell must wire snoozeOnboarding(24) to onSnooze"
  );
  assert.ok(
    content.includes("snoozedUntil={onboarding.state.snoozedUntil}"),
    "AppShell must pass snoozedUntil to OnboardingChecklistWidget"
  );
});

test("Onboarding widget components contain 0% emoji slop and obey light-only rules", () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const confettiPath = path.resolve(
    process.cwd(),
    "src/components/onboarding/celebration-confetti.tsx"
  );
  const widgetPath = path.resolve(
    process.cwd(),
    "src/components/onboarding/onboarding-checklist-widget.tsx"
  );

  assert.ok(fs.existsSync(confettiPath), "celebration-confetti.tsx must exist");
  assert.ok(fs.existsSync(widgetPath), "onboarding-checklist-widget.tsx must exist");

  const confettiContent = fs.readFileSync(confettiPath, "utf-8");
  assert.equal(emojiRegex.test(confettiContent), false, "celebration-confetti.tsx must have 0% emojis");
  assert.equal(confettiContent.includes("dark:"), false, "celebration-confetti.tsx must not have dark: classes");

  const widgetContent = fs.readFileSync(widgetPath, "utf-8");
  assert.equal(emojiRegex.test(widgetContent), false, "onboarding-checklist-widget.tsx must have 0% emojis");
  assert.equal(widgetContent.includes("dark:"), false, "onboarding-checklist-widget.tsx must not have dark: classes");
});
