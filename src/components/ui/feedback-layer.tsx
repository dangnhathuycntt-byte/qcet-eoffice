"use client";

import * as React from "react";
import { Toast } from "@base-ui/react/toast";
import { Toaster, toast as sonnerToast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
  AlertOctagon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type FeedbackVariant = "info" | "success" | "warning" | "error";

export interface InlineAlertBannerProps {
  variant?: FeedbackVariant;
  title?: string;
  children: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  className?: string;
  id?: string;
}

export interface FormValidationErrorItem {
  field?: string;
  message: string;
}

export interface FormValidationSummaryProps {
  title?: string;
  errors: (string | FormValidationErrorItem)[];
  onDismiss?: () => void;
  className?: string;
  id?: string;
}

export interface ToastItem {
  id: string;
  variant: FeedbackVariant;
  title?: string;
  message: string;
  durationMs?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface FeedbackContextValue {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, "id">) => string;
  dismissToast: (id: string) => void;
  notifySuccess: (message: string, title?: string) => string;
  notifyError: (message: string, title?: string) => string;
  notifyWarning: (message: string, title?: string) => string;
  notifyInfo: (message: string, title?: string) => string;
}

// ============================================================================
// 1. InlineAlertBanner (Inline Critical & Contextual Alerts)
// ============================================================================

const VARIANT_STYLES: Record<
  FeedbackVariant,
  {
    container: string;
    iconColor: string;
    titleColor: string;
    textColor: string;
    actionBtn: string;
  }
> = {
  info: {
    container: "bg-secondary text-foreground",
    iconColor: "text-primary",
    titleColor: "text-foreground font-semibold",
    textColor: "text-muted-foreground",
    actionBtn: "bg-primary hover:bg-primary-hover text-on-action",
  },
  success: {
    container: "bg-secondary text-foreground",
    iconColor: "text-foreground font-semibold",
    titleColor: "text-foreground font-semibold",
    textColor: "text-muted-foreground",
    actionBtn: "bg-primary hover:bg-primary-hover text-on-action",
  },
  warning: {
    container: "bg-secondary text-foreground",
    iconColor: "text-foreground font-semibold",
    titleColor: "text-foreground font-semibold",
    textColor: "text-muted-foreground",
    actionBtn: "bg-primary hover:bg-primary-hover text-on-action",
  },
  error: {
    container: "bg-danger-soft text-destructive",
    iconColor: "text-destructive",
    titleColor: "text-destructive font-semibold",
    textColor: "text-destructive",
    actionBtn: "bg-destructive text-white",
  },
};

function renderVariantIcon(variant: FeedbackVariant) {
  switch (variant) {
    case "success":
      return <CheckCircle2 className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />;
    case "warning":
      return <AlertTriangle className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />;
    case "error":
      return <AlertOctagon className="size-4 shrink-0 text-destructive" strokeWidth={1.5} />;
    case "info":
    default:
      return <Info className="size-4 shrink-0 text-primary" strokeWidth={1.5} />;
  }
}

export function InlineAlertBanner({
  variant = "info",
  title,
  children,
  action,
  onDismiss,
  className,
  id,
}: InlineAlertBannerProps) {
  const styles = VARIANT_STYLES[variant];
  const role = variant === "error" || variant === "warning" ? "alert" : "status";

  return (
    <div
      id={id}
      role={role}
      data-slot="inline-alert-banner"
      data-variant={variant}
      className={cn(
        "relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border-0 text-xs leading-relaxed transition-colors",
        styles.container,
        className
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <div className="mt-0.5">{renderVariantIcon(variant)}</div>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          {title && (
            <h4 className={cn("text-xs font-semibold tracking-tight", styles.titleColor)}>
              {title}
            </h4>
          )}
          <div className={cn("text-xs font-normal break-words", styles.textColor)}>
            {children}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={cn(
              "inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors min-h-[32px]",
              styles.actionBtn
            )}
          >
            {action.label}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Đóng thông báo"
            className="size-7 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 2. FormValidationSummary (Form Field Errors)
// ============================================================================

export function FormValidationSummary({
  title = "Vui lòng kiểm tra lại các thông tin sau:",
  errors,
  onDismiss,
  className,
  id,
}: FormValidationSummaryProps) {
  if (!errors || errors.length === 0) return null;

  return (
    <div
      id={id}
      role="alert"
      data-slot="form-validation-summary"
      className={cn(
        "rounded-xl border-0 bg-danger-soft p-4 text-xs text-destructive flex flex-col gap-2.5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2 font-semibold text-destructive text-xs">
          <XCircle className="size-4 text-destructive shrink-0" strokeWidth={1.5} />
          <span>{title}</span>
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-destructive text-white tabular-nums">
            {errors.length}
          </span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Đóng cảnh báo lỗi form"
            className="size-6 rounded-md inline-flex items-center justify-center text-destructive hover:bg-black/5 cursor-pointer transition-colors"
          >
            <X className="size-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>

      <ul className="list-disc list-inside flex flex-col gap-1 text-destructive text-xs pl-1">
        {errors.map((err, idx) => {
          const message = typeof err === "string" ? err : err.message;
          const field = typeof err === "object" ? err.field : undefined;
          return (
            <li key={idx} className="leading-relaxed">
              {field && <span className="font-semibold">{field}: </span>}
              <span>{message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================================
// 3. Toast — Base UI powered (Modern Top-Center Floating Island)
// ============================================================================

const toastManager = Toast.createToastManager();

const TOAST_VARIANT_CONFIG: Record<
  FeedbackVariant,
  {
    iconBg: string;
    iconColor: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }
> = {
  info: {
    iconBg: "bg-secondary",
    iconColor: "text-primary",
    icon: Info,
  },
  success: {
    iconBg: "bg-secondary",
    iconColor: "text-foreground",
    icon: CheckCircle2,
  },
  warning: {
    iconBg: "bg-secondary",
    iconColor: "text-foreground",
    icon: AlertTriangle,
  },
  error: {
    iconBg: "bg-danger-soft",
    iconColor: "text-destructive",
    icon: AlertOctagon,
  },
};

export interface FeedbackToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  rawToast?: any;
}

export function FeedbackToast({ toast, onDismiss: _onDismiss, rawToast }: FeedbackToastProps) {
  const config = TOAST_VARIANT_CONFIG[toast.variant] || TOAST_VARIANT_CONFIG.info;
  const IconComponent = config.icon;

  return (
    <Toast.Root
      toast={rawToast}
      className={cn(
        "group pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-2xl border-0 bg-card p-4 shadow-menu transition-opacity duration-150"
      )}
    >
      <div className={cn("size-6 rounded-full flex items-center justify-center shrink-0 mt-0.5", config.iconBg, config.iconColor)}>
        <IconComponent className="size-3.5" strokeWidth={1.5} />
      </div>

      <div className="min-w-0 flex-1 text-xs">
        {toast.title && (
          <Toast.Title className="font-semibold text-foreground text-xs leading-snug tracking-tight">
            {toast.title}
          </Toast.Title>
        )}
        <Toast.Description className="font-normal text-muted-foreground leading-relaxed line-clamp-3 break-words mt-0.5">
          {toast.message}
        </Toast.Description>
        {toast.action && (
          <div className="mt-2">
            <Toast.Action onClick={() => { toast.action?.onClick(); }}>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover transition-colors cursor-pointer"
              >
                {toast.action.label}
              </button>
            </Toast.Action>
          </div>
        )}
      </div>

      <Toast.Close
        aria-label="Đóng thông báo nổi"
        className="size-6 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0 -mr-1 -mt-0.5"
      >
        <X className="size-3.5" strokeWidth={1.5} />
      </Toast.Close>
    </Toast.Root>
  );
}

export function ToastContainer({
  toasts: _legacyToasts,
  onDismiss: _legacyDismiss,
  className: _className,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  className?: string;
}) {
  return null;
}

// ============================================================================
// 3b. Viewport renderer (must be inside Toast.Provider)
// ============================================================================

function ToastViewportRenderer({ dismissToast }: { dismissToast: (id: string) => void }) {
  const manager = Toast.useToastManager();
  return (
    <Toast.Viewport
      aria-label="Thông báo hệ thống"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none w-full max-w-[440px] px-4 sm:px-0"
    >
      {manager.toasts.map((t: any) => (
        <FeedbackToast
          key={t.id}
          toast={{ id: t.id, variant: t.variant || "info", title: t.title, message: t.message || t.description || "", action: t.action }}
          onDismiss={dismissToast}
          rawToast={t}
        />
      ))}
    </Toast.Viewport>
  );
}

// ============================================================================
// 4. Feedback Context & Provider — Powered by Sonner
// ============================================================================

const FeedbackContext = React.createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const dismissToast = React.useCallback((id: string) => {
    sonnerToast.dismiss(id);
    toastManager.close(id);
  }, []);

  const showToast = React.useCallback(
    (item: Omit<ToastItem, "id">): string => {
      const fn =
        item.variant === "success"
          ? sonnerToast.success
          : item.variant === "error"
          ? sonnerToast.error
          : item.variant === "warning"
          ? sonnerToast.warning
          : sonnerToast.info;

      const toastId = fn(item.title || item.message, {
        description: item.title ? item.message : undefined,
        duration: item.durationMs ?? 4000,
        action: item.action
          ? {
              label: item.action.label,
              onClick: item.action.onClick,
            }
          : undefined,
      });
      return String(toastId);
    },
    [],
  );

  const notifySuccess = React.useCallback(
    (m: string, t?: string) =>
      String(
        sonnerToast.success(t || m, {
          description: t ? m : undefined,
        })
      ),
    []
  );

  const notifyError = React.useCallback(
    (m: string, t?: string) =>
      String(
        sonnerToast.error(t || m, {
          description: t ? m : undefined,
        })
      ),
    []
  );

  const notifyWarning = React.useCallback(
    (m: string, t?: string) =>
      String(
        sonnerToast.warning(t || m, {
          description: t ? m : undefined,
        })
      ),
    []
  );

  const notifyInfo = React.useCallback(
    (m: string, t?: string) =>
      String(
        sonnerToast.info(t || m, {
          description: t ? m : undefined,
        })
      ),
    []
  );

  const contextValue = React.useMemo<FeedbackContextValue>(
    () => ({ toasts: [], showToast, dismissToast, notifySuccess, notifyError, notifyWarning, notifyInfo }),
    [showToast, dismissToast, notifySuccess, notifyError, notifyWarning, notifyInfo],
  );

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}
      <Toaster
        position="bottom-center"
        offset={16}
        /* Mobile: nằm trên thanh điều hướng dưới cố định (56px + safe area) */
        mobileOffset={{ bottom: "calc(56px + env(safe-area-inset-bottom, 0px) + 12px)", left: 16, right: 16 }}
        toastOptions={{
          className:
            "rounded-2xl border-0 bg-card text-foreground font-sans shadow-menu text-xs",
          style: {
            border: "none",
            "--normal-border": "transparent",
            "--normal-bg": "var(--card)",
            "--normal-text": "var(--foreground)",
          } as React.CSSProperties,
        }}
      />
    </FeedbackContext.Provider>
  );
}

export { sonnerToast as toast };

export function useFeedback(): FeedbackContextValue {
  const context = React.useContext(FeedbackContext);
  if (!context) {
    return {
      toasts: [], showToast: () => "", dismissToast: () => {},
      notifySuccess: () => "", notifyError: () => "", notifyWarning: () => "", notifyInfo: () => "",
    };
  }
  return context;
}
