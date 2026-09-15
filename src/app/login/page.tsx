"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
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
      {/* Left Branding Panel Skeleton (Desktop ~42%) */}
      <div
        aria-hidden="true"
        className="hidden lg:flex lg:w-[42%] xl:w-[40%] flex-col justify-between bg-slate-900 p-10 xl:p-12 select-none"
      >
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-slate-800 animate-pulse" />
          <div className="space-y-1">
            <div className="h-3 w-28 bg-slate-800 rounded animate-pulse" />
            <div className="h-2.5 w-44 bg-slate-800/60 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-7 w-64 bg-slate-800 rounded animate-pulse" />
          <div className="h-4 w-48 bg-slate-800/60 rounded animate-pulse" />
          <div className="h-3 w-48 bg-slate-800/40 rounded animate-pulse pt-4" />
        </div>
      </div>

      {/* Right Login Area Skeleton (~58% on desktop, 100% on mobile) */}
      <div className="w-full lg:w-[58%] xl:w-[60%] flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="flex flex-col items-center text-center max-w-[380px] sm:max-w-[420px] w-full space-y-7">
          {/* Mobile-only branding skeleton */}
          <div className="flex lg:hidden flex-col items-center space-y-2">
            <div className="size-16 rounded-full bg-muted animate-pulse" />
            <div className="h-5 w-40 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="h-7 w-64 bg-muted rounded-md animate-pulse" />
          <div className="h-12 w-[340px] sm:w-[360px] bg-muted rounded-md animate-pulse" />
          <div className="space-y-2 flex flex-col items-center pt-1">
            <div className="h-3.5 w-56 bg-muted rounded-md animate-pulse" />
            <div className="h-3.5 w-52 bg-muted rounded-md animate-pulse" />
          </div>
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
      router.refresh();
      router.replace(targetUrl);
    }
  }, [isLoading, isAuthenticated, user, router, targetUrl]);

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

  if (shouldShowLoginSkeleton({ isLoading, isAuthenticated, user })) {
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
      {/* Desktop Left: Institutional Campus Photography & Brand Panel (~40-42% desktop, hidden below 900px / mobile) */}
      <div
        aria-hidden="true"
        className="hidden lg:flex lg:w-[42%] xl:w-[40%] relative flex-col justify-between p-10 xl:p-12 select-none overflow-hidden bg-slate-950 text-white"
      >
        {/* Campus Photo Background */}
        <Image
          src="/campus-qcet.jpg"
          alt="Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"
          fill
          priority
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="object-cover object-[center_35%]"
        />

        {/* Sophisticated Dark Institutional Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-slate-950/60 z-1" />

        {/* Top: School Badge Lockup */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="size-10 rounded-full bg-white/95 p-1 flex items-center justify-center shadow-xs">
            <Image
              src="/logo-qcet.png"
              alt=""
              width={36}
              height={36}
              className="size-8 object-contain"
            />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-white tracking-tight">QCET E-Office</p>
            <p className="text-[11px] text-white/80 font-medium">Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn</p>
          </div>
        </div>

        {/* Lower Area: Institutional Statement & Footer */}
        <div className="relative z-10 space-y-6 pt-12">
          <div className="space-y-2 max-w-sm">
            <h2 className="text-xl xl:text-2xl font-bold tracking-tight text-white font-heading leading-snug">
              Không gian làm việc số của Nhà trường
            </h2>
            <p className="text-xs xl:text-sm text-white/80 font-medium">
              Nhiệm vụ · Văn bản · Lịch công tác
            </p>
          </div>

          <div className="text-[11px] text-white/60 font-medium border-t border-white/10 pt-4">
            © 2026 Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
          </div>
        </div>
      </div>

      {/* Desktop Right / Mobile Centered: Clean Google-only Login Area (~58-60% desktop, 100% mobile) */}
      <div className="w-full lg:w-[58%] xl:w-[60%] flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="flex flex-col items-center text-center max-w-[380px] sm:max-w-[420px] w-full space-y-7">
          {/* Mobile Only: Compact School Logo & Branding Lockup */}
          <div className="flex lg:hidden flex-col items-center space-y-2.5">
            <Image
              src="/logo-qcet.png"
              alt="Logo Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"
              width={128}
              height={128}
              className="size-16 object-contain select-none"
              priority
            />
            <div className="space-y-0.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground font-heading">
                QCET E-Office
              </h1>
              <p className="text-xs text-muted-foreground font-medium">
                Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
              </p>
            </div>
          </div>

          {/* Login Heading (Desktop primary heading & Mobile action title) */}
          <div className="pt-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
              Đăng nhập bằng tài khoản công vụ
            </h2>
          </div>

          {/* OAuth Error / Warning Notice */}
          {oauthError && !dismissedOAuthError && (
            <div
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
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 w-full rounded-lg border border-red-200 bg-red-50/90 p-3 text-xs text-red-900 text-left"
            >
              <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" strokeWidth={1.5} />
              <p className="flex-1 text-[11px] leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* Official Google Sign-In Button (Large size ~360px) */}
          <div className="w-full flex justify-center pt-0.5">
            <GoogleLoginButton
              returnTo={targetUrl}
              onError={(msg) => setErrorMessage(msg)}
              onSuccess={(url) => {
                router.refresh();
                router.replace(url);
              }}
            />
          </div>

          {/* Domain Note & Accessible Technical Support Link */}
          <div className="space-y-2 pt-1 text-center text-xs text-muted-foreground">
            <p className="text-xs">
              Dành cho tài khoản <span className="font-mono font-medium text-foreground">@cdktcnqn.edu.vn</span>
            </p>
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
        </div>
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
