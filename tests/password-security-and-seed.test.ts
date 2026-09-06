import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password";

describe("Password Security Utilities", () => {
  test("hashPassword should produce a valid bcrypt hash different from plain text", async () => {
    const raw = "Qcet@2026";
    const hashed = await hashPassword(raw);

    assert.notEqual(hashed, raw);
    assert.match(hashed, /^\$2[aby]\$\d+\$/, "Must be a valid bcrypt hash signature");
  });

  test("verifyPassword should return true for correct password and false for incorrect", async () => {
    const raw = "Qcet@2026";
    const hashed = await hashPassword(raw);

    const isMatch = await verifyPassword(raw, hashed);
    assert.strictEqual(isMatch, true);

    const isWrong = await verifyPassword("WrongPassword", hashed);
    assert.strictEqual(isWrong, false);
  });
});
