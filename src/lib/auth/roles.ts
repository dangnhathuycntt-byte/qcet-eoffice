import { AuthUser, UserRole } from "@/types/auth";
import { isExecutiveUser, isManagerUser } from "@/components/layout/scope-switcher";

export { isExecutiveUser, isManagerUser };

export function isExecutive(user?: AuthUser | null): boolean {
  return isExecutiveUser(user);
}

export function isManager(user?: AuthUser | null): boolean {
  return isManagerUser(user);
}

export function isStaff(user?: AuthUser | null): boolean {
  return user?.role === "STAFF";
}

export function canCreateSchoolTask(user?: AuthUser | null): boolean {
  return isExecutive(user);
}

export function canAssignUnitTask(user?: AuthUser | null): boolean {
  return isExecutive(user) || isManager(user);
}

export function canSelfAssignTask(user?: AuthUser | null): boolean {
  return isStaff(user);
}

export function canDelegateRole(user?: AuthUser | null): boolean {
  return isExecutive(user) || isManager(user);
}

export function canConfigureVTVL(user?: AuthUser | null): boolean {
  return isExecutive(user);
}

export function isScopeAllowed(role: UserRole | undefined | null, scope: "school" | "unit" | "my"): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;
  if (role === "MANAGER") return scope === "unit" || scope === "my";
  if (role === "STAFF") return scope === "my";
  return false;
}

export * from "@/types/auth";
