"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Link2, Pencil, Play, Plus, Trash2 } from "lucide-react";
import type { MeetingDetailPageData } from "@qcet/contracts/page-data";
import { formatDisplayDate, formatTime } from "@qcet/shared/lib/format/date";
import { cn } from "@/lib/utils";
import { MobileMenuButton } from "@/components/layout/mobile-menu-button";
import { Button } from "@/components/ui/button";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { FieldError } from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback-layer";
import { PropertyRow } from "@/components/ui/property-row";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { addParticipant, confirmMinutes, discardMinutes, draftMinutes, holdMeeting } from "@/components/meetings/meeting-client";
import { MeetingNotesPanel } from "@/components/meetings/meeting-notes-panel";
import { MeetingRecordingPanel } from "@/components/meetings/meeting-recording-panel";
import { ChairPicker, ParticipantsPicker, useMeetingPeople, type MeetingPerson } from "@/components/meetings/participants-picker";
import { MEETING_STATUS_TONE_CLASS, meetingStatus } from "@/components/meetings/meeting-status";
import { SectionCard } from "@/components/meetings/section-card";

type MeetingData = MeetingDetailPageData["meeting"];
type ParticipantData = MeetingData["participants"][number];

interface MeetingDetailViewProps {
  meeting: MeetingData;
  currentUser: { id: string; name: string; role: string };
}

const PARTICIPANT_ROLE_LABELS: Record<string, string> = {
  CHAIR: "Chủ tọa",
  SECRETARY: "Thư ký",
  ATTENDEE: "Thành viên",
  INVITED_GUEST: "Khách mời",
};

const PARTICIPANT_ROLE_ORDER = ["CHAIR", "SECRETARY", "ATTENDEE", "INVITED_GUEST"];

/** Điểm danh: chỉ vắng/từ chối mới có màu (`text-warning`), còn lại chữ mờ. */
const ATTENDANCE: Record<string, { label: string; warn?: boolean }> = {
  INVITED: { label: "Đã mời" },
  ACCEPTED: { label: "Đã nhận" },
  DECLINED: { label: "Từ chối", warn: true },
  ATTENDED: { label: "Có mặt" },
  ABSENT: { label: "Vắng mặt", warn: true },
};

/** Biên bản tối thiểu 10 ký tự như `DraftMinutesSchema` của máy chủ. */
const MINUTES_MIN_LENGTH = 10;

