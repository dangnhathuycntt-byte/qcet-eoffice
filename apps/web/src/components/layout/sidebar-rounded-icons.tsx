import * as React from "react";
import { cn } from "@/lib/utils";

export interface SidebarIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
  className?: string;
  /**
   * Kiểu "mực" như bộ icon nhiệm vụ (`task-icons`, menu chuột phải): tô đặc một mảng chính (đầu người, dải đầu lịch, đáy khay,
   * góc gấp…), nét giữ 1,25px. Hộp Ctrl+K bật (người dùng gửi ảnh menu chuột phải 22/10/2026); sidebar giữ nét viền.
   */
  ink?: boolean;
}

/** Mảng tô của kiểu "mực": cùng màu nét, không viền để không phình hình. */
function InkFill({ d }: { d: string }) {
  return <path d={d} fill="currentColor" stroke="none" data-ink="" />;
}

/**
 * Bộ icon điều hướng theo sidebar chính của Linear: lưới 16 (vẽ ở 16px), chỉ nét viền mảnh 1,25px,
 * khung bo lớn, không mảng tô (riêng chấm của "Thêm"; `ink` thêm một mảng tô, xem `SidebarIconProps`). Nét giữ 1,25px cả khi hiện nhỏ hơn 16px (`data-slot`, xem
 * `globals.css`), cùng độ dày với icon Lucide.
 */
function SidebarSvg({ size = 16, strokeWidth = 1.25, className, children, ...props }: SidebarIconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      data-slot="sidebar-icon"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Đáy khay (dùng chung cho Hộp thư và Văn bản đến) */
const TRAY_LINE = "M1.75 9h3l1 1.5h4.5l1-1.5h3";
/** Đáy khay dưới đường khay (mảng tô kiểu "mực" của Hộp thư, Văn bản đến) */
const TRAY_BASE = "M1.75 9h3l1 1.5h4.5l1-1.5h3v1.5a3.25 3.25 0 0 1-3.25 3.25h-6a3.25 3.25 0 0 1-3.25-3.25Z";

/** 2. Nhiệm vụ: hai ô chồng (như icon Issues của Linear) */
export function IconSidebarTasks({ ink, ...props }: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <rect x="1.75" y="1.75" width="9" height="9" rx="2.75" fill={ink ? "currentColor" : undefined} />
      <path d="M13.25 5.5a1.75 1.75 0 0 1 1 1.6v4.4a2.75 2.75 0 0 1-2.75 2.75H7.1a1.75 1.75 0 0 1-1.6-1" />
    </SidebarSvg>
  );
}

/** 3. Hộp thư: khay thư */
export function IconSidebarMail({ ink, ...props }: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      {ink && <InkFill d={TRAY_BASE} />}
      <rect x="1.75" y="2.25" width="12.5" height="11.5" rx="3.25" />
      <path d={TRAY_LINE} />
    </SidebarSvg>
  );
}

/** 4. Lịch công tác */
export function IconSidebarCalendar({ ink, ...props }: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      {ink && <InkFill d="M1.75 6.75V6A3.25 3.25 0 0 1 5 2.75h6A3.25 3.25 0 0 1 14.25 6v.75Z" />}
      <rect x="1.75" y="2.75" width="12.5" height="11.5" rx="3.25" />
      <path d="M5.25 1.25v2.5M10.75 1.25v2.5M1.75 6.75h12.5" />
    </SidebarSvg>
  );
}

/** 5. Văn bản đến: khay hở, mũi tên đi vào */
export function IconSidebarInboxIn({ ink, ...props }: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      {ink && <InkFill d={TRAY_BASE} />}
      <path d="M4.5 3.75h-.5a2.25 2.25 0 0 0-2.25 2.25v4.5a3.25 3.25 0 0 0 3.25 3.25h6a3.25 3.25 0 0 0 3.25-3.25V6a2.25 2.25 0 0 0-2.25-2.25h-.5" />
      <path d={TRAY_LINE} />
      <path d="M8 1.5v5.25M5.9 4.75 8 6.85l2.1-2.1" />
    </SidebarSvg>
  );
}

/** 6. Văn bản đi: máy bay giấy */
export function IconSidebarSend({ ink, ...props }: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      {ink && <InkFill d="M13.75 2.25 2.25 6.6l3.65 1.6Z" />}
      <path d="M13.75 2.25 2.25 6.6l3.65 1.6 2 1.9 1.6 3.65Z" />
      <path d="M5.9 8.2 13.75 2.25" />
    </SidebarSvg>
  );
}

