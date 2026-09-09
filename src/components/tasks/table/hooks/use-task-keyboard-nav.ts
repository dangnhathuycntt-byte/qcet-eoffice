"use client";

import * as React from "react";

/**
 * Trạng thái chỉ mục bàn phím đang hoạt động (Roving Index State)
 */
export interface KeyboardNavState {
  activeIndex: number;
  activeId: string | null;
}

/**
 * Hành động điều hướng bàn phím cho Reducer
 */
export type KeyboardNavAction =
  | { type: "MOVE_DOWN"; itemCount: number; idList?: string[] }
  | { type: "MOVE_UP"; itemCount: number; idList?: string[] }
  | { type: "SET_INDEX"; index: number; itemCount: number; idList?: string[] }
  | { type: "SET_ID"; id: string | null; idList?: string[] }
  | { type: "RESET" };

/**
 * Kiểm tra xem target của event có nằm trong ô nhập liệu (input, textarea, select, contenteditable) không
 */
export function isInputElement(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;

  // Hỗ trợ kiểm tra HTMLElement hoặc đối tượng giả lập trong unit tests
  const el = target as {
    tagName?: string;
    isContentEditable?: boolean;
    hasAttribute?: (attr: string) => boolean;
  };

  const tagName = el.tagName ? el.tagName.toLowerCase() : "";
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (el.isContentEditable === true) {
    return true;
  }

  if (typeof el.hasAttribute === "function" && el.hasAttribute("contenteditable")) {
    return true;
  }

  return false;
}

/**
 * Reducer thuần túy tính toán trạng thái di chuyển dòng
 */
export function keyboardNavReducer(
  state: KeyboardNavState,
  action: KeyboardNavAction
): KeyboardNavState {
  switch (action.type) {
    case "MOVE_DOWN": {
      const { itemCount, idList } = action;
      if (itemCount <= 0) {
        return { activeIndex: -1, activeId: null };
      }

      let newIndex: number;
      if (state.activeIndex < 0) {
        newIndex = 0;
      } else {
        newIndex = Math.min(state.activeIndex + 1, itemCount - 1);
      }

      const activeId = idList && idList[newIndex] ? idList[newIndex] : null;
      return { activeIndex: newIndex, activeId };
    }

    case "MOVE_UP": {
      const { itemCount, idList } = action;
      if (itemCount <= 0) {
        return { activeIndex: -1, activeId: null };
      }

      let newIndex: number;
      if (state.activeIndex <= 0) {
        newIndex = 0;
      } else {
        newIndex = Math.max(state.activeIndex - 1, 0);
      }

      const activeId = idList && idList[newIndex] ? idList[newIndex] : null;
      return { activeIndex: newIndex, activeId };
    }

    case "SET_INDEX": {
      const { index, itemCount, idList } = action;
      if (itemCount <= 0 || index < 0) {
        return { activeIndex: -1, activeId: null };
      }

      const clamped = Math.max(0, Math.min(index, itemCount - 1));
      const activeId = idList && idList[clamped] ? idList[clamped] : null;
      return { activeIndex: clamped, activeId };
    }

    case "SET_ID": {
      const { id, idList } = action;
      if (!id || !idList) {
        return { activeIndex: -1, activeId: null };
      }

      const idx = idList.indexOf(id);
      return {
        activeIndex: idx,
        activeId: idx >= 0 ? id : null,
      };
    }

    case "RESET":
      return { activeIndex: -1, activeId: null };

    default:
      return state;
  }
}

/**
 * Tùy chọn xử lý sự kiện bàn phím thuần túy (Pure Key Event Handler)
 */
export interface KeyboardNavHandlerOptions {
  event: {
    key: string;
    target?: unknown;
    metaKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    preventDefault?: () => void;
    stopPropagation?: () => void;
  };
  activeIndex: number;
  itemCount: number;
  activeId?: string | null;
  idList?: string[];
  isExpanded?: (id: string) => boolean;
  hasSubtasks?: (id: string) => boolean;
  onMoveActive?: (newIndex: number, newId: string | null) => void;
  onToggleSelect?: (id: string) => void;
  onToggleExpand?: (id: string, expand: boolean) => void;
  onSelectTask?: (id: string) => void;
  onClearSelection?: () => void;
  enabled?: boolean;
}

