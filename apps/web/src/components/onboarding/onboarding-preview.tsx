import * as React from "react";
import { ArrowUp, Inbox, Sparkles } from "lucide-react";
import {
  FOCUS_AREAS,
  addressLabel,
  selfPronoun,
  type AddressForm,
  type AnswerStyle,
  type FocusArea,
  type OnboardingStep,
} from "@/lib/onboarding";

const STEP_ORDER: OnboardingStep[] = ["profile", "address", "focus", "start"];

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface OnboardingPreviewProps {
  step: OnboardingStep;
  fullName: string;
  title: string;
  department: string | null;
  address: AddressForm;
  style: AnswerStyle;
  focus: FocusArea[];
  briefing: boolean;
  prompt: string | null;
}

/**
 * Khung xem trước bên phải: Trợ lý chào và trả lời theo lựa chọn ở từng bước. Chỉ nói đúng điều Trợ lý làm được (tra cứu,
 * soạn thẻ chờ duyệt, bản tin sáng), không bịa số việc hay tên nhiệm vụ.
 */
export function OnboardingPreview({ step, fullName, title, department, address, style, focus, briefing, prompt }: OnboardingPreviewProps) {
  const reached = (target: OnboardingStep) => STEP_ORDER.indexOf(step) >= STEP_ORDER.indexOf(target);
  const label = addressLabel(address, fullName) || "Thầy/Cô";
  const self = selfPronoun(address);
  const focusLabels = FOCUS_AREAS.filter((area) => focus.includes(area.id)).map((area) => area.label);

  return (
    <div className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xs">
      <div className="flex h-11 items-center gap-2 border-b border-border/60 px-4">
        <Sparkles className="size-3.5 text-muted-foreground" />
        <span className="text-compact font-medium">Trợ lý</span>
        <span className="ml-auto text-xs text-muted-foreground">Xem trước</span>
      </div>

      <div className="flex min-h-[320px] flex-col gap-3 p-4 text-compact leading-relaxed">
        <p>
          Chào {label}! {capitalize(self)} là Trợ lý của QCET E-Office.
        </p>

        {step === "profile" ? (
          <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1 rounded-lg border border-border/70 px-3 py-2 text-xs">
            <dt className="text-muted-foreground">Họ tên</dt>
            <dd className="truncate">{fullName.trim() || "—"}</dd>
            <dt className="text-muted-foreground">Chức danh</dt>
            <dd className="truncate">{title.trim() || "—"}</dd>
            <dt className="text-muted-foreground">Đơn vị</dt>
            <dd className="truncate">{department ?? "Chưa được gán"}</dd>
          </dl>
        ) : null}

        {reached("address") ? (
          style === "concise" ? (
            <p>
              {capitalize(self)} tra cứu nhiệm vụ, văn bản, cuộc họp và soạn sẵn thao tác; {label} duyệt thì {self} mới thực hiện.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <p>{capitalize(self)} có thể giúp {label}:</p>
              <ul className="list-disc space-y-0.5 pl-5">
                <li>Tra cứu, tóm tắt nhiệm vụ, văn bản và cuộc họp {label} được xem.</li>
                <li>Soạn sẵn bình luận, đổi trạng thái hoặc nhắc việc thành thẻ để {label} duyệt.</li>
                <li>Chỉ thực hiện thao tác khi {label} bấm duyệt.</li>
              </ul>
            </div>
          )
        ) : null}

        {reached("focus") && focusLabels.length ? (
          <p className="ml-auto max-w-[85%] rounded-2xl bg-secondary px-3 py-2">Tôi cần hỗ trợ: {focusLabels.join(", ").toLowerCase()}.</p>
        ) : null}

        {reached("focus") && briefing ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-border/70 px-3 py-2">
            <Inbox className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 text-xs">
              <p className="font-medium text-foreground">Bản tin sáng</p>
              <p className="text-muted-foreground">7 giờ sáng mỗi ngày, Hộp thư nhận số việc cần xử lý, nhiệm vụ trễ hạn và cuộc họp hôm nay.</p>
            </div>
          </div>
        ) : null}
      </div>

      {step === "start" ? (
        <div className="border-t border-border/60 p-3">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2">
            <p className="min-w-0 flex-1 text-compact">{prompt ?? "Hỏi Trợ lý…"}</p>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <ArrowUp className="size-3.5" />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
