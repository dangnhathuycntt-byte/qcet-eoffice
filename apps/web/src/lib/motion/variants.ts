import type { Variants } from "motion/react";
import { motionTransition } from "./tokens";

export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: motionTransition.enter },
  exit: { opacity: 0, transition: motionTransition.exit },
};

export const popoverVariants: Variants = {
  initial: { opacity: 0, y: -4, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: motionTransition.dropdown },
  exit: { opacity: 0, y: -4, scale: 0.985, transition: motionTransition.dropdownExit },
};

export const sideSheetVariants: Variants = {
  initial: { x: "100%" },
  animate: { x: 0, transition: motionTransition.panel },
  exit: { x: "100%", transition: motionTransition.panelExit },
};

/** Khung trượt ra từ mép thanh bên (Hộp thư): dịch ngắn và mờ dần, không quét cả bề rộng như side sheet. */
export const edgePanelVariants: Variants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0, transition: motionTransition.panel },
  exit: { opacity: 0, x: -8, transition: motionTransition.panelExit },
};

export const listItemVariants: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: motionTransition.micro },
  exit: { opacity: 0, y: 4, transition: motionTransition.micro },
};

export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};
