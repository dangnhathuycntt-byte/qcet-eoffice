export const motionDuration = {
  instant: 0.08,
  micro: 0.1,
  fast: 0.14,
  normal: 0.18,
  panel: 0.26,
  dropdownEnter: 0.18,
  dropdownExit: 0.14,
  modalEnter: 0.22,
  modalExit: 0.16,
  panelEnter: 0.26,
  panelExit: 0.2,
} as const;

export const motionEase = {
  enter: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
  standard: [0.2, 0, 0, 1],
} as const;

export const motionSpring = {
  snappy: {
    type: "spring",
    stiffness: 450,
    damping: 35,
    mass: 0.8,
  },
  gentle: {
    type: "spring",
    stiffness: 280,
    damping: 28,
    mass: 1,
  },
} as const;

export const motionTransition = {
  micro: {
    duration: motionDuration.micro,
    ease: motionEase.enter,
  },
  enter: {
    duration: motionDuration.modalEnter,
    ease: motionEase.enter,
  },
  exit: {
    duration: motionDuration.modalExit,
    ease: motionEase.exit,
  },
  panel: {
    duration: motionDuration.panelEnter,
    ease: motionEase.enter,
  },
  panelExit: {
    duration: motionDuration.panelExit,
    ease: motionEase.exit,
  },
  dropdown: {
    duration: motionDuration.dropdownEnter,
    ease: motionEase.enter,
  },
  dropdownExit: {
    duration: motionDuration.dropdownExit,
    ease: motionEase.exit,
  },
  snappySpring: motionSpring.snappy,
  gentleSpring: motionSpring.gentle,
} as const;
