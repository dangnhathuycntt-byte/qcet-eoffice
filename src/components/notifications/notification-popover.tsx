"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Activity,
  FileText,
  AlertTriangle,
  Plus,
  BarChart2,
  Wifi,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QCET_PERSONNEL, Personnel } from "@/lib/mock-dashboard-data";
import { useSidebar } from "@/components/layout/sidebar-context";

export interface QCETNotification {
  id: string;
  actorName: string;
  action: string;
  targetTitle: string;
  timestamp: string;
  category: string;
  isRead: boolean;
  timeGroup: "new" | "earlier";
  type: "completed" | "progress" | "upload" | "review" | "created" | "report" | "network";
  linkHref: string;
}

export const INITIAL_NOTIFICATIONS: QCETNotification[] = [
  {
    id: "notif-1",
    actorName: "Trần Hùng",
    action: "vừa hoàn thành công việc",
    targetTitle: "Báo cáo an toàn thông tin định kỳ tháng 9/2026",
    timestamp: "10 phút trước",
    category: "ATTT",
    isRead: false,
    timeGroup: "new",
    type: "completed",
    linkHref: "/?category=ATTT",
  },
  {
    id: "notif-2",
    actorName: "Nguyễn Ngọc Vinh",
    action: "đã cập nhật tiến độ công việc",
    targetTitle: "Theo dõi kênh theo dõi chỉ đạo của UBND Tỉnh tháng 9/2026",
    timestamp: "25 phút trước",
    category: "KHAC",
    isRead: false,
    timeGroup: "new",
    type: "progress",
    linkHref: "/?category=KHAC",
  },
  {
    id: "notif-3",
    actorName: "Mai Đinh Thị Xuân",
    action: "vừa tải lên ấn phẩm truyền thông",
    targetTitle: "Bài viết MỚI VÀO QCET – NHỮNG NGÀY ĐẦU TIÊN SẼ CÓ GÌ?",
    timestamp: "45 phút trước",
    category: "TRUYEN_THONG",
    isRead: false,
    timeGroup: "new",
    type: "upload",
    linkHref: "/?category=TRUYEN_THONG",
  },
  {
    id: "notif-4",
    actorName: "Trần Hùng",
    action: "vừa kiểm tra và cấu hình",
    targetTitle: "Khảo sát và đo kiểm tín hiệu wifi khu nhà A và nhà B",
    timestamp: "1 giờ trước",
    category: "CNTT",
    isRead: false,
    timeGroup: "new",
    type: "network",
    linkHref: "/?category=CNTT",
  },
  {
    id: "notif-5",
    actorName: "Lê Hoàng Nam",
    action: "vừa chuyển trạng thái cần chỉnh sửa",
    targetTitle: "Phân luồng và nhắc nhở các đơn vị xử lý nhiệm vụ tồn đọng",
    timestamp: "2 giờ trước",
    category: "KHAC",
    isRead: false,
    timeGroup: "earlier",
    type: "review",
    linkHref: "/?category=KHAC",
  },
  {
    id: "notif-6",
    actorName: "Phạm Thị Thu",
    action: "vừa hoàn thành quét OCR",
    targetTitle: "Quét và OCR 150 đầu giáo trình chuyên ngành kỹ thuật",
    timestamp: "3 giờ trước",
    category: "THU_VIEN",
    isRead: true,
    timeGroup: "earlier",
    type: "completed",
    linkHref: "/?category=THU_VIEN",
  },
  {
    id: "notif-7",
    actorName: "Võ Minh Trí",
    action: "vừa gửi báo cáo số liệu",
    targetTitle: "Thống kê số liệu nhập học các ngành công nghệ và kinh tế",
    timestamp: "4 giờ trước",
    category: "BAO_CAO",
    isRead: true,
    timeGroup: "earlier",
    type: "report",
    linkHref: "/?category=BAO_CAO",
  },
  {
    id: "notif-8",
    actorName: "Đặng Văn Hậu",
    action: "vừa tạo mới công việc đơn vị",
    targetTitle: "Hoàn thiện báo cáo tự đánh giá tiêu chuẩn 1 đến 5",
    timestamp: "5 giờ trước",
    category: "BAO_CAO",
    isRead: true,
    timeGroup: "earlier",
    type: "created",
    linkHref: "/?category=BAO_CAO",
  },
];

