"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Settings, RefreshCw } from "lucide-react";
import {
  useSidebar,
  MODULES,
  type NavigationModule,
  type ModuleMeta,
} from "@/components/layout/sidebar-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function AppPrimaryRail() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    currentModule,
    setCurrentModule,
    toggleCollapse,
    setCollapsed,
    isCollapsed,
  } = useSidebar();

  const handleModuleClick = (mod: ModuleMeta) => {
    (document.activeElement as HTMLElement)?.blur?.();
    if (currentModule === mod.id) {
      toggleCollapse();
    } else {
      setCurrentModule(mod.id);
      setCollapsed(false);
      router.push(mod.defaultHref);
    }
  };

  return (
    <TooltipProvider>
      <nav
        aria-label="Thanh phân hệ chính"
        className="w-14 shrink-0 h-full flex flex-col items-center justify-between py-3 bg-card/60 backdrop-blur-md border-r border-border/70 select-none"
      >
        {/* Top Section */}
        <div className="flex flex-col items-center w-full">
          {/* School Logo */}
          <Link
            href="/"
            aria-label="QCET E-Office Trang chủ"
            className="group relative size-10 rounded-xl flex items-center justify-center hover:scale-105 transition-transform"
          >
            <Image
              src="/logo-qcet.png"
              alt="Logo QCET"
              width={36}
              height={36}
              className="size-9 object-contain drop-shadow-xs"
              priority
            />
          </Link>

          {/* Divider */}
          <div className="w-6 h-px bg-border/70 my-2" />

          {/* Module Buttons with Label Below */}
          <div className="flex flex-col gap-1.5 items-center w-full px-1">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              const isActive = currentModule === mod.id;

              return (
                <Tooltip key={mod.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleModuleClick(mod)}
                      aria-label={mod.label}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "w-full flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 rounded-xl transition-all duration-150 group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring select-none",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <div
                        className={cn(
                          "size-8 rounded-lg flex items-center justify-center transition-all duration-150 relative",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "group-hover:bg-muted/80 text-muted-foreground group-hover:text-foreground"
                        )}
                      >
                        <Icon className="size-4.5" strokeWidth={isActive ? 2 : 1.5} />
                        {mod.isComingSoon && (
                          <span
                            className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-amber-500"
                            title="Đang phát triển"
                          />
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[9.5px] leading-tight text-center truncate max-w-full tracking-tight px-0.5",
                          isActive
                            ? "font-semibold text-primary"
                            : "font-medium text-muted-foreground/80 group-hover:text-foreground"
                        )}
                      >
                        {mod.shortLabel}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" hidden={!isCollapsed && isActive}>
                    <div className="flex items-center gap-1.5">
                      <span>{mod.label}</span>
                      {mod.isComingSoon && (
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded">
                          Đang phát triển
                        </span>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col gap-1 items-center w-full px-1.5">
          {/* Notion status indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                tabIndex={0}
                role="status"
                aria-label="Dữ liệu Notion: Đã kết nối"
                className="size-10 rounded-xl relative flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all cursor-default focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCw className="size-4" />
                <span className="absolute bottom-2 right-2 size-2 rounded-full bg-emerald-500 ring-2 ring-card" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                <span>Dữ liệu Notion: Đã kết nối</span>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Settings button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                aria-label="Cài đặt & Tùy chọn"
                className="size-10 rounded-xl relative flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Settings className="size-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <span>Cài đặt & Tùy chọn</span>
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  );
}
