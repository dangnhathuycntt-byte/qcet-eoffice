"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, ChevronRight, FileText, CheckSquare, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { StandardDialog } from "@/components/ui/dialog";

const STORAGE_PREFIX = "qcet_fg_";

export interface FeatureGuideCardProps {
  /** Unique key per feature, e.g. "inbox-sign", "tasks-sort", "delegation-create" */
  id: string;
  /** Step indicator, e.g. "1/3", "2/3", "3/3" */
  step?: string;
  /** Button label in footer, e.g. "Tiếp", "Xong" */
  nextLabel?: string;
  /** Callback when user clicks the next/finish button */
  onNext?: () => void;
  /** Main headline */
  title: string;
  /** Supporting copy */
  description: string;
  /** Optional inline preview snippet */
  preview?: React.ReactNode;
  /** Which side of the anchor to place the card (desktop) */
  side?: "top" | "bottom" | "left" | "right";
  /** Horizontal alignment relative to anchor (desktop) */
  align?: "start" | "center" | "end";
  /** Delay before showing (ms) — let the page settle */
  delay?: number;
  /** Additional className on the outer wrapper */
  className?: string;
  children?: React.ReactNode;
}

export function isFeatureGuideDismissed(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${id}`) === "1";
  } catch {
    return false;
  }
}

export function dismissFeatureGuide(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, "1");
  } catch {
    // ignore
  }
}

export function resetFeatureGuide(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
  } catch {
    // ignore
  }
}

export function resetAllFeatureGuides(): void {
  if (typeof window === "undefined") return;
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX));
    for (const k of keys) {
      localStorage.removeItem(k);
    }
    window.dispatchEvent(new CustomEvent("qcet:open-feature-guide"));
  } catch {
    // ignore
  }
}

/* ─────────────────────────────────────────────────────────────
   3 PREVIEWS KHỚP THIẾT KẾ FeatureGuide.dc.html
   ───────────────────────────────────────────────────────────── */

export function InboundDocumentPreview() {
  return (
    <div className="w-[230px] rounded-[10px] bg-white p-3.5 shadow-[0_0_0_1px_var(--border)]">
      <div className="text-[11px] text-muted-foreground">Công văn đến · 214/CV-ĐT</div>
      <div className="mt-2 h-[7px] w-[90%] rounded bg-bg-hover" />
      <div className="mt-1.5 h-[7px] w-[70%] rounded bg-bg-hover" />
      <div className="mt-3 flex h-11 items-center rounded-lg border-[1.5px] border-dashed border-[var(--gray-7)] px-3">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
          <path d="M3 17c3-6 4-6 5-2s2 3 4-1 3-3 5 1" />
        </svg>
      </div>
    </div>
  );
}

export function TaskSortPreview() {
  return (
    <div className="w-[260px] overflow-hidden rounded-[10px] bg-white shadow-[0_0_0_1px_var(--border)]">
      <div className="flex h-8 items-center justify-between border-b border-muted px-3 text-xs text-foreground">
        <span className="truncate">Duyệt hồ sơ xét tuyển</span>
        <span className="text-destructive shrink-0 font-medium">Trễ 1 ngày</span>
      </div>
      <div className="flex h-8 items-center justify-between border-b border-muted px-3 text-xs text-foreground">
        <span className="truncate">Chuẩn bị họp giao ban</span>
        <span className="text-muted-foreground shrink-0">Hôm nay</span>
      </div>
      <div className="flex h-8 items-center justify-between px-3 text-xs text-foreground">
        <span className="truncate">Báo cáo tuần</span>
        <span className="text-muted-foreground shrink-0">3 ngày nữa</span>
      </div>
    </div>
  );
}

export function DelegationPreview() {
  return (
    <div className="flex items-center gap-3.5 rounded-[10px] bg-white px-5 py-4 shadow-[0_0_0_1px_var(--border)]">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--gray-5)] text-sm font-semibold text-foreground">
        A
      </span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
        <path d="M5 12h14m-5-5 5 5-5 5" />
      </svg>
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-bg-selected text-sm font-semibold text-foreground">
        B
      </span>
      <span className="ml-1.5 text-xs text-muted-foreground shrink-0">15–20/10</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   FEATURE GUIDE CARD COMPONENT
   ───────────────────────────────────────────────────────────── */

export function FeatureGuideCard({
  id,
  step = "1/3",
  nextLabel = "Tiếp",
  onNext,
  title,
  description,
  preview,
  side = "bottom",
  align = "start",
  delay = 500,
  className,
  children,
}: FeatureGuideCardProps) {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isFeatureGuideDismissed(id)) return;
    const timer = setTimeout(() => {
      setMounted(true);
      // Kích hoạt transition 180ms
      requestAnimationFrame(() => setVisible(true));
    }, delay);
    return () => clearTimeout(timer);
  }, [id, delay]);

  // Lắng nghe sự kiện mở lại từ menu Hướng dẫn
  React.useEffect(() => {
    const handleReopen = (e: CustomEvent<{ id?: string }>) => {
      if (!e.detail?.id || e.detail.id === id) {
        setMounted(true);
        requestAnimationFrame(() => setVisible(true));
      }
    };
    window.addEventListener("qcet:open-feature-guide", handleReopen as EventListener);
    return () => window.removeEventListener("qcet:open-feature-guide", handleReopen as EventListener);
  }, [id]);

  const handleDismiss = React.useCallback(() => {
    setVisible(false);
    dismissFeatureGuide(id);
    setTimeout(() => setMounted(false), 200);
  }, [id]);

  const handleNextClick = React.useCallback(() => {
    handleDismiss();
    onNext?.();
  }, [handleDismiss, onNext]);

  // Đóng khi nhấn Esc
  React.useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, handleDismiss]);

  // Đóng khi click ra ngoài thẻ
  React.useEffect(() => {
    if (!visible) return;
    const onClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        handleDismiss();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", onClick);
    }, 150);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onClick);
    };
  }, [visible, handleDismiss]);

  const desktopPositionClasses = cn(
    "hidden min-[600px]:block absolute z-40",
    side === "bottom" && "top-full mt-3",
    side === "top" && "bottom-full mb-3",
    side === "left" && "right-full mr-3 top-0",
    side === "right" && "left-full ml-3 top-0",
    (side === "top" || side === "bottom") && align === "start" && "left-0",
    (side === "top" || side === "bottom") && align === "center" && "left-1/2 -translate-x-1/2",
    (side === "top" || side === "bottom") && align === "end" && "right-0",
    (side === "left" || side === "right") && align === "start" && "top-0",
    (side === "left" || side === "right") && align === "center" && "top-1/2 -translate-y-1/2",
    (side === "left" || side === "right") && align === "end" && "bottom-0",
  );

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {children}

      {mounted && (
        <>
          {/* Card cho di động (< 600px): cố định ở đáy màn hình theo LoginMobile/FeatureGuide */}
          <div
            role="dialog"
            aria-modal="false"
            aria-label={title}
            className={cn(
              "block min-[600px]:hidden fixed bottom-2 left-2 right-2 z-50 pointer-events-auto",
              "transition-all duration-[180ms] ease-out motion-reduce:transition-opacity motion-reduce:transform-none",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
            )}
          >
            <div
              ref={cardRef}
              className="w-full max-w-[374px] mx-auto rounded-2xl bg-white shadow-[0_0_0_1px_var(--border),0_12px_32px_rgba(26,29,35,0.12)] overflow-hidden border border-border/40"
            >
              <div className="relative m-2 rounded-[10px] bg-muted h-[150px] flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleDismiss}
                  aria-label="Đóng hướng dẫn"
                  className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-black/5 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                >
                  <X className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                </button>
                {preview}
              </div>

              <div className="px-4 pt-2">
                <div className="text-base font-semibold leading-6 tracking-[-0.005em] text-foreground">
                  {title}
                </div>
                <div className="mt-1.5 text-sm leading-5 text-muted-foreground">
                  {description}
                </div>
              </div>

              <div className="flex h-[52px] items-center justify-between px-4 text-sm mt-1">
                <span className="flex items-center gap-2 text-muted-foreground select-none">
                  ‹ {step} ›
                </span>
                <button
                  type="button"
                  onClick={handleNextClick}
                  className="font-medium text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                >
                  {nextLabel}
                </button>
              </div>
            </div>
          </div>

          {/* Card cho máy tính bảng & máy tính (>= 600px): gắn vào element */}
          <div
            role="dialog"
            aria-modal="false"
            aria-label={title}
            className={cn(
              desktopPositionClasses,
              "w-[340px] pointer-events-auto",
              "transition-all duration-[180ms] ease-out motion-reduce:transition-opacity motion-reduce:transform-none",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
            )}
          >
            <div
              className="w-[340px] rounded-2xl bg-white shadow-[0_0_0_1px_var(--border),0_12px_32px_rgba(26,29,35,0.10)] overflow-hidden border border-border/40"
            >
              <div className="relative m-2 rounded-[10px] bg-muted h-[150px] flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleDismiss}
                  aria-label="Đóng hướng dẫn"
                  className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-black/5 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                >
                  <X className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                </button>
                {preview}
              </div>

              <div className="px-4 pt-2">
                <div className="text-base font-semibold leading-6 tracking-[-0.005em] text-foreground">
                  {title}
                </div>
                <div className="mt-1.5 text-sm leading-5 text-muted-foreground">
                  {description}
                </div>
              </div>

              <div className="flex h-[52px] items-center justify-between px-4 text-sm mt-1">
                <span className="flex items-center gap-2 text-muted-foreground select-none">
                  ‹ {step} ›
                </span>
                <button
                  type="button"
                  onClick={handleNextClick}
                  className="font-medium text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                >
                  {nextLabel}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   3 THẺ GẮN MÀN HÌNH CHUẨN THEO ĐẶC TẢ
   ───────────────────────────────────────────────────────────── */

/** Thẻ 1 · Văn bản đến: Ký ngay trên văn bản */
export function InboundDocumentFeatureGuide({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  return (
    <FeatureGuideCard
      id="inbox-sign"
      step="1/3"
      nextLabel="Tiếp"
      onNext={() => router.push("/tasks")}
      title="Ký ngay trên văn bản."
      description="Đọc, bút phê và ký trên cùng một màn hình, không cần in ra."
      preview={<InboundDocumentPreview />}
      side="bottom"
      align="start"
    >
      {children}
    </FeatureGuideCard>
  );
}

/** Thẻ 2 · Nhiệm vụ: Việc gần hạn nằm trên cùng */
export function TaskSortFeatureGuide({ children }: { children?: React.ReactNode }) {
  const router = useRouter();
  return (
    <FeatureGuideCard
      id="tasks-sort"
      step="2/3"
      nextLabel="Tiếp"
      onNext={() => router.push("/delegations")}
      title="Việc gần hạn nằm trên cùng."
      description="Việc trễ hạn và sắp đến hạn được xếp trước, không cần lọc."
      preview={<TaskSortPreview />}
      side="bottom"
      align="start"
    >
      {children}
    </FeatureGuideCard>
  );
}

/** Thẻ 3 · Ủy quyền: Vắng mặt? Ủy quyền cho người khác */
export function DelegationFeatureGuide({ children }: { children?: React.ReactNode }) {
  return (
    <FeatureGuideCard
      id="delegation-create"
      step="3/3"
      nextLabel="Xong"
      title="Vắng mặt? Ủy quyền cho người khác."
      description="Chọn người và thời gian. Họ xử lý thay bạn, bạn vẫn xem được."
      preview={<DelegationPreview />}
      side="bottom"
      align="end"
    >
      {children}
    </FeatureGuideCard>
  );
}

/* ─────────────────────────────────────────────────────────────
   MODAL TRỢ GIÚP → HƯỚNG DẪN ĐỂ XEM LẠI
   ───────────────────────────────────────────────────────────── */

export function HelpGuideModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("qcet:open-help-guide", handleOpen);
    return () => window.removeEventListener("qcet:open-help-guide", handleOpen);
  }, []);

  const handleSelectGuide = (guideId: string, targetPath: string) => {
    setIsOpen(false);
    resetFeatureGuide(guideId);
    router.push(targetPath);
    // Phát event mở thẻ sau khi điều hướng
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("qcet:open-feature-guide", { detail: { id: guideId } }));
    }, 400);
  };

  const handleResetAll = () => {
    setIsOpen(false);
    resetAllFeatureGuides();
    router.push("/documents");
  };

  return (
    <StandardDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      title="Hướng dẫn sử dụng"
      description="Chọn màn hình cần xem lại hướng dẫn tính năng."
      size="md"
    >
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={() => handleSelectGuide("inbox-sign", "/documents")}
          className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all hover:bg-muted/50 hover:border-border active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">1. Văn bản đến</div>
              <div className="text-xs text-muted-foreground mt-0.5">Ký ngay trên văn bản · Đọc, bút phê và ký cùng màn hình</div>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground/60 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => handleSelectGuide("tasks-sort", "/tasks")}
          className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all hover:bg-muted/50 hover:border-border active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
              <CheckSquare className="size-4" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">2. Nhiệm vụ</div>
              <div className="text-xs text-muted-foreground mt-0.5">Việc gần hạn nằm trên cùng · Tự động xếp việc khẩn cấp</div>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground/60 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => handleSelectGuide("delegation-create", "/delegations")}
          className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all hover:bg-muted/50 hover:border-border active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Shield className="size-4" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">3. Ủy quyền</div>
              <div className="text-xs text-muted-foreground mt-0.5">Vắng mặt? Ủy quyền cho người khác · Chọn người và thời gian</div>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground/60 shrink-0" />
        </button>

        <div className="pt-3 border-t border-border/50 flex justify-end">
          <button
            type="button"
            onClick={handleResetAll}
            className="text-xs font-medium text-primary hover:underline cursor-pointer px-2 py-1"
          >
            Xem lại tất cả từ đầu
          </button>
        </div>
      </div>
    </StandardDialog>
  );
}
