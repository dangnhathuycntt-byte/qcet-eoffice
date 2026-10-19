"use client";

import * as React from "react";
import { Pencil, Settings2, Trash2 } from "lucide-react";
import {
  ASSISTANT_INSTRUCTIONS_MAX,
  ASSISTANT_MEMORIES_PER_USER,
  ASSISTANT_MEMORY_MAX,
  ASSISTANT_MESSAGE_MAX,
  ASSISTANT_SKILL_NAME_MAX,
  type AssistantMemoryDTO,
  type AssistantPreferencesDTO,
  type AssistantSkillDTO,
} from "@qcet/contracts/assistant";
import { Button } from "@/components/ui/button";
import { StandardDialog } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback-layer";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  addMemoryRequest,
  assistantErrorText,
  createSkillRequest,
  deleteMemoryRequest,
  deleteSkillRequest,
  getPreferencesRequest,
  listMemoriesRequest,
  updatePreferencesRequest,
  updateSkillRequest,
} from "@/components/assistant/assistant-client";
import { assistantSkillStore, useAssistantSkills } from "@/components/assistant/use-assistant-skills";

const SAVE_FAILED = "Chưa lưu được. Thầy/Cô thử lại.";
const LOAD_FAILED = "Chưa tải được cài đặt Trợ lý. Thầy/Cô thử lại sau.";

type SettingsTab = "general" | "memories" | "skills";

/** Nút mở Cài đặt Trợ lý (đầu trang Trợ lý, đầu khung nổi). */
export function AssistantSettingsButton({ className, size = "icon-md" }: { className?: string; size?: "icon-md" | "icon-sm" }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size={size} aria-label="Cài đặt Trợ lý" onClick={() => setOpen(true)} className={className}>
            <Settings2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" sideOffset={6}>
          Cài đặt Trợ lý
        </TooltipContent>
      </Tooltip>
      <AssistantSettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * Cài đặt Trợ lý (ADR-012), như Custom instructions và Memory của ChatGPT, Claude: hướng dẫn riêng (cách trả lời), bản
 * tin sáng vào Hộp thư, ghi nhớ (xem, thêm, xóa; Trợ lý chỉ thêm khi Thầy/Cô duyệt thẻ ghi nhớ) và kỹ năng gọi bằng "/".
 */
export function AssistantSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = React.useState<SettingsTab>("general");
  return (
    <StandardDialog open={open} onOpenChange={onOpenChange} title="Cài đặt Trợ lý" size="md" compact>
      {open ? (
        <Tabs value={tab} onValueChange={(next) => setTab(next as SettingsTab)} className="flex min-h-0 flex-col gap-4">
          <TabsList variant="pill" size="sm" aria-label="Phần cài đặt">
            <TabsTrigger value="general">Chung</TabsTrigger>
            <TabsTrigger value="memories">Ghi nhớ</TabsTrigger>
            <TabsTrigger value="skills">Kỹ năng</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <GeneralSettings />
          </TabsContent>
          <TabsContent value="memories">
            <MemorySettings />
          </TabsContent>
          <TabsContent value="skills">
            <SkillSettings />
          </TabsContent>
        </Tabs>
      ) : null}
    </StandardDialog>
  );
}

function SectionLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
      {children}
    </label>
  );
}

