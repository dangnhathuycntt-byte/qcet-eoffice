"use client";

import * as React from "react";
import { Select } from "@base-ui/react/select";
import { Combobox } from "@base-ui/react/combobox";
import { Calendar, Check, CheckCircle2, ChevronDown, CircleDashed, Clock, Loader2, UserPlus, X } from "lucide-react";
import type { TaskStatus } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { computeDueStatus } from "./task-identity-block";
import { formatDisplayDate } from "@/lib/format/date";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { propertyMotionStyle, propertyPopupClassName, propertyTriggerVariants } from "@/components/ui/property-control-styles";

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
  const Icon = value === "COMPLETED" ? CheckCircle2 : value === "WAITING_APPROVAL" ? Clock : CircleDashed;

  return (
    <Select.Root value={value} disabled={disabled} onValueChange={(next) => {
      if (next && next !== value && !visibleOptions.find((option) => option.value === next)?.disabled) onValueChange(next);
    }}>
      <Select.Trigger aria-label="Trạng thái" className={propertyTriggerVariants()} style={propertyMotionStyle}>
        <Icon className={cn("size-3.5 shrink-0", selected?.iconClass)} strokeWidth={1.5} aria-hidden="true" />
        <Select.Value>{() => <span>{selected?.label ?? value}</span>}</Select.Value>
        {!disabled && <Select.Icon><ChevronDown className="size-3 text-muted-foreground/60" strokeWidth={1.5} /></Select.Icon>}
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="z-50" side="bottom" align="start" sideOffset={4} collisionPadding={8} alignItemWithTrigger={false} collisionAvoidance={{ side: "none", align: "shift" }}>
          <Select.Popup className={cn(propertyPopupClassName, "w-48 max-h-[var(--available-height)] overflow-y-auto")} style={propertyMotionStyle}>
            <Select.List>
              {visibleOptions.map((option) => (
                <Select.Item key={option.value} value={option.value} disabled={option.disabled} title={option.reason}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("size-1.5 rounded-full", option.dotClass)} aria-hidden="true" />
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </span>
                  <Select.ItemIndicator><Check className="size-3 text-primary" strokeWidth={1.5} /></Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export interface TaskPersonnelOption {
  id: string;
  name: string;
  email?: string;
  departmentName?: string;
}

export function TaskAssigneePicker({ items, assigneeId, assigneeName, displayName, disabled, pending, onSelect }: {
  items: TaskPersonnelOption[];
  assigneeId?: string;
  assigneeName?: string;
  displayName: string;
  disabled?: boolean;
  pending?: boolean;
  onSelect: (person: TaskPersonnelOption) => Promise<void>;
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
        {pending ? <Loader2 className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" strokeWidth={1.5} /> : <UserPlus className="size-3.5 shrink-0" strokeWidth={1.5} />}
        <span className="truncate font-normal">{displayName}</span>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner className="z-50" side="bottom" align="start" sideOffset={4} collisionPadding={8}>
          <Combobox.Popup className={cn(propertyPopupClassName, "w-64 max-w-[var(--available-width)]")} style={propertyMotionStyle}>
            <Combobox.InputGroup className="m-1 border-b border-border/40 pb-1.5">
              <Combobox.Input aria-label="Tìm cán bộ" placeholder="Tìm cán bộ..." className="h-8 w-full rounded-md bg-muted/40 px-2 text-xs outline-none focus:bg-background" />
            </Combobox.InputGroup>
            <Combobox.Empty>
              <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">Không tìm thấy cán bộ phù hợp</div>
            </Combobox.Empty>
            <Combobox.List className="max-h-60 overflow-y-auto overscroll-contain outline-none">
              {(person) => (
                <Combobox.Item key={person.id} value={person} className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs font-normal outline-none data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary">
                  <span className="min-w-0">
                    <span className="block truncate font-normal">{person.name}</span>
                    {person.departmentName && <span className="block truncate text-[10px] text-muted-foreground">{person.departmentName}</span>}
                  </span>
                  <Combobox.ItemIndicator><Check className="size-3 text-primary" strokeWidth={1.5} /></Combobox.ItemIndicator>
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

  const startLabel = startDateIso ? formatDisplayDate(startDateIso) : "—";
  const dueLabel = dueDateIso ? formatDisplayDate(dueDateIso) : "Chưa đặt hạn";

  return (
    <div className="relative group/date-row inline-flex items-center gap-1">
      <Calendar className={cn("size-3.5 shrink-0", iconClass)} strokeWidth={1.5} aria-hidden="true" />
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
