"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { useRouter } from "next/navigation";
import { FileText, Send, ArrowLeft, Loader2 } from "lucide-react";
import { fadeVariants } from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";

interface ComposeOutgoingDocumentFormProps {
  departments: { id: string; name: string; code: string }[];
  signers: { id: string; name: string; email: string }[];
  currentUser: { id: string; name: string; role: string };
}

const SECURITY_OPTIONS = [
  { value: "THUONG", label: "Thường" },
  { value: "MAT", label: "Mật" },
  { value: "TOI_MAT", label: "Tối mật" },
  { value: "TUYET_MAT", label: "Tuyệt mật" },
] as const;

const URGENCY_OPTIONS = [
  { value: "THUONG", label: "Thường" },
  { value: "KHAN", label: "Khẩn" },
  { value: "THUONG_KHAN", label: "Thượng khẩn" },
  { value: "HOA_TOC", label: "Hỏa tốc" },
] as const;

export function ComposeOutgoingDocumentForm({
  departments,
  signers,
  currentUser,
}: ComposeOutgoingDocumentFormProps) {
  const router = useRouter();

  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [securityLevel, setSecurityLevel] = React.useState("THUONG");
  const [urgency, setUrgency] = React.useState("THUONG");
  const [draftingDeptId, setDraftingDeptId] = React.useState("");
  const [authorizedSignerId, setAuthorizedSignerId] = React.useState("");
  const [recipientList, setRecipientList] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 3) {
      setError("Tiêu đề văn bản phải có ít nhất 3 ký tự.");
      return;
    }

    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        summary: summary.trim() || undefined,
        category: category.trim() || undefined,
        securityLevel,
        urgency,
        draftingDeptId: draftingDeptId || undefined,
        authorizedSignerId: authorizedSignerId || undefined,
        recipientList: recipientList.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/documents/outgoing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.error || "Không thể tạo bản nháp văn bản đi. Vui lòng thử lại."
        );
      }

      router.push("/documents/outgoing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const sectionClass = "rounded-lg border border-border bg-card p-4";
  const sectionTitleClass = "mb-3 text-compact font-semibold text-foreground";
  const textareaClass = "resize-none";

  return (
    <m.div
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-3xl px-4 py-5"
    >
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/documents")}>
          <ArrowLeft className="size-3.5" strokeWidth={1.5} />
          Quay lại
        </Button>
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" strokeWidth={1.5} />
          <h1 className="text-xl font-semibold text-foreground">Soạn văn bản đi mới</h1>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <m.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionTransition.enter}
          className="mb-3"
        >
          <InlineAlert variant="error">{error}</InlineAlert>
        </m.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Section: Thông tin chung */}
        <section className={sectionClass}>
          <h2 className={sectionTitleClass}>Thông tin chung</h2>
          <div className="space-y-3">
            <FormField label="Tiêu đề văn bản">
              <Input
                compact
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tiêu đề văn bản..."
                maxLength={255}
                required
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Trích yếu" optional>
              <Textarea
                compact
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Nội dung tóm tắt của văn bản..."
                maxLength={2000}
                rows={3}
                className={textareaClass}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Loại văn bản" optional>
              <Input
                compact
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="VD: Công văn, Quyết định, Tờ trình..."
                maxLength={100}
                disabled={isSubmitting}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Mức độ bảo mật">
                <Select
                  compact
                  options={[...SECURITY_OPTIONS]}
                  value={securityLevel}
                  onValueChange={(v) => setSecurityLevel(v ?? "THUONG")}
                  disabled={isSubmitting}
                />
              </FormField>
              <FormField label="Mức độ khẩn">
                <Select
                  compact
                  options={[...URGENCY_OPTIONS]}
                  value={urgency}
                  onValueChange={(v) => setUrgency(v ?? "THUONG")}
                  disabled={isSubmitting}
                />
              </FormField>
            </div>
          </div>
        </section>

        {/* Section: Đơn vị & Người ký */}
        <section className={sectionClass}>
          <h2 className={sectionTitleClass}>Đơn vị & Người ký</h2>
          <div className="space-y-3">
            <FormField label="Đơn vị soạn thảo" optional>
              <Select
                compact
                options={[
                  { value: "", label: "— Chọn đơn vị —" },
                  ...departments.map((dept) => ({ value: dept.id, label: `${dept.name} (${dept.code})` })),
                ]}
                value={draftingDeptId}
                onValueChange={(v) => setDraftingDeptId(v ?? "")}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Người ký" optional>
              <Select
                compact
                options={[
                  { value: "", label: "— Chọn người ký —" },
                  ...signers.map((signer) => ({ value: signer.id, label: `${signer.name} (${signer.email})` })),
                ]}
                value={authorizedSignerId}
                onValueChange={(v) => setAuthorizedSignerId(v ?? "")}
                disabled={isSubmitting}
              />
            </FormField>
          </div>
        </section>

        {/* Section: Nơi nhận & Ghi chú */}
        <section className={sectionClass}>
          <h2 className={sectionTitleClass}>Nơi nhận & Ghi chú</h2>
          <div className="space-y-3">
            <FormField label="Nơi nhận" optional>
              <Textarea
                compact
                value={recipientList}
                onChange={(e) => setRecipientList(e.target.value)}
                placeholder="Danh sách nơi nhận, cách nhau bằng dấu phẩy hoặc xuống dòng..."
                maxLength={1000}
                rows={2}
                className={textareaClass}
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Ghi chú" optional>
              <Textarea
                compact
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú bổ sung..."
                maxLength={2000}
                rows={2}
                className={textareaClass}
                disabled={isSubmitting}
              />
            </FormField>
          </div>
        </section>

        {/* Submit */}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isSubmitting || title.trim().length < 3}>
            {isSubmitting ? (
              <Loader2 className="animate-spin" strokeWidth={1.5} />
            ) : (
              <Send strokeWidth={1.5} />
            )}
            {isSubmitting ? "Đang tạo..." : "Tạo bản nháp"}
          </Button>
        </div>
      </form>
    </m.div>
  );
}
