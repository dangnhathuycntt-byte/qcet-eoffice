"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Network,
  Bell,
  Clock,
  Sun,
  Moon,
  Plus,
  User,
  CheckCircle2,
  ChevronDown,
  LogOut,
  Settings,
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
import { UserProfileModal } from "@/components/auth/user-profile-modal";

export function getInitials(name: string): string {
  if (!name || !name.trim()) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

export const NAVIGATION_ITEMS = [
  { href: "/", label: "Quản lý công việc", icon: CheckSquare },
  { href: "/org", label: "Cơ cấu & Danh bạ", icon: Network },
  { href: "/dashboard", label: "Báo cáo KPI", icon: LayoutDashboard },
  { href: "/notifications", label: "Thông báo", icon: Bell },
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
    <div className="hidden xl:flex items-center gap-1.5 text-xs font-mono tabular-nums text-muted-foreground select-none">
      <Clock size={13} strokeWidth={1.5} className="text-muted-foreground/80 shrink-0" />
      <span>{timeStr}</span>
    </div>
  );
}

export function ZoomToggle() {
  const [zoomLevel, setZoomLevel] = React.useState<number>(1.0);
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
      document.documentElement.style.zoom = "1.0";
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
      className="hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border/50 bg-secondary/40 hover:bg-secondary/80 text-xs font-medium text-foreground transition-colors cursor-pointer active:scale-[0.98]"
      title="Bật / Tắt phóng to giao diện (100% / 120%)"
    >
      <span className="text-[10px] text-muted-foreground font-normal">Zoom</span>
      <span className="font-mono text-[11px] text-foreground font-semibold tabular-nums">
        {mounted ? `${Math.round(zoomLevel * 100)}%` : "100%"}
      </span>
    </button>
  );
}

