import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionFromRequest } from "@/lib/jwt-session";

interface RootPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RootPage({ searchParams }: RootPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const session = await getSessionFromRequest({ cookies: cookieStore });

  // Preserve authentication / onboarding redirects
  if (!session) {
    redirect("/login");
  }

  const zoneParam = resolvedParams?.zone;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedParams)) {
    if (key !== "zone" && typeof value === "string") {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  const query = qs ? `?${qs}` : "";

  if (zoneParam === "calendar") {
    redirect(`/calendar${query}`);
  } else if (zoneParam === "org") {
    redirect(`/org${query}`);
  } else if (zoneParam === "documents") {
    redirect(`/documents${query}`);
  }

  redirect(`/tasks${query}`);
}
