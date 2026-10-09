"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { OfficialDocument, DocumentType, DocumentUrgency, DocumentStatus, DocumentItem } from "@/types/document";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDocumentUrlFilters } from "@/hooks/use-document-url-filters";
import { useDocumentPane } from "@/hooks/use-document-pane";
import { PaneResizeHandle } from "@/components/ui/pane-resize-handle";
import { readScroll, writeScroll } from "@/lib/documents/list-scroll-memory";
import { PANE_DEFAULT, PANE_MAX, PANE_MIN, nextWidthForKey, parseStoredPaneWidth, resolvePaneLayout, type PaneMode } from "@/lib/documents/document-pane-layout";
import { DocumentLedgerToolbar, DocumentLedgerTable, DocumentCardList, DocumentBulkToolbar, DEFAULT_LEDGER_COLUMNS, getLedgerEmptyCopy, type LedgerColumnVisibility } from "./registry";
import { useDepartmentList } from "@/hooks/use-department-list";
import { DocumentQuickView } from "./workspace/document-quick-view";
import { CreateDocumentModal } from "./create-document-modal";
import { DocumentQuickEntryModal } from "./document-quick-entry-modal";
import { DigitalSignatureDialog } from "./digital-signature-dialog";
import { TaskPaginationBar } from "@/components/tasks/table/components/task-pagination-bar";
import { InboundDocumentFeatureGuide } from "@/components/feature-guide/feature-guide";

const PANE_WIDTH_KEY = "qcet_document_pane_width";

interface ApiDoc {
  id: string; type: string; urgency: string; status: string;
  originalNumber?: string | null; documentNumber?: string | null;
  registrationNumber?: number | null; documentYear?: number | null;
  issuedDate?: string | Date | null; registeredDate?: string | Date | null; receivedDate?: string | null;
  issuingAuthority?: string | null; signatory?: string | null; signerName?: string | null; signerTitle?: string | null;
  summary?: string | null; workflowStatus?: string | null; dueDate?: string | Date | null; leadUnitName?: string | null; leadDepartment?: string | null; leadDepartmentName?: string | null; draftingDeptName?: string | null;
  linkedTaskId?: string | null;
  linkedTask?: { id: string; code?: string; title: string; status: string; progressPercent: number; dueDate?: string | null } | null;
  signatures?: Array<unknown> | null;
  attachments?: Array<{ id?: string; fileName: string; fileSize?: number; fileUrl?: string; mimeType?: string }> | null;
  fileAttachment?: { name: string; size: string; url?: string } | null;
}

