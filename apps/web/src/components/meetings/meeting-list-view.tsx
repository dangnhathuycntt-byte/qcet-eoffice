"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarX2 } from "lucide-react";
import { MEETING_BUCKETS, MEETING_SORT_FIELDS, type MeetingBucket, type MeetingSortField } from "@qcet/contracts/meeting";
import { getTodayIctDate } from "@qcet/shared/lib/academic-calendar";
import { formatCompactDate, formatDisplayDate, formatTime, formatWeekday } from "@qcet/shared/lib/format/date";
import { TaskIconDisplay, TaskIconExport, TaskIconLink } from "@qcet/shared/lib/icons/task-icons";
import { daysUntil } from "@/lib/format/relative-date";
import { downloadCsv, toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { useIsPhone } from "@/hooks/use-is-phone";
import { useListSelection } from "@/hooks/use-list-selection";
import { useLongPress } from "@/hooks/use-long-press";
import { ListPageCreateButton, ListPageHeader, ListPageTitle } from "@/components/workspace/list-page-header";
import { ActiveFilterBar, FilterSegmentChip } from "@/components/workspace/components/active-filter-breadcrumb";
import { FilterIconMonth, FilterIconStatus } from "@/components/dashboard/task-filter-icons";
import { CreateMeetingDialog } from "@/components/meetings/create-meeting-dialog";
import { MEETING_STATUS_TONE_CLASS, meetingStatus } from "@/components/meetings/meeting-status";
import { cancelMeeting, holdMeeting } from "@/components/meetings/meeting-client";
import { MeetingRowMenu, type MeetingMenuAnchor } from "@/components/meetings/meeting-row-menu";
import {
  DEFAULT_MEETING_DISPLAY,
  MEETING_CANCEL_NOTICE,
  MEETING_COLUMNS,
  MEETING_SORT_LABELS,
  MEETING_TIME_FILTERS,
  canCancelMeeting,
  defaultSortOrder,
  isDefaultMeetingDisplay,
  meetingCsvRows,
  meetingPath,
  meetingTimeRange,
  meetingTimeRangeLabel,
  parseTimeFilter,
  readMeetingDisplay,
  statusOptionsFor,
  writeMeetingDisplay,
  type MeetingDisplayPrefs,
  type MeetingRow,
  type MeetingTimeFilter,
} from "@/components/meetings/meeting-list-model";
import { ListToolbarFilterPopover, ListToolbarPopover, ListToolbarSearchToggle, type ListFilterCategory } from "@/components/ui/list-toolbar";
import { SelectionActionBar, SelectionActionButton, SelectionActionDivider } from "@/components/ui/selection-action-bar";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { PropertyToggleChip } from "@/components/ui/property-toggle-chip";
import { useFeedback } from "@/components/ui/feedback-layer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyValue,
  TableHead,
  TableHeader,
  TableRow,
  TableRowActions,
  TableRowSelector,
  TableSortButton,
  tableAriaSort,
  type TableSortDirection,
} from "@/components/ui/table";
import type { SelectionGroupPosition } from "@/lib/selection-group";
import {
  TaskIconDue,
  TaskIconStatusCancelled,
  TaskIconStatusDone,
  TaskIconStatusInProgress,
  TaskIconStatusNew,
  TaskIconStatusReview,
} from "@qcet/shared/lib/icons/task-icons";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";

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
    detail: near ? meetingTimeRangeLabel(row) : `${formatWeekday(row.startTime)} · ${meetingTimeRangeLabel(row)}`,
    /** Ô một dòng: `dd/MM` như cột Hạn của Nhiệm vụ (năm, thứ và khoảng giờ ở tooltip). */
    shortDay: near ?? formatCompactDate(row.startTime),
    start: formatTime(row.startTime, ""),
    fullDate: `${formatWeekday(row.startTime)}, ${formatDisplayDate(row.startTime)}`,
    today: diff === 0,
  };
}

/** Đang gõ chữ hoặc đang ở menu/hộp thoại/popover: phím tắt của trang (F) không chen vào. Ô tích của hàng không tính. */
const isTypingTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      "input:not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable='true'], [role='textbox'], [role='menu'], [role='dialog'], [role='alertdialog'], [role='listbox'], [data-list-toolbar-popover]"
    )
  );

