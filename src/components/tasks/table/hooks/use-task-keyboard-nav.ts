"use client";

import {
  type KeyboardNavState,
  type KeyboardNavAction,
  type KeyboardNavHandlerOptions,
  type UseKeyboardNavigationOptions,
  type UseKeyboardNavigationReturn,
  isInputElement,
  keyboardNavReducer,
  handleKeyboardNavigation,
  useKeyboardNavigation,
} from "@/hooks/use-keyboard-navigation";

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
 * Tùy chọn cấu hình cho React Hook useTaskKeyboardNav (tương thích ngược)
 */
export type UseTaskKeyboardNavOptions<T = { id: string }> =
  UseKeyboardNavigationOptions<T>;

/**
 * Kiểu trả về cho React Hook useTaskKeyboardNav (tương thích ngược)
 */
export type UseTaskKeyboardNavReturn = UseKeyboardNavigationReturn;

/**
 * Hook quản lý điều hướng phím WCAG 2.1 AA / Linear style cho bảng nhiệm vụ
 */
export const useTaskKeyboardNav = useKeyboardNavigation;
