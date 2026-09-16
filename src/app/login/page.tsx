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
        <div className="w-full h-full flex flex-col justify-end p-8 lg:p-10 xl:p-12 rounded-2xl lg:rounded-[24px] bg-muted/80">
          <div className="space-y-3">
            <div className="h-5 w-44 bg-muted-foreground/20 rounded-full animate-pulse" />
            <div className="h-8 w-72 bg-muted-foreground/20 rounded animate-pulse" />
            <div className="h-4 w-52 bg-muted-foreground/15 rounded animate-pulse" />
            <div className="h-3 w-48 bg-muted-foreground/10 rounded animate-pulse pt-3" />
          </div>
        </div>
      </div>

      {/* Right Login Area Skeleton (44% on lg+, 100% on mobile) */}
      <div className="w-full lg:w-[44%] flex flex-col justify-between p-6 sm:p-10 lg:p-12 min-h-[100dvh] lg:min-h-0">
        <div className="h-6 hidden sm:block" />
        <div className="flex flex-col items-center text-center max-w-[380px] w-full mx-auto my-auto py-8">
          <div className="size-12 rounded-xl bg-muted animate-pulse" />
          <div className="mt-4 h-7 w-36 bg-muted rounded-md animate-pulse" />
          <div className="mt-8 h-12 w-full bg-muted rounded-md animate-pulse" />
        </div>
        <div className="w-full flex justify-center py-4">
          <div className="h-4 w-32 bg-muted/60 rounded animate-pulse" />
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
      {/* Desktop Left: Institutional Campus Photography Panel (56% on lg+) */}
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

          {/* Minimalist soft gradient overlay: preserves true photo colors while ensuring text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent z-1" />

          {/* Lower Area: Institutional Statement & Footer */}
          <m.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 space-y-4 max-w-lg"
          >
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-medium text-white/90 border border-white/15">
                Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn
              </span>
              <h2 className="text-xl xl:text-2xl font-bold tracking-tight text-white font-heading leading-snug text-balance">
                Không gian làm việc số của nhà trường
              </h2>
              <p className="text-xs xl:text-sm text-white/85 font-medium">
                Nhiệm vụ · Văn bản &amp; Hồ sơ · Lịch công tác
              </p>
            </div>

            <div className="text-[11px] text-white/65 font-medium border-t border-white/10 pt-3">
              © 2026 QCET Work · Cổng điều hành tác nghiệp
            </div>
          </m.div>
        </div>
      </div>

      {/* Desktop Right / Mobile: Minimalist Auth Panel (44% on lg+, 100% on mobile) */}
      <div className="w-full lg:w-[44%] flex flex-col justify-between p-6 sm:p-10 lg:p-12 min-h-[100dvh] lg:min-h-0">
        {/* Top spacer for optical vertical centering */}
        <div className="h-6 hidden sm:block" />

        {/* Minimal Auth Block: Logo -> QCET Work -> Google Login Button */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center max-w-[380px] w-full mx-auto my-auto py-8"
        >
          {/* Logo nhỏ */}
          <m.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src="/logo-qcet.png"
              alt="Logo QCET"
              width={96}
              height={96}
              className="size-12 object-contain select-none"
              priority
            />
          </m.div>

          {/* Tên ứng dụng */}
          <m.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4"
          >
            <h1 className="text-2xl sm:text-[26px] font-semibold tracking-[-0.02em] text-foreground font-heading">
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
              className="mt-6 flex items-start gap-2.5 w-full rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive text-left"
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
              className="mt-6 flex items-start gap-2.5 w-full rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive text-left"
            >
              <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" strokeWidth={1.5} />
              <p className="flex-1 text-[11px] leading-relaxed">{errorMessage}</p>
            </m.div>
          )}

          {/* Chuẩn Google Identity Services Button */}
          <div className="w-full flex justify-center mt-7 sm:mt-8">
            <GoogleLoginButton
              returnTo={targetUrl}
              onError={handleError}
              onSuccess={handleSuccess}
            />
          </div>
        </m.div>

        {/* Minimal Footer Support Link */}
        <footer className="w-full text-center py-4 text-xs text-muted-foreground/80 flex items-center justify-center gap-3">
          <a
            href="mailto:support@cdktcnqn.edu.vn"
            className="hover:text-foreground transition-colors underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-xs"
          >
            Hỗ trợ kỹ thuật
          </a>
          <span className="text-border select-none" aria-hidden="true">·</span>
          <a
            href="mailto:qtm@cdktcnqn.edu.vn"
            className="hover:text-foreground transition-colors underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-xs"
          >
            Quản trị mạng
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
