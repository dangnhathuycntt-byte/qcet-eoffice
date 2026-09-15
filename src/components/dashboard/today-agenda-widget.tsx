"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  MapPin,
  Video,
  UserCheck,
  ExternalLink,
  ChevronRight,
  Radio,
  CheckCircle2,
  CalendarCheck2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SchoolTask, StaffTask } from "@/types/dashboard";

export interface AgendaEventItem {
  id: string;
  title: string;
  startTime: string; // ví dụ "08:30"
  endTime: string; // ví dụ "10:30"
  location: string; // ví dụ "Phòng họp A1 - Nhà Hiệu bộ"
  chairPerson: string; // ví dụ "Hiệu trưởng"
  isOnline?: boolean;
  meetingLink?: string;
  status: "UPCOMING" | "IN_PROGRESS" | "COMPLETED";
  type?: "TRUONG" | "DON_VI";

  // Các trường mở rộng linh hoạt cho khả năng tương thích cao
  timeRange?: string;
  room?: string;
  host?: string;
  participants?: string;
  scope?: "TRUONG" | "DON_VI" | "CA_NHAN";
  scopeLabel?: string;
  isCompleted?: boolean;
  taskId?: string;
}

export interface TodayAgendaWidgetProps {
  events?: AgendaEventItem[];
  date?: string | Date;
  className?: string;
  onSelectEvent?: (eventId: string) => void;
  tasks?: (SchoolTask | StaffTask)[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  viewAllHref?: string;
}

/**
 * Danh sách mock events mặc định phong phú cho ngày hiện tại thiết kế riêng cho trường học:
 * Ban Giám hiệu, Trưởng đơn vị, Chuyên viên và Giảng viên.
 */
export const DEFAULT_MOCK_AGENDA_EVENTS: AgendaEventItem[] = [
  {
    id: "agenda-evt-01",
    title: "Họp giao ban Ban Giám hiệu đầu tuần & Đánh giá công tác tuyển sinh",
    startTime: "08:00",
    endTime: "09:30",
    location: "Phòng họp 1 - Nhà Hiệu bộ",
    chairPerson: "Hiệu trưởng",
    status: "COMPLETED",
    type: "TRUONG",
    isOnline: false,
  },
  {
    id: "agenda-evt-02",
    title: "Hội đồng nghiệm thu đề tài Nghiên cứu khoa học cấp Trường năm 2026",
    startTime: "09:45",
    endTime: "11:30",
    location: "Phòng Hội thảo 2 - Tòa A",
    chairPerson: "Phó Hiệu trưởng phụ trách NCKH",
    status: "IN_PROGRESS",
    type: "TRUONG",
    isOnline: true,
    meetingLink: "https://meet.google.com/qce-meet-demo",
  },
  {
    id: "agenda-evt-03",
    title: "Làm việc với Đoàn Đánh giá ngoài kiểm định chất lượng CTĐT",
    startTime: "14:00",
    endTime: "16:00",
    location: "Hội trường B - Nhà Đa năng",
    chairPerson: "Hiệu trưởng & Trưởng các Khoa",
    status: "UPCOMING",
    type: "TRUONG",
    isOnline: false,
  },
  {
    id: "agenda-evt-04",
    title: "Họp chuyên môn Khoa CNTT & Duyệt đề cương chi tiết học phần Học kỳ I",
    startTime: "16:15",
    endTime: "17:30",
    location: "Văn phòng Khoa CNTT (Phòng 402 - Nhà C)",
    chairPerson: "Trưởng khoa CNTT",
    status: "UPCOMING",
    type: "DON_VI",
    isOnline: false,
  },
];

/**
 * Định dạng ngày hiển thị tiếng Việt chuẩn hành chính sư phạm ICT (UTC+7).
 * Ví dụ: "Thứ Ba, 15/09/2026"
 */
export function formatAgendaDisplayDate(dateInput?: string | Date): string {
  let targetDate: Date;
  if (!dateInput) {
    targetDate = new Date();
  } else if (typeof dateInput === "string") {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      targetDate = new Date(
        parseInt(match[1], 10),
        parseInt(match[2], 10) - 1,
        parseInt(match[3], 10),
        12,
        0,
        0
      );
    } else {
      targetDate = new Date(dateInput);
    }
  } else {
    targetDate = dateInput;
  }

