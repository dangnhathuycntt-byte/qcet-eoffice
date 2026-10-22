/**
 * Phạm vi mời họp cả nhóm ("Phạm vi" trong bộ chọn Thành phần): chọn nhanh Toàn trường, Ban Giám hiệu, trưởng đơn vị…
 * thay vì chọn từng người hay từng đơn vị. Chỉ dựa vào mã chức vụ đang có trong danh bạ (`positionCode`); nhóm không có
 * ai thì ẩn. Thuần túy, không đọc DB.
 */
import {
  isDeputyUnitLeaderPosition,
  isExecutivePosition,
  isLecturerPosition,
  isUnitLeaderPosition,
} from "../organization/position-groups";

export type AudienceScopeId = "all" | "executive" | "unit-head" | "unit-deputy" | "lecturer";

export interface AudienceScopePerson {
  id: string;
  /** Mã chức vụ ở mọi đơn vị người đó có mặt (người kiêm nhiệm có nhiều mã) */
  positionCodes?: readonly string[];
}

export interface AudienceScopeGroup<T extends AudienceScopePerson> {
  id: AudienceScopeId;
  label: string;
  people: T[];
}

const SCOPES: ReadonlyArray<{ id: AudienceScopeId; label: string; matches: (codes: readonly string[]) => boolean }> = [
  { id: "all", label: "Toàn trường", matches: () => true },
  { id: "executive", label: "Ban Giám hiệu", matches: (codes) => codes.some(isExecutivePosition) },
  { id: "unit-head", label: "Trưởng đơn vị", matches: (codes) => codes.some(isUnitLeaderPosition) },
  { id: "unit-deputy", label: "Phó trưởng đơn vị", matches: (codes) => codes.some(isDeputyUnitLeaderPosition) },
  { id: "lecturer", label: "Giảng viên", matches: (codes) => codes.some(isLecturerPosition) },
];

/** Các phạm vi có ít nhất một người, theo thứ tự cố định; mỗi người nằm trong mọi phạm vi họ thuộc về. */
export function audienceScopeGroups<T extends AudienceScopePerson>(people: readonly T[]): AudienceScopeGroup<T>[] {
  return SCOPES.map((scope) => ({
    id: scope.id,
    label: scope.label,
    people: people.filter((person) => scope.matches(person.positionCodes ?? [])),
  })).filter((group) => group.people.length > 0);
}
