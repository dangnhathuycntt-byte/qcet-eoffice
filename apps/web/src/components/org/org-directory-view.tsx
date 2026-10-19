"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import {
  buildOrgDirectory,
  countPeople,
  directoryToCsv,
  filterDirectory,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StandardDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { UserAvatar } from "@/components/ui/user-avatar";
import { focusRingClass } from "@/components/ui/focus-ring";
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
 * Cơ cấu & Danh bạ (`/org`). Dựng lại 15/10/2026 theo khung một thẻ, tham chiếu trang Members/Teams của Linear:
 * tab Danh bạ (người theo từng đơn vị, lãnh đạo lên đầu) và tab Cơ cấu (đơn vị theo loại, kèm lãnh đạo và số nhân sự).
 * Dữ liệu từ OrganizationalUnit + PositionAssignment đang hiệu lực; tab, đơn vị đang lọc và từ khóa giữ trên URL.
 */
export function OrgDirectoryView() {
  const searchParams = useSearchParams();
  const [tab, setTab] = React.useState<Tab>(() => (searchParams.get("tab") === "units" ? "units" : "people"));
  const [query, setQuery] = React.useState(() => searchParams.get("q") ?? "");
  const [unitCode, setUnitCode] = React.useState<string | null>(() => searchParams.get("unit"));
  const [leadersOnly, setLeadersOnly] = React.useState(() => searchParams.get("leaders") === "1");
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [directory, setDirectory] = React.useState<OrgDirectory | null>(null);
  const [error, setError] = React.useState<LoadError | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [person, setPerson] = React.useState<OrgMember | null>(null);

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
  const filterCount = (unit ? 1 : 0) + (leadersOnly ? 1 : 0);

  const openUnit = (target: OrgUnit) => {
    setUnitCode(target.code);
    setQuery("");
    setTab("people");
  };

  const exportCsv = () => {
    const blob = new Blob(["﻿" + directoryToCsv(sections)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `danh-ba-qcet-${unit ? unit.code.toLowerCase() : "toan-truong"}-${ICT_DATE.format(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      className="max-w-5xl"
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
                onClear={() => {
                  setUnitCode(null);
                  setLeadersOnly(false);
                }}
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
      <div className="flex flex-col gap-3 pb-6">
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
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : tab === "people" ? (
          <PeopleTab
            sections={sections}
            unit={unit}
            leadersOnly={leadersOnly}
            query={query}
            onClearUnit={() => setUnitCode(null)}
            onClearLeaders={() => setLeadersOnly(false)}
            onOpenPerson={setPerson}
          />
        ) : (
          <UnitsTab directory={directory} query={query} onOpenUnit={openUnit} />
        )}
      </div>

      <PersonDialog person={person} directory={directory} onClose={() => setPerson(null)} />
    </WorkspacePageCard>
  );
}

/** Dải tiêu đề nhóm như Linear (32px, bo góc, nền nhạt), nằm trong bảng. */
function GroupBand({ label, count, colSpan }: { label: string; count: number; colSpan: number }) {
  return (
    <tr data-slot="group-header">
      <td colSpan={colSpan} className="px-0 py-px">
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
  onClearUnit,
  onClearLeaders,
  onOpenPerson,
}: {
  sections: ReturnType<typeof filterDirectory>;
  unit: OrgUnit | null;
  leadersOnly: boolean;
  query: string;
  onClearUnit: () => void;
  onClearLeaders: () => void;
  onOpenPerson: (member: OrgMember) => void;
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
            title="Không tìm thấy người phù hợp"
            description={query.trim() ? "Thử tên, chức vụ, email hoặc số điện thoại khác; gõ không dấu cũng được." : "Thử bỏ bớt bộ lọc."}
          />
        )
      ) : (
        <Table density="two-line" className="table-fixed">
          <TableHeader>
            <TableRow className="h-8 border-b border-border/60">
              <TableHead className="h-8 w-full @xl:w-[46%]">Họ tên</TableHead>
              <TableHead className="hidden h-8 @xl:table-cell @xl:w-[36%]">Chức vụ</TableHead>
              <TableHead className="hidden h-8 @xl:table-cell @xl:w-[18%]">Điện thoại</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sections.map((section) => (
              <React.Fragment key={section.unit.id}>
                <GroupBand label={section.unit.name} count={section.members.length} colSpan={3} />
                {section.members.map((member) => (
                  <TableRow key={`${section.unit.id}:${member.id}`} interactive className="border-b border-border/40" onClick={() => onOpenPerson(member)}>
                    <TableCell>
                      <Pressable
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPerson(member);
                        }}
                        aria-haspopup="dialog"
                        className="flex w-full min-w-0 items-center gap-2.5 rounded-sm text-left"
                      >
                        <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="md" />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">{member.name}</span>
                          <span className="truncate text-xs text-muted-foreground @xl:hidden">{member.position ?? member.email}</span>
                          <span className="hidden truncate text-xs text-muted-foreground @xl:inline">{member.email}</span>
                        </span>
                      </Pressable>
                    </TableCell>
                    <TableCell className={cn("hidden truncate @xl:table-cell", member.isLeadership ? "text-foreground" : "text-muted-foreground")} title={member.position ?? undefined}>
                      {member.position ?? "—"}
                    </TableCell>
                    <TableCell className="hidden truncate tabular-nums @xl:table-cell">
                      {member.phone ? (
                        <a href={`tel:${member.phone.replace(/[^\d+]/g, "")}`} onClick={(e) => e.stopPropagation()} className={LINK_CLASS}>
                          {member.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}

function UnitsTab({ directory, query, onOpenUnit }: { directory: OrgDirectory; query: string; onOpenUnit: (unit: OrgUnit) => void }) {
  const groups = directory.groups
    .map((group) => ({ ...group, units: query.trim() ? group.units.filter((u) => matchesUnit(u, query)) : group.units }))
    .filter((group) => group.units.length > 0);

  if (groups.length === 0) {
    return <EmptyState density="compact" title="Không tìm thấy đơn vị phù hợp" description="Thử tên đơn vị hoặc tên lãnh đạo khác; gõ không dấu cũng được." />;
  }

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow className="h-8 border-b border-border/60">
          <TableHead className="h-8 w-full @xl:w-[46%]">Đơn vị</TableHead>
          <TableHead className="hidden h-8 @xl:table-cell @xl:w-[40%]">Lãnh đạo</TableHead>
          <TableHead className="h-8 w-20 text-right @xl:w-[14%]">Nhân sự</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <React.Fragment key={group.type}>
            <GroupBand label={group.label} count={group.units.length} colSpan={3} />
            {group.units.map((unit) => {
              const [first, ...rest] = unit.leaders;
              return (
                <TableRow key={unit.id} interactive className="border-b border-border/40" onClick={() => onOpenUnit(unit)}>
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
                      <span className="line-clamp-2 text-pretty font-medium text-foreground">{unit.name}</span>
                    </Pressable>
                  </TableCell>
                  <TableCell className="hidden @xl:table-cell">
                    {first ? (
                      <span className="flex min-w-0 items-center gap-2" title={unit.leaders.map((l) => `${l.name} · ${l.position ?? "Lãnh đạo"}`).join("\n")}>
                        <UserAvatar name={first.name} avatarUrl={first.avatarUrl} size="xs" />
                        <span className="truncate">{first.name}</span>
                        {rest.length > 0 ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">+{rest.length}</span> : null}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", unit.members.length === 0 && "text-muted-foreground")}>{unit.members.length}</TableCell>
                </TableRow>
              );
            })}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

/** Thông tin liên hệ của một người: mọi chức vụ đang giữ (có thể ở nhiều đơn vị), email, điện thoại. */
function PersonDialog({ person, directory, onClose }: { person: OrgMember | null; directory: OrgDirectory | null; onClose: () => void }) {
  // Giữ người vừa xem trong lúc hộp thoại đóng dần, để tiêu đề và nội dung không chớp trống
  const [shown, setShown] = React.useState(person);
  if (person && person !== shown) setShown(person);
  const roles = React.useMemo(
    () => (shown && directory ? directory.units.flatMap((u) => u.members.filter((m) => m.id === shown.id)) : []),
    [shown, directory],
  );
  return (
    <StandardDialog open={person !== null} onOpenChange={(open) => !open && onClose()} title={shown?.name ?? ""} size="sm" compact>
      {shown ? (
        <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2 text-compact">
          <dt className="text-xs leading-5 text-muted-foreground">Chức vụ</dt>
          <dd className="flex flex-col gap-1">
            {roles.map((role) => (
              <span key={role.unitId}>
                {role.position ?? "—"} <span className="text-muted-foreground">· {role.unitName}</span>
              </span>
            ))}
          </dd>
          <dt className="text-xs leading-5 text-muted-foreground">Email</dt>
          <dd className="min-w-0 break-all">
            {shown.email ? (
              <a href={`mailto:${shown.email}`} className={LINK_CLASS}>
                {shown.email}
              </a>
            ) : (
              <span className="text-muted-foreground">Chưa cập nhật</span>
            )}
          </dd>
          <dt className="text-xs leading-5 text-muted-foreground">Điện thoại</dt>
          <dd className="tabular-nums">
            {shown.phone ? (
              <a href={`tel:${shown.phone.replace(/[^\d+]/g, "")}`} className={LINK_CLASS}>
                {shown.phone}
              </a>
            ) : (
              <span className="text-muted-foreground">Chưa cập nhật</span>
            )}
          </dd>
        </dl>
      ) : null}
    </StandardDialog>
  );
}
