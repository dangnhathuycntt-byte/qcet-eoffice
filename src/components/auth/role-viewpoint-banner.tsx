"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthUser } from "@/types/auth";
import { Badge } from "@/components/ui/badge";
import { RoleSwitcherPill } from "@/components/auth/role-switcher-pill";
import { cn } from "@/lib/utils";

export function getViewpointText(user: AuthUser): string {
  if (user.role === "ADMIN") {
    return "Góc nhìn Ban Giám hiệu: Giám sát toàn trường (11 đơn vị trực thuộc)";
  }
  if (user.role === "MANAGER") {
    return `Góc nhìn Lãnh đạo Đơn vị: ${user.department || "Đơn vị"} — Phụ trách: ${user.name}`;
  }
  return `Góc nhìn Cá nhân: Nhiệm vụ & Công việc được phân công cho ${user.name}`;
}

export function getViewpointEmoji(role: string): string {
  if (role === "ADMIN") return "🏛️";
  if (role === "MANAGER") return "🏢";
  return "👤";
}

export function RoleViewpointBanner({ className }: { className?: string }) {
  const { user } = useAuth();
  const emoji = getViewpointEmoji(user.role);
  const viewpointText = getViewpointText(user);

  return (
    <div
      data-slot="role-viewpoint-banner"
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card/80 backdrop-blur-xl p-3 shadow-card sm:flex-row sm:items-center sm:justify-between transition-colors",
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base shrink-0 select-none" aria-hidden="true">
          {emoji}
        </span>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Badge
            variant="outline"
            className={cn(
              "text-[11px] font-bold px-2.5 py-0.5 rounded-lg shrink-0",
              user.role === "ADMIN" &&
                "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
              user.role === "MANAGER" &&
                "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
              user.role === "STAFF" &&
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            )}
          >
            {user.role === "ADMIN"
              ? "Ban Giám hiệu"
              : user.role === "MANAGER"
              ? "Lãnh đạo Đơn vị"
              : "Cá nhân"}
          </Badge>
          <span className="text-xs font-semibold text-foreground">
            {viewpointText}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        <span className="text-[11px] text-muted-foreground hidden md:inline font-medium">
          Chuyển góc nhìn:
        </span>
        <RoleSwitcherPill />
      </div>
    </div>
  );
}
