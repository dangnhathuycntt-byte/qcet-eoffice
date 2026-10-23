import { motionDuration, motionEase } from "./tokens";

/**
 * Chuyển động cho danh sách khi người dùng thêm hoặc bỏ một mục (xóa dòng trong bảng, lưu trữ, thêm việc con…), chạy trên
 * compositor: chỉ `transform` và `opacity` qua Web Animations API, không animate `height`, `top`, `margin` (không có chuyển
 * động layout) và không thêm gói vào bundle (`layout` của `motion` cần `domMax`, +14kb).
 *
 * - Bỏ mục: bản sao ("bóng") của dòng đứng đúng chỗ cũ, mờ dần trong `micro` rồi gỡ; lúc gỡ các mục phía sau trượt lên bằng
 *   FLIP (First–Last–Invert–Play: đo vị trí trước và sau, đảo bằng `translate`, chạy về 0).
 * - Thêm mục: dòng mới hiện dần, các mục phía sau trượt xuống từ vị trí cũ.
 * - Bỏ qua khi: giảm chuyển động, tab ẩn, đổi hơn `MAX_CHANGES` mục một lượt (lọc, sắp xếp, đổi trang, tải thêm), mục nằm ngoài
 *   khung nhìn, mục chỉ đổi chỗ (React `insertBefore`).
 *
 * Quan sát DOM bằng `MutationObserver` nên không phải đổi từng nơi dùng `.map`: gắn `useListMotion` vào phần tử cha. Observer
 * chạy ở microtask sau khi React commit, trước khi trình duyệt vẽ nên không có khung hình nháy.
 */

const EXIT_MS = Math.round(motionDuration.micro * 1000);
const SLIDE_MS = Math.round(motionDuration.normal * 1000);
const MAX_CHANGES = 3;
const MAX_FOLLOWERS = 40;
const VIEWPORT_MARGIN = 96;
const ANIMATION_ID = "list-motion";
const GHOST_ATTR = "data-list-ghost";

const EASE_ENTER = `cubic-bezier(${motionEase.enter.join(",")})`;
const EASE_EXIT = `cubic-bezier(${motionEase.exit.join(",")})`;

// Bản sao chỉ để nhìn: bỏ thuộc tính nhận diện (id, data-*-key…) kẻo mã tìm dòng theo khóa (Esc, j/k) thấy nhầm bóng.
const GHOST_KEEP_DATA = new Set(["data-slot", "data-table-row", "data-state", "data-density", "data-selected", "data-checked", "data-disabled"]);

export interface ListMotionOptions {
  /** Chỉ phần tử con thỏa điều kiện mới được tính là mục (mặc định mọi phần tử con). */
  item?: (el: HTMLElement) => boolean;
  /**
   * Các mục phía sau trượt theo (mặc định bật). Tắt cho danh sách định vị tuyệt đối tự lo chỗ của từng thẻ (lưới so le của Ghi
   * chú tự FLIP khi đổi chỗ): chỉ còn hiện dần khi thêm và mờ dần khi bỏ.
   */
  flip?: boolean;
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sanitizeGhost(root: HTMLElement) {
  const all = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const el of all) {
    el.removeAttribute("id");
    for (const name of el.getAttributeNames()) {
      if (name.startsWith("data-") && !GHOST_KEEP_DATA.has(name)) el.removeAttribute(name);
    }
    el.removeAttribute("tabindex");
  }
  root.setAttribute(GHOST_ATTR, "");
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("inert", "");
  root.style.pointerEvents = "none";
}

function measure(els: HTMLElement[]): DOMRect[] {
  return els.map((el) => el.getBoundingClientRect());
}

/** Các mục đứng sau `node` (cùng cha) còn trong khung nhìn, tối đa `MAX_FOLLOWERS`. */
function followersOf(node: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  const limit = window.innerHeight + VIEWPORT_MARGIN;
  for (let el = node.nextElementSibling; el && out.length < MAX_FOLLOWERS; el = el.nextElementSibling) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.getBoundingClientRect().top > limit) break;
    out.push(el);
  }
  return out;
}

