"use client";

import * as React from "react";
import { Rows3, Rows4 } from "lucide-react";
import { useDisplayDensity } from "@/components/density-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const DENSITY_CONFIG = {
  comfortable: {
    label: "Thoải mái (48px)",
    next: "compact" as const,
    tooltip: "Đang ở chế độ Thoải mái (48px) - Bấm để chuyển Thu gọn",
    ariaLabel: "Đang ở chế độ Thoải mái (48px) - Bấm để chuyển Thu gọn",
  },
  compact: {
    label: "Thu gọn (38px)",
    next: "comfortable" as const,
    tooltip: "Đang ở chế độ Thu gọn (38px) - Bấm để chuyển Thoải mái",
    ariaLabel: "Đang ở chế độ Thu gọn (38px) - Bấm để chuyển Thoải mái",
  },
} as const;

export interface DensityToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: "outline" | "ghost";
}

export function DensityToggle({
  className,
  showLabel = false,
  variant = "outline",
}: DensityToggleProps) {
  const { density, toggleDensity } = useDisplayDensity();
  const isCompact = density === "compact";
  const config = DENSITY_CONFIG[density] || DENSITY_CONFIG.comfortable;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={variant}
            data-density-toggle="true"
            onClick={toggleDensity}
            className={cn(
              "h-9.5 px-3 min-w-[38px] gap-2 border-border/80 text-xs font-medium cursor-pointer transition-colors relative",
              isCompact && "bg-secondary/80 text-foreground",
              className
            )}
            aria-label={config.ariaLabel}
            title={config.tooltip}
          >
            {isCompact ? (
              <Rows4 className="size-4 shrink-0 text-primary" />
            ) : (
              <Rows3 className="size-4 shrink-0 text-muted-foreground" />
            )}
            {showLabel && <span>{config.label}</span>}
            {isCompact && (
              <span
                className="size-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p className="font-medium">
            {isCompact ? "Đang ở chế độ Thu gọn (38px)" : "Đang ở chế độ Thoải mái (48px)"}
          </p>
          <p className="text-muted-foreground text-xs">
            Bấm để chuyển sang {isCompact ? "Thoải mái (48px)" : "Thu gọn (38px)"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
