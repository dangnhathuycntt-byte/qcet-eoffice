import { permanentRedirect } from "next/navigation";

interface UnitTasksPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function UnitTasksPage({ searchParams }: UnitTasksPageProps) {
  const resolvedParams = searchParams ? await searchParams : {};
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(resolvedParams)) {
    if (key !== "scope" && typeof value === "string") {
      params.set(key, value);
    } else if (Array.isArray(value) && value.length > 0) {
      params.set(key, value[0]);
    }
  }
  params.set("scope", "unit");

  permanentRedirect(`/tasks?${params.toString()}`);
}
