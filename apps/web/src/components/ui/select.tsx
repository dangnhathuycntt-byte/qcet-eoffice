"use client";

import * as React from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldFocusRingClass } from "@/components/ui/focus-ring";
import { PROPERTY_PILL_CLASS } from "@/components/ui/button";
import { MenuSheetHeader, SHEET_BACKDROP_CLASS, SHEET_POPUP_CLASS, SHEET_POSITIONER_CLASS } from "@/components/ui/menu";

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
  /** Gắn vào nút chọn để `FormField` nối nhãn. */
  id?: string;
  /** Nối với gợi ý/lỗi của `FormField`. */
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** Lớp cho Positioner (mặc định `z-30`); truyền `z-50` khi dùng trong modal. */
  positionerClassName?: string;
  /** compact: 28px trên desktop (32px trên điện thoại), chữ 13px, mục menu ≤ 32px. Mặc định giữ nguyên. */
  compact?: boolean;
  /**
   * pill: chip thuộc tính 24px như hàng thuộc tính của hộp tạo việc/cuộc họp (`PROPERTY_PILL_CLASS`): không mũi tên, menu
   * mở dưới chip canh trái, mục menu ≤ 32px. Mặc định `field` (ô chọn nền xám).
   */
  variant?: "field" | "pill";
  /** Chỉ cho `pill`: icon đầu chip; nơi gọi tự đặt màu (thường `text-muted-foreground`). */
  icon?: React.ReactNode;
  /**
   * Chỉ cho `pill`: giá trị mặc định không mang tín hiệu (ví dụ "Thường"). Đang ở giá trị này thì chip ghi `idleLabel` (tên
   * thuộc tính) bằng chữ mờ thay vì giá trị, như chip "Đơn vị" ở hộp tạo việc; chọn giá trị khác thì hiện giá trị.
   */
  idleValue?: string;
  idleLabel?: string;
  /** Gợi ý khi rê chuột lên nút chọn. */
  title?: string;
  /** Tiêu đề bảng chọn trên điện thoại; mặc định `label`, rồi `aria-label`. Đặt khi `aria-label` đã kèm giá trị (chip: "Độ khẩn: Thường"). */
  sheetTitle?: string;
}

function renderItem(option: SelectOption, compact = false) {
  return (
    <BaseSelect.Item
      key={option.value}
      value={option.value}
      disabled={option.disabled}
      className={cn(
        "flex cursor-pointer items-center rounded-sm px-2.5 text-foreground outline-none select-none data-[highlighted]:bg-accent data-[selected]:bg-accent data-[selected]:font-medium data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        compact ? "min-h-8 py-1 text-compact" : "py-2 text-sm sm:py-1.5",
      )}
    >
      <BaseSelect.ItemText className="min-w-0 truncate">
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
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  positionerClassName,
  compact = false,
  variant = "field",
  icon,
  idleValue,
  idleLabel,
  title,
  sheetTitle,
}: SelectProps) {
  const isPill = variant === "pill";
  const isIdle = isPill && idleValue !== undefined && value === idleValue;
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
        id={id}
        title={title}
        aria-describedby={ariaDescribedBy}
        aria-label={label ? undefined : ariaLabel}
        aria-invalid={invalid || ariaInvalid || undefined}
        className={cn(
          isPill
            ? PROPERTY_PILL_CLASS
            : [
                "flex w-full cursor-pointer items-center justify-between gap-2 rounded-control border-0 bg-secondary outline-none select-none",
                compact ? "h-8 px-2 text-compact sm:h-7" : "h-10 px-3 text-base sm:h-9 sm:text-sm",
                "transition-colors duration-100 motion-reduce:transition-none",
                `hover:bg-accent focus-visible:bg-selected ${fieldFocusRingClass} data-[popup-open]:bg-selected`,
                "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
                "aria-invalid:bg-danger-soft aria-invalid:text-destructive",
              ],
          className,
        )}
      >
        {isPill ? icon : null}
        {isIdle ? (
          <span className="truncate text-muted-foreground">{idleLabel ?? placeholder}</span>
        ) : (
          <BaseSelect.Value
            placeholder={placeholder}
            className="truncate data-[placeholder]:text-muted-foreground"
          />
        )}
        {isPill ? null : (
          <BaseSelect.Icon className="text-muted-foreground">
            <ChevronsUpDown className={compact ? "size-3.5" : "size-4"} />
          </BaseSelect.Icon>
        )}
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Backdrop className={SHEET_BACKDROP_CLASS} />
        <BaseSelect.Positioner
          sideOffset={4}
          align={isPill ? "start" : undefined}
          alignItemWithTrigger={false}
          collisionPadding={12}
          className={cn("z-30 outline-none", positionerClassName, SHEET_POSITIONER_CLASS)}
        >
          <BaseSelect.Popup
            className={cn(
              "min-w-[var(--anchor-width)] origin-[var(--transform-origin)] rounded-[var(--radius-menu)] border-0 bg-popover p-1 text-popover-foreground shadow-menu outline-none",
              "transition-opacity duration-100 ease-out motion-reduce:transition-none",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
              SHEET_POPUP_CLASS,
              isPill && "min-w-44",
              popupClassName,
            )}
          >
            <MenuSheetHeader title={sheetTitle ?? label ?? ariaLabel ?? placeholder} />
            <BaseSelect.List className="max-h-[var(--available-height)] overflow-y-auto">
              {groups.map(([group, list]) =>
                group ? (
                  <BaseSelect.Group key={group}>
                    <BaseSelect.GroupLabel className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                      {group}
                    </BaseSelect.GroupLabel>
                    {list.map((o) => renderItem(o, compact || isPill))}
                  </BaseSelect.Group>
                ) : (
                  list.map((o) => renderItem(o, compact || isPill))
                ),
              )}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
