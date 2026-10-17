import { prisma } from "@/lib/prisma";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { apiError, apiSuccess } from "@/server/api/response";

interface DepartmentPersonnelDTO {
  id: string;
  name: string;
  email: string;
  role: string;
  /** Chức danh tự ghi trên tài khoản; chức vụ chuẩn ở `position` (PositionDefinition). */
  title: string | null;
  phone: string | null;
  avatarUrl: string | null;
  position: string | null;
  positionCode: string | null;
  isLeadership: boolean;
  assignmentType: string;
}

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
        type: true,
        parentId: true,
        metadata: true,
        ...(includePersonnel && {
          positionAssignments: {
            where: {
              status: "ACTIVE",
              effectiveFrom: { lte: new Date() },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
              user: { isActive: true },
            },
            select: {
              type: true,
              positionDefinition: { select: { code: true, title: true, isLeadership: true } },
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  title: true,
                  phone: true,
                  avatarUrl: true,
                },
              },
            },
            orderBy: { createdAt: "asc" as const },
          },
        }),
      },
      orderBy: { name: "asc" },
    });

    const mapped = units.map((u) => {
      let personnel: DepartmentPersonnelDTO[] | undefined;
      if (includePersonnel) {
        // Một người giữ hai chức vụ trong cùng đơn vị (vd. Trưởng phòng + Giám đốc trung tâm): giữ một dòng, ưu tiên chức vụ lãnh đạo
        const byUser = new Map<string, DepartmentPersonnelDTO>();
        for (const pa of (u as any).positionAssignments ?? []) {
          if (!pa.user) continue;
          const isLeadership = Boolean(pa.positionDefinition?.isLeadership);
          const existing = byUser.get(pa.user.id);
          if (existing && (existing.isLeadership || !isLeadership)) continue;
          byUser.set(pa.user.id, {
            id: pa.user.id,
            name: pa.user.name,
            email: pa.user.email,
            role: pa.user.role,
            title: pa.user.title,
            phone: pa.user.phone ?? null,
            avatarUrl: pa.user.avatarUrl ?? null,
            position: pa.positionDefinition?.title ?? null,
            positionCode: pa.positionDefinition?.code ?? null,
            isLeadership,
            assignmentType: pa.type,
          });
        }
        personnel = [...byUser.values()];
      }

      const metadata = u.metadata && typeof u.metadata === "object" && !Array.isArray(u.metadata) ? (u.metadata as Record<string, unknown>) : {};
      return {
        id: u.id,
        name: u.name,
        code: u.code || u.id,
        color: null,
        type: u.type,
        parentId: u.parentId,
        shortName: typeof metadata.shortName === "string" ? metadata.shortName : null,
        description: typeof metadata.description === "string" ? metadata.description : null,
        displayOrder: typeof metadata.displayOrder === "number" ? metadata.displayOrder : null,
        ...(includePersonnel && { personnel }),
      };
    });

    return apiSuccess(
      {
        data: mapped,
        departments: mapped,
        total: mapped.length,
      },
      {
        headers: { "Cache-Control": "private, max-age=60" },
        requestId,
        legacyCompat: true,
      },
    );
  } catch (error) {
    return apiError(error, requestId, { headers: { "Cache-Control": "private, no-store" } });
  }
}
