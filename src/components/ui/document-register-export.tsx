"use client";

import * as React from "react";
import { FileSpreadsheet, FileText, Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExportFormat = "xlsx" | "pdf";
export type RegisterType = "incoming" | "outgoing" | "submissions" | "internal";

export interface DocumentRegisterExportProps {
  defaultRegisterType?: RegisterType;
  totalRecords?: number;
  year?: number;
  onExport: (options: { registerType: RegisterType; format: ExportFormat; year: number }) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

/**
 * Panel xuất sổ theo dõi văn bản đi/đến chuẩn mẫu hành chính nhà nước.
 */
export function DocumentRegisterExport({
  defaultRegisterType = "incoming",
  totalRecords = 412,
  year = 2026,
  onExport,
  onCancel,
  isLoading = false,
}: DocumentRegisterExportProps) {
  const [registerType, setRegisterType] = React.useState<RegisterType>(defaultRegisterType);
  const [format, setFormat] = React.useState<ExportFormat>("xlsx");
  const [selectedYear, setSelectedYear] = React.useState<number>(year);

  const registerLabels: Record<RegisterType, string> = {
    incoming: "Sổ theo dõi văn bản đến",
    outgoing: "Sổ đăng ký văn bản đi",
    submissions: "Sổ theo dõi tờ trình & văn bản nội bộ",
    internal: "Sổ công văn chỉ đạo điều hành",
  };

  return (
    <div className="flex flex-col gap-5 rounded-2xl border-0 bg-card p-6 shadow-none">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-foreground">Xuất sổ đăng ký văn bản</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Trích xuất dữ liệu lưu trữ theo mẫu quy định của Nghị định số 30/2020/NĐ-CP
        </p>
      </div>

      {/* Loại sổ */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Loại sổ văn bản</label>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(registerLabels) as RegisterType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setRegisterType(type)}
              className={cn(
                "flex items-center justify-between rounded-xl border-0 px-3 py-2 text-left text-xs transition-colors duration-100 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary",
                registerType === type
                  ? "bg-selected font-semibold text-foreground"
                  : "bg-secondary text-foreground hover:bg-accent"
              )}
            >
              <span>{registerLabels[type]}</span>
              {registerType === type ? <Check className="size-3.5 shrink-0" /> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Định dạng tệp */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Định dạng trích xuất</label>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFormat("xlsx")}
            className={cn(
              "flex items-center gap-3 rounded-xl border-0 p-3 text-left transition-colors duration-100 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary",
              format === "xlsx"
                ? "bg-selected text-foreground font-semibold"
                : "bg-secondary text-foreground hover:bg-accent"
            )}
          >
            <FileSpreadsheet className="size-5 text-foreground" />
            <div>
              <div className="text-xs font-semibold">Bảng tính Excel (.xlsx)</div>
              <div className="text-xs text-muted-foreground">Đầy đủ cột dữ liệu & trích yếu</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFormat("pdf")}
            className={cn(
              "flex items-center gap-3 rounded-xl border-0 p-3 text-left transition-colors duration-100 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary",
              format === "pdf"
                ? "bg-selected text-foreground font-semibold"
                : "bg-secondary text-foreground hover:bg-accent"
            )}
          >
            <FileText className="size-5 text-foreground" />
            <div>
              <div className="text-xs font-semibold">Tài liệu PDF in ấn</div>
              <div className="text-xs text-muted-foreground">Đúng khuôn sổ lưu trữ văn thư</div>
            </div>
          </button>
        </div>
      </div>

      {/* Phạm vi & Tổng quan */}
      <div className="rounded-xl bg-secondary p-3.5 text-xs text-foreground flex items-center justify-between">
        <div>
          <span className="text-muted-foreground">Phạm vi thời gian: </span>
          <strong className="font-semibold">Năm {selectedYear}</strong>
        </div>
        <div className="rounded-lg bg-card border-0 px-2.5 py-1 text-xs font-medium text-foreground">
          Tổng cộng: <span className="tabular-nums font-semibold text-primary">{totalRecords.toLocaleString("vi-VN")}</span> văn bản
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-xl border-0 bg-secondary px-3.5 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors duration-100 disabled:opacity-50"
          >
            Đóng
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onExport({ registerType, format, year: selectedYear })}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-xl border-0 bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors duration-100 hover:opacity-90 disabled:opacity-50"
        >
          <Download className="size-3.5" />
          {isLoading ? "Đang kết xuất dữ liệu..." : "Tải xuống sổ văn bản"}
        </button>
      </div>
    </div>
  );
}
