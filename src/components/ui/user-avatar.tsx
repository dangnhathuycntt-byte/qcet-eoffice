"use client";

import * as React from "react";
import { Avatar } from "@base-ui/react/avatar";
import { User } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, getInitials } from "@/lib/utils";

export const PASTEL_PALETTE = [
  "bg-blue-500/10 text-blue-700",
  "bg-emerald-500/10 text-emerald-800",
  "bg-amber-500/10 text-amber-800",
  "bg-violet-500/10 text-violet-700",
  "bg-rose-500/10 text-rose-700",
  "bg-sky-500/10 text-sky-800",
];

export function getPastelColor(name?: string | null): string {
  if (!name || name.trim().toLowerCase() === "chưa phân công") {
    return "bg-muted text-muted-foreground font-medium";
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_PALETTE.length;
  return `${PASTEL_PALETTE[index]} font-semibold`;
}

const avatarVariants = cva(
  "shrink-0 rounded-full overflow-hidden select-none",
  {
    variants: {
      size: {
        xs: "size-4 text-[9px] font-semibold", // 16px (bảng phụ, deadlines)
        sm: "size-5 text-[10px] font-semibold", // 20px (bảng chính, sidebar)
        md: "size-6 text-xs font-semibold", // 24px (hoạt động, preview)
        lg: "size-8 text-sm font-semibold", // 32px (hồ sơ, topbar)
        xl: "size-[60px] text-2xl font-bold", // 60px (onboarding, profile hero)
      },
    },
    defaultVariants: { size: "sm" },
  },
);

export type UserPresenceStatus = "online" | "away" | "busy" | "offline" | "meeting";

export interface UserPresenceProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: UserPresenceStatus;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

export function UserPresence({ status = "online", size = "sm", className, ...props }: UserPresenceProps) {
  const statusColor = {
    online: "bg-primary",
    away: "bg-muted-foreground",
    busy: "bg-destructive",
    meeting: "bg-foreground",
    offline: "bg-muted-foreground",
  }[status];

  const dotSize = {
    xs: "size-1.5",
    sm: "size-2",
    md: "size-2.5",
    lg: "size-3",
    xl: "size-4",
  }[size];

  const statusLabel = {
    online: "Trực tuyến",
    away: "Vắng mặt",
    busy: "Đang bận",
    meeting: "Đang họp",
    offline: "Ngoại tuyến",
  }[status];

  return (
    <span
      role="status"
      aria-label={statusLabel}
      title={statusLabel}
      className={cn(
        "inline-block rounded-full ring-2 ring-background shrink-0",
        dotSize,
        statusColor,
        className
      )}
      {...props}
    />
  );
}

export interface UserAvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  name?: string | null;
  avatarUrl?: string | null;
  presence?: UserPresenceStatus;
}

/**
 * Accessible avatar with image + initials fallback & optional presence indicator.
 *
 * Dependencies leveraged:
 * - `@base-ui/react/avatar` — headless, accessible, auto-fallback
 * - `cva` — size variants
 * - `getInitials` from `@/lib/utils` — Vietnamese-aware initials
 */
export function UserAvatar({
  name,
  avatarUrl,
  size = "sm",
  presence,
  className,
  ...props
}: UserAvatarProps) {
  const isUnassigned = !name || name.trim().toLowerCase() === "chưa phân công";

  const avatarNode = (
    <Avatar.Root
      className={cn(avatarVariants({ size }), className)}
      title={name || undefined}
      aria-label={name || "Ảnh đại diện"}
      {...props}
    >
      {avatarUrl && (
        <Avatar.Image
          src={avatarUrl}
          alt={name || "Ảnh đại diện"}
          className="size-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
      <Avatar.Fallback
        className={cn(
          "flex size-full items-center justify-center font-medium tabular-nums",
          getPastelColor(name)
        )}
      >
        {isUnassigned ? (
          <User
            className={cn(
              size === "xs" && "size-2.5",
              size === "sm" && "size-3",
              size === "md" && "size-3.5",
              size === "lg" && "size-4",
              size === "xl" && "size-8"
            )}
            strokeWidth={1.5}
          />
        ) : (
          getInitials(name ?? "")
        )}
      </Avatar.Fallback>
    </Avatar.Root>
  );

  if (!presence) {
    return avatarNode;
  }

  return (
    <span className="relative inline-flex shrink-0">
      {avatarNode}
      <span className="absolute bottom-0 right-0 translate-x-0.5 translate-y-0.5">
        <UserPresence status={presence} size={size as any} />
      </span>
    </span>
  );
}

export interface UserAvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  users: Array<{ name?: string | null; avatarUrl?: string | null }>;
  max?: number;
  size?: "xs" | "sm" | "md" | "lg";
}

/**
 * Group avatar display matching Artboard 13:
 * "Nhóm avatar: Tối đa 3 rồi '+N'. Chồng nhau, không viền; tách bằng nền trang."
 */
export function UserAvatarGroup({
  users,
  max = 3,
  size = "sm",
  className,
  ...props
}: UserAvatarGroupProps) {
  const visibleUsers = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div
      className={cn("flex items-center select-none [&>*:not(:first-child)]:-ml-1.5", className)}
      {...props}
    >
      {visibleUsers.map((u, i) => (
        <UserAvatar
          key={i}
          name={u.name}
          avatarUrl={u.avatarUrl}
          size={size}
          className="ring-2 ring-background shrink-0"
        />
      ))}
      {remaining > 0 && (
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-secondary text-muted-foreground font-medium tabular-nums ring-2 ring-background shrink-0",
            size === "xs" && "size-4 text-xs",
            size === "sm" && "size-5 text-xs",
            size === "md" && "size-6 text-xs",
            size === "lg" && "size-8 text-xs"
          )}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}
