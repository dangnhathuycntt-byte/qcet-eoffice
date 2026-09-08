"use client";

import * as React from "react";
import {
  ShieldAlert,
  X,
  Database,
  ArrowRight,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Official Google Multi-Color SVG Icon
export function GoogleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

interface GoogleLoginButtonProps {
  className?: string;
}

export function GoogleLoginButton({ className }: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const isDev = process.env.NODE_ENV === "development";

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3001";
  const callbackUrl = `${origin}/api/auth/callback/google`;

  const handleStartOAuth = () => {
    setIsLoading(true);
    if (typeof window !== "undefined") {
      window.location.href = "/api/auth/google";
    }
  };

  const handleClick = () => {
    if (isDev && !googleClientId) {
      setIsModalOpen(true);
      return;
    }
    handleStartOAuth();
  };

  const handleCopyCallback = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed or not supported in current environment
    }
  };

  return (
    <>
      {/* Google Login Trigger Button */}
      <button
        type="button"
        disabled={isLoading}
        onClick={handleClick}
        aria-label="Đăng nhập bằng email trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (@cdktcnqn.edu.vn)"
        className={cn(
          "relative flex h-12 w-full select-none items-center justify-center gap-3 rounded-xl border border-border/90 bg-card px-4 text-sm font-semibold text-foreground shadow-xs transition-colors hover:bg-secondary/70 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed",
          className
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-5 shrink-0 animate-spin text-primary" strokeWidth={1.5} />
            <span className="font-semibold text-foreground whitespace-nowrap">
              Đang chuyển hướng đăng nhập...
            </span>
          </>
        ) : (
          <>
            <GoogleIcon className="size-5 shrink-0" />
            <span className="font-semibold text-foreground whitespace-nowrap">
              Đăng nhập bằng Email trường
            </span>
          </>
        )}
      </button>

      {/* Guidance Dialog when GOOGLE_CLIENT_ID is unconfigured in development */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
          <div
            className="fixed inset-0"
            onClick={() => setIsModalOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-dialog-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              aria-label="Đóng thông báo"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>

            <div className="flex items-start gap-3.5 mb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <ShieldAlert className="size-5" strokeWidth={1.5} />
              </div>
              <div>
                <h3
                  id="google-dialog-title"
                  className="text-sm font-bold text-foreground"
                >
                  Cấu hình dịch vụ đăng nhập Google
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dịch vụ xác thực tài khoản tập trung dành cho Nhà trường
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-foreground">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-amber-900">
                <p className="font-semibold">
                  Môi trường phát triển chưa cấu hình NEXT_PUBLIC_GOOGLE_CLIENT_ID trong tệp .env.local.
                </p>
                <p className="mt-1 text-amber-800">
                  Vui lòng đăng ký OAuth 2.0 Client ID trên Google Cloud Console với Authorized redirect URI bên dưới:
                </p>
              </div>

              {/* Callback URL Box with Copy Button */}
              <div className="rounded-xl border border-border/80 bg-secondary/30 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Authorized redirect URI (Callback URL):</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
                  <code className="flex-1 font-mono text-xs text-foreground select-all break-all">
                    {callbackUrl}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyCallback}
                    className="flex items-center gap-1 shrink-0 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
                    title="Sao chép địa chỉ callback"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5 text-emerald-600" strokeWidth={1.5} />
                        <span className="text-emerald-600 font-semibold">Đã copy</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-border/80 bg-secondary/30 p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Database className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                  <span>Quy định tài khoản đăng nhập:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1 text-xs">
                  <li>
                    Đăng nhập bằng tài khoản email trường do Nhà trường quản lý.
                  </li>
                  <li>
                    Tài khoản cán bộ, giảng viên có đuôi @cdktcnqn.edu.vn được tự động phân quyền theo đơn vị công tác.
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  handleStartOAuth();
                }}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                <span>Vẫn thử tới /api/auth/google</span>
              </button>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
              >
                <span>Đã hiểu, đóng</span>
                <ArrowRight className="size-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