  if (isNaN(targetDate.getTime())) {
    return "Hôm nay";
  }

  const formatter = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const formatted = formatter.format(targetDate);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Định dạng khoảng thời gian chuẩn 24h ICT.
 */
export function formatEventTimeRange(startTime: string, endTime: string): string {
  if (!startTime) return "";
  if (!endTime) return startTime;
  return `${startTime} - ${endTime}`;
}

/**
 * Cấu hình hiển thị badge trạng thái cuộc họp.
 */
export function getAgendaStatusBadgeConfig(status: AgendaEventItem["status"]): {
  label: string;
  badgeClass: string;
  isLivePulse: boolean;
} {
  switch (status) {
    case "IN_PROGRESS":
      return {
        label: "Đang diễn ra",
        badgeClass:
          "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
        isLivePulse: true,
      };
    case "UPCOMING":
      return {
        label: "Sắp diễn ra",
        badgeClass:
          "bg-secondary/70 text-secondary-foreground border-border/50",
        isLivePulse: false,
      };
    case "COMPLETED":
      return {
        label: "Đã kết thúc",
        badgeClass:
          "bg-muted/50 text-muted-foreground border-transparent line-through decoration-muted-foreground/40",
        isLivePulse: false,
      };
    default:
      return {
        label: "Lịch họp",
        badgeClass: "bg-muted text-muted-foreground border-border/40",
        isLivePulse: false,
      };
  }
}

/**
 * Cấu hình hiển thị loại sự kiện công tác (Toàn trường / Đơn vị).
 */
export function getAgendaTypeBadgeConfig(type?: AgendaEventItem["type"]): {
  label: string;
  className: string;
} {
  if (type === "TRUONG") {
    return {
      label: "Toàn trường",
      className:
        "bg-blue-500/10 text-blue-700 border-blue-500/25",
    };
  }
  if (type === "DON_VI") {
    return {
      label: "Đơn vị",
      className:
        "bg-amber-500/10 text-amber-700 border-amber-500/25",
    };
  }
  return {
    label: "Công tác",
    className: "bg-muted text-muted-foreground border-border/40",
  };
}

/**
 * Thống kê số lượng sự kiện theo trạng thái.
 */
export function countAgendaEvents(events: AgendaEventItem[] = []): {
  total: number;
  inProgress: number;
  upcoming: number;
  completed: number;
} {
  let inProgress = 0;
  let upcoming = 0;
  let completed = 0;

  for (const ev of events) {
    if (ev.status === "IN_PROGRESS") inProgress++;
    else if (ev.status === "UPCOMING") upcoming++;
    else if (ev.status === "COMPLETED") completed++;
  }

  return {
    total: events.length,
    inProgress,
    upcoming,
    completed,
  };
}

/**
 * Sắp xếp các sự kiện công tác:
 * - Đang diễn ra (IN_PROGRESS) và Sắp tới (UPCOMING) xếp theo thời gian bắt đầu
 * - Đã kết thúc (COMPLETED) đẩy xuống sau
 */
export function sortAgendaEvents(events: AgendaEventItem[]): AgendaEventItem[] {
  return [...events].sort((a, b) => {
    if (a.status === "COMPLETED" && b.status !== "COMPLETED") return 1;
    if (a.status !== "COMPLETED" && b.status === "COMPLETED") return -1;

    if (a.status === "IN_PROGRESS" && b.status !== "IN_PROGRESS") return -1;
    if (a.status !== "IN_PROGRESS" && b.status === "IN_PROGRESS") return 1;

    return a.startTime.localeCompare(b.startTime);
  });
}

/**
 * Widget Lịch công tác hôm nay (Today's Agenda Widget)
 * Thiết kế Calm UI, tinh gọn, không viền rườm rà, hỗ trợ theme light/dark mượt mà.
 */
export function TodayAgendaWidget({
  events,
  date,
  className,
  onSelectEvent,
  tasks = [],
  onSelectTask,
  viewAllHref = "/calendar",
}: TodayAgendaWidgetProps) {
  const displayDateText = React.useMemo(
    () => formatAgendaDisplayDate(date),
    [date]
  );

  // Trích xuất danh sách sự kiện: ưu tiên events truyền vào, nếu không dùng mock events mặc định phong phú
  const resolvedEvents: AgendaEventItem[] = React.useMemo(() => {
    if (events && events.length > 0) {
      return events;
    }

    // Nếu không có events cụ thể nhưng có tasks có hạn hôm nay thì map thêm
    if (tasks && tasks.length > 0 && !events) {
      const matchedItems: AgendaEventItem[] = [];
      const todayIso = new Date().toISOString().slice(0, 10);
      for (const task of tasks) {
        const due = (task as SchoolTask).dueDate || (task as StaffTask).dueDate;
        if (due && due.startsWith(todayIso)) {
          const isSchool = "category" in task;
          matchedItems.push({
            id: task.id,
            title: task.title,
            startTime: "08:30",
            endTime: "17:00",
            location: isSchool ? "Trường CĐ Kỹ thuật Cao Thắng" : "Văn phòng đơn vị",
            chairPerson:
              (task as SchoolTask).leadAssigneeName ||
              (task as StaffTask).assigneeName ||
              "Chuyên viên phụ trách",
            status: task.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS",
            type: isSchool ? "TRUONG" : "DON_VI",
            taskId: task.id,
          });
        }
      }
      if (matchedItems.length > 0) return matchedItems;
    }

    return events ?? DEFAULT_MOCK_AGENDA_EVENTS;
  }, [events, tasks]);

  const sortedEvents = React.useMemo(() => sortAgendaEvents(resolvedEvents), [resolvedEvents]);
  const counts = React.useMemo(() => countAgendaEvents(resolvedEvents), [resolvedEvents]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs transition-colors space-y-4",
        className
      )}
      data-slot="today-agenda-widget"
    >
      {/* HEADER: Tiêu đề + Ngày hiện tại + Bộ đếm trạng thái */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarDays className="size-4 text-primary shrink-0" strokeWidth={1.5} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-semibold text-base sm:text-lg text-foreground tracking-tight leading-tight">
                Lịch công tác hôm nay
              </h3>
              {counts.inProgress > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 animate-pulse">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Đang diễn ra
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {displayDateText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors py-1 px-2 rounded-lg hover:bg-muted/60"
            title="Xem toàn bộ lịch công tác"
          >
            <span>Xem toàn bộ</span>
            <ChevronRight size={13} strokeWidth={1.5} />
          </Link>
        </div>
      </div>

      {/* BODY: Danh sách sự kiện hoặc Empty state */}
      {sortedEvents.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-8 px-4 text-center"
          data-slot="agenda-empty-state"
        >
          <CalendarCheck2 className="size-6 text-muted-foreground mb-2" strokeWidth={1.5} />
          <p className="text-sm font-medium text-foreground">
            Hôm nay không có lịch công tác nào
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Bạn có thể đăng ký lịch mới hoặc tra cứu toàn bộ lịch công tác của Nhà trường và Đơn vị.
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-3.5 h-8 text-xs font-medium rounded-lg"
          >
            <Link href={viewAllHref}>Xem lịch công tác tuần</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5" data-slot="agenda-events-list">
          {sortedEvents.map((event) => {
            const statusConfig = getAgendaStatusBadgeConfig(event.status);
            const typeConfig = getAgendaTypeBadgeConfig(event.type);
            const isClickable = Boolean(onSelectEvent || onSelectTask);

            const handleCardClick = () => {
              if (onSelectEvent) {
                onSelectEvent(event.id);
              } else if (onSelectTask && event.taskId) {
                const matched = tasks.find((t) => t.id === event.taskId);
                if (matched) onSelectTask(matched);
              }
            };

            return (
              <div
                key={event.id}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onClick={handleCardClick}
                onKeyDown={(e) => {
                  if (isClickable && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    handleCardClick();
                  }
                }}
                data-slot="agenda-event-card"
                data-event-status={event.status}
                className={cn(
                  "group relative flex items-start gap-3 p-3 rounded-xl border transition-all text-left",
                  event.status === "IN_PROGRESS"
                    ? "border-emerald-500/30 bg-emerald-500/[0.03] shadow-xs"
                    : event.status === "COMPLETED"
                    ? "border-border/30 bg-muted/20 opacity-70"
                    : "border-border/50 bg-background/60 hover:bg-muted/40 hover:border-border/80 shadow-2xs",
                  isClickable && "cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                {/* Cột thời gian 24h ICT */}
                <div
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg px-2.5 py-1.5 shrink-0 border min-w-[76px] text-center",
                    event.status === "IN_PROGRESS"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
                      : event.status === "COMPLETED"
                      ? "bg-muted/40 border-border/30 text-muted-foreground"
                      : "bg-muted/50 border-border/40 text-foreground"
                  )}
                >
                  <span className="font-mono font-bold text-xs leading-tight">
                    {event.startTime}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono leading-tight mt-0.5">
                    {event.endTime}
                  </span>
                </div>

                {/* Nội dung chi tiết sự kiện */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Badge loại lịch */}
                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                        typeConfig.className
                      )}
                    >
                      {typeConfig.label}
                    </span>

                    {/* Badge trạng thái */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border",
                        statusConfig.badgeClass
                      )}
                    >
                      {statusConfig.isLivePulse && (
                        <span className="size-1 rounded-full bg-emerald-500" />
                      )}
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Tiêu đề */}
                  <h4
                    className={cn(
                      "font-heading text-xs sm:text-sm font-semibold tracking-tight text-foreground leading-snug line-clamp-2",
                      event.status === "COMPLETED" && "line-through text-muted-foreground"
                    )}
                  >
                    {event.title}
                  </h4>

                  {/* Metadata: Địa điểm & Chủ trì */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {/* Địa điểm */}
                    <div className="flex items-center gap-1 truncate">
                      {event.isOnline ? (
                        <Video size={12} strokeWidth={1.5} className="text-blue-500 shrink-0" />
                      ) : (
                        <MapPin size={12} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{event.location}</span>
                    </div>

                    {/* Người chủ trì */}
                    {event.chairPerson && (
                      <div className="flex items-center gap-1 truncate">
                        <UserCheck size={12} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
                        <span className="truncate">Chủ trì: {event.chairPerson}</span>
                      </div>
                    )}
                  </div>

                  {/* Nút tham gia trực tuyến nếu có meetingLink */}
                  {event.isOnline && event.meetingLink && (
                    <div className="pt-1">
                      <a
                        href={event.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline py-0.5 px-1.5 rounded bg-blue-500/10 border border-blue-500/20"
                      >
                        <Radio size={11} strokeWidth={1.5} className="animate-pulse text-blue-500" />
                        <span>Vào phòng họp trực tuyến</span>
                        <ExternalLink size={10} strokeWidth={1.5} className="ml-0.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FOOTER: Liên kết nhanh tới Lịch công tác */}
      <div className="pt-2 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
        <span className="text-[11px]">
          Múi giờ chuẩn: <strong className="font-medium text-foreground">ICT (UTC+7)</strong>
        </span>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-7 text-xs font-medium text-primary hover:text-primary/90 px-2 rounded-lg gap-1"
        >
          <Link href={viewAllHref}>
            <span>Mở Lịch công tác</span>
            <ChevronRight size={12} strokeWidth={1.5} />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default TodayAgendaWidget;