/**
 * Cuộc họp (`/meetings`, mục "Cuộc họp" ở sidebar; thay trang Lịch công tác đã bỏ 20/10/2026): danh sách cuộc họp mình
 * tổ chức hoặc được mời. Khung theo trang Nhiệm vụ (người dùng yêu cầu "học nhiệm vụ" 20/10/2026, thêm thao tác như Nhiệm
 * vụ 21/10/2026): một thẻ cao hết màn hình, thanh tiêu đề 44px với "+ Tạo cuộc họp", hàng tab giai đoạn cùng tìm thu gọn,
 * bộ lọc (trạng thái, thời gian) và tùy chọn hiển thị (cột, sắp xếp); hai hàng này và tiêu đề cột dính khi cuộn. Hàng có ô
 * chọn (Shift chọn dải), menu thao tác (chuột phải, "⋯", phím Menu, nhấn giữ trên điện thoại) và thanh thao tác hàng loạt.
 * Các mục con ở sidebar và hàng tab cùng chọn `?bucket=`; tìm `?q=`, lọc `?status=` `?time=`. Phạm vi xem và thao tác được
 * phép do API quyết định (`meeting.read`, `availableActions` của từng hàng).
 */
export function MeetingListView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const feedback = useFeedback();
  const isPhone = useIsPhone();
  const tab = parseTab(searchParams.get("bucket"));
  const urlQuery = searchParams.get("q") ?? "";
  const statusParam = searchParams.get("status");
  const status = statusParam && statusOptionsFor(tab).includes(statusParam) ? statusParam : null;
  const timeFilter = parseTimeFilter(searchParams.get("time"));

  const [items, setItems] = React.useState<MeetingRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState(urlQuery);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [displayOpen, setDisplayOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  // Tùy chọn hiển thị đọc từ trình duyệt sau khi gắn (máy chủ không biết), danh sách chờ đọc xong mới tải để không tải hai lần
  const [display, setDisplay] = React.useState<MeetingDisplayPrefs | null>(null);
  const prefs = display ?? DEFAULT_MEETING_DISPLAY;
  const [menu, setMenu] = React.useState<{ meeting: MeetingRow | null; anchor: MeetingMenuAnchor | null; open: boolean }>({
    meeting: null,
    anchor: null,
    open: false,
  });
  const [cancelTargets, setCancelTargets] = React.useState<{ rows: MeetingRow[]; skipped: number } | null>(null);
  const [cancelling, setCancelling] = React.useState(false);
  const [starting, setStarting] = React.useState(false);

  React.useEffect(() => setDisplay(readMeetingDisplay()), []);
  const updateDisplay = React.useCallback((next: MeetingDisplayPrefs) => {
    setDisplay(next);
    writeMeetingDisplay(next);
  }, []);

  // Đổi mục ở sidebar hoặc tab thì ô tìm theo URL; gõ chữ chỉ cập nhật URL sau khi ngừng gõ (không nháy danh sách)
  React.useEffect(() => setSearch(urlQuery), [urlQuery]);
  const replaceParams = React.useCallback(
    (next: { bucket?: TabKey; q?: string; status?: string | null; time?: MeetingTimeFilter | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      const bucket = next.bucket ?? tab;
      if (bucket === "all") params.delete("bucket");
      else params.set("bucket", bucket);
      const q = (next.q ?? urlQuery).trim();
      if (q) params.set("q", q);
      else params.delete("q");
      // Trạng thái không có ở tab mới (Đã hủy khi sang Sắp diễn ra/Đã họp) thì bỏ, không để danh sách rỗng khó hiểu
      const nextStatus = next.status === undefined ? status : next.status;
      if (nextStatus && statusOptionsFor(bucket).includes(nextStatus)) params.set("status", nextStatus);
      else params.delete("status");
      const nextTime = next.time === undefined ? timeFilter : next.time;
      if (nextTime) params.set("time", nextTime);
      else params.delete("time");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, tab, urlQuery, status, timeFilter]
  );
  React.useEffect(() => {
    if (search.trim() === urlQuery.trim()) return;
    const timer = setTimeout(() => replaceParams({ q: search }), 300);
    return () => clearTimeout(timer);
  }, [search, urlQuery, replaceParams]);

  const sort = prefs.sort;
  const buildUrl = React.useCallback(
    (pageNumber: number) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(pageNumber) });
      if (tab !== "all") params.set("bucket", tab);
      if (urlQuery.trim()) params.set("search", urlQuery.trim());
      if (status) params.set("status", status);
      if (timeFilter) {
        const range = meetingTimeRange(timeFilter, getTodayIctDate());
        params.set("from", range.from);
        params.set("to", range.to);
      }
      if (sort) {
        params.set("sort", sort.field);
        params.set("order", sort.order);
      }
      return `/api/meetings?${params.toString()}`;
    },
    [tab, urlQuery, status, timeFilter, sort]
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

  const prefsReady = display !== null;
  React.useEffect(() => {
    if (!prefsReady) return;
    const controller = new AbortController();
    void load(1, controller.signal);
    return () => controller.abort();
  }, [load, prefsReady]);

  // Phím F mở bộ lọc như trang Nhiệm vụ (nút ghi "Bộ lọc (F)")
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      setFilterOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const ids = React.useMemo(() => items.map((row) => row.id), [items]);
  const selection = useListSelection(ids);
  const selectedRows = React.useMemo(() => items.filter((row) => selection.selected.has(row.id)), [items, selection.selected]);
  const cancellable = selectedRows.filter(canCancelMeeting);

  const openMenu = React.useCallback((meeting: MeetingRow, anchor: MeetingMenuAnchor) => setMenu({ meeting, anchor, open: true }), []);
  const openRow = React.useCallback((meeting: MeetingRow) => router.push(meetingPath(meeting.id)), [router]);

  const searching = urlQuery.trim().length > 0;
  const filterCount = (status ? 1 : 0) + (timeFilter ? 1 : 0);
  const clearFilters = () => replaceParams({ status: null, time: null });

  const categories: ListFilterCategory[] = [
    {
      id: "status",
      label: "Trạng thái",
      Icon: FilterIconStatus,
      options: [{ value: "ALL", label: "Tất cả" }, ...statusOptionsFor(tab).map((value) => ({ value, label: meetingStatus(value).label }))],
      value: status ?? "ALL",
      valueLabel: status ? meetingStatus(status).label : undefined,
      onSelect: (value) => replaceParams({ status: value === "ALL" ? null : value }),
    },
    {
      id: "time",
      label: "Thời gian",
      Icon: FilterIconMonth,
      options: [{ value: "ALL", label: "Mọi lúc" }, ...MEETING_TIME_FILTERS],
      value: timeFilter ?? "ALL",
      valueLabel: MEETING_TIME_FILTERS.find((option) => option.value === timeFilter)?.label,
      onSelect: (value) => replaceParams({ time: value === "ALL" ? null : parseTimeFilter(value) }),
    },
  ];

  const toggleSort = (field: MeetingSortField) =>
    updateDisplay({
      ...prefs,
      sort: sort?.field === field ? { field, order: sort.order === "asc" ? "desc" : "asc" } : { field, order: defaultSortOrder(field) },
    });

  const copyLinks = async (rows: MeetingRow[]) => {
    try {
      await navigator.clipboard.writeText(rows.map((row) => `${window.location.origin}${meetingPath(row.id)}`).join("\n"));
      feedback.notifySuccess(rows.length === 1 ? "Đã sao chép liên kết" : `Đã sao chép ${rows.length} liên kết`);
    } catch {
      feedback.notifyError("Không sao chép được liên kết");
    }
  };

  const exportRows = (rows: MeetingRow[]) => {
    downloadCsv(`cuoc-hop-${getTodayIctDate()}.csv`, toCsv(meetingCsvRows(rows)));
  };

  // Bắt đầu họp từ danh sách rồi mở trang cuộc họp (ghi âm, soạn biên bản ở đó), như nút cùng tên ở trang chi tiết
  const startMeeting = async (meeting: MeetingRow) => {
    if (starting) return;
    setStarting(true);
    try {
      await holdMeeting(meeting.id);
      feedback.notifySuccess("Đã chuyển cuộc họp sang Đã họp.");
      router.push(meetingPath(meeting.id));
    } catch (error) {
      feedback.notifyError(error instanceof Error ? error.message : "Chưa chuyển được cuộc họp sang Đã họp.");
    } finally {
      setStarting(false);
    }
  };

  // Hủy lần lượt từng cuộc (máy chủ kiểm quyền và trạng thái từng cuộc); lỗi ở cuộc nào thì dừng và báo, cuộc đã hủy vẫn giữ
  const confirmCancel = async () => {
    if (!cancelTargets) return;
    setCancelling(true);
    const done: string[] = [];
    let failure: string | null = null;
    for (const row of cancelTargets.rows) {
      try {
        await cancelMeeting(row.id);
        done.push(row.id);
      } catch (error) {
        failure = error instanceof Error ? error.message : "Chưa hủy được cuộc họp.";
        break;
      }
    }
    setCancelling(false);
    setCancelTargets(null);
    if (done.length > 0) {
      const cancelled = new Set(done);
      // Tab theo giai đoạn và bộ lọc trạng thái không chứa cuộc đã hủy: bỏ khỏi danh sách; tab Tất cả thì đổi nhãn tại chỗ
      const keep = tab === "all" && (!status || status === "CANCELLED");
      setItems((current) =>
        keep
          ? current.map((row) => (cancelled.has(row.id) ? { ...row, status: "CANCELLED" } : row))
          : current.filter((row) => !cancelled.has(row.id))
      );
      if (!keep) setTotal((current) => Math.max(0, current - done.length));
      selection.clear();
      router.refresh();
    }
    if (failure) {
      const left = cancelTargets.rows.length - done.length;
      feedback.notifyError(done.length > 0 ? `${failure} Đã hủy ${done.length} cuộc, còn ${left} cuộc chưa hủy.` : failure);
    } else {
      feedback.notifySuccess(done.length === 1 ? "Đã hủy cuộc họp." : `Đã hủy ${done.length} cuộc họp.`);
    }
  };

  const columns = prefs.columns;
  const showOrganizer = columns.organizer;
  const showParticipants = columns.participants;
  const showStatus = columns.status;

  return (
    <>
      {/* Thanh tiêu đề + hàng tab đứng yên khi cuộn (88px), tiêu đề cột dính ngay dưới như trang Nhiệm vụ */}
      <div className="relative z-20 flex flex-col md:sticky md:top-0 md:z-40 md:bg-card">
        <ListPageHeader
          title={<ListPageTitle>Cuộc họp</ListPageTitle>}
          action={<ListPageCreateButton label="Tạo cuộc họp" onClick={() => setCreating(true)} />}
        />
        <div className="flex h-11 w-full min-w-0 items-center gap-1">
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
          <ListToolbarFilterPopover
            open={filterOpen}
            onOpenChange={setFilterOpen}
            categories={categories}
            activeCount={filterCount}
            onClear={clearFilters}
            ariaLabel="Bộ lọc cuộc họp"
          />
          <MeetingDisplayPopover open={displayOpen} onOpenChange={setDisplayOpen} prefs={prefs} onChange={updateDisplay} />
        </div>
      </div>
      <h2 className="sr-only">{TITLES[tab]}</h2>

      {filterCount > 0 ? (
        <ActiveFilterBar onClearAll={clearFilters} filteredCount={isLoading ? undefined : total}>
          {status ? (
            <FilterSegmentChip
              icon={FilterIconStatus}
              label="Trạng thái"
              value={meetingStatus(status).label}
              onRemove={() => replaceParams({ status: null })}
              removeAriaLabel="Bỏ lọc trạng thái"
            />
          ) : null}
          {timeFilter ? (
            <FilterSegmentChip
              icon={FilterIconMonth}
              label="Thời gian"
              value={MEETING_TIME_FILTERS.find((option) => option.value === timeFilter)?.label}
              onRemove={() => replaceParams({ time: null })}
              removeAriaLabel="Bỏ lọc thời gian"
            />
          ) : null}
        </ActiveFilterBar>
      ) : null}

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
          glyph={searching || filterCount > 0 ? "no-results" : "calendar"}
          title={
            searching || filterCount > 0
              ? "Không có cuộc họp phù hợp"
              : tab === "upcoming"
                ? "Chưa có cuộc họp sắp diễn ra"
                : tab === "done"
                  ? "Chưa có cuộc họp nào đã họp"
                  : "Chưa có cuộc họp nào"
          }
          description={
            searching || filterCount > 0 ? "Thử từ khóa khác, bỏ bớt bộ lọc hoặc xem giai đoạn khác." : "Cuộc họp Thầy/Cô tổ chức hoặc được mời sẽ hiện ở đây."
          }
          action={
            filterCount > 0 ? (
              <Button size="sm" variant="secondary" onClick={clearFilters}>
                Xóa bộ lọc
              </Button>
            ) : searching ? undefined : (
              <Button size="sm" onClick={() => setCreating(true)}>
                Tạo cuộc họp
              </Button>
            )
          }
        />
      ) : (
        <>
          <Table density="two-line" className="table-fixed" containerClassName="@container md:overflow-x-visible">
            <TableHeader className="md:sticky md:top-[88px] md:z-10">
              <TableRow>
                <TableHead className={COLUMN_WIDTH.title} aria-sort={tableAriaSort(sortDirection(sort, "title"))}>
                  <div className="flex items-center gap-2">
                    <TableRowSelector
                      className="-my-1.5 max-md:hidden"
                      checked={selection.allSelected}
                      indeterminate={selection.someSelected}
                      onToggle={selection.toggleAll}
                      aria-label={selection.allSelected ? "Bỏ chọn tất cả cuộc họp đang hiện" : "Chọn tất cả cuộc họp đang hiện"}
                      title={selection.allSelected ? "Bỏ chọn tất cả (X)" : "Chọn tất cả (X)"}
                    />
                    <TableSortButton label="Cuộc họp" direction={sortDirection(sort, "title")} onSort={() => toggleSort("title")} />
                  </div>
                </TableHead>
                {columns.location ? <TableHead className={COLUMN_WIDTH.location}>Địa điểm</TableHead> : null}
                <TableHead className={COLUMN_WIDTH.time} aria-sort={tableAriaSort(sortDirection(sort, "startTime"))}>
                  <TableSortButton label="Thời gian" direction={sortDirection(sort, "startTime")} onSort={() => toggleSort("startTime")} />
                </TableHead>
                {showOrganizer ? <TableHead className={COLUMN_WIDTH.organizer}>Người tạo</TableHead> : null}
                {showParticipants ? <TableHead className={COLUMN_WIDTH.participants}>Thành phần</TableHead> : null}
                {showStatus ? <TableHead className={COLUMN_WIDTH.status}>Trạng thái</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <MeetingListRow
                  key={row.id}
                  row={row}
                  columns={columns}
                  selected={selection.selected.has(row.id)}
                  groupPosition={selection.groupPositions.get(row.id) ?? null}
                  menuTarget={menu.open && menu.meeting?.id === row.id}
                  isPhone={isPhone}
                  onToggle={selection.toggle}
                  onOpen={openRow}
                  onMenu={openMenu}
                />
              ))}
            </TableBody>
          </Table>
          {items.length < total ? (
            <Button variant="ghost" size="sm" className="mt-2 self-start" loading={isLoadingMore} onClick={() => void load(page + 1)}>
              Xem thêm {total - items.length} cuộc họp
            </Button>
          ) : null}
        </>
      )}

      <SelectionActionBar count={selection.count} total={total} noun="cuộc họp" onClear={selection.clear} busy={cancelling}>
        <SelectionActionButton onClick={() => void copyLinks(selectedRows)} title="Sao chép liên kết các cuộc họp đã chọn">
          <TaskIconLink className="size-4" />
          Sao chép liên kết
        </SelectionActionButton>
        <SelectionActionButton onClick={() => exportRows(selectedRows)} title="Tải bảng các cuộc họp đã chọn (mở bằng Excel)">
          <TaskIconExport className="size-4" />
          Xuất Excel
        </SelectionActionButton>
        {cancellable.length > 0 ? (
          <>
            <SelectionActionDivider />
            <SelectionActionButton
              tone="destructive"
              disabled={cancelling}
              onClick={() => setCancelTargets({ rows: cancellable, skipped: selectedRows.length - cancellable.length })}
              title="Hủy các cuộc họp chưa diễn ra trong số đã chọn"
            >
              <CalendarX2 className="size-4" />
              Hủy họp
            </SelectionActionButton>
          </>
        ) : null}
      </SelectionActionBar>

      <MeetingRowMenu
        meeting={menu.meeting}
        anchor={menu.anchor}
        open={menu.open}
        onOpenChange={(open) => setMenu((current) => ({ ...current, open }))}
        onStart={(meeting) => void startMeeting(meeting)}
        onCancel={(meeting) => setCancelTargets({ rows: [meeting], skipped: 0 })}
      />

      <DestructiveConfirmDialog
        isOpen={cancelTargets !== null}
        onClose={() => {
          if (!cancelling) setCancelTargets(null);
        }}
        onConfirm={confirmCancel}
        isConfirming={cancelling}
        title={cancelTargets && cancelTargets.rows.length > 1 ? `Hủy ${cancelTargets.rows.length} cuộc họp?` : "Hủy cuộc họp?"}
        entityLabel="Cuộc họp"
        entityName={cancelTargets?.rows.length === 1 ? cancelTargets.rows[0].title : undefined}
        description={
          cancelTargets?.rows.length === 1
            ? `sẽ chuyển sang Đã hủy. ${MEETING_CANCEL_NOTICE}`
            : `Các cuộc họp chuyển sang Đã hủy. ${MEETING_CANCEL_NOTICE}`
        }
        confirmLabel="Hủy cuộc họp"
      >
        {cancelTargets && cancelTargets.rows.length > 1 ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {cancelTargets.rows.slice(0, 5).map((row) => (
              <li key={row.id}>
                {/* Cắt chữ ở thẻ trong: cắt trên <li> thì mất dấu đầu dòng */}
                <span className="block truncate">{row.title}</span>
              </li>
            ))}
            {cancelTargets.rows.length > 5 ? <li>và {cancelTargets.rows.length - 5} cuộc khác</li> : null}
          </ul>
        ) : null}
        {cancelTargets && cancelTargets.skipped > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {cancelTargets.skipped} cuộc đã chọn giữ nguyên vì đã họp, đã hủy hoặc Thầy/Cô không phải người tạo, chủ tọa.
          </p>
        ) : null}
      </DestructiveConfirmDialog>

      <CreateMeetingDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

