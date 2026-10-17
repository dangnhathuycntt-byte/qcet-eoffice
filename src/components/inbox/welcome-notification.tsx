"use client";

import type * as React from "react";
import Link from "next/link";
import { WelcomeInstallDemo } from "@/components/inbox/welcome-install-demo";
import { Pressable } from "@/components/ui/pressable";
import { focusRingClass } from "@/components/ui/focus-ring";
import { INSTITUTION_CONFIG } from "@/config/institution";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

/**
 * Thông báo chào mừng (type `welcome`), theo bố cục "Welcome to Linear" (đo trên linear.app 14/10/2026):
 * một trang tài liệu — tiêu đề lớn, một câu dẫn, khung hình minh họa (Linear là video), rồi từng mục có tiêu đề
 * với danh sách "liên kết + một dòng mô tả", đường kẻ và dòng hỗ trợ ở cuối.
 * Không lặp logo (sidebar và hàng thông báo đã có). Mọi lối vào đều là trang/hộp thoại có thật trong ứng dụng;
 * Chỗ video của Linear là 4 cảnh nét mực (tạo bằng imagegen, nền đã chuyển thành trong suốt) thay nhau bằng CSS;
 * tô bằng màu chữ qua mask nên tự hợp chế độ tối. Giảm chuyển động thì chỉ hiện cảnh đầu.
 * Bản có ảnh động hướng dẫn tạo nhiệm vụ được lưu ở `artifacts/welcome-onboarding/`.
 */
interface WelcomeEntry {
  title: string;
  description: string;
  /** Trang đích. */
  href?: string;
  /** Hộp thoại dùng chung mở bằng sự kiện cửa sổ (Cài ứng dụng). */
  event?: string;
}

const START_ITEMS: readonly WelcomeEntry[] = [
  { href: "/tasks", title: "Nhiệm vụ", description: "Giao việc, theo dõi tiến độ và hạn hoàn thành." },
  { href: "/documents?type=inbox", title: "Văn bản", description: "Văn bản đến, văn bản đi, tờ trình nội bộ và hồ sơ công việc." },
  { href: "/calendar", title: "Lịch công tác", description: "Xem lịch công tác của bạn." },
  { href: "/org", title: "Cơ cấu & Danh bạ", description: "Tra cứu đơn vị và thông tin liên hệ." },
];

const RESOURCE_ITEMS: readonly WelcomeEntry[] = [
  { event: "qcet:open-install-modal", title: "Cài ứng dụng trên điện thoại", description: "Nhận thông báo và xử lý việc ngay trên điện thoại." },
];

const SCENES = [
  { src: "/design/illustrations/welcome-tasks.webp", caption: "Giao việc và theo dõi tiến độ đến khi hoàn thành" },
  { src: "/design/illustrations/welcome-docs.webp", caption: "Văn bản đến tay đúng người, đúng hạn" },
  { src: "/design/illustrations/welcome-calendar.webp", caption: "Lịch công tác chung cho cả đơn vị" },
  { src: "/design/illustrations/welcome-people.webp", caption: "Danh bạ toàn trường và thông báo ngay trên điện thoại" },
] as const;
/** Mỗi cảnh hiện 4 giây. */
const SCENE_MS = 4000;
const CYCLE_MS = SCENE_MS * SCENES.length;

/** Thời điểm bắt đầu của cảnh thứ `index` trong chu kỳ chung. */
const sceneTiming = (name: string, index: number): React.CSSProperties => ({
  animationName: name,
  animationDuration: `${CYCLE_MS}ms`,
  animationDelay: `${index * SCENE_MS}ms`,
  animationTimingFunction: "ease-in-out",
  animationIterationCount: "infinite",
  animationFillMode: "both",
});

