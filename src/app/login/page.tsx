"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types/auth";
import { DEMO_LOGIN_CARDS, validateLoginForm } from "@/lib/login-helpers";

export default function LoginPage() {
  const router = useRouter();
  const { user, switchRole } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [loadingRole, setLoadingRole] = React.useState<UserRole | "custom" | null>(null);

  const handleStandardLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateLoginForm(email, password);
    if (!validation.valid) {
      setErrorMessage(validation.error || "Thông tin đăng nhập không hợp lệ");
      return;
    }

    setLoadingRole("custom");

    // Resolve role or match demo user
    const targetRole = validation.user?.role || "ADMIN";
    switchRole(targetRole);

    setTimeout(() => {
      router.push("/");
    }, 250);
  };

  const handleDemoLogin = (role: UserRole, demoEmail: string) => {
    setErrorMessage(null);
    setEmail(demoEmail);
    setPassword("demo2026");
    setLoadingRole(role);

    switchRole(role);

    setTimeout(() => {
      router.push("/");
    }, 250);
  };

  return (
    <div className="flex min-h-[calc(100vh-140px)] w-full items-center justify-center py-6 sm:py-10">
      <div className="w-full max-w-lg space-y-6">
        {/* ========================================================================= */}
        {/* 1. Institutional Header with QCET Crest & Identity                         */}
        {/* ========================================================================= */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex size-12 items-center justify-center rounded-xl bg-[#18181B] text-white shadow-sm ring-1 ring-zinc-800/10 dark:bg-white dark:text-zinc-900">
            <Building2 className="size-6" aria-hidden="true" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-sans">
              QCET E-Office
            </h1>
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Văn phòng Điều hành & Quản trị Công việc Điện tử
            </p>
            <p className="text-xs text-muted-foreground">
              Trường Cao đẳng Kinh tế - Kỹ thuật Cần Thơ
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. Main Login Card: Twenty CRM Light-Mode Styling                         */}
        {/* ========================================================================= */}
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <div className="mb-6 space-y-1 border-b border-[#E4E4E7]/70 pb-4 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-foreground">
              Đăng nhập tài khoản
            </h2>
            <p className="text-xs text-muted-foreground">
              Nhập email công vụ hoặc lựa chọn tài khoản mẫu 1 chạm bên dưới
            </p>
          </div>

          {/* Validation / Error Message */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50/80 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Email & Password Form */}
          <form onSubmit={handleStandardLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-medium text-foreground"
              >
                Địa chỉ Email công vụ
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="size-4 text-muted-foreground" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vidu: bgh@cdktcnqn.edu.vn"
                  autoComplete="email"
                  className="block w-full rounded-md border border-[#E4E4E7] bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100 dark:focus:ring-zinc-100 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-foreground"
                >
                  Mật khẩu
                </label>
                <span className="text-[11px] text-muted-foreground hover:underline cursor-pointer">
                  Quên mật khẩu?
                </span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="size-4 text-muted-foreground" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="block w-full rounded-md border border-[#E4E4E7] bg-background py-2 pl-9 pr-9 text-xs text-foreground placeholder:text-muted-foreground focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100 dark:focus:ring-zinc-100 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingRole !== null}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-[#18181B] py-2.5 px-4 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-[#27272A] active:scale-[0.99] disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer"
            >
              {loadingRole === "custom" ? (
                <span>Đang xử lý đăng nhập...</span>
              ) : (
                <>
                  <span>Đăng nhập vào hệ thống</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E4E4E7] dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider font-semibold">
              <span className="bg-white px-3 text-muted-foreground dark:bg-zinc-900">
                Hoặc 1-Click Truy Cập Nhanh Demo
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. 1-Click Demo Quick Access Cards                                        */}
          {/* ========================================================================= */}
          <div className="space-y-2.5">
            {DEMO_LOGIN_CARDS.map((card) => {
              const isSelected = user.role === card.role;
              const isLoadingThis = loadingRole === card.role;

              const getRoleIcon = () => {
                if (card.role === "ADMIN") return Landmark;
                if (card.role === "MANAGER") return Building2;
                return User;
              };
              const RoleIcon = getRoleIcon();

              return (
                <button
                  key={card.role}
                  type="button"
                  onClick={() => handleDemoLogin(card.role, card.email)}
                  disabled={loadingRole !== null}
                  className={`group relative flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-50/90 shadow-2xs dark:border-zinc-400 dark:bg-zinc-800/80"
                      : "border-[#E4E4E7] bg-white hover:border-zinc-300 hover:bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                        card.role === "ADMIN"
                          ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
                          : card.role === "MANAGER"
                          ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                      }`}
                    >
                      <RoleIcon className="size-4" />
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {card.title}
                        </span>
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/70">
                          {card.badge}
                        </span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            Đang hoạt động
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {card.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center pl-2">
                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors group-hover:bg-secondary group-hover:text-foreground">
                      {isLoadingThis ? "Đang vào..." : "Chọn"}
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Xác thực an toàn đa quyền (BGH / Trưởng phòng / Viên chức)</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-muted-foreground/80 space-y-1">
          <p>
            Hệ thống Quản trị & Điều hành Văn phòng Điện tử QCET
          </p>
          <p className="text-[11px]">
            Phát triển & Vận hành bởi Trung tâm CNTT - Trường Cao đẳng Kinh tế - Kỹ thuật Cần Thơ
          </p>
        </div>
      </div>
    </div>
  );
}
