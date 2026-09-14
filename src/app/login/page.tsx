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
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { resolveOAuthError, sanitizeRedirectUrl } from "@/lib/login-helpers";
import { cn } from "@/lib/utils";

/**
 * Pixel-perfect Skeleton that mirrors LoginFormContent geometry 1:1
 * Guarantees zero Cumulative Layout Shift (CLS) during SSR/CSR hydration.
 */
function LoginSkeleton() {
  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col justify-between bg-background">
      {/* Background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-35 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_15%,rgba(14,83,180,0.05),transparent_70%)] pointer-events-none" />

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
        <div className="w-full max-w-[420px] rounded-2xl border border-border/80 bg-card/95 p-6 sm:p-7 shadow-xs space-y-5">
          <div className="space-y-2 text-center flex flex-col items-center">
            <div className="h-6 w-44 bg-secondary/70 rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-secondary/40 rounded-md animate-pulse" />
          </div>
          <div className="h-12 w-full bg-secondary/50 rounded-xl animate-pulse" />
          <div className="h-4 w-48 mx-auto bg-secondary/40 rounded-md animate-pulse" />
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
    </div>
  );
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();

  const targetUrl = React.useMemo(() => {
    return sanitizeRedirectUrl(searchParams.get("redirect") || searchParams.get("callbackUrl"));
  }, [searchParams]);

  // Auto-redirect once authenticated. router.refresh() flushes the Next.js RSC
  // router cache so the target page sees the new session cookie immediately —
  // without it, a stale unauthenticated render may linger and the server can
  // redirect back to /login even though the cookie is already set.
  React.useEffect(() => {
    if (!isLoading && user) {
      router.refresh();
      router.replace(targetUrl);
    }
  }, [isLoading, user, router, targetUrl]);

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

  if (isLoading || user) {
    return <LoginSkeleton />;
  }

  return (
    <main
      id="main-content"
      role="main"
      aria-label="Trang đăng nhập QCET E-Office"
      className="relative flex min-h-[100dvh] w-full flex-col justify-between bg-background selection:bg-primary/15 selection:text-primary"
    >
      {/* Blueprint Grid & Academic Blue Ambient Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-35 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_15%,rgba(14,83,180,0.05),transparent_70%)] pointer-events-none" />

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
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
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
                    strokeWidth={1.75}
                  />
                )}
                {oauthError.variant === "red" && (
                  <AlertCircle
                    className="size-4 shrink-0 text-red-600 mt-0.5"
                    strokeWidth={1.75}
                  />
                )}
                {oauthError.variant === "neutral" && (
                  <Info
                    className="size-4 shrink-0 text-muted-foreground mt-0.5"
                    strokeWidth={1.75}
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
                        <ArrowRight className="size-3" strokeWidth={1.75} />
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
                  <X className="size-3.5" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          )}

          {/* Centralized Login Card */}
          <div className="rounded-2xl border border-border/80 bg-card/95 p-6 sm:p-7 shadow-xs backdrop-blur-sm space-y-5">
            <div className="space-y-1.5 text-center">
              <h1 className="text-xl font-bold tracking-tight text-foreground font-heading">
                Đăng nhập hệ thống
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Hệ thống làm việc và điều hành văn bản điện tử dành cho Cán bộ, Giảng viên & Nhân viên Nhà trường.
              </p>
            </div>

            <GoogleLoginButton />

            <div className="text-center text-xs text-muted-foreground">
              <span>Áp dụng cho tài khoản email </span>
              <span className="font-mono font-semibold text-primary">@cdktcnqn.edu.vn</span>
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-border/60 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" strokeWidth={2} />
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
