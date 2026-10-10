import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CompletionAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface CompletionStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: React.ReactNode;
  primaryAction: CompletionAction;
  secondaryAction?: CompletionAction;
  meta?: React.ReactNode;
}

/**
 * Institutional completion state matching Components5.dc.html:
 * "Nói điều đã xảy ra, ai được báo, việc kế tiếp. Không dùng dấu chấm than, không biểu tượng ăn mừng."
 */
export function CompletionState({
  title,
  description,
  primaryAction,
  secondaryAction,
  meta,
  className,
  ...props
}: CompletionStateProps) {
  return (
    <div
      data-slot="completion-state"
      className={cn(
        "flex flex-col items-start justify-center max-w-lg mx-auto py-10 px-6 sm:px-8",
        className,
      )}
      {...props}
    >
      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>

      <div className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
        {description}
      </div>

      {meta && <div className="mt-4 w-full">{meta}</div>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {primaryAction.href ? (
          <Button asChild variant="default" size="default">
            <Link href={primaryAction.href}>{primaryAction.label}</Link>
          </Button>
        ) : (
          <Button
            variant="default"
            size="default"
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        )}

        {secondaryAction &&
          (secondaryAction.href ? (
            <Button asChild variant="secondary" size="default">
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="default"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          ))}
      </div>
    </div>
  );
}
