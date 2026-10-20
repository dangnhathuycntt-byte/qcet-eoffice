"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Circle, CircleCheck, Smartphone } from "lucide-react";
import { WelcomeInstallDemo } from "@/components/inbox/welcome-install-demo";
import { AssistantSettingsDialog } from "@/components/assistant/assistant-settings-dialog";
import { getPreferencesRequest, listConversationsRequest } from "@/components/assistant/assistant-client";
import { Button } from "@/components/ui/button";
import { EmptyGlyph, type EmptyGlyphName } from "@/components/ui/empty-glyphs";
import { Kbd } from "@/components/ui/kbd";
import { focusRingClass } from "@/components/ui/focus-ring";
import { Progress } from "@/components/ui/progress";
import { usePushNotification } from "@/hooks/use-push-notification";
import { INSTITUTION_CONFIG } from "@qcet/shared/config/institution";
import { useAuth } from "@/lib/auth-context";
import { useRuntimeFeature } from "@/lib/runtime-features";
import { cn } from "@/lib/utils";

/**
 * Thông báo chào mừng (type `welcome`), thiết kế lại 19/10/2026 (người dùng: "thiết kế lại toàn bộ thư welcome"): thay
 * trang tài liệu kiểu "Welcome to Linear" (khung ảnh lớn thay cảnh, danh sách liên kết gạch chân) bằng thư làm quen gọn
 * theo cỡ chữ của app: danh sách "Bắt đầu" có trạng thái thật như checklist làm quen của Notion, Linear (chỉ việc kiểm
 * được: đã hỏi Trợ lý, đã bật thông báo, đã nhận bản tin sáng), câu hỏi mẫu mở Trợ lý với câu điền sẵn, bốn khu làm việc
 * mang bốn cảnh nét mực (tô bằng màu chữ qua mask nên hợp chế độ tối), phím tắt có thật và lối cài ứng dụng.
 * Không lặp logo (hàng thông báo đã có); mọi lối vào là trang hay hộp thoại có thật.
 */
interface WelcomeEntry {
  title: string;
  description: string;
  /** Trang đích. */
  href?: string;
  /** Hộp thoại dùng chung mở bằng sự kiện cửa sổ (Cài ứng dụng). */
  event?: string;
}

const INSTALL_ENTRY: WelcomeEntry = {
  event: "qcet:open-install-modal",
  title: "Cài ứng dụng trên điện thoại",
  description: "Nhận việc mới, nhắc hạn và xử lý văn bản ngay trên điện thoại.",
};

/** Bốn khu làm việc chính, mỗi khu một icon lớn cùng bộ với trạng thái trống. */
const AREAS = [
  { href: "/tasks", title: "Nhiệm vụ", description: "Giao việc, theo dõi tiến độ đến khi hoàn thành.", glyph: "tasks" },
  { href: "/documents?type=inbox", title: "Văn bản", description: "Văn bản đến, văn bản đi, tờ trình và hồ sơ công việc.", glyph: "doc-in" },
  { href: "/meetings", title: "Cuộc họp", description: "Chương trình, biên bản và quyết nghị các cuộc họp của đơn vị.", glyph: "calendar" },
  { href: "/org", title: "Cơ cấu & Danh bạ", description: "Tra cứu đơn vị, người phụ trách và liên hệ.", glyph: "directory" },
] as const satisfies ReadonlyArray<{ href: string; title: string; description: string; glyph: EmptyGlyphName }>;

/** Câu hỏi mẫu: mở Trợ lý với câu điền sẵn, người dùng tự gửi. */
const SAMPLE_PROMPTS = [
  "Hôm nay tôi cần làm gì?",
  "Việc nào của tôi sắp tới hạn trong tuần này?",
  "Tóm tắt văn bản đến đang chờ tôi xử lý.",
] as const;

/** Phím tắt đang có trong app (bảng đầy đủ mở bằng "?"). */
const SHORTCUTS: ReadonlyArray<{ keys: string[]; label: string; assistant?: boolean }> = [
  { keys: ["⌘", "K"], label: "Tìm kiếm và mở nhanh" },
  { keys: ["⌘", "J"], label: "Mở Trợ lý ở mọi trang", assistant: true },
  { keys: ["C"], label: "Tạo nhiệm vụ (trang Nhiệm vụ)" },
  { keys: ["?"], label: "Xem mọi phím tắt" },
];

// Tạm ẩn ảnh động cài ứng dụng trên điện thoại cuối thư (người dùng chốt 14/10/2026); mục "Cài ứng dụng trên điện thoại" và dòng hỗ trợ vẫn giữ.
// Hộp "Hướng dẫn sử dụng" và các thẻ hướng dẫn 1/3–3/3 đã bỏ hẳn (14/10/2026), thay bằng thẻ gợi ý ở trang trống.
const INSTALL_DEMO_ENABLED = false;

