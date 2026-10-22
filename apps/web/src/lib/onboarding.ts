import { ASSISTANT_INSTRUCTIONS_MAX } from "@qcet/contracts/assistant";

/**
 * Onboarding (`/onboarding`): xác nhận hồ sơ rồi thiết lập cách Trợ lý làm việc cùng người dùng (xưng hô, cách trả lời,
 * việc cần giúp, bản tin sáng) và kết thúc bằng câu hỏi đầu tiên điền sẵn cho Trợ lý (người dùng tự gửi). Các lựa chọn
 * lưu thành Hướng dẫn riêng của Trợ lý (`assistant_preferences.instructions`), sửa lại được trong Cài đặt Trợ lý.
 */

export type OnboardingStep = "profile" | "address" | "focus" | "start";

/** Thứ tự bước; Trợ lý tắt thì chỉ còn hồ sơ. */
export function onboardingSteps(assistantEnabled: boolean): OnboardingStep[] {
  return assistantEnabled ? ["profile", "address", "focus", "start"] : ["profile"];
}

export function parseOnboardingStep(value: string | null | undefined, steps: OnboardingStep[]): OnboardingStep {
  return steps.find((step) => step === value) ?? steps[0];
}

export type AddressForm = "thay" | "co" | "anh" | "chi" | "ten";
export type AnswerStyle = "concise" | "detailed";
export type FocusArea = "tasks" | "documents" | "meetings" | "today";

export const ADDRESS_FORMS: AddressForm[] = ["thay", "co", "anh", "chi", "ten"];

const HONORIFIC: Record<Exclude<AddressForm, "ten">, string> = { thay: "Thầy", co: "Cô", anh: "Anh", chi: "Chị" };

/** Tên gọi theo thói quen tiếng Việt: chữ cuối của họ tên. */
export function givenName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** Cách Trợ lý gọi người dùng: "Thầy Huy", "Chị Lan"… hoặc chỉ tên. */
export function addressLabel(form: AddressForm, fullName: string): string {
  const name = givenName(fullName);
  if (form === "ten") return name;
  return name ? `${HONORIFIC[form]} ${name}` : HONORIFIC[form];
}

/** Gọi bằng Thầy/Cô/Anh/Chị thì Trợ lý xưng "em", gọi tên thì xưng "tôi". */
export function selfPronoun(form: AddressForm): "em" | "tôi" {
  return form === "ten" ? "tôi" : "em";
}

export const ANSWER_STYLE_LABEL: Record<AnswerStyle, { label: string; hint: string }> = {
  concise: { label: "Ngắn gọn", hint: "Đi thẳng vào việc, giải thích thêm khi được hỏi" },
  detailed: { label: "Đầy đủ", hint: "Kèm giải thích và các bước cần làm" },
};

// Chỉ những việc Trợ lý có công cụ đọc thật (nhiệm vụ, văn bản, cuộc họp, việc trong ngày); không có công cụ ghi chú.
export const FOCUS_AREAS: { id: FocusArea; label: string; instruction: string; prompt: string }[] = [
  {
    id: "tasks",
    label: "Nhiệm vụ của tôi",
    instruction: "nhiệm vụ được giao",
    prompt: "Những nhiệm vụ nào của tôi sắp đến hạn hoặc đang trễ hạn?",
  },
  {
    id: "documents",
    label: "Văn bản cần xử lý",
    instruction: "văn bản cần xử lý",
    prompt: "Có văn bản nào đang chờ tôi xử lý không?",
  },
  {
    id: "meetings",
    label: "Lịch họp",
    instruction: "lịch họp",
    prompt: "Tuần này tôi có những cuộc họp nào?",
  },
  {
    id: "today",
    label: "Việc hôm nay",
    instruction: "tổng hợp việc trong ngày",
    prompt: "Tóm tắt việc hôm nay của tôi: việc cần xử lý, nhiệm vụ trễ hạn và lịch họp hôm nay.",
  },
];

export interface AssistantSetupChoices {
  fullName: string;
  title: string;
  address: AddressForm;
  style: AnswerStyle;
  focus: FocusArea[];
}

/** Hướng dẫn riêng ghép từ lựa chọn, đúng thứ tự hiển thị của nhóm việc; giới hạn như ô Hướng dẫn riêng. */
export function composeAssistantInstructions(choices: AssistantSetupChoices): string {
  const lines: string[] = [];
  const label = addressLabel(choices.address, choices.fullName);
  if (label) lines.push(`Gọi tôi là ${label}, xưng "${selfPronoun(choices.address)}".`);
  lines.push(
    choices.style === "concise"
      ? "Trả lời ngắn gọn, đi thẳng vào việc; chỉ giải thích thêm khi tôi hỏi."
      : "Trả lời đầy đủ: nêu lý do và các bước cần làm."
  );
  const title = choices.title.trim();
  if (title) lines.push(`Chức danh của tôi: ${title}.`);
  const focus = FOCUS_AREAS.filter((area) => choices.focus.includes(area.id)).map((area) => area.instruction);
  if (focus.length) lines.push(`Tôi cần hỗ trợ nhiều nhất về: ${focus.join(", ")}.`);
  return lines.join("\n").slice(0, ASSISTANT_INSTRUCTIONS_MAX);
}

/** Câu hỏi đầu tiên gợi ý theo việc đã chọn (tối đa 3); chưa chọn gì thì gợi ý nhiệm vụ và việc hôm nay. */
export function starterPrompts(focus: FocusArea[]): string[] {
  const chosen = FOCUS_AREAS.filter((area) => focus.includes(area.id));
  const list = chosen.length ? chosen : FOCUS_AREAS.filter((area) => area.id === "tasks" || area.id === "today");
  return list.slice(0, 3).map((area) => area.prompt);
}

/** Trang không qua onboarding: trang công khai và chính trang onboarding. */
const ONBOARDING_EXEMPT_PREFIXES = ["/onboarding", "/login", "/portal", "/docs", "/maintenance"];

/**
 * Chuyển người dùng chưa onboarding sang `/onboarding`: chỉ khi phiên do máy chủ xác thực và `onboardedAt` là `null`
 * (bản lưu ngoại tuyến không có trường này thì bỏ qua).
 */
export function shouldRedirectToOnboarding(
  user: { onboardedAt?: string | null } | null | undefined,
  isAuthenticated: boolean,
  pathname: string
): boolean {
  if (!user || !isAuthenticated || user.onboardedAt !== null) return false;
  return !ONBOARDING_EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
