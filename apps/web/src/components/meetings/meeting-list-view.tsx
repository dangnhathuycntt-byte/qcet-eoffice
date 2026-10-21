"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MEETING_BUCKETS, type MeetingBucket } from "@qcet/contracts/meeting";
import { formatDisplayDate, formatTime, formatWeekday } from "@qcet/shared/lib/format/date";
import { daysUntil } from "@/lib/format/relative-date";
import { ListPageCreateButton, ListPageHeader, ListPageTitle } from "@/components/workspace/list-page-header";
import { CreateMeetingDialog } from "@/components/meetings/create-meeting-dialog";
import { MEETING_STATUS_TONE_CLASS, meetingStatus } from "@/components/meetings/meeting-status";
import { ListToolbarSearchToggle } from "@/components/ui/list-toolbar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

interface MeetingRow {
  id: string;
  title: string;
  status: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  organizer: { id: string; name: string; avatarUrl?: string | null } | null;
  unit: { name: string } | null;
  _count: { participants: number; resolutions: number };
}

interface MeetingPage {
  items: MeetingRow[];
  total: number;
}

type TabKey = "all" | MeetingBucket;

const PAGE_SIZE = 20;

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "upcoming", label: "Sắp diễn ra" },
  { key: "done", label: "Đã họp" },
];

const TITLES: Record<TabKey, string> = {
  all: "Tất cả cuộc họp",
  upcoming: "Cuộc họp sắp diễn ra",
  done: "Cuộc họp đã họp",
};

function parseTab(value: string | null): TabKey {
  return (MEETING_BUCKETS as readonly string[]).includes(value ?? "") ? (value as MeetingBucket) : "all";
}

function timeRange(row: MeetingRow) {
  const start = formatTime(row.startTime, "");
  const end = row.endTime ? formatTime(row.endTime, "") : "";
  return end ? `${start} – ${end}` : start;
}

const NEAR_DAYS: Record<number, string> = { [-1]: "Hôm qua", 0: "Hôm nay", 1: "Ngày mai" };

/**
 * Ô Thời gian: hôm qua/hôm nay/ngày mai ghi bằng chữ (như lịch họp), ngày khác `dd/MM/yyyy` kèm thứ ở dòng giờ để biết
 * cuộc họp rơi vào ngày nào trong tuần mà không phải đếm.
 */
function meetingWhen(row: MeetingRow) {
  const diff = daysUntil(row.startTime);
  const near = diff === null ? undefined : NEAR_DAYS[diff];
  return {
    day: near ?? formatDisplayDate(row.startTime),
    detail: near ? timeRange(row) : `${formatWeekday(row.startTime)} · ${timeRange(row)}`,
    start: formatTime(row.startTime, ""),
    fullDate: `${formatWeekday(row.startTime)}, ${formatDisplayDate(row.startTime)}`,
    today: diff === 0,
  };
}

/**
 * Cuộc họp (`/meetings`, mục "Cuộc họp" ở sidebar; thay trang Lịch công tác đã bỏ 20/10/2026): danh sách cuộc họp mình
 * tổ chức hoặc được mời. Khung theo trang Nhiệm vụ (người dùng yêu cầu "học nhiệm vụ" 20/10/2026): một thẻ cao hết màn
 * hình, không breadcrumb (`app-shell`), thanh tiêu đề 44px với "+ Tạo cuộc họp", hàng tab giai đoạn cùng nút tìm thu gọn,
 * hai hàng này và tiêu đề cột dính khi cuộn; bảng không kẻ dòng. Các mục con ở sidebar và hàng tab cùng chọn `?bucket=`,
 * tìm theo tên (`?q=`), bấm một hàng mở trang chi tiết. Phạm vi xem do API quyết định (`meeting.read`).
 */
