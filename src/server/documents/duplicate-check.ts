/**
 * Kiểm văn bản đến trùng số ký hiệu và cơ quan ban hành trước khi vào sổ (V-02).
 *
 * Chỉ trả văn bản người dùng có quyền đọc (buildDocumentReadWhere), để không
 * tiết lộ sự tồn tại của văn bản bị ẩn. Trùng chỉ là cảnh báo: người đăng ký
 * xác nhận bằng acknowledgeDuplicate thì vẫn vào sổ (quyết định Q4).
 */
import { DocumentType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError } from "@/server/api/errors";
import { buildDocumentReadWhere } from "@/server/policies/document-policy";
import {
  isPlaceholderDocumentNumber,
  isSameIncomingDocument,
} from "@/domain/documents/duplicate-key";

export interface DuplicateDocumentMatch {
  id: string;
  registrationNumber: number;
  documentYear: number;
  originalNumber: string;
  issuingAuthority: string;
  registeredDate: string;
  summary: string;
}

export const DUPLICATE_SUSPECT_CODE = "DUPLICATE_SUSPECT";

type ReadScope = Parameters<typeof buildDocumentReadWhere>[0];

export async function findSuspectedDuplicates(
  user: ReadScope,
  input: { originalNumber?: string | null; issuingAuthority?: string | null },
  options: { excludeId?: string } = {}
): Promise<DuplicateDocumentMatch[]> {
  const originalNumber = input.originalNumber?.trim() ?? "";
  if (isPlaceholderDocumentNumber(originalNumber) || !input.issuingAuthority?.trim()) return [];

  // Lọc thô theo số ký hiệu ở DB, so cơ quan ban hành sau chuẩn hóa ở bộ nhớ.
  const where: Prisma.DocumentWhereInput = {
    AND: [
      buildDocumentReadWhere(user),
      {
        type: DocumentType.VAN_BAN_DEN,
        originalNumber: { equals: originalNumber, mode: "insensitive" },
        ...(options.excludeId ? { id: { not: options.excludeId } } : {}),
      },
    ],
  };

  const candidates = await prisma.document.findMany({
    where,
    select: {
      id: true,
      registrationNumber: true,
      documentYear: true,
      originalNumber: true,
      issuingAuthority: true,
      registeredDate: true,
      summary: true,
    },
    orderBy: { registeredDate: "desc" },
    take: 20,
  });

  return candidates
    .filter((doc) => isSameIncomingDocument(doc, { originalNumber, issuingAuthority: input.issuingAuthority }))
    .slice(0, 5)
    .map((doc) => ({ ...doc, registeredDate: doc.registeredDate.toISOString() }));
}

export async function assertNoSuspectedDuplicate(
  user: ReadScope,
  input: { originalNumber?: string | null; issuingAuthority?: string | null; acknowledgeDuplicate?: boolean | null }
): Promise<void> {
  if (input.acknowledgeDuplicate) return;
  const matches = await findSuspectedDuplicates(user, input);
  if (matches.length > 0) {
    throw new ConflictError(
      "Đã có văn bản đến cùng số ký hiệu và cơ quan ban hành. Kiểm tra lại hoặc xác nhận vẫn vào sổ.",
      DUPLICATE_SUSPECT_CODE
    );
  }
}
