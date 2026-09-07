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
import { OfficialDocument, DocumentType, DocumentUrgency, DocumentStatus } from "@/types/document";
import { MOCK_DOCUMENTS, getDocumentStats } from "@/lib/mock-document-data";
import { Button } from "@/components/ui/button";
import { DensityToggle } from "@/components/ui/density-toggle";
import {
  DocumentDetailDialog,
  getUrgencyBadgeConfig,
  getStatusBadgeConfig,
} from "./document-detail-dialog";
import { CreateDocumentModal } from "./create-document-modal";

export function DocumentRegistryView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data state initialized from mock data
  const [documents, setDocuments] = React.useState<OfficialDocument[]>(MOCK_DOCUMENTS);

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

  // Handle new document creation
  const handleCreateDocument = (newDoc: OfficialDocument) => {
    setDocuments((prev) => [newDoc, ...prev]);
    setSelectedDocument(newDoc);
    setIsDetailOpen(true);
  };

  // Filtered documents
  const filteredDocuments = React.useMemo(() => {
    return documents.filter((doc) => {
      // Tab filter
      if (activeTab === "inbox" && doc.type !== "inbox") return false;
      if (activeTab === "outbox" && doc.type !== "outbox") return false;
      if (activeTab === "pending") {
        // Pending tab shows submissions and pending inbox
        if (doc.type !== "submission" && doc.status !== "pending_assignment") return false;
      }

      // Urgency filter
      if (urgencyFilter !== "ALL" && doc.urgency !== urgencyFilter) return false;

      // Status filter
      if (statusFilter !== "ALL" && doc.status !== statusFilter) return false;

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

  const stats = React.useMemo(() => getDocumentStats(documents), [documents]);

  return (
    <div className="max-w-[1440px] w-full mx-auto space-y-6 pb-20 md:pb-12" data-slot="document-registry-view">
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
                <span>Nghị định 30/2020/NĐ-CP • Sổ điện tử liên thông</span>
              </span>
              <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                Năm học 2026-2027
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Sổ Quản Lý Văn Bản &amp; Công Văn Điện Tử
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Tiếp nhận công văn đến, phát hành văn bản đi, xử lý tờ trình và liên thông tự động vào Kho nhiệm vụ QCET
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                alert("Đang xuất sổ công văn theo mẫu quy định của Bộ LĐ-TB&XH...");
              }}
              className="gap-1.5 text-xs rounded-xl"
            >
              <Download className="size-3.5" strokeWidth={1.5} />
              <span>Xuất sổ điện tử</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-1.5 text-xs rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            >
              <Plus className="size-3.5" strokeWidth={1.5} />
              <span>Soạn văn bản / Tờ trình</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. KPI & Information Density Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Inbox */}
        <div
          onClick={() => handleTabChange("inbox")}
          className="p-4 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xs hover:border-sky-500/40 hover:bg-sky-500/5 transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground group-hover:text-sky-600 transition-colors">
              VĂN BẢN ĐẾN
            </span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Inbox className="size-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-foreground">
              {stats.totalInbox}
            </span>
            <span className="text-xs text-muted-foreground font-medium">văn bản</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tổng cục, UBND Tỉnh, Sở &amp; Bộ
          </p>
        </div>

        {/* Total Outbox */}
        <div
          onClick={() => handleTabChange("outbox")}
          className="p-4 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xs hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground group-hover:text-emerald-600 transition-colors">
              VĂN BẢN ĐI
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Send className="size-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-foreground">
              {stats.totalOutbox}
            </span>
            <span className="text-xs text-muted-foreground font-medium">văn bản</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            100% đã ký số &amp; đóng dấu điện tử
          </p>
        </div>

        {/* Submissions Pending */}
        <div
          onClick={() => handleTabChange("pending")}
          className="p-4 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xs hover:border-purple-500/40 hover:bg-purple-500/5 transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground group-hover:text-purple-600 transition-colors">
              TỜ TRÌNH DUYỆT
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <FileCheck className="size-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-foreground">
              {stats.totalSubmissions}
            </span>
            <span className="text-xs text-muted-foreground font-medium">tờ trình</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Khoa CNTT, Phòng Đào tạo đề xuất
          </p>
        </div>

        {/* Linked Tasks */}
        <div
          onClick={() => handleTabChange("all")}
          className="p-4 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xs hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
              LIÊN THÔNG NHIỆM VỤ
            </span>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 className="size-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-primary">
              {stats.linkedTaskCount}/{documents.length}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              ({Math.round((stats.linkedTaskCount / documents.length) * 100)}%)
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tự động gán vào Kho nhiệm vụ QCET
          </p>
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
              {stats.totalInbox}
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
              {stats.totalOutbox}
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
              {stats.totalSubmissions}
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
              ({filteredDocuments.length} bản ghi)
            </span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Bấm vào hàng để xem bút phê và tệp đính kèm
          </span>
        </div>

        {filteredDocuments.length === 0 ? (
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
                  <th className="py-3 px-4 w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Số / Ký hiệu</th>
                  <th className="py-3 px-4 w-[120px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ngày BH / Đến</th>
                  <th className="py-3 px-4 w-[200px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cơ quan &amp; Người ký</th>
                  <th className="py-3 px-4 min-w-[280px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trích yếu nội dung</th>
                  <th className="py-3 px-4 w-[160px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Đơn vị &amp; Tiến độ</th>
                  <th className="py-3 px-4 w-[180px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">Liên thông việc</th>
                  <th className="py-3 px-4 w-[80px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chi tiết</th>
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
                      <td className="py-3 px-4 table-cell-dense" onClick={(e) => e.stopPropagation()}>
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
