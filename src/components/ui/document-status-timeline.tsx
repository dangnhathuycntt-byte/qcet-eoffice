"use client";

import * as React from "react";
import { Check, Clock, AlertCircle, User, FileText, ChevronRight } from "lucide-react";
import { UserAvatar } from "./user-avatar";
import { cn } from "@/lib/utils";

export type StepState = "completed" | "current" | "pending" | "rejected";

export interface WorkflowStep {
  id: string;
  title: string;
  actor?: {
    name: string;
    title?: string;
    avatarUrl?: string;
  };
  timestamp?: string | Date;
  comment?: string;
  state: StepState;
}

export interface DocumentStatusTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: WorkflowStep[];
  orientation?: "horizontal" | "vertical";
}

/**
 * Trục tiến trình xử lý văn bản / tờ trình / nhiệm vụ theo quy trình hành chính.
 */
export function DocumentStatusTimeline({
  steps,
  orientation = "vertical",
  className,
  ...props
}: DocumentStatusTimelineProps) {
  const formatTime = (val?: string | Date) => {
    if (!val) return "";
    if (typeof val === "string") return val;
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(val);
  };

  const getStepIcon = (state: StepState, index: number) => {
    switch (state) {
      case "completed":
        return <Check className="size-3.5 text-primary-foreground" />;
      case "current":
        return <Clock className="size-3.5 text-primary" />;
      case "rejected":
        return <AlertCircle className="size-3.5 text-destructive" />;
      case "pending":
      default:
        return <span className="text-xs text-muted-foreground">{index + 1}</span>;
    }
  };

  const getStepIndicatorClass = (state: StepState) => {
    switch (state) {
      case "completed":
        return "bg-primary border-primary text-primary-foreground";
      case "current":
        return "bg-selected border-primary text-primary";
      case "rejected":
        return "bg-danger-soft border-destructive text-destructive";
      case "pending":
      default:
        return "bg-muted border-border text-muted-foreground";
    }
  };

  if (orientation === "horizontal") {
    return (
      <div className={cn("w-full overflow-x-auto py-2", className)} {...props}>
        <div className="flex items-center min-w-max gap-2">
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all",
                    getStepIndicatorClass(step.state)
                  )}
                >
                  {getStepIcon(step.state, idx)}
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-xs font-medium truncate",
                      step.state === "current"
                        ? "text-primary font-semibold"
                        : step.state === "completed"
                          ? "text-foreground"
                          : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                  {step.actor?.name ? (
                    <p className="text-xs text-muted-foreground truncate">{step.actor.name}</p>
                  ) : null}
                </div>
              </div>
              {idx < steps.length - 1 ? (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground mx-1" />
              ) : null}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col relative gap-4", className)} {...props}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;

        return (
          <div key={step.id} className="relative flex items-start gap-3.5 group">
            {/* Đường nối dọc */}
            {!isLast ? (
              <div
                className={cn(
                  "absolute left-3.5 top-7 bottom-0 w-[1.5px] -ml-[0.75px]",
                  step.state === "completed" ? "bg-primary" : "bg-mark"
                )}
                aria-hidden="true"
              />
            ) : null}

            {/* Indicator nút tròn */}
            <div
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-all",
                getStepIndicatorClass(step.state)
              )}
            >
              {getStepIcon(step.state, idx)}
            </div>

            {/* Nội dung bước */}
            <div className="flex-1 pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className={cn(
                    "text-xs font-medium",
                    step.state === "current"
                      ? "text-primary font-semibold"
                      : step.state === "completed"
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground"
                  )}
                >
                  {step.title}
                </p>
                {step.timestamp ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatTime(step.timestamp)}
                  </span>
                ) : null}
              </div>

              {step.actor ? (
                <div className="mt-1 flex items-center gap-2">
                  <UserAvatar
                    name={step.actor.name}
                    avatarUrl={step.actor.avatarUrl}
                    size="xs"
                  />
                  <span className="text-xs text-foreground font-medium">{step.actor.name}</span>
                  {step.actor.title ? (
                    <span className="text-xs text-muted-foreground">({step.actor.title})</span>
                  ) : null}
                </div>
              ) : null}

              {step.comment ? (
                <div className="mt-2 rounded-xl bg-secondary p-3 text-xs text-foreground border-0">
                  <span className="font-semibold text-muted-foreground">Ý kiến: </span>
                  {step.comment}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
