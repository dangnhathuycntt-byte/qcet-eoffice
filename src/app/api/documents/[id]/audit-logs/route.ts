import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiContext } from "@/server/api/context";
import { requireAuthenticated } from "@/server/api/auth";
import { apiSuccess, apiError } from "@/server/api/response";
import { canReadDocument } from "@/server/policies/document-policy";
import { NotFoundError, ForbiddenError } from "@/server/api/errors";
import {
  loadAuthorizationContext,
  buildDocumentResource,
  authorize,
} from "@/server/authorization";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export interface DocumentTimelineStep {
  id: string;
  stepNumber: number;
  key: string;
  title: string;
  subtitle: string;
  status: "completed" | "current" | "pending" | "rejected";
  actorName?: string | null;
  actorRole?: string | null;
  actorTitle?: string | null;
  actorAvatar?: string | null;
  timestamp?: string | null;
  notes?: string | null;
  departmentName?: string | null;
  assignedToName?: string | null;
  deadline?: string | null;
}

export interface DocumentAuditLogItem {
  id: string;
  action: string;
  actionLabel: string;
  actorName: string;
  actorRole?: string | null;
  actorTitle?: string | null;
  actorAvatar?: string | null;
  timestamp: string;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

const ACTION_LABELS: Record<string, string> = {
  DOCUMENT_CREATED: "Tiếp nhận & Vào sổ văn bản",
  DOCUMENT_PRESENTED: "Trình Ban Giám Hiệu xem xét",
  DOCUMENT_DIRECTED: "Lãnh đạo BGH cho ý kiến chỉ đạo / Bút phê",
  DOCUMENT_DIRECTIVE_CREATED: "Ban hành chỉ đạo điều hành",
  DOCUMENT_UNIT_ASSIGNED: "Phân công tác nghiệp cho đơn vị & chuyên viên",
  DOCUMENT_RESOLVED: "Báo cáo kết quả & Giải quyết hoàn tất",
  DOCUMENT_FILED: "Lập hồ sơ công việc & Lưu trữ",
  DOCUMENT_STATUS_CHANGED: "Cập nhật trạng thái văn bản",
  DOCUMENT_SUBMITTED_FOR_REVIEW: "Trình phê duyệt dự thảo",
  DOCUMENT_FORMAT_APPROVED: "Thẩm định thể thức văn bản đạt",
  DOCUMENT_CONTENT_APPROVED: "Phê duyệt nội dung văn bản",
  DOCUMENT_SIGNED: "Ký số ban hành",
  DOCUMENT_ASSIGNED_NUMBER: "Cấp số văn bản đi chính thức",
  DOCUMENT_ISSUED: "Phát hành văn bản",
  DOCUMENT_DELIVERED: "Chuyển giao văn bản đến nơi nhận",
};

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

