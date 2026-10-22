"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PopoverClose, PopoverContent, PopoverDescription, PopoverRoot, PopoverTitle } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { pwaOnboardingCoordinator } from "@/lib/pwa/onboarding-coordinator";
import { cn } from "@/lib/utils";

/**
 * Nút tạo mới ở trang trống kèm thẻ hướng dẫn bước đầu (thay hộp "Hướng dẫn sử dụng" và thẻ 1/3–3/3 cũ; tham khảo thẻ "Design your store"
 * của Whop). Thẻ nằm ngay dưới nút tạo mới trên thanh công cụ (góc phải trên, `data-slot="list-toolbar-create"`, đúng nút mà cảnh minh họa
 * bấm), mép phải thẳng nút; điện thoại (dưới md) thì nằm dưới nút giữa trang để không che tranh và chữ của trang trống.
 * Tần suất (chốt 15/10/2026 sau khi đối chiếu NN/g về gợi ý theo ngữ cảnh, WCAG 2.2.2 và thông lệ "hiện một lần, nhớ lượt tắt"; thay cách
 * hiện–ẩn–lặp mãi ngày 14/10):
 * - Mỗi tài khoản thấy mỗi thẻ (`hintId`) một lần: ghi "đã xem" vào localStorage theo người dùng ngay khi thẻ hiện, nên tải lại trang hay
 *   đã có dữ liệu thì không hiện nữa. Trang trống vẫn tự giải thích bằng tiêu đề, mô tả và nút.
 * - Một lần chen ngang mỗi phiên: đi qua `pwaOnboardingCoordinator` (loại "TOUR"); phiên đã hiện lời nhắc cài ứng dụng/thông báo đẩy hay
 *   thẻ hướng dẫn khác thì không hiện, để lần sau.
 * - Cảnh minh họa chạy hai vòng rồi dừng ở cảnh danh sách đã trải ra; thẻ ở lại tới khi người dùng đóng (X, Esc, bấm ra ngoài, kể cả bấm
 *   nút tạo mới). Không lấy focus, không chặn thao tác; không hiện khi đang có hộp thoại khác hoặc nút đang bị ẩn.
 * - Giảm chuyển động: thẻ hiện cố định, cảnh minh họa đứng yên ở cảnh danh sách.
 * - Nút phụ "Hướng dẫn" (`guideButton`) mở lại thẻ bất cứ lúc nào, thay liên kết sang `/docs` (người dùng chốt 15/10/2026: /docs chưa ổn định).
 * Chuyển động (keyframes `onboarding-hint-*` trong globals.css): thẻ trượt ra, rồi con trỏ đi lên bấm nút tạo mới ở góc phải trên của
 * trang thu nhỏ, rồi danh sách (dòng skeleton) trải ra từng dòng (người dùng chốt 14/10/2026: không diễn hộp tạo mới).
 */
const LOOP_MS = 4400;
/** Vòng minh họa bắt đầu sau khi thẻ đã trượt ra xong. */
const LOOP_DELAY_MS = 500;
/** Hai vòng, dừng ở 85% vòng thứ hai: con trỏ đã tan, các dòng danh sách đang hiện (57–88% của keyframes `onboarding-hint-row`). */
const LOOP_COUNT = 1.85;
/** Lần đầu hiện sau khi trang ổn định. */
const FIRST_SHOW_MS = 600;
/** Đang có hộp thoại khác hoặc nút chưa hiện: thử lại sau. */
const RETRY_MS = 1500;
const STILL = "motion-reduce:animate-none!";

const loop = (name: string, delayMs = 0, timing = "var(--motion-ease-standard)"): React.CSSProperties => ({
  animationName: name,
  animationDuration: `${LOOP_MS}ms`,
  animationDelay: `${LOOP_DELAY_MS + delayMs}ms`,
  animationTimingFunction: timing,
  animationIterationCount: LOOP_COUNT,
  animationFillMode: "both",
});

const seenKey = (userId: string, hintId: string) => `qcet-onboarding-hint:${userId}:${hintId}`;

function hasSeen(key: string) {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(key, Date.now().toString());
  } catch {
    // Không ghi được (chế độ riêng tư, chặn lưu trữ): lần sau có thể hiện lại, không ảnh hưởng thao tác
  }
}

