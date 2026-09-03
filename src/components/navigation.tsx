"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Network,
  Bell,
  Sun,
  Moon,
  Building2,
  User,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const NAVIGATION_ITEMS = [
  { href: "/", label: "Trang chủ", icon: LayoutDashboard },
  { href: "/tasks", label: "Công việc", icon: CheckSquare },
  { href: "/calendar", label: "Lịch biểu", icon: Calendar },
  { href: "/org", label: "Cơ cấu", icon: Network, fullLabel: "Cơ cấu tổ chức" },
  { href: "/notifications", label: "Thông báo", icon: Bell },
];

export function Navigation() {
  const pathname = usePathname();
  const { resolved, toggleTheme } = useTheme();

  return (
    <>
      {/* ========================================================================= */}
      {/* Desktop Header & Floating Pill Navigation (>= 768px)                       */}
      {/* ========================================================================= */}
      <header
        data-slot="desktop-nav"
        className="fixed inset-x-0 top-0 z-50 hidden border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-xl transition-colors md:block sm:px-8 lg:px-12"
      >
        <div className="mx-auto flex h-12 w-full max-w-7xl items-center justify-between gap-4">
          {/* Logo & Brand */}
          <Link
            href="/"
            className="group flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span className="relative flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25 transition-transform group-hover:scale-105">
              <Building2 className="size-5" aria-hidden="true" />
              <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500"></span>
              </span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                  QCET E-Office
                </span>
                <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  MVP
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">Văn phòng Điện tử</p>
            </div>
          </Link>

          {/* Desktop Floating Pill Navigation */}
          <nav
            data-slot="floating-pill-nav"
            className="flex items-center gap-1 rounded-2xl border border-border/80 bg-card/70 p-1.5 shadow-sm backdrop-blur-md"
          >
            {NAVIGATION_ITEMS.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={active}
                  className={cn(
                    "relative flex h-8 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-all duration-150",
                    active
                      ? "border border-primary/30 bg-primary/10 text-primary shadow-xs font-bold"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("size-3.5", active ? "text-primary" : "text-muted-foreground")} />
                  <span>{item.fullLabel || item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Actions: Status, Theme, Profile */}
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-border/80 bg-card/60 px-3 py-1.5 text-left lg:flex">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              <div className="max-w-40">
                <p className="text-[11px] font-semibold leading-tight text-foreground">Hệ thống sẵn sàng</p>
                <p className="truncate text-[10px] text-muted-foreground font-medium">QCET Portal Phase 1</p>
              </div>
            </div>

            {/* Theme Toggle Button */}
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={toggleTheme}
              aria-label="Chuyển đổi giao diện sáng/tối"
              className="border-border bg-card/60 text-foreground hover:bg-accent hover:border-primary/40 transition-all"
            >
              {resolved === "dark" ? (
                <Sun className="size-4 text-amber-400 transition-transform" />
              ) : (
                <Moon className="size-4 text-muted-foreground transition-transform" />
              )}
            </Button>

            {/* Profile Avatar / Link */}
            <Link href="/profile">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="border-border bg-card/60 text-foreground hover:bg-accent hover:border-primary/40 transition-all"
                aria-label="Hồ sơ người dùng"
              >
                <User className="size-4 text-muted-foreground" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* Mobile TopBar (< 768px)                                                   */}
      {/* ========================================================================= */}
      <header
        data-slot="mobile-topbar"
        className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border/80 bg-card/90 px-4 backdrop-blur-md md:hidden"
      >
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Building2 className="size-4" aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-tight text-foreground">QCET E-Office</span>
            <span className="text-[10px] text-muted-foreground">Văn phòng Số</span>
          </div>
        </Link>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label="Chuyển đổi giao diện sáng/tối"
          >
            {resolved === "dark" ? (
              <Sun className="size-4 text-amber-400" />
            ) : (
              <Moon className="size-4 text-muted-foreground" />
            )}
          </Button>

          <Link href="/notifications">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Thông báo"
              className="relative"
            >
              <Bell className="size-4 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-primary"></span>
              </span>
            </Button>
          </Link>

          <Link href="/profile">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Hồ sơ cá nhân"
            >
              <User className="size-4 text-muted-foreground" />
            </Button>
          </Link>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* Mobile Bottom Navigation Bar (< 768px)                                    */}
      {/* ========================================================================= */}
      <nav
        data-slot="mobile-bottom-nav"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border/80 bg-card/95 px-2 pb-safe backdrop-blur-md md:hidden"
      >
        {NAVIGATION_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors",
                active ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-xl transition-all",
                  active ? "bg-primary/15 text-primary scale-105" : "text-muted-foreground"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="text-[10px] leading-none tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
