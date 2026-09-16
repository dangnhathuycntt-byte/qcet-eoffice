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
} from "@/lib/login-helpers";

function LoginSkeleton() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      role="main"
      aria-label="Đang tải trang đăng nhập"
      className="flex min-h-[100dvh] w-full bg-background outline-none"
    >
      {/* Left Branding Panel Skeleton (56% on lg+) */}
      <div
        aria-hidden="true"
        className="hidden lg:flex lg:w-[56%] p-4 lg:p-5 xl:p-6 select-none"
      >
        <div className="w-full h-full flex flex-col justify-end p-8 lg:p-10 rounded-2xl lg:rounded-[24px] bg-muted/80">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-muted-foreground/20 rounded animate-pulse" />
            <div className="h-4 w-64 bg-muted-foreground/15 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Right Login Area Skeleton (44% on lg+, 100% on mobile) */}
      <div className="w-full lg:w-[44%] flex flex-col justify-between p-6 sm:p-10 lg:p-12 min-h-[100dvh] lg:min-h-0">
        <div className="h-6 hidden sm:block" />
        <div className="flex flex-col items-center text-center max-w-[340px] w-full mx-auto my-auto py-8">
          <div className="size-10 rounded-full bg-muted animate-pulse" />
          <div className="mt-3 h-6 w-32 bg-muted rounded-md animate-pulse" />
          <div className="mt-6 h-11 w-full bg-muted rounded-md animate-pulse" />
        </div>
        <div className="w-full flex justify-center py-4">
          <div className="h-4 w-16 bg-muted/60 rounded animate-pulse" />
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

  // Only show skeleton if already authenticated and redirecting
  if (isAuthenticated && Boolean(user)) {
    return <LoginSkeleton />;
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      role="main"
      aria-label="Trang đăng nhập QCET Work"
      className="flex min-h-[100dvh] w-full bg-background selection:bg-primary/15 selection:text-primary outline-none"
    >
      {/* Desktop Left: Clean Institutional Campus Panel (56% on lg+) */}
      <div
        aria-hidden="true"
        className="hidden lg:flex lg:w-[56%] p-4 lg:p-5 xl:p-6 select-none"
      >
        <div className="relative w-full h-full flex flex-col justify-end p-8 lg:p-10 xl:p-12 overflow-hidden rounded-2xl lg:rounded-[24px] bg-black text-white shadow-sm ring-1 ring-white/10">
          {/* Campus Photo Background - Cleanly framed on academic buildings and plaza */}
          <m.div
            initial={{ scale: 1.04, opacity: 0 }}
            animate={{ scale: 1.01, opacity: 1 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 size-full"
          >
            <Image
              src="/campus-qcet.jpg"
              alt="Khuôn viên Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"
              fill
              priority
              sizes="(min-width: 1024px) 56vw, 100vw"
              className="object-cover object-[65%_52%]"
            />
          </m.div>

          {/* Minimalist soft gradient overlay: subtle shadow only at bottom text */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-1" />

          {/* Lower Area: Minimal Institutional Caption */}
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 space-y-1 max-w-sm"
          >
            <h2 className="text-lg font-semibold tracking-tight text-white font-heading">
              Không gian làm việc số
            </h2>
            <p className="text-xs text-white/80 font-medium">
              Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
            </p>
          </m.div>
        </div>
      </div>

      {/* Desktop Right / Mobile: True Minimalist Auth Panel (44% on lg+, 100% on mobile) */}
      <div className="w-full lg:w-[44%] flex flex-col justify-between p-6 sm:p-10 lg:p-12 min-h-[100dvh] lg:min-h-0">
        {/* Top spacer for optical vertical centering */}
        <div className="h-6 hidden sm:block" />

        {/* Pure Minimal Auth Block: Small Logo -> QCET Work -> Google Sign-in */}
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center max-w-[340px] w-full mx-auto my-auto py-8"
        >
          {/* 1. Logo nhỏ 40px */}
          <m.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src="/logo-qcet.png"
              alt="Logo QCET"
              width={80}
              height={80}
              className="size-10 object-contain select-none"
              priority
            />
          </m.div>

          {/* 2. Tiêu đề ứng dụng */}
          <m.div
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-3"
          >
            <h1 className="text-xl sm:text-[22px] font-semibold tracking-[-0.02em] text-foreground font-heading">
              QCET Work
            </h1>
          </m.div>

          {/* OAuth Error / Warning Notice */}
          {oauthError && !dismissedOAuthError && (
            <m.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              role="alert"
              className="mt-5 flex items-start gap-2.5 w-full rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive text-left"
            >
              <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" strokeWidth={1.5} />
              <div className="flex-1 space-y-1">
                <p className="font-semibold">{oauthError.title}</p>
                <p className="text-[11px] leading-relaxed opacity-90">{oauthError.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setDismissedOAuthError(true)}
                className="shrink-0 p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive rounded-xs cursor-pointer transition-opacity"
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
              transition={{ duration: 0.25 }}
              role="alert"
              className="mt-5 flex items-start gap-2.5 w-full rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive text-left"
            >
              <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" strokeWidth={1.5} />
              <p className="flex-1 text-[11px] leading-relaxed">{errorMessage}</p>
            </m.div>
          )}

          {/* 3. Nút Google Đăng nhập chuẩn 340px */}
          <div className="w-full flex justify-center mt-6">
            <GoogleLoginButton
              returnTo={targetUrl}
              onError={handleError}
              onSuccess={handleSuccess}
            />
          </div>
        </m.div>

        {/* Minimal Footer Support Link */}
        <footer className="w-full text-center py-4 text-xs text-muted-foreground/70">
          <a
            href="mailto:support@cdktcnqn.edu.vn"
            className="hover:text-foreground transition-colors underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-xs"
          >
            Hỗ trợ kỹ thuật
          </a>
        </footer>
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
