"use client";

import * as React from "react";
import type {
  SchoolTask,
  StaffTask,
  UpcomingItem,
  ActivityEvent,
  DashboardStats,
} from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import type { WorkspaceZone } from "@/types/workspace";

export interface BentoPortalHubProps {
  tasks?: SchoolTask[];
  stats?: DashboardStats;
  upcoming?: UpcomingItem[];
  activities?: ActivityEvent[];
  user?: AuthUser | null;
  onNavigateZone?: (zone: WorkspaceZone) => void;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onOpenCreateTask?: (level?: "TRUONG" | "DON_VI", parentId?: string) => void;
  onManualRefresh?: () => void;
  isRefreshing?: boolean;
}

/**
 * BentoPortalHub legacy placeholder component (QCET Academic Year 2025-2026).
 * Neutralized to prevent bundle bloat and eliminate AI slop nesting.
 */
export function BentoPortalHub(_props?: BentoPortalHubProps) {
  return null;
}