/** Cùng địa chỉ hỗ trợ ở trang đăng nhập. */
const SUPPORT_EMAIL = "hotro@cdktcnqn.edu.vn";

const LINK_CLASS = cn("rounded-sm text-primary underline-offset-2 hover:underline", focusRingClass);

function assistantPromptHref(prompt: string): string {
  return `/assistant?prompt=${encodeURIComponent(prompt)}`;
}

/** Trạng thái một bước: chỉ "done" khi đọc được bằng chứng (cuộc trò chuyện, đăng ký nhận thông báo, cài đặt bản tin). */
type StepState = "done" | "todo";

interface Step {
  id: string;
  title: string;
  description: string;
  state: StepState;
  doneLabel: string;
  action: React.ReactNode;
}

/** Đọc trạng thái các bước liên quan Trợ lý; lỗi mạng thì coi như chưa làm (không báo xong khi không chắc). */
function useAssistantSteps(enabled: boolean) {
  const [asked, setAsked] = React.useState(false);
  const [briefing, setBriefing] = React.useState(false);
  const [refresh, setRefresh] = React.useState(0);
  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void listConversationsRequest({}, controller.signal)
      .then((list) => setAsked(list.items.length > 0))
      .catch(() => undefined);
    void getPreferencesRequest(controller.signal)
      .then((prefs) => setBriefing(prefs.briefingEnabled))
      .catch(() => undefined);
    return () => controller.abort();
  }, [enabled, refresh]);
  return { asked, briefing, reload: () => setRefresh((value) => value + 1) };
}

function SectionTitle({ id, children, aside }: { id: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h3 id={id} className="text-compact font-semibold text-foreground">
        {children}
      </h3>
      {aside}
    </div>
  );
}

