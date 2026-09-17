import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  validateLoginForm,
  resolveDemoUserByRole,
  resolveOAuthError,
  sanitizeRedirectUrl,
  shouldShowLoginSkeleton,
} from "../src/lib/login-helpers";

describe("Issue #6: Single Centered Column Architecture & Institutional Copy Verification", () => {
  const loginPageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/login/page.tsx"),
    "utf-8"
  );

  test("does not contain campus-qcet.jpg or 56% desktop split panel", () => {
    assert.strictEqual(
      loginPageSource.includes("campus-qcet.jpg"),
      false,
      "src/app/login/page.tsx must NOT contain campus-qcet.jpg"
    );
    assert.strictEqual(
      loginPageSource.includes("w-[56%]"),
      false,
      "src/app/login/page.tsx must NOT contain 56% column panel"
    );
    assert.strictEqual(
      loginPageSource.includes("w-[44%]"),
      false,
      "src/app/login/page.tsx must NOT contain 44% column panel"
    );
  });

  test("uses centered container with max-w-[360px]", () => {
    assert.ok(
      loginPageSource.includes("max-w-[360px]"),
      "src/app/login/page.tsx must have max-w-[360px] centered container"
    );
    assert.ok(
      loginPageSource.includes("flex-col items-center"),
      "src/app/login/page.tsx must center items vertically and horizontally"
    );
  });

  test("contains standard institutional Vietnamese labels and copy", () => {
    // Heading
    assert.ok(
      loginPageSource.includes("Đăng nhập QCET Work"),
      "Must contain 'Đăng nhập QCET Work' heading"
    );
    // Subheading
    assert.ok(
      loginPageSource.includes("Sử dụng tài khoản Google của nhà trường."),
      "Must contain 'Sử dụng tài khoản Google của nhà trường.' subheading"
    );
    // Role condition note
    assert.ok(
      loginPageSource.includes("Dành cho tài khoản @cdktcnqn.edu.vn đã được cấp quyền."),
      "Must contain 'Dành cho tài khoản @cdktcnqn.edu.vn đã được cấp quyền.' copy"
    );
    // Support link & email
    assert.ok(
      loginPageSource.includes("Gặp sự cố? Liên hệ hỗ trợ"),
      "Must contain 'Gặp sự cố? Liên hệ hỗ trợ' text"
    );
    assert.ok(
      loginPageSource.includes("mailto:support@cdktcnqn.edu.vn"),
      "Must link to mailto:support@cdktcnqn.edu.vn"
    );
  });

  test("includes dismiss buttons for OAuth and runtime error notices", () => {
    assert.ok(
      loginPageSource.includes('aria-label="Đóng thông báo"'),
      "OAuth notice must have dismiss button with accessible label"
    );
    assert.ok(
      loginPageSource.includes('aria-label="Đóng thông báo lỗi"'),
      "Runtime error notice must have dismiss button with accessible label"
    );
  });
});

describe("Issue #6: Login Skeleton State Protection", () => {
  test("shouldShowLoginSkeleton behaves correctly under all session states", () => {
    // 1. Initial page load (isLoading=true) -> skeleton
    assert.strictEqual(
      shouldShowLoginSkeleton({ isLoading: true, isAuthenticated: false, user: null }),
      true,
      "Must show skeleton while session is loading"
    );

    // 2. Fully authenticated user -> skeleton while redirecting
    assert.strictEqual(
      shouldShowLoginSkeleton({
        isLoading: false,
        isAuthenticated: true,
        user: { id: "usr_1", email: "test@cdktcnqn.edu.vn" },
      }),
      true,
      "Must show skeleton for authenticated user during auto-redirect"
    );

    // 3. Unauthenticated visitor -> do NOT show skeleton (render login form)
    assert.strictEqual(
      shouldShowLoginSkeleton({ isLoading: false, isAuthenticated: false, user: null }),
      false,
      "Must NOT show skeleton for unauthenticated visitor"
    );

    // 4. Stale offline cache (user object present but isAuthenticated is false) -> do NOT show skeleton
    assert.strictEqual(
      shouldShowLoginSkeleton({
        isLoading: false,
        isAuthenticated: false,
        user: { id: "stale_usr", email: "stale@cdktcnqn.edu.vn" },
      }),
      false,
      "Must NOT trap unauthenticated visitor in infinite skeleton even with stale cached user"
    );
  });
});

