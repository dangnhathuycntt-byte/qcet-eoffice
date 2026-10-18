import { foldVietnamese } from "@qcet/shared/lib/search/vietnamese-search";

/**
 * Mô hình trang Cơ cấu & Danh bạ (`/org`), dựng từ `GET /api/departments?includePersonnel=true`:
 * đơn vị lấy từ OrganizationalUnit (không dùng cấu hình tĩnh `QCET_ORG_UNITS`, mã ở đó lệch với DB),
 * nhân sự là các PositionAssignment đang hiệu lực, chức vụ theo PositionDefinition.
 */

export interface OrgPersonnelInput {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  position?: string | null;
  positionCode?: string | null;
  isLeadership?: boolean;
}

export interface OrgUnitInput {
  id: string;
  code: string;
  name: string;
  type?: string;
  parentId?: string | null;
  shortName?: string | null;
  description?: string | null;
  displayOrder?: number | null;
  personnel?: OrgPersonnelInput[];
}

export interface OrgMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  position: string | null;
  positionCode: string | null;
  isLeadership: boolean;
  unitId: string;
  unitName: string;
}

export interface OrgUnit {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  /** Cấp lồng dưới đơn vị cấp một (bộ môn trong khoa…), 0 là cấp một. */
  depth: number;
  members: OrgMember[];
  leaders: OrgMember[];
}

export interface OrgGroup {
  type: string;
  label: string;
  units: OrgUnit[];
}

export interface OrgDirectory {
  /** Đơn vị theo thứ tự hiển thị: nhóm theo loại, đơn vị con ngay sau đơn vị cha. */
  units: OrgUnit[];
  groups: OrgGroup[];
  /** Số người khác nhau (một người có thể giữ chức vụ ở hai đơn vị). */
  peopleCount: number;
}

/** Nhãn nhóm theo `UnitType` (prisma/schema.prisma). */
export const UNIT_TYPE_LABELS: Record<string, string> = {
  SCHOOL: "Cấp trường",
  DEPARTMENT: "Phòng chức năng",
  FACULTY: "Khoa",
  CENTER: "Trung tâm",
  SECTION: "Bộ môn, tổ",
  OTHER: "Đơn vị khác",
};

const TYPE_ORDER = ["SCHOOL", "DEPARTMENT", "FACULTY", "CENTER", "SECTION", "OTHER"];

const compareVi = (a: string, b: string) => a.localeCompare(b, "vi");

/** Tên gọi (từ cuối) theo thói quen xếp danh sách người Việt. */
function givenName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? "";
}

/** Hiệu trưởng trước, rồi trưởng đơn vị, rồi cấp phó, rồi những người còn lại. */
function leaderRank(member: OrgMember): number {
  if (!member.isLeadership) return 3;
  if (member.positionCode === "HIEU_TRUONG") return 0;
  return member.positionCode?.startsWith("PHO_") ? 2 : 1;
}

export function compareMembers(a: OrgMember, b: OrgMember): number {
  return leaderRank(a) - leaderRank(b) || compareVi(givenName(a.name), givenName(b.name)) || compareVi(a.name, b.name);
}

function compareUnits(a: OrgUnitInput, b: OrgUnitInput): number {
  const order = (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER);
  return order || compareVi(a.name, b.name);
}

function toUnit(input: OrgUnitInput, depth: number): OrgUnit {
  const members = (input.personnel ?? [])
    .map<OrgMember>((p) => ({
      id: p.id,
      name: p.name,
      email: p.email ?? "",
      phone: p.phone?.trim() || null,
      avatarUrl: p.avatarUrl ?? null,
      position: p.position ?? null,
      positionCode: p.positionCode ?? null,
      isLeadership: Boolean(p.isLeadership),
      unitId: input.id,
      unitName: input.name,
    }))
    .sort(compareMembers);
  return {
    id: input.id,
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    type: input.type ?? "OTHER",
    depth,
    members,
    leaders: members.filter((m) => m.isLeadership),
  };
}

