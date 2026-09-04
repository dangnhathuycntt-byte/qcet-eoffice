"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Briefcase,
  Calendar,
  Network,
  Bell,
  Sun,
  Moon,
  Building2,
  ChevronDown,
  Search,
  CheckCircle2,
  RefreshCw,
  Command,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const NAVIGATION_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Nhiệm vụ cấp Trường", icon: CheckSquare },
  { href: "/unit-tasks", label: "Công việc Đơn vị", icon: Briefcase },
  { href: "/calendar", label: "Lịch công tác", icon: Calendar },
  { href: "/org", label: "Cơ cấu tổ chức", icon: Network },
];

export function Navigation() {
  const pathname = usePathname();
  const { resolved, toggleTheme } = useTheme();
  const [isSyncing, setIsSyncing] = React.useState(false);

  // Trigger search focus across the page on ⌘K button click
  const triggerQuickSearch = () => {
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);
  };

  const simulateSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1200);
  };

  return (
    <header
      data-slot="twenty-topbar"
      className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/95 backdrop-blur-md"
    >
      {/* ========================================================================= */}
      {/* 1. Main Top Bar: Workspace | Quick Search | Sync & Profile               */}
      {/* ========================================================================= */}
      <div className="mx-auto flex h-13 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left: QCET Logo + Workspace Dropdown Pill */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
            aria-label="Về trang chủ QCET E-Office"
          >
            <span className="flex size-7.5 items-center justify-center rounded-lg bg-foreground text-background shadow-xs">
              <Building2 className="size-4" aria-hidden="true" />
            </span>
          </Link>

          {/* Workspace Switcher Pill */}
          <button
            type="button"
            className="group flex items-center gap-2 rounded-md border border-border/80 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-foreground transition-all hover:bg-secondary hover:border-border cursor-pointer"
            title="Không gian làm việc hiện tại"
          >
            <span className="font-semibold text-foreground">QCET E-Office</span>
            <span className="text-muted-foreground/60 font-light">/</span>
            <span className="font-medium text-foreground/80">Ban Giám hiệu</span>
            <ChevronDown className="size-3 text-muted-foreground transition-transform group-hover:translate-y-0.5" />
          </button>
        </div>

        {/* Center: Quick Search Command Trigger */}
        <div className="hidden flex-1 max-w-md md:flex justify-center">
          <button
            type="button"
            onClick={triggerQuickSearch}
            className="flex h-8 w-full max-w-xs items-center justify-between rounded-md border border-border/80 bg-secondary/40 px-3 text-xs text-muted-foreground transition-all hover:bg-secondary/80 hover:border-border hover:text-foreground cursor-pointer"
            aria-label="Tìm kiếm nhanh toàn hệ thống"
          >
            <div className="flex items-center gap-2">
              <Search className="size-3.5 text-muted-foreground" />
              <span>Tìm kiếm nhanh...</span>
            </div>
            <kbd className="pointer-events-none inline-flex h-4.5 items-center gap-0.5 rounded border border-border/80 bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-2xs">
              <Command className="size-2.5" />K
            </kbd>
          </button>
        </div>

        {/* Right: Live Notion Sync status | Notifications | Theme | User Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Notion Sync Status Indicator */}
          <button
            type="button"
            onClick={simulateSync}
            className="hidden items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-1 text-[11px] font-medium text-emerald-800 transition-colors hover:bg-emerald-100/70 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 sm:inline-flex cursor-pointer"
            title="Đồng bộ hóa trực tiếp với Notion Database QCET"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="size-3 animate-spin text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold">Đang đồng bộ...</span>
              </>
            ) : (
              <>
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                </span>
                <span className="font-semibold">Đã đồng bộ</span>
              </>
            )}
          </button>

          {/* Theme Switcher Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label="Chuyển đổi giao diện sáng/tối"
            className="size-8 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {resolved === "dark" ? (
              <Sun className="size-4 text-amber-400 transition-transform" />
            ) : (
              <Moon className="size-4 text-muted-foreground transition-transform" />
            )}
          </Button>

          {/* Notifications Bell */}
          <Link href="/notifications">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Xem thông báo"
              className="relative size-8 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Bell className="size-4" />
              <span className="absolute top-1.5 right-1.5 flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-primary"></span>
              </span>
            </Button>
          </Link>

          {/* User Avatar + Name */}
          <div className="flex items-center gap-2 pl-1 border-l border-border/60">
            <div className="flex size-7.5 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-bold text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900 shadow-2xs">
              AQ
            </div>
            <div className="hidden text-left lg:block">
              <p className="text-xs font-semibold leading-tight text-foreground">Admin QCET</p>
              <p className="text-[10px] text-muted-foreground">BGH QCET</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Sub-Bar: Clean Twenty-Style Horizontal Navigation Links                */}
      {/* ========================================================================= */}
      <div className="border-t border-border/50 bg-background/50 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex h-9.5 w-full max-w-7xl items-center gap-1 overflow-x-auto scrollbar-none">
          {NAVIGATION_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active}
                className={cn(
                  "relative inline-flex h-7.5 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors whitespace-nowrap",
                  active
                    ? "bg-secondary text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className={cn("size-3.5", active ? "text-foreground" : "text-muted-foreground")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
