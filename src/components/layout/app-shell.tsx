"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  SidebarProvider,
  useSidebarLayout,
} from "@/components/layout/sidebar-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
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
      router.replace(redirectUrl);
    }
  }, [isLoading, isAuthenticated, user, isPublicRoute, router]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Khi chưa đăng nhập hoặc mất session trên protected route (đã xác nhận sau khi load xong)
  if (!isLoading && !isAuthenticated && !user) {
    return null;
  }

  return (
    <div className="relative min-h-[100dvh] bg-background text-foreground">
      <React.Suspense fallback={<aside className="hidden md:flex w-[248px] shrink-0 border-r border-border/50 bg-card" />}>
        <AppSidebar />
      </React.Suspense>
      <div
        className={cn(
          "min-h-[100dvh] flex flex-col transition-all duration-200 ease-in-out",
          isCollapsed ? "md:pl-16" : "md:pl-[248px]"
        )}
      >
        <React.Suspense fallback={<header className="sticky top-0 z-30 w-full h-[52px] border-b border-border/50 bg-background/80" />}>
          <AppTopbar />
        </React.Suspense>
        <OfflineBanner />
        {/* Centralized safe-area bottom clearance on main */}
        <main
          id="main-content"
          className="flex-1 py-3 md:py-5 pb-[calc(56px+env(safe-area-inset-bottom,0px)+12px)] md:pb-6"
          tabIndex={-1}
        >
          <div className="max-w-[1600px] w-full mx-auto px-3.5 sm:px-6">
            {children}
          </div>
        </main>
      </div>

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
