"use client";

import * as React from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import {
  X,
  Keyboard,
  Search,
  Command,
  Eye,
  CheckSquare,
  ListTodo,
  Calendar,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { shouldIgnoreShortcut } from "@/lib/shortcuts/guards";

interface ShortcutGroup {
  id: string;
  title: string;
  icon: React.ElementType;
  shortcuts: {
    label: string;
    keys: string[];
    description?: string;
  }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: "global",
    title: "Toàn cục & Điều hướng",
    icon: Command,
    shortcuts: [
      { label: "Mở menu lệnh / Tìm kiếm", keys: ["⌘", "K"], description: "Ctrl + K trên Windows" },
      { label: "Bảng tra cứu phím tắt", keys: ["?"], description: "Hoặc ⌘ /" },
      { label: "Giao việc / Tạo nhiệm vụ mới", keys: ["C"] },
      { label: "Đóng cửa sổ / Hủy chọn", keys: ["Esc"] },
    ],
  },
  {
    id: "task-table",
    title: "Bảng nhiệm vụ & Triage",
    icon: ListTodo,
    shortcuts: [
      { label: "Xem nhanh (Peek Preview)", keys: ["Space"], description: "Rê chuột vào dòng hoặc chọn rồi nhấn Space" },
      { label: "Di chuyển dòng kế tiếp", keys: ["J"], description: "Hoặc phím mũi tên Xuống ↓" },
      { label: "Di chuyển dòng trước đó", keys: ["K"], description: "Hoặc phím mũi tên Lên ↑" },
      { label: "Mở toàn màn hình chi tiết", keys: ["Enter"] },
      { label: "Chọn / Bỏ chọn dòng", keys: ["X"], description: "Kích hoạt thanh thao tác hàng loạt" },
      { label: "Tìm kiếm nhanh trong bảng", keys: ["/"] },
    ],
  },
  {
    id: "quick-actions",
    title: "Thao tác trên nhiệm vụ",
    icon: Sparkles,
    shortcuts: [
      { label: "Đổi trạng thái", keys: ["S"], description: "Khi đang mở Context menu hoặc Detail" },
      { label: "Đổi mức độ ưu tiên", keys: ["P"] },
      { label: "Gia hạn / Đổi hạn hoàn thành", keys: ["E"] },
    ],
  },
];

export function GlobalShortcutsModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Listen to custom trigger event or keypress
  React.useEffect(() => {
    const handleOpenModal = () => setIsOpen(true);
    const handleCloseModal = () => setIsOpen(false);

    window.addEventListener("qcet:open-shortcuts", handleOpenModal);
    window.addEventListener("qcet:close-shortcuts", handleCloseModal);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Bỏ qua khi đang focus trong input/textarea/editor
      if (shouldIgnoreShortcut(e)) return;

      // Nhấn ? (Shift + /) hoặc ⌘/
      if (e.key === "?" || (e.key === "/" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // Nhấn Esc để đóng modal
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("qcet:open-shortcuts", handleOpenModal);
      window.removeEventListener("qcet:close-shortcuts", handleCloseModal);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Reset search khi đóng
  React.useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  const filteredGroups = React.useMemo(() => {
    if (!searchQuery.trim()) return SHORTCUT_GROUPS;
    const q = searchQuery.toLowerCase().trim();
    return SHORTCUT_GROUPS.map((group) => {
      const filtered = group.shortcuts.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          s.keys.some((k) => k.toLowerCase().includes(q)) ||
          s.description?.toLowerCase().includes(q)
      );
      return { ...group, shortcuts: filtered };
    }).filter((group) => group.shortcuts.length > 0);
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none">
        {/* Backdrop */}
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs"
          onClick={() => setIsOpen(false)}
        />

        {/* Modal Container */}
        <m.div
          role="dialog"
          aria-modal="true"
          aria-label="Bảng tra cứu phím tắt bàn phím"
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-zinc-900 shadow-2xl flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/[0.08] dark:border-white/[0.08] px-4 py-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                <Keyboard size={14} strokeWidth={1.75} />
              </div>
              <h2 className="text-sm font-semibold text-foreground tracking-tight">
                Phím tắt bàn phím
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              aria-label="Đóng bảng phím tắt (Esc)"
            >
              <X size={15} strokeWidth={1.5} />
            </button>
          </div>

          {/* Quick Search in Shortcuts */}
          <div className="border-b border-black/[0.06] dark:border-white/[0.06] px-4 py-2 flex items-center gap-2 bg-background">
            <Search size={14} className="text-muted-foreground/60 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm phím tắt (Space, J, K, C, ⌘K...)"
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Body List */}
          <div className="overflow-y-auto p-4 space-y-5 thin-scrollbar flex-1">
            {filteredGroups.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Không tìm thấy phím tắt phù hợp với từ khóa &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filteredGroups.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground/75 tracking-tight px-1">
                      <Icon size={13} strokeWidth={1.5} className="text-muted-foreground/60" />
                      <span>{group.title}</span>
                    </div>

                    <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.04] dark:divide-white/[0.04] bg-muted/[0.12] overflow-hidden">
                      {group.shortcuts.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-foreground text-[12.5px] tracking-tight truncate">
                              {item.label}
                            </span>
                            {item.description && (
                              <span className="text-[10.5px] text-muted-foreground/70">
                                {item.description}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {item.keys.map((key, kIdx) => (
                              <kbd
                                key={kIdx}
                                className={cn(
                                  "inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-[4px] font-mono text-[11px] font-medium leading-none",
                                  "bg-white dark:bg-zinc-800 text-foreground border border-black/15 dark:border-white/20 shadow-2xs"
                                )}
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Note */}
          <div className="border-t border-black/[0.08] dark:border-white/[0.08] px-4 py-2 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Nhấn <kbd className="px-1 py-0.5 font-mono text-[10px] bg-background rounded border border-border/80 text-foreground">?</kbd> bất cứ lúc nào để mở bảng này
            </span>
            <span className="font-mono text-[10.5px]">QCET Work</span>
          </div>
        </m.div>
      </div>
    </AnimatePresence>
  );
}
export default GlobalShortcutsModal;
