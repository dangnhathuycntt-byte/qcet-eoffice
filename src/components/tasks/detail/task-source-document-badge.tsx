"use client";

import * as React from "react";
import { FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskSourceDocument } from "@/types/dashboard";
import { formatDisplayDate } from "@/lib/format/date";
import { Tooltip } from "@base-ui/react/tooltip";

interface TaskSourceDocumentBadgeProps {
  sourceDocument: TaskSourceDocument;
  className?: string;
  /** Chế độ compact dùng trong PropertyRow của sidebar */
  compact?: boolean;
}

export function TaskSourceDocumentBadge({
  sourceDocument,
  className,
  compact = false,
}: TaskSourceDocumentBadgeProps) {
  const docHref = `/documents?highlight=${sourceDocument.id}`;
  const typeLabel =
    sourceDocument.type === "VAN_BAN_DEN"
      ? "Văn bản đến"
      : sourceDocument.type === "VAN_BAN_DI"
      ? "Văn bản đi"
      : "Văn bản";

  if (compact) {
    return (
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={(props) => (
              <a
                {...props}
                href={docHref}
                className={cn(
                  "inline-flex items-center gap-1 max-w-full min-w-0 group",
                  "text-xs font-medium text-primary/80 hover:text-primary",
                  "rounded px-1.5 py-0.5 bg-primary/8 hover:bg-primary/12",
                  "transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  className
                )}
                aria-label={`Mở văn bản gốc: ${sourceDocument.originalNumber}`}
              >
                <FileText className="size-3 shrink-0" strokeWidth={1.5} />
                <span className="truncate">
                  {sourceDocument.originalNumber || `#${sourceDocument.registrationNumber}`}
                </span>
                <ExternalLink
                  className="size-2.5 shrink-0 opacity-50 group-hover:opacity-100"
                  strokeWidth={1.5}
                />
              </a>
            )}
          />
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={4}>
              <Tooltip.Popup className="z-50 max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                <p className="font-medium">
                  {typeLabel}: {sourceDocument.originalNumber}
                </p>
                <p className="text-muted-foreground mt-0.5 line-clamp-2">
                  {sourceDocument.summary}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {sourceDocument.issuingAuthority}
                </p>
                {sourceDocument.issuedDate && (
                  <p className="text-muted-foreground">
                    Ban hành: {formatDisplayDate(sourceDocument.issuedDate)}
                  </p>
                )}
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
  }

  // Full card variant for task-detail-page header area
  return (
    <a
      href={docHref}
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5",
        "hover:bg-muted/50 hover:border-border transition-colors group",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      aria-label={`Mở văn bản gốc: ${sourceDocument.originalNumber}`}
    >
      <FileText className="size-4 shrink-0 text-muted-foreground mt-0.5" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground">
            {typeLabel}
          </span>
          <span className="text-[10px] text-muted-foreground/60">·</span>
          <span className="text-[10px] text-muted-foreground">
            {sourceDocument.issuingAuthority}
          </span>
        </div>
        <p className="text-xs font-semibold text-foreground mt-0.5 truncate">
          {sourceDocument.originalNumber}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
          {sourceDocument.summary}
        </p>
      </div>
      <ExternalLink
        className="size-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground mt-0.5"
        strokeWidth={1.5}
      />
    </a>
  );
}
