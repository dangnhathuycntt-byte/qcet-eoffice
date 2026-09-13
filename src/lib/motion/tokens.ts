export const motionDuration = {
  instant: 0.1,
  fast: 0.14,
  normal: 0.18,
  panel: 0.22,
} as const;

export const motionEase = {
  enter: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const motionTransition = {
  micro: {
    duration: motionDuration.fast,
    ease: motionEase.enter,
  },
  enter: {
    duration: motionDuration.normal,
    ease: motionEase.enter,
  },
  exit: {
    duration: motionDuration.fast,
    ease: motionEase.exit,
  },
  panel: {
    duration: motionDuration.panel,
    ease: motionEase.enter,
  },
} as const;
