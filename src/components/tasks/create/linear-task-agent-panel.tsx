"use client";

import * as React from "react";
import {
  ChevronRight,
  X,
  Send,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskMilestoneItem {
  id: string;
  title: string;
  dueDate?: string;
  completed?: boolean;
}

export interface TaskAgentSuggestion {
  title: string;
  summary: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  description: string;
  targetDate: string;
  startDate?: string;
  milestones: TaskMilestoneItem[];
  category?: string;
  suggestedLeadName?: string;
  suggestedCoAssignees?: string[];
}

export interface LinearTaskAgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCollapse: () => void;
  onApplySuggestion: (
    suggestion: TaskAgentSuggestion,
    options?: { onlyEmptyFields?: boolean }
  ) => void;
  currentDraft?: {
    title?: string;
    summary?: string;
    description?: string;
    priority?: string;
    dueDate?: string;
    startDate?: string;
    category?: string;
    leadAssigneeName?: string;
    coAssignees?: string[];
    milestones?: TaskMilestoneItem[];
  };
  availablePersonnel?: { name: string; role?: string }[];
}

const PROMPT_PILLS = [
  {
    id: "scope",
    label: "Xác định mục tiêu & phạm vi",
    prompt:
      "Xác định mục tiêu chỉ đạo, căn cứ pháp lý và phạm vi triển khai cho nhiệm vụ.",
  },
  {
    id: "timeline",
    label: "Lập kế hoạch mốc thời gian",
    prompt:
      "Thiết lập lộ trình thực hiện, ngày bắt đầu và các mốc hạn chót nghiệm thu theo tiến độ.",
  },
  {
    id: "breakdown",
    label: "Phân rã đầu việc con",
    prompt:
      "Chia nhỏ nhiệm vụ thành 4 mốc công việc chi tiết gắn với kết quả nghiệm thu định lượng.",
  },
  {
    id: "personnel",
    label: "Chọn nhân sự phụ trách",
    prompt:
      "Đề xuất phân công vai trò Người chủ trì (DRI) và các nhân sự đơn vị phối hợp tối ưu.",
  },
];

