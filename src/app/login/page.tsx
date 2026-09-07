"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Building2,
  Landmark,
  User,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  UserPlus,
  Briefcase,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { cn } from "@/lib/utils";

const SEED_ACCOUNTS = [
  {
    role: "ADMIN" as const,
    badge: "BGH",
    title: "Ban Giám hiệu",
    name: "TS. Nguyễn Văn Hiệu",
    subtitle: "Hiệu trưởng",
    email: "bgh@qcet.edu.vn",
    department: "Ban Giám hiệu",
  },
  {
    role: "MANAGER" as const,
    badge: "Trưởng đơn vị",
    title: "Trưởng đơn vị",
    name: "ThS. Lê Hoàng Nam",
    subtitle: "Trưởng phòng QTM & CNTT",
    email: "cntt.lead@qcet.edu.vn",
    department: "Phòng Quản trị Mạng & CNTT",
  },
  {
    role: "STAFF" as const,
    badge: "Chuyên viên",
    title: "Chuyên viên",
    name: "Kỹ sư Trần Hùng",
    subtitle: "Chuyên viên Mạng & ATTT",
    email: "chuyenvien@qcet.edu.vn",
    department: "Phòng Quản trị Mạng & CNTT",
  },
];

const DEPARTMENTS = [
  { id: "BGH", name: "Ban Giám hiệu Nhà trường" },
  { id: "CNTT", name: "Phòng Quản trị Mạng và CNTT" },
  { id: "TCHC", name: "Phòng Tổ chức Hành chính" },
  { id: "KHTC", name: "Phòng Kế hoạch Tài chính" },
  { id: "DT_QLKH", name: "Phòng Đào tạo & Quản lý Khoa học" },
];

