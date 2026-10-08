"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuditActionLabel, type ConsolidatedActivityItem } from "@/lib/tasks/activity-feed-aggregator";
import {
  TaskIconAssignee,
  TaskIconBlockAttachment,
  TaskIconBlockCallout,
  TaskIconComplete,
  TaskIconDeadline,
  TaskIconPriority,
  TaskIconStatus,
} from "@/lib/icons/task-icons";

const TZ = "Asia/Ho_Chi_Minh";

type IconComponent = React.ComponentType<{ className?: string }>;

function PencilIcon({ className }: { className?: string }) {
  return <Pencil className={className} strokeWidth={1.5} />;
}

/** Icon theo loại hoạt động (cùng bộ icon dự án, nét 1,5) */
function iconForAction(action: string): IconComponent {
  const a = action.toUpperCase();
  if (a.includes("STATUS") || ["NOT_STARTED", "IN_PROGRESS", "WAITING_APPROVAL", "NEEDS_REVIEW", "CANCELLED"].includes(a)) return TaskIconStatus;
  if (a === "COMPLETED" || a.includes("APPROVED")) return TaskIconComplete;
  if (a.includes("DEADLINE") || a.includes("DUE_DATE") || a.includes("START_DATE")) return TaskIconDeadline;
  if (a.includes("ASSIGN") || a.includes("REASSIGN")) return TaskIconAssignee;
  if (a.includes("PRIORITY")) return TaskIconPriority;
  if (a.includes("DELIVERABLE")) return TaskIconBlockAttachment;
  if (a === "COMMENT" || a === "DIRECTIVE" || a.includes("REJECT") || a.includes("REVISION")) return TaskIconBlockCallout;
  return PencilIcon;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("sv-SE", { timeZone: TZ }); // YYYY-MM-DD
}

function dayLabel(key: string, todayKey: string, yesterdayKey: string): string {
  if (!key) return "Không rõ ngày";
  if (key === todayKey) return "Hôm nay";
  if (key === yesterdayKey) return "Hôm qua";
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("vi-VN", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
}

export interface TaskActivityFeedProps {
  events: ConsolidatedActivityItem[];
  /** Mốc "hôm nay" để kiểm thử xác định; mặc định lấy giờ hiện tại */
  now?: Date;
  className?: string;
}

/**
 * Nhật ký hoạt động gọn kiểu Linear: nhóm theo ngày, mỗi sự kiện một dòng
 * (icon theo loại · người thao tác · nội dung · giờ), không chấm tròn và không viền từng dòng.
 */
export function TaskActivityFeed({ events, now = new Date(), className }: TaskActivityFeedProps) {
  const groups = React.useMemo(() => {
    const todayKey = now.toLocaleDateString("sv-SE", { timeZone: TZ });
    const yesterdayKey = new Date(now.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString("sv-SE", { timeZone: TZ });
    const map = new Map<string, ConsolidatedActivityItem[]>();
    for (const evt of events) {
      const key = dayKey(evt.timestamp);
      const list = map.get(key);
      if (list) list.push(evt);
      else map.set(key, [evt]);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: dayLabel(key, todayKey, yesterdayKey),
      items,
    }));
  }, [events, now]);

  return (
    <div className={cn("space-y-4", className)}>
      {groups.map((group) => (
        <section key={group.key || "unknown"} aria-label={group.label}>
          <h3 className="px-2 pb-1 text-xs font-medium text-muted-foreground">{group.label}</h3>
          <ul>
            {group.items.map((evt) => {
              const Icon = iconForAction(evt.action);
              const text = evt.description || getAuditActionLabel(evt.action);
              return (
                <li
                  key={evt.id}
                  className="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted/40"
                >
                  <Icon className="mt-px size-4 shrink-0 text-muted-foreground" />
                  <p className="min-w-0 flex-1 leading-relaxed text-muted-foreground">
                    {evt.actorName && <span className="font-medium text-foreground">{evt.actorName} </span>}
                    {text}
                  </p>
                  <time dateTime={evt.timestamp} className="shrink-0 tabular-nums text-muted-foreground">
                    {timeLabel(evt.timestamp)}
                  </time>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
