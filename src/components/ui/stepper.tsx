import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  /** Chỉ số bước hiện tại, bắt đầu từ 0. */
  current: number;
  className?: string;
}

/** Các bước của một quy trình (ví dụ soạn văn bản đi). Bước hiện tại có `aria-current="step"`; trạng thái từng bước có chữ ẩn cho trình đọc màn hình. */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <nav aria-label="Các bước" className={className}>
      <ol className="flex items-center gap-2">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li
              key={step.label}
              aria-current={active ? "step" : undefined}
              className="flex min-w-0 items-center gap-2"
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-selected text-primary font-semibold border-2 border-primary",
                  !done && !active && "bg-secondary text-muted-foreground",
                )}
              >
                {done ? <Check aria-hidden="true" className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "truncate text-sm",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
                <span className="sr-only">
                  {done ? " (đã xong)" : active ? " (đang thực hiện)" : " (chưa bắt đầu)"}
                </span>
              </span>
              {i < steps.length - 1 ? (
                <span aria-hidden="true" className={cn("h-px w-6 shrink-0 sm:w-10", done ? "bg-primary" : "bg-border")} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
