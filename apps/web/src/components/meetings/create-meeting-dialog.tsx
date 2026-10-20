"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, Clock, MapPin, X } from "lucide-react";
import { getTodayIctDate } from "@qcet/shared/lib/academic-calendar";
import { cn } from "@/lib/utils";
import { Button, PROPERTY_PILL_CLASS } from "@/components/ui/button";
import { DialogClose, DialogFooter, DialogForm, FieldError, StandardDialog } from "@/components/ui/dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { PopoverContent, PopoverRoot, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { PersonPillPicker } from "@/components/tasks/create/person-pill-picker";
import { useModalDirtyGuard } from "@/hooks/use-modal-dirty-guard";
import { useDepartmentList } from "@/hooks/use-department-list";
import { useAuth } from "@/lib/auth-context";
import { responseMessage } from "@/components/meetings/meeting-client";
import { ParticipantsPicker, type MeetingPerson } from "@/components/meetings/participants-picker";
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
 * ô giờ có icon đồng hồ của trình duyệt nằm sau chữ, mô tả dính vào nhãn ô đầu): tên lớn không viền, hàng chip Ngày, Giờ,
 * Địa điểm, Chủ tọa, Thành phần, đường kẻ, rồi ô nội dung không viền. Chủ tọa và thành phần chọn từ danh bạ cán bộ ngay ở
 * đây (`initialParticipants`): trang chi tiết chưa có chỗ thêm người, nên trước đây cuộc họp tạo mới không có chủ tọa để
 * duyệt biên bản. Người tạo luôn dự họp (thư ký, hoặc chủ tọa nếu tự chọn mình). Enter gửi, nút chính không khóa, lỗi báo
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
  const [chairId, setChairId] = React.useState("");
  const [attendees, setAttendees] = React.useState<MeetingPerson[]>([]);
  const [openPicker, setOpenPicker] = React.useState<"time" | "location" | "chair" | null>(null);
  const [errors, setErrors] = React.useState<Partial<Record<FieldName, string>>>({});
  const [failure, setFailure] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const endRef = React.useRef<HTMLInputElement>(null);
  const dateWrapRef = React.useRef<HTMLDivElement>(null);

  const { departments, isLoading: peopleLoading } = useDepartmentList({ includePersonnel: true, enabled: open });
  // Danh bạ cả trường: gộp cán bộ các đơn vị, mỗi người một lần (người kiêm nhiệm ở nhiều đơn vị)
  const people = React.useMemo(() => {
    const byId = new Map<string, MeetingPerson>();
    for (const department of departments) {
      for (const person of department.personnel ?? []) {
        if (!byId.has(person.id)) byId.set(person.id, { ...person, departmentName: department.shortName || department.name });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [departments]);
  // Người tạo đã dự họp sẵn (thư ký) nên không có trong Thành phần; chủ tọa cũng không lặp lại ở đó
  const attendeeOptions = React.useMemo(() => people.filter((p) => p.id !== user?.id && p.id !== chairId), [people, user?.id, chairId]);

  // Mỗi lần mở là một biểu mẫu mới, ngày mặc định là hôm nay
  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setDate(getTodayIctDate());
    setStartTime(DEFAULT_START);
    setEndTime(DEFAULT_END);
    setLocation("");
    setAgenda("");
    setChairId("");
    setAttendees([]);
    setOpenPicker(null);
    setErrors({});
    setFailure(null);
  }, [open]);

  const isDirty = Boolean(title.trim() || location.trim() || agenda.trim() || chairId || attendees.length > 0);
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
        ...(chairId ? [{ userId: chairId, role: "CHAIR" as const }] : []),
        ...attendees.filter((p) => p.id !== chairId && p.id !== user?.id).map((p) => ({ userId: p.id, role: "ATTENDEE" as const })),
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
    >
      <DialogForm onSubmit={() => void submit()} className="gap-3">
        {/* Đầu hộp gọn một dòng 12px như hộp Soạn văn bản đi; bỏ tiêu đề 16px và câu mô tả (người dùng: "xoá cho gọn" 20/10/2026) */}
        <div className="-mt-1 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Cuộc họp</span>
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" aria-hidden />
            <span>Tạo mới</span>
          </div>
          <DialogClose render={<Button variant="ghost" size="icon-xs" aria-label="Đóng" title="Đóng (Esc)" className="shrink-0" />}>
            <X />
          </DialogClose>
        </div>
        <div className="flex flex-col gap-1">
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

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
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
                  placeholder="Ví dụ: Phòng họp số 1"
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

            <PersonPillPicker
              people={people}
              valueId={chairId}
              onSelect={(person) => {
                setChairId(person.id);
                setAttendees((current) => current.filter((p) => p.id !== person.id));
              }}
              onClear={() => setChairId("")}
              open={openPicker === "chair"}
              onOpenChange={(next) => setOpenPicker(next ? "chair" : null)}
              loading={peopleLoading}
              emptyLabel="Chủ tọa"
              menuTitle="Chủ tọa"
            />

            <ParticipantsPicker people={attendeeOptions} value={attendees} onChange={setAttendees} loading={peopleLoading} />
          </div>
          {errors.date ? <FieldError id={`${ids}-date-error`}>{errors.date}</FieldError> : null}
          {errors.end ? <FieldError id={`${ids}-end-error`}>{errors.end}</FieldError> : null}
        </div>

        <div aria-hidden className="h-px bg-border" />

        <label htmlFor={`${ids}-agenda`} className="sr-only">
          Nội dung và chương trình
        </label>
        <Textarea
          id={`${ids}-agenda`}
          variant="bare"
          compact
          autoResize
          value={agenda}
          placeholder="Nội dung và chương trình, tài liệu cần chuẩn bị…"
          className="min-h-24 sm:min-h-24"
          onChange={(event) => setAgenda(event.target.value)}
        />

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
