import type { DocumentItem } from "@/types/document";

/**
 * Quy trình văn bản đến (FSM): REGISTERED → PRESENTED → DIRECTED → UNIT_ASSIGNED_PERSON → RESOLVED → FILED → ARCHIVED.
 * Hàm thuần: UI chỉ dùng để hiện nút theo vai trò; server vẫn là nơi kiểm quyền thực sự.
 */

export interface IncomingActionDef {
  key: string;
  label: string;
  confirmMsg: string;
  body: Record<string, unknown>;
  destructive?: boolean;
  /** Thao tác cần nhập thêm: lý do (trả lại), chọn đơn vị (chuyển lại) hoặc chọn người xử lý (phân công). */
  input?: "reason" | "unit" | "person";
}

export const INCOMING_STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Đã vào sổ",
  PRESENTED: "Đã trình lãnh đạo",
  ASSIGNED_TO_LEAD_UNIT: "Đã giao đơn vị chủ trì",
  DIRECTED: "Đã có bút phê",
  UNIT_ASSIGNED_PERSON: "Đã phân công",
  RESOLVED: "Đã giải quyết",
  FILED: "Đã lập hồ sơ",
  ARCHIVED: "Đã lưu trữ",
};

export function getIncomingActions(status: string, role: string | null | undefined): IncomingActionDef[] {
  const actions: IncomingActionDef[] = [];
  if (status === "REGISTERED" && role === "VAN_THU") {
    actions.push({ key: "present", label: "Trình lãnh đạo", confirmMsg: "Trình văn bản này lên lãnh đạo?", body: {} });
  }
  if (status === "PRESENTED" && role === "BAN_GIAM_HIEU") {
    actions.push({ key: "direct", label: "Bút phê", confirmMsg: "Xác nhận bút phê cho văn bản này?", body: { instruction: "" } });
  }
  // Trưởng đơn vị phân công người xử lý: cần chọn người nên mở biểu mẫu thay vì xác nhận suông (V-01).
  if (["DIRECTED", "ASSIGNED_TO_LEAD_UNIT"].includes(status) && role === "TRUONG_PHONG") {
    actions.push({ key: "assign-unit", label: "Phân công", confirmMsg: "", body: {}, input: "person" });
  }
  if (status === "UNIT_ASSIGNED_PERSON" && role === "CHUYEN_VIEN") {
    actions.push({ key: "resolve", label: "Báo cáo kết quả", confirmMsg: "Xác nhận đã giải quyết văn bản này?", body: { summary: "" } });
  }
  if (status === "RESOLVED" && role === "VAN_THU") {
    actions.push({ key: "file", label: "Lập hồ sơ", confirmMsg: "Lập hồ sơ cho văn bản này?", body: {} });
  }
  // Trả lại khi chuyển nhầm đơn vị (V-01): trưởng đơn vị chủ trì, trước khi sinh nhiệm vụ.
  if (role === "TRUONG_PHONG" && ["ASSIGNED_TO_LEAD_UNIT", "UNIT_ASSIGNED_PERSON"].includes(status)) {
    actions.push({
      key: "return",
      label: "Trả lại",
      confirmMsg: "",
      body: {},
      destructive: true,
      input: "reason",
    });
  }
  // Văn bản bị trả lại về DIRECTED chờ Văn thư chuyển cho đơn vị khác.
  if (role === "VAN_THU" && status === "DIRECTED") {
    actions.push({ key: "reroute", label: "Chuyển đơn vị khác", confirmMsg: "", body: {}, input: "unit" });
  }
  if (role === "BAN_GIAM_HIEU" && ["DIRECTED", "UNIT_ASSIGNED_PERSON"].includes(status)) {
    actions.push({ key: "approve-content", label: "Duyệt nội dung", confirmMsg: "Phê duyệt nội dung văn bản này?", body: {} });
    actions.push({ key: "reject-content", label: "Từ chối nội dung", confirmMsg: "Từ chối nội dung văn bản này?", body: { reason: "" }, destructive: true });
  }
  return actions;
}

/** "25/09 15:20" theo giờ Việt Nam. */
export function formatShortDateTime(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Ho_Chi_Minh",
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}

export interface IncomingQuote {
  id: string;
  text: string;
  who: string;
  at: string | null;
}

/** Ý kiến chỉ đạo: ưu tiên bút phê theo từng lãnh đạo; nếu không có thì dùng nội dung bút phê tổng. */
export function buildIncomingQuotes(item: DocumentItem): IncomingQuote[] {
  const wf = (item.incomingWorkflow ?? {}) as { directedAt?: string | null; leadershipInstruction?: string | null; leader?: { name?: string | null } | null };
  if (item.directives?.length) {
    return item.directives.map((d) => ({
      id: d.id,
      text: d.instruction,
      who: d.leaderName ?? "Lãnh đạo",
      at: wf.directedAt ?? null,
    }));
  }
  if (wf.leadershipInstruction) {
    return [{ id: "instruction", text: wf.leadershipInstruction, who: wf.leader?.name ?? "Lãnh đạo", at: wf.directedAt ?? null }];
  }
  return [];
}
