"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { Building2, X, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface WelcomeModalProps {
  isOpen: boolean;
  onStartTour: () => void;
  onDismiss: () => void;
}

export function WelcomeModal({ isOpen, onStartTour, onDismiss }: WelcomeModalProps) {
  const { user } = useAuth();
  const modalRef = React.useRef<HTMLDivElement>(null);

  const displayName = React.useMemo(() => {
    if (!user?.name) return "";
    if (user.name.includes("@")) {
      const prefix = user.name.split("@")[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return user.name;
  }, [user?.name]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
      if (e.key === "Tab" && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onDismiss]);

  if (!isOpen || !user) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      aria-describedby="welcome-modal-desc"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-xl p-6 sm:p-7 overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border/60 mb-1">
                QCET E-Office
              </span>
              <h2 id="welcome-modal-title" className="text-lg font-semibold tracking-tight text-foreground">
                Kính chào Thầy/Cô {displayName}!
              </h2>
            </div>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Đóng bảng chào mừng"
            className="flex items-center justify-center min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div id="welcome-modal-desc" className="mt-4 space-y-3.5 text-xs text-muted-foreground">
          <p className="leading-relaxed">
            Hệ thống Quản lý & Điều hành tác nghiệp số trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn.
          </p>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-2.5 text-foreground">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs">
              Vai trò: <strong className="text-primary font-semibold">{user.roleLabel || user.role}</strong>
              {user.department && !user.roleLabel?.toLowerCase().includes(user.department.toLowerCase()) && (
                <span className="text-muted-foreground ml-1">· {user.department}</span>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="p-2.5 rounded-lg border border-border/50 bg-background/60 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Quy trình phân công & nghiệm thu</p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">Phân công rõ vai trò, nhiệm vụ và báo cáo sản phẩm.</p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-border/50 bg-background/60 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Nghị định 30/2020/NĐ-CP</p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">Quy chuẩn văn thư lưu trữ và xử lý tờ trình số hóa.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onDismiss}
            className="w-full sm:w-auto text-muted-foreground hover:text-foreground text-xs sm:text-sm min-h-[44px] px-4"
          >
            Vào bàn làm việc ngay
          </Button>
          {/* Hướng dẫn khởi đầu - Tiền thân: KHÁM PHÁ TRONG 45 GIÂY */}
          <Button
            onClick={onStartTour}
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm min-h-[44px] px-4 font-medium flex items-center justify-center gap-1.5 shadow-sm"
          >
            Xem hướng dẫn sử dụng <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
