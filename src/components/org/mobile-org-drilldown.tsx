"use client";

import * as React from "react";
import {
  Building2,
  Briefcase,
  GraduationCap,
  Globe,
  ChevronRight,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Search,
  X,
  UserCheck,
  Shield,
  Clock,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  QCET_DEPARTMENTS,
  type DepartmentNode,
  type DepartmentCategory,
  type StaffMember,
  filterStaffMembers,
} from "@/components/org/organization-tree";

export type MobileOrgLevel = "root" | "group" | "dept";

export interface OrgGroupMeta {
  category: DepartmentCategory;
  title: string;
  countLabel: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

export interface MobileOrgDrillDownProps {
  initialDepartmentCode?: string;
  onSelectStaff?: (staff: StaffMember) => void;
  className?: string;
}

export function MobileOrgDrillDown({
  initialDepartmentCode,
  onSelectStaff,
  className,
}: MobileOrgDrillDownProps) {
  // Find initial department if provided
  const initialDept = React.useMemo(() => {
    if (!initialDepartmentCode || initialDepartmentCode === "ALL") return null;
    return (
      QCET_DEPARTMENTS.find(
        (d) => d.code.toLowerCase() === initialDepartmentCode.toLowerCase() || d.id === initialDepartmentCode
      ) || null
    );
  }, [initialDepartmentCode]);

  const [currentLevel, setCurrentLevel] = React.useState<MobileOrgLevel>(
    initialDept ? "dept" : "root"
  );
  const [selectedGroup, setSelectedGroup] = React.useState<DepartmentCategory | null>(
    initialDept ? initialDept.category : null
  );
  const [selectedDept, setSelectedDept] = React.useState<DepartmentNode | null>(
    initialDept
  );

  // Search state
  const [searchQuery, setSearchQuery] = React.useState("");
  const isSearching = searchQuery.trim().length > 0;

  // Selected staff profile modal for mobile detail
  const [activeStaffModal, setActiveStaffModal] = React.useState<StaffMember | null>(null);

  // Metrics for groups
  const bghDept = QCET_DEPARTMENTS.find((d) => d.category === "BGH");
  const bghMembersCount = bghDept?.members.length ?? 5;
  const phongCount = QCET_DEPARTMENTS.filter((d) => d.category === "PHONG_CHUC_NANG").length;
  const khoaCount = QCET_DEPARTMENTS.filter((d) => d.category === "KHOA_CHUYEN_MON").length;
  const ttCount = QCET_DEPARTMENTS.filter((d) => d.category === "TRUNG_TAM").length;

  const orgGroups: OrgGroupMeta[] = [
    {
      category: "BGH",
      title: "Ban Giám hiệu",
      countLabel: `${bghMembersCount} thành viên`,
      icon: Building2,
    },
    {
      category: "PHONG_CHUC_NANG",
      title: "Các phòng chức năng",
      countLabel: `${phongCount} phòng ban`,
      icon: Briefcase,
    },
    {
      category: "KHOA_CHUYEN_MON",
      title: "Các khoa đào tạo",
      countLabel: `${khoaCount} khoa chuyên môn`,
      icon: GraduationCap,
    },
    {
      category: "TRUNG_TAM",
      title: "Các trung tâm & đơn vị trực thuộc",
      countLabel: `${ttCount} đơn vị trực thuộc`,
      icon: Globe,
    },
  ];

  // Group label lookup
  const getGroupTitle = (category: DepartmentCategory | null): string => {
    switch (category) {
      case "BGH":
        return "Ban Giám hiệu";
      case "PHONG_CHUC_NANG":
        return "Các phòng chức năng";
      case "KHOA_CHUYEN_MON":
        return "Các khoa đào tạo";
      case "TRUNG_TAM":
        return "Các trung tâm & đơn vị trực thuộc";
      default:
        return "Cơ cấu trường";
    }
  };

  // Navigate into an org group
  const handleSelectGroup = (category: DepartmentCategory) => {
    setSelectedGroup(category);
    if (category === "BGH" && bghDept) {
      // For BGH, direct drilldown to department detail view
      setSelectedDept(bghDept);
      setCurrentLevel("dept");
    } else {
      setSelectedDept(null);
      setCurrentLevel("group");
    }
  };

  // Navigate into a department
  const handleSelectDepartment = (dept: DepartmentNode) => {
    setSelectedDept(dept);
    setSelectedGroup(dept.category);
    setCurrentLevel("dept");
  };

  // Handle back navigation
  const handleBack = () => {
    if (currentLevel === "dept") {
      if (selectedGroup === "BGH") {
        // From BGH detail, return to root
        setCurrentLevel("root");
        setSelectedDept(null);
        setSelectedGroup(null);
      } else {
        // Return to group list
        setCurrentLevel("group");
        setSelectedDept(null);
      }
    } else if (currentLevel === "group") {
      // Return to root
      setCurrentLevel("root");
      setSelectedGroup(null);
      setSelectedDept(null);
    }
  };

  // Filtered search results
  const searchResults = React.useMemo(() => {
    if (!isSearching) return [];
    return filterStaffMembers(QCET_DEPARTMENTS, searchQuery);
  }, [isSearching, searchQuery]);

  // Departments in selected group
  const groupDepartments = React.useMemo(() => {
    if (!selectedGroup) return [];
    return QCET_DEPARTMENTS.filter((d) => d.category === selectedGroup);
  }, [selectedGroup]);

  return (
    <div
      className={cn("w-full space-y-3 select-none pb-8", className)}
      data-slot="mobile-org-drilldown"
    >
      {/* Search Input Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
          <Search size={16} strokeWidth={1.5} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm cán bộ, giảng viên, số điện thoại, đơn vị..."
          className="w-full h-11 pl-10 pr-9 rounded-xl border border-border/80 bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
        />
        {isSearching && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground touch-manipulation cursor-pointer"
            aria-label="Xóa tìm kiếm"
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Global Search Results Overlay */}
      {isSearching ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>Kết quả tìm kiếm ({searchResults.length})</span>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-primary hover:underline cursor-pointer"
            >
              Đóng tìm kiếm
            </button>
          </div>
          {searchResults.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-border/80 bg-card p-6">
              <p className="text-xs font-semibold text-foreground">Không tìm thấy nhân sự phù hợp</p>
              <p className="text-xs text-muted-foreground mt-1">
                Thử tìm với họ tên, số điện thoại hoặc mã đơn vị khác
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((staff) => (
                <StaffTouchCard
                  key={staff.id}
                  staff={staff}
                  onSelectStaff={() => {
                    setActiveStaffModal(staff);
                    onSelectStaff?.(staff);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ================================================================= */}
          {/* BREADCRUMB & BACK BUTTON BAR                                      */}
          {/* ================================================================= */}
          {currentLevel !== "root" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl border border-border/80 bg-card text-xs font-medium text-foreground hover:bg-muted/50 active:scale-[0.98] transition-all touch-manipulation cursor-pointer shadow-2xs"
                data-testid="mobile-org-back-button"
              >
                <ArrowLeft size={16} strokeWidth={1.5} className="text-primary" />
                <span>
                  Quay lại{" "}
                  <span className="font-semibold">
                    {currentLevel === "dept"
                      ? getGroupTitle(selectedGroup)
                      : "Cơ cấu trường"}
                  </span>
                </span>
              </button>
            </div>
          )}

          {/* ================================================================= */}
          {/* LEVEL 0: ROOT VIEW (CATEGORIES / ORG GROUPS)                      */}
          {/* ================================================================= */}
          {currentLevel === "root" && (
            <div className="space-y-2.5" data-testid="mobile-org-root-view">
              <div className="px-1 py-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Cơ cấu tổ chức Nhà trường (QCET)
                </span>
              </div>

              <div className="space-y-2">
                {orgGroups.map((grp) => {
                  const IconComp = grp.icon;
                  return (
                    <button
                      key={grp.category}
                      type="button"
                      onClick={() => handleSelectGroup(grp.category)}
                      className="w-full flex items-center justify-between gap-3 p-3.5 min-h-[48px] rounded-xl border border-border/80 bg-card hover:bg-muted/40 active:bg-muted/60 transition-all text-left touch-manipulation cursor-pointer shadow-2xs group"
                      data-testid={`org-group-${grp.category.toLowerCase()}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                          <IconComp size={18} strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {grp.title}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono tabular-nums mt-0.5">
                            {grp.countLabel}
                          </div>
                        </div>
                      </div>
                      <div className="size-7 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0 group-hover:text-foreground">
                        <ChevronRight size={16} strokeWidth={1.5} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* LEVEL 1: SUB-LEVEL VIEW (DEPARTMENTS LIST IN GROUP)               */}
          {/* ================================================================= */}
          {currentLevel === "group" && selectedGroup && (
            <div className="space-y-2.5" data-testid="mobile-org-group-view">
              <div className="px-1 py-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {getGroupTitle(selectedGroup)} ({groupDepartments.length})
                </span>
              </div>

              <div className="space-y-2">
                {groupDepartments.map((dept) => (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => handleSelectDepartment(dept)}
                    className="w-full flex items-center justify-between gap-3 p-3.5 min-h-[48px] rounded-xl border border-border/80 bg-card hover:bg-muted/40 active:bg-muted/60 transition-all text-left touch-manipulation cursor-pointer shadow-2xs group"
                    data-testid={`dept-card-${dept.code.toLowerCase()}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {dept.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-xs font-mono tabular-nums font-semibold bg-primary/10 text-primary border border-primary/20">
                          {dept.code}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{dept.leaderRole}:</span>
                        <span className="font-medium text-foreground">{dept.leaderName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono tabular-nums mt-0.5 flex items-center gap-2">
                        <span>{dept.members.length} nhân sự</span>
                        <span>•</span>
                        <span>{dept.phone}</span>
                      </div>
                    </div>
                    <div className="size-7 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0 group-hover:text-foreground">
                      <ChevronRight size={16} strokeWidth={1.5} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* LEVEL 2: DEPARTMENT DETAIL VIEW (PERSONNEL LIST)                  */}
          {/* ================================================================= */}
          {currentLevel === "dept" && selectedDept && (
            <div className="space-y-3" data-testid="mobile-org-dept-view">
              {/* Department Header Summary */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                      {selectedDept.categoryLabel}
                    </span>
                    <h2 className="text-sm font-bold text-foreground mt-0.5">
                      {selectedDept.name}
                    </h2>
                  </div>
                  <Badge variant="outline" className="font-mono tabular-nums text-xs">
                    {selectedDept.code}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedDept.description}
                </p>

                {/* Contact strip with min-h-[44px] tap targets */}
                <div className="pt-2 border-t border-border/60 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin size={14} strokeWidth={1.5} className="shrink-0 text-primary" />
                    <span>{selectedDept.location}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <a
                      href={`tel:${selectedDept.phone.replace(/\s+/g, "")}`}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-2.5 py-1 rounded-lg bg-muted/50 hover:bg-muted text-xs font-mono tabular-nums text-foreground touch-manipulation cursor-pointer border border-border/60"
                    >
                      <Phone size={13} strokeWidth={1.5} className="text-emerald-700" />
                      <span>{selectedDept.phone}</span>
                    </a>
                    <a
                      href={`mailto:${selectedDept.email}`}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-2.5 py-1 rounded-lg bg-muted/50 hover:bg-muted text-xs text-foreground touch-manipulation cursor-pointer border border-border/60"
                    >
                      <Mail size={13} strokeWidth={1.5} className="text-blue-700" />
                      <span>{selectedDept.email}</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Personnel List Header */}
              <div className="px-1 pt-1 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Danh sách nhân sự ({selectedDept.members.length})
                </span>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {selectedDept.code}
                </span>
              </div>

              {/* Personnel List Cards */}
              <div className="space-y-2">
                {selectedDept.members.map((staff) => (
                  <StaffTouchCard
                    key={staff.id}
                    staff={staff}
                    onSelectStaff={() => {
                      setActiveStaffModal(staff);
                      onSelectStaff?.(staff);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Staff Quick Profile Detail Modal */}
      {activeStaffModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setActiveStaffModal(null)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl border border-border/80 p-4 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-sm text-primary font-mono tabular-nums">
                  {activeStaffModal.name.split(" ").slice(-2).map((n) => n[0]).join("")}
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">
                    {activeStaffModal.titlePrefix} {activeStaffModal.name}
                  </div>
                  <div className="text-xs font-medium text-primary">
                    {activeStaffModal.role}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {activeStaffModal.departmentName}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveStaffModal(null)}
                className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground touch-manipulation cursor-pointer"
                aria-label="Đóng"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Attendance status */}
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Trạng thái công tác</span>
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-600" />
                <span>
                  {activeStaffModal.status === "ACTIVE"
                    ? "Đang công tác"
                    : activeStaffModal.status === "ON_LEAVE"
                    ? "Nghỉ phép"
                    : "Bận"}
                </span>
              </span>
            </div>

            {/* Room if present */}
            {activeStaffModal.room && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin size={14} strokeWidth={1.5} className="text-primary" />
                <span>Phòng làm việc: {activeStaffModal.room}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {activeStaffModal.phone && (
                <a
                  href={`tel:${activeStaffModal.phone.replace(/\s+/g, "")}`}
                  className="flex items-center justify-center gap-2 min-h-[48px] px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all touch-manipulation cursor-pointer font-mono tabular-nums shadow-xs"
                >
                  <Phone size={14} strokeWidth={1.5} />
                  <span>{activeStaffModal.phone}</span>
                </a>
              )}
              <a
                href={`mailto:${activeStaffModal.email}`}
                className="flex items-center justify-center gap-2 min-h-[48px] px-3 rounded-xl border border-border/80 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold active:scale-[0.98] transition-all touch-manipulation cursor-pointer shadow-xs"
              >
                <Mail size={14} strokeWidth={1.5} />
                <span>Gửi Email</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface StaffTouchCardProps {
  staff: StaffMember;
  onSelectStaff: () => void;
}

function StaffTouchCard({ staff, onSelectStaff }: StaffTouchCardProps) {
  const isLeader =
    staff.role.includes("Hiệu trưởng") ||
    staff.role.includes("Trưởng phòng") ||
    staff.role.includes("Trưởng khoa") ||
    staff.role.includes("Giám đốc");
  const isDeputy =
    staff.role.includes("Phó Hiệu trưởng") ||
    staff.role.includes("Phó trưởng phòng") ||
    staff.role.includes("Phó Trưởng phòng") ||
    staff.role.includes("Phó trưởng khoa") ||
    staff.role.includes("Phó Trưởng khoa") ||
    staff.role.includes("Phó Giám đốc");

  const initials = staff.name
    .split(" ")
    .slice(-2)
    .map((n) => n[0])
    .join("");

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3 min-h-[48px] rounded-xl border bg-card transition-all shadow-2xs touch-manipulation",
        isLeader
          ? "border-primary/30 bg-primary/[0.02]"
          : isDeputy
          ? "border-indigo-500/20 bg-indigo-500/[0.01]"
          : "border-border/80"
      )}
      data-testid={`staff-card-${staff.id}`}
    >
      <div
        onClick={onSelectStaff}
        className="flex items-start justify-between gap-2.5 cursor-pointer"
      >
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary font-mono shrink-0 mt-0.5">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-foreground">
                {staff.titlePrefix} {staff.name}
              </span>
              {isLeader && (
                <span className="px-1.5 py-0.2 rounded text-xs font-semibold bg-primary/15 text-primary border border-primary/25">
                  Trưởng đơn vị
                </span>
              )}
              {isDeputy && (
                <span className="px-1.5 py-0.2 rounded text-xs font-semibold bg-indigo-500/15 text-indigo-700 border border-indigo-500/25">
                  Phó đơn vị
                </span>
              )}
            </div>
            <div className="text-xs text-primary/90 font-medium mt-0.5">
              {staff.role}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {staff.departmentName}
            </div>
          </div>
        </div>

        {/* Attendance Status Dot */}
        <div className="shrink-0 flex items-center gap-1 pt-1">
          <span
            className={cn(
              "size-2 rounded-full",
              staff.status === "ACTIVE"
                ? "bg-emerald-500"
                : staff.status === "ON_LEAVE"
                ? "bg-amber-500"
                : "bg-slate-400"
            )}
            title={staff.status}
          />
        </div>
      </div>

      {/* Quick Action Contact Bar (min-h-[44px] tap targets) */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        {staff.phone && (
          <a
            href={`tel:${staff.phone.replace(/\s+/g, "")}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-2 rounded-lg bg-muted/50 hover:bg-muted text-xs font-mono tabular-nums text-foreground touch-manipulation cursor-pointer border border-border/60"
            data-testid={`phone-btn-${staff.id}`}
          >
            <Phone size={13} strokeWidth={1.5} className="text-emerald-700" />
            <span>{staff.phone}</span>
          </a>
        )}
        <a
          href={`mailto:${staff.email}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-2 rounded-lg bg-muted/50 hover:bg-muted text-xs text-foreground touch-manipulation cursor-pointer border border-border/60 truncate"
          data-testid={`email-btn-${staff.id}`}
        >
          <Mail size={13} strokeWidth={1.5} className="text-blue-700 shrink-0" />
          <span className="truncate">{staff.email}</span>
        </a>
      </div>
    </div>
  );
}
