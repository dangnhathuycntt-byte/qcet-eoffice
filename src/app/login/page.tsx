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
      className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-background px-6 py-12 sm:pb-20 outline-none"
    >
      <div className="flex w-full max-w-[360px] flex-col items-center text-center">
        {/* Logo skeleton */}
        <div className="size-11 sm:size-12 rounded-full bg-muted animate-pulse select-none" />

        {/* Title skeleton */}
        <div className="mt-4 h-7 w-48 rounded-md bg-muted animate-pulse" />

        {/* Description skeleton */}
        <div className="mt-1.5 h-4 w-60 rounded bg-muted/70 animate-pulse" />

        {/* Google button skeleton */}
        <div className="mt-6 h-11 w-full rounded-lg bg-muted animate-pulse" />

        {/* Eligibility condition skeleton */}
        <div className="mt-4 h-4 w-52 rounded bg-muted/50 animate-pulse" />

        {/* Support link skeleton */}
        <div className="mt-6 h-3.5 w-32 rounded bg-muted/40 animate-pulse" />
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

  // Auto-redirect if already authenticated (guarded to prevent duplicate triggers)
  const isRedirectingRef = React.useRef(false);
  React.useEffect(() => {
    if (!isLoading && isAuthenticated && user && !isRedirectingRef.current) {
      isRedirectingRef.current = true;
      router.replace(targetUrl);
    }
  }, [isLoading, isAuthenticated, user, targetUrl, router]);

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

  const handleError = React.useCallback((msg: string) => {
    setErrorMessage(msg);
  }, []);

  const handleSuccess = React.useCallback((url: string) => {
    window.location.href = url;
  }, []);

  // Show skeleton if loading or authenticated and redirecting
  if (shouldShowLoginSkeleton({ isLoading, isAuthenticated, user })) {
    return <LoginSkeleton />;
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      role="main"
      aria-label="Trang đăng nhập QCET Work"
      className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-background px-6 py-12 sm:pb-20 selection:bg-primary/15 selection:text-primary outline-none"
    >
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex w-full max-w-[360px] flex-col items-center text-center"
      >
        {/* 1. Logo QCET: 44-48px */}
        <Image
          src="/logo-qcet.png"
          alt="Logo QCET"
          width={48}
          height={48}
          priority
          className="size-11 sm:size-12 object-contain select-none"
        />

        {/* 2. Tiêu đề ứng dụng */}
        <h1 className="mt-4 font-heading text-2xl font-semibold tracking-[-0.02em] text-foreground">
          Đăng nhập QCET Work
        </h1>

        {/* 3. Mô tả ngắn */}
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sử dụng tài khoản Google của nhà trường.
        </p>

        {/* OAuth Error / Warning Notice */}
        {oauthError && !dismissedOAuthError && (
          <m.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            role="alert"
            className={`mt-5 flex w-full items-start gap-2.5 rounded-lg border p-3 text-left text-xs ${
              oauthError.variant === "amber"
                ? "border-amber-500/25 bg-amber-500/[0.06] text-amber-900"
                : oauthError.variant === "neutral"
                ? "border-border bg-muted/50 text-muted-foreground"
                : "border-destructive/25 bg-destructive/[0.06] text-destructive"
            }`}
          >
            <AlertCircle
              className={`mt-0.5 size-4 shrink-0 ${
                oauthError.variant === "amber"
                  ? "text-amber-600"
                  : oauthError.variant === "neutral"
                  ? "text-muted-foreground"
                  : "text-destructive"
              }`}
              strokeWidth={1.5}
            />
            <div className="flex-1 space-y-1">
              <p className="font-semibold text-xs leading-none">{oauthError.title}</p>
              <p className="text-[11.5px] leading-relaxed opacity-90">{oauthError.message}</p>
              {oauthError.actionText && oauthError.actionHref && (
                <div className="pt-1">
                  <a
                    href={oauthError.actionHref}
                    className="inline-flex items-center text-[11.5px] font-medium underline underline-offset-2 transition-opacity hover:opacity-80"
                  >
                    {oauthError.actionText}
                  </a>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDismissedOAuthError(true)}
              className="shrink-0 rounded-xs p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
              aria-label="Đóng thông báo"
            >
              <X className="size-3.5" strokeWidth={1.5} />
            </button>
          </m.div>
        )}

        {/* Runtime Error Notice */}
        {errorMessage && (
          <m.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            role="alert"
            className="mt-5 flex w-full items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] p-3 text-left text-xs text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={1.5} />
            <p className="flex-1 text-[11.5px] leading-relaxed">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="shrink-0 rounded-xs p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
              aria-label="Đóng thông báo lỗi"
            >
              <X className="size-3.5" strokeWidth={1.5} />
            </button>
          </m.div>
        )}

        {/* 4. Nút Google Đăng nhập */}
        <div className="mt-6 w-full">
          <GoogleLoginButton
            returnTo={targetUrl}
            onError={handleError}
            onSuccess={handleSuccess}
          />
        </div>

        {/* 5. Điều kiện đăng nhập */}
        <p className="mt-4 text-center text-xs sm:text-[13px] leading-relaxed text-muted-foreground/80 max-w-[320px]">
          Dành cho tài khoản @cdktcnqn.edu.vn đã được cấp quyền.
        </p>

        {/* 6. Hỗ trợ sự cố */}
        <a
          href="mailto:support@cdktcnqn.edu.vn"
          className="mt-6 rounded-xs text-xs sm:text-[13px] text-muted-foreground/80 transition-colors hover:text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 py-1 px-2"
        >
          Gặp sự cố? Liên hệ hỗ trợ
        </a>
      </m.div>
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
