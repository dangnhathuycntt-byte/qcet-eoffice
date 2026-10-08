import * as React from "react";

export interface SidebarIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * 1. Tổng quan (Home) — Vector chính xác từ Vector 2758.svg
 */
export function IconSidebarHome({
  size = 19,
  strokeWidth = 1.5,
  className,
  ...props
}: SidebarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 19 19"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M15.8608 5.91267L17.2576 7.45816C17.4897 7.71498 17.6182 8.04884 17.6182 8.39502V14.8322C17.6182 16.3755 16.3671 17.6266 14.8238 17.6266H3.6112C2.06788 17.6266 0.816772 16.3755 0.816772 14.8322V8.14783C0.816772 7.75385 0.983107 7.37818 1.27481 7.11335L7.41125 1.54221C8.45104 0.598203 10.0299 0.572572 11.0998 1.48233L13.6217 3.62679C13.6822 3.67823 13.7752 3.63524 13.7752 3.55583V1.74251M6.13607 14.2296H11.924"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 2. Nhiệm vụ / Công việc (Job listings / Briefcase) — Theo đúng hình mẫu trong screenshot
 */
export function IconSidebarTasks({
  size = 19,
  strokeWidth = 1.5,
  className,
  ...props
}: SidebarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 19 19"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Tay cầm bo tròn */}
      <path
        d="M6.5 4.5V3C6.5 2.17 7.17 1.5 8 1.5H11C11.83 1.5 12.5 2.17 12.5 3V4.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Thân cặp bo tròn */}
      <rect
        x="1.75"
        y="4.5"
        width="15.5"
        height="12"
        rx="3.2"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Đường nắp mở cặp uốn cong nhẹ ở giữa */}
      <path
        d="M1.75 9.5H6.8L7.8 11.2C8 11.5 8.5 11.8 9 11.8H10C10.5 11.8 11 11.5 11.2 11.2L12.2 9.5H17.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 3. Hộp thư (Mail / Inbox) — Bo tròn mềm mại đồng bộ
 */
export function IconSidebarMail({
  size = 19,
  strokeWidth = 1.5,
  className,
  ...props
}: SidebarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 19 19"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        x="1.75"
        y="3.5"
        width="15.5"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 5.2L7.9 9.6C8.8 10.3 10.2 10.3 11.1 9.6L16.5 5.2"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 4. Lịch công tác (Calendar) — Bo tròn mềm mại
 */
export function IconSidebarCalendar({
  size = 19,
  strokeWidth = 1.5,
  className,
  ...props
}: SidebarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 19 19"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        x="2"
        y="3.5"
        width="15"
        height="13"
        rx="3.2"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 1.75V4.25M13 1.75V4.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 7.5H17"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="11.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

/**
 * 5. Báo cáo / Văn bản đến (Reports) — Giống hệt icon "Reports" trong ảnh screenshot
 */
export function IconSidebarReports({
  size = 19,
  strokeWidth = 1.5,
  className,
  ...props
}: SidebarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 19 19"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        x="2.75"
        y="1.75"
        width="13.5"
        height="15.5"
        rx="3.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 3 cột biểu đồ bo tròn bên trong */}
      <path
        d="M6.5 13.5V11M9.5 13.5V8M12.5 13.5V10"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 6. Văn bản đi (Outgoing Paper Airplane) — Bo tròn mượt mà
 */
export function IconSidebarSend({
  size = 19,
  strokeWidth = 1.5,
  className,
  ...props
}: SidebarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 19 19"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M16.5 2.5L8.5 10.5M16.5 2.5L11.5 16.5C11.3 17 10.6 17.1 10.3 16.6L7.5 11.5L2.4 8.7C1.9 8.4 2 7.7 2.5 7.5L16.5 2.5Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 7. Tờ trình nội bộ (Document Paper with lines) — Bo tròn
 */
export function IconSidebarDocLines({
  size = 19,
  strokeWidth = 1.5,
  className,
  ...props
}: SidebarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 19 19"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        x="2.75"
        y="1.75"
        width="13.5"
        height="15.5"
        rx="3.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 7H12.5M6.5 10.5H12.5M6.5 14H10"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 8. Hồ sơ công việc (Folder) — Bo tròn
 */
export function IconSidebarFolder({
  size = 19,
  strokeWidth = 1.5,
  className,
  ...props
}: SidebarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 19 19"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M1.75 6C1.75 4.6 2.85 3.5 4.25 3.5H7.2C7.9 3.5 8.6 3.9 9 4.5L9.8 5.5H14.75C16.15 5.5 17.25 6.6 17.25 8V13.5C17.25 14.9 16.15 16 14.75 16H4.25C2.85 16 1.75 14.9 1.75 13.5V6Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 9. Cơ cấu & Danh bạ (Candidates / People) — Giống hệt icon "Candidates" trong ảnh screenshot
 */
export function IconSidebarPeople({
  size = 19,
  strokeWidth = 1.5,
  className,
  ...props
}: SidebarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 19 19"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Người chính (bên trái) */}
      <circle
        cx="6"
        cy="5.25"
        r="2.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1.75 15.5C1.75 12.8 3.8 10.75 6.5 10.75C9.2 10.75 11.25 12.8 11.25 15.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Người phụ (bên phải) */}
      <path
        d="M11 3.5C11.5 2.9 12.2 2.5 13 2.5C14.4 2.5 15.5 3.6 15.5 5C15.5 5.8 15.1 6.5 14.5 7"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 10.9C14.7 11.4 16.5 13.2 16.75 15.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 10. Thêm / Cài đặt (Settings bracket with X) — Giống hệt icon "Settings" trong ảnh screenshot
 */
export function IconSidebarSettingsBracket({
  size = 19,
  strokeWidth = 1.5,
  className,
  ...props
}: SidebarIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 19 19"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* 4 góc vuông bo tròn */}
      <path
        d="M2 6V4.25C2 3 3 2 4.25 2H6"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 2H14.75C16 2 17 3 17 4.25V6"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 13V14.75C2 16 3 17 4.25 17H6"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 17H14.75C16 17 17 16 17 14.75V13"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dấu x nhỏ ở tâm */}
      <path
        d="M7.75 7.75L11.25 11.25M11.25 7.75L7.75 11.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
