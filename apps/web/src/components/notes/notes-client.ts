import type {
  CreatePersonalNoteInput,
  PersonalNote,
  PersonalNoteEntityType,
  PersonalNoteSummary,
  UpdatePersonalNoteInput,
} from "@qcet/contracts/personal-notes";

// Gọi API ghi chú cá nhân (/api/notes) từ trình duyệt; dùng chung cho trang Ghi chú và khung ghi chú trong cuộc họp.

/** Lỗi từ API kèm mã HTTP để nơi gọi phân biệt "đã bị xóa" (404) với lỗi mạng. */
export class NotesRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "NotesRequestError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success === false) {
    const raw = json?.message ?? json?.error;
    const message = typeof raw === "string" ? raw : raw?.message;
    throw new NotesRequestError(message || `Lỗi ${res.status}`, res.status);
  }
  return json as T;
}

export interface NotesListFilter {
  q?: string;
  entityType?: PersonalNoteEntityType;
  entityId?: string;
}

export async function fetchNotes(filter: NotesListFilter = {}, signal?: AbortSignal): Promise<{ notes: PersonalNoteSummary[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.entityType && filter.entityId) {
    params.set("entityType", filter.entityType);
    params.set("entityId", filter.entityId);
  }
  const query = params.toString();
  return request(`/api/notes${query ? `?${query}` : ""}`, { signal });
}

export function fetchNote(id: string, signal?: AbortSignal): Promise<PersonalNote> {
  return request(`/api/notes/${encodeURIComponent(id)}`, { signal });
}

export function createNote(input: Partial<CreatePersonalNoteInput> = {}): Promise<PersonalNote> {
  return request("/api/notes", { method: "POST", body: JSON.stringify(input) });
}

export function updateNote(id: string, input: UpdatePersonalNoteInput): Promise<PersonalNote> {
  return request(`/api/notes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function deleteNote(id: string): Promise<void> {
  await request(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Dòng danh sách từ ghi chú đầy đủ (sau khi tạo hoặc sửa) để danh sách cập nhật ngay không cần tải lại. */
export function toNoteSummary(note: PersonalNote): PersonalNoteSummary {
  return {
    id: note.id,
    title: note.title,
    excerpt: note.content.replace(/\s+/g, " ").trim().slice(0, 160),
    pinned: note.pinned,
    entityType: note.entityType,
    entityId: note.entityId,
    updatedAt: note.updatedAt,
  };
}
