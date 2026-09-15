"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { clientEnv } from "@/config/env.client";
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
  returnTo?: string;
  onError?: (errorMsg: string) => void;
  onSuccess?: (returnUrl: string) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            hd?: string;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
              locale?: string;
            }
          ) => void;
        };
      };
    };
  }
}

export function GoogleLoginButton({
  className,
  returnTo,
  onError,
  onSuccess,
}: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGisRendered, setIsGisRendered] = React.useState(false);
  const gisContainerRef = React.useRef<HTMLDivElement>(null);

  const googleClientId = clientEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // Handle GIS Credential response (ID Token)
  const handleCredentialResponse = React.useCallback(
    async (response: { credential: string }) => {
      if (!response.credential) return;
      setIsLoading(true);

      try {
        const res = await fetch("/api/auth/google/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credential: response.credential,
            returnTo,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          setIsLoading(false);
          onError?.(data.error || "Đăng nhập Google không thành công");
          return;
        }

        const target = data.returnTo || returnTo || "/tasks";
        if (onSuccess) {
          onSuccess(target);
        } else {
          window.location.href = target;
        }
      } catch {
        setIsLoading(false);
        onError?.("Không thể kết nối đến máy chủ xác thực");
      }
    },
    [returnTo, onError, onSuccess]
  );

  // Initialize Google Identity Services / FedCM
  React.useEffect(() => {
    if (!googleClientId || typeof window === "undefined") return;

    let isMounted = true;

    const initGIS = () => {
      if (!window.google?.accounts?.id || !gisContainerRef.current) return;

      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
          auto_select: false, // Do not enable automatic account selection per security requirement
          hd: "cdktcnqn.edu.vn",
          use_fedcm_for_prompt: true, // Google Identity Services / FedCM standard
        });

        if (gisContainerRef.current) {
          gisContainerRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(gisContainerRef.current, {
            theme: "outline",
            size: "large",
            type: "standard",
            text: "continue_with",
            shape: "rectangular",
            logo_alignment: "left",
            width: 360,
            locale: "vi",
          });
          if (isMounted) {
            setIsGisRendered(true);
          }
        }
      } catch {
        // Fallback to standard redirect button if GIS fails
      }
    };

    if (window.google?.accounts?.id) {
      initGIS();
    } else {
      const scriptId = "google-jssdk";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = initGIS;
        document.head.appendChild(script);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [googleClientId, handleCredentialResponse]);

  // Standard OAuth 2.0 fallback handler
  const handleStartOAuth = () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (returnTo && returnTo !== "/tasks" && returnTo !== "/") {
      params.set("returnTo", returnTo);
    }
    const qs = params.toString();
    window.location.href = `/api/auth/google${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className={cn("flex flex-col items-center justify-center w-full", className)}>
      {/* 1. Google Identity Services Container */}
      <div
        ref={gisContainerRef}
        className={cn("min-h-[44px] flex items-center justify-center", !isGisRendered && "hidden")}
        aria-hidden={!isGisRendered}
      />

      {/* 2. Accessible institutional button fallback */}
      {(!isGisRendered || isLoading) && (
        <button
          type="button"
          disabled={isLoading}
          onClick={handleStartOAuth}
          aria-label="Tiếp tục với Google (@cdktcnqn.edu.vn)"
          className="flex h-12 w-[340px] sm:w-[360px] max-w-full items-center justify-center gap-3 rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 shadow-xs hover:bg-neutral-50 active:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4.5 animate-spin text-primary" strokeWidth={1.5} />
              <span className="text-sm font-medium text-neutral-800">Đang chuyển hướng...</span>
            </>
          ) : (
            <>
              <GoogleIcon className="size-5 shrink-0" />
              <span className="text-sm font-medium text-neutral-800">Tiếp tục với Google</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
