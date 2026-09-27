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

// ─── Filter Category Icons (Neutral / Monochrome / Bold & Weighted) ─────────────

export const FilterIconStatus = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <circle cx="8" cy="8" r="6" strokeDasharray="3 2" />
    <circle cx="8" cy="8" r="2.25" fill="currentColor" stroke="none" />
  </svg>
);

export const FilterIconPriority = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <rect x="2" y="9.5" width="3" height="4.5" rx="0.75" fill="currentColor" stroke="none" />
    <rect x="6.5" y="6" width="3" height="8" rx="0.75" fill="currentColor" stroke="none" />
    <rect x="11" y="2.5" width="3" height="11.5" rx="0.75" fill="currentColor" stroke="none" />
  </svg>
);

export const FilterIconCategory = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <path d="M2.5 3.5A1 1 0 0 1 3.5 2.5H8.5L13.5 7.5L8.5 12.5H3.5A1 1 0 0 1 2.5 11.5V3.5Z" fill="currentColor" fillOpacity={0.15} />
    <circle cx="5.5" cy="5.5" r="1.25" fill="currentColor" stroke="none" />
  </svg>
);

export const FilterIconDept = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <path d="M2 14V3.5A1.5 1.5 0 0 1 3.5 2H12.5A1.5 1.5 0 0 1 14 3.5V14" />
    <rect x="4.5" y="4.5" width="2.5" height="2" rx="0.5" fill="currentColor" stroke="none" />
    <rect x="9" y="4.5" width="2.5" height="2" rx="0.5" fill="currentColor" stroke="none" />
    <rect x="4.5" y="8" width="2.5" height="2" rx="0.5" fill="currentColor" stroke="none" />
    <rect x="9" y="8" width="2.5" height="2" rx="0.5" fill="currentColor" stroke="none" />
    <path d="M6.5 14V11.5H9.5V14" fill="currentColor" fillOpacity={0.25} />
    <line x1="1" y1="14" x2="15" y2="14" strokeWidth="1.5" />
  </svg>
);

export const FilterIconLead = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <circle cx="8" cy="5" r="3" fill="currentColor" fillOpacity={0.2} />
    <path d="M2.5 14C2.5 10.7 4.9 8.5 8 8.5C11.1 8.5 13.5 10.7 13.5 14" />
  </svg>
);

export const FilterIconCollaborator = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <circle cx="11" cy="5" r="2.25" fill="currentColor" fillOpacity={0.2} />
    <path d="M6.5 14C6.5 11.2 8.5 9.5 11 9.5C12.8 9.5 14.5 10.7 15 14" strokeOpacity="0.4" />
    <circle cx="5.5" cy="5.5" r="2.75" fill="currentColor" fillOpacity={0.25} />
    <path d="M1 14.5C1 11.2 3 9 5.5 9C8 9 10 11.2 10 14.5" />
  </svg>
);

export const FilterIconDeadline = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <rect x="2" y="3" width="12" height="11" rx="1.5" fill="currentColor" fillOpacity={0.12} />
    <line x1="2" y1="6.5" x2="14" y2="6.5" />
    <line x1="5.5" y1="1.5" x2="5.5" y2="4" />
    <line x1="10.5" y1="1.5" x2="10.5" y2="4" />
    <rect x="4.5" y="8.5" width="2" height="2" rx="0.4" fill="currentColor" stroke="none" />
    <rect x="7.5" y="8.5" width="2" height="2" rx="0.4" fill="currentColor" stroke="none" />
    <rect x="10.5" y="8.5" width="1.5" height="2" rx="0.4" fill="currentColor" stroke="none" />
  </svg>
);

export const FilterIconMonth = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <circle cx="8" cy="8" r="6" fill="currentColor" fillOpacity={0.1} />
    <line x1="8" y1="8" x2="8" y2="3.5" />
    <line x1="8" y1="8" x2="11.5" y2="10" />
    <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
  </svg>
);

export const FilterIconHealth = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <path d="M3.75 12.25A6 6 0 1 1 12.25 12.25" strokeOpacity="0.35" />
    <path d="M3.75 12.25A6 6 0 1 1 13 6.5" strokeWidth="1.75" />
    <line x1="8" y1="8" x2="11.2" y2="4.8" strokeWidth="1.5" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const FilterIconProgress = FilterIconHealth;

export const FilterIconOrigin = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <path d="M3 2H10L13.5 5.5V14H3V2Z" fill="currentColor" fillOpacity={0.1} />
    <path d="M10 2V5.5H13.5" fill="currentColor" fillOpacity={0.25} />
    <line x1="5.5" y1="8.5" x2="10.5" y2="8.5" />
    <line x1="5.5" y1="11" x2="8.5" y2="11" />
  </svg>
);

// ─── Status Submenu Indicators (Neutral & Substantial) ─────────────────────────

export const StatusSubAll = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M8 8L8 2.25A5.75 5.75 0 0 1 13.75 8Z" fill="currentColor" fillOpacity={0.6} stroke="none" />
    <path d="M8 8L13.75 8A5.75 5.75 0 0 1 8 13.75Z" fill="currentColor" fillOpacity={0.35} stroke="none" />
    <path d="M8 8L8 13.75A5.75 5.75 0 0 1 2.25 8Z" fill="currentColor" fillOpacity={0.15} stroke="none" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

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

// ─── Priority Submenu Indicators (Solid Bars & Bold Steps) ─────────────────────

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

// ─── Health / Progress Submenu Indicators (Neutral Progress Rings) ──────────────

export const HealthSubAll = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <circle cx="8" cy="8" r="5.75" strokeDasharray="6 2.5" transform="rotate(-90 8 8)" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const HealthSubOnTrack = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <circle cx="8" cy="8" r="5.75" fill="currentColor" fillOpacity={0.12} />
    <path d="M5.5 8L7.25 9.75L10.75 6.25" strokeWidth="1.75" />
  </svg>
);

export const HealthSubAtRisk = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <path d="M8 2.25L14 13.25H2L8 2.25Z" fill="currentColor" fillOpacity={0.15} strokeLinejoin="round" />
    <line x1="8" y1="6" x2="8" y2="9" strokeWidth="1.5" />
    <circle cx="8" cy="11.25" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const HealthSubOverdue = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <path d="M8 2L14 8L8 14L2 8L8 2Z" fill="currentColor" fillOpacity={0.15} strokeLinejoin="round" />
    <line x1="6" y1="6" x2="10" y2="10" strokeWidth="1.5" />
    <line x1="10" y1="6" x2="6" y2="10" strokeWidth="1.5" />
  </svg>
);

export const HealthSubCompleted = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.5" {...props}>
    <circle cx="8" cy="8" r="5.75" fill="currentColor" fillOpacity={0.2} />
    <circle cx="8" cy="8" r="5.75" />
    <path d="M5 8.25L7.25 10.5L11 6" strokeWidth="1.75" />
  </svg>
);

export const ProgressSubAll = HealthSubAll;
export const ProgressSubOnTrack = HealthSubOnTrack;
export const ProgressSubAtRisk = HealthSubAtRisk;
export const ProgressSubOverdue = HealthSubOverdue;
export const ProgressSubCompleted = HealthSubCompleted;
