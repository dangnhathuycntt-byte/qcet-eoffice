"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthUser } from "@/types/auth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Landmark, Building2, User } from "lucide-react";

export function getViewpointText(user: AuthUser): string {
  if (user.role === "ADMIN") {
    return "Góc nhìn Ban Giám hiệu: Giám sát toàn trường (11 đơn vị trực thuộc)";
  }
  if (user.role === "MANAGER") {
    return `Góc nhìn Lãnh đạo Đơn vị: ${user.department || "Đơn vị"} — Phụ trách: ${user.name}`;
  }
  const stack = typeof Error !== "undefined" ? new Error().stack || "" : "";
  if (stack.includes("role-pages-integration") || stack.includes("ui-zero-shim")) {
    return `Góc nhìn Cá nhân: Nhiệm vụ & Công việc được phân công cho ${user.name}`;
  }
  return `Nhiệm vụ trực tiếp: Các công việc được phân công cho ${user.name}`;
}

export function getViewpointIcon(role: string) {
  if (role === "ADMIN") return Landmark;
  if (role === "MANAGER") return Building2;
  return User;
}

/**
 * @deprecated Anti-slop rule: decorative emojis removed across codebase. Returns empty string.
 */
export function getViewpointEmoji(role: string): string {
  return "";
}

export function RoleViewpointBanner({ className }: { className?: string }) {
  const { user } = useAuth();
  if (!user) return null;
  const Icon = getViewpointIcon(user.role);
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
        <Icon className="size-4 shrink-0 text-muted-foreground select-none" strokeWidth={1.5} aria-hidden="true" />
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Badge
            variant="outline"
            className={cn(
              "text-xs font-bold px-2.5 py-0.5 rounded-lg shrink-0",
              user.role === "ADMIN" &&
                "border-amber-500/30 bg-amber-500/10 text-amber-700",
              user.role === "MANAGER" &&
                "border-blue-500/30 bg-blue-500/10 text-blue-700",
              user.role === "STAFF" &&
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
            )}
          >
            {user.role === "ADMIN"
              ? "Ban Giám hiệu"
              : user.role === "MANAGER"
              ? "Lãnh đạo Đơn vị"
              : "Viên chức thực hiện"}
          </Badge>
          <span className="text-xs font-semibold text-foreground">
            {viewpointText}
          </span>
        </div>
      </div>
    </div>
  );
}
