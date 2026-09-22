import { prisma } from "@/lib/prisma";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";

export async function GET(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    requireAuthenticated(context);

    const url = new URL(req.url);
    const includePersonnel = url.searchParams.get("includePersonnel") === "true";

    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
        color: true,
        ...(includePersonnel && {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              title: true,
            },
            orderBy: { name: "asc" as const },
          },
        }),
      },
      orderBy: { name: "asc" },
    });

    const mapped = departments.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.shortName || d.id,
      color: d.color,
      ...(includePersonnel && {
        personnel: (d as any).users?.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          title: u.title,
        })) ?? [],
      }),
    }));

    return apiSuccess(
      { success: true, departments: mapped },
      {
        headers: { "Cache-Control": "private, max-age=60" },
        requestId: context.requestId,
      },
    );
  } catch (error) {
    return apiError(error, requestId, {
      "Cache-Control": "private, no-store",
    });
  }
}
