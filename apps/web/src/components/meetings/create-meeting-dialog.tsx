"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogForm, FieldError, StandardDialog } from "@/components/ui/dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { getTodayIctDate } from "@qcet/shared/lib/academic-calendar";
import { useModalDirtyGuard } from "@/hooks/use-modal-dirty-guard";
import { responseMessage } from "@/components/meetings/meeting-client";

const DEFAULT_START = "08:00";
const DEFAULT_END = "09:30";

type FieldName = "title" | "date" | "end";

/** Giờ ICT (UTC+7) của ô ngày và ô giờ thành ISO UTC, như máy chủ lưu `startTime`. */
function toMeetingIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

/**
 * Tạo cuộc họp (thay hộp "Tạo sự kiện lịch biểu" của trang Lịch công tác đã bỏ 20/10/2026): chỉ các trường máy chủ lưu
 * thật (tên, ngày giờ, địa điểm, nội dung). Thành phần dự họp và chủ tọa thêm ở trang chi tiết, nơi có danh sách người
 * dùng thật; ô "Chủ trì/Thành phần" gõ tay trước đây chỉ bị gộp vào nội dung nên bỏ. Tạo xong mở thẳng trang chi tiết.
 * Theo quy tắc biểu mẫu của `AGENTS.md`: Enter gửi, nút chính không khóa, lỗi báo dưới từng ô.
 */
export function CreateMeetingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const ids = React.useId();
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState("");
  const [startTime, setStartTime] = React.useState(DEFAULT_START);
  const [endTime, setEndTime] = React.useState(DEFAULT_END);
  const [location, setLocation] = React.useState("");
  const [agenda, setAgenda] = React.useState("");
  const [errors, setErrors] = React.useState<Partial<Record<FieldName, string>>>({});
  const [failure, setFailure] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const endRef = React.useRef<HTMLInputElement>(null);
  const dateWrapRef = React.useRef<HTMLDivElement>(null);

  // Mỗi lần mở là một biểu mẫu mới, ngày mặc định là hôm nay
  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setDate(getTodayIctDate());
    setStartTime(DEFAULT_START);
    setEndTime(DEFAULT_END);
    setLocation("");
    setAgenda("");
    setErrors({});
    setFailure(null);
  }, [open]);

  const isDirty = Boolean(title.trim() || location.trim() || agenda.trim());
  const { handleOpenChange } = useModalDirtyGuard({ isDirty, onConfirmClose: () => onOpenChange(false) });

  const submit = async () => {
    if (saving) return;
    const next: Partial<Record<FieldName, string>> = {};
    if (title.trim().length < 3) next.title = "Nhập tên cuộc họp (ít nhất 3 ký tự).";
    if (!date) next.date = "Chọn ngày họp.";
    if (startTime && endTime && endTime <= startTime) next.end = "Giờ kết thúc phải sau giờ bắt đầu.";
    setErrors(next);
    if (next.title) return titleRef.current?.focus();
    if (next.date) return dateWrapRef.current?.querySelector("button")?.focus();
    if (next.end) return endRef.current?.focus();

    setSaving(true);
    setFailure(null);
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          startTime: toMeetingIso(date, startTime || DEFAULT_START),
          endTime: endTime ? toMeetingIso(date, endTime) : undefined,
          location: location.trim() || undefined,
          agenda: agenda.trim() || undefined,
        }),
      });
      if (!response.ok) {
        setFailure(await responseMessage(response, "Chưa tạo được cuộc họp. Thầy/Cô thử lại."));
        return;
      }
      const created = (await response.json()) as { id?: string };
      onOpenChange(false);
      router.push(created.id ? `/meetings/${encodeURIComponent(created.id)}` : "/meetings");
    } catch {
      setFailure("Mất kết nối khi tạo cuộc họp. Thầy/Cô thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const labelClass = "text-xs font-medium text-foreground";

  return (
    <StandardDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Tạo cuộc họp"
      description="Sau khi tạo, thêm người dự họp và chủ tọa ở trang chi tiết."
      size="md"
      compact
    >
      <DialogForm onSubmit={() => void submit()}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-title`} className={labelClass}>
            Tên cuộc họp
          </label>
          <Input
            ref={titleRef}
            id={`${ids}-title`}
            compact
            autoFocus
            value={title}
            maxLength={500}
            placeholder="Ví dụ: Giao ban Lãnh đạo Trường tháng 10"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${ids}-title-error` : undefined}
            onChange={(event) => {
              setTitle(event.target.value);
              setErrors((current) => ({ ...current, title: undefined }));
            }}
          />
          {errors.title ? <FieldError id={`${ids}-title-error`}>{errors.title}</FieldError> : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5" ref={dateWrapRef}>
            <label htmlFor={`${ids}-date`} className={labelClass}>
              Ngày
            </label>
            <VietnameseDatePicker
              id={`${ids}-date`}
              variant="input"
              value={date}
              clearable={false}
              error={errors.date ? true : undefined}
              onChange={(value) => {
                setDate(value);
                setErrors((current) => ({ ...current, date: undefined }));
              }}
              className="w-full"
              // Cùng cỡ với Input compact bên cạnh (28px, chữ 13px không monospace); mặc định của biến thể "input" là 36px
              triggerClassName="h-8 rounded-control! px-2 font-sans text-compact sm:h-7"
            />
            {errors.date ? <FieldError id={`${ids}-date-error`}>{errors.date}</FieldError> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-start`} className={labelClass}>
              Bắt đầu
            </label>
            <Input id={`${ids}-start`} type="time" compact value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-end`} className={labelClass}>
              Kết thúc
            </label>
            <Input
              ref={endRef}
              id={`${ids}-end`}
              type="time"
              compact
              value={endTime}
              aria-invalid={errors.end ? true : undefined}
              aria-describedby={errors.end ? `${ids}-end-error` : undefined}
              onChange={(event) => {
                setEndTime(event.target.value);
                setErrors((current) => ({ ...current, end: undefined }));
              }}
            />
          </div>
        </div>
        {errors.end ? <FieldError id={`${ids}-end-error`}>{errors.end}</FieldError> : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-location`} className={labelClass}>
            Địa điểm
          </label>
          <Input
            id={`${ids}-location`}
            compact
            value={location}
            maxLength={255}
            placeholder="Ví dụ: Phòng họp số 1"
            onChange={(event) => setLocation(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-agenda`} className={labelClass}>
            Nội dung và chương trình
          </label>
          <Textarea
            id={`${ids}-agenda`}
            compact
            rows={3}
            value={agenda}
            placeholder="Nội dung chính, tài liệu cần chuẩn bị…"
            onChange={(event) => setAgenda(event.target.value)}
          />
        </div>

        {failure ? <InlineAlert variant="error">{failure}</InlineAlert> : null}
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            Tạo cuộc họp
          </Button>
        </DialogFooter>
      </DialogForm>
    </StandardDialog>
  );
}
