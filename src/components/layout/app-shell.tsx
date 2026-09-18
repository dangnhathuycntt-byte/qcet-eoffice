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
import { useOnboarding } from "@/hooks/use-onboarding";
import {
  pwaOnboardingCoordinator,
  usePWAOnboardingCoordinator,
} from "@/lib/pwa/onboarding-coordinator";
import { useAuth } from "@/lib/auth-context";
import { sanitizeRedirectUrl } from "@/lib/login-helpers";
import { cn } from "@/lib/utils";

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

const WelcomeModal = dynamic(
  () => import("@/components/onboarding/welcome-modal").then((m) => m.WelcomeModal),
  { ssr: false }
);

const SpotlightTour = dynamic(
  () => import("@/components/onboarding/spotlight-tour").then((m) => m.SpotlightTour),
  { ssr: false }
);

const OnboardingChecklistWidget = dynamic(
  () => import("@/components/onboarding/onboarding-checklist-widget").then((m) => m.OnboardingChecklistWidget),
  { ssr: false }
);

export function OnboardingHub() {
  const { user } = useAuth();
  const onboarding = useOnboarding();
  const {
    canShowWelcome,
    completeWelcome,
    recordInterruptionShown,
    recordAction,
  } = usePWAOnboardingCoordinator(user?.id);

  React.useEffect(() => {
    if (onboarding.state.hasSeenWelcome) {
      completeWelcome();
    }
  }, [onboarding.state.hasSeenWelcome, completeWelcome]);

  React.useEffect(() => {
    const handleRestart = () => {
      onboarding.restartOnboarding();
      onboarding.setIsChecklistExpanded(true);
    };

    window.addEventListener("qcet:restart-onboarding", handleRestart);
    return () => {
      window.removeEventListener("qcet:restart-onboarding", handleRestart);
    };
  }, [onboarding.restartOnboarding, onboarding.setIsChecklistExpanded]);

  const shouldShowWelcome =
    onboarding.isMounted &&
    !onboarding.state.hasSeenWelcome &&
    !onboarding.state.isDismissed &&
    !onboarding.isSnoozed &&
    canShowWelcome;

  React.useEffect(() => {
    if (shouldShowWelcome) {
      recordInterruptionShown("WELCOME");
    }
  }, [shouldShowWelcome, recordInterruptionShown]);

  return (
    <>
      <WelcomeModal
        isOpen={shouldShowWelcome}
        onStartTour={() => {
          completeWelcome();
          onboarding.startTour({ force: true });
        }}
        onDismiss={() => {
          onboarding.dismissOnboarding();
          completeWelcome();
        }}
      />
      <SpotlightTour
        isActive={onboarding.isTourActive}
        steps={onboarding.tourSteps}
        currentIndex={onboarding.currentTourIndex}
        onNext={() => {
          if (onboarding.currentTourIndex < onboarding.tourSteps.length - 1) {
            onboarding.setCurrentTourIndex((i) => i + 1);
          } else {
            onboarding.endTour();
            recordAction("tour_completed");
          }
        }}
        onPrev={() => onboarding.setCurrentTourIndex((i) => Math.max(0, i - 1))}
        onClose={() => {
          onboarding.endTour();
          recordAction("tour_closed");
        }}
      />
      {onboarding.isMounted && (
        <OnboardingChecklistWidget
          tasks={onboarding.checklistTasks}
          completedSteps={onboarding.state.completedSteps}
          percentage={onboarding.progress.percentage}
          isExpanded={onboarding.isChecklistExpanded && !shouldShowWelcome}
          isDismissed={onboarding.state.isDismissed || onboarding.isSnoozed}
          snoozedUntil={onboarding.state.snoozedUntil}
          onToggleExpand={() => onboarding.setIsChecklistExpanded((v) => !v)}
          onDismiss={onboarding.dismissOnboarding}
          onSnooze={() => onboarding.snoozeOnboarding(24)}
          onCompleteStep={(stepId) => {
            onboarding.completeStep(stepId);
            recordAction(`step_${stepId}`);
          }}
          onStartTour={onboarding.startTour}
        />
      )}
    </>
  );
}

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
  const { isCollapsed } = useSidebarLayout();
  const pathname = usePathname();
  const isTaskDetail = /^\/tasks\/[^/]+$/.test(pathname ?? "");
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { user, isAuthenticated, isLoading } = useAuth();
  const isRedirectingRef = React.useRef(false);

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
    <div className="relative min-h-[100dvh] bg-[#f8f9fa] dark:bg-zinc-950 text-foreground antialiased flex flex-col md:flex-row">
      {/* Desktop Sidebar (Fixed Linear width) */}
      <React.Suspense fallback={<aside className="hidden md:flex w-[228px] shrink-0 bg-[#f8f9fa] dark:bg-zinc-950" />}>
        <AppSidebar />
      </React.Suspense>

      {/* Main Content Area: Content Panel on Desktop */}
      <div
        className={cn(
          "min-h-[100dvh] flex-1 flex flex-col transition-all duration-200 ease-in-out md:pl-[228px]"
        )}
      >
        {/* Mobile Header (Only visible below md) */}
        <React.Suspense fallback={<header className="md:hidden sticky top-0 z-30 w-full h-12 border-b border-border/50 bg-background/80" />}>
          <AppTopbar />
        </React.Suspense>

        {/* Desktop Top Header Bar (Linear-style matching sidebar top header) */}
        <React.Suspense fallback={<header className="hidden md:flex h-11 shrink-0 bg-[#f8f9fa] dark:bg-zinc-950" />}>
          <DesktopTopbar />
        </React.Suspense>

        <OfflineBanner />

        {/* Inner Content Panel: Linear white canvas with rounded top-left corner */}
        <main
          id="main-content"
          tabIndex={-1}
          className={isTaskDetail
            ? "flex flex-1 min-w-0 flex-col h-[calc(100dvh-48px)] md:h-[calc(100dvh-44px)] outline-none overflow-hidden"
            : "flex-1 flex flex-col md:rounded-tl-2xl md:border-t md:border-l md:border-border md:bg-card md:shadow-2xs min-h-[calc(100dvh-44px)] outline-none overflow-hidden"}
        >
          <div className={isTaskDetail ? "flex min-h-0 min-w-0 flex-1 flex-col" : "w-full flex-1 p-3 sm:p-5 md:p-6 max-w-[1600px] mx-auto flex flex-col"}>
            {children}
          </div>
        </main>
      </div>

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
      <OnboardingHub />
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