const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Phần tử Tab tới được trong `root` (bỏ focus guard của base-ui và phần tử đang ẩn), theo thứ tự trong trang. */
function tabbables(root: ParentNode) {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => !el.hasAttribute("data-base-ui-focus-guard") && el.getClientRects().length > 0
  );
}

function toolbarCreateButton() {
  return (
    Array.from(document.querySelectorAll<HTMLElement>('[data-slot="list-toolbar-create"]')).find((el) => el.getClientRects().length > 0) ?? null
  );
}

export function CreateButtonWithHint({
  hintId,
  label,
  onClick,
  title,
  description,
  guideButton = false,
}: {
  /** Khóa nhớ "đã xem" theo người dùng, mỗi trang trống một khóa (vd. "tasks", "documents-inbox"). */
  hintId: string;
  /** Nhãn nút tạo mới (vd. "Tạo việc", "Soạn văn bản đi"). */
  label: string;
  onClick: () => void;
  title: string;
  description: React.ReactNode;
  /** Thêm nút "Hướng dẫn" cạnh nút tạo mới để mở lại thẻ này. */
  guideButton?: boolean;
}) {
  const { user } = useAuth();
  const userId = user?.id;
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const guideRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  // Máy tính: nút tạo mới trên thanh công cụ; điện thoại hoặc không thấy nút đó: nút giữa trang
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    const key = seenKey(userId, hintId);
    if (hasSeen(key)) return;
    // Bộ điều phối được khởi tạo ở lời nhắc thông báo đẩy (nạp động, có thể sau thẻ này): khởi tạo theo người dùng trước khi đọc/ghi
    // cổng chen ngang để không ghi vào khóa khách; gọi lại `init` với cùng người dùng là an toàn.
    pwaOnboardingCoordinator.init(userId);
    let timer = 0;
    const show = () => {
      if (pwaOnboardingCoordinator.hasSessionInterruptionShown()) return;
      if (!buttonRef.current?.getClientRects().length || document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        timer = window.setTimeout(show, RETRY_MS);
        return;
      }
      markSeen(key);
      pwaOnboardingCoordinator.recordInterruptionShown("TOUR");
      setAnchor(window.matchMedia("(min-width: 768px)").matches ? toolbarCreateButton() : null);
      setOpen(true);
    };
    timer = window.setTimeout(show, FIRST_SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [userId, hintId]);

  // Người dùng tự mở lại bằng nút Hướng dẫn: không qua cổng chen ngang của phiên (họ chủ động bấm), vẫn ghi đã xem để thẻ không tự hiện nữa
  const openGuide = () => {
    if (userId) markSeen(seenKey(userId, hintId));
    setAnchor(window.matchMedia("(min-width: 768px)").matches ? toolbarCreateButton() : null);
    setOpen(true);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) return;
    setOpen(false);
    pwaOnboardingCoordinator.clearActiveInterruption();
  };

  // base-ui 1.8: popover không có nút mở (Trigger) thì Tab từ phần tử cuối của thẻ không có đích (`triggerFocusTargetRef` trống), focus rơi
  // về body và bỏ qua nút Hướng dẫn cùng phần còn lại của trang. Tự chuyển tới phần tử kế tiếp sau nút tạo mới giữa trang (focus guard của
  // thẻ nằm ngay sau nút này nên Tab từ nút vào thẻ); Shift+Tab base-ui đã xử lý đúng.
  const handlePopupKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Focus guard của thẻ nằm sau nút cuối cùng trước thẻ (nút Hướng dẫn nếu có, không thì nút tạo mới)
    const origin = guideRef.current ?? buttonRef.current;
    if (event.key !== "Tab" || event.shiftKey || !origin) return;
    const popup = event.currentTarget;
    if (document.activeElement !== tabbables(popup).at(-1)) return;
    const next = tabbables(document).find(
      (el) => origin.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && !popup.contains(el)
    );
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  return (
    <>
      <Button ref={buttonRef} size="pill" onClick={onClick}>
        {label}
      </Button>
      {guideButton ? (
        <Button ref={guideRef} size="pill" variant="toolbar" aria-haspopup="dialog" aria-expanded={open} onClick={openGuide}>
          Hướng dẫn
        </Button>
      ) : null}
      <PopoverRoot open={open} onOpenChange={handleOpenChange}>
        <PopoverContent
          anchor={anchor ?? buttonRef}
          side="bottom"
          align={anchor ? "end" : "start"}
          sideOffset={8}
          initialFocus={false}
          finalFocus={false}
          onKeyDown={handlePopupKeyDown}
          className="w-64 rounded-xl p-1.5"
        >
          <div
            data-slot="onboarding-hint"
            className={cn(anchor ? "origin-top-right" : "origin-top-left", "select-none", STILL)}
            style={{
              animationName: "onboarding-hint-in",
              animationDuration: "var(--motion-duration-panel)",
              animationTimingFunction: "var(--motion-ease-enter)",
              animationFillMode: "both",
            }}
          >
            <div aria-hidden className="relative h-32 overflow-hidden rounded-lg bg-muted">
              <ClickScene action={label} />
            </div>
            <div className="px-2 pb-1.5 pt-2.5">
              <div className="flex items-start justify-between gap-2">
                <PopoverTitle className="text-compact font-medium text-foreground">{title}</PopoverTitle>
                <PopoverClose
                  render={<Button variant="ghost" size="icon-xs" aria-label="Đóng hướng dẫn" className="-my-1.5 -mr-1.5 shrink-0 text-muted-foreground" />}
                >
                  <X />
                </PopoverClose>
              </div>
              <PopoverDescription className="mt-1 text-xs text-muted-foreground">{description}</PopoverDescription>
            </div>
          </div>
        </PopoverContent>
      </PopoverRoot>
    </>
  );
}

