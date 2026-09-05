"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Briefcase,
  Calendar,
  Network,
  Clock,
  Sun,
  Moon,
  Plus,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CreateTaskModal,
  CreateTaskFormData,
} from "@/components/dashboard/create-task-modal";
import { useAuth } from "@/lib/auth-context";
import { RoleSwitcherPill } from "@/components/auth/role-switcher-pill";

export function getInitials(name: string): string {
  if (!name || !name.trim()) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

export const NAVIGATION_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Nhiệm vụ cấp Trường", icon: CheckSquare },
  { href: "/unit-tasks", label: "Công việc Đơn vị", icon: Briefcase },
  { href: "/calendar", label: "Lịch công tác", icon: Calendar },
  { href: "/org", label: "Cơ cấu tổ chức", icon: Network },
];

export function LiveClock() {
  const [timeStr, setTimeStr] = React.useState<string>("");

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!timeStr) return null;

  return (
    <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card/60 border border-border/50 text-xs font-mono font-bold text-foreground/90 shadow-xs">
      <Clock size={13} className="text-primary" />
      <span className="tabular-nums">{timeStr}</span>
    </div>
  );
}

export function ZoomToggle() {
  const [zoomLevel, setZoomLevel] = React.useState<number>(1.2);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("qcet_ui_zoom");
    if (saved) {
      const z = parseFloat(saved);
      if (!isNaN(z)) {
        setZoomLevel(z);
        document.documentElement.style.zoom = String(z);
      }
    } else {
      document.documentElement.style.zoom = "1.2";
    }
  }, []);

  const toggleZoom = () => {
    const nextZoom = zoomLevel === 1.2 ? 1.0 : 1.2;
    setZoomLevel(nextZoom);
    document.documentElement.style.zoom = String(nextZoom);
    localStorage.setItem("qcet_ui_zoom", String(nextZoom));
  };

  return (
    <button
      type="button"
      onClick={toggleZoom}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-card/80 hover:bg-card border border-border/60 text-xs font-black text-foreground shadow-xs transition-all cursor-pointer hover:border-primary/40 active:scale-95"
      title="Bật / Tắt chế độ Zoom 1.2 (Chữ lớn BGH)"
    >
      <span className="text-[10.5px] text-muted-foreground font-bold">Zoom:</span>
      <span className="font-mono text-primary font-black">
        {mounted ? `${Math.round(zoomLevel * 100)}%` : "120%"}
      </span>
    </button>
  );
}

