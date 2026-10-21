"use client";

import * as React from "react";
import { getSelectionGroupPositions } from "@/lib/selection-group";

/**
 * Chọn nhiều hàng trên trang danh sách (ô tích ở hàng, Shift+bấm chọn cả dải, ô tích tiêu đề chọn/bỏ tất cả), như bảng
 * Nhiệm vụ. `ids` là các hàng đang hiện theo thứ tự trên màn hình; hàng biến mất (đổi bộ lọc, tải lại) thì tự bỏ khỏi lựa chọn.
 */
export function useListSelection(ids: readonly string[]) {
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(() => new Set());
  const anchorRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const visible = new Set(ids);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
    if (anchorRef.current && !visible.has(anchorRef.current)) anchorRef.current = null;
  }, [ids]);

  /** Bật/tắt một hàng; `range` (Shift) chọn từ hàng bấm trước tới hàng này. */
  const toggle = React.useCallback(
    (id: string, range = false) => {
      const anchor = anchorRef.current;
      const from = anchor ? ids.indexOf(anchor) : -1;
      const to = ids.indexOf(id);
      setSelected((prev) => {
        const next = new Set(prev);
        if (range && from !== -1 && to !== -1) {
          for (const rangeId of ids.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(rangeId);
        } else if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      anchorRef.current = id;
    },
    [ids]
  );

  const clear = React.useCallback(() => {
    setSelected((prev) => (prev.size === 0 ? prev : new Set()));
    anchorRef.current = null;
  }, []);

  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const toggleAll = React.useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(ids));
    anchorRef.current = null;
  }, [allSelected, ids]);

  const groupPositions = React.useMemo(() => getSelectionGroupPositions(ids, selected), [ids, selected]);

  return {
    selected,
    /** Vị trí từng hàng đang chọn trong khối chọn liền nhau, cho `TableRow groupPosition` (chỉ bo góc ngoài khối). */
    groupPositions,
    count: selected.size,
    allSelected,
    /** Có chọn nhưng chưa hết: ô tích tiêu đề ở trạng thái "một phần". */
    someSelected: selected.size > 0 && !allSelected,
    isSelected: (id: string) => selected.has(id),
    toggle,
    toggleAll,
    clear,
  };
}
