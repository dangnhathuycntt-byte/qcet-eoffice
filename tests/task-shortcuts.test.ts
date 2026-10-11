import test from "node:test";
import assert from "node:assert/strict";
import { shouldIgnoreShortcut, isInteractiveInput } from "../src/lib/shortcuts/guards";

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
