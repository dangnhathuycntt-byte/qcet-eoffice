"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { Compass, Sparkles, X, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface WelcomeModalProps {
  isOpen: boolean;
  onStartTour: () => void;
  onDismiss: () => void;
}

export function WelcomeModal({ isOpen, onStartTour, onDismiss }: WelcomeModalProps) {
  const { user } = useAuth();
  const modalRef = React.useRef<HTMLDivElement>(null);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      aria-describedby="welcome-modal-desc"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden"
      >
        {/* Decorative corner glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Compass className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-1">
                <Sparkles className="w-3 h-3" /> QCET E-Office 2026
              </span>
              <h2 id="welcome-modal-title" className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Kính chào Thầy/Cô {user.name}!
              </h2>
            </div>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Đóng bảng chào mừng"
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div id="welcome-modal-desc" className="mt-4 space-y-3 text-sm text-muted-foreground">
          <p>
            Chào mừng Thầy/Cô gia nhập hệ thống Quản trị & Điều hành Văn phòng điện tử Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn.
          </p>
          <div className="p-3.5 rounded-xl bg-muted/50 border border-border/50 text-xs flex items-center gap-3 text-foreground font-medium">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <span>
              Vai trò ghi nhận: <strong className="text-primary">{user.roleLabel}</strong> ({user.department})
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Hệ thống đã chuẩn hóa các quy trình điều hành theo Nghị định 30/2020/NĐ-CP và cơ chế phân công nhiệm vụ DACUM.
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <Button
            variant="ghost"
            onClick={onDismiss}
            className="w-full sm:w-auto text-muted-foreground hover:text-foreground text-xs"
          >
            Bỏ qua, vào việc ngay
          </Button>
          <Button
            onClick={onStartTour}
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-medium text-xs flex items-center justify-center gap-2"
          >
            Khám phá trong 45 giây <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