/**
 * Bề rộng cột như bảng Nhiệm vụ (`TASK_COLUMN_CLASS`; người dùng: bảng Nhiệm vụ "gọn đẹp", bảng này "dàn trải quá"
 * 21/10/2026): cột thuộc tính hẹp, cố định, dồn về bên phải; cột tên lấy phần còn lại. Khung bảng hẹp thì bớt cột theo bề
 * rộng khung (container query): dưới 560px như điện thoại (ô Thời gian hai dòng kèm trạng thái), địa điểm hết chỗ thì nằm
 * dưới tên.
 */
const COLUMN_WIDTH = {
  title: "@max-[560px]:w-[48%]",
  location: "w-[152px] @max-[1040px]:hidden",
  time: "w-[148px] @max-[560px]:w-[52%]",
  organizer: "w-[176px] @max-[760px]:hidden",
  participants: "w-[96px] @max-[940px]:hidden",
  status: "w-[184px] @max-[560px]:hidden",
} as const;

/** Icon trạng thái lấy từ bộ icon trạng thái của Nhiệm vụ, theo bậc của cuộc họp: dự thảo → đã mời → chờ biên bản → xong. */
const MEETING_STATUS_ICON: Record<string, (props: { className?: string }) => React.ReactElement> = {
  DRAFT_AGENDA: TaskIconStatusNew,
  INVITED: TaskIconStatusInProgress,
  HELD: TaskIconStatusReview,
  MINUTES_DRAFT: TaskIconStatusReview,
  MINUTES_CONFIRMED: TaskIconStatusDone,
  CANCELLED: TaskIconStatusCancelled,
};

