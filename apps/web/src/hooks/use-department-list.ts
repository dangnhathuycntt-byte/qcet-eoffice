"use client";

import * as React from "react";
import { QCET_ORG_UNITS } from "@/lib/org/org-structure";

export interface DepartmentPersonnel {
  id: string;
  name: string;
  email?: string;
  role?: string;
  title?: string;
  avatarUrl?: string | null;
  phone?: string | null;
  /** Chức vụ theo PositionDefinition (vd. "Trưởng khoa / Trưởng bộ môn trực thuộc"). */
  position?: string | null;
  positionCode?: string | null;
  isLeadership?: boolean;
}

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  color?: string | null;
  /** `UnitType` của OrganizationalUnit: SCHOOL, FACULTY, DEPARTMENT, CENTER, SECTION, OTHER. */
  type?: string;
  parentId?: string | null;
  shortName?: string | null;
  description?: string | null;
  displayOrder?: number | null;
  personnel?: DepartmentPersonnel[];
}

export const STATIC_FALLBACK_DEPARTMENTS: DepartmentOption[] = QCET_ORG_UNITS.map((u) => ({
  id: u.id,
  name: u.name,
  code: u.code,
  color: null,
  personnel: [],
}));

/**
 * Module-level cache — avoids re-fetching when multiple components mount
 * simultaneously. Keyed by includePersonnel flag.
 */
const _cache: Record<string, DepartmentOption[] | null> = {};
const _cacheTimestamp: Record<string, number> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const _inflight: Record<string, Promise<DepartmentOption[]> | null> = {};

/**
 * Chỉ ghi vào bộ nhớ đệm khi máy chủ trả về danh sách hợp lệ. Lỗi mạng, 401/429/5xx hoặc thân không phải danh sách thì
 * ném lỗi mà không ghi gì: trước đây lỗi thoáng qua bị lưu thành danh sách rỗng 5 phút, bộ chọn người báo "chưa có
 * danh sách cán bộ" và không có cách tải lại.
 */
export async function fetchDepartments(
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
    .then(async (response): Promise<DepartmentOption[]> => {
      const data = await response.json().catch(() => null);
      const items = !response.ok
        ? null
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.departments)
            ? data.departments
            : null;
      if (!items) throw new Error(`Không tải được danh sách đơn vị (${response.status})`);
      _cache[key] = items;
      _cacheTimestamp[key] = Date.now();
      return items;
    })
    .finally(() => {
      _inflight[key] = null;
    });

  return _inflight[key]!;
}

/** Xóa bộ nhớ đệm (dùng trong kiểm thử). */
export function resetDepartmentListCache(): void {
  for (const key of Object.keys(_cache)) {
    delete _cache[key];
    delete _cacheTimestamp[key];
    _inflight[key] = null;
  }
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
): { departments: DepartmentOption[]; isLoading: boolean; error: boolean; reload: () => void } {
  const enabled = options?.enabled ?? true;
  const includePersonnel = options?.includePersonnel ?? false;
  const key = includePersonnel ? "with-personnel" : "basic";

  const [departments, setDepartments] = React.useState<DepartmentOption[]>(
    _cache[key] ?? STATIC_FALLBACK_DEPARTMENTS,
  );
  const [isLoading, setIsLoading] = React.useState(!_cache[key] && enabled);
  const [error, setError] = React.useState(false);
  // Tăng khi người dùng bấm "Thử lại" sau một lần tải lỗi
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) return;
    if (_cache[key]) {
      setDepartments(_cache[key]!);
      setIsLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(false);
    fetchDepartments(includePersonnel).then(
      (list) => {
        if (!cancelled) {
          setDepartments(list);
          setIsLoading(false);
        }
      },
      () => {
        // Lỗi không vào bộ nhớ đệm: lần mở sau hoặc "Thử lại" tải lại
        if (!cancelled) {
          setDepartments([]);
          setError(true);
          setIsLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, includePersonnel, key, attempt]);

  const reload = React.useCallback(() => setAttempt((n) => n + 1), []);
  return { departments, isLoading, error, reload };
}
