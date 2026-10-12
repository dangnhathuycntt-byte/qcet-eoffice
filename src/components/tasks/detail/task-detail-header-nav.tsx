"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Link2, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTaskDetailUrl } from "@/lib/tasks/task-detail-navigation";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { useFeedback } from "@/components/ui/feedback-layer";

export interface TaskDetailHeaderNavProps {
  taskId: string;
  showInspector?: boolean;
  onToggleInspector?: () => void;
  isDrawerOpen?: boolean;
  onOpenProgressModal?: () => void;
  /** Nội dung đặt ở bên trái cùng hàng (ví dụ tab Tổng quan / Hoạt động) */
  leading?: React.ReactNode;
  className?: string;
}

export function TaskDetailHeaderNav({
  taskId,
  showInspector,
  onToggleInspector,
  isDrawerOpen = false,
  onOpenProgressModal,
  leading,
  className,
}: TaskDetailHeaderNavProps) {
  const feedback = useFeedback();
  const router = useRouter();

  // Có lịch sử trong app thì quay lại đúng danh sách (giữ tab/bộ lọc); mở thẳng từ liên kết thì về /tasks
  const handleBack = React.useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/tasks");
  }, [router]);

  const handleCopyLink = React.useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(getTaskDetailUrl(taskId));
      feedback.notifySuccess("Đã sao chép liên kết");
    } catch {
      feedback.notifyError("Không sao chép được liên kết");
    }
  }, [taskId, feedback]);

  return (
    <header
      data-slot="task-detail-header-nav"
      className={cn(
        "h-10 max-md:h-[calc(44px+env(safe-area-inset-top,0px))] max-md:pt-[env(safe-area-inset-top,0px)] w-full flex items-center justify-between px-4 sm:px-6 border-b border-border/40 bg-background/95 backdrop-blur-md sticky top-0 z-30 select-none",
        className
      )}
    >
      {/* Bên trái: tab; breadcrumb do layout quản lý */}
      <div className="flex min-w-0 items-center">
        {/* Chỉ dưới md: topbar chung đã nhường chỗ cho header này */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="-ml-2 md:hidden"
          onClick={handleBack}
          aria-label="Quay lại danh sách nhiệm vụ"
        >
          <ChevronLeft />
        </Button>
        {leading}
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
        {/* Cập nhật tiến độ */}
        {onOpenProgressModal && (
          <Pressable
            onClick={onOpenProgressModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/50 bg-background hover:bg-muted/50 text-xs font-medium text-foreground transition-colors"
            title="Cập nhật tiến độ nhiệm vụ"
          >
            <span className="text-xs">Cập nhật tiến độ</span>
          </Pressable>
        )}

        {/* Copy link — subtle direct icon, visible on hover/focus and touch */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center justify-center size-8 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted/70 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
          title="Sao chép liên kết"
          aria-label="Sao chép liên kết"
        >
          <Link2 className="size-3.5" />
        </button>

        {/* Properties toggle — hidden when child drawer is open */}
        {onToggleInspector && !isDrawerOpen && (
          <button
            type="button"
            onClick={onToggleInspector}
            className={cn(
              "inline-flex items-center justify-center size-8 rounded-lg transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden",
              showInspector
                ? "bg-muted/80 text-foreground"
                : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/50"
            )}
            title={showInspector ? "Ẩn thuộc tính" : "Hiện thuộc tính"}
            aria-label={showInspector ? "Ẩn thuộc tính" : "Hiện thuộc tính"}
            aria-expanded={showInspector}
          >
            <PanelRight className="size-3.5" />
          </button>
        )}
      </div>
    </header>
  );
}
