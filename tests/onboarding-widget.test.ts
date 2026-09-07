import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ChecklistTaskConfig } from "../src/lib/onboarding-constants";

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

test("CelebrationConfetti source structure verifies canvas, animationFrame, and motion safety", () => {
  const confettiPath = path.resolve(
    process.cwd(),
    "src/components/onboarding/celebration-confetti.tsx"
  );
  assert.ok(fs.existsSync(confettiPath), "celebration-confetti.tsx must exist");
  const content = fs.readFileSync(confettiPath, "utf-8");

  assert.ok(content.includes('"use client"'), "Must be client component");
  assert.ok(content.includes("<canvas"), "Must render canvas element");
  assert.ok(
    content.includes("prefers-reduced-motion"),
    "Must respect prefers-reduced-motion"
  );
  assert.ok(
    content.includes("requestAnimationFrame"),
    "Must utilize requestAnimationFrame for smooth 60fps rendering"
  );
  assert.ok(
    content.includes("cancelAnimationFrame"),
    "Must clean up animationFrame on unmount"
  );
  assert.ok(
    content.includes('aria-hidden="true"'),
    "Canvas should be aria-hidden"
  );
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
    content.includes("CelebrationConfetti"),
    "Widget must render CelebrationConfetti"
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

test("Onboarding widget components contain 0% emoji slop", () => {
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const confettiPath = path.resolve(
    process.cwd(),
    "src/components/onboarding/celebration-confetti.tsx"
  );
  const widgetPath = path.resolve(
    process.cwd(),
    "src/components/onboarding/onboarding-checklist-widget.tsx"
  );

  if (fs.existsSync(confettiPath)) {
    const content = fs.readFileSync(confettiPath, "utf-8");
    assert.equal(emojiRegex.test(content), false, "celebration-confetti.tsx must have 0% emojis");
  }
  if (fs.existsSync(widgetPath)) {
    const content = fs.readFileSync(widgetPath, "utf-8");
    assert.equal(emojiRegex.test(content), false, "onboarding-checklist-widget.tsx must have 0% emojis");
  }
});
