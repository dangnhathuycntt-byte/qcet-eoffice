"use client";

import * as React from "react";
import { Avatar } from "@base-ui/react/avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, getInitials } from "@/lib/utils";

export const PASTEL_PALETTE = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
  "bg-indigo-100 text-indigo-700",
];

export function getPastelColor(name?: string | null): string {
  if (!name || !name.trim()) return "bg-muted text-muted-foreground";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PASTEL_PALETTE.length;
  return PASTEL_PALETTE[index];
}

const avatarVariants = cva(
  "shrink-0 rounded-full overflow-hidden",
  {
    variants: {
      size: {
        xs: "size-4 text-[8px]",
        sm: "size-5 text-[10px]", // 20px (bảng)
        md: "size-6 text-xs",     // 24px (hoạt động)
        lg: "size-8 text-xs",     // 32px (hồ sơ)
        xl: "size-[60px] text-[22px] font-semibold", // 60px (onboarding)
      },
    },
    defaultVariants: { size: "sm" },
  },
);

export interface UserAvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  name?: string | null;
  avatarUrl?: string | null;
}

/**
 * Accessible avatar with image + initials fallback.
 *
 * Dependencies leveraged:
 * - `@base-ui/react/avatar` — headless, accessible, auto-fallback
 * - `cva` — size variants
 * - `getInitials` from `@/lib/utils` — Vietnamese-aware initials
 */
export function UserAvatar({
  name,
  avatarUrl,
  size,
  className,
  ...props
}: UserAvatarProps) {
  return (
    <Avatar.Root
      className={cn(avatarVariants({ size }), className)}
      {...props}
    >
      {avatarUrl && (
        <Avatar.Image
          src={avatarUrl}
          alt=""
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
        {getInitials(name ?? "")}
      </Avatar.Fallback>
    </Avatar.Root>
  );
}
