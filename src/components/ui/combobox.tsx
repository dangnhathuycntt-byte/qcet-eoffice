"use client";

import * as React from "react";
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";
import * as m from "motion/react-m";
import { popoverVariants } from "@/lib/motion/variants";
import { MENU_POPUP_CLASS } from "@/components/ui/menu";

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: ComboboxOption | null;
  defaultValue?: ComboboxOption | null;
  onValueChange?: (value: ComboboxOption | null) => void;
  /**
   * Cho chọn giá trị ngoài danh sách: Enter khi chữ đã gõ chưa trùng nhãn nào
   * sẽ gửi `{ value: chữ, label: chữ }` qua `onValueChange`.
   */
  freeSolo?: boolean;
  placeholder?: string;
  emptyText?: string;
  "aria-label"?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

/**
 * Ô nhập có lọc để chọn một mục trong danh sách dài, dựng trên `@base-ui/react/combobox`.
 * Danh sách ngắn, không cần lọc: dùng `Select`.
 */
export function Combobox({
  options,
  value,
  defaultValue,
  onValueChange,
  freeSolo = false,
  placeholder = "Tìm và chọn",
  emptyText = "Không có kết quả phù hợp",
  "aria-label": ariaLabel,
  id,
  disabled,
  invalid,
  className,
}: ComboboxProps) {
  const handleFreeSoloKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!freeSolo || e.key !== "Enter") return;
    const text = e.currentTarget.value.trim();
    if (!text) return;
    const matched = options.some((o) => o.label.toLowerCase() === text.toLowerCase());
    if (!matched) onValueChange?.({ value: text, label: text });
  };

  return (
    <BaseCombobox.Root
      items={options}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      itemToStringLabel={(item: ComboboxOption) => item.label}
      isItemEqualToValue={(a: ComboboxOption, b: ComboboxOption) => a.value === b.value}
    >
      <BaseCombobox.InputGroup
        className={cn(
          "flex h-7 w-full items-center rounded-md border border-border/60 bg-background text-xs text-foreground shadow-2xs transition-colors hover:border-border focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-50",
          invalid && "border-destructive bg-danger-soft text-destructive",
          className,
        )}
      >
        <BaseCombobox.Input
          id={id}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          placeholder={placeholder}
          onKeyDown={handleFreeSoloKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent pl-2.5 pr-1 text-xs outline-none placeholder:text-muted-foreground/70"
        />
        <BaseCombobox.Clear
          aria-label="Xóa lựa chọn"
          className={cn(
            "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground data-[disabled]:hidden",
            focusRingClass,
          )}
        >
          <X className="size-3" />
        </BaseCombobox.Clear>
        <BaseCombobox.Trigger
          aria-label="Mở danh sách"
          className={cn(
            "mr-0.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground",
            focusRingClass,
          )}
        >
          <ChevronDown className="size-3.5" />
        </BaseCombobox.Trigger>
      </BaseCombobox.InputGroup>
      <BaseCombobox.Portal>
        <BaseCombobox.Positioner sideOffset={4} collisionPadding={12} className="z-30 outline-none">
          <BaseCombobox.Popup
            render={<m.div variants={popoverVariants} initial="initial" animate="animate" />}
            className={cn(MENU_POPUP_CLASS, "w-[var(--anchor-width)] max-w-[var(--available-width)]")}
          >
            <BaseCombobox.Empty>
              <div className="px-2 py-1.5 text-xs text-muted-foreground">{emptyText}</div>
            </BaseCombobox.Empty>
            <BaseCombobox.List className="max-h-[min(14rem,var(--available-height))] overflow-y-auto overscroll-contain outline-none data-[empty]:p-0">
              {(item: ComboboxOption) => (
                <BaseCombobox.Item
                  key={item.value}
                  value={item}
                  className="grid h-7 cursor-pointer grid-cols-[1rem_1fr] items-center gap-2 rounded-md px-2 text-xs text-foreground outline-none select-none data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <BaseCombobox.ItemIndicator className="col-start-1 text-primary">
                    <Check className="size-3.5" />
                  </BaseCombobox.ItemIndicator>
                  <span className="col-start-2 block min-w-0 truncate">{item.label}</span>
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}