export function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav
      data-slot="mobile-nav"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/90 backdrop-blur-md border-t border-border/50 px-2 py-1.5 shadow-lg"
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
            item.label === "Quản lý công việc"
              ? "Công việc"
              : item.label === "Cơ cấu & Danh bạ" || item.label === "Cơ cấu tổ chức"
              ? "Tổ chức"
              : item.label === "Báo cáo KPI"
              ? "KPI"
              : item.label === "Thông báo"
              ? "Thông báo"
              : item.label;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors",
                active
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                size={16}
                strokeWidth={1.5}
                className={cn(
                  "mb-0.5",
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
  const { user, logout, setIsProfileModalOpen } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [initialAssigneeName, setInitialAssigneeName] = React.useState<string | undefined>(undefined);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = React.useState(false);
  const profileDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setIsProfileDropdownOpen(false);
      }
    };
    if (isProfileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

  // Global event listener for opening create modal with pre-selected assignee (e.g. from /org)
  React.useEffect(() => {
    const handleOpenCreateTask = (e: Event) => {
      const customEvent = e as CustomEvent<{ leadAssigneeName?: string }>;
      if (customEvent?.detail?.leadAssigneeName) {
        setInitialAssigneeName(customEvent.detail.leadAssigneeName);
      } else {
        setInitialAssigneeName(undefined);
      }
      setIsCreateModalOpen(true);
    };
    window.addEventListener("qcet:open-create-task", handleOpenCreateTask);
    return () => window.removeEventListener("qcet:open-create-task", handleOpenCreateTask);
  }, []);

  // Global keyboard shortcuts: '⌘K' / 'Ctrl+K' or 'N' (outside form inputs) to quick-create task
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
        ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) ||
        ((e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey && !e.altKey)
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
      className="sticky top-0 z-50 w-full h-14 border-b border-border/50 bg-background/85 backdrop-blur-md transition-colors"
    >
      <div className="max-w-[1440px] h-full w-full mx-auto px-3.5 sm:px-6 flex items-center justify-between gap-3">
        {/* Left: Brand & Desktop Navigation */}
        <div className="flex items-center gap-4 lg:gap-6 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0 group"
            aria-label="Về trang chủ QCET E-Office"
          >
            <div className="relative flex items-center justify-center size-8 rounded-lg bg-card p-0.5 border border-border/60 shrink-0 transition-colors group-hover:border-primary/40">
              <Image
                src="/logo-qcet.png"
                alt="QCET Logo"
                width={32}
                height={32}
                priority
                unoptimized
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
                QCET E-Office
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-muted-foreground bg-muted border border-border/50 select-none">
                v1.2 Enterprise
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Thanh điều hướng chính">
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
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors whitespace-nowrap",
                    active
                      ? "bg-secondary text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  <Icon
                    size={14}
                    strokeWidth={1.5}
                    className={cn(
                      "shrink-0",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: LiveClock | ZoomToggle | RoleSwitcherPill | Quick Create Task | Theme | Avatar */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <LiveClock />
          <ZoomToggle />
          <RoleSwitcherPill />

          {/* Sleek Linear-style Quick Create Task Button */}
          <Button
            type="button"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
            title="Giao việc mới (phím ⌘K hoặc N)"
          >
            <Plus size={14} strokeWidth={1.5} className="shrink-0" />
            <span className="hidden sm:inline font-medium">Giao việc</span>
            <kbd className="ml-0.5 hidden items-center gap-0.5 rounded border border-primary-foreground/30 bg-primary-foreground/15 px-1 py-0.5 text-[10px] font-mono leading-none sm:inline-flex opacity-90">
              ⌘K
            </kbd>
          </Button>

          {/* Theme Switcher Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label="Chuyển đổi giao diện sáng/tối"
            className="size-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            {resolved === "dark" ? (
              <Sun size={15} strokeWidth={1.5} className="text-amber-400" />
            ) : (
              <Moon size={15} strokeWidth={1.5} className="text-muted-foreground" />
            )}
          </Button>

          {/* User Avatar + Profile Dropdown */}
          <div className="relative" ref={profileDropdownRef}>
            <button
              type="button"
              onClick={() => setIsProfileDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 pl-2 border-l border-border/50 transition-opacity hover:opacity-90 group cursor-pointer focus:outline-none"
              title={`Hồ sơ cá nhân: ${user.name}`}
              aria-expanded={isProfileDropdownOpen}
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-semibold shadow-xs group-hover:ring-1 group-hover:ring-primary/40 transition-all">
                {getInitials(user.name)}
              </div>
              <div className="hidden text-left xl:block">
                <p
                  className="text-xs font-semibold leading-tight text-foreground max-w-[130px] truncate"
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
              <ChevronDown
                size={12}
                strokeWidth={1.5}
                className="text-muted-foreground transition-transform group-hover:text-foreground hidden sm:block"
              />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border/60 bg-card/95 backdrop-blur-md p-3 shadow-dropdown z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* User Summary Card */}
                <div className="flex items-start gap-3 border-b border-border/50 pb-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 text-sm font-semibold shadow-xs shrink-0">
                    {getInitials(user.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-foreground truncate" title={user.name}>
                        {user.name}
                      </p>
                      {user.emailVerified && (
                        <span title="Đã xác thực Google Workspace" className="shrink-0 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={13} strokeWidth={1.5} />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground truncate" title={user.email}>
                      {user.email}
                    </p>
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[9.5px] font-medium text-foreground border border-border/50">
                        {user.role === "ADMIN"
                          ? "Ban Giám hiệu"
                          : user.role === "MANAGER"
                          ? "Trưởng đơn vị"
                          : "Chuyên viên"}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {user.departmentCode || "QCET"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-2 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer text-left active:scale-[0.98]"
                  >
                    <Settings size={14} strokeWidth={1.5} className="text-muted-foreground" />
                    <span>Cập nhật hồ sơ cán bộ</span>
                  </button>

                  <Link
                    href="/login"
                    onClick={() => setIsProfileDropdownOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer text-left active:scale-[0.98]"
                  >
                    <User size={14} strokeWidth={1.5} className="text-muted-foreground" />
                    <span>Đổi tài khoản / Đăng nhập khác</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer text-left active:scale-[0.98]"
                  >
                    <LogOut size={14} strokeWidth={1.5} />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation for Small Screens (< 768px) */}
      <MobileNav pathname={pathname} />

      {/* CreateTaskModal Dialog from Topbar */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setInitialAssigneeName(undefined);
        }}
        onSubmit={handleCreateTaskFromTopbar}
        initialLeadAssigneeName={initialAssigneeName}
      />

      {/* User Profile Modal */}
      <UserProfileModal />
    </header>
  );
}
