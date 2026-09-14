import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveScopeDetails } from "../src/components/layout/scope-switcher";

describe("Scope Switcher Mobile Adaptation Suite", () => {
  it("resolveScopeDetails correctly formats short label and trigger label for mobile view", () => {
    const mockUser = {
      id: "user_gv_1",
      name: "ThS. Lê Văn Phó",
      email: "lvpho@caothang.edu.vn",
      role: "LECTURER" as const,
      title: "Giảng viên",
      department: "Khoa Công nghệ Thông tin",
      departmentCode: "K_CNTT",
    };

    const details = resolveScopeDetails("unit", "K_CNTT", mockUser);
    assert.equal(details.scope, "unit");
    assert.equal(details.shortLabel, "Khoa CNTT");
    assert.ok(
      details.triggerLabel.includes("Khoa CNTT") ||
      details.triggerLabel.includes("Khoa Công nghệ thông tin")
    );

    const schoolDetails = resolveScopeDetails("school", null, {
      ...mockUser,
      role: "BGH" as const,
    });
    assert.equal(schoolDetails.scope, "school");
    assert.equal(schoolDetails.shortLabel, "Toàn trư��ng");

    const myDetails = resolveScopeDetails("my", null, mockUser);
    assert.equal(myDetails.scope, "my");
    assert.equal(myDetails.shortLabel, "Cá nhân");
  });
});
