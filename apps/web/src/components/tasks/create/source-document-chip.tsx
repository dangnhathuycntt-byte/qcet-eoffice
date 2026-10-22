"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROPERTY_PILL_CLASS } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MENU_OPTION_ROW_CLASS, MENU_POPUP_CLASS, MenuSheetHeader, SheetKeyboardSync, SHEET_BACKDROP_CLASS, SHEET_POPUP_CLASS, SHEET_POSITIONER_CLASS } from "@/components/ui/menu";

export interface SourceDocumentOption {
  id: string;
  /** Số, ký hiệu hiển thị trên chip */
  number: string;
  summary: string;
}

interface ApiDocumentRow {
  id: string;
  type?: string;
  status?: string;
  linkedTaskId?: string | null;
  originalNumber?: string | null;
  documentNumber?: string | null;
  registrationNumber?: number | null;
  documentYear?: number | null;
  summary?: string | null;
}

const UNLINK_OPTION: SourceDocumentOption = { id: "__unlink__", number: "", summary: "" };

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

  // Tải ngay khi chip hiện (không chờ mở) và tải lại mỗi lần mở/gõ: Combobox cần sẵn danh sách lúc bấm mở
  React.useEffect(() => {
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
        // Sổ đến có cả văn bản đi đơn vị khác gửi tới (ADR-015); chưa giao việc từ văn bản đó được vì mỗi văn bản chỉ
        // liên kết một nhiệm vụ, nên chỉ lấy văn bản đến như trước.
        setOptions(rows.filter((r) => r.type === "VAN_BAN_DEN" && !r.linkedTaskId && !UNLINKABLE_STATUSES.has(r.status ?? "")).map(toOption));
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
  // Mục "Bỏ gắn" đứng đầu danh sách (chọn được bằng bàn phím), chỉ có khi đã gắn văn bản
  const items = React.useMemo(() => (value ? [UNLINK_OPTION, ...options] : options), [value, options]);

  return (
    <Combobox.Root
      items={items}
      value={value}
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
      inputValue={query}
      onInputValueChange={setQuery}
      // Server đã lọc theo từ khóa
      filter={null}
      onValueChange={(next) => {
        onChange(!next || next.id === UNLINK_OPTION.id ? null : next);
        onOpenChange(false);
      }}
      itemToStringLabel={(opt) => opt.number}
      itemToStringValue={(opt) => opt.id}
      isItemEqualToValue={(a, b) => a.id === b.id}
      autoHighlight
    >
      <Combobox.Trigger
        aria-label={value ? `Văn bản nguồn: ${value.number}` : "Văn bản nguồn"}
        className={cn(PROPERTY_PILL_CLASS, !value && "text-muted-foreground max-md:aspect-square max-md:gap-0 max-md:px-0")}
      >
        <FileText className="text-muted-foreground" />
        <span className={cn("max-w-[140px] truncate", !value && "max-md:hidden")}>{label}</span>
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Backdrop className={SHEET_BACKDROP_CLASS} />
        <Combobox.Positioner className={cn("z-50", SHEET_POSITIONER_CLASS)} side="bottom" align="start" sideOffset={4} collisionPadding={12}>
          {/* Rộng hơn menu thường (384px) vì trích yếu là nội dung chính cần đọc được */}
          <Combobox.Popup
            aria-label="Chọn văn bản nguồn"
            className={cn("w-96 max-w-[var(--available-width)]", MENU_POPUP_CLASS, SHEET_POPUP_CLASS, "max-md:has-[[data-popup-open]]:visible")}
          >
            {open && <SheetKeyboardSync />}
            <MenuSheetHeader title="Văn bản nguồn" />
            <Combobox.Input
              aria-label="Tìm văn bản đến"
              placeholder="Tìm số, ký hiệu, trích yếu…"
              render={<Input variant="menu" className="mb-1 border-b border-border/60" />}
            />
            <Combobox.Empty>
              <div className={cn("px-2 py-1.5 text-xs", status === "error" ? "text-destructive" : "text-muted-foreground")}>
                {status === "loading"
                  ? "Đang tải văn bản…"
                  : status === "error"
                    ? "Không tải được danh sách văn bản"
                    : query.trim()
                      ? "Không tìm thấy văn bản phù hợp"
                      : "Không có văn bản đến nào chưa gắn nhiệm vụ"}
              </div>
            </Combobox.Empty>
            <Combobox.List className="max-h-64 overflow-y-auto overscroll-contain outline-none data-[empty]:p-0 max-md:max-h-[calc(55dvh-var(--keyboard-height,0px))]">
              {(opt: SourceDocumentOption) =>
                opt.id === UNLINK_OPTION.id ? (
                  <Combobox.Item key={opt.id} value={opt} className={cn(MENU_OPTION_ROW_CLASS, "text-muted-foreground")}>
                    <X className="size-4 shrink-0" />
                    <span>Bỏ gắn văn bản</span>
                  </Combobox.Item>
                ) : (
                  <Combobox.Item key={opt.id} value={opt} className={cn(MENU_OPTION_ROW_CLASS, "h-auto flex-col items-start gap-0.5 py-1.5")}>
                    {/* Trích yếu là tên văn bản: dòng chính, tối đa 2 dòng; số ký hiệu nhỏ mờ bên dưới */}
                    <span className="line-clamp-2 w-full break-words">{opt.summary || "Chưa có trích yếu"}</span>
                    <span className="w-full truncate text-muted-foreground tabular-nums">{opt.number}</span>
                  </Combobox.Item>
                )
              }
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