function mapApiDocumentToOfficial(item: ApiDoc): OfficialDocument {
  const typeMap: Record<string, DocumentType> = { VAN_BAN_DEN: "inbox", inbox: "inbox", VAN_BAN_DI: "outbox", outbox: "outbox", TO_TRINH_NOI_BO: "submission", submission: "submission" };
  const urgencyMap: Record<string, DocumentUrgency> = { HOA_TOC: "flash", flash: "flash", THUONG_KHAN: "top_urgent", top_urgent: "top_urgent", KHAN: "urgent", urgent: "urgent", THUONG: "normal", normal: "normal" };
  const statusMap: Record<string, DocumentStatus> = { CHO_PHAN_CONG: "pending_assignment", pending_assignment: "pending_assignment", DANG_XU_LY: "processing", processing: "processing", CHO_PHE_DUYET: "approved", approved: "approved", DA_HOAN_THANH: "completed", LUU_THEO_DOI: "completed", completed: "completed" };

  let status = statusMap[item.status] || "pending_assignment";
  if (item.linkedTaskId && status === "processing") status = "delegated";

  const formatDate = (val?: string | Date | null) => val ? (typeof val === "string" ? val.split("T")[0] : new Date(val).toISOString().split("T")[0]) : "";
  const docNumber = item.originalNumber || item.documentNumber || (item.registrationNumber ? `${item.registrationNumber}/${item.documentYear || new Date().getFullYear()}` : item.id);
  const fileAttachment = item.attachments && item.attachments.length > 0 ? {
    name: item.attachments[0].fileName,
    size: item.attachments[0].fileSize != null ? `${Math.round(item.attachments[0].fileSize / 1024)} KB` : "Chưa rõ dung lượng",
    url: item.attachments[0].fileUrl,
  } : item.fileAttachment || undefined;

  return {
    id: item.id,
    type: typeMap[item.type] || "inbox",
    documentNumber: docNumber,
    registrationNumber: item.registrationNumber ?? undefined,
    documentYear: item.documentYear ?? undefined,
    dueDate: formatDate(item.dueDate) || undefined,
    workflowStatus: item.workflowStatus || undefined,
    issuedDate: formatDate(item.issuedDate),
    receivedDate: formatDate(item.registeredDate) || item.receivedDate || undefined,
    issuingAuthority: item.issuingAuthority || "",
    summary: item.summary || "",
    urgency: urgencyMap[item.urgency] || "normal",
    status,
    leadDepartment: item.leadUnitName || item.leadDepartmentName || item.leadDepartment || item.draftingDeptName || "Chưa phân công",
    signatory: item.signerName ? `${item.signerName}${item.signerTitle ? ` (${item.signerTitle})` : ""}` : item.signatory || "",
    linkedTaskId: item.linkedTaskId || undefined,
    linkedTaskTitle: item.linkedTask?.title || (item.linkedTaskId ? `Nhiệm vụ #${item.linkedTaskId}` : undefined),
    linkedTaskStatus: item.linkedTask?.status,
    linkedTaskProgressPercent: item.linkedTask?.progressPercent,
    linkedTaskDueDate: item.linkedTask?.dueDate,
    fileAttachment,
    attachments: item.attachments?.map((a, i) => ({
      id: a.id || `att-${i}`,
      name: a.fileName,
      url: a.fileUrl,
      sizeBytes: a.fileSize ?? undefined,
      mimeType: a.mimeType,
    })),
    signatures: item.signatures || undefined,
  };
}

