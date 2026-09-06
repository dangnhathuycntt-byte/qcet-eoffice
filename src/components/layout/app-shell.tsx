"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  SidebarProvider,
  useSidebar,
} from "@/components/layout/sidebar-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { cn } from "@/lib/utils";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/portal") {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <React.Suspense fallback={<aside className="hidden md:flex w-[280px] shrink-0 border-r border-border/50 bg-card" />}>
        <AppSidebar />
      </React.Suspense>
      <div
        className={cn(
          "min-h-screen flex flex-col transition-all duration-200 ease-in-out",
          isCollapsed ? "md:pl-28" : "md:pl-[280px]"
        )}
      >
        <React.Suspense fallback={<header className="sticky top-0 z-30 w-full h-[52px] border-b border-border/50 bg-background/80" />}>
          <AppTopbar />
        </React.Suspense>
        <main id="main-content" className="flex-1 py-6 md:py-8" tabIndex={-1}>
          <div className="max-w-[1440px] w-full mx-auto px-3.5 sm:px-6">
            {children}
          </div>
        </main>
      </div>
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
