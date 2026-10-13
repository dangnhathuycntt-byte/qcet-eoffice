/**
 * Bộ lọc theo người (Người chủ trì, Người phối hợp) và số đếm cho menu lọc kiểu Linear.
 * Giá trị bộ lọc là danh sách token cách nhau dấu phẩy: `me` (tôi), `none` (chưa có ai) hoặc khóa người.
 * Hàm thuần, không phụ thuộc UI.
 */
import type { SchoolTask } from "@/types/dashboard";
import { getTaskUnitId } from "@/lib/tasks/task-unit";

export const PERSON_FILTER_ME = "me";
export const PERSON_FILTER_NONE = "none";

export interface FilterViewer {
  id?: string;
  name?: string;
}

export interface FilterPersonOption {
  key: string;
  name: string;
  avatarUrl?: string;
}

export type TaskFilterFacetKey = "status" | "priority" | "deadline" | "health" | "lead" | "collaborator";

/** Dữ liệu cho menu lọc: danh sách người và số nhiệm vụ theo từng lựa chọn (`counts[nhóm][giá trị]`). */
export interface TaskFilterFacets {
  leadPeople: FilterPersonOption[];
  collaboratorPeople: FilterPersonOption[];
  counts: Record<TaskFilterFacetKey, Record<string, number>>;
}

const PLACEHOLDER_NAMES = new Set(["", "chưa phân công", "chưa phân bổ"]);

function cleanName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return PLACEHOLDER_NAMES.has(trimmed.toLowerCase()) ? null : trimmed;
}

function sameName(a?: string | null, b?: string | null): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

export function parsePersonFilter(value?: string | null): string[] {
  if (!value || value === "all") return [];
  return value.split(",").map((token) => token.trim()).filter(Boolean);
}

/** Khóa người chủ trì: id nếu có, không thì theo tên. `null` khi chưa có người chủ trì. */
export function getTaskLeadKey(task: SchoolTask): string | null {
  const name = cleanName(task.leadAssigneeName);
  if (!name && !task.leadAssigneeId) return null;
  return task.leadAssigneeId || `name:${name}`;
}

/** Người phối hợp của nhiệm vụ (khóa theo tên vì `coAssignees` chỉ lưu tên). */
export function getTaskCollaboratorNames(task: SchoolTask): string[] {
  const names = new Map<string, string>();
  for (const raw of task.coAssignees ?? []) {
    const name = cleanName(raw);
    if (name) names.set(name.toLowerCase(), name);
  }
  return [...names.values()];
}

function isViewerLead(task: SchoolTask, viewer?: FilterViewer | null): boolean {
  if (!viewer) return false;
  return Boolean((viewer.id && task.leadAssigneeId === viewer.id) || sameName(task.leadAssigneeName, viewer.name));
}

export function matchesLeadFilter(task: SchoolTask, tokens: string[], viewer?: FilterViewer | null): boolean {
  if (tokens.length === 0) return true;
  const key = getTaskLeadKey(task);
  return tokens.some((token) => {
    if (token === PERSON_FILTER_NONE) return key === null;
    if (token === PERSON_FILTER_ME) return isViewerLead(task, viewer);
    return key === token;
  });
}

export function matchesCollaboratorFilter(task: SchoolTask, tokens: string[], viewer?: FilterViewer | null): boolean {
  if (tokens.length === 0) return true;
  const names = getTaskCollaboratorNames(task);
  return tokens.some((token) => {
    if (token === PERSON_FILTER_NONE) return names.length === 0;
    if (token === PERSON_FILTER_ME) return names.some((name) => sameName(name, viewer?.name));
    return names.some((name) => `name:${name}` === token);
  });
}

function byName(a: FilterPersonOption, b: FilterPersonOption): number {
  return a.name.localeCompare(b.name, "vi");
}

