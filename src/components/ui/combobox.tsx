"use client";

import * as React from "react";
import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import { UserAvatar } from "./user-avatar";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  subtitle?: string;
  group?: string;
  avatarUrl?: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: ComboboxOption | null;
  defaultValue?: ComboboxOption | null;
  onValueChange?: (value: ComboboxOption | null) => void;
  placeholder?: string;
  emptyText?: string;
  showAvatar?: boolean;
  "aria-label"?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  defaultInputValue?: string;
  className?: string;
}

/**
 * Ô nhập có lọc để chọn một mục trong danh sách dài, dựng trên `@base-ui/react/combobox`.
 * Hỗ trợ phân nhóm đơn vị trường học, avatar tròn pastel và chức danh (Chuyên viên, Giảng viên...).
 * Danh sách ngắn, không cần lọc: dùng `Select`.
 */
export function Combobox({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Tìm và chọn",
  emptyText = "Không có kết quả phù hợp",
  showAvatar,
  "aria-label": ariaLabel,
  id,
  disabled,
  invalid,
  open,
  defaultOpen,
  defaultInputValue,
  className,
}: ComboboxProps) {
  return (
    <BaseCombobox.Root
      items={options}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      open={open}
      defaultOpen={defaultOpen}
      defaultInputValue={defaultInputValue}
      isItemEqualToValue={(a, b) => a.value === b.value}
    >
      <BaseCombobox.InputGroup
        className={cn(
          "relative flex h-12 w-full items-center rounded-control bg-secondary text-base sm:h-9 sm:text-sm",
          "transition-colors duration-100 motion-reduce:transition-none hover:bg-accent",
          "focus-within:bg-selected focus-within:outline-2 focus-within:outline-primary focus-within:outline-offset-1",
          "has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-50",
          invalid && "bg-danger-soft text-destructive",
          className,
        )}
      >
        <BaseCombobox.Input
          id={id}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent pl-3 pr-1 outline-none placeholder:text-muted-foreground"
        />
        <BaseCombobox.Clear
          aria-label="Xóa lựa chọn"
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary data-[disabled]:hidden"
        >
          <X className="size-3.5" />
        </BaseCombobox.Clear>
        <BaseCombobox.Trigger
          aria-label="Mở danh sách"
          className="mr-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ChevronDown className="size-4" />
        </BaseCombobox.Trigger>
      </BaseCombobox.InputGroup>
      <BaseCombobox.Portal>
        <BaseCombobox.Positioner
          sideOffset={4}
          collisionPadding={12}
          className="z-30 outline-none"
        >
          <BaseCombobox.Popup className="w-[var(--anchor-width)] max-w-[var(--available-width)] origin-[var(--transform-origin)] rounded-[var(--radius-menu)] border-0 bg-popover p-1 text-popover-foreground shadow-menu outline-none transition-opacity duration-100 ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none">
            <BaseCombobox.Empty>
              <div className="px-2.5 py-3 text-sm text-muted-foreground">
                {emptyText}
              </div>
            </BaseCombobox.Empty>
            <BaseCombobox.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain outline-none data-[empty]:p-0">
              {(item: ComboboxOption) => {
                const hasAvatar = showAvatar || Boolean(item.avatarUrl);
                const subtext = item.subtitle || item.description;

                return (
                  <React.Fragment key={item.value}>
                    {item.group ? (
                      <BaseCombobox.GroupLabel className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                        {item.group}
                      </BaseCombobox.GroupLabel>
                    ) : null}
                    <BaseCombobox.Item
                      value={item}
                      className={cn(
                        "grid cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50 sm:py-1.5",
                        hasAvatar ? "grid-cols-[1rem_auto_1fr]" : "grid-cols-[1rem_1fr]"
                      )}
                    >
                      <BaseCombobox.ItemIndicator className="col-start-1 text-primary">
                        <Check className="size-4" />
                      </BaseCombobox.ItemIndicator>
                      {hasAvatar ? (
                        <div className="col-start-2 flex items-center">
                          <UserAvatar
                            name={item.label}
                            avatarUrl={item.avatarUrl}
                            size="xs"
                            className="size-5"
                          />
                        </div>
                      ) : null}
                      <span className={cn(hasAvatar ? "col-start-3" : "col-start-2", "min-w-0")}>
                        <span className="block truncate text-foreground font-medium">{item.label}</span>
                        {subtext ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {subtext}
                          </span>
                        ) : null}
                      </span>
                    </BaseCombobox.Item>
                  </React.Fragment>
                );
              }}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}
