"use client";

import * as React from "react";
import type {
  ColumnSortState,
  SelectionState,
  SortDirection,
  TableDensity,
  TaskSortField,
} from "../types";
import {
  DEFAULT_DENSITY,
  DEFAULT_PAGE_SIZE,
} from "../constants";

/**
 * Hàm tính toán thuần túy trạng thái lựa chọn (Selection State Calculator)
 */
export function calculateSelectionState(
  selectedIds: Set<string>,
  visibleIds: string[] = []
): SelectionState {
  const totalSelected = selectedIds.size;

  if (visibleIds.length === 0) {
    return {
      selectedIds,
      allVisibleSelected: false,
      someVisibleSelected: false,
      totalSelected,
    };
  }

  const selectedVisibleCount = visibleIds.filter((id) =>
    selectedIds.has(id)
  ).length;

  const allVisibleSelected =
    selectedVisibleCount === visibleIds.length && visibleIds.length > 0;
  const someVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;

  return {
    selectedIds,
    allVisibleSelected,
    someVisibleSelected,
    totalSelected,
  };
}

/**
 * Hàm thêm/bớt phần tử trong Set một cách bất biến (Immutable Set Toggle)
 */
export function toggleSetItem<T>(set: Set<T>, item: T): Set<T> {
  const next = new Set(set);
  if (next.has(item)) {
    next.delete(item);
  } else {
    next.add(item);
  }
  return next;
}

/**
 * Hàm tính toán chiều sắp xếp kế tiếp theo chu kỳ: asc -> desc -> reset
 */
export function getNextSortDirection(
  currentField?: TaskSortField,
  newField?: TaskSortField,
  currentDirection: SortDirection = "asc"
): { field?: TaskSortField; direction: SortDirection } {
  if (!newField) {
    return { field: undefined, direction: "asc" };
  }

  if (currentField !== newField) {
    return { field: newField, direction: "asc" };
  }

  if (currentDirection === "asc") {
    return { field: newField, direction: "desc" };
  }

  // Sau desc sẽ reset về mặc định không sắp xếp
  return { field: undefined, direction: "asc" };
}

/**
 * Tùy chọn khởi tạo cho useTaskTableState
 */
export interface UseTaskTableStateOptions {
  totalItems?: number;
  initialPage?: number;
  initialPageSize?: number;
  initialDensity?: TableDensity;
  initialSortField?: TaskSortField;
  initialSortDirection?: SortDirection;
  initialExpandedIds?: string[];
  initialSelectedIds?: string[];
  visibleIds?: string[];
}

/**
 * Kiểu trả về toàn diện của useTaskTableState
 */
export interface UseTaskTableStateReturn {
  // 1. Phân trang (Pagination)
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  canNextPage: boolean;
  canPrevPage: boolean;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;

  // 2. Lựa chọn dòng (Selection)
  selectedIds: Set<string>;
  selectedCount: number;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  selectionState: SelectionState;
  toggleSelect: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  deselectMultiple: (ids: string[]) => void;
  selectAll: (targetVisibleIds?: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;

  // 3. Mở rộng nhánh cây việc con (Row Expansion)
  expandedIds: Set<string>;
  toggleExpand: (id: string, forceExpand?: boolean) => void;
  expandAll: (parentIds: string[]) => void;
  collapseAll: () => void;
  isExpanded: (id: string) => boolean;

  // 4. Sắp xếp cột (Sorting)
  sortField?: TaskSortField;
  sortDirection: SortDirection;
  columnSortState: ColumnSortState;
  handleSort: (field: TaskSortField) => void;
  setSorting: (field?: TaskSortField, direction?: SortDirection) => void;

  // 5. Mật độ hiển thị (Density)
  density: TableDensity;
  setDensity: (density: TableDensity) => void;
  toggleDensity: () => void;

  // 6. Đặt lại toàn bộ bảng
  resetTableState: () => void;
}

/**
 * Hook quản lý trạng thái bảng phân cấp toàn diện (Pagination, Selection, Expansion, Sorting, Density)
 */
export function useTaskTableState(
  options: UseTaskTableStateOptions = {}
): UseTaskTableStateReturn {
  const {
    totalItems = 0,
    initialPage = 1,
    initialPageSize = DEFAULT_PAGE_SIZE,
    initialDensity = DEFAULT_DENSITY,
    initialSortField,
    initialSortDirection = "asc",
    initialExpandedIds = [],
    initialSelectedIds = [],
    visibleIds = [],
  } = options;

  // --- 1. Phân trang (Pagination) ---
  const [currentPage, setCurrentPage] = React.useState<number>(initialPage);
  const [pageSize, setPageSizeState] = React.useState<number>(initialPageSize);

  const totalPages = React.useMemo(() => {
    if (totalItems <= 0) return 1;
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [totalItems, pageSize]);

  // Đảm bảo currentPage luôn hợp lệ khi totalPages thay đổi
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const setPage = React.useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(clamped);
    },
    [totalPages]
  );

