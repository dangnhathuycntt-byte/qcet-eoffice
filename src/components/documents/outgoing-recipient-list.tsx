"use client";

import * as React from "react";
import { Building2, CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OutgoingDocumentStatus } from "@/contracts/documents";

const ISSUED_STATUSES: OutgoingDocumentStatus[] = [
  "ISSUED",
  "DELIVERED",
  "FILED",
  "ARCHIVED",
];

function parseRecipientList(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface OutgoingRecipientListProps {
  recipientList?: string | null;
  status: OutgoingDocumentStatus;
  issuedAt?: Date | string | null;
  className?: string;
}

export function OutgoingRecipientList({
  recipientList,
  status,
  issuedAt,
  className,
}: OutgoingRecipientListProps) {
  const recipients = parseRecipientList(recipientList);
  const isIssued = ISSUED_STATUSES.includes(status);

  if (recipients.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-center",
          className
        )}
      >
        <Users className="mx-auto size-5 text-muted-foreground/40 mb-1.5" strokeWidth={1.5} />
        <p className="text-xs text-muted-foreground">Chưa có danh sách nơi nhận</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border/70 bg-card p-4 shadow-xs", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Nơi nhận ({recipients.length})
        </h3>
        {isIssued && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <CheckCircle2 className="size-3" strokeWidth={2} />
            Đã phát hành
          </span>
        )}
      </div>

      <ul className="space-y-1.5" role="list" aria-label="Danh sách nơi nhận">
        {recipients.map((recipient, index) => (
          <li
            key={index}
            className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5"
          >
            <Building2
              className="size-3.5 shrink-0 text-muted-foreground/60"
              strokeWidth={1.5}
            />
            <span className="text-xs text-foreground leading-snug">{recipient}</span>
            {isIssued && (
              <CheckCircle2
                className="ml-auto size-3 shrink-0 text-emerald-500"
                strokeWidth={2}
              />
            )}
          </li>
        ))}
      </ul>

      {isIssued && issuedAt && (
        <p className="mt-3 text-[10px] text-muted-foreground text-right">
          Phát hành lúc{" "}
          {new Date(issuedAt).toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Ho_Chi_Minh",
          })}
        </p>
      )}
    </div>
  );
}
