import type { Variants } from "motion/react";
import { motionTransition } from "./tokens";

export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: motionTransition.enter },
  exit: { opacity: 0, transition: motionTransition.exit },
};

export const popoverVariants: Variants = {
  initial: { opacity: 0, y: -4, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: motionTransition.enter },
  exit: { opacity: 0, y: -4, scale: 0.985, transition: motionTransition.exit },
};

export const dialogVariants: Variants = {
  initial: { opacity: 0, y: 6, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1, transition: motionTransition.enter },
  exit: { opacity: 0, y: 6, scale: 0.99, transition: motionTransition.exit },
};

export const sideSheetVariants: Variants = {
  initial: { x: "100%" },
  animate: { x: 0, transition: motionTransition.panel },
  exit: { x: "100%", transition: motionTransition.panel },
};

export const bottomSheetVariants: Variants = {
  initial: { y: "100%" },
  animate: { y: 0, transition: motionTransition.panel },
  exit: { y: "100%", transition: motionTransition.panel },
};

export const toastVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: motionTransition.enter },
  exit: { opacity: 0, y: 8, transition: motionTransition.exit },
};

export const listItemVariants: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: motionTransition.micro },
  exit: { opacity: 0, y: 4, transition: motionTransition.micro },
};
