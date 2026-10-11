"use client";

import { type KeyboardNavState, type KeyboardNavAction, type KeyboardNavHandlerOptions, isInputElement, keyboardNavReducer, handleKeyboardNavigation, useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";

export type {
  KeyboardNavState,
  KeyboardNavAction,
  KeyboardNavHandlerOptions,
};

export {
  isInputElement,
  keyboardNavReducer,
  handleKeyboardNavigation,
};

/**
 * Hook quản lý điều hướng phím chuẩn WCAG 2.1 AA cho bảng nhiệm vụ
 */
export const useTaskKeyboardNav = useKeyboardNavigation;
