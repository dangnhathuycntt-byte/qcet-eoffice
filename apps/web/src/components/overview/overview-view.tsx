"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, UserRoundCheck } from "lucide-react";
import type { ActionInboxItem, ActionInboxResponse } from "@qcet/contracts/me";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { formatDisplayName } from "@/components/layout/app-sidebar";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { focusRingClass } from "@/components/ui/focus-ring";
import {
  IconSidebarFolder,
  IconSidebarInboxIn,
  IconSidebarSend,
  IconSidebarTasks,
} from "@/components/layout/sidebar-rounded-icons";
import { daysUntil, formatRelativeDate } from "@/lib/format/relative-date";
import { DUE_SOON_DAYS } from "@/components/tasks/table/utils/table-date-helpers";
import { cn } from "@/lib/utils";

interface Meeting {
  id: string;
  title: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
}

type Section<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

type ItemGroup = "task" | "document" | "dossier" | "delegation";

const GROUP_OF: Record<ActionInboxItem["resourceType"], ItemGroup> = {
  TASK: "task",
  INCOMING_DOCUMENT: "document",
  OUTGOING_DOCUMENT: "document",
  DOSSIER: "dossier",
  DELEGATION: "delegation",
};

const GROUP_LABEL: Record<ItemGroup, string> = {
  task: "Nhiệm vụ",
  document: "Văn bản",
  dossier: "Hồ sơ",
  delegation: "Ủy quyền",
};

const ITEM_ICON: Record<ActionInboxItem["resourceType"], React.ComponentType<{ className?: string }>> = {
  TASK: IconSidebarTasks,
  INCOMING_DOCUMENT: IconSidebarInboxIn,
  OUTGOING_DOCUMENT: IconSidebarSend,
  DOSSIER: IconSidebarFolder,
  DELEGATION: UserRoundCheck,
};

/** Số việc hiện trước khi bấm "Xem thêm". */
const VISIBLE_ITEMS = 8;
/** Lịch họp trong bao nhiêu ngày tới. */
const MEETING_DAYS = 7;

const ICT = "Asia/Ho_Chi_Minh";
const MEETING_DAY = new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: ICT });
const MEETING_TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ICT });

async function fetchSection<T>(url: string, signal: AbortSignal, pick: (json: any) => T): Promise<Section<T>> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return { status: "error" };
    return { status: "ready", data: pick(await res.json()) };
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    return { status: "error" };
  }
}

/** Việc trễ hạn lâu nhất lên đầu, rồi hạn gần nhất; việc không có hạn xếp sau, mới giao trước. */
function compareItems(a: ActionInboxItem, b: ActionInboxItem) {
  if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  if (a.deadline) return -1;
  if (b.deadline) return 1;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

/**
 * Trang Tổng quan (`/`): chỉ những gì đang chờ chính người dùng (như Home của Notion, My issues của Linear): việc cần xử lý ở mọi
 * phân hệ chia nhóm theo độ gấp và lịch họp 7 ngày tới. Số liệu tổng hợp (nhiệm vụ theo đơn vị, thống kê văn bản) nằm ở Báo cáo
 * (`/reports`), không lặp ở đây (chốt 15/10/2026).
 * - Việc cần xử lý: `/api/me/inbox` (đã lọc theo vai trò, chức vụ, ủy quyền của người dùng; mỗi loại tối đa 10–20 mục).
 * - Lịch: `/api/meetings` từ hôm nay tới hết ngày thứ 7.
 */
export function OverviewView({ greeting, userName, todayLabel }: { greeting: string; userName: string; todayLabel: string }) {
  const [inbox, setInbox] = React.useState<Section<ActionInboxResponse>>({ status: "loading" });
  const [meetings, setMeetings] = React.useState<Section<Meeting[]>>({ status: "loading" });
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    const ctrl = new AbortController();
    const from = new Date();
    const to = new Date(from.getTime() + MEETING_DAYS * 86_400_000);
    const meetingParams = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), limit: "20", page: "1" });
    setInbox({ status: "loading" });
    setMeetings({ status: "loading" });
    Promise.all([
      fetchSection("/api/me/inbox", ctrl.signal, (json) => json as ActionInboxResponse).then(setInbox),
      fetchSection(`/api/meetings?${meetingParams}`, ctrl.signal, (json) => (Array.isArray(json?.items) ? (json.items as Meeting[]) : [])).then(setMeetings),
    ]).catch(() => {
      // Huỷ khi rời trang: bỏ qua
    });
    return () => ctrl.abort();
  }, [reloadKey]);

  const retry = () => setReloadKey((key) => key + 1);

  return (
    <WorkspacePageCard title="Tổng quan" description={todayLabel} hideTitleOnMobile className="max-w-5xl">
      <div className="flex flex-col gap-8 pb-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">
            {greeting}, {formatDisplayName(userName)}
          </h2>
          <p className="text-compact text-muted-foreground">Việc đang chờ bạn ở Nhiệm vụ, Văn bản và Hồ sơ, và lịch họp sắp tới.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <ActionList inbox={inbox} onRetry={retry} />
          <UpcomingMeetings meetings={meetings} onRetry={retry} />
        </div>
      </div>
    </WorkspacePageCard>
  );
}

