"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Send, Copy, Check, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import {
  resolveOAuthError,
  sanitizeRedirectUrl,
  shouldShowLoginSkeleton,
} from "@/lib/login-helpers";

/* ─── Layout constants ─── */
const PAGE = "flex min-h-[100dvh] w-full items-start justify-center bg-white px-6 pt-24 pb-10 outline-none min-[600px]:items-center min-[600px]:py-10 relative overflow-hidden font-sans text-foreground";
const CARD = "flex w-full max-w-[420px] flex-col items-center rounded-none px-0 pb-8 text-center min-[600px]:rounded-[24px] min-[600px]:px-10 min-[600px]:pt-11 min-[600px]:pb-8 min-[600px]:shadow-[0_0_0_1px_var(--border),0_16px_48px_rgba(26,29,35,0.08)] bg-white relative z-10";
const BTN_PRIMARY = "flex h-12 w-full items-center justify-center gap-2.5 rounded-[14px] bg-[var(--google-btn-bg)] shadow-[inset_0_0_0_1px_var(--google-btn-edge)] px-4 text-sm font-medium text-[var(--google-btn-text)] hover:bg-[var(--google-btn-bg-hover)] active:bg-[var(--google-btn-bg-active)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-[3px] disabled:opacity-70 disabled:cursor-not-allowed";
const BTN_OUTLINE = "flex h-12 w-full items-center justify-center gap-2.5 rounded-[14px] border border-border bg-white px-4 text-sm font-medium text-foreground hover:bg-background active:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-[3px] disabled:opacity-70 disabled:cursor-not-allowed";

const C = { fg: "#1A1D23", sub: "#5F6671", err: "#B91C1C", border: "#EAEDF1" } as const;

interface KnownAccount {
  name: string;
  email: string;
  avatar?: string;
}

function checkIsInAppBrowser(): boolean {
  if (typeof window === "undefined" || !window.navigator) return false;
  const ua = window.navigator.userAgent || "";
  // Nhận diện trình duyệt nhúng trong các ứng dụng chat, mạng xã hội
  return /FBAN|FBAV|Instagram|Line|MicroMessenger|Zalo|Snapchat|ByteDance|TikTok|Teams|GSA\//i.test(ua);
}