  const setPageSize = React.useCallback((size: number) => {
    if (size > 0) {
      setPageSizeState(size);
      setCurrentPage(1);
    }
  }, []);

  const nextPage = React.useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = React.useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const canNextPage = currentPage < totalPages;
  const canPrevPage = currentPage > 1;

  // --- 2. Lựa chọn dòng (Selection) ---
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set(initialSelectedIds)
  );

  const toggleSelect = React.useCallback((id: string) => {
    setSelectedIds((prev) => toggleSetItem(prev, id));
  }, []);

  const selectMultiple = React.useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const deselectMultiple = React.useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const selectAll = React.useCallback(
    (targetVisibleIds?: string[]) => {
      const currentVisible = targetVisibleIds ?? visibleIds;
      if (currentVisible.length === 0) return;

      setSelectedIds((prev) => {
        const allVisibleAreSelected = currentVisible.every((id) =>
          prev.has(id)
        );
        const next = new Set(prev);

        if (allVisibleAreSelected) {
          // Bỏ chọn tất cả các dòng đang hiển thị
          for (const id of currentVisible) {
            next.delete(id);
          }
        } else {
          // Chọn tất cả các dòng đang hiển thị
          for (const id of currentVisible) {
            next.add(id);
          }
        }
        return next;
      });
    },
    [visibleIds]
  );

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = React.useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const selectionState = React.useMemo(() => {
    return calculateSelectionState(selectedIds, visibleIds);
  }, [selectedIds, visibleIds]);

  // --- 3. Mở rộng nhánh cây việc con (Row Expansion) ---
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    () => new Set(initialExpandedIds)
  );

  const toggleExpand = React.useCallback(
    (id: string, forceExpand?: boolean) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (forceExpand !== undefined) {
          if (forceExpand) next.add(id);
          else next.delete(id);
        } else {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
        return next;
      });
    },
    []
  );

  const expandAll = React.useCallback((parentIds: string[]) => {
    setExpandedIds(new Set(parentIds));
  }, []);

  const collapseAll = React.useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const isExpanded = React.useCallback(
    (id: string) => expandedIds.has(id),
    [expandedIds]
  );

  // --- 4. Sắp xếp cột (Sorting) ---
  const [sorting, setSortingState] = React.useState<{
    field: TaskSortField | undefined;
    direction: SortDirection;
  }>(() => ({
    field: initialSortField,
    direction: initialSortDirection,
  }));

  const sortField = sorting.field;
  const sortDirection = sorting.direction;

  const handleSort = React.useCallback((field: TaskSortField) => {
    setSortingState((current) => {
      const next = getNextSortDirection(current.field, field, current.direction);
      return {
        field: next.field,
        direction: next.direction,
      };
    });
  }, []);

  const setSorting = React.useCallback(
    (field?: TaskSortField, direction: SortDirection = "asc") => {
      setSortingState({ field, direction });
    },
    []
  );

  const columnSortState = React.useMemo<ColumnSortState>(() => {
    return {
      field: sorting.field,
      column: sorting.field,
      direction: sorting.direction,
    };
  }, [sorting.field, sorting.direction]);

  // --- 5. Mật độ hiển thị (Density) ---
  const [density, setDensity] = React.useState<TableDensity>(initialDensity);

  const toggleDensity = React.useCallback(() => {
    setDensity((prev) => (prev === "compact" ? "comfortable" : "compact"));
  }, []);

  // --- 6. Đặt lại toàn bộ bảng ---
  const resetTableState = React.useCallback(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
    setExpandedIds(new Set());
    setSortingState({ field: initialSortField, direction: initialSortDirection });
    setDensity(initialDensity);
  }, [initialSortField, initialSortDirection, initialDensity]);

  return {
    // Pagination
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    canNextPage,
    canPrevPage,
    setPage,
    setPageSize,
    nextPage,
    prevPage,

    // Selection
    selectedIds,
    selectedCount: selectedIds.size,
    allVisibleSelected: selectionState.allVisibleSelected,
    someVisibleSelected: selectionState.someVisibleSelected,
    selectionState,
    toggleSelect,
    selectMultiple,
    deselectMultiple,
    selectAll,
    clearSelection,
    isSelected,

    // Expansion
    expandedIds,
    toggleExpand,
    expandAll,
    collapseAll,
    isExpanded,

    // Sorting
    sortField,
    sortDirection,
    columnSortState,
    handleSort,
    setSorting,

    // Density
    density,
    setDensity,
    toggleDensity,

    // Reset
    resetTableState,
  };
}
