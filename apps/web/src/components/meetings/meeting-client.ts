/** Gọi API cuộc họp từ trình duyệt; lỗi ném `Error` mang câu của máy chủ để hiện cho người dùng. */

/** Câu lỗi của máy chủ (RFC 9457 `detail`, hoặc `message` của API cũ); không có thì câu mặc định. */
export async function responseMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { detail?: unknown; message?: unknown } | null;
  const text = typeof body?.detail === "string" ? body.detail : typeof body?.message === "string" ? body.message : "";
  return text || fallback;
}

async function post(path: string, fallback: string, body?: unknown): Promise<void> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Mất kết nối tới máy chủ. Thầy/Cô thử lại.");
  }
  if (!response.ok) throw new Error(await responseMessage(response, fallback));
}

const base = (meetingId: string) => `/api/meetings/${encodeURIComponent(meetingId)}`;

/** Đánh dấu cuộc họp đã diễn ra (Đã mời → Đã họp). */
export const holdMeeting = (meetingId: string) => post(`${base(meetingId)}/actions/hold`, "Chưa chuyển được cuộc họp sang Đã họp.");

/** Hủy cuộc họp chưa diễn ra (→ Đã hủy); lý do ghi vào nhật ký. */
export const cancelMeeting = (meetingId: string, reason?: string) =>
  post(`${base(meetingId)}/actions/cancel`, "Chưa hủy được cuộc họp.", reason ? { reason } : undefined);

/** Lưu dự thảo biên bản (Đã họp → Dự thảo biên bản). */
export const draftMinutes = (meetingId: string, minutes: string) =>
  post(`${base(meetingId)}/actions/draft-minutes`, "Chưa lưu được biên bản.", { minutes });

/** Xóa dự thảo biên bản để soạn lại (Dự thảo biên bản → Đã họp). */
export const discardMinutes = (meetingId: string) =>
  post(`${base(meetingId)}/actions/discard-minutes`, "Chưa xóa được biên bản.");

/** Duyệt biên bản (Dự thảo biên bản → Biên bản đã duyệt). */
export const confirmMinutes = (meetingId: string) => post(`${base(meetingId)}/actions/confirm-minutes`, "Chưa duyệt được biên bản.");

/** Mời một người dự họp (người tổ chức, chủ tọa); người đã có trong cuộc họp thì máy chủ đổi vai trò. */
export const addParticipant = (meetingId: string, userId: string, role: "CHAIR" | "ATTENDEE") =>
  post(`${base(meetingId)}/participants`, "Chưa thêm được người dự họp.", { userId, role });
