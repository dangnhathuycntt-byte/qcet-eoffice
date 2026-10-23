/**
 * Cấp số văn bản đi (spec Văn bản G2, G3; NĐ 30/2020/NĐ-CP Điều 15): ký hiệu mặc định theo loại và đơn vị soạn, ngày ban hành
 * và năm của dãy số theo múi giờ Việt Nam. Dùng chung cho lệnh cấp số và bản xem trước của hộp Cấp số.
 */
import { prisma } from "@qcet/db/prisma";
import { ValidationError } from "@/server/api/errors";
import { getTodayIctDate, parseStrictDateOnly } from "@qcet/shared/lib/academic-calendar";
import {
  OUTGOING_NOTATION_ERROR,
  deriveOutgoingNotation,
  isValidOutgoingNotation,
} from "@qcet/shared/domain/documents/outgoing-notation";

export function assertValidNotation(notation: string): void {
  if (!isValidOutgoingNotation(notation)) {
    throw new ValidationError(OUTGOING_NOTATION_ERROR, { codeNotation: ["Ký hiệu không hợp lệ"] }, "INVALID_NOTATION");
  }
}

/** Năm của dãy số: năm theo múi giờ Việt Nam (máy chủ có thể chạy UTC nên không dùng `getFullYear`). */
export function currentNumberingYear(today: string = getTodayIctDate()): number {
  return Number(today.slice(0, 4));
}

/**
 * Khoảng ngày ban hành được chọn: từ ngày ký (nhưng không trước 01/01 của năm dãy số, vì số bắt đầu lại mỗi năm) đến hôm nay.
 * Ngày là chuỗi `YYYY-MM-DD` theo múi giờ Việt Nam.
 */
export function issuedDateBounds(authorizedSignedAt: Date, today: string = getTodayIctDate()): { min: string; max: string } {
  const signedDay = parseStrictDateOnly(authorizedSignedAt) ?? today;
  const startOfYear = `${today.slice(0, 4)}-01-01`;
  return { min: signedDay > startOfYear ? signedDay : startOfYear, max: today };
}

/** Ngày ban hành người dùng chọn (`undefined` = hôm nay); ném lỗi nếu ngoài khoảng cho phép. Trả `YYYY-MM-DD`. */
export function resolveIssuedDate(input: Date | string | undefined, bounds: { min: string; max: string }): string | null {
  if (input === undefined || input === null || input === "") return null;
  const day = parseStrictDateOnly(input);
  if (!day) {
    throw new ValidationError("Ngày ban hành không hợp lệ.", { issuedDate: ["Ngày không hợp lệ"] }, "INVALID_ISSUED_DATE");
  }
  if (day < bounds.min || day > bounds.max) {
    throw new ValidationError(
      `Ngày ban hành phải từ ${bounds.min} (ngày ký, trong năm cấp số) đến ${bounds.max} (hôm nay).`,
      { issuedDate: ["Ngoài khoảng cho phép"] },
      "INVALID_ISSUED_DATE"
    );
  }
  return day;
}

/** Ký hiệu mặc định của một văn bản đi: theo hình thức văn bản và đơn vị soạn thảo của dự thảo. */
export async function resolveDefaultNotation(input: {
  category: string | null;
  draftingUnitId: string | null;
}): Promise<string> {
  const unit = input.draftingUnitId
    ? await prisma.organizationalUnit.findUnique({
        where: { id: input.draftingUnitId },
        select: { name: true, type: true, metadata: true },
      })
    : null;
  const shortName = (unit?.metadata as { shortName?: unknown } | null)?.shortName;
  return deriveOutgoingNotation({
    category: input.category,
    unit: unit
      ? { name: unit.name, shortName: typeof shortName === "string" ? shortName : null, isSchoolLevel: unit.type === "SCHOOL" }
      : null,
  });
}