/** Độ dài thanh tên của từng dòng skeleton (khác nhau cho giống danh sách thật). */
const ROW_TITLE_WIDTHS = ["58%", "44%", "66%", "50%"];

/**
 * Trang thu nhỏ có nút tạo mới ở góc phải trên (đúng chỗ và đúng nhãn nút thật): con trỏ đi lên bấm nút, rồi các dòng của danh sách
 * (vòng trạng thái, tên, người chủ trì, hạn; dạng skeleton) lần lượt trải ra từ trên xuống.
 * Dựng ở cỡ chữ thật rồi thu nhỏ bằng `zoom` (như ảnh động thư chào mừng). Giảm chuyển động: đứng ở cảnh danh sách đã có, không có con trỏ.
 */
function ClickScene({ action }: { action: string }) {
  return (
    <div className="absolute inset-0 text-xs [zoom:0.7]">
      <div className="absolute inset-x-4 bottom-0 top-4 overflow-hidden rounded-t-xl bg-background shadow-xs">
        <div className="flex h-9 items-center justify-between border-b border-border/60 pl-3.5 pr-2">
          <span className="h-2 w-16 rounded-full bg-foreground/10" />
          <span className={cn("relative flex h-6 items-center gap-1 rounded-full px-2 font-medium text-foreground", STILL)} style={loop("onboarding-hint-press")}>
            <Plus className="size-3.5 text-muted-foreground" />
            {action}
            <svg
              viewBox="0 0 16 16"
              className={cn("absolute left-1/2 top-1/2 size-5 text-foreground drop-shadow-sm motion-reduce:hidden", STILL)}
              style={loop("onboarding-hint-cursor")}
            >
              <path d="M2 1.5v11.2l3.1-2.9 2 4.6 2-.9-2-4.5h4.3z" fill="currentColor" stroke="var(--background)" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        {ROW_TITLE_WIDTHS.map((width, index) => (
          <div
            key={width}
            className={cn("flex h-8 origin-top items-center gap-2.5 border-b border-border/40 px-3.5", STILL)}
            style={loop("onboarding-hint-row", index * 260)}
          >
            <span className="size-3 shrink-0 rounded-full border-[1.5px] border-foreground/25" />
            <span className="h-1.5 rounded-full bg-foreground/15" style={{ width }} />
            <span className="ml-auto size-4 shrink-0 rounded-full bg-primary/20" />
            <span className="h-1.5 w-7 shrink-0 rounded-full bg-foreground/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
