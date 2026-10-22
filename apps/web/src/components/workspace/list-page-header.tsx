"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { MobileMenuButton } from "@/components/layout/mobile-menu-button";
import { listToolbarPrimaryButtonClass } from "@/components/ui/list-toolbar";
import { Pressable } from "@/components/ui/pressable";
import { cn } from "@/lib/utils";

/**
 * Khung tiêu đề 44px tràn mép của trang danh sách trong khung một thẻ (Nhiệm vụ, Cuộc họp; khung do `app-shell` dựng, lề
 * ngang 16px điện thoại / 18px máy tính nên hàng này kéo âm đúng chừng ấy để chạm hai mép thẻ). Không kẻ đáy: header của Linear
 * tách khỏi nội dung bằng khoảng trắng (đo 22/10/2026). Tiêu đề trang bên trái, nút tạo mới bên phải; điện thoại có thêm nút
 * mở sidebar thay cho thanh trên cùng (như Linear).
 */
export function ListPageHeader({ title, action }: { title: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="-mx-4 flex h-[calc(44px+env(safe-area-inset-top,0px))] w-[calc(100%+32px)] min-w-0 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top,0px)] md:-mx-[18px] md:h-11 md:w-[calc(100%+36px)] md:px-[18px] md:pt-0">
      <div className="flex min-w-0 items-center gap-2">
        <MobileMenuButton className="-ml-1.5 md:hidden" />
        {title}
      </div>
      {action}
    </div>
  );
}

/** Tên trang trong `ListPageHeader`: chữ 13px đậm vừa như "Nhiệm vụ". */
export function ListPageTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn("text-compact font-medium text-foreground select-none", className)} {...props} />;
}

/** Nút tạo mới ở góc phải `ListPageHeader` ("+ Tạo việc"): nền trong, bo tròn; điện thoại chỉ còn dấu + (vùng bấm 32px). */
export function ListPageCreateButton({
  label,
  ariaLabel = label,
  onClick,
}: {
  label: string;
  /** Tên đầy đủ cho trình đọc màn hình và tooltip khi nhãn ngắn ("Tạo việc mới"). */
  ariaLabel?: string;
  onClick: () => void;
}) {
  return (
    <Pressable
      data-slot="list-toolbar-create"
      onClick={onClick}
      title={ariaLabel}
      aria-label={ariaLabel}
      className={cn(listToolbarPrimaryButtonClass, "rounded-full border-transparent bg-transparent shadow-none max-md:size-8 max-md:px-0")}
    >
      <Plus className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="hidden md:inline">{label}</span>
    </Pressable>
  );
}
