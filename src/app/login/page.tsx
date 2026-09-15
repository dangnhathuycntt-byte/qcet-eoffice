"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import * as m from "motion/react-m";
import { AlertCircle, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import {
  resolveOAuthError,
  sanitizeRedirectUrl,
  shouldShowLoginSkeleton,
} from "@/lib/login-helpers";

function LoginSkeleton() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      role="main"
      aria-label="Đang tải trang đăng nhập"
      className="flex min-h-screen w-full bg-background outline-none"
    >
      {/* Left Branding Panel Skeleton (~46% desktop) */}
      <div
        aria-hidden="true"
        className="hidden lg:flex lg:w-[46%] xl:w-[45%] p-4 lg:p-5 xl:p-6 select-none"
      >
        <div className="w-full h-full flex flex-col justify-end p-8 lg:p-10 xl:p-12 rounded-3xl bg-slate-900">
          <div className="space-y-3">
            <div className="h-7 w-64 bg-slate-800 rounded animate-pulse" />
            <div className="h-4 w-48 bg-slate-800/60 rounded animate-pulse" />
            <div className="h-3 w-48 bg-slate-800/40 rounded animate-pulse pt-4" />
          </div>
        </div>
      </div>

      {/* Right Login Area Skeleton (~54% on desktop, 100% on mobile) */}
      <div className="w-full lg:w-[54%] xl:w-[55%] flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="flex flex-col text-left max-w-[380px] sm:max-w-[400px] w-full space-y-7 -translate-y-2 sm:-translate-y-4">
          <div className="flex items-center gap-3">
            <div className="size-14 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-28 bg-muted rounded-md animate-pulse" />
              <div className="h-3 w-48 bg-muted/80 rounded-md animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-8 w-56 bg-muted rounded-md animate-pulse" />
            <div className="h-4 w-72 bg-muted/70 rounded-md animate-pulse" />
          </div>
          <div className="h-12 w-full bg-muted rounded-md animate-pulse" />
          <div className="h-3.5 w-52 bg-muted rounded-md animate-pulse pt-1" />
        </div>
      </div>
    </main>
  );
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const targetUrl = React.useMemo(() => {
    return sanitizeRedirectUrl(
      searchParams.get("returnTo") ||
      searchParams.get("redirect") ||
      searchParams.get("callbackUrl")
    );
  }, [searchParams]);

  // Auto-redirect if already authenticated
  React.useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      window.location.href = targetUrl;
    }
  }, [isLoading, isAuthenticated, user, targetUrl]);

  // OAuth Error handling from URL query parameters
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

  // Only show skeleton if already authenticated and redirecting
  if (isAuthenticated && Boolean(user)) {
    return <LoginSkeleton />;
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      role="main"
      aria-label="Trang đăng nhập QCET E-Office"
      className="flex min-h-screen w-full bg-background selection:bg-primary/15 selection:text-primary outline-none"
    >
      {/* Desktop Left: Institutional Campus Photography & Brand Statement (~46% desktop, hidden below 1024px / mobile) */}
      <div
        aria-hidden="true"
        className="hidden lg:flex lg:w-[46%] xl:w-[45%] p-4 lg:p-5 xl:p-6 select-none"
      >
        <div className="relative w-full h-full flex flex-col justify-end p-8 lg:p-10 xl:p-12 overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl border border-border/10">
          {/* Campus Photo Background with Framer Motion gentle zoom entrance */}
          <m.div
            initial={{ scale: 1.06, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 size-full"
          >
            <Image
              src="/campus-qcet.jpg"
              alt="Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"
              fill
              priority
              sizes="(min-width: 1024px) 46vw, 100vw"
              className="object-cover object-[73%_center]"
            />
          </m.div>

          {/* Brighter, clearer institutional gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-slate-900/30 z-1" />

          {/* Lower Area: Institutional Statement & Footer */}
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 space-y-6"
          >
            <div className="space-y-2 max-w-sm">
              <h2 className="text-xl xl:text-2xl font-bold tracking-tight text-white font-heading leading-snug">
                Không gian làm việc số của nhà trường
              </h2>
              <p className="text-xs xl:text-sm text-white/85 font-medium">
                Nhiệm vụ · Văn bản · Lịch công tác
              </p>
            </div>

            <div className="text-[11px] text-white/60 font-medium border-t border-white/10 pt-4">
              © 2026 Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
            </div>
          </m.div>
        </div>
      </div>

      {/* Desktop Right / Mobile Centered: Clean Google-only Login Area (~54% desktop, 100% mobile) */}
      <div className="w-full lg:w-[54%] xl:w-[55%] flex flex-col items-center justify-center p-6 sm:p-12">
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col text-left max-w-[380px] sm:max-w-[400px] w-full space-y-7 -translate-y-2 sm:-translate-y-4"
        >
          {/* Top Lockup: Official School Logo, QCET E-Office, Full School Name */}
          <m.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3.5"
          >
            <Image
              src="/logo-qcet.png"
              alt="Logo Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"
              width={144}
              height={144}
              className="size-14 sm:size-16 object-contain select-none shrink-0"
              priority
            />
            <div className="space-y-0.5">
              <p className="text-xs font-bold tracking-wider text-primary uppercase font-mono">
                QCET E-Office
              </p>
              <p className="text-xs text-muted-foreground font-medium line-clamp-1">
                Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
              </p>
            </div>
          </m.div>

          {/* Heading & Direction Text */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground font-heading leading-tight">
              Đăng nhập QCET E-Office
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sử dụng tài khoản Google đã được cấp quyền để tiếp tục.
            </p>
          </div>

          {/* OAuth Error / Warning Notice */}
          {oauthError && !dismissedOAuthError && (
            <m.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              role="alert"
              className="flex items-start gap-2.5 w-full rounded-lg border border-red-200 bg-red-50/90 p-3 text-xs text-red-900 text-left"
            >
              <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" strokeWidth={1.5} />
              <div className="flex-1 space-y-1">
                <p className="font-semibold">{oauthError.title}</p>
                <p className="text-[11px] leading-relaxed text-red-800">{oauthError.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setDismissedOAuthError(true)}
                className="shrink-0 p-0.5 text-red-700 hover:text-red-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-xs cursor-pointer transition-colors"
                aria-label="Đóng thông báo"
              >
                <X className="size-3.5" strokeWidth={1.5} />
              </button>
            </m.div>
          )}

          {errorMessage && (
            <m.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              role="alert"
              className="flex items-start gap-2.5 w-full rounded-lg border border-red-200 bg-red-50/90 p-3 text-xs text-red-900 text-left"
            >
              <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" strokeWidth={1.5} />
              <p className="flex-1 text-[11px] leading-relaxed">{errorMessage}</p>
            </m.div>
          )}

          {/* Official Google Sign-In Button (Large size ~380px) */}
          <div className="w-full flex justify-start pt-0.5">
            <GoogleLoginButton
              returnTo={targetUrl}
              onError={(msg) => setErrorMessage(msg)}
              onSuccess={(url) => {
                window.location.href = url;
              }}
            />
          </div>

          {/* Accessible Technical Support Link */}
          <div className="pt-1 text-xs text-muted-foreground">
            <p className="text-xs">
              Không đăng nhập được?{" "}
              <a
                href="mailto:support@cdktcnqn.edu.vn"
                className="text-foreground font-medium underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-xs transition-colors"
              >
                Liên hệ hỗ trợ
              </a>
            </p>
          </div>
        </m.div>
      </div>
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