export function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav
      data-slot="mobile-nav"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/90 backdrop-blur-lg border-t border-border/60 px-2 py-1.5 shadow-lg"
      aria-label="Điều hướng di động"
    >
      <div className="flex items-center justify-around">
        {NAVIGATION_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" &&
              (pathname === item.href || pathname.startsWith(item.href + "/")));
          const Icon = item.icon;
          const shortLabel =
            item.label === "Nhiệm vụ cấp Trường"
              ? "Cấp Trường"
              : item.label === "Công việc Đơn vị"
              ? "Đơn vị"
              : item.label === "Cơ cấu tổ chức"
              ? "Tổ chức"
              : item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium transition-colors",
                active
                  ? "text-primary font-bold bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-4 mb-0.5",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span className="truncate max-w-[68px]">{shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const { resolved, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);

  // Global keyboard shortcut: Press 'N' anywhere (outside form inputs) to quick-create task
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (
        (e.key === "n" || e.key === "N") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setIsCreateModalOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCreateTaskFromTopbar = (data: CreateTaskFormData) => {
    window.dispatchEvent(
      new CustomEvent("qcet:task-created", { detail: data })
    );
    setIsCreateModalOpen(false);
  };

  return (
    <header
      data-slot="executive-header"
      className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl transition-all duration-200 shadow-xs"
    >
      {/* ========================================================================= */}
      {/* 1. Main Top Bar: Branding | LiveClock | Zoom | Role | Actions             */}
      {/* ========================================================================= */}
      <div className="max-w-[1440px] w-full mx-auto px-3.5 sm:px-6 py-2.5 flex items-center justify-between gap-3 relative">
        {/* Left: QCET School Logo and College Name with Green Ping Badge */}
        <Link
          href="/"
          className="flex items-center gap-2.5 sm:gap-3 min-w-0 group"
          aria-label="Về trang chủ QCET E-Office"
        >
          <div className="relative flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-card p-1 shadow-card border border-border/60 shrink-0 transition-all duration-300 group-hover:scale-105 group-hover:border-primary/40 group-hover:shadow-glow-primary">
            <Image
              src="/logo-qcet.png"
              alt="Logo Quy Nhon"
              width={44}
              height={44}
              priority
              unoptimized
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-foreground font-heading group-hover:text-primary transition-colors">
                QCET E-Office
              </span>
              <span className="relative flex h-2 w-2" title="Hệ thống trực tuyến">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium leading-none select-none mt-0.5 truncate">
              Trường CĐ Kỹ thuật Công nghệ Quy Nhơn
            </p>
          </div>
        </Link>

        {/* Right: LiveClock | ZoomToggle | RoleSwitcherPill | Quick Task | Theme | Avatar */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <LiveClock />
          <ZoomToggle />
          <RoleSwitcherPill />

          {/* Quick Create Task Action Button */}
          <Button
            type="button"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-card hover:shadow-hover transition-all cursor-pointer"
            title="Giao việc nhanh toàn hệ thống"
          >
            <Plus className="size-3.5" />
            <span>Giao việc</span>
            <kbd className="ml-0.5 rounded border border-primary-foreground/30 bg-primary-foreground/20 px-1 py-0.5 text-[9.5px] font-mono leading-none opacity-90">
              N
            </kbd>
          </Button>

          {/* Theme Switcher Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label="Chuyển đổi giao diện sáng/tối"
            className="size-8 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent hover:border-border/50"
          >
            {resolved === "dark" ? (
              <Sun className="size-4 text-amber-400 transition-transform" />
            ) : (
              <Moon className="size-4 text-muted-foreground transition-transform" />
            )}
          </Button>

          {/* User Avatar + Profile */}
          <Link
            href="/login"
            className="flex items-center gap-2 pl-1 border-l border-border/60 transition-opacity hover:opacity-85 group cursor-pointer"
            title={`Đổi tài khoản / Đăng nhập (Hiện tại: ${user.name})`}
          >
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-bold shadow-xs group-hover:ring-2 group-hover:ring-primary/30">
              {getInitials(user.name)}
            </div>
            <div className="hidden text-left xl:block">
              <p
                className="text-xs font-bold leading-tight text-foreground max-w-[130px] truncate"
                title={user.name}
              >
                {user.name}
              </p>
              <p
                className="text-[10.5px] text-muted-foreground font-medium max-w-[130px] truncate"
                title={user.roleLabel}
              >
                {user.role === "ADMIN"
                  ? "BGH QCET"
                  : user.departmentCode || user.department}
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SubNav: Horizontal Scrolling Pill Bar with Glassmorphism                */}
      {/* ========================================================================= */}
      <div className="border-t border-border/50 bg-background/70 backdrop-blur-xl px-3.5 sm:px-6">
        <div className="mx-auto flex h-10 w-full max-w-[1440px] items-center gap-1.5 overflow-x-auto scrollbar-none">
          {NAVIGATION_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" &&
                (pathname === item.href || pathname.startsWith(item.href + "/")));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active}
                className={cn(
                  "relative inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all whitespace-nowrap",
                  active
                    ? "bg-primary/10 text-primary font-bold border border-primary/20 shadow-xs"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-3.5",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. Mobile Bottom Navigation for Small Screens (< 768px)                   */}
      {/* ========================================================================= */}
      <MobileNav pathname={pathname} />

      {/* CreateTaskModal Dialog from Topbar */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTaskFromTopbar}
      />
    </header>
  );
}
