"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, Loader2, AlertCircle } from "lucide-react";

/**
 * Tính toán offset ký tự trong toàn bộ chu���i văn bản của container
 * dựa trên targetNode và offset trả về từ CaretPosition hoặc Range.
 */
export function getTextOffsetInContainer(
  container: Node,
  targetNode: Node,
  targetOffset: number
): number {
  let charCount = 0;

  function traverse(node: Node): boolean {
    if (node === targetNode) {
      charCount += targetOffset;
      return true;
    }

    // Node.TEXT_NODE === 3 trong chuẩn DOM W3C
    if (node.nodeType === 3) {
      charCount += (node.textContent || "").length;
    } else if (node.nodeName === "BR") {
      charCount += 1;
    }

    for (let i = 0; i < node.childNodes.length; i++) {
      if (traverse(node.childNodes[i])) {
        return true;
      }
    }

    return false;
  }

  traverse(container);
  return charCount;
}

/**
 * Xác định vị trí ký tự từ tọa độ chuột (clientX, clientY)
 * sử dụng native browser APIs (caretPositionFromPoint / caretRangeFromPoint).
 */
export function getCaretFromPoint(
  x: number,
  y: number,
  container: HTMLElement
): number | null {
  if (typeof document === "undefined") return null;

  try {
    // 1. Chuẩn W3C hiện đại (Firefox, Chrome 128+)
    if (typeof (document as any).caretPositionFromPoint === "function") {
      const pos = (document as any).caretPositionFromPoint(x, y);
      if (pos && pos.offsetNode && container.contains(pos.offsetNode)) {
        return getTextOffsetInContainer(container, pos.offsetNode, pos.offset);
      }
    }

    // 2. WebKit / Blink (Chrome, Safari, Edge)
    if (typeof (document as any).caretRangeFromPoint === "function") {
      const range = (document as any).caretRangeFromPoint(x, y);
      if (range && range.startContainer && container.contains(range.startContainer)) {
        return getTextOffsetInContainer(container, range.startContainer, range.startOffset);
      }
    }
  } catch {
    // Fallback an toàn nếu trình duyệt chặn hoặc sandbox
  }

  return null;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface DirectInlineEditorProps {
  /** Giá trị hiện tại */
  value: string;
  /** Callback lưu dữ liệu */
  onSave: (newValue: string) => Promise<void> | void;
  /** Cho phép chỉnh sửa hay chỉ đọc */
  canEdit?: boolean;
  /** Cho phép xuống dòng (nhiều dòng) */
  multiline?: boolean;
  /** Thẻ HTML khi ở chế độ view */
  as?: "h1" | "h2" | "h3" | "div" | "p";
  /** Văn bản placeholder khi rỗng */
  placeholder?: string;
  /** Label trợ năng */
  ariaLabel?: string;
  /** Class chung */
  className?: string;
  /** Class cho chế độ View */
  viewClassName?: string;
  /** Class cho chế độ Editor (textarea) */
  editorClassName?: string;
  /** Thời gian debounce tự động lưu (ms), mặc định 800ms */
  autoSaveDebounceMs?: number;
  /** Nhấn Enter để lưu (mặc định true cho tiêu đề 1 dòng, false cho multiline) */
  submitOnEnter?: boolean;
  /** Số dòng tối thiểu */
  minRows?: number;
  /** Hiển thị trạng thái lưu nhẹ nhàng */
  showSaveIndicator?: boolean;
}

export function DirectInlineEditor({
  value,
  onSave,
  canEdit = true,
  multiline = false,
  as = multiline ? "div" : "h1",
  placeholder = "Nhập nội dung...",
  ariaLabel = "Chỉnh sửa nội dung",
  className,
  viewClassName,
  editorClassName,
  autoSaveDebounceMs = 800,
  submitOnEnter = !multiline,
  minRows = 1,
  showSaveIndicator = true,
}: DirectInlineEditorProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = React.useState("");

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const viewContainerRef = React.useRef<HTMLElement>(null);
  const pendingSelectionRef = React.useRef<{ start: number; end: number } | null>(null);

  const isComposingRef = React.useRef(false);
  const isFocusedRef = React.useRef(false);
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastSavedValueRef = React.useRef(value);

  // Đồng bộ prop value từ ngoài vào draft khi KHÔNG focus/editing
  React.useEffect(() => {
    if (!isFocusedRef.current) {
      setDraft(value);
      lastSavedValueRef.current = value;
    }
  }, [value]);

  // Dọn dẹp timer khi unmount
  React.useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Hàm tự động co giãn chiều cao của textarea
  const adjustTextareaHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 24)}px`;
  }, []);

  // Hàm thực thi lưu
  const executeSave = React.useCallback(
    async (valToSave: string) => {
      const trimmed = valToSave.trim();
      if (trimmed === lastSavedValueRef.current.trim()) {
        return;
      }
      try {
        setSaveStatus("saving");
        setErrorMessage("");
        await onSave(trimmed);
        lastSavedValueRef.current = trimmed;
        setSaveStatus("saved");
        setTimeout(() => {
          setSaveStatus((prev) => (prev === "saved" ? "idle" : prev));
        }, 2000);
      } catch (err: unknown) {
        setSaveStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Chưa lưu được. Nội dung vẫn được giữ lại.");
      }
    },
    [onSave]
  );

  // Lên lịch autosave với debounce
  const scheduleAutosave = React.useCallback(
    (valToSave: string) => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      // Không autosave giữa chừng khi đang ghép dấu tiếng Việt (IME)
      if (isComposingRef.current) return;

      autoSaveTimerRef.current = setTimeout(() => {
        executeSave(valToSave);
      }, autoSaveDebounceMs);
    },
    [autoSaveDebounceMs, executeSave]
  );

  // Kích hoạt editor khi click vào văn bản (View mode)
  const handleViewClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!canEdit) return;

    const container = viewContainerRef.current;
    if (!container) return;

    let start = draft.length;
    let end = draft.length;
    let hasExplicitPosition = false;

    // 1. Kiểm tra text selection hiện tại (double-click chọn từ hoặc kéo bôi đen)
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (container.contains(range.startContainer) && container.contains(range.endContainer)) {
        const startOffset = getTextOffsetInContainer(container, range.startContainer, range.startOffset);
        const endOffset = getTextOffsetInContainer(container, range.endContainer, range.endOffset);
        start = Math.min(startOffset, endOffset);
        end = Math.max(startOffset, endOffset);
        hasExplicitPosition = true;
      }
    }

    // 2. Nếu click đơn (selection collapsed), dùng API xác định caret từ tọa độ click
    if (!hasExplicitPosition || start === end) {
      const pointCaret = getCaretFromPoint(e.clientX, e.clientY, container);
      if (pointCaret !== null) {
        start = pointCaret;
        end = pointCaret;
        hasExplicitPosition = true;
      }
    }

    // Giới hạn trong phạm vi hợp lệ của chuỗi
    start = Math.max(0, Math.min(start, draft.length));
    end = Math.max(0, Math.min(end, draft.length));

    pendingSelectionRef.current = { start, end };
    setIsEditing(true);
  };

  // Đồng bộ caret ngay khi textarea mount (useLayoutEffect để không bị nháy con trỏ)
  React.useLayoutEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;
      adjustTextareaHeight();
      textarea.focus();

      if (pendingSelectionRef.current) {
        const { start, end } = pendingSelectionRef.current;
        textarea.setSelectionRange(start, end);
        pendingSelectionRef.current = null;
      }
    }
  }, [isEditing, adjustTextareaHeight]);

  // Cập nhật chiều cao khi draft thay đổi
  React.useEffect(() => {
    if (isEditing) {
      adjustTextareaHeight();
    }
  }, [draft, isEditing, adjustTextareaHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setDraft(nextVal);
    adjustTextareaHeight();
    scheduleAutosave(nextVal);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = async () => {
    isFocusedRef.current = false;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    await executeSave(draft);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Nhấn Escape: lưu và thoát chỉnh sửa
    if (e.key === "Escape") {
      e.preventDefault();
      textareaRef.current?.blur();
      return;
    }

    // Nhấn Enter (đối với tiêu đề): lưu và thoát
    if (submitOnEnter && e.key === "Enter" && !e.shiftKey) {
      // Đảm bảo không ngắt khi đang gõ tiếng Việt IME
      if (!e.nativeEvent.isComposing && !isComposingRef.current) {
        e.preventDefault();
        textareaRef.current?.blur();
      }
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    scheduleAutosave(e.currentTarget.value);
  };

  const Tag = as as any;

  return (
    <div className={cn("relative w-full group/editor", className)}>
      {isEditing ? (
        <div className="w-full relative">
          <textarea
            ref={textareaRef}
            value={draft}
            rows={minRows}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            aria-label={ariaLabel}
            placeholder={placeholder}
            className={cn(
              "block w-full bg-transparent p-0 m-0 border-0 outline-none focus:outline-none focus:ring-0 resize-none overflow-hidden cursor-text whitespace-pre-wrap break-words",
              editorClassName
            )}
          />

          {/* Chỉ báo trạng thái lưu góc trên/dưới */}
          {showSaveIndicator && (
            <div className="absolute right-0 top-0 -translate-y-5 flex items-center gap-1 text-[11px] font-normal transition-opacity duration-200 pointer-events-none select-none">
              {saveStatus === "saving" && (
                <span className="inline-flex items-center gap-1 text-muted-foreground animate-pulse">
                  <Loader2 className="size-3 animate-spin" />
                  <span>Đang lưu...</span>
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <Check className="size-3" />
                  <span>Đã lưu</span>
                </span>
              )}
              {saveStatus === "error" && (
                <span className="inline-flex items-center gap-1 text-rose-600">
                  <AlertCircle className="size-3" />
                  <span>{errorMessage || "Lỗi lưu"}</span>
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full relative">
          <Tag
            ref={viewContainerRef}
            onClick={handleViewClick}
            className={cn(
              "block w-full cursor-text select-text transition-colors p-0 m-0",
              canEdit && "hover:text-foreground/85",
              viewClassName
            )}
            title={canEdit ? "Nhấp vào vị trí bất kỳ để chỉnh sửa" : undefined}
          >
            {draft ? (
              <span className="whitespace-pre-wrap break-words">{draft}</span>
            ) : (
              <span className="text-muted-foreground/50 italic select-none">
                {placeholder}
              </span>
            )}
          </Tag>
        </div>
      )}
    </div>
  );
}
