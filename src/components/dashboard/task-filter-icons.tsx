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

// ─── Filter Category Icons (Neutral / Monochrome) ─────────────────────────────

export const FilterIconStatus = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5A3.5 3.5 0 1 1 4.5 8" strokeWidth="1.5" />
    <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const FilterIconPriority = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <rect x="1.5" y="10" width="3" height="4.5" rx="0.75" />
    <rect x="6.5" y="6.5" width="3" height="8" rx="0.75" />
    <rect x="11.5" y="3" width="3" height="11.5" rx="0.75" />
  </svg>
);

export const FilterIconCategory = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3H9.5L14 8L9.5 13H3.5A1.5 1.5 0 0 1 2 11.5V4.5Z" />
    <circle cx="5.25" cy="8" r="1.25" />
  </svg>
);

export const FilterIconDept = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <path d="M1.5 6.5L8 2L14.5 6.5" />
    <path d="M3 6.5V14H13V6.5" />
    <rect x="4.5" y="8" width="2.5" height="2.5" rx="0.5" />
    <rect x="9" y="8" width="2.5" height="2.5" rx="0.5" />
    <path d="M6.5 14V11.25A1.5 1.5 0 0 1 9.5 11.25V14" />
  </svg>
);

export const FilterIconLead = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <circle cx="8" cy="5.5" r="2.75" />
    <path d="M2 14C2 11.239 4.686 9 8 9C11.314 9 14 11.239 14 14" />
  </svg>
);

export const FilterIconCollaborator = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <circle cx="6" cy="5.25" r="2.25" />
    <path d="M1 14C1 11.515 3.239 9.5 6 9.5C7.06 9.5 8.048 9.82 8.85 10.37" strokeOpacity="0.4" />
    <circle cx="10.5" cy="5.25" r="2.25" />
    <path d="M6 14C6 11.515 8.014 9.5 10.5 9.5C12.986 9.5 15 11.515 15 14" />
  </svg>
);

export const FilterIconDeadline = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <rect x="2" y="3.5" width="12" height="11" rx="1.5" />
    <line x1="2" y1="7" x2="14" y2="7" />
    <line x1="5.5" y1="2" x2="5.5" y2="5" />
    <line x1="10.5" y1="2" x2="10.5" y2="5" />
    <circle cx="9.5" cy="10.5" r="1.75" />
    <circle cx="9.5" cy="10.5" r="0.5" fill="currentColor" stroke="none" />
  </svg>
);

export const FilterIconMonth = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <circle cx="8" cy="8" r="6" />
    <line x1="8" y1="8" x2="8" y2="3.5" strokeWidth="1.5" />
    <line x1="8" y1="8" x2="11.2" y2="10" />
    <circle cx="8" cy="8" r="0.875" fill="currentColor" stroke="none" />
  </svg>
);

export const FilterIconHealth = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <path d="M1.5 8.5H4.5L6 4.5L7.75 12L9.5 6L11 8.5H14.5" strokeLinejoin="round" />
  </svg>
);

export const FilterIconOrigin = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <path d="M4.5 1.5H12A1 1 0 0 1 13 2.5V13.5A1 1 0 0 1 12 14.5H4.5A1.5 1.5 0 0 1 3 13V3A1.5 1.5 0 0 1 4.5 1.5Z" />
    <path d="M4.5 1.5A1.5 1.5 0 0 0 3 3V13A1.5 1.5 0 0 0 4.5 14.5" strokeOpacity="0.4" />
    <line x1="5.75" y1="5" x2="11" y2="5" />
    <line x1="5.75" y1="7.25" x2="11" y2="7.25" />
    <line x1="5.75" y1="9.5" x2="9" y2="9.5" />
    <circle cx="9.5" cy="12" r="1.5" />
    <circle cx="9.5" cy="12" r="0.5" fill="currentColor" stroke="none" />
  </svg>
);

// ─── Status Submenu Indicators (Neutral Minimalist) ──────────────────────────���

export const StatusSubAll = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <path d="M2 11L8 13.5L14 11L8 8.5L2 11Z" />
    <path d="M2 8L8 10.5L14 8L8 5.5L2 8Z" />
    <path d="M2 5L8 7.5L14 5L8 2.5L2 5Z" />
  </svg>
);

export const StatusSubNew = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <circle cx="8" cy="8" r="5.5" strokeDasharray="3 2" />
  </svg>
);

export const StatusSubInProgress = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <circle cx="8" cy="8" r="5.5" strokeOpacity="0.3" />
    <path d="M8 2.5A5.5 5.5 0 0 1 13.5 8L8 8Z" fill="currentColor" fillOpacity="0.2" />
    <path d="M8 2.5A5.5 5.5 0 0 1 13.5 8" strokeWidth="1.5" />
  </svg>
);

export const StatusSubReview = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <circle cx="8" cy="8" r="5.5" />
    <circle cx="8" cy="8" r="1.75" fill="currentColor" stroke="none" />
  </svg>
);

export const StatusSubCompleted = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M5.5 8.25L7.25 10L10.75 6.5" strokeWidth="1.5" />
  </svg>
);

// ─── Priority Submenu Indicators (Neutral 3-Level Steps) ──────────────────────

export const PrioritySubBars = ({
  level,
  ...props
}: IconProps & { level: 0 | 1 | 2 | 3 }) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <rect
      x="1.5" y="10" width="3" height="4.5" rx="0.5"
      fill={level >= 1 ? "currentColor" : "none"}
      stroke="currentColor"
      strokeOpacity={level >= 1 ? 1 : 0.35}
    />
    <rect
      x="6.5" y="6.5" width="3" height="8" rx="0.5"
      fill={level >= 2 ? "currentColor" : "none"}
      stroke="currentColor"
      strokeOpacity={level >= 2 ? 1 : 0.35}
    />
    <rect
      x="11.5" y="3" width="3" height="11.5" rx="0.5"
      fill={level >= 3 ? "currentColor" : "none"}
      stroke="currentColor"
      strokeOpacity={level >= 3 ? 1 : 0.35}
    />
  </svg>
);

// ─── Health Submenu Indicators (Neutral Geometric Shapes) ─────────────────────

export const HealthSubOnTrack = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <circle cx="8" cy="8" r="5.5" strokeOpacity="0.5" />
    <circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none" />
  </svg>
);

export const HealthSubAtRisk = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <path d="M8 2.5L14 13.5H2L8 2.5Z" strokeLinejoin="round" />
    <line x1="8" y1="6.5" x2="8" y2="9.5" strokeWidth="1.5" />
    <circle cx="8" cy="11.5" r="0.75" fill="currentColor" stroke="none" />
  </svg>
);

export const HealthSubOverdue = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <path d="M8 2L14 8L8 14L2 8L8 2Z" strokeLinejoin="round" />
    <line x1="8" y1="5.5" x2="8" y2="8.5" strokeWidth="1.5" />
    <circle cx="8" cy="10.5" r="0.75" fill="currentColor" stroke="none" />
  </svg>
);

export const HealthSubCompleted = (props: IconProps) => (
  <svg {...baseProps} strokeWidth="1.25" {...props}>
    <circle cx="8" cy="8" r="5.5" />
    <circle cx="8" cy="8" r="3.5" fill="currentColor" fillOpacity="0.25" stroke="none" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);
