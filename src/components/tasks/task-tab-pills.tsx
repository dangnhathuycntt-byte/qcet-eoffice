"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TASK_TABS, parseTaskTab, type TaskTab } from "@/domain/tasks/task-tabs";

/** Các view của trang Nhiệm vụ dạng viên thuốc (như "All projects" của Linear). */
export function TaskTabPills({ value, onChange }: { value: TaskTab; onChange: (tab: TaskTab) => void }) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const tab = parseTaskTab(next);
        if (tab) onChange(tab);
      }}
      className="shrink-0"
    >
      <TabsList variant="pill" size="sm" aria-label="Chế độ xem nhiệm vụ">
        {TASK_TABS.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