/**
 * Điều phối sự kiện bàn phím chuẩn Linear / WCAG 2.1 AA
 * Trả về true nếu sự kiện phím đã được xử lý và tiêu thụ
 */
export function handleKeyboardNavigation(
  options: KeyboardNavHandlerOptions
): boolean {
  const {
    event,
    activeIndex,
    itemCount,
    activeId,
    idList = [],
    isExpanded,
    hasSubtasks,
    onMoveActive,
    onToggleSelect,
    onToggleExpand,
    onSelectTask,
    onClearSelection,
    enabled = true,
  } = options;

  if (!enabled) return false;

  // Bỏ qua nếu người dùng đang nhập liệu trong input/textarea/select
  if (isInputElement(event.target)) {
    return false;
  }

  // Bỏ qua nếu có phím bổ trợ Meta/Ctrl/Alt để không chiếm phím tắt hệ điều hành
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }

  const key = event.key;

  // 1. j / ArrowDown: Di chuyển con trỏ dòng xuống
  if (key === "j" || key === "J" || key === "ArrowDown") {
    if (event.preventDefault) event.preventDefault();
    const nextState = keyboardNavReducer(
      { activeIndex, activeId: activeId ?? null },
      { type: "MOVE_DOWN", itemCount, idList }
    );
    if (onMoveActive) {
      onMoveActive(nextState.activeIndex, nextState.activeId);
    }
    return true;
  }

  // 2. k / ArrowUp: Di chuyển con trỏ dòng lên
  if (key === "k" || key === "K" || key === "ArrowUp") {
    if (event.preventDefault) event.preventDefault();
    const nextState = keyboardNavReducer(
      { activeIndex, activeId: activeId ?? null },
      { type: "MOVE_UP", itemCount, idList }
    );
    if (onMoveActive) {
      onMoveActive(nextState.activeIndex, nextState.activeId);
    }
    return true;
  }

  // 3. x / Space: Chọn / bỏ chọn dòng hiện tại
  if (key === "x" || key === "X" || key === " ") {
    if (activeIndex >= 0 && activeIndex < itemCount) {
      if (event.preventDefault) event.preventDefault();
      const targetId = activeId || idList[activeIndex];
      if (targetId && onToggleSelect) {
        onToggleSelect(targetId);
      }
      return true;
    }
  }

  // 4. ArrowRight: Mở rộng nhánh việc con của dòng hiện tại
  if (key === "ArrowRight") {
    if (activeIndex >= 0 && activeIndex < itemCount) {
      const targetId = activeId || idList[activeIndex];
      if (targetId) {
        const canExpand = hasSubtasks ? hasSubtasks(targetId) : true;
        const currentlyExpanded = isExpanded ? isExpanded(targetId) : false;
        if (canExpand && !currentlyExpanded && onToggleExpand) {
          if (event.preventDefault) event.preventDefault();
          onToggleExpand(targetId, true);
          return true;
        }
      }
    }
  }

  // 5. ArrowLeft: Thu gọn nhánh việc con của dòng hiện tại
  if (key === "ArrowLeft") {
    if (activeIndex >= 0 && activeIndex < itemCount) {
      const targetId = activeId || idList[activeIndex];
      if (targetId) {
        const canCollapse = hasSubtasks ? hasSubtasks(targetId) : true;
        const currentlyExpanded = isExpanded ? isExpanded(targetId) : true;
        if (canCollapse && currentlyExpanded && onToggleExpand) {
          if (event.preventDefault) event.preventDefault();
          onToggleExpand(targetId, false);
          return true;
        }
      }
    }
  }

  // 6. Enter: Xem chi tiết nhiệm vụ (Side Sheet / Modal)
  if (key === "Enter") {
    if (activeIndex >= 0 && activeIndex < itemCount) {
      if (event.preventDefault) event.preventDefault();
      const targetId = activeId || idList[activeIndex];
      if (targetId && onSelectTask) {
        onSelectTask(targetId);
      }
      return true;
    }
  }

  // 7. Escape: Bỏ chọn hàng loạt hoặc làm mới chỉ mục
  if (key === "Escape") {
    if (event.preventDefault) event.preventDefault();
    if (onClearSelection) {
      onClearSelection();
    }
    if (onMoveActive) {
      onMoveActive(-1, null);
    }
    return true;
  }

  return false;
}

