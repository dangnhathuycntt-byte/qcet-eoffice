import { NextRequest } from "next/server";
import { AssistantMemoryInputSchema } from "@qcet/contracts/assistant";
import { parseAndValidateJson } from "@/server/api/validation";
import { addAssistantMemory, listAssistantMemories } from "@/server/assistant/assistant-profile";
import { assistantRoute } from "@/server/assistant/assistant-route";

/** Ghi nhớ của Trợ lý về người gọi (ADR-012); người gọi tự thêm, sửa, xóa. */
export async function GET(req: NextRequest) {
  return assistantRoute(req, { endpoint: "GET /api/assistant/memories", mutate: false }, async ({ session }) => ({
    memories: await listAssistantMemories(session.id),
  }));
}

export async function POST(req: NextRequest) {
  return assistantRoute(req, { endpoint: "POST /api/assistant/memories", mutate: true, status: 201 }, async ({ session }) => {
    const body = await parseAndValidateJson(req, AssistantMemoryInputSchema, { maxBytes: 4 * 1024 });
    return addAssistantMemory(session.id, body.content, "user");
  });
}
