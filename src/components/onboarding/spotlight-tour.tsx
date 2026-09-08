"use client";

import * as React from "react";
import { TourStepConfig } from "@/lib/onboarding-constants";
import { ArrowLeft, ArrowRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function clampTooltip(left: number, width: number, viewportWidth: number, minMargin = 12): number {
  return Math.max(minMargin, Math.min(left, viewportWidth - width - minMargin));
}

export function calculateCutoutRect(
  rect: { x: number; y: number; width: number; height: number },
  padding = 8
) {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

export interface SpotlightTourProps {
  isActive: boolean;
  steps: TourStepConfig[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function SpotlightTour({
  isActive,
  steps,
  currentIndex,
  onNext,
  onPrev,
  onClose,
}: SpotlightTourProps) {
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);
  const [targetRadius, setTargetRadius] = React.useState<number>(8);
  const [isMobile, setIsMobile] = React.useState(false);
  const currentStep = steps[currentIndex];

  // Đo đạc vị trí của target element và responsive viewport
  React.useEffect(() => {
    if (!isActive || !currentStep) return;

    const checkDevice = () => setIsMobile(window.innerWidth < 768);
    checkDevice();

    const updateRect = () => {
      let el =
        document.querySelector(currentStep.targetSelector) ||
        (currentStep.fallbackSelector ? document.querySelector(currentStep.fallbackSelector) : null);

      // Nếu không tìm thấy target và fallback của step, tự động fallback an toàn
      // để không bao giờ bị tình trạng màn hình đen tối hoàn toàn
      if (!el) {
        el =
          document.querySelector("#tour-create-task-btn") ||
          document.querySelector("#tour-tasks-landing") ||
          document.querySelector("#tour-scope-switcher") ||
          document.querySelector("#tour-topbar-search");
      }

      if (el) {
        const rect = el.getBoundingClientRect();
        // Cuộn phần tử vào giữa màn hình nếu cần
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        setTargetRect(el.getBoundingClientRect());

        // Đo chính xác góc bo của phần tử để viền spotlight bo tròn khớp 100%
        try {
          const cs = window.getComputedStyle(el);
          const r = parseFloat(cs.borderRadius);
          setTargetRadius(isNaN(r) ? 8 : r);
        } catch {
          setTargetRadius(8);
        }
      } else {
        setTargetRect(null);
        setTargetRadius(8);
      }
    };

    updateRect();
    // Chạy lại updateRect sau một khoảng ngắn đề phòng animation hoặc lazy-render
    const timer = setTimeout(updateRect, 100);

    window.addEventListener("resize", checkDevice);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", checkDevice);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
    };
  }, [isActive, currentStep]);

  // Phím tắt bàn phím
  React.useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, onClose, onNext, onPrev]);

  if (!isActive || !currentStep) return null;

  // Với card lớn có bo viền sâu, padding viền ôm sát (3px) thay vì nhảy ra xa
  const padding = targetRadius >= 14 ? 3 : 6;
  const isLastStep = currentIndex === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
      aria-describedby="tour-step-desc"
    >
      {/* 1. Lớp phủ SVG Mask */}
      <svg className="w-full h-full" aria-hidden="true">
        <defs>
          <mask id="qcet-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect ? (
              <rect
                x={targetRect.x - padding}
                y={targetRect.y - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="8"
                style={{ rx: targetRadius }}
                fill="black"
              />
            ) : (
              <rect
                x="5%"
                y="5%"
                width="90%"
                height="90%"
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.45)"
          mask="url(#qcet-spotlight-mask)"
          className="pointer-events-auto cursor-pointer"
          onClick={onClose}
        />
      </svg>

      {/* 2. Viền phát sáng xung quanh phần tử được chọn */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary pointer-events-none transition-all duration-300 ring-4 ring-primary/20"
          style={{
            top: targetRect.y - padding,
            left: targetRect.x - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            borderRadius: `${targetRadius + padding}px`,
          }}
        />
      )}

      {/* 3. Popover Tooltip (Desktop) hoặc Bottom Sheet (Mobile) */}
      <div
        className={`pointer-events-auto transition-all duration-300 ${
          isMobile
            ? "fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border rounded-t-2xl shadow-xl z-50 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            : "absolute w-80 bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xl z-50"
        }`}
        style={
          !isMobile
            ? targetRect
              ? {
                  top: Math.min(
                    targetRect.bottom + 12,
                    typeof window !== "undefined" ? window.innerHeight - 240 : 500
                  ),
                  left: clampTooltip(
                    targetRect.left,
                    320,
                    typeof window !== "undefined" ? window.innerWidth : 1024,
                    16
                  ),
                }
              : {
                  top: "40%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }
            : undefined
        }
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20">
            Bước {currentIndex + 1} / {steps.length}
          </span>
          <button
            onClick={onClose}
            aria-label="Đóng hướng dẫn"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 id="tour-step-title" className="text-sm font-semibold text-foreground mb-1">
          {currentStep.title}
        </h3>
        <p id="tour-step-desc" className="text-xs text-muted-foreground leading-relaxed mb-4">
          {currentStep.description}
        </p>

        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="text-xs h-8 sm:h-7 px-3 sm:px-2 text-muted-foreground min-h-[36px] sm:min-h-[28px]"
          >
            <ArrowLeft className="w-3 h-3 mr-1" /> Trước
          </Button>

          <Button
            size="sm"
            onClick={onNext}
            className="text-xs h-8 sm:h-7 px-4 sm:px-3 bg-primary text-primary-foreground hover:bg-primary/90 font-medium min-h-[36px] sm:min-h-[28px]"
          >
            {isLastStep ? "Hoàn tất" : "Tiếp tục"}
            {!isLastStep && <ArrowRight className="w-3 h-3 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