export function buildOrgDirectory(inputs: OrgUnitInput[]): OrgDirectory {
  const ids = new Set(inputs.map((u) => u.id));
  const children = new Map<string | null, OrgUnitInput[]>();
  for (const unit of inputs) {
    const parent = unit.parentId && ids.has(unit.parentId) ? unit.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), unit]);
  }
  for (const list of children.values()) list.sort(compareUnits);

  const byType = new Map<string, OrgUnit[]>();
  const add = (unit: OrgUnit, type: string) => byType.set(type, [...(byType.get(type) ?? []), unit]);
  // Đơn vị con đi cùng nhóm với đơn vị cấp một chứa nó
  const visit = (unit: OrgUnitInput, depth: number, groupType: string) => {
    add(toUnit(unit, depth), groupType);
    for (const child of children.get(unit.id) ?? []) visit(child, depth + 1, groupType);
  };
  for (const root of children.get(null) ?? []) {
    if (root.type === "SCHOOL") {
      // Trường là gốc: đứng riêng ở nhóm "Cấp trường", các đơn vị trực thuộc thành cấp một
      add(toUnit(root, 0), "SCHOOL");
      for (const child of children.get(root.id) ?? []) visit(child, 0, child.type ?? "OTHER");
    } else {
      visit(root, 0, root.type ?? "OTHER");
    }
  }

  const types = [...TYPE_ORDER, ...[...byType.keys()].filter((t) => !TYPE_ORDER.includes(t))];
  const groups = types
    .filter((type) => byType.has(type))
    .map((type) => ({ type, label: UNIT_TYPE_LABELS[type] ?? UNIT_TYPE_LABELS.OTHER, units: byType.get(type)! }));
  const units = groups.flatMap((g) => g.units);
  const peopleCount = new Set(units.flatMap((u) => u.members.map((m) => m.id))).size;
  return { units, groups, peopleCount };
}

/** Mọi từ trong truy vấn đều phải khớp (không phân biệt dấu). Số điện thoại so theo chữ số. */
function matchesTokens(haystack: string, query: string): boolean {
  const tokens = foldVietnamese(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const folded = foldVietnamese(haystack);
  return tokens.every((token) => folded.includes(token));
}

export function matchesMember(member: OrgMember, query: string): boolean {
  const digits = member.phone?.replace(/\D/g, "") ?? "";
  return matchesTokens([member.name, member.email, member.position ?? "", member.unitName, digits].join(" "), query);
}

export function matchesUnit(unit: OrgUnit, query: string): boolean {
  return matchesTokens([unit.name, unit.code, ...unit.leaders.map((l) => l.name)].join(" "), query);
}

export interface DirectorySection {
  unit: OrgUnit;
  members: OrgMember[];
}

/**
 * Danh bạ theo từng đơn vị sau khi lọc. Đã chọn một đơn vị thì luôn trả về đơn vị đó (kể cả khi rỗng)
 * để trang nói rõ "đơn vị chưa có nhân sự" thay vì "không tìm thấy".
 */
export function filterDirectory(
  directory: OrgDirectory,
  { unitId, leadersOnly, query }: { unitId?: string | null; leadersOnly?: boolean; query?: string },
): DirectorySection[] {
  const units = unitId ? directory.units.filter((u) => u.id === unitId) : directory.units;
  return units
    .map((unit) => ({
      unit,
      members: unit.members.filter((m) => (!leadersOnly || m.isLeadership) && (!query || matchesMember(m, query))),
    }))
    .filter((section) => unitId || section.members.length > 0);
}

export function countPeople(sections: DirectorySection[]): number {
  return new Set(sections.flatMap((s) => s.members.map((m) => m.id))).size;
}

/** Ô CSV: bọc ngoặc kép, nhân đôi ngoặc kép bên trong; chặn công thức Excel ở đầu ô (=, @, +/- không theo sau là số). */
function csvCell(value: string): string {
  const safe = /^[=@\t\r]/.test(value) || /^[+-](?!\d)/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function directoryToCsv(sections: DirectorySection[]): string {
  const header = ["Họ và tên", "Chức vụ", "Đơn vị", "Email", "Điện thoại"];
  const rows = sections.flatMap((s) => s.members.map((m) => [m.name, m.position ?? "", m.unitName, m.email, m.phone ?? ""]));
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
