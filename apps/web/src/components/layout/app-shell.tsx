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
import { AgentModelsProvider } from "@/components/agent-chat/agent-models";
import type { AgentModelCatalog } from "@qcet/shared/domain/agent/agent-models";
import { useAuth } from "@/lib/auth-context";
import { sanitizeRedirectUrl } from "@qcet/shared/lib/login-helpers";
import { isAssistantPath, isCardPagePath, isNotesPath, isTaskDetailPath, isTaskSubPagePath } from "@/lib/navigation/active-matcher";
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

/**
 * Phần khung trang chừa cho thanh dưới của Trợ lý (máy tính). Thanh cao 36px phủ cả 8px lề dưới của khung, nút 28px
 * nằm giữa nên cách đáy khung 4px như thanh dưới của Linear (`assistant-dock.tsx`).
 */
const ASSISTANT_STATUSBAR_RESERVE = "1.75rem";

// Thanh dưới và khung chat nổi của Trợ lý: tải sau, không nặng thêm khung trang (chỗ của thanh đã chừa từ server)
const AssistantDock = dynamic(() => import("@/components/assistant/assistant-dock").then((mod) => mod.AssistantDock), {
  ssr: false,
});

function AppShellInner({ children, assistantEnabled = false }: { children: React.ReactNode; assistantEnabled?: boolean }) {
  const { sidebarWidth, sidebarWidthMotion } = useSidebarLayout();
  const pathname = usePathname();
  const isTaskDetail = isTaskDetailPath(pathname);
  // Hộp thư tự chiếm toàn bộ khung nội dung (danh sách + chi tiết), không đệm
  const isInbox = pathname === "/inbox";
  // Trợ lý dùng cùng khung cao như Hộp thư: thanh đầu trang và khung tin, không cột phụ. Cờ tắt thì trang là 404, dùng
  // khung thường có thanh đầu
  const isAssistant = assistantEnabled && isAssistantPath(pathname);
  // Ghi chú cá nhân cũng là hai cột cao như Hộp thư
  const isFullHeightPane = isInbox || isAssistant || isNotesPath(pathname);
  // Thanh dưới của Trợ lý (máy tính, mọi trang trừ trang Trợ lý): khung trang chừa `--app-statusbar` ở đáy
  const showAssistantBar = assistantEnabled && !isAssistant;
  // Sổ văn bản dùng cùng khung workspace với chi tiết nhiệm vụ: chiều cao cố định, các thẻ tự cuộn
  // Trang con tĩnh của Nhiệm vụ tự dựng khung một thẻ (WorkspacePageCard) nên cũng dùng khung workspace, không bọc thêm thẻ ngoài
  const isTaskSubPage = isTaskSubPagePath(pathname);
  // Cơ cấu & Danh bạ, Báo cáo và các trang trong menu "Thêm" cũng tự dựng khung một thẻ
  const isCardPage = isCardPagePath(pathname);
  const isWorkspaceShell = isTaskDetail || isTaskSubPage || isCardPage || pathname === "/documents";
  // Danh sách và chi tiết nhiệm vụ, hộp thư, sổ văn bản, trang một thẻ: bỏ thanh breadcrumb trên desktop để nhường chỗ cho nội dung
  // Trang danh sách khung một thẻ cao hết màn hình như Nhiệm vụ: tự có thanh tiêu đề 44px và nút mở sidebar trên điện thoại
  // (`ListPageHeader`), nội dung cuộn trong thẻ. Cuộc họp học theo Nhiệm vụ (người dùng yêu cầu 20/10/2026).
  const isListPage = pathname === "/tasks" || pathname === "/meetings";
  const hideDesktopTopbar = isListPage || isTaskDetail || isTaskSubPage || isCardPage || isFullHeightPane || pathname === "/documents";
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
    <div
      className={cn(
        "relative bg-sidebar text-foreground antialiased flex flex-col md:flex-row md:pb-[var(--app-statusbar)]",
        // Chi tiết nhiệm vụ: chiều cao cố định để vùng nội dung co theo khung, không giãn theo nội dung
        isWorkspaceShell ? "h-[100dvh]" : "min-h-[100dvh]"
      )}
      style={{ "--app-statusbar": showAssistantBar ? ASSISTANT_STATUSBAR_RESERVE : "0px" } as React.CSSProperties}
    >
      {/* Nút mở menu ở header các trang đọc trạng thái này để tô nửa icon khi menu đang mở */}
      <MobileMenuOpenContext.Provider value={isMobileMenuOpen}>
      {/* Desktop Sidebar (Fixed width) */}
      <React.Suspense fallback={<aside className="hidden md:flex shrink-0 bg-sidebar" style={{ width: `${sidebarWidth}px` }} />}>
        <AppSidebar />
      </React.Suspense>

      {/* Main Content Area: Content Panel on Desktop */}
      <m.div
        className={isWorkspaceShell ? "md:pl-[var(--sidebar-w)] min-h-0 min-w-0 flex-1 flex flex-col" : "md:pl-[var(--sidebar-w)] min-h-[100dvh] md:min-h-[calc(100dvh-var(--app-statusbar))] min-w-0 flex-1 flex flex-col"}
        style={{ "--sidebar-w": sidebarWidthVar } as React.CSSProperties}
      >
        {/* Mobile Header (chỉ dưới md); danh sách, chi tiết nhiệm vụ, hộp thư và sổ văn bản tự có header riêng (nút mở sidebar / nút quay lại) như Linear */}
        {!isListPage && !isTaskDetail && !isFullHeightPane && pathname !== "/documents" && <AppTopbar showSearch={!isTaskSubPage && !isCardPage} />}

        {/* Desktop Top Header Bar (Matching sidebar top header) */}
        {!hideDesktopTopbar && <DesktopTopbar />}

        <OfflineBanner />

        {/* Inner Content Panel: White canvas with rounded top-left corner.
            Thẻ trang cách mép sidebar 8px (`md:ml-2`) như thẻ của chi tiết nhiệm vụ: nút thu gọn thanh bên nằm gọn trong khe đó
            thay vì đè lên viền thẻ (người dùng yêu cầu 20/10/2026). Trang workspace tự lùi thẻ bằng lề trong của nó. */}
        <main
          id="main-content"
          tabIndex={-1}
          className={isWorkspaceShell
            ? "flex flex-1 min-h-0 min-w-0 flex-col md:mt-2 outline-none overflow-hidden"
            : isFullHeightPane
            ? "flex flex-none min-w-0 flex-col h-[100dvh] md:mt-2 md:mr-2 md:mb-2 md:ml-2 md:h-[calc(100dvh-16px-var(--app-statusbar))] md:rounded-2xl md:border md:border-border md:bg-card md:shadow-2xs outline-none overflow-hidden"
            : cn(
                "flex-1 flex flex-col md:ml-2 md:border-t md:border-l md:border-border md:bg-card md:shadow-2xs min-h-[calc(100dvh-44px)] md:min-h-[calc(100dvh-44px-var(--app-statusbar))] outline-none overflow-hidden",
                // Trang danh sách (Nhiệm vụ, Cuộc họp): khung bo đủ 4 góc, cách mép phải và dưới 8px như chi tiết
                isListPage ? "md:rounded-2xl md:border-r md:border-b md:mr-2 md:mb-2" : "md:rounded-tl-2xl",
                hideDesktopTopbar && (isListPage ? "md:mt-2 md:h-[calc(100dvh-16px-var(--app-statusbar))] md:flex-none" : "md:mt-2 md:min-h-[calc(100dvh-8px-var(--app-statusbar))]")
              )}
        >
          <div
            className={
              isWorkspaceShell
                ? "flex min-h-0 min-w-0 flex-1 flex-col"
                : isFullHeightPane
                ? "flex min-h-0 min-w-0 flex-1 flex-col pb-[env(safe-area-inset-bottom,0px)] md:pb-0"
                : isListPage
                ? "flex-1 min-h-0 overflow-y-auto flex flex-col bg-card md:bg-transparent"
                : "w-full flex-1 p-3 sm:p-5 md:p-6 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] md:pb-6 flex flex-col"
            }
          >
            {/* Trang danh sách: padding nằm trong vùng cuộn để tiêu đề cột dính sát mép khung */}
            {isListPage ? (
              <div className="flex w-full flex-1 flex-col px-4 pt-0 sm:p-5 md:px-[18px] md:pt-0 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] md:pb-6">
                {children}
              </div>
            ) : (
              children
            )}
          </div>
        </main>

        {/* Trong cột này để thanh dưới (fixed) lấy được `--sidebar-w`; luôn gắn khi bật cờ, kể cả ở trang Trợ lý (thanh tự
            ẩn), để lượt đang chạy trong khung nổi không bị hủy khi chuyển sang đó */}
        {assistantEnabled ? <AssistantDock /> : null}
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
  assistantEnabled,
  agentModels = null,
}: {
  children: React.ReactNode;
  initialSidebarCollapsed?: boolean;
  /** Cờ Trợ lý đọc ở server: bật thì có thanh dưới và khung chat nổi trên máy tính. */
  assistantEnabled?: boolean;
  /** Model chọn được ở ô soạn của Trợ lý và Agent tạo nhiệm vụ; ít hơn hai model thì không có bộ chọn. */
  agentModels?: AgentModelCatalog | null;
}) {
  return (
    <SidebarProvider initialCollapsed={initialSidebarCollapsed}>
      <AgentModelsProvider catalog={agentModels}>
        <AppShellInner assistantEnabled={assistantEnabled}>{children}</AppShellInner>
      </AgentModelsProvider>
    </SidebarProvider>
  );
}
export default AppShell;
