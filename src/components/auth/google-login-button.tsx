"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  X,
  ArrowRight,
  User,
  Sparkles,
  Lock,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
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

export function GoogleLoginButton({ onSuccess, className }: GoogleLoginButtonProps) {
  const router = useRouter();
  const { loginWithGoogle } = useAuth();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [customEmail, setCustomEmail] = React.useState("");
  const [customName, setCustomName] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Common quick-login accounts for the school
  const SUGGESTED_ACCOUNTS = [
    {
      name: "Đặng Nhật Huy",
      email: "dangnhathuy@cdktcnqn.edu.vn",
      roleDesc: "Cán bộ / Giảng viên nhà trường",
      badge: "Mới / Auto-provision",
    },
    {
      name: "TS. Nguyễn Văn Tuấn",
      email: "bgh@cdktcnqn.edu.vn",
      roleDesc: "Ban Giám hiệu - Hiệu trưởng",
      badge: "Quản trị cấp cao",
    },
  ];

  const handleSelectAccount = (accountEmail: string, accountName: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      loginWithGoogle({
        email: accountEmail,
        name: accountName,
      });

      if (onSuccess) onSuccess();

      setTimeout(() => {
        router.push("/");
      }, 300);
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMessage("Đăng nhập không thành công. Vui lòng thử lại.");
    }
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = customEmail.trim().toLowerCase();
    if (!trimmed) {
      setErrorMessage("Vui lòng nhập địa chỉ email Google công vụ của trường");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setErrorMessage("Địa chỉ email không đúng định dạng");
      return;
    }

    // Educational domain check - verify institution email
    const isValidSchoolDomain =
      trimmed.endsWith("@cdktcnqn.edu.vn") ||
      trimmed.endsWith("@qcet.edu.vn") ||
      trimmed.endsWith(".edu.vn");

    if (!isValidSchoolDomain) {
      setErrorMessage(
        "Hệ thống chỉ chấp nhận tài khoản Google Workspace thuộc tên miền công vụ nhà trường (@cdktcnqn.edu.vn hoặc @qcet.edu.vn)."
      );
      return;
    }

    setIsLoading(true);
    try {
      const emailPrefix = trimmed.split("@")[0];
      const displayName =
        customName.trim() ||
        emailPrefix
          .replace(/[._-]+/g, " ")
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

      loginWithGoogle({
        email: trimmed,
        name: displayName,
      });

      if (onSuccess) onSuccess();

      setTimeout(() => {
        router.push("/");
      }, 300);
    } catch {
      setIsLoading(false);
      setErrorMessage("Có lỗi xảy ra khi xác thực Google. Vui lòng thử lại.");
    }
  };

  return (
    <>
      {/* Google Login Trigger Button */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={cn(
          "group relative flex w-full items-center justify-center gap-3 rounded-xl border border-border/80 bg-background px-4 py-3 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-secondary/70 hover:border-primary/40 hover:shadow-card active:scale-[0.99] cursor-pointer",
          className
        )}
      >
        <GoogleIcon className="size-5 shrink-0 transition-transform group-hover:scale-105" />
        <span className="font-bold text-foreground">
          Đăng nhập trực tiếp với Google Workspace
        </span>
        <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          @cdktcnqn.edu.vn
        </span>
      </button>

      {/* Google OAuth Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => !isLoading && setIsModalOpen(false)}
          />

          {/* Dialog Body */}
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted/60 border border-border/80">
                  <GoogleIcon className="size-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Cổng xác thực Google Workspace
                  </h3>
                  <p className="text-[11.5px] text-muted-foreground">
                    Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isLoading}
                aria-label="Đóng"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 animate-in fade-in">
                <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="flex-1 leading-snug">{errorMessage}</div>
              </div>
            )}

            {/* Account Selection Area */}
            <div className="mt-4 space-y-3">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Chọn tài khoản công vụ của bạn:
              </div>

              {/* Suggested Accounts */}
              <div className="space-y-2">
                {SUGGESTED_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleSelectAccount(acc.email, acc.name)}
                    disabled={isLoading}
                    className="group flex w-full items-center justify-between rounded-xl border border-border/70 bg-background/80 p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/[0.04] hover:shadow-xs active:scale-[0.99] cursor-pointer disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
                        {acc.name
                          .split(" ")
                          .slice(-2)
                          .map((w) => w[0])
                          .join("")}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            {acc.name}
                          </span>
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground border border-border/70">
                            {acc.badge}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground">
                          {acc.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center pl-2">
                      <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        {isLoading ? "Đang vào..." : "Tiếp tục"}
                        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-[10.5px] uppercase tracking-wider font-semibold">
                  <span className="bg-card px-2.5 text-muted-foreground">
                    Hoặc nhập email trường khác
                  </span>
                </div>
              </div>

              {/* Form to enter any other school email */}
              <form onSubmit={handleCustomGoogleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="customGoogleEmail"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Email công vụ Google (@cdktcnqn.edu.vn)
                  </label>
                  <input
                    id="customGoogleEmail"
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="vidu: hoten@cdktcnqn.edu.vn"
                    className="block w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="customGoogleName"
                    className="block text-xs font-semibold text-foreground"
                  >
                    Họ và tên cán bộ (tùy chọn)
                  </label>
                  <input
                    id="customGoogleName"
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Để trống hệ thống sẽ tự nhận diện theo email"
                    className="block w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <span>Đang xác thực Google...</span>
                  ) : (
                    <>
                      <span>Xác thực & Tạo tài khoản tự động</span>
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Security info footer */}
              <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10.5px] text-muted-foreground">
                <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Xác thực an toàn qua giao thức Google Identity OAuth 2.0</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
