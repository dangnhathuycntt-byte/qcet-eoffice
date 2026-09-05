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

export function resolveDemoUserByRole(role: UserRole): AuthUser {
  const match = DEFAULT_DEMO_USERS.find((u) => u.role === role);
  return match || DEFAULT_DEMO_USERS[0];
}
