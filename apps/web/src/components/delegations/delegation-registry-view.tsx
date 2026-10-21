"use client";

import * as React from "react";
import { WorkspacePageCard } from "@/components/workspace/page-card";
import { ListToolbarSearch } from "@/components/ui/list-toolbar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { daysUntil } from "@/lib/format/relative-date";
import { cn } from "@/lib/utils";

type DelegationStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

interface DelegationAssignment {
  user: { name: string };
  unit: { name: string } | null;
  positionDefinition: { title: string } | null;
}

interface DelegationItem {
  id: string;
  status: DelegationStatus;
  grantorAssignment: DelegationAssignment;
  granteeAssignment: DelegationAssignment;
  action: string;
  resourceScope: string | null;
  validFrom: string;
  validUntil: string;
  sourceDocumentNumber: string | null;
  reason: string | null;
}

type StatusFilterKey = "ALL" | DelegationStatus;

const PAGE_SIZE = 20;

const STATUS_TABS: { key: StatusFilterKey; label: string }[] = [
  { key: "ACTIVE", label: "Có hiệu lực" },
  { key: "EXPIRED", label: "Hết hiệu lực" },
  { key: "REVOKED", label: "Đã thu hồi" },
  { key: "ALL", label: "Tất cả" },
];

const STATUS_LABELS: Record<DelegationStatus, string> = {
  ACTIVE: "Có hiệu lực",
  EXPIRED: "Hết hiệu lực",
  REVOKED: "Đã thu hồi",
};

/** Nhóm nghiệp vụ của quyền được ủy quyền (mã quyền dạng `task.approve`, `document.outgoing.sign`…). */
const ACTION_DOMAIN: Record<string, string> = {
  task: "Nhiệm vụ",
  document: "Văn bản",
  meeting: "Cuộc họp",
  dossier: "Hồ sơ",
};

const DATE = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });

function formatDate(raw: string | null | undefined) {
  if (!raw) return "—";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : DATE.format(d);
}

/** "01/10 – 15/10/2026" khi cùng năm (như bảng Delegation), khác năm thì ghi đủ hai ngày. */
function formatRange(from: string, until: string) {
  const a = formatDate(from);
  const b = formatDate(until);
  return a.slice(6) === b.slice(6) && a.length === 10 ? `${a.slice(0, 5)} – ${b}` : `${a} – ${b}`;
}

function assignmentLine(a: DelegationAssignment) {
  return [a.positionDefinition?.title, a.unit?.name].filter(Boolean).join(" · ");
}

