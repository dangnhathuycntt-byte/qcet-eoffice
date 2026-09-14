"use client";

import * as React from "react";
import { TourStepConfig } from "@/lib/onboarding-constants";
import { ArrowLeft, ArrowRight, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export function clampTooltip(left: number, width: number, viewportWidth: number, minMargin = 12): number {
  return Math.max(minMargin, Math.min(left, viewportWidth - width - minMargin));
}

export function calculateCutoutRect(
  rect: { x: number; y: number; width: number; height: number } | null | undefined,
  padding = 8
) {
  if (!rect) return null;
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

/** data-testid dùng trong test và automation */
export const SKIP_BUTTON_TESTID = "spotlight-tour-skip";

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

    // ResizeObserver bắt layout shift thay vì scroll listener (jank-prone)
    const el =
      document.querySelector(currentStep.targetSelector) ||
      (currentStep.fallbackSelector ? document.querySelector(currentStep.fallbackSelector) : null);
    const ro = new ResizeObserver(updateRect);
    if (el) ro.observe(el);

    window.addEventListener("resize", checkDevice);
    window.addEventListener("resize", updateRect);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("resize", checkDevice);
      window.removeEventListener("resize", updateRect);
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
      {/* 1. Lớp phủ SVG Mask — pointer-events-none để không chặn tương tác với nội dung phía sau */}
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
                style={{ rx: targetRadius }}
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Opacity thấp hơn (0.2) và không pointer-events-auto → nội dung phía sau vẫn tương tác được */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.20)"
          mask="url(#qcet-spotlight-mask)"
        />
      </svg>

      {/* 2. Viền phát sáng xung quanh phần tử được chọn (chỉ hiển thị khi tìm thấy phần tử) */}
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

      {/* 3. Nút "Bỏ qua tour" cố định góc trên phải — luôn hiển thị, dễ tìm */}
      <button
        type="button"
        data-testid={SKIP_BUTTON_TESTID}
        onClick={onClose}
        aria-label="Bỏ qua tour hướng dẫn"
        className="pointer-events-auto fixed top-4 right-4 z-[51] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/90 border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:bg-background hover:border-border shadow-sm backdrop-blur-sm transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
        Bỏ qua
      </button>

      {/* 4. Popover Tooltip (Desktop), Bottom Sheet (Mobile), hoặc Centered Fallback Card khi target không tìm thấy */}
      {!targetRect ? (
        <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none z-50">
          <div
            className="pointer-events-auto w-full max-w-md bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200"
            data-testid="spotlight-fallback-card"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                Bước {currentIndex + 1} / {steps.length}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng hướng dẫn"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 id="tour-step-title" className="text-base font-semibold text-foreground mb-1.5">
              {currentStep.title}
            </h3>
            <p id="tour-step-desc" className="text-sm text-muted-foreground leading-relaxed mb-3">
              {currentStep.description}
            </p>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 leading-relaxed mb-4">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Mục này có thể đang bị thu gọn hoặc nằm ở phân hệ làm việc khác. Bạn có thể bấm &quot;Tiếp tục&quot; để khám phá các khu vực tiếp theo.
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/50">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={onClose}
                className="text-xs h-8 sm:h-9 px-3 text-muted-foreground hover:text-foreground min-h-[36px]"
              >
                Để sau (Tự khám phá)
              </Button>
              <div className="flex items-center gap-2">
                {currentIndex > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={onPrev}
                    className="text-xs h-8 sm:h-9 px-3 min-h-[36px]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Trước
                  </Button>
                )}
                <Button
                  size="sm"
                  type="button"
                  onClick={onNext}
                  className="text-xs h-8 sm:h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 font-medium min-h-[36px]"
                >
                  {isLastStep ? "Hoàn tất" : "Tiếp tục"}
                  {!isLastStep && <ArrowRight className="w-3.5 h-3.5 ml-1" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`pointer-events-auto transition-all duration-300 ${
            isMobile
              ? "fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border rounded-t-2xl shadow-xl z-50 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
              : "absolute w-80 bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xl z-50"
          }`}
          style={
            !isMobile
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
              : undefined
          }
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20">
              Bước {currentIndex + 1} / {steps.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng hướng dẫn"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
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
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={onPrev}
                disabled={currentIndex === 0}
                className="text-xs h-8 sm:h-7 px-2.5 sm:px-2 text-muted-foreground min-h-[36px] sm:min-h-[28px] touch-manipulation"
              >
                <ArrowLeft className="w-3 h-3 mr-1" /> Trước
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={onClose}
                className="text-xs h-8 sm:h-7 px-2 text-muted-foreground hover:text-foreground min-h-[36px] sm:min-h-[28px] touch-manipulation"
              >
                Để sau
              </Button>
            </div>

            <Button
              size="sm"
              type="button"
              onClick={onNext}
              className="text-xs h-8 sm:h-7 px-4 sm:px-3 bg-primary text-primary-foreground hover:bg-primary/90 font-medium min-h-[36px] sm:min-h-[28px] touch-manipulation"
            >
              {isLastStep ? "Hoàn tất" : "Tiếp tục"}
              {!isLastStep && <ArrowRight className="w-3 h-3 ml-1" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