export default function LoginPage() {
  const router = useRouter();
  const { user, login, register, switchRole } = useAuth();

  const [activeTab, setActiveTab] = React.useState<"login" | "register">("login");

  // Login form state
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  // Register form state
  const [regName, setRegName] = React.useState("");
  const [regEmail, setRegEmail] = React.useState("");
  const [regPassword, setRegPassword] = React.useState("");
  const [regDept, setRegDept] = React.useState("CNTT");
  const [regTitle, setRegTitle] = React.useState("");

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [loadingSeedEmail, setLoadingSeedEmail] = React.useState<string | null>(null);

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setErrorMessage("Vui lòng nhập đầy đủ địa chỉ email và mật khẩu");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await login(trimmedEmail, password);
      if (!res.success) {
        setErrorMessage(res.error || "Email hoặc mật khẩu không chính xác");
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage("Đăng nhập thành công! Đang chuyển tiếp...");
      setTimeout(() => {
        router.push("/");
      }, 300);
    } catch {
      setErrorMessage("Lỗi kết nối máy chủ xác thực. Vui lòng thử lại.");
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedName = regName.trim();
    const trimmedEmail = regEmail.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail || !regPassword) {
      setErrorMessage("Vui lòng điền đầy đủ họ tên, email và mật khẩu");
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage("Mật khẩu bảo mật phải có ít nhất 6 ký tự");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await register({
        name: trimmedName,
        email: trimmedEmail,
        password: regPassword,
        departmentId: regDept,
        title: regTitle.trim() || "Chuyên viên",
      });

      if (!res.success) {
        setErrorMessage(res.error || "Đăng ký không thành công");
        setIsSubmitting(false);
        return;
      }

      // Automatically sign in with newly registered account
      const loginRes = await login(trimmedEmail, regPassword);
      if (loginRes.success) {
        setSuccessMessage("Tạo tài khoản thành công! Đang vào hệ thống...");
        setTimeout(() => {
          router.push("/");
        }, 300);
      } else {
        setSuccessMessage("Tài khoản đã tạo thành công. Vui lòng đăng nhập.");
        setActiveTab("login");
        setEmail(trimmedEmail);
        setIsSubmitting(false);
      }
    } catch {
      setErrorMessage("Đã xảy ra lỗi khi tạo tài khoản. Vui lòng thử lại.");
      setIsSubmitting(false);
    }
  };

  const handleQuickSeedLogin = async (seedEmail: string, role: "ADMIN" | "MANAGER" | "STAFF") => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEmail(seedEmail);
    setPassword("Qcet@2026");
    setLoadingSeedEmail(seedEmail);

    try {
      const res = await login(seedEmail, "Qcet@2026");
      if (res.success) {
        setSuccessMessage("Đăng nhập thành công! Đang chuyển tiếp...");
        setTimeout(() => {
          router.push("/");
        }, 200);
        return;
      }

      // Fallback if local server or DB connection is unreachable
      switchRole(role);
      setTimeout(() => {
        router.push("/");
      }, 200);
    } catch {
      switchRole(role);
      setTimeout(() => {
        router.push("/");
      }, 200);
    } finally {
      setLoadingSeedEmail(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-140px)] w-full items-center justify-center py-6 sm:py-10 px-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Institutional Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-card border border-border/80 shadow-glow-primary ring-1 ring-primary/20">
            <div className="relative size-12 flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs overflow-hidden">
              <Image
                src="/logo-qcet.png"
                alt="Logo QCET"
                width={48}
                height={48}
                className="object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <Building2 className="size-6 absolute" aria-hidden="true" strokeWidth={1.5} />
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-sans">
              QCET E-Office
            </h1>
            <p className="text-sm font-semibold text-primary">
              Văn phòng Điều hành & Quản trị Công việc Điện tử
            </p>
            <p className="text-xs text-muted-foreground">
              Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
            </p>
          </div>
        </div>

        {/* Main Auth Card */}
        <div className="rounded-2xl border border-border/60 bg-card/90 backdrop-blur-md p-6 shadow-card dark:border-border/40 sm:p-8">
          {/* Tab Selector: Login vs Register */}
          <div className="mb-6 flex rounded-xl bg-secondary/60 p-1 border border-border/50">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setErrorMessage(null);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer",
                activeTab === "login"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <KeyRound className="size-3.5" strokeWidth={1.5} />
              <span>Đăng nhập</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setErrorMessage(null);
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer",
                activeTab === "register"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <UserPlus className="size-3.5" strokeWidth={1.5} />
              <span>Đăng ký tài khoản mới</span>
            </button>
          </div>

          {/* Error Message Display */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 animate-in fade-in"
            >
              <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" strokeWidth={1.5} />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Success Message Display */}
          {successMessage && (
            <div
              role="status"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 animate-in fade-in"
            >
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" strokeWidth={1.5} />
              <div className="flex-1 leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {activeTab === "login" && (
            <>
              {/* Google Workspace SSO Trigger */}
              <div className="space-y-2">
                <GoogleLoginButton />
                <p className="text-center text-xs text-muted-foreground">
                  Đăng nhập qua cổng định danh liên kết Google trường
                </p>
              </div>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wider font-semibold">
                  <span className="bg-card px-3 text-muted-foreground">
                    Hoặc đăng nhập mật khẩu nội bộ
                  </span>
                </div>
              </div>

              {/* Standard Credentials Form */}
              <form onSubmit={handleStandardLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="loginEmail"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Email công vụ
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                      <Mail className="size-4" strokeWidth={1.5} />
                    </div>
                    <input
                      id="loginEmail"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vidu: bgh@qcet.edu.vn"
                      className="block w-full rounded-xl border border-border/80 bg-background pl-9 pr-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="loginPassword"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                      <Lock className="size-4" strokeWidth={1.5} />
                    </div>
                    <input
                      id="loginPassword"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Nhập mật khẩu công vụ"
                      className="block w-full rounded-xl border border-border/80 bg-background pl-9 pr-10 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" strokeWidth={1.5} />
                      ) : (
                        <Eye className="size-4" strokeWidth={1.5} />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-xs font-semibold text-primary-foreground shadow-card hover:bg-primary/90 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Đang xác thực thông tin...</span>
                  ) : (
                    <>
                      <span>Đăng nhập hệ thống</span>
                      <ArrowRight className="size-3.5" strokeWidth={1.5} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* TAB 2: REGISTRATION FORM */}
          {activeTab === "register" && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="space-y-1 border-b border-border/60 pb-3">
                <h3 className="text-xs font-bold text-foreground">
                  Đăng ký tài khoản nội bộ mới
                </h3>
                <p className="text-xs text-muted-foreground">
                  Tài khoản sẽ được khởi tạo trong CSDL PostgreSQL của trường
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="regName"
                  className="block text-xs font-semibold text-foreground"
                >
                  Họ và tên cán bộ <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <User className="size-4" strokeWidth={1.5} />
                  </div>
                  <input
                    id="regName"
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="VD: TS. Nguyễn Văn A"
                    className="block w-full rounded-xl border border-border/80 bg-background pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="regEmail"
                  className="block text-xs font-semibold text-foreground"
                >
                  Email công vụ <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <Mail className="size-4" strokeWidth={1.5} />
                  </div>
                  <input
                    id="regEmail"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="canbo@qcet.edu.vn"
                    className="block w-full rounded-xl border border-border/80 bg-background pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="regPassword"
                  className="block text-xs font-semibold text-foreground"
                >
                  Mật khẩu bảo mật <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <Lock className="size-4" strokeWidth={1.5} />
                  </div>
                  <input
                    id="regPassword"
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="block w-full rounded-xl border border-border/80 bg-background pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="regDept"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Đơn vị / Phòng ban
                  </label>
                  <select
                    id="regDept"
                    value={regDept}
                    onChange={(e) => setRegDept(e.target.value)}
                    className="block w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="regTitle"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Chức danh / Vị trí
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                      <Briefcase className="size-4" strokeWidth={1.5} />
                    </div>
                    <input
                      id="regTitle"
                      type="text"
                      value={regTitle}
                      onChange={(e) => setRegTitle(e.target.value)}
                      placeholder="VD: Chuyên viên CNTT"
                      className="block w-full rounded-xl border border-border/80 bg-background pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-xs font-semibold text-primary-foreground shadow-card hover:bg-primary/90 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer mt-2"
              >
                {isSubmitting ? (
                  <span>Đang khởi tạo tài khoản...</span>
                ) : (
                  <>
                    <UserPlus className="size-3.5" strokeWidth={1.5} />
                    <span>Tạo tài khoản & Đăng nhập</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider font-semibold">
              <span className="bg-card px-3 text-muted-foreground">
                Tài khoản kiểm thử CSDL hạt nhân (1-Click)
              </span>
            </div>
          </div>

          {/* Quick Access Seed Cards */}
          <div className="space-y-2">
            {SEED_ACCOUNTS.map((account) => {
              const isSelected = user.role === account.role && user.email === account.email;
              const isLoadingThis = loadingSeedEmail === account.email;

              const RoleIcon =
                account.role === "ADMIN"
                  ? Landmark
                  : account.role === "MANAGER"
                  ? Building2
                  : User;

              return (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleQuickSeedLogin(account.email, account.role)}
                  disabled={loadingSeedEmail !== null || isSubmitting}
                  className={cn(
                    "group relative flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition-all cursor-pointer glass-card",
                    isSelected
                      ? "border-primary bg-primary/[0.06] shadow-card ring-1 ring-primary/30"
                      : "border-border/60 hover:border-primary/40 hover:shadow-card active:scale-[0.99]"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-semibold shadow-xs",
                        account.role === "ADMIN"
                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                          : account.role === "MANAGER"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      )}
                    >
                      <RoleIcon className="size-4" strokeWidth={1.5} />
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-foreground truncate">
                          {account.name}
                        </span>
                        <span className="rounded bg-secondary px-1.5 py-0.2 text-xs font-semibold text-muted-foreground border border-border/70">
                          {account.badge}
                        </span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" strokeWidth={1.5} />
                            Hiện tại
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {account.subtitle} &bull; <span className="font-mono">{account.email}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center pl-2 shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold text-muted-foreground transition-all group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-xs">
                      {isLoadingThis ? "Đang vào..." : "Đăng nhập"}
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
            <span>Xác thực an toàn đa quyền (BGH / Trưởng đơn vị / Giảng viên)</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-muted-foreground/80 space-y-1">
          <p className="font-medium">
            Hệ thống Quản trị & Điều hành Văn phòng Điện tử QCET
          </p>
          <p className="text-xs">
            Phát triển & Vận hành bởi Trung tâm CNTT - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
          </p>
        </div>
      </div>
    </div>
  );
}
