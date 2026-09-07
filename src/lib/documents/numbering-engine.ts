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

/**
 * In-memory simulation of atomic sequence numbering across concurrent requests.
 */
export async function simulateAtomicNumbering(
  type: DocumentType,
  year: number,
  storage: Map<string, number>
): Promise<number> {
  const key = `${type}_${year}`;
  const current = storage.get(key) || 0;
  const next = current + 1;
  storage.set(key, next);
  return next;
}

/**
 * Atomic auto-increment numbering engine backed by Prisma DocumentNumberSequence.
 * Guarantees consecutive, non-repeating numbers per (type, year).
 */
export async function getNextRegistrationNumber(
  type: DocumentType,
  year: number,
  client?: any
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

  return await db.$transaction(async (tx: any) => {
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
    });
    return sequence.lastNumber;
  });
}

/**
 * Convenience alias for formatDocumentDisplayNumber.
 */
export const formatRegistrationNumber = formatDocumentDisplayNumber;
