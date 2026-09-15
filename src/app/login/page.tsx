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
      className="relative flex min-h-screen w-full flex-col items-center justify-center p-6 bg-background overflow-hidden outline-none"
    >
      <div className="flex flex-col items-center text-center max-w-[380px] sm:max-w-[420px] w-full space-y-8">
        <div className="size-16 sm:size-[72px] rounded-full bg-muted animate-pulse" />
        <div className="space-y-2 flex flex-col items-center">
          <div className="h-7 w-48 bg-muted rounded-md animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded-md animate-pulse" />
        </div>
        <div className="space-y-1.5 flex flex-col items-center pt-1">
          <div className="h-4 w-32 bg-muted rounded-md animate-pulse" />
          <div className="h-3.5 w-72 bg-muted rounded-md animate-pulse" />
        </div>
        <div className="h-12 w-[320px] sm:w-[340px] bg-muted rounded-md animate-pulse" />
        <div className="space-y-2 flex flex-col items-center pt-2">
          <div className="h-3.5 w-56 bg-muted rounded-md animate-pulse" />
          <div className="h-3.5 w-48 bg-muted rounded-md animate-pulse" />
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
      className="relative flex min-h-screen w-full flex-col items-center justify-center p-6 bg-background selection:bg-primary/15 selection:text-primary overflow-hidden outline-none"
    >
      {/* Subtle Institutional Watermark (Decorative only, hidden on mobile, 3% opacity, monochrome) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none opacity-0 sm:opacity-[0.03] grayscale hidden sm:block z-0"
      >
        <Image
          src="/logo-qcet.png"
          alt=""
          width={480}
          height={480}
          className="size-[460px] sm:size-[480px] object-contain"
          priority
        />
      </div>

      {/* Main Content Composition */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-[380px] sm:max-w-[420px] w-full space-y-8">
        {/* Branding: High-Resolution School Logo, QCET E-Office, Full School Name */}
        <div className="flex flex-col items-center space-y-3">
          <Image
            src="/logo-qcet.png"
            alt="Logo Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"
            width={144}
            height={144}
            className="size-16 sm:size-[72px] object-contain select-none"
            priority
          />
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-heading">
              QCET E-Office
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
            </p>
          </div>
        </div>

        {/* Section Heading & Instruction */}
        <div className="space-y-1.5">
          <h2 className="text-sm sm:text-base font-semibold text-foreground">
            Đăng nhập
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Sử dụng tài khoản Google Workspace được Nhà trường cấp để truy cập hệ thống.
          </p>
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

        {/* Official Google Sign-In Button (Large size) */}
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

        {/* Shortened Domain Note & Technical Support Link */}
        <div className="space-y-2 pt-1 text-center text-xs text-muted-foreground">
          <p className="text-xs">
            Dành cho tài khoản <span className="font-mono font-medium text-foreground">@cdktcnqn.edu.vn</span>
          </p>
          <p className="text-xs">
            Hỗ trợ kỹ thuật:{" "}
            <a
              href="mailto:support@cdktcnqn.edu.vn"
              className="text-foreground font-medium underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-xs transition-colors"
            >
              Trung tâm Số &amp; Truyền thông
            </a>
          </p>
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