function sortDirection(sort: MeetingDisplayPrefs["sort"], field: MeetingSortField): TableSortDirection {
  return sort?.field === field ? sort.order : null;
}

interface MeetingListRowProps {
  row: MeetingRow;
  columns: MeetingDisplayPrefs["columns"];
  selected: boolean;
  groupPosition: SelectionGroupPosition | null;
  menuTarget: boolean;
  isPhone: boolean;
  onToggle: (id: string, range?: boolean) => void;
  onOpen: (row: MeetingRow) => void;
  onMenu: (row: MeetingRow, anchor: MeetingMenuAnchor) => void;
}

/**
 * Một hàng cuộc họp. Bàn phím trên hàng (Tab tới hàng): Enter mở, Space/X chọn, ↑/↓ sang hàng kế, phím Menu hoặc Shift+F10
 * mở menu thao tác. Chuột: bấm mở, chuột phải mở menu tại con trỏ, ô chọn và "⋯" hiện khi rê. Điện thoại: nhấn giữ mở menu
 * dạng bottom sheet (không có ô chọn).
 */
const MeetingListRow = React.memo(function MeetingListRow({ row, columns, selected, groupPosition, menuTarget, isPhone, onToggle, onOpen, onMenu }: MeetingListRowProps) {
  const status = meetingStatus(row.status);
  const StatusIcon = MEETING_STATUS_ICON[row.status] ?? TaskIconStatusNew;
  const when = meetingWhen(row);
  const href = meetingPath(row.id);
  const longPress = useLongPress<HTMLTableRowElement>(isPhone ? (anchor) => onMenu(row, anchor) : undefined);

  const onKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      event.preventDefault();
      onMenu(row, event.currentTarget);
    } else if (event.key === "Enter") {
      event.preventDefault();
      onOpen(row);
    } else if (event.key === " " || event.key.toLowerCase() === "x") {
      event.preventDefault();
      onToggle(row.id, event.shiftKey);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const sibling = event.key === "ArrowDown" ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling;
      if (sibling instanceof HTMLElement) {
        event.preventDefault();
        sibling.focus();
      }
    }
  };

  return (
    <TableRow
      interactive
      selected={selected}
      groupPosition={groupPosition}
      menuTarget={menuTarget}
      tabIndex={0}
      data-meeting-id={row.id}
      onClick={(event) => {
        if (longPress.consumeClick()) return;
        // Shift/Ctrl/Cmd+bấm trên hàng là chọn (như bảng Nhiệm vụ), không mở trang
        if (!isPhone && (event.shiftKey || event.metaKey || event.ctrlKey) && !(event.target as Element).closest("a")) {
          onToggle(row.id, event.shiftKey);
          return;
        }
        onOpen(row);
      }}
      onKeyDown={onKeyDown}
      onContextMenu={
        isPhone
          ? undefined
          : (event) => {
              event.preventDefault();
              onMenu(row, { x: event.clientX, y: event.clientY });
            }
      }
      {...longPress.handlers}
    >
      <TableCell className="relative md:pr-11">
        <div className="flex min-w-0 items-center gap-2">
          <TableRowSelector
            className="max-md:hidden"
            checked={selected}
            tabIndex={-1}
            onToggle={(event) => onToggle(row.id, event.shiftKey)}
            aria-label={selected ? `Bỏ chọn cuộc họp ${row.title}` : `Chọn cuộc họp ${row.title}`}
            title={selected ? "Bỏ chọn (X)" : "Chọn (X)"}
          />
          <div className="flex min-w-0 flex-col">
            <Link
              href={href}
              tabIndex={-1}
              onClick={(event) => event.stopPropagation()}
              className="truncate font-medium outline-none transition-colors group-hover:text-primary"
              title={row.title}
            >
              {row.title}
            </Link>
            {/* Khung hẹp chưa có cột Địa điểm: ghi dưới tên. Không ghi "Chưa có địa điểm" lặp ở mọi hàng */}
            {columns.location && row.location ? <span className="truncate text-xs text-muted-foreground @min-[1040px]:hidden">{row.location}</span> : null}
          </div>
        </div>
        {isPhone ? null : (
          <TableRowActions
            label={`Thao tác cuộc họp ${row.title}`}
            open={menuTarget}
            tabIndex={-1}
            onOpen={(event) => onMenu(row, event.currentTarget)}
          />
        )}
      </TableCell>
      {columns.location ? (
        <TableCell className={COLUMN_WIDTH.location}>
          {row.location ? (
            <span className="block truncate text-xs text-muted-foreground" title={row.location}>
              {row.location}
            </span>
          ) : (
            <TableEmptyValue />
          )}
        </TableCell>
      ) : null}
      <TableCell className="whitespace-nowrap tabular-nums">
        {/* Máy tính: một dòng như cột Hạn của Nhiệm vụ (icon lịch, ngày · giờ), thứ trong tuần ở tooltip */}
        <span className="flex min-w-0 items-center gap-2 text-xs @max-[560px]:hidden" title={`${when.fullDate} · ${meetingTimeRangeLabel(row)}`}>
          <TaskIconDue aria-hidden className={cn("size-4 shrink-0", when.today ? "text-foreground" : "text-muted-foreground/70")} />
          <span className={cn("truncate", when.today ? "font-medium text-foreground" : "text-muted-foreground")}>
            {when.shortDay} · {when.start}
          </span>
        </span>
        {/* Khung dưới 560px không có cột Trạng thái: ngày ở dòng trên, giờ bắt đầu và trạng thái ở dòng dưới, màu như cột đó. Chỉ giờ
            bắt đầu thôi (cả khoảng giờ ở tooltip và trang chi tiết) để nhãn không bị cắt thành "Dự th…" (ảnh 390px 21/10/2026) */}
        <div className="flex flex-col @min-[560px]:hidden">
          <span className={cn("truncate", when.today && "font-medium")} title={when.fullDate}>
            {when.day}
          </span>
          <span className="truncate text-xs text-muted-foreground" title={`${meetingTimeRangeLabel(row)} · ${status.label}`}>
            {when.start}
            <span className={MEETING_STATUS_TONE_CLASS[status.tone]}> · {status.label}</span>
          </span>
        </div>
      </TableCell>
      {columns.organizer ? (
        <TableCell className={COLUMN_WIDTH.organizer}>
          {row.organizer ? (
            <span
              className="flex min-w-0 items-center gap-2"
              title={row.unit?.name ? `${row.organizer.name} · ${row.unit.name}` : row.organizer.name}
            >
              <UserAvatar name={row.organizer.name} avatarUrl={row.organizer.avatarUrl} size="xs" />
              <span className="min-w-0 truncate text-xs">{row.organizer.name}</span>
            </span>
          ) : (
            <TableEmptyValue />
          )}
        </TableCell>
      ) : null}
      {columns.participants ? (
        <TableCell className={cn("whitespace-nowrap text-xs tabular-nums", COLUMN_WIDTH.participants)}>
          {row._count.participants > 0 ? `${row._count.participants} người` : <TableEmptyValue />}
        </TableCell>
      ) : null}
      {columns.status ? (
        <TableCell className={cn("whitespace-nowrap", COLUMN_WIDTH.status)}>
          <span className="flex min-w-0 items-center gap-2 text-xs" title={status.label}>
            <StatusIcon className="size-4 shrink-0 text-foreground/70" />
            <span className={cn("truncate", status.tone === "warning" ? "text-warning" : "text-muted-foreground")}>{status.label}</span>
          </span>
        </TableCell>
      ) : null}
    </TableRow>
  );
});