/** Người chủ trì xuất hiện trong tập nhiệm vụ, bỏ chính người xem (đã có dòng "Tôi"), xếp theo tên. */
export function collectLeadOptions(tasks: SchoolTask[], viewer?: FilterViewer | null): FilterPersonOption[] {
  const people = new Map<string, FilterPersonOption>();
  for (const task of tasks) {
    const key = getTaskLeadKey(task);
    if (!key || isViewerLead(task, viewer) || people.has(key)) continue;
    people.set(key, {
      key,
      name: cleanName(task.leadAssigneeName) ?? "Chưa rõ tên",
      avatarUrl: task.leadAssigneeAvatar || undefined,
    });
  }
  return [...people.values()].sort(byName);
}

/** Người phối hợp xuất hiện trong tập nhiệm vụ, bỏ chính người xem, xếp theo tên. */
export function collectCollaboratorOptions(tasks: SchoolTask[], viewer?: FilterViewer | null): FilterPersonOption[] {
  const people = new Map<string, FilterPersonOption>();
  for (const task of tasks) {
    for (const name of getTaskCollaboratorNames(task)) {
      const key = `name:${name}`;
      if (sameName(name, viewer?.name) || people.has(key)) continue;
      const avatar = task.assignees?.find((person) => sameName(person.name, name))?.avatar;
      people.set(key, { key, name, avatarUrl: avatar || undefined });
    }
  }
  return [...people.values()].sort(byName);
}

export interface RosterPerson {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

/** Đơn vị của người xem, lấy từ nhiệm vụ cùng tên đơn vị (tài khoản phía trình duyệt không mang mã đơn vị). */
export function resolveViewerUnitId(tasks: SchoolTask[], viewerDepartment?: string | null): string | undefined {
  if (!viewerDepartment) return undefined;
  const task = tasks.find((t) =>
    [t.departmentName, t.department, t.leadDepartment].some((name) => sameName(name, viewerDepartment))
  );
  return task ? getTaskUnitId(task) : undefined;
}

/**
 * Thêm cán bộ của đơn vị vào danh sách người (kể cả người chưa có nhiệm vụ nào), bỏ người xem và người đã có.
 * `keyOf` cho khóa lọc tương ứng: người chủ trì theo id, người phối hợp theo tên.
 */
export function withRoster(
  people: FilterPersonOption[],
  roster: RosterPerson[],
  keyOf: (person: RosterPerson) => string,
  viewer?: FilterViewer | null
): FilterPersonOption[] {
  const merged = [...people];
  for (const person of roster) {
    const name = cleanName(person.name);
    if (!name || (viewer?.id && person.id === viewer.id) || sameName(name, viewer?.name)) continue;
    const key = keyOf(person);
    if (merged.some((p) => p.key === key || sameName(p.name, name))) continue;
    merged.push({ key, name, avatarUrl: person.avatarUrl || undefined });
  }
  return merged.sort(byName);
}

/** Nhãn hiển thị cho giá trị bộ lọc người (chip bộ lọc đang áp). */
export function getPersonFilterLabel(
  value: string | null | undefined,
  people: FilterPersonOption[],
  noneLabel: string
): string | null {
  const tokens = parsePersonFilter(value);
  if (tokens.length === 0) return null;
  return tokens
    .map((token) =>
      token === PERSON_FILTER_ME
        ? "Tôi"
        : token === PERSON_FILTER_NONE
          ? noneLabel
          : people.find((person) => person.key === token)?.name ?? token.replace(/^name:/, "")
    )
    .join(", ");
}

/**
 * Số nhiệm vụ cho từng lựa chọn của một nhóm lọc, tính bằng chính hàm lọc của bảng
 * với nhóm đó chỉ chọn lựa chọn ấy (các nhóm khác giữ nguyên) để số trong menu khớp số dòng hiển thị.
 */
export function countFacetOptions(values: string[], countWith: (value: string) => number): Record<string, number> {
  return Object.fromEntries(values.map((value) => [value, countWith(value)]));
}
