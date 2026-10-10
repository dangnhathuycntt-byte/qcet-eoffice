"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface AdministrativeHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  parentAgency?: string;
  agencyName: string;
  documentNumber?: string;
  location?: string;
  date?: string | Date;
  documentType?: string;
  subject?: string;
  isDraft?: boolean;
}

/**
 * Thành phần thể thức đầu trang văn bản hành chính chuẩn Nghị định 30/2020/NĐ-CP.
 * Bao gồm Quốc hiệu, Tiêu ngữ, Tên cơ quan, Số/Ký hiệu, Địa danh ngày tháng và Trích yếu.
 */
export function AdministrativeHeader({
  parentAgency = "ỦY BAN NHÂN DÂN THÀNH PHỐ",
  agencyName = "TRƯỜNG CĐ KT-KT QUẢNG CHÂU",
  documentNumber = "Số: .../QCET-TB",
  location = "Quảng Châu",
  date = new Date(),
  documentType,
  subject,
  isDraft = false,
  className,
  ...props
}: AdministrativeHeaderProps) {
  const formattedDate = React.useMemo(() => {
    if (!date) return "ngày ... tháng ... năm ...";
    if (typeof date === "string") return date;
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const y = date.getFullYear();
    return `ngày ${d} tháng ${m} năm ${y}`;
  }, [date]);

  return (
    <header
      className={cn(
        "font-serif text-foreground leading-tight select-text print:text-black",
        className
      )}
      {...props}
    >
      {/* Khối đầu văn bản: 2 cột */}
      <div className="grid grid-cols-2 gap-4 pb-4">
        {/* Cột trái: Cơ quan ban hành & Số hiệu */}
        <div className="flex flex-col items-center text-center">
          {parentAgency ? (
            <span className="text-xs font-normal uppercase text-muted-foreground">
              {parentAgency}
            </span>
          ) : null}
          <span className="text-compact font-semibold uppercase">
            {agencyName}
          </span>
          <div className="my-1.5 h-[1px] w-1/3 bg-foreground/60" aria-hidden="true" />
          <span className="text-compact font-normal">
            {documentNumber}
          </span>
        </div>

        {/* Cột phải: Quốc hiệu, Tiêu ngữ & Ngày tháng */}
        <div className="flex flex-col items-center text-center">
          <span className="text-compact font-semibold uppercase">
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </span>
          <span className="text-compact font-semibold">
            Độc lập - Tự do - Hạnh phúc
          </span>
          <div className="my-1.5 h-[1px] w-1/2 bg-foreground/60" aria-hidden="true" />
          <span className="text-compact italic text-muted-foreground">
            {location}, {formattedDate}
          </span>
        </div>
      </div>

      {/* Tên loại văn bản và Trích yếu nội dung */}
      {documentType || subject ? (
        <div className="my-4 text-center">
          {documentType ? (
            <h1 className="text-base font-semibold uppercase">
              {documentType}
            </h1>
          ) : null}
          {subject ? (
            <p className="mt-1 text-sm font-semibold italic">
              V/v {subject}
            </p>
          ) : null}
        </div>
      ) : null}

      {isDraft ? (
        <div className="inline-block rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
          Bản dự thảo - Chưa ký ban hành
        </div>
      ) : null}
    </header>
  );
}

export interface DocumentRecipientsProps extends React.HTMLAttributes<HTMLDivElement> {
  recipients?: string[];
  signerTitle?: string;
  signerName?: string;
  signatureStamp?: React.ReactNode;
}

/**
 * Phần Nơi nhận và Khối chữ ký cuối văn bản chuẩn hành chính.
 */
export function DocumentFooter({
  recipients = ["Như Điều 3;", "Ban Giám hiệu;", "Lưu: VT, PĐT."],
  signerTitle = "HIỆU TRƯỞNG",
  signerName,
  signatureStamp,
  className,
  ...props
}: DocumentRecipientsProps) {
  return (
    <footer
      className={cn(
        "grid grid-cols-2 gap-4 pt-6 font-serif text-foreground leading-relaxed print:text-black",
        className
      )}
      {...props}
    >
      {/* Cột trái: Nơi nhận */}
      <div className="text-xs">
        <p className="font-semibold italic">Nơi nhận:</p>
        <ul className="list-none pl-0 flex flex-col gap-0.5">
          {recipients.map((item, idx) => (
            <li key={idx}>- {item}</li>
          ))}
        </ul>
      </div>

      {/* Cột phải: Thẩm quyền ký & Chữ ký */}
      <div className="flex flex-col items-center text-center">
        <p className="text-compact font-semibold uppercase">{signerTitle}</p>
        <div className="my-3 min-h-[56px] flex items-center justify-center">
          {signatureStamp ?? (
            <span className="text-xs italic text-muted-foreground">[Chữ ký số]</span>
          )}
        </div>
        {signerName ? (
          <p className="text-compact font-semibold">{signerName}</p>
        ) : null}
      </div>
    </footer>
  );
}
