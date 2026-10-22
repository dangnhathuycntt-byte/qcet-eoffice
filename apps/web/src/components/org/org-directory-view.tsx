"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Download, X } from "lucide-react";
import {
  buildOrgDirectory,
  countPeople,
  directoryToCsv,
  filterDirectory,
  highlightQueryTokens,
  matchesUnit,
  type OrgDirectory,
  type OrgMember,
  type OrgUnit,
  type OrgUnitInput,
} from "@/lib/org/org-directory";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { ListToolbarFilterPopover, ListToolbarSearch, type ListFilterCategory } from "@/components/ui/list-toolbar";
import { ActiveFilterBar, FilterSegmentChip } from "@/components/workspace/components/active-filter-breadcrumb";
import { FilterIconDept, FilterIconLead } from "@/components/dashboard/task-filter-icons";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableEmptyValue, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StandardDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/ui/user-avatar";
import { focusRingClass } from "@/components/ui/focus-ring";
import { isInputElement, isInsideModal } from "@/hooks/use-keyboard-navigation";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

type Tab = "people" | "units";

/** Lỗi tải: hết phiên thì thử lại cũng vậy. */
interface LoadError {
  message: string;
  retry: boolean;
}

const ICT_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

/** `/api/departments` trả theo `legacyCompat`: mảng nằm ở `data` hoặc `departments`. */
function readUnits(json: unknown): OrgUnitInput[] | null {
  const body = json as { data?: unknown; departments?: unknown } | null;
  if (Array.isArray(body?.data)) return body.data as OrgUnitInput[];
  if (Array.isArray(body?.departments)) return body.departments as OrgUnitInput[];
  const nested = (body?.data as { data?: unknown } | undefined)?.data;
  return Array.isArray(nested) ? (nested as OrgUnitInput[]) : null;
}

const LINK_CLASS = cn("rounded-sm text-foreground underline-offset-2 hover:underline", focusRingClass);

/**
 * Bề rộng cột như `TASK_COLUMN_CLASS` của bảng Nhiệm vụ: cột thuộc tính cố định, cột tên lấy phần còn lại, khung danh sách
 * hẹp (panel chi tiết mở, điện thoại) thì bớt cột. Container query theo khung danh sách, không theo cả thẻ.
 * Cột bớt đi giữ chỗ trong lưới (`<col>` thu về 0, ô `cell-collapse`), không `display:none`: xem `cell-collapse` ở `globals.css`.
 */
const PEOPLE_COL_CLASS = { position: "w-[248px] @max-[640px]:w-0", phone: "w-[136px] @max-[820px]:w-0" } as const;
const PEOPLE_CELL_CLASS = { position: "@max-[640px]:cell-collapse", phone: "@max-[820px]:cell-collapse" } as const;
const UNIT_COL_CLASS = { leaders: "w-[248px] @max-[640px]:w-0", count: "w-[88px]" } as const;
const UNIT_CELL_CLASS = { leaders: "@max-[640px]:cell-collapse" } as const;

