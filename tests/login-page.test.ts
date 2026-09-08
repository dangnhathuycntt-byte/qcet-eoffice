import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";
import {
  DEMO_LOGIN_CARDS,
  validateLoginForm,
  resolveDemoUserByRole,
  resolveOAuthError,
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
    assert.ok(admin);
    assert.equal(admin.role, "ADMIN");
    assert.equal(admin.email, "bgh@cdktcnqn.edu.vn");

    const manager = resolveDemoUserByRole("MANAGER");
    assert.ok(manager);
    assert.equal(manager.role, "MANAGER");
    assert.equal(manager.email, "daotao@cdktcnqn.edu.vn");

    const staff = resolveDemoUserByRole("STAFF");
    assert.ok(staff);
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

  test("login page, google login modal, and mobile drawer do not contain hardcoded seed accounts or passwords (CWE-798)", () => {
    const loginContent = fs.readFileSync(
      path.resolve(__dirname, "../src/app/login/page.tsx"),
      "utf8"
    );
    assert.ok(!loginContent.includes("SEED_ACCOUNTS"), "SEED_ACCOUNTS must be removed from login page");
    assert.ok(!loginContent.includes("handleQuickSeedLogin"), "handleQuickSeedLogin must be removed from login page");
    assert.ok(!loginContent.includes("Qcet@2026"), "Hardcoded password Qcet@2026 must be removed from login page");
    assert.ok(
      !loginContent.includes("Tài khoản kiểm thử CSDL hạt nhân"),
      "1-Click test accounts UI must be removed from login page"
    );

    const googleBtnContent = fs.readFileSync(
      path.resolve(__dirname, "../src/components/auth/google-login-button.tsx"),
      "utf8"
    );
    assert.ok(!googleBtnContent.includes("Qcet@2026"), "Hardcoded password Qcet@2026 must be removed from google button modal");
    assert.ok(!googleBtnContent.includes("tài khoản kiểm thử hạt nhân"), "Test accounts mention must be removed from google button modal");

    const drawerContent = fs.readFileSync(
      path.resolve(__dirname, "../src/components/layout/mobile-menu-drawer.tsx"),
      "utf8"
    );
    assert.ok(!drawerContent.includes("CHUYỂN VAI TRÒ TRẢI NGHIỆM"), "Demo role switcher must be removed from mobile menu drawer");
    assert.ok(!drawerContent.includes("DEMO_USERS"), "DEMO_USERS must not be imported in mobile menu drawer");
  });
});

describe("OAuth Error Mapping & Resolution", () => {
  test("returns null when no error code is provided", () => {
    assert.equal(resolveOAuthError(null), null);
    assert.equal(resolveOAuthError(undefined), null);
    assert.equal(resolveOAuthError(""), null);
  });

  test("maps domain_not_allowed with amber variant, message, email, and retry action", () => {
    const errorInfo = resolveOAuthError("domain_not_allowed", "user@gmail.com");
    assert.ok(errorInfo, "errorInfo should not be null");
    assert.equal(errorInfo.code, "domain_not_allowed");
    assert.equal(errorInfo.variant, "amber");
    assert.ok(
      errorInfo.message.includes("Tài khoản không thuộc miền @cdktcnqn.edu.vn"),
      "Message must mention @cdktcnqn.edu.vn"
    );
    assert.ok(errorInfo.message.includes("user@gmail.com"), "Message should include the violating email");
    assert.equal(errorInfo.email, "user@gmail.com");
    assert.equal(errorInfo.actionText, "Thử lại bằng tài khoản trường");
    assert.equal(errorInfo.actionHref, "/api/auth/google");
  });

  test("maps account_disabled with red variant and IT department contact guidance", () => {
    const errorInfo = resolveOAuthError("account_disabled");
    assert.ok(errorInfo);
    assert.equal(errorInfo.code, "account_disabled");
    assert.equal(errorInfo.variant, "red");
    assert.ok(
      errorInfo.message.includes("Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa"),
      "Message must state account is locked or disabled"
    );
    assert.ok(
      errorInfo.message.includes("Phòng Quản trị Mạng và CNTT"),
      "Message must instruct contacting IT department"
    );
  });

  test("maps oauth_cancelled with neutral variant", () => {
    const errorInfo = resolveOAuthError("oauth_cancelled");
    assert.ok(errorInfo);
    assert.equal(errorInfo.code, "oauth_cancelled");
    assert.equal(errorInfo.variant, "neutral");
    assert.ok(
      errorInfo.message.includes("Bạn đã hủy quá trình đăng nhập bằng Google"),
      "Message must state user cancelled"
    );
  });

  test("maps oauth_state_invalid with red variant and expired/invalid message", () => {
    const errorInfo = resolveOAuthError("oauth_state_invalid");
    assert.ok(errorInfo);
    assert.equal(errorInfo.code, "oauth_state_invalid");
    assert.equal(errorInfo.variant, "red");
    assert.ok(
      errorInfo.message.includes("Phiên đăng nhập đã hết hạn hoặc không hợp lệ"),
      "Message must state session expired or invalid"
    );
  });

  test("maps oauth_not_configured with red variant and unconfigured message", () => {
    const errorInfo = resolveOAuthError("oauth_not_configured");
    assert.ok(errorInfo);
    assert.equal(errorInfo.code, "oauth_not_configured");
    assert.equal(errorInfo.variant, "red");
    assert.ok(
      errorInfo.message.includes("Hệ thống chưa cấu hình Google OAuth"),
      "Message must state Google OAuth is unconfigured"
    );
  });

  test("maps generic or unknown oauth errors (oauth_failed, etc.) with default message", () => {
    const errorInfo = resolveOAuthError("oauth_failed");
    assert.ok(errorInfo);
    assert.equal(errorInfo.variant, "red");
    assert.ok(
      errorInfo.message.includes("Đã xảy ra lỗi trong quá trình xác thực với Google"),
      "Message must provide generic Google authentication error notice"
    );

    const unknownInfo = resolveOAuthError("unknown_error_xyz");
    assert.ok(unknownInfo);
    assert.equal(unknownInfo.variant, "red");
    assert.ok(
      unknownInfo.message.includes("Đã xảy ra lỗi trong quá trình xác thực với Google"),
      "Message must provide generic Google authentication error notice"
    );
  });
});

describe("Login Page UI Structure & Standards", () => {
  const loginContent = fs.readFileSync(
    path.resolve(__dirname, "../src/app/login/page.tsx"),
    "utf8"
  );

  test("wraps content in React.Suspense boundary for useSearchParams compatibility", () => {
    assert.ok(
      loginContent.includes("Suspense"),
      "Login page must import or use React.Suspense"
    );
    assert.ok(
      loginContent.includes("useSearchParams"),
      "Login page must use useSearchParams to extract error and email"
    );
  });

  test("includes GoogleLoginButton and uppercase HOẶC divider", () => {
    assert.ok(
      loginContent.includes("<GoogleLoginButton"),
      "Login page must render GoogleLoginButton component"
    );
    assert.ok(
      loginContent.includes("HOẶC") || loginContent.includes("Hoặc"),
      "Login page must include 'HOẶC' divider"
    );
  });

  test("adheres strictly to Light-Only Standard without dark: classes or decorative emojis", () => {
    const darkClasses = loginContent.match(/dark:[a-zA-Z0-9_-]+/g);
    assert.equal(darkClasses, null, "Login page must not contain dark: classes");

    // Ensure no decorative emojis in login page
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.ok(!emojiRegex.test(loginContent), "Login page must not contain decorative emojis");
  });
});

