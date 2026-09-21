"use client";

import * as React from "react";
import { Avatar } from "@base-ui/react/avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, getInitials } from "@/lib/utils";

const avatarVariants = cva(
  "shrink-0 rounded-full ring-1 ring-border/40 overflow-hidden",
  {
    variants: {
      size: {
        xs: "size-4 text-[8px]",
        sm: "size-5 text-[10px]",
        md: "size-7 text-xs",
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
        />
      )}
      <Avatar.Fallback className="flex size-full items-center justify-center bg-muted font-medium tabular-nums text-muted-foreground border border-border/60">
        {getInitials(name ?? "")}
      </Avatar.Fallback>
    </Avatar.Root>
  );
}
