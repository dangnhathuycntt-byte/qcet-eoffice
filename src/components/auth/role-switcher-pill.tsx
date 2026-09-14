"use client";

import { Landmark, Building2, User, ArrowRightLeft } from "lucide-react";
import { UserRole } from "@/types/auth";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export interface RoleConfigItem {
  role: UserRole;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Landmark;
  color: string;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfigItem> = {
  ADMIN: {
    role: "ADMIN",
    label: "Ban Giám hiệu",
    shortLabel: "BGH",
    description: "Ban Giám hiệu (Toàn quyền)",
    icon: Landmark,
    color: "text-amber-700 bg-amber-500/10 border-amber-500/30",
  },
  MANAGER: {
    role: "MANAGER",
    label: "Trưởng đơn vị",
    shortLabel: "Trưởng đơn vị",
    description: "Lãnh đạo Phòng / Khoa / Trung tâm",
    icon: Building2,
    color: "text-blue-700 bg-blue-500/10 border-blue-500/30",
  },
  STAFF: {
    role: "STAFF",
    label: "Chuyên viên",
    shortLabel: "Chuyên viên",
    description: "Gi��ng viên / Chuyên viên thực hiện",
    icon: User,
    color: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30",
  },
};

export const ROLE_ORDER: UserRole[] = ["ADMIN", "MANAGER", "STAFF"];

/**
 * Dev-only role switcher pill.
 * Cho phép chuyển đổi nhanh giữa các role (ADMIN / MANAGER / STAFF)
 * để test giao diện theo góc nhìn từng vai trò.
 *
 * Chỉ hiển thị khi NODE_ENV === 'development'.
 */
export function RoleSwitcherPill({ className }: { className?: string }) {
  if (process.env.NODE_ENV !== "development") return null;

  return <RoleSwitcherPillInner className={className} />;
}

function RoleSwitcherPillInner({ className }: { className?: string }) {
  const { user, switchRole } = useAuth();

  if (!user) return null;

  const currentConfig = ROLE_CONFIGS[user.role] || ROLE_CONFIGS.STAFF;
  const CurrentIcon = currentConfig.icon;

  return (
    <div
      data-slot="role-switcher-pill"
      className={cn("flex flex-col gap-1", className)}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 border border-orange-200/60">
        <ArrowRightLeft size={12} strokeWidth={1.5} className="text-orange-500 shrink-0" />
        <span className="text-xs font-medium text-orange-700">
          Test: Chuyển đổi vai trò
        </span>
      </div>
      <div className="flex items-center gap-1">
        {ROLE_ORDER.map((role) => {
          const config = ROLE_CONFIGS[role];
          const Icon = config.icon;
          const isActive = user.role === role;
          return (
            <button
              key={role}
              type="button"
              onClick={() => switchRole(role)}
              title={config.description}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all cursor-pointer active:scale-[0.97]",
                isActive
                  ? cn(config.color, "ring-1 ring-current/20 shadow-xs font-semibold")
                  : "text-muted-foreground bg-transparent border-transparent hover:bg-secondary hover:border-border/50"
              )}
            >
              <Icon size={13} strokeWidth={1.5} className="shrink-0" />
              <span className="hidden sm:inline">{config.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
