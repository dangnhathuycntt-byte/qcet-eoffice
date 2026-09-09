"use client";

import * as React from "react";
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
    container: "bg-blue-50/90 border-blue-200/80 text-blue-950",
    iconColor: "text-blue-600",
    titleColor: "text-blue-900",
    textColor: "text-blue-800",
    actionBtn: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  success: {
    container: "bg-emerald-50/90 border-emerald-200/80 text-emerald-950",
    iconColor: "text-emerald-600",
    titleColor: "text-emerald-900",
    textColor: "text-emerald-800",
    actionBtn: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  warning: {
    container: "bg-amber-50/90 border-amber-200/80 text-amber-950",
    iconColor: "text-amber-600",
    titleColor: "text-amber-900",
    textColor: "text-amber-800",
    actionBtn: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  error: {
    container: "bg-rose-50/90 border-rose-200/80 text-rose-950",
    iconColor: "text-rose-600",
    titleColor: "text-rose-900",
    textColor: "text-rose-800",
    actionBtn: "bg-rose-600 hover:bg-rose-700 text-white",
  },
};

function renderVariantIcon(variant: FeedbackVariant) {
  switch (variant) {
    case "success":
      return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" strokeWidth={1.75} />;
    case "warning":
      return <AlertTriangle className="size-4 shrink-0 text-amber-600" strokeWidth={1.75} />;
    case "error":
      return <AlertOctagon className="size-4 shrink-0 text-rose-600" strokeWidth={1.75} />;
    case "info":
    default:
      return <Info className="size-4 shrink-0 text-blue-600" strokeWidth={1.75} />;
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
        "relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border text-xs leading-relaxed transition-all",
        styles.container,
        className
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <div className="mt-0.5">{renderVariantIcon(variant)}</div>
        <div className="space-y-0.5 min-w-0 flex-1">
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
              "inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-xs min-h-[32px]",
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
            className="size-7 rounded-lg inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X className="size-3.5" strokeWidth={1.75} />
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
        "rounded-xl border border-rose-200/90 bg-rose-50/90 p-4 text-xs text-rose-950 space-y-2.5 animate-in fade-in duration-150",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-rose-200/60 pb-2">
        <div className="flex items-center gap-2 font-semibold text-rose-900 text-xs">
          <XCircle className="size-4 text-rose-600 shrink-0" strokeWidth={1.75} />
          <span>{title}</span>
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-700 border border-rose-200">
            {errors.length}
          </span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Đóng cảnh báo lỗi form"
            className="size-6 rounded-md inline-flex items-center justify-center text-rose-600 hover:bg-rose-100/80 cursor-pointer transition-colors"
          >
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <ul className="list-disc list-inside space-y-1 text-rose-800 text-xs pl-1">
        {errors.map((err, idx) => {
          const message = typeof err === "string" ? err : err.message;
          const field = typeof err === "object" ? err.field : undefined;
          return (
            <li key={idx} className="leading-relaxed">
              {field && <span className="font-medium text-rose-900">{field}: </span>}
              <span>{message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================================
// 3. Feedback Toast & Container (Transient Notifications)
// ============================================================================

export interface FeedbackToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export function FeedbackToast({ toast, onDismiss }: FeedbackToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.durationMs ?? 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  const styles = VARIANT_STYLES[toast.variant];

  return (
    <div
      role="status"
      aria-live="polite"
      data-slot="feedback-toast"
      className={cn(
        "group pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-xl border p-3 shadow-lg transition-all animate-in slide-in-from-bottom-2 duration-200 min-h-[44px]",
        styles.container
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {renderVariantIcon(toast.variant)}
        <div className="min-w-0 flex-1 text-xs">
          {toast.title && (
            <div className={cn("font-semibold", styles.titleColor)}>
              {toast.title}
            </div>
          )}
          <div className={cn("font-normal truncate", styles.textColor)}>
            {toast.message}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className={cn(
              "px-2 py-1 rounded text-xs font-medium cursor-pointer transition-colors",
              styles.actionBtn
            )}
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Đóng thông báo nổi"
          className="size-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 cursor-pointer transition-colors"
        >
          <X className="size-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
  className,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  className?: string;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Thông báo hệ thống"
      className={cn(
        "fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full",
        className
      )}
    >
      {toasts.map((toast) => (
        <FeedbackToast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ============================================================================
// 4. Feedback Context & Provider
// ============================================================================

const FeedbackContext = React.createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = React.useCallback(
    (item: Omit<ToastItem, "id">): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { ...item, id }]);
      return id;
    },
    []
  );

  const notifySuccess = React.useCallback(
    (message: string, title?: string) =>
      showToast({ variant: "success", message, title }),
    [showToast]
  );

  const notifyError = React.useCallback(
    (message: string, title?: string) =>
      showToast({ variant: "error", message, title }),
    [showToast]
  );

  const notifyWarning = React.useCallback(
    (message: string, title?: string) =>
      showToast({ variant: "warning", message, title }),
    [showToast]
  );

  const notifyInfo = React.useCallback(
    (message: string, title?: string) =>
      showToast({ variant: "info", message, title }),
    [showToast]
  );

  const contextValue = React.useMemo<FeedbackContextValue>(
    () => ({
      toasts,
      showToast,
      dismissToast,
      notifySuccess,
      notifyError,
      notifyWarning,
      notifyInfo,
    }),
    [toasts, showToast, dismissToast, notifySuccess, notifyError, notifyWarning, notifyInfo]
  );

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const context = React.useContext(FeedbackContext);
  if (!context) {
    // Fallback no-op implementation when used outside provider
    return {
      toasts: [],
      showToast: () => "",
      dismissToast: () => {},
      notifySuccess: () => "",
      notifyError: () => "",
      notifyWarning: () => "",
      notifyInfo: () => "",
    };
  }
  return context;
}