/** Bỏ dấu để tìm không phân biệt dấu (gõ "nguyen" vẫn ra "Nguyễn"). */
function fold(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

/**
 * Ủy quyền tác nghiệp (`/delegations`, mục "Thêm" ở sidebar): danh sách ủy quyền xử lý thay mặt, chỉ để xem.
 * Dựng lại 15/10/2026 theo bảng Delegation: khung một thẻ, bảng một hàng mỗi ủy quyền, trạng thái bằng chữ.
 * Phạm vi xem do API quyết định (bản thân và đơn vị mình; Ban Giám hiệu xem toàn trường).
 */
export function DelegationRegistryView() {
  const [items, setItems] = React.useState<DelegationItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilterKey>("ACTIVE");
  const [search, setSearch] = React.useState("");
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  const fetchDelegations = React.useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setFetchError(null);
      try {
        // Luôn gửi `status`: thiếu tham số thì API chỉ trả ủy quyền đang có hiệu lực, kể cả khi chọn "Tất cả"
        const res = await fetch(`/api/delegations?status=${statusFilter}`, { signal });
        if (!res.ok) {
          setFetchError("Chưa tải được danh sách ủy quyền.");
          return;
        }
        const json = await res.json();
        // API trả thẳng mảng; vẫn nhận dạng bọc `{ data }` của các API cũ
        const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : null;
        if (list) setItems(list);
        else setFetchError("Chưa đọc được danh sách ủy quyền từ máy chủ.");
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") setFetchError("Mất kết nối khi tải danh sách ủy quyền.");
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [statusFilter]
  );

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetchDelegations(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchDelegations]);

  const filtered = React.useMemo(() => {
    const q = fold(search.trim());
    if (!q) return items;
    return items.filter((d) =>
      [d.grantorAssignment.user.name, d.granteeAssignment.user.name, d.action, d.resourceScope ?? "", d.sourceDocumentNumber ?? ""].some((field) =>
        fold(field).includes(q)
      )
    );
  }, [items, search]);

  return (
    <WorkspacePageCard
      title="Ủy quyền tác nghiệp"
      description="Ai ủy quyền cho ai xử lý thay, trong phạm vi nào và đến khi nào"
      hideTitleOnMobile
      className="max-w-5xl"
      actions={
        <ListToolbarSearch
          value={search}
          onChange={(value) => {
            setSearch(value);
            setVisibleCount(PAGE_SIZE);
          }}
          placeholder="Tìm người, phạm vi, căn cứ…"
          aria-label="Tìm ủy quyền"
        />
      }
    >
      <div className="empty-fill flex flex-col gap-4 pb-6">
        <Tabs
          value={statusFilter}
          onValueChange={(next) => {
            setStatusFilter(next as StatusFilterKey);
            setVisibleCount(PAGE_SIZE);
          }}
          className="max-w-full overflow-x-auto"
        >
          <TabsList variant="pill" size="sm" aria-label="Lọc theo trạng thái">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {fetchError ? (
          <InlineAlert actionLabel="Thử lại" onAction={() => fetchDelegations()}>
            {fetchError}
          </InlineAlert>
        ) : isLoading ? (
          <div aria-busy className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            role="status"
            density="page"
            glyph={search.trim() ? "no-results" : "directory"}
            title={search.trim() ? "Không có ủy quyền phù hợp" : statusFilter === "ACTIVE" ? "Chưa có ủy quyền nào đang có hiệu lực" : "Không có ủy quyền nào"}
            description={
              search.trim()
                ? "Thử từ khóa khác hoặc xem trạng thái khác."
                : "Ủy quyền liên quan tới Thầy/Cô hoặc đơn vị của Thầy/Cô sẽ hiện ở đây."
            }
          />
        ) : (
          <>
            <Table density="two-line" className="min-w-[760px] table-fixed">
              <TableHeader>
                <TableRow className="border-b border-border/60">
                  <TableHead className="w-[21%]">Người ủy quyền</TableHead>
                  <TableHead className="w-[21%]">Người được ủy quyền</TableHead>
                  <TableHead className="w-[19%]">Phạm vi</TableHead>
                  <TableHead className="w-[10%]">Căn cứ</TableHead>
                  <TableHead className="w-[15%]">Thời gian</TableHead>
                  <TableHead className="w-[14%]">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, visibleCount).map((d) => {
                  const left = daysUntil(d.validUntil);
                  const expiringSoon = d.status === "ACTIVE" && left !== null && left >= 0 && left <= 7;
                  return (
                    <TableRow key={d.id} className="border-b border-border/40">
                      <TableCell>
                        <PersonCell assignment={d.grantorAssignment} />
                      </TableCell>
                      <TableCell>
                        <PersonCell assignment={d.granteeAssignment} />
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 flex-col" title={d.resourceScope ? `${d.action} · ${d.resourceScope}` : d.action}>
                          <span className="truncate">
                            {ACTION_DOMAIN[d.action.split(".")[0]] ?? "Khác"}
                            {d.resourceScope ? ` · ${d.resourceScope}` : ""}
                          </span>
                          <span className="truncate font-mono text-xs text-muted-foreground">{d.action}</span>
                        </div>
                      </TableCell>
                      <TableCell className="truncate whitespace-nowrap tabular-nums" title={d.sourceDocumentNumber ?? undefined}>
                        {d.sourceDocumentNumber || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="truncate whitespace-nowrap text-xs tabular-nums">
                        {formatRange(d.validFrom, d.validUntil)}
                      </TableCell>
                      <TableCell className={cn("truncate whitespace-nowrap text-xs", d.status === "ACTIVE" ? (expiringSoon ? "text-warning" : "text-foreground") : "text-muted-foreground")}>
                        {expiringSoon ? (left === 0 ? "Hết hạn hôm nay" : `Hết hạn sau ${left} ngày`) : STATUS_LABELS[d.status]}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filtered.length > visibleCount ? (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                Xem thêm {filtered.length - visibleCount} ủy quyền
              </Button>
            ) : null}
          </>
        )}
      </div>
    </WorkspacePageCard>
  );
}

function PersonCell({ assignment }: { assignment: DelegationAssignment }) {
  const line = assignmentLine(assignment);
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate font-medium">{assignment.user.name}</span>
      {line ? <span className="truncate text-xs text-muted-foreground">{line}</span> : null}
    </div>
  );
}
