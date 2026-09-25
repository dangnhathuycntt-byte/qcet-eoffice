"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, Plus, RefreshCw, Inbox, Send, FileCheck, ChevronRight, ArrowLeft, CheckCircle2, FilePlus, Stamp } from "lucide-react";
import type { OfficialDocument, DocumentType, DocumentUrgency, DocumentStatus, DocumentItem } from "@/types/document";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDocumentUrlFilters, type DocumentTabType } from "@/hooks/use-document-url-filters";
import { DocumentFilterBar, DocumentStatsSummary, DocumentTable, DocumentCardList, DocumentPagination, DocumentBulkToolbar, type DocumentStatsData, type DocumentKpiType } from "./registry";
import { DocumentDetailDialog } from "./document-detail-dialog";
import { DocumentOutgoingDetailView } from "./document-outgoing-detail-view";
import { CreateDocumentModal } from "./create-document-modal";
import { DocumentQuickEntryModal } from "./document-quick-entry-modal";
import { DigitalSignatureDialog } from "./digital-signature-dialog";

const DocumentPdfViewer = dynamic(() => import("./document-pdf-viewer").then((mod) => mod.DocumentPdfViewer), {
  ssr: false,
  loading: () => <div role="status" className="p-8 text-center text-sm text-muted-foreground animate-pulse">Đang tải trình xem PDF...</div>,
});

interface ApiDoc {
  id: string; type: string; urgency: string; status: string;
  originalNumber?: string | null; documentNumber?: string | null;
  registrationNumber?: number | null; documentYear?: number | null;
  issuedDate?: string | Date | null; registeredDate?: string | Date | null; receivedDate?: string | null;
  issuingAuthority?: string | null; signatory?: string | null; signerName?: string | null; signerTitle?: string | null;
  summary?: string | null; leadDepartment?: string | null; leadDepartmentName?: string | null; draftingDeptName?: string | null;
  linkedTaskId?: string | null; linkedTask?: { id: string; title: string } | null; signatures?: Array<unknown> | null;
  attachments?: Array<{ fileName: string; fileSize?: number; fileUrl?: string }> | null;
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
    size: `${Math.max(1, Math.round((item.attachments[0].fileSize || 1024) / 1024))} KB`,
    url: item.attachments[0].fileUrl,
  } : item.fileAttachment || undefined;

  return {
    id: item.id,
    type: typeMap[item.type] || "inbox",
    documentNumber: docNumber,
    issuedDate: formatDate(item.issuedDate),
    receivedDate: formatDate(item.registeredDate) || item.receivedDate || undefined,
    issuingAuthority: item.issuingAuthority || "Cơ quan ban hành",
    summary: item.summary || "",
    urgency: urgencyMap[item.urgency] || "normal",
    status,
    leadDepartment: item.leadDepartmentName || item.leadDepartment || item.draftingDeptName || "Chưa phân công",
    signatory: item.signerName ? `${item.signerName}${item.signerTitle ? ` (${item.signerTitle})` : ""}` : item.signatory || "Lãnh đạo đơn vị",
    linkedTaskId: item.linkedTaskId || undefined,
    linkedTaskTitle: item.linkedTask?.title || (item.linkedTaskId ? `Nhiệm vụ #${item.linkedTaskId}` : undefined),
    fileAttachment,
    signatures: item.signatures || undefined,
  };
}

const TAB_CONFIGS: Array<{ id: DocumentTabType; label: string; icon: React.ElementType }> = [
  { id: "all", label: "Tất cả", icon: FileText },
  { id: "inbox", label: "Văn bản đến", icon: Inbox },
  { id: "outbox", label: "Văn bản đi", icon: Send },
  { id: "submission", label: "Tờ trình duyệt", icon: FileCheck },
];

