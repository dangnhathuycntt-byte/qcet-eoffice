/**
 * Canonical create-task policy (T06 / D5 / §9).
 *
 * Single source of truth for role classification and task-creation capability.
 * Extracted from dashboard/create-task-modal.tsx so that both the dashboard
 * modal and other UI surfaces (workspace toolbar, tasks/create modal) share
 * the same gate.
 */
import type { UserRole, AuthUser } from "@/types/auth";

// ---------------------------------------------------------------------------
// Role classification
// ---------------------------------------------------------------------------

/** The 7 dbRole values that designate an executive (Ban Giám Hiệu) actor. */
export const EXECUTIVE_ROLES = [
  "BAN_GIAM_HIEU",
  "HIEU_TRUONG",
  "PHO_HIEU_TRUONG",
  "BGH",
  "BGH_HT",
  "BGH_PHT_DT",
  "BGH_PHT_CSVC",
] as const;

export function getCanonicalDbRole(user: AuthUser): string {
  return String(user.dbRole || user.role || "").toUpperCase();
}

export function isExecutiveUser(user?: AuthUser | null): boolean {
  const role = user ? getCanonicalDbRole(user) : "";
  return (EXECUTIVE_ROLES as readonly string[]).includes(role);
}

// ---------------------------------------------------------------------------
// Task levels
// ---------------------------------------------------------------------------

export type TaskLevel = "TRUONG" | "DON_VI" | "STAFF";

export function getAllowedTaskLevelsForRole(role: UserRole): TaskLevel[] {
  if (role === "ADMIN") return ["TRUONG", "DON_VI"];
  if (role === "MANAGER") return ["DON_VI"];
  if (role === "STAFF") return [];
  return [];
}

export function getDefaultTaskLevelForRole(role: UserRole): TaskLevel {
  if (role === "ADMIN") return "TRUONG";
  return "DON_VI";
}

// ---------------------------------------------------------------------------
// Create-task policy
// ---------------------------------------------------------------------------

export type CreateTaskMode = "INSTITUTIONAL" | "PERSONAL";

export interface CreateTaskPolicy {
  canCreate: boolean;
  mode: CreateTaskMode;
  /** Institutional levels the actor may author (empty for personal-only actors). */
  institutionalLevels: TaskLevel[];
  defaultLevel: TaskLevel;
}

export function resolveCreateTaskPolicy(user?: AuthUser | null): CreateTaskPolicy {
  const institutionalLevels = user
    ? isExecutiveUser(user)
      ? (["TRUONG", "DON_VI"] as TaskLevel[])
      : ["TRUONG_PHONG", "MANAGER"].includes(getCanonicalDbRole(user))
        ? (["DON_VI"] as TaskLevel[])
        : []
    : [];
  if (!user) {
    return {
      canCreate: false,
      mode: "INSTITUTIONAL",
      institutionalLevels,
      defaultLevel: "DON_VI",
    };
  }

  const hasInstitutionalScope = institutionalLevels.length > 0;
  const canSelfAssign = Boolean(user.departmentCode && user.departmentCode !== "QCET") &&
    (!hasInstitutionalScope || isExecutiveUser(user));

  return {
    canCreate: hasInstitutionalScope || canSelfAssign,
    mode: hasInstitutionalScope ? "INSTITUTIONAL" : "PERSONAL",
    institutionalLevels,
    defaultLevel: hasInstitutionalScope
      ? isExecutiveUser(user)
        ? "TRUONG"
        : "DON_VI"
      : "STAFF",
  };
}