export function DocumentRegistryView() {
  const router = useRouter();
  const pane = useDocumentPane();

  // URL state management
  const { filters, isResultFiltered, setFilter, setFilters, resetFilters, searchInputValue, setSearchInputValue } = useDocumentUrlFilters();
  // Đơn vị chủ trì: cùng nguồn danh sách đơn vị đang dùng ở form vào sổ (mọi người dùng đã đăng nhập đọc được)
  const { departments, isLoading: isDepartmentsLoading } = useDepartmentList();

  // Data & Pagination state
  const [documents, setDocuments] = React.useState<OfficialDocument[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState<boolean>(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  // Cột tùy chọn chỉ là trình bày, không đi vào query; giữ theo vòng đời trang
  const [visibleColumns, setVisibleColumns] = React.useState<LedgerColumnVisibility>(DEFAULT_LEDGER_COLUMNS);


  // Modals & Dialogs
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isQuickEntryOpen, setIsQuickEntryOpen] = React.useState(false);
  const [signatureDoc, setSignatureDoc] = React.useState<OfficialDocument | null>(null);
  const [isSignatureOpen, setIsSignatureOpen] = React.useState(false);

  // Quick View: bố cục theo độ rộng thực của vùng workspace (danh sách + pane)
  const workspaceRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [workspaceWidth, setWorkspaceWidth] = React.useState(0);
  const [preferredWidth, setPreferredWidth] = React.useState(PANE_DEFAULT);
  const modeRef = React.useRef<PaneMode | undefined>(undefined);
  const [focusToken, setFocusToken] = React.useState(0);

  // Danh sách chỉ tải lại khi bộ lọc thật sự đổi: mở/đóng Quick View (docId, file) đổi URL nhưng không được làm danh sách nháy
  const filtersKey = JSON.stringify(filters);
  const filtersRef = React.useRef(filters);
  filtersRef.current = filters;

  // Fetch documents matching filters
  const fetchDocuments = React.useCallback(async (signal?: AbortSignal) => {
    const filters = filtersRef.current;
    setIsLoading(true);
    setFetchError(null);
    try {
      const p = new URLSearchParams();
      if (filters.type === "inbox") p.set("type", "VAN_BAN_DEN");
      else if (filters.type === "outbox") p.set("type", "VAN_BAN_DI");
      else if (filters.type === "submission") p.set("type", "TO_TRINH_NOI_BO");

      if (filters.bucket) p.set("bucket", filters.bucket);
      if (filters.search.trim()) p.set("search", filters.search.trim());

      const uMap: Record<string, string> = { flash: "HOA_TOC", top_urgent: "THUONG_KHAN", urgent: "KHAN", normal: "THUONG" };
      if (filters.urgency && filters.urgency !== "ALL") p.set("urgency", uMap[filters.urgency] || filters.urgency);

      const sMap: Record<string, string> = { pending_assignment: "CHO_PHAN_CONG", processing: "DANG_XU_LY", approved: "CHO_PHE_DUYET", completed: "DA_HOAN_THANH" };
      if (filters.status && filters.status !== "ALL") p.set("status", sMap[filters.status] || filters.status);

      if (filters.leadUnitId && filters.leadUnitId !== "ALL") p.set("leadUnitId", filters.leadUnitId);
      if (filters.documentYear) p.set("documentYear", String(filters.documentYear));
      p.set("page", String(filters.page));
      p.set("pageSize", String(filters.pageSize));

      const res = await fetch(`/api/documents?${p.toString()}`, { signal });
      if (res.ok) {
        const json = await res.json();
        const raw = Array.isArray(json.data) ? json.data : Array.isArray(json.documents) ? json.documents : [];
        const mapped = raw.map(mapApiDocumentToOfficial);
        setDocuments(mapped);
        setTotalCount(json.total ?? mapped.length);
      } else {
        setFetchError("Không thể tải danh sách văn bản từ máy chủ");
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "AbortError") {
        console.error("Fetch error:", err);
        setFetchError("Lỗi kết nối máy chủ khi tải danh sách văn bản");
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetchDocuments(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchDocuments]);

  React.useEffect(() => {
    try {
      setPreferredWidth(parseStoredPaneWidth(localStorage.getItem(PANE_WIDTH_KEY)));
    } catch {
      // Không đọc được lựa chọn cũ: dùng độ rộng mặc định
    }
  }, []);
  React.useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWorkspaceWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const layout = resolvePaneLayout(workspaceWidth, preferredWidth, modeRef.current);
  modeRef.current = workspaceWidth > 0 ? layout.mode : undefined;
  const handleResize = React.useCallback((width: number) => {
    const next = Math.min(PANE_MAX, Math.max(PANE_MIN, Math.round(width)));
    setPreferredWidth(next);
    try {
      localStorage.setItem(PANE_WIDTH_KEY, String(next));
    } catch {
      // Không lưu được: vẫn dùng trong phiên này
    }
  }, []);

  // Đóng pane (nút, Esc hoặc Back): trả focus về dòng vừa xem nếu còn trong danh sách
  const lastDocIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const previous = lastDocIdRef.current;
    lastDocIdRef.current = pane.docId;
    if (previous && !pane.docId) {
      const row = listRef.current?.querySelector<HTMLElement>(`[data-doc-id="${CSS.escape(previous)}"]`);
      (row ?? listRef.current)?.focus();
    }
  }, [pane.docId]);

  // Vị trí cuộn của danh sách: nhớ theo bộ lọc, khôi phục sau lần tải đầu (quay lại từ Full Page)
  const scrollRestoredFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      try {
        writeScroll(sessionStorage, filtersKey, el.scrollTop);
      } catch {
        // sessionStorage không dùng được
      }
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(save, 80);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
    };
  }, [filtersKey]);
  React.useEffect(() => {
    if (isLoading || fetchError || documents.length === 0) return;
    if (scrollRestoredFor.current === filtersKey) return;
    scrollRestoredFor.current = filtersKey;
    const el = listRef.current;
    if (!el) return;
    let saved = 0;
    try {
      saved = readScroll(sessionStorage, filtersKey);
    } catch {
      // không có vị trí đã lưu
    }
    el.scrollTop = saved;
    // Quick View đang mở: đảm bảo dòng của văn bản đó nằm trong tầm nhìn
    if (pane.docId) {
      el.querySelector<HTMLElement>(`[data-doc-id="${CSS.escape(pane.docId)}"]`)?.scrollIntoView({ block: "nearest" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, fetchError, documents, filtersKey]);

  const paneDoc = pane.docId ? documents.find((d) => d.id === pane.docId) ?? null : null;

  // Chọn nhiều chỉ áp dụng cho các dòng đang xem: đổi loại, bộ lọc, từ khóa hoặc trang thì bỏ chọn
  const listKey = [filters.type, filters.search, filters.status, filters.bucket, filters.urgency, filters.leadUnitId, filters.documentYear ?? "", filters.page, filters.pageSize].join("|");
  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [listKey]);
  React.useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(documents.map((d) => d.id));
      const next = new Set(Array.from(prev).filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [documents]);

  // Multi-selection handlers
  const handleToggleSelect = React.useCallback((docId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  }, []);
  const handleSelectAll = React.useCallback(() => {
    setSelectedIds(selectedIds.size === documents.length ? new Set() : new Set(documents.map((d) => d.id)));
  }, [selectedIds.size, documents]);
  const handleClearSelection = React.useCallback(() => setSelectedIds(new Set()), []);

  // Mở Quick View từ danh sách (click dòng / Enter): focus về nút Đóng của pane
  const handleOpenDetail = React.useCallback((doc: OfficialDocument) => {
    pane.open(doc.id);
    setFocusToken((n) => n + 1);
  }, [pane]);

  // Chuyển dòng bằng bàn phím trong danh sách: pane đang mở thì đổi văn bản theo, focus ở lại danh sách
  const handleNavigate = React.useCallback((doc: OfficialDocument) => {
    if (pane.docId) pane.switchDocument(doc.id);
  }, [pane]);

  // Excel / CSV Export handler (NĐ 30/2020)
  const handleExportExcel = React.useCallback(async () => {
    try {
      setIsExporting(true);
      const p = new URLSearchParams();
      if (filters.type === "inbox") p.set("type", "VAN_BAN_DEN");
      else if (filters.type === "outbox") p.set("type", "VAN_BAN_DI");
      else if (filters.type === "submission") p.set("type", "TO_TRINH_NOI_BO");
      if (filters.status !== "ALL" && filters.status !== "") p.set("status", filters.status);
      if (filters.urgency !== "ALL" && filters.urgency !== "") p.set("urgency", filters.urgency);
      if (filters.leadUnitId && filters.leadUnitId !== "ALL") p.set("leadUnitId", filters.leadUnitId);
      if (filters.documentYear) p.set("documentYear", String(filters.documentYear));
      if (filters.search) p.set("search", filters.search);

      const res = await fetch(`/api/documents/export-excel?${p.toString()}`);
      if (!res.ok) throw new Error("Không thể xuất sổ văn bản");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `so-van-ban-${filters.type}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  }, [filters]);

  const typeTitle: Record<string, string> = { all: "Sổ văn bản", inbox: "Văn bản đến", outbox: "Văn bản đi", submission: "Tờ trình nội bộ" };
  const bucketLabels: Record<string, string> = filters.type === "outbox"
    ? { pending: "Chờ xử lý", done: "Đã xử lý", issued: "Đã phát hành" }
    : { pending: "Chờ xử lý", done: "Đã xử lý" };
  const urgencyLabels: Record<string, string> = { flash: "Hỏa tốc", top_urgent: "Thượng khẩn", urgent: "Khẩn", normal: "Thường" };
  const statusLabels: Record<string, string> = { pending_assignment: "Chờ bút phê", processing: "Đang xử lý", approved: "Chờ phê duyệt", completed: "Đã lập hồ sơ" };

  const primaryAction = filters.type === "outbox"
    ? { label: "Soạn văn bản đi", run: () => router.push("/documents/outgoing/compose") }
    : filters.type === "inbox"
    ? { label: "Vào sổ văn bản đến", run: () => setIsQuickEntryOpen(true) }
    : { label: filters.type === "submission" ? "Soạn tờ trình" : "Soạn văn bản", run: () => setIsCreateOpen(true) };

  const leadUnitName = filters.leadUnitId
    ? departments.find((d) => d.id === filters.leadUnitId)?.name ?? (isDepartmentsLoading ? "Đang tải…" : "Không rõ đơn vị")
    : undefined;
  const leadUnitOptions = isDepartmentsLoading ? [] : departments.map((d) => ({ value: d.id, label: d.name }));

  const activeFilters = [
    ...(filters.bucket ? [{ id: "bucket", label: "Nhóm", value: bucketLabels[filters.bucket] ?? filters.bucket, onClear: () => setFilter("bucket", "") }] : []),
    ...(filters.status && filters.status !== "ALL" ? [{ id: "status", label: "Trạng thái", value: statusLabels[filters.status] ?? filters.status, onClear: () => setFilter("status", "ALL") }] : []),
    ...(filters.urgency && filters.urgency !== "ALL" ? [{ id: "urgency", label: "Mức khẩn", value: urgencyLabels[filters.urgency] ?? filters.urgency, onClear: () => setFilter("urgency", "ALL") }] : []),
    ...(filters.leadUnitId ? [{ id: "leadUnit", label: "Đơn vị chủ trì", value: leadUnitName ?? filters.leadUnitId, onClear: () => setFilter("leadUnitId", "") }] : []),
    ...(filters.documentYear ? [{ id: "year", label: "Năm", value: String(filters.documentYear), onClear: () => setFilter("documentYear", undefined) }] : []),
  ];
  // Xóa bộ lọc giữ loại sổ, từ khóa và tham số không thuộc bộ lọc; resetFilters sẽ đưa loại về "Tất cả"
  const clearFilters = () => setFilters({ bucket: "", status: "ALL", urgency: "ALL", leadUnitId: "", documentYear: undefined });
  const emptyCopy = getLedgerEmptyCopy(isResultFiltered);
  const emptyAction = isResultFiltered ? (
    <Button size="sm" variant="outline" onClick={() => setFilters({ search: "", bucket: "", status: "ALL", urgency: "ALL", leadUnitId: "", documentYear: undefined })}>
      Xóa bộ lọc và từ khóa
    </Button>
  ) : (
    <Button size="sm" variant="outline" onClick={primaryAction.run}>{primaryAction.label}</Button>
  );

  const quickViewProps = pane.docId
    ? {
        docId: pane.docId,
        fileId: pane.fileId,
        seed: paneDoc,
        onClose: pane.close,
        onFileChange: pane.selectFile,
        onWorkflowUpdate: () => {
          fetchDocuments();
        },
        onViewSignature: (item: DocumentItem | null) => {
          setSignatureDoc(item ? mapApiDocumentToOfficial(item as unknown as ApiDoc) : paneDoc);
          setIsSignatureOpen(true);
        },
        focusToken,
      }
    : null;
  const paneVisible = Boolean(quickViewProps) && workspaceWidth > 0 && layout.mode === "pane";
  const overlayVisible = Boolean(quickViewProps) && workspaceWidth > 0 && layout.mode === "overlay";

  return (
    <div ref={workspaceRef} className="flex min-h-0 w-full flex-1 md:flex-row" data-slot="document-registry-view">
      <div
        ref={listRef}
        tabIndex={-1}
        data-slot="document-list-region"
        className="min-w-0 flex-1 pb-6 outline-none md:overflow-y-auto md:p-6 md:pb-10"
      >
      <DocumentLedgerToolbar
        title={typeTitle[filters.type] ?? "Sổ văn bản"}
        total={isLoading || fetchError ? null : totalCount}
        searchValue={searchInputValue}
        onSearchChange={setSearchInputValue}
        urgency={filters.urgency}
        onUrgencyChange={(v) => setFilter("urgency", v)}
        status={filters.status}
        onStatusChange={(v) => setFilter("status", v)}
        year={filters.documentYear}
        onYearChange={(y) => setFilter("documentYear", y)}
        primaryActionLabel={primaryAction.label}
        onPrimaryAction={primaryAction.run}
        activeFilters={activeFilters}
        onClearFilters={clearFilters}
        leadUnitId={filters.leadUnitId}
        leadUnitLabel={leadUnitName}
        leadUnitOptions={leadUnitOptions}
        onLeadUnitChange={(id) => setFilter("leadUnitId", id)}
        visibleColumns={visibleColumns}
        onVisibleColumnsChange={setVisibleColumns}
      />

      <InboundDocumentFeatureGuide>
        <div className="mt-2">
          <div className="hidden sm:block">
            <DocumentLedgerTable
              documents={documents} selectedIds={selectedIds} selectedDocumentId={pane.docId}
              numberHeader={filters.type === "outbox" ? "Số đi" : filters.type === "inbox" ? "Số đến" : "Số"}
              visibleColumns={visibleColumns} isFiltered={isResultFiltered}
              emptyAction={emptyAction}
              isLoading={isLoading} error={fetchError} onRetry={() => fetchDocuments()}
              onOpen={handleOpenDetail} onNavigate={handleNavigate} onToggleSelect={handleToggleSelect} onSelectAll={handleSelectAll}
            />
          </div>
          <div className="block sm:hidden">
            <DocumentCardList
              documents={documents} selectedDocument={paneDoc} selectedIds={selectedIds}
              emptyTitle={emptyCopy.title} emptyDescription={emptyCopy.description}
              emptyAction={emptyAction}
              onSelectDocument={handleOpenDetail} onToggleSelect={handleToggleSelect} onViewPdf={handleOpenDetail}
              isLoading={isLoading} error={fetchError} onRetry={() => fetchDocuments()} selectable
            />
          </div>
          <TaskPaginationBar
            itemLabel="văn bản"
            currentPage={filters.page} pageSize={filters.pageSize} totalItems={totalCount}
            onPageChange={(page) => setFilter("page", page)} onPageSizeChange={(pageSize) => setFilter("pageSize", pageSize)} disabled={isLoading}
          />
        </div>
      </InboundDocumentFeatureGuide>
      </div>

      {/* Quick View không modal: danh sách bên cạnh vẫn cuộn, chọn, lọc được */}
      {paneVisible && quickViewProps ? (
        <>
          <PaneResizeHandle
            value={layout.width}
            min={PANE_MIN}
            max={layout.max}
            onResize={handleResize}
            onKey={(key, current) => nextWidthForKey(key, current, layout)}
            onReset={() => handleResize(PANE_DEFAULT)}
          />
          <div style={{ width: layout.width }} className="flex h-full min-h-0 shrink-0 flex-col bg-card" data-slot="document-quick-view-pane">
            <DocumentQuickView {...quickViewProps} mode="pane" />
          </div>
        </>
      ) : null}
      {overlayVisible && quickViewProps ? <DocumentQuickView {...quickViewProps} mode="overlay" /> : null}

      {/* 6. Floating Bulk Action Toolbar */}
      <DocumentBulkToolbar
        selectedCount={selectedIds.size} selectedIds={selectedIds} totalCount={totalCount}
        onClearSelection={handleClearSelection} onRefresh={() => { fetchDocuments(); }}
        onSuccess={() => { setSelectedIds(new Set()); fetchDocuments(); }}
      />

      <CreateDocumentModal
        isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)}
        onSubmit={async (newDoc) => { pane.open(newDoc.id); fetchDocuments(); }}
      />

      <DocumentQuickEntryModal
        isOpen={isQuickEntryOpen} onClose={() => setIsQuickEntryOpen(false)}
        onSuccess={(_newDoc) => { setIsQuickEntryOpen(false); fetchDocuments(); }}
        defaultType={filters.type === "outbox" ? "VAN_BAN_DI" : filters.type === "submission" ? "TO_TRINH_NOI_BO" : "VAN_BAN_DEN"}
      />

      <DigitalSignatureDialog
        open={isSignatureOpen} onOpenChange={setIsSignatureOpen}
        documentData={signatureDoc}
        documentNumber={signatureDoc?.documentNumber}
        documentTitle={signatureDoc?.summary}
        existingSignature={(signatureDoc?.signatures?.[0] as any) || null}
      />
    </div>
  );
}
