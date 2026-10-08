"use client";

import * as React from "react";
import { Select } from "@base-ui/react/select";
import { Combobox } from "@base-ui/react/combobox";
import { Check, Loader2, X } from "lucide-react";
import {
  TaskIconAssignee,
  TaskIconDeadline,
  TaskIconPriorityUrgent,
  TaskIconPriorityHigh,
  TaskIconPriorityNormal,
  TaskIconPriorityLow,
} from "@/lib/icons/task-icons";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import type { TaskStatus, TaskPriority } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { computeDueStatus } from "@/domain/tasks/deadlines";
import { formatDisplayDate } from "@/lib/format/date";
import { UserAvatar } from "@/components/ui/user-avatar";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { propertyMotionStyle, propertyPopupClassName, propertyTriggerVariants } from "@/components/ui/property-control-styles";
import type { PriorityDisplayConfig } from "@/domain/tasks/display-config";

export interface TaskStatusChoice {
  value: TaskStatus;
  label: string;
  dotClass: string;
  iconClass: string;
  disabled?: boolean;
  reason?: string;
}

export function TaskStatusSelect({ value, options, disabled, onValueChange }: {
  value: TaskStatus;
  options: TaskStatusChoice[];
  disabled?: boolean;
  onValueChange: (value: TaskStatus) => void;
}) {
  // Loại bỏ CANCELLED khỏi dropdown — trạng thái này chỉ set bởi admin/hệ thống
  const HIDDEN_STATUSES = new Set(["CANCELLED"]);
  const visibleOptions = options.filter((opt) => !HIDDEN_STATUSES.has(opt.value) || opt.value === value);
  const selected = visibleOptions.find((option) => option.value === value);

  return (
    <Select.Root value={value} disabled={disabled} onValueChange={(next) => {
      if (next && next !== value && !visibleOptions.find((option) => option.value === next)?.disabled) onValueChange(next);
    }}>
      <Select.Trigger aria-label="Trạng thái" className={propertyTriggerVariants()} style={propertyMotionStyle}>
        <TaskStatusCircle status={value} />
        <Select.Value>{() => <span>{selected?.label ?? value}</span>}</Select.Value>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="z-50" side="bottom" align="start" sideOffset={4} collisionPadding={8} alignItemWithTrigger={false} collisionAvoidance={{ side: "none", align: "shift" }}>
          <Select.Popup className={cn(propertyPopupClassName, "w-48 max-h-[var(--available-height)] overflow-y-auto")} style={propertyMotionStyle}>
            <Select.List>
              {visibleOptions.map((option) => (
                <Select.Item key={option.value} value={option.value} disabled={option.disabled} title={option.reason}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-accent data-[selected]:font-medium data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40">
                  <span className="flex items-center gap-2">
                    <TaskStatusCircle status={option.value} />
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </span>
                  <Select.ItemIndicator><Check className="size-3.5 text-foreground" strokeWidth={1.5} /></Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export type { PersonnelOption as TaskPersonnelOption } from "@/hooks/use-personnel-list";
import type { PersonnelOption } from "@/hooks/use-personnel-list";

export function TaskAssigneePicker({ items, assigneeId, assigneeName, assigneeAvatarUrl, displayName, disabled, pending, onSelect }: {
  items: PersonnelOption[];
  assigneeId?: string;
  assigneeName?: string;
  assigneeAvatarUrl?: string | null;
  displayName: string;
  disabled?: boolean;
  pending?: boolean;
  onSelect: (person: PersonnelOption) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = items.find((person) => assigneeId ? person.id === assigneeId : person.name === assigneeName) ?? null;

  return (
    <Combobox.Root items={items} value={selected} open={open} onOpenChange={setOpen}
      onValueChange={(person) => { if (person) void onSelect(person).then(() => setOpen(false)).catch(() => {}); }}
      itemToStringLabel={(person) => person.name} itemToStringValue={(person) => person.id}
      isItemEqualToValue={(person, value) => person.id === value.id}
      filter={(person, query) => {
        const normalized = query.trim().toLocaleLowerCase("vi");
        return !normalized || [person.name, person.email, person.departmentName].some((text) => text?.toLocaleLowerCase("vi").includes(normalized));
      }} autoHighlight disabled={disabled || pending}>
      <Combobox.Trigger aria-label={`Người phụ trách: ${displayName}`} className={propertyTriggerVariants({ variant: "muted" })} style={propertyMotionStyle}>
        {pending ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
        ) : selected || assigneeName ? (
          <UserAvatar name={selected?.name ?? assigneeName} avatarUrl={selected?.avatarUrl ?? assigneeAvatarUrl} size="sm" />
        ) : (
          <TaskIconAssignee className="size-4 shrink-0" />
        )}
        <span className="truncate font-normal">{displayName}</span>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner className="z-50" side="bottom" align="start" sideOffset={4} collisionPadding={8}>
          <Combobox.Popup className={cn(propertyPopupClassName, "w-64 max-w-[var(--available-width)]")} style={propertyMotionStyle}>
            <Combobox.InputGroup className="m-1 border-b border-border/40 pb-1.5">
              <Combobox.Input aria-label="Tìm cán bộ" placeholder="Tìm cán bộ..." className="h-8 w-full rounded-md bg-muted/40 px-2 text-xs outline-none focus:bg-background" />
            </Combobox.InputGroup>
            <Combobox.Empty>
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">Không tìm thấy cán bộ phù hợp</div>
            </Combobox.Empty>
            <Combobox.List className="max-h-60 overflow-y-auto overscroll-contain outline-none">
              {(person) => (
                <Combobox.Item key={person.id} value={person} className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs font-normal outline-none data-[highlighted]:bg-muted data-[selected]:bg-accent data-[selected]:font-medium">
                  <span className="flex min-w-0 items-center gap-2">
                    <UserAvatar name={person.name} avatarUrl={person.avatarUrl} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-normal">{person.name}</span>
                      {person.departmentName && <span className="block truncate text-xs text-muted-foreground">{person.departmentName}</span>}
                    </span>
                  </span>
                  <Combobox.ItemIndicator><Check className="size-3.5 text-foreground" strokeWidth={1.5} /></Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

/* ── TaskDateRange ── */

export function TaskDateRange({
  startDateIso,
  dueDateIso,
  canEdit,
  onStartDateChange,
  onDueDateChange,
  onClearDates,
}: {
  startDateIso: string;
  dueDateIso: string;
  canEdit?: boolean;
  onStartDateChange?: (iso: string) => void;
  onDueDateChange?: (iso: string) => void;
  onClearDates?: () => void;
}) {
  const dueInfo = computeDueStatus(dueDateIso || undefined);
  const nearDue = !dueInfo.isOverdue && dueDateIso && (
    dueInfo.text === "Hôm nay" || dueInfo.text === "Ngày mai" || dueInfo.text === "Còn 2 ngày"
  );
  const urgencyClass = dueInfo.isOverdue ? "text-rose-700" : nearDue ? "text-amber-600" : "";
  const iconClass = dueInfo.isOverdue ? "text-rose-700" : nearDue ? "text-amber-500" : "text-muted-foreground";

  const startLabel = startDateIso ? formatDisplayDate(startDateIso) : "-";
  const dueLabel = dueDateIso ? formatDisplayDate(dueDateIso) : "Chưa đặt hạn";

  return (
    <div className="relative group/date-row inline-flex items-center gap-1">
      <TaskIconDeadline className={cn("size-4 shrink-0", iconClass)} />
      {canEdit && onStartDateChange ? (
        <VietnameseDatePicker
          value={startDateIso || null}
          onChange={onStartDateChange}
          placeholder="Bắt đầu"
          variant="chip"
          icon={null}
          side="bottom"
          align="left"
          className={cn("p-0 h-auto border-0 text-xs font-normal shadow-none hover:bg-transparent", urgencyClass && `[&_span]:${urgencyClass}`)}
        />
      ) : (
        <span className={cn("tabular-nums text-xs font-normal", urgencyClass || "text-muted-foreground")}>{startLabel}</span>
      )}
      <span className="text-muted-foreground/60">→</span>
      {canEdit && onDueDateChange ? (
        <VietnameseDatePicker
          value={dueDateIso || null}
          onChange={onDueDateChange}
          placeholder="Hạn chót"
          variant="chip"
          icon={null}
          side="bottom"
          align="left"
          showPresets={true}
          className={cn("p-0 h-auto border-0 text-xs font-normal shadow-none hover:bg-transparent", urgencyClass && `[&_span]:${urgencyClass}`)}
        />
      ) : (
        <span className={cn("tabular-nums text-xs font-normal", urgencyClass || "text-muted-foreground")}>{dueLabel}</span>
      )}
      {canEdit && onClearDates && (startDateIso || dueDateIso) && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClearDates(); }}
          className="opacity-0 group-hover/date-row:opacity-100 inline-flex size-4 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-all motion-reduce:transition-none"
          aria-label="Xóa ngày"
          title="Xóa ngày"
        >
          <X className="size-3" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

/* ── TaskPrioritySelect ── */

const PRIORITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  URGENT: TaskIconPriorityUrgent,
  HIGH: TaskIconPriorityHigh,
  NORMAL: TaskIconPriorityNormal,
  LOW: TaskIconPriorityLow,
};

// Cùng quy tắc màu với PrioritySignalBars: khẩn cấp đỏ, cao đậm, còn lại mờ
const PRIORITY_ICON_COLOR: Record<string, string> = {
  URGENT: "text-rose-600",
  HIGH: "text-foreground/70",
  NORMAL: "text-muted-foreground",
  LOW: "text-muted-foreground",
};

export function TaskPrioritySelect({ value, options, disabled, onValueChange }: {
  value: TaskPriority;
  options: PriorityDisplayConfig[];
  disabled?: boolean;
  onValueChange: (value: TaskPriority) => void;
}) {
  const selected = options.find((opt) => opt.value === value);

  return (
    <Select.Root value={value} disabled={disabled} onValueChange={(next) => {
      if (next && next !== value) onValueChange(next as TaskPriority);
    }}>
      <Select.Trigger aria-label="Ưu tiên" className={propertyTriggerVariants()} style={propertyMotionStyle}>
        {React.createElement(PRIORITY_ICONS[value] ?? TaskIconPriorityNormal, { className: cn("size-4 shrink-0", PRIORITY_ICON_COLOR[value] ?? "text-muted-foreground") })}
        <Select.Value>{() => <span>{selected?.label ?? value}</span>}</Select.Value>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="z-50" side="bottom" align="start" sideOffset={4} collisionPadding={8} alignItemWithTrigger={false} collisionAvoidance={{ side: "none", align: "shift" }}>
          <Select.Popup className={cn(propertyPopupClassName, "w-44 max-h-[var(--available-height)] overflow-y-auto")} style={propertyMotionStyle}>
            <Select.List>
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-accent data-[selected]:font-medium">
                  <span className="flex items-center gap-2">
                    {React.createElement(PRIORITY_ICONS[option.value] ?? TaskIconPriorityNormal, { className: cn("size-4", PRIORITY_ICON_COLOR[option.value] ?? "text-muted-foreground") })}
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </span>
                  <Select.ItemIndicator><Check className="size-3.5 text-foreground" strokeWidth={1.5} /></Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
