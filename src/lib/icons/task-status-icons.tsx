/**
 * Status & Priority indicator SVG icons for tasks.
 *
 * These live in lib/ (not components/) so that domain display-config
 * can reference them without crossing the domain→UI boundary.
 * Re-exported by task-filter-icons.tsx for backward compatibility.
 */
import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

// ─── Status Submenu Indicators ──────────────────────────────────────────────────

export const StatusSubNew = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <circle cx="8" cy="8" r="5.75" strokeDasharray="3.5 2.5" />
    <circle cx="8" cy="8" r="1.75" fill="currentColor" fillOpacity={0.25} stroke="none" />
  </svg>
);

export const StatusSubInProgress = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <circle cx="8" cy="8" r="5.75" strokeOpacity="0.4" />
    <path d="M8 2.25A5.75 5.75 0 0 1 13.75 8L8 8Z" fill="currentColor" fillOpacity={0.4} stroke="none" />
    <path d="M8 2.25A5.75 5.75 0 0 1 13.75 8" strokeWidth="1.75" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const StatusSubReview = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <circle cx="8" cy="8" r="5.75" />
    <circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none" />
  </svg>
);

export const StatusSubCompleted = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <circle cx="8" cy="8" r="5.75" fill="currentColor" fillOpacity={0.15} />
    <path d="M5 8.25L7.25 10.5L11 6" strokeWidth="1.75" />
  </svg>
);

// ─── Priority Submenu Indicators ────────────────────────────────────────────────

export const PrioritySubBars = ({
  level,
  ...props
}: IconProps & { level: 0 | 1 | 2 | 3 }) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <rect
      x="1.5" y="9.5" width="3.25" height="5" rx="0.75"
      fill="currentColor"
      fillOpacity={level >= 1 ? 1 : 0.2}
      stroke="none"
    />
    <rect
      x="6.25" y="6" width="3.25" height="8.5" rx="0.75"
      fill="currentColor"
      fillOpacity={level >= 2 ? 1 : 0.2}
      stroke="none"
    />
    <rect
      x="11" y="2" width="3.25" height="12.5" rx="0.75"
      fill="currentColor"
      fillOpacity={level >= 3 ? 1 : 0.2}
      stroke="none"
    />
  </svg>
);

export const PrioritySubUrgent = (props: IconProps) => (
  <PrioritySubBars level={3} {...props} />
);

export const PrioritySubHigh = (props: IconProps) => (
  <PrioritySubBars level={2} {...props} />
);

export const PrioritySubNormal = (props: IconProps) => (
  <PrioritySubBars level={1} {...props} />
);

export const PrioritySubLow = (props: IconProps) => (
  <PrioritySubBars level={0} {...props} />
);
