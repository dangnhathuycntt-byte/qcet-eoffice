import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPublicRuntimeConfig } from "@/config/runtime";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trợ lý | QCET E-Office",
  description: "Cuộc trò chuyện đã lưu với Trợ lý",
};

interface AssistantConversationPageProps {
  params: Promise<{ id: string }>;
}

export default async function AssistantConversationPage({ params }: AssistantConversationPageProps) {
  if (!getPublicRuntimeConfig().features.assistant) notFound();

  const { id } = await params;
  const authSession = await auth();
  const cookieStore = await cookies();
  const jwtSession = !authSession?.user?.id ? await getSessionFromRequest({ cookies: cookieStore }) : null;
  if (!(authSession?.user?.id ?? jwtSession?.id)) {
    redirect(`/login?returnTo=${encodeURIComponent(`/assistant/${id}`)}`);
  }

  return <AssistantWorkspace conversationId={id} />;
}
