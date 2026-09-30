"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useAuth } from "@/lib/auth-context";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import {
  resolveOAuthError,
  sanitizeRedirectUrl,
  shouldShowLoginSkeleton,
} from "@/lib/login-helpers";

const loginPageClass = "flex min-h-[100dvh] w-full items-center justify-center bg-white px-6 py-10 outline-none relative overflow-hidden";
const loginCardClass = "flex w-full max-w-[420px] flex-col items-center rounded-[24px] bg-white px-0 pt-6 pb-8 sm:px-10 sm:pt-11 sm:pb-8 sm:shadow-[0_0_0_1px_#EAEDF1,0_16px_48px_rgba(26,29,35,0.08)] text-center relative z-10";

function LoginSkeleton() {
  return (
    <main id="main-content" tabIndex={-1} aria-label="Đang tải trang đăng nhập" aria-busy="true" className={loginPageClass}>
      <div className={loginCardClass}>
        <div className="size-16 rounded-full bg-muted" />
        <div className="mt-[22px] h-8 w-40 rounded bg-muted" />
        <div className="mt-2 h-5 w-full rounded bg-muted" />
        <div className="mt-7 h-12 w-full rounded-[14px] bg-muted" />
        <div className="mt-3 min-h-11 w-full" />
        <div className="h-4 w-40 rounded bg-muted" />
      </div>
    </main>
  );
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const hasStartedGoogleRef = React.useRef(false);

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
      const destination = !user.onboardedAt ? "/onboarding" : targetUrl;
      router.replace(destination);
    }
  }, [isLoading, isAuthenticated, user, targetUrl, router]);

  React.useEffect(() => {
    if (
      !isLoading &&
      !isAuthenticated &&
      searchParams.get("startGoogle") === "1" &&
      !hasStartedGoogleRef.current
    ) {
      hasStartedGoogleRef.current = true;
      void signIn("google", { callbackUrl: targetUrl }).catch(() => {
        hasStartedGoogleRef.current = false;
        setErrorMessage("Không thể kết nối đến máy chủ xác thực");
      });
    }
  }, [isLoading, isAuthenticated, searchParams, targetUrl]);

  // OAuth Error handling from URL query parameters
  const errorParam = searchParams.get("error");
  const emailParam = searchParams.get("email");

  const oauthError = React.useMemo(() => {
    return resolveOAuthError(errorParam, emailParam);
  }, [errorParam, emailParam]);

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

  const visibleOAuthError = oauthError;
  const designNotices: Record<string, { message: string; action?: string }> = {
    domain_not_allowed: { message: "Tài khoản này không thuộc @cdktcnqn.edu.vn.", action: "Chọn tài khoản khác" },
    account_not_found: { message: "Tài khoản chưa được cấp quyền.", action: "Liên hệ hỗ trợ" },
    session_expired: { message: "Phiên đã hết hạn.", action: "Đăng nhập lại" },
    oauth_cancelled: { message: "Bạn đã hủy đăng nhập." },
    server_error: { message: "Không kết nối được Google.", action: "Thử lại" },
  };
  const designNotice = visibleOAuthError ? designNotices[visibleOAuthError.code] : undefined;
  const notice = errorMessage ? "Không kết nối được Google." : designNotice?.message || visibleOAuthError?.message;
  const actionText = errorMessage ? "Thử lại" : designNotice ? designNotice.action : visibleOAuthError?.actionText || "Liên hệ hỗ trợ";

  return (
    <main id="main-content" tabIndex={-1} aria-label="Trang đăng nhập QCET Work" className={loginPageClass}>
      <div className={loginCardClass}>
        <Image src="/design/login-logo.png" alt="Logo QCET" width={64} height={64} priority className="size-16 rounded-full object-contain select-none" />
        <h1 className="mt-[22px] text-2xl tracking-[-0.012em] font-semibold text-foreground">Đăng nhập</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Dùng tài khoản Google của nhà trường</p>
        <div className="mt-7 w-full">
          <GoogleLoginButton returnTo={targetUrl} onError={handleError} onSuccess={handleSuccess} />
        </div>
        <div className="mt-3 min-h-11 w-full text-sm" aria-live="polite" aria-atomic="true">
          {notice ? (
            <p role={visibleOAuthError?.variant === "neutral" && !errorMessage ? "status" : "alert"} className={visibleOAuthError?.variant === "neutral" && !errorMessage ? "leading-[1.55] text-muted-foreground" : "leading-[1.55] text-destructive"}>
              {notice}
              {actionText && <> {" "}<a href={visibleOAuthError?.actionHref || (errorMessage || visibleOAuthError?.code === "server_error" ? "/login?startGoogle=1" : "mailto:support@cdktcnqn.edu.vn")} className="rounded-sm underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{actionText}</a></>}
            </p>
          ) : <p className="pt-1 text-muted-foreground">@cdktcnqn.edu.vn</p>}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">QCET Work chỉ nhận tên và email của bạn.</p>

      </div>

      {/* Tranh khuôn viên ở đáy màn hình (desktop/tablet từ 600px) */}
      <Image
        src="/design/campus-illustration.webp"
        alt=""
        width={1440}
        height={444}
        priority
        className="pointer-events-none absolute left-0 bottom-[30px] w-full hidden sm:block select-none z-0"
      />

      {/* Góc phải dưới: Liên hệ hỗ trợ */}
      <div className="absolute right-8 bottom-7 hidden sm:block text-[13px] text-[#5F6671] z-10">
        Gặp sự cố?{" "}
        <a
          href="mailto:hotro@cdktcnqn.edu.vn"
          className="text-[#1A1D23] underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          hotro@cdktcnqn.edu.vn
        </a>
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
