"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { cn } from "@/lib/utils";

// Official Google Multi-Color SVG Icon
export function GoogleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z"
        fill="#4285F4"
      />
      <path
        d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.8 0-5.2-1.9-6-4.5H2.4v2.800A11 11 0 0 0 12 23z"
        fill="#34A853"
      />
      <path
        d="M6 14.100a6.600 6.600 0 0 1 0-4.200V7.100H2.400a11 11 0 0 0 0 9.800z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.400c1.600 0 3 .6 4.100 1.600l3.100-3.100A11 11 0 0 0 2.400 7.100L6 9.900c.8-2.600 3.200-4.500 6-4.500z"
        fill="#EA4335"
      />
    </svg>
  );
}

export interface GoogleLoginButtonProps {
  className?: string;
  returnTo?: string;
  prompt?: string;
  onError?: (errorMsg: string) => void;
  onSuccess?: (returnUrl: string) => void;
}

export function GoogleLoginButton({
  className,
  returnTo,
  prompt,
  onError,
  onSuccess,
}: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const isStartingRef = React.useRef(false);

  const handleStartOAuth = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setIsLoading(true);
    try {
      const target = returnTo && returnTo !== "/login" && returnTo !== "/" ? returnTo : "/tasks";
      const signInOptions: Record<string, string> = { callbackUrl: target };
      if (prompt) {
        signInOptions.prompt = prompt;
      }
      const result = (await signIn("google", signInOptions)) as any;
      if (result?.url && onSuccess) {
        onSuccess(result.url);
      }
    } catch {
      isStartingRef.current = false;
      setIsLoading(false);
      onError?.("Không thể kết nối đến máy chủ xác thực");
    }
  };

  return (
    <div className={cn("flex flex-col items-center justify-center w-full", className)}>
      <button
        type="button"
        disabled={isLoading}
        onClick={handleStartOAuth}
        aria-label={isLoading ? "Đang chuyển sang Google…" : "Đăng nhập bằng Google"}
        aria-busy={isLoading}
        className="flex h-[52px] min-[600px]:h-12 w-full items-center justify-center gap-2.5 rounded-[14px] shadow-[inset_0_0_0_1px_var(--google-border)] bg-[var(--google-background)] px-4 text-sm font-medium text-[var(--google-foreground)] hover:bg-[var(--google-hover)] active:bg-[var(--google-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--google-focus)] focus-visible:ring-offset-[3px] cursor-pointer disabled:cursor-not-allowed transition-colors duration-[var(--motion-duration-micro)] motion-reduce:transition-none"
      >
        {isLoading ? (
          <span role="status" className="inline-flex items-center gap-2.5">
            <svg className="size-5 animate-spin text-current" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" style={{ strokeWidth: 2.2 }} opacity="0.24" /><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" style={{ strokeWidth: 2.2 }} strokeLinecap="round" /></svg>
            <span className="text-sm font-medium text-current">Đang chuyển sang Google…</span>
          </span>
        ) : (
          <>
            <GoogleIcon className="size-5 shrink-0" />
            <span className="text-base min-[600px]:text-sm font-medium text-current">Đăng nhập bằng Google</span>
          </>
        )}
      </button>
    </div>
  );
}