function getActorPersonnel(name: string): Personnel | undefined {
  return QCET_PERSONNEL.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
}

function getActorInitials(name: string): string {
  if (!name || !name.trim()) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getTypeBadge(type: QCETNotification["type"]) {
  switch (type) {
    case "completed":
      return {
        bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
        icon: CheckCircle2,
      };
    case "progress":
      return {
        bg: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30",
        icon: Activity,
      };
    case "upload":
      return {
        bg: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30",
        icon: FileText,
      };
    case "network":
      return {
        bg: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30",
        icon: Wifi,
      };
    case "review":
      return {
        bg: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30",
        icon: AlertTriangle,
      };
    case "created":
      return {
        bg: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30",
        icon: Plus,
      };
    case "report":
      return {
        bg: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30",
        icon: BarChart2,
      };
    default:
      return {
        bg: "bg-primary/15 text-primary border border-primary/30",
        icon: Bell,
      };
  }
}

interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function NotificationPopover({ isOpen, onClose, containerRef }: NotificationPopoverProps) {
  const [notifications, setNotifications] = React.useState<QCETNotification[]>(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const { setBadgeCounts } = useSidebar();

  const unreadCount = React.useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Sync unread count to sidebar badge
  React.useEffect(() => {
    setBadgeCounts((prev) => ({
      ...prev,
      notifications: unreadCount,
    }));
  }, [unreadCount, setBadgeCounts]);

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef?.current && containerRef.current.contains(e.target as Node)) {
        return;
      }
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, containerRef]);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const filteredNotifications = React.useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filter]);

  const newItems = React.useMemo(() => {
    return filteredNotifications.filter((n) => n.timeGroup === "new");
  }, [filteredNotifications]);

  const earlierItems = React.useMemo(() => {
    return filteredNotifications.filter((n) => n.timeGroup === "earlier");
  }, [filteredNotifications]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      data-slot="notification-popover"
      className="absolute right-0 sm:right-0 top-full mt-2 w-[calc(100vw-24px)] sm:w-[410px] max-w-[420px] max-h-[min(580px,85vh)] flex flex-col rounded-2xl border border-border/80 bg-card/98 backdrop-blur-xl shadow-dropdown z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden select-none"
    >
      {/* Top Header */}
      <div className="p-3.5 pb-2.5 border-b border-border/50 shrink-0 bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-foreground font-heading">
              Thông báo điều hành
            </h2>
            {unreadCount > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 tabular-nums">
                {unreadCount} mới
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Check size={12} strokeWidth={1.5} className="text-emerald-500" />
                <span>Đã đọc hết</span>
              </span>
            )}
          </div>

          {/* Direct Action: Mark all as read button */}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              title="Đánh dấu tất cả thông báo là đã đọc"
            >
              <CheckCheck size={13} strokeWidth={1.5} className="text-primary" />
              <span>Đã đọc tất cả</span>
            </button>
          )}
        </div>

        {/* Theme-Synchronized Segmented Filter Control */}
        <div className="flex items-center justify-between gap-2 mt-2.5">
          <div className="inline-flex items-center p-0.5 rounded-xl bg-muted/70 border border-border/50 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                filter === "all"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                filter === "unread"
                  ? "bg-card text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <span>Chưa đọc</span>
              {unreadCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/20 tabular-nums">
                  {unreadCount}
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-medium text-muted-foreground bg-muted tabular-nums">
                  0
                </span>
              )}
            </button>
          </div>

          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            {filteredNotifications.length} mục
          </span>
        </div>
      </div>

      {/* Scrollable Notification List */}
      <div className="flex-1 overflow-y-auto overscroll-contain py-1 divide-y divide-border/30 thin-scrollbar">
        {filteredNotifications.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="size-10 rounded-full bg-secondary/80 text-muted-foreground flex items-center justify-center mx-auto mb-2.5">
              <Check size={18} strokeWidth={1.5} />
            </div>
            <p className="text-xs font-semibold text-foreground">Không có thông báo chưa đọc nào</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Bạn đã nắm bắt hết mọi thông tin điều hành</p>
          </div>
        ) : (
          <>
            {/* Section: Mới */}
            {newItems.length > 0 && (
              <div className="pb-1">
                <div className="px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/80 bg-muted/20">
                  Mới cập nhật
                </div>
                <div className="space-y-0.5 px-1 pt-1">
                  {newItems.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onRead={() => markAsRead(item.id)}
                      onClose={onClose}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Section: Trước đó */}
            {earlierItems.length > 0 && (
              <div className="pt-1 pb-1">
                <div className="px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/80 bg-muted/20">
                  Trước đó
                </div>
                <div className="space-y-0.5 px-1 pt-1">
                  {earlierItems.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onRead={() => markAsRead(item.id)}
                      onClose={onClose}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border/50 bg-muted/20 text-center shrink-0">
        <Link
          href="/notifications"
          onClick={onClose}
          className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
        >
          <span>Xem tất cả thông báo điều hành</span>
          <ExternalLink size={12} strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}

interface NotificationRowProps {
  item: QCETNotification;
  onRead: () => void;
  onClose: () => void;
}

function NotificationRow({ item, onRead, onClose }: NotificationRowProps) {
  const personnel = getActorPersonnel(item.actorName);
  const badge = getTypeBadge(item.type);
  const BadgeIcon = badge.icon;

  const handleClick = () => {
    onRead();
    onClose();
  };

  return (
    <Link
      href={item.linkHref}
      onClick={handleClick}
      className={cn(
        "group relative flex items-start gap-3 p-2.5 rounded-xl transition-all cursor-pointer border border-transparent",
        item.isRead
          ? "hover:bg-muted/50 opacity-85 hover:opacity-100"
          : "bg-primary/[0.04] dark:bg-primary/[0.08] hover:bg-muted/70 font-medium border-l-primary"
      )}
    >
      {/* Avatar Container with Theme-Harmonized Mini Badge */}
      <div className="relative shrink-0 mt-0.5">
        <div className="size-10 rounded-full overflow-hidden bg-muted border border-border/60 flex items-center justify-center shadow-2xs">
          {personnel?.avatar ? (
            <Image
              src={personnel.avatar}
              alt={item.actorName}
              width={40}
              height={40}
              unoptimized
              className="size-full object-cover"
            />
          ) : (
            <span className="font-bold text-xs text-foreground">
              {getActorInitials(item.actorName)}
            </span>
          )}
        </div>

        {/* Micro overlay icon badge */}
        <div
          className={cn(
            "absolute -bottom-1 -right-1 size-4.5 rounded-full ring-2 ring-card flex items-center justify-center shadow-2xs",
            badge.bg
          )}
        >
          <BadgeIcon size={10} strokeWidth={1.5} />
        </div>
      </div>

      {/* Content text */}
      <div className="flex-1 min-w-0 pr-1">
        <p className="text-xs text-foreground leading-snug line-clamp-2">
          <span className="font-bold text-foreground">{item.actorName}</span>{" "}
          <span className="text-muted-foreground">{item.action}</span>{" "}
          <span className="font-semibold text-foreground">&ldquo;{item.targetTitle}&rdquo;</span>
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="px-1 py-0.2 rounded text-[9.5px] font-mono font-semibold bg-muted text-muted-foreground border border-border/50">
            {item.category}
          </span>
          <span className="text-[10.5px] text-muted-foreground font-mono tabular-nums flex items-center gap-1">
            <Clock size={10} strokeWidth={1.5} className="text-muted-foreground/80 shrink-0" />
            <span>{item.timestamp}</span>
          </span>
        </div>
      </div>

      {/* Unread Indicator or Quick Mark Read Button on hover */}
      {!item.isRead ? (
        <div className="self-center shrink-0 flex items-center gap-1 pr-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRead();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-card hover:shadow-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Đánh dấu đã đọc"
            aria-label="Đánh dấu đã đọc"
          >
            <Check size={12} strokeWidth={1.5} />
          </button>
          <span
            className="block size-2 rounded-full bg-primary ring-2 ring-primary/20"
            title="Chưa đọc"
          />
        </div>
      ) : null}
    </Link>
  );
}
