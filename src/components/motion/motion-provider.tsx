"use client";

import * as React from "react";
import { LazyMotion, MotionConfig } from "motion/react";

const loadFeatures = () =>
  import("@/lib/motion/features").then((module) => module.default);

export function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}
