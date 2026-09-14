"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Wrench, X, Clock, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface MaintenanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  feature?: string;
  description?: string;
}

export function MaintenanceDialog({
  isOpen,
  onClose,
  title,
  feature,
  description,
}: MaintenanceDialogProps) {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      document.body.style.overflow = "hidden";
    } else {
      setVisible(false);
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle ESC key to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || (!isOpen && !visible)) return null;

  const featureKey = feature || "general";
  const desc =
    description ||
    "Tính năng này đang trong kế hoạch hoàn thiện và nâng cấp đồng bộ theo tiến trình Chuyển đổi số của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET - Version 2.4.3). Quý Thầy/Cô và Cán bộ vui lòng quay lại sau.";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="maintenance-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Body */}
      <div
        className={`relative w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-2xl transition-all duration-200 ease-out z-10 select-none ${
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2"
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
          aria-label="Đóng thông báo"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-start gap-4">
          <div className="size-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
            <Wrench className="size-6" strokeWidth={1.5} />
          </div>

          <div className="space-y-1 pr-6 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-xs"
              >
                <Clock className="size-3 mr-1 inline-block" />
                Đang bảo trì
              </Badge>
              <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                v2.4.3
              </Badge>
            </div>
            <h2
              id="maintenance-dialog-title"
              className="text-lg font-bold text-foreground tracking-tight"
            >
              {title}
            </h2>
          </div>
        </div>

        <p className="mt-4 text-xs md:text-sm text-muted-foreground leading-relaxed">
          {desc}
        </p>

        {/* Info Box */}
        <div className="mt-5 p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Mã hệ thống:</span>
            <span className="font-mono font-medium text-foreground">QCET-CDS-{featureKey}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Trạng thái:</span>
            <span className="text-amber-600 font-medium">
              Đang nâng cấp đồng bộ
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Đơn vị chủ quản:</span>
            <span className="text-foreground">Trường CĐ Kỹ thuật Công nghệ Quy Nhơn</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary shrink-0" />
            <span>An toàn dữ liệu</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Đã hiểu
            </Button>
            <Button
              variant="default"
              size="sm"
              asChild
              className="text-xs gap-1"
            >
              <Link
                href={`/maintenance?feature=${encodeURIComponent(
                  featureKey
                )}&title=${encodeURIComponent(title)}`}
                onClick={onClose}
              >
                <span>Xem chi tiết</span>
                <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
