"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  fadeVariants,
  listItemVariants,
  staggerContainerVariants,
} from "@/lib/motion/variants";
import { motionDuration, motionEase } from "@/lib/motion/tokens";

export type AnimatedFadeProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
> & {
  show?: boolean;
  duration?: number;
};

/** Khối hiệu ứng mờ dần (Fade In/Out) tự động tôn trọng thiết lập giảm chuyển động. */
export function AnimatedFade({
  show = true,
  children,
  className,
  ...props
}: AnimatedFadeProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      {show ? (
        <m.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={shouldReduceMotion ? undefined : fadeVariants}
          className={cn(className)}
          {...props}
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

export type AnimatedListProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
> & {
  children: React.ReactNode;
};

/** Danh sách có hiệu ứng xuất hiện so le (Staggered List Entry). */
export function AnimatedList({ children, className, ...props }: AnimatedListProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <m.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={shouldReduceMotion ? undefined : staggerContainerVariants}
      className={cn("flex flex-col", className)}
      {...props}
    >
      {children}
    </m.div>
  );
}

export type AnimatedItemProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
> & {
  children: React.ReactNode;
};

/** Mục con trong danh sách so le hoặc tự động trượt vào. */
export function AnimatedItem({ children, className, ...props }: AnimatedItemProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <m.div
      variants={shouldReduceMotion ? undefined : listItemVariants}
      className={cn(className)}
      {...props}
    >
      {children}
    </m.div>
  );
}

export interface AnimatedCollapseProps {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Hiệu ứng mở gập mượt mà theo chiều dọc (Auto height collapse). */
export function AnimatedCollapse({ open, children, className }: AnimatedCollapseProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <m.div
          initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
          animate={{
            height: "auto",
            opacity: 1,
            transition: {
              height: { duration: motionDuration.normal, ease: motionEase.enter },
              opacity: { duration: motionDuration.fast, ease: motionEase.enter },
            },
          }}
          exit={{
            height: 0,
            opacity: 0,
            transition: {
              height: { duration: motionDuration.fast, ease: motionEase.exit },
              opacity: { duration: motionDuration.micro, ease: motionEase.exit },
            },
          }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

export interface AnimatedNumberProps {
  value: number;
  className?: string;
  format?: (val: number) => string;
}

/** Số đếm nhảy mượt mà (chỉ số thống kê, đếm nhiệm vụ). */
export function AnimatedNumber({ value, className, format = (v) => v.toLocaleString("vi-VN") }: AnimatedNumberProps) {
  return (
    <span className={cn("tabular-nums transition-all duration-300", className)}>
      {format(value)}
    </span>
  );
}
