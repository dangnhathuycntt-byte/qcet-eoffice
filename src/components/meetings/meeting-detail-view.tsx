"use client";

import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  User,
  Building2,
  Hash,
  Loader2,
  Play,
  FileEdit,
  Plus,
  ListChecks,
  X,
} from "lucide-react";
import * as m from "motion/react-m";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";

import { fadeVariants } from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { useDepartmentList } from "@/hooks/use-department-list";
import { usePersonnelList } from "@/hooks/use-personnel-list";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ParticipantData {
  id: string;
  meetingId: string;
  userId: string;
  role: string;
  attendanceStatus: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  user: { name: string | null; email: string };
}

interface ResolutionData {
  id: string;
  meetingId: string;
  code: string | null;
  title: string;
  content: string;
  leadUnitId: string | null;
  leadUserId: string | null;
  deadline: string | null;
  resultingTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  leadUnit: { name: string } | null;
  leadUser: { name: string | null } | null;
}

interface MeetingData {
  id: string;
  title: string;
  code: string | null;
  bodyId: string | null;
  unitId: string | null;
  organizerId: string;
  status: string;
  startTime: string;
  endTime: string | null;
  location: string | null;
  agenda: string | null;
  minutes: string | null;
  materialsUrl: string | null;
  materialsFileObjectId: string | null;
  minutesConfirmedAt: string | null;
  minutesConfirmedById: string | null;
  createdAt: string;
  updatedAt: string;
  unit: { name: string; code: string } | null;
  organizer: { name: string | null; email: string } | null;
  participants: ParticipantData[];
  resolutions: ResolutionData[];
}

interface MeetingDetailViewProps {
  meeting: MeetingData;
  currentUser: { id: string; name: string; role: string };
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT_AGENDA: { label: "Dự thảo chương trình", className: "bg-muted text-muted-foreground border-border/50" },
  INVITED: { label: "Đã mời", className: "bg-sky-50 text-sky-700 border-sky-200" },
  HELD: { label: "Đã họp", className: "bg-amber-50 text-amber-700 border-amber-200" },
  MINUTES_DRAFT: { label: "Dự thảo biên bản", className: "bg-orange-50 text-orange-700 border-orange-200" },
  MINUTES_CONFIRMED: { label: "Biên bản đã duyệt", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Đã hủy", className: "bg-red-50 text-red-700 border-red-200" },
};

const PARTICIPANT_ROLE_LABELS: Record<string, string> = {
  CHAIR: "Chủ tọa",
  SECRETARY: "Thư ký",
  ATTENDEE: "Thành viên",
  INVITED_GUEST: "Khách mời",
};

const PARTICIPANT_ROLE_ORDER = ["CHAIR", "SECRETARY", "ATTENDEE", "INVITED_GUEST"];

const ATTENDANCE_CONFIG: Record<string, { label: string; className: string }> = {
  INVITED: { label: "Đã mời", className: "bg-muted text-muted-foreground" },
  ACCEPTED: { label: "Đã nhận", className: "bg-sky-50 text-sky-700" },
  DECLINED: { label: "Từ chối", className: "bg-red-50 text-red-700" },
  ATTENDED: { label: "Có mặt", className: "bg-emerald-50 text-emerald-700" },
  ABSENT: { label: "Vắng mặt", className: "bg-amber-50 text-amber-700" },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border/50" };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", cfg.className)}>
      {cfg.label}
    </span>
  );
}

