import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  validateLoginForm,
  resolveDemoUserByRole,
  resolveOAuthError,
  sanitizeRedirectUrl,
} from "../src/lib/login-helpers";

describe("Login Form Validation & Safe Fallback Contract", () => {
  test("resolveDemoUserByRole safely returns undefined in zero-mock environment", () => {
    assert.equal(resolveDemoUserByRole("ADMIN"), undefined);
    assert.equal(resolveDemoUserByRole("MANAGER"), undefined);
    assert.equal(resolveDemoUserByRole("STAFF"), undefined);
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

  test("validates properly formatted credentials without synthesizing mock users", () => {
    const resultAdmin = validateLoginForm("bgh@cdktcnqn.edu.vn", "password123");
    assert.equal(resultAdmin.valid, true);
    assert.equal(resultAdmin.user, undefined, "Must not synthesize mock user");

    const resultManager = validateLoginForm("daotao@cdktcnqn.edu.vn", "password123");
    assert.equal(resultManager.valid, true);
    assert.equal(resultManager.user, undefined);

    const resultStaff = validateLoginForm("vinhnn@cdktcnqn.edu.vn", "password123");
    assert.equal(resultStaff.valid, true);
    assert.equal(resultStaff.user, undefined);
  });

  test("validates unknown emails without synthesizing fake privilege or staff users", () => {
    const fakeBgh = validateLoginForm("bgh-hacker@cdktcnqn.edu.vn", "pass1234");
    assert.equal(fakeBgh.valid, true);
    assert.equal(fakeBgh.user, undefined);

    const fakeDaotao = validateLoginForm("phong.daotao.fake@cdktcnqn.edu.vn", "pass1234");
    assert.equal(fakeDaotao.valid, true);
    assert.equal(fakeDaotao.user, undefined);

    const standardUnknown = validateLoginForm("nguyenvana@cdktcnqn.edu.vn", "pass1234");
    assert.equal(standardUnknown.valid, true);
    assert.equal(standardUnknown.user, undefined);
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

  test("implements pure Google Workspace SSO without internal credentials form or HOẶC divider", () => {
    assert.ok(
      loginContent.includes("<GoogleLoginButton"),
      "Login page must render GoogleLoginButton component"
    );
    assert.ok(
      !loginContent.includes("HOẶC"),
      "Login page must not include 'HOẶC' divider"
    );
    assert.ok(
      !loginContent.includes("handleStandardLogin"),
      "Internal credential submit handler must be removed"
    );
    assert.ok(
      !loginContent.includes("handleRegister"),
      "Registration submit handler must be removed"
    );
  });

  test("adheres strictly to Light-Only Standard without dark: classes or decorative emojis", () => {
    const darkClasses = loginContent.match(/dark:[a-zA-Z0-9_-]+/g);
    assert.equal(darkClasses, null, "Login page must not contain dark: classes");

    // Ensure no decorative emojis in login page
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.ok(!emojiRegex.test(loginContent), "Login page must not contain decorative emojis");
  });

  test("uses semantic main element with accessible label and auto-redirects authenticated users", () => {
    assert.ok(
      loginContent.includes('<main'),
      "Login page must use semantic <main> tag"
    );
    assert.ok(
      loginContent.includes('role="main"'),
      'Login page must specify role="main"'
    );
    assert.ok(
      loginContent.includes('aria-label="Trang đăng nhập QCET E-Office"'),
      'Login page must have aria-label="Trang đăng nhập QCET E-Office"'
    );
    assert.ok(
      loginContent.includes("router.replace"),
      "Login page must auto-redirect authenticated users using router.replace"
    );
  });

  test("contains authentic QCET institutional header, domain badge, and academic workspace subtext", () => {
    assert.ok(loginContent.includes("QCET E-Office"));
    assert.ok(loginContent.includes("Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"));
    assert.ok(loginContent.includes("/logo-qcet.png"));
    assert.ok(loginContent.includes("@cdktcnqn.edu.vn"));
    assert.ok(
      loginContent.includes(
        "Hệ thống làm việc và điều hành văn bản điện tử dành cho Cán bộ, Giảng viên & Nhân viên Nhà trường."
      )
    );
    assert.ok(
      loginContent.includes(
        "Hệ thống bảo mật sử dụng tài khoản email chính thức của Nhà trường"
      )
    );
    assert.ok(
      loginContent.includes("Hệ thống Quản lý Văn bản & Điều hành")
    );
    assert.ok(
      !loginContent.includes("Xác thực an toàn qua Google Identity"),
      "Login page must not contain 'Xác thực an toàn qua Google Identity'"
    );
    assert.ok(
      !loginContent.includes("SSO"),
      "Login page must not contain 'SSO'"
    );
    assert.ok(loginContent.includes("ShieldCheck"));
  });
});

describe("Open Redirect Protection (OWASP A01)", () => {
  test("allows legitimate relative URLs", () => {
    assert.equal(sanitizeRedirectUrl("/"), "/");
    assert.equal(sanitizeRedirectUrl("/?zone=tasks"), "/?zone=tasks");
    assert.equal(sanitizeRedirectUrl("/dashboard"), "/dashboard");
    assert.equal(sanitizeRedirectUrl("/settings/profile?tab=security"), "/settings/profile?tab=security");
  });

  test("blocks external protocol-relative URLs", () => {
    assert.equal(sanitizeRedirectUrl("//evil.com"), "/");
    assert.equal(sanitizeRedirectUrl("//google.com/phishing"), "/");
  });

  test("blocks backslash bypasses", () => {
    assert.equal(sanitizeRedirectUrl("/\\evil.com"), "/");
    assert.equal(sanitizeRedirectUrl("\\evil.com"), "/");
  });

  test("blocks absolute URLs with schemes", () => {
    assert.equal(sanitizeRedirectUrl("https://evil.com"), "/");
    assert.equal(sanitizeRedirectUrl("http://evil.com"), "/");
    assert.equal(sanitizeRedirectUrl("javascript:alert(1)"), "/");
    assert.equal(sanitizeRedirectUrl("data:text/html,<script>alert(1)</script>"), "/");
  });

  test("blocks control characters and CRLF injection", () => {
    assert.equal(sanitizeRedirectUrl("/path\r\nevil"), "/");
    assert.equal(sanitizeRedirectUrl("/path\tfoo"), "/");
  });

  test("handles null, undefined, and empty string safely", () => {
    assert.equal(sanitizeRedirectUrl(null), "/");
    assert.equal(sanitizeRedirectUrl(undefined), "/");
    assert.equal(sanitizeRedirectUrl(""), "/");
    assert.equal(sanitizeRedirectUrl("   "), "/");
  });
});