/** 7. Tờ trình nội bộ: trang giấy gấp góc */
export function IconSidebarDocLines({ ink, ...props }: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      {ink && <InkFill d="M9.25 1.75v2.5a1.5 1.5 0 0 0 1.5 1.5h2.5Z" />}
      <path d="M9.25 1.75H5.25a2.5 2.5 0 0 0-2.5 2.5v7.5a2.5 2.5 0 0 0 2.5 2.5h5.5a2.5 2.5 0 0 0 2.5-2.5V5.75Z" />
      <path d="M9.25 1.75v2.5a1.5 1.5 0 0 0 1.5 1.5h2.5" />
      <path d="M5.75 8.75h4.5M5.75 11.25h2.75" />
    </SidebarSvg>
  );
}

/** Ghi chú cá nhân: sổ tay có gáy lò xo (hình theo `Notebook` của Lucide, thu về lưới 16) */
export function IconSidebarNotes({ ink, ...props }: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      {ink && (
        // Bìa tô đặc, hai dòng chữ khoét rỗng (evenodd) thay cho nét
        <path
          d="M5.25 1.75h5.5a2.5 2.5 0 0 1 2.5 2.5v7.5a2.5 2.5 0 0 1-2.5 2.5h-5.5a2.5 2.5 0 0 1-2.5-2.5v-7.5a2.5 2.5 0 0 1 2.5-2.5ZM7.25 5.125h3a.625.625 0 0 1 0 1.25h-3a.625.625 0 0 1 0-1.25ZM7.25 7.625h3a.625.625 0 0 1 0 1.25h-3a.625.625 0 0 1 0-1.25Z"
          fill="currentColor"
          fillRule="evenodd"
          stroke="none"
          data-ink=""
        />
      )}
      <path d="M5.25 1.75h5.5a2.5 2.5 0 0 1 2.5 2.5v7.5a2.5 2.5 0 0 1-2.5 2.5h-5.5a2.5 2.5 0 0 1-2.5-2.5v-7.5a2.5 2.5 0 0 1 2.5-2.5Z" />
      <path d="M1.75 5h2M1.75 8h2M1.75 11h2" />
      {!ink && <path d="M7.25 5.75h3M7.25 8.25h3" />}
    </SidebarSvg>
  );
}

/** 8. Hồ sơ công việc: thư mục */
export function IconSidebarFolder({ ink, ...props }: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      {ink && <InkFill d="M1.75 6.75V5.25a2.5 2.5 0 0 1 2.5-2.5h2.1c.55 0 1.05.25 1.4.7l.8 1.05h3.2a2.5 2.5 0 0 1 2.5 2.5v-.25Z" />}
      <path d="M1.75 5.25a2.5 2.5 0 0 1 2.5-2.5h2.1c.55 0 1.05.25 1.4.7l.8 1.05h3.2a2.5 2.5 0 0 1 2.5 2.5v4.75a2.5 2.5 0 0 1-2.5 2.5h-7.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M1.75 6.75h12.5" />
    </SidebarSvg>
  );
}

/** 9. Cơ cấu & Danh bạ: thẻ người (như icon đội của Linear) */
export function IconSidebarPeople({ ink, ...props }: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="3.5" />
      <circle cx="8" cy="6.6" r="1.85" fill={ink ? "currentColor" : undefined} />
      <path d="M4.9 11.75c.5-1.35 1.7-2.2 3.1-2.2s2.6.85 3.1 2.2" />
    </SidebarSvg>
  );
}

/** 9b. Báo cáo: khung bo có ba cột số liệu (như icon Insights của Linear) */
export function IconSidebarChart({ ink, ...props }: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="3.5" />
      {ink ? (
        // Cột số liệu tô đặc như cột của icon Độ ưu tiên
        <g fill="currentColor" stroke="none" data-ink="">
          <rect x="4.25" y="7.75" width="2" height="4.25" rx="1" />
          <rect x="7" y="3.75" width="2" height="8.25" rx="1" />
          <rect x="9.75" y="6.25" width="2" height="5.75" rx="1" />
        </g>
      ) : (
        <path d="M5.25 11.25v-2.5M8 11.25v-6.5M10.75 11.25v-4" />
      )}
    </SidebarSvg>
  );
}

/** 10. Thêm: ba chấm */
export function IconSidebarMore(props: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <circle cx="3.5" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </SidebarSvg>
  );
}

/**
 * Trợ lý: tia sáng bốn cánh cùng hình với `AgentIcon` (Agent soạn nhiệm vụ) để nhận ra cùng một nhóm AI,
 * vẽ trên lưới 16 với nét 1,25px như các icon sidebar khác.
 */
export function IconSidebarAssistant({ ink, ...props }: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <path d="M7 3.25Q8.15 7.85 12.75 9Q8.15 10.15 7 14.75Q5.85 10.15 1.25 9Q5.85 7.85 7 3.25Z" fill={ink ? "currentColor" : undefined} />
      <path d="M12.75 1.25Q13.19 2.81 14.75 3.25Q13.19 3.69 12.75 5.25Q12.31 3.69 10.75 3.25Q12.31 2.81 12.75 1.25Z" fill="currentColor" stroke="none" />
    </SidebarSvg>
  );
}