/**
 * Tùy chọn cấu hình cho React Hook useTaskKeyboardNav
 */
export interface UseTaskKeyboardNavOptions<T = { id: string }> {
  items: T[];
  getId?: (item: T) => string;
  enabled?: boolean;
  initialActiveIndex?: number;
  onSelectTask?: (id: string, item?: T) => void;
  onToggleSelect?: (id: string) => void;
  onToggleExpand?: (id: string, expand: boolean) => void;
  onClearSelection?: () => void;
  isExpanded?: (id: string) => boolean;
  hasSubtasks?: (id: string) => boolean;
  containerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Kiểu trả về cho React Hook useTaskKeyboardNav
 */
export interface UseTaskKeyboardNavReturn {
  activeIndex: number;
  activeId: string | null;
  setActiveIndex: (index: number) => void;
  setActiveId: (id: string | null) => void;
  resetActive: () => void;
  handleKeyDown: (
    e: React.KeyboardEvent | KeyboardEvent
  ) => boolean;
}

/**
 * Hook quản lý điều hướng phím WCAG 2.1 AA / Linear style cho bảng nhiệm vụ
 */
export function useTaskKeyboardNav<T = { id: string }>(
  options: UseTaskKeyboardNavOptions<T>
): UseTaskKeyboardNavReturn {
  const {
    items,
    getId = (item: T) => {
      if (item && typeof item === "object" && "id" in item) {
        return String((item as { id: unknown }).id);
      }
      return String(item);
    },
    enabled = true,
    initialActiveIndex = -1,
    onSelectTask,
    onToggleSelect,
    onToggleExpand,
    onClearSelection,
    isExpanded,
    hasSubtasks,
    containerRef,
  } = options;

  const idList = React.useMemo(() => {
    return items.map(getId);
  }, [items, getId]);

  const [navState, dispatch] = React.useReducer(keyboardNavReducer, {
    activeIndex: initialActiveIndex,
    activeId:
      initialActiveIndex >= 0 && idList[initialActiveIndex]
        ? idList[initialActiveIndex]
        : null,
  });

  const setActiveIndex = React.useCallback(
    (index: number) => {
      dispatch({
        type: "SET_INDEX",
        index,
        itemCount: items.length,
        idList,
      });
    },
    [items.length, idList]
  );

  const setActiveId = React.useCallback(
    (id: string | null) => {
      dispatch({
        type: "SET_ID",
        id,
        idList,
      });
    },
    [idList]
  );

  const resetActive = React.useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent | KeyboardEvent): boolean => {
      return handleKeyboardNavigation({
        event: e,
        activeIndex: navState.activeIndex,
        itemCount: items.length,
        activeId: navState.activeId,
        idList,
        isExpanded,
        hasSubtasks,
        onMoveActive: (newIndex, newId) => {
          if (newIndex === -1) {
            resetActive();
          } else {
            setActiveIndex(newIndex);
          }
        },
        onToggleSelect,
        onToggleExpand,
        onSelectTask: (id) => {
          if (onSelectTask) {
            const item = items[navState.activeIndex];
            onSelectTask(id, item);
          }
        },
        onClearSelection,
        enabled,
      });
    },
    [
      navState.activeIndex,
      navState.activeId,
      items,
      idList,
      isExpanded,
      hasSubtasks,
      onToggleSelect,
      onToggleExpand,
      onSelectTask,
      onClearSelection,
      enabled,
      resetActive,
      setActiveIndex,
    ]
  );

  // Lắng nghe phím toàn cục hoặc container khi enabled
  React.useEffect(() => {
    if (!enabled) return;

    const targetElement: EventTarget =
      containerRef && containerRef.current
        ? containerRef.current
        : typeof window !== "undefined"
        ? window
        : null!;

    if (!targetElement) return;

    const listener = (event: Event) => {
      handleKeyDown(event as KeyboardEvent);
    };

    targetElement.addEventListener("keydown", listener);
    return () => {
      targetElement.removeEventListener("keydown", listener);
    };
  }, [enabled, containerRef, handleKeyDown]);

  return {
    activeIndex: navState.activeIndex,
    activeId: navState.activeId,
    setActiveIndex,
    setActiveId,
    resetActive,
    handleKeyDown,
  };
}
