import type { DocumentStatus, DocumentUrgency } from "@/types/document";

const VN_TZ = "Asia/Ho_Chi_Minh";

/** Ngày hiện tại theo múi giờ Việt Nam, dạng YYYY-MM-DD. */
export function todayInVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: VN_TZ }).format(now);
}

/** "2026-09-25" → "25/09/2026"; chuỗi rỗng khi không hợp lệ. */
export function formatLedgerDate(value?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * Ngày trong ô bảng: luôn có năm ("25/09/2026"). Chỉ rút gọn "25/09" khi danh sách đang lọc đúng năm đó,
 * để năm vẫn rõ từ bộ lọc đang hiển thị.
 */
export function formatLedgerCellDate(value?: string | null, filterYear?: number): string {
  const full = formatLedgerDate(value);
  return full && filterYear && full.endsWith(`/${filterYear}`) ? full.slice(0, 5) : full;
}

function dayNumber(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}

export type LedgerDueTone = "danger" | "warning" | "muted";

/** Ghi chú hạn xử lý: "Còn 1 ngày", "Hôm nay", "Trễ hạn 3 ngày". */
export function getLedgerDueNote(
  dueDate: string | undefined,
  isDone: boolean,
  today: string = todayInVietnam()
): { text: string; tone: LedgerDueTone } | null {
  if (!dueDate || isDone) return null;
  const diff = dayNumber(dueDate) - dayNumber(today);
  if (Number.isNaN(diff)) return null;
  if (diff < 0) return { text: `Trễ hạn ${-diff} ngày`, tone: "danger" };
  if (diff === 0) return { text: "Hôm nay", tone: "warning" };
  return { text: `Còn ${diff} ngày`, tone: diff <= 2 ? "warning" : "muted" };
}

export function getLedgerUrgencyTag(
  urgency: DocumentUrgency
): { label: string; tone: "danger" | "warning" } | null {
  switch (urgency) {
    case "flash":
    case "HOA_TOC":
      return { label: "HỎA TỐC", tone: "danger" };
    case "top_urgent":
    case "THUONG_KHAN":
      return { label: "THƯỢNG KHẨN", tone: "danger" };
    case "urgent":
    case "KHAN":
      return { label: "KHẨN", tone: "warning" };
    default:
      return null;
  }
}

export function isLedgerDone(status: DocumentStatus): boolean {
  return status === "completed" || status === "DA_HOAN_THANH" || status === "LUU_THEO_DOI";
}

type StepTone = "warning" | "default" | "muted";
export type LedgerStepKind = "new" | "progress" | "review" | "done";
type Step = { label: string; tone: StepTone; kind: LedgerStepKind };

// Bản đồ hệ thống · Quy trình 6 (Văn bản đến) và Quy trình 7 (Văn bản đi).
const INCOMING_STEPS: Record<string, Step> = {
  RECEIVED: { label: "Mới nhận", tone: "default", kind: "new" },
  REGISTERED: { label: "Đã đăng ký", tone: "default", kind: "new" },
  PRESENTED: { label: "Chờ bút phê", tone: "warning", kind: "review" },
  DIRECTED: { label: "Đã chuyển", tone: "default", kind: "progress" },
  ASSIGNED_TO_LEAD_UNIT: { label: "Đã chuyển", tone: "default", kind: "progress" },
  UNIT_ASSIGNED_PERSON: { label: "Đang xử lý", tone: "default", kind: "progress" },
  IN_PROGRESS: { label: "Đang xử lý", tone: "default", kind: "progress" },
  RESOLVED: { label: "Hoàn thành", tone: "muted", kind: "done" },
  FILED: { label: "Đã lập hồ sơ", tone: "muted", kind: "done" },
  ARCHIVED: { label: "Đã lưu trữ", tone: "muted", kind: "done" },
};

const OUTGOING_STEPS: Record<string, Step> = {
  DRAFT: { label: "Nháp", tone: "default", kind: "new" },
  CONTENT_REVIEW: { label: "Chờ duyệt", tone: "warning", kind: "review" },
  FORMAT_CHECK: { label: "Chờ duyệt", tone: "warning", kind: "review" },
  AUTHORIZED_SIGN: { label: "Chờ ký", tone: "warning", kind: "review" },
  NUMBERED: { label: "Đã ký", tone: "default", kind: "progress" },
  ORGANIZATION_SIGNED: { label: "Đã ký", tone: "default", kind: "progress" },
  ISSUED: { label: "Đã phát hành", tone: "muted", kind: "done" },
  DELIVERED: { label: "Đã phát hành", tone: "muted", kind: "done" },
  FILED: { label: "Đã lưu hồ sơ", tone: "muted", kind: "done" },
  ARCHIVED: { label: "Đã lưu trữ", tone: "muted", kind: "done" },
  RECALLED: { label: "Đã thu hồi", tone: "muted", kind: "done" },
};

/** Nhãn "Bước": ưu tiên trạng thái workflow, thiếu thì suy ra từ `Document.status`. */
export function getLedgerStepLabel(
  status: DocumentStatus,
  workflowStatus?: string,
  type?: string
): Step {
  if (workflowStatus) {
    const isOutgoing = type === "outbox" || type === "VAN_BAN_DI";
    const hit = (isOutgoing ? OUTGOING_STEPS : INCOMING_STEPS)[workflowStatus];
    if (hit) return hit;
  }
  switch (status) {
    case "pending_assignment":
    case "CHO_PHAN_CONG":
      return { label: "Chờ bút phê", tone: "warning", kind: "review" };
    case "processing":
    case "DANG_XU_LY":
      return { label: "Đang xử lý", tone: "default", kind: "progress" };
    case "delegated":
      return { label: "Đã giao đơn vị", tone: "default", kind: "progress" };
    case "approved":
    case "CHO_PHE_DUYET":
      return { label: "Chờ phê duyệt", tone: "warning", kind: "review" };
    default:
      return { label: "Đã lập hồ sơ", tone: "muted", kind: "done" };
  }
}
