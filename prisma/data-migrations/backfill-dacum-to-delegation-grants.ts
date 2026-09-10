import { PrismaClient, DelegationStatus, AssignmentStatus } from "@prisma/client";

export interface DacumBackfillReport {
  totalLegacyDacumDelegations: number;
  delegationGrantsCreated: number;
  delegationGrantsExisting: number;
  paritySuccess: boolean;
  mismatchCount: number;
  unresolvedAssignments: Array<{ dacumId: string; reason: string }>;
}

export async function backfillDacumToDelegationGrants(
  client?: PrismaClient,
  options: { dryRun?: boolean } = {}
): Promise<DacumBackfillReport> {
  const prisma = client || new PrismaClient();
  const dryRun = !!options.dryRun;

  console.log(`[DataMigration:Dacum->DelegationGrants] Bắt đầu backfill (${dryRun ? "DRY-RUN" : "EXECUTE"})...`);

  const dacumDelegations = await prisma.dacumDelegation.findMany({
    include: {
      grantor: {
        include: {
          positionAssignments: {
            where: { status: AssignmentStatus.ACTIVE },
          },
        },
      },
      delegate: {
        include: {
          positionAssignments: {
            where: { status: AssignmentStatus.ACTIVE },
          },
        },
      },
    },
  });

  console.log(`[DataMigration:Dacum->DelegationGrants] Tìm thấy ${dacumDelegations.length} dacum delegations.`);

  let delegationGrantsCreated = 0;
  let delegationGrantsExisting = 0;
  let mismatchCount = 0;
  const unresolvedAssignments: Array<{ dacumId: string; reason: string }> = [];

  const now = new Date();

  for (const dacum of dacumDelegations) {
    const grantorAssignment = dacum.grantor.positionAssignments[0];
    const granteeAssignment = dacum.delegate.positionAssignments[0];

    if (!grantorAssignment) {
      unresolvedAssignments.push({
        dacumId: dacum.id,
        reason: `Grantor (${dacum.grantorId}) không có PositionAssignment ACTIVE`,
      });
      mismatchCount++;
      continue;
    }

    if (!granteeAssignment) {
      unresolvedAssignments.push({
        dacumId: dacum.id,
        reason: `Grantee (${dacum.delegateId}) không có PositionAssignment ACTIVE`,
      });
      mismatchCount++;
      continue;
    }

    const docNumber = dacum.documentRef || `DACUM-REF-${dacum.id}`;

    // Xác định status
    let targetStatus: DelegationStatus = DelegationStatus.ACTIVE;
    if (!dacum.isActive) {
      targetStatus = DelegationStatus.REVOKED;
    } else if (dacum.expiresAt && dacum.expiresAt < now) {
      targetStatus = DelegationStatus.EXPIRED;
    }

    // Kiểm tra xem đã có DelegationGrant nào tương đương chưa
    const existingGrant = await prisma.delegationGrant.findFirst({
      where: {
        grantorAssignmentId: grantorAssignment.id,
        granteeAssignmentId: granteeAssignment.id,
        sourceDocumentNumber: docNumber,
      },
    });

    if (existingGrant) {
      delegationGrantsExisting++;
    } else {
      if (!dryRun) {
        await prisma.delegationGrant.create({
          data: {
            grantorAssignmentId: grantorAssignment.id,
            granteeAssignmentId: granteeAssignment.id,
            action: dacum.authorityScope || "task.approve",
            resourceScope: dacum.departmentId ? "DEPARTMENT" : "ALL",
            validFrom: dacum.startDate ?? dacum.createdAt,
            validUntil: dacum.expiresAt ?? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
            sourceDocumentNumber: docNumber,
            reason: dacum.reason || dacum.committeeRole,
            status: targetStatus,
          },
        });
      }
      delegationGrantsCreated++;
    }
  }

  // Verification
  let paritySuccess = mismatchCount === 0;
  if (!dryRun) {
    for (const dacum of dacumDelegations) {
      const docNumber = dacum.documentRef || `DACUM-REF-${dacum.id}`;
      const found = await prisma.delegationGrant.findFirst({
        where: {
          sourceDocumentNumber: docNumber,
        },
      });
      if (!found) {
        paritySuccess = false;
        mismatchCount++;
      }
    }
  }

  const report: DacumBackfillReport = {
    totalLegacyDacumDelegations: dacumDelegations.length,
    delegationGrantsCreated,
    delegationGrantsExisting,
    paritySuccess,
    mismatchCount,
    unresolvedAssignments,
  };

  console.log("[DataMigration:Dacum->DelegationGrants] Báo cáo kết quả:", JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1]?.includes("backfill-dacum-to-delegation-grants")) {
  const isDryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient();
  backfillDacumToDelegationGrants(prisma, { dryRun: isDryRun })
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}
