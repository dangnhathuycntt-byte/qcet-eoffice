"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Send } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import {
  resolveOAuthError,
  sanitizeRedirectUrl,
  shouldShowLoginSkeleton,
} from "@/lib/login-helpers";

/* ─── Layout constants ─── */
const PAGE = "flex min-h-[100dvh] w-full items-start justify-center bg-white px-6 pt-24 pb-10 outline-none min-[600px]:items-center min-[600px]:py-10 relative overflow-hidden font-sans text-foreground";
const CARD = "flex w-full max-w-[420px] flex-col items-start rounded-none px-0 pb-8 text-left min-[600px]:items-center min-[600px]:rounded-[24px] min-[600px]:px-10 min-[600px]:pt-11 min-[600px]:pb-8 min-[600px]:text-center min-[600px]:shadow-[0_0_0_1px_#EAEDF1,0_16px_48px_rgba(26,29,35,0.08)] bg-white relative z-10";
const BTN_PRIMARY = "flex h-12 w-full items-center justify-center gap-2.5 rounded-[14px] px-4 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-[3px]";
const BTN_OUTLINE = "flex h-12 w-full items-center justify-center gap-2.5 rounded-[14px] border px-4 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-[3px]";

const C = { fg: "#1A1D23", sub: "#5F6671", err: "#B42318", border: "#EAEDF1" } as const;

function checkIsInAppBrowser(): boolean {
  if (typeof window === "undefined" || !window.navigator) return false;
  const ua = window.navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Line|MicroMessenger|Zalo|Snapchat|ByteDance|TikTok|Teams/i.test(ua);
}

function LoginSkeleton() {
  return (
    <main id="main-content" tabIndex={-1} aria-label="Đang tải" aria-busy="true" className={PAGE}>
      <div className={CARD}>
        <div className="size-16 rounded-full bg-muted" />
        <div className="mt-[22px] h-8 w-40 rounded bg-muted" />
        <div className="mt-1.5 h-5 w-56 rounded bg-muted" />
        <div className="mt-7 h-12 w-full rounded-[14px] bg-muted" />
        <div className="mt-3.5 h-4 w-32 rounded bg-muted" />
        <div className="mt-2 h-4 w-52 rounded bg-muted" />
      </div>
    </main>
  );
}

function Logo() {
  return <Image src="/design/login-logo.png" alt="Logo QCET" width={64} height={64} priority className="size-14 min-[600px]:size-16 rounded-full object-contain select-none" />;
}

function SupportFooter() {
  return (
    <div className="mt-8 pt-5 w-full text-center text-[13px]" style={{ borderTop: `1px solid ${C.border}`, color: C.sub }}>
      Gặp sự cố?{" "}
      <a href="mailto:hotro@cdktcnqn.edu.vn" className="underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ color: C.fg }}>hotro@cdktcnqn.edu.vn</a>
    </div>
  );
}

function CampusChrome() {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-[30px] z-0 hidden min-[600px]:flex justify-center select-none overflow-hidden">
        <Image src="/design/campus-illustration.webp" alt="" width={1800} height={444} priority className="w-full max-w-[1800px] h-auto object-contain object-bottom" />
      </div>
      <div className="absolute inset-x-0 bottom-0 pb-7 text-center text-xs min-[600px]:hidden" style={{ color: C.sub }}>
        Gặp sự cố?{" "}
        <a href="mailto:hotro@cdktcnqn.edu.vn" className="underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ color: C.fg }}>hotro@cdktcnqn.edu.vn</a>
      </div>
      <div className="absolute right-8 bottom-[52px] hidden min-[600px]:block text-[13px] z-10" style={{ color: C.sub }}>
        Gặp sự cố?{" "}
        <a href="mailto:hotro@cdktcnqn.edu.vn" className="underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ color: C.fg }}>hotro@cdktcnqn.edu.vn</a>
      </div>
    </>
  );
}

