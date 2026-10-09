"use client";

import * as React from "react";
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
      <div className={cn("rounded-[10px] border border-border bg-card p-3", className)}>
        <h3 className="mb-1.5 text-xs font-semibold text-foreground">Nơi nhận</h3>
        <p className="py-1 text-xs text-muted-foreground">Chưa có danh sách nơi nhận</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-[10px] border border-border bg-card p-3", className)}>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          Nơi nhận
          <span className="font-normal tabular-nums text-muted-foreground">{recipients.length}</span>
        </h3>
        {isIssued && <span className="text-xs text-muted-foreground">Đã phát hành</span>}
      </div>

      <ul className="space-y-0.5" role="list" aria-label="Danh sách nơi nhận">
        {recipients.map((recipient, index) => (
          <li key={index} className="py-0.5 text-compact text-foreground leading-snug">
            {recipient}
          </li>
        ))}
      </ul>

      {isIssued && issuedAt && (
        <p className="mt-2 text-xs text-muted-foreground text-right">
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
