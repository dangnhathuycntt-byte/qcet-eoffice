"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { User, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROPERTY_PILL_CLASS } from "@/components/ui/button";
import { propertyTriggerVariants } from "@/components/ui/property-control-styles";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MENU_OPTION_ROW_CLASS, MENU_POPUP_CLASS, MenuSheetHeader, SHEET_BACKDROP_CLASS, SHEET_POPUP_CLASS, SHEET_POSITIONER_CLASS } from "@/components/ui/menu";
import { foldVietnamese } from "@qcet/shared/lib/search/vietnamese-search";
import type { DepartmentPersonnel } from "@/hooks/use-department-list";

export interface PersonPillPickerProps {
  people: DepartmentPersonnel[];
  valueId: string;
  onSelect: (person: DepartmentPersonnel) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  /** Nhãn khi chưa chọn ai */
  emptyLabel?: string;
  /** Chưa chọn thì hiện mờ người này (việc con kế thừa chủ trì của nhiệm vụ) */
  fallbackPerson?: DepartmentPersonnel | null;
  fallbackHint?: string;
  invalid?: boolean;
  required?: boolean;
  /** Điện thoại: chưa chọn thì chỉ hiện nút tròn có icon */
  compactWhenEmpty?: boolean;
  /** `pill`: chip thuộc tính của hộp tạo việc; `property`: nút không viền trong hàng danh sách (hàng việc con), điện thoại chỉ hiện avatar/icon */
  appearance?: "pill" | "property";
  /** Tên nút cho trình đọc màn hình, ví dụ kèm tên việc con; mặc định là `emptyLabel` */
  triggerLabel?: string;
  triggerRef?: React.Ref<HTMLButtonElement>;
  /** Tiêu đề menu và tên ô tìm (mặc định "Người chủ trì"; hộp tạo cuộc họp dùng "Chủ tọa") */
  menuTitle?: string;
  /** Có thì menu có dòng "Bỏ chọn" khi đã chọn người (trường không bắt buộc) */
  onClear?: () => void;
}

/** Chip chọn người chủ trì trong hộp tạo việc (pill `PROPERTY_PILL_CLASS`, menu có ô tìm, gõ không dấu vẫn ra). */
export function PersonPillPicker({
  people,
  valueId,
  onSelect,
  open,
  onOpenChange,
  loading = false,
  emptyLabel = "Chủ trì",
  fallbackPerson = null,
  fallbackHint,
  invalid = false,
  required = false,
  compactWhenEmpty = false,
  appearance = "pill",
  triggerLabel,
  triggerRef,
  menuTitle = "Người chủ trì",
  onClear,
}: PersonPillPickerProps) {
  const [query, setQuery] = React.useState("");
  const selected = people.find((p) => p.id === valueId) ?? null;
  const shown = selected ?? fallbackPerson;

  return (
    <Combobox.Root
      items={people}
      value={selected}
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
      inputValue={query}
      onInputValueChange={setQuery}
      // Gõ không dấu vẫn tìm ra ("hung" → "Hùng")
      filter={(person, q) => {
        const folded = foldVietnamese(q);
        return !folded || [person.name, person.email].some((t) => foldVietnamese(t).includes(folded));
      }}
      itemToStringLabel={(person) => person.name}
      itemToStringValue={(person) => person.id}
      isItemEqualToValue={(a, b) => a.id === b.id}
      onValueChange={(person) => {
        if (!person) {
          // Chỉ "Bỏ chọn" (Combobox.Clear) mới đưa về rỗng
          onClear?.();
          onOpenChange(false);
          return;
        }
        onSelect(person);
        setQuery("");
        onOpenChange(false);
      }}
      autoHighlight
    >
      <Combobox.Trigger
        ref={triggerRef}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-label={triggerLabel ?? (selected ? undefined : emptyLabel)}
        title={selected ? `${emptyLabel}: ${selected.name}` : fallbackPerson ? fallbackHint : undefined}
        className={cn(
          appearance === "property" ? propertyTriggerVariants({ variant: selected ? "default" : "muted" }) : PROPERTY_PILL_CLASS,
          appearance === "pill" && !selected && "text-muted-foreground",
          !shown && compactWhenEmpty && "max-md:aspect-square max-md:gap-0 max-md:px-0",
        )}
      >
        {shown ? (
          <UserAvatar name={shown.name} avatarUrl={shown.avatarUrl} size="xs" className={cn(!selected && "opacity-60")} />
        ) : (
          <User className={cn("size-3.5", invalid ? "text-destructive" : "text-muted-foreground")} />
        )}
        <span className={cn(appearance === "property" ? "max-w-[120px] truncate max-md:hidden" : "max-w-[140px] truncate", !shown && compactWhenEmpty && "max-md:hidden")}>
          {shown?.name || emptyLabel}
        </span>
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Backdrop className={SHEET_BACKDROP_CLASS} />
        <Combobox.Positioner className={cn("z-50", SHEET_POSITIONER_CLASS)} side="bottom" align="start" sideOffset={4} collisionPadding={12}>
          <Combobox.Popup
            aria-label={`Chọn ${menuTitle.toLocaleLowerCase("vi")}`}
            className={cn("w-64 max-w-[var(--available-width)]", MENU_POPUP_CLASS, SHEET_POPUP_CLASS, "max-md:has-[[data-popup-open]]:visible")}
          >
            <MenuSheetHeader title={menuTitle} />
            <Combobox.Input aria-label={`Tìm ${menuTitle.toLocaleLowerCase("vi")}`} placeholder="Tìm người…" render={<Input variant="menu" />} />
            <div aria-hidden className="-mx-1 my-1 h-px bg-border" />
            {onClear && selected && !query ? (
              <Combobox.Clear className={cn(MENU_OPTION_ROW_CLASS, "w-full text-muted-foreground")}>
                <UserX className="size-3.5" />
                Bỏ chọn
              </Combobox.Clear>
            ) : null}
            <Combobox.Empty>
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {people.length === 0 ? (loading ? "Đang tải danh sách…" : "Chưa có nhân sự trong đơn vị này") : "Không tìm thấy người phù hợp"}
              </div>
            </Combobox.Empty>
            <Combobox.List className="max-h-56 overflow-y-auto overscroll-contain outline-none data-[empty]:p-0 max-md:max-h-[calc(55dvh-var(--keyboard-height,0px))]">
              {(person: DepartmentPersonnel) => (
                <Combobox.Item key={person.id} value={person} className={MENU_OPTION_ROW_CLASS}>
                  <UserAvatar name={person.name} avatarUrl={person.avatarUrl} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{person.name}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
