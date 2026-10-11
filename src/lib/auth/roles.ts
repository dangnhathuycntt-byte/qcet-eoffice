import { AuthUser } from "@/types/auth";
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

export * from "@/types/auth";
