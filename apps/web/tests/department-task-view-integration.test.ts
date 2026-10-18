import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseViewModeParam } from "../src/lib/unified-task-hub";

describe("Department Grouped Task View Integration", () => {

  test("parseViewModeParam parses 'department' and 'don-vi' correctly", () => {
    assert.equal(parseViewModeParam("department"), "department");
    assert.equal(parseViewModeParam("don-vi"), "department");
    assert.equal(parseViewModeParam("unit"), "department");
  });

});
