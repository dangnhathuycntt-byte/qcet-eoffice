/**
 * Responsibility Area & Portfolio Assignment Domain Service (QĐ 420/QĐ-CĐKTCNQN)
 *
 * Implements governance management of 11 canonical responsibility areas
 * assigned to School Leadership (Ban Giám hiệu) and Unit Leaders:
 * 1. BGH_CHUNG: Chỉ đạo, điều hành chung toàn diện
 * 2. NOI_VU_TO_CHUC: Công tác tổ chức cán bộ, nội vụ, bảo vệ chính trị nội bộ
 * 3. DAO_TAO_QLSV: Công tác đào tạo, tuyển sinh và công tác HSSV
 * 4. TAI_CHINH_CSVC: Tài chính, kế toán, cơ sở vật chất, đầu tư công
 * 5. NCKH_HTQT: Nghiên cứu khoa học, chuyển giao công nghệ, hợp tác quốc tế
 * 6. DOAN_THE_CTCT: Công tác Đảng, Đoàn thể, Công tác chính trị tư tưởng
 * 7. KHAO_THI_KDKL: Khảo thí, bảo đảm chất lượng, kiểm định chất lượng GDNN
 * 8. CNTT_CHUYEN_DOI_SO: Chuyển đổi số, an toàn thông tin, thư viện điện tử
 * 9. TU_VAN_TS_VL: Tư vấn học đường, hướng nghiệp và kết nối việc làm
 * 10. KT_DAP_UNG_XA_HOI: Đào tạo ngắn hạn, dịch vụ kỹ thuật đáp ứng xã hội
 * 11. QUAN_TRI_DOI_NGOAI: Quan hệ doanh nghiệp, xúc tiến đầu tư, đối ngoại
 *
 * Invariants Enforced:
 * - Portfolio assignments must link to an ACTIVE leadership PositionAssignment.
 * - Effective-dated temporal bounds (effectiveFrom <= effectiveTo).
 * - Prevention of conflicting/duplicate active portfolio assignments for the same area.
 * - Atomic database writes & audit logging.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, ResponsibilityArea, PortfolioAssignment } from "@prisma/client";
import { AssignmentStatus } from "@prisma/client";
import { ValidationError, ConflictError, NotFoundError } from "@/server/api/errors";
import { auditService, AuditAction, AuditEntityType } from "@/lib/db/audit";

export interface AssignPortfolioInput {
  positionAssignmentId: string;
  responsibilityAreaId: string;
  isPrimary?: boolean;
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
  decisionNumber?: string;
  notes?: string;
}

export interface EndPortfolioInput {
  portfolioAssignmentId: string;
  endDate: Date | string;
  notes?: string;
}

export interface PortfolioQueryFilter {
  positionAssignmentId?: string;
  responsibilityAreaId?: string;
  isPrimary?: boolean;
  activeAt?: Date | string;
}

export class ResponsibilityPortfolioService {
  /**
   * 1. List all canonical responsibility areas.
   */
  static async listResponsibilityAreas(): Promise<ResponsibilityArea[]> {
    return await prisma.responsibilityArea.findMany({
      orderBy: [{ category: "asc" }, { code: "asc" }],
      include: {
        portfolioAssignments: {
          where: {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: new Date() } },
            ],
          },
          include: {
            positionAssignment: {
              include: {
                user: { select: { id: true, name: true, email: true } },
                positionDefinition: true,
                unit: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * 2. Get responsibility area by code.
   */
  static async getResponsibilityAreaByCode(code: string): Promise<ResponsibilityArea | null> {
    return await prisma.responsibilityArea.findUnique({
      where: { code },
      include: {
        portfolioAssignments: {
          include: {
            positionAssignment: {
              include: {
                user: { select: { id: true, name: true, email: true } },
                positionDefinition: true,
                unit: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * 3. Assign a responsibility portfolio to a position assignment.
   */
  static async assignPortfolio(
    actor: { id: string; name?: string },
    input: AssignPortfolioInput
  ): Promise<PortfolioAssignment> {
    const effectiveFrom = new Date(input.effectiveFrom);
    const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;

    if (effectiveTo && effectiveFrom > effectiveTo) {
      throw new ValidationError(
        `Ngày bắt đầu (${effectiveFrom.toISOString()}) không được sau ngày kết thúc (${effectiveTo.toISOString()})`
      );
    }

    // 1. Verify PositionAssignment
    const assignment = await prisma.positionAssignment.findUnique({
      where: { id: input.positionAssignmentId },
      include: {
        positionDefinition: true,
        user: { select: { id: true, name: true } },
      },
    });

    if (!assignment) {
      throw new NotFoundError(`Không tìm thấy phân công chức vụ: ${input.positionAssignmentId}`);
    }

    if (assignment.status !== AssignmentStatus.ACTIVE) {
      throw new ValidationError(
        `Không thể phân công mảng phụ trách cho vị trí không còn hiệu lực (${assignment.status})`
      );
    }

    // 2. Verify ResponsibilityArea
    const area = await prisma.responsibilityArea.findUnique({
      where: { id: input.responsibilityAreaId },
    });

    if (!area) {
      throw new NotFoundError(`Không tìm thấy mảng trách nhiệm: ${input.responsibilityAreaId}`);
    }

    // 3. Conflict Check: check if there is an overlapping assignment for the same position and area
    const existingActive = await prisma.portfolioAssignment.findFirst({
      where: {
        positionAssignmentId: input.positionAssignmentId,
        responsibilityAreaId: input.responsibilityAreaId,
        OR: [
          // Case 1: Existing has no end date, and starts before or at new start
          {
            effectiveTo: null,
          },
          // Case 2: Overlapping date range
          {
            effectiveFrom: { lte: effectiveTo ?? new Date("2099-12-31") },
            effectiveTo: { gte: effectiveFrom },
          },
        ],
      },
    });

    if (existingActive) {
      throw new ConflictError(
        `Mảng trách nhiệm '${area.name}' đã được phân công cho cán bộ '${assignment.user.name}' trong khoảng thời gian này.`
      );
    }

    return await prisma.$transaction(async (tx) => {
      const portfolio = await tx.portfolioAssignment.create({
        data: {
          positionAssignmentId: input.positionAssignmentId,
          responsibilityAreaId: input.responsibilityAreaId,
          effectiveFrom,
          effectiveTo,
          sourceDecisionNumber: input.decisionNumber,
        },
        include: {
          responsibilityArea: true,
          positionAssignment: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              positionDefinition: true,
            },
          },
        },
      });

      // Audit Log
      await auditService.logEvent(tx, {
        actorId: actor.id,
        action: AuditAction.PORTFOLIO_ASSIGNED,
        entityType: AuditEntityType.PORTFOLIO_ASSIGNMENT,
        entityId: portfolio.id,
        afterData: {
          user: assignment.user.name,
          position: assignment.positionDefinition.title,
          area: area.name,
          category: area.category,
          isPrimary: input.isPrimary,
          effectiveFrom,
          effectiveTo,
          decisionNumber: input.decisionNumber,
        },
      });

      return portfolio;
    });
  }

  /**
   * 4. Terminate / End a portfolio assignment.
   */
  static async endPortfolioAssignment(
    actor: { id: string; name?: string },
    input: EndPortfolioInput
  ): Promise<PortfolioAssignment> {
    const endDate = new Date(input.endDate);

    const portfolio = await prisma.portfolioAssignment.findUnique({
      where: { id: input.portfolioAssignmentId },
      include: {
        responsibilityArea: true,
        positionAssignment: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!portfolio) {
      throw new NotFoundError(`Không tìm thấy phân công mảng trách nhiệm: ${input.portfolioAssignmentId}`);
    }

    if (new Date(portfolio.effectiveFrom) > endDate) {
      throw new ValidationError(
        `Ngày kết thúc (${endDate.toISOString()}) không thể trước ngày bắt đầu (${new Date(
          portfolio.effectiveFrom
        ).toISOString()})`
      );
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.portfolioAssignment.update({
        where: { id: input.portfolioAssignmentId },
        data: {
          effectiveTo: endDate,
        },
        include: {
          responsibilityArea: true,
          positionAssignment: {
            include: {
              user: { select: { id: true, name: true } },
              positionDefinition: true,
            },
          },
        },
      });

      await auditService.logEvent(tx, {
        actorId: actor.id,
        action: AuditAction.PORTFOLIO_TERMINATED,
        entityType: AuditEntityType.PORTFOLIO_ASSIGNMENT,
        entityId: updated.id,
        afterData: {
          user: portfolio.positionAssignment.user.name,
          area: portfolio.responsibilityArea.name,
          endDate,
          notes: input.notes,
        },
      });

      return updated;
    });
  }

  /**
   * 5. Get active portfolios for a position assignment at a given date.
   */
  static async getActivePortfoliosForAssignment(
    assignmentId: string,
    atDate: Date = new Date()
  ): Promise<PortfolioAssignment[]> {
    return await prisma.portfolioAssignment.findMany({
      where: {
        positionAssignmentId: assignmentId,
        effectiveFrom: { lte: atDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: atDate } }],
      },
      include: {
        responsibilityArea: true,
      },
    });
  }

  /**
   * 6. Get all active portfolio assignments for a responsibility area at a given date.
   */
  static async getPortfoliosForArea(
    areaId: string,
    atDate: Date = new Date()
  ): Promise<PortfolioAssignment[]> {
    return await prisma.portfolioAssignment.findMany({
      where: {
        responsibilityAreaId: areaId,
        effectiveFrom: { lte: atDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: atDate } }],
      },
      include: {
        positionAssignment: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            positionDefinition: true,
            unit: true,
          },
        },
      },
    });
  }
}
