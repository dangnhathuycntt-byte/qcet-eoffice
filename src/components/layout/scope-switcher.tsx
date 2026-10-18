"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { School, Building2, User } from "lucide-react";
import { QCET_ORG_UNITS, type OrgUnitConfig } from "@/lib/org/org-structure";
import { type DepartmentNode } from "@/components/org/organization-tree";
import { isUserUnassignedDepartment } from "@/lib/auth-context";
import { foldVietnamese } from "@/lib/search/vietnamese-search";
import { isAdminTierUser, isManagerUser } from "@/lib/role-task-filter";

export type ScopeType = "school" | "unit" | "my";

export interface ScopeDetails {
  scope: ScopeType;
  label: string;
  shortLabel: string;
  triggerLabel: string;
  iconType: "School" | "Building2" | "User";
  department?: DepartmentNode;
  isWarning?: boolean;
}

export interface DepartmentTierGroup {
  category: "KHOA_CHUYEN_MON" | "PHONG_CHUC_NANG" | "TRUNG_TAM";
  label: string;
  expectedCountText: string;
}

export const DEPARTMENT_TIERS: DepartmentTierGroup[] = [
  {
    category: "KHOA_CHUYEN_MON",
    label: "Khoa chuyên môn",
    expectedCountText: "9 khoa",
  },
  {
    category: "PHONG_CHUC_NANG",
    label: "Phòng chức năng",
    expectedCountText: "5 phòng",
  },
  {
    category: "TRUNG_TAM",
    label: "Trung tâm",
    expectedCountText: "2 trung tâm",
  },
];

/**
 * Formats standard Vietnamese institutional department display label.
 */
export function formatDepartmentLabel(dept: DepartmentNode): string {
  if (dept.code === "BGH" || dept.category === "BGH") {
    return "Ban Giám hiệu";
  }
  if (dept.code === "K_CNTT") {
    return "Khoa Công nghệ thông tin";
  }
  if (dept.code === "P_DTQLKH" || dept.code === "DAO_TAO") {
    return "Phòng Đào tạo & QLKH";
  }
  if (dept.shortName) {
    if (/^(Phòng|Khoa|Trung tâm|TT)\b/i.test(dept.shortName)) {
      return dept.shortName;
    }
    if (dept.category === "PHONG_CHUC_NANG") {
      return `Phòng ${dept.shortName}`;
    }
    if (dept.category === "KHOA_CHUYEN_MON") {
      return `Khoa ${dept.shortName}`;
    }
    return dept.shortName;
  }
  return dept.name;
}

/**
 * Instant unaccented Vietnamese search filter for subordinate units.
 */
export function matchesDepartmentSearch(dept: DepartmentNode, query: string): boolean {
  if (!query) return true;
  const cleanQuery = foldVietnamese(query);
  const nameNorm = foldVietnamese(dept.name);
  const shortNorm = foldVietnamese(dept.shortName || "");
  const formattedNorm = foldVietnamese(formatDepartmentLabel(dept));
  const rawCode = dept.code.toLowerCase();
  const pureCode = rawCode.replace(/^(k_|p_|tt_)/, "");

  return (
    nameNorm.includes(cleanQuery) ||
    shortNorm.includes(cleanQuery) ||
    formattedNorm.includes(cleanQuery) ||
    rawCode.includes(cleanQuery) ||
    pureCode.includes(cleanQuery)
  );
}

/**
 * Converts an OrgUnitConfig to a DepartmentNode with empty personnel.
 * Used by resolveDepartment for pure-config lookups that don't need API data.
 */
function toDepartmentNode(unit: OrgUnitConfig): DepartmentNode {
  return {
    ...unit,
    leaderName: "",
    leaderRole: "",
    members: [],
  };
}

/**
 * Resolves a department from QCET_ORG_UNITS by code, id, or normalized string.
 * Returns a DepartmentNode with empty personnel (config-only lookup).
 */
