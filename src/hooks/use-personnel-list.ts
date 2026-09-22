"use client";

import * as React from "react";

/**
 * Shared personnel option interface.
 *
 * Replaces the identical `TaskPersonnelOption` that was defined locally in
 * task-property-controls.tsx and the ad-hoc inline types in 5+ other files.
 */
export interface PersonnelOption {
  id: string;
  name: string;
  email?: string;
  departmentName?: string;
  /** Academic title, e.g. "ThS. Nguyễn Văn A" */
  title?: string;
  /** UserRole from DB */
  role?: string;
}

/**
 * Module-level cache — avoids re-fetching when multiple components mount
 * simultaneously (e.g. identity-block + sidebar both call `usePersonnelList`).
 */
let _cache: PersonnelOption[] | null = null;
let _inflight: Promise<PersonnelOption[]> | null = null;

async function fetchPersonnel(): Promise<PersonnelOption[]> {
  if (_cache) return _cache;
  if (_inflight) return _inflight;

  _inflight = fetch("/api/users")
    .then((r) => r.json())
    .then((data): PersonnelOption[] => {
      if (data.success && Array.isArray(data.users)) {
        _cache = data.users.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          departmentName: u.department?.name || u.departmentName || "Đơn vị",
          title: u.position || u.title || null,
          role: u.role || null,
        }));
      } else {
        _cache = [];
      }
      return _cache!;
    })
    .catch((): PersonnelOption[] => {
      _cache = [];
      return _cache;
    })
    .finally(() => {
      _inflight = null;
    });

  return _inflight!;
}

/**
 * Shared hook that fetches the personnel list from `/api/users`.
 *
 * Replaces 5+ identical `useState + useEffect(fetch("/api/users"))` blocks
 * scattered across task-identity-block, subtask-detail-drawer,
 * task-properties-sidebar, and create-task-modal.
 *
 * @param options.enabled - When false the fetch is skipped (default: true).
 *   Pass `canEdit` so read-only views never fire the request.
 */
export function usePersonnelList(
  options?: { enabled?: boolean },
): { personnel: PersonnelOption[]; isLoading: boolean } {
  const enabled = options?.enabled ?? true;
  const [personnel, setPersonnel] = React.useState<PersonnelOption[]>(_cache ?? []);
  const [isLoading, setIsLoading] = React.useState(!_cache && enabled);

  React.useEffect(() => {
    if (!enabled) return;
    if (_cache) {
      setPersonnel(_cache);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void fetchPersonnel().then((list) => {
      if (!cancelled) {
        setPersonnel(list);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [enabled]);

  return { personnel, isLoading };
}
