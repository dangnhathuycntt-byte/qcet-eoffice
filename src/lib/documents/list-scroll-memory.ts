/** Nhớ vị trí cuộn của danh sách văn bản theo bộ lọc, để quay lại từ Full Page vẫn đúng chỗ. */
const PREFIX = "qcet_documents_scroll:";
const MAX_ENTRIES = 12;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const scrollKeyFor = (filtersKey: string) => `${PREFIX}${filtersKey}`;

export function readScroll(storage: StorageLike | null, filtersKey: string): number {
  try {
    const value = Number(storage?.getItem(scrollKeyFor(filtersKey)));
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  } catch {
    return 0;
  }
}

export function writeScroll(storage: StorageLike | null, filtersKey: string, scrollTop: number): void {
  if (!storage) return;
  try {
    const key = scrollKeyFor(filtersKey);
    if (scrollTop > 0) storage.setItem(key, String(Math.round(scrollTop)));
    else storage.removeItem(key);
    pruneScrollEntries(storage);
  } catch {
    // Không lưu được (chế độ riêng tư, đầy bộ nhớ): bỏ qua, danh sách vẫn dùng bình thường
  }
}

/** Giữ số mục ít: xóa các mục cũ nhất khi vượt giới hạn (chỉ áp dụng cho `Storage` thật có `key()`). */
function pruneScrollEntries(storage: StorageLike): void {
  const real = storage as Partial<Storage>;
  if (typeof real.length !== "number" || typeof real.key !== "function") return;
  const keys: string[] = [];
  for (let i = 0; i < real.length; i++) {
    const k = real.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) storage.removeItem(k);
}
