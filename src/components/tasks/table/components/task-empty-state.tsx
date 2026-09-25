"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { useReducedMotion } from "motion/react";
import { Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { motionTransition } from "@/lib/motion/tokens";
import type { SmartFilterTab } from "../types";

export interface TaskEmptyStateProps {
  title?: string;
  description?: string;
  searchQuery?: string;
  activeTab?: SmartFilterTab | string;
  /** attention/workbox filter (e.g. "requires_my_approval", "overdue") — used to determine hasFilterActive */
  attention?: string;
  status?: string;
  academicMonth?: number | "ALL";
  department?: string;
  category?: string;
  priority?: string;
  userName?: string;
  onResetFilters?: () => void;
  onAddTask?: () => void;
  canAddTask?: boolean;
  className?: string;
}

type MockTask = {
  title: string;
  summary: string;
  assignee: string;
  initial: string;
  date: string;
  status: "WAITING_APPROVAL" | "IN_PROGRESS" | "TODO" | "COMPLETED";
};

const MOCK_TASKS: MockTask[] = [
  {
    title: "Hoàn thiện kế hoạch kiểm định chất lượng HK1",
    summary: "Rà soát tiêu chí 3 và 4 theo chuẩn Bộ GD&ĐT",
    assignee: "Đặng Nhật Huy",
    initial: "H",
    date: "03/10/2026",
    status: "WAITING_APPROVAL",
  },
  {
    title: "Rà soát đề cương chi tiết học phần CNTT",
    summary: "Cập nhật chuẩn đầu ra đáp ứng thực tiễn doanh nghiệp",
    assignee: "Trần Minh Tuấn",
    initial: "T",
    date: "08/10/2026",
    status: "IN_PROGRESS",
  },
  {
    title: "Tổng hợp đăng ký đề tài NCKH giảng viên",
    summary: "Thu thập hồ sơ thuyết minh đề tài cấp cơ sở",
    assignee: "Nguyễn Thị Nam",
    initial: "N",
    date: "15/10/2026",
    status: "TODO",
  },
  {
    title: "Chuẩn bị hồ sơ nghiệm thu công trình CSVC",
    summary: "Biên bản bàn giao thiết bị phòng thực hành mới",
    assignee: "Lê Văn Khoa",
    initial: "K",
    date: "22/10/2026",
    status: "TODO",
  },
];

const SKELETON_WIDTHS = [
  { title: "65%", desc: "45%" },
  { title: "75%", desc: "55%" },
  { title: "55%", desc: "38%" },
  { title: "70%", desc: "50%" },
];

function MockStatusBadge({ status }: { status: MockTask["status"] }) {
  if (status === "COMPLETED") {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700/90">
        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
        <span className="font-medium">Hoàn thành</span>
      </div>
    );
  }
  if (status === "WAITING_APPROVAL") {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-700">
        <span className="size-1.5 rounded-full bg-amber-500/80 shrink-0" />
        <span className="font-medium">Chờ duyệt</span>
      </div>
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-foreground">
        <span className="size-1.5 rounded-full bg-blue-500/80 shrink-0" />
        <span className="font-medium">Đang làm</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
      <span className="font-medium">Mới</span>
    </div>
  );
}

