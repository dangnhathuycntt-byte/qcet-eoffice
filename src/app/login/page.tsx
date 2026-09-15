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
      className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-background outline-none"
    >
      <div className="flex flex-col items-center text-center max-w-sm w-full space-y-4">
        <div className="size-16 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-52 bg-muted rounded-md animate-pulse" />
        <div className="h-3 w-40 bg-muted rounded-md animate-pulse" />
        <div className="h-9 w-64 bg-muted rounded-md animate-pulse pt-2" />
        <div className="h-3 w-48 bg-muted rounded-md animate-pulse" />
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
      className="flex min-h-screen w-full flex-col items-center justify-center p-6 bg-background selection:bg-primary/15 selection:text-primary outline-none"
    >
      <div className="flex flex-col items-center text-center max-w-sm w-full space-y-6">
        {/* Branding: Logo, QCET E-Office, School Name */}
        <div className="flex flex-col items-center space-y-2">
          <Image
            src="/logo-qcet.png"
            alt="Logo Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"
            width={64}
            height={64}
            className="size-16 object-contain select-none"
            priority
          />
          <div className="space-y-0.5">
            <h1 className="text-lg font-bold tracking-tight text-foreground font-heading">
              QCET E-Office
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
            </p>
          </div>
        </div>

        {/* Section Heading & Instruction */}
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">
            Đăng nhập
          </h2>
          <p className="text-xs text-muted-foreground">
            Sử dụng tài khoản Google Workspace được Nhà trường cấp để truy cập hệ thống.
          </p>
        </div>

        {/* Error Notice */}
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
              className="shrink-0 p-0.5 text-red-700 hover:text-red-950 cursor-pointer"
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

        {/* Google SSO Button */}
        <div className="w-full flex justify-center pt-1">
          <GoogleLoginButton
            returnTo={targetUrl}
            onError={(msg) => setErrorMessage(msg)}
            onSuccess={(url) => {
              router.refresh();
              router.replace(url);
            }}
          />
        </div>

        {/* Eligibility Note & Technical Support */}
        <div className="space-y-2 pt-2 text-center text-xs text-muted-foreground">
          <p className="text-[11px]">
            Chỉ áp dụng cho tài khoản thuộc miền <span className="font-mono font-medium text-foreground">@cdktcnqn.edu.vn</span>
          </p>
          <p className="text-[11px]">
            Hỗ trợ kỹ thuật:{" "}
            <a
              href="mailto:support@cdktcnqn.edu.vn"
              className="text-foreground hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
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
