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
  avatarUrl?: string | null;
}

/**
 * Module-level cache — avoids re-fetching when multiple components mount
 * simultaneously (e.g. identity-block + sidebar both call `usePersonnelList`).
 * Khóa theo đơn vị (`""` = toàn trường) để mỗi đơn vị chỉ tải danh sách của mình một lần.
 */
const _cache = new Map<string, PersonnelOption[]>();
const _inflight = new Map<string, Promise<PersonnelOption[]>>();

/**
 * Chỉ ghi vào bộ nhớ đệm khi máy chủ trả về danh sách hợp lệ; lỗi mạng, 401/429/5xx hay thân không phải danh sách thì trả
 * rỗng mà không ghi gì (trước đây bị lưu thành danh sách rỗng đến khi tải lại trang), lần mở sau tải lại.
 */
export async function fetchPersonnel(departmentId?: string): Promise<PersonnelOption[]> {
  const key = departmentId ?? "";
  const cached = _cache.get(key);
  if (cached) return cached;
  const pending = _inflight.get(key);
  if (pending) return pending;

  // Theo đơn vị: lấy đủ cán bộ của đơn vị đó (API mặc định chỉ trả 20 người đầu).
  const url = departmentId ? `/api/users?departmentId=${encodeURIComponent(departmentId)}&limit=100` : "/api/users";
  const request = fetch(url)
    .then((r) => r.json())
    .then((data): PersonnelOption[] => {
      if (!(data?.success && Array.isArray(data.users))) return [];
      const list: PersonnelOption[] = data.users.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        departmentName: u.department?.name || u.departmentName || "Đơn vị",
        title: u.position || u.title || null,
        role: u.role || null,
        avatarUrl: u.avatarUrl || null,
      }));
      _cache.set(key, list);
      return list;
    })
    .catch((): PersonnelOption[] => [])
    .finally(() => {
      _inflight.delete(key);
    });

  _inflight.set(key, request);
  return request;
}

/** Xóa bộ nhớ đệm (dùng trong kiểm thử). */
export function resetPersonnelListCache(): void {
  _cache.clear();
  _inflight.clear();
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
  options?: { enabled?: boolean; departmentId?: string },
): { personnel: PersonnelOption[]; isLoading: boolean } {
  const enabled = options?.enabled ?? true;
  const departmentId = options?.departmentId;
  const key = departmentId ?? "";
  const [personnel, setPersonnel] = React.useState<PersonnelOption[]>(_cache.get(key) ?? []);
  const [isLoading, setIsLoading] = React.useState(!_cache.has(key) && enabled);

  React.useEffect(() => {
    if (!enabled) return;
    const cached = _cache.get(key);
    if (cached) {
      setPersonnel(cached);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setPersonnel([]);
    setIsLoading(true);
    void fetchPersonnel(departmentId).then((list) => {
      if (!cancelled) {
        setPersonnel(list);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [enabled, key, departmentId]);

  return { personnel, isLoading };
}