function StartChecklist({ steps }: { steps: Step[] }) {
  const done = steps.filter((step) => step.state === "done").length;
  return (
    <section aria-labelledby="welcome-start" className="mt-8">
      <SectionTitle
        id="welcome-start"
        aside={
          <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
            <Progress value={done} max={steps.length} aria-label="Tiến độ làm quen" className="w-16" />
            {done}/{steps.length}
          </span>
        }
      >
        Bắt đầu
      </SectionTitle>
      <div className="overflow-hidden rounded-lg border border-border">
        <ul className="divide-y divide-border/60">
          {steps.map((step) => {
            const finished = step.state === "done";
            return (
              <li key={step.id} className="flex min-h-12 items-center gap-3 px-3 py-2">
                {finished ? (
                  <CircleCheck className="size-4 shrink-0 text-foreground" aria-hidden />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className={cn("text-compact", finished ? "text-muted-foreground line-through decoration-border" : "font-medium text-foreground")}>
                    {step.title}
                    {finished ? <span className="sr-only"> (đã xong)</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {finished ? <span className="shrink-0 text-xs text-muted-foreground">{step.doneLabel}</span> : step.action}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function SamplePrompts() {
  return (
    <section aria-labelledby="welcome-ask" className="mt-8">
      <SectionTitle id="welcome-ask">Thử hỏi Trợ lý</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {SAMPLE_PROMPTS.map((prompt) => (
          <Button key={prompt} asChild variant="toolbar" size="pill" className="max-md:h-11">
            <Link href={assistantPromptHref(prompt)}>{prompt}</Link>
          </Button>
        ))}
      </div>
    </section>
  );
}

function WorkAreas() {
  return (
    <section aria-labelledby="welcome-areas" className="mt-8">
      <SectionTitle id="welcome-areas">Các khu làm việc</SectionTitle>
      <ul className="grid grid-cols-2 gap-2 sm:gap-3">
        {AREAS.map((area) => {
          return (
            <li key={area.href}>
              <Link
                href={area.href}
                className={cn(
                  "group/area flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-foreground/20",
                  focusRingClass,
                )}
              >
                {/* Icon lớn trên nền thẻ (mặt khối tô `--card` nên dải ảnh không có nền riêng), đậm lên khi rê chuột */}
                <span aria-hidden className="flex aspect-[1600/679] items-center justify-center border-b border-border/60">
                  <EmptyGlyph name={area.glyph} className="size-20 text-foreground/80 transition-colors group-hover/area:text-foreground" />
                </span>
                <span className="flex flex-col gap-0.5 px-3 py-2.5">
                  <span className="flex items-center gap-1 text-compact font-medium text-foreground">
                    {area.title}
                    <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/area:opacity-100" aria-hidden />
                  </span>
                  <span className="text-xs text-muted-foreground">{area.description}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Shortcuts({ assistantEnabled }: { assistantEnabled: boolean }) {
  // Điện thoại không có bàn phím nên ẩn mục này ở màn hẹp
  return (
    <section aria-labelledby="welcome-keys" className="mt-8 hidden md:block">
      <SectionTitle id="welcome-keys" aside={<span className="text-xs text-muted-foreground">Windows dùng Ctrl thay ⌘</span>}>
        Phím tắt
      </SectionTitle>
      <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {SHORTCUTS.filter((item) => !item.assistant || assistantEnabled).map((item) => (
          <li key={item.label} className="flex h-8 items-center justify-between gap-3 text-compact text-foreground">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="flex shrink-0 gap-1">
              {item.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InstallRow({ entry }: { entry: WelcomeEntry }) {
  const name = entry.event;
  return (
    <section aria-label={entry.title} className="mt-8 flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden>
        <Smartphone className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-compact font-medium text-foreground">{entry.title}</p>
        <p className="text-xs text-muted-foreground">{entry.description}</p>
      </div>
      {name ? (
        <Button variant="outline" size="sm" className="shrink-0 max-md:min-h-11" onClick={() => window.dispatchEvent(new CustomEvent(name))}>
          Xem cách cài
        </Button>
      ) : null}
    </section>
  );
}

export function WelcomeNotification({ title }: { title: string }) {
  const { user } = useAuth();
  const name = user?.name?.trim();
  const assistantEnabled = useRuntimeFeature("assistant");
  const assistant = useAssistantSteps(assistantEnabled);
  const push = usePushNotification();
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const steps: Step[] = [
    ...(assistantEnabled
      ? [
          {
            id: "ask",
            title: "Hỏi Trợ lý câu đầu tiên",
            description: "Hỏi bằng tiếng Việt về việc, văn bản, lịch họp Thầy/Cô được xem.",
            state: assistant.asked ? "done" : "todo",
            doneLabel: "Đã hỏi",
            action: (
              <Button asChild variant="outline" size="sm" className="shrink-0 max-md:min-h-11">
                <Link href={assistantPromptHref(SAMPLE_PROMPTS[0])}>Hỏi ngay</Link>
              </Button>
            ),
          } satisfies Step,
        ]
      : []),
    {
      id: "push",
      title: "Bật thông báo trên thiết bị này",
      description: "Biết ngay khi có việc mới, bình luận hay nhắc hạn.",
      state: push.isSubscribed ? "done" : "todo",
      doneLabel: "Đã bật",
      action: (
        <Button asChild variant="outline" size="sm" className="shrink-0 max-md:min-h-11">
          <Link href="/settings">Bật</Link>
        </Button>
      ),
    },
    ...(assistantEnabled
      ? [
          {
            id: "briefing",
            title: "Nhận bản tin sáng",
            description: "7 giờ mỗi sáng, Hộp thư nhận số việc cần xử lý, việc trễ hạn và lịch họp.",
            state: assistant.briefing ? "done" : "todo",
            doneLabel: "Đã bật",
            action: (
              <Button variant="outline" size="sm" className="shrink-0 max-md:min-h-11" onClick={() => setSettingsOpen(true)}>
                Bật
              </Button>
            ),
          } satisfies Step,
        ]
      : []),
  ];

  return (
    <div className="text-compact leading-relaxed">
      <h2 className="break-words text-2xl font-semibold leading-tight tracking-tight text-foreground">{title}</h2>
      <p className="mt-3 text-foreground">
        {name ? `Chào ${name}. ` : ""}Đây là nơi {INSTITUTION_CONFIG.officialName} giao việc, xử lý văn bản và theo dõi lịch
        công tác. Vài bước dưới đây giúp Thầy/Cô bắt đầu trong vài phút.
      </p>

      <StartChecklist steps={steps} />
      {assistantEnabled ? <SamplePrompts /> : null}
      <WorkAreas />
      <Shortcuts assistantEnabled={assistantEnabled} />
      <InstallRow entry={INSTALL_ENTRY} />
      {/* Minh họa mục "Cài ứng dụng trên điện thoại": các bước trên iPhone, máy duy nhất phải cài tay */}
      {INSTALL_DEMO_ENABLED ? <WelcomeInstallDemo /> : null}

      <hr className="mt-8 border-border" />
      <p className="mt-4 text-xs text-muted-foreground">
        Có câu hỏi? Gửi thư tới{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className={LINK_CLASS}>
          {SUPPORT_EMAIL}
        </a>
        .
      </p>

      {assistantEnabled ? (
        <AssistantSettingsDialog
          open={settingsOpen}
          onOpenChange={(open) => {
            setSettingsOpen(open);
            // Đóng cài đặt thì đọc lại trạng thái bản tin
            if (!open) assistant.reload();
          }}
        />
      ) : null}
    </div>
  );
}
