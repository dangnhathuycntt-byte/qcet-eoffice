export const DEFAULT_PEEK_WIDTH = 760;
export const SINGLE_PEEK_WIDTH = 480;
export const MIN_PEEK_WIDTH = 380;
export const MAX_PEEK_WIDTH = 960;

export function clampPeekWidth(width: number, viewportWidth: number): number {
  return Math.max(MIN_PEEK_WIDTH, Math.min(viewportWidth * 0.75, MAX_PEEK_WIDTH, width));
}
