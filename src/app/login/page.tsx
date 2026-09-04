"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/types/auth";
import { DEMO_LOGIN_CARDS, validateLoginForm } from "@/lib/login-helpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div className="flex min-h-[calc(100vh-140px)] w-full items-center justify-center py-6 sm:py-10 px-4">
      <div className="w-full max-w-lg space-y-6">
        {/* ========================================================================= */}
        {/* 1. Institutional Header with QCET Crest & Identity                         */}
        {/* ========================================================================= */}
        <div className="text-center space-y-3">
          {/* Logo Card with shadow-glow-primary */}
          <div className="inline-flex p-3 rounded-2xl bg-card border border-border/80 shadow-glow-primary ring-1 ring-primary/20">
            <div className="relative size-12 flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-xs overflow-hidden">
              <Image
                src="/logo-qcet.png"
                alt="Logo QCET"
                width={48}
                height={48}
                className="object-contain"
                onError={(e) => {
                  // Fallback to icon if image fails
                  e.currentTarget.style.display = "none";
                }}
              />
              <Building2 className="size-6 absolute" aria-hidden="true" />
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
              Trường Cao đẳng Kinh tế - Kỹ thuật Cần Thơ
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. Main Login Card: Modern QCET Styling                                   */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-border/60 bg-card/90 backdrop-blur-md p-6 shadow-card dark:border-border/40 sm:p-8">
          <div className="mb-6 space-y-1 border-b border-border/60 pb-4">
            <h2 className="text-base font-bold text-foreground">
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
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 animate-fade-in"
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
                className="block text-xs font-semibold text-foreground"
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
                  className="block w-full rounded-xl border border-border/70 bg-background py-2.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-foreground"
                >
                  Mật khẩu
                </label>
                <span className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer font-medium">
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
                  className="block w-full rounded-xl border border-border/70 bg-background py-2.5 pl-9 pr-9 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground cursor-pointer"
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
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-xs font-semibold text-primary-foreground shadow-card hover:shadow-card-hover transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
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
              <div className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider font-semibold">
              <span className="bg-card px-3 text-muted-foreground">
                Hoặc 1-Click Truy Cập Nhanh Demo
              </span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. 1-Click Demo Quick Access Cards with Glassmorphism                     */}
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
                  className={cn(
                    "group relative flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer glass-card",
                    isSelected
                      ? "border-primary bg-primary/[0.06] shadow-card ring-1 ring-primary/30"
                      : "border-border/60 hover:border-primary/40 hover:shadow-card active:scale-[0.99]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold shadow-xs",
                        card.role === "ADMIN"
                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                          : card.role === "MANAGER"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      )}
                    >
                      <RoleIcon className="size-4.5" />
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {card.title}
                        </span>
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border/70">
                          {card.badge}
                        </span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
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
                    <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-all group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-xs">
                      {isLoadingThis ? "Đang vào..." : "Chọn"}
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Xác thực an toàn đa quyền (BGH / Trưởng phòng / Viên chức)</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-muted-foreground/80 space-y-1">
          <p className="font-medium">
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