    // 1. Fetch document from DB
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        registeredBy: {
          select: { id: true, name: true, role: true, title: true, avatarUrl: true },
        },
        leadUser: {
          select: { id: true, name: true, role: true, title: true, avatarUrl: true },
        },
        directives: {
          include: {
            leader: {
              select: { id: true, name: true, role: true, title: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        incomingWorkflow: {
          include: {
            presentedBy: {
              select: { id: true, name: true, role: true, title: true, avatarUrl: true },
            },
            leader: {
              select: { id: true, name: true, role: true, title: true, avatarUrl: true },
            },
            leadUnit: {
              select: { id: true, name: true, code: true },
            },
            unitAssignments: {
              include: {
                assignedBy: {
                  select: { id: true, name: true, role: true, title: true, avatarUrl: true },
                },
                driUser: {
                  select: { id: true, name: true, role: true, title: true, avatarUrl: true },
                },
                unit: {
                  select: { id: true, name: true, code: true },
                },
                task: {
                  select: { id: true, title: true, status: true },
                },
              },
              orderBy: { createdAt: "desc" },
            },
            resolvedBy: {
              select: { id: true, name: true, role: true, title: true, avatarUrl: true },
            },
            filedBy: {
              select: { id: true, name: true, role: true, title: true, avatarUrl: true },
            },
            archivedBy: {
              select: { id: true, name: true, role: true, title: true, avatarUrl: true },
            },
          },
        },
        outgoingWorkflow: {
          include: {
            contentReviewer: {
              select: { id: true, name: true, role: true, title: true, avatarUrl: true },
            },
            formatReviewer: {
              select: { id: true, name: true, role: true, title: true, avatarUrl: true },
            },
            authorizedSigner: {
              select: { id: true, name: true, role: true, title: true, avatarUrl: true },
            },
            numberer: {
              select: { id: true, name: true, role: true, title: true, avatarUrl: true },
            },
            orgSigner: {
              select: { id: true, name: true, role: true, title: true, avatarUrl: true },
            },
            issuer: {
              select: { id: true, name: true, role: true, title: true, avatarUrl: true },
            },
          },
        },
        linkedTask: {
          select: { id: true, title: true, status: true, dueDate: true },
        },
      },
    });

    if (!document) {
      throw new NotFoundError("Văn bản không tồn tại", "DOCUMENT_NOT_FOUND");
    }

    // 2. Authorization check
    const authContext = await loadAuthorizationContext(authUser.id);
    const docResource = buildDocumentResource(document as any);
    const readDecision = authorize(authContext, "document.read", docResource);
    if (!readDecision.allowed || !canReadDocument(authUser, document as any)) {
      throw new ForbiddenError(
        readDecision.reason || "Bạn không có quyền truy cập lịch sử văn bản này"
      );
    }

    // 3. Query Audit Events
    const rawAuditEvents = await prisma.auditEvent.findMany({
      where: {
        OR: [
          { entityType: "Document", entityId: id },
          { entityType: "DocumentIncomingWorkflow", entityId: document.incomingWorkflow?.id || "none" },
          { entityType: "DocumentOutgoingWorkflow", entityId: document.outgoingWorkflow?.id || "none" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Extract all actor IDs from audit logs to resolve names & avatars
    const actorIds = Array.from(
      new Set(rawAuditEvents.map((e) => e.actorId).filter(Boolean) as string[])
    );
    const users = actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, role: true, title: true, avatarUrl: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Format Audit Log Trail
    const auditLogs: DocumentAuditLogItem[] = rawAuditEvents.map((evt) => {
      const actor = evt.actorId ? userMap.get(evt.actorId) : null;
      let notes: string | null = null;
      if (evt.afterData && typeof evt.afterData === "object") {
        const after = evt.afterData as Record<string, unknown>;
        if (typeof after.presenterNotes === "string") notes = after.presenterNotes;
        else if (typeof after.leadershipInstruction === "string") notes = after.leadershipInstruction;
        else if (typeof after.instruction === "string") notes = after.instruction;
        else if (typeof after.resolutionSummary === "string") notes = after.resolutionSummary;
        else if (typeof after.filingNotes === "string") notes = after.filingNotes;
        else if (typeof after.summary === "string") notes = after.summary;
      }

      return {
        id: evt.id,
        action: evt.action,
        actionLabel: ACTION_LABELS[evt.action] || evt.action,
        actorName: actor?.name || "Hệ thống QCET",
        actorRole: actor?.role || null,
        actorTitle: actor?.title || null,
        actorAvatar: actor?.avatarUrl || null,
        timestamp: evt.createdAt.toISOString(),
        notes,
        metadata: (evt.metadata as Record<string, unknown>) || null,
      };
    });

    // 4. Build 5-step Canonical Lifecycle Timeline (Decree 30/2020)
    const wf = document.incomingWorkflow;
    const directives = document.directives || [];
    const primaryDirective = directives[0];
    const unitAssignments = wf?.unitAssignments || [];
    const primaryAssignment = unitAssignments[0];

    const isDocOutbox = document.type === "VAN_BAN_DI";
    const outWf = document.outgoingWorkflow;

    let steps: DocumentTimelineStep[] = [];

    if (isDocOutbox && outWf) {
      // Outgoing document 5-step workflow
      const isDraftDone = true;
      const isFormatDone = Boolean(outWf.formatApprovedAt);
      const isContentDone = Boolean(outWf.contentApprovedAt);
      const isSignedDone = Boolean(outWf.authorizedSignedAt || outWf.orgSignedAt);
      const isIssuedDone = Boolean(outWf.issuedAt || outWf.deliveredAt);

      steps = [
        {
          id: "step-1",
          stepNumber: 1,
          key: "DRAFT",
          title: "Soạn thảo dự thảo",
          subtitle: "Đơn vị soạn thảo khởi tạo văn bản đi",
          status: isDraftDone ? "completed" : "current",
          actorName: document.registeredBy?.name || "Chuyên viên soạn thảo",
          actorTitle: document.registeredBy?.title || null,
          actorAvatar: document.registeredBy?.avatarUrl || null,
          timestamp: document.createdAt.toISOString(),
          notes: document.summary || "Khởi tạo dự thảo văn bản đi theo mẫu NĐ 30/2020",
        },
        {
          id: "step-2",
          stepNumber: 2,
          key: "FORMAT_REVIEW",
          title: "Thẩm định thể thức",
          subtitle: "Văn thư kiểm tra thể thức và kỹ thuật trình bày",
          status: isFormatDone ? "completed" : isDraftDone && !isContentDone ? "current" : "pending",
          actorName: outWf.formatReviewer?.name || (isFormatDone ? "Văn thư kiểm tra" : null),
          actorTitle: outWf.formatReviewer?.title || "Văn thư",
          actorAvatar: outWf.formatReviewer?.avatarUrl || null,
          timestamp: outWf.formatApprovedAt?.toISOString() || null,
          notes: isFormatDone ? "Thể thức và kỹ thuật trình bày đạt chuẩn NĐ 30/2020" : null,
        },
        {
          id: "step-3",
          stepNumber: 3,
          key: "CONTENT_REVIEW",
          title: "Phê duyệt nội dung",
          subtitle: "Trưởng đơn vị / Phụ trách duyệt nội dung",
          status: isContentDone ? "completed" : isFormatDone ? "current" : "pending",
          actorName: outWf.contentReviewer?.name || (isContentDone ? "Trưởng đơn vị" : null),
          actorTitle: outWf.contentReviewer?.title || null,
          actorAvatar: outWf.contentReviewer?.avatarUrl || null,
          timestamp: outWf.contentApprovedAt?.toISOString() || null,
          notes: isContentDone ? "Nội dung văn bản đã được kiểm tra và phê duyệt" : null,
        },
        {
          id: "step-4",
          stepNumber: 4,
          key: "SIGN_AND_NUMBER",
          title: "Ký số & Cấp số ban hành",
          subtitle: "Lãnh đạo ký số và Văn thư cấp số văn bản",
          status: isSignedDone ? "completed" : isContentDone ? "current" : "pending",
          actorName: outWf.authorizedSigner?.name || (document.signerName ?? null),
          actorTitle: outWf.authorizedSigner?.title || (document.signerTitle ?? "Lãnh đạo ký"),
          actorAvatar: outWf.authorizedSigner?.avatarUrl || null,
          timestamp: (outWf.authorizedSignedAt || outWf.orgSignedAt)?.toISOString() || null,
          notes: document.registrationNumber
            ? `Số văn bản: ${document.registrationNumber}/${document.documentYear} • Đã ký số cơ quan`
            : null,
        },
        {
          id: "step-5",
          stepNumber: 5,
          key: "ISSUE_AND_DELIVER",
          title: "Phát hành & Lưu trữ",
          subtitle: "Phát hành tới nơi nhận và vào sổ lưu trữ",
          status: isIssuedDone ? "completed" : isSignedDone ? "current" : "pending",
          actorName: outWf.issuer?.name || (isIssuedDone ? "Văn thư cơ quan" : null),
          actorTitle: outWf.issuer?.title || "Văn thư",
          actorAvatar: outWf.issuer?.avatarUrl || null,
          timestamp: (outWf.issuedAt || outWf.deliveredAt)?.toISOString() || null,
          notes: document.recipientList ? `Nơi nhận: ${document.recipientList}` : "Đã hoàn tất phát hành và lưu trữ hồ sơ",
        },
      ];
    } else {
      // Incoming document 5-step canonical workflow (Tiếp nhận -> Trình ký -> Chỉ đạo -> Giao đơn vị -> Hoàn thành)
      const isReceivedDone = true;
      const isPresentedDone = Boolean(wf?.presentedAt);
      const isDirectedDone = Boolean(wf?.directedAt || directives.length > 0);
      const isAssignedDone = Boolean(unitAssignments.length > 0 || document.linkedTaskId);
      const isCompletedDone = Boolean(
        wf?.resolvedAt ||
        wf?.filedAt ||
        wf?.status === "RESOLVED" ||
        wf?.status === "FILED" ||
        wf?.status === "ARCHIVED" ||
        document.status === "DA_HOAN_THANH"
      );

      // Determine step 1: Tiếp nhận
      const regActor = document.registeredBy;
      steps.push({
        id: "step-1",
        stepNumber: 1,
        key: "RECEIVED",
        title: "Tiếp nhận & Vào sổ",
        subtitle: "Văn thư tiếp nhận và cấp số đến",
        status: isReceivedDone ? "completed" : "current",
        actorName: regActor?.name || "Văn thư Trường",
        actorRole: regActor?.role || "VAN_THU",
        actorTitle: regActor?.title || "Văn thư",
        actorAvatar: regActor?.avatarUrl || null,
        timestamp: (document.registeredDate || document.createdAt).toISOString(),
        notes: document.registrationNumber
          ? `Số đến: ${document.registrationNumber}/${document.documentYear} • Số gốc: ${document.originalNumber}`
          : "Đã vào sổ đăng ký văn bản đến theo Nghị định 30/2020",
      });

      // Determine step 2: Trình ký / Trình BGH
      const presenter = wf?.presentedBy;
      steps.push({
        id: "step-2",
        stepNumber: 2,
        key: "PRESENTED",
        title: "Trình Ban Giám Hiệu",
        subtitle: "Văn thư lập phiếu trình Lãnh đạo Trường xem xét",
        status: isPresentedDone ? "completed" : isDirectedDone ? "completed" : "current",
        actorName: presenter?.name || (isPresentedDone || isDirectedDone ? "Văn thư Trường" : null),
        actorRole: presenter?.role || "VAN_THU",
        actorTitle: presenter?.title || "Văn thư",
        actorAvatar: presenter?.avatarUrl || null,
        timestamp: wf?.presentedAt?.toISOString() || null,
        notes: wf?.presenterNotes || (isPresentedDone ? "Đã chuyển phiếu trình Ban Giám Hiệu cho ý kiến chỉ đạo" : "Chờ Văn thư hoàn tất phiếu trình"),
      });

      // Determine step 3: Chỉ đạo & Bút phê BGH
      const leader = wf?.leader || primaryDirective?.leader;
      const instructionText =
        wf?.leadershipInstruction ||
        primaryDirective?.instruction ||
        (wf?.leadUnit ? `Giao đơn vị ${wf.leadUnit.name} chủ trì xử lý đúng hạn.` : null);

      steps.push({
        id: "step-3",
        stepNumber: 3,
        key: "DIRECTED",
        title: "Chỉ đạo & Bút phê BGH",
        subtitle: "Lãnh đạo Ban Giám Hiệu cho ý kiến phân công",
        status: isDirectedDone ? "completed" : isPresentedDone ? "current" : "pending",
        actorName: leader?.name || (isDirectedDone ? "Ban Giám Hiệu" : null),
        actorRole: leader?.role || "BAN_GIAM_HIEU",
        actorTitle: leader?.title || "Hiệu trưởng / Phó Hiệu trưởng",
        actorAvatar: leader?.avatarUrl || null,
        departmentName: wf?.leadUnit?.name || null,
        deadline: (wf?.deadline || primaryDirective?.deadline)?.toISOString() || document.dueDate?.toISOString() || null,
        timestamp: (wf?.directedAt || primaryDirective?.createdAt)?.toISOString() || null,
        notes: instructionText || (isDirectedDone ? "Đã có ý kiến chỉ đạo của Ban Giám Hiệu" : "Đang chờ ý kiến chỉ đạo của BGH"),
      });

      // Determine step 4: Giao đơn vị & Phân công tác nghiệp
      const assignedBy = primaryAssignment?.assignedBy;
      const dri = primaryAssignment?.driUser || document.leadUser;

      steps.push({
        id: "step-4",
        stepNumber: 4,
        key: "UNIT_ASSIGNED",
        title: "Giao đơn vị & Phân công DRI",
        subtitle: "Trưởng đơn vị phân công chuyên viên chủ trì",
        status: isAssignedDone ? "completed" : isDirectedDone ? "current" : "pending",
        actorName: assignedBy?.name || (isAssignedDone ? "Trưởng đơn vị" : null),
        actorRole: assignedBy?.role || "TRUONG_PHONG",
        actorTitle: assignedBy?.title || "Trưởng phòng/Khoa",
        actorAvatar: assignedBy?.avatarUrl || null,
        assignedToName: dri?.name || null,
        departmentName: primaryAssignment?.unit?.name || wf?.leadUnit?.name || null,
        deadline: primaryAssignment?.deadline?.toISOString() || null,
        timestamp: primaryAssignment?.createdAt?.toISOString() || null,
        notes: primaryAssignment?.instruction || (document.linkedTaskId ? `Đã liên thông nhiệm vụ QCET: ${document.linkedTaskId}` : isAssignedDone ? "Đã phân công chuyên viên thụ lý" : "Chờ Trưởng đơn vị phân công tác nghiệp"),
      });

      // Determine step 5: Giải quyết & Hoàn tất lưu trữ
      const resolver = wf?.resolvedBy || wf?.filedBy || wf?.archivedBy;

      steps.push({
        id: "step-5",
        stepNumber: 5,
        key: "COMPLETED",
        title: "Giải quyết & Lưu trữ hồ sơ",
        subtitle: "Chuyên viên báo cáo kết quả và lập hồ sơ công việc",
        status: isCompletedDone ? "completed" : isAssignedDone ? "current" : "pending",
        actorName: resolver?.name || (isCompletedDone ? "Chuyên viên & Văn thư" : null),
        actorRole: resolver?.role || null,
        actorTitle: resolver?.title || null,
        actorAvatar: resolver?.avatarUrl || null,
        timestamp: (wf?.resolvedAt || wf?.filedAt || wf?.archivedAt)?.toISOString() || null,
        notes: wf?.resolutionSummary || wf?.filingNotes || (isCompletedDone ? "Văn bản đã được giải quyết đầy đủ và lưu trữ hồ sơ theo NĐ 30/2020." : "Đang trong tiến độ giải quyết"),
      });
    }

    // Progress calculation
    const completedCount = steps.filter((s) => s.status === "completed").length;
    const progressPercent = Math.round((completedCount / steps.length) * 100);

    const payload = {
      documentId: id,
      documentNumber: document.originalNumber || String(document.registrationNumber || id),
      type: document.type,
      progressPercent,
      completedCount,
      totalSteps: steps.length,
      currentStep: steps.find((s) => s.status === "current") || steps[steps.length - 1],
      steps,
      auditLogs,
    };

    return apiSuccess(
      {
        success: true,
        data: payload,
        ...payload,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
        requestId,
      }
    );
  } catch (error) {
    return apiError(error, requestId, {
      headers: { "Cache-Control": "private, no-store" },
      legacyCompat: true,
    });
  }
}
