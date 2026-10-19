import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  label: string;
  /** Gợi ý hiển thị dưới ô nhập. */
  hint?: string;
  /** Thông báo lỗi; khi có, ô nhập được đánh dấu `aria-invalid` và nối với thông báo qua `aria-describedby`. */
  error?: string;
  /** Đánh dấu bắt buộc (theo chuẩn thiết kế QCET không hiển thị dấu *, mặc định mọi ô là bắt buộc). */
  required?: boolean;
  /** Đánh dấu không bắt buộc; khi bật sẽ hiển thị nhãn "(không bắt buộc)" chữ xám cạnh label. */
  optional?: boolean;
  /** Một điều khiển nhận `id`, `aria-describedby`, `aria-invalid` (Input, Textarea, Combobox). */
  children: React.ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    invalid?: boolean;
  }>;
  className?: string;
}

/**
 * Nhãn, gợi ý và thông báo lỗi cho một ô nhập, nối đúng quan hệ truy cập.
 * Chuẩn QCET: nhãn nằm trên ô, không dấu *, chỉ đánh dấu ô không bắt buộc bằng "(không bắt buộc)".
 */
export function FormField({ label, hint, error, required, optional, children, className }: FormFieldProps) {
  const uid = React.useId();
  const controlId = children.props.id ?? `${uid}-control`;
  const hintId = hint ? `${uid}-hint` : undefined;
  const errorId = error ? `${uid}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  // Hiển thị (không bắt buộc) khi optional=true hoặc khi required explicitly = false
  const showOptional = optional || required === false;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={controlId} className="text-xs font-medium text-foreground">
        {label}
        {showOptional ? (
          <span className="ml-1.5 font-normal text-muted-foreground">
            (không bắt buộc)
          </span>
        ) : null}
      </label>
      {React.cloneElement(children, {
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
