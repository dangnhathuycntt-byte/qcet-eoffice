"use client";

import * as React from "react";
import { StandardDialog } from "@/components/ui/dialog";
import { useModalDirtyGuard } from "@/hooks/use-modal-dirty-guard";
import {
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  MapPin,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { cn } from "@/lib/utils";
import { useVirtualKeyboard, scrollActiveInputIntoView } from "@/hooks/use-virtual-keyboard";

export interface CreateEventFormData {
  title: string;
  startDate: string;
  startTime: string;
  endTime: string;
  location: string;
  host: string;
  participants: string;
  scope: "SCHOOL" | "UNIT";
  description: string;
}

export interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateEventFormData) => Promise<boolean | void>;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
}

export function CreateEventModal({
  isOpen,
  onClose,
  onSubmit,
  initialDate = "",
  initialStartTime = "08:00",
  initialEndTime = "09:30",
}: CreateEventModalProps) {
  const [title, setTitle] = React.useState("");
  const [startDate, setStartDate] = React.useState(initialDate);
  const [startTime, setStartTime] = React.useState(initialStartTime);
  const [endTime, setEndTime] = React.useState(initialEndTime);
  const [location, setLocation] = React.useState("");
  const [host, setHost] = React.useState("");
  const [participants, setParticipants] = React.useState("");
  const [scope, setScope] = React.useState<"SCHOOL" | "UNIT">("SCHOOL");
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const titleInputRef = React.useRef<HTMLInputElement>(null);
  useVirtualKeyboard();

  const isDirty = Boolean(
    title.trim() ||
    location.trim() ||
    host.trim() ||
    participants.trim() ||
    description.trim() ||
    (startDate && startDate !== initialDate) ||
    (startTime && startTime !== initialStartTime) ||
    (endTime && endTime !== initialEndTime) ||
    scope !== "SCHOOL"
  );

  const { handleOpenChange } = useModalDirtyGuard({
    isDirty,
    onConfirmClose: onClose,
  });

  React.useEffect(() => {
    if (isOpen) {
      setStartDate(initialDate);
      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setError(null);
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setTitle("");
      setLocation("");
      setHost("");
      setParticipants("");
      setDescription("");
      setError(null);
    }
  }, [isOpen, initialDate, initialStartTime, initialEndTime]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Vui lòng nhập tên cuộc họp hoặc sự kiện");
      return;
    }
    if (!startDate) {
      setError("Vui lòng chọn ngày diễn ra");
      return;
    }
    if (startTime && endTime && startTime > endTime) {
      setError("Giờ kết thúc phải sau giờ bắt đầu");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const result = await onSubmit({
        title: title.trim(),
        startDate,
        startTime,
        endTime,
        location: location.trim(),
        host: host.trim(),
        participants: participants.trim(),
        scope,
        description: description.trim(),
      });
      if (result !== false) {
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra khi tạo sự kiện");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <StandardDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="Tạo sự kiện lịch biểu"
      description="Lịch họp, hội nghị, sự kiện công tác của nhà trường"
      size="md"
      className="max-h-[90vh] flex flex-col overflow-hidden sm:max-w-lg"
    >
      <div className="flex flex-col flex-1 min-h-0 -mx-6 -mb-6 mt-2">
        {/* Scrollable Form Body */}
        <div className="overflow-y-auto px-6 py-4 space-y-3.5 flex-1 thin-scrollbar">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2 shrink-0"
            >
              <span>{error}</span>
            </div>
          )}

          <form id="create-event-form" onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="calendar-event-title" className="block text-xs font-semibold text-foreground mb-1.5">
                Tên sự kiện / Cuộc họp <span className="text-rose-600">*</span>
              </label>
              <input
                ref={titleInputRef}
                id="calendar-event-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={(e) => scrollActiveInputIntoView(e.currentTarget)}
                placeholder="VD: Giao ban Lãnh đạo Trường tháng 9"
                className="w-full min-h-[44px] sm:min-h-9 h-9 rounded-xl border border-border/80 bg-background px-3 text-base sm:text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="calendar-event-date" className="block text-xs font-semibold text-foreground mb-1.5">
                  Ngày <span className="text-rose-600">*</span>
                </label>
                <VietnameseDatePicker
                  id="calendar-event-date"
                  required
                  value={startDate}
                  onChange={(val) => setStartDate(val)}
                  variant="input"
                  className="w-full"
                />
              </div>
              <div>
                <label htmlFor="calendar-event-start-time" className="block text-xs font-semibold text-foreground mb-1.5">
                  Bắt đầu
                </label>
                <div className="relative">
                  <input
                    id="calendar-event-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    onFocus={(e) => scrollActiveInputIntoView(e.currentTarget)}
                    className="w-full min-h-[44px] sm:min-h-9 h-9 rounded-xl border border-border/80 bg-background px-3 text-base sm:text-xs text-foreground font-mono focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                  <Clock className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <label htmlFor="calendar-event-end-time" className="block text-xs font-semibold text-foreground mb-1.5">
                  Kết thúc
                </label>
                <div className="relative">
                  <input
                    id="calendar-event-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    onFocus={(e) => scrollActiveInputIntoView(e.currentTarget)}
                    className="w-full min-h-[44px] sm:min-h-9 h-9 rounded-xl border border-border/80 bg-background px-3 text-base sm:text-xs text-foreground font-mono focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                  <Clock className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="calendar-event-location" className="block text-xs font-semibold text-foreground mb-1.5">
                  Địa điểm / Phòng họp
                </label>
                <div className="relative">
                  <input
                    id="calendar-event-location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onFocus={(e) => scrollActiveInputIntoView(e.currentTarget)}
                    placeholder="VD: Phòng họp số 1"
                    className="w-full min-h-[44px] sm:min-h-9 h-9 rounded-xl border border-border/80 bg-background pl-8 pr-3 text-base sm:text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <label htmlFor="calendar-event-type" className="block text-xs font-semibold text-foreground mb-1.5">
                  Cấp quản lý
                </label>
                <select
                  id="calendar-event-type"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "SCHOOL" | "UNIT")}
                  onFocus={(e) => scrollActiveInputIntoView(e.currentTarget)}
                  className="w-full min-h-[44px] sm:min-h-9 h-9 rounded-xl border border-border/80 bg-background px-3 text-base sm:text-xs text-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="SCHOOL">Cấp Trường (Toàn trường)</option>
                  <option value="UNIT">Cấp Đơn vị (Nội bộ khoa/phòng)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="calendar-event-host" className="block text-xs font-semibold text-foreground mb-1.5">
                  Chủ trì cuộc họp
                </label>
                <div className="relative">
                  <input
                    id="calendar-event-host"
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    onFocus={(e) => scrollActiveInputIntoView(e.currentTarget)}
                    placeholder="VD: TS. Nguyễn Văn A - Hiệu trưởng"
                    className="w-full min-h-[44px] sm:min-h-9 h-9 rounded-xl border border-border/80 bg-background pl-8 pr-3 text-base sm:text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <label htmlFor="calendar-event-department" className="block text-xs font-semibold text-foreground mb-1.5">
                  Thành phần tham dự
                </label>
                <div className="relative">
                  <input
                    id="calendar-event-department"
                    type="text"
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    onFocus={(e) => scrollActiveInputIntoView(e.currentTarget)}
                    placeholder="VD: Ban Giám hiệu, Trưởng các Đơn vị"
                    className="w-full min-h-[44px] sm:min-h-9 h-9 rounded-xl border border-border/80 bg-background pl-8 pr-3 text-base sm:text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                  <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="calendar-event-description" className="block text-xs font-semibold text-foreground mb-1.5">
                Nội dung chuẩn bị / Ghi chú
              </label>
              <textarea
                id="calendar-event-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={(e) => scrollActiveInputIntoView(e.currentTarget)}
                placeholder="Ghi chú về tài liệu họp, nội dung chi tiết..."
                className="w-full rounded-xl border border-border/80 bg-background p-3 text-base sm:text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 p-3.5 sm:p-4 border-t border-border/60 bg-muted/20 shrink-0 px-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
            className="min-h-[44px] sm:min-h-9 text-xs rounded-xl px-4 cursor-pointer"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            form="create-event-form"
            size="sm"
            disabled={submitting}
            className="min-h-[44px] sm:min-h-9 text-xs font-semibold rounded-xl px-5 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                Đang lưu...
              </>
            ) : (
              "Lưu sự kiện"
            )}
          </Button>
        </div>
      </div>
    </StandardDialog>
  );
}
