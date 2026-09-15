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
      {/* Left Branding Panel (Desktop only ~40%) */}
      <div
        aria-hidden="true"
        className="hidden lg:flex lg:w-[40%] xl:w-[38%] flex-col justify-between border-r border-slate-200/40 bg-slate-50/50 p-12 select-none"
      >
        <div />
        <div className="pt-[14vh] pb-8 space-y-2.5">
          <div className="h-7 w-64 bg-muted rounded animate-pulse" />
          <div className="h-4 w-48 bg-muted/60 rounded animate-pulse" />
        </div>
        <div className="h-3 w-48 bg-muted/40 rounded animate-pulse" />
      </div>

      {/* Right Login Area (~60% on desktop, 100% on mobile) */}
      <div className="w-full lg:w-[60%] xl:w-[62%] flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="flex flex-col items-center text-center max-w-[380px] sm:max-w-[420px] w-full space-y-8">
          <div className="size-[72px] sm:size-20 rounded-full bg-muted animate-pulse" />
          <div className="space-y-2 flex flex-col items-center">
            <div className="h-7 w-52 bg-muted rounded-md animate-pulse" />
            <div className="h-4 w-68 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="h-4 w-60 bg-muted rounded-md animate-pulse pt-1" />
          <div className="h-12 w-[340px] sm:w-[360px] bg-muted rounded-md animate-pulse" />
          <div className="space-y-2 flex flex-col items-center pt-2">
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
      {/* Desktop Left: Institutional Brand Panel (~40% width) */}
      <div
        aria-hidden="true"
        className="hidden lg:flex lg:w-[40%] xl:w-[38%] relative flex-col justify-between border-r border-slate-200/40 bg-slate-50/50 p-12 select-none overflow-hidden"
      >
        <div />

        {/* Branding copy positioned slightly upward */}
        <div className="relative z-10 pt-[14vh] pb-8 max-w-sm space-y-2.5">
          <h2 className="text-xl xl:text-2xl font-bold tracking-tight text-slate-900 font-heading leading-snug">
            Không gian làm việc số của Nhà trường
          </h2>
          <p className="text-xs xl:text-sm text-slate-500 font-medium">
            Nhiệm vụ · Văn bản · Lịch công tác
          </p>
        </div>

        {/* Watermark: ~320-380px, 3.5% opacity, anchored bottom-right */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 -right-10 select-none opacity-[0.035] grayscale z-0"
        >
          <Image
            src="/logo-qcet.png"
            alt=""
            width={360}
            height={360}
            className="size-[340px] xl:size-[360px] object-contain"
          />
        </div>

        {/* Bottom: Institutional Footer Copyright */}
        <div className="relative z-10 text-[11px] text-slate-400 font-medium">
          © 2026 Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
        </div>
      </div>

      {/* Desktop Right / Mobile Centered: Clean Google-only Login Area (~60% width, ~8-12% enlarged scale) */}
      <div className="w-full lg:w-[60%] xl:w-[62%] flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="flex flex-col items-center text-center max-w-[380px] sm:max-w-[420px] w-full space-y-8">
          {/* Branding: Official High-Resolution School Logo (~76-80px), QCET E-Office, Full School Name */}
          <div className="flex flex-col items-center space-y-3">
            <Image
              src="/logo-qcet.png"
              alt="Logo Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"
              width={160}
              height={160}
              className="size-[72px] sm:size-20 object-contain select-none"
              priority
            />
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground font-heading">
                QCET E-Office
              </h1>
              <p className="text-xs sm:text-[14.5px] text-muted-foreground font-medium">
                Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
              </p>
            </div>
          </div>

          {/* Single Concise Login Heading */}
          <div className="pt-0.5">
            <h2 className="text-sm sm:text-base font-semibold text-foreground">
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