/** Panel chi tiết đứng cạnh danh sách từ `lg`; hẹp hơn thì mở hộp thoại (tấm đáy trên điện thoại). */
const WIDE_QUERY = "(min-width: 1024px)";
function subscribeWide(onChange: () => void) {
  const mql = window.matchMedia(WIDE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
function useIsWide() {
  return React.useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => false);
}

const personKey = (member: OrgMember) => `${member.unitId}:${member.id}`;
const ARROW_KEY_WIDGETS = '[role="menu"], [role="menubar"], [role="listbox"], [role="tablist"], [role="toolbar"], [role="radiogroup"], [role="tree"], [role="grid"], [role="slider"]';
const personTrigger = (key: string) => document.querySelector<HTMLElement>(`[data-person-key="${CSS.escape(key)}"] [data-person-trigger]`);

/**
 * Cơ cấu & Danh bạ (`/org`). Dựng lại 15/10/2026 theo khung một thẻ, tham chiếu trang Members/Teams của Linear:
 * tab Danh bạ (người theo từng đơn vị, lãnh đạo lên đầu) và tab Cơ cấu (đơn vị theo loại, kèm lãnh đạo và số nhân sự).
 * 22/10/2026 (người dùng gửi ảnh, bảo tra cứu bố cục): bảng tràn hết thẻ như Nhiệm vụ, tiêu đề cột và nhóm đơn vị dính khi cuộn,
 * chữ khớp in đậm, chi tiết người ở panel bên phải giữ ngữ cảnh danh sách (Primer "view" pattern, NN/g modal vs nonmodal),
 * j/k hoặc ↑/↓ đổi người như Linear, sao chép email/số ngay tại nút (Carbon: phản hồi tại chỗ).
 * Dữ liệu từ OrganizationalUnit + PositionAssignment đang hiệu lực; tab, đơn vị đang lọc và từ khóa giữ trên URL.
 */
export function OrgDirectoryView() {
  const searchParams = useSearchParams();
  const isWide = useIsWide();
  const [tab, setTab] = React.useState<Tab>(() => (searchParams.get("tab") === "units" ? "units" : "people"));
  const [query, setQuery] = React.useState(() => searchParams.get("q") ?? "");
  const [unitCode, setUnitCode] = React.useState<string | null>(() => searchParams.get("unit"));
  const [leadersOnly, setLeadersOnly] = React.useState(() => searchParams.get("leaders") === "1");
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [directory, setDirectory] = React.useState<OrgDirectory | null>(null);
  const [error, setError] = React.useState<LoadError | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    fetch("/api/departments?includePersonnel=true", { signal: ctrl.signal })
      .then(async (res) => {
        if (res.status === 401) {
          setError({ message: "Phiên đăng nhập đã hết hạn. Thầy/Cô đăng nhập lại để xem danh bạ.", retry: false });
          return;
        }
        const units = res.ok ? readUnits(await res.json()) : null;
        if (!units) {
          setError({ message: "Chưa tải được cơ cấu và danh bạ.", retry: true });
          return;
        }
        setDirectory(buildOrgDirectory(units));
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        setError({ message: "Mất kết nối khi tải danh bạ.", retry: true });
      });
    return () => ctrl.abort();
  }, [reloadKey]);

  // Giữ tab, đơn vị, bộ lọc và từ khóa trên URL để chia sẻ hoặc quay lại (từ khóa ghi sau khi ngừng gõ).
  // Dùng history.replaceState (Next đồng bộ với useSearchParams): router.replace tải lại trang từ máy chủ và mất trạng thái đang gõ
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const set = (key: string, value: string | null) => (value ? params.set(key, value) : params.delete(key));
      set("tab", tab === "units" ? "units" : null);
      set("unit", unitCode);
      set("leaders", leadersOnly ? "1" : null);
      set("q", query.trim() || null);
      const next = params.toString();
      if (next !== searchParams.toString()) window.history.replaceState(null, "", `/org${next ? `?${next}` : ""}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [tab, unitCode, leadersOnly, query, searchParams]);

  const unit = directory && unitCode ? directory.units.find((u) => u.code === unitCode) ?? null : null;
  const sections = React.useMemo(
    () => (directory ? filterDirectory(directory, { unitId: unit?.id ?? null, leadersOnly, query }) : []),
    [directory, unit, leadersOnly, query],
  );
  const visibleKeys = React.useMemo(() => sections.flatMap((s) => s.members.map(personKey)), [sections]);
  const selected = React.useMemo(() => {
    if (!directory || !selectedKey) return null;
    for (const u of directory.units) {
      const found = u.members.find((m) => personKey(m) === selectedKey);
      if (found) return found;
    }
    return null;
  }, [directory, selectedKey]);
  const filterCount = (unit ? 1 : 0) + (leadersOnly ? 1 : 0);
  const showPanel = isWide && tab === "people" && selected !== null;

  const clearFilters = () => {
    setUnitCode(null);
    setLeadersOnly(false);
  };

  const openUnit = (target: OrgUnit) => {
    setUnitCode(target.code);
    setQuery("");
    setTab("people");
  };

  const openPerson = React.useCallback(
    (key: string) => {
      setSelectedKey(key);
      if (!isWide) setDialogOpen(true);
    },
    [isWide],
  );

  // Đóng panel thì con trỏ về hàng đang chọn (nút Đóng biến mất cùng panel, không để con trỏ rơi về đầu trang)
  const closePanel = React.useCallback(() => {
    if (selectedKey) personTrigger(selectedKey)?.focus({ preventScroll: true });
    setSelectedKey(null);
  }, [selectedKey]);

  // j/k, ↑/↓ đổi người đang chọn (panel đi theo), Esc bỏ chọn. Con trỏ chuyển vào hàng để trình đọc màn hình đọc tên và Enter mở.
  // Bỏ qua khi con trỏ ở widget tự dùng phím mũi tên (tab, menu; popover lọc là role="dialog" đã loại ở trên). Không giới hạn theo vùng: bấm chỗ trống thì
  // con trỏ vào <main> (tabIndex -1) và j/k vẫn phải chạy
  React.useEffect(() => {
    if (tab !== "people") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isInputElement(event.target) || isInsideModal(event.target)) return;
      if ((event.target as HTMLElement | null)?.closest?.(ARROW_KEY_WIDGETS)) return;
      if (event.key === "Escape") {
        if (selectedKey) closePanel();
        return;
      }
      const delta = event.key === "j" || event.key === "ArrowDown" ? 1 : event.key === "k" || event.key === "ArrowUp" ? -1 : 0;
      if (!delta || visibleKeys.length === 0) return;
      event.preventDefault();
      const index = selectedKey ? visibleKeys.indexOf(selectedKey) : -1;
      const nextIndex = index === -1 ? (delta > 0 ? 0 : visibleKeys.length - 1) : Math.min(visibleKeys.length - 1, Math.max(0, index + delta));
      const nextKey = visibleKeys[nextIndex];
      setSelectedKey(nextKey);
      const trigger = personTrigger(nextKey);
      trigger?.focus({ preventScroll: true });
      trigger?.closest("tr")?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tab, selectedKey, visibleKeys, closePanel]);

  const exportCsv = () => {
    downloadCsv(`danh-ba-qcet-${unit ? unit.code.toLowerCase() : "toan-truong"}-${ICT_DATE.format(new Date())}.csv`, directoryToCsv(sections));
  };

  const categories: ListFilterCategory[] = directory
    ? [
        {
          id: "unit",
          label: "Đơn vị",
          Icon: FilterIconDept,
          options: [{ value: "ALL", label: "Tất cả đơn vị" }, ...directory.units.map((u) => ({ value: u.code, label: u.name }))],
          value: unit?.code ?? "ALL",
          valueLabel: unit?.name,
          onSelect: (value) => setUnitCode(value === "ALL" ? null : value),
        },
        {
          id: "leaders",
          label: "Chức vụ",
          Icon: FilterIconLead,
          options: [
            { value: "ALL", label: "Tất cả" },
            { value: "LEADERS", label: "Lãnh đạo" },
          ],
          value: leadersOnly ? "LEADERS" : "ALL",
          valueLabel: leadersOnly ? "Lãnh đạo" : undefined,
          onSelect: (value) => setLeadersOnly(value === "LEADERS"),
        },
      ]
    : [];

  return (
    <WorkspacePageCard
      title="Cơ cấu & Danh bạ"
      description={directory ? `${directory.units.length} đơn vị · ${directory.peopleCount} người đang giữ chức vụ` : "Đơn vị và cán bộ, giảng viên toàn trường"}
      hideTitleOnMobile
      hideDescriptionOnMobile
      className="max-w-none"
      actions={
        <>
          <ListToolbarSearch
            value={query}
            onChange={setQuery}
            placeholder={tab === "people" ? "Tìm người, chức vụ, email…" : "Tìm đơn vị, lãnh đạo…"}
            aria-label={tab === "people" ? "Tìm trong danh bạ" : "Tìm đơn vị"}
          />
          {tab === "people" && directory ? (
            <>
              <ListToolbarFilterPopover
                open={filterOpen}
                onOpenChange={setFilterOpen}
                categories={categories}
                activeCount={filterCount}
                onClear={clearFilters}
                ariaLabel="Lọc danh bạ"
              />
              <Button variant="toolbar" size="sm" className="max-sm:hidden" onClick={exportCsv} disabled={countPeople(sections) === 0}>
                <Download />
                Xuất CSV
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <div className="flex items-start gap-6">
        <div className="@container flex min-w-0 flex-1 flex-col gap-3 pb-6">
          <Tabs value={tab} onValueChange={(next) => setTab(next === "units" ? "units" : "people")}>
            <TabsList variant="pill" size="sm" aria-label="Chế độ xem">
              <TabsTrigger value="people">
                Danh bạ {directory ? <span className="tabular-nums text-muted-foreground">{directory.peopleCount}</span> : null}
              </TabsTrigger>
              <TabsTrigger value="units">
                Cơ cấu {directory ? <span className="tabular-nums text-muted-foreground">{directory.units.length}</span> : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {error ? (
            <InlineAlert actionLabel={error.retry ? "Thử lại" : undefined} onAction={error.retry ? () => setReloadKey((k) => k + 1) : undefined}>
              {error.message}
            </InlineAlert>
          ) : !directory ? (
            <div aria-busy className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : tab === "people" ? (
            <PeopleTab
              sections={sections}
              unit={unit}
              leadersOnly={leadersOnly}
              query={query}
              selectedKey={selectedKey}
              onClearUnit={() => setUnitCode(null)}
              onClearLeaders={() => setLeadersOnly(false)}
              onClearAll={() => {
                clearFilters();
                setQuery("");
              }}
              onOpenPerson={openPerson}
            />
          ) : (
            <UnitsTab directory={directory} query={query} onOpenUnit={openUnit} onClearQuery={() => setQuery("")} />
          )}
        </div>

        {showPanel && directory ? (
          <aside aria-label={`Liên hệ: ${selected.name}`} className="sticky top-0 w-80 shrink-0 self-start border-l border-border/60 pl-5">
            <div className="flex items-start gap-3 pb-4">
              <UserAvatar name={selected.name} avatarUrl={selected.avatarUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-compact font-semibold text-foreground">{selected.name}</p>
                {selected.position ? <p className="mt-0.5 text-xs text-muted-foreground">{selected.position}</p> : null}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-xs" aria-label="Đóng" onClick={closePanel}>
                    <X />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" shortcut="Esc">
                  Đóng
                </TooltipContent>
              </Tooltip>
            </div>
            <PersonDetails person={selected} directory={directory} onOpenUnit={openUnit} />
          </aside>
        ) : null}
      </div>

      <StandardDialog
        open={dialogOpen && !isWide && selected !== null}
        onOpenChange={(open) => !open && setDialogOpen(false)}
        title={selected?.name ?? ""}
        description={selected?.position ?? undefined}
        size="sm"
        compact
      >
        {selected && directory ? (
          <PersonDetails
            person={selected}
            directory={directory}
            onOpenUnit={(target) => {
              setDialogOpen(false);
              openUnit(target);
            }}
          />
        ) : null}
      </StandardDialog>
    </WorkspacePageCard>
  );
}

/** Phần khớp từ khóa in đậm (như Ctrl+K), không tô nền. */
function Highlight({ text, query }: { text: string; query: string }) {
  const segments = React.useMemo(() => highlightQueryTokens(text, query), [text, query]);
  return (
    <>
      {segments.map((segment, i) =>
        segment.match ? (
          <span key={i} className="font-semibold text-foreground">
            {segment.text}
          </span>
        ) : (
          <React.Fragment key={i}>{segment.text}</React.Fragment>
        ),
      )}
    </>
  );
}

/**
 * Dải tiêu đề nhóm như Linear (32px, bo góc, nền nhạt), dính dưới tiêu đề cột khi cuộn để biết đang ở đơn vị nào.
 * Tiêu đề cột dính ở `-top-4` để bù đệm `py-4` của thân thẻ (kẻo hàng lộ ra phía trên), nên dải nhóm dính ở `top-4`.
 */
function GroupBand({ label, count, colSpan }: { label: string; count: number; colSpan: number }) {
  return (
    <tr data-slot="group-header">
      <td colSpan={colSpan} className="sticky top-4 z-[1] bg-card px-0 py-px">
        <div className="flex h-8 items-center gap-2 rounded-md bg-muted px-2 text-xs">
          <span className="truncate font-medium text-foreground">{label}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{count}</span>
        </div>
      </td>
    </tr>
  );
}

function PeopleTab({
  sections,
  unit,
  leadersOnly,
  query,
  selectedKey,
  onClearUnit,
  onClearLeaders,
  onClearAll,
  onOpenPerson,
}: {
  sections: ReturnType<typeof filterDirectory>;
  unit: OrgUnit | null;
  leadersOnly: boolean;
  query: string;
  selectedKey: string | null;
  onClearUnit: () => void;
  onClearLeaders: () => void;
  onClearAll: () => void;
  onOpenPerson: (key: string) => void;
}) {
  const people = countPeople(sections);
  const hasFilters = Boolean(unit) || leadersOnly;

  return (
    <>
      {hasFilters ? (
        <ActiveFilterBar
          onClearAll={() => {
            onClearUnit();
            onClearLeaders();
          }}
          filteredCount={people}
        >
          {unit ? <FilterSegmentChip icon={FilterIconDept} label="Đơn vị" value={unit.name} onRemove={onClearUnit} removeAriaLabel="Bỏ lọc đơn vị" /> : null}
          {leadersOnly ? <FilterSegmentChip icon={FilterIconLead} label="Chức vụ" value="Lãnh đạo" onRemove={onClearLeaders} removeAriaLabel="Bỏ lọc chức vụ" /> : null}
        </ActiveFilterBar>
      ) : null}

      {unit?.description ? <p className="max-w-3xl text-pretty text-xs text-muted-foreground">{unit.description}</p> : null}

      {people === 0 ? (
        unit && !query.trim() && !leadersOnly ? (
          <EmptyState density="compact" title="Đơn vị chưa có nhân sự trong hệ thống" description="Chưa có ai đang giữ chức vụ tại đơn vị này." />
        ) : (
          <EmptyState
            density="compact"
            glyph="no-results"
            title="Không tìm thấy người phù hợp"
            description={query.trim() ? "Thử tên, chức vụ, email hoặc số điện thoại khác; gõ không dấu cũng được." : "Thử bỏ bớt bộ lọc."}
            action={
              <Button variant="outline" size="sm" onClick={onClearAll}>
                Xóa tìm kiếm và bộ lọc
              </Button>
            }
          />
        )
      ) : (
        <Table density="two-line" className="table-fixed" containerClassName="overflow-x-clip">
          <colgroup>
            <col />
            <col className={PEOPLE_COL_CLASS.position} />
            <col className={PEOPLE_COL_CLASS.phone} />
          </colgroup>
          <TableHeader className="sticky -top-4 z-[2]">
            <TableRow>
              <TableHead>Họ tên</TableHead>
              <TableHead className={PEOPLE_CELL_CLASS.position}>Chức vụ</TableHead>
              <TableHead className={PEOPLE_CELL_CLASS.phone}>Điện thoại</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sections.map((section) => (
              <React.Fragment key={section.unit.id}>
                <GroupBand label={section.unit.name} count={section.members.length} colSpan={3} />
                {section.members.map((member) => {
                  const key = personKey(member);
                  return (
                    <TableRow key={key} data-person-key={key} interactive current={key === selectedKey} onClick={() => onOpenPerson(key)}>
                      <TableCell>
                        <Pressable
                          data-person-trigger
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPerson(key);
                          }}
                          aria-haspopup="dialog"
                          className="flex w-full min-w-0 items-center gap-2.5 rounded-sm text-left"
                        >
                          <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="md" />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate font-medium text-foreground">
                              <Highlight text={member.name} query={query} />
                            </span>
                            {/* Khung hẹp không có cột Chức vụ: dòng phụ là chức vụ thay cho email */}
                            <span className="truncate text-xs text-muted-foreground @min-[640px]:hidden">
                              <Highlight text={member.position ?? member.email} query={query} />
                            </span>
                            <span className="hidden truncate text-xs text-muted-foreground @min-[640px]:inline">
                              <Highlight text={member.email} query={query} />
                            </span>
                          </span>
                        </Pressable>
                      </TableCell>
                      <TableCell
                        className={cn("truncate", PEOPLE_CELL_CLASS.position, member.isLeadership ? "text-foreground" : "text-muted-foreground")}
                        title={member.position ?? undefined}
                      >
                        {member.position ? <Highlight text={member.position} query={query} /> : <TableEmptyValue />}
                      </TableCell>
                      <TableCell className={cn("truncate tabular-nums", PEOPLE_CELL_CLASS.phone)}>
                        {member.phone ? (
                          <a href={`tel:${member.phone.replace(/[^\d+]/g, "")}`} onClick={(e) => e.stopPropagation()} className={LINK_CLASS}>
                            {member.phone}
                          </a>
                        ) : (
                          <TableEmptyValue />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

function UnitsTab({
  directory,
  query,
  onOpenUnit,
  onClearQuery,
}: {
  directory: OrgDirectory;
  query: string;
  onOpenUnit: (unit: OrgUnit) => void;
  onClearQuery: () => void;
}) {
  const groups = directory.groups
    .map((group) => ({ ...group, units: query.trim() ? group.units.filter((u) => matchesUnit(u, query)) : group.units }))
    .filter((group) => group.units.length > 0);

  if (groups.length === 0) {
    return (
      <EmptyState
        density="compact"
        glyph="no-results"
        title="Không tìm thấy đơn vị phù hợp"
        description="Thử tên đơn vị hoặc tên lãnh đạo khác; gõ không dấu cũng được."
        action={
          <Button variant="outline" size="sm" onClick={onClearQuery}>
            Xóa tìm kiếm
          </Button>
        }
      />
    );
  }

  return (
    <Table className="table-fixed" containerClassName="overflow-x-clip">
      <colgroup>
        <col />
        <col className={UNIT_COL_CLASS.leaders} />
        <col className={UNIT_COL_CLASS.count} />
      </colgroup>
      <TableHeader className="sticky -top-4 z-[2]">
        <TableRow>
          <TableHead>Đơn vị</TableHead>
          <TableHead className={UNIT_CELL_CLASS.leaders}>Lãnh đạo</TableHead>
          <TableHead className="text-right">Nhân sự</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <React.Fragment key={group.type}>
            <GroupBand label={group.label} count={group.units.length} colSpan={3} />
            {group.units.map((unit) => {
              const [first, ...rest] = unit.leaders;
              return (
                <TableRow key={unit.id} interactive onClick={() => onOpenUnit(unit)}>
                  <TableCell>
                    <Pressable
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenUnit(unit);
                      }}
                      aria-label={`Xem danh bạ ${unit.name}`}
                      className="flex w-full min-w-0 items-center rounded-sm text-left"
                      style={unit.depth > 0 ? { paddingLeft: unit.depth * 16 } : undefined}
                    >
                      <span className="line-clamp-2 text-pretty font-medium text-foreground">
                        <Highlight text={unit.name} query={query} />
                      </span>
                    </Pressable>
                  </TableCell>
                  <TableCell className={UNIT_CELL_CLASS.leaders}>
                    {first ? (
                      <span className="flex min-w-0 items-center gap-2" title={unit.leaders.map((l) => `${l.name} · ${l.position ?? "Lãnh đạo"}`).join("\n")}>
                        <UserAvatar name={first.name} avatarUrl={first.avatarUrl} size="xs" />
                        <span className="truncate">
                          <Highlight text={first.name} query={query} />
                        </span>
                        {rest.length > 0 ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">+{rest.length}</span> : null}
                      </span>
                    ) : (
                      <TableEmptyValue />
                    )}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", unit.members.length === 0 && "text-muted-foreground")}>
                    {unit.members.length}
                  </TableCell>
                </TableRow>
              );
            })}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

/** Nút sao chép cạnh email/số điện thoại: đổi thành dấu tích và báo "Đã sao chép" ngay tại nút, trình đọc màn hình đọc qua vùng live. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            className="shrink-0 text-muted-foreground"
            onClick={() => {
              void navigator.clipboard
                .writeText(value)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{copied ? "Đã sao chép" : label}</TooltipContent>
      </Tooltip>
      <span aria-live="polite" className="sr-only">
        {copied ? "Đã sao chép" : ""}
      </span>
    </>
  );
}

/** Liên hệ của một người: các đơn vị đang giữ chức vụ (bấm để xem danh bạ đơn vị đó), email, điện thoại. */
function PersonDetails({ person, directory, onOpenUnit }: { person: OrgMember; directory: OrgDirectory; onOpenUnit: (unit: OrgUnit) => void }) {
  const roles = React.useMemo(
    () => directory.units.flatMap((u) => u.members.filter((m) => m.id === person.id).map((m) => ({ unit: u, position: m.position }))),
    [person.id, directory],
  );
  return (
    <dl className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 text-compact">
      {/* Chức vụ đã ở đầu panel/hộp; giữ nhiều chức vụ thì ghi chức vụ dưới từng đơn vị */}
      <dt className="text-xs leading-5 text-muted-foreground">Đơn vị</dt>
      <dd className="flex flex-col gap-2">
        {roles.map(({ unit, position }) => (
          <span key={unit.id} className="flex flex-col items-start">
            <Pressable onClick={() => onOpenUnit(unit)} className="rounded-sm text-left leading-5 underline-offset-2 hover:underline">
              {unit.name}
            </Pressable>
            {roles.length > 1 && position ? <span className="text-xs text-muted-foreground">{position}</span> : null}
          </span>
        ))}
      </dd>
      <dt className="text-xs leading-7 text-muted-foreground">Email</dt>
      <dd className="flex min-w-0 items-center gap-1">
        {person.email ? (
          <>
            <a href={`mailto:${person.email}`} className={cn(LINK_CLASS, "min-w-0 truncate")} title={person.email}>
              {person.email}
            </a>
            <CopyButton value={person.email} label="Sao chép email" />
          </>
        ) : (
          <span className="leading-7 text-muted-foreground">Chưa cập nhật</span>
        )}
      </dd>
      <dt className="text-xs leading-7 text-muted-foreground">Điện thoại</dt>
      <dd className="flex min-w-0 items-center gap-1 tabular-nums">
        {person.phone ? (
          <>
            <a href={`tel:${person.phone.replace(/[^\d+]/g, "")}`} className={LINK_CLASS}>
              {person.phone}
            </a>
            <CopyButton value={person.phone} label="Sao chép số điện thoại" />
          </>
        ) : (
          <span className="leading-7 text-muted-foreground">Chưa cập nhật</span>
        )}
      </dd>
    </dl>
  );
}
