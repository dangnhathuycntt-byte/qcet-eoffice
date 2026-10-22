"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldFocusRingClass } from "@/components/ui/focus-ring";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Automatically expands height as content grows (Components5.dc.html) */
  autoResize?: boolean;
  /** Displays remaining / total character counter */
  showCount?: boolean;
  /** Maximum character limit for counter (defaults to maxLength attribute if omitted) */
  maxCharacters?: number;
  /** Chỉ hiện bộ đếm khi còn ≤ 20 ký tự (form gọn trong popover); mặc định luôn hiện khi có giới hạn. */
  countOnlyNearLimit?: boolean;
  /** compact: chữ 13px, đệm gọn, không đặt chiều cao tối thiểu 96px, không có tay kéo đổi cỡ (form gọn trong hộp thoại/popover; cao hơn thì đặt `min-h-*`). Mặc định giữ nguyên. */
  compact?: boolean;
  /** bare: không nền, không đệm ngang, không viền focus; ô soạn hòa vào hộp như phần mô tả của hộp tạo việc. Dùng kèm `compact`. */
  variant?: "field" | "bare";
  /**
   * Tô màu một phần chữ ngay trong ô (ví dụ tên được nhắc): lớp chữ trùng khít cỡ chữ, đệm, ngắt dòng đè lên ô, chữ của ô
   * trong suốt, con trỏ và vùng chọn vẫn là của ô. Chỉ đổi màu, không đổi độ đậm hay cỡ để chữ không lệch con trỏ.
   * Cần `value` (ô có điều khiển).
   */
  renderHighlight?: (value: string) => React.ReactNode;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      autoResize = false,
      showCount = false,
      maxCharacters,
      countOnlyNearLimit = false,
      compact = false,
      variant = "field",
      renderHighlight,
      maxLength,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref,
  ) => {
    const internalRef = React.useRef<HTMLTextAreaElement | null>(null);
    const limit = maxCharacters ?? maxLength;
    const [typedCount, setTypedCount] = React.useState<number>(() =>
      typeof defaultValue === "string" ? defaultValue.length : 0,
    );
    // Có `value` thì đếm theo value: form tự xóa nội dung sau khi gửi hoặc dữ liệu tải về sau vẫn ra đúng số
    const charCount = value != null ? String(value).length : typedCount;

    React.useImperativeHandle(ref, () => internalRef.current!);

    const adjustHeight = React.useCallback(() => {
      if (!autoResize || !internalRef.current) return;
      const el = internalRef.current;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [autoResize]);

    React.useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setTypedCount(e.target.value.length);
      adjustHeight();
      onChange?.(e);
    };

    const remaining = limit !== undefined ? limit - charCount : null;
    const isNearLimit = remaining !== null && remaining <= 20;
    const showCounter = limit !== undefined && !(countOnlyNearLimit && !isNearLimit);
    const highlightText = renderHighlight && typeof value === "string" ? value : null;
    const metricClass = compact ? "px-2 py-1.5 text-compact" : "px-3.5 py-3 text-base sm:text-sm";

    const field = (
      <textarea
        ref={internalRef}
        data-slot="textarea"
        value={value}
        defaultValue={defaultValue}
        maxLength={limit}
        onChange={handleChange}
        className={cn(
          `w-full rounded-control border-0 bg-secondary text-foreground placeholder:text-faint outline-none transition-colors duration-100 hover:bg-accent ${fieldFocusRingClass} focus-visible:bg-selected aria-invalid:bg-danger-soft aria-invalid:text-destructive read-only:bg-transparent read-only:hover:bg-transparent read-only:focus-visible:bg-transparent read-only:cursor-default read-only:select-text disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none`,
          compact ? "min-h-8 px-2 py-1.5 text-compact sm:min-h-7" : "min-h-24 px-3.5 py-3 text-base sm:text-sm",
          autoResize ? "resize-none overflow-hidden" : compact ? "resize-none" : "resize-y",
          variant === "bare" &&
            "rounded-none bg-transparent px-0 hover:bg-transparent focus-visible:bg-transparent focus-visible:outline-none aria-invalid:bg-transparent",
          className,
          highlightText !== null && "text-transparent caret-foreground",
        )}
        {...props}
      />
    );

    const textareaElement = highlightText === null ? field : (
      // flex: ô (inline-block) không chừa khe dưới đường chân chữ, lớp bọc cao đúng bằng ô
      <div className="relative flex w-full flex-col">
        {field}
        <div
          aria-hidden
          data-slot="textarea-highlight"
          className={cn(
            metricClass,
            className,
            "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words bg-transparent text-foreground hover:bg-transparent",
          )}
        >
          {renderHighlight!(highlightText)}
        </div>
      </div>
    );

    if (!showCount && limit === undefined) {
      return textareaElement;
    }

    // Có giới hạn thì luôn có lớp bọc flex: bộ đếm ẩn/hiện không đổi cây DOM (ô đang gõ không bị remount) và không
    // đổi khoảng cách (lớp bọc `contents` làm mất margin của `space-y-*` ở thẻ cha).
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {textareaElement}
        {showCounter && (
          <div className="flex items-center justify-between text-xs px-1 select-none" aria-live="polite">
            <span
              className={cn(
                "transition-colors",
                isNearLimit ? "text-destructive font-medium" : "text-muted-foreground",
              )}
            >
              {remaining !== null && remaining <= 20 && remaining >= 0
                ? `Còn ${remaining} ký tự nữa là hết chỗ`
                : ""}
            </span>
            <span
              className={cn(
                "tabular-nums ml-auto transition-colors",
                isNearLimit ? "text-destructive font-medium" : "text-muted-foreground",
              )}
            >
              {charCount} / {limit}
            </span>
          </div>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea as CharacterCountTextarea };
