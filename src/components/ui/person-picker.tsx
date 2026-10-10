"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { UserAvatar } from "./user-avatar";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

export interface PersonOption {
  id: string;
  name: string;
  department?: string;
  roleTitle?: string;
  email?: string;
  avatarUrl?: string;
}

export interface PersonPickerProps {
  people: PersonOption[];
  value?: string | string[];
  defaultValue?: string | string[];
  onChange?: (value: any) => void;
  multiple?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  label?: string;
  currentDepartment?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
  id?: string;
}

/**
 * Điều khiển chọn cán bộ, giảng viên (chọn đơn hoặc chọn nhiều người phối hợp).
 * Hiển thị avatar tròn pastel theo tên, nhãn đơn vị, chức danh và chip xóa nhanh.
 * Chuẩn QCET: Artboard Components4 (Chọn nhiều người · Phối hợp) và Components2.
 */
export function PersonPicker({
  people,
  value: controlledValue,
  defaultValue,
  onChange,
  multiple = false,
  placeholder = "Chọn người thực hiện...",
  searchPlaceholder = "Tìm theo tên, chức danh hoặc đơn vị...",
  emptyText = "Không tìm thấy cán bộ, giảng viên phù hợp",
  label,
  currentDepartment,
  disabled = false,
  invalid = false,
  className,
  "aria-label": ariaLabel,
  id,
}: PersonPickerProps) {
  const [internalValue, setInternalValue] = React.useState<string | string[]>(() => {
    if (defaultValue !== undefined) return defaultValue;
    return multiple ? [] : "";
  });
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedValue = controlledValue !== undefined ? controlledValue : internalValue;
  const selectedList = Array.isArray(selectedValue) ? selectedValue : selectedValue ? [selectedValue] : [];

  const updateSelection = (newVal: string | string[]) => {
    if (controlledValue === undefined) {
      setInternalValue(newVal);
    }
    onChange?.(newVal);
  };

  const handleSelectPerson = (personId: string) => {
    if (disabled) return;
    if (multiple) {
      const currentList = Array.isArray(selectedValue) ? selectedValue : [];
      if (currentList.includes(personId)) {
        updateSelection(currentList.filter((id) => id !== personId));
      } else {
        updateSelection([...currentList, personId]);
      }
    } else {
      updateSelection(personId);
      setIsOpen(false);
    }
  };

  const handleRemovePerson = (personId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (disabled) return;
    if (multiple) {
      const currentList = Array.isArray(selectedValue) ? selectedValue : [];
      updateSelection(currentList.filter((id) => id !== personId));
    } else {
      updateSelection("");
    }
    inputRef.current?.focus();
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    updateSelection(multiple ? [] : "");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && searchTerm === "" && selectedList.length > 0 && multiple) {
      const lastId = selectedList[selectedList.length - 1];
      handleRemovePerson(lastId);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredPeople = React.useMemo(() => {
    if (!searchTerm.trim()) return people;
    const term = searchTerm.toLowerCase();
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.department && p.department.toLowerCase().includes(term)) ||
        (p.roleTitle && p.roleTitle.toLowerCase().includes(term)) ||
        (p.email && p.email.toLowerCase().includes(term))
    );
  }, [people, searchTerm]);

  // Group by current department vs others
  const groupedPeople = React.useMemo(() => {
    if (!currentDepartment) {
      return [{ groupName: undefined, list: filteredPeople }];
    }
    const inside = filteredPeople.filter((p) => p.department === currentDepartment);
    const outside = filteredPeople.filter((p) => p.department !== currentDepartment);

    const groups = [];
    if (inside.length > 0) {
      groups.push({ groupName: `Trong ${currentDepartment}`, list: inside });
    }
    if (outside.length > 0) {
      groups.push({ groupName: "Tìm ở đơn vị khác...", list: outside });
    }
    return groups;
  }, [filteredPeople, currentDepartment]);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-foreground mb-1.5">
          {label}
        </label>
      )}

      <div
        id={id}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel || label || placeholder}
        aria-invalid={invalid || undefined}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            inputRef.current?.focus();
          }
        }}
        className={cn(
          "relative flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-xl bg-secondary px-2.5 py-1 text-sm",
          "transition-colors duration-100 motion-reduce:transition-none",
          "focus-within:bg-selected focus-within:outline-2 focus-within:outline-primary focus-within:outline-offset-1",
          disabled && "cursor-not-allowed opacity-50",
          invalid && "bg-danger-soft text-destructive",
          !disabled && "cursor-text"
        )}
      >
        {selectedList.map((personId) => {
          const person = people.find((p) => p.id === personId);
          if (!person) return null;
          return (
            <span
              key={person.id}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-background pl-1 pr-2 py-0.5 text-xs font-medium text-foreground select-none"
            >
              <UserAvatar
                name={person.name}
                avatarUrl={person.avatarUrl}
                size="xs"
                className="size-5"
              />
              <span className="max-w-[150px] truncate">{person.name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemovePerson(person.id, e)}
                  className={`rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer outline-none ${focusRingClass} relative before:absolute before:-inset-1.5 before:content-[''] touch-manipulation`}
                  aria-label={`Bỏ chọn ${person.name}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          );
        })}

        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          placeholder={selectedList.length === 0 ? placeholder : ""}
          className="min-w-[100px] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />

        <div className="flex shrink-0 items-center gap-1 ml-auto">
          {selectedList.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClearAll}
              className={`flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer outline-none ${focusRingClass} relative before:absolute before:-inset-1.5 before:content-[''] touch-manipulation`}
              aria-label="Xóa tất cả người đã chọn"
            >
              <X className="size-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-2xl bg-popover p-1 text-popover-foreground shadow-menu outline-none border-0">
          {filteredPeople.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">{emptyText}</div>
          ) : (
            <div role="listbox" className="flex flex-col gap-1">
              {groupedPeople.map((group, groupIdx) => (
                <div key={groupIdx} className="flex flex-col gap-0.5">
                  {group.groupName && (
                    <div className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                      {group.groupName}
                    </div>
                  )}
                  {group.list.map((person) => {
                    const isSelected = selectedList.includes(person.id);
                    return (
                      <div
                        key={person.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectPerson(person.id)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm select-none transition-colors",
                          isSelected ? "bg-accent text-accent-foreground font-medium" : "hover:bg-muted text-foreground"
                        )}
                      >
                        <UserAvatar
                          name={person.name}
                          avatarUrl={person.avatarUrl}
                          size="sm"
                          className="size-6 shrink-0"
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="truncate font-medium">{person.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {[person.roleTitle, person.department].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                        {isSelected && <Check className="size-4 shrink-0 text-primary" />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
