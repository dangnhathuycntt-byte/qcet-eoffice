import { AuthUser, UserRole } from "@/types/auth";

export interface LoginFormState {
  email: string;
  password?: string;
}

export interface LoginValidationResult {
  valid: boolean;
  error?: string;
  user?: AuthUser;
}

export function validateLoginForm(email: string, password?: string): LoginValidationResult {
  const trimmedEmail = (email || "").trim().toLowerCase();

  if (!trimmedEmail) {
    return { valid: false, error: "Vui lòng nhập địa chỉ email công vụ (@cdktcnqn.edu.vn)" };
  }

  // Basic email pattern check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: "Địa chỉ email không đúng định dạng" };
  }

  // Check password if provided (for standard login)
  if (password !== undefined && password.length < 4) {
    return { valid: false, error: "Mật khẩu phải có ít nhất 4 ký tự" };
  }

  return { valid: true };
}

export function resolveDemoUserByRole(_role: UserRole): AuthUser | undefined {
  return undefined;
}

/**
 * Determines whether the login screen should render the skeleton loading state.
 * Prevents the critical bug where an unauthenticated visitor with a stale offline-cached
 * identity (user !== null, isAuthenticated === false) gets trapped in an infinite skeleton loop.
 */
export function shouldShowLoginSkeleton({
  isLoading,
  isAuthenticated,
  user,
}: {
  isLoading?: boolean;
  isAuthenticated?: boolean;
  user?: unknown;
}): boolean {
  if (isLoading) return true;
  if (isAuthenticated && Boolean(user)) return true;
  return false;
}

/**
 * Sanitizes redirect target URLs to prevent Open Redirect attacks (OWASP A01/A07).
 * Only allows safe relative paths starting with a single '/' and strictly disallows
 * protocol-relative URLs ('//'), backslashes ('/\'), URI schemes (http:, javascript:), and control characters.
 * Also prevents redirect loops back to login/auth.
 */
export function sanitizeRedirectUrl(url: string | null | undefined): string {
  if (!url) return "/tasks";
  const trimmed = url.trim();
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes("://") &&
    !trimmed.includes("\\") &&
    !/[\r\n\t\0]/.test(trimmed)
  ) {
    const cleanPath = trimmed.split("?")[0];
    if (cleanPath === "/" || cleanPath === "/login" || cleanPath.startsWith("/api/auth")) {
      return "/tasks";
    }
    return trimmed;
  }
  return "/tasks";
}

export type OAuthErrorVariant = "amber" | "red" | "neutral";

export interface OAuthErrorInfo {
  code: string;
  title: string;
  message: string;
  variant: OAuthErrorVariant;
  email?: string;
  actionText?: string;
  actionHref?: string;
}

export function resolveOAuthError(
  error: string | null | undefined,
  email?: string | null
): OAuthErrorInfo | null {
  if (!error) return null;

  switch (error) {
    case "domain_not_allowed":
      return {
        code: "domain_not_allowed",
        title: "Email không thuộc hệ thống Nhà trường",
        message: email
          ? `Tài khoản không thuộc miền @cdktcnqn.edu.vn (email của Thầy/Cô: ${email}). Vui lòng sử dụng địa chỉ email do Nhà trường cấp để đăng nhập.`
          : "Tài khoản không thuộc miền @cdktcnqn.edu.vn được cấp phép. Vui lòng sử dụng email công vụ nhà trường được cấp để đăng nhập.",
        variant: "amber",
        email: email || undefined,
        actionText: "Thử lại bằng tài khoản trường",
        actionHref: "/login?startGoogle=1",
      };

    case "account_not_found":
    case "AccessDenied":
      return {
        code: "account_not_found",
        title: "Tài khoản chưa được cấp quyền",
        message:
          "Tài khoản Google này chưa được cấp phép truy cập hệ thống QCET E-Office. Vui lòng liên hệ Phòng Quản trị Mạng và CNTT (email: qtm@cdktcnqn.edu.vn) để đăng ký tài khoản.",
        variant: "amber",
        email: email || undefined,
      };

    case "account_disabled":
      return {
        code: "account_disabled",
        title: "Tài khoản bị tạm khóa",
        message:
          "Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa. Vui lòng liên hệ Phòng Quản trị Mạng và CNTT (email: qtm@cdktcnqn.edu.vn) để được hỗ trợ.",
        variant: "red",
      };

    case "oauth_cancelled":
      return {
        code: "oauth_cancelled",
        title: "Đã dừng thao tác đăng nhập",
        message: "Bạn đã hủy quá trình đăng nhập bằng Google. Vui lòng thử lại khi sẵn sàng.",
        variant: "neutral",
      };

    case "oauth_state_invalid":
    case "OAuthStateError":
      return {
        code: "oauth_state_invalid",
        title: "Lỗi trạng thái xác thực",
        message: "Yêu cầu xác thực Google không hợp lệ hoặc mã bảo mật (State/PKCE) đã hết hạn. Vui lòng thử đăng nhập lại.",
        variant: "red",
        actionText: "Thử đăng nhập lại",
        actionHref: "/login?startGoogle=1",
      };

    case "session_expired":
      return {
        code: "session_expired",
        title: "Phiên làm việc hết hạn",
        message: "Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.",
        variant: "amber",
        actionText: "Đăng nhập lại",
        actionHref: "/login?startGoogle=1",
      };

    case "server_error":
      return {
        code: "server_error",
        title: "Lỗi kết nối máy chủ",
        message: "Không thể kết nối đến cơ sở dữ liệu hoặc máy chủ xác thực. Vui lòng thử lại sau.",
        variant: "red",
      };

    case "CallbackRouteError":
    case "OAuthCallbackError":
    case "OAuthAccountNotLinked":
      return {
        code: "oauth_callback_error",
        title: "Lỗi trong quá trình xác thực",
        message: "Quá trình xác thực với Google gặp sự cố hoặc tài khoản chưa được liên kết. Vui lòng thử lại.",
        variant: "red",
        actionText: "Thử lại",
        actionHref: "/login?startGoogle=1",
      };

    case "oauth_not_configured":
      return {
        code: "oauth_not_configured",
        title: "Hệ thống đăng nhập chưa kích hoạt",
        message:
          "Hệ thống chưa cấu hình Google OAuth. Thầy/Cô vui lòng liên hệ Trung tâm Số & Truyền thông hoặc Quản trị mạng Nhà trường để được hỗ trợ.",
        variant: "red",
      };

    case "missing_code":
    case "oauth_failed":
    default:
      return {
        code: error,
        title: "Đăng nhập không thành công",
        message:
          "Đã xảy ra lỗi trong quá trình xác thực với Google. Thầy/Cô vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
        variant: "red",
      };
  }
}
