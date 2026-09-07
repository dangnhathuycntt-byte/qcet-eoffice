"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkspaceZone, parseZoneParam } from "@/types/workspace";
import type { TaskScope, TaskViewMode } from "@/components/dashboard/unified-task-toolbar";
import {
  getDefaultScopeForRole,
  getDefaultViewModeForRole,
  parseScopeParam,
  scopeToParam,
  parseViewModeParam,
} from "@/lib/unified-task-hub";
import { getAcademicMonthInfo } from "@/lib/academic-calendar";
import type { UserRole } from "@/types/auth";

export interface UrlParamsSyncReturn {
  activeZone: WorkspaceZone;
  scope: TaskScope;
  viewMode: TaskViewMode;
  selectedDepartment: string;
  selectedAcademicMonth: number | "ALL";
  isStaffExpanded: boolean;
  useAdvancedToolbar: boolean;
  handleZoneChange: (zone: WorkspaceZone) => void;
  handleScopeChange: (scope: TaskScope) => void;
  handleViewModeChange: (view: TaskViewMode) => void;
  handleDepartmentChange: (dept: string) => void;
  handleAcademicMonthChange: (month: number | "ALL") => void;
  handleToggleStaffExpanded: () => void;
  setIsStaffExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setUseAdvancedToolbar: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useUrlParamsSync(userRole?: UserRole): UrlParamsSyncReturn {
  const router = useRouter();
  const searchParams = useSearchParams();

  const zoneQuery = searchParams.get("zone");
  const scopeQuery = searchParams.get("scope");
  const viewQuery = searchParams.get("view");
  const deptQuery = searchParams.get("dept");
  const monthQuery = searchParams.get("month");

  const defaultScope = React.useMemo(() => getDefaultScopeForRole(userRole), [userRole]);
  const defaultViewMode = React.useMemo(() => getDefaultViewModeForRole(userRole), [userRole]);

  const [activeZone, setActiveZone] = React.useState<WorkspaceZone>(() => parseZoneParam(zoneQuery));
  const [scope, setScope] = React.useState<TaskScope>(() => parseScopeParam(scopeQuery, defaultScope));
  const [viewMode, setViewMode] = React.useState<TaskViewMode>(() => parseViewModeParam(viewQuery, defaultViewMode));
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>(deptQuery || "ALL");
  const [selectedAcademicMonth, setSelectedAcademicMonth] = React.useState<number | "ALL">(() => {
    if (monthQuery === "ALL") return "ALL";
    if (monthQuery) {
      const parsed = parseInt(monthQuery, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) return parsed;
    }
    return getAcademicMonthInfo(new Date()).monthNumber;
  });

  const [isStaffExpanded, setIsStaffExpanded] = React.useState<boolean>(
    () => viewQuery !== null && viewQuery !== "focus"
  );
  const [useAdvancedToolbar, setUseAdvancedToolbar] = React.useState<boolean>(false);

  // Sync from URL
  React.useEffect(() => {
    if (zoneQuery === "portal") {
      router.replace("/portal");
      return;
    }
    setActiveZone(parseZoneParam(zoneQuery));
  }, [zoneQuery, router]);

  React.useEffect(() => {
    setScope(scopeQuery ? parseScopeParam(scopeQuery, defaultScope) : defaultScope);
  }, [scopeQuery, defaultScope]);

  React.useEffect(() => {
    if (viewQuery) {
      setViewMode(parseViewModeParam(viewQuery, defaultViewMode));
      setIsStaffExpanded(viewQuery !== "focus");
    } else {
      setViewMode(defaultViewMode);
      setIsStaffExpanded(false);
    }
  }, [viewQuery, defaultViewMode]);

  React.useEffect(() => {
    if (deptQuery !== null) setSelectedDepartment(deptQuery);
  }, [deptQuery]);

  React.useEffect(() => {
    if (monthQuery !== null) {
      if (monthQuery === "ALL") setSelectedAcademicMonth("ALL");
      else {
        const parsed = parseInt(monthQuery, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) setSelectedAcademicMonth(parsed);
      }
    }
  }, [monthQuery]);

  const updateUrlParams = React.useCallback(
    (updates: {
      zone?: WorkspaceZone;
      scope?: TaskScope;
      view?: TaskViewMode;
      dept?: string;
      month?: number | "ALL";
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.zone !== undefined) {
        if (updates.zone === "portal") params.delete("zone");
        else params.set("zone", updates.zone);
      }
      if (updates.scope !== undefined) params.set("scope", scopeToParam(updates.scope));
      if (updates.view !== undefined) params.set("view", updates.view);
      if (updates.dept !== undefined) {
        if (updates.dept && updates.dept !== "ALL") params.set("dept", updates.dept);
        else params.delete("dept");
      }
      if (updates.month !== undefined) {
        if (updates.month === "ALL") params.set("month", "ALL");
        else params.set("month", String(updates.month));
      }
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [router, searchParams]
  );

  const handleZoneChange = React.useCallback(
    (newZone: WorkspaceZone) => {
      if (newZone === "portal") {
        router.push("/portal");
        return;
      }
      setActiveZone(newZone);
      updateUrlParams({ zone: newZone });
    },
    [updateUrlParams, router]
  );

  const handleScopeChange = React.useCallback(
    (newScope: TaskScope) => {
      setScope(newScope);
      updateUrlParams({ scope: newScope });
    },
    [updateUrlParams]
  );

  const handleViewModeChange = React.useCallback(
    (newMode: TaskViewMode) => {
      setViewMode(newMode);
      updateUrlParams({ view: newMode });
    },
    [updateUrlParams]
  );

  const handleDepartmentChange = React.useCallback(
    (newDept: string) => {
      setSelectedDepartment(newDept);
      updateUrlParams({ dept: newDept });
    },
    [updateUrlParams]
  );

  const handleAcademicMonthChange = React.useCallback(
    (newMonth: number | "ALL") => {
      setSelectedAcademicMonth(newMonth);
      updateUrlParams({ month: newMonth });
    },
    [updateUrlParams]
  );

  const handleToggleStaffExpanded = React.useCallback(() => {
    setIsStaffExpanded((prev) => {
      const next = !prev;
      if (next) {
        updateUrlParams({ view: "table" });
      } else {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("view");
        const qs = params.toString();
        router.replace(qs ? `/?${qs}` : "/", { scroll: false });
      }
      return next;
    });
  }, [updateUrlParams, searchParams, router]);

  return {
    activeZone,
    scope,
    viewMode,
    selectedDepartment,
    selectedAcademicMonth,
    isStaffExpanded,
    useAdvancedToolbar,
    handleZoneChange,
    handleScopeChange,
    handleViewModeChange,
    handleDepartmentChange,
    handleAcademicMonthChange,
    handleToggleStaffExpanded,
    setIsStaffExpanded,
    setUseAdvancedToolbar,
  };
}
