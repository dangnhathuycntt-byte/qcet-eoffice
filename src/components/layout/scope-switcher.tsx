"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  School,
  Building2,
  User,
  ChevronDown,
  Check,
  Settings,
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
import { useAuth } from "@/lib/auth-context";

export type ScopeType = "school" | "unit" | "my";

export interface ScopeDetails {
  scope: ScopeType;
  label: string;
  shortLabel: string;
  triggerLabel: string;
  iconType: "School" | "Building2" | "User";
  department?: DepartmentNode;
}

/**
 * Formats standard Vietnamese institutional department display label.
 */
export function formatDepartmentLabel(dept: DepartmentNode): string {
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
 * Resolves a department from QCET_DEPARTMENTS by code, id, or normalized string.
 */
export function resolveDepartment(codeOrId?: string | null): DepartmentNode | undefined {
  if (!codeOrId) return undefined;
  const norm = codeOrId.trim().toUpperCase().replace(/[-\s]/g, "_");
  return (
    QCET_DEPARTMENTS.find((d) => d.code.toUpperCase() === norm) ||
    QCET_DEPARTMENTS.find((d) => d.id.toUpperCase() === norm) ||
    QCET_DEPARTMENTS.find((d) => d.shortName?.toUpperCase() === norm) ||
    QCET_DEPARTMENTS.find((d) => {
      const pureCode = d.code.toUpperCase().replace(/^(K_|P_|TT_)/, "");
      const pureNorm = norm.replace(/^(K_|P_|TT_|DEPT_)/, "");
      return (
        pureCode === pureNorm ||
        (norm === "DAO_TAO" && (d.code === "P_DTQLKH" || d.name.includes("Đào tạo"))) ||
        (norm === "CNTT" && d.code === "K_CNTT") ||
        (norm === "TCHC" && (d.code === "P_KTDBCL" || d.code === "P_HCQT")) ||
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
  fallbackUser?: { role?: string; department?: string; departmentCode?: string } | null
): ScopeDetails {
  const normScope = (scopeParam || "").trim().toLowerCase();

  // Explicit school scope
  if (normScope === "school" || normScope === "school_tasks") {
    // Access control guard: non-executive users must never access school scope
    if (fallbackUser && !isExecutiveUser(fallbackUser)) {
      if (isManagerUser(fallbackUser)) {
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
  const [showOtherUnits, setShowOtherUnits] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const scopeParam = searchParams?.get("scope") ?? null;
  const deptParam = searchParams?.get("dept") ?? null;

  const isExecutive = isExecutiveUser(user);
  const isManager = isManagerUser(user);

  const currentScope = React.useMemo(() => {
    return resolveScopeDetails(scopeParam, deptParam, user);
  }, [scopeParam, deptParam, user]);

  // Primary user department context
  const primaryUnitName = user?.department || "Phòng Quản trị Mạng và CNTT";
  const primaryUnitCode = user?.departmentCode || "P_HCQT";

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

  // Standard non-BGH departments for selection
  const standardDepartments = React.useMemo(() => {
    return QCET_DEPARTMENTS.filter(
      (dept) => dept.code !== "BGH" && dept.category !== "BGH"
    );
  }, []);

  // Allowed scopes based on role — hide "Toàn trường" from non-executive
  const allScopes: ScopeType[] = ["school", "unit", "my"];
  const allowedScopes = isExecutive
    ? allScopes
    : allScopes.filter((s) => s !== "school");

  // Other units (excluding primary unit and Khoa CNTT for clean quick list)
  const otherDepartments = React.useMemo(() => {
    return standardDepartments.filter(
      (dept) => dept.code !== "K_CNTT" && dept.code !== primaryUnitCode
    );
  }, [standardDepartments, primaryUnitCode]);

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
        return <School className="w-3.5 h-3.5 text-primary shrink-0" />;
      case "Building2":
        return <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />;
      case "User":
      default:
        return <User className="w-3.5 h-3.5 text-primary shrink-0" />;
    }
  };

  // Determine which scope is currently selected for checkmarks
  const isPrimaryUnitSelected =
    currentScope.scope === "unit" &&
    (!deptParam ||
      deptParam === primaryUnitCode ||
      deptParam === "P_QTM_CNTT" ||
      currentScope.label === primaryUnitName);

  const isKhoaCnttSelected =
    currentScope.scope === "unit" &&
    (deptParam === "K_CNTT" || currentScope.department?.code === "K_CNTT");

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
        className="group inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/40 hover:bg-secondary/80 px-2.5 text-xs font-medium text-foreground transition-all cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.98]"
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
          className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 max-w-[calc(100vw-32px)] rounded-xl border border-border/70 bg-card/95 p-1.5 text-popover-foreground shadow-xl backdrop-blur-md z-50 animate-in fade-in-0 zoom-in-95 focus:outline-none"
        >
          {/* Header Title */}
          <div className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            PHẠM VI ĐANG XEM
          </div>

          <div className="space-y-0.5 mt-1">
            {/* 1. Primary Unit (e.g. Phòng Quản trị Mạng và CNTT) */}
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
                />
                <span className="truncate">{primaryUnitName}</span>
              </div>
              {isPrimaryUnitSelected && (
                <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
              )}
            </button>

            {/* 2. Khoa CNTT */}
            <button
              type="button"
              onClick={() => handleSelectScope("unit", "K_CNTT")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer",
                isKhoaCnttSelected
                  ? "bg-primary/10 text-primary font-semibold"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Building2
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isKhoaCnttSelected ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span className="truncate">Khoa CNTT</span>
              </div>
              {isKhoaCnttSelected && (
                <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
              )}
            </button>

            {/* 3. Toàn trường - only visible to executive role */}
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
                  />
                  <div className="truncate">
                    <span>Toàn trường</span>
                    <span className="text-xs text-muted-foreground ml-1.5 hidden sm:inline">
                      (BGH điều hành)
                    </span>
                  </div>
                </div>
                {isSchoolSelected && (
                  <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                )}
              </button>
            )}

            {/* 4. Cá nhân (Của tôi) */}
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
                />
                <div className="truncate">
                  <span>Cá nhân</span>
                  <span className="text-xs text-muted-foreground ml-1.5 hidden sm:inline">
                    (Công việc của tôi)
                  </span>
                </div>
              </div>
              {isMySelected && (
                <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
              )}
            </button>

            {/* Expandable Other Units */}
            {otherDepartments.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowOtherUnits((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Đơn vị khác ({otherDepartments.length} đơn vị)...</span>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 transition-transform duration-150",
                      showOtherUnits && "rotate-180"
                    )}
                  />
                </button>

                {showOtherUnits && (
                  <div className="max-h-40 overflow-y-auto mt-1 space-y-0.5 pr-1 border-t border-border/40 pt-1">
                    {otherDepartments.map((dept) => {
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
                            "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer",
                            isSelected
                              ? "bg-primary/10 text-primary font-semibold"
                              : "hover:bg-muted text-foreground"
                          )}
                        >
                          <span className="truncate">{formatDepartmentLabel(dept)}</span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-1.5 border-t border-border/50" />

          {/* Footer: Quản lý phạm vi */}
          <button
            type="button"
            onClick={handleOpenDelegationModal}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span>Quản lý phạm vi</span>
          </button>
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
                <X size={18} />
              </BottomSheetClose>
            </div>
          </BottomSheetHeader>

          <div className="p-4 space-y-3">
            <div>
              <div className="px-1 pb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Phạm vi chính
              </div>
              <div className="space-y-1.5">
                {/* 1. Primary Unit */}
                <button
                  type="button"
                  onClick={() => handleSelectScope("unit", primaryUnitCode)}
                  className={cn(
                    "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer min-h-[48px] active:scale-[0.99]",
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
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-tight">{primaryUnitName}</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                        Đơn vị công tác chính
                      </p>
                    </div>
                  </div>
                  {isPrimaryUnitSelected && (
                    <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                  )}
                </button>

                {/* 2. Khoa CNTT */}
                {primaryUnitCode !== "K_CNTT" && (
                  <button
                    type="button"
                    onClick={() => handleSelectScope("unit", "K_CNTT")}
                    className={cn(
                      "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer min-h-[48px] active:scale-[0.99]",
                      isKhoaCnttSelected
                        ? "bg-primary/10 border border-primary/25 text-primary font-semibold shadow-xs"
                        : "bg-muted/40 hover:bg-muted/70 text-foreground border border-border/40"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "size-8 rounded-lg flex items-center justify-center shrink-0",
                          isKhoaCnttSelected
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight">
                          Khoa Công nghệ Thông tin
                        </p>
                        <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                          Khoa chuyên môn (K_CNTT)
                        </p>
                      </div>
                    </div>
                    {isKhoaCnttSelected && (
                      <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                    )}
                  </button>
                )}

                {/* 3. Toàn trường - only visible to executive role */}
                {allowedScopes.includes("school") && (
                  <button
                    type="button"
                    onClick={() => handleSelectScope("school")}
                    className={cn(
                      "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer min-h-[48px] active:scale-[0.99]",
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
                        <School className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight">Toàn trường QCET</p>
                        <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                          Ban Giám hiệu chỉ đạo điều hành
                        </p>
                      </div>
                    </div>
                    {isSchoolSelected && (
                      <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                    )}
                  </button>
                )}

                {/* 4. Cá nhân (Của tôi) */}
                <button
                  type="button"
                  onClick={() => handleSelectScope("my")}
                  className={cn(
                    "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-sm transition-all cursor-pointer min-h-[48px] active:scale-[0.99]",
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
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium leading-tight">Cá nhân (Của tôi)</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                        Nhiệm vụ và kế hoạch cá nhân
                      </p>
                    </div>
                  </div>
                  {isMySelected && (
                    <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                  )}
                </button>
              </div>
            </div>

            {/* Other Units list on mobile */}
            {otherDepartments.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setShowOtherUnits((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-xl transition-colors cursor-pointer min-h-[44px]"
                >
                  <span>CÁC ĐƠN VỊ KHÁC ({otherDepartments.length})</span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 transition-transform duration-200",
                      showOtherUnits && "rotate-180"
                    )}
                  />
                </button>

                {showOtherUnits && (
                  <div className="max-h-48 overflow-y-auto mt-1 space-y-1 pr-1">
                    {otherDepartments.map((dept) => {
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
                            "w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left text-xs transition-colors cursor-pointer min-h-[44px]",
                            isSelected
                              ? "bg-primary/10 text-primary font-semibold"
                              : "hover:bg-muted/60 text-foreground"
                          )}
                        >
                          <span className="truncate">{formatDepartmentLabel(dept)}</span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Quản lý phạm vi */}
            <div className="pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={handleOpenDelegationModal}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/80 transition-colors cursor-pointer min-h-[44px]"
              >
                <Settings className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span>Quản lý phạm vi & Ủy quyền</span>
              </button>
            </div>
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