/* ─── Main ─── */
function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isInApp, setIsInApp] = React.useState(false);
  const [hasCopiedLink, setHasCopiedLink] = React.useState(false);
  const [lastUser, setLastUser] = React.useState<{ name: string; email: string; avatar?: string } | null>(null);
  const [chooseOther, setChooseOther] = React.useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = React.useState(false);
  const [hasSubmittedRequest, setHasSubmittedRequest] = React.useState(false);
  const [isQuickLogging, setIsQuickLogging] = React.useState(false);

  const hasStartedGoogleRef = React.useRef(false);
  const isRedirectingRef = React.useRef(false);

  React.useEffect(() => {
    setIsInApp(checkIsInAppBrowser());
    document.documentElement.classList.add("bg-white");
    document.body.classList.add("bg-white");
    try {
      const stored = localStorage.getItem("qcet_last_login_user");
      if (stored) {
        const p = JSON.parse(stored);
        if (p?.name && p?.email) {
          // Fallback: get avatar from active user storage if missing
          if (!p.avatar) {
            try {
              const active = localStorage.getItem("qcet_active_user");
              if (active) { const a = JSON.parse(active); if (a?.avatar) p.avatar = a.avatar; }
            } catch { /* */ }
          }
          setLastUser(p);
        }
      }
    } catch { /* */ }
    return () => { document.documentElement.classList.remove("bg-white"); document.body.classList.remove("bg-white"); };
  }, []);

  const targetUrl = React.useMemo(() => sanitizeRedirectUrl(
    searchParams.get("returnTo") || searchParams.get("redirect") || searchParams.get("callbackUrl")
  ), [searchParams]);

  const deepLinkLabel = React.useMemo(() => {
    const raw = searchParams.get("returnTo") || "";
    return raw.startsWith("/tasks/") ? (searchParams.get("title") || null) : null;
  }, [searchParams]);

  React.useEffect(() => {
    if (!isLoading && isAuthenticated && user && !isRedirectingRef.current) {
      isRedirectingRef.current = true;
      router.replace(targetUrl);
    }
  }, [isLoading, isAuthenticated, user, targetUrl, router]);

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated && searchParams.get("startGoogle") === "1" && !hasStartedGoogleRef.current) {
      hasStartedGoogleRef.current = true;
      const prompt = searchParams.get("prompt") || undefined;
      void signIn("google", { callbackUrl: targetUrl, prompt }).catch(() => {
        hasStartedGoogleRef.current = false;
        setErrorMessage("Không thể kết nối đến máy chủ xác thực");
      });
    }
  }, [isLoading, isAuthenticated, searchParams, targetUrl]);

  const errorParam = searchParams.get("error");
  const emailParam = searchParams.get("email");
  const oauthError = React.useMemo(() => resolveOAuthError(errorParam, emailParam), [errorParam, emailParam]);
  const fromLogout = searchParams.get("reason") === "logout";
  const fromExpired = searchParams.get("reason") === "expired" || oauthError?.code === "session_expired";

  const handleRequestAccess = React.useCallback(async () => {
    setIsSubmittingRequest(true);
    try {
      const email = emailParam || "";
      await fetch("/api/auth/request-access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || "unknown@cdktcnqn.edu.vn" }),
      });
      setHasSubmittedRequest(true);
    } catch { setHasSubmittedRequest(true); }
    finally { setIsSubmittingRequest(false); }
  }, [emailParam]);

  if (shouldShowLoginSkeleton({ isLoading, isAuthenticated, user })) return <LoginSkeleton />;

  /* ═══════════════════════════════════════════════════════
     STATE: Trong ứng dụng chat (Board 1 · card 7)
     ═══════════════════════════════════════════════════════ */
  if (isInApp) {
    return (
      <main id="main-content" tabIndex={-1} className={PAGE}>
        <div className={CARD}>
          <Logo />
          <h1 className="mt-[22px] text-[28px] min-[600px]:text-2xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>Mở bằng trình duyệt</h1>
          <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>Google không cho đăng nhập trong ứng dụng này.</p>
          <div className="mt-7 w-full">
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setHasCopiedLink(true); setTimeout(() => setHasCopiedLink(false), 3000); } catch {} }}
              className={BTN_PRIMARY} style={{ background: "#131314", color: "#E3E3E3", boxShadow: "inset 0 0 0 1px #8E918F" }}>
              {hasCopiedLink ? "Đã sao chép ✓" : "Sao chép liên kết"}
            </button>
          </div>
          <p className="mt-3.5 text-xs" style={{ color: C.sub }}>Bấm <strong style={{ color: C.fg }}>⋯</strong> rồi chọn Mở bằng trình duyệt.</p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: C.sub }}>QCET Work chỉ nhận tên và email của bạn.</p>
          <SupportFooter />
        </div>
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════════
     STATE: Chưa được cấp quyền · gửi yêu cầu (Board 3 · card 1)
     ═══════════════════════════════════════════════════════ */
  if ((oauthError?.code === "account_not_found" || oauthError?.code === "AccessDenied") && !hasSubmittedRequest) {
    return (
      <main id="main-content" tabIndex={-1} className={PAGE}>
        <div className={CARD}>
          <Logo />
          <h1 className="mt-[22px] text-xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>Chưa được cấp quyền</h1>
          <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>{emailParam || "Tài khoản của bạn"} chưa có quyền dùng QCET Work.</p>
          <div className="mt-7 w-full flex flex-col items-center gap-3">
            <button type="button" disabled={isSubmittingRequest} onClick={handleRequestAccess}
              className={BTN_OUTLINE} style={{ borderColor: C.border, color: C.fg }}>
              <Send className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              {isSubmittingRequest ? "Đang gửi..." : "Gửi yêu cầu cấp quyền"}
            </button>
            <a href="/login?startGoogle=1&prompt=select_account" className="text-sm font-medium underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ color: C.fg }}>
              Dùng tài khoản khác
            </a>
            <p className="text-xs" style={{ color: C.sub }}>Yêu cầu gửi kèm tên và email của bạn.</p>
          </div>
          <SupportFooter />
        </div>
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════════
     STATE: Đã gửi yêu cầu (Board 3 · card 2)
     ═══════════════════════════════════════════════════════ */
  if (hasSubmittedRequest) {
    return (
      <main id="main-content" tabIndex={-1} className={PAGE}>
        <div className={CARD}>
          <Logo />
          <h1 className="mt-[22px] text-xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>Đã gửi yêu cầu</h1>
          <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>Quản trị viên sẽ xem và báo qua email.</p>
          <div className="mt-7 w-full flex flex-col items-center gap-3">
            <button type="button" onClick={() => router.push("/login")}
              className={BTN_OUTLINE} style={{ borderColor: C.border, color: C.fg }}>
              Quay lại đăng nhập
            </button>
            <p className="text-xs" style={{ color: C.sub }}>Bạn sẽ nhận email khi được cấp quyền.</p>
          </div>
          <p className="mt-4 text-xs leading-relaxed" style={{ color: C.sub }}>QCET Work chỉ nhận tên và email của bạn.</p>
          <SupportFooter />
        </div>
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════════
     STATE: Tài khoản đã bị khóa (Board 3 · card 3)
     ═══════════════════════════════════════════════════════ */
  if (oauthError?.code === "account_disabled") {
    return (
      <main id="main-content" tabIndex={-1} className={PAGE}>
        <div className={CARD}>
          <Logo />
          <h1 className="mt-[22px] text-xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>Tài khoản đã bị khóa</h1>
          <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>Tài khoản này không còn dùng được QCET Work.</p>
          <div className="mt-7 w-full flex flex-col items-center gap-3">
            <button type="button" onClick={() => router.push("/login?startGoogle=1&prompt=select_account")}
              className={BTN_OUTLINE} style={{ borderColor: C.border, color: C.fg }}>
              Dùng tài khoản khác
            </button>
            <p className="text-xs" style={{ color: C.sub }}>
              Nếu đây là nhầm lẫn,{" "}
              <a href="mailto:hotro@cdktcnqn.edu.vn" className="underline underline-offset-[3px]" style={{ color: C.fg }}>liên hệ hỗ trợ</a>.
            </p>
          </div>
          <p className="mt-4 text-xs leading-relaxed" style={{ color: C.sub }}>QCET Work chỉ nhận tên và email của bạn.</p>
          <SupportFooter />
        </div>
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════════
     STATE: Chưa kết nối được Google (Board 3 · card 5)
     ═══════════════════════════════════════════════════════ */
  if (errorMessage || oauthError?.code === "server_error") {
    return (
      <main id="main-content" tabIndex={-1} className={PAGE}>
        <div className={CARD}>
          <Logo />
          <h1 className="mt-[22px] text-xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>Chưa kết nối được Google</h1>
          <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>Kiểm tra mạng rồi thử lại.</p>
          <div className="mt-7 w-full flex flex-col items-center gap-3">
            <button type="button" onClick={() => { setErrorMessage(null); router.push("/login?startGoogle=1"); }}
              className={BTN_OUTLINE} style={{ borderColor: C.border, color: C.fg }}>
              Thử lại
            </button>
            <p className="text-xs" style={{ color: C.sub }}>
              Vẫn lỗi?{" "}
              <a href="mailto:hotro@cdktcnqn.edu.vn" className="underline underline-offset-[3px]" style={{ color: C.fg }}>liên hệ hỗ trợ</a>.
            </p>
          </div>
          <p className="mt-4 text-xs leading-relaxed" style={{ color: C.sub }}>QCET Work chỉ nhận tên và email của bạn.</p>
          <SupportFooter />
        </div>
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════════
     STATE: Đã đăng nhập trước đó (Board 1 · card 5) — "Chào mừng quay lại"
     ═══════════════════════════════════════════════════════ */
  if (lastUser && !chooseOther && !oauthError && !fromLogout && !fromExpired) {
    const firstName = lastUser.name.trim().split(" ").pop() || "bạn";
    const initial = lastUser.name.trim().charAt(0).toUpperCase() || "A";
    const handleQuickLogin = () => {
      setIsQuickLogging(true);
      signIn("google", { callbackUrl: targetUrl }, { login_hint: lastUser.email, prompt: "none" }).catch(() => setIsQuickLogging(false));
    };
    return (
      <main id="main-content" tabIndex={-1} className={PAGE}>
        <div className={CARD}>
          <Logo />
          <h1 className="mt-[22px] text-[28px] min-[600px]:text-2xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>Đăng nhập</h1>
          <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>Chào mừng quay lại</p>

          <button type="button" disabled={isQuickLogging} onClick={handleQuickLogin}
            className="mt-6 flex w-full items-center gap-3 rounded-xl p-3 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all duration-150 active:scale-[0.98] hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-70" style={{ border: `1px solid ${C.border}` }}>
            {lastUser.avatar ? (
              <img src={lastUser.avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ background: C.fg, color: "#fff" }}>{initial}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium" style={{ color: C.fg }}>{lastUser.name}</div>
              <div className="truncate text-xs" style={{ color: C.sub }}>{lastUser.email}</div>
            </div>
            {isQuickLogging && <div className="size-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: C.sub }} />}
          </button>

          <div className="mt-5 w-full flex flex-col items-center gap-2.5">
            <button type="button" onClick={() => setChooseOther(true)}
              className="text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring h-10" style={{ color: C.fg }}>
              Dùng tài khoản khác
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: C.sub }}>QCET Work chỉ nhận tên và email của bạn.</p>
        </div>
        <CampusChrome />
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════════
     DEFAULT: Đăng nhập (Board 1 · card 1 + inline variants)
     Board 1 uses SAME card, only message area changes.
     ═══════════════════════════════════════════════════════ */
  let title = "Đăng nhập";
  let subtitle: React.ReactNode = "Dùng tài khoản Google của nhà trường";
  if (fromExpired) { title = "Phiên đã hết hạn"; subtitle = "Đăng nhập lại để tiếp tục."; }
  else if (fromLogout) { title = "Đã đăng xuất"; subtitle = "Hẹn gặp lại."; }
  else if (deepLinkLabel) { subtitle = <>Đăng nhập để mở nhiệm vụ <strong className="font-medium" style={{ color: C.fg }}>{deepLinkLabel}</strong></>; }

  let messageNode: React.ReactNode = <span style={{ color: C.sub }}>@cdktcnqn.edu.vn</span>;
  if (oauthError?.code === "domain_not_allowed") {
    messageNode = (
      <span role="alert" style={{ color: C.err }}>
        Tài khoản này không thuộc @cdktcnqn.edu.vn.{" "}
        <a href="/login?startGoogle=1&prompt=select_account" className="underline underline-offset-[3px]" style={{ color: C.err }}>Chọn tài khoản khác</a>
      </span>
    );
  } else if (fromLogout) {
    messageNode = <span style={{ color: C.sub }}>Đang dùng máy chung? Hãy đóng cả trình duyệt.</span>;
  } else if (fromExpired) {
    const draftName = searchParams.get("draft");
    messageNode = draftName
      ? <span style={{ color: C.sub }}>Bản nháp &ldquo;{draftName}&rdquo; đã được lưu.</span>
      : <span style={{ color: C.sub }}>@cdktcnqn.edu.vn</span>;
  }

  return (
    <main id="main-content" tabIndex={-1} aria-label="Trang đăng nhập QCET Work" className={PAGE}>
      <div className={CARD}>
        <Logo />
        <h1 className="mt-[22px] text-[28px] min-[600px]:text-2xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>{title}</h1>
        <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>{subtitle}</p>
        <div className="mt-7 w-full">
          <GoogleLoginButton returnTo={targetUrl} onError={(msg) => setErrorMessage(msg)} onSuccess={(url) => { window.location.href = url; }} />
        </div>
        <div className="mt-3.5 min-h-11 w-full text-xs text-center" aria-live="polite" aria-atomic="true">{messageNode}</div>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: C.sub }}>QCET Work chỉ nhận tên và email của bạn.</p>
      </div>
      <CampusChrome />
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
