import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { UserRole as PrismaUserRole } from "@prisma/client";
import { getApiContext } from "@/server/api/request-context";
import { parseAndValidateJson, MAX_AUTH_BODY_SIZE } from "@/server/api/validation";
import { RegisterInputSchema } from "@/contracts/auth";
import { assertRateLimit } from "@/server/security/rate-limit";
import { ConflictError, ValidationError } from "@/server/api/errors";
import { toUserPublicDTO } from "@/server/dto";
import { apiError, apiSuccess } from "@/server/api/response";

export async function POST(req: Request) {
  let requestId = crypto.randomUUID();
  try {
    const context = await getApiContext(req);
    requestId = context.requestId;

    // Rate limiting: Key by `${context.ip || 'ip'}:register` using `RATE_LIMIT_PRESETS.AUTH_REGISTER`
    assertRateLimit(`${context.ip || 'ip'}:register`, 'AUTH_REGISTER');

    const body = await parseAndValidateJson(req, RegisterInputSchema, {
      maxBytes: MAX_AUTH_BODY_SIZE,
    });

    const normalizedEmail = body.email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictError("Email này đã được đăng ký trong hệ thống");
    }

    let assignedDepartmentId: string | null = null;
    if (body.departmentId && body.departmentId.trim() !== "") {
      const dept = await prisma.department.findUnique({
        where: { id: body.departmentId.trim() },
      });
      if (!dept) {
        throw new ValidationError("Phòng ban không tồn tại trong hệ thống");
      }
      assignedDepartmentId = dept.id;
    } else {
      const defaultDept = await prisma.department.findUnique({
        where: { id: "CNTT" },
      });
      if (defaultDept) {
        assignedDepartmentId = defaultDept.id;
      }
    }

    const hashedPassword = await hashPassword(body.password);

    // Public registration strictly enforces CHUYEN_VIEN role unconditionally
    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: body.name.trim(),
        passwordHash: hashedPassword,
        role: PrismaUserRole.CHUYEN_VIEN,
        departmentId: assignedDepartmentId,
        title: body.title?.trim() || "Chuyên viên",
        onboardedAt: null,
        onboardingData: {
          hasSeenWelcome: false,
          hasCompletedTour: false,
          completedSteps: ["step-profile"],
          isDismissed: false,
          snoozedUntil: null,
        },
      },
      include: {
        department: {
          select: { id: true, name: true, shortName: true },
        },
      },
    });

    return apiSuccess(
      {
        success: true,
        user: toUserPublicDTO(newUser),
      },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
        requestId: context.requestId,
      }
    );
  } catch (error) {
    // Canonical error handling adheres to RFC 7807 problem details (status: 500 on unexpected errors)
    return apiError(error, requestId, { "Cache-Control": "private, no-store" });
  }
}
