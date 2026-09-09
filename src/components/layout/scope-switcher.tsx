"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  School,
  Building2,
  User,
  ChevronDown,
  Check,
  Shield,
  Search,
  X,
} from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetClose,
} from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";
import { QCET_DEPARTMENTS, type DepartmentNode } from "@/components/org/organization-tree";
import { useAuth, isUserUnassignedDepartment } from "@/lib/auth-context";

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
 * Removes Vietnamese diacritics / accents for fast instant text matching.
 */
export function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, (m) => (m === "đ" ? "d" : "D"))
    .toLowerCase()
    .trim();
}

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
  const cleanQuery = removeVietnameseTones(query);
  const nameNorm = removeVietnameseTones(dept.name);
  const shortNorm = removeVietnameseTones(dept.shortName || "");
  const formattedNorm = removeVietnameseTones(formatDepartmentLabel(dept));
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
 * Resolves a department from QCET_DEPARTMENTS by code, id, or normalized string.
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
    return QCET_DEPARTMENTS.find((d) => d.code === "BGH");
  }

  return (
    QCET_DEPARTMENTS.find((d) => d.code.toUpperCase() === norm) ||
    QCET_DEPARTMENTS.find((d) => d.id.toUpperCase() === norm) ||
    QCET_DEPARTMENTS.find((d) => d.shortName?.toUpperCase() === norm) ||
    QCET_DEPARTMENTS.find((d) => {
      const pureCode = d.code.toUpperCase().replace(/^(K_|P_|TT_)/, "");
      const pureNorm = norm.replace(/^(K_|P_|TT_|DEPT_)/, "");
      return (
        pureCode === pureNorm ||
        (norm === "DAO_TAO" && (d.code === "P_QLDT" || d.code === "P_DTQLKH" || d.name.includes("Đào tạo"))) ||
        (norm === "CNTT" && d.code === "K_CNTT") ||
        (norm === "TCHC" && (d.code === "P_TCDBCL" || d.code === "P_HCQT")) ||
        d.code.toUpperCase().includes(pureNorm) ||
        pureNorm.includes(pureCode)
      );
    }) ||
    QCET_DEPARTMENTS.find((d) => d.name.toUpperCase().includes(norm))
  );
}

export function isExecutiveUser(
  user?: { role?: string } | null
): boolean {
  if (!user?.role) return false;
  const role = user.role.toUpperCase();
  return (
    role === "ADMIN" ||
    role === "BGH" ||
    role === "BAN_GIAM_HIEU" ||
    role === "HIEU_TRUONG" ||
    role === "PHO_HIEU_TRUONG"
  );
}

export function isManagerUser(
  user?: { role?: string } | null
): boolean {
  if (!user?.role) return false;
  const role = user.role.toUpperCase();
  return (
    role === "MANAGER" ||
    role === "TRUONG_DON_VI" ||
    role === "TRUONG_PHONG" ||
    role === "TRUONG_KHOA" ||
    role === "PHO_PHONG" ||
    role === "PHO_KHOA"
  );
}

