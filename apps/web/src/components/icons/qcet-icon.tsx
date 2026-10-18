import * as React from "react";
import { qcetOutlinePaths, type QcetIconName } from "./qcet-outline-paths";

export type QcetIconProps = React.SVGProps<SVGSVGElement> & {
  name: QcetIconName;
  size?: number;
  title?: string;
};

/** QCET outline: 24px grid, 1.5px ink, rounded corners; no background. */
export const QcetIcon = React.forwardRef<SVGSVGElement, QcetIconProps>(
  ({ name, size = 20, title, ...props }, ref) => (
    <svg ref={ref} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title || props["aria-label"] || props["aria-labelledby"] ? undefined : true}
      role={title || props["aria-label"] || props["aria-labelledby"] ? "img" : undefined}
      {...props}>
      {title && <title>{title}</title>}
      {qcetOutlinePaths[name].map((d, index) => <path key={index} d={d} strokeWidth={name === "more" ? 3 : undefined} />)}
    </svg>
  ),
);
QcetIcon.displayName = "QcetIcon";
export type { QcetIconName };