const SORT_SELECT_OPTIONS = [
  { value: "default", label: "Mặc định" },
  ...MEETING_SORT_FIELDS.map((field) => ({ value: field, label: MEETING_SORT_LABELS[field] })),
];

/** Tùy chọn hiển thị (như "Hiển thị" của trang Nhiệm vụ): bật/tắt cột, sắp xếp, đặt lại; lưu ở trình duyệt. */
function MeetingDisplayPopover({
  open,
  onOpenChange,
  prefs,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: MeetingDisplayPrefs;
  onChange: (prefs: MeetingDisplayPrefs) => void;
}) {
  const customized = !isDefaultMeetingDisplay(prefs);
  return (
    <ListToolbarPopover
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Tùy chọn hiển thị"
      title="Hiển thị"
      sheetTitle="Hiển thị"
      width="w-64"
      flush
      scrollable={false}
      trigger={
        <>
          <TaskIconDisplay size={14} className="text-muted-foreground" />
          <span className="sr-only">Hiển thị</span>
          {customized ? <span aria-hidden className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" /> : null}
        </>
      }
    >
      <div className="space-y-2 px-3 py-2.5">
        <div className="text-xs font-medium text-muted-foreground">Thuộc tính hiển thị</div>
        <div className="flex flex-wrap gap-1">
          {MEETING_COLUMNS.map((column) => (
            <PropertyToggleChip
              key={column.id}
              variant="quiet"
              className={column.wide ? "max-md:hidden" : undefined}
              pressed={prefs.columns[column.id]}
              onPressedChange={(pressed) => onChange({ ...prefs, columns: { ...prefs.columns, [column.id]: pressed } })}
            >
              {column.label}
            </PropertyToggleChip>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border/50 px-3 py-2.5 text-xs">
        <span className="font-medium text-muted-foreground">Sắp xếp</span>
        <div className="flex items-center gap-1.5">
          {prefs.sort ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={prefs.sort.order === "asc" ? "Đang tăng dần, đổi sang giảm dần" : "Đang giảm dần, đổi sang tăng dần"}
              title={prefs.sort.order === "asc" ? "Tăng dần" : "Giảm dần"}
              onClick={() => prefs.sort && onChange({ ...prefs, sort: { ...prefs.sort, order: prefs.sort.order === "asc" ? "desc" : "asc" } })}
            >
              {prefs.sort.order === "asc" ? <ArrowUp /> : <ArrowDown />}
            </Button>
          ) : null}
          <Select
            compact
            aria-label="Tiêu chí sắp xếp"
            options={SORT_SELECT_OPTIONS}
            value={prefs.sort?.field ?? "default"}
            onValueChange={(next) => {
              if (!next) return;
              const field = (MEETING_SORT_FIELDS as readonly string[]).includes(next) ? (next as MeetingSortField) : null;
              onChange({ ...prefs, sort: field ? { field, order: defaultSortOrder(field) } : null });
            }}
            className="w-32 text-xs"
            positionerClassName="z-50"
          />
        </div>
      </div>
      <div className="flex items-center justify-end border-t border-border/50 px-2 py-1.5">
        <Button variant="ghost" size="xs" disabled={!customized} onClick={() => onChange(DEFAULT_MEETING_DISPLAY)}>
          Đặt lại
        </Button>
      </div>
    </ListToolbarPopover>
  );
}
