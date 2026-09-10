"use client";

import * as React from "react";
import { useDashboardNav } from "@/components/dashboard/dashboard-context";
import { TasksFocusLanding } from "./tasks-focus-landing";
import { TasksExpandedViews } from "./tasks-expanded-views";

function TasksZoneComponent() {
  const { isStaffExpanded, viewMode } = useDashboardNav();

  // If a specialized expanded view mode is active (calendar, department breakdown, or executive command center),
  // render TasksExpandedViews.
  // Otherwise, always render the canonical UnifiedAdaptiveWorkspace (via TasksFocusLanding)
  // so that Staff, Manager, and Admin/Executive all share the same canonical workspace engine.
  const isSpecializedExpandedView =
    isStaffExpanded &&
    (viewMode === "calendar" ||
      viewMode === "department" ||
      viewMode === "executive");

  return (
    <div className="space-y-6" data-slot="zone-tasks">
      {isSpecializedExpandedView ? <TasksExpandedViews /> : <TasksFocusLanding />}
    </div>
  );
}

export const TasksZone = React.memo(TasksZoneComponent);
