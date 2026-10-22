"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, MapPin } from "lucide-react";
import { getTodayIctDate } from "@qcet/shared/lib/academic-calendar";
import { cn } from "@/lib/utils";
import { Button, PROPERTY_PILL_CLASS } from "@/components/ui/button";
import { DialogComposeBody, DialogComposeFooter, DialogComposeHeader, DialogComposeProperties, DialogForm, FieldError, StandardDialog, SubmitShortcutHint } from "@/components/ui/dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { PopoverContent, PopoverRoot, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { useModalDirtyGuard } from "@/hooks/use-modal-dirty-guard";
import { useModifierKey } from "@/hooks/use-modifier-key";
import { useAuth } from "@/lib/auth-context";
import { responseMessage } from "@/components/meetings/meeting-client";
import { ChairPicker, ParticipantsPicker, useMeetingPeople, type MeetingPerson } from "@/components/meetings/participants-picker";
import { TimeRangeFields, durationText, fromMinutes, toMinutes } from "@/components/meetings/time-range-picker";

const DEFAULT_START = "08:00";
const DEFAULT_END = "09:30";

type FieldName = "title" | "date" | "end";

/** Giờ ICT (UTC+7) của ô ngày và ô giờ thành ISO UTC, như máy chủ lưu `startTime`. */
function toMeetingIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+07:00`).toISOString();
}

/**
 * Tạo cuộc họp, theo bố cục hộp tạo việc (người dùng yêu cầu "cải thiện modal" 20/10/2026, trước đó là năm ô có nhãn,
 * ô giờ có icon đồng hồ của trình duyệt nằm sau chữ, mô tả dính vào nhãn ô đầu): tên lớn không viền, ô nội dung không viền
 * ngay dưới, rồi hàng chip Ngày, Giờ, Địa điểm, Chủ tọa, Thành phần như hộp New issue của Linear. Chủ tọa và thành phần chọn từ danh bạ cán bộ ngay ở
 * đây (`initialParticipants`; thêm sau ở thẻ Thành phần của trang chi tiết), vì trước đây cuộc họp tạo mới không có chủ
 * tọa để duyệt biên bản. Người tạo luôn dự họp (thư ký, hoặc chủ tọa nếu tự chọn mình). Enter gửi, nút chính không khóa, lỗi báo
 * dưới ô. Tạo xong mở thẳng trang chi tiết.
 */
export function CreateMeetingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const ids = React.useId();
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState("");
  const [startTime, setStartTime] = React.useState(DEFAULT_START);
  const [endTime, setEndTime] = React.useState(DEFAULT_END);
  const [location, setLocation] = React.useState("");
  const [agenda, setAgenda] = React.useState("");
  const [chair, setChair] = React.useState<MeetingPerson | null>(null);
  const [attendees, setAttendees] = React.useState<MeetingPerson[]>([]);
  const [openPicker, setOpenPicker] = React.useState<"time" | "location" | "chair" | null>(null);
  const [errors, setErrors] = React.useState<Partial<Record<FieldName, string>>>({});
  const [failure, setFailure] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const modKey = useModifierKey();
  const titleRef = React.useRef<HTMLInputElement>(null);
  const endRef = React.useRef<HTMLInputElement>(null);
  const dateWrapRef = React.useRef<HTMLDivElement>(null);

  const directory = useMeetingPeople(open);
  // Người tạo đã dự họp sẵn (thư ký) nên không có trong Thành phần; chủ tọa cũng không lặp lại ở đó
  const attendeeHidden = React.useMemo(() => new Set([user?.id, chair?.id].filter((id): id is string => Boolean(id))), [user?.id, chair?.id]);

  // Mỗi lần mở là một biểu mẫu mới, ngày mặc định là hôm nay
  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setDate(getTodayIctDate());
    setStartTime(DEFAULT_START);
    setEndTime(DEFAULT_END);
    setLocation("");
    setAgenda("");
    setChair(null);
    setAttendees([]);
    setOpenPicker(null);
    setErrors({});
    setFailure(null);
  }, [open]);

  const isDirty = Boolean(title.trim() || location.trim() || agenda.trim() || chair || attendees.length > 0);
  const { handleOpenChange } = useModalDirtyGuard({ isDirty, onConfirmClose: () => onOpenChange(false) });

  // Đổi giờ bắt đầu thì giữ nguyên thời lượng (như lịch Google), không bắt sửa lại giờ kết thúc
  const changeStart = (next: string) => {
    if (next && startTime && endTime) {
      setEndTime(fromMinutes(toMinutes(next) + toMinutes(endTime) - toMinutes(startTime)));
      setErrors((current) => ({ ...current, end: undefined }));
    }
    setStartTime(next);
  };

  const submit = async () => {
    if (saving) return;
    const next: Partial<Record<FieldName, string>> = {};
    if (title.trim().length < 3) next.title = "Nhập tên cuộc họp (ít nhất 3 ký tự).";
    if (!date) next.date = "Chọn ngày họp.";
    if (startTime && endTime && endTime <= startTime) next.end = "Giờ kết thúc phải sau giờ bắt đầu.";
    setErrors(next);
    if (next.title) return titleRef.current?.focus();
    if (next.date) return dateWrapRef.current?.querySelector("button")?.focus();
    if (next.end) {
      setOpenPicker("time");
      return;
    }

    setSaving(true);
    setFailure(null);
    try {
      const initialParticipants = [
        ...(chair ? [{ userId: chair.id, role: "CHAIR" as const }] : []),
        ...attendees.filter((p) => p.id !== chair?.id && p.id !== user?.id).map((p) => ({ userId: p.id, role: "ATTENDEE" as const })),
      ];
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          startTime: toMeetingIso(date, startTime || DEFAULT_START),
          endTime: endTime ? toMeetingIso(date, endTime) : undefined,
          location: location.trim() || undefined,
          agenda: agenda.trim() || undefined,
          initialParticipants: initialParticipants.length > 0 ? initialParticipants : undefined,
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

  const duration = durationText(startTime, endTime);

  return (
    <StandardDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Tạo cuộc họp"
      showHeader={false}
      size="lg"
      variant="compose"
    >
      {/* Khung hộp New issue của Linear như hộp Soạn văn bản đi (người dùng: "học các dạng modal áp dụng cho văn bản và cuộc
          họp" 22/10/2026): nền trắng, tên 24px, nội dung ngay dưới tên, hàng chip rồi chân hộp, không đường kẻ; phóng to được.
          Đầu hộp chỉ một dòng 12px (người dùng: "xoá cho gọn" tiêu đề 16px và câu mô tả 20/10/2026) */}
      <DialogForm onSubmit={() => void submit()} className="min-h-0 flex-1 gap-0">
        <DialogComposeHeader items={["Cuộc họp", "Tạo mới"]} />

        {/* Lỗi gửi nằm ngoài vùng cuộn như hộp Tạo nhiệm vụ để luôn thấy */}
        {failure ? (
          <div className="shrink-0 px-5 pt-3 md:px-6">
            <InlineAlert variant="error" aria-live="assertive">
              {failure}
            </InlineAlert>
          </div>
        ) : null}

        <DialogComposeBody>
          <div className="flex shrink-0 flex-col gap-0.5">
            <label htmlFor={`${ids}-title`} className="sr-only">
              Tên cuộc họp
            </label>
            <Input
              ref={titleRef}
              id={`${ids}-title`}
              variant="title"
              autoFocus
              value={title}
              maxLength={500}
              placeholder="Tên cuộc họp"
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? `${ids}-title-error` : undefined}
              onChange={(event) => {
                setTitle(event.target.value);
                setErrors((current) => ({ ...current, title: undefined }));
              }}
            />
            {errors.title ? <FieldError id={`${ids}-title-error`}>{errors.title}</FieldError> : null}
          </div>

          <label htmlFor={`${ids}-agenda`} className="sr-only">
            Nội dung và chương trình
          </label>
          <Textarea
            id={`${ids}-agenda`}
            variant="bare"
            compact
            autoResize
            value={agenda}
            placeholder="Nội dung và chương trình (không bắt buộc)"
            className="mt-2 min-h-16 shrink-0 text-sm leading-relaxed sm:min-h-16"
            onChange={(event) => setAgenda(event.target.value)}
          />
        </DialogComposeBody>

        <DialogComposeProperties
          errors={
            <>
              {errors.date ? <FieldError id={`${ids}-date-error`}>{errors.date}</FieldError> : null}
              {errors.end ? <FieldError id={`${ids}-end-error`}>{errors.end}</FieldError> : null}
            </>
          }
        >
          <div ref={dateWrapRef} className="flex">
            <VietnameseDatePicker
              id={`${ids}-date`}
              variant="pill"
              value={date}
              clearable={false}
              error={errors.date ? true : undefined}
              icon={<Calendar className={errors.date ? "text-destructive" : "text-muted-foreground"} />}
              periodPicker={false}
              placeholder="Ngày"
              title="Ngày họp"
              onChange={(value) => {
                setDate(value);
                setErrors((current) => ({ ...current, date: undefined }));
              }}
              className="flex"
            />
          </div>

          <PopoverRoot open={openPicker === "time"} onOpenChange={(next) => setOpenPicker(next ? "time" : null)}>
            <PopoverTrigger
              aria-label={`Giờ họp: ${startTime} đến ${endTime}`}
              aria-invalid={errors.end ? true : undefined}
              className={cn(PROPERTY_PILL_CLASS, errors.end && "text-destructive")}
            >
              <Clock className={cn("size-3.5", errors.end ? "text-destructive" : "text-muted-foreground")} />
              <span className="tabular-nums">{endTime ? `${startTime} – ${endTime}` : startTime}</span>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={4}
              mobileSheet
              sheetTitle="Giờ họp"
              positionerClassName="z-[60]"
              className="z-[60] w-80 p-3"
              initialFocus={errors.end ? endRef : undefined}
            >
              <PopoverTitle className="sr-only">Giờ họp</PopoverTitle>
              <TimeRangeFields
                start={startTime}
                end={endTime}
                onStartChange={changeStart}
                onEndChange={(next) => {
                  setEndTime(next);
                  setErrors((current) => ({ ...current, end: undefined }));
                }}
                endRef={endRef}
                endInvalid={Boolean(errors.end)}
                endDescribedBy={errors.end ? `${ids}-end-error` : undefined}
              />
              {/* Lỗi đã được đọc ở dòng báo dưới hàng chip (role="alert"); ở đây chỉ hiện lại cho thấy */}
              <p className={cn("mt-2 text-xs", errors.end ? "text-destructive" : "text-muted-foreground")}>
                {errors.end ?? (duration ? `Kéo dài ${duration}` : "Chọn giờ kết thúc sau giờ bắt đầu.")}
              </p>
            </PopoverContent>
          </PopoverRoot>

          <PopoverRoot open={openPicker === "location"} onOpenChange={(next) => setOpenPicker(next ? "location" : null)}>
            <PopoverTrigger
              aria-label={location ? `Địa điểm: ${location}` : "Địa điểm"}
              className={cn(PROPERTY_PILL_CLASS, !location && "text-muted-foreground")}
            >
              <MapPin className="size-3.5 text-muted-foreground" />
              <span className="max-w-40 truncate">{location || "Địa điểm"}</span>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={4} mobileSheet sheetTitle="Địa điểm" positionerClassName="z-[60]" className="z-[60] w-64 p-1">
              <PopoverTitle className="sr-only">Địa điểm</PopoverTitle>
              <Input
                variant="menu"
                autoFocus
                value={location}
                maxLength={255}
                aria-label="Địa điểm"
                placeholder="Địa điểm họp"
                onChange={(event) => setLocation(event.target.value)}
                onKeyDown={(event) => {
                  // Ô nằm ngoài biểu mẫu (portal) nên Enter không gửi: Enter là xong, quay về hộp
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    setOpenPicker(null);
                  }
                }}
              />
            </PopoverContent>
          </PopoverRoot>

          <ChairPicker
            directory={directory}
            value={chair}
            onChange={(person) => {
              setChair(person);
              setAttendees((current) => current.filter((p) => p.id !== person.id));
            }}
            onClear={() => setChair(null)}
            open={openPicker === "chair"}
            onOpenChange={(next) => setOpenPicker(next ? "chair" : null)}
          />

          <ParticipantsPicker directory={directory} value={attendees} onChange={setAttendees} hiddenIds={attendeeHidden} />
        </DialogComposeProperties>

        <DialogComposeFooter>
          <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={saving}
            aria-keyshortcuts="Meta+Enter Control+Enter"
            title={`${modKey} + Enter`}
            className="max-md:px-4"
          >
            <span>{saving ? "Đang tạo…" : "Tạo cuộc họp"}</span>
            {saving ? null : <SubmitShortcutHint />}
          </Button>
        </DialogComposeFooter>
      </DialogForm>
    </StandardDialog>
  );
}
