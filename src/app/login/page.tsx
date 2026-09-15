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
        <div className="flex flex-col items-center text-center max-w-[360px] w-full px-6 sm:px-0 -translate-y-6">
          <div className="size-16 rounded-full bg-muted animate-pulse" />
          <div className="mt-3 space-y-1 flex flex-col items-center">
            <div className="h-4 w-28 bg-muted rounded-md animate-pulse" />
            <div className="h-4 w-48 bg-muted/80 rounded-md animate-pulse" />
          </div>
          <div className="mt-7 h-8 w-64 bg-muted rounded-md animate-pulse" />
          <div className="mt-2 h-4 w-56 bg-muted/70 rounded-md animate-pulse" />
          <div className="mt-6 h-12 w-full bg-muted rounded-md animate-pulse" />
          <div className="mt-6 h-3.5 w-44 bg-muted rounded-md animate-pulse" />
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
        <div className="relative w-full h-full flex flex-col justify-end p-8 lg:p-10 xl:p-12 overflow-hidden rounded-3xl bg-slate-950 text-white">
          {/* Campus Photo Background with Framer Motion gentle zoom entrance - Closer focus on school architecture */}
          <m.div
            initial={{ scale: 1.08, opacity: 0 }}
            animate={{ scale: 1.03, opacity: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 size-full"
          >
            <Image
              src="/campus-qcet.jpg"
              alt="Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"
              fill
              priority
              sizes="(min-width: 1024px) 46vw, 100vw"
              className="object-cover object-[75%_65%]"
            />
          </m.div>

          {/* Brighter, clearer institutional gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-slate-900/25 z-1" />

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
          className="flex flex-col items-center text-center max-w-[360px] w-full px-6 sm:px-0 -translate-y-6"
        >
          {/* 1. Logo gốc 64px */}
          <m.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src="/logo-qcet.png"
              alt="Logo Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"
              width={144}
              height={144}
              className="size-16 object-contain select-none"
              priority
            />
          </m.div>

          {/* 2. Tên trường hai dòng (cách logo 12px) */}
          <m.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3"
          >
            <p className="text-[13.5px] leading-snug text-muted-foreground font-medium">
              Trường Cao đẳng<br />Kỹ thuật Công nghệ Quy Nhơn
            </p>
          </m.div>

          {/* 3. Tiêu đề “Đăng nhập QCET E-Office”, 28px semibold (cách tên trường 28px) */}
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="mt-7"
          >
            <h1 className="text-[28px] font-semibold tracking-tight text-foreground font-heading leading-tight">
              Đăng nhập QCET E-Office
            </h1>
          </m.div>

          {/* 4. Mô tả 14px: “Sử dụng tài khoản Google được cấp quyền.” (cách tiêu đề 8px) */}
          <m.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-2"
          >
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Sử dụng tài khoản Google được cấp quyền.
            </p>
          </m.div>

          {/* OAuth Error / Warning Notice */}
          {oauthError && !dismissedOAuthError && (
            <m.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              role="alert"
              className="mt-5 flex items-start gap-2.5 w-full rounded-lg border border-red-200 bg-red-50/90 p-3 text-xs text-red-900 text-left"
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
              className="mt-5 flex items-start gap-2.5 w-full rounded-lg border border-red-200 bg-red-50/90 p-3 text-xs text-red-900 text-left"
            >
              <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" strokeWidth={1.5} />
              <p className="flex-1 text-[11px] leading-relaxed">{errorMessage}</p>
            </m.div>
          )}

          {/* 5. Nút Google rộng 100% (cách mô tả 24px) */}
          <div className="w-full flex justify-center mt-6">
            <GoogleLoginButton
              returnTo={targetUrl}
              onError={(msg) => setErrorMessage(msg)}
              onSuccess={(url) => {
                window.location.href = url;
              }}
            />
          </div>

          {/* 6. Dòng hỗ trợ 13px: “Cần trợ giúp? Liên hệ hỗ trợ” (cách nút 24px) */}
          <div className="mt-6 text-[13px] text-muted-foreground">
            <p>
              Cần trợ giúp?{" "}
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
