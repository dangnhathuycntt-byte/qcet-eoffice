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

  test("uses centered container with max-w-[420px]", () => {
    assert.ok(
      loginPageSource.includes("max-w-[420px]"),
      "src/app/login/page.tsx must have max-w-[420px] centered container"
    );
    assert.ok(
      loginPageSource.includes("flex-col items-center"),
      "src/app/login/page.tsx must center items vertically and horizontally"
    );
  });

  test("contains standard institutional Vietnamese labels and copy", () => {
    // Heading
    assert.ok(
      loginPageSource.includes(">Đăng nhập</h1>"),
      "Must contain 'Đăng nhập QCET Work' heading"
    );
    // Subheading
    assert.ok(
      loginPageSource.includes("Dùng tài khoản Google của nhà trường"),
      "Must contain 'Dùng tài khoản Google của nhà trường' subheading"
    );
    // Role condition note
    assert.ok(
      loginPageSource.includes("QCET E-Office chỉ nhận tên và email của bạn.") ||
      loginPageSource.includes("QCET Work chỉ nhận tên và email của bạn.") ||
        loginPageSource.includes("QCET Work nhận tên, email và ảnh đại diện của bạn."),
      "Must contain institutional note copy"
    );
    // Support link & email
    assert.ok(
      loginPageSource.toLowerCase().includes("liên hệ hỗ trợ") || loginPageSource.includes("Gặp sự cố?"),
      "Must contain 'Liên hệ hỗ trợ' or 'Gặp sự cố?' text"
    );
    assert.ok(
      loginPageSource.includes("mailto:support@cdktcnqn.edu.vn") || loginPageSource.includes("mailto:hotro@cdktcnqn.edu.vn"),
      "Must link to support email"
    );
  });

  test("uses the original embedded design logo without re-encoding", () => {
    const crypto = require("node:crypto");
    const logo = fs.readFileSync(path.resolve(process.cwd(), "public/design/login-logo.png"));
    assert.equal(crypto.createHash("sha256").update(logo).digest("hex"), "27350e6ef02b6c366dd0b10ea5018b68d2aca356d8eb18de35f8efd98589f537");
    assert.ok(loginPageSource.includes('/design/login-logo.png'));
  });

  test("places accessible notices below Google sign-in with a recovery action", () => {
    assert.ok(loginPageSource.includes('aria-live="polite"'));
    assert.ok(loginPageSource.includes('min-h-11'));
    assert.ok(loginPageSource.includes('"alert"') || loginPageSource.includes('role="alert"'));
    assert.ok(loginPageSource.includes('Thử lại'));
    assert.ok(
      loginPageSource.indexOf('<GoogleLoginButton') < loginPageSource.indexOf('{messageNode}') ||
      loginPageSource.indexOf('<GoogleLoginButton') < loginPageSource.indexOf('{notice ?')
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

describe("Login Specification & Multi-State Compliance (Boards Login & Login2)", () => {
  const loginPageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/login/page.tsx"),
    "utf-8"
  );

  test("contains institutional branding 'QCET E-Office' and official support email", () => {
    assert.ok(
      loginPageSource.includes("QCET E-Office"),
      "Must use 'QCET E-Office' as application title"
    );
    assert.ok(
      loginPageSource.includes("hotro@cdktcnqn.edu.vn"),
      "Must use official support email hotro@cdktcnqn.edu.vn"
    );
  });

  test("implements all required login states from Login and Login2 boards", () => {
    // 1. In-app chat browser (disallowed_useragent)
    assert.ok(loginPageSource.includes("Mở bằng trình duyệt"));
    assert.ok(loginPageSource.includes("Google không cho đăng nhập trong ứng dụng này."));
    assert.ok(loginPageSource.includes("Sao chép liên kết"));

    // 2. Unregistered / Access Denied
    assert.ok(loginPageSource.includes("Chưa được cấp quyền"));
    assert.ok(loginPageSource.includes("Gửi yêu cầu cấp quyền"));
    assert.ok(loginPageSource.includes("Đã gửi yêu cầu"));
    assert.ok(loginPageSource.includes("Quản trị viên sẽ xem và báo qua email."));

    // 3. Deactivated / Disabled account
    assert.ok(loginPageSource.includes("Tài khoản đã bị khóa"));
    assert.ok(loginPageSource.includes("Tài khoản này không còn dùng được QCET E-Office."));

    // 4. Returning user / quick login
    assert.ok(loginPageSource.includes("Chào mừng quay lại"));
    assert.ok(loginPageSource.includes("Tiếp tục với tên"));
    assert.ok(loginPageSource.includes("Dùng tài khoản khác"));

    // 5. Shared machine (select_account)
    assert.ok(loginPageSource.includes("Chọn tài khoản"));
    assert.ok(loginPageSource.includes("Luôn hỏi trước khi vào, vì đây là máy dùng chung."));

    // 6. Deep link redirect state
    assert.ok(loginPageSource.includes("Đăng nhập để mở nhiệm vụ"));

    // 7. Expired session & Logout
    assert.ok(loginPageSource.includes("Phiên đã hết hạn"));
    assert.ok(loginPageSource.includes("Đã đăng xuất"));
    assert.ok(loginPageSource.includes("Đang dùng máy chung? Hãy đóng cả trình duyệt."));

    // 8. Connection failure with in-place retry
    assert.ok(loginPageSource.includes("Chưa kết nối được Google"));
    assert.ok(loginPageSource.includes("Kiểm tra mạng rồi thử lại."));
    assert.ok(loginPageSource.includes("handleRetryAtPlace") || loginPageSource.includes("isRetryingAtPlace"));
  });

  test("handles accessible error tab titles and keyboard focus ring", () => {
    // Tab title prefix for errors
    assert.ok(loginPageSource.includes('document.title = "Lỗi: Đăng nhập · QCET E-Office"'));
    // Focus ring 2px, offset 3px, institutional color #0058A0
    assert.ok(loginPageSource.includes("focus-visible:ring-[#0058A0]"));
    assert.ok(loginPageSource.includes("focus-visible:ring-offset-[3px]"));
  });
});
