"use client";

import * as React from "react";
import {
  ShieldAlert,
  X,
  Database,
  ArrowRight,
  ExternalLink,
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
  onSuccess?: () => void;
  className?: string;
}

export function GoogleLoginButton({ className }: GoogleLoginButtonProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const handleClick = () => {
    if (!googleClientId) {
      setIsModalOpen(true);
      return;
    }

    // When GOOGLE_CLIENT_ID is configured, redirect to Google OAuth
    const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/api/auth/callback/google` : "";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=consent`;

    if (typeof window !== "undefined") {
      window.location.href = authUrl;
    }
  };

  return (
    <>
      {/* Google Login Trigger Button */}
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "group relative flex w-full items-center justify-center gap-3 rounded-xl border border-border/80 bg-background px-4 py-3 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-secondary/70 hover:border-primary/40 hover:shadow-card active:scale-[0.99] cursor-pointer",
          className
        )}
      >
        <GoogleIcon className="size-5 shrink-0 transition-transform group-hover:scale-105" />
        <span className="font-bold text-foreground">
          Đăng nhập với Google Workspace
        </span>
        <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-xs font-semibold text-blue-600 border border-blue-500/20">
          @cdktcnqn.edu.vn
        </span>
      </button>

      {/* Guidance Dialog when GOOGLE_CLIENT_ID is unconfigured */}
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
                  Thông báo xác thực Google Workspace
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cấu hình dịch vụ định danh liên kết trường
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-foreground">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-amber-900">
                <p className="font-semibold">
                  Hệ thống đang chạy CSDL PostgreSQL nội bộ. Để kích hoạt đăng nhập Google Workspace trường, vui lòng cấu hình GOOGLE_CLIENT_ID trong .env.local.
                </p>
              </div>

              <div className="rounded-xl border border-border/80 bg-secondary/30 p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Database className="size-4 text-primary shrink-0" strokeWidth={1.5} />
                  <span>Hướng dẫn đăng nhập hiện hành:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1 text-xs">
                  <li>
                    Sử dụng form đăng nhập email / mật khẩu bên dưới với các tài khoản nội bộ nhà trường.
                  </li>
                  <li>
                    Hoặc click trực tiếp các tài khoản kiểm thử hạt nhân (Ban Giám hiệu, Trưởng đơn vị, Chuyên viên) để truy cập nhanh.
                  </li>
                  <li>
                    Mật khẩu mặc định cho toàn bộ tài khoản nội bộ là: <span className="font-mono font-semibold text-foreground">Qcet@2026</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
              >
                <span>Đã hiểu, quay lại đăng nhập</span>
                <ArrowRight className="size-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
