import * as React from "react";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  viewBox: "0 0 16 16",
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.35,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/**
 * Linear-Grade Pure Vector Outline Suite (0% Fills, Razor-Sharp Geometry)
 * Matched 1:1 to Linear's refined micro-stroke aesthetic.
 */

/** 1. Nhiệm vụ — Linear's exact "My issues" viewfinder / target bracket glyph */
export function SidebarIconTasks(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      {/* 4 precision corner brackets */}
      <path d="M5.5 2.5H3.5C2.95 2.5 2.5 2.95 2.5 3.5V5.5" />
      <path d="M10.5 2.5H12.5C13.05 2.5 13.5 2.95 13.5 3.5V5.5" />
      <path d="M13.5 10.5V12.5C13.5 13.05 13.05 13.5 12.5 13.5H10.5" />
      <path d="M5.5 13.5H3.5C2.95 13.5 2.5 13.05 2.5 12.5V10.5" />
      {/* Precision center focal point */}
      <circle cx="8" cy="8" r="1.5" />
    </svg>
  );
}

/** 2. Lịch công tác — Linear-grade minimal calendar outline */
export function SidebarIconCalendar(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <line x1="2" y1="6.5" x2="14" y2="6.5" />
      <line x1="5.5" y1="1.5" x2="5.5" y2="3.5" />
      <line x1="10.5" y1="1.5" x2="10.5" y2="3.5" />
      {/* Single clean active date dot */}
      <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 3. Hộp thư — Linear's exact in-tray outline */
export function SidebarIconInbox(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      {/* Upper open tray rim */}
      <path d="M3.2 4.5H12.8L14 9.5V12.5C14 13.05 13.55 13.5 13 13.5H3C2.45 13.5 2 13.05 2 12.5V9.5L3.2 4.5Z" />
      {/* Front ergonomic thumb cutout */}
      <path d="M2 9.5H5.25L6.25 11H9.75L10.75 9.5H14" />
    </svg>
  );
}

/** 4. Văn bản & Công văn — Pure line folded-corner administrative document */
export function SidebarIconDocuments(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3.5 2H9.5L13.5 6V13C13.5 13.55 13.05 14 12.5 14H3.5C2.95 14 2.5 13.55 2.5 13V3C2.5 2.45 2.95 2 3.5 2Z" />
      <path d="M9.5 2V6H13.5" />
      <line x1="5" y1="8.5" x2="11" y2="8.5" />
      <line x1="5" y1="11" x2="9" y2="11" />
    </svg>
  );
}

/** 5. Cơ cấu & Danh bạ — Linear-style clean node hierarchy tree */
export function SidebarIconOrg(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      {/* Root node */}
      <rect x="6.25" y="2" width="3.5" height="3" rx="1" />
      {/* Connector lines */}
      <path d="M8 5V7.5H3.75V9.5" />
      <path d="M8 7.5H12.25V9.5" />
      {/* Child nodes */}
      <rect x="2" y="9.5" width="3.5" height="3" rx="1" />
      <rect x="10.5" y="9.5" width="3.5" height="3" rx="1" />
    </svg>
  );
}

/** 6. Bàn làm việc (Dashboard / Workbench) — Linear-style modular grid */
export function SidebarIconDesk(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </svg>
  );
}

/** 7. Cài đặt hệ thống — Clean mechanical gear outline */
export function SidebarIconSettings(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.4 3.4L4.5 4.5M11.5 11.5L12.6 12.6M3.4 12.6L4.5 11.5M11.5 4.5L12.6 3.4" />
    </svg>
  );
}
