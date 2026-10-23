"use client";

import * as React from "react";
import { Link2 } from "lucide-react";
import { IconSidebarPanelRight } from "@/components/layout/sidebar-rounded-icons";
import { MobileMenuButton } from "@/components/layout/mobile-menu-button";
import { cn } from "@/lib/utils";
import { getTaskDetailUrl } from "@/lib/tasks/task-detail-navigation";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { useFeedback } from "@/components/ui/feedback-layer";

export interface TaskDetailHeaderNavProps {
  taskId: string;
  /** Tên nhiệm vụ hiện trong đường dẫn ở hàng trên khi màn hẹp */
  taskTitle?: string;
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
  taskTitle,
  showInspector,
  onToggleInspector,
  isDrawerOpen = false,
  onOpenProgressModal,
  leading,
  className,
}: TaskDetailHeaderNavProps) {
  const feedback = useFeedback();

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
        "h-10 w-full flex items-center justify-between px-4 sm:px-6 border-b border-border/40 bg-background sticky top-0 z-30 select-none",
        // Màn hẹp (<1024px) kiểu Linear: hàng 1 nút mở menu + tên nhiệm vụ + liên kết, hàng 2 tab + tiến độ + nút thuộc tính
        "max-lg:grid max-lg:h-auto max-lg:grid-cols-[minmax(0,1fr)_auto_auto] max-lg:gap-x-1.5 max-lg:pt-[env(safe-area-inset-top,0px)]",
        className
      )}
    >
      {/* Bên trái: tab; breadcrumb do layout quản lý */}
      <div className="flex min-w-0 items-center max-lg:contents">
        {/* Chỉ dưới lg: topbar chung đã nhường chỗ, nút mở sidebar như trang danh sách (Linear: Menu) */}
        <div className="flex min-w-0 items-center lg:hidden max-lg:[grid-area:1/1/2/3]">
          <MobileMenuButton className="-ml-1.5" />
          {taskTitle && (
            <span className="ml-3 min-w-0 truncate text-compact font-medium text-foreground">{taskTitle}</span>
          )}
        </div>
        <div className="min-w-0 max-lg:[grid-area:2/1]">{leading}</div>
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1 sm:gap-1.5 shrink-0 max-lg:contents">
        {/* Cập nhật tiến độ */}
        {onOpenProgressModal && (
          <Pressable
            onClick={onOpenProgressModal}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/50 bg-background hover:bg-muted/50 text-xs font-medium text-foreground transition-colors max-lg:[grid-area:2/2] max-lg:whitespace-nowrap"
            title="Cập nhật tiến độ nhiệm vụ"
          >
            <span className="text-xs">Cập nhật tiến độ</span>
          </Pressable>
        )}

        {/* Copy link: nút icon, luôn hiện */}
        <Button
          variant="ghost"
          size="icon-md"
          onClick={handleCopyLink}
          className="max-lg:[grid-area:1/3]"
          title="Sao chép liên kết"
          aria-label="Sao chép liên kết"
        >
          <Link2 className="size-3.5" />
        </Button>

        {/* Properties toggle — hidden when child drawer is open */}
        {onToggleInspector && !isDrawerOpen && (
          <Button
            variant="ghost"
            size="icon-md"
            onClick={onToggleInspector}
            // Đang mở thể hiện bằng icon tô nửa phải, không thêm nền
            className={cn("max-lg:[grid-area:2/3]", showInspector && "text-foreground")}
            title={showInspector ? "Ẩn thuộc tính" : "Hiện thuộc tính"}
            aria-label={showInspector ? "Ẩn thuộc tính" : "Hiện thuộc tính"}
            aria-pressed={showInspector}
          >
            <IconSidebarPanelRight size={14} active={showInspector} />
          </Button>
        )}
      </div>
    </header>
  );
}
