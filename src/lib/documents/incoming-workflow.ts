import type { DocumentItem } from "@qcet/contracts/types/document";

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
  /** Thao tác cần nhập thêm: lý do (trả lại), chọn đơn vị (chuyển lại), chọn người xử lý (phân công), bút phê (đơn vị chủ trì + ý kiến) hoặc kết quả giải quyết. */
  input?: "reason" | "unit" | "person" | "direct" | "resolve" | "file";
}

export function getIncomingActions(status: string, role: string | null | undefined): IncomingActionDef[] {
  const actions: IncomingActionDef[] = [];
  if (status === "REGISTERED" && role === "VAN_THU") {
    actions.push({ key: "present", label: "Trình lãnh đạo", confirmMsg: "Trình văn bản này lên lãnh đạo?", body: {} });
  }
  // Lãnh đạo bút phê được cả khi Văn thư chưa trình (máy trạng thái cho phép REGISTERED → giao đơn vị chủ trì).
  if (["REGISTERED", "PRESENTED"].includes(status) && role === "BAN_GIAM_HIEU") {
    actions.push({ key: "direct", label: "Chuyển", confirmMsg: "", body: {}, input: "direct" });
  }
  // Trưởng đơn vị phân công người xử lý: cần chọn người nên mở biểu mẫu thay vì xác nhận suông (V-01).
  if (["DIRECTED", "ASSIGNED_TO_LEAD_UNIT"].includes(status) && role === "TRUONG_PHONG") {
    actions.push({ key: "assign-unit", label: "Chuyển", confirmMsg: "", body: {}, input: "person" });
  }
  if (["UNIT_ASSIGNED_PERSON", "IN_PROGRESS"].includes(status) && role === "CHUYEN_VIEN") {
    actions.push({ key: "resolve", label: "Kết thúc", confirmMsg: "", body: {}, input: "resolve" });
  }
  if (status === "RESOLVED" && role === "VAN_THU") {
    actions.push({ key: "file", label: "Lưu hồ sơ", confirmMsg: "", body: {}, input: "file" });
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
  return actions;
}

export interface IncomingFlowStep {
  key: string;
  label: string;
  state: "done" | "active" | "upcoming";
}

const FLOW_STEPS = [
  { key: "register", label: "Đăng ký" },
  { key: "direct", label: "Lãnh đạo bút phê" },
  { key: "assign", label: "Phân công" },
  { key: "handle", label: "Xử lý" },
  { key: "file", label: "Lập hồ sơ" },
] as const;

/** Bước đang chờ (chỉ số trong FLOW_STEPS) và người cần làm; null = không thuộc luồng chính. */
const FLOW_POSITION: Record<string, { index: number; waitingFor: string | null }> = {
  RECEIVED: { index: 0, waitingFor: "Văn thư đăng ký văn bản" },
  REGISTERED: { index: 1, waitingFor: "Văn thư trình lãnh đạo" },
  PRESENTED: { index: 1, waitingFor: "Lãnh đạo bút phê" },
  DIRECTED: { index: 2, waitingFor: "Trưởng đơn vị chủ trì phân công người xử lý" },
  ASSIGNED_TO_LEAD_UNIT: { index: 2, waitingFor: "Trưởng đơn vị chủ trì phân công người xử lý" },
  UNIT_ASSIGNED_PERSON: { index: 3, waitingFor: "Người được phân công báo cáo kết quả" },
  IN_PROGRESS: { index: 3, waitingFor: "Người được phân công báo cáo kết quả" },
  RESOLVED: { index: 4, waitingFor: "Văn thư lập hồ sơ" },
  FILED: { index: 5, waitingFor: null },
  ARCHIVED: { index: 5, waitingFor: null },
};

/** Các bước của luồng văn bản đến kèm trạng thái theo bước hiện tại; null khi trạng thái không thuộc luồng chính (ví dụ đã thu hồi). */
export function getIncomingFlow(status: string): { steps: IncomingFlowStep[]; waitingFor: string | null } | null {
  const position = FLOW_POSITION[status];
  if (!position) return null;
  return {
    steps: FLOW_STEPS.map((step, i) => ({
      ...step,
      state: i < position.index ? "done" : i === position.index ? "active" : "upcoming",
    })),
    waitingFor: position.waitingFor,
  };
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