/**
 * Soạn mới (cuộc trò chuyện mới): khung bo lớn hở góc trên phải như các icon sidebar, bút chéo đi ra từ góc hở
 * (hình bút theo `SquarePen` của Lucide, thu về lưới 16).
 */
export function IconSidebarCompose({ ink, ...props }: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <path d="M7.5 1.75H5A3.25 3.25 0 0 0 1.75 5v6A3.25 3.25 0 0 0 5 14.25h6A3.25 3.25 0 0 0 14.25 11V8.5" />
      <path d="M12.25 1.75a1 1 0 0 1 2 2l-6 6a1.35 1.35 0 0 1-.58.34l-1.9.56a.33.33 0 0 1-.42-.42l.56-1.9a1.35 1.35 0 0 1 .34-.58Z" fill={ink ? "currentColor" : undefined} />
    </SidebarSvg>
  );
}

/**
 * Lịch sử trò chuyện: mặt đồng hồ có mũi tên quay ngược ở góc trên trái (hình theo `History` của Lucide, thu về lưới
 * 16, vòng tròn chạm cùng mép 1,75 như khung các icon khác).
 */
export function IconSidebarHistory(props: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <path d="M1.75 8A6.25 6.25 0 1 0 8 1.75a6.75 6.75 0 0 0-4.7 1.9L1.75 5.25" />
      <path d="M1.75 1.75v3.5h3.5" />
      <path d="M8 4.75V8l2.5 1.5" />
    </SidebarSvg>
  );
}

/** Đóng (dấu ×) ở chip cuộc trò chuyện trên thanh dưới của Trợ lý: hai nét chéo, cùng lưới 16 và nét với các icon khác. */
export function IconSidebarClose(props: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <path d="M4.25 4.25l7.5 7.5M11.75 4.25l-7.5 7.5" />
    </SidebarSvg>
  );
}

/**
 * 11. Mở/đóng sidebar: khung 14×12 trên lưới 16 và vạch ngăn lệch trái như nút sidebar của Linear (vẽ ở 14px).
 * Đang mở thì tô kín nửa trái khung.
 */
export function IconSidebarPanel({ active = false, ...props }: SidebarIconProps & { active?: boolean }) {
  return (
    <SidebarSvg {...props}>
      <rect x="1.625" y="2.625" width="12.75" height="10.75" rx="2.25" />
      <path d="M4.75 5.625v4.75" className={cn(PANEL_DIVIDER_CLASS, active && "opacity-0")} />
      <path
        d="M8 2.625H3.875a2.25 2.25 0 0 0-2.25 2.25v6.25a2.25 2.25 0 0 0 2.25 2.25H8z"
        fill="currentColor"
        className={cn(PANEL_FILL_CLASS, "origin-left", active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0")}
      />
    </SidebarSvg>
  );
}

/** Chuyển trạng thái panel: nửa tô trượt ra từ mép ngoài, vạch ngăn mờ dần (giảm chuyển động thì đổi tức thì) */
const PANEL_DIVIDER_CLASS = "transition-opacity duration-200 ease-out motion-reduce:transition-none";
const PANEL_FILL_CLASS =
  "transition-[transform,opacity] duration-200 ease-out [transform-box:fill-box] motion-reduce:transition-none";

/**
 * 12. Mở/đóng panel bên phải: cùng khung với nút sidebar (11). Đóng thì một vạch mảnh sát mép phải bên trong khung; mở
 * thì khối đặc bo góc thụt vào trong khung, không chạm viền (người dùng gửi ảnh nút panel của Linear 19/10/2026).
 */
export function IconSidebarPanelRight({ active = false, ...props }: SidebarIconProps & { active?: boolean }) {
  return (
    <SidebarSvg {...props}>
      <rect x="1.625" y="2.625" width="12.75" height="10.75" rx="2.25" />
      <path d="M11.25 5.625v4.75" className={cn(PANEL_DIVIDER_CLASS, active && "opacity-0")} />
      <rect
        x="7.75"
        y="5"
        width="4.25"
        height="6"
        rx="1.25"
        fill="currentColor"
        className={cn(PANEL_FILL_CLASS, "origin-right", active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0")}
      />
    </SidebarSvg>
  );
}

/** Icon có kiểu "mực" (`ink`). Nơi nhận icon tùy ý (Lucide, `task-icons`) chỉ truyền `ink` cho các icon này. */
export const SIDEBAR_INK_ICONS: ReadonlySet<unknown> = new Set([
  IconSidebarTasks,
  IconSidebarMail,
  IconSidebarCalendar,
  IconSidebarInboxIn,
  IconSidebarSend,
  IconSidebarDocLines,
  IconSidebarNotes,
  IconSidebarFolder,
  IconSidebarPeople,
  IconSidebarChart,
  IconSidebarAssistant,
  IconSidebarCompose,
]);
