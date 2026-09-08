"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import {
  SidebarProvider,
  useSidebar,
} from "@/components/layout/sidebar-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { useOnboarding } from "@/hooks/use-onboarding";
import { cn } from "@/lib/utils";

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
  const onboarding = useOnboarding();

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

  return (
    <>
      <WelcomeModal
        isOpen={
          onboarding.isMounted &&
          !onboarding.state.hasSeenWelcome &&
          !onboarding.state.isDismissed
        }
        onStartTour={onboarding.startTour}
        onDismiss={onboarding.dismissOnboarding}
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
          }
        }}
        onPrev={() => onboarding.setCurrentTourIndex((i) => Math.max(0, i - 1))}
        onClose={onboarding.endTour}
      />
      {onboarding.isMounted && (
        <OnboardingChecklistWidget
          tasks={onboarding.checklistTasks}
          completedSteps={onboarding.state.completedSteps}
          percentage={onboarding.progress.percentage}
          isExpanded={onboarding.isChecklistExpanded}
          isDismissed={onboarding.state.isDismissed}
          onToggleExpand={() => onboarding.setIsChecklistExpanded((v) => !v)}
          onDismiss={onboarding.dismissOnboarding}
          onCompleteStep={onboarding.completeStep}
          onStartTour={onboarding.startTour}
        />
      )}
    </>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/portal") {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <React.Suspense fallback={<aside className="hidden md:flex w-[248px] shrink-0 border-r border-border/50 bg-card" />}>
        <AppSidebar />
      </React.Suspense>
      <div
        className={cn(
          "min-h-screen flex flex-col transition-all duration-200 ease-in-out",
          isCollapsed ? "md:pl-16" : "md:pl-[248px]"
        )}
      >
        <React.Suspense fallback={<header className="sticky top-0 z-30 w-full h-[52px] border-b border-border/50 bg-background/80" />}>
          <AppTopbar />
        </React.Suspense>
        <OfflineBanner />
        <main id="main-content" className="flex-1 py-4 md:py-8 pb-28 md:pb-8" tabIndex={-1}>
          <div className="max-w-[1440px] w-full mx-auto px-3.5 sm:px-6">
            {children}
          </div>
        </main>
      </div>

      <React.Suspense fallback={null}>
        <MobileBottomNav className="flex md:hidden" />
      </React.Suspense>

      <PushOnboardingSheet />
      <MobileAppInstallModal />
      <OnboardingHub />
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
