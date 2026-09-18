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
 * Kiểm tra xem phần tử target có nằm bên trong một Modal/Dialog/Command Palette hay không
 */
export function isInsideModal(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { closest?: (selector: string) => Element | null };
  if (typeof el.closest === "function") {
    return Boolean(
      el.closest(
        '[role="dialog"], [aria-modal="true"], [data-slot="command-palette"]'
      )
    );
  }
  return false;
}

/**
 * Reducer thuần túy tính toán trạng thái di chuyển con trỏ dòng
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
 * Tùy chọn xử lý sự kiện bàn phím thuần túy (Pure Key Event Handler Options)
 */
export interface KeyboardNavHandlerOptions {
  event: {
    key: string;
    code?: string;
    target?: unknown;
    metaKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    defaultPrevented?: boolean;
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
  onSpacePeek?: (id: string) => void;
  onClearSelection?: () => void;
  onFocusSearch?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

/**
 * Điều phối sự kiện bàn phím chuẩn Linear / Superhuman / WCAG 2.1 AA
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
    onSpacePeek,
    onClearSelection,
    onFocusSearch,
    onEscape,
    enabled = true,
  } = options;

  if (!enabled) return false;
  if (event.defaultPrevented) return false;

  // Bỏ qua nếu người dùng đang thao tác bên trong Modal / Dialog
  if (isInsideModal(event.target)) {
    return false;
  }

  const key = event.key;

  // 0. Phím Escape: Được xử lý cả khi trong input và ngoài input
  if (key === "Escape") {
    if (event.preventDefault) event.preventDefault();
    if (onEscape) {
      onEscape();
    } else {
      if (onClearSelection) {
        onClearSelection();
      }
      if (onMoveActive) {
        onMoveActive(-1, null);
      }
    }
    return true;
  }

  // Bỏ qua nếu người dùng đang nhập liệu trong input/textarea/select/contenteditable
  if (isInputElement(event.target)) {
    return false;
  }

  // Bỏ qua nếu có phím bổ trợ Meta/Ctrl/Alt để không chiếm phím tắt hệ điều hành
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }

  // 1. Phím '/' : Kích hoạt ô tìm kiếm (Focus Search Input)
  if (key === "/") {
    if (event.preventDefault) event.preventDefault();
    if (onFocusSearch) {
      onFocusSearch();
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qcet:focus-task-search"));
    }
    return true;
  }

  // 2. j / ArrowDown: Di chuyển con trỏ dòng xuống
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

  // 3. k / ArrowUp: Di chuyển con trỏ dòng lên
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

  // 4. x / X: Chọn / bỏ chọn dòng hiện tại (Linear standard: x for selection)
  if (key === "x" || key === "X") {
    if (activeIndex >= 0 && activeIndex < itemCount) {
      if (event.preventDefault) event.preventDefault();
      const targetId = activeId || idList[activeIndex];
      if (targetId && onToggleSelect) {
        onToggleSelect(targetId);
      }
      return true;
    }
  }

  // 4b. Space: Xem nhanh dòng hiện tại (Linear Peek / macOS Quick Look) hoặc Chọn / Bỏ chọn dòng
  if (key === " " || event.code === "Space") {
    if (activeIndex >= 0 && activeIndex < itemCount) {
      if (event.preventDefault) event.preventDefault();
      const targetId = activeId || idList[activeIndex];
      if (targetId) {
        if (onSpacePeek) {
          onSpacePeek(targetId);
          return true;
        }
        if (onToggleSelect) {
          onToggleSelect(targetId);
          return true;
        }
      }
    }
  }

  // 5. ArrowRight: Mở rộng nhánh việc con của dòng hiện tại
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

  // 6. ArrowLeft: Thu gọn nhánh việc con của dòng hiện tại
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

  // 7. Enter: Mở chi tiết nhiệm vụ (Side Sheet / Modal)
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

  return false;
}

/**
 * Tùy chọn cấu hình cho React Hook useKeyboardNavigation
 */
export interface UseKeyboardNavigationOptions<T = { id: string }> {
  items: T[];
  getId?: (item: T) => string;
  enabled?: boolean;
  initialActiveIndex?: number;
  onSelectTask?: (id: string, item?: T) => void;
  onSpacePeek?: (id: string, item?: T) => void;
  onToggleSelect?: (id: string) => void;
  onToggleExpand?: (id: string, expand: boolean) => void;
  onClearSelection?: () => void;
  onFocusSearch?: () => void;
  onEscape?: () => void;
  isExpanded?: (id: string) => boolean;
  hasSubtasks?: (id: string) => boolean;
  containerRef?: React.RefObject<HTMLElement | null>;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * Kiểu trả về cho React Hook useKeyboardNavigation
 */
export interface UseKeyboardNavigationReturn {
  activeIndex: number;
  activeId: string | null;
  setActiveIndex: (index: number) => void;
  setActiveId: (id: string | null) => void;
  resetActive: () => void;
  handleKeyDown: (e: React.KeyboardEvent | KeyboardEvent) => boolean;
  focusSearch: () => void;
}

/**
 * Hook quản lý điều hướng phím công thái học chuẩn WCAG 2.1 AA / Linear style
 */
export function useKeyboardNavigation<T = { id: string }>(
  options: UseKeyboardNavigationOptions<T>
): UseKeyboardNavigationReturn {
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
    onSpacePeek,
    onToggleSelect,
    onToggleExpand,
    onClearSelection,
    onFocusSearch,
    onEscape,
    isExpanded,
    hasSubtasks,
    containerRef,
    searchRef,
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

  const focusSearch = React.useCallback(() => {
    if (searchRef && searchRef.current) {
      searchRef.current.focus();
      searchRef.current.select();
    } else if (onFocusSearch) {
      onFocusSearch();
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qcet:focus-task-search"));
    }
  }, [searchRef, onFocusSearch]);

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
        onMoveActive: (newIndex) => {
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
        onSpacePeek: (id) => {
          if (onSpacePeek) {
            const item = items[navState.activeIndex];
            onSpacePeek(id, item);
          }
        },
        onClearSelection,
        onFocusSearch: focusSearch,
        onEscape,
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
      onSpacePeek,
      onClearSelection,
      focusSearch,
      onEscape,
      enabled,
      resetActive,
      setActiveIndex,
    ]
  );

  // Lắng nghe phím toàn cục hoặc container khi enabled
  React.useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const listener = (event: KeyboardEvent) => {
      // Nếu containerRef được truyền, chỉ xử lý khi container đang được gắn trong DOM
      if (containerRef?.current && typeof document !== "undefined") {
        if (!document.contains(containerRef.current)) return;
      }
      handleKeyDown(event);
    };

    window.addEventListener("keydown", listener);
    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [enabled, containerRef, handleKeyDown]);

  return {
    activeIndex: navState.activeIndex,
    activeId: navState.activeId,
    setActiveIndex,
    setActiveId,
    resetActive,
    handleKeyDown,
    focusSearch,
  };
}
