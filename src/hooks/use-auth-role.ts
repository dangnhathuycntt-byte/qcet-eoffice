"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import type { AuthUser, UserRole } from "@/types/auth";

export interface AuthRoleFlags {
  role: UserRole | null;
  rawRole: string | null;
  isAdmin: boolean;
  isBGH: boolean;
  isExecutive: boolean;
  isDepartmentHead: boolean;
  isManager: boolean;
  isLeader: boolean;
  isLecturer: boolean;
  isStaff: boolean;
  isReady: boolean;
  user: AuthUser | null;
}

/**
 * Normalizes role strings / aliases into standard UserRole ('ADMIN' | 'MANAGER' | 'STAFF').
 */
export function normalizeUserRole(candidate?: string | null): UserRole | null {
  if (!candidate) return null;
  const upper = candidate.trim().toUpperCase();
  if (
    upper === "ADMIN" ||
    upper === "BGH" ||
    upper === "BAN_GIAM_HIEU" ||
    upper === "HIEU_TRUONG" ||
    upper === "PHO_HIEU_TRUONG" ||
    upper === "EXECUTIVE"
  ) {
    return "ADMIN";
  }
  if (
    upper === "MANAGER" ||
    upper === "TRUONG_DON_VI" ||
    upper === "TRUONG_PHONG" ||
    upper === "TRUONG_KHOA" ||
    upper === "PHO_PHONG" ||
    upper === "PHO_KHOA" ||
    upper === "LEADER" ||
    upper === "DEPARTMENT_HEAD" ||
    upper === "DEAN"
  ) {
    return "MANAGER";
  }
  if (
    upper === "STAFF" ||
    upper === "GIANG_VIEN" ||
    upper === "CHUYEN_VIEN" ||
    upper === "LECTURER"
  ) {
    return "STAFF";
  }
  return null;
}

/**
 * Pure role flags resolver.
 * Computes boolean flags based purely on the user's role without React state subscriptions.
 */
export function resolveRoleFlags(
  user: AuthUser | null,
  isLoading?: boolean
): AuthRoleFlags {
  const isReady = isLoading !== undefined ? !isLoading : true;

  if (!user) {
    return {
      role: null,
      rawRole: null,
      isAdmin: false,
      isBGH: false,
      isExecutive: false,
      isDepartmentHead: false,
      isManager: false,
      isLeader: false,
      isLecturer: false,
      isStaff: false,
      isReady,
      user: null,
    };
  }

  const rawRole =
    (user as { rawRole?: string }).rawRole ||
    user.dbRole ||
    (user.role ? String(user.role) : null) ||
    null;

  const role: UserRole | null =
    normalizeUserRole(user.role) ||
    normalizeUserRole(user.dbRole) ||
    normalizeUserRole(rawRole) ||
    (user.role ?? null);

  const isAdmin = role === "ADMIN";
  const isBGH = role === "ADMIN";
  const isExecutive = role === "ADMIN";

  const isDepartmentHead = role === "MANAGER";
  const isManager = role === "MANAGER";
  const isLeader = role === "MANAGER";

  const isLecturer = role === "STAFF";
  const isStaff = role === "STAFF";

  return {
    role,
    rawRole,
    isAdmin,
    isBGH,
    isExecutive,
    isDepartmentHead,
    isManager,
    isLeader,
    isLecturer,
    isStaff,
    isReady,
    user,
  };
}

/**
 * Lightweight hook providing memoized role flags.
 * Decouples caller components from heavy dashboard tasks and filter contexts.
 * Gracefully falls back if consumed outside AuthProvider or during SSR.
 */
export function useAuthRole(): AuthRoleFlags {
  let user: AuthUser | null = null;
  let isLoading = false;

  try {
    const auth = useAuth();
    user = auth?.user ?? null;
    isLoading = typeof auth?.isLoading === "boolean" ? auth.isLoading : false;
  } catch {
    user = null;
    isLoading = false;
  }

  return React.useMemo(() => {
    return resolveRoleFlags(user, isLoading);
  }, [user, isLoading]);
}