function GeneralSettings() {
  const { showToast } = useFeedback();
  const [prefs, setPrefs] = React.useState<AssistantPreferencesDTO | null>(null);
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const instructionsId = React.useId();
  const briefingId = React.useId();

  React.useEffect(() => {
    const controller = new AbortController();
    getPreferencesRequest(controller.signal)
      .then((result) => {
        setPrefs(result);
        setDraft(result.instructions);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(assistantErrorText(failure, LOAD_FAILED));
      });
    return () => controller.abort();
  }, []);

  const save = async (change: Partial<AssistantPreferencesDTO>) => {
    setSaving(true);
    try {
      const next = await updatePreferencesRequest(change);
      setPrefs(next);
      setDraft(next.instructions);
      showToast({ variant: "success", message: "Đã lưu cài đặt Trợ lý." });
    } catch (failure) {
      showToast({ variant: "error", message: assistantErrorText(failure, SAVE_FAILED) });
    } finally {
      setSaving(false);
    }
  };

  if (error) return <InlineAlert variant="error">{error}</InlineAlert>;
  if (!prefs) return <p className="text-xs text-muted-foreground">Đang tải…</p>;
  const changed = draft.trim() !== prefs.instructions;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <SectionLabel htmlFor={instructionsId}>Hướng dẫn riêng</SectionLabel>
        <p className="text-xs text-muted-foreground">
          Cách Thầy/Cô muốn Trợ lý trả lời, ví dụ độ dài, cách trình bày, đơn vị thường hỏi. Không thay được quy tắc an toàn.
        </p>
        <Textarea
          id={instructionsId}
          compact
          rows={4}
          value={draft}
          maxLength={ASSISTANT_INSTRUCTIONS_MAX}
          countOnlyNearLimit
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ví dụ: Trả lời ngắn, dùng bảng khi so sánh, ưu tiên việc của Phòng Đào tạo."
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={!changed || saving} onClick={() => void save({ instructions: draft.trim() })}>
            Lưu hướng dẫn
          </Button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <SectionLabel htmlFor={briefingId}>Bản tin sáng</SectionLabel>
          <p className="text-xs text-muted-foreground">
            7 giờ sáng mỗi ngày, Hộp thư nhận số việc cần xử lý, nhiệm vụ trễ hạn và cuộc họp hôm nay; bấm để hỏi Trợ lý chi tiết.
          </p>
        </div>
        <Switch
          id={briefingId}
          checked={prefs.briefingEnabled}
          disabled={saving}
          onChange={(event) => void save({ briefingEnabled: event.target.checked })}
        />
      </div>
    </div>
  );
}

