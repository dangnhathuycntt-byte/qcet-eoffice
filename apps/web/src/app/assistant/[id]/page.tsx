import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getRuntimeConfig, getWebSession } from "@/lib/server-api";
import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trợ lý",
  description: "Cuộc trò chuyện đã lưu với Trợ lý",
};

interface AssistantConversationPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssistantConversationPage({ params }: AssistantConversationPageProps) {
  if (!(await getRuntimeConfig())?.features.assistant) notFound();

  const { id } = await params;
  if (!(await getWebSession())) {
    redirect(`/login?returnTo=${encodeURIComponent(`/assistant/${id}`)}`);
  }

  return <AssistantWorkspace conversationId={id} />;
}
