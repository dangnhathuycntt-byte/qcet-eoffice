"use client";

import * as React from "react";
import { Download, X, Smartphone, CheckCircle2 } from "lucide-react";
import { usePWAOnboardingCoordinator } from "@/lib/pwa/onboarding-coordinator";

export interface PWAInstallPromptProps {
  userId?: string | null;
  className?: string;
  onInstallSuccess?: () => void;
  onDismiss?: () => void;
}

/**
 * PWA Install Prompt - Coordinated Institutional Banner
 *
 * Requirements:
 * - Appears strictly when coordinator reaches INSTALL_ELIGIBLE stage.
 * - Zero emoji policy (0% emoji slop).
 * - Light-only institutional QCET styling (Zero dark-mode classes).
 * - Min-height 44px touch targets on all interactive controls.
 */
export function PWAInstallPrompt({
  userId,
  className = "",
  onInstallSuccess,
  onDismiss,
}: PWAInstallPromptProps) {
  const {
    canShowInstallPrompt,
    isIOS,
    promptInstall,
    snoozeInstall,
    recordInterruptionShown,
  } = usePWAOnboardingCoordinator(userId);

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [justInstalled, setJustInstalled] = React.useState(false);

  React.useEffect(() => {
    if (canShowInstallPrompt) {
      recordInterruptionShown("PWA_INSTALL");
    }
  }, [canShowInstallPrompt, recordInterruptionShown]);

  if (!canShowInstallPrompt && !justInstalled) {
    return null;
  }

  const handleInstall = async () => {
    setIsProcessing(true);
    try {
      const result = await promptInstall();
      if (result === "accepted") {
        setJustInstalled(true);
        onInstallSuccess?.();
        setTimeout(() => setJustInstalled(false), 3000);
      } else if (result === "ios_guided") {
        snoozeInstall();
        onDismiss?.();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = () => {
    snoozeInstall();
    onDismiss?.();
  };

  if (justInstalled) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-950 shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-200 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0">
            <CheckCircle2 size={20} strokeWidth={2} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-emerald-900">
              Cài đặt ứng dụng thành công
            </h4>
            <p className="text-xs text-emerald-700">
              QCET E-Office đã sẵn sàng trên màn hình chính của bạn.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside
      role="region"
      aria-label="Thông báo cài đặt ứng dụng QCET E-Office"
      className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-lg z-50 p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl ring-1 ring-slate-900/5 animate-in fade-in slide-in-from-bottom-4 duration-300 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
            {isIOS ? (
              <Smartphone size={20} strokeWidth={2} />
            ) : (
              <Download size={20} strokeWidth={2} />
            )}
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
              Ứng dụng PWA chính thức
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              Cài đặt QCET E-Office
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Cài đặt QCET E-Office trên thiết bị để truy cập nhanh, nhận thông báo công việc tức thì và làm việc ngay cả khi mất mạng.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          aria-label="Để sau và đóng"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={handleDismiss}
          className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center"
        >
          Để sau
        </button>
        <button
          type="button"
          onClick={handleInstall}
          disabled={isProcessing}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs sm:text-sm shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Download size={16} strokeWidth={2} />
          <span>{isProcessing ? "Đang xử lý..." : "Cài đặt ngay"}</span>
        </button>
      </div>
    </aside>
  );
}