function MemorySettings() {
  const { showToast } = useFeedback();
  const [memories, setMemories] = React.useState<AssistantMemoryDTO[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const inputId = React.useId();

  React.useEffect(() => {
    const controller = new AbortController();
    listMemoriesRequest(controller.signal)
      .then((result) => setMemories(result.memories))
      .catch((failure) => {
        if (!controller.signal.aborted) setError(assistantErrorText(failure, LOAD_FAILED));
      });
    return () => controller.abort();
  }, []);

  const add = async () => {
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const memory = await addMemoryRequest(content);
      setMemories((prev) => [...(prev ?? []).filter((item) => item.id !== memory.id), memory]);
      setDraft("");
    } catch (failure) {
      showToast({ variant: "error", message: assistantErrorText(failure, SAVE_FAILED) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const previous = memories;
    setMemories((prev) => (prev ?? []).filter((item) => item.id !== id));
    try {
      await deleteMemoryRequest(id);
    } catch (failure) {
      setMemories(previous);
      showToast({ variant: "error", message: assistantErrorText(failure, "Chưa xóa được ghi nhớ. Thầy/Cô thử lại.") });
    }
  };

  if (error) return <InlineAlert variant="error">{error}</InlineAlert>;
  if (!memories) return <p className="text-xs text-muted-foreground">Đang tải…</p>;
  const full = memories.length >= ASSISTANT_MEMORIES_PER_USER;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Trợ lý dùng các ghi nhớ này ở mọi cuộc trò chuyện. Trợ lý chỉ thêm ghi nhớ khi Thầy/Cô bấm duyệt thẻ ghi nhớ. Tối đa{" "}
        {ASSISTANT_MEMORIES_PER_USER} mục.
      </p>
      {memories.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa có ghi nhớ.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border">
          {memories.map((memory) => (
            <li key={memory.id} className="flex min-h-10 items-center gap-2 px-3 py-1.5">
              <span className="min-w-0 flex-1 break-words text-compact text-foreground">{memory.content}</span>
              {memory.source === "assistant" ? <span className="shrink-0 text-xs text-muted-foreground">Từ Trợ lý</span> : null}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Xóa ghi nhớ: ${memory.content}`}
                title="Xóa"
                onClick={() => void remove(memory.id)}
                className="shrink-0 text-muted-foreground max-md:size-11"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          Ghi nhớ mới
        </label>
        <Input
          id={inputId}
          compact
          value={draft}
          maxLength={ASSISTANT_MEMORY_MAX}
          disabled={full}
          placeholder={full ? "Đã đủ ghi nhớ, xóa bớt để thêm" : "Ví dụ: Phụ trách khảo thí của Khoa Cơ khí"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void add();
            }
          }}
        />
        <Button size="sm" className="shrink-0" disabled={!draft.trim() || busy || full} onClick={() => void add()}>
          Thêm
        </Button>
      </div>
    </div>
  );
}

function SkillSettings() {
  const { showToast } = useFeedback();
  const skills = useAssistantSkills(true);
  const [editing, setEditing] = React.useState<AssistantSkillDTO | "new" | null>(null);

  const remove = async (skill: AssistantSkillDTO) => {
    assistantSkillStore.remove(skill.id);
    try {
      await deleteSkillRequest(skill.id);
    } catch (failure) {
      assistantSkillStore.upsert(skill);
      showToast({ variant: "error", message: assistantErrorText(failure, "Chưa xóa được kỹ năng. Thầy/Cô thử lại.") });
    }
  };

  if (editing) {
    return (
      <SkillForm
        skill={editing === "new" ? null : editing}
        onDone={() => setEditing(null)}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Câu lệnh lưu sẵn cho việc hay làm. Gõ &quot;/&quot; ở đầu ô hỏi để chọn; chữ của kỹ năng được đưa vào ô để Thầy/Cô xem và sửa trước khi gửi.
      </p>
      {skills === null ? (
        <p className="text-xs text-muted-foreground">Đang tải…</p>
      ) : skills.length === 0 ? (
        <p className="text-xs text-muted-foreground">Chưa có kỹ năng.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border">
          {skills.map((skill) => (
            <li key={skill.id} className="flex min-h-12 items-center gap-2 px-3 py-1.5">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-compact font-medium text-foreground" title={skill.name}>
                  /{skill.name}
                </span>
                <span className="truncate text-xs text-muted-foreground" title={skill.prompt}>
                  {skill.prompt}
                </span>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`Sửa kỹ năng ${skill.name}`} title="Sửa" onClick={() => setEditing(skill)} className="shrink-0 text-muted-foreground max-md:size-11">
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Xóa kỹ năng ${skill.name}`} title="Xóa" onClick={() => void remove(skill)} className="shrink-0 text-muted-foreground max-md:size-11">
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          Thêm kỹ năng
        </Button>
      </div>
    </div>
  );
}

/** Thêm hoặc sửa một kỹ năng; dùng trong Cài đặt và hộp "Lưu thành kỹ năng". */
function SkillForm({ skill, initialPrompt = "", onDone }: { skill: AssistantSkillDTO | null; initialPrompt?: string; onDone: (saved: boolean) => void }) {
  const { showToast } = useFeedback();
  const [name, setName] = React.useState(skill?.name ?? "");
  const [prompt, setPrompt] = React.useState(skill?.prompt ?? initialPrompt);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const nameId = React.useId();
  const promptId = React.useId();
  const valid = name.trim().length > 0 && prompt.trim().length > 0;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const input = { name: name.trim(), prompt: prompt.trim() };
      const saved = skill ? await updateSkillRequest(skill.id, input) : await createSkillRequest(input);
      assistantSkillStore.upsert(saved);
      showToast({ variant: "success", message: skill ? "Đã lưu kỹ năng." : `Đã thêm kỹ năng /${saved.name}.` });
      onDone(true);
    } catch (failure) {
      setError(assistantErrorText(failure, SAVE_FAILED));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <SectionLabel htmlFor={nameId}>Tên kỹ năng</SectionLabel>
        <Input id={nameId} compact autoFocus value={name} maxLength={ASSISTANT_SKILL_NAME_MAX} placeholder="Ví dụ: Báo cáo tuần" onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <SectionLabel htmlFor={promptId}>Câu lệnh</SectionLabel>
        <Textarea
          id={promptId}
          compact
          rows={5}
          value={prompt}
          maxLength={ASSISTANT_MESSAGE_MAX}
          countOnlyNearLimit
          placeholder="Ví dụ: Tóm tắt nhiệm vụ trễ hạn của đơn vị tôi tuần này, nhóm theo người chủ trì."
          onChange={(event) => setPrompt(event.target.value)}
        />
      </div>
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => onDone(false)}>
          Hủy
        </Button>
        <Button size="sm" disabled={!valid || saving} onClick={() => void submit()}>
          {skill ? "Lưu" : "Thêm kỹ năng"}
        </Button>
      </div>
    </div>
  );
}

/** Hộp "Lưu thành kỹ năng" từ một câu hỏi đã gửi: câu hỏi điền sẵn làm câu lệnh, người dùng đặt tên. */
export function useSaveSkillDialog() {
  const [prompt, setPrompt] = React.useState<string | null>(null);
  const dialog = (
    <StandardDialog open={prompt !== null} onOpenChange={(open) => !open && setPrompt(null)} title="Lưu thành kỹ năng" size="sm" compact>
      {prompt !== null ? <SkillForm key={prompt} skill={null} initialPrompt={prompt} onDone={() => setPrompt(null)} /> : null}
    </StandardDialog>
  );
  return { openSaveSkill: (text: string) => setPrompt(text), saveSkillDialog: dialog };
}
