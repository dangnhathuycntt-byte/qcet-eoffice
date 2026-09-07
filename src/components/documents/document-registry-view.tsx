"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Search,
  Plus,
  Download,
  Filter,
  Inbox,
  Send,
  FileCheck,
  Archive,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Eye,
} from "lucide-react";
import {
  OfficialDocument,
  DocumentType,
  DocumentUrgency,
  DocumentStatus,
  DocumentStats,
} from "@/types/document";
import { Button } from "@/components/ui/button";
import { DensityToggle } from "@/components/ui/density-toggle";
import {
  DocumentDetailDialog,
  getUrgencyBadgeConfig,
  getStatusBadgeConfig,
} from "./document-detail-dialog";
import { CreateDocumentModal } from "./create-document-modal";

interface ApiDocumentItem {
  id: string;
  type: string;
  urgency: string;
  status: string;
  originalNumber?: string | null;
  documentNumber?: string | null;
  registrationNumber?: number | null;
  documentYear?: number | null;
  issuedDate?: string | Date | null;
  registeredDate?: string | Date | null;
  receivedDate?: string | null;
  issuingAuthority?: string | null;
  signatory?: string | null;
  signerName?: string | null;
  signerTitle?: string | null;
  summary?: string | null;
  leadDepartment?: string | null;
  leadDepartmentId?: string | null;
  leadDepartmentName?: string | null;
  draftingDeptName?: string | null;
  linkedTaskId?: string | null;
  linkedTaskTitle?: string | null;
  linkedTask?: { id: string; title: string } | null;
  securityLevel?: string | null;
  attachments?: Array<{
    fileName: string;
    fileSize?: number;
    fileUrl?: string;
  }> | null;
  fileAttachment?: {
    name: string;
    size: string;
    url?: string;
  } | null;
}

function mapApiDocumentToOfficial(item: ApiDocumentItem): OfficialDocument {
  let type: DocumentType = "inbox";
  if (item.type === "VAN_BAN_DEN" || item.type === "inbox") type = "inbox";
  else if (item.type === "VAN_BAN_DI" || item.type === "outbox") type = "outbox";
  else if (item.type === "TO_TRINH_NOI_BO" || item.type === "submission") type = "submission";

  let urgency: DocumentUrgency = "normal";
  if (item.urgency === "HOA_TOC" || item.urgency === "flash") urgency = "flash";
  else if (item.urgency === "THUONG_KHAN" || item.urgency === "top_urgent") urgency = "top_urgent";
  else if (item.urgency === "KHAN" || item.urgency === "urgent") urgency = "urgent";
  else if (item.urgency === "THUONG" || item.urgency === "normal") urgency = "normal";

  let status: DocumentStatus = "pending_assignment";
  if (item.status === "CHO_PHAN_CONG" || item.status === "pending_assignment") status = "pending_assignment";
  else if (item.status === "DANG_XU_LY" || item.status === "processing") status = "processing";
  else if (item.status === "CHO_PHE_DUYET" || item.status === "approved") status = "approved";
  else if (item.status === "DA_HOAN_THANH" || item.status === "LUU_THEO_DOI" || item.status === "completed") status = "completed";
  if (item.linkedTaskId && status === "processing") status = "delegated";

  const issuedDateStr = item.issuedDate
    ? typeof item.issuedDate === "string"
      ? item.issuedDate.split("T")[0]
      : new Date(item.issuedDate).toISOString().split("T")[0]
    : "";

  const receivedDateStr = item.registeredDate
    ? typeof item.registeredDate === "string"
      ? item.registeredDate.split("T")[0]
      : new Date(item.registeredDate).toISOString().split("T")[0]
    : item.receivedDate || undefined;

  const docNumber =
    item.originalNumber ||
    item.documentNumber ||
    (item.registrationNumber
      ? `${item.registrationNumber}/${item.documentYear || new Date().getFullYear()}`
      : item.id);

  const signatory =
    item.signerName
      ? `${item.signerName}${item.signerTitle ? ` (${item.signerTitle})` : ""}`
      : item.signatory || "Lãnh đạo đơn vị";

  const fileAttachment =
    item.attachments && item.attachments.length > 0
      ? {
          name: item.attachments[0].fileName,
          size: `${Math.max(1, Math.round((item.attachments[0].fileSize || 1024) / 1024))} KB`,
          url: item.attachments[0].fileUrl,
        }
      : item.fileAttachment || undefined;

  return {
    id: item.id,
    type,
    documentNumber: docNumber,
    issuedDate: issuedDateStr,
    receivedDate: receivedDateStr,
    issuingAuthority: item.issuingAuthority || "Cơ quan ban hành",
    summary: item.summary || "",
    urgency: urgency || "normal",
    status: status || "pending_assignment",
    leadDepartment:
      item.leadDepartmentName || item.leadDepartment || item.draftingDeptName || "Chưa phân công",
    signatory,
    linkedTaskId: item.linkedTaskId || undefined,
    linkedTaskTitle:
      item.linkedTask?.title || (item.linkedTaskId ? `Nhiệm vụ #${item.linkedTaskId}` : undefined),
    fileAttachment,
  };
}

