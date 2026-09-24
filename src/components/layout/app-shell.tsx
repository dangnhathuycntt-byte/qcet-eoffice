"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  SidebarProvider,
  useSidebarLayout,
} from "@/components/layout/sidebar-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar, DesktopTopbar } from "@/components/layout/app-topbar";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import { MobileMenuDrawer } from "@/components/layout/mobile-menu-drawer";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { useAuth } from "@/lib/auth-context";
import { sanitizeRedirectUrl } from "@/lib/login-helpers";
import * as m from "motion/react-m";
import { useTransform } from "motion/react";

const CommandSearchModal = dynamic(
  () => import("@/components/layout/command-search-modal").then((mod) => mod.CommandSearchModal),
  { ssr: false }
);

const GlobalShortcutsModal = dynamic(
  () => import("@/components/layout/global-shortcuts-modal").then((mod) => mod.GlobalShortcutsModal),
  { ssr: false }
);

const PWAInstallPrompt = dynamic(
  () => import("@/components/pwa/pwa-install-prompt").then((m) => m.PWAInstallPrompt),
  { ssr: false }
);

const PushOnboardingSheet = dynamic(
  () => import("@/components/pwa/push-onboarding-sheet").then((m) => m.PushOnboardingSheet),
  { ssr: false }
);

const MobileAppInstallModal = dynamic(
  () => import("@/components/pwa/mobile-app-install-modal").then((m) => m.MobileAppInstallModal),
  { ssr: false }
);

function MobileAppInstallModalContainer() {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("qcet:open-install-modal", handleOpen);
    return () => window.removeEventListener("qcet:open-install-modal", handleOpen);
  }, []);

  if (!isOpen) return null;

  return (
    <MobileAppInstallModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
    />
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { sidebarWidth, sidebarWidthMotion } = useSidebarLayout();
  const pathname = usePathname();
  const isTaskDetail = /^\/tasks\/[^/]+$/.test(pathname ?? "");
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { user, isAuthenticated, isLoading } = useAuth();
  const isRedirectingRef = React.useRef(false);
  // Chỉ apply sidebarWidth padding trên màn hình md+; mobile luôn là 0
  const [isMd, setIsMd] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsMd(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMd(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const desktopPaddingLeft = useTransform(sidebarWidthMotion, (v) => isMd ? v : 0);

  React.useEffect(() => {
    const handleOpen = () => setIsMobileMenuOpen(true);
    window.addEventListener("qcet:open-mobile-menu", handleOpen);
    return () => window.removeEventListener("qcet:open-mobile-menu", handleOpen);
  }, []);

  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/portal" ||
    (typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/login") || window.location.pathname.startsWith("/portal")));

  // Khi mất session hoặc chưa đăng nhập trên các trang bảo vệ: điều hướng an toàn về /login
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/login") || window.location.pathname.startsWith("/portal")) {
      return;
    }
    if (!isLoading && !isAuthenticated && !user && !isPublicRoute && !isRedirectingRef.current) {
      isRedirectingRef.current = true;
      const fullPath = `${window.location.pathname}${window.location.search}`;
      const safeReturnTo = sanitizeRedirectUrl(fullPath);
      const redirectUrl =
        safeReturnTo && safeReturnTo !== "/tasks" && safeReturnTo !== "/"
          ? `/login?returnTo=${encodeURIComponent(safeReturnTo)}`
          : "/login";
      window.location.replace(redirectUrl);
    }
  }, [isLoading, isAuthenticated, user, isPublicRoute]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Khi chưa đăng nhập hoặc mất session trên protected route: hiển thị trạng thái chuyển hướng
  if (!isLoading && !isAuthenticated && !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#f4f5f7] dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground font-medium">Đang chuyển hướng đến trang đăng nhập...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] bg-sidebar dark:bg-zinc-950 text-foreground antialiased flex flex-col md:flex-row">
      {/* Desktop Sidebar (Fixed width) */}
      <React.Suspense fallback={<aside className="hidden md:flex shrink-0 bg-sidebar" style={{ width: `${sidebarWidth}px` }} />}>
        <AppSidebar />
      </React.Suspense>

      {/* Main Content Area: Content Panel on Desktop */}
      <m.div
        className="min-h-[100dvh] flex-1 flex flex-col"
        style={{ paddingLeft: desktopPaddingLeft }}
      >
        {/* Mobile Header (Only visible below md) */}
        <React.Suspense fallback={<header className="md:hidden sticky top-0 z-30 w-full h-12 border-b border-border/50 bg-background/80" />}>
          <AppTopbar />
        </React.Suspense>

        {/* Desktop Top Header Bar (Matching sidebar top header) */}
        <React.Suspense fallback={<header className="hidden md:flex h-11 shrink-0 bg-sidebar dark:bg-zinc-950" />}>
          <DesktopTopbar />
        </React.Suspense>

        <OfflineBanner />

        {/* Inner Content Panel: White canvas with rounded top-left corner */}
        <main
          id="main-content"
          tabIndex={-1}
          className={isTaskDetail
            ? "flex flex-1 min-w-0 flex-col h-[calc(100dvh-48px)] md:h-[calc(100dvh-44px)] outline-none overflow-hidden"
            : "flex-1 flex flex-col md:rounded-tl-2xl md:border-t md:border-l md:border-border md:bg-card md:shadow-2xs min-h-[calc(100dvh-44px)] outline-none overflow-hidden"}
        >
          <div className={isTaskDetail ? "flex min-h-0 min-w-0 flex-1 flex-col" : "w-full flex-1 p-3 sm:p-5 md:p-6 flex flex-col"}>
            {children}
          </div>
        </main>
      </m.div>

      {/* Mobile Navigation */}
      <React.Suspense fallback={null}>
        <MobileBottomNav className="flex md:hidden" />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <MobileMenuDrawer open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} />
      </React.Suspense>

      <PWAInstallPrompt userId={user?.id} />
      <PushOnboardingSheet userId={user?.id} />
      <MobileAppInstallModalContainer />
      <CommandSearchModal />
      <GlobalShortcutsModal />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppShellInner>{children}</AppShellInner>
    </SidebarProvider>
  );
}
export default AppShell;
