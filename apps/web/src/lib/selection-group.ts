export type SelectionGroupPosition = "first" | "middle" | "last" | "only";

/** Vị trí của từng hàng đang chọn trong nhóm hàng chọn liền nhau (hàng chưa chọn không có mục). */
export function getSelectionGroupPositions(
  ids: readonly string[],
  selectedIds: ReadonlySet<string>,
): Map<string, SelectionGroupPosition> {
  const positions = new Map<string, SelectionGroupPosition>();
  for (let i = 0; i < ids.length; i++) {
    if (!selectedIds.has(ids[i])) continue;
    const prevSelected = i > 0 && selectedIds.has(ids[i - 1]);
    const nextSelected = i < ids.length - 1 && selectedIds.has(ids[i + 1]);
    if (prevSelected && nextSelected) positions.set(ids[i], "middle");
    else if (prevSelected) positions.set(ids[i], "last");
    else if (nextSelected) positions.set(ids[i], "first");
    else positions.set(ids[i], "only");
  }
  return positions;
}
