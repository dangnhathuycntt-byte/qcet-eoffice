import { NextRequest } from "next/server";
import { AssistantSkillInputSchema } from "@qcet/contracts/assistant";
import { parseAndValidateJson } from "@/server/api/validation";
import { createAssistantSkill, listAssistantSkills } from "@/server/assistant/assistant-profile";
import { assistantRoute } from "@/server/assistant/assistant-route";

/** Kỹ năng (câu lệnh lưu sẵn) của người gọi, gọi bằng "/" trong ô hỏi Trợ lý (ADR-012). */
export async function GET(req: NextRequest) {
  return assistantRoute(req, { endpoint: "GET /api/assistant/skills", mutate: false }, async ({ session }) => ({
    skills: await listAssistantSkills(session.id),
  }));
}

export async function POST(req: NextRequest) {
  return assistantRoute(req, { endpoint: "POST /api/assistant/skills", mutate: true, status: 201 }, async ({ session }) => {
    const body = await parseAndValidateJson(req, AssistantSkillInputSchema, { maxBytes: 32 * 1024 });
    return createAssistantSkill(session.id, body);
  });
}
