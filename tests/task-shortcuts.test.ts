import test from "node:test";
import assert from "node:assert/strict";
import { shouldIgnoreShortcut, shouldIgnoreSpaceKey, isInteractiveInput } from "../src/lib/shortcuts/guards";
import { ShortcutRegistry } from "../src/lib/shortcuts/registry";
import { formatShortcutLabel } from "../src/lib/shortcuts/platform";

test("guards: detects interactive input elements", () => {
  const input = { tagName: "INPUT", getAttribute: () => null } as unknown as HTMLElement;
  const textarea = { tagName: "TEXTAREA", getAttribute: () => null } as unknown as HTMLElement;
  const select = { tagName: "SELECT", getAttribute: () => null } as unknown as HTMLElement;
  const div = { tagName: "DIV", getAttribute: () => null } as unknown as HTMLElement;
  const textboxRole = { tagName: "DIV", getAttribute: (attr: string) => attr === "role" ? "textbox" : null } as unknown as HTMLElement;

  assert.equal(isInteractiveInput(input), true);
  assert.equal(isInteractiveInput(textarea), true);
  assert.equal(isInteractiveInput(select), true);
  assert.equal(isInteractiveInput(textboxRole), true);
  assert.equal(isInteractiveInput(div), false);
});

test("guards: shouldIgnoreSpaceKey protects buttons, checkboxes, and interactive controls", () => {
  const button = { tagName: "BUTTON", getAttribute: () => null } as unknown as HTMLElement;
  const checkbox = { tagName: "INPUT", getAttribute: (attr: string) => attr === "role" ? "checkbox" : null } as unknown as HTMLElement;
  const tableRow = { tagName: "TR", getAttribute: () => null } as unknown as HTMLElement;

  const eventOnButton = { target: button, isComposing: false, keyCode: 32 } as unknown as KeyboardEvent;
  const eventOnCheckbox = { target: checkbox, isComposing: false, keyCode: 32 } as unknown as KeyboardEvent;
  const eventOnRow = { target: tableRow, isComposing: false, keyCode: 32 } as unknown as KeyboardEvent;

  assert.equal(shouldIgnoreSpaceKey(eventOnButton), true);
  assert.equal(shouldIgnoreSpaceKey(eventOnCheckbox), true);
  assert.equal(shouldIgnoreSpaceKey(eventOnRow), false);
});

test("shortcuts: registry registers, matches keys, and handles actions", () => {
  const registry = new ShortcutRegistry();
  let fired = false;

  const unregister = registry.register({
    id: "test-c",
    description: "Create task",
    key: "c",
    action: () => {
      fired = true;
    },
  });

  const row = { tagName: "TR", getAttribute: () => null } as unknown as HTMLElement;
  const eventC = {
    key: "c",
    target: row,
    isComposing: false,
    preventDefault: () => {},
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
  } as unknown as KeyboardEvent;

  const handled = registry.handleKeyDown(eventC);
  assert.equal(handled, true);
  assert.equal(fired, true);

  unregister();
  fired = false;
  const handledAfterUnregister = registry.handleKeyDown(eventC);
  assert.equal(handledAfterUnregister, false);
  assert.equal(fired, false);
});

test("platform: formats shortcut labels", () => {
  const label = formatShortcutLabel(["ctrl", "shift", "c"]);
  assert.ok(label.includes("C"));
});
