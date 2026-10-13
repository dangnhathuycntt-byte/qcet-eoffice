import * as React from "react";

export interface SidebarIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * Bộ icon điều hướng theo sidebar chính của Linear: lưới 16 (vẽ ở 16px), chỉ nét viền mảnh 1,25px,
 * khung bo lớn, không mảng tô (riêng chấm của "Thêm").
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

/** 1. Tổng quan: ngôi nhà, cửa vòm */
export function IconSidebarHome(props: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <path d="M2.5 7.2c0-.4.2-.8.5-1.1l4-3.5a1.5 1.5 0 0 1 2 0l4 3.5c.3.3.5.7.5 1.1v5.3a1.75 1.75 0 0 1-1.75 1.75h-7.5A1.75 1.75 0 0 1 2.5 12.5Z" />
      <path d="M6.25 14.25V11.5a1.75 1.75 0 0 1 3.5 0v2.75" />
    </SidebarSvg>
  );
}

/** 2. Nhiệm vụ: hai ô chồng (như icon Issues của Linear) */
export function IconSidebarTasks(props: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <rect x="1.75" y="1.75" width="9" height="9" rx="2.75" />
      <path d="M13.25 5.5a1.75 1.75 0 0 1 1 1.6v4.4a2.75 2.75 0 0 1-2.75 2.75H7.1a1.75 1.75 0 0 1-1.6-1" />
    </SidebarSvg>
  );
}

/** 3. Hộp thư: khay thư */
export function IconSidebarMail(props: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <rect x="1.75" y="2.25" width="12.5" height="11.5" rx="3.25" />
      <path d={TRAY_LINE} />
    </SidebarSvg>
  );
}

/** 4. Lịch công tác */
export function IconSidebarCalendar(props: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <rect x="1.75" y="2.75" width="12.5" height="11.5" rx="3.25" />
      <path d="M5.25 1.25v2.5M10.75 1.25v2.5M1.75 6.75h12.5" />
    </SidebarSvg>
  );
}

/** 5. Văn bản đến: khay hở, mũi tên đi vào */
export function IconSidebarInboxIn(props: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <path d="M4.5 3.75h-.5a2.25 2.25 0 0 0-2.25 2.25v4.5a3.25 3.25 0 0 0 3.25 3.25h6a3.25 3.25 0 0 0 3.25-3.25V6a2.25 2.25 0 0 0-2.25-2.25h-.5" />
      <path d={TRAY_LINE} />
      <path d="M8 1.5v5.25M5.9 4.75 8 6.85l2.1-2.1" />
    </SidebarSvg>
  );
}

/** 6. Văn bản đi: máy bay giấy */
export function IconSidebarSend(props: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <path d="M13.75 2.25 2.25 6.6l3.65 1.6 2 1.9 1.6 3.65Z" />
      <path d="M5.9 8.2 13.75 2.25" />
    </SidebarSvg>
  );
}

/** 7. Tờ trình nội bộ: trang giấy gấp góc */
export function IconSidebarDocLines(props: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <path d="M9.25 1.75H5.25a2.5 2.5 0 0 0-2.5 2.5v7.5a2.5 2.5 0 0 0 2.5 2.5h5.5a2.5 2.5 0 0 0 2.5-2.5V5.75Z" />
      <path d="M9.25 1.75v2.5a1.5 1.5 0 0 0 1.5 1.5h2.5" />
      <path d="M5.75 8.75h4.5M5.75 11.25h2.75" />
    </SidebarSvg>
  );
}

/** 8. Hồ sơ công việc: thư mục */
export function IconSidebarFolder(props: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <path d="M1.75 5.25a2.5 2.5 0 0 1 2.5-2.5h2.1c.55 0 1.05.25 1.4.7l.8 1.05h3.2a2.5 2.5 0 0 1 2.5 2.5v4.75a2.5 2.5 0 0 1-2.5 2.5h-7.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M1.75 6.75h12.5" />
    </SidebarSvg>
  );
}

/** 9. Cơ cấu & Danh bạ: thẻ người (như icon đội của Linear) */
export function IconSidebarPeople(props: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="3.5" />
      <circle cx="8" cy="6.6" r="1.85" />
      <path d="M4.9 11.75c.5-1.35 1.7-2.2 3.1-2.2s2.6.85 3.1 2.2" />
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

/** 11. Mở/đóng sidebar: khung 14×12 trên lưới 16 và vạch ngăn lệch trái như nút sidebar của Linear (vẽ ở 14px) */
export function IconSidebarPanel(props: SidebarIconProps) {
  return (
    <SidebarSvg {...props}>
      <rect x="1.625" y="2.625" width="12.75" height="10.75" rx="2.25" />
      <path d="M4.75 5.625v4.75" />
    </SidebarSvg>
  );
}
