"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { MobileMenuButton } from "@/components/layout/mobile-menu-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Đầu khung 44px của trang một ngăn có ô tìm ngay trên hàng tiêu đề như Linear (Hộp thư, Ghi chú cá nhân): bấm kính lúp thì
 * ô tìm thay tên trang, không thêm hàng, không khung viền; Esc xóa chữ rồi mới đóng. Điện thoại có nút mở sidebar thay thanh
 * trên cùng và chừa vùng an toàn trên. `actions` (lọc, menu ⋯) đứng sau nút tìm.
 */
export function PaneSearchHeader({
  title,
  searchOpen,
  onSearchOpenChange,
  query,
  onQueryChange,
  searchLabel,
  searchPlaceholder,
  searchButtonTitle = "Tìm kiếm",
  inputRef,
  actions,
}: {
  title: string;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  /** Tên ô tìm và nút mở tìm cho trình đọc màn hình ("Tìm kiếm thông báo"). */
  searchLabel: string;
  searchPlaceholder: string;
  /** Tooltip nút mở tìm, kèm phím tắt nếu trang có ("Tìm kiếm (Ctrl/⌘ F)"). */
  searchButtonTitle?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  actions?: React.ReactNode;
}) {
  const close = () => {
    onQueryChange("");
    onSearchOpenChange(false);
  };
  return (
    <header className="flex h-11 shrink-0 items-center gap-1 px-4 max-md:h-[calc(44px+env(safe-area-inset-top,0px))] max-md:pt-[env(safe-area-inset-top,0px)]">
      <MobileMenuButton className="-ml-1.5 mr-1 md:hidden" />
      {searchOpen ? (
        <>
          <Search aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            variant="menu"
            type="text"
            value={query}
            maxLength={100}
            autoFocus
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              if (query) onQueryChange("");
              else onSearchOpenChange(false);
            }}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className="h-7 min-w-0 flex-1 px-1.5 text-compact sm:h-7 sm:text-compact"
          />
        </>
      ) : (
        <h1 className="truncate text-compact font-medium text-foreground">{title}</h1>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        {searchOpen ? (
          <Button variant="ghost" size="icon-xs" aria-label="Đóng tìm kiếm" title="Đóng tìm kiếm (Esc)" onClick={close}>
            <X />
          </Button>
        ) : (
          <Button variant="ghost" size="icon-xs" aria-label={searchLabel} title={searchButtonTitle} onClick={() => onSearchOpenChange(true)}>
            <Search />
          </Button>
        )}
        {actions}
      </div>
    </header>
  );
}
