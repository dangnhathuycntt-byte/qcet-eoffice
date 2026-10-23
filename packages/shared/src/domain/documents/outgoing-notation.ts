/**
 * Ký hiệu văn bản đi theo loại (spec Văn bản G2, NĐ 30/2020/NĐ-CP Điều 8 và Phụ lục III mẫu 1.4 và 1.5). Thuần túy, không
 * đọc DB; Văn thư xem trước và sửa được trước khi cấp số.
 * - Văn bản có tên loại: `<viết tắt loại>-<viết tắt cơ quan>` (ví dụ `QĐ-CĐKTCNQN`).
 * - Công văn và loại không có trong Phụ lục III: `<viết tắt cơ quan>-<viết tắt đơn vị soạn thảo>` (ví dụ `CĐKTCNQN-QLĐT`);
 *   không rõ đơn vị soạn thì chỉ có viết tắt cơ quan.
 */
import { INSTITUTION_CONFIG } from "../../config/institution";

/**
 * Phụ lục III NĐ 30/2020/NĐ-CP, loại văn bản hành chính có tên loại, khớp danh sách "Hình thức" của hộp Soạn văn bản đi.
 * "Báo cáo tuần" là một dạng báo cáo. Loại ngoài bảng (Công văn, Kết luận, Nghị định, Thông tư, Phiếu trình, Hợp đồng lao
 * động, Khác…) không có chữ viết tắt do Nghị định quy định nên dùng dạng công văn thay vì tự đặt chữ viết tắt.
 */
export const OUTGOING_TYPE_ABBREVIATIONS: Readonly<Record<string, string>> = {
  "Nghị quyết": "NQ",
  "Quyết định": "QĐ",
  "Chỉ thị": "CT",
  "Quy chế": "QC",
  "Quy định": "QyĐ",
  "Thông cáo": "TC",
  "Thông báo": "TB",
  "Hướng dẫn": "HD",
  "Chương trình": "CTr",
  "Kế hoạch": "KH",
  "Phương án": "PA",
  "Đề án": "ĐA",
  "Dự án": "DA",
  "Báo cáo": "BC",
  "Báo cáo tuần": "BC",
  "Biên bản": "BB",
  "Tờ trình": "TTr",
  "Hợp đồng": "HĐ",
  "Công điện": "CĐ",
  "Bản ghi nhớ": "BGN",
  "Bản thỏa thuận": "BTT",
  "Giấy ủy quyền": "GUQ",
  "Giấy mời": "GM",
  "Giấy giới thiệu": "GGT",
  "Giấy nghỉ phép": "GNP",
  "Phiếu gửi": "PG",
  "Phiếu chuyển": "PC",
  "Phiếu báo": "PB",
};

const UNIT_PREFIX = /^(Phòng|Khoa|Trung tâm|TT|Ban)\s+/iu;
const CONNECTORS = new Set(["-", "–", "&", "và", "VÀ", "của"]);

/** Chuỗi chỉ gồm chữ in hoa, số, `&` và `-` (ví dụ `QLĐT`, `TCHC-QT`, `KT&ĐBCL`): đã là chữ viết tắt. */
const ALREADY_ABBREVIATED = /^[\p{Lu}\p{N}][\p{Lu}\p{N}&-]*$/u;

/**
 * Chữ viết tắt tên đơn vị trong ký hiệu. Lấy `shortName` của đơn vị nếu có, nếu không lấy tên; bỏ chữ đầu loại đơn vị
 * (Phòng, Khoa, Trung tâm, TT, Ban). Phần còn lại đã là chữ viết tắt (`Phòng QLĐT`) thì giữ, bỏ `&` và `-`; còn là tên
 * (`Khoa Cơ khí`) thì lấy chữ cái đầu mỗi từ, từ đã viết hoa toàn bộ (`HTVL`) giữ nguyên, bỏ từ nối (và, &, -).
 */
export function abbreviateUnitName(name: string, shortName?: string | null): string {
  const source = (shortName?.trim() || name.trim()).replace(UNIT_PREFIX, "").trim();
  if (!source) return "";
  if (ALREADY_ABBREVIATED.test(source)) return source.replace(/[&-]/g, "");
  return source
    .split(/\s+/)
    .filter((word) => word && !CONNECTORS.has(word))
    .map((word) => (ALREADY_ABBREVIATED.test(word) && word.length > 1 ? word.replace(/[&-]/g, "") : word.charAt(0).toLocaleUpperCase("vi")))
    .join("");
}

export interface OutgoingNotationUnit {
  name: string;
  shortName?: string | null;
  /** Đơn vị cấp trường: không thêm viết tắt đơn vị vào ký hiệu công văn. */
  isSchoolLevel?: boolean;
}

/** Ký hiệu mặc định của văn bản đi theo loại văn bản và đơn vị soạn thảo. */
export function deriveOutgoingNotation(input: { category?: string | null; unit?: OutgoingNotationUnit | null }): string {
  const organization = INSTITUTION_CONFIG.notationCode;
  const typeCode = OUTGOING_TYPE_ABBREVIATIONS[(input.category ?? "").trim()];
  if (typeCode) return `${typeCode}-${organization}`;
  const unit = input.unit && !input.unit.isSchoolLevel ? abbreviateUnitName(input.unit.name, input.unit.shortName) : "";
  return unit ? `${organization}-${unit}` : organization;
}

/** Ký hiệu chỉ gồm chữ, số, dấu chấm và gạch ngang (không có `/` hay khoảng trắng): nằm sau `số/` trong số văn bản. */
const OUTGOING_NOTATION_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}.-]*$/u;
const OUTGOING_NOTATION_MAX_LENGTH = 100;

export const OUTGOING_NOTATION_ERROR = "Ký hiệu chỉ gồm chữ, số, dấu chấm và gạch ngang, không có dấu gạch chéo hay khoảng trắng.";

/** Máy chủ và hộp Cấp số dùng chung để ký hiệu nhập tay hợp lệ ở cả hai nơi. */
export function isValidOutgoingNotation(notation: string): boolean {
  return notation.length <= OUTGOING_NOTATION_MAX_LENGTH && OUTGOING_NOTATION_PATTERN.test(notation);
}
