/**
 * Chế độ hiển thị Quick View theo độ rộng thực của vùng workspace (danh sách + pane),
 * không theo viewport: thu gọn sidebar hay cửa sổ hẹp đều được tính.
 */
export const LIST_MIN = 480;
export const PANE_MIN = 440;
export const PANE_DEFAULT = 640;
export const PANE_MAX = 1100;
/**
 * Phần khung cộng thêm ngoài hai thẻ: padding của workspace (2 × 8px) và gap giữa hai thẻ (6px),
 * giống `.splitWorkspace` của Task Detail. Thanh kéo nằm trên mép thẻ nên không chiếm thêm chỗ.
 */
export const SHELL_CHROME = 22;
/** Chống nhảy qua lại: từ overlay chỉ quay lại pane khi dư thêm 24px. */
export const MODE_HYSTERESIS = 24;
export const PANE_KEY_STEP = 20;

export type PaneMode = "pane" | "overlay";

export interface PaneLayout {
  mode: PaneMode;
  /** Độ rộng pane đang hiển thị (đã bị clamp); 0 ở chế độ overlay. */
  width: number;
  /** Cận trên khả dụng của pane ở độ rộng workspace hiện tại. */
  max: number;
}

export const clampWidth = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Quy tắc: đủ chỗ cho `LIST_MIN + khung + PANE_MIN` thì là pane; ngược lại là overlay.
 * `previousMode` dùng cho hysteresis chỉ ở chiều quay lại pane: đang overlay thì cần dư thêm 24px.
 * Đang pane thì rớt xuống overlay ngay dưới ngưỡng, để danh sách và pane luôn đủ hai mức tối thiểu.
 * Độ rộng người dùng chọn (`preferred`) được giữ nguyên ở nơi lưu; chỉ phần hiển thị bị clamp.
 */
export function resolvePaneLayout(workspaceWidth: number, preferred: number, previousMode?: PaneMode): PaneLayout {
  const threshold = LIST_MIN + SHELL_CHROME + PANE_MIN;
  const needed = previousMode === "overlay" ? threshold + MODE_HYSTERESIS : threshold;
  if (!(workspaceWidth >= needed)) return { mode: "overlay", width: 0, max: 0 };
  const max = Math.min(PANE_MAX, workspaceWidth - LIST_MIN - SHELL_CHROME);
  return { mode: "pane", width: clampWidth(preferred, PANE_MIN, max), max };
}

/** Giá trị đọc từ localStorage: số hợp lệ trong [PANE_MIN, PANE_MAX], ngược lại mặc định. */
export function parseStoredPaneWidth(raw: string | null | undefined): number {
  const value = Number(raw);
  return Number.isFinite(value) && value >= PANE_MIN && value <= PANE_MAX ? Math.round(value) : PANE_DEFAULT;
}

/** Phím trên thanh kéo: ←/→ đổi 20px (pane nằm bên phải nên ← làm rộng), Home về mặc định. */
export function nextWidthForKey(key: string, current: number, layout: PaneLayout): number | null {
  switch (key) {
    case "ArrowLeft":
      return clampWidth(current + PANE_KEY_STEP, PANE_MIN, layout.max);
    case "ArrowRight":
      return clampWidth(current - PANE_KEY_STEP, PANE_MIN, layout.max);
    case "Home":
      return clampWidth(PANE_DEFAULT, PANE_MIN, layout.max);
    default:
      return null;
  }
}
