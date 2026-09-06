import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Client Auth Context & Login Contract", () => {
  test("src/lib/auth-context.tsx provides login and register async functions", () => {
    const content = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/auth-context.tsx"),
      "utf-8"
    );
    assert.match(content, /login:\s*\(email:\s*string,\s*password:\s*string\)\s*=>\s*Promise/, "Must declare async login");
    assert.match(content, /logout:\s*\(\)\s*=>\s*Promise/, "Must declare async logout");
    assert.match(content, /\/api\/auth\/me/, "Must call /api/auth/me to sync persistent session");
  });

  test("src/app/login/page.tsx calls real login endpoint", () => {
    const content = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/login/page.tsx"),
      "utf-8"
    );
    assert.match(content, /await login\(/, "Must call login with real credentials");
  });
});