/** `composite: "add"` cộng vào chuyển động đang chạy dở (xóa liên tiếp) thay vì ghi đè nên không nhảy. */
function playFlip(els: HTMLElement[], first: DOMRect[], last: DOMRect[]) {
  els.forEach((el, i) => {
    const dx = first[i].left - last[i].left;
    const dy = first[i].top - last[i].top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    const animation = el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0px, 0px)" }],
      { duration: SLIDE_MS, easing: EASE_ENTER, composite: "add" },
    );
    animation.id = ANIMATION_ID;
  });
}

function playEnter(node: HTMLElement, flip: boolean) {
  const followers = flip ? followersOf(node) : [];
  if (followers.length > 0) {
    // Vị trí cũ của các mục phía sau = vị trí khi dòng mới chưa có: ẩn tạm rồi đo, cả hai lần đo xong trước khi vẽ.
    const last = measure(followers);
    const display = node.style.display;
    node.style.display = "none";
    const first = measure(followers);
    node.style.display = display;
    playFlip(followers, first, last);
  }
  const fade = node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SLIDE_MS, easing: EASE_ENTER, fill: "backwards" });
  fade.id = ANIMATION_ID;
}

function playExit(container: HTMLElement, removed: HTMLElement, next: Node | null, flip: boolean) {
  // `next` cũng bị gỡ trong lượt này (hai dòng liền nhau): không còn mốc chèn đúng chỗ, để lượt đổi tức thì.
  if (next && next.parentNode !== container) return;
  const ghost = removed.cloneNode(true) as HTMLElement;
  sanitizeGhost(ghost);
  container.insertBefore(ghost, next);
  const rect = ghost.getBoundingClientRect();
  if (rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
    ghost.remove();
    return;
  }
  const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: EXIT_MS, easing: EASE_EXIT, fill: "forwards" });
  fade.id = ANIMATION_ID;
  fade.finished.then(
    () => {
      if (!ghost.isConnected) return;
      const followers = flip ? followersOf(ghost) : [];
      const first = measure(followers);
      ghost.remove();
      playFlip(followers, first, measure(followers));
    },
    () => ghost.remove(),
  );
}

/** Quan sát `container`: mục thêm hoặc bỏ (ít hơn `MAX_CHANGES`) được làm chuyển động. Trả hàm ngắt quan sát. */
export function observeListMotion(container: HTMLElement, options: ListMotionOptions = {}): () => void {
  if (typeof MutationObserver === "undefined" || typeof container.animate !== "function") return () => {};
  const isItem = options.item ?? (() => true);
  const flip = options.flip ?? true;

  const observer = new MutationObserver((records) => {
    if (prefersReducedMotion() || document.hidden || !container.isConnected) return;

    const removedAll = new Set<Node>();
    const removed: { node: HTMLElement; next: Node | null }[] = [];
    const added: HTMLElement[] = [];
    for (const record of records) {
      record.removedNodes.forEach((node) => {
        removedAll.add(node);
        if (node instanceof HTMLElement && !node.hasAttribute(GHOST_ATTR) && !node.isConnected && isItem(node)) {
          removed.push({ node, next: record.nextSibling });
        }
      });
    }
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        // Nằm cả trong `removedAll` nghĩa là React chỉ đổi chỗ: không tính là thêm.
        if (node instanceof HTMLElement && node.isConnected && !node.hasAttribute(GHOST_ATTR) && !removedAll.has(node) && isItem(node)) {
          added.push(node);
        }
      });
    }

    const changes = removed.length + added.length;
    if (changes === 0 || changes > MAX_CHANGES) return;
    for (const { node, next } of removed) playExit(container, node, next, flip);
    for (const node of added) if (node.isConnected) playEnter(node, flip);
  });

  observer.observe(container, { childList: true });
  return () => observer.disconnect();
}
