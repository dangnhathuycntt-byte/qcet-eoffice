/**
 * Thao tác của văn bản đi mà người xem được làm lúc này và việc đang chờ (`outgoingStep` của chi tiết văn bản).
 * Server quyết định nút hiện: cùng cổng với lệnh ghi (`runOutgoingStepGate`), nên nút hiện thì bấm được, và người
 * không đến lượt chỉ thấy "Đang chờ …" thay vì nút dẫn tới 403.
 */
import { prisma } from "@qcet/db/prisma";
import type { OutgoingDocumentStatus } from "@prisma/client";
import type { OutgoingDocumentStatus as ContractStatus } from "@qcet/contracts/documents";
import type { DocumentItem } from "@qcet/contracts/types/document";
import {
  describeOutgoingWaiting,
  outgoingStepSlugsForState,
  type OutgoingStepSlug,
  type OutgoingStepView,
} from "@qcet/shared/domain/documents/outgoing-steps";
import { authorize } from "@/server/authorization/hybrid-authorization";
import type { AuthenticatedUser } from "@/server/api/request-context";
import { ForbiddenError } from "@/server/api/errors";
import { resolveUserContext } from "@/server/documents/incoming-document-service";
import { runOutgoingStepGate, type OutgoingStepSubject } from "@/server/documents/outgoing-document-service";

interface WorkflowRow {
  status: OutgoingDocumentStatus;
  contentReviewerId: string | null;
  formatReviewerId: string | null;
  authorizedSignerId: string | null;
  draftingUnitId: string | null;
  contentReviewSubmittedAt: Date | null;
  formatReviewSubmittedAt: Date | null;
  formatApprovedAt: Date | null;
  authorizedSignedAt: Date | null;
  numberedAt: Date | null;
  orgSignedAt: Date | null;
}

export async function buildOutgoingStepView(
  authUser: AuthenticatedUser,
  document: DocumentItem
): Promise<OutgoingStepView | null> {
  const workflow = document.outgoingWorkflow as WorkflowRow | null | undefined;
  if (document.type !== "VAN_BAN_DI" || !workflow) return null;

  const user = await resolveUserContext(authUser as never);
  const subject: OutgoingStepSubject = {
    documentId: document.id,
    status: workflow.status,
    contentReviewerId: workflow.contentReviewerId,
    formatReviewerId: workflow.formatReviewerId,
    authorizedSignerId: workflow.authorizedSignerId,
    draftingUnitId: workflow.draftingUnitId,
    document: { registeredById: document.registeredById, signerName: document.signerName ?? null },
  };

  const canDo = async (step: OutgoingStepSlug): Promise<boolean> => {
    try {
      await runOutgoingStepGate(step, user, subject, async (action, resource) => {
        const decision = await authorize(user, action, resource);
        if (!decision.allowed) throw new ForbiddenError(decision.reason || "Không đủ quyền thực hiện bước này.");
      });
      return true;
    } catch (error) {
      if (error instanceof ForbiddenError) return false;
      throw error;
    }
  };

  const candidates = outgoingStepSlugsForState(workflow.status as ContractStatus, workflow.authorizedSignedAt);
  const allowed = await Promise.all(candidates.map(canDo));
  const actions = candidates.filter((_, index) => allowed[index]);

  const reviewerIds = [workflow.contentReviewerId, workflow.authorizedSignerId].filter((id): id is string => Boolean(id));
  const names = reviewerIds.length
    ? new Map(
        (await prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true } })).map((u) => [
          u.id,
          u.name,
        ])
      )
    : new Map<string, string>();

  return {
    actions,
    waiting: describeOutgoingWaiting({
      ...workflow,
      status: workflow.status as ContractStatus,
      contentReviewerName: workflow.contentReviewerId ? names.get(workflow.contentReviewerId) : null,
      authorizedSignerName: workflow.authorizedSignerId ? names.get(workflow.authorizedSignerId) : null,
    }),
  };
}
