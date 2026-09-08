import { AuthUser, UserRole } from "../types/auth";
import { DEFAULT_DEMO_USERS } from "./role-task-filter";

export interface DemoLoginCard {
  role: UserRole;
  badge: string;
  title: string;
  subtitle: string;
  email: string;
  department: string;
  description: string;
}

export const DEMO_LOGIN_CARDS: DemoLoginCard[] = [
  {
    role: "ADMIN",
    badge: "BGH",
    title: "Ban Giám hiệu",
    subtitle: "Hiệu trưởng / bgh@cdktcnqn.edu.vn",
    email: "bgh@cdktcnqn.edu.vn",
    department: "Ban Giám hiệu",
    description: "Toàn quyền điều hành, phê duyệt và giao việc cấp Trường",
  },
  {
    role: "MANAGER",
    badge: "Trưởng đơn vị",
    title: "Trưởng đơn vị",
    subtitle: "Trưởng phòng Đào tạo & QLKH / daotao@cdktcnqn.edu.vn",
    email: "daotao@cdktcnqn.edu.vn",
    department: "Phòng Đào tạo & QLKH",
    description: "Quản trị công việc đơn vị, giao việc cho viên chức trực thuộc",
  },
  {
    role: "STAFF",
    badge: "Chuyên viên",
    title: "Chuyên viên",
    subtitle: "Cán bộ CNTT - Nguyễn Ngọc Vinh / vinhnn@cdktcnqn.edu.vn",
    email: "vinhnn@cdktcnqn.edu.vn",
    department: "Khoa Công nghệ thông tin",
    description: "Xem và cập nhật tiến độ công việc được phân công trực tiếp",
  },
];

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

  // Try finding matching demo user
  const foundUser = DEFAULT_DEMO_USERS.find(
    (u) => u.email.toLowerCase() === trimmedEmail
  );

  if (foundUser) {
    return { valid: true, user: foundUser };
  }

  // If not a demo user, check if it's an educational email or domain match
  return {
    valid: true,
    user: {
      id: `user-custom-${Date.now()}`,
      name: trimmedEmail.split("@")[0].toUpperCase(),
      email: trimmedEmail,
      role: trimmedEmail.includes("bgh") ? "ADMIN" : trimmedEmail.includes("daotao") ? "MANAGER" : "STAFF",
      roleLabel: "Người dùng hệ thống",
      department: "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn",
      departmentCode: "QCET",
    },
  };
}

export function resolveDemoUserByRole(role: UserRole): AuthUser | undefined {
  return DEFAULT_DEMO_USERS.find((u) => u.role === role);
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
        title: "Tài khoản không thuộc miền cho phép",
        message: email
          ? `Tài khoản không thuộc miền @cdktcnqn.edu.vn (email của bạn: ${email}). Vui lòng đăng nhập bằng tài khoản Google Workspace chính thức của nhà trường.`
          : "Tài khoản không thuộc miền @cdktcnqn.edu.vn được cấp phép. Vui lòng sử dụng email công vụ nhà trường được cấp để đăng nhập.",
        variant: "amber",
        email: email || undefined,
        actionText: "Thử lại bằng tài khoản trường",
        actionHref: "/api/auth/google",
      };

    case "account_disabled":
      return {
        code: "account_disabled",
        title: "Tài khoản bị vô hiệu hóa",
        message:
          "Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa. Vui lòng liên hệ Phòng Quản trị Mạng và CNTT (email: qtm@cdktcnqn.edu.vn) để được hỗ trợ.",
        variant: "red",
      };

    case "oauth_cancelled":
      return {
        code: "oauth_cancelled",
        title: "Hủy thao tác đăng nhập",
        message: "Bạn đã hủy quá trình đăng nhập bằng Google. Vui lòng thử lại khi sẵn sàng.",
        variant: "neutral",
      };

    case "oauth_state_invalid":
      return {
        code: "oauth_state_invalid",
        title: "Phiên đăng nhập hết hạn",
        message: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.",
        variant: "red",
      };

    case "oauth_not_configured":
      return {
        code: "oauth_not_configured",
        title: "Chưa cấu hình đăng nhập Google",
        message: "Hệ thống chưa cấu hình Google OAuth. Vui lòng liên hệ quản trị viên.",
        variant: "red",
      };

    case "missing_code":
    case "oauth_failed":
    default:
      return {
        code: error,
        title: "Lỗi xác thực Google",
        message: "Đã xảy ra lỗi trong quá trình xác thực với Google. Vui lòng thử lại sau.",
        variant: "red",
      };
  }
}
