import { NextRequest } from "next/server";
import { AssistantMemoryInputSchema } from "@qcet/contracts/assistant";
import { NotFoundError } from "@/server/api/errors";
import { parseAndValidateJson } from "@/server/api/validation";
import { deleteAssistantMemory, updateAssistantMemory } from "@/server/assistant/assistant-profile";
import { assistantRoute } from "@/server/assistant/assistant-route";

/** Sửa hoặc xóa một ghi nhớ của chính người gọi; của người khác trả 404 như không có. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  return assistantRoute(req, { endpoint: "PATCH /api/assistant/memories/[id]", mutate: true }, async ({ session }) => {
    const { id } = await props.params;
    const body = await parseAndValidateJson(req, AssistantMemoryInputSchema, { maxBytes: 4 * 1024 });
    return updateAssistantMemory(session.id, id, body.content);
  });
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  return assistantRoute(req, { endpoint: "DELETE /api/assistant/memories/[id]", mutate: true }, async ({ session }) => {
    const { id } = await props.params;
    if (!(await deleteAssistantMemory(session.id, id))) throw new NotFoundError("Không tìm thấy ghi nhớ.");
    return { id, deleted: true };
  });
}
