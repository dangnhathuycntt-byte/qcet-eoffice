"use client";

import * as React from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  placeholder?: string;
  label?: string;
  "aria-label"?: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  name?: string;
  open?: boolean;
  defaultOpen?: boolean;
  className?: string;
  popupClassName?: string;
}

function renderItem(option: SelectOption) {
  return (
    <BaseSelect.Item
      key={option.value}
      value={option.value}
      disabled={option.disabled}
      className="grid cursor-pointer grid-cols-[1rem_1fr] items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none select-none data-[highlighted]:bg-accent data-[selected]:font-medium data-[disabled]:pointer-events-none data-[disabled]:opacity-50 sm:py-1.5"
    >
      <BaseSelect.ItemIndicator className="col-start-1 text-primary">
        <Check className="size-4" />
      </BaseSelect.ItemIndicator>
      <BaseSelect.ItemText className="col-start-2 truncate">
        {option.label}
      </BaseSelect.ItemText>
    </BaseSelect.Item>
  );
}

/**
 * Dropdown chọn một giá trị cố định, dựng trên `@base-ui/react/select`.
 * Dùng cho danh sách ngắn; danh sách dài cần lọc nên dùng combobox.
 */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Chọn một mục",
  label,
  "aria-label": ariaLabel,
  disabled,
  invalid,
  required,
  name,
  open,
  defaultOpen,
  className,
  popupClassName,
}: SelectProps) {
  const items = React.useMemo(
    () => options.map(({ value: v, label: l }) => ({ value: v, label: l })),
    [options],
  );
  const groups = React.useMemo(() => {
    const map = new Map<string, SelectOption[]>();
    for (const o of options) {
      const key = o.group ?? "";
      map.set(key, [...(map.get(key) ?? []), o]);
    }
    return [...map.entries()];
  }, [options]);

  return (
    <BaseSelect.Root
      items={items}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      required={required}
      name={name}
      open={open}
      defaultOpen={defaultOpen}
    >
      {label ? (
        <BaseSelect.Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {label}
        </BaseSelect.Label>
      ) : null}
      <BaseSelect.Trigger
        aria-label={label ? undefined : ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-control border-0 bg-secondary px-3 text-base outline-none select-none sm:h-9 sm:text-sm",
          "transition-colors duration-100 motion-reduce:transition-none",
          "hover:bg-accent focus-visible:bg-selected focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1 data-[popup-open]:bg-selected",
          "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          "aria-invalid:bg-danger-soft aria-invalid:text-destructive",
          className,
        )}
      >
        <BaseSelect.Value
          placeholder={placeholder}
          className="truncate data-[placeholder]:text-muted-foreground"
        />
        <BaseSelect.Icon className="text-muted-foreground">
          <ChevronsUpDown className="size-4" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          sideOffset={4}
          alignItemWithTrigger={false}
          collisionPadding={12}
          className="z-30 outline-none"
        >
          <BaseSelect.Popup
            className={cn(
              "min-w-[var(--anchor-width)] origin-[var(--transform-origin)] rounded-[var(--radius-menu)] border-0 bg-popover p-1 text-popover-foreground shadow-menu outline-none",
              "transition-opacity duration-100 ease-out motion-reduce:transition-none",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
              popupClassName,
            )}
          >
            <BaseSelect.List className="max-h-[var(--available-height)] overflow-y-auto">
              {groups.map(([group, list]) =>
                group ? (
                  <BaseSelect.Group key={group}>
                    <BaseSelect.GroupLabel className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                      {group}
                    </BaseSelect.GroupLabel>
                    {list.map(renderItem)}
                  </BaseSelect.Group>
                ) : (
                  list.map(renderItem)
                ),
              )}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