export function DocumentRegistryView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data state initialized as empty list from real database
  const [documents, setDocuments] = React.useState<OfficialDocument[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [stats, setStats] = React.useState<DocumentStats>({
    totalInbox: 0,
    totalOutbox: 0,
    totalSubmissions: 0,
    urgentCount: 0,
    linkedTaskCount: 0,
  });

  // Active Tab state synced with URL query ?tab=
  const tabParam = searchParams.get("tab") || "all";
  const activeTab: string = ["all", "inbox", "outbox", "pending", "archive"].includes(tabParam)
    ? tabParam
    : "all";

  // Filter & Search states
  const [searchQuery, setSearchQuery] = React.useState("");
  const [urgencyFilter, setUrgencyFilter] = React.useState<string>("ALL");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");

  // Modal states
  const [selectedDocument, setSelectedDocument] = React.useState<OfficialDocument | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  // Fetch document stats from real API route
  const fetchStats = React.useCallback(async () => {
    try {
      const res = await fetch("/api/documents/stats");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setStats((prev) => ({
            ...prev,
            totalInbox: json.data.incoming ?? 0,
            totalOutbox: json.data.outgoing ?? 0,
            totalSubmissions: json.data.internal ?? 0,
            urgentCount: json.data.urgent ?? 0,
          }));
        }
      }
    } catch (err) {
      console.error("Error fetching document stats:", err);
    }
  }, []);

  // Fetch documents from real API route with query filtering
  const fetchDocuments = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === "inbox") params.set("type", "VAN_BAN_DEN");
      else if (activeTab === "outbox") params.set("type", "VAN_BAN_DI");
      else if (activeTab === "pending") params.set("type", "TO_TRINH_NOI_BO");

      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }
      if (urgencyFilter !== "ALL") {
        const apiUrgency =
          urgencyFilter === "flash"
            ? "HOA_TOC"
            : urgencyFilter === "top_urgent"
            ? "THUONG_KHAN"
            : urgencyFilter === "urgent"
            ? "KHAN"
            : urgencyFilter === "normal"
            ? "THUONG"
            : urgencyFilter;
        params.set("urgency", apiUrgency);
      }
      if (statusFilter !== "ALL") {
        const apiStatus =
          statusFilter === "pending_assignment"
            ? "CHO_PHAN_CONG"
            : statusFilter === "processing"
            ? "DANG_XU_LY"
            : statusFilter === "approved"
            ? "CHO_PHE_DUYET"
            : statusFilter === "completed"
            ? "DA_HOAN_THANH"
            : statusFilter;
        params.set("status", apiStatus);
      }

      const queryString = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/documents${queryString}`);
      if (res.ok) {
        const json = await res.json();
        const rawDocs = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.documents)
          ? json.documents
          : [];
        const mapped = rawDocs.map(mapApiDocumentToOfficial);
        setDocuments(mapped);
        setStats((prev) => ({
          ...prev,
          linkedTaskCount: mapped.filter((d: OfficialDocument) => Boolean(d.linkedTaskId)).length,
        }));
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, searchQuery, urgencyFilter, statusFilter]);

  // Load documents and stats on filter changes
  React.useEffect(() => {
    fetchDocuments();
    fetchStats();
  }, [fetchDocuments, fetchStats]);

  // Switch tab and sync with URL
  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    router.replace(`/documents?${params.toString()}`);
  };

  // Open detail dialog
  const handleOpenDetail = (doc: OfficialDocument) => {
    setSelectedDocument(doc);
    setIsDetailOpen(true);
  };

  // Handle new document creation via real database API
  const handleCreateDocument = async (newDoc: OfficialDocument) => {
    setDocuments((prev) => [newDoc, ...prev]);
    setSelectedDocument(newDoc);
    setIsDetailOpen(true);

    try {
      const apiType =
        newDoc.type === "inbox"
          ? "VAN_BAN_DEN"
          : newDoc.type === "outbox"
          ? "VAN_BAN_DI"
          : "TO_TRINH_NOI_BO";

      const apiUrgency =
        newDoc.urgency === "flash"
          ? "HOA_TOC"
          : newDoc.urgency === "top_urgent"
          ? "THUONG_KHAN"
          : newDoc.urgency === "urgent"
          ? "KHAN"
          : "THUONG";

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: apiType,
          originalNumber: newDoc.documentNumber,
          issuedDate: newDoc.issuedDate,
          issuingAuthority: newDoc.issuingAuthority,
          category: "Công văn",
          summary: newDoc.summary,
          urgency: apiUrgency,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const created = json.data || json.document;
        if (created?.id) {
          setDocuments((prev) =>
            prev.map((d) => (d.id === newDoc.id ? { ...d, id: created.id } : d))
          );
        }
        fetchStats();
      } else {
        // Rollback optimistic addition on server failure
        setDocuments((prev) => prev.filter((d) => d.id !== newDoc.id));
        const errJson = await res.json().catch(() => null);
        alert(errJson?.error || "Không thể đăng ký văn bản vào hệ thống. Vui lòng thử lại.");
      }
    } catch (err) {
      // Rollback optimistic addition on network exception
      setDocuments((prev) => prev.filter((d) => d.id !== newDoc.id));
      console.error("Error creating document via API:", err);
      alert("Lỗi kết nối khi đăng ký văn bản. Đã hoàn tác dữ liệu.");
    }
  };

  // Filtered documents
  const filteredDocuments = React.useMemo(() => {
    return documents.filter((doc) => {
      // Tab filter
      if (activeTab === "inbox" && doc.type !== "inbox" && doc.type !== "VAN_BAN_DEN") return false;
      if (activeTab === "outbox" && doc.type !== "outbox" && doc.type !== "VAN_BAN_DI") return false;
      if (activeTab === "pending") {
        const isSubmission = doc.type === "submission" || doc.type === "TO_TRINH_NOI_BO";
        const isPending = doc.status === "pending_assignment" || doc.status === "CHO_PHAN_CONG";
        if (!isSubmission && !isPending) return false;
      }

      // Urgency filter
      if (urgencyFilter !== "ALL") {
        const isFlash =
          (urgencyFilter === "flash" || urgencyFilter === "HOA_TOC") &&
          (doc.urgency === "flash" || doc.urgency === "HOA_TOC");
        const isTopUrgent =
          (urgencyFilter === "top_urgent" || urgencyFilter === "THUONG_KHAN") &&
          (doc.urgency === "top_urgent" || doc.urgency === "THUONG_KHAN");
        const isUrgent =
          (urgencyFilter === "urgent" || urgencyFilter === "KHAN") &&
          (doc.urgency === "urgent" || doc.urgency === "KHAN");
        const isNormal =
          (urgencyFilter === "normal" || urgencyFilter === "THUONG") &&
          (doc.urgency === "normal" || doc.urgency === "THUONG");
        if (!isFlash && !isTopUrgent && !isUrgent && !isNormal && doc.urgency !== urgencyFilter) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "ALL") {
        const isPending =
          (statusFilter === "pending_assignment" || statusFilter === "CHO_PHAN_CONG") &&
          (doc.status === "pending_assignment" || doc.status === "CHO_PHAN_CONG");
        const isProc =
          (statusFilter === "processing" || statusFilter === "DANG_XU_LY") &&
          (doc.status === "processing" || doc.status === "DANG_XU_LY");
        const isApproved =
          (statusFilter === "approved" || statusFilter === "CHO_PHE_DUYET") &&
          (doc.status === "approved" || doc.status === "CHO_PHE_DUYET");
        const isCompleted =
          (statusFilter === "completed" || statusFilter === "DA_HOAN_THANH") &&
          (doc.status === "completed" || doc.status === "DA_HOAN_THANH");
        if (!isPending && !isProc && !isApproved && !isCompleted && doc.status !== statusFilter) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesNumber = doc.documentNumber.toLowerCase().includes(query);
        const matchesSummary = doc.summary.toLowerCase().includes(query);
        const matchesAuthority = doc.issuingAuthority.toLowerCase().includes(query);
        const matchesDept = doc.leadDepartment.toLowerCase().includes(query);
        return matchesNumber || matchesSummary || matchesAuthority || matchesDept;
      }

      return true;
    });
  }, [documents, activeTab, urgencyFilter, statusFilter, searchQuery]);

  const computedStats = React.useMemo(() => {
    const totalInbox =
      stats.totalInbox > 0 ? stats.totalInbox : documents.filter((d) => d.type === "inbox").length;
    const totalOutbox =
      stats.totalOutbox > 0 ? stats.totalOutbox : documents.filter((d) => d.type === "outbox").length;
    const totalSubmissions =
      stats.totalSubmissions > 0
        ? stats.totalSubmissions
        : documents.filter((d) => d.type === "submission").length;
    const linkedTaskCount = documents.filter((d) => Boolean(d.linkedTaskId)).length;
    const urgentCount =
      stats.urgentCount > 0
        ? stats.urgentCount
        : documents.filter(
            (d) =>
              d.urgency === "urgent" ||
              d.urgency === "top_urgent" ||
              d.urgency === "flash" ||
              d.urgency === "KHAN" ||
              d.urgency === "THUONG_KHAN" ||
              d.urgency === "HOA_TOC"
          ).length;

    return {
      totalInbox,
      totalOutbox,
      totalSubmissions,
      urgentCount,
      linkedTaskCount,
    };
  }, [stats, documents]);

  return (
    <div
      className="max-w-[1440px] w-full mx-auto space-y-6 pb-20 md:pb-12"
      data-slot="document-registry-view"
    >
      {/* 1. Header & Breadcrumb */}
      <div>
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2.5"
        >
          <Link
            href="/"
            className="transition-colors hover:text-foreground hover:underline underline-offset-4"
          >
            Trang chủ
          </Link>
          <ChevronRight className="size-3 text-muted-foreground/60" strokeWidth={1.5} />
          <span className="font-medium text-foreground">Văn bản &amp; Quản lý Công văn</span>
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <FileText className="size-3" strokeWidth={1.5} />
                Nghị định 30/2020/NĐ-CP
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="size-3" strokeWidth={1.5} />
                Liên thông Task Hub
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Sổ Quản Lý Văn Bản &amp; Công Văn Điện Tử
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Hệ thống đăng ký, quản lý công văn đi - đến, tờ trình nội bộ và bút phê lãnh đạo theo
              chuẩn văn thư lưu trữ
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchDocuments();
                fetchStats();
              }}
              disabled={isLoading}
              className="h-9 px-3 text-xs rounded-xl border-border/70 shadow-2xs hover:bg-muted/60 cursor-pointer"
            >
              <RefreshCw
                className={`size-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
                strokeWidth={1.5}
              />
              <span>Làm mới</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => alert("Tính năng xuất sổ điện tử theo định dạng Excel/PDF chuẩn NĐ30")}
              className="h-9 px-3 text-xs rounded-xl border-border/70 shadow-2xs hover:bg-muted/60 cursor-pointer"
            >
              <Download className="size-3.5 mr-1.5" strokeWidth={1.5} />
              <span>Xuất sổ điện tử</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="h-9 px-3.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 cursor-pointer"
            >
              <Plus className="size-3.5 mr-1.5" strokeWidth={2} />
              <span>Soạn văn bản / Tờ trình</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Quick Stats Strip (4 KPI Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Tổng Văn bản Đến */}
        <div
          onClick={() => handleTabChange("inbox")}
          className="p-4 rounded-2xl border border-border/70 bg-card hover:border-primary/40 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              VĂN BẢN ĐẾN
            </span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:bg-sky-500/20 transition-colors">
              <Inbox className="size-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-foreground">
              {computedStats.totalInbox}
            </span>
            <span className="text-xs text-muted-foreground">sổ tiếp nhận</span>
          </div>
        </div>

        {/* Card 2: Tổng Văn bản Đi */}
        <div
          onClick={() => handleTabChange("outbox")}
          className="p-4 rounded-2xl border border-border/70 bg-card hover:border-primary/40 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              VĂN BẢN ĐI
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <Send className="size-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-foreground">
              {computedStats.totalOutbox}
            </span>
            <span className="text-xs text-muted-foreground">phát hành</span>
          </div>
        </div>

        {/* Card 3: Tờ trình & Đề xuất */}
        <div
          onClick={() => handleTabChange("pending")}
          className="p-4 rounded-2xl border border-border/70 bg-card hover:border-primary/40 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              TỜ TRÌNH DUYỆT
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20 transition-colors">
              <FileCheck className="size-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-foreground">
              {computedStats.totalSubmissions}
            </span>
            <span className="text-xs text-muted-foreground">chờ BGH duyệt</span>
          </div>
        </div>

        {/* Card 4: Tỷ lệ Liên thông Giao việc */}
        <div className="p-4 rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              LIÊN THÔNG NHIỆM VỤ
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {computedStats.linkedTaskCount}
            </span>
            <span className="text-xs text-muted-foreground">
              / {documents.length} (
              {documents.length > 0
                ? Math.round((computedStats.linkedTaskCount / documents.length) * 100)
                : 0}
              %)
            </span>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar & Tab Selector */}
      <div className="p-3 sm:p-4 rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xs space-y-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-border/50">
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "all"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <span>Tất cả</span>
            <span className="text-xs font-mono px-1.5 py-0.2 rounded-md bg-background/20">
              {documents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("inbox")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "inbox"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Inbox className="size-3.5" strokeWidth={1.5} />
            <span>Văn bản đến</span>
            <span className="text-xs font-mono px-1.5 py-0.2 rounded-md bg-background/20">
              {computedStats.totalInbox}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("outbox")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "outbox"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Send className="size-3.5" strokeWidth={1.5} />
            <span>Văn bản đi</span>
            <span className="text-xs font-mono px-1.5 py-0.2 rounded-md bg-background/20">
              {computedStats.totalOutbox}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("pending")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "pending"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <FileCheck className="size-3.5" strokeWidth={1.5} />
            <span>Tờ trình duyệt</span>
            <span className="text-xs font-mono px-1.5 py-0.2 rounded-md bg-background/20">
              {computedStats.totalSubmissions}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("archive")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "archive"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Archive className="size-3.5" strokeWidth={1.5} />
            <span>Sổ lưu trữ</span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm theo số ký hiệu (vd: 128), trích yếu nội dung, hoặc đơn vị..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-border/70 bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Urgency Filter */}
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="px-2.5 py-2 text-xs rounded-xl border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 shrink-0"
            >
              <option value="ALL">Độ khẩn: Tất cả</option>
              <option value="flash">Hỏa tốc</option>
              <option value="top_urgent">Thượng khẩn</option>
              <option value="urgent">Khẩn</option>
              <option value="normal">Thường</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-2 text-xs rounded-xl border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 shrink-0"
            >
              <option value="ALL">Trạng thái: Tất cả</option>
              <option value="pending_assignment">Chờ bút phê</option>
              <option value="processing">Đang xử lý</option>
              <option value="delegated">Đã giao việc</option>
              <option value="approved">Đã ký duyệt</option>
              <option value="completed">Hoàn tất</option>
            </select>

            {/* Density Toggle */}
            <DensityToggle className="h-8.5 rounded-xl border-border/70 shadow-2xs shrink-0" />
          </div>
        </div>
      </div>

      {/* 4. Official Registry Table (Desktop) / Cards (Mobile) */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              DANH SÁCH VĂN BẢN VÀ CÔNG VĂN
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {isLoading ? "(Đang tải dữ liệu...)" : `(${filteredDocuments.length} bản ghi)`}
            </span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Bấm vào hàng để xem bút phê và tệp đính kèm
          </span>
        </div>

        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-row-dense">
              <thead>
                <tr className="border-b border-border/50 bg-muted/10">
                  <th className="py-3 px-4 w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Số / Ký hiệu
                  </th>
                  <th className="py-3 px-4 w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ngày BH / Đến
                  </th>
                  <th className="py-3 px-4 w-[200px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Cơ quan &amp; Người ký
                  </th>
                  <th className="py-3 px-4 min-w-[280px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Trích yếu nội dung
                  </th>
                  <th className="py-3 px-4 w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Đơn vị &amp; Tiến độ
                  </th>
                  <th className="py-3 px-4 w-[180px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Liên thông việc
                  </th>
                  <th className="py-3 px-4 w-[80px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Chi tiết
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="py-3 px-4 table-cell-dense">
                      <div className="h-4 w-28 bg-muted rounded mb-1" />
                      <div className="h-3 w-16 bg-muted/60 rounded" />
                    </td>
                    <td className="py-3 px-4 table-cell-dense">
                      <div className="h-4 w-20 bg-muted rounded mb-1" />
                      <div className="h-3 w-14 bg-muted/60 rounded" />
                    </td>
                    <td className="py-3 px-4 table-cell-dense">
                      <div className="h-4 w-32 bg-muted rounded mb-1" />
                      <div className="h-3 w-24 bg-muted/60 rounded" />
                    </td>
                    <td className="py-3 px-4 table-cell-dense">
                      <div className="h-4 w-3/4 bg-muted rounded mb-1.5" />
                      <div className="h-3 w-20 bg-muted/60 rounded" />
                    </td>
                    <td className="py-3 px-4 table-cell-dense">
                      <div className="h-4 w-24 bg-muted rounded mb-1" />
                      <div className="h-3 w-20 bg-muted/60 rounded" />
                    </td>
                    <td className="py-3 px-4 table-cell-dense">
                      <div className="h-6 w-24 bg-muted/80 rounded-lg" />
                    </td>
                    <td className="py-3 px-4 table-cell-dense text-right">
                      <div className="h-7 w-7 bg-muted/60 rounded-lg ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="size-8 mx-auto mb-2 opacity-50" strokeWidth={1.5} />
            <p className="text-sm font-medium text-foreground">Không tìm thấy văn bản phù hợp</p>
            <p className="text-xs mt-1">Vui lòng thay đổi từ khóa hoặc bộ lọc tìm kiếm.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-row-dense">
              <thead>
                <tr className="border-b border-border/50 bg-muted/10">
                  <th className="py-3 px-4 w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Số / Ký hiệu
                  </th>
                  <th className="py-3 px-4 w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ngày BH / Đến
                  </th>
                  <th className="py-3 px-4 w-[200px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Cơ quan &amp; Người ký
                  </th>
                  <th className="py-3 px-4 min-w-[280px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Trích yếu nội dung
                  </th>
                  <th className="py-3 px-4 w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Đơn vị &amp; Tiến độ
                  </th>
                  <th className="py-3 px-4 w-[180px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Liên thông việc
                  </th>
                  <th className="py-3 px-4 w-[80px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Chi tiết
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredDocuments.map((doc) => {
                  const urgencyConfig = getUrgencyBadgeConfig(doc.urgency);
                  const statusConfig = getStatusBadgeConfig(doc.status);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => handleOpenDetail(doc)}
                      className="hover:bg-muted/40 transition-colors cursor-pointer group"
                    >
                      {/* Số / Ký hiệu & Loại */}
                      <td className="py-3 px-4 table-cell-dense">
                        <span className="font-mono text-xs md:text-[13px] font-semibold text-primary block group-hover:text-primary/80 transition-colors">
                          {doc.documentNumber}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {doc.type === "inbox"
                            ? "Văn bản đến"
                            : doc.type === "outbox"
                            ? "Văn bản đi"
                            : "Tờ trình duyệt"}
                        </span>
                      </td>

                      {/* Ngày */}
                      <td className="py-3 px-4 table-cell-dense">
                        <span className="font-mono text-xs text-muted-foreground block">
                          {doc.issuedDate}
                        </span>
                        {doc.receivedDate && (
                          <span className="text-xs text-muted-foreground/80 block">
                            Đến: {doc.receivedDate}
                          </span>
                        )}
                      </td>

                      {/* Cơ quan & Người ký */}
                      <td className="py-3 px-4 table-cell-dense">
                        <span className="font-medium text-foreground block truncate max-w-[190px]">
                          {doc.issuingAuthority}
                        </span>
                        <span className="text-xs text-muted-foreground block truncate max-w-[190px]">
                          {doc.signatory}
                        </span>
                      </td>

                      {/* Trích yếu nội dung */}
                      <td className="py-3 px-4 table-cell-dense">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground line-clamp-2 leading-relaxed">
                            {doc.summary}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${urgencyConfig.className}`}
                            >
                              {urgencyConfig.label}
                            </span>
                            {doc.fileAttachment && (
                              <span className="text-xs text-muted-foreground font-mono">
                                • PDF ({doc.fileAttachment.size})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Đơn vị & Tiến độ */}
                      <td className="py-3 px-4 table-cell-dense">
                        <span className="font-medium text-foreground block truncate max-w-[150px]">
                          {doc.leadDepartment}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border mt-1 ${statusConfig.className}`}
                        >
                          <StatusIcon className="size-3" strokeWidth={1.5} />
                          <span>{statusConfig.label}</span>
                        </span>
                      </td>

                      {/* Liên thông việc */}
                      <td
                        className="py-3 px-4 table-cell-dense"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {doc.linkedTaskId ? (
                          <Link
                            href={`/?taskId=${doc.linkedTaskId}`}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-semibold transition-colors"
                            title={doc.linkedTaskTitle}
                          >
                            <CheckCircle2 className="size-3" strokeWidth={1.5} />
                            <span className="font-mono">{doc.linkedTaskId}</span>
                            <ArrowRight className="size-2.5" strokeWidth={1.5} />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground/60 italic">
                            Chưa tạo việc
                          </span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3 px-4 table-cell-dense text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-lg text-muted-foreground group-hover:text-primary hover:bg-muted cursor-pointer"
                          aria-label="Xem chi tiết"
                        >
                          <Eye className="size-3.5" strokeWidth={1.5} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Modals & Dialogs */}
      <DocumentDetailDialog
        document={selectedDocument}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />

      <CreateDocumentModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateDocument}
      />
    </div>
  );
}