function generateMockAgentResponse(
  prompt: string,
  currentTitle?: string,
  personnelList: { name: string; role?: string }[] = []
): TaskAgentSuggestion {
  const normalized = prompt.toLowerCase();
  const baseTitle =
    currentTitle && currentTitle.trim().length > 3
      ? currentTitle.trim()
      : "Hoàn thiện hệ thống quản lý đào tạo và khảo thí trực tuyến QCET";

  // Calculate default target dates (UTC+7 / ICT standard)
  const now = new Date();
  const startDate = now.toISOString().split("T")[0];
  const targetDateObj = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const targetDate = targetDateObj.toISOString().split("T")[0];

  const m1Date = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const m2Date = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const m3Date = new Date(now.getTime() + 23 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Candidates for DRI & Collaborators
  const candidateLead =
    personnelList.length > 0 ? personnelList[0].name : "Trưởng phòng QLĐT";
  const candidateCo =
    personnelList.length > 1
      ? personnelList.slice(1, 3).map((p) => p.name)
      : [];

  if (normalized.includes("mốc") || normalized.includes("phân rã") || normalized.includes("chia")) {
    return {
      title: baseTitle,
      summary:
        "Phân rã nhiệm vụ thành 4 giai đoạn độc lập có sản phẩm nghiệm thu rõ ràng.",
      priority: "HIGH",
      description:
        "Kế hoạch triển khai chia nhỏ theo các mốc công việc:\n- Giai đoạn 1: Thu thập hồ sơ, căn cứ pháp lý và yêu cầu thực tế.\n- Giai đoạn 2: Xây dựng dự thảo phương án và thẩm định kỹ thuật.\n- Giai đoạn 3: Triển khai thí điểm tại các đơn vị trực thuộc.\n- Giai đoạn 4: Hoàn thiện báo cáo tổng kết và nghiệm thu chính thức.",
      startDate,
      targetDate,
      category: "CHUYEN_DOI_SO",
      suggestedLeadName: candidateLead,
      suggestedCoAssignees: candidateCo,
      milestones: [
        {
          id: `ms-${Date.now()}-1`,
          title: "Khảo sát hiện trạng và tổng hợp nhu cầu các đơn vị",
          dueDate: m1Date,
          completed: false,
        },
        {
          id: `ms-${Date.now()}-2`,
          title: "Xây dựng dự thảo quy trình và thẩm định kỹ thuật",
          dueDate: m2Date,
          completed: false,
        },
        {
          id: `ms-${Date.now()}-3`,
          title: "Triển khai thử nghiệm và tiếp nhận phản hồi hiệu chỉnh",
          dueDate: m3Date,
          completed: false,
        },
        {
          id: `ms-${Date.now()}-4`,
          title: "Nghiệm thu chính thức và bàn giao tài liệu hướng dẫn",
          dueDate: targetDate,
          completed: false,
        },
      ],
    };
  }

  if (normalized.includes("nhân sự") || normalized.includes("phụ trách") || normalized.includes("dri")) {
    return {
      title: baseTitle,
      summary:
        "Phân công cụ thể vai trò Người chủ trì (DRI) và đầu mối phối hợp các đơn vị.",
      priority: "URGENT",
      description:
        "Yêu cầu về nhân sự thực hiện:\n- Người chủ trì chịu trách nhiệm toàn diện trước BGH về tiến độ và chất lượng.\n- Các nhân sự phối hợp chủ động thực hiện phần việc được giao theo phân công.",
      startDate,
      targetDate,
      category: "CHUYEN_DOI_SO",
      suggestedLeadName: candidateLead,
      suggestedCoAssignees: candidateCo,
      milestones: [
        {
          id: `ms-${Date.now()}-1`,
          title: "Họp phân công nhiệm vụ chi tiết cho các thành viên",
          dueDate: m1Date,
          completed: false,
        },
        {
          id: `ms-${Date.now()}-2`,
          title: "Kiểm tra tiến độ thực hiện định kỳ giữa kỳ",
          dueDate: m2Date,
          completed: false,
        },
        {
          id: `ms-${Date.now()}-3`,
          title: "Tổng hợp đánh giá năng suất và báo cáo kết quả thực hiện",
          dueDate: targetDate,
          completed: false,
        },
      ],
    };
  }

  // Default: Scope & Objective
  return {
    title: baseTitle,
    summary:
      "Xác lập mục tiêu chỉ đạo, tiêu chí hoàn thành và phân công trách nhiệm rõ ràng.",
    priority: "MEDIUM",
    description:
      "Mục tiêu & Yêu cầu trọng tâm:\n- Bảo đảm tính đồng bộ, tuân thủ quy chế chuyên môn và tiến độ nhà trường.\n- Các đơn vị liên quan chủ động phối hợp, báo cáo kịp thời khi phát sinh vướng mắc.\n- Sản phẩm bàn giao phải có hồ sơ kiểm thử và xác nhận của lãnh đạo phụ trách.",
    startDate,
    targetDate,
    category: "CHUYEN_DOI_SO",
    suggestedLeadName: candidateLead,
    suggestedCoAssignees: candidateCo,
    milestones: [
      {
        id: `ms-${Date.now()}-1`,
        title: "Xác định danh mục chỉ tiêu và sản phẩm bàn giao cốt lõi",
        dueDate: m1Date,
        completed: false,
      },
      {
        id: `ms-${Date.now()}-2`,
        title: "Thẩm định đề cương công việc cùng các bên liên quan",
        dueDate: m2Date,
        completed: false,
      },
      {
        id: `ms-${Date.now()}-3`,
        title: "Tổ chức triển khai thí điểm tại 02 đơn vị đầu mối",
        dueDate: m3Date,
        completed: false,
      },
      {
        id: `ms-${Date.now()}-4`,
        title: "Nghiệm thu toàn diện và hoàn tất hồ sơ lưu trữ",
        dueDate: targetDate,
        completed: false,
      },
    ],
  };
}

export function LinearTaskAgentPanel({
  isOpen,
  onClose,
  onCollapse,
  onApplySuggestion,
  currentDraft,
  availablePersonnel = [],
}: LinearTaskAgentPanelProps) {
  const [prompt, setPrompt] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<TaskAgentSuggestion | null>(null);
  const [errorNotice, setErrorNotice] = React.useState<string | null>(null);
  const [applied, setApplied] = React.useState(false);
  const [onlyEmptyFields, setOnlyEmptyFields] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleGenerate = (customPrompt?: string) => {
    const textToRun = customPrompt ?? prompt;
    if (!textToRun.trim() && !currentDraft?.title) {
      setErrorNotice("Vui lòng nhập yêu cầu hoặc đặt tên nhiệm vụ trước.");
      return;
    }

    setIsGenerating(true);
    setErrorNotice(null);
    setApplied(false);

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      try {
        const res = generateMockAgentResponse(
          textToRun,
          currentDraft?.title,
          availablePersonnel
        );
        if (!res || !res.title) {
          throw new Error("Phản hồi đề xuất từ Trợ lý AI không đúng định dạng.");
        }
        setSuggestion(res);
        setIsGenerating(false);
      } catch (err: unknown) {
        setIsGenerating(false);
        setErrorNotice(
          err instanceof Error
            ? err.message
            : "Đã xảy ra sự cố khi kết nối Trợ lý AI. Bạn vẫn có thể tiếp tục nhập biểu mẫu thủ công."
        );
      }
    }, 700);
  };

  const handleApply = () => {
    if (!suggestion) return;
    onApplySuggestion(suggestion, { onlyEmptyFields });
    setApplied(true);
  };

  const handleDiscard = () => {
    setSuggestion(null);
    setApplied(false);
    setErrorNotice(null);
  };

  if (!isOpen) return null;

  return (
    <aside
      className={cn(
        "w-full md:w-[340px] md:min-w-[340px] md:max-w-[340px] border-t md:border-t-0 md:border-l border-border/60 bg-card shrink-0",
        "flex flex-col min-h-0 overflow-hidden text-foreground transition-all duration-200",
        "animate-in slide-in-from-right-4"
      )}
      aria-label="Khung trợ lý soạn thảo nhiệm vụ"
    >
      {/* Panel Top Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-card shrink-0">
        <h3 className="text-xs font-semibold text-foreground">
          Trợ lý soạn thảo
        </h3>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onCollapse}
            className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            aria-label="Thu gọn khung trợ lý"
            title="Thu gọn"
          >
            <ChevronRight className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            aria-label="Đóng khung trợ lý"
            title="Đóng"
          >
            <X className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Lightweight Prompt Suggestions */}
        <div className="space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground select-none">
            Gợi ý cấu trúc
          </span>
          <div className="flex flex-wrap gap-1">
            {PROMPT_PILLS.map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  setPrompt(pill.prompt);
                  handleGenerate(pill.prompt);
                }}
                disabled={isGenerating}
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-left cursor-pointer disabled:opacity-40 disabled:pointer-events-none select-none"
              >
                <span>{pill.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Box */}
        <div className="rounded-md border border-border/80 bg-background p-2.5 space-y-1.5 focus-within:border-border transition-colors">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            placeholder="Yêu cầu trợ lý soạn thảo cấu trúc..."
            rows={3}
            className="w-full resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground">
              Nhấn Enter để gửi
            </span>
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={isGenerating || (!prompt.trim() && !currentDraft?.title)}
              className={cn(
                "inline-flex items-center justify-center size-6 rounded bg-primary text-primary-foreground transition-all shadow-2xs cursor-pointer",
                "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                "disabled:opacity-40 disabled:pointer-events-none"
              )}
              aria-label="Gửi yêu cầu tới AI"
            >
              {isGenerating ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Send className="size-3" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>

        {/* Error Notification with Retry */}
        {errorNotice && (
          <div className="rounded bg-rose-50 border border-rose-200 p-2.5 space-y-1.5 text-xs text-rose-800">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="size-3.5 shrink-0 text-rose-500 mt-0.5" />
              <span className="flex-1 leading-relaxed text-[11px]">{errorNotice}</span>
            </div>
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => handleGenerate()}
                className="h-6 px-2 text-[11px] font-medium rounded border border-rose-200 bg-background text-rose-700 hover:bg-rose-50 cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          </div>
        )}

        {/* Loading State Animation */}
        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-8 space-y-1.5 text-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">
              Trợ lý đang soạn thảo...
            </p>
          </div>
        )}

        {/* Generated Suggestion Preview (Diff & Approval) */}
        {!isGenerating && suggestion && (
          <div className="rounded-md border border-border/80 bg-background p-3 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
              <span className="text-xs font-semibold text-foreground">
                Đề xuất nội dung
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {suggestion.priority}
              </span>
            </div>

            {/* Field Diff / Detail Comparison */}
            <div className="space-y-2 text-xs">
              {/* Title proposal */}
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase text-muted-foreground font-medium">
                  Tên nhiệm vụ
                </span>
                <div className="text-xs font-semibold text-foreground leading-snug">
                  {suggestion.title}
                </div>
              </div>

              {/* Summary proposal */}
              {suggestion.summary && (
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase text-muted-foreground font-medium">
                    Tóm tắt
                  </span>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {suggestion.summary}
                  </div>
                </div>
              )}

              {/* Timeline & Metadata */}
              <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                <span>Hạn: {suggestion.targetDate}</span>
                <span>•</span>
                <span>{suggestion.milestones.length} mốc thực hiện</span>
              </div>

              {/* Suggested Personnel (if any) */}
              {suggestion.suggestedLeadName && (
                <div className="text-[11px] text-muted-foreground">
                  Chủ trì dự kiến: <strong className="text-foreground">{suggestion.suggestedLeadName}</strong>
                </div>
              )}

              {/* Milestones excerpt */}
              {suggestion.milestones.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Các mốc đầu việc dự kiến
                  </div>
                  <ul className="space-y-0.5">
                    {suggestion.milestones.map((m, idx) => (
                      <li
                        key={m.id}
                        className="text-[11px] text-muted-foreground flex items-start justify-between gap-2 py-0.5"
                      >
                        <span className="truncate">
                          {idx + 1}. {m.title}
                        </span>
                        {m.dueDate && (
                          <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                            {m.dueDate}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Overwrite Protection Option */}
            <div className="pt-1.5 border-t border-border/40 flex items-center gap-1.5">
              <input
                id="only-empty-fields"
                type="checkbox"
                checked={onlyEmptyFields}
                onChange={(e) => setOnlyEmptyFields(e.target.checked)}
                className="size-3.5 rounded border-border text-foreground focus:ring-primary cursor-pointer"
              />
              <label
                htmlFor="only-empty-fields"
                className="text-[11px] text-muted-foreground cursor-pointer select-none"
              >
                Chỉ điền các trường còn trống
              </label>
            </div>

            {/* Action Buttons: Apply / Discard */}
            <div className="pt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscard}
                className="flex-1 h-7 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent cursor-pointer"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleApply}
                className={cn(
                  "flex-1 h-7 text-xs font-medium rounded transition-colors cursor-pointer",
                  applied
                    ? "bg-emerald-600 text-white"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {applied ? "Đã áp dụng" : "Áp dụng vào mẫu"}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default LinearTaskAgentPanel;
