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
  const [isMobile, setIsMobile] = React.useState(false);
  const currentStep = steps[currentIndex];

  // Đo đạc vị trí của target element và responsive viewport
  React.useEffect(() => {
    if (!isActive || !currentStep) return;

    const checkDevice = () => setIsMobile(window.innerWidth < 768);
    checkDevice();

    const updateRect = () => {
      const el =
        document.querySelector(currentStep.targetSelector) ||
        (currentStep.fallbackSelector ? document.querySelector(currentStep.fallbackSelector) : null);

      if (el) {
        const rect = el.getBoundingClientRect();
        // Cuộn phần tử vào giữa màn hình nếu cần
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    window.addEventListener("resize", checkDevice);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, { passive: true });

    return () => {
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

  const padding = 8;
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
            {targetRect && (
              <rect
                x={targetRect.x - padding}
                y={targetRect.y - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
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
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#qcet-spotlight-mask)"
          className="pointer-events-auto cursor-pointer"
          onClick={onClose}
        />
      </svg>

      {/* 2. Viền phát sáng xung quanh phần tử được chọn */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-lg pointer-events-none transition-all duration-300 ring-4 ring-primary/20 animate-pulse"
          style={{
            top: targetRect.y - padding,
            left: targetRect.x - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
          }}
        />
      )}

      {/* 3. Popover Tooltip (Desktop) hoặc Bottom Sheet (Mobile) */}
      <div
        className={`pointer-events-auto transition-all duration-300 ${
          isMobile
            ? "fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border rounded-t-2xl shadow-2xl z-50"
            : "absolute w-80 bg-card border border-border/80 rounded-2xl p-5 shadow-2xl z-50"
        }`}
        style={
          !isMobile && targetRect
            ? {
                top: Math.min(
                  targetRect.bottom + 16,
                  typeof window !== "undefined" ? window.innerHeight - 240 : 500
                ),
                left: clampTooltip(
                  targetRect.left,
                  320,
                  typeof window !== "undefined" ? window.innerWidth : 1024,
                  16
                ),
              }
            : undefined
        }
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              Bước {currentIndex + 1} / {steps.length}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng hướng dẫn"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 id="tour-step-title" className="text-sm font-bold text-foreground mb-1.5">
          {currentStep.title}
        </h3>
        <p id="tour-step-desc" className="text-xs text-muted-foreground leading-relaxed mb-4">
          {currentStep.description}
        </p>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="text-xs h-8 px-2.5"
          >
            <ArrowLeft className="w-3 h-3 mr-1" /> Trước
          </Button>

          <Button
            size="sm"
            onClick={onNext}
            className="text-xs h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          >
            {isLastStep ? "Hoàn thành" : "Tiếp theo"}
            {!isLastStep && <ArrowRight className="w-3 h-3 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