describe("Issue #6: OAuth Error Resolution & Error Variants", () => {
  test("returns null when no error code is provided", () => {
    assert.equal(resolveOAuthError(null), null);
    assert.equal(resolveOAuthError(undefined), null);
    assert.equal(resolveOAuthError(""), null);
  });

  test("domain_not_allowed: amber alert with email details & retry action", () => {
    const errorInfo = resolveOAuthError("domain_not_allowed", "personal@gmail.com");
    assert.ok(errorInfo);
    assert.equal(errorInfo.code, "domain_not_allowed");
    assert.equal(errorInfo.variant, "amber");
    assert.ok(errorInfo.title.includes("Email không thuộc hệ thống"));
    assert.ok(errorInfo.message.includes("personal@gmail.com"));
    assert.ok(errorInfo.message.includes("@cdktcnqn.edu.vn"));
    assert.equal(errorInfo.actionText, "Thử lại bằng tài khoản trường");
    assert.equal(errorInfo.actionHref, "/login?startGoogle=1");
  });

  test("account_not_found / AccessDenied: amber alert informing user to contact IT", () => {
    const notFound = resolveOAuthError("account_not_found");
    assert.ok(notFound);
    assert.equal(notFound.variant, "amber");
    assert.ok(notFound.title.includes("chưa được cấp quyền"));
    assert.ok(notFound.message.includes("qtm@cdktcnqn.edu.vn"));

    const accessDenied = resolveOAuthError("AccessDenied");
    assert.ok(accessDenied);
    assert.equal(accessDenied.variant, "amber");
    assert.ok(accessDenied.title.includes("chưa được cấp quyền"));
  });

  test("account_disabled: red alert for suspended account", () => {
    const errorInfo = resolveOAuthError("account_disabled");
    assert.ok(errorInfo);
    assert.equal(errorInfo.code, "account_disabled");
    assert.equal(errorInfo.variant, "red");
    assert.ok(errorInfo.title.includes("khóa"));
  });

  test("oauth_cancelled: neutral alert when user cancels OAuth consent", () => {
    const errorInfo = resolveOAuthError("oauth_cancelled");
    assert.ok(errorInfo);
    assert.equal(errorInfo.code, "oauth_cancelled");
    assert.equal(errorInfo.variant, "neutral");
    assert.ok(errorInfo.message.includes("hủy quá trình đăng nhập"));
  });

  test("oauth_state_invalid: red alert for expired CSRF state", () => {
    const errorInfo = resolveOAuthError("oauth_state_invalid");
    assert.ok(errorInfo);
    assert.equal(errorInfo.variant, "red");
    assert.ok(errorInfo.message.includes("hết hạn"));
  });

  test("oauth_not_configured: red alert for server configuration issue", () => {
    const errorInfo = resolveOAuthError("oauth_not_configured");
    assert.ok(errorInfo);
    assert.equal(errorInfo.variant, "red");
    assert.ok(errorInfo.message.includes("chưa cấu hình Google OAuth"));
  });

  test("fallback for missing_code, oauth_failed, or arbitrary error strings", () => {
    const generic = resolveOAuthError("oauth_failed");
    assert.ok(generic);
    assert.equal(generic.variant, "red");
    assert.ok(generic.title.includes("Đăng nhập không thành công"));

    const unknown = resolveOAuthError("unknown_custom_oauth_code");
    assert.ok(unknown);
    assert.equal(unknown.variant, "red");
    assert.equal(unknown.code, "unknown_custom_oauth_code");
  });
});

describe("Issue #6: Open Redirect Protection (OWASP A01)", () => {
  test("allows legitimate relative application paths", () => {
    assert.equal(sanitizeRedirectUrl("/tasks"), "/tasks");
    assert.equal(sanitizeRedirectUrl("/tasks?scope=my"), "/tasks?scope=my");
    assert.equal(sanitizeRedirectUrl("/documents/inbound"), "/documents/inbound");
    assert.equal(sanitizeRedirectUrl("/settings/profile?tab=security"), "/settings/profile?tab=security");
  });

  test("normalizes root, login, and auth api paths to /tasks to prevent loops", () => {
    assert.equal(sanitizeRedirectUrl("/"), "/tasks");
    assert.equal(sanitizeRedirectUrl("/login"), "/tasks");
    assert.equal(sanitizeRedirectUrl("/login?error=oauth_cancelled"), "/tasks");
    assert.equal(sanitizeRedirectUrl("/api/auth/signin"), "/tasks");
  });

  test("blocks protocol-relative URLs", () => {
    assert.equal(sanitizeRedirectUrl("//evil.com"), "/tasks");
    assert.equal(sanitizeRedirectUrl("//attacker.com/malicious"), "/tasks");
  });

  test("blocks backslash open-redirect bypass tricks", () => {
    assert.equal(sanitizeRedirectUrl("/\\evil.com"), "/tasks");
    assert.equal(sanitizeRedirectUrl("\\evil.com"), "/tasks");
  });

  test("blocks absolute URLs and malicious schemes", () => {
    assert.equal(sanitizeRedirectUrl("https://evil.com"), "/tasks");
    assert.equal(sanitizeRedirectUrl("http://evil.com"), "/tasks");
    assert.equal(sanitizeRedirectUrl("javascript:alert(1)"), "/tasks");
    assert.equal(sanitizeRedirectUrl("data:text/html,<script>alert(1)</script>"), "/tasks");
  });

  test("blocks CRLF and control character injections", () => {
    assert.equal(sanitizeRedirectUrl("/path\r\nevil"), "/tasks");
    assert.equal(sanitizeRedirectUrl("/path\tfoo"), "/tasks");
    assert.equal(sanitizeRedirectUrl("/path\0evil"), "/tasks");
  });

  test("handles null, undefined, empty, and whitespace-only values safely", () => {
    assert.equal(sanitizeRedirectUrl(null), "/tasks");
    assert.equal(sanitizeRedirectUrl(undefined), "/tasks");
    assert.equal(sanitizeRedirectUrl(""), "/tasks");
    assert.equal(sanitizeRedirectUrl("   "), "/tasks");
  });
});

describe("Issue #6: Form Validation Fallbacks & Mock Zero-Tolerance", () => {
  test("resolveDemoUserByRole returns undefined (no mock accounts in production codebase)", () => {
    assert.equal(resolveDemoUserByRole("ADMIN"), undefined);
    assert.equal(resolveDemoUserByRole("MANAGER"), undefined);
    assert.equal(resolveDemoUserByRole("STAFF"), undefined);
  });

  test("validateLoginForm performs strict input validation", () => {
    const emptyResult = validateLoginForm("");
    assert.equal(emptyResult.valid, false);

    const malformedResult = validateLoginForm("invalid-email");
    assert.equal(malformedResult.valid, false);

    const validResult = validateLoginForm("teacher@cdktcnqn.edu.vn");
    assert.equal(validResult.valid, true);
    assert.equal(validResult.user, undefined);
  });
});
