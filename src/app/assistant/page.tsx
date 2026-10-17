import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPublicRuntimeConfig } from "@/config/runtime";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { AssistantWorkspace } from "@/components/assistant/assistant-workspace";
import { parseAssistantContextParam } from "@/components/assistant/assistant-model";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trợ lý | QCET E-Office",
  description: "Hỏi đáp chỉ đọc về nhiệm vụ, văn bản và lịch họp trong quyền của Thầy/Cô",
};

interface AssistantPageProps {
  searchParams: Promise<{ context?: string | string[] }>;
}

export default async function AssistantPage({ searchParams }: AssistantPageProps) {
  // Cờ tắt thì trang không tồn tại (đồng nhất với API trả 503 FEATURE_DISABLED)
  if (!getPublicRuntimeConfig().features.assistant) notFound();

  const authSession = await auth();
  const cookieStore = await cookies();
  const jwtSession = !authSession?.user?.id ? await getSessionFromRequest({ cookies: cookieStore }) : null;
  if (!(authSession?.user?.id ?? jwtSession?.id)) {
    redirect(`/login?returnTo=${encodeURIComponent("/assistant")}`);
  }

  const { context } = await searchParams;
  return <AssistantWorkspace initialContext={parseAssistantContextParam(context)} />;
}
