/**
 * OBSOLETE — Phase 9: TaskAssignee table dropped.
 * The backfill from TaskAssignee → TaskActor was completed before the table was dropped.
 * This module is kept as a no-op stub so run-all.ts compiles without modification.
 */
import { PrismaClient } from "@prisma/client";

export interface AssigneesBackfillReport {
  totalLegacyAssignees: number;
  driCreatedOrUpdated: number;
  collaboratorsCreated: number;
  supervisorsCreated: number;
  assignersCreated: number;
  leadUnitsCreated: number;
  paritySuccess: boolean;
  mismatchedAssignees: number;
}

export async function backfillAssigneesToActors(
  _client?: PrismaClient,
  _options: { dryRun?: boolean } = {}
): Promise<AssigneesBackfillReport> {
  console.log("[DataMigration:Assignees->Actors] OBSOLETE: TaskAssignee table was dropped in Phase 9. Skipping.");
  return {
    totalLegacyAssignees: 0,
    driCreatedOrUpdated: 0,
    collaboratorsCreated: 0,
    supervisorsCreated: 0,
    assignersCreated: 0,
    leadUnitsCreated: 0,
    paritySuccess: true,
    mismatchedAssignees: 0,
  };
}