type Urgency = "overdue" | "soon" | "later";

/** Nhóm theo độ gấp như nhóm "Focus" ở My issues của Linear: trễ hạn, đến hạn trong vài ngày tới, còn lại (kể cả việc không có hạn). */
const URGENCY_GROUPS: { id: Urgency; label: string; tone: string }[] = [
  { id: "overdue", label: "Trễ hạn", tone: "text-destructive" },
  { id: "soon", label: "Sắp đến hạn", tone: "text-warning" },
  { id: "later", label: "Còn lại", tone: "text-muted-foreground" },
];

function urgencyOf(item: ActionInboxItem): Urgency {
  const days = daysUntil(item.deadline);
  if (days === null) return "later";
  if (days < 0) return "overdue";
  return days <= DUE_SOON_DAYS ? "soon" : "later";
}

function SectionHeader({ id, title, count, children }: { id: string; title: string; count?: number; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
      <h2 id={id} className="flex items-baseline gap-2 text-compact font-semibold text-foreground">
        {title}
        {count !== undefined && count > 0 ? <span className="text-xs font-normal tabular-nums text-muted-foreground">{count}</span> : null}
      </h2>
      {children}
    </div>
  );
}

function RowSkeletons({ rows }: { rows: number }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-12 items-center gap-3 px-2">
          <Skeleton className="size-4 rounded-sm" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-2.5 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionList({ inbox, onRetry }: { inbox: Section<ActionInboxResponse>; onRetry: () => void }) {
  const [group, setGroup] = React.useState<"all" | ItemGroup>("all");
  const [expanded, setExpanded] = React.useState(false);
  const items = React.useMemo(
    () => (inbox.status === "ready" ? [...inbox.data.items].sort(compareItems) : []),
    [inbox]
  );
  const groups = (Object.keys(GROUP_LABEL) as ItemGroup[])
    .map((id) => ({ id, count: items.filter((item) => GROUP_OF[item.resourceType] === id).length }))
    .filter((g) => g.count > 0);
  const filtered = group === "all" ? items : items.filter((item) => GROUP_OF[item.resourceType] === group);
  const shown = expanded ? filtered : filtered.slice(0, VISIBLE_ITEMS);

  return (
    <section aria-labelledby="overview-actions" className="flex min-w-0 flex-col gap-2">
      <SectionHeader id="overview-actions" title="Việc cần xử lý" count={items.length}>
        {groups.length > 1 ? (
          <Tabs value={group} onValueChange={(next) => { setGroup(next as "all" | ItemGroup); setExpanded(false); }} className="max-w-full overflow-x-auto">
            <TabsList variant="pill" size="sm" aria-label="Lọc theo loại việc">
              <TabsTrigger value="all">Tất cả</TabsTrigger>
              {groups.map((g) => (
                <TabsTrigger key={g.id} value={g.id}>
                  {GROUP_LABEL[g.id]} <span className="tabular-nums text-muted-foreground">{g.count}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
      </SectionHeader>

      {inbox.status === "loading" ? (
        <RowSkeletons rows={5} />
      ) : inbox.status === "error" ? (
        <InlineAlert actionLabel="Thử lại" onAction={onRetry} className="py-2">
          Chưa tải được danh sách việc cần xử lý.
        </InlineAlert>
      ) : items.length === 0 ? (
        <EmptyState
          density="compact"
          illustration="all-done"
          title="Không có việc nào đang chờ bạn"
          description="Việc được giao, văn bản cần xử lý và kết quả cần duyệt sẽ hiện ở đây."
        />
      ) : (
        <>
          {/* Danh sách đã xếp hạn sớm trước nên cắt "Xem thêm" vẫn giữ các nhóm liền mạch; số ở tiêu đề nhóm là tổng của nhóm */}
          <div className="-mx-2 flex flex-col gap-2">
            {URGENCY_GROUPS.map((g) => {
              const rows = shown.filter((item) => urgencyOf(item) === g.id);
              if (rows.length === 0) return null;
              return (
                <section key={g.id} aria-labelledby={`overview-group-${g.id}`}>
                  <h3 id={`overview-group-${g.id}`} className="flex h-8 items-center gap-2 px-2 text-xs font-medium">
                    <span className={g.tone}>{g.label}</span>
                    <span className="tabular-nums text-muted-foreground">{filtered.filter((item) => urgencyOf(item) === g.id).length}</span>
                  </h3>
                  <ul className="flex flex-col">
                    {rows.map((item) => (
                      <li key={item.id}>
                        <ActionRow item={item} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          {filtered.length > VISIBLE_ITEMS ? (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Thu gọn" : `Xem thêm ${filtered.length - VISIBLE_ITEMS} việc`}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

function ActionRow({ item }: { item: ActionInboxItem }) {
  const Icon = ITEM_ICON[item.resourceType];
  const days = daysUntil(item.deadline);
  const dueTone =
    days === null ? "text-muted-foreground" : days <= 0 ? "text-destructive" : days <= DUE_SOON_DAYS ? "text-warning" : "text-muted-foreground";
  return (
    <Link
      href={item.linkUrl}
      className={cn("flex h-12 items-center gap-3 rounded-md px-2 transition-colors hover:bg-accent", focusRingClass)}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-compact font-medium text-foreground" title={item.title}>
          {item.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {item.requiredAction}
          {item.resourceCode ? ` · ${item.resourceCode}` : ""}
        </span>
      </span>
      {item.deadline ? (
        <span className={cn("shrink-0 text-xs tabular-nums", dueTone)}>{formatRelativeDate(item.deadline)}</span>
      ) : null}
    </Link>
  );
}

function UpcomingMeetings({ meetings, onRetry }: { meetings: Section<Meeting[]>; onRetry: () => void }) {
  const list = meetings.status === "ready" ? [...meetings.data].sort((a, b) => a.startTime.localeCompare(b.startTime)) : [];
  return (
    <section aria-labelledby="overview-meetings" className="flex flex-col gap-2">
      <SectionHeader id="overview-meetings" title="Lịch 7 ngày tới" count={list.length}>
        <Button asChild variant="ghost" size="sm">
          <Link href="/calendar">Mở lịch</Link>
        </Button>
      </SectionHeader>
      {meetings.status === "loading" ? (
        <RowSkeletons rows={2} />
      ) : meetings.status === "error" ? (
        <InlineAlert actionLabel="Thử lại" onAction={onRetry} className="py-2">
          Chưa tải được lịch họp.
        </InlineAlert>
      ) : list.length === 0 ? (
        <p className="flex items-center gap-2 py-2 text-compact text-muted-foreground">
          <CalendarDays className="size-4 shrink-0" />
          Không có cuộc họp nào trong {MEETING_DAYS} ngày tới.
        </p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {list.map((meeting) => {
            const start = new Date(meeting.startTime);
            return (
              <li key={meeting.id}>
                <Link
                  href="/calendar"
                  className={cn("flex h-12 items-center gap-3 rounded-md px-2 transition-colors hover:bg-accent", focusRingClass)}
                >
                  <span className="flex w-14 shrink-0 flex-col text-xs tabular-nums">
                    <span className="font-medium text-foreground">{MEETING_DAY.format(start)}</span>
                    <span className="text-muted-foreground">{MEETING_TIME.format(start)}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-compact font-medium text-foreground" title={meeting.title}>
                      {meeting.title}
                    </span>
                    {meeting.location ? <span className="truncate text-xs text-muted-foreground">{meeting.location}</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
