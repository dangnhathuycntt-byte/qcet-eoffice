"use client";

import * as React from "react";

export interface DepartmentPersonnel {
  id: string;
  name: string;
  email?: string;
  role?: string;
  title?: string;
}

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  color?: string | null;
  personnel?: DepartmentPersonnel[];
}

/**
 * Module-level cache — avoids re-fetching when multiple components mount
 * simultaneously. Keyed by includePersonnel flag.
 */
const _cache: Record<string, DepartmentOption[] | null> = {};
const _cacheTimestamp: Record<string, number> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const _inflight: Record<string, Promise<DepartmentOption[]> | null> = {};

async function fetchDepartments(
  includePersonnel: boolean,
): Promise<DepartmentOption[]> {
  const key = includePersonnel ? "with-personnel" : "basic";
  const now = Date.now();
  if (_cache[key] && (now - (_cacheTimestamp[key] || 0)) < CACHE_TTL_MS) {
    return _cache[key]!;
  }
  if (_inflight[key]) return _inflight[key]!;

  const url = includePersonnel
    ? "/api/departments?includePersonnel=true"
    : "/api/departments";

  _inflight[key] = fetch(url)
    .then((r) => r.json())
    .then((data): DepartmentOption[] => {
      if (data.success && Array.isArray(data.departments)) {
        _cache[key] = data.departments;
        _cacheTimestamp[key] = Date.now();
      } else {
        _cache[key] = [];
        _cacheTimestamp[key] = Date.now();
      }
      return _cache[key]!;
    })
    .catch((): DepartmentOption[] => {
      _cache[key] = [];
      _cacheTimestamp[key] = Date.now();
      return _cache[key]!;
    })
    .finally(() => {
      _inflight[key] = null;
    });

  return _inflight[key]!;
}

/**
 * Shared hook that fetches the department list from `/api/departments`.
 *
 * Follows the same module-level cache + dedup inflight pattern
 * as `usePersonnelList()`.
 *
 * @param options.enabled - When false the fetch is skipped (default: true).
 * @param options.includePersonnel - When true, includes users per department.
 */
export function useDepartmentList(
  options?: { enabled?: boolean; includePersonnel?: boolean },
): { departments: DepartmentOption[]; isLoading: boolean } {
  const enabled = options?.enabled ?? true;
  const includePersonnel = options?.includePersonnel ?? false;
  const key = includePersonnel ? "with-personnel" : "basic";

  const [departments, setDepartments] = React.useState<DepartmentOption[]>(
    _cache[key] ?? [],
  );
  const [isLoading, setIsLoading] = React.useState(!_cache[key] && enabled);

  React.useEffect(() => {
    if (!enabled) return;
    if (_cache[key]) {
      setDepartments(_cache[key]!);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void fetchDepartments(includePersonnel).then((list) => {
      if (!cancelled) {
        setDepartments(list);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, includePersonnel, key]);

  return { departments, isLoading };
}
