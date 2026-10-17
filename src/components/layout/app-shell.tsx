"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import {
  SidebarProvider,
  useSidebarLayout,
} from "@/components/layout/sidebar-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar, DesktopTopbar } from "@/components/layout/app-topbar";
import { MobileMenuDrawer } from "@/components/layout/mobile-menu-drawer";
import { MobileMenuOpenContext } from "@/components/layout/mobile-menu-button";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { useAuth } from "@/lib/auth-context";
import { sanitizeRedirectUrl } from "@/lib/login-helpers";
import { isCardPagePath, isTaskDetailPath, isTaskSubPagePath } from "@/lib/navigation/active-matcher";
import { cn } from "@/lib/utils";
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
  const isTaskDetail = isTaskDetailPath(pathname);
  // Hộp thư tự chiếm toàn bộ khung nội dung (danh sách + chi tiết), không đệm
  const isInbox = pathname === "/inbox";
  // Sổ văn bản dùng cùng khung workspace với chi tiết nhiệm vụ: chiều cao cố định, các thẻ tự cuộn
  // Trang con tĩnh của Nhiệm vụ tự dựng khung một thẻ (WorkspacePageCard) nên cũng dùng khung workspace, không bọc thêm thẻ ngoài
  const isTaskSubPage = isTaskSubPagePath(pathname);
  // Tổng quan, Báo cáo và các trang trong menu "Thêm" cũng tự dựng khung một thẻ
  const isCardPage = isCardPagePath(pathname);
  const isWorkspaceShell = isTaskDetail || isTaskSubPage || isCardPage || pathname === "/documents";
  // Danh sách và chi tiết nhiệm vụ, hộp thư, sổ văn bản, trang một thẻ: bỏ thanh breadcrumb trên desktop để nhường chỗ cho nội dung
  const hideDesktopTopbar = pathname === "/tasks" || isTaskDetail || isTaskSubPage || isCardPage || isInbox || pathname === "/documents";
  const isTasksList = pathname === "/tasks";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { user, isAuthenticated, isLoading } = useAuth();
  const isRedirectingRef = React.useRef(false);
  // Padding trái theo độ rộng sidebar qua CSS variable; chỉ áp dụng từ md trở lên (mobile = 0)
  const sidebarWidthVar = useTransform(sidebarWidthMotion, (v) => `${v}px`);

  React.useEffect(() => {
    const handleOpen = () => setIsMobileMenuOpen(true);
    window.addEventListener("qcet:open-mobile-menu", handleOpen);
    return () => window.removeEventListener("qcet:open-mobile-menu", handleOpen);
  }, []);

  // Tài liệu hướng dẫn (/docs) công khai, tự dựng khung riêng kiểu linear.app/docs: không sidebar/topbar của ứng dụng
  const isDocsRoute = pathname === "/docs" || pathname.startsWith("/docs/");
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/portal" ||
    isDocsRoute ||
    (typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/login") ||
        window.location.pathname.startsWith("/portal")));

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
    <div className={cn(
      "relative bg-sidebar text-foreground antialiased flex flex-col md:flex-row",
      // Chi tiết nhiệm vụ: chiều cao cố định để vùng nội dung co theo khung, không giãn theo nội dung
      isWorkspaceShell ? "h-[100dvh]" : "min-h-[100dvh]"
    )}>
      {/* Nút mở menu ở header các trang đọc trạng thái này để tô nửa icon khi menu đang mở */}
      <MobileMenuOpenContext.Provider value={isMobileMenuOpen}>
      {/* Desktop Sidebar (Fixed width) */}
      <React.Suspense fallback={<aside className="hidden md:flex shrink-0 bg-sidebar" style={{ width: `${sidebarWidth}px` }} />}>
        <AppSidebar />
      </React.Suspense>

      {/* Main Content Area: Content Panel on Desktop */}
      <m.div
        className={isWorkspaceShell ? "md:pl-[var(--sidebar-w)] min-h-0 min-w-0 flex-1 flex flex-col" : "md:pl-[var(--sidebar-w)] min-h-[100dvh] min-w-0 flex-1 flex flex-col"}
        style={{ "--sidebar-w": sidebarWidthVar } as React.CSSProperties}
      >
        {/* Mobile Header (chỉ dưới md); danh sách, chi tiết nhiệm vụ, hộp thư và sổ văn bản tự có header riêng (nút mở sidebar / nút quay lại) như Linear */}
        {!isTasksList && !isTaskDetail && !isInbox && pathname !== "/documents" && <AppTopbar showSearch={!isTaskSubPage && !isCardPage} />}

        {/* Desktop Top Header Bar (Matching sidebar top header) */}
        {!hideDesktopTopbar && <DesktopTopbar />}

        <OfflineBanner />

        {/* Inner Content Panel: White canvas with rounded top-left corner */}
        <main
          id="main-content"
          tabIndex={-1}
          className={isWorkspaceShell
            ? "flex flex-1 min-h-0 min-w-0 flex-col md:mt-2 outline-none overflow-hidden"
            : isInbox
            ? "flex flex-none min-w-0 flex-col h-[100dvh] md:mt-2 md:mr-2 md:mb-2 md:h-[calc(100dvh-16px)] md:rounded-2xl md:border md:border-border md:bg-card md:shadow-2xs outline-none overflow-hidden"
            : cn(
                "flex-1 flex flex-col md:border-t md:border-l md:border-border md:bg-card md:shadow-2xs min-h-[calc(100dvh-44px)] outline-none overflow-hidden",
                // Danh sách nhiệm vụ: khung bo đủ 4 góc, cách mép phải và dưới 8px như chi tiết
                isTasksList ? "md:rounded-2xl md:border-r md:border-b md:mr-2 md:mb-2" : "md:rounded-tl-2xl",
                hideDesktopTopbar && (isTasksList ? "md:mt-2 md:h-[calc(100dvh-16px)] md:flex-none" : "md:mt-2 md:min-h-[calc(100dvh-8px)]")
              )}
        >
          <div
            className={
              isWorkspaceShell
                ? "flex min-h-0 min-w-0 flex-1 flex-col"
                : isInbox
                ? "flex min-h-0 min-w-0 flex-1 flex-col pb-[env(safe-area-inset-bottom,0px)] md:pb-0"
                : isTasksList
                ? "flex-1 min-h-0 overflow-y-auto flex flex-col bg-card md:bg-transparent"
                : "w-full flex-1 p-3 sm:p-5 md:p-6 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] md:pb-6 flex flex-col"
            }
          >
            {/* Danh sách nhiệm vụ: padding nằm trong vùng cuộn để tiêu đề cột dính sát mép khung */}
            {isTasksList ? (
              <div className="flex w-full flex-1 flex-col px-4 pt-0 sm:p-5 md:px-[18px] md:pt-0 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] md:pb-6">
                {children}
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </m.div>

      <React.Suspense fallback={null}>
        <MobileMenuDrawer open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} />
      </React.Suspense>

      <PWAInstallPrompt userId={user?.id} />
      <PushOnboardingSheet userId={user?.id} />
      <MobileAppInstallModalContainer />
      <CommandSearchModal />
      <GlobalShortcutsModal />
      </MobileMenuOpenContext.Provider>
    </div>
  );
}

export function AppShell({
  children,
  initialSidebarCollapsed,
}: {
  children: React.ReactNode;
  initialSidebarCollapsed?: boolean;
}) {
  return (
    <SidebarProvider initialCollapsed={initialSidebarCollapsed}>
      <AppShellInner>{children}</AppShellInner>
    </SidebarProvider>
  );
}
export default AppShell;
