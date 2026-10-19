import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { useModalDirtyGuard } from "../src/hooks/use-modal-dirty-guard";

describe("useModalDirtyGuard", () => {
  test("is exported as a function", () => {
    assert.equal(typeof useModalDirtyGuard, "function");
  });
});
