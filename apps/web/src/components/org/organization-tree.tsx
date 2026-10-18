import type { DepartmentCategory, OrgUnitConfig } from "@/lib/org/org-structure";
import type { DepartmentOption } from "@/hooks/use-department-list";

export type { DepartmentCategory } from "@/lib/org/org-structure";

/**
 * Kiểu và helper đơn vị dựng từ cấu hình tĩnh `QCET_ORG_UNITS`, còn dùng cho bộ chọn phạm vi
 * (`layout/scope-switcher.tsx`). Trang Cơ cấu & Danh bạ (`/org`) đã chuyển sang dữ liệu DB:
 * `components/org/org-directory-view.tsx` + `lib/org/org-directory.ts`.
 */

// ============================================================================
// 1. Data Types & Interfaces
// ============================================================================
export interface StaffMember {
  id: string;
  name: string;
  titlePrefix?: string;
  role: string;
  email: string;
  phone?: string;
  avatar?: string;
  departmentId: string;
  departmentName: string;
  status: "ACTIVE" | "ON_LEAVE" | "BUSY";
  room?: string;
  responsibilities?: string[];
}

export interface DepartmentNode {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  category: DepartmentCategory;
  categoryLabel: string;
  description: string;
  location: string;
  phone: string;
  email: string;
  leaderName: string;
  leaderRole: string;
  members: StaffMember[];
  groupField?: "Nhóm" | "Nhóm công tác";
  externalDbKey?: string;
}

// ============================================================================
// 2. Build DepartmentNode[] from static config + API personnel
// ============================================================================

export function buildDepartmentNodes(
  orgUnits: OrgUnitConfig[],
  apiDepartments: DepartmentOption[],
): DepartmentNode[] {
  return orgUnits.map((unit) => {
    const apiDept = apiDepartments.find(
      (d) => d.code === unit.code || d.id === unit.code,
    );
    const members: StaffMember[] = (apiDept?.personnel ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      titlePrefix:
        p.title?.match(
          /^(ThS\.|TS\.|PGS\.TS\.|GS\.TS\.|PGS\.|GS\.|BS\.|CN\.|KS\.|GVC\.)\s*/i,
        )?.[1] || "",
      role: p.role || "",
      email: p.email || "",
      departmentId: unit.id,
      departmentName: unit.name,
      status: "ACTIVE" as const,
    }));
    const leader =
      members.find((m) =>
        ["TRUONG_DON_VI", "BAN_GIAM_HIEU", "ADMIN"].includes(m.role),
      ) || members[0];
    return {
      ...unit,
      leaderName: leader ? `${leader.titlePrefix} ${leader.name}`.trim() : "",
      leaderRole: leader?.role || "",
      members,
    };
  });
}

// ============================================================================
// 3. Search & Filter Helpers
// ============================================================================

export function filterStaffMembers(
  departments: DepartmentNode[],
  query: string
): StaffMember[] {
  const allStaff: StaffMember[] = [];
  const seenIds = new Set<string>();

  for (const dept of departments) {
    for (const member of dept.members) {
      if (!seenIds.has(member.id)) {
        seenIds.add(member.id);
        allStaff.push(member);
      }
    }
  }

  const trimmed = query.trim().toLowerCase();
  const normalizedQuery = trimmed === "@qcet.edu.vn" ? "@cdktcnqn.edu.vn" : trimmed;
  if (!trimmed) {
    return allStaff;
  }

  return allStaff.filter((staff) => {
    return (
      staff.name.toLowerCase().includes(trimmed) ||
      staff.email.toLowerCase().includes(trimmed) || staff.email.toLowerCase().includes(normalizedQuery) ||
      staff.role.toLowerCase().includes(trimmed) ||
      staff.departmentName.toLowerCase().includes(trimmed) ||
      (staff.phone && staff.phone.includes(trimmed)) ||
      (staff.room && staff.room.toLowerCase().includes(trimmed)) ||
      (staff.titlePrefix && staff.titlePrefix.toLowerCase().includes(trimmed))
    );
  });
}