export function resolveDepartment(codeOrId?: string | null): DepartmentNode | undefined {
  if (!codeOrId) return undefined;
  const norm = codeOrId.trim().toUpperCase().replace(/[-\s]/g, "_");

  // Macro institutional legal name alias
  if (
    norm.includes("TRUONG_CAO_DANG") ||
    norm.includes("BGH") ||
    norm === "BAN_GIAM_HIEU" ||
    norm === "TOAN_TRUONG"
  ) {
    const found = QCET_ORG_UNITS.find((d) => d.code === "BGH");
    return found ? toDepartmentNode(found) : undefined;
  }

  const match =
    QCET_ORG_UNITS.find((d) => d.code.toUpperCase() === norm) ||
    QCET_ORG_UNITS.find((d) => d.id.toUpperCase() === norm) ||
    QCET_ORG_UNITS.find((d) => d.shortName?.toUpperCase() === norm) ||
    QCET_ORG_UNITS.find((d) => {
      const pureCode = d.code.toUpperCase().replace(/^(K_|P_|TT_)/, "");
      const pureNorm = norm.replace(/^(K_|P_|TT_|DEPT_)/, "");
      return (
        pureCode === pureNorm ||
        (norm === "DAO_TAO" && (d.code === "P_QLDT" || d.name.includes("Đào tạo"))) ||
        (norm === "CNTT" && d.code === "K_CNTT") ||
        (norm === "TCHC" && (d.code === "P_TCDBCL" || d.code === "P_HCQT")) ||
        d.code.toUpperCase().includes(pureNorm) ||
        pureNorm.includes(pureCode)
      );
    }) ||
    QCET_ORG_UNITS.find((d) => d.name.toUpperCase().includes(norm));

  return match ? toDepartmentNode(match) : undefined;
}

/**
 * Resolves scope metadata (label, icon, trigger label, resolved department).
 * Invariant: Role Is Not Scope. Scope represents visual dataset filter, not operational authority.
 */