/**
 * Resolves scope metadata (label, icon, trigger label, resolved department).
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
    if (fallbackUser && !isExecutiveUser(fallbackUser)) {
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

function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    setIsMobile(mql.matches);
    if (mql.addEventListener) {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    } else if ("addListener" in mql) {
      (mql as any).addListener(update);
      return () => (mql as any).removeListener(update);
    }
  }, [breakpoint]);

  return isMobile;
}

export function ScopeSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const scopeParam = searchParams?.get("scope") ?? null;
  const deptParam = searchParams?.get("dept") ?? null;

  const isExecutive = isExecutiveUser(user);
  const isManager = isManagerUser(user);

  const currentScope = React.useMemo(() => {
    return resolveScopeDetails(scopeParam, deptParam, user);
  }, [scopeParam, deptParam, user]);

  // Primary user department context resolved dynamically
  const resolvedPrimaryDept = React.useMemo(() => {
    if (isExecutive) {
      return resolveDepartment("BGH") || QCET_DEPARTMENTS.find((d) => d.code === "BGH");
    }
    return resolveDepartment(user?.departmentCode || user?.department);
  }, [isExecutive, user?.departmentCode, user?.department]);

  const primaryUnitCode = resolvedPrimaryDept?.code || (isExecutive ? "BGH" : user?.departmentCode || "P_HCQT");
  const primaryUnitName = React.useMemo(() => {
    if (isExecutive) return "Ban Giám hiệu";
    if (resolvedPrimaryDept) {
      return resolvedPrimaryDept.code === "BGH" ? "Ban Giám hiệu" : formatDepartmentLabel(resolvedPrimaryDept);
    }
    const raw = user?.department || "Đơn vị của tôi";
    if (raw.includes("Trường Cao đẳng")) return "Ban Giám hiệu";
    return raw;
  }, [isExecutive, resolvedPrimaryDept, user?.department]);

  // Silent URL guard: non-executive users accessing school scope must be redirected
  React.useEffect(() => {
    const norm = (scopeParam || "").trim().toLowerCase();
    if ((norm === "school" || norm === "school_tasks") && !isExecutive) {
      const fallbackScope: ScopeType = isManager ? "unit" : "my";
      const targetDept = isManager
        ? user?.departmentCode || primaryUnitCode
        : undefined;
      const newUrl = buildScopeUrl(
        fallbackScope,
        targetDept,
        pathname,
        searchParams ? searchParams.toString() : ""
      );
      router.replace(newUrl);
    }
  }, [
    scopeParam,
    isExecutive,
    isManager,
    user,
    primaryUnitCode,
    pathname,
    searchParams,
    router,
  ]);

  // Standard non-BGH operational units (16 units)
  const standardDepartments = React.useMemo(() => {
    return QCET_DEPARTMENTS.filter(
      (dept) => dept.code !== "BGH" && dept.category !== "BGH"
    );
  }, []);

  // Filtered department tiers based on instant search
  const filteredTiers = React.useMemo(() => {
    return DEPARTMENT_TIERS.map((tier) => {
      const depts = standardDepartments.filter(
        (d) => d.category === tier.category && matchesDepartmentSearch(d, searchQuery)
      );
      return {
        ...tier,
        departments: depts,
      };
    }).filter((tier) => tier.departments.length > 0);
  }, [standardDepartments, searchQuery]);

  const totalMatches = React.useMemo(() => {
    return filteredTiers.reduce((acc, t) => acc + t.departments.length, 0);
  }, [filteredTiers]);

  // Allowed scopes based on role — hide "Toàn trường" from non-executive
  const allScopes: ScopeType[] = ["school", "unit", "my"];
  const allowedScopes = isExecutive
    ? allScopes
    : allScopes.filter((s) => s !== "school");

  // Close popover on outside click or ESC key
  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (isMobile) return;
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isMobile]);

  const handleSelectScope = (scope: ScopeType, deptCode?: string) => {
    let targetScope = scope;
    let targetDept = deptCode;
    if (scope === "school" && !isExecutive) {
      targetScope = isManager ? "unit" : "my";
      targetDept = isManager ? user?.departmentCode || primaryUnitCode : undefined;
    }

    const newUrl = buildScopeUrl(
      targetScope,
      targetDept,
      pathname,
      searchParams ? searchParams.toString() : ""
    );
    router.push(newUrl);
    setIsOpen(false);
  };

  const handleOpenDelegationModal = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qcet:open-delegation-modal"));
    }
    setIsOpen(false);
  };

  const renderIcon = (type: ScopeDetails["iconType"]) => {
    switch (type) {
      case "School":
        return <School className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.5} />;
      case "Building2":
        return <Building2 className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.5} />;
      case "User":
      default:
        return <User className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={1.5} />;
    }
  };

  // Determine active selection state
  const isPrimaryUnitSelected =
    currentScope.scope === "unit" &&
    (deptParam === primaryUnitCode ||
      currentScope.department?.code === primaryUnitCode ||
      (!deptParam && !currentScope.department && !isExecutive));

  const isSchoolSelected = currentScope.scope === "school";
  const isMySelected = currentScope.scope === "my";

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Chuyển đổi phạm vi hoạt động"
        className="group inline-flex min-h-[44px] sm:min-h-[32px] h-auto sm:h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/40 hover:bg-secondary/80 px-2.5 text-xs font-medium text-foreground transition-all cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.98] touch-manipulation"
      >
        {renderIcon(currentScope.iconType)}
        <span className="truncate max-w-[110px] xs:max-w-[140px] sm:max-w-[190px] md:max-w-[240px]">
          <span className="hidden sm:inline">{currentScope.triggerLabel}</span>
          <span className="sm:hidden">{currentScope.shortLabel}</span>
        </span>
        <ChevronDown
          size={12}
          strokeWidth={1.5}
          className={cn(
            "text-muted-foreground transition-transform duration-150 group-hover:text-foreground shrink-0 ml-0.5",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Desktop Dropdown Popover (>= md) */}
      {isOpen && !isMobile && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute left-0 top-full mt-1.5 w-80 max-w-[calc(100vw-32px)] rounded-xl border border-border/70 bg-card/95 p-1.5 text-popover-foreground shadow-xl backdrop-blur-md z-50 animate-in fade-in-0 zoom-in-95 focus:outline-none"
        >
          {/* Section 1: Primary Scopes */}
          <div className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Phạm vi chính
          </div>

          <div className="space-y-0.5 mt-0.5">
            {/* 1. Toàn trường - only visible to executive role */}
            {allowedScopes.includes("school") && (
              <button
                type="button"
                onClick={() => handleSelectScope("school")}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer",
                  isSchoolSelected
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <School
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isSchoolSelected ? "text-primary" : "text-muted-foreground"
                    )}
                    strokeWidth={1.5}
                  />
                  <div className="truncate">
                    <span>Toàn trường (BGH QCET)</span>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      Chỉ đạo, điều hành chiến lược
                    </span>
                  </div>
                </div>
                {isSchoolSelected && (
                  <Check className="w-4 h-4 text-primary shrink-0 ml-2" strokeWidth={1.5} />
                )}
              </button>
            )}

            {/* 2. Primary Unit (Đơn vị của tôi / Ban Giám hiệu) */}
            <button
              type="button"
              onClick={() => handleSelectScope("unit", primaryUnitCode)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer",
                isPrimaryUnitSelected
                  ? "bg-primary/10 text-primary font-semibold"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Building2
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isPrimaryUnitSelected ? "text-primary" : "text-muted-foreground"
                  )}
                  strokeWidth={1.5}
                />
                <div className="truncate">
                  <span>{primaryUnitName}</span>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    {isExecutive ? "Đơn vị điều hành" : "Đơn vị của tôi"}
                  </span>
                </div>
              </div>
              {isPrimaryUnitSelected && (
                <Check className="w-4 h-4 text-primary shrink-0 ml-2" strokeWidth={1.5} />
              )}
            </button>

            {/* 3. Cá nhân (Của tôi) */}
            <button
              type="button"
              onClick={() => handleSelectScope("my")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer",
                isMySelected
                  ? "bg-primary/10 text-primary font-semibold"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <User
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isMySelected ? "text-primary" : "text-muted-foreground"
                  )}
                  strokeWidth={1.5}
                />
                <div className="truncate">
                  <span>Cá nhân (Của tôi)</span>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    Nhiệm vụ và kế hoạch cá nhân
                  </span>
                </div>
              </div>
              {isMySelected && (
                <Check className="w-4 h-4 text-primary shrink-0 ml-2" strokeWidth={1.5} />
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="my-1.5 border-t border-border/60" />

          {/* Section 2: Searchable Combobox of 16 Subordinate Units */}
          <div className="px-3 pt-1 pb-1 flex items-center justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <span>Đơn vị trực thuộc</span>
            <span className="text-[10px] font-normal text-muted-foreground">16 đơn vị</span>
          </div>

          {/* Search Filter Input */}
          <div className="px-2 pt-1 pb-1.5">
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm đơn vị (VD: CNTT, Đào tạo, Điện)..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-muted/40 hover:bg-muted/70 focus:bg-background border border-border/60 rounded-lg placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                  aria-label="Xóa tìm kiếm"
                >
                  <X className="w-3 h-3" strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>

          {/* 3-Tier Categorized List */}
          <div className="max-h-56 overflow-y-auto px-1 space-y-2">
            {filteredTiers.map((tier) => (
              <div key={tier.category} className="space-y-0.5">
                <div className="px-2 py-0.5 text-[10px] font-bold text-muted-foreground/90 uppercase tracking-wider flex items-center justify-between bg-muted/40 rounded">
                  <span>{tier.label}</span>
                  <span className="text-[10px] font-medium text-muted-foreground/70">
                    {tier.departments.length}
                  </span>
                </div>
                {tier.departments.map((dept) => {
                  const isSelected =
                    currentScope.scope === "unit" &&
                    (deptParam === dept.code ||
                      deptParam === dept.id ||
                      currentScope.department?.code === dept.code);

                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => handleSelectScope("unit", dept.code)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer min-h-[32px]",
                        isSelected
                          ? "bg-primary/10 text-primary font-semibold"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <span className="truncate">{formatDepartmentLabel(dept)}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {totalMatches === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Không tìm thấy đơn vị phù hợp với &quot;{searchQuery}&quot;
              </div>
            )}
          </div>

          {/* Sticky Footer: Phân quyền & Ủy quyền phạm vi */}
          <div className="sticky bottom-0 pt-2 pb-0.5 mt-1 border-t border-border/60 bg-card/95 backdrop-blur-xs">
            <button
              type="button"
              onClick={handleOpenDelegationModal}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer min-h-[36px]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="w-3.5 h-3.5 shrink-0 text-primary" strokeWidth={1.5} />
                <span className="truncate font-medium">Phân quyền & Ủy quyền phạm vi</span>
              </div>
              <span className="size-2 rounded-full bg-emerald-500 shrink-0" title="Đang hiệu lực" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile BottomSheet (< md) */}
      <BottomSheet open={isOpen && isMobile} onOpenChange={setIsOpen}>
        <BottomSheetContent className="max-h-[85vh] overflow-y-auto">
          <BottomSheetHeader className="border-b border-border/50 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <BottomSheetTitle className="text-base font-bold text-foreground">
                  Chọn phạm vi hoạt động
                </BottomSheetTitle>
                <BottomSheetDescription className="text-xs text-muted-foreground mt-0.5">
                  Lựa chọn không gian làm việc theo thẩm quyền & nhiệm vụ
                </BottomSheetDescription>
              </div>
              <BottomSheetClose
                aria-label="Đóng bảng chọn phạm vi"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <X size={18} strokeWidth={1.5} />
              </BottomSheetClose>
            </div>
          </BottomSheetHeader>

          <div className="p-4 space-y-4">
            {/* Primary Scopes Section */}
            <div>
              <div className="px-1 pb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Phạm vi chính
              </div>
              <div className="space-y-2">
                {/* 1. Toàn trường - only visible to executive role */}
                {allowedScopes.includes("school") && (
                  <button
                    type="button"
                    onClick={() => handleSelectScope("school")}
                    className={cn(
                      "w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left text-sm transition-all cursor-pointer min-h-[48px] active:scale-[0.99]",
                      isSchoolSelected
                        ? "bg-primary/10 border border-primary/25 text-primary font-semibold shadow-xs"
                        : "bg-muted/40 hover:bg-muted/70 text-foreground border border-border/40"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "size-8 rounded-lg flex items-center justify-center shrink-0",
                          isSchoolSelected
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <School className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight">Toàn trường (BGH QCET)</p>
                        <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                          Ban Giám hiệu chỉ đạo điều hành
                        </p>
                      </div>
                    </div>
                    {isSchoolSelected && (
                      <Check className="w-4 h-4 text-primary shrink-0 ml-2" strokeWidth={1.5} />
                    )}
                  </button>
                )}

                {/* 2. Primary Unit */}
                <button
                  type="button"
                  onClick={() => handleSelectScope("unit", primaryUnitCode)}
                  className={cn(
                    "w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left text-sm transition-all cursor-pointer min-h-[48px] active:scale-[0.99]",
                    isPrimaryUnitSelected
                      ? "bg-primary/10 border border-primary/25 text-primary font-semibold shadow-xs"
                      : "bg-muted/40 hover:bg-muted/70 text-foreground border border-border/40"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center shrink-0",
                        isPrimaryUnitSelected
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Building2 className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-tight">{primaryUnitName}</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                        {isExecutive ? "Đơn vị điều hành" : "Đơn vị của tôi"}
                      </p>
                    </div>
                  </div>
                  {isPrimaryUnitSelected && (
                    <Check className="w-4 h-4 text-primary shrink-0 ml-2" strokeWidth={1.5} />
                  )}
                </button>

                {/* 3. Cá nhân (Của tôi) */}
                <button
                  type="button"
                  onClick={() => handleSelectScope("my")}
                  className={cn(
                    "w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left text-sm transition-all cursor-pointer min-h-[48px] active:scale-[0.99]",
                    isMySelected
                      ? "bg-primary/10 border border-primary/25 text-primary font-semibold shadow-xs"
                      : "bg-muted/40 hover:bg-muted/70 text-foreground border border-border/40"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center shrink-0",
                        isMySelected
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <User className="w-4 h-4" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-tight">Cá nhân (Của tôi)</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                        Nhiệm vụ và kế hoạch cá nhân
                      </p>
                    </div>
                  </div>
                  {isMySelected && (
                    <Check className="w-4 h-4 text-primary shrink-0 ml-2" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>

            {/* Subordinate Units Combobox */}
            <div className="pt-2 border-t border-border/50">
              <div className="px-1 pb-2 flex items-center justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <span>Đơn vị trực thuộc</span>
                <span className="text-[11px] font-normal text-muted-foreground">16 đơn vị</span>
              </div>

              {/* Mobile Search input */}
              <div className="relative mb-3">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                  strokeWidth={1.5}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm đơn vị (VD: CNTT, Đào tạo, Điện)..."
                  className="w-full pl-9 pr-9 py-2.5 text-sm bg-muted/40 border border-border/60 rounded-xl placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded"
                    aria-label="Xóa tìm kiếm"
                  >
                    <X className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                )}
              </div>

              {/* 3-Tier Categorized List on Mobile */}
              <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                {filteredTiers.map((tier) => (
                  <div key={tier.category} className="space-y-1">
                    <div className="px-2 py-1 text-xs font-bold text-muted-foreground/90 uppercase tracking-wider flex items-center justify-between bg-muted/40 rounded-lg">
                      <span>{tier.label}</span>
                      <span className="text-xs font-medium text-muted-foreground/70">
                        {tier.departments.length}
                      </span>
                    </div>
                    {tier.departments.map((dept) => {
                      const isSelected =
                        currentScope.scope === "unit" &&
                        (deptParam === dept.code ||
                          deptParam === dept.id ||
                          currentScope.department?.code === dept.code);

                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => handleSelectScope("unit", dept.code)}
                          className={cn(
                            "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm transition-colors cursor-pointer min-h-[44px] active:scale-[0.99]",
                            isSelected
                              ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                              : "hover:bg-muted/60 text-foreground bg-muted/20"
                          )}
                        >
                          <span className="truncate">{formatDepartmentLabel(dept)}</span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary shrink-0 ml-2" strokeWidth={1.5} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}

                {totalMatches === 0 && (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    Không tìm thấy đơn vị phù hợp với &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Footer: Phân quyền & Ủy quyền phạm vi */}
            <div className="sticky bottom-0 pt-3 pb-2 border-t border-border/50 bg-background/95 backdrop-blur-xs">
              <button
                type="button"
                onClick={handleOpenDelegationModal}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-foreground bg-muted/40 hover:bg-muted/80 transition-colors cursor-pointer min-h-[48px] active:scale-[0.99] border border-border/40"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Shield className="w-4 h-4 shrink-0 text-primary" strokeWidth={1.5} />
                  <span className="truncate">Phân quyền & Ủy quyền phạm vi</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground">Hiệu lực</span>
                  <span className="size-2 rounded-full bg-emerald-500" />
                </div>
              </button>
            </div>
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
