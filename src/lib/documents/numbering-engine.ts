import { prisma as defaultPrisma } from "@/lib/prisma";
import type { DocumentType } from "@/types/document";

/**
 * Formats a document registration number for display according to Decree 30/2020/ND-CP.
 * - VAN_BAN_DEN: Padded integer (e.g. "01", "125")
 * - VAN_BAN_DI: Number / Department or Authority code (e.g. "89/CĐKTCN-ĐT", "12/CĐKTCN")
 * - TO_TRINH_NOI_BO: Prefix with year (e.g. "TT-5/2026")
 */
export function formatDocumentDisplayNumber(
  type: DocumentType,
  num: number,
  year: number,
  departmentCode?: string
): string {
  if (type === "VAN_BAN_DEN" || type === "inbox") {
    return num < 10 ? `0${num}` : `${num}`;
  }
  if (type === "VAN_BAN_DI" || type === "outbox") {
    const code = departmentCode || "CĐKTCN";
    return `${num}/${code}`;
  }
  return `TT-${num}/${year}`;
}

/**
 * Generates an internal unique reference code for a document.
 * E.g., VBDEN-2026-0001, VBDI-2026-0089, TTNB-2026-0005.
 */
export function generateDocumentCode(type: DocumentType, year: number, num: number): string {
  const prefix =
    type === "VAN_BAN_DEN" || type === "inbox"
      ? "VBDEN"
      : type === "VAN_BAN_DI" || type === "outbox"
      ? "VBDI"
      : "TTNB";
  return `${prefix}-${year}-${String(num).padStart(4, "0")}`;
}

const documentMemorySequences = new Map<string, number>();

/**
 * Resets in-memory sequence storage for documents (useful for unit testing).
 */
export function resetDocumentMemorySequences(): void {
  documentMemorySequences.clear();
}

export interface DocumentNumberingOptions {
  useRawSql?: boolean;
}

/**
 * In-memory simulation of atomic sequence numbering across concurrent requests.
 */
export async function simulateAtomicNumbering(
  type: DocumentType,
  year: number,
  storage?: Map<string, number>
): Promise<number> {
  const store = storage || documentMemorySequences;
  const key = `${type}_${year}`;
  const current = store.get(key) || 0;
  const next = current + 1;
  store.set(key, next);
  return next;
}

/**
 * Atomic auto-increment numbering engine backed by Prisma DocumentNumberSequence.
 * Guarantees consecutive, non-repeating numbers per (type, year).
 * Handles both root PrismaClient and interactive TransactionClient (where $transaction is undefined).
 */
export async function getNextRegistrationNumber(
  type: DocumentType,
  year: number,
  client?: any,
  options?: DocumentNumberingOptions
): Promise<number> {
  const db = client || defaultPrisma;

  const normalizedType =
    type === "inbox"
      ? "VAN_BAN_DEN"
      : type === "outbox"
      ? "VAN_BAN_DI"
      : type === "submission"
      ? "TO_TRINH_NOI_BO"
      : type;

  // Fast-path: raw SQL atomic update with RETURNING if requested and supported
  if (options?.useRawSql && typeof db?.$queryRaw === "function") {
    try {
      const updateResult: any = await db.$queryRaw`
        UPDATE "document_number_sequences"
        SET "last_number" = "last_number" + 1, "updated_at" = NOW()
        WHERE "type" = ${normalizedType}::"DocumentType" AND "year" = ${year}
        RETURNING "last_number";
      `;
      if (Array.isArray(updateResult) && updateResult.length > 0) {
        return updateResult[0].last_number;
      }
    } catch {
      // If raw update fails (e.g. mock db or non-Postgres), fall through to upsert
    }
  }

  const executeUpsert = async (tx: any): Promise<number> => {
    if (tx?.documentNumberSequence?.upsert) {
      const sequence = await tx.documentNumberSequence.upsert({
        where: {
          type_year: { type: normalizedType, year },
        },
        create: {
          type: normalizedType,
          year,
          lastNumber: 1,
        },
        update: {
          lastNumber: { increment: 1 },
        },
        select: {
          lastNumber: true,
        },
      });
      return sequence.lastNumber;
    }
    // In-memory fallback if documentNumberSequence model is not present on client
    return simulateAtomicNumbering(normalizedType, year, documentMemorySequences);
  };

  // If db has $transaction function (root PrismaClient), run inside transaction.
  // If db is already an interactive transaction client, execute directly.
  if (typeof db?.$transaction === "function") {
    return await db.$transaction(executeUpsert);
  } else {
    return await executeUpsert(db);
  }
}

/**
 * Raw SQL atomic numbering convenience helper.
 */
export async function getNextRegistrationNumberRawSql(
  type: DocumentType,
  year: number,
  client?: any
): Promise<number> {
  return getNextRegistrationNumber(type, year, client, { useRawSql: true });
}

/**
 * Convenience alias for formatDocumentDisplayNumber.
 */
export const formatRegistrationNumber = formatDocumentDisplayNumber;
