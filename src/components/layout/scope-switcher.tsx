"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { School, Building2, User, ChevronDown, Check, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { QCET_DEPARTMENTS, type DepartmentNode } from "@/components/org/organization-tree";

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

/**
 * Resolves scope metadata (label, icon, trigger label, resolved department).
 */
export function resolveScopeDetails(
  scopeParam?: string | null,
  deptParam?: string | null
): ScopeDetails {
  const normScope = (scopeParam || "").trim().toLowerCase();

  if (normScope === "school" || normScope === "school_tasks") {
    return {
      scope: "school",
      label: "Toàn trường (BGH QCET)",
      shortLabel: "Toàn trường",
      triggerLabel: "Phạm vi: Toàn trường (BGH QCET)",
      iconType: "School",
    };
  }

  if (normScope === "unit" || normScope === "unit_tasks") {
    const dept = resolveDepartment(deptParam);
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
    return {
      scope: "unit",
      label: "Đơn vị",
      shortLabel: "Đơn vị",
      triggerLabel: "Phạm vi: Đơn vị",
      iconType: "Building2",
    };
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

export function ScopeSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const scopeParam = searchParams?.get("scope") ?? null;
  const deptParam = searchParams?.get("dept") ?? null;

  const currentScope = React.useMemo(() => {
    return resolveScopeDetails(scopeParam, deptParam);
  }, [scopeParam, deptParam]);

  // Standard non-BGH departments for selection
  const standardDepartments = React.useMemo(() => {
    return QCET_DEPARTMENTS.filter(
      (dept) => dept.code !== "BGH" && dept.category !== "BGH"
    );
  }, []);

  // Close popover on outside click or ESC key
  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
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
  }, [isOpen]);

  const handleSelectScope = (scope: ScopeType, deptCode?: string) => {
    const newUrl = buildScopeUrl(
      scope,
      deptCode,
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
        <span className="truncate max-w-[130px] sm:max-w-[190px] md:max-w-[220px]">
          {currentScope.triggerLabel}
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

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute left-0 top-full mt-1.5 w-80 max-w-[calc(100vw-32px)] rounded-xl border border-border/70 bg-card/95 p-1.5 text-popover-foreground shadow-xl backdrop-blur-md z-50 animate-in fade-in-0 zoom-in-95 focus:outline-none"
        >
          <div className="max-h-[420px] overflow-y-auto pr-0.5 space-y-2 divide-y divide-border/30">
            {/* Group 1: Toàn trường */}
            <div className="space-y-1">
              <div className="px-2.5 pt-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Toàn trường (BGH QCET)
              </div>
              <button
                type="button"
                onClick={() => handleSelectScope("school")}
                className={cn(
                  "w-full flex items-start gap-2.5 p-2 rounded-lg text-left text-xs transition-colors cursor-pointer",
                  currentScope.scope === "school"
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <School className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground">
                    Toàn trường (Executive Cockpit)
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    Theo dõi chỉ số KPI & điều hành toàn viện
                  </div>
                </div>
                {currentScope.scope === "school" && (
                  <Check className="w-4 h-4 text-primary shrink-0 self-center" />
                )}
              </button>
            </div>

            {/* Group 2: Đơn vị & Khoa phòng */}
            <div className="pt-2 space-y-1">
              <div className="px-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Đơn vị & Khoa phòng
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                {standardDepartments.map((dept) => {
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
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer",
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="truncate">
                          <div className="font-medium truncate">
                            {formatDepartmentLabel(dept)}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {dept.categoryLabel}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Group 3: Cá nhân */}
            <div className="pt-2 space-y-1">
              <div className="px-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Cá nhân
              </div>
              <button
                type="button"
                onClick={() => handleSelectScope("my")}
                className={cn(
                  "w-full flex items-start gap-2.5 p-2 rounded-lg text-left text-xs transition-colors cursor-pointer",
                  currentScope.scope === "my"
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <User className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground">
                    Cá nhân (Của tôi)
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    Nhiệm vụ trọng tâm và lịch công tác của riêng tôi
                  </div>
                </div>
                {currentScope.scope === "my" && (
                  <Check className="w-4 h-4 text-primary shrink-0 self-center" />
                )}
              </button>
            </div>
          </div>

          {/* Footer Action */}
          <div className="border-t border-border/50 pt-1.5 mt-1">
            <button
              type="button"
              onClick={handleOpenDelegationModal}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <span>Quản lý phân quyền & ủy quyền...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
