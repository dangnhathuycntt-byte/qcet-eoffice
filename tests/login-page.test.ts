import { test, describe } from "node:test";
import assert from "node:assert/strict";
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

describe("Open Redirect Protection (OWASP A01)", () => {
  test("allows legitimate relative URLs and normalizes root to /tasks", () => {
    assert.equal(sanitizeRedirectUrl("/"), "/tasks");
    assert.equal(sanitizeRedirectUrl("/tasks?scope=my"), "/tasks?scope=my");
    assert.equal(sanitizeRedirectUrl("/documents"), "/documents");
    assert.equal(sanitizeRedirectUrl("/settings/profile?tab=security"), "/settings/profile?tab=security");
  });

  test("blocks external protocol-relative URLs", () => {
    assert.equal(sanitizeRedirectUrl("//evil.com"), "/tasks");
    assert.equal(sanitizeRedirectUrl("//google.com/phishing"), "/tasks");
  });

  test("blocks backslash bypasses", () => {
    assert.equal(sanitizeRedirectUrl("/\\evil.com"), "/tasks");
    assert.equal(sanitizeRedirectUrl("\\evil.com"), "/tasks");
  });

  test("blocks absolute URLs with schemes", () => {
    assert.equal(sanitizeRedirectUrl("https://evil.com"), "/tasks");
    assert.equal(sanitizeRedirectUrl("http://evil.com"), "/tasks");
    assert.equal(sanitizeRedirectUrl("javascript:alert(1)"), "/tasks");
    assert.equal(sanitizeRedirectUrl("data:text/html,<script>alert(1)</script>"), "/tasks");
  });

  test("blocks control characters and CRLF injection", () => {
    assert.equal(sanitizeRedirectUrl("/path\r\nevil"), "/tasks");
    assert.equal(sanitizeRedirectUrl("/path\tfoo"), "/tasks");
  });

  test("handles null, undefined, and empty string safely", () => {
    assert.equal(sanitizeRedirectUrl(null), "/tasks");
    assert.equal(sanitizeRedirectUrl(undefined), "/tasks");
    assert.equal(sanitizeRedirectUrl(""), "/tasks");
    assert.equal(sanitizeRedirectUrl("   "), "/tasks");
  });
});

