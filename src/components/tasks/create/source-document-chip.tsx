"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { ChevronDown, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { MenuSheetHeader, SHEET_BACKDROP_CLASS, SHEET_POPUP_CLASS, SHEET_POSITIONER_CLASS } from "@/components/ui/menu";

export interface SourceDocumentOption {
  id: string;
  /** Số, ký hiệu hiển thị trên chip */
  number: string;
  summary: string;
}

interface ApiDocumentRow {
  id: string;
  status?: string;
  linkedTaskId?: string | null;
  originalNumber?: string | null;
  documentNumber?: string | null;
  registrationNumber?: number | null;
  documentYear?: number | null;
  summary?: string | null;
}

// Văn bản đã hoàn thành/lưu theo dõi là bất biến: server từ chối gắn, nên không mời chọn
const UNLINKABLE_STATUSES = new Set(["DA_HOAN_THANH", "LUU_THEO_DOI"]);

function toOption(row: ApiDocumentRow): SourceDocumentOption {
  const number =
    row.originalNumber ||
    row.documentNumber ||
    (row.registrationNumber ? `${row.registrationNumber}/${row.documentYear ?? new Date().getFullYear()}` : "");
  return { id: row.id, number: number || "Chưa có số", summary: row.summary ?? "" };
}

/** Gắn nhiệm vụ vừa tạo vào văn bản qua API cập nhật văn bản (server kiểm quyền, văn bản bất biến, một văn bản một nhiệm vụ). */
export async function linkTaskToDocument(documentId: string, taskId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ linkedTaskId: taskId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

interface SourceDocumentChipProps {
  value: SourceDocumentOption | null;
  onChange: (next: SourceDocumentOption | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Chip "Văn bản" của hộp tạo nhiệm vụ: chọn một văn bản đến chưa gắn nhiệm vụ làm văn bản nguồn.
 * Điện thoại: chưa chọn thì chỉ hiện nút tròn có icon như các chip khác.
 */
export function SourceDocumentChip({ value, onChange, open, onOpenChange }: SourceDocumentChipProps) {
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<SourceDocumentOption[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");

  React.useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setStatus("loading");
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ type: "VAN_BAN_DEN", page: "1", pageSize: "20" });
        if (query.trim()) params.set("search", query.trim());
        const res = await fetch(`/api/documents?${params.toString()}`, { signal: ctrl.signal, credentials: "include" });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        const rows: ApiDocumentRow[] = Array.isArray(json.data) ? json.data : [];
        setOptions(rows.filter((r) => !r.linkedTaskId && !UNLINKABLE_STATUSES.has(r.status ?? "")).map(toOption));
        setStatus("idle");
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") setStatus("error");
      }
    }, query ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [open, query]);

  const label = value ? value.number : "Văn bản";

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <div className="relative">
        <Popover.Trigger
          type="button"
          aria-label={value ? `Văn bản nguồn: ${value.number}` : "Văn bản nguồn"}
          title={value ? `Văn bản nguồn: ${value.number}` : "Gắn văn bản nguồn"}
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium border transition-all duration-150 cursor-pointer select-none",
            !value && "max-md:size-7 max-md:justify-center max-md:gap-0 max-md:rounded-full max-md:px-0",
            open ? "border-border bg-accent text-foreground shadow-2xs" : "border-transparent bg-muted/60 hover:bg-accent text-foreground",
          )}
        >
          <FileText className="size-3 shrink-0 text-muted-foreground max-md:size-3.5" />
          <span className={cn("max-w-[140px] truncate", !value && "text-muted-foreground max-md:hidden")}>{label}</span>
          <ChevronDown
            className={cn(
              "size-2.5 text-muted-foreground transition-transform duration-200 ease-out",
              !value && "max-md:hidden",
              open && "rotate-180 text-foreground",
            )}
          />
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Backdrop className={SHEET_BACKDROP_CLASS} />
          <Popover.Positioner className={cn("z-50", SHEET_POSITIONER_CLASS)} align="start" sideOffset={4} collisionPadding={12}>
            <Popover.Popup
              style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }}
              className={cn("w-72 p-1 rounded-xl border border-border bg-popover shadow-2xl", SHEET_POPUP_CLASS, "max-md:border-0")}
              aria-label="Chọn văn bản nguồn"
            >
              <MenuSheetHeader title="Văn bản nguồn" />
              <Input
                compact
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm số, ký hiệu, trích yếu…"
                aria-label="Tìm văn bản đến"
                className="mb-1 text-xs max-md:h-8"
              />
              <div className="max-h-60 space-y-0.5 overflow-y-auto overscroll-contain">
                {value ? (
                  <Pressable
                    onClick={() => {
                      onChange(null);
                      onOpenChange(false);
                    }}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent/70 max-md:min-h-10 max-md:text-compact"
                  >
                    Bỏ văn bản nguồn
                  </Pressable>
                ) : null}
                {status === "loading" && options.length === 0 ? (
                  <div className="px-3 py-3 text-center text-xs text-muted-foreground">Đang tải văn bản…</div>
                ) : status === "error" ? (
                  <div className="px-3 py-3 text-center text-xs text-destructive">Không tải được danh sách văn bản</div>
                ) : options.length === 0 ? (
                  <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                    Không có văn bản đến nào chưa gắn nhiệm vụ
                  </div>
                ) : (
                  options.map((opt) => (
                    <Pressable
                      key={opt.id}
                      onClick={() => {
                        onChange(opt);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "flex w-full flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors max-md:min-h-10",
                        value?.id === opt.id ? "bg-accent" : "hover:bg-accent/70",
                      )}
                    >
                      <span className={cn("truncate text-xs text-foreground max-md:text-compact", value?.id === opt.id && "font-medium")}>{opt.number}</span>
                      {opt.summary ? <span className="line-clamp-2 text-xs text-muted-foreground">{opt.summary}</span> : null}
                    </Pressable>
                  ))
                )}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </div>
    </Popover.Root>
  );
}
