"use client";

import * as React from "react";
import { useDashboardNav } from "@/components/dashboard/dashboard-context";
import { TasksFocusLanding } from "./tasks-focus-landing";
import { TasksExpandedViews } from "./tasks-expanded-views";

function TasksZoneComponent() {
  const { isStaffExpanded } = useDashboardNav();

  return (
    <div className="space-y-6" data-slot="zone-tasks">
      {!isStaffExpanded ? <TasksFocusLanding /> : <TasksExpandedViews />}
    </div>
  );
}

export const TasksZone = React.memo(TasksZoneComponent);
