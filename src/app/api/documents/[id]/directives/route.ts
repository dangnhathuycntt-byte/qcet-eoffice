import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getDocumentById,
  mapPrismaDocumentToItem,
} from "@/lib/documents/document-service";
import {
  executeDirectivePipeline,
} from "@/lib/documents/directive-pipeline";
import { validateDirectivePayload } from "@/lib/documents/document-validator";
import { verifySessionToken, SESSION_COOKIE_NAME, SessionPayload } from "@/lib/jwt-session";
import { getAcademicMonthInfo, getAcademicYear } from "@/lib/academic-calendar";
import { TaskScope, TaskPriority, TaskStatus } from "@prisma/client";
import type { DocumentDirectiveItem } from "@/types/document";

interface RouteContext {
  params: { id: string } | Promise<{ id: string }>;
}

function getSessionPayload(request: NextRequest): SessionPayload | null {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value || bearerToken;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!["BAN_GIAM_HIEU", "ADMIN"].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền ban hành chỉ đạo" },
        { status: 403 }
      );
    }

    const { id } = await context.params;

    // 1. Check document existence
    const document = await getDocumentById(id);
    if (!document) {
      return NextResponse.json(
        { success: false, error: "Văn bản không tồn tại" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Strict leaderId binding from session (anti-spoofing)
    body.leaderId = session.id;

    // 2. Validate directive payload
    const validation = validateDirectivePayload(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    // 3. Resolve leader user and assigned department for naming & DB constraints
    const effectiveLeaderId = session.id;
    const leaderUser = await prisma.user.findUnique({ where: { id: effectiveLeaderId } });

    const assignedDept = await prisma.department.findUnique({
      where: { id: body.assignedDeptId },
    });

    const serializedCollaborators =
      Array.isArray(body.collaboratorIds)
        ? JSON.stringify(body.collaboratorIds)
        : typeof body.collaboratorIds === "string"
        ? body.collaboratorIds
        : null;

    const directiveItem: DocumentDirectiveItem = {
      id: "",
      documentId: id,
      leaderId: effectiveLeaderId,
      leaderName: leaderUser?.name || session.name || "Ban Giám hiệu",
      instruction: body.instruction,
      deadline: body.deadline ? new Date(body.deadline).toISOString() : null,
      assignedDeptId: body.assignedDeptId,
      assignedDeptName: assignedDept?.name,
      collaboratorIds: serializedCollaborators,
      isTaskGenerated: false,
    };

    // 4. Coordinated transactional persistence
    const pipelineResult = await executeDirectivePipeline(
      document,
      directiveItem,
      async (taskPayload) => {
        return await prisma.$transaction(async (tx) => {
          const dueDateObj = new Date(taskPayload.dueDate);
          const monthInfo = getAcademicMonthInfo(dueDateObj);
          const academicYearStr = monthInfo.academicYear || getAcademicYear(dueDateObj);
          const monthNum = monthInfo.monthNumber;

          // Generate continuous unique task code NV-YYYY-MM-XXX
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

          let priorityEnum: TaskPriority = TaskPriority.NORMAL;
          if (taskPayload.priority === "URGENT") priorityEnum = TaskPriority.URGENT;
          else if (taskPayload.priority === "HIGH") priorityEnum = TaskPriority.HIGH;
          else if (taskPayload.priority === "LOW") priorityEnum = TaskPriority.LOW;

          // Ensure department exists in DB before FK insertion
          const validDept = await tx.department.findUnique({
            where: { id: taskPayload.departmentId },
          });

          const createdTask = await tx.task.create({
            data: {
              code,
              title: taskPayload.title,
              description: taskPayload.description,
              scope: TaskScope.SCHOOL,
              status: TaskStatus.NOT_STARTED,
              priority: priorityEnum,
              dueDate: dueDateObj,
              departmentId: validDept ? validDept.id : null,
              createdById: effectiveLeaderId,
              academicMonth: monthNum,
              academicYear: academicYearStr,
            },
            include: {
              department: true,
            },
          });

          return createdTask;
        });
      }
    );

    // 5. Save directive record & update document status to DANG_XU_LY
    const { savedDirective, updatedDocumentRecord } = await prisma.$transaction(
      async (tx) => {
        const dir = await tx.documentDirective.create({
          data: {
            documentId: id,
            leaderId: effectiveLeaderId,
            instruction: body.instruction,
            deadline: body.deadline ? new Date(body.deadline) : null,
            assignedDeptId: body.assignedDeptId,
            collaboratorIds: serializedCollaborators,
            isTaskGenerated: true,
          },
          include: {
            leader: true,
            assignedDept: true,
          },
        });

        const docRecord = await tx.document.update({
          where: { id },
          data: {
            status: "DANG_XU_LY",
            linkedTaskId: pipelineResult.task.id,
            leadDepartmentId: body.assignedDeptId,
          },
          include: {
            draftingDept: true,
            leadDepartment: true,
            leadUser: true,
            registeredBy: true,
            attachments: true,
            directives: {
              include: {
                leader: true,
                assignedDept: true,
              },
            },
            linkedTask: true,
          },
        });

        return {
          savedDirective: dir,
          updatedDocumentRecord: docRecord,
        };
      }
    );

    const mappedDoc = mapPrismaDocumentToItem(updatedDocumentRecord);

    return NextResponse.json(
      {
        success: true,
        data: {
          task: pipelineResult.task,
          directive: savedDirective,
          document: mappedDoc,
        },
        task: pipelineResult.task,
        directive: savedDirective,
        document: mappedDoc,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating directive:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
