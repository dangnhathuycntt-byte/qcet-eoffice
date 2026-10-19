import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getRuntimeConfig, getWebSession } from "@/lib/server-api";
import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";
import { parseAssistantContextParam, parseAssistantPromptParam } from "@/components/assistant/assistant-model";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trợ lý | QCET E-Office",
  description: "Hỏi đáp chỉ đọc về nhiệm vụ, văn bản và lịch họp trong quyền của Thầy/Cô",
};

interface AssistantPageProps {
  searchParams: Promise<{ context?: string | string[]; prompt?: string | string[] }>;
}

export default async function AssistantPage({ searchParams }: AssistantPageProps) {
  // Cờ tắt thì trang không tồn tại (đồng nhất với API trả 503 FEATURE_DISABLED)
  if (!(await getRuntimeConfig())?.features.assistant) notFound();

  if (!(await getWebSession())) {
    redirect(`/login?returnTo=${encodeURIComponent("/assistant")}`);
  }

  const { context, prompt } = await searchParams;
  return <AssistantWorkspace initialContext={parseAssistantContextParam(context)} initialPrompt={parseAssistantPromptParam(prompt)} />;
}
