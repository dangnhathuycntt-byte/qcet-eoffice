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
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationPopover } from "@/components/notifications/notification-popover";
import { RoleSwitcherPill } from "@/components/auth/role-switcher-pill";

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

const LEVEL_1_ROOTS = new Set([
  "/",
  "/dashboard",
  "/workbench",
  "/tasks",
  "/calendar",
  "/notifications",
  "/documents",
  "/org",
  "/settings",
]);

function TopbarBreadcrumbs({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const [rootTitle, pageTitle] = resolveBreadcrumb(pathname || "/", searchParams);
  const cleanPath = pathname?.split("?")[0].replace(/\/+$/, "") || "/";
  const isLevel1 = LEVEL_1_ROOTS.has(cleanPath);
  const hasDeeperContext = Boolean(searchParams?.get("taskId") || searchParams?.get("id") || searchParams?.get("unitId"));

  // Level-1 pages do not repeat location with sidebar + breadcrumb + title; breadcrumbs remain for deeper context
  if (isLevel1 && !hasDeeperContext) {
    return null;
  }

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
      {pathname.startsWith("/documents") && (
        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-800 border border-amber-500/20">
          Đang phát triển
        </span>
      )}
    </div>
  );
}

function TopbarBreadcrumbsFallback({ pathname }: { pathname: string }) {
  const [rootTitle, pageTitle] = resolveBreadcrumb(pathname || "/");
  const cleanPath = pathname?.split("?")[0].replace(/\/+$/, "") || "/";
  const isLevel1 = LEVEL_1_ROOTS.has(cleanPath);

  // Level-1 pages do not repeat location with sidebar + breadcrumb + title
  if (isLevel1) {
    return null;
  }

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
      {pathname.startsWith("/documents") && (
        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-800 border border-amber-500/20">
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
  const { user, logout, isProfileModalOpen, setIsProfileModalOpen, isOfflineReadOnly } = useAuth();

  const unreadNotifications = Number(badgeCounts?.notifications) || 0;

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = React.useState(false);
  const profileDropdownRef = React.useRef<HTMLDivElement>(null);

  const [isNotificationOpen, setIsNotificationOpen] = React.useState(false);
  const notificationRef = React.useRef<HTMLDivElement>(null);

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

  // Global event listener for toggling notifications
  React.useEffect(() => {
    const handleToggleNotifications = () => {
      setIsNotificationOpen((prev) => !prev);
    };
    window.addEventListener("qcet:toggle-notifications", handleToggleNotifications);
    return () => window.removeEventListener("qcet:toggle-notifications", handleToggleNotifications);
  }, []);

  const handleOpenSearch = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("qcet:open-command-search", { detail: { open: true } }));
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
      const isKeyK = e.key === "k" || e.key === "K" || e.code === "KeyK";
      if (isKeyK && (e.metaKey || e.ctrlKey) && !e.altKey) {
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
      className="sticky top-0 z-30 w-full h-[calc(52px+env(safe-area-inset-top,0px))] border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top,0px)] transition-colors"
    >
      <div className="h-full w-full px-3.5 sm:px-6 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_minmax(280px,384px)_minmax(0,1fr)] items-center gap-2 sm:gap-4">
        {/* Left Zone: Desktop Collapse Toggle & Deep Breadcrumbs */}
        <div className="flex items-center min-w-0 gap-2 sm:gap-3">
          {/* Mobile Menu Trigger (< 768px) đã được thay thế bằng tab 'Thêm' ở Bottom Nav để tránh xung đột 2 drawer */}

          {/* Desktop Sidebar Toggle (>= 768px) */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden md:inline-flex size-8 mr-1 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={toggleCollapse}
            title="Thu gọn / Mở rộng thanh bên (Ctrl+B hoặc ⌘B)"
            aria-label="Thu gọn / Mở rộng thanh bên"
          >
            {isCollapsed ? <PanelLeftOpen size={16} strokeWidth={1.5} /> : <PanelLeftClose size={16} strokeWidth={1.5} />}
          </Button>

          {/* Dynamic Breadcrumbs */}
          <Suspense fallback={<TopbarBreadcrumbsFallback pathname={pathname} />}>
            <TopbarBreadcrumbs pathname={pathname} />
          </Suspense>
        </div>

        {/* Center Zone: Bounded Command Search Launcher */}
        <div className="hidden sm:flex items-center justify-center w-full">
          <button
            id="tour-topbar-search"
            type="button"
            onClick={handleOpenSearch}
            className="flex items-center justify-between w-full max-w-sm h-9 px-3 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 text-muted-foreground transition-colors cursor-pointer group"
            title="Tìm kiếm toàn hệ thống… (phím ⌘K hoặc Ctrl+K)"
            aria-label="Tìm kiếm toàn hệ thống"
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

        {/* Right Zone: justify-self-end: Notifications & Compact Profile */}
        <div className="flex items-center justify-self-end gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile Quick Search Trigger */}
          <button
            type="button"
            onClick={handleOpenSearch}
            className="flex sm:hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer touch-manipulation"
            title="Tìm kiếm"
            aria-label="Tìm nhanh công việc, nhân sự"
          >
            <Search size={18} strokeWidth={1.5} />
          </button>

          {/* Notification Bell: Popover Trigger */}
          <div ref={notificationRef} className="relative flex items-center">
            <button
              type="button"
              onClick={() => setIsNotificationOpen((prev) => !prev)}
              className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer touch-manipulation"
              title="Thông báo điều hành"
              aria-label="Thông báo điều hành"
              aria-expanded={isNotificationOpen}
            >
              <Bell size={16} strokeWidth={1.5} className="size-4" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-xs font-bold text-destructive-foreground flex items-center justify-center ring-2 ring-background tabular-nums pointer-events-none">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>
            <Link href="/notifications" className="sr-only">
              Xem tất cả thông báo điều hành
            </Link>
            <NotificationPopover
              isOpen={isNotificationOpen}
              onClose={() => setIsNotificationOpen(false)}
              containerRef={notificationRef}
            />
          </div>

          {/* User Avatar + Profile Dropdown */}
          {user ? (
          <div className="relative" ref={profileDropdownRef}>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth < 768) {
                  window.dispatchEvent(new CustomEvent("qcet:open-mobile-menu"));
                  return;
                }
                setIsProfileDropdownOpen((prev) => !prev);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center sm:justify-start gap-2 pl-2 border-l border-border/50 transition-opacity hover:opacity-90 group cursor-pointer focus:outline-none touch-manipulation"
              title={`Hồ sơ cá nhân: ${user.name}`}
              aria-expanded={isProfileDropdownOpen}
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-semibold shadow-2xs shrink-0">
                {getInitials(user.name)}
              </div>
              <div className="hidden items-center gap-1.5 text-left md:flex">
                <span
                  className="text-xs font-semibold text-foreground max-w-[100px] lg:max-w-[130px] truncate"
                  title={user.name}
                >
                  {user.name}
                </span>
                {isOfflineReadOnly && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-900 border border-amber-300 shrink-0"
                    title="Phiên đăng nhập máy chủ đã hết hạn (Chỉ xem)"
                  >
                    Chỉ xem
                  </span>
                )}
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
                {isOfflineReadOnly && (
                  <div className="mb-2.5 p-2 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 font-medium leading-relaxed">
                    Phiên máy chủ đã hết hạn. Dữ liệu đang hiển thị ở chế độ chỉ xem từ bộ nhớ tạm.
                  </div>
                )}
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

                {/* Dev-only: Role Switcher */}
                <RoleSwitcherPill className="border-t border-border/50 pt-2 mt-1 px-1" />

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
