"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  X,
  Printer,
  Copy,
  Check,
  Building2,
  AlertTriangle,
  FileCheck,
  TrendingUp,
  User,
  Calendar,
  Layers,
  Download,
} from "lucide-react";
import type { AuthUser } from "@/types/auth";
import type {
  ElevenDepartmentRadarItem,
  SchoolBottleneckItem,
} from "@/types/workspace";
import type {
  ExecutiveCockpitMetrics,
  InstitutionalApprovalItem as InstitutionalApprovalQueueItem,
} from "./executive-cockpit-workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ExecutiveBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser;
  metrics: ExecutiveCockpitMetrics;
  radarItems: ElevenDepartmentRadarItem[];
  bottlenecks: SchoolBottleneckItem[];
  approvalQueue: InstitutionalApprovalQueueItem[];
  referenceDate?: string;
}

export function ExecutiveBriefingModal({
  isOpen,
  onClose,
  user,
  metrics,
  radarItems,
  bottlenecks,
  approvalQueue,
  referenceDate,
}: ExecutiveBriefingModalProps): React.JSX.Element | null {
  const [mounted, setMounted] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Handle ESC key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Sort departments by completion rate descending for briefing review
  const sortedDepartments = React.useMemo(() => {
    return [...radarItems].sort((a, b) => b.completionRate - a.completionRate);
  }, [radarItems]);

  // Delayed / red departments
  const laggingDepartments = React.useMemo(() => {
    return radarItems.filter(
      (dept) =>
        dept.healthStatus === "RED" || dept.delayedTasks + dept.blockedTasks > 0
    );
  }, [radarItems]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportMarkdown = () => {
    const lines = [
      "# BÁO CÁO GIAO BAN BAN GIÁM HIỆU QCET",
      `*Thời điểm trích xuất: ${new Date().toLocaleDateString("vi-VN")}*`,
      `*Lãnh đạo phụ trách: ${user.name} (${user.roleLabel || "Ban Giám Hiệu"})*`,
      "",
      "## 1. Chỉ số vận hành chính",
      `- Tỷ lệ hoàn thành toàn trường: **${metrics.totalSchoolCompletionRate}%**`,
      `- Tổng số nhiệm vụ trọng tâm: **${metrics.activeTasksCount}**`,
      `- Hồ sơ chờ BGH phê duyệt: **${metrics.pendingInstitutionalApprovalCount}**`,
      `- Điểm nghẽn cần tháo gỡ: **${metrics.bottlenecksCount}**`,
      "",
      "## 2. Tiến độ chi tiết 11 đơn vị",
      "| Đơn vị | Mã | Hoàn thành | Chậm / Nghẽn | Tỷ lệ |",
      "| :--- | :--- | :---: | :---: | :---: |",
      ...sortedDepartments.map(
        (d) =>
          `| ${d.departmentName} | ${d.departmentCode} | ${d.completedTasks}/${d.totalTasks} | ${d.delayedTasks + d.blockedTasks} | ${d.completionRate}% |`
      ),
      "",
      "## 3. Các điểm nghẽn trọng yếu",
      bottlenecks.length === 0
        ? "Toàn trường thông suốt, 0 điểm nghẽn."
        : bottlenecks
            .map(
              (b, idx) =>
                `${idx + 1}. **${b.title}** (${b.departmentCode}) - Phụ trách: ${b.assigneeName || "Chưa giao"} - Quá hạn: ${b.daysOverdue || 0} ngày`
            )
            .join("\n"),
      "",
      "## 4. Hồ sơ chờ phê duyệt",
      approvalQueue.length === 0
        ? "Hàng đợi phê duyệt đang trống."
        : approvalQueue
            .map(
              (a, idx) =>
                `${idx + 1}. **${a.title}** (${a.departmentCode}) - Người trình: ${a.submittedByName} - Ngày trình: ${a.submittedDate || "Mới cập nhật"}`
            )
            .join("\n"),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `QCET-Bao-cao-giao-ban-BGH-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = () => {
    const lines = [
      "=== BÁO CÁO GIAO BAN BAN GIÁM HIỆU QCET ===",
      `Thời điểm: ${new Date().toLocaleDateString("vi-VN")}`,
      `Lãnh đạo phụ trách: ${user.name} (${user.roleLabel || "Ban Giám Hiệu"})`,
      "",
      "1. CHỈ SỐ VẬN HÀNH CHÍNH:",
      `- Tỷ lệ hoàn thành toàn trường: ${metrics.totalSchoolCompletionRate}%`,
      `- Tổng số nhiệm vụ trọng tâm: ${metrics.activeTasksCount}`,
      `- Hồ sơ chờ BGH phê duyệt: ${metrics.pendingInstitutionalApprovalCount}`,
      `- Điểm nghẽn cần tháo gỡ: ${metrics.bottlenecksCount}`,
      "",
      "2. TIẾN ĐỘ 11 ĐƠN VỊ:",
      ...sortedDepartments.map(
        (d) =>
          `- ${d.departmentName} (${d.departmentCode}): ${d.completionRate}% [Hoàn thành: ${d.completedTasks}/${d.totalTasks}, Chậm: ${d.delayedTasks + d.blockedTasks}]`
      ),
      "",
      "3. CÁC ĐIỂM NGHẼN TRỌNG YẾU CẦN CHỈ ĐẠO:",
      bottlenecks.length === 0
        ? "- Toàn trường thông suốt, không có ách tắc."
        : bottlenecks
            .slice(0, 5)
            .map(
              (b, idx) =>
                `- [${idx + 1}] ${b.title} (${b.departmentCode}) - Người thực hiện: ${b.assigneeName || "Chưa giao"} - Quá hạn: ${b.daysOverdue || 0} ngày`
            )
            .join("\n"),
    ];

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className={cn(
          "relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-background text-foreground",
          "rounded-2xl border border-border/80 shadow-2xl overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border/70 bg-muted/30">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground">
                TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHỆ QUY NHƠN
              </span>
            </div>
            <h2
              id="briefing-modal-title"
              className="text-lg sm:text-xl font-bold tracking-tight text-foreground"
            >
              Báo Cáo Giao Ban Điều Hành Ban Giám Hiệu
            </h2>
            <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {user.name} ({user.roleLabel || "Ban Giám Hiệu"})
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Học kỳ I · Năm học 2026-2027
              </span>
              <span>•</span>
              <span>11 phòng, khoa, trung tâm</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="print:hidden p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg cursor-pointer transition-colors"
            aria-label="Đóng báo cáo giao ban"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Printable Briefing Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Section 1: Executive KPI Strip */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span>I. Tổng quan vận hành toàn trường</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border bg-card space-y-1">
                <div className="text-xs text-muted-foreground">Tiến độ chung</div>
                <div className="text-2xl font-bold text-foreground tabular-nums">
                  {metrics.totalSchoolCompletionRate}%
                </div>
                <div className="text-xs text-muted-foreground">
                  Chỉ tiêu: ≥ 85%
                </div>
              </div>

              <div className="p-3.5 rounded-xl border bg-card space-y-1">
                <div className="text-xs text-muted-foreground">Nhiệm vụ trọng tâm</div>
                <div className="text-2xl font-bold text-foreground tabular-nums">
                  {metrics.activeTasksCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tại 11 đơn vị
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/[0.04] space-y-1">
                <div className="text-xs font-medium text-rose-600">
                  Điểm nghẽn cần tháo gỡ
                </div>
                <div className="text-2xl font-bold text-rose-600 tabular-nums">
                  {metrics.bottlenecksCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  Quá hạn hoặc bị chặn
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/[0.04] space-y-1">
                <div className="text-xs font-medium text-indigo-600">
                  Chờ BGH phê duyệt
                </div>
                <div className="text-2xl font-bold text-indigo-600 tabular-nums">
                  {metrics.pendingInstitutionalApprovalCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tờ trình & báo cáo
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Department Rankings */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span>II. Tiến độ vận hành 11 đơn vị (Sắp xếp theo tỷ lệ hoàn thành)</span>
              </h3>
              <Badge variant="outline" className="text-xs">
                11/11 đơn vị
              </Badge>
            </div>

            <div className="border rounded-xl overflow-hidden bg-card text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-muted/50 text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3">Mã đơn vị</th>
                    <th className="py-2.5 px-3">Tên phòng / khoa</th>
                    <th className="py-2.5 px-3">Trưởng đơn vị</th>
                    <th className="py-2.5 px-3 text-center">Tổng việc</th>
                    <th className="py-2.5 px-3 text-center">Hoàn thành</th>
                    <th className="py-2.5 px-3 text-center">Chậm/Nghẽn</th>
                    <th className="py-2.5 px-3 text-right">Tiến độ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {sortedDepartments.map((dept) => {
                    const hasIssues =
                      dept.delayedTasks + dept.blockedTasks > 0 ||
                      dept.healthStatus === "RED";
                    return (
                      <tr
                        key={dept.departmentCode}
                        className={cn(
                          "hover:bg-muted/30 transition-colors",
                          hasIssues && "bg-rose-500/[0.02]"
                        )}
                      >
                        <td className="py-2.5 px-3 font-mono font-semibold text-foreground">
                          {dept.departmentCode}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-foreground">
                          {dept.departmentName}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {dept.leadName}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium tabular-nums">
                          {dept.totalTasks}
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-600 font-semibold tabular-nums">
                          {dept.completedTasks}
                        </td>
                        <td className="py-2.5 px-3 text-center tabular-nums">
                          {dept.delayedTasks + dept.blockedTasks > 0 ? (
                            <span className="font-semibold text-rose-600">
                              {dept.delayedTasks + dept.blockedTasks}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={cn(
                              "font-bold tabular-nums",
                              dept.completionRate >= 80
                                ? "text-emerald-600"
                                : dept.completionRate >= 50
                                  ? "text-amber-600"
                                  : "text-rose-600"
                            )}
                          >
                            {dept.completionRate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Critical Bottlenecks */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-rose-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>III. Danh sách điểm nghẽn trọng yếu cần BGH chỉ đạo</span>
              </h3>
              <Badge
                variant={bottlenecks.length > 0 ? "destructive" : "outline"}
                className="text-xs"
              >
                {bottlenecks.length} điểm nghẽn
              </Badge>
            </div>

            {bottlenecks.length === 0 ? (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] text-xs text-emerald-700">
                Toàn trường đang vận hành thông suốt, không ghi nhận điểm nghẽn nào cần BGH can thiệp giải tỏa.
              </div>
            ) : (
              <div className="space-y-2">
                {bottlenecks.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-rose-500/30 bg-card text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-rose-600">
                          #{idx + 1}
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-xs bg-muted"
                        >
                          {item.departmentCode}
                        </Badge>
                        <span className="font-semibold text-foreground">
                          {item.title}
                        </span>
                      </div>
                      <Badge
                        variant="destructive"
                        className="text-xs bg-rose-600"
                      >
                        {item.daysOverdue && item.daysOverdue > 0
                          ? `Trễ ${item.daysOverdue} ngày`
                          : "Bị tắc nghẽn"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>Đơn vị: {item.departmentName}</span>
                      <span>Người phụ trách: {item.assigneeName || "Chưa giao"}</span>
                      {item.blockedReason && (
                        <span className="text-rose-600 font-medium">
                          Lý do: {item.blockedReason}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Pending Approvals */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-indigo-600 flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                <span>IV. Tờ trình & hồ sơ chờ Ban Giám Hiệu phê duyệt</span>
              </h3>
              <Badge className="bg-indigo-600 text-white text-xs">
                {approvalQueue.length} hồ sơ
              </Badge>
            </div>

            {approvalQueue.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed text-xs text-muted-foreground text-center">
                Không có hồ sơ nào đang chờ ký duyệt ban hành.
              </div>
            ) : (
              <div className="space-y-2">
                {approvalQueue.map((doc, idx) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-xl border border-indigo-500/30 bg-card text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-indigo-600">
                          #{idx + 1}
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-xs bg-muted"
                        >
                          {doc.departmentCode}
                        </Badge>
                        <span className="font-semibold text-foreground">
                          {doc.title}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        Ngày trình: {doc.submittedDate || "Mới đây"}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      Người trình: {doc.submittedByName} ({doc.departmentName})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="print:hidden flex items-center justify-between p-4 border-t border-border/70 bg-muted/20">
          <div className="text-xs text-muted-foreground">
            Bản quyền hệ sinh thái số QCET · Phục vụ họp giao ban lãnh đạo
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopySummary}
              className="text-xs h-8 gap-1.5 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-semibold">Đã sao chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép tóm tắt</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportMarkdown}
              className="text-xs h-8 gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Markdown</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs h-8 gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In báo cáo</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={onClose}
              className="text-xs h-8 px-4 cursor-pointer"
            >
              Đóng
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
