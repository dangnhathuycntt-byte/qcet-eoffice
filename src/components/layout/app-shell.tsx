"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  SidebarProvider,
  useSidebar,
} from "@/components/layout/sidebar-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { PushOnboardingSheet } from "@/components/pwa/push-onboarding-sheet";
import { cn } from "@/lib/utils";

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