export function resolveScopeDetails(
  scopeParam?: string | null,
  deptParam?: string | null,
  fallbackUser?: { role?: string; department?: string | null; departmentCode?: string | null } | null
): ScopeDetails {
  const normScope = (scopeParam || "").trim().toLowerCase();

  // Explicit school scope
  if (normScope === "school" || normScope === "school_tasks") {
    // Access control guard: non-executive users must never access school scope
    if (fallbackUser && !isAdminTierUser(fallbackUser)) {
      if (isManagerUser(fallbackUser)) {
        if (!deptParam && isUserUnassignedDepartment(fallbackUser)) {
          return {
            scope: "unit",
            label: "Chưa chọn đơn vị",
            shortLabel: "Chưa chọn đ/vị",
            triggerLabel: "Phạm vi: Chưa chọn đơn vị",
            iconType: "Building2",
            isWarning: true,
          };
        }
        const targetCodeOrName =
          deptParam || fallbackUser.departmentCode || fallbackUser.department;
        const dept = resolveDepartment(targetCodeOrName);
        if (dept) {
          const deptLabel = formatDepartmentLabel(dept);
          return {
            scope: "unit",
            label: deptLabel,
            shortLabel: dept.shortName || dept.name,
            triggerLabel: `Phạm vi: ${deptLabel}`,
            iconType: "Building2",
            department: dept,
          };
        }
        const customName =
          deptParam || fallbackUser.department || "Đơn vị";
        return {
          scope: "unit",
          label: customName,
          shortLabel: customName,
          triggerLabel: `Phạm vi: ${customName}`,
          iconType: "Building2",
        };
      }
      return {
        scope: "my",
        label: "Cá nhân (Của tôi)",
        shortLabel: "Cá nhân",
        triggerLabel: "Phạm vi: Cá nhân (Của tôi)",
        iconType: "User",
      };
    }

    return {
      scope: "school",
      label: "Toàn trường (BGH QCET)",
      shortLabel: "Toàn trường",
      triggerLabel: "Phạm vi: Toàn trường (BGH QCET)",
      iconType: "School",
    };
  }

  // Explicit unit scope
  if (normScope === "unit" || normScope === "unit_tasks") {
    if (!deptParam && isUserUnassignedDepartment(fallbackUser)) {
      return {
        scope: "unit",
        label: "Chưa chọn đơn vị",
        shortLabel: "Chưa chọn đ/vị",
        triggerLabel: "Phạm vi: Chưa chọn đơn vị",
        iconType: "Building2",
        isWarning: true,
      };
    }
    const targetCodeOrName = deptParam || fallbackUser?.departmentCode || fallbackUser?.department;
    const dept = resolveDepartment(targetCodeOrName);
    if (dept) {
      const deptLabel = formatDepartmentLabel(dept);
      return {
        scope: "unit",
        label: deptLabel,
        shortLabel: dept.shortName || dept.name,
        triggerLabel: `Phạm vi: ${deptLabel}`,
        iconType: "Building2",
        department: dept,
      };
    }
    const customName = deptParam || fallbackUser?.department || "Đơn vị";
    return {
      scope: "unit",
      label: customName,
      shortLabel: customName,
      triggerLabel: `Phạm vi: ${customName}`,
      iconType: "Building2",
    };
  }

  // Explicit my scope
  if (normScope === "my" || normScope === "my_tasks") {
    return {
      scope: "my",
      label: "Cá nhân (Của tôi)",
      shortLabel: "Cá nhân",
      triggerLabel: "Phạm vi: Cá nhân (Của tôi)",
      iconType: "User",
    };
  }

  // Default when scope is not specified in URL: prioritize active user role
  if (fallbackUser) {
    if (fallbackUser.role === "ADMIN") {
      return {
        scope: "school",
        label: "Toàn trường (BGH QCET)",
        shortLabel: "Toàn trường",
        triggerLabel: "Phạm vi: Toàn trường (BGH QCET)",
        iconType: "School",
      };
    }
    if (fallbackUser.role === "MANAGER") {
      if (isUserUnassignedDepartment(fallbackUser)) {
        return {
          scope: "unit",
          label: "Chưa chọn đơn vị",
          shortLabel: "Chưa chọn đ/vị",
          triggerLabel: "Phạm vi: Chưa chọn đơn vị",
          iconType: "Building2",
          isWarning: true,
        };
      }
      const target = fallbackUser.departmentCode || fallbackUser.department;
      const dept = resolveDepartment(target);
      if (dept) {
        const deptLabel = formatDepartmentLabel(dept);
        return {
          scope: "unit",
          label: deptLabel,
          shortLabel: dept.shortName || dept.name,
          triggerLabel: `Phạm vi: ${deptLabel}`,
          iconType: "Building2",
          department: dept,
        };
      }
      const deptName = fallbackUser.department || "Phòng Quản trị Mạng và CNTT";
      return {
        scope: "unit",
        label: deptName,
        shortLabel: deptName,
        triggerLabel: `Phạm vi: ${deptName}`,
        iconType: "Building2",
      };
    }
  }

  // Default to "my"
  return {
    scope: "my",
    label: "Cá nhân (Của tôi)",
    shortLabel: "Cá nhân",
    triggerLabel: "Phạm vi: Cá nhân (Của tôi)",
    iconType: "User",
  };
}

/**
 * Builds a clean URL query string preserving pathname and other valid query parameters.
 */
export function buildScopeUrl(
  scope: ScopeType,
  dept?: string,
  pathname: string = "",
  existingParams?: URLSearchParams | string
): string {
  const params = new URLSearchParams(
    typeof existingParams === "string" ? existingParams : existingParams?.toString() || ""
  );

  if (scope === "school") {
    params.set("scope", "school");
    params.delete("dept");
  } else if (scope === "unit") {
    params.set("scope", "unit");
    if (dept) {
      params.set("dept", dept);
    } else {
      params.delete("dept");
    }
  } else {
    // "my"
    params.set("scope", "my");
    params.delete("dept");
  }

  const query = params.toString();
  if (!pathname) {
    return query ? `?${query}` : "";
  }
  return query ? `${pathname}?${query}` : pathname;
}
