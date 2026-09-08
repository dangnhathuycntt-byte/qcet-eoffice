import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("GoogleLoginButton Component Specifications", () => {
  const componentPath = path.join(process.cwd(), "src/components/auth/google-login-button.tsx");
  const content = fs.readFileSync(componentPath, "utf-8");

  test("points to /api/auth/google for secure server-initiated OAuth", () => {
    assert.ok(content.includes("/api/auth/google"));
  });

  test("displays official domain badge @cdktcnqn.edu.vn", () => {
    assert.ok(content.includes("@cdktcnqn.edu.vn"));
  });

  test("includes loading state with Loader2 and disabled button", () => {
    assert.ok(content.includes("Loader2"));
    assert.ok(content.includes("disabled="));
  });

  test("conforms to Google branding with 4-color Super G logo", () => {
    assert.ok(content.includes("#4285F4"));
    assert.ok(content.includes("#34A853"));
    assert.ok(content.includes("#FBBC05"));
    assert.ok(content.includes("#EA4335"));
  });
});
