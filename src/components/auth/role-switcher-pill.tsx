"use client";

import { Landmark, Building2, User } from "lucide-react";
import { UserRole } from "@/types/auth";

export interface RoleConfigItem {
  role: UserRole;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Landmark;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfigItem> = {
  ADMIN: {
    role: "ADMIN",
    label: "Ban Giám hiệu",
    shortLabel: "BGH",
    description: "Ban Giám hiệu (Toàn quyền)",
    icon: Landmark,
  },
  MANAGER: {
    role: "MANAGER",
    label: "Trưởng đơn vị",
    shortLabel: "Trưởng đơn vị",
    description: "Lãnh đạo Phòng / Khoa / Trung tâm",
    icon: Building2,
  },
  STAFF: {
    role: "STAFF",
    label: "Chuyên viên",
    shortLabel: "Chuyên viên",
    description: "Giảng viên / Chuyên viên thực hiện",
    icon: User,
  },
};

export const ROLE_ORDER: UserRole[] = ["ADMIN", "MANAGER", "STAFF"];

/**
 * Decommissioned in production/standard mode.
 * Roles are strictly authenticated via database/JWT session; no client-side switching shims allowed.
 */
export function RoleSwitcherPill({ className }: { className?: string }) {
  return null;
}