export function DocumentRegistryView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL state management
  const { filters, setFilter, setFilters, resetFilters, searchInputValue, setSearchInputValue } = useDocumentUrlFilters();

  // Data & Pagination state
  const [documents, setDocuments] = React.useState<OfficialDocument[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState<boolean>(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Statistics
  const [stats, setStats] = React.useState<DocumentStatsData>({
    total: 0, totalInbox: 0, totalOutbox: 0, totalSubmissions: 0,
    pending: 0, processing: 0, urgent: 0, overdue: 0, completed: 0, linkedTasks: 0,
  });

  // Modals & Dialogs
  const [selectedDocument, setSelectedDocument] = React.useState<OfficialDocument | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isQuickEntryOpen, setIsQuickEntryOpen] = React.useState(false);
  const [fullscreenPdfDoc, setFullscreenPdfDoc] = React.useState<OfficialDocument | null>(null);
  const [outgoingDetailDocId, setOutgoingDetailDocId] = React.useState<string | null>(null);
  const [outgoingDetailDoc, setOutgoingDetailDoc] = React.useState<DocumentItem | null>(null);
  const [signatureDoc, setSignatureDoc] = React.useState<OfficialDocument | null>(null);
  const [isSignatureOpen, setIsSignatureOpen] = React.useState(false);

  // Fetch document stats
  const fetchStats = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/documents/stats", { signal });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data) {
        setStats({
          total: json.data.total ?? (json.data.incoming ?? 0) + (json.data.outgoing ?? 0) + (json.data.internal ?? 0),
          totalInbox: json.data.incoming ?? 0, totalOutbox: json.data.outgoing ?? 0, totalSubmissions: json.data.internal ?? 0,
          urgent: json.data.urgent ?? 0, overdue: json.data.overdue ?? 0, processing: json.data.processing ?? 0,
          pending: json.data.pending ?? 0, completed: json.data.completed ?? 0, linkedTasks: json.data.linkedTasks ?? 0,
        });
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "AbortError") console.error("Stats fetch error:", err);
    }
  }, []);

  // Fetch documents matching filters
  const fetchDocuments = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const p = new URLSearchParams();
      if (filters.type === "inbox") p.set("type", "VAN_BAN_DEN");
      else if (filters.type === "outbox") p.set("type", "VAN_BAN_DI");
      else if (filters.type === "submission") p.set("type", "TO_TRINH_NOI_BO");

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
  }, [filters]);

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetchDocuments(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchDocuments]);

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetchStats(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchStats]);

  // Deep-link selection
  const docIdParam = searchParams.get("docId");
  React.useEffect(() => {
    if (!docIdParam || documents.length === 0) return;
    const cleanId = decodeURIComponent(docIdParam).toLowerCase().trim();
    const matched = documents.find((d) => d.id.toLowerCase() === cleanId || d.documentNumber?.toLowerCase().includes(cleanId) || d.summary?.toLowerCase().includes(cleanId));
    if (matched) handleOpenDetail(matched);
  }, [docIdParam, documents]);

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

  // Open detail dialog
  const handleOpenDetail = React.useCallback((doc: OfficialDocument) => {
    if (doc.type === "outbox" || doc.type === "VAN_BAN_DI") {
      setOutgoingDetailDocId(doc.id);
      fetch(`/api/documents/${doc.id}`).then((r) => r.json()).then((json) => {
        const item = json?.data ?? json;
        if (item?.id) setOutgoingDetailDoc(item);
      }).catch(() => {});
    } else {
      setSelectedDocument(doc);
      setIsDetailOpen(true);
    }
  }, []);

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

  // KPI Card Selection Handler
  const handleSelectKpi = React.useCallback((kpi: DocumentKpiType) => {
    if (kpi === "pending") setFilters({ status: "pending_assignment", urgency: "ALL" });
    else if (kpi === "processing") setFilters({ status: "processing", urgency: "ALL" });
    else if (kpi === "urgent") setFilters({ urgency: "urgent", status: "ALL" });
    else if (kpi === "completed") setFilters({ status: "completed", urgency: "ALL" });
    else setFilters({ status: "ALL", urgency: "ALL" });
  }, [setFilters]);

  return (
    <div className="max-w-[1440px] w-full mx-auto space-y-5 pb-6 md:pb-10" data-slot="document-registry-view">
      {/* 1. Header & Actions */}
      <div>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <Link href="/tasks" className="transition-colors hover:text-foreground hover:underline underline-offset-4">Nhiệm vụ</Link>
          <ChevronRight className="size-3 text-muted-foreground/60" strokeWidth={1.5} />
          <span className="font-medium text-foreground">Văn bản &amp; Quản lý Công văn</span>
        </nav>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-600 border border-sky-500/20">
                <FileText className="size-3" strokeWidth={1.5} /> Nghị định 30/2020/NĐ-CP
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 className="size-3" strokeWidth={1.5} /> Liên thông Task Hub
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Sổ Quản Lý Văn Bản &amp; Công Văn Điện Tử</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Hệ thống đăng ký, quản lý công văn đi - đến, tờ trình nội bộ và bút phê lãnh đạo theo chuẩn văn thư lưu trữ
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Button variant="outline" size="sm" onClick={() => { fetchDocuments(); fetchStats(); }} disabled={isLoading} className="min-h-[40px] px-3 text-xs rounded-xl border-border/70 shadow-2xs hover:bg-muted/60 cursor-pointer">
              <RefreshCw className={cn("size-3.5 mr-1.5", isLoading && "animate-spin")} strokeWidth={1.5} />
              <span>Làm mới</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsQuickEntryOpen(true)} className="min-h-[40px] px-3 text-xs rounded-xl border-border/70 shadow-2xs hover:bg-muted/60 cursor-pointer">
              <FilePlus className="size-3.5 mr-1.5 text-primary" strokeWidth={1.5} />
              <span>Vào sổ nhanh</span>
            </Button>
            <Button size="sm" onClick={() => setIsCreateOpen(true)} className="min-h-[40px] px-3.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 cursor-pointer">
              <Plus className="size-3.5 mr-1.5" strokeWidth={1.5} />
              <span>Soạn văn bản / Tờ trình</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. KPIs Summary */}
      <DocumentStatsSummary stats={stats} onSelectKpi={handleSelectKpi} currentTab={filters.type} currentStatus={filters.status} currentUrgency={filters.urgency} isLoading={isLoading} />

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border/60 overflow-x-auto pb-1 scrollbar-none">
        {TAB_CONFIGS.map((tab) => {
          const Icon = tab.icon;
          const isActive = filters.type === tab.id;
          const count = tab.id === "inbox" ? stats.totalInbox : tab.id === "outbox" ? stats.totalOutbox : tab.id === "submission" ? stats.totalSubmissions : stats.total;
          return (
            <button key={tab.id} type="button" onClick={() => setFilter("type", tab.id)} className={cn("min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-colors cursor-pointer flex items-center gap-1.5", isActive ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
              <Icon className="size-3.5" strokeWidth={1.5} />
              <span>{tab.label}</span>
              {typeof count === "number" && count > 0 && <span className={cn("text-xs font-mono px-1.5 py-0.2 rounded-md", isActive ? "bg-background/20" : "bg-muted text-muted-foreground")}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* 4. Filter Bar */}
      <DocumentFilterBar
        searchQuery={searchInputValue} onSearchChange={setSearchInputValue}
        urgencyFilter={filters.urgency} onUrgencyChange={(urgency) => setFilter("urgency", urgency)}
        statusFilter={filters.status} onStatusChange={(status) => setFilter("status", status)}
        departmentFilter={filters.leadUnitId} onDepartmentChange={(deptId) => setFilter("leadUnitId", deptId)}
        yearFilter={filters.documentYear ? String(filters.documentYear) : "ALL"} onYearChange={(year) => setFilter("documentYear", year === "ALL" ? undefined : parseInt(year, 10))}
        onExportExcel={handleExportExcel} isExporting={isExporting} onResetFilters={resetFilters} showDensityToggle
      />

      {/* 5. Main Content: Desktop Table & Mobile Card List */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs">
        <div className="hidden sm:block">
          <DocumentTable
            documents={documents} selectedDocument={selectedDocument} selectedIds={selectedIds}
            onSelectDocument={handleOpenDetail} onToggleSelect={handleToggleSelect} onSelectAll={handleSelectAll} onClearSelection={handleClearSelection}
            onViewPdf={(doc) => setFullscreenPdfDoc(doc)} onLinkTask={(doc) => router.push(doc.linkedTaskId ? `/tasks?taskId=${doc.linkedTaskId}` : `/tasks`)}
            isLoading={isLoading} error={fetchError} onRetry={() => fetchDocuments()} selectable
          />
        </div>
        <div className="block sm:hidden">
          <DocumentCardList
            documents={documents} selectedDocument={selectedDocument} selectedIds={selectedIds}
            onSelectDocument={handleOpenDetail} onToggleSelect={handleToggleSelect} onViewPdf={(doc) => setFullscreenPdfDoc(doc)}
            isLoading={isLoading} error={fetchError} onRetry={() => fetchDocuments()} selectable
          />
        </div>
        <DocumentPagination
          currentPage={filters.page} pageSize={filters.pageSize} totalItems={totalCount}
          onPageChange={(page) => setFilter("page", page)} onPageSizeChange={(pageSize) => setFilter("pageSize", pageSize)} disabled={isLoading}
        />
      </div>

      {/* 6. Floating Bulk Action Toolbar */}
      <DocumentBulkToolbar
        selectedCount={selectedIds.size} selectedIds={selectedIds} totalCount={totalCount}
        onClearSelection={handleClearSelection} onRefresh={() => { fetchDocuments(); fetchStats(); }}
        onSuccess={() => { setSelectedIds(new Set()); fetchDocuments(); fetchStats(); }}
      />

      {/* 7. Modals & Dialogs */}
      <DocumentDetailDialog document={selectedDocument} isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} onViewPdf={(doc) => setFullscreenPdfDoc(doc)} />

      <DocumentOutgoingDetailView
        document={outgoingDetailDoc} isOpen={Boolean(outgoingDetailDocId)}
        onClose={() => { setOutgoingDetailDocId(null); setOutgoingDetailDoc(null); }}
        onWorkflowUpdate={() => {
          if (outgoingDetailDocId) {
            fetch(`/api/documents/${outgoingDetailDocId}`).then((r) => r.json()).then((json) => {
              const item = json?.data ?? json;
              if (item?.id) setOutgoingDetailDoc(item);
            }).catch(() => {});
          }
          fetchDocuments(); fetchStats();
        }}
      />

      <CreateDocumentModal
        isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)}
        onSubmit={async (newDoc) => { setDocuments((prev) => [newDoc, ...prev]); setSelectedDocument(newDoc); setIsDetailOpen(true); fetchStats(); }}
      />

      <DocumentQuickEntryModal
        isOpen={isQuickEntryOpen} onClose={() => setIsQuickEntryOpen(false)}
        onSuccess={(_newDoc) => { setIsQuickEntryOpen(false); fetchDocuments(); fetchStats(); }}
        defaultType={filters.type === "all" ? "inbox" : filters.type}
      />

      <DigitalSignatureDialog
        open={isSignatureOpen} onOpenChange={setIsSignatureOpen}
        documentData={signatureDoc || selectedDocument}
        documentNumber={signatureDoc?.documentNumber || selectedDocument?.documentNumber}
        documentTitle={signatureDoc?.summary || selectedDocument?.summary}
        existingSignature={((signatureDoc || selectedDocument)?.signatures?.[0] as any) || null}
      />

      {/* 8. Fullscreen PDF Viewer */}
      {fullscreenPdfDoc && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in duration-150" role="dialog" aria-modal="true" aria-label="Xem tệp PDF toàn màn hình" data-slot="fullscreen-pdf-viewer">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/70 bg-card shrink-0">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <button type="button" onClick={() => setFullscreenPdfDoc(null)} aria-label="Đóng và quay lại" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-border/70 bg-background text-foreground hover:bg-secondary active:bg-secondary/80 cursor-pointer">
                <ArrowLeft strokeWidth={1.5} className="size-5" />
              </button>
              <div className="truncate">
                <p className="text-xs font-bold text-foreground font-mono tabular-nums truncate">{fullscreenPdfDoc.documentNumber || fullscreenPdfDoc.id}</p>
                <p className="text-xs text-muted-foreground truncate">{fullscreenPdfDoc.fileAttachment?.name || fullscreenPdfDoc.summary}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => { setSignatureDoc(fullscreenPdfDoc); setIsSignatureOpen(true); }} className="min-h-[44px] px-3 text-xs rounded-xl border-border/70 font-semibold cursor-pointer">
                <Stamp className="size-3.5 mr-1.5 text-primary" strokeWidth={1.5} />
                <span>Xem chữ ký số</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setFullscreenPdfDoc(null)} className="min-h-[44px] px-4 text-xs font-semibold rounded-xl cursor-pointer">
                Đóng
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden p-2 sm:p-4 bg-muted/20">
            <DocumentPdfViewer fileUrl={fullscreenPdfDoc.fileAttachment?.url || ""} fileName={fullscreenPdfDoc.fileAttachment?.name || `${fullscreenPdfDoc.documentNumber || "van-ban"}.pdf`} fileSize={fullscreenPdfDoc.fileAttachment?.size} className="h-full w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
