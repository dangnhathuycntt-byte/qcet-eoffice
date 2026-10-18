/**
 * Đề xuất nhiệm vụ của Trợ lý (ADR-010): Trợ lý soạn, người dùng mở hộp tạo nhiệm vụ đã điền sẵn rồi tự bấm Tạo.
 * Thuần, không gọi mạng: làm sạch đề xuất mô hình gửi, và khớp tên người hỏi nêu với nhân sự của đơn vị trong hộp.
 */
import type { AssistantTaskProposal, AssistantTaskProposalSubtask } from "@/contracts/assistant";
import {
  TASK_AGENT_SUBTASKS_MAX,
  TASK_AGENT_TITLE_MAX,
  type TaskAgentDraft,
  type TaskAgentPerson,
} from "@/domain/tasks/task-agent-draft";

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();
const titleKey = (title: string) => oneLine(title).toLocaleLowerCase("vi");

/**
 * Chuẩn hóa đề xuất đã qua kiểm kiểu (zod): tiêu đề một dòng, bỏ ngày bắt đầu sau hạn và hạn việc con sau hạn nhiệm
 * vụ, bỏ việc con trùng tên, tối đa TASK_AGENT_SUBTASKS_MAX việc con. Trường rỗng bị bỏ.
 */
export function normalizeTaskProposal(input: AssistantTaskProposal): AssistantTaskProposal {
  const proposal: AssistantTaskProposal = { title: oneLine(input.title).slice(0, TASK_AGENT_TITLE_MAX) };
  const description = input.description?.trim();
  if (description) proposal.description = description;
  if (input.priority) proposal.priority = input.priority;
  if (input.dueDate) proposal.dueDate = input.dueDate;
  if (input.startDate && (!input.dueDate || input.startDate <= input.dueDate)) proposal.startDate = input.startDate;
  const lead = input.leadAssigneeName ? oneLine(input.leadAssigneeName) : "";
  if (lead) proposal.leadAssigneeName = lead;

  const seen = new Set<string>();
  const subtasks: AssistantTaskProposalSubtask[] = [];
  for (const raw of input.subtasks ?? []) {
    if (subtasks.length >= TASK_AGENT_SUBTASKS_MAX) break;
    const title = oneLine(raw.title).slice(0, TASK_AGENT_TITLE_MAX);
    if (!title || seen.has(titleKey(title))) continue;
    seen.add(titleKey(title));
    const item: AssistantTaskProposalSubtask = { title };
    const itemDescription = raw.description?.trim();
    if (itemDescription) item.description = itemDescription;
    const assignee = raw.assigneeName ? oneLine(raw.assigneeName) : "";
    if (assignee) item.assigneeName = assignee;
    if (raw.dueDate && (!proposal.dueDate || raw.dueDate <= proposal.dueDate)) item.dueDate = raw.dueDate;
    subtasks.push(item);
  }
  if (subtasks.length > 0) proposal.subtasks = subtasks;
  return proposal;
}

// Danh xưng đứng trước tên khi người hỏi nhắc tới ai đó ("giao cho chị Lan", "thầy Minh", "TS. Hùng")
const HONORIFICS = new Set(["thầy", "cô", "anh", "chị", "ông", "bà", "em", "bạn", "đ/c"]);
const ACADEMIC_TITLE = /^(?:(?:gs|pgs|ts|ths|ks|cn|bs)\.)+$/;

/**
 * Họ tên thành các từ thường: bỏ phần trong ngoặc (danh sách nhân sự ghi kèm chức vụ, "TS. Đinh Quốc Cường (Trưởng
 * khoa Cơ khí)"), bỏ danh xưng/học vị đứng đầu; bỏ hết thì giữ nguyên ("Anh" cũng là tên).
 */
function nameTokens(name: string): string[] {
  const plain = name.normalize("NFC").replace(/\([^)]*\)/g, " ");
  const tokens = oneLine(plain).toLocaleLowerCase("vi").split(" ").filter(Boolean);
  let start = 0;
  while (start < tokens.length - 1) {
    const token = tokens[start];
    if (token === "đồng" && tokens[start + 1] === "chí" && start + 2 < tokens.length) start += 2;
    else if (HONORIFICS.has(token) || ACADEMIC_TITLE.test(token)) start += 1;
    else break;
  }
  return tokens.slice(start);
}

/**
 * Id người có họ tên khớp: trùng cả họ tên, hoặc khớp phần cuối họ tên ("Lan", "Thị Lan" với "Nguyễn Thị Lan") mà chỉ
 * một người khớp. Giữ dấu (Lan khác Lân). Không chắc thì trả undefined để người dùng tự chọn.
 */
export function matchPersonByName(name: string | undefined, personnel: readonly TaskAgentPerson[]): string | undefined {
  const query = name ? nameTokens(name) : [];
  if (query.length === 0) return undefined;
  const people = personnel.map((person) => ({ id: person.id, tokens: nameTokens(person.name) }));
  const joined = query.join(" ");
  const exact = people.filter((person) => person.tokens.join(" ") === joined);
  if (exact.length > 0) return exact.length === 1 ? exact[0].id : undefined;
  const tail = people.filter(
    (person) => person.tokens.length > query.length && person.tokens.slice(-query.length).join(" ") === joined,
  );
  return tail.length === 1 ? tail[0].id : undefined;
}

/** Đề xuất thành bản nháp của hộp tạo nhiệm vụ, tên người đổi thành id nhân sự của đơn vị đang chọn. */
export function proposalToTaskDraft(proposal: AssistantTaskProposal, personnel: readonly TaskAgentPerson[]): TaskAgentDraft {
  const draft: TaskAgentDraft = { title: proposal.title };
  if (proposal.description) draft.description = proposal.description;
  if (proposal.priority) draft.priority = proposal.priority;
  if (proposal.startDate) draft.startDate = proposal.startDate;
  if (proposal.dueDate) draft.dueDate = proposal.dueDate;
  const leadAssigneeId = matchPersonByName(proposal.leadAssigneeName, personnel);
  if (leadAssigneeId) draft.leadAssigneeId = leadAssigneeId;
  if (proposal.subtasks?.length) {
    draft.subtasks = proposal.subtasks.map((item) => {
      const assigneeId = matchPersonByName(item.assigneeName, personnel);
      return {
        title: item.title,
        ...(item.description ? { description: item.description } : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(item.dueDate ? { dueDate: item.dueDate } : {}),
      };
    });
  }
  return draft;
}
