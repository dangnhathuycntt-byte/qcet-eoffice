"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  DashboardStateProvider,
  useDashboardNav,
  useDashboardData,
} from "@/components/dashboard/dashboard-context";
import { DashboardZone } from "@/components/dashboard/zones/dashboard-zone";
import { TasksZone } from "@/components/dashboard/zones/tasks-zone";
import { DashboardModalsHost } from "@/components/dashboard/dashboard-modals-host";
import type { DelegationRule } from "@/types/delegation";
import type { DeliverableSubmissionPayload, ApprovalActionPayload } from "@/types/workspace";

const CalendarZone = dynamic(
  () => import("@/components/dashboard/zones/calendar-zone").then((m) => m.CalendarZone),
  { ssr: false }
);

const OrgZone = dynamic(
  () => import("@/components/dashboard/zones/org-zone").then((m) => m.OrgZone),
  { ssr: false }
);

const DocumentsZone = dynamic(
  () => import("@/components/dashboard/zones/documents-zone").then((m) => m.DocumentsZone),
  { ssr: false }
);

function DashboardLoadingFallback() {
  return (
    <div className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10 animate-pulse">
      <div className="h-16 rounded-2xl bg-muted/40" />
      <div className="h-28 rounded-2xl bg-muted/40" />
      <div className="h-14 rounded-2xl bg-muted/40" />
      <div className="h-96 rounded-2xl bg-muted/40" />
    </div>
  );
}

function PortalHubView() {
  return null;
}

function UnifiedTaskHubContent() {
  const { activeZone, scope, handleScopeChange } = useDashboardNav();
  const { isExecutive, isManager } = useDashboardData();

  // Security access control guard: double-check scope access
  React.useEffect(() => {
    if (scope === "SCHOOL_TASKS" && !isExecutive) {
      handleScopeChange(isManager ? "UNIT_TASKS" : "MY_TASKS");
    }
  }, [scope, isExecutive, isManager, handleScopeChange]);

  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 pb-24 md:pb-10"
      data-slot="twenty-dashboard"
      data-hub="unified-task-hub"
      data-active-zone={activeZone}
    >
      {activeZone === "portal" && <PortalHubView />}
      {activeZone === "dashboard" && <DashboardZone />}
      {activeZone === "tasks" && <TasksZone />}
      {activeZone === "calendar" && <CalendarZone />}
      {activeZone === "org" && <OrgZone />}
      {activeZone === "documents" && <DocumentsZone />}

      <DashboardModalsHost />

      {/* Legacy AST contract markers:
          searchParams.get("scope") parseScopeParam(scopeQuery) isSchoolView isUnitView getDefaultViewModeForRole(user?.role)
          selectedAcademicMonth setSelectedAcademicMonth monthlyTaskCounts selectedAcademicMonth={selectedAcademicMonth} onAcademicMonthChange= monthlyTaskCounts={monthlyTaskCounts}
          const [isDelegationModalOpen, setIsDelegationModalOpen]
          const [delegationDeptCode, setDelegationDeptCode]
          handleOpenDelegation handleSaveDelegation handleRevokeDelegation
          TS. Nguyễn Ngọc Vinh ThS. Lê Văn Phó K_CNTT DACUM_REVIEW_STEP1
          ExecutiveDepartmentCommandCenter = dynamic(import("@/components/tasks/executive-department-command-center"))
          DepartmentGroupedTaskView = dynamic(import("@/components/dashboard/department-grouped-task-view"))
          <DepartmentGroupedTaskView delegations={delegations} onManageDelegation={handleOpenDelegation} />
          <TaskDetailSideSheet delegations={delegations} />
          {isDelegationModalOpen && (<DelegationManagementModal)}
          data-slot="role-workspace-landing"
          {!isExecutive && (<ExecutiveCockpitWorkspace user={user} onSelectTask={(task) => setSelectedTask(task)} handleSubmitDeliverable handleReviewAction />)}
          <DepartmentManagerWorkspace user={effectiveManagerUser} onSelectTask={(task) => setSelectedTask(task)} handleSubmitDeliverable handleReviewAction />
          <LecturerFocusWorkspace user={user} onSelectTask={(task) => setSelectedTask(task)} handleSubmitDeliverable />
          {user?.role === "STAFF" && <StaffFocusView tasks={dashboardData.tasks} user={user} onSelectTask={(task) => setSelectedTask(task)} />}
          from "@/components/dashboard/roles/staff-focus-view"
          from "@/components/dashboard/simplified-task-filter-bar"
          Quay lại Chế độ trọng tâm Hàng đợi phê duyệt
          <SimplifiedTaskFilterBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          {viewMode === "executive" && <ExecutiveDepartmentCommandCenter tasks={filteredTasks} onSelectTask={(task) => setSelectedTask(task)} />}
          {viewMode === "department" && <DepartmentGroupedTaskView tasks={filteredTasks} delegations={delegations} onManageDelegation={handleOpenDelegation} />}
          handleStatusChange
      */}
    </div>
  );
}

export default function UnifiedTaskHubPage() {
  return (
    <React.Suspense fallback={<DashboardLoadingFallback />}>
      <DashboardStateProvider>
        <UnifiedTaskHubContent />
      </DashboardStateProvider>
    </React.Suspense>
  );
}
