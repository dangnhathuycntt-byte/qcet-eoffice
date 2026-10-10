"use client";

import * as React from "react";
import { FileText, UploadCloud, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  /** Giá trị cho thuộc tính `accept` của input, ví dụ ".pdf,.docx". */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  hint?: string;
  className?: string;
}

/** Vùng kéo thả hoặc bấm để chọn tệp. Dùng được bằng bàn phím (Enter hoặc Space mở hộp chọn tệp). */
export function FileDropzone({
  onFiles,
  accept,
  multiple = true,
  disabled,
  hint,
  className,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const emit = (list: FileList | null) => {
    if (list && list.length) onFiles(Array.from(list));
  };
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) emit(e.dataTransfer.files);
      }}
      data-dragging={dragging || undefined}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl bg-secondary px-6 py-8 text-center outline-none transition-colors duration-100 hover:bg-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 data-[dragging]:bg-selected aria-disabled:cursor-not-allowed aria-disabled:opacity-50 motion-reduce:transition-none",
        className,
      )}
    >
      <UploadCloud aria-hidden="true" className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Kéo thả tệp vào đây hoặc bấm để chọn</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export interface FileTileProps {
  name: string;
  /** Dung lượng hoặc thời gian tải lên (ví dụ: "2.4 MB"). */
  size?: string;
  meta?: string;
  href?: string;
  onDownload?: () => void;
  onRemove?: () => void;
  className?: string;
}

/**
 * Hiển thị tệp đính kèm tối giản: biểu tượng + tên gạch chân khi rê chuột + dung lượng.
 * Không đóng khung hộp, giữ giao diện thanh thoát chuẩn Nền tảng thiết kế QCET.
 */
export function FileTile({
  name,
  size,
  meta,
  href,
  onDownload,
  onRemove,
  className,
}: FileTileProps) {
  const metaText = size ?? meta;
  const isLink = Boolean(href || onDownload);

  return (
    <div
      className={cn(
        "group/file inline-flex max-w-full items-center gap-2 py-1 text-sm text-foreground",
        className,
      )}
    >
      <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      {isLink ? (
        <a
          href={href ?? "#"}
          onClick={(e) => {
            if (onDownload) {
              e.preventDefault();
              onDownload();
            }
          }}
          className="truncate font-normal text-foreground underline-offset-3 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1"
        >
          {name}
        </a>
      ) : (
        <span className="truncate font-normal text-foreground underline-offset-3 group-hover/file:underline">
          {name}
        </span>
      )}
      {metaText ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {metaText}
        </span>
      ) : null}
      {onDownload && !href ? (
        <button
          type="button"
          aria-label={`Tải xuống ${name}`}
          onClick={onDownload}
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground opacity-0 outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 relative before:absolute before:-inset-2 before:content-[''] touch-manipulation group-hover/file:opacity-100"
        >
          <Download className="size-3.5" />
        </button>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          aria-label={`Gỡ tệp ${name}`}
          onClick={onRemove}
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground opacity-0 outline-none transition-opacity hover:text-destructive focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 relative before:absolute before:-inset-2 before:content-[''] touch-manipulation group-hover/file:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export interface FileListProps {
  files: Array<{
    id: string;
    name: string;
    size?: string;
    meta?: string;
    href?: string;
  }>;
  onRemove?: (id: string) => void;
  onDownload?: (id: string) => void;
  className?: string;
}

/** Danh sách tệp đính kèm dạng hàng tối giản không khung thẻ. */
export function FileList({ files, onRemove, onDownload, className }: FileListProps) {
  if (!files || files.length === 0) return null;
  return (
    <div className={cn("flex flex-col divide-y divide-border/40", className)}>
      {files.map((file) => (
        <FileTile
          key={file.id}
          name={file.name}
          size={file.size}
          meta={file.meta}
          href={file.href}
          onDownload={onDownload ? () => onDownload(file.id) : undefined}
          onRemove={onRemove ? () => onRemove(file.id) : undefined}
          className="py-1.5"
        />
      ))}
    </div>
  );
}
