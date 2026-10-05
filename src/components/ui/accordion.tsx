"use client";

import * as React from "react";
import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccordionItemData {
  value: string;
  title: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface AccordionProps {
  items: AccordionItemData[];
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Danh sách câu hỏi / khối nội dung mở gập nhiều mục (Accordion), dựng trên `@base-ui/react/accordion`.
 * Hỗ trợ chuyển động mượt mà và phím điều hướng `↑/↓`.
 */
export function Accordion({
  items,
  value,
  defaultValue,
  onValueChange,
  multiple = false,
  disabled,
  className,
}: AccordionProps) {
  return (
    <BaseAccordion.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      className={cn("w-full divide-y divide-border/60", className)}
    >
      {items.map((item) => (
        <BaseAccordion.Item
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          className="group/accordion"
        >
          <BaseAccordion.Header className="flex">
            <BaseAccordion.Trigger
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-between py-3.5 text-left text-sm font-medium text-foreground outline-none select-none",
                "transition-colors duration-[var(--motion-duration-micro)] hover:text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1",
                "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
              )}
            >
              <span>{item.title}</span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none group-data-[panel-open]/accordion:rotate-180"
              />
            </BaseAccordion.Trigger>
          </BaseAccordion.Header>
          <BaseAccordion.Panel
            className={cn(
              "overflow-hidden text-sm text-muted-foreground transition-[height,opacity] duration-200 ease-out motion-reduce:transition-none",
              "data-[starting-style]:h-0 data-[starting-style]:opacity-0",
              "data-[ending-style]:h-0 data-[ending-style]:opacity-0",
            )}
          >
            <div className="pt-0.5 pb-4 text-sm leading-relaxed text-muted-foreground">
              {item.content}
            </div>
          </BaseAccordion.Panel>
        </BaseAccordion.Item>
      ))}
    </BaseAccordion.Root>
  );
}
