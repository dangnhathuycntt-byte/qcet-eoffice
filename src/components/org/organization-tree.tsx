"use client";

import * as React from "react";
import {
  Building2,
  Users,
  Briefcase,
  GraduationCap,
  Globe,
  Search,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Layers,
  LayoutGrid,
  List,
  X,
  Download,
  Printer,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MobileOrgDrillDown } from "./mobile-org-drilldown";
import {
  QCET_ORG_UNITS,
  type DepartmentCategory,
  type OrgUnitConfig,
} from "@/lib/org/org-structure";
import {
  useDepartmentList,
  type DepartmentOption,
  type DepartmentPersonnel,
} from "@/hooks/use-department-list";
import { toCanonicalUnitCode } from "@/lib/departments";

export { MobileOrgDrillDown };
export type { DepartmentCategory } from "@/lib/org/org-structure";

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
  notionDbKey?: string;
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

function getCategoryIcon(category: DepartmentCategory) {
  switch (category) {
    case "BGH":
      return Building2;
    case "PHONG_CHUC_NANG":
      return Briefcase;
    case "KHOA_CHUYEN_MON":
      return GraduationCap;
    case "TRUNG_TAM":
      return Globe;
  }
}

// Export CSV Function (RFC 4180 with UTF-8 BOM for Microsoft Excel compatibility)
export function exportDirectoryToCSV(departments: DepartmentNode[]) {
  const allStaff = departments.flatMap((d) => d.members);
  const headers = [
    "Họ và tên",
    "Học vị / Học hàm",
    "Chức vụ",
    "Đơn vị",
    "Email công vụ",
    "Số điện thoại",
    "Phòng làm việc",
  ];

  const rows = allStaff.map((s) => [
    `"${s.name}"`,
    `"${s.titlePrefix || ""}"`,
    `"${s.role}"`,
    `"${s.departmentName}"`,
    `"${s.email}"`,
    `"${s.phone || ""}"`,
    `"${s.room || ""}"`,
  ]);

  const csvContent =
    "﻿" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `Danh-ba-can-bo-QCET-${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================================================
// 4. Logical-context persistence (T59)
// ============================================================================
// Expand / search / view context survives reloads and re-entry so the user never
// loses their logical position in the directory. This is session-scoped UI state
// only — never authorization and never dataset scope (Role Is Not Scope).

const ORG_TREE_STATE_KEY = "qcet:org:tree-state";

interface PersistedOrgTreeState {
  activeTab?: "directory" | "bento";
  selectedDeptCode?: string;
  searchQuery?: string;
  viewMode?: "grid" | "list";
  expandedCategories?: Record<DepartmentCategory, boolean>;
}

function readPersistedOrgTreeState(): PersistedOrgTreeState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ORG_TREE_STATE_KEY);
    return raw ? (JSON.parse(raw) as PersistedOrgTreeState) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// 5. Main OrganizationTree Component
// ============================================================================

interface OrganizationTreeProps {
  initialDepartmentCode?: string;
  onSelectStaff?: (staff: StaffMember) => void;
  /**
   * T59: persist logical browse context (tab / search / expanded categories /
   * drill position) across reloads. Enabled by the full-page /org surface only,
   * so an embedded dashboard zone does not inherit page-local browse state.
   */
  persistContext?: boolean;
}

export function getStaffInitials(name?: string): string {
  if (!name || !name.trim()) return "CB";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

export function OrganizationTree({
  initialDepartmentCode,
  onSelectStaff,
  persistContext = false,
}: OrganizationTreeProps) {
  // Primary view is the directory/tree (T56/D12). The unit overview ("bento")
  // is a secondary presentation, never the default landing view.
  const [activeTab, setActiveTab] = React.useState<"directory" | "bento">(
    "directory"
  );
  const [selectedDeptCode, setSelectedDeptCode] = React.useState<string | null>(
    initialDepartmentCode || "ALL"
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<
    "ALL" | "LEADER" | "FACULTY" | "SPECIALIST"
  >("ALL");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");

  // Expanded categories state in sidebar tree
  const [expandedCategories, setExpandedCategories] = React.useState<
    Record<DepartmentCategory, boolean>
  >({
    BGH: true,
    PHONG_CHUC_NANG: true,
    KHOA_CHUYEN_MON: true,
    TRUNG_TAM: true,
  });

  // Selected staff profile modal
  const [activeProfileStaff, setActiveProfileStaff] =
    React.useState<StaffMember | null>(null);

  // T59: persist logical context. Declared before the hydration effect so the
  // first commit can never overwrite an already-stored position.
  const orgContextHydratedRef = React.useRef(false);

  // Merge static org-unit config with API personnel data
  const { departments: apiDepts } = useDepartmentList({ includePersonnel: true });
  const departments = React.useMemo(
    () => buildDepartmentNodes(QCET_ORG_UNITS, apiDepts),
    [apiDepts],
  );

  React.useEffect(() => {
    if (!persistContext || !orgContextHydratedRef.current || typeof window === "undefined") return;
    const payload: PersistedOrgTreeState = {
      activeTab,
      selectedDeptCode: selectedDeptCode ?? "ALL",
      searchQuery,
      viewMode,
      expandedCategories,
    };
    try {
      window.sessionStorage.setItem(ORG_TREE_STATE_KEY, JSON.stringify(payload));
    } catch {
      // Storage unavailable (e.g. private mode): context is simply not persisted.
    }
  }, [persistContext, activeTab, selectedDeptCode, searchQuery, viewMode, expandedCategories]);

  // T59: restore logical context after mount. Skipped when a parent pins an
  // explicit department, so an embedded drill-down keeps its own context.
  React.useEffect(() => {
    if (persistContext && !initialDepartmentCode) {
      const persisted = readPersistedOrgTreeState();
      if (persisted) {
        if (persisted.activeTab) setActiveTab(persisted.activeTab);
        if (persisted.selectedDeptCode) {
          setSelectedDeptCode(persisted.selectedDeptCode);
        }
        if (typeof persisted.searchQuery === "string") {
          setSearchQuery(persisted.searchQuery);
        }
        if (persisted.viewMode) setViewMode(persisted.viewMode);
        if (persisted.expandedCategories) {
          setExpandedCategories((prev) => ({
            ...prev,
            ...persisted.expandedCategories,
          }));
        }
      }
    }
    orgContextHydratedRef.current = true;
  }, [persistContext, initialDepartmentCode]);

  const toggleCategory = (cat: DepartmentCategory) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  // Categories list
  const categoriesList = React.useMemo<{
    category: DepartmentCategory;
    label: string;
    icon: typeof Building2;
    departments: DepartmentNode[];
  }[]>(() => [
    {
      category: "BGH",
      label: "Ban Giám hiệu",
      icon: Building2,
      departments: departments.filter((d) => d.category === "BGH"),
    },
    {
      category: "PHONG_CHUC_NANG",
      label: "Phòng chức năng",
      icon: Briefcase,
      departments: departments.filter(
        (d) => d.category === "PHONG_CHUC_NANG"
      ),
    },
    {
      category: "KHOA_CHUYEN_MON",
      label: "Khoa chuyên môn",
      icon: GraduationCap,
      departments: departments.filter(
        (d) => d.category === "KHOA_CHUYEN_MON"
      ),
    },
    {
      category: "TRUNG_TAM",
      label: "Trung tâm trực thuộc",
      icon: Globe,
      departments: departments.filter((d) => d.category === "TRUNG_TAM"),
    },
  ], [departments]);

  // Current selected department
  const selectedDepartment = departments.find(
    (d) =>
      d.code === selectedDeptCode ||
      toCanonicalUnitCode(selectedDeptCode || "") === d.code
  );

  // Total school staff count — derived from the directory's own members (T61).
  const totalHeadcount = React.useMemo(() => {
    return departments.reduce((acc, d) => acc + d.members.length, 0);
  }, [departments]);



  // Filtered members resolution
  const displayedMembers = React.useMemo(() => {
    let list: StaffMember[] = [];

    if (searchQuery.trim()) {
      list = filterStaffMembers(departments, searchQuery);
    } else if (selectedDeptCode === null || selectedDeptCode === "ALL") {
      list = departments.flatMap((d) => d.members);
    } else if (selectedDepartment) {
      list = selectedDepartment.members;
    }

    // Role filter
    if (roleFilter === "LEADER") {
      list = list.filter(
        (m) =>
          m.role.includes("Hiệu trưởng") ||
          m.role.includes("Trưởng phòng") ||
          m.role.includes("Trưởng khoa") ||
          m.role.includes("Giám đốc")
      );
    } else if (roleFilter === "FACULTY") {
      list = list.filter((m) => m.role.includes("Giảng viên"));
    } else if (roleFilter === "SPECIALIST") {
      list = list.filter(
        (m) =>
          m.role.includes("Chuyên viên") ||
          m.role.includes("Cán bộ") ||
          m.role.includes("Kỹ sư") ||
          m.role.includes("Kế toán")
      );
    }

    return list;
  }, [departments, searchQuery, selectedDeptCode, selectedDepartment, roleFilter]);

  const handleOpenStaff = (staff: StaffMember) => {
    setActiveProfileStaff(staff);
    if (onSelectStaff) {
      onSelectStaff(staff);
    }
  };

  return (
    <div className="space-y-6" data-slot="qcet-organization-system">
      {/* Mobile Hierarchical Drill-Down Navigation (< 640px / sm:hidden) */}
      <div className="block sm:hidden">
        <MobileOrgDrillDown
          initialDepartmentCode={initialDepartmentCode}
          onSelectStaff={handleOpenStaff}
          persistContext={persistContext}
        />
      </div>

      {/* Desktop Visual Organization Tree (sm:block / >= 640px) */}
      <div className="hidden sm:block space-y-6">
        {/* ===================================================================== */}
        {/* 1. Main Navigation Tabs & Action Strip                                */}
        {/* ===================================================================== */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        {/* Modern Segmented Tab Pills — primary (directory) first, secondary last */}
        <div className="inline-flex p-1 rounded-xl bg-muted/60 border border-border/70 shadow-2xs self-start">
          <button
            type="button"
            onClick={() => setActiveTab("directory")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "directory"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="size-3.5 text-indigo-500" strokeWidth={1.5} />
            <span>Danh bạ & Cây tổ chức</span>
            <Badge variant="secondary" className="text-xs h-4.5 px-1.5 font-mono tabular-nums">
              {departments.reduce((sum, d) => sum + d.members.length, 0)}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bento")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              activeTab === "bento"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-3.5 text-primary" strokeWidth={1.5} />
            <span>Sơ đồ đơn vị</span>
            <Badge variant="secondary" className="text-xs h-4.5 px-1.5 font-mono tabular-nums">
              {departments.length}
            </Badge>
          </button>
        </div>

        {/* Utilities: Export CSV & Print */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => exportDirectoryToCSV(departments)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-background text-xs font-medium text-foreground hover:bg-muted/70 shadow-2xs transition-all cursor-pointer"
            title="Xuất file CSV danh bạ"
          >
            <Download className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span>Xuất CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-background text-xs font-medium text-foreground hover:bg-muted/70 shadow-2xs transition-all cursor-pointer"
            title="In trang danh bạ"
          >
            <Printer className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span className="hidden sm:inline">In danh bạ</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. TAB CONTENT 1: SƠ ĐỒ BENTO & CHẤM CÔNG TRỰC TUYẾN                   */}
      {/* ===================================================================== */}
      {activeTab === "bento" && (
        <div className="space-y-6">
          {/* Quick Category Filter Strip */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1">
              Nhóm đơn vị:
            </span>
            <button
              type="button"
              onClick={() => setSelectedDeptCode("ALL")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer",
                selectedDeptCode === "ALL"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                  : "bg-background border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              Toàn trường ({departments.length})
            </button>
            {categoriesList.map((cat) => {
              const count = cat.departments.length;
              const isSelected = cat.departments.some(
                (d) => d.code === selectedDeptCode
              );
              return (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setSelectedDeptCode(cat.departments[0]?.code || "ALL")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer",
                    isSelected
                      ? "bg-primary/10 text-primary border-primary/40 font-semibold shadow-2xs"
                      : "bg-background border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Bento Grid Layout of All 17 Departments */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => {
              const Icon = getCategoryIcon(dept.category);
              const isSelected = selectedDeptCode === dept.code;

              return (
                <div
                  key={dept.id}
                  onClick={() => {
                    setSelectedDeptCode(dept.code);
                    setActiveTab("directory");
                  }}
                  className={cn(
                    "group relative rounded-2xl border p-4.5 transition-all duration-200 cursor-pointer flex flex-col justify-between hover:shadow-md",
                    isSelected
                      ? "border-primary/60 bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                      : "border-border/70 bg-card hover:border-border hover:bg-card/90"
                  )}
                >
                  {/* Card Header: Category & Biometric Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "flex size-9 items-center justify-center rounded-xl shrink-0 transition-colors",
                          dept.category === "BGH"
                            ? "bg-primary/10 text-primary"
                            : dept.category === "PHONG_CHUC_NANG"
                            ? "bg-indigo-500/10 text-indigo-600"
                            : dept.category === "KHOA_CHUYEN_MON"
                            ? "bg-emerald-500/10 text-emerald-700"
                            : "bg-amber-500/10 text-amber-700"
                        )}
                      >
                        <Icon className="size-4.5" strokeWidth={1.5} />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground block">
                          {dept.categoryLabel}
                        </span>
                        <h4 className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {dept.name}
                        </h4>
                      </div>
                    </div>

                    {/* Department Code Badge */}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-border/70 text-xs font-semibold text-muted-foreground shrink-0 font-mono">
                      <span>{dept.code}</span>
                    </div>
                  </div>

                  {/* Leader & Location */}
                  <div className="space-y-1.5 text-xs text-muted-foreground my-2">
                    <div className="flex items-center gap-2">
                      <Users className="size-3.5 text-muted-foreground/70 shrink-0" strokeWidth={1.5} />
                      <span className="font-medium text-foreground truncate">
                        {dept.leaderRole}: {dept.leaderName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <MapPin className="size-3.5 text-muted-foreground/70 shrink-0" strokeWidth={1.5} />
                      <span className="truncate">{dept.location}</span>
                    </div>
                  </div>

                  {/* Department Details & Actions */}
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                        <Users className="size-3.5 text-primary" strokeWidth={1.5} />
                        Nhân sự đơn vị
                      </span>
                      <span className="font-bold text-foreground font-mono">
                        {dept.members.length} cán bộ / GV
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5 truncate max-w-[200px]" title={dept.email}>
                        <Mail className="size-3 text-muted-foreground/70 shrink-0" strokeWidth={1.5} />
                        <span className="truncate">{dept.email}</span>
                      </span>
                      <span className="text-muted-foreground/80 font-mono">
                        {dept.phone}
                      </span>
                    </div>

                    {/* Footer Badges */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                      <span className="text-muted-foreground text-2xs">
                        {/* T61: no per-unit open-task total is available from the directory
                            payload, so the card states the counts it actually holds. */}
                        {dept.members.length} nhân sự
                      </span>
                      <span className="font-semibold text-primary group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
                        Xem danh bạ <ChevronRight className="size-3" strokeWidth={1.5} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. TAB CONTENT 2: DANH BẠ NHÂN SỰ & CÂY PHÂN CẤP TỔ CHỨC (PRIMARY)     */}
      {/* ===================================================================== */}
      {activeTab === "directory" && (
        <div className="space-y-6">
          {/* Global Search & Filter Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xs p-3.5 shadow-card">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Input with quick clear */}
              <div className="relative flex-1">
                <Search
                  className="size-4 text-muted-foreground pointer-events-none absolute left-3 top-2.5"
                  strokeWidth={1.5}
                />
                <input
                  type="text"
                  placeholder="Tìm kiếm cán bộ, giảng viên theo họ tên, chức vụ, email, phòng ban... (⌘K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8.5 pl-9 pr-8 rounded-xl border border-border/70 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Xóa tìm kiếm"
                  >
                    <X className="size-3.5" strokeWidth={1.5} />
                  </button>
                )}
              </div>

              {/* Role Filter Chips & View Mode Switcher */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <div className="inline-flex items-center rounded-xl border border-border/70 bg-muted/40 p-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setRoleFilter("ALL")}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer",
                      roleFilter === "ALL"
                        ? "bg-card text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Tất cả vai trò
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter("LEADER")}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer",
                      roleFilter === "LEADER"
                        ? "bg-card text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Lãnh đạo
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter("FACULTY")}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer",
                      roleFilter === "FACULTY"
                        ? "bg-card text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Giảng viên
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter("SPECIALIST")}
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer",
                      roleFilter === "SPECIALIST"
                        ? "bg-card text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Chuyên viên
                  </button>
                </div>

                {/* View Mode Switcher (Grid vs Table) */}
                <div className="inline-flex items-center rounded-xl border border-border/70 bg-muted/40 p-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer",
                      viewMode === "grid"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Dạng thẻ lưới (Grid)"
                  >
                    <LayoutGrid className="size-3.5" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer",
                      viewMode === "list"
                        ? "bg-card text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Dạng danh sách (List)"
                  >
                    <List className="size-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Two-Column Layout: Left Tree Nav + Right Staff Directory */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Department Accordion Navigation (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="size-3.5" strokeWidth={1.5} />
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      Cơ cấu {departments.length} đơn vị QCET
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-xs h-5 px-2 font-semibold rounded-full font-mono tabular-nums"
                  >
                    {departments.length} đơn vị
                  </Badge>
                </div>

                {/* "Tất cả đơn vị" option */}
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDeptCode("ALL");
                      setSearchQuery("");
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer",
                      selectedDeptCode === "ALL"
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="size-3.5" strokeWidth={1.5} />
                      <span>Toàn trường (Tất cả đơn vị)</span>
                    </div>
                    <Badge
                      variant={selectedDeptCode === "ALL" ? "default" : "outline"}
                      className={cn(
                        "text-xs h-4.5 px-1.5 rounded-md font-mono tabular-nums",
                        selectedDeptCode === "ALL" &&
                          "bg-white/20 text-white border-transparent"
                      )}
                    >
                      {totalHeadcount}
                    </Badge>
                  </button>
                </div>

                {/* Department Categories Accordion */}
                <div className="space-y-3">
                  {categoriesList.map((catGroup) => {
                    const Icon = catGroup.icon;
                    const isExpanded = expandedCategories[catGroup.category];
                    const catHeadcount = catGroup.departments.reduce(
                      (acc, d) => acc + d.members.length,
                      0
                    );

                    return (
                      <div key={catGroup.category} className="space-y-1">
                        {/* Category Header toggle */}
                        <button
                          type="button"
                          onClick={() => toggleCategory(catGroup.category)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="size-3.5 text-primary/80" strokeWidth={1.5} />
                            <span>{catGroup.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-muted-foreground">
                              {catHeadcount}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="size-3.5" strokeWidth={1.5} />
                            ) : (
                              <ChevronRight className="size-3.5" strokeWidth={1.5} />
                            )}
                          </div>
                        </button>

                        {/* Department Items list */}
                        {isExpanded && (
                          <div className="pl-4 space-y-0.5 border-l border-border/60 ml-2">
                            {catGroup.departments.map((dept) => {
                              const isDeptSelected =
                                selectedDeptCode === dept.code ||
                                (selectedDepartment &&
                                  selectedDepartment.code === dept.code);

                              return (
                                <button
                                  key={dept.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDeptCode(dept.code);
                                    setSearchQuery("");
                                  }}
                                  className={cn(
                                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all text-left cursor-pointer",
                                    isDeptSelected
                                      ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                  )}
                                >
                                  <span className="truncate pr-2">{dept.name}</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-2xs font-mono text-muted-foreground">
                                      {dept.members.length} NS
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Staff Cards Grid / Table (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {/* Active Scope Summary Banner */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">
                        {selectedDepartment
                          ? selectedDepartment.name
                          : "Toàn bộ Cán bộ & Giảng viên QCET"}
                      </h3>
                      {selectedDepartment && (
                        <Badge variant="outline" className="text-xs">
                          {selectedDepartment.code}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedDepartment
                        ? selectedDepartment.description
                        : `Tổng số ${displayedMembers.length} cán bộ, giảng viên đang hiển thị.`}
                    </p>
                  </div>

                  {selectedDepartment && (
                    <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-muted/40 border border-border/60 shrink-0 text-xs">
                      <div>
                        <span className="text-xs text-muted-foreground block">
                          Nhân sự đơn vị
                        </span>
                        <span className="font-bold text-foreground font-mono">
                          {selectedDepartment.members.length} cán bộ / GV
                        </span>
                      </div>
                      <div className="w-px h-6 bg-border/60" />
                      <div>
                        <span className="text-xs text-muted-foreground block">
                          Vị trí
                        </span>
                        <span className="font-medium text-foreground truncate max-w-[140px] block">
                          {selectedDepartment.location}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Staff Members Display: Grid View */}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {displayedMembers.map((staff) => (
                    <div
                      key={staff.id}
                      onClick={() => handleOpenStaff(staff)}
                      className="group rounded-2xl border border-border/70 bg-card p-4 shadow-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          {staff.avatar ? (
                            <img
                              src={staff.avatar}
                              alt={staff.name}
                              className="size-11 rounded-xl object-cover border border-border shadow-2xs"
                            />
                          ) : (
                            <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary font-bold text-sm shadow-2xs">
                              {getStaffInitials(staff.name)}
                            </div>
                          )}
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card",
                              staff.status === "ACTIVE"
                                ? "bg-emerald-500"
                                : staff.status === "BUSY"
                                ? "bg-amber-500"
                                : "bg-slate-400"
                            )}
                            title={staff.status === "ACTIVE" ? "Đang công tác" : staff.status === "BUSY" ? "Bận công vụ" : "Nghỉ phép"}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {staff.titlePrefix ? `${staff.titlePrefix} ` : ""}
                              {staff.name}
                            </h4>
                          </div>
                          <p className="text-xs font-medium text-muted-foreground truncate mt-0.5">
                            {staff.role}
                          </p>
                          <span className="text-xs text-muted-foreground/80 truncate block mt-0.5">
                            {staff.departmentName}
                          </span>
                        </div>
                      </div>

                      {/* Contact & Room Bar */}
                      <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          {staff.room && (
                            <span className="px-1.5 py-0.5 rounded-md bg-muted text-xs font-medium text-foreground">
                              {staff.room}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground/80 truncate max-w-[140px]">
                            {staff.room ? `Phòng: ${staff.room}` : "Văn phòng đơn vị"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.dispatchEvent(
                                new CustomEvent("qcet:open-create-task", {
                                  detail: {
                                    assigneeId: staff.id,
                                    assigneeName: staff.name,
                                    departmentId: staff.departmentId,
                                  },
                                })
                              );
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors cursor-pointer"
                            title={`Giao việc trực tiếp cho ${staff.name}`}
                          >
                            <UserCheck className="size-3.5" strokeWidth={1.5} />
                            <span>Giao việc</span>
                          </button>
                          {staff.phone && (
                            <a
                              href={`tel:${staff.phone}`}
                              className="p-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors tabular-nums"
                              title={`Gọi ${staff.phone}`}
                            >
                              <Phone className="size-3.5" strokeWidth={1.5} />
                            </a>
                          )}
                          <a
                            href={`mailto:${staff.email}`}
                            className="p-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title={`Gửi email ${staff.email}`}
                          >
                            <Mail className="size-3.5" strokeWidth={1.5} />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Staff Members Display: List / Table View */
                <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border/70 bg-muted/40 font-semibold text-muted-foreground">
                          <th className="py-2.5 px-3">Cán bộ / Giảng viên</th>
                          <th className="py-2.5 px-3">Chức vụ & Đơn vị</th>
                          <th className="py-2.5 px-3">Liên hệ</th>
                          <th className="py-2.5 px-3">Phòng</th>
                          <th className="py-2.5 px-3 text-right">Trạng thái công tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {displayedMembers.map((staff) => (
                          <tr
                            key={staff.id}
                            onClick={() => handleOpenStaff(staff)}
                            className="hover:bg-muted/40 transition-colors cursor-pointer"
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5">
                                {staff.avatar ? (
                                  <img
                                    src={staff.avatar}
                                    alt={staff.name}
                                    className="size-7 rounded-lg object-cover border border-border/70 shrink-0"
                                  />
                                ) : (
                                  <div className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-primary/10 text-primary font-semibold text-xs shrink-0">
                                    {getStaffInitials(staff.name)}
                                  </div>
                                )}
                                <span className="font-semibold text-foreground">
                                  {staff.titlePrefix ? `${staff.titlePrefix} ` : ""}
                                  {staff.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-foreground">{staff.role}</div>
                              <div className="text-xs text-muted-foreground">
                                {staff.departmentName}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="text-muted-foreground">{staff.email}</div>
                              {staff.phone && (
                                <div className="text-xs font-mono text-muted-foreground">
                                  {staff.phone}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-1.5 py-0.5 rounded-md bg-muted text-xs font-medium">
                                {staff.room || "--"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-xs">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold",
                                  staff.status === "ACTIVE"
                                    ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-700 border border-amber-500/20"
                                )}
                              >
                                {staff.status === "ACTIVE" ? "Đang công tác" : "Nghỉ phép"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* ===================================================================== */}
      {/* 4. Staff Member Detail Modal / Side Sheet                             */}
      {/* ===================================================================== */}
      {activeProfileStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0"
          onClick={() => setActiveProfileStaff(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl space-y-5 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                {activeProfileStaff.avatar ? (
                  <img
                    src={activeProfileStaff.avatar}
                    alt={activeProfileStaff.name}
                    className="size-14 rounded-2xl object-cover border border-border shadow-xs shrink-0"
                  />
                ) : (
                  <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-primary/10 text-primary font-bold text-lg shadow-xs shrink-0">
                    {getStaffInitials(activeProfileStaff.name)}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {activeProfileStaff.titlePrefix
                      ? `${activeProfileStaff.titlePrefix} `
                      : ""}
                    {activeProfileStaff.name}
                  </h3>
                  <p className="text-xs font-semibold text-primary">
                    {activeProfileStaff.role}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeProfileStaff.departmentName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveProfileStaff(null)}
                className="size-8 rounded-xl border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Contact Information & Room */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">
                  Email công vụ
                </span>
                <a
                  href={`mailto:${activeProfileStaff.email}`}
                  className="font-semibold text-primary hover:underline break-all"
                >
                  {activeProfileStaff.email}
                </a>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">
                  Số điện thoại
                </span>
                <a
                  href={`tel:${activeProfileStaff.phone}`}
                  className="font-semibold text-foreground hover:underline font-mono"
                >
                  {activeProfileStaff.phone || "Đang cập nhật"}
                </a>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">
                  Phòng làm việc
                </span>
                <span className="font-semibold text-foreground">
                  {activeProfileStaff.room || "Văn phòng khoa/phòng"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block font-medium">
                  Trạng thái công tác
                </span>
                <span className="font-semibold text-foreground">
                  {activeProfileStaff.status === "ACTIVE"
                    ? "Đang công tác"
                    : activeProfileStaff.status === "BUSY"
                    ? "Bận công vụ"
                    : "Nghỉ phép"}
                </span>
              </div>
            </div>

            {/* Responsibilities list */}
            {activeProfileStaff.responsibilities &&
              activeProfileStaff.responsibilities.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground">
                    Phân công nhiệm vụ trọng tâm
                  </h4>
                  <ul className="space-y-1.5 text-xs text-foreground list-disc pl-4">
                    {activeProfileStaff.responsibilities.map((resp, idx) => (
                      <li key={idx}>{resp}</li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
              {activeProfileStaff.phone && (
                <a
                  href={`tel:${activeProfileStaff.phone}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border bg-background text-xs font-medium text-foreground hover:bg-muted shadow-2xs"
                >
                  <Phone className="size-3.5 text-primary" strokeWidth={1.5} />
                  <span>Gọi điện</span>
                </a>
              )}
              <a
                href={`mailto:${activeProfileStaff.email}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow-xs"
              >
                <Mail className="size-3.5" strokeWidth={1.5} />
                <span>Gửi thư công vụ</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