function AttendanceBadge({ status }: { status: string }) {
  const cfg = ATTENDANCE_CONFIG[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cfg.className)}>
      {cfg.label}
    </span>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">
          {value ?? <span className="italic text-muted-foreground/60">—</span>}
        </p>
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatDatetime(startIso: string, endIso: string | null): string {
  const date = formatDate(startIso);
  const startTime = formatTime(startIso);
  if (!endIso) return `${date}, ${startTime}`;
  const endTime = formatTime(endIso);
  return `${date}, ${startTime} – ${endTime}`;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function MeetingDetailView({ meeting, currentUser }: MeetingDetailViewProps) {
  const router = useRouter();
  const [holdLoading, setHoldLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [showMinutesInput, setShowMinutesInput] = useState(false);
  const [minutesText, setMinutesText] = useState("");

  /* Resolution creation form state */
  const [showResolutionForm, setShowResolutionForm] = useState(false);
  const [resolutionLoading, setResolutionLoading] = useState(false);
  const [resTitle, setResTitle] = useState("");
  const [resContent, setResContent] = useState("");
  const [resCode, setResCode] = useState("");
  const [resLeadUnitId, setResLeadUnitId] = useState("");
  const [resLeadUserId, setResLeadUserId] = useState("");
  const [resDeadline, setResDeadline] = useState("");
  const [resCreateTask, setResCreateTask] = useState(false);
  const [resTaskTitle, setResTaskTitle] = useState("");
  const [resError, setResError] = useState<string | null>(null);

  const isOrganizer = currentUser.id === meeting.organizerId;
  const isLeader = ["BAN_GIAM_HIEU", "TRUONG_PHONG", "ADMIN"].includes(currentUser.role);

  const canHold = meeting.status === "INVITED" && (isLeader || isOrganizer);
  const canDraftMinutes = meeting.status === "HELD" && (isLeader || isOrganizer);
  const canConfirmMinutes = meeting.status === "MINUTES_DRAFT" && isLeader;
  const canAddResolution =
    ["HELD", "MINUTES_DRAFT", "MINUTES_CONFIRMED"].includes(meeting.status) &&
    (isLeader || isOrganizer);
  const showActions = canHold || canDraftMinutes || canConfirmMinutes || canAddResolution;

  /* Fetch units/personnel only when resolution form is open */
  const { departments } = useDepartmentList({ enabled: showResolutionForm });
  const { personnel } = usePersonnelList({ enabled: showResolutionForm });

  const resetResolutionForm = useCallback(() => {
    setResTitle("");
    setResContent("");
    setResCode("");
    setResLeadUnitId("");
    setResLeadUserId("");
    setResDeadline("");
    setResCreateTask(false);
    setResTaskTitle("");
    setResError(null);
  }, []);

  const handleCreateResolution = useCallback(async () => {
    if (!resTitle.trim() || !resContent.trim()) return;
    setResolutionLoading(true);
    setResError(null);
    try {
      const body: Record<string, unknown> = {
        title: resTitle.trim(),
        content: resContent.trim(),
        createTask: resCreateTask,
      };
      if (resCode.trim()) body.code = resCode.trim();
      if (resLeadUnitId) body.leadUnitId = resLeadUnitId;
      if (resLeadUserId) body.leadUserId = resLeadUserId;
      if (resDeadline) body.deadline = new Date(resDeadline).toISOString();
      if (resCreateTask && resTaskTitle.trim()) body.taskTitle = resTaskTitle.trim();

      const res = await fetch(`/api/meetings/${meeting.id}/resolutions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowResolutionForm(false);
        resetResolutionForm();
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setResError(data?.error?.message || `Lỗi ${res.status}`);
      }
    } catch {
      setResError("Không thể kết nối máy chủ");
    } finally {
      setResolutionLoading(false);
    }
  }, [
    resTitle, resContent, resCode, resLeadUnitId, resLeadUserId,
    resDeadline, resCreateTask, resTaskTitle, meeting.id, router, resetResolutionForm,
  ]);

  const showMinutes =
    meeting.status === "MINUTES_DRAFT" || meeting.status === "MINUTES_CONFIRMED";

  /* Group participants by role */
  const participantsByRole = PARTICIPANT_ROLE_ORDER.reduce<
    Record<string, ParticipantData[]>
  >((acc, role) => {
    const group = meeting.participants.filter((p) => p.role === role);
    if (group.length > 0) acc[role] = group;
    return acc;
  }, {});

  return (
    <m.div
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={motionTransition}
      className="mx-auto max-w-5xl space-y-6 p-4 md:p-6"
    >
      {/* Back + header */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Quay lại"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            {meeting.code && (
              <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                {meeting.code}
              </span>
            )}
            <StatusBadge status={meeting.status} />
          </div>
          <h1 className="text-lg font-semibold text-foreground">{meeting.title}</h1>
        </div>
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="rounded-xl border border-border/50 bg-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {canHold && (
              <button
                type="button"
                disabled={holdLoading}
                onClick={async () => {
                  setHoldLoading(true);
                  try {
                    const res = await fetch(`/api/meetings/${meeting.id}/actions/hold`, {
                      method: "POST",
                      credentials: "include",
                    });
                    if (res.ok) router.refresh();
                  } finally {
                    setHoldLoading(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {holdLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Play className="h-4 w-4" strokeWidth={1.5} />
                )}
                Bắt đầu họp
              </button>
            )}

            {canDraftMinutes && !showMinutesInput && (
              <button
                type="button"
                onClick={() => setShowMinutesInput(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <FileEdit className="h-4 w-4" strokeWidth={1.5} />
                Soạn biên bản
              </button>
            )}

            {canConfirmMinutes && (
              <button
                type="button"
                disabled={confirmLoading}
                onClick={async () => {
                  setConfirmLoading(true);
                  try {
                    const res = await fetch(`/api/meetings/${meeting.id}/actions/confirm-minutes`, {
                      method: "POST",
                      credentials: "include",
                    });
                    if (res.ok) router.refresh();
                  } finally {
                    setConfirmLoading(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {confirmLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                )}
                Duyệt biên bản
              </button>
            )}

            {canAddResolution && !showResolutionForm && (
              <button
                type="button"
                onClick={() => setShowResolutionForm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Thêm quyết nghị
              </button>
            )}
          </div>

          {/* Inline minutes textarea */}
          {showMinutesInput && (
            <div className="mt-3 space-y-2">
              <textarea
                value={minutesText}
                onChange={(e) => setMinutesText(e.target.value)}
                placeholder="Nhập nội dung biên bản..."
                rows={5}
                className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={draftLoading || !minutesText.trim()}
                  onClick={async () => {
                    setDraftLoading(true);
                    try {
                      const res = await fetch(`/api/meetings/${meeting.id}/actions/draft-minutes`, {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ minutes: minutesText.trim() }),
                      });
                      if (res.ok) {
                        setShowMinutesInput(false);
                        setMinutesText("");
                        router.refresh();
                      }
                    } finally {
                      setDraftLoading(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {draftLoading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
                  Lưu biên bản
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMinutesInput(false);
                    setMinutesText("");
                  }}
                  className="inline-flex items-center rounded-lg border border-border px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}

          {/* Inline resolution creation form */}
          {showResolutionForm && (
            <div className="mt-3 space-y-3 rounded-lg border border-border/30 bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ListChecks className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  Thêm quyết nghị / kết luận
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowResolutionForm(false);
                    resetResolutionForm();
                  }}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              {resError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  {resError}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Tiêu đề <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={resTitle}
                    onChange={(e) => setResTitle(e.target.value)}
                    placeholder="Tiêu đề quyết nghị..."
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Nội dung <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={resContent}
                    onChange={(e) => setResContent(e.target.value)}
                    placeholder="Nội dung quyết nghị / chỉ đạo..."
                    rows={3}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Mã quyết nghị
                  </label>
                  <input
                    type="text"
                    value={resCode}
                    onChange={(e) => setResCode(e.target.value)}
                    placeholder="VD: KL-01"
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Hạn hoàn thành
                  </label>
                  <input
                    type="date"
                    value={resDeadline}
                    onChange={(e) => setResDeadline(e.target.value)}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Đơn vị phụ trách
                  </label>
                  <select
                    value={resLeadUnitId}
                    onChange={(e) => setResLeadUnitId(e.target.value)}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">— Chọn đơn vị —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Người phụ trách
                  </label>
                  <select
                    value={resLeadUserId}
                    onChange={(e) => setResLeadUserId(e.target.value)}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">— Chọn người —</option>
                    {personnel.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.departmentName ? ` (${p.departmentName})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Create task toggle */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={resCreateTask}
                    onChange={(e) => setResCreateTask(e.target.checked)}
                    className="h-4 w-4 rounded border-border/50 text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  Tạo nhiệm vụ từ quyết nghị
                </label>
                {resCreateTask && (
                  <input
                    type="text"
                    value={resTaskTitle}
                    onChange={(e) => setResTaskTitle(e.target.value)}
                    placeholder="Tiêu đề nhiệm vụ (để trống sẽ dùng tiêu đề quyết nghị)"
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                )}
              </div>

              {/* Submit / Cancel */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={resolutionLoading || !resTitle.trim() || !resContent.trim()}
                  onClick={handleCreateResolution}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {resolutionLoading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
                  Ban hành
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResolutionForm(false);
                    resetResolutionForm();
                  }}
                  className="inline-flex items-center rounded-lg border border-border px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Main content — spans 2 cols */}
        <div className="space-y-4 md:col-span-2">
          {/* Meeting info */}
          <SectionCard title="Thông tin cuộc họp" icon={Calendar}>
            <div className="space-y-1">
              <MetaRow
                icon={Clock}
                label="Thời gian"
                value={formatDatetime(meeting.startTime, meeting.endTime)}
              />
              <MetaRow
                icon={MapPin}
                label="Địa điểm"
                value={meeting.location}
              />
              <MetaRow
                icon={Building2}
                label="Đơn vị chủ trì"
                value={meeting.unit?.name}
              />
              <MetaRow
                icon={User}
                label="Người tổ chức"
                value={meeting.organizer?.name ?? meeting.organizer?.email}
              />
            </div>
          </SectionCard>

          {/* Agenda */}
          <SectionCard title="Nội dung / Chương trình" icon={FileText}>
            {meeting.agenda ? (
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {meeting.agenda}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground/60">
                Chưa có nội dung
              </p>
            )}
          </SectionCard>

          {/* Minutes — only shown for MINUTES_DRAFT / MINUTES_CONFIRMED */}
          {showMinutes && (
            <SectionCard title="Biên bản" icon={FileText}>
              {meeting.minutes ? (
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {meeting.minutes}
                </p>
              ) : (
                <p className="text-sm italic text-muted-foreground/60">
                  Chưa có biên bản
                </p>
              )}
            </SectionCard>
          )}

          {/* Resolutions */}
          <SectionCard title="Nghị quyết" icon={CheckCircle2}>
            {meeting.resolutions.length > 0 ? (
              <div className="divide-y divide-border/30">
                {meeting.resolutions.map((res) => (
                  <div key={res.id} className="py-2.5">
                    <div className="flex items-start gap-3">
                      <Hash className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                      <div className="min-w-0 flex-1">
                        {res.code && (
                          <div className="mb-0.5 flex items-center gap-2">
                            <span className="rounded bg-muted/60 px-1 py-0.5 font-mono text-xs text-muted-foreground">
                              {res.code}
                            </span>
                          </div>
                        )}
                        <p className="text-sm font-medium text-foreground">{res.title}</p>
                        {res.content && (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                            {res.content}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {res.deadline && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" strokeWidth={1.5} />
                              Hạn: {formatDate(res.deadline)}
                            </span>
                          )}
                          {res.leadUnit && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" strokeWidth={1.5} />
                              {res.leadUnit.name}
                            </span>
                          )}
                          {res.leadUser?.name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" strokeWidth={1.5} />
                              {res.leadUser.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground/60">
                Chưa có nghị quyết
              </p>
            )}
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SectionCard title="Thành phần tham dự" icon={Users}>
            {meeting.participants.length > 0 ? (
              <div className="space-y-4">
                {PARTICIPANT_ROLE_ORDER.map((role) => {
                  const group = participantsByRole[role];
                  if (!group) return null;
                  return (
                    <div key={role}>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                        {PARTICIPANT_ROLE_LABELS[role] ?? role}
                      </p>
                      <div className="space-y-2">
                        {group.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                              <span className="truncate text-sm text-foreground">
                                {p.user.name ?? p.user.email}
                              </span>
                            </div>
                            <AttendanceBadge status={p.attendanceStatus} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground/60">
                Chưa có thành viên
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </m.div>
  );
}