function WelcomeScenes() {
  return (
    <figure aria-hidden className="mt-6">
      <div className="relative aspect-[1600/679] overflow-hidden rounded-xl border border-border/60 bg-card">
        {SCENES.map((scene, index) => {
          const mask = `url(${scene.src}) center / contain no-repeat`;
          return (
            <span
              key={scene.src}
              className={cn("absolute inset-4 bg-foreground/80 motion-reduce:animate-none! sm:inset-6", index > 0 && "motion-reduce:hidden")}
              style={{ WebkitMask: mask, mask, ...sceneTiming("welcome-scene", index) }}
            />
          );
        })}
      </div>
      <figcaption className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="relative grid min-w-0 flex-1">
          {SCENES.map((scene, index) => (
            <span
              key={scene.src}
              className={cn("col-start-1 row-start-1 truncate motion-reduce:animate-none!", index > 0 && "motion-reduce:hidden")}
              style={sceneTiming("welcome-scene", index)}
            >
              {scene.caption}
            </span>
          ))}
        </span>
        <span className="flex shrink-0 items-center gap-1 motion-reduce:hidden">
          {SCENES.map((scene, index) => (
            <span key={scene.src} className="h-1.5 w-1.5 rounded-full bg-border" style={sceneTiming("welcome-dot", index)} />
          ))}
        </span>
      </figcaption>
    </figure>
  );
}

// Tạm ẩn ảnh động cài ứng dụng trên điện thoại cuối thư (người dùng chốt 14/10/2026); mục "Cài ứng dụng trên điện thoại" và dòng hỗ trợ vẫn giữ.
// Hộp "Hướng dẫn sử dụng" và các thẻ hướng dẫn 1/3–3/3 đã bỏ hẳn (14/10/2026), thay bằng thẻ gợi ý ở trang trống.
const INSTALL_DEMO_ENABLED = false;

/** Cùng địa chỉ hỗ trợ ở trang đăng nhập. */
const SUPPORT_EMAIL = "hotro@cdktcnqn.edu.vn";

const LINK_CLASS = cn("rounded-sm text-primary underline-offset-2 hover:underline", focusRingClass);

function EntryTitle({ entry }: { entry: WelcomeEntry }) {
  if (entry.href) {
    return (
      <Link href={entry.href} className={LINK_CLASS}>
        {entry.title}
      </Link>
    );
  }
  if (entry.event) {
    const name = entry.event;
    return (
      <Pressable onClick={() => window.dispatchEvent(new CustomEvent(name))} className={cn(LINK_CLASS, "text-left")}>
        {entry.title}
      </Pressable>
    );
  }
  return <span className="font-medium text-foreground">{entry.title}</span>;
}

function WelcomeSection({ id, title, items }: { id: string; title: string; items: readonly WelcomeEntry[] }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h3 id={id} className="text-base font-semibold text-foreground">
        {title}
      </h3>
      <ul className="mt-2 list-disc space-y-2 pl-5 marker:text-muted-foreground">
        {items.map((entry) => (
          <li key={entry.title} className="pl-0.5">
            <EntryTitle entry={entry} />
            <p className="text-foreground">{entry.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WelcomeNotification({ title }: { title: string }) {
  const { user } = useAuth();
  const name = user?.name?.trim();
  return (
    <div className="text-sm leading-6">
      <h2 className="break-words text-3xl font-medium leading-tight tracking-tight text-foreground">{title}</h2>
      <p className="mt-4 text-foreground">
        {name ? `Chào ${name}, ` : ""}QCET E-Office là hệ thống làm việc trực tuyến của {INSTITUTION_CONFIG.officialName}: giao
        việc, xử lý văn bản và theo dõi lịch công tác trên cùng một nơi.
      </p>

      {/* Linear đặt video ở đây */}
      <WelcomeScenes />

      <WelcomeSection id="welcome-start" title="Bắt đầu" items={START_ITEMS} />
      <WelcomeSection id="welcome-resources" title="Tài nguyên" items={RESOURCE_ITEMS} />
      {/* Minh họa mục "Cài ứng dụng trên điện thoại": các bước trên iPhone, máy duy nhất phải cài tay */}
      {INSTALL_DEMO_ENABLED ? <WelcomeInstallDemo /> : null}

      <hr className="mt-8 border-border" />
      <p className="mt-6 text-foreground">
        Có câu hỏi? Gửi thư tới{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className={LINK_CLASS}>
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
