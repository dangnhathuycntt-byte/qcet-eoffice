import { NextRequest } from "next/server";
import { AssistantSkillInputSchema } from "@qcet/contracts/assistant";
import { NotFoundError } from "@/server/api/errors";
import { parseAndValidateJson } from "@/server/api/validation";
import { deleteAssistantSkill, updateAssistantSkill } from "@/server/assistant/assistant-profile";
import { assistantRoute } from "@/server/assistant/assistant-route";

/** Sửa hoặc xóa một kỹ năng của chính người gọi; của người khác trả 404 như không có. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  return assistantRoute(req, { endpoint: "PATCH /api/assistant/skills/[id]", mutate: true }, async ({ session }) => {
    const { id } = await props.params;
    const body = await parseAndValidateJson(req, AssistantSkillInputSchema, { maxBytes: 32 * 1024 });
    return updateAssistantSkill(session.id, id, body);
  });
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  return assistantRoute(req, { endpoint: "DELETE /api/assistant/skills/[id]", mutate: true }, async ({ session }) => {
    const { id } = await props.params;
    if (!(await deleteAssistantSkill(session.id, id))) throw new NotFoundError("Không tìm thấy kỹ năng.");
    return { id, deleted: true };
  });
}
