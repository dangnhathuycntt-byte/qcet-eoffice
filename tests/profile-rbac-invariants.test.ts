import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("P0 Profile / RBAC UX Invariants", () => {
  const filePath = path.join(process.cwd(), "src/components/auth/user-profile-modal.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  test("User cannot self-select system roles (no setRole onClick buttons)", () => {
    assert.strictEqual(
      content.includes('onClick={() => setRole("STAFF")}'),
      false,
      "Must not have self-assign STAFF button"
    );
    assert.strictEqual(
      content.includes('onClick={() => setRole("MANAGER")}'),
      false,
      "Must not have self-assign MANAGER button"
    );
    assert.strictEqual(
      content.includes('onClick={() => setRole("ADMIN")}'),
      false,
      "Must not have self-assign ADMIN button"
    );
  });

  test("Role is displayed as read-only institutional data", () => {
    assert.ok(
      content.includes("Quản trị viên") || content.includes("Nhà trường quản lý") || content.includes("chỉ đọc"),
      "Must explain role is managed by school/admin/org data"
    );
  });
});