function meetingTime(startIso: string, endIso: string | null): string {
  const start = formatTime(startIso, "");
  const end = endIso ? formatTime(endIso, "") : "";
  return `${formatDisplayDate(startIso)} · ${end ? `${start} – ${end}` : start}`;
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

/**
 * Chi tiết cuộc họp (`/meetings/[id]`), theo khung chi tiết nhiệm vụ (người dùng yêu cầu "cải thiện trang chi tiết cuộc họp"
 * 20/10/2026, sau khi trang danh sách đã theo trang Nhiệm vụ): một thẻ cao hết màn hình, không breadcrumb chung
 * (`app-shell`); thanh đầu 40px có đường dẫn "Cuộc họp › tên", "Bắt đầu họp" (khi đã mời) và sao chép liên kết; cột chính
 * là tên 20px, nội dung và chương trình, rồi thẻ Ghi âm và thẻ Biên bản ("+ Thêm" để soạn, "Duyệt biên bản" cho chủ tọa,
 * "Sửa" và xóa khi còn dự thảo);
 * cột phải 340px là thẻ Thuộc tính (lưới nhãn–giá trị), Thành phần ("+ Thêm" mời người, "Chọn chủ tọa" khi chưa có), Ghi chú của tôi. Dưới 1024px cột phải xếp ngay dưới
 * tên. Phần Quyết nghị đã bỏ khỏi trang theo yêu cầu người dùng (20/10/2026); API quyết nghị vẫn còn. Quyền thao tác do
 * máy chủ kiểm lại; ở đây chỉ để ẩn nút không dùng được.
 */
export function MeetingDetailView({ meeting, currentUser }: MeetingDetailViewProps) {
  const router = useRouter();
  const feedback = useFeedback();
  const ids = React.useId();
  const [pending, setPending] = React.useState<"hold" | "draft" | "confirm" | "discard" | "chair" | null>(null);
  const [editingMinutes, setEditingMinutes] = React.useState(false);
  const [minutesText, setMinutesText] = React.useState("");
  const [minutesError, setMinutesError] = React.useState<string | null>(null);
  const [discardingMinutes, setDiscardingMinutes] = React.useState(false);
  const minutesRef = React.useRef<HTMLTextAreaElement>(null);

  const isOrganizer = currentUser.id === meeting.organizerId;
  // Theo quyền máy chủ tính, không đoán theo vai trò: bắt đầu họp là người tổ chức/chủ tọa, soạn biên bản là thư ký/chủ
  // tọa/người tổ chức, duyệt biên bản chỉ chủ tọa (thư ký soạn biên bản không tự duyệt)
  const can = (action: string) => meeting.availableActions.includes(action);
  const canHold = meeting.status === "INVITED" && can("meeting.update");
  const canDraftMinutes = meeting.status === "HELD" && can("meeting.draft_minutes");
  const canConfirmMinutes = meeting.status === "MINUTES_DRAFT" && can("meeting.confirm_minutes");
  // Dự thảo chưa duyệt thì người soạn biên bản sửa hoặc xóa (về Đã họp) được; đã duyệt thì khóa
  const canEditMinutes = meeting.status === "MINUTES_DRAFT" && can("meeting.draft_minutes");
  const editingSaved = editingMinutes && meeting.status === "MINUTES_DRAFT";
  const chairs = meeting.participants.filter((p) => p.role === "CHAIR");
  // Ghi âm theo quan hệ soạn biên bản của máy chủ (người tổ chức, chủ tọa, thư ký của cuộc họp), trong lúc họp và soạn biên bản
  const isMinutesAuthor =
    isOrganizer || meeting.participants.some((p) => p.userId === currentUser.id && (p.role === "CHAIR" || p.role === "SECRETARY"));
  const canRecord = isMinutesAuthor && ["INVITED", "HELD", "MINUTES_DRAFT"].includes(meeting.status);
  const isHeld = ["HELD", "MINUTES_DRAFT", "MINUTES_CONFIRMED"].includes(meeting.status);
  const status = meetingStatus(meeting.status);

  // Mời người: người tổ chức/chủ tọa (máy chủ tính), đến khi biên bản được duyệt hoặc cuộc họp bị hủy
  const canManageParticipants = can("meeting.manage_participants") && !["MINUTES_CONFIRMED", "CANCELLED"].includes(meeting.status);
  // Danh bạ chỉ tải khi mở menu lần đầu
  const [peopleWanted, setPeopleWanted] = React.useState(false);
  const directory = useMeetingPeople(peopleWanted);
  const [chairPickerOpen, setChairPickerOpen] = React.useState(false);
  // Người vừa chọn, hiện ngay như đã chọn trong lúc chờ máy chủ và tải lại trang
  const [inviting, setInviting] = React.useState<MeetingPerson[]>([]);
  const participantIds = React.useMemo(() => new Set(meeting.participants.map((p) => p.userId)), [meeting.participants]);
  const lockedIds = React.useMemo(() => new Set([...participantIds, ...inviting.map((p) => p.id)]), [participantIds, inviting]);
  const pickerValue = React.useMemo(
    () => [
      ...meeting.participants.map((p) => ({ id: p.userId, name: p.user.name ?? p.user.email, email: p.user.email, avatarUrl: p.user.avatarUrl })),
      ...inviting.filter((p) => !participantIds.has(p.id)),
    ],
    [meeting.participants, inviting, participantIds]
  );

  // Mở khung soạn thì đưa con trỏ vào và cuộn tới (cả khi đến từ "Dùng làm biên bản" của bản ghi âm)
  React.useEffect(() => {
    if (!editingMinutes) return;
    const el = minutesRef.current;
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [editingMinutes]);

  const startMinutes = React.useCallback((text = "") => {
    setMinutesText((current) => text || current);
    setMinutesError(null);
    setEditingMinutes(true);
  }, []);
  const useRecordingAsMinutes = React.useCallback((text: string) => startMinutes(text), [startMinutes]);
  const editMinutes = () => {
    setMinutesText(meeting.minutes ?? "");
    setMinutesError(null);
    setEditingMinutes(true);
  };
  const closeMinutesEditor = () => {
    setEditingMinutes(false);
    setMinutesText("");
    setMinutesError(null);
  };

  const run = async (kind: "hold" | "confirm" | "discard", action: () => Promise<void>, success: string) => {
    if (pending) return;
    setPending(kind);
    try {
      await action();
      feedback.notifySuccess(success);
      router.refresh();
    } catch (error) {
      feedback.notifyError(error instanceof Error ? error.message : "Chưa thực hiện được. Thầy/Cô thử lại.");
    } finally {
      setPending(null);
    }
  };

  const saveMinutes = async () => {
    if (pending) return;
    if (minutesText.trim().length < MINUTES_MIN_LENGTH) {
      setMinutesError(`Nhập nội dung biên bản (ít nhất ${MINUTES_MIN_LENGTH} ký tự).`);
      minutesRef.current?.focus();
      return;
    }
    setPending("draft");
    try {
      await draftMinutes(meeting.id, minutesText.trim());
      closeMinutesEditor();
      feedback.notifySuccess(editingSaved ? "Đã lưu biên bản." : "Đã lưu dự thảo biên bản.");
      router.refresh();
    } catch (error) {
      setMinutesError(error instanceof Error ? error.message : "Chưa lưu được biên bản.");
    } finally {
      setPending(null);
    }
  };

  // Mỗi người chọn được mời ngay (thành viên); menu vẫn mở để chọn tiếp. Người đã dự họp không bỏ được ở đây
  const invite = async (next: MeetingPerson[]) => {
    const fresh = next.filter((p) => !lockedIds.has(p.id));
    if (fresh.length === 0) return;
    setInviting((current) => [...current, ...fresh]);
    const results = await Promise.allSettled(fresh.map((p) => addParticipant(meeting.id, p.id, "ATTENDEE")));
    const failed = fresh.filter((_, index) => results[index].status === "rejected");
    if (failed.length > 0) {
      const reason = results.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason;
      setInviting((current) => current.filter((p) => !failed.some((f) => f.id === p.id)));
      feedback.notifyError(reason instanceof Error ? reason.message : "Chưa thêm được người dự họp.");
    }
    router.refresh();
  };

  const chooseChair = async (person: MeetingPerson) => {
    setChairPickerOpen(false);
    if (pending) return;
    setPending("chair");
    try {
      await addParticipant(meeting.id, person.id, "CHAIR");
      feedback.notifySuccess(`Đã chọn ${person.name} làm chủ tọa.`);
      router.refresh();
    } catch (error) {
      feedback.notifyError(error instanceof Error ? error.message : "Chưa chọn được chủ tọa.");
    } finally {
      setPending(null);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meetings/${encodeURIComponent(meeting.id)}`);
      feedback.notifySuccess("Đã sao chép liên kết");
    } catch {
      feedback.notifyError("Không sao chép được liên kết");
    }
  };

  const participantsByRole = PARTICIPANT_ROLE_ORDER.map((role) => [role, meeting.participants.filter((p) => p.role === role)] as const).filter(
    ([, group]) => group.length > 0
  );

  // Bắt đầu họp là thao tác của cả cuộc họp: ở thanh đầu, luôn thấy khi cuộn. Thao tác biên bản nằm ở thẻ Biên bản
  // (người dùng bỏ nút "Soạn biên bản" ở thanh đầu 20/10/2026, chọn nút "Thêm" ngay trong thẻ)
  const primaryAction = canHold ? (
    <Button variant="toolbar" size="sm" loading={pending === "hold"} onClick={() => void run("hold", () => holdMeeting(meeting.id), "Đã chuyển cuộc họp sang Đã họp.")}>
      <Play aria-hidden="true" />
      Bắt đầu họp
    </Button>
  ) : null;

  const inspector = (
    <div className="flex flex-col gap-2">
      <SectionCard title="Thuộc tính">
        <div className="text-xs">
          <PropertyRow label="Trạng thái" density="compact" labelClassName="w-24" valueClassName="justify-start">
            <span className={MEETING_STATUS_TONE_CLASS[status.tone]}>{status.label}</span>
          </PropertyRow>
          <PropertyRow label="Thời gian" density="compact" labelClassName="w-24" valueClassName="justify-start">
            <span className="tabular-nums">{meetingTime(meeting.startTime, meeting.endTime)}</span>
          </PropertyRow>
          <PropertyRow label="Địa điểm" density="compact" labelClassName="w-24" valueClassName="justify-start">
            <span className="break-words">{meeting.location || <Muted>Chưa có</Muted>}</span>
          </PropertyRow>
          <PropertyRow label="Đơn vị chủ trì" density="compact" labelClassName="w-24" valueClassName="justify-start">
            {/* Tên đơn vị không ghi tắt: xuống tối đa 2 dòng */}
            <span className="line-clamp-2">{meeting.unit?.name || <Muted>Chưa có</Muted>}</span>
          </PropertyRow>
          <PropertyRow label="Người tổ chức" density="compact" labelClassName="w-24" valueClassName="justify-start">
            {meeting.organizer ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <UserAvatar name={meeting.organizer.name ?? meeting.organizer.email} avatarUrl={meeting.organizer.avatarUrl} size="xs" />
                <span className="truncate">{meeting.organizer.name ?? meeting.organizer.email}</span>
              </span>
            ) : (
              <Muted>Chưa có</Muted>
            )}
          </PropertyRow>
          {meeting.minutesConfirmedAt ? (
            <PropertyRow label="Duyệt biên bản" density="compact" labelClassName="w-24" valueClassName="justify-start">
              <span className="tabular-nums">{formatDisplayDate(meeting.minutesConfirmedAt)}</span>
            </PropertyRow>
          ) : null}
          {meeting.code ? (
            <PropertyRow label="Mã" density="compact" labelClassName="w-24" valueClassName="justify-start">
              <span className="truncate text-xs tabular-nums text-muted-foreground">{meeting.code}</span>
            </PropertyRow>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Thành phần"
        count={meeting.participants.length}
        action={
          canManageParticipants ? (
            <ParticipantsPicker
              directory={directory}
              value={pickerValue}
              onChange={(next) => void invite(next)}
              lockedIds={lockedIds}
              align="end"
              onOpenChange={(open) => open && setPeopleWanted(true)}
              trigger={
                <Button variant="ghost" size="xs" aria-label="Thêm người dự họp">
                  <Plus aria-hidden="true" />
                  Thêm
                </Button>
              }
            />
          ) : null
        }
      >
        {/* Chưa có chủ tọa thì không ai duyệt được biên bản: người mời được chọn ngay ở đây */}
        {canManageParticipants && chairs.length === 0 ? (
          <div className="mb-2">
            <p className="mb-0.5 text-xs text-muted-foreground">Chủ tọa</p>
            <ChairPicker
              directory={directory}
              value={null}
              onChange={(person) => void chooseChair(person)}
              open={chairPickerOpen}
              onOpenChange={(open) => {
                setChairPickerOpen(open);
                if (open) setPeopleWanted(true);
              }}
              emptyLabel="Chọn chủ tọa"
            />
          </div>
        ) : null}
        {participantsByRole.length > 0 ? (
          <div className="flex flex-col gap-2">
            {participantsByRole.map(([role, group]) => (
              <div key={role}>
                <p className="mb-0.5 text-xs text-muted-foreground">{PARTICIPANT_ROLE_LABELS[role] ?? role}</p>
                <ul>
                  {group.map((p) => (
                    <ParticipantRow key={p.id} participant={p} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{canManageParticipants ? "Chưa có người dự họp. Bấm Thêm để mời." : "Chưa có người dự họp."}</p>
        )}
      </SectionCard>

      <SectionCard title="Ghi chú của tôi">
        <MeetingNotesPanel meetingId={meeting.id} />
      </SectionCard>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] p-2 max-md:p-0">
        <div
          data-slot="meeting-workspace"
          className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card max-md:rounded-none max-md:border-0"
        >
          <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border/40 px-[18px] max-md:h-[calc(44px+env(safe-area-inset-top,0px))] max-md:px-4 max-md:pt-[env(safe-area-inset-top,0px)]">
            <nav aria-label="Đường dẫn" className="flex min-w-0 items-center gap-1 text-xs">
              <MobileMenuButton className="-ml-1.5 mr-1 md:hidden" />
              <Link href="/meetings" className="shrink-0 rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline">
                Cuộc họp
              </Link>
              <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground/60" />
              <span aria-current="page" className="min-w-0 truncate font-medium text-foreground">
                {meeting.title}
              </span>
            </nav>
            <div className="flex shrink-0 items-center gap-1.5">
              {primaryAction}
              <Button variant="ghost" size="icon-md" onClick={() => void copyLink()} title="Sao chép liên kết" aria-label="Sao chép liên kết">
                <Link2 />
              </Button>
            </div>
          </header>

          <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
            {/* Màn rộng: lưới hai cột, cột phải trải hai hàng để tên và các thẻ cột chính không bị đẩy cách nhau.
                Màn hẹp: thứ tự DOM là tên, thuộc tính, các thẻ. */}
            <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-4 pb-16 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:pl-[clamp(24px,3vw,48px)] lg:pr-4 lg:pt-0">
              <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:pt-6">
                <h1 className="break-words text-xl font-semibold leading-snug tracking-tight text-foreground">{meeting.title}</h1>
                <h2 className="mt-4 text-xs font-medium text-muted-foreground">Nội dung và chương trình</h2>
                {meeting.agenda ? (
                  <p className="mt-1 whitespace-pre-wrap break-words text-compact leading-relaxed text-foreground">{meeting.agenda}</p>
                ) : (
                  <p className="mt-1 text-compact text-muted-foreground">Chưa có nội dung và chương trình.</p>
                )}
              </div>

              <aside aria-label="Thuộc tính cuộc họp" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-3">
                {inspector}
              </aside>

              <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-2">
                {/* Ghi âm và biên bản đề xuất bằng AI: chỉ người soạn biên bản của cuộc họp */}
                {canRecord && (
                  <MeetingRecordingPanel
                    meetingId={meeting.id}
                    onUseAsMinutes={canDraftMinutes ? useRecordingAsMinutes : undefined}
                    minutesHint={
                      meeting.status === "INVITED"
                        ? "Bấm Bắt đầu họp để dùng làm biên bản."
                        : meeting.status === "MINUTES_DRAFT"
                          ? canEditMinutes
                            ? "Biên bản đã được soạn; sao chép phần cần dùng rồi bấm Sửa ở thẻ Biên bản."
                            : "Biên bản đã được soạn; Thầy/Cô sao chép phần cần dùng."
                          : undefined
                    }
                  />
                )}

                {isHeld && (
                  <SectionCard
                    title="Biên bản"
                    action={
                      editingMinutes ? null : canDraftMinutes && !meeting.minutes ? (
                        <Button variant="ghost" size="xs" aria-label="Thêm biên bản" onClick={() => startMinutes()}>
                          <Plus aria-hidden="true" />
                          Thêm
                        </Button>
                      ) : meeting.status === "MINUTES_DRAFT" ? (
                        <>
                          {canConfirmMinutes ? (
                            <Button
                              variant="ghost"
                              size="xs"
                              loading={pending === "confirm"}
                              onClick={() => void run("confirm", () => confirmMinutes(meeting.id), "Đã duyệt biên bản.")}
                            >
                              Duyệt biên bản
                            </Button>
                          ) : (
                            <span
                              className={cn("max-w-64 truncate text-xs", chairs.length > 0 ? "text-muted-foreground" : "text-warning")}
                              title="Chỉ chủ tọa duyệt được biên bản; thư ký soạn biên bản không tự duyệt."
                            >
                              {chairs.length > 0
                                ? `Chờ chủ tọa ${chairs.map((p) => p.user.name ?? p.user.email).join(", ")} duyệt`
                                : "Chưa có chủ tọa để duyệt"}
                            </span>
                          )}
                          {canEditMinutes && (
                            <>
                              <Button variant="ghost" size="xs" onClick={editMinutes}>
                                <Pencil aria-hidden="true" />
                                Sửa
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Xóa biên bản"
                                title="Xóa biên bản"
                                onClick={() => setDiscardingMinutes(true)}
                              >
                                <Trash2 />
                              </Button>
                            </>
                          )}
                        </>
                      ) : meeting.status === "MINUTES_CONFIRMED" ? (
                        <span className="text-xs text-muted-foreground">Đã duyệt</span>
                      ) : null
                    }
                  >
                    {editingMinutes ? (
                      <form
                        noValidate
                        className="flex flex-col gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveMinutes();
                        }}
                      >
                        <Textarea
                          ref={minutesRef}
                          id="meeting-minutes-input"
                          compact
                          value={minutesText}
                          aria-label="Nội dung biên bản"
                          placeholder="Nhập nội dung biên bản, hoặc bấm Dùng làm biên bản ở một bản ghi âm…"
                          // `sm:` vì Textarea compact đặt `sm:min-h-7`; biên bản từ bản ghi âm dài thì ô cao hơn
                          className={minutesText.length > 400 ? "min-h-80 sm:min-h-80" : "min-h-32 sm:min-h-32"}
                          aria-invalid={minutesError ? true : undefined}
                          aria-describedby={minutesError ? `${ids}-minutes-error` : undefined}
                          onChange={(event) => {
                            setMinutesText(event.target.value);
                            setMinutesError(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
                              event.preventDefault();
                              void saveMinutes();
                            }
                            // Esc chỉ đóng khi chưa gõ gì (hoặc chưa đổi gì so với biên bản đang sửa), không mất chữ vừa nhập
                            if (event.key === "Escape" && (!minutesText.trim() || (editingSaved && minutesText === meeting.minutes))) {
                              closeMinutesEditor();
                            }
                          }}
                        />
                        {minutesError ? <FieldError id={`${ids}-minutes-error`}>{minutesError}</FieldError> : null}
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={closeMinutesEditor}>
                            Hủy
                          </Button>
                          <Button type="submit" size="sm" loading={pending === "draft"}>
                            Lưu biên bản
                          </Button>
                        </div>
                      </form>
                    ) : meeting.minutes ? (
                      <p className="whitespace-pre-wrap break-words text-compact leading-relaxed text-foreground">{meeting.minutes}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {canDraftMinutes ? "Chưa có biên bản. Bấm Thêm để soạn, hoặc dùng kết quả của một bản ghi âm." : "Chưa có biên bản."}
                      </p>
                    )}
                  </SectionCard>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>

      <DestructiveConfirmDialog
        isOpen={discardingMinutes}
        onClose={() => pending !== "discard" && setDiscardingMinutes(false)}
        onConfirm={async () => {
          await run("discard", () => discardMinutes(meeting.id), "Đã xóa biên bản.");
          setDiscardingMinutes(false);
        }}
        isConfirming={pending === "discard"}
        title="Xóa biên bản?"
        description="Dự thảo biên bản bị xóa, cuộc họp về Đã họp để soạn lại. Bản ghi âm và biên bản đề xuất vẫn giữ."
        confirmLabel="Xóa biên bản"
      />
    </div>
  );
}

function ParticipantRow({ participant }: { participant: ParticipantData }) {
  const name = participant.user.name ?? participant.user.email;
  const attendance = ATTENDANCE[participant.attendanceStatus] ?? { label: participant.attendanceStatus };
  return (
    <li className="flex h-7 items-center gap-1.5 text-xs">
      <UserAvatar name={name} avatarUrl={participant.user.avatarUrl} size="xs" />
      <span className="min-w-0 flex-1 truncate text-foreground" title={name}>
        {name}
      </span>
      <span className={cn("shrink-0 text-xs", attendance.warn ? "text-warning" : "text-muted-foreground")}>{attendance.label}</span>
    </li>
  );
}
