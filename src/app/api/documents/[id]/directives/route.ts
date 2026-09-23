import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/server/api/context";
import { requireAuthenticated } from "@/server/api/auth";
import { apiSuccess, apiError } from "@/server/api/response";
import { assertCsrf } from "@/server/security/csrf";
import {
  assertJsonContentType,
  assertRequestBodySize,
  MAX_JSON_BODY_SIZE,
} from "@/server/api/validation";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  canReadDocument,
  canDirectDocument,
  isAdmin,
  isManager,
} from "@/server/policies/document-policy";
import {
  toDocumentDirectiveDTO,
  toDocumentDirectiveDTOArray,
  toDocumentDetailDTO,
} from "@/server/dto/document-dto";
import { CreateDirectiveSchema } from "@/contracts/documents";
import {
  getDocumentById,
  mapPrismaDocumentToItem,
} from "@/lib/documents/document-service";
import {
  mapDirectiveToSchoolTask,
  mapUrgencyToTaskPriority,
} from "@/lib/documents/directive-pipeline";
import { validateDirectivePayload } from "@/lib/documents/document-validator";
import { getAcademicMonthInfo, getAcademicYear } from "@/lib/academic-calendar";
import { TaskScope, TaskPriority, TaskStatus } from "@prisma/client";
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from "@/server/api/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  let requestId = crypto.randomUUID();
  try {
    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    const authUser = requireAuthenticated(apiContext);

    const { id } = await Promise.resolve(context.params);

    const document = await getDocumentById(id);
    if (!document) {
      throw new NotFoundError("Văn bản không tồn tại", "DOCUMENT_NOT_FOUND");
    }

    // Object-level authorization check (BOLA prevention)
    if (!canReadDocument(authUser, document)) {
      throw new AuthorizationError(
        "Bạn không có quyền truy cập văn bản này (Forbidden)",
        "FORBIDDEN"
      );
    }

    const directives = await prisma.documentDirective.findMany({
      where: { documentId: id },
      include: {
        leader: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(
      {
        success: true,
        data: directives,
        directives: toDocumentDirectiveDTOArray(directives),
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        requestId: apiContext.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  let requestId = crypto.randomUUID();
  try {
    const apiContext = await getApiContext(request);
    requestId = apiContext.requestId;
    const authUser = requireAuthenticated(apiContext);

    // 1. Role boundary check: only Leadership/Admin or Department Manager can issue directives
    const canIssueDirectives = isAdmin(authUser) || isManager(authUser);

    if (!canIssueDirectives) {
      throw new AuthorizationError(
        "Bạn không có quyền ban hành chỉ đạo (Forbidden)",
        "FORBIDDEN"
      );
    }

    // 2. CSRF assertion on mutations
    assertCsrf(request);

    // 3. Content-Type and Body size limits
    assertJsonContentType(request);
    assertRequestBodySize(request, MAX_JSON_BODY_SIZE);

    // 4. Rate limiting on mutations
    await assertRateLimit(authUser.id, "MUTATION");

    const { id } = await Promise.resolve(context.params);

    const document = await getDocumentById(id);
    if (!document) {
      throw new NotFoundError("Văn bản không tồn tại", "DOCUMENT_NOT_FOUND");
    }

    // 5. Object-level authorization check (BOLA prevention)
    if (!canDirectDocument(authUser, document)) {
      throw new AuthorizationError(
        "Bạn không có quyền ban hành chỉ đạo bút phê cho văn bản này (Forbidden)",
        "FORBIDDEN"
      );
    }

    const rawBody = await request.json();

    // Strict leaderId anti-spoofing binding from server session
    rawBody.leaderId = authUser.id;

    // 6. Input validation
    const validated = CreateDirectiveSchema.parse(rawBody);

    const validation = validateDirectivePayload(rawBody);
    if (!validation.isValid) {
      throw new ValidationError(
        validation.errors[0] || "Dữ liệu chỉ đạo không hợp lệ",
        {
          general: validation.errors,
        }
      );
    }

    const instruction = (validated.instruction || validated.content)!;
    const assignedDeptId = (validated.assignedDeptId || validated.assignedToDepartmentId)!;
    const deadline = validated.deadline ? new Date(validated.deadline) : null;
    const serializedCollaborators = Array.isArray(validated.collaboratorIds)
      ? JSON.stringify(validated.collaboratorIds)
      : typeof validated.collaboratorIds === "string"
      ? validated.collaboratorIds
      : null;

    // Build standardized task payload
    const taskPayload = mapDirectiveToSchoolTask(document, {
      id: "",
      documentId: id,
      leaderId: authUser.id,
      leaderName: authUser.name || "Ban Giám hiệu",
      instruction,
      deadline: deadline ? deadline.toISOString() : null,
      assignedDeptId,
      collaboratorIds: serializedCollaborators,
      isTaskGenerated: false,
    });

    const priorityEnum = (mapUrgencyToTaskPriority(document.urgency) as TaskPriority) || TaskPriority.NORMAL;

    // 7. Coordinated single atomic transaction
    const { createdTask, savedDirective, updatedDocumentRecord } = await prisma.$transaction(
      async (tx) => {
        const dueDateObj = taskPayload.dueDate
          ? new Date(taskPayload.dueDate)
          : deadline || new Date(Date.now() + 7 * 86400000);
        const monthInfo = getAcademicMonthInfo(dueDateObj);
        const academicYearStr = monthInfo.academicYear || getAcademicYear(dueDateObj);
        const monthNum = monthInfo.monthNumber;

        // Generate unique continuous task code NV-YYYY-MM-XXX
        const count = await tx.task.count({
          where: {
            academicMonth: monthNum,
            academicYear: academicYearStr,
          },
        });

        let seq = count + 1;
        const curYear = dueDateObj.getFullYear();
        let code = `NV-${curYear}-${String(monthNum).padStart(2, "0")}-${String(seq).padStart(3, "0")}`;

        while (await tx.task.findUnique({ where: { code }, select: { id: true } })) {
          seq++;
          code = `NV-${curYear}-${String(monthNum).padStart(2, "0")}-${String(seq).padStart(3, "0")}`;
        }

        // Phase 9: Department model dropped — use leadUnitId directly
        const task = await tx.task.create({
          data: {
            code,
            title: taskPayload.title,
            description: taskPayload.description,
            scope: TaskScope.SCHOOL,
            status: TaskStatus.NOT_STARTED,
            priority: priorityEnum,
            dueDate: dueDateObj,
            leadUnitId: assignedDeptId || null,
            createdById: authUser.id,
            academicMonth: monthNum,
            academicYear: academicYearStr,
          },
          include: {
            leadUnit: true,
          },
        });

        const dir = await tx.documentDirective.create({
          data: {
            documentId: id,
            leaderId: authUser.id,
            instruction,
            deadline,
            assignedDeptId,
            collaboratorIds: serializedCollaborators,
            isTaskGenerated: true,
          },
          include: {
            leader: true,
          },
        });

        const docRecord = await tx.document.update({
          where: { id },
          data: {
            status: "DANG_XU_LY",
            linkedTaskId: task.id,
          },
          include: {
            leadUser: true,
            registeredBy: true,
            attachments: true,
            directives: {
              include: {
                leader: true,
              },
            },
            linkedTask: true,
          },
        });

        return {
          createdTask: task,
          savedDirective: dir,
          updatedDocumentRecord: docRecord,
        };
      }
    );

    const mappedDoc = mapPrismaDocumentToItem(updatedDocumentRecord);

    return apiSuccess(
      {
        success: true,
        data: {
          task: createdTask,
          directive: savedDirective,
          document: mappedDoc,
        },
        task: createdTask,
        directive: toDocumentDirectiveDTO(savedDirective),
        document: toDocumentDetailDTO(mappedDoc),
      },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
        requestId: apiContext.requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}
