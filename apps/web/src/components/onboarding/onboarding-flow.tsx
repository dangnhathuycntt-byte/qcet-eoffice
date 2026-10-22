"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { AssistantPreferencesDTO } from "@qcet/contracts/assistant";
import { ASSISTANT_INSTRUCTIONS_MAX } from "@qcet/contracts/assistant";
import { sanitizeRedirectUrl } from "@qcet/shared/lib/login-helpers";
import { useAuth, isUserUnassignedDepartment } from "@/lib/auth-context";
import { assistantErrorText, getPreferencesRequest, updatePreferencesRequest } from "@/components/assistant/assistant-client";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  ADDRESS_FORMS,
  ANSWER_STYLE_LABEL,
  FOCUS_AREAS,
  addressLabel,
  composeAssistantInstructions,
  givenName,
  onboardingSteps,
  parseOnboardingStep,
  starterPrompts,
  type AddressForm,
  type AnswerStyle,
  type FocusArea,
  type OnboardingStep,
} from "@/lib/onboarding";
import { OnboardingPreview } from "@/components/onboarding/onboarding-preview";

const STEP_COPY: Record<OnboardingStep, { title: (name: string) => string; description: string }> = {
  profile: {
    title: (name) => (name ? `Chào ${name}, xác nhận hồ sơ` : "Xác nhận hồ sơ"),
    description: "Tên và chức danh hiện trên nhiệm vụ, văn bản và trong câu trả lời của Trợ lý.",
  },
  address: {
    title: () => "Trợ lý xưng hô thế nào?",
    description: "Chọn cách gọi và cách trả lời; Trợ lý ghi nhớ như một hướng dẫn riêng.",
  },
  focus: {
    title: () => "Trợ lý giúp gì trước?",
    description: "Trợ lý chỉ đọc dữ liệu Thầy/Cô được xem và chỉ thực hiện thao tác khi Thầy/Cô bấm duyệt.",
  },
  start: {
    title: () => "Hỏi Trợ lý câu đầu tiên",
    description: "Chọn một câu; Trợ lý mở với câu hỏi điền sẵn để Thầy/Cô xem lại rồi gửi.",
  },
};

const PREFERENCES_FAILED = "Chưa lưu được thiết lập Trợ lý. Thầy/Cô thử lại.";

/**
 * Onboarding nhiều bước theo mẫu form trái, xem trước phải (tham khảo onboarding của Claude, Frame; tra cứu 22/10/2026):
 * hồ sơ → xưng hô và cách trả lời → việc cần giúp, bản tin sáng → câu hỏi đầu tiên. Bước nằm ở `?step=` (nút lùi của trình duyệt
 * về bước trước). "Bỏ qua" và bước cuối đều ghi nhận đã onboarding nên không bị hỏi lại; mở lại từ mục "Hồ sơ cá nhân".
 */
