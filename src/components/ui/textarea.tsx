"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Automatically expands height as content grows (Components5.dc.html) */
  autoResize?: boolean;
  /** Displays remaining / total character counter */
  showCount?: boolean;
  /** Maximum character limit for counter (defaults to maxLength attribute if omitted) */
  maxCharacters?: number;
  /** Chỉ hiện bộ đếm khi còn ≤ 20 ký tự (form gọn trong popover); mặc định luôn hiện khi có giới hạn. */
  countOnlyNearLimit?: boolean;
  /** compact: chữ 13px, đệm gọn, không đặt chiều cao tối thiểu 96px. Mặc định giữ nguyên. */
  compact?: boolean;
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
    const [charCount, setCharCount] = React.useState<number>(() => {
      if (typeof value === "string") return value.length;
      if (typeof defaultValue === "string") return defaultValue.length;
      return 0;
    });

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
      setCharCount(e.target.value.length);
      adjustHeight();
      onChange?.(e);
    };

    const remaining = limit !== undefined ? limit - charCount : null;
    const isNearLimit = remaining !== null && remaining <= 20;

    const textareaElement = (
      <textarea
        ref={internalRef}
        data-slot="textarea"
        value={value}
        defaultValue={defaultValue}
        maxLength={limit}
        onChange={handleChange}
        className={cn(
          "w-full rounded-control border-0 bg-secondary text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-100 hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1 focus-visible:bg-selected aria-invalid:bg-danger-soft aria-invalid:text-destructive read-only:bg-transparent read-only:hover:bg-transparent read-only:focus-visible:bg-transparent read-only:cursor-default read-only:select-text disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
          compact ? "min-h-11 px-2 py-1.5 text-compact sm:min-h-7" : "min-h-24 px-3.5 py-3 text-base sm:text-sm",
          autoResize ? "resize-none overflow-hidden" : "resize-y",
          className,
        )}
        {...props}
      />
    );

    if ((!showCount && limit === undefined) || (countOnlyNearLimit && !isNearLimit)) {
      return textareaElement;
    }

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {textareaElement}
        {limit !== undefined && (
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
