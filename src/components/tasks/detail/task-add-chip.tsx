"use client";

import * as React from "react";
import { Building2, CalendarClock, ClipboardCheck, GitBranch, Plus, ShieldCheck, Users } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

const CHIP_CLASS = cn(
  "order-last inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors",
  "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "data-[popup-open]:bg-accent data-[popup-open]:text-foreground",
);

// Bo góc lồng nhau: vỏ rounded-lg (14px) − đệm 6px = bo mục 8px (rounded-sm). Bóng dùng token menu, không dùng shadow-2xl.
const MENU_CLASS = "w-60 rounded-lg border border-border bg-popover p-1.5 shadow-menu outline-none";
const PANEL_CLASS = "w-64 overflow-y-auto rounded-lg border border-border bg-popover p-3 shadow-menu outline-none";
const PANEL_TITLE_CLASS = "mb-2 text-xs font-medium text-foreground";
const MENU_ITEM_CLASS =
  "flex h-7 w-full cursor-pointer items-center gap-2.5 rounded-sm px-2 text-left text-xs text-foreground transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none";

/** Các khối tùy chọn có thể gom vào menu "+ Thêm" của chi tiết nhiệm vụ. */
export type TaskOptionalKey = "extension" | "people" | "backup" | "unit-request" | "criteria" | "approval";
const ENTRY_ORDER: TaskOptionalKey[] = ["criteria", "people", "unit-request", "backup", "approval", "extension"];
const ENTRY_ICON: Record<TaskOptionalKey, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  criteria: ClipboardCheck,
  people: Users,
  "unit-request": Building2,
  backup: ShieldCheck,
  approval: GitBranch,
  extension: CalendarClock,
};

interface Entry {
  label: string;
  open: () => void;
}

interface OptionalMenuContextValue {
  register: (key: TaskOptionalKey, entry: Entry) => void;
  unregister: (key: TaskOptionalKey) => void;
  anchor: HTMLElement | null;
}

const OptionalMenuContext = React.createContext<OptionalMenuContextValue | null>(null);

/**
 * Gom các khối tùy chọn còn trống của chi tiết nhiệm vụ vào một nút "+ Thêm" (progressive disclosure, kiểu "+ Add property").
 * Khối có dữ liệu tự hiện trên trang; khối trống chỉ là một mục trong menu, chọn mục thì form mở trong popover neo tại nút.
 */
export function TaskOptionalSections({ children, className }: { children: React.ReactNode; className?: string }) {
  const [entries, setEntries] = React.useState<Partial<Record<TaskOptionalKey, Entry>>>({});
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);

  const register = React.useCallback((key: TaskOptionalKey, entry: Entry) => {
    setEntries((prev) => (prev[key]?.label === entry.label && prev[key]?.open === entry.open ? prev : { ...prev, [key]: entry }));
  }, []);
  const unregister = React.useCallback((key: TaskOptionalKey) => {
    setEntries((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);
  const value = React.useMemo(() => ({ register, unregister, anchor }), [register, unregister, anchor]);
  const available = ENTRY_ORDER.filter((key) => entries[key]);

  return (
    <OptionalMenuContext.Provider value={value}>
      <div
        data-slot="task-optional-sections"
        className={cn("flex flex-wrap items-center gap-x-1 gap-y-4 [&>section]:basis-full [&>p]:basis-full", className)}
      >
        {children}
        {available.length > 0 ? (
          <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Popover.Trigger
              ref={setAnchor}
              type="button"
              data-slot="task-optional-menu"
              title="Thêm tiêu chí, người tham gia, phối hợp…"
              className={cn(CHIP_CLASS, "order-1")}
            >
              <Plus className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
              Thêm
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner className="z-50" align="start" sideOffset={4} collisionPadding={12}>
                <Popover.Popup
                  aria-label="Thêm thông tin cho nhiệm vụ"
                  role="menu"
                  className={MENU_CLASS}
                  onKeyDown={(e) => {
                    // Mũi tên lên/xuống đổi mục như menu thật
                    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
                    const at = items.indexOf(document.activeElement as HTMLElement);
                    const next = e.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
                    e.preventDefault();
                    items[next]?.focus();
                  }}
                >
                  <p className="px-2 pb-1 pt-0.5 text-xs text-muted-foreground">Thêm vào nhiệm vụ</p>
                  {available.map((key) => {
                    const Icon = ENTRY_ICON[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          entries[key]?.open();
                        }}
                        className={MENU_ITEM_CLASS}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                        {entries[key]?.label}
                      </button>
                    );
                  })}
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        ) : null}
      </div>
    </OptionalMenuContext.Provider>
  );
}

/**
 * Khối tùy chọn còn trống: đăng ký một mục vào menu "+ Thêm"; form mở trong popover neo tại nút đó.
 * Dùng ngoài `TaskOptionalSections` thì tự hiện thành chip riêng.
 */
export function TaskAddPanel({
  entry,
  label,
  open,
  onOpenChange,
  panel,
}: {
  entry: TaskOptionalKey;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: React.ReactNode;
}) {
  const ctx = React.useContext(OptionalMenuContext);
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });
  const openEntry = React.useCallback(() => onOpenChangeRef.current(true), []);
  const register = ctx?.register;
  const unregister = ctx?.unregister;

  React.useEffect(() => {
    if (!register || !unregister) return;
    register(entry, { label, open: openEntry });
    return () => unregister(entry);
  }, [register, unregister, entry, label, openEntry]);

  if (!ctx) {
    return (
      <TaskAddChip open={open} onOpenChange={onOpenChange} panel={panel}>
        {label}
      </TaskAddChip>
    );
  }

  return (
    <Popover.Root open={open && Boolean(ctx.anchor)} onOpenChange={(next) => onOpenChange(next)}>
      <Popover.Portal>
        <Popover.Positioner anchor={ctx.anchor} className="z-50" align="start" sideOffset={4} collisionPadding={12}>
          <Popover.Popup data-slot="task-add-chip-panel" style={{ maxHeight: "var(--available-height)" }} className={PANEL_CLASS}>
            <p className={PANEL_TITLE_CLASS}>{label}</p>
            {panel}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Chip đứng riêng (vd. "Từ chối nhận việc"). Có `panel` thì bấm chip mở form trong popover neo tại chip.
 * `order-last` để chip dồn về hàng cuối, sau những khối đã có dữ liệu.
 */
export function TaskAddChip({
  children,
  onClick,
  icon = true,
  title,
  panel,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  /** false: không có dấu "+" (thao tác không phải thêm, vd. từ chối nhận việc). */
  icon?: boolean;
  title?: string;
  /** Form hiện trong popover; mở/đóng theo `open`/`onOpenChange` của khối. */
  panel?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const content = (
    <>
      {icon ? <Plus className="size-3.5" strokeWidth={1.5} aria-hidden="true" /> : null}
      {children}
    </>
  );

  if (!panel) {
    return (
      <button type="button" data-slot="task-add-chip" title={title} onClick={onClick} className={CHIP_CLASS}>
        {content}
      </button>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => onOpenChange?.(next)}>
      <Popover.Trigger type="button" data-slot="task-add-chip" title={title} className={CHIP_CLASS}>
        {content}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="z-50" align="start" sideOffset={4} collisionPadding={12}>
          <Popover.Popup data-slot="task-add-chip-panel" style={{ maxHeight: "var(--available-height)" }} className={PANEL_CLASS}>
            <p className={PANEL_TITLE_CLASS}>{children}</p>
            {panel}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