export function MeetingListView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("bucket"));
  const urlQuery = searchParams.get("q") ?? "";

  const [items, setItems] = React.useState<MeetingRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState(urlQuery);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  // Đổi mục ở sidebar hoặc tab thì ô tìm theo URL; gõ chữ chỉ cập nhật URL sau khi ngừng gõ (không nháy danh sách)
  React.useEffect(() => setSearch(urlQuery), [urlQuery]);
  const replaceParams = React.useCallback(
    (next: { bucket?: TabKey; q?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      const bucket = next.bucket ?? tab;
      if (bucket === "all") params.delete("bucket");
      else params.set("bucket", bucket);
      const q = (next.q ?? urlQuery).trim();
      if (q) params.set("q", q);
      else params.delete("q");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, tab, urlQuery]
  );
  React.useEffect(() => {
    if (search.trim() === urlQuery.trim()) return;
    const timer = setTimeout(() => replaceParams({ q: search }), 300);
    return () => clearTimeout(timer);
  }, [search, urlQuery, replaceParams]);

  const buildUrl = React.useCallback(
    (pageNumber: number) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(pageNumber) });
      if (tab !== "all") params.set("bucket", tab);
      if (urlQuery.trim()) params.set("search", urlQuery.trim());
      return `/api/meetings?${params.toString()}`;
    },
    [tab, urlQuery]
  );

  const load = React.useCallback(
    async (pageNumber: number, signal?: AbortSignal) => {
      const more = pageNumber > 1;
      if (more) setIsLoadingMore(true);
      else {
        setIsLoading(true);
        setFetchError(null);
      }
      try {
        const res = await fetch(buildUrl(pageNumber), { signal });
        if (!res.ok) {
          setFetchError("Chưa tải được danh sách cuộc họp.");
          return;
        }
        const json = (await res.json()) as MeetingPage;
        setItems((current) => (more ? [...current, ...json.items] : json.items));
        setTotal(json.total);
        setPage(pageNumber);
      } catch (error) {
        if ((error as { name?: string })?.name !== "AbortError") setFetchError("Mất kết nối khi tải danh sách cuộc họp.");
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [buildUrl]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void load(1, controller.signal);
    return () => controller.abort();
  }, [load]);

  const searching = urlQuery.trim().length > 0;

  return (
    <>
      {/* Thanh tiêu đề + hàng tab đứng yên khi cuộn (88px), tiêu đề cột dính ngay dưới như trang Nhiệm vụ */}
      <div className="relative z-20 flex flex-col md:sticky md:top-0 md:z-40 md:bg-card">
        <ListPageHeader
          title={<ListPageTitle>Cuộc họp</ListPageTitle>}
          action={<ListPageCreateButton label="Tạo cuộc họp" onClick={() => setCreating(true)} />}
        />
        <div className="flex h-11 w-full min-w-0 items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden no-scrollbar py-0.5">
            <Tabs value={tab} onValueChange={(next) => replaceParams({ bucket: next as TabKey })} className="shrink-0">
              <TabsList variant="pill" size="sm" aria-label="Lọc theo giai đoạn">
                {TABS.map((entry) => (
                  <TabsTrigger key={entry.key} value={entry.key}>
                    {entry.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <ListToolbarSearchToggle
            open={searchOpen}
            onOpenChange={setSearchOpen}
            label="Tìm cuộc họp"
            placeholder="Tìm tên cuộc họp…"
            value={search}
            onChange={setSearch}
            loading={isLoading && searching}
            slashShortcut
          />
        </div>
      </div>
      <h2 className="sr-only">{TITLES[tab]}</h2>

      {fetchError ? (
        <InlineAlert className="mt-2" actionLabel="Thử lại" onAction={() => void load(1)}>
          {fetchError}
        </InlineAlert>
      ) : isLoading && items.length === 0 ? (
        <div aria-busy className="flex flex-col pt-8">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex h-12 items-center gap-6 px-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3.5 w-1/6" />
              <Skeleton className="h-3.5 w-1/6 max-md:hidden" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          density="page"
          glyph={searching ? "no-results" : "calendar"}
          title={searching ? "Không có cuộc họp phù hợp" : tab === "upcoming" ? "Chưa có cuộc họp sắp diễn ra" : tab === "done" ? "Chưa có cuộc họp nào đã họp" : "Chưa có cuộc họp nào"}
          description={searching ? "Thử từ khóa khác hoặc xem giai đoạn khác." : "Cuộc họp Thầy/Cô tổ chức hoặc được mời sẽ hiện ở đây."}
          action={
            searching ? undefined : (
              <Button size="sm" onClick={() => setCreating(true)}>
                Tạo cuộc họp
              </Button>
            )
          }
        />
      ) : (
        <>
          <Table density="two-line" className="table-fixed" containerClassName="md:overflow-x-visible">
            <TableHeader className="md:sticky md:top-[88px] md:z-10">
              <TableRow className="h-8 border-b-0">
                <TableHead className="h-8 w-[48%] md:w-[38%]">Cuộc họp</TableHead>
                <TableHead className="h-8 w-[52%] md:w-[16%]">Thời gian</TableHead>
                <TableHead className="hidden h-8 w-[22%] md:table-cell">Người tổ chức</TableHead>
                <TableHead className="hidden h-8 w-[10%] lg:table-cell">Thành phần</TableHead>
                <TableHead className="hidden h-8 md:table-cell md:w-[24%] lg:w-[14%]">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => {
                const status = meetingStatus(row.status);
                const when = meetingWhen(row);
                const href = `/meetings/${encodeURIComponent(row.id)}`;
                return (
                  <TableRow key={row.id} interactive className="border-b-0" onClick={() => router.push(href)}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <Link href={href} className="truncate font-medium outline-none hover:underline focus-visible:underline" title={row.title}>
                          {row.title}
                        </Link>
                        {/* Không ghi "Chưa có địa điểm" lặp ở mọi hàng: chưa có thì tên đứng một mình */}
                        {row.location ? <span className="truncate text-xs text-muted-foreground">{row.location}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      <div className="flex flex-col">
                        <span className={cn("truncate", when.today && "font-medium")} title={when.fullDate}>
                          {when.day}
                        </span>
                        <span className="truncate text-xs text-muted-foreground" title={`${timeRange(row)} · ${status.label}`}>
                          <span className="max-md:hidden">{when.detail}</span>
                          {/* Điện thoại không có cột Trạng thái: ghi kèm dưới giờ, màu như cột đó. Chỉ giờ bắt đầu thôi (cả
                              khoảng giờ ở tooltip và trang chi tiết) để nhãn không bị cắt thành "Dự th…" (ảnh 390px 21/10/2026) */}
                          <span className="md:hidden">{when.start}</span>
                          <span className={cn("md:hidden", MEETING_STATUS_TONE_CLASS[status.tone])}> · {status.label}</span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {row.organizer ? (
                        <div className="flex min-w-0 flex-col">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <UserAvatar name={row.organizer.name} avatarUrl={row.organizer.avatarUrl} size="xs" />
                            <span className="truncate">{row.organizer.name}</span>
                          </span>
                          {row.unit?.name ? <span className="truncate pl-5.5 text-xs text-muted-foreground">{row.unit.name}</span> : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap tabular-nums lg:table-cell">
                      {row._count.participants > 0 ? `${row._count.participants} người` : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "hidden truncate whitespace-nowrap text-xs md:table-cell",
                        MEETING_STATUS_TONE_CLASS[status.tone]
                      )}
                    >
                      {status.label}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {items.length < total ? (
            <Button variant="ghost" size="sm" className="mt-2 self-start" loading={isLoadingMore} onClick={() => void load(page + 1)}>
              Xem thêm {total - items.length} cuộc họp
            </Button>
          ) : null}
        </>
      )}
      <CreateMeetingDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
