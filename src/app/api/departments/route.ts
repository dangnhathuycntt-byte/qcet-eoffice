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

    // Phase 9: Department model dropped — read from OrganizationalUnit.
    // `members` relation không tồn tại; nhân sự đơn vị là `positionAssignments`.
    const units = await prisma.organizationalUnit.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        code: true,
        ...(includePersonnel && {
          positionAssignments: {
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
        personnel: ((u as any).positionAssignments ?? []).map((pa: any) => ({
          id: pa.user.id,
          name: pa.user.name,
          email: pa.user.email,
          role: pa.user.role,
          title: pa.user.title,
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
  } catch (error) {
    return apiError(error, requestId, {
      "Cache-Control": "private, no-store",
    });
  }
}
