"use client";

import * as React from "react";
import { Toast } from "@base-ui/react/toast";
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
      return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" strokeWidth={1.5} />;
    case "warning":
      return <AlertTriangle className="size-4 shrink-0 text-amber-600" strokeWidth={1.5} />;
    case "error":
      return <AlertOctagon className="size-4 shrink-0 text-rose-600" strokeWidth={1.5} />;
    case "info":
    default:
      return <Info className="size-4 shrink-0 text-blue-600" strokeWidth={1.5} />;
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
        "rounded-xl border border-rose-200/90 bg-rose-50/90 p-4 text-xs text-rose-950 space-y-2.5 animate-in fade-in duration-150",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-rose-200/60 pb-2">
        <div className="flex items-center gap-2 font-semibold text-rose-900 text-xs">
          <XCircle className="size-4 text-rose-600 shrink-0" strokeWidth={1.5} />
          <span>{title}</span>
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 border border-rose-200">
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
            <X className="size-3.5" strokeWidth={1.5} />
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
// 3. Toast — Base UI powered (Modern Top-Center Floating Island)
// ============================================================================

const toastManager = Toast.createToastManager();

const TOAST_VARIANT_CONFIG: Record<
  FeedbackVariant,
  {
    iconBg: string;
    iconColor: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    accentBorder: string;
  }
> = {
  info: {
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-600",
    icon: Info,
    accentBorder: "border-blue-500/20",
  },
  success: {
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600",
    icon: CheckCircle2,
    accentBorder: "border-emerald-500/20",
  },
  warning: {
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600",
    icon: AlertTriangle,
    accentBorder: "border-amber-500/20",
  },
  error: {
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-600",
    icon: AlertOctagon,
    accentBorder: "border-rose-500/25",
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
        "group pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-2xl border bg-card/95 backdrop-blur-md p-3.5 shadow-dropdown transition-all animate-in fade-in-0 slide-in-from-top-4 zoom-in-95 duration-200",
        config.accentBorder
      )}
    >
      <div className={cn("size-6 rounded-full flex items-center justify-center shrink-0 mt-0.5", config.iconBg, config.iconColor)}>
        <IconComponent className="size-3.5" strokeWidth={1.5} />
      </div>

      <div className="min-w-0 flex-1 text-xs">
        {toast.title && (
          <Toast.Title className="font-semibold text-foreground text-[13px] leading-snug tracking-tight">
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
                className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-2xs cursor-pointer"
              >
                {toast.action.label}
              </button>
            </Toast.Action>
          </div>
        )}
      </div>

      <Toast.Close
        aria-label="Đóng thông báo nổi"
        className="size-6 inline-flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0 -mr-1 -mt-0.5"
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
// 4. Feedback Context & Provider — Base UI Toast under the hood
// ============================================================================

const FeedbackContext = React.createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const dismissToast = React.useCallback((id: string) => {
    toastManager.close(id);
  }, []);

  const showToast = React.useCallback(
    (item: Omit<ToastItem, "id">): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const toast = { ...item, id };
      toastManager.add({ ...toast, timeout: item.durationMs ?? 4000 });
      return id;
    },
    [],
  );

  const notifySuccess = React.useCallback((m: string, t?: string) => showToast({ variant: "success", message: m, title: t }), [showToast]);
  const notifyError = React.useCallback((m: string, t?: string) => showToast({ variant: "error", message: m, title: t }), [showToast]);
  const notifyWarning = React.useCallback((m: string, t?: string) => showToast({ variant: "warning", message: m, title: t }), [showToast]);
  const notifyInfo = React.useCallback((m: string, t?: string) => showToast({ variant: "info", message: m, title: t }), [showToast]);

  const contextValue = React.useMemo<FeedbackContextValue>(
    () => ({ toasts: [], showToast, dismissToast, notifySuccess, notifyError, notifyWarning, notifyInfo }),
    [showToast, dismissToast, notifySuccess, notifyError, notifyWarning, notifyInfo],
  );

  return (
    <FeedbackContext.Provider value={contextValue}>
      <Toast.Provider toastManager={toastManager}>
        {children}
        <ToastViewportRenderer dismissToast={dismissToast} />
      </Toast.Provider>
    </FeedbackContext.Provider>
  );
}

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
