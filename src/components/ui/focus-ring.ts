/**
 * Viền focus bàn phím chuẩn (2px primary, cách 1px). Luôn đi kèm `outline-solid`:
 * trong Tailwind v4, `outline-none` đặt `--tw-outline-style: none`, nên chỉ
 * `focus-visible:outline-2` thì viền không hiện.
 */
export const focusRingClass =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1";
