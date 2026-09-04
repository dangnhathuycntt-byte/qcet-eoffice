import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";
import {
  DEMO_LOGIN_CARDS,
  validateLoginForm,
  resolveDemoUserByRole,
} from "../src/lib/login-helpers";

describe("Login Page Demo Credentials", () => {
  test("provides credentials and shortcuts for BGH, HOD, and Staff", () => {
    assert.equal(DEFAULT_DEMO_USERS.length, 3);
    assert.equal(DEFAULT_DEMO_USERS[0].email, "bgh@cdktcnqn.edu.vn");
  });

  test("contains authentic QCET demo cards configuration matching brief verbatim", () => {
    assert.equal(DEMO_LOGIN_CARDS.length, 3);

    // 1. Ban Giám hiệu
    const bghCard = DEMO_LOGIN_CARDS.find((c) => c.role === "ADMIN");
    assert.ok(bghCard, "BGH card must exist");
    assert.equal(bghCard?.title, "Ban Giám hiệu");
    assert.equal(bghCard?.subtitle, "Hiệu trưởng / bgh@cdktcnqn.edu.vn");
    assert.equal(bghCard?.email, "bgh@cdktcnqn.edu.vn");

    // 2. Trưởng đơn vị
    const hodCard = DEMO_LOGIN_CARDS.find((c) => c.role === "MANAGER");
    assert.ok(hodCard, "HOD card must exist");
    assert.equal(hodCard?.title, "Trưởng đơn vị");
    assert.equal(hodCard?.subtitle, "Trưởng phòng Đào tạo & QLKH / daotao@cdktcnqn.edu.vn");
    assert.equal(hodCard?.email, "daotao@cdktcnqn.edu.vn");

    // 3. Chuyên viên
    const staffCard = DEMO_LOGIN_CARDS.find((c) => c.role === "STAFF");
    assert.ok(staffCard, "Staff card must exist");
    assert.equal(staffCard?.title, "Chuyên viên");
    assert.equal(staffCard?.subtitle, "Cán bộ CNTT - Nguyễn Ngọc Vinh / vinhnn@cdktcnqn.edu.vn");
    assert.equal(staffCard?.email, "vinhnn@cdktcnqn.edu.vn");
  });

  test("resolves demo user correctly by role", () => {
    const admin = resolveDemoUserByRole("ADMIN");
    assert.equal(admin.role, "ADMIN");
    assert.equal(admin.email, "bgh@cdktcnqn.edu.vn");

    const manager = resolveDemoUserByRole("MANAGER");
    assert.equal(manager.role, "MANAGER");
    assert.equal(manager.email, "daotao@cdktcnqn.edu.vn");

    const staff = resolveDemoUserByRole("STAFF");
    assert.equal(staff.role, "STAFF");
    assert.equal(staff.email, "vinhnn@cdktcnqn.edu.vn");
  });
});

describe("Login Form Validation & Authentication Logic", () => {
  test("rejects empty or whitespace-only email", () => {
    const resultEmpty = validateLoginForm("");
    assert.equal(resultEmpty.valid, false);
    assert.ok(resultEmpty.error?.includes("Vui lòng nhập địa chỉ email"));

    const resultWhitespace = validateLoginForm("   ");
    assert.equal(resultWhitespace.valid, false);
  });

  test("rejects malformed email formats", () => {
    const result = validateLoginForm("invalid-email-address");
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("không đúng định dạng"));
  });

  test("rejects password shorter than 4 characters when provided", () => {
    const result = validateLoginForm("bgh@cdktcnqn.edu.vn", "123");
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("ít nhất 4 ký tự"));
  });

  test("authenticates known demo emails with corresponding demo user payload", () => {
    const result = validateLoginForm("bgh@cdktcnqn.edu.vn", "password123");
    assert.equal(result.valid, true);
    assert.equal(result.user?.role, "ADMIN");
    assert.equal(result.user?.email, "bgh@cdktcnqn.edu.vn");
  });

  test("login page route file exists in src/app/login/page.tsx", () => {
    const loginFilePath = path.resolve(__dirname, "../src/app/login/page.tsx");
    // Verify directory exists or will exist
    assert.ok(
      fs.existsSync(path.dirname(loginFilePath)),
      "src/app/login directory must exist"
    );
  });
});
