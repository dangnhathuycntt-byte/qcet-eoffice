"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  User,
  Settings,
  LogOut,
  CheckCircle2,
  Search,
  Bell,
  Compass,
  Smartphone,
  LogIn,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useSidebar, resolveBreadcrumb } from "@/components/layout/sidebar-context";
import { ScopeSwitcher } from "@/components/layout/scope-switcher";
import { GlobalMonthSelector } from "@/components/layout/global-month-selector";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const UserProfileModal = dynamic(
  () => import("@/components/auth/user-profile-modal").then((m) => m.UserProfileModal),
  { ssr: false }
);

export function getInitials(name: string): string {
  if (!name || !name.trim()) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

function TopbarBreadcrumbs({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const [rootTitle, pageTitle] = resolveBreadcrumb(pathname || "/", searchParams);
  const isDocuments = pathname?.startsWith("/documents");

  return (
    <div className="flex items-center min-w-0">
      <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
        {rootTitle}
      </span>
      <ChevronRight
        size={12}
        className="text-muted-foreground/50 hidden sm:inline mx-1 shrink-0"
      />
      <span className="text-xs font-semibold text-foreground truncate max-w-[120px] sm:max-w-none">
        {pageTitle}
      </span>
      {isDocuments && (
        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0 select-none">
          Đang phát triển
        </span>
      )}
    </div>
  );
}

function TopbarBreadcrumbsFallback({ pathname }: { pathname: string }) {
  const [rootTitle, pageTitle] = resolveBreadcrumb(pathname || "/");
  const isDocuments = pathname?.startsWith("/documents");

  return (
    <div className="flex items-center min-w-0">
      <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
        {rootTitle}
      </span>
      <ChevronRight
        size={12}
        className="text-muted-foreground/50 hidden sm:inline mx-1 shrink-0"
      />
      <span className="text-xs font-semibold text-foreground truncate max-w-[120px] sm:max-w-none">
        {pageTitle}
      </span>
      {isDocuments && (
        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0 select-none">
          Đang phát triển
        </span>
      )}
    </div>
  );
}

export function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed, toggleCollapse, badgeCounts } = useSidebar();
  const { user, logout, isProfileModalOpen, setIsProfileModalOpen } = useAuth();

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = React.useState(false);
  const profileDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
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

  // Global event listener for navigating to notifications
  React.useEffect(() => {
    const handleToggleNotifications = () => {
      router.push("/notifications");
    };
    window.addEventListener("qcet:toggle-notifications", handleToggleNotifications);
    return () => window.removeEventListener("qcet:toggle-notifications", handleToggleNotifications);
  }, [router]);

  const handleOpenSearch = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("qcet:open-command-search"));
  }, []);

  // Global keyboard shortcuts: '⌘K' / 'Ctrl+K' to quick search
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
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleOpenSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpenSearch]);

  return (
    <header
      data-slot="app-topbar"
      className="sticky top-0 z-30 w-full h-[calc(52px+env(safe-area-inset-top,0px))] border-b border-border/50 bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top,0px)] transition-colors"
    >
      <div className="h-full w-full px-3.5 sm:px-6 flex items-center justify-between gap-3">
        {/* Left Zone: Mobile Menu, Desktop Collapse Toggle, Dynamic Breadcrumbs & Scope Switcher */}
        <div className="flex items-center min-w-0 gap-2 sm:gap-3">
          {/* Mobile Menu Trigger (< 768px) đã được thay thế bằng tab 'Thêm' ở Bottom Nav để tránh xung đột 2 drawer */}

          {/* Desktop Sidebar Toggle (>= 768px) */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden md:inline-flex size-8 mr-1 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={toggleCollapse}
            title="Thu gọn / Mở rộng thanh bên (phím [ hoặc Ctrl+B)"
            aria-label="Thu gọn / Mở rộng thanh bên"
          >
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </Button>

          {/* Dynamic Breadcrumbs */}
          <Suspense fallback={<TopbarBreadcrumbsFallback pathname={pathname} />}>
            <TopbarBreadcrumbs pathname={pathname} />
          </Suspense>

          {/* Breadcrumb - Scope Separator */}
          <div className="h-4 w-px bg-border/60 shrink-0 hidden sm:block" />

          {/* Scope Switcher Dropdown */}
          <div id="tour-scope-switcher">
            <Suspense fallback={<div className="h-8 w-44 rounded-lg bg-muted/40 animate-pulse" />}>
              <ScopeSwitcher />
            </Suspense>
          </div>

          {/* Global Academic Month Selector */}
          <div id="tour-month-selector">
            <Suspense fallback={<div className="h-8 w-32 rounded-lg bg-muted/40 animate-pulse" />}>
              <GlobalMonthSelector />
            </Suspense>
          </div>
        </div>

        {/* Center Zone: Global Command / Quick Search */}
        <div className="flex items-center justify-center flex-1 max-w-md px-2">
          <button
            id="tour-topbar-search"
            type="button"
            onClick={handleOpenSearch}
            className="hidden sm:flex items-center justify-between w-64 md:w-80 lg:w-96 h-9 px-3 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 text-muted-foreground transition-colors cursor-pointer group"
            title="Tìm nhanh công việc, nhân sự... (phím ⌘K hoặc Ctrl+K)"
            aria-label="Tìm nhanh công việc, nhân sự"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search
                size={14}
                strokeWidth={1.5}
                className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors"
              />
              <span className="text-xs truncate">Tìm nhanh công việc, nhân sự...</span>
            </div>
            <kbd className="text-xs font-mono px-1.5 py-0.5 rounded border border-border/60 bg-background/80 text-muted-foreground group-hover:text-foreground shrink-0">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Zone: Notification Bell, Theme Switcher & User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile Quick Search Trigger */}
          <button
            type="button"
            onClick={handleOpenSearch}
            className="flex sm:hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer touch-manipulation"
            title="Tìm kiếm"
            aria-label="Tìm nhanh công việc, nhân sự"
          >
            <Search size={18} strokeWidth={1.75} />
          </button>

          {/* Notification Bell: Direct Link to /notifications */}
          <Link
            href="/notifications"
            className="relative hidden md:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer touch-manipulation"
            title="Thông báo điều hành"
            aria-label="Thông báo điều hành"
          >
            <Bell size={16} strokeWidth={1.5} className="size-4" />
            {Number(badgeCounts?.notifications) > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background" />
            )}
          </Link>

          {/* Mobile App Install Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("qcet:open-install-modal"));
              }
            }}
            aria-label="Cài đặt ứng dụng di động"
            title="Cài đặt ứng dụng di động"
            className="hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary transition-colors cursor-pointer touch-manipulation"
          >
            <Smartphone size={16} strokeWidth={1.5} />
          </Button>

          {/* User Avatar + Profile Dropdown */}
          {user ? (
          <div className="relative" ref={profileDropdownRef}>
            <button
              type="button"
              onClick={() => setIsProfileDropdownOpen((prev) => !prev)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center sm:justify-start gap-2 pl-2 border-l border-border/50 transition-opacity hover:opacity-90 group cursor-pointer focus:outline-none touch-manipulation"
              title={`Hồ sơ cá nhân: ${user.name}`}
              aria-expanded={isProfileDropdownOpen}
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-semibold shadow-2xs">
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
                  className="text-xs text-muted-foreground font-medium max-w-[130px] truncate"
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
                className={cn(
                  "text-muted-foreground transition-transform duration-150 group-hover:text-foreground hidden sm:block",
                  isProfileDropdownOpen && "rotate-180"
                )}
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
                        <span title="Tài khoản email trường đã xác minh" className="shrink-0 text-emerald-600">
                          <CheckCircle2 size={13} strokeWidth={1.5} />
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-muted-foreground truncate" title={user.email}>
                      {user.email}
                    </p>
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-foreground border border-border/50">
                        {user.role === "ADMIN"
                          ? "Ban Giám hiệu"
                          : user.role === "MANAGER"
                          ? "Trưởng đơn vị"
                          : "Chuyên viên"}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {user.departmentCode || "QCET"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Actions */}
                <div className="mt-2 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer text-left active:scale-[0.98]"
                  >
                    <Settings size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                    <span>Hồ sơ cá nhân</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("qcet:open-install-modal"));
                      }
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer text-left active:scale-[0.98]"
                  >
                    <Smartphone size={14} strokeWidth={1.5} className="text-primary shrink-0" />
                    <span>Cài đặt ứng dụng di động</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("qcet:restart-onboarding"));
                      }
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer text-left active:scale-[0.98]"
                  >
                    <Compass size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                    <span>Hướng dẫn sử dụng hệ thống</span>
                  </button>

                  <Link
                    href="/login"
                    onClick={() => setIsProfileDropdownOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer text-left active:scale-[0.98]"
                  >
                    <User size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                    <span>Đổi tài khoản / Đăng nhập khác</span>
                  </Link>
                </div>

                {/* Divider & Logout */}
                <div className="border-t border-border/50 pt-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer text-left active:scale-[0.98]"
                  >
                    <LogOut size={14} strokeWidth={1.5} className="shrink-0" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs ml-1"
            >
              <LogIn size={13} strokeWidth={1.5} />
              <span>Đăng nhập</span>
            </Link>
          )}
        </div>
      </div>

      {/* User Profile Modal */}
      {isProfileModalOpen && <UserProfileModal />}
    </header>
  );
}