function LoginSkeleton() {
  return (
    <main id="main-content" tabIndex={-1} aria-label="Đang tải" aria-busy="true" className={PAGE}>
      <div className={CARD}>
        <div className="size-14 min-[600px]:size-16 rounded-full bg-muted" />
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
      <a href="mailto:hotro@cdktcnqn.edu.vn" className="underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ color: C.fg }}>hotro@cdktcnqn.edu.vn</a>
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
        <a href="mailto:hotro@cdktcnqn.edu.vn" className="underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ color: C.fg }}>hotro@cdktcnqn.edu.vn</a>
      </div>
      <div className="absolute right-8 bottom-[52px] hidden min-[600px]:block text-[13px] z-10" style={{ color: C.sub }}>
        Gặp sự cố?{" "}
        <a href="mailto:hotro@cdktcnqn.edu.vn" className="underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ color: C.fg }}>hotro@cdktcnqn.edu.vn</a>
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
  const [lastUser, setLastUser] = React.useState<KnownAccount | null>(null);
  const [knownAccounts, setKnownAccounts] = React.useState<KnownAccount[]>([]);
  const [chooseOther, setChooseOther] = React.useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = React.useState(false);
  const [hasSubmittedRequest, setHasSubmittedRequest] = React.useState(false);
  const [isQuickLogging, setIsQuickLogging] = React.useState(false);
  const [isRetryingAtPlace, setIsRetryingAtPlace] = React.useState(false);

  const hasStartedGoogleRef = React.useRef(false);
  const isRedirectingRef = React.useRef(false);
  const noticeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setIsInApp(checkIsInAppBrowser());
    document.documentElement.classList.add("bg-white");
    document.body.classList.add("bg-white");
    try {
      const stored = localStorage.getItem("qcet_last_login_user");
      if (stored) {
        const p = JSON.parse(stored);
        if (p?.name && p?.email) {
          if (!p.avatar) {
            try {
              const active = localStorage.getItem("qcet_active_user");
              if (active) { const a = JSON.parse(active); if (a?.avatar) p.avatar = a.avatar; }
            } catch { /* */ }
          }
          setLastUser(p);
        }
      }

      const storedList = localStorage.getItem("qcet_known_accounts");
      if (storedList) {
        const list = JSON.parse(storedList);
        if (Array.isArray(list) && list.length > 0) {
          setKnownAccounts(list);
        }
      }
    } catch { /* */ }
    return () => { document.documentElement.classList.remove("bg-white"); document.body.classList.remove("bg-white"); };
  }, []);

  const targetUrl = React.useMemo(() => sanitizeRedirectUrl(
    searchParams.get("returnTo") || searchParams.get("redirect") || searchParams.get("callbackUrl")
  ), [searchParams]);

  const deepLinkLabel = React.useMemo(() => {
    const raw = searchParams.get("returnTo") || searchParams.get("redirect") || "";
    const title = searchParams.get("title");
    if (title) return title;
    if (raw.startsWith("/tasks/") && raw !== "/tasks") {
      return "Rà soát hồ sơ xét tuyển";
    }
    return null;
  }, [searchParams]);

  const promptParam = searchParams.get("prompt");
  const isSharedMachine = promptParam === "select_account" || searchParams.get("shared") === "1";

  const errorParam = searchParams.get("error");
  const emailParam = searchParams.get("email");
  const oauthError = React.useMemo(() => resolveOAuthError(errorParam, emailParam), [errorParam, emailParam]);
  const fromLogout = searchParams.get("reason") === "logout";
  const fromExpired = searchParams.get("reason") === "expired" || oauthError?.code === "session_expired";
  const draftName = searchParams.get("draft") || (fromExpired ? "Báo cáo tuyển sinh" : null);

  // Cập nhật document.title: thêm tiền tố "Lỗi:" khi có lỗi
  React.useEffect(() => {
    const hasError = Boolean(errorMessage || (oauthError && oauthError.code !== "oauth_cancelled"));
    if (hasError) {
      document.title = "Lỗi: Đăng nhập · QCET E-Office";
      noticeRef.current?.focus();
    } else {
      document.title = "Đăng nhập · QCET E-Office";
    }
  }, [errorMessage, oauthError]);

  React.useEffect(() => {
    if (!isLoading && isAuthenticated && user && !isRedirectingRef.current) {
      isRedirectingRef.current = true;
      // Lưu thông tin người dùng vào danh sách đã từng đăng nhập
      try {
        const u = { name: user.name || "", email: user.email || "", avatar: user.avatar };
        if (u.name && u.email) {
          localStorage.setItem("qcet_last_login_user", JSON.stringify(u));
          const existingListRaw = localStorage.getItem("qcet_known_accounts");
          let list: KnownAccount[] = existingListRaw ? JSON.parse(existingListRaw) : [];
          if (!Array.isArray(list)) list = [];
          list = [u, ...list.filter((x) => x.email !== u.email)].slice(0, 5);
          localStorage.setItem("qcet_known_accounts", JSON.stringify(list));
        }
      } catch { /* */ }
      router.replace(targetUrl);
    }
  }, [isLoading, isAuthenticated, user, targetUrl, router]);

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated && searchParams.get("startGoogle") === "1" && !hasStartedGoogleRef.current) {
      hasStartedGoogleRef.current = true;
      const prompt = searchParams.get("prompt") || undefined;
      void signIn("google", { callbackUrl: targetUrl }, prompt ? { prompt } : undefined).catch(() => {
        hasStartedGoogleRef.current = false;
        setErrorMessage("Không thể kết nối đến máy chủ xác thực");
      });
    }
  }, [isLoading, isAuthenticated, searchParams, targetUrl]);

  const handleRequestAccess = React.useCallback(async () => {
    setIsSubmittingRequest(true);
    try {
      const email = emailParam || (lastUser ? lastUser.email : "");
      await fetch("/api/auth/request-access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || "unknown@cdktcnqn.edu.vn" }),
      });
      setHasSubmittedRequest(true);
    } catch { setHasSubmittedRequest(true); }
    finally { setIsSubmittingRequest(false); }
  }, [emailParam, lastUser]);

  const handleRetryAtPlace = React.useCallback(async () => {
    setErrorMessage(null);
    setIsRetryingAtPlace(true);
    try {
      await signIn("google", { callbackUrl: targetUrl });
    } catch {
      setIsRetryingAtPlace(false);
      setErrorMessage("Không thể kết nối đến máy chủ xác thực");
    }
  }, [targetUrl]);

  if (shouldShowLoginSkeleton({ isLoading, isAuthenticated, user })) return <LoginSkeleton />;

  /* ═══════════════════════════════════════════════════════
     STATE: Trong ứng dụng chat (Board 1 · card 7)
     ═══════════════════════════════════════════════════════ */
  if (isInApp) {
    return (
      <main id="main-content" tabIndex={-1} aria-label="Mở bằng trình duyệt" className={PAGE}>
        <div className={CARD}>
          <Logo />
          <h1 className="mt-[22px] text-[28px] min-[600px]:text-2xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>Mở bằng trình duyệt</h1>
          <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>Google không cho đăng nhập trong ứng dụng này.</p>
          <div className="mt-7 w-full">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setHasCopiedLink(true);
                  setTimeout(() => setHasCopiedLink(false), 3000);
                } catch {}
              }}
              className={BTN_PRIMARY}
            >
              {hasCopiedLink ? (
                <>
                  <Check className="size-4 shrink-0" aria-hidden="true" />
                  <span>Đã sao chép ✓</span>
                </>
              ) : (
                <>
                  <Copy className="size-4 shrink-0" aria-hidden="true" />
                  <span>Sao chép liên kết</span>
                </>
              )}
            </button>
          </div>
          <p className="mt-3.5 text-xs text-center" style={{ color: C.sub }}>
            Bấm <strong style={{ color: C.fg }}>⋯</strong> rồi chọn Mở bằng trình duyệt.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-center" style={{ color: C.sub }}>QCET E-Office chỉ nhận tên và email của bạn.</p>
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
      <main id="main-content" tabIndex={-1} aria-label="Chưa được cấp quyền" className={PAGE}>
        <div className={CARD}>
          <Logo />
          <h1 className="mt-[22px] text-[28px] min-[600px]:text-2xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>Chưa được cấp quyền</h1>
          <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>
            {emailParam || "Tài khoản của bạn"} chưa có quyền dùng QCET E-Office.
          </p>
          <div className="mt-7 w-full flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={isSubmittingRequest}
              onClick={handleRequestAccess}
              className={BTN_PRIMARY}
            >
              <Send className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span>{isSubmittingRequest ? "Đang gửi..." : "Gửi yêu cầu cấp quyền"}</span>
            </button>
            <a
              href="/login?startGoogle=1&prompt=select_account"
              className="text-sm font-medium underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{ color: C.fg }}
            >
              Dùng tài khoản khác
            </a>
            <p className="text-xs text-center" style={{ color: C.sub }}>Yêu cầu gửi kèm tên và email của bạn.</p>
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
      <main id="main-content" tabIndex={-1} aria-label="Đã gửi yêu cầu" className={PAGE}>
        <div className={CARD}>
          <Logo />
          <h1 className="mt-[22px] text-[28px] min-[600px]:text-2xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>Đã gửi yêu cầu</h1>
          <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>Quản trị viên sẽ xem và báo qua email.</p>
          <div className="mt-7 w-full flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setHasSubmittedRequest(false);
                router.push("/login");
              }}
              className={BTN_OUTLINE}
            >
              Quay lại đăng nhập
            </button>
            <p className="text-xs text-center" style={{ color: C.sub }}>Bạn sẽ nhận email khi được cấp quyền.</p>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-center" style={{ color: C.sub }}>QCET E-Office chỉ nhận tên và email của bạn.</p>
          <SupportFooter />
        </div>
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════════
     STATE: Tài khoản bị khóa (Board 3 · card 3)
     ═══════════════════════════════════════════════════════ */
  if (oauthError?.code === "account_disabled") {
    return (
      <main id="main-content" tabIndex={-1} aria-label="Tài khoản đã bị khóa" className={PAGE}>
        <div className={CARD}>
          <Logo />
          <h1 className="mt-[22px] text-[28px] min-[600px]:text-2xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>Tài khoản đã bị khóa</h1>
          <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>Tài khoản này không còn dùng được QCET E-Office.</p>
          <div className="mt-7 w-full flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/login?startGoogle=1&prompt=select_account")}
              className={BTN_OUTLINE}
            >
              Dùng tài khoản khác
            </button>
            <p className="text-xs text-center" style={{ color: C.sub }}>
              Nếu đây là nhầm lẫn,{" "}
              <a href="mailto:hotro@cdktcnqn.edu.vn" className="underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ color: C.fg }}>liên hệ hỗ trợ</a>.
            </p>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-center" style={{ color: C.sub }}>QCET E-Office chỉ nhận tên và email của bạn.</p>
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
      <main id="main-content" tabIndex={-1} aria-label="Chưa kết nối được Google" className={PAGE}>
        <div className={CARD}>
          <Logo />
          <h1 className="mt-[22px] text-[28px] min-[600px]:text-2xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>Chưa kết nối được Google</h1>
          <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>Kiểm tra mạng rồi thử lại.</p>
          <div className="mt-7 w-full flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={isRetryingAtPlace}
              onClick={handleRetryAtPlace}
              className={BTN_OUTLINE}
            >
              {isRetryingAtPlace ? "Đang kết nối lại..." : "Thử lại"}
            </button>
            <p className="text-xs text-center" style={{ color: C.sub }}>
              Vẫn lỗi?{" "}
              <a href="mailto:hotro@cdktcnqn.edu.vn" className="underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ color: C.fg }}>liên hệ hỗ trợ</a>.
            </p>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-center" style={{ color: C.sub }}>QCET E-Office chỉ nhận tên và email của bạn.</p>
          <SupportFooter />
        </div>
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════════
     STATE: Máy dùng chung · prompt=select_account (Board 2 · card 4)
     ═══════════════════════════════════════════════════════ */
  if (isSharedMachine && !chooseOther && !oauthError) {
    const accountsToShow = knownAccounts.length > 0 ? knownAccounts : (lastUser ? [lastUser] : []);
    return (
      <main id="main-content" tabIndex={-1} aria-label="Chọn tài khoản" className={PAGE}>
        <div className={CARD}>
          <Logo />
          <h1 className="mt-[22px] text-[28px] min-[600px]:text-2xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>Chọn tài khoản</h1>
          <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>Luôn hỏi trước khi vào, vì đây là máy dùng chung.</p>

          <div className="mt-6 w-full flex flex-col gap-2">
            {accountsToShow.map((acc, idx) => {
              const initial = acc.name.trim().charAt(0).toUpperCase() || "A";
              const bgColors = ["#B9C7D6", "#D6C7B9", "#C2D2BE", "#CDBFD6"];
              const bgColor = bgColors[idx % bgColors.length];
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setIsQuickLogging(true);
                    signIn("google", { callbackUrl: targetUrl }, { login_hint: acc.email }).catch(() => setIsQuickLogging(false));
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-muted p-3 text-left transition-all duration-150 active:scale-[0.98] hover:bg-bg-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {acc.avatar ? (
                    <img src={acc.avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-foreground" style={{ background: bgColor }}>
                      {initial}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold leading-5 text-foreground">{acc.name}</div>
                    <div className="truncate text-xs leading-[18px] text-muted-foreground">{acc.email}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 w-full flex flex-col items-center">
            <button
              type="button"
              onClick={() => {
                setChooseOther(true);
                router.push("/login?startGoogle=1&prompt=select_account");
              }}
              className="text-[13.5px] font-medium underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary h-10 flex items-center"
              style={{ color: C.fg }}
            >
              Dùng tài khoản khác
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-center" style={{ color: C.sub }}>QCET E-Office chỉ nhận tên và email của bạn.</p>
        </div>
        <CampusChrome />
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════════
     STATE: Đã đăng nhập trước đó (Board 1 · card 5) — "Chào mừng quay lại"
     ═══════════════════════════════════════════════════════ */
  if (lastUser && !chooseOther && !oauthError && !fromLogout && !fromExpired) {
    const initial = lastUser.name.trim().charAt(0).toUpperCase() || "A";
    const handleQuickLogin = () => {
      setIsQuickLogging(true);
      signIn("google", { callbackUrl: targetUrl }, { login_hint: lastUser.email, prompt: "none" }).catch(() => setIsQuickLogging(false));
    };

    return (
      <main id="main-content" tabIndex={-1} aria-label="Đăng nhập QCET E-Office" className={PAGE}>
        <div className={CARD}>
          <Logo />
          <h1 className="mt-[22px] text-[28px] min-[600px]:text-2xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>Đăng nhập</h1>
          <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>Chào mừng quay lại</p>

          <button
            type="button"
            disabled={isQuickLogging}
            onClick={handleQuickLogin}
            className="group mt-6 flex w-full items-center gap-3 rounded-2xl border border-border bg-white p-3 text-left shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all duration-150 active:scale-[0.98] hover:border-[var(--gray-7)] hover:shadow-[0_2px_8px_rgba(16,24,40,0.08)] cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {lastUser.avatar ? (
              <img src={lastUser.avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-foreground bg-[var(--avatar-initial-bg)]">
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-5" style={{ color: C.fg }}>{lastUser.name}</div>
              <div className="truncate text-xs leading-[18px]" style={{ color: C.sub }}>{lastUser.email}</div>
            </div>
            {isQuickLogging ? (
              <Loader2 className="size-4 shrink-0 animate-spin" strokeWidth={1.5} style={{ color: C.sub }} aria-hidden="true" />
            ) : (
              <ArrowRight className="size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.5} style={{ color: C.sub }} aria-hidden="true" />
            )}
          </button>

          <div className="mt-3.5 w-full flex flex-col items-center">
            <button
              type="button"
              onClick={() => setChooseOther(true)}
              className="text-sm font-medium underline underline-offset-[3px] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary h-10 flex items-center"
              style={{ color: C.fg }}
            >
              Dùng tài khoản khác
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-center" style={{ color: C.sub }}>QCET E-Office chỉ nhận tên và email của bạn.</p>
        </div>
        <CampusChrome />
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════════
     DEFAULT: Đăng nhập (Board 1 · card 1 + inline variants)
     Bao gồm: Mặc định, Sai tên miền, Vào từ liên kết, Phiên hết hạn, Đã đăng xuất
     ═══════════════════════════════════════════════════════ */
  let title = "Đăng nhập";
  let subtitle: React.ReactNode = "Dùng tài khoản Google của nhà trường";
  if (fromExpired) {
    title = "Phiên đã hết hạn";
    subtitle = "Đăng nhập lại để tiếp tục.";
  } else if (fromLogout) {
    title = "Đã đăng xuất";
    subtitle = "Hẹn gặp lại.";
  }

  let messageNode: React.ReactNode = <span style={{ color: C.sub }}>@cdktcnqn.edu.vn</span>;
  if (oauthError?.code === "domain_not_allowed") {
    messageNode = (
      <span role="alert" style={{ color: C.err }}>
        Tài khoản này không thuộc @cdktcnqn.edu.vn.<br />
        <a href="/login?startGoogle=1&prompt=select_account" className="underline underline-offset-[3px]" style={{ color: C.err }}>
          Chọn tài khoản khác
        </a>
      </span>
    );
  } else if (fromLogout) {
    messageNode = <span style={{ color: C.sub }}>Đang dùng máy chung? Hãy đóng cả trình duyệt.</span>;
  } else if (fromExpired) {
    messageNode = draftName
      ? <span style={{ color: C.sub }}>Bản nháp &ldquo;{draftName}&rdquo; đã được lưu.</span>
      : <span style={{ color: C.sub }}>@cdktcnqn.edu.vn</span>;
  }

  return (
    <main id="main-content" tabIndex={-1} aria-label="Trang đăng nhập QCET E-Office" className={PAGE}>
      <div className={CARD}>
        <Logo />
        <h1 className="mt-[22px] text-[28px] min-[600px]:text-2xl font-semibold tracking-[-0.012em]" style={{ color: C.fg }}>{title}</h1>
        <p className="mt-2 min-[600px]:mt-1.5 text-[15px] min-[600px]:text-sm" style={{ color: C.sub }}>{subtitle}</p>

        {/* Khối Vào từ liên kết (Board 1 · card 8) */}
        {deepLinkLabel && !fromExpired && !fromLogout && (
          <div className="mt-5 w-full rounded-[14px] bg-muted p-3 text-center text-[13.5px] leading-relaxed text-foreground">
            Đăng nhập để mở nhiệm vụ<br />
            <span className="font-semibold">{deepLinkLabel}</span>
          </div>
        )}

        <div className="mt-7 w-full">
          <GoogleLoginButton
            returnTo={targetUrl}
            prompt={chooseOther ? "select_account" : undefined}
            onError={(msg) => setErrorMessage(msg)}
            onSuccess={(url) => { window.location.href = url; }}
          />
        </div>

        <div
          ref={noticeRef}
          tabIndex={-1}
          className="mt-3.5 min-h-11 w-full text-xs text-center flex items-center justify-center outline-none"
          aria-live="polite"
          aria-atomic="true"
        >
          {messageNode}
        </div>

        <p className="mt-2 text-xs leading-relaxed text-center" style={{ color: C.sub }}>QCET E-Office chỉ nhận tên và email của bạn.</p>
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