interface GhostTaskRowProps {
  data: MockTask;
  widths: { title: string; desc: string };
  isHovered: boolean;
  anyHovered: boolean;
  reducedMotion: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function GhostTaskRow({
  data,
  widths,
  isHovered,
  anyHovered,
  reducedMotion,
  onMouseEnter,
  onMouseLeave,
}: GhostTaskRowProps) {
  const isDimmed = anyHovered && !isHovered;

  return (
    <div
      className={cn(
        "relative h-[46px] w-full flex items-center border-b border-border/40 cursor-pointer transition-all duration-200 select-none",
        isHovered
          ? "bg-muted/40 rounded-lg border-transparent"
          : isDimmed
          ? "opacity-30"
          : "opacity-85 hover:opacity-100"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Layer 1: Skeleton (Default visible, fades out on hover) */}
      <m.div
        className="absolute inset-0 flex items-center gap-4 px-3 sm:px-4"
        animate={isHovered ? { opacity: 0 } : { opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : motionTransition.enter}
      >
        {/* Task Title + Subtitle */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-4">
          <div
            className="h-2.5 sm:h-3 rounded bg-muted animate-pulse"
            style={{ width: widths.title }}
          />
          <div
            className="h-2 sm:h-2.5 rounded bg-muted/70 animate-pulse hidden xs:block"
            style={{ width: widths.desc }}
          />
        </div>

        {/* Lead Assignee */}
        <div className="flex items-center gap-2 w-32 sm:w-40 shrink-0">
          <div className="size-5 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="h-2.5 rounded bg-muted w-20 sm:w-24 animate-pulse" />
        </div>

        {/* Coordination (Subtasks) */}
        <div className="hidden sm:block w-16 shrink-0 text-center">
          <div className="h-2.5 rounded bg-muted/50 w-3 mx-auto animate-pulse" />
        </div>

        {/* Due Date */}
        <div className="hidden md:block w-28 shrink-0">
          <div className="h-2.5 rounded bg-muted w-18 animate-pulse" />
        </div>

        {/* Status */}
        <div className="flex items-center gap-1.5 w-24 sm:w-28 shrink-0">
          <div className="size-1.5 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="h-2.5 rounded bg-muted w-14 sm:w-16 animate-pulse" />
        </div>
      </m.div>

      {/* Layer 2: Real Mock Data (Reveals on hover with subtle blur fade) */}
      <m.div
        className="absolute inset-0 flex items-center gap-4 px-3 sm:px-4 pointer-events-none"
        animate={
          isHovered
            ? { opacity: 0.95, filter: "blur(0px)" }
            : { opacity: 0, filter: "blur(3px)" }
        }
        transition={reducedMotion ? { duration: 0 } : motionTransition.enter}
      >
        {/* Task Title + Subtitle */}
        <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-4">
          <span className="text-[13px] font-medium text-foreground truncate">
            {data.title}
          </span>
          <span className="text-[11.5px] text-muted-foreground/75 truncate hidden xs:block">
            {data.summary}
          </span>
        </div>

        {/* Lead Assignee */}
        <div className="flex items-center gap-2 w-32 sm:w-40 shrink-0">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-600/90 text-[10px] font-semibold text-white shadow-2xs">
            {data.initial}
          </span>
          <span className="text-xs font-medium text-foreground truncate">
            {data.assignee}
          </span>
        </div>

        {/* Coordination */}
        <div className="hidden sm:block w-16 shrink-0 text-center text-muted-foreground/40 text-xs">
          —
        </div>

        {/* Due Date */}
        <div className="hidden md:block w-28 shrink-0">
          <span className="font-mono text-xs text-muted-foreground">
            {data.date}
          </span>
        </div>

        {/* Status */}
        <div className="w-24 sm:w-28 shrink-0">
          <MockStatusBadge status={data.status} />
        </div>
      </m.div>
    </div>
  );
}

function GhostTablePreview({ reducedMotion }: { reducedMotion: boolean }) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{
        maskImage:
          "linear-gradient(to bottom, black 40%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, black 40%, transparent 100%)",
      }}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <div className="flex flex-col w-full">
        {MOCK_TASKS.map((task, i) => (
          <GhostTaskRow
            key={i}
            data={task}
            widths={SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]}
            isHovered={hoveredIndex === i}
            anyHovered={hoveredIndex !== null}
            reducedMotion={reducedMotion}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </div>
    </div>
  );
}

export const TaskEmptyState = React.memo(function TaskEmptyState({
  title,
  description,
  searchQuery,
  activeTab,
  attention,
  status,
  academicMonth,
  department,
  category,
  priority,
  userName,
  onResetFilters,
  onAddTask,
  canAddTask = false,
  className,
}: TaskEmptyStateProps) {
  const reducedMotion = useReducedMotion() ?? false;

  // Determine contextual heading and description
  let displayTitle = title;
  let displayDescription = description;
  const isSearchEmpty = Boolean(searchQuery && searchQuery.trim().length > 0);

  const activeFiltersCount = [
    Boolean(isSearchEmpty),
    Boolean(department && department !== "ALL"),
    Boolean(category && category !== "ALL"),
    Boolean(priority && priority !== "ALL"),
    Boolean(status && status !== "ALL" && status !== "all"),
    Boolean(attention && attention !== "ALL" && attention !== "all"),
    Boolean(academicMonth !== undefined && academicMonth !== "ALL"),
    Boolean(activeTab && activeTab !== "all" && activeTab !== "ALL"),
  ].filter(Boolean).length;

  const hasFilterActive = activeFiltersCount > 0;

  if (!displayTitle) {
    if (activeFiltersCount > 1) {
      displayTitle = "Không có nhiệm vụ phù hợp";
      displayDescription = "Thử thay đổi hoặc xóa bộ lọc hiện tại";
    } else if (isSearchEmpty) {
      displayTitle = `Không tìm thấy nhiệm vụ với từ khóa "${searchQuery}"`;
      displayDescription =
        "Vui lòng thử tìm kiếm với từ khóa khác, hoặc kiểm tra lại bộ lọc danh mục và trạng thái.";
    } else if (activeTab === "overdue" || attention === "overdue") {
      displayTitle = "Không có nhiệm vụ nào quá hạn";
      displayDescription =
        "Tuyệt vời! Tất cả các nhiệm vụ đều đang đúng tiến độ hoặc đã được giải quyết.";
    } else if (
      status === "WAITING_APPROVAL" ||
      status === "waiting_approval" ||
      activeTab === "waiting_approval" ||
      attention === "requires_my_approval"
    ) {
      displayTitle = "Không có nhiệm vụ nào chờ phê duyệt";
      displayDescription =
        "Hiện tại không có nhiệm vụ hoặc báo cáo nào đang chờ duyệt từ bạn.";
    } else if (department && department !== "ALL") {
      displayTitle = `Đơn vị "${department}" chưa có nhiệm vụ`;
      displayDescription =
        "Không có nhiệm vụ nào được phân công hoặc đăng ký cho đơn vị này theo các tiêu chí hiện tại.";
    } else if (academicMonth !== undefined && academicMonth !== "ALL") {
      displayTitle = `Không có nhiệm vụ trong Tháng ${academicMonth}`;
      displayDescription = "Thử thay đổi hoặc xóa bộ lọc hiện tại";
    } else if (activeFiltersCount > 0) {
      displayTitle = "Không có nhiệm vụ phù hợp";
      displayDescription = "Thử thay đổi hoặc xóa bộ lọc hiện tại";
    } else {
      displayTitle = "Chưa có nhiệm vụ nào được phân công trong kỳ này";
      displayDescription =
        "Hiện tại không có nhiệm vụ nào trong cơ sở dữ liệu. Thầy/Cô có thể tạo nhiệm vụ mới hoặc làm mới dữ liệu từ máy chủ.";
    }
  }

  return (
    <div
      data-slot="workspace-empty-state"
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center min-h-[48vh] sm:min-h-[54vh] py-8 px-4 sm:px-6 text-center select-none max-w-4xl mx-auto w-full",
        className
      )}
    >
      {/* Ghost Table Skeleton Preview (Seamless, No Outer Box, Bottom Fade Mask) */}
      <div className="w-full max-w-3xl mb-8">
        <GhostTablePreview reducedMotion={reducedMotion} />
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-foreground tracking-tight max-w-md">
        {displayTitle}
      </h3>

      {/* Description */}
      <p className="mt-1.5 text-xs sm:text-[13px] text-muted-foreground max-w-md leading-relaxed">
        {displayDescription}
      </p>

      {/* Action Buttons */}
      <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
        {hasFilterActive && onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            title="Đặt lại bộ lọc"
            aria-label="Xóa bộ lọc"
            className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground shadow-2xs hover:bg-muted hover:text-foreground cursor-pointer active:scale-[0.98] transition-all"
          >
            <RotateCcw className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span>Xóa bộ lọc</span>
          </button>
        )}

        {canAddTask && onAddTask && (
          <button
            type="button"
            onClick={onAddTask}
            className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-lg bg-foreground text-background text-xs font-semibold shadow-xs hover:bg-foreground/90 cursor-pointer active:scale-[0.98] transition-all"
          >
            <Plus className="size-3.5" strokeWidth={1.5} />
            <span>Tạo nhiệm vụ mới</span>
          </button>
        )}
      </div>
    </div>
  );
});
