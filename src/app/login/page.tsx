"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  ArrowRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import {
  resolveOAuthError,
  sanitizeRedirectUrl,
  shouldShowLoginSkeleton,
  validateLoginForm,
} from "@/lib/login-helpers";
import { cn } from "@/lib/utils";

/**
 * Pixel-perfect Skeleton that mirrors LoginFormContent geometry 1:1
 * Guarantees zero Cumulative Layout Shift (CLS) during SSR/CSR hydration.
 */
function LoginSkeleton() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      role="main"
      aria-label="Đang tải trang đăng nhập"
      className="relative flex min-h-[100dvh] w-full flex-col justify-between bg-background outline-none focus:outline-hidden"
    >
      {/* Clean institutional background */}

      {/* Top Header Skeleton */}
      <header className="relative z-10 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-secondary/60 animate-pulse" />
            <div className="space-y-1">
              <div className="h-3 w-56 bg-secondary/50 rounded-md animate-pulse" />
              <div className="h-3.5 w-28 bg-secondary/70 rounded-md animate-pulse" />
            </div>
          </div>
          <div className="h-3.5 w-32 bg-secondary/30 rounded-md animate-pulse hidden sm:block" />
        </div>
      </header>

      {/* Center Card Skeleton */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[420px] rounded-2xl border border-border/80 bg-card/95 p-6 sm:p-7 shadow-xs space-y-4">
          <div className="space-y-2 text-center flex flex-col items-center">
            <div className="h-6 w-44 bg-secondary/70 rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-secondary/40 rounded-md animate-pulse" />
          </div>
          <div className="h-12 w-full bg-secondary/50 rounded-xl animate-pulse" />
          <div className="h-3 w-48 mx-auto bg-secondary/30 rounded-md animate-pulse" />
          <div className="space-y-3 pt-1">
            <div className="h-10 w-full bg-secondary/40 rounded-xl animate-pulse" />
            <div className="h-10 w-full bg-secondary/40 rounded-xl animate-pulse" />
            <div className="h-11 w-full bg-secondary/60 rounded-xl animate-pulse" />
          </div>
          <div className="pt-2 border-t border-border/60">
            <div className="h-3.5 w-56 mx-auto bg-secondary/30 rounded-md animate-pulse" />
          </div>
        </div>
      </div>

      {/* Bottom Footer Skeleton */}
      <footer className="relative z-10 w-full border-t border-border/60 bg-background/80 backdrop-blur-md py-3 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="h-3.5 w-64 bg-secondary/40 rounded-md animate-pulse" />
          <div className="h-3.5 w-48 bg-secondary/30 rounded-md animate-pulse hidden sm:block" />
        </div>
      </footer>
    </main>
  );
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading, login } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const targetUrl = React.useMemo(() => {
    return sanitizeRedirectUrl(
      searchParams.get("returnTo") ||
      searchParams.get("redirect") ||
      searchParams.get("callbackUrl")
    );
  }, [searchParams]);

  // Auto-redirect once server-authenticated. Uses `isAuthenticated` (server
  // session confirmed) rather than `user` (which can be a stale offline-cached
  // identity after logout). router.refresh() flushes the Next.js RSC router
  // cache so the target page sees the new session cookie immediately — without
  // it, a stale unauthenticated render may linger and the server can redirect
  // back to /login even though the cookie is already set.
  React.useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.refresh();
      router.replace(targetUrl);
    }
  }, [isLoading, isAuthenticated, user, router, targetUrl]);

  // OAuth Error handling from URL params
  const errorParam = searchParams.get("error");
  const emailParam = searchParams.get("email");
  const [dismissedOAuthError, setDismissedOAuthError] = React.useState(false);

  const oauthError = React.useMemo(() => {
    return resolveOAuthError(errorParam, emailParam);
  }, [errorParam, emailParam]);

  React.useEffect(() => {
    if (errorParam) {
      setDismissedOAuthError(false);
    }
  }, [errorParam]);

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateLoginForm(email, password);
    if (!validation.valid) {
      setErrorMessage(validation.error || "Vui lòng nhập địa chỉ email và mật khẩu hợp lệ");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      if (!res.success) {
        setErrorMessage(res.error || "Email hoặc mật khẩu không chính xác");
        setIsSubmitting(false);
        return;
      }

      router.refresh();
      router.replace(targetUrl);
    } catch {
      setErrorMessage("Không thể kết nối đến máy chủ xác thực. Vui lòng thử lại.");
      setIsSubmitting(false);
    }
  };

  if (shouldShowLoginSkeleton({ isLoading, isAuthenticated, user })) {
    return <LoginSkeleton />;
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      role="main"
      aria-label="Trang đăng nhập QCET E-Office"
      className="relative flex min-h-[100dvh] w-full flex-col justify-between bg-background selection:bg-primary/15 selection:text-primary outline-none focus:outline-hidden"
    >
      {/* Clean institutional background */}

      {/* 1. TOP HEADER (Line mỏng, nằm hẳn phía trên) */}
      <header className="relative z-10 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Left: Logo + Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn + QCET E-Office */}
          <div className="flex items-center gap-3">
            <Image
              src="/logo-qcet.png"
              alt="Logo QCET"
              width={36}
              height={36}
              className="size-9 object-contain"
              priority
            />
            <div className="flex flex-col justify-center">
              <span className="text-xs font-semibold text-muted-foreground leading-tight">
                Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
              </span>
              <span className="text-sm font-bold tracking-tight text-foreground font-heading leading-tight">
                QCET E-Office
              </span>
            </div>
          </div>

          {/* Right: Clean text identity, zero decorative pills */}
          <div className="hidden sm:block text-xs font-medium text-muted-foreground">
            Hệ thống Quản lý Văn bản & Điều hành
          </div>
        </div>
      </header>

      {/* 2. CENTER CONTENT (Chỉ có Login Card ở giữa) */}
      <div className="relative z-10 flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[420px] space-y-4">
          {/* OAuth Error Alert if any */}
          {oauthError && !dismissedOAuthError && (
            <div
              role={oauthError.variant === "neutral" ? "status" : "alert"}
              className={cn(
                "rounded-xl border p-3.5 text-xs shadow-xs animate-in fade-in transition-all",
                oauthError.variant === "amber" &&
                  "border-amber-300/80 bg-amber-50/90 text-amber-950",
                oauthError.variant === "red" &&
                  "border-red-200 bg-red-50/90 text-red-950",
                oauthError.variant === "neutral" &&
                  "border-border/80 bg-secondary/60 text-secondary-foreground"
              )}
            >
              <div className="flex items-start gap-2.5">
                {oauthError.variant === "amber" && (
                  <AlertTriangle
                    className="size-4 shrink-0 text-amber-600 mt-0.5"
                    strokeWidth={1.5}
                  />
                )}
                {oauthError.variant === "red" && (
                  <AlertCircle
                    className="size-4 shrink-0 text-red-600 mt-0.5"
                    strokeWidth={1.5}
                  />
                )}
                {oauthError.variant === "neutral" && (
                  <Info
                    className="size-4 shrink-0 text-muted-foreground mt-0.5"
                    strokeWidth={1.5}
                  />
                )}

                <div className="flex-1 space-y-1 text-left">
                  <div className="font-semibold text-xs">{oauthError.title}</div>
                  <div className="leading-relaxed opacity-90 text-xs">{oauthError.message}</div>

                  {oauthError.email && (
                    <div className="pt-0.5">
                      <span className="inline-block rounded bg-amber-100 px-2 py-0.5 font-mono text-xs font-semibold text-amber-900">
                        {oauthError.email}
                      </span>
                    </div>
                  )}

                  {oauthError.actionText && oauthError.actionHref && (
                    <div className="pt-1.5">
                      <a
                        href={oauthError.actionHref}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-xs"
                      >
                        <span>{oauthError.actionText}</span>
                        <ArrowRight className="size-3" strokeWidth={1.5} />
                      </a>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setDismissedOAuthError(true)}
                  className="shrink-0 p-1 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  aria-label="Đóng thông báo"
                >
                  <X className="size-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}

          {/* Centralized Login Card */}
          <div className="rounded-2xl border border-border/80 bg-card/95 p-6 sm:p-7 shadow-xs backdrop-blur-sm space-y-4">
            <div className="space-y-1.5 text-center">
              <h1 className="text-xl font-bold tracking-tight text-foreground font-heading">
                Đăng nhập hệ thống
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Hệ thống làm việc và điều hành văn bản điện tử dành cho Cán bộ, Giảng viên & Nhân viên Nhà trường.
              </p>
            </div>

            {/* Phương thức 1: Google SSO */}
            <GoogleLoginButton />

            {/* Đường phân cách phương thức */}
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/70" />
              </div>
              <div className="relative flex justify-center text-xs font-medium">
                <span className="bg-card px-2.5 text-muted-foreground text-xs">
                  Hoặc đăng nhập bằng tài khoản công vụ
                </span>
              </div>
            </div>

            {/* Thông báo lỗi đăng nhập mật khẩu */}
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs text-red-950 animate-in fade-in"
              >
                <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" strokeWidth={1.5} />
                <div className="flex-1 leading-relaxed text-left">{errorMessage}</div>
              </div>
            )}

            {/* Phương thức 2: Đăng nhập Email & Mật khẩu công vụ */}
            <form onSubmit={handleStandardLogin} className="space-y-3">
              <div className="space-y-1 text-left">
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
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vidu: bgh@cdktcnqn.edu.vn"
                    className="block w-full rounded-xl border border-border/80 bg-background pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1 text-left">
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
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className="block w-full rounded-xl border border-border/80 bg-background pl-9 pr-10 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
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
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 shrink-0 animate-spin" strokeWidth={1.5} />
                    <span>Đang xác thực tài khoản...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng nhập hệ thống</span>
                    <ArrowRight className="size-3.5" strokeWidth={1.5} />
                  </>
                )}
              </button>
            </form>

            {/* Tài khoản thử nghiệm nhanh (Môi trường phát triển / Nội bộ) */}
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Tài khoản thử nghiệm nhanh:</span>
                <span className="font-mono text-[11px]">Mật khẩu: Qcet@2026</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-left">
                <button
                  type="button"
                  onClick={() => {
                    setEmail("dangnhathuy@cdktcnqn.edu.vn");
                    setPassword("Qcet@2026");
                    setErrorMessage(null);
                  }}
                  className="flex flex-col rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs hover:border-primary/50 hover:bg-primary/5 transition-all text-left cursor-pointer"
                >
                  <span className="font-semibold text-foreground text-[11px] leading-tight">ThS. Đặng Nhật Huy</span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate">dangnhathuy@cdktcnqn.edu.vn</span>
                  <span className="text-[10px] text-primary font-medium mt-0.5">Ban Giám hiệu (Hiệu trưởng)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail("bgh@cdktcnqn.edu.vn");
                    setPassword("Qcet@2026");
                    setErrorMessage(null);
                  }}
                  className="flex flex-col rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs hover:border-primary/50 hover:bg-primary/5 transition-all text-left cursor-pointer"
                >
                  <span className="font-semibold text-foreground text-[11px] leading-tight">Ban Giám hiệu</span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate">bgh@cdktcnqn.edu.vn</span>
                  <span className="text-[10px] text-primary font-medium mt-0.5">Tài khoản đơn vị BGH</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail("daotao@cdktcnqn.edu.vn");
                    setPassword("Qcet@2026");
                    setErrorMessage(null);
                  }}
                  className="flex flex-col rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs hover:border-primary/50 hover:bg-primary/5 transition-all text-left cursor-pointer"
                >
                  <span className="font-semibold text-foreground text-[11px] leading-tight">Phòng QL Đào tạo</span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate">daotao@cdktcnqn.edu.vn</span>
                  <span className="text-[10px] text-muted-foreground font-medium mt-0.5">Trưởng đơn vị</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEmail("admin@cdktcnqn.edu.vn");
                    setPassword("Qcet@123456");
                    setErrorMessage(null);
                  }}
                  className="flex flex-col rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs hover:border-primary/50 hover:bg-primary/5 transition-all text-left cursor-pointer"
                >
                  <span className="font-semibold text-foreground text-[11px] leading-tight">Quản trị hệ thống</span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate">admin@cdktcnqn.edu.vn</span>
                  <span className="text-[10px] text-muted-foreground font-medium mt-0.5">Qcet@123456</span>
                </button>
              </div>
            </div>

            <div className="text-center text-xs text-muted-foreground">
              <span>Áp dụng cho tài khoản email </span>
              <span className="font-mono font-semibold text-primary">@cdktcnqn.edu.vn</span>
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" strokeWidth={1.5} />
              <span>Hệ thống bảo mật sử dụng tài khoản email chính thức của Nhà trường</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM FOOTER (Line mỏng, chia đều không dồn nội dung) */}
      <footer className="relative z-10 w-full border-t border-border/60 bg-background/80 backdrop-blur-md py-3 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p className="text-center sm:text-left">
            Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
          </p>
          <p className="text-center sm:text-right">
            Hỗ trợ kỹ thuật: Trung tâm Số & Truyền thông
          </p>
        </div>
      </footer>
    </main>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginSkeleton />}>
      <LoginFormContent />
    </React.Suspense>
  );
}
