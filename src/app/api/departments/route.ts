import { prisma } from "@/lib/prisma";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";
import { ORG_UNIT_READ_CUTOVER } from "@/lib/feature-flags";

export async function GET(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    requireAuthenticated(context);

    const url = new URL(req.url);
    const includePersonnel = url.searchParams.get("includePersonnel") === "true";

    if (ORG_UNIT_READ_CUTOVER) {
      // Stage B: đọc từ OrganizationalUnit, map sang shape Department cho tương thích ngược
      const units = await prisma.organizationalUnit.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          code: true,
          ...(includePersonnel && {
            members: {
              where: { status: "ACTIVE" },
              select: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    title: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" as const },
            },
          }),
        },
        orderBy: { name: "asc" },
      });

      const mapped = units.map((u) => ({
        id: u.id,
        name: u.name,
        code: u.code || u.id,
        color: null,
        ...(includePersonnel && {
          personnel: ((u as any).members ?? []).map((m: any) => ({
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            role: m.user.role,
            title: m.user.title,
          })),
        }),
      }));

      return apiSuccess(
        { success: true, departments: mapped },
        {
          headers: { "Cache-Control": "private, max-age=60" },
          requestId: context.requestId,
        },
      );
    }

    // Stage A fallback: đọc từ Department (legacy)
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
