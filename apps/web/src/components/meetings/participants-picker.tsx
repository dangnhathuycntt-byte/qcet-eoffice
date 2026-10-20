"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Users } from "lucide-react";
import { foldVietnamese } from "@qcet/shared/lib/search/vietnamese-search";
import { cn } from "@/lib/utils";
import { PROPERTY_PILL_CLASS } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MENU_OPTION_ROW_CLASS, MENU_POPUP_CLASS, MenuSheetHeader, SHEET_BACKDROP_CLASS, SHEET_POPUP_CLASS, SHEET_POSITIONER_CLASS } from "@/components/ui/menu";

export interface MeetingPerson {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  departmentName?: string;
}

/** Số avatar xếp chồng trên chip trước khi chỉ còn số đếm. */
const STACK_MAX = 3;

/**
 * Chip "Thành phần" của hộp tạo cuộc họp: chọn nhiều người (Combobox `multiple` của Base UI), menu giữ mở khi chọn, có ô
 * tìm gõ không dấu theo tên, email, đơn vị. Đang chọn là nền accent và chữ đậm như các menu chọn giá trị khác của app.
 */
export function ParticipantsPicker({
  people,
  value,
  onChange,
  loading = false,
}: {
  people: MeetingPerson[];
  value: MeetingPerson[];
  onChange: (next: MeetingPerson[]) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const shown = value.slice(0, STACK_MAX);

  return (
    <Combobox.Root
      multiple
      items={people}
      value={value}
      onValueChange={onChange}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      inputValue={query}
      onInputValueChange={setQuery}
      filter={(person, q) => {
        const folded = foldVietnamese(q);
        return !folded || [person.name, person.email, person.departmentName].some((t) => foldVietnamese(t ?? "").includes(folded));
      }}
      itemToStringLabel={(person) => person.name}
      itemToStringValue={(person) => person.id}
      isItemEqualToValue={(a, b) => a.id === b.id}
      autoHighlight
    >
      <Combobox.Trigger
        aria-label={value.length > 0 ? `Thành phần: ${value.map((p) => p.name).join(", ")}` : "Thành phần"}
        className={cn(PROPERTY_PILL_CLASS, value.length === 0 && "text-muted-foreground")}
      >
        {value.length > 0 ? (
          <span className="flex -space-x-1">
            {shown.map((person) => (
              <UserAvatar key={person.id} name={person.name} avatarUrl={person.avatarUrl} size="xs" className="ring-1 ring-background" />
            ))}
          </span>
        ) : (
          <Users className="size-3.5 text-muted-foreground" />
        )}
        <span className="truncate">{value.length > 0 ? `${value.length} người` : "Thành phần"}</span>
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Backdrop className={SHEET_BACKDROP_CLASS} />
        <Combobox.Positioner className={cn("z-50", SHEET_POSITIONER_CLASS)} side="bottom" align="start" sideOffset={4} collisionPadding={12}>
          <Combobox.Popup
            aria-label="Chọn người dự họp"
            className={cn("w-64 max-w-[var(--available-width)]", MENU_POPUP_CLASS, SHEET_POPUP_CLASS, "max-md:has-[[data-popup-open]]:visible")}
          >
            <MenuSheetHeader title="Thành phần" />
            <Combobox.Input aria-label="Tìm người dự họp" placeholder="Tìm người…" render={<Input variant="menu" />} />
            <div aria-hidden className="-mx-1 my-1 h-px bg-border" />
            <Combobox.Empty>
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {people.length === 0 ? (loading ? "Đang tải danh sách…" : "Chưa có danh sách cán bộ") : "Không tìm thấy người phù hợp"}
              </div>
            </Combobox.Empty>
            <Combobox.List className="max-h-56 overflow-y-auto overscroll-contain outline-none data-[empty]:p-0 max-md:max-h-[calc(55dvh-var(--keyboard-height,0px))]">
              {(person: MeetingPerson) => (
                <Combobox.Item
                  key={person.id}
                  value={person}
                  // Tên và đơn vị cắt cuối trong menu 256px: rê chuột thấy đủ
                  title={person.departmentName ? `${person.name} · ${person.departmentName}` : person.name}
                  className={MENU_OPTION_ROW_CLASS}
                >
                  <UserAvatar name={person.name} avatarUrl={person.avatarUrl} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{person.name}</span>
                  {person.departmentName ? (
                    <span className="max-w-24 shrink-0 truncate font-normal text-muted-foreground">{person.departmentName}</span>
                  ) : null}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