export function OnboardingFlow({ assistantEnabled }: { assistantEnabled: boolean }) {
  const { user, updateProfile, completeOnboarding } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const steps = onboardingSteps(assistantEnabled);
  const step = parseOnboardingStep(searchParams.get("step"), steps);
  const stepIndex = steps.indexOf(step);
  const isLastStep = stepIndex === steps.length - 1;
  const nextPath = sanitizeRedirectUrl(searchParams.get("next") ?? "") || "/tasks";
  const alreadyOnboarded = Boolean(user?.onboardedAt);

  const [name, setName] = React.useState(user?.name ?? "");
  const [title, setTitle] = React.useState(user?.title ?? "");
  const [phone, setPhone] = React.useState(user?.phone ?? "");
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [address, setAddress] = React.useState<AddressForm>("ten");
  const [style, setStyle] = React.useState<AnswerStyle>("concise");
  const [focus, setFocus] = React.useState<FocusArea[]>(["tasks"]);
  const [briefing, setBriefing] = React.useState(false);
  const [savedPreferences, setSavedPreferences] = React.useState<AssistantPreferencesDTO | null>(null);
  // Hướng dẫn riêng đã có hoặc người dùng tự sửa thì giữ nguyên chữ; chưa có thì ghép từ lựa chọn
  const [instructionsDraft, setInstructionsDraft] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<"next" | "skip" | "later" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!assistantEnabled) return;
    const controller = new AbortController();
    getPreferencesRequest(controller.signal)
      .then((prefs) => {
        setSavedPreferences(prefs);
        setBriefing(prefs.briefingEnabled);
        if (prefs.instructions.trim()) setInstructionsDraft(prefs.instructions);
      })
      .catch(() => {
        // Chưa đọc được thì coi như chưa có; lưu ở bước "Trợ lý giúp gì" sẽ báo lỗi nếu API vẫn hỏng
      });
    return () => controller.abort();
  }, [assistantEnabled]);

  const composedInstructions = composeAssistantInstructions({ fullName: name, title, address, style, focus });
  const instructions = instructionsDraft ?? composedInstructions;
  const prompts = starterPrompts(focus);
  const selectedPrompt = prompt && prompts.includes(prompt) ? prompt : prompts[0] ?? null;

  // Đổi bước: con trỏ vào điều khiển đầu tiên của bước (ô tên ở bước hồ sơ)
  React.useEffect(() => {
    setError(null);
    const first = formRef.current?.querySelector<HTMLElement>("input, textarea, [data-slot='toggle-group-item'], [data-onboarding-option]");
    first?.focus();
  }, [step]);

  const goTo = (target: OnboardingStep) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", target);
    window.history.pushState(null, "", `?${params.toString()}`);
  };

  const finish = async (destination: string, kind: "next" | "skip" | "later") => {
    setPending(kind);
    setError(null);
    if (!alreadyOnboarded) {
      const result = await completeOnboarding();
      if (!result.success) {
        setPending(null);
        setError(result.error ?? "Chưa lưu được trạng thái bắt đầu sử dụng.");
        return;
      }
    }
    router.push(destination);
  };

  const saveProfile = async (): Promise<boolean> => {
    if (!name.trim()) {
      setNameError("Nhập họ và tên.");
      nameInputRef.current?.focus();
      return false;
    }
    setNameError(null);
    const changed = name.trim() !== (user?.name ?? "") || title.trim() !== (user?.title ?? "") || phone.trim() !== (user?.phone ?? "");
    if (!changed) return true;
    const result = await updateProfile({ name, title, phone });
    if (!result.success) {
      setError(result.error ?? "Chưa lưu được hồ sơ. Thầy/Cô thử lại.");
      return false;
    }
    return true;
  };

  const savePreferences = async (): Promise<boolean> => {
    const nextInstructions = instructions.trim();
    if (savedPreferences && savedPreferences.instructions === nextInstructions && savedPreferences.briefingEnabled === briefing) return true;
    try {
      setSavedPreferences(await updatePreferencesRequest({ instructions: nextInstructions, briefingEnabled: briefing }));
      return true;
    } catch (failure) {
      setError(assistantErrorText(failure, PREFERENCES_FAILED));
      return false;
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    if (step === "start") {
      await finish(selectedPrompt ? `/assistant?prompt=${encodeURIComponent(selectedPrompt)}` : "/assistant", "next");
      return;
    }
    setPending("next");
    setError(null);
    const saved = step === "profile" ? await saveProfile() : step === "focus" ? await savePreferences() : true;
    if (!saved) {
      setPending(null);
      return;
    }
    if (isLastStep) {
      await finish(nextPath, "next");
      return;
    }
    setPending(null);
    goTo(steps[stepIndex + 1]);
  };

  const copy = STEP_COPY[step];
  const department = user && !isUserUnassignedDepartment(user) ? user.department : null;
  const primaryLabel = step === "start" ? "Mở Trợ lý" : isLastStep ? "Hoàn tất" : step === "focus" ? "Lưu và tiếp tục" : "Tiếp tục";

  return (
    <div className="flex min-h-[100dvh] w-full bg-background text-foreground">
      <div className="flex w-full min-w-0 flex-col lg:w-1/2">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Image src="/design/login-logo.png" alt="" width={24} height={24} className="size-6 rounded-full object-contain" />
            <span className="truncate text-compact font-medium">QCET E-Office</span>
          </div>
          <Button type="button" variant="ghost" size="sm" loading={pending === "skip"} disabled={pending !== null} onClick={() => void finish(nextPath, "skip")}>
            {alreadyOnboarded ? "Đóng" : "Bỏ qua"}
          </Button>
        </header>

        <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-4 pb-10 outline-none sm:px-8">
          <div className="mx-auto flex w-full max-w-[440px] flex-col pt-4 sm:pt-12">
            {steps.length > 1 ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">
                  Bước {stepIndex + 1}/{steps.length}
                </span>
                <Progress value={stepIndex + 1} max={steps.length} aria-label="Tiến độ thiết lập" />
              </div>
            ) : null}

            <h1 className="mt-6 text-xl font-semibold tracking-tight">{copy.title(givenName(user?.name ?? ""))}</h1>
            <p className="mt-1.5 text-compact text-muted-foreground">{copy.description}</p>

            <form ref={formRef} noValidate onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
              {step === "profile" ? (
                <>
                  <FormField label="Họ và tên" error={nameError ?? undefined}>
                    <Input
                      ref={nameInputRef}
                      compact
                      value={name}
                      autoComplete="name"
                      onChange={(event) => {
                        setName(event.target.value);
                        if (nameError && event.target.value.trim()) setNameError(null);
                      }}
                    />
                  </FormField>
                  <FormField label="Chức danh" optional hint="Ví dụ: Giảng viên, Chuyên viên, Trưởng khoa.">
                    <Input compact value={title} autoComplete="organization-title" onChange={(event) => setTitle(event.target.value)} />
                  </FormField>
                  <FormField label="Số điện thoại" optional>
                    <Input compact type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
                  </FormField>
                  <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 rounded-lg border border-border px-3 py-2.5 text-xs">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="min-w-0 truncate">{user?.email}</dd>
                    <dt className="text-muted-foreground">Đơn vị</dt>
                    <dd className="min-w-0">
                      {department ?? (
                        <>
                          Chưa được gán
                          <span className="block text-muted-foreground">Quản trị viên gán theo phân công vị trí việc làm.</span>
                        </>
                      )}
                    </dd>
                    <dt className="text-muted-foreground">Vai trò</dt>
                    <dd className="min-w-0">{user?.roleLabel}</dd>
                  </dl>
                </>
              ) : null}

              {step === "address" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">Trợ lý gọi Thầy/Cô là</span>
                    <ToggleGroup
                      aria-label="Trợ lý gọi Thầy/Cô là"
                      variant="outline"
                      value={[address]}
                      onValueChange={(value) => value[0] && setAddress(value[0] as AddressForm)}
                      className="flex-wrap"
                    >
                      {ADDRESS_FORMS.map((form) => (
                        <ToggleGroupItem key={form} value={form}>
                          {addressLabel(form, name) || "Theo tên"}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">Cách trả lời</span>
                    <ToggleGroup
                      aria-label="Cách trả lời"
                      variant="outline"
                      value={[style]}
                      onValueChange={(value) => value[0] && setStyle(value[0] as AnswerStyle)}
                    >
                      {(Object.keys(ANSWER_STYLE_LABEL) as AnswerStyle[]).map((key) => (
                        <ToggleGroupItem key={key} value={key}>
                          {ANSWER_STYLE_LABEL[key].label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <p className="text-xs text-muted-foreground">{ANSWER_STYLE_LABEL[style].hint}.</p>
                  </div>
                </>
              ) : null}

              {step === "focus" ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium">Việc cần Trợ lý giúp</span>
                    <ToggleGroup
                      aria-label="Việc cần Trợ lý giúp"
                      variant="outline"
                      multiple
                      value={focus}
                      onValueChange={(value) => setFocus(value as FocusArea[])}
                      className="flex-wrap"
                    >
                      {FOCUS_AREAS.map((area) => (
                        <ToggleGroupItem key={area.id} value={area.id}>
                          {area.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <p className="text-xs text-muted-foreground">Chọn một hoặc nhiều; dùng để gợi ý câu hỏi đầu tiên.</p>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <label htmlFor="onboarding-briefing" className="text-xs font-medium">
                        Bản tin sáng
                      </label>
                      <p className="text-xs text-muted-foreground">
                        7 giờ sáng mỗi ngày, Hộp thư nhận số việc cần xử lý, nhiệm vụ trễ hạn và cuộc họp hôm nay.
                      </p>
                    </div>
                    <Switch id="onboarding-briefing" checked={briefing} onChange={(event) => setBriefing(event.target.checked)} />
                  </div>
                  <FormField label="Trợ lý sẽ ghi nhớ" hint="Lưu vào Hướng dẫn riêng; sửa lại được trong Cài đặt Trợ lý.">
                    <Textarea
                      compact
                      autoResize
                      rows={4}
                      className="min-h-24"
                      value={instructions}
                      maxLength={ASSISTANT_INSTRUCTIONS_MAX}
                      countOnlyNearLimit
                      onChange={(event) => setInstructionsDraft(event.target.value)}
                    />
                  </FormField>
                  {instructionsDraft !== null && instructionsDraft !== composedInstructions ? (
                    <Button type="button" variant="ghost" size="sm" className="-mt-3 self-start" onClick={() => setInstructionsDraft(null)}>
                      Soạn lại theo lựa chọn
                    </Button>
                  ) : null}
                </>
              ) : null}

              {step === "start" ? (
                <div role="group" aria-label="Câu hỏi gợi ý" className="flex flex-col gap-1.5">
                  {prompts.map((text) => {
                    const selected = text === selectedPrompt;
                    return (
                      <Pressable
                        key={text}
                        data-onboarding-option=""
                        aria-pressed={selected}
                        onClick={() => setPrompt(text)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-compact transition-colors",
                          selected ? "border-transparent bg-selected font-medium text-foreground" : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        {text}
                      </Pressable>
                    );
                  })}
                </div>
              ) : null}

              {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

              <div className="mt-1 flex items-center justify-between gap-2">
                {stepIndex > 0 ? (
                  <Button type="button" variant="ghost" size="sm" disabled={pending !== null} onClick={() => goTo(steps[stepIndex - 1])}>
                    <ArrowLeft data-icon="inline-start" />
                    Quay lại
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  {step === "start" ? (
                    <Button type="button" variant="ghost" size="sm" loading={pending === "later"} disabled={pending !== null} onClick={() => void finish(nextPath, "later")}>
                      Để sau
                    </Button>
                  ) : null}
                  <Button type="submit" size="sm" loading={pending === "next"}>
                    {primaryLabel}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>

      <aside aria-hidden="true" className="hidden min-h-[100dvh] w-1/2 items-center justify-center border-l border-border bg-sidebar p-10 lg:flex">
        <OnboardingPreview
          step={step}
          fullName={name}
          title={title}
          department={department}
          address={address}
          style={style}
          focus={focus}
          briefing={briefing}
          prompt={selectedPrompt}
        />
      </aside>
    </div>
  );
}
