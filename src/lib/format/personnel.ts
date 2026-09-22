/**
 * Chuẩn hóa tên người phụ trách:
 * - Chỉ hiển thị học vị + họ tên (ví dụ: "ThS. Phạm Văn Tường")
 * - Bỏ chức vụ / phần trong ngoặc đơn (...), ngoặc vuông [...], hoặc sau dấu gạch ngang
 * - Hiển thị đủ tên (không bị cắt ngắn)
 * - Tra cứu dữ liệu danh bạ nhân sự để lấy học vị nếu tên gốc chưa kèm học vị
 *
 * @param rawName - Tên gốc cần chuẩn hóa
 * @param personnelDirectory - Danh sách nhân sự (từ usePersonnelList hook) để tra cứu học vị.
 *   Nếu không truyền, bỏ qua bước lookup — trả tên đã clean.
 */
export function formatAssigneeNameWithTitle(
  rawName?: string | null,
  personnelDirectory?: Array<{ name: string; title?: string }>,
): string {
  if (!rawName) return "Chưa phân công";
  const trimmed = rawName.trim();
  if (!trimmed || trimmed.toLowerCase().includes("chưa phân công")) {
    return "Chưa phân công";
  }

  // 1. Loại bỏ các phần chú thích chức vụ trong ngoặc: (Phó Hiệu trưởng), (PHT), [Trưởng phòng]...
  let cleanName = trimmed.replace(/\s*\([^)]*\)/g, "");
  cleanName = cleanName.replace(/\s*\[[^\]]*\]/g, "");
  // Loại bỏ phần chức vụ sau gạch ngang nếu có
  cleanName = cleanName.replace(
    /\s*-\s*(Hiệu trưởng|Phó Hiệu trưởng|Trưởng phòng|Phó Trưởng phòng|Trưởng khoa|Phó Trưởng khoa|Giảng viên|Chuyên viên|Kế toán|Giám đốc|Tổ trưởng|PHT|TP|TK).*$/i,
    ""
  );
  cleanName = cleanName.trim().replace(/\s+/g, " ");

  if (!cleanName) return "Chưa phân công";

  // 2. Kiểm tra xem tên đã có tiền tố học vị/học hàm chưa
  const academicPrefixRegex =
    /^(ThS\.|TS\.|PGS\.TS\.|GS\.TS\.|PGS\.|GS\.|BS\.|CN\.|KS\.|GVC\.|ThS\b|TS\b)\s*/i;
  const match = cleanName.match(academicPrefixRegex);

  if (match) {
    const rawPrefix = match[1];
    let normalizedPrefix = rawPrefix;
    const pUpper = rawPrefix.toUpperCase().replace(/\./g, "");
    if (pUpper === "THS") normalizedPrefix = "ThS.";
    else if (pUpper === "TS") normalizedPrefix = "TS.";
    else if (pUpper === "PGSTS") normalizedPrefix = "PGS.TS.";
    else if (pUpper === "GSTS") normalizedPrefix = "GS.TS.";
    else if (pUpper === "PGS") normalizedPrefix = "PGS.";
    else if (pUpper === "GS") normalizedPrefix = "GS.";
    else if (pUpper === "BS") normalizedPrefix = "BS.";
    else if (pUpper === "CN") normalizedPrefix = "CN.";
    else if (pUpper === "KS") normalizedPrefix = "KS.";

    const nameWithoutPrefix = cleanName.slice(match[0].length).trim();
    return `${normalizedPrefix} ${nameWithoutPrefix}`;
  }

  // 3. Nếu chưa có học vị: tra cứu trong danh bạ nhân sự để lấy title đầy đủ
  if (personnelDirectory && personnelDirectory.length > 0) {
    const lowerClean = cleanName.toLowerCase();
    for (const member of personnelDirectory) {
      const memberNameClean = member.name
        .replace(/^(ThS\.|TS\.|CN\.|BS\.|PGS\.|GS\.|KS\.|GVC\.)\s*/i, "")
        .trim()
        .toLowerCase();
      if (
        member.name.toLowerCase() === lowerClean ||
        memberNameClean === lowerClean
      ) {
        if (member.title && member.title.trim()) {
          return member.title.trim();
        }
      }
    }
  }

  // Nếu không có trong danh bạ, trả về tên sạch nguyên bản
  return cleanName;
}
