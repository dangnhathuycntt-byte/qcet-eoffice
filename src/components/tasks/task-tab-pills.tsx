"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MenuContent, MenuOptionItem, MenuRoot, MenuTrigger } from "@/components/ui/menu";
import { TASK_TABS, parseTaskTab, type TaskTab } from "@qcet/shared/domain/tasks/task-tabs";

/**
 * Các view của trang Nhiệm vụ. Từ md: dạng viên thuốc (như "All projects" của Linear).
 * Điện thoại: một nút hiện view đang chọn kèm mũi tên, bấm ra danh sách (như Linear mobile) để chừa chỗ cho icon tìm, lọc, hiển thị.
 */
export function TaskTabPills({ value, onChange }: { value: TaskTab; onChange: (tab: TaskTab) => void }) {
  const [open, setOpen] = React.useState(false);
  const current = TASK_TABS.find((tab) => tab.id === value) ?? TASK_TABS[0];

  return (
    <>
      <MenuRoot open={open} onOpenChange={setOpen}>
        <MenuTrigger
          aria-label={`Chế độ xem nhiệm vụ: ${current.label}`}
          className="inline-flex h-7 max-md:h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-selected px-3 text-xs font-medium text-foreground outline-none touch-manipulation md:hidden"
        >
          <span>{current.label}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </MenuTrigger>
        <MenuContent align="start" className="w-48" mobileSheet sheetTitle="Chế độ xem">
          {TASK_TABS.map((tab) => (
            <MenuOptionItem
              key={tab.id}
              className="h-9"
              selected={tab.id === value}
              closeOnClick
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </MenuOptionItem>
          ))}
        </MenuContent>
      </MenuRoot>

      <Tabs
        value={value}
        onValueChange={(next) => {
          const tab = parseTaskTab(next);
          if (tab) onChange(tab);
        }}
        className="hidden shrink-0 md:block"
      >
        <TabsList variant="pill" size="sm" aria-label="Chế độ xem nhiệm vụ">
          {TASK_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </>
  );
}
