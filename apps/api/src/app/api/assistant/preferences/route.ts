import { NextRequest } from "next/server";
import { AssistantPreferencesUpdateSchema } from "@qcet/contracts/assistant";
import { parseAndValidateJson } from "@/server/api/validation";
import { getAssistantPreferences, updateAssistantPreferences } from "@/server/assistant/assistant-profile";
import { assistantRoute } from "@/server/assistant/assistant-route";

/** Thiết lập Trợ lý của người gọi: hướng dẫn riêng và bật bản tin sáng (ADR-012). */
export async function GET(req: NextRequest) {
  return assistantRoute(req, { endpoint: "GET /api/assistant/preferences", mutate: false }, ({ session }) =>
    getAssistantPreferences(session.id),
  );
}

export async function PUT(req: NextRequest) {
  return assistantRoute(req, { endpoint: "PUT /api/assistant/preferences", mutate: true }, async ({ session }) => {
    const body = await parseAndValidateJson(req, AssistantPreferencesUpdateSchema, { maxBytes: 16 * 1024 });
    return updateAssistantPreferences(session.id, body);
  });
}
