"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { useRouter } from "next/navigation";
import { FileText, Send, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { fadeVariants } from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

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

const labelClass = "block text-sm font-medium text-[oklch(0.205_0.015_250)] mb-1.5";
const inputClass = cn(
  "w-full rounded-lg border border-[oklch(0.915_0.006_250)] bg-white px-3 py-2 text-sm",
  "text-[oklch(0.145_0.015_250)] placeholder:text-[oklch(0.38_0.015_250)]",
  "outline-none transition-colors",
  "focus:border-[oklch(0.45_0.12_250)] focus:ring-1 focus:ring-[oklch(0.45_0.12_250)]",
  "disabled:cursor-not-allowed disabled:opacity-50"
);
const selectClass = cn(inputClass, "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8");

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

  return (
    <m.div
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-3xl px-4 py-6"
    >
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/documents")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm",
            "text-[oklch(0.38_0.015_250)] transition-colors",
            "hover:bg-[oklch(0.965_0.005_250)] hover:text-[oklch(0.205_0.015_250)]",
            "active:scale-[0.98]"
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </button>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-[oklch(0.38_0.015_250)]" />
          <h1 className="text-lg font-semibold text-[oklch(0.145_0.015_250)]">
            Soạn văn bản đi mới
          </h1>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <m.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionTransition.enter}
          className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </m.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section: Thông tin chung */}
        <section className="rounded-xl border border-[oklch(0.915_0.006_250)] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[oklch(0.205_0.015_250)]">
            Thông tin chung
          </h2>
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className={labelClass}>
                Tiêu đề văn bản <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tiêu đề văn bản..."
                maxLength={255}
                required
                className={inputClass}
                disabled={isSubmitting}
              />
            </div>

            {/* Summary */}
            <div>
              <label htmlFor="summary" className={labelClass}>
                Trích yếu
              </label>
              <textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Nội dung tóm tắt của văn bản..."
                maxLength={2000}
                rows={3}
                className={cn(inputClass, "resize-none")}
                disabled={isSubmitting}
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className={labelClass}>
                Loại văn bản
              </label>
              <input
                id="category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="VD: Công văn, Quyết định, Tờ trình..."
                maxLength={100}
                className={inputClass}
                disabled={isSubmitting}
              />
            </div>

            {/* Security & Urgency row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="securityLevel" className={labelClass}>
                  Mức độ bảo mật
                </label>
                <select
                  id="securityLevel"
                  value={securityLevel}
                  onChange={(e) => setSecurityLevel(e.target.value)}
                  className={selectClass}
                  disabled={isSubmitting}
                >
                  {SECURITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="urgency" className={labelClass}>
                  Mức độ khẩn
                </label>
                <select
                  id="urgency"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  className={selectClass}
                  disabled={isSubmitting}
                >
                  {URGENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Đơn vị & Người ký */}
        <section className="rounded-xl border border-[oklch(0.915_0.006_250)] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[oklch(0.205_0.015_250)]">
            Đơn vị & Người ký
          </h2>
          <div className="space-y-4">
            {/* Drafting dept */}
            <div>
              <label htmlFor="draftingDeptId" className={labelClass}>
                Đơn vị soạn thảo
              </label>
              <select
                id="draftingDeptId"
                value={draftingDeptId}
                onChange={(e) => setDraftingDeptId(e.target.value)}
                className={selectClass}
                disabled={isSubmitting}
              >
                <option value="">— Chọn đơn vị —</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} ({dept.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Authorized signer */}
            <div>
              <label htmlFor="authorizedSignerId" className={labelClass}>
                Người ký
              </label>
              <select
                id="authorizedSignerId"
                value={authorizedSignerId}
                onChange={(e) => setAuthorizedSignerId(e.target.value)}
                className={selectClass}
                disabled={isSubmitting}
              >
                <option value="">— Chọn người ký —</option>
                {signers.map((signer) => (
                  <option key={signer.id} value={signer.id}>
                    {signer.name} ({signer.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Section: Nơi nhận & Ghi chú */}
        <section className="rounded-xl border border-[oklch(0.915_0.006_250)] bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[oklch(0.205_0.015_250)]">
            Nơi nhận & Ghi chú
          </h2>
          <div className="space-y-4">
            {/* Recipient list */}
            <div>
              <label htmlFor="recipientList" className={labelClass}>
                Nơi nhận
              </label>
              <textarea
                id="recipientList"
                value={recipientList}
                onChange={(e) => setRecipientList(e.target.value)}
                placeholder="Danh sách nơi nhận, cách nhau bằng dấu phẩy hoặc xuống dòng..."
                maxLength={1000}
                rows={2}
                className={cn(inputClass, "resize-none")}
                disabled={isSubmitting}
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className={labelClass}>
                Ghi chú
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú bổ sung..."
                maxLength={2000}
                rows={2}
                className={cn(inputClass, "resize-none")}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || title.trim().length < 3}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium",
              "bg-[oklch(0.42_0.18_250)] text-white shadow-sm",
              "transition-all",
              "hover:bg-[oklch(0.38_0.18_250)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.45_0.12_250)] focus-visible:ring-offset-2",
              "active:scale-[0.98]",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSubmitting ? "Đang tạo..." : "Tạo bản nháp"}
          </button>
        </div>
      </form>
    </m.div>
  );
}
