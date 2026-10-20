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

/** Lưu dự thảo biên bản (Đã họp → Dự thảo biên bản). */
export const draftMinutes = (meetingId: string, minutes: string) =>
  post(`${base(meetingId)}/actions/draft-minutes`, "Chưa lưu được biên bản.", { minutes });

/** Duyệt biên bản (Dự thảo biên bản → Biên bản đã duyệt). */
export const confirmMinutes = (meetingId: string) => post(`${base(meetingId)}/actions/confirm-minutes`, "Chưa duyệt được biên bản.");
