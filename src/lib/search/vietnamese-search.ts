/**
 * QCET E-Office - Vietnamese Search & Ergonomics Utility
 *
 * Provides diacritic folding, telex normalization, institutional acronym matching,
 * multi-tier search scoring, and substring highlight segmentation.
 */

/**
 * Folds Vietnamese text to lowercase ASCII by stripping combining diacritics
 * and handling non-decomposing stroke characters (đ/Đ).
 */
export function foldVietnamese(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFC")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Normalizes mid-flight Telex keystrokes to their base representations.
 * Handles common syllable expansions (e.g., 'dd' -> 'd', 'ee' -> 'e', 'w' -> 'u').
 */
export function normalizeTelexQuery(query: string | null | undefined): string {
  let q = foldVietnamese(query);
  if (!q) return "";
  q = q
    .replace(/aa/g, "a")
    .replace(/aw/g, "a")
    .replace(/ee/g, "e")
    .replace(/oo/g, "o")
    .replace(/ow/g, "o")
    .replace(/uw/g, "u")
    .replace(/dd/g, "d")
    .replace(/w/g, "u");
  // Collapse trailing syllable tone markers (s, f, r, x, j)
  return q.replace(/([aeiouy])[sfrxj]\b/g, "$1");
}

/**
 * Extracts word-initial acronym from an institutional name or title.
 * Strips common department prefixes (Khoa, Phòng, Trung tâm, Bộ môn) so that
 * "Khoa Công nghệ thông tin" yields "cntt" while "Ban Giám hiệu" yields "bgh".
 */
export function extractAcronym(text: string | null | undefined): string {
  const folded = foldVietnamese(text);
  if (!folded) return "";

  // Strip leading unit prefixes if present to match common organizational acronyms
  const cleaned = folded.replace(/^(khoa|phong|trung tam|bo mon|to)\s+/i, "");

  return cleaned
    .split(/[\s\-&/_,.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("");
}

/**
 * Returns both raw and prefix-stripped acronyms for comprehensive matching.
 */
export function extractAcronyms(text: string | null | undefined): string[] {
  const folded = foldVietnamese(text);
  if (!folded) return [];

  const raw = folded
    .split(/[\s\-&/_,.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("");

  const stripped = extractAcronym(text);
  return Array.from(new Set([raw, stripped].filter(Boolean)));
}

/**
 * Common QCET institutional department acronym mappings
 */
export const QCET_ACRONYMS: Record<string, string[]> = {
  cntt: ["Khoa Công nghệ thông tin", "Công nghệ thông tin"],
  dt: ["Khoa Điện tử", "Điện tử", "Đào tạo"],
  ck: ["Khoa Cơ khí", "Cơ khí"],
  kt: ["Khoa Kinh tế", "Kinh tế", "Kế toán"],
  tc: ["Khoa Tại chức", "Tài chính"],
  dbcl: ["Phòng Đảm bảo chất lượng giáo dục", "Đảm bảo chất lượng"],
  dbclgd: ["Phòng Đảm bảo chất lượng giáo dục"],
  dtnd: ["Phòng Đào tạo & Nghiên cứu khoa học", "Đào tạo"],
  tckt: ["Phòng Tài chính - Kế toán", "Tài chính kế toán"],
  hctc: ["Phòng Hành chính - Tổ chức", "Hành chính tổ chức"],
  ctsv: ["Phòng Công tác sinh viên", "Công tác sinh viên"],
  bgh: ["Ban Giám hiệu", "Hiệu trưởng", "Phó Hiệu trưởng"],
};

/**
 * Multi-tier search scorer for Vietnamese enterprise queries.
 * Returns a score between 0 (no match) and 100 (exact match).
 */
export function scoreVietnameseSearch(
  targetText: string,
  rawQuery: string,
  keywords: string[] = []
): number {
  if (!rawQuery.trim()) return 1;

  const rawQ = rawQuery.trim().toLowerCase();
  const foldedQ = foldVietnamese(rawQ);
  const telexQ = normalizeTelexQuery(rawQ);

  const targetRaw = (targetText || "").toLowerCase();
  const targetFolded = foldVietnamese(targetText);
  const targetAcronyms = extractAcronyms(targetText);

  // Tier 1: Exact matches
  if (targetRaw === rawQ) return 100;
  if (targetFolded === foldedQ) return 90;

  // Tier 2: Prefix matches
  if (targetRaw.startsWith(rawQ)) return 85;
  if (targetFolded.startsWith(foldedQ) || targetFolded.startsWith(telexQ)) return 80;

  // Tier 3: Institutional acronym matches (e.g., "cntt", "dbclgd", "bgh")
  const isAcronymMatch = targetAcronyms.some(
    (acr) => acr === foldedQ || acr === telexQ || acr.startsWith(foldedQ)
  );
  if (isAcronymMatch) {
    return 75;
  }

  // Pre-configured QCET acronym check
  if (QCET_ACRONYMS[foldedQ]) {
    const isAcronymMatch = QCET_ACRONYMS[foldedQ].some((term) =>
      targetFolded.includes(foldVietnamese(term))
    );
    if (isAcronymMatch) return 74;
  }

  // Tier 4: Dispatch / Document Code Fast-Path (e.g. "NV-2026", "124/QD-CDKT")
  if (
    (targetFolded.includes(foldedQ) || targetFolded.includes(telexQ)) &&
    (foldedQ.includes("-") || foldedQ.includes("/"))
  ) {
    return 72;
  }

  // Tier 5: Substring containment
  if (targetFolded.includes(foldedQ) || targetFolded.includes(telexQ)) {
    return 65;
  }

  // Tier 6: Multi-token containment (e.g., "ke hoach nam" in "Kế hoạch năm học 2026")
  const queryTokens = (foldedQ.length < telexQ.length ? foldedQ : telexQ)
    .split(/\s+/)
    .filter(Boolean);
  if (queryTokens.length > 1 && queryTokens.every((tok) => targetFolded.includes(tok))) {
    return 60;
  }

  // Tier 7: Aliases & metadata keywords
  for (const kw of keywords) {
    const kwFolded = foldVietnamese(kw);
    if (kwFolded === foldedQ) return 55;
    if (kwFolded.includes(foldedQ)) return 50;
  }

  return 0;
}

/**
 * Highlights matching segments in text based on accent-folded query without
 * modifying original casing and accents of the original text.
 */
export function highlightMatchSegments(
  text: string,
  query: string
): Array<{ text: string; match: boolean }> {
  if (!text || !query.trim()) {
    return [{ text: text || "", match: false }];
  }

  const foldedText = foldVietnamese(text);
  const foldedQuery = foldVietnamese(query);

  const idx = foldedText.indexOf(foldedQuery);
  if (idx === -1) {
    // If contiguous query doesn't match, check for acronym match
    const acronym = extractAcronym(text);
    if (acronym.startsWith(foldedQuery)) {
      return [{ text, match: true }];
    }
    return [{ text, match: false }];
  }

  const matchLength = query.length; // Approximate length in original string
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + foldedQuery.length);
  const after = text.slice(idx + foldedQuery.length);

  const segments: Array<{ text: string; match: boolean }> = [];
  if (before) segments.push({ text: before, match: false });
  if (match) segments.push({ text: match, match: true });
  if (after) segments.push({ text: after, match: false });

  return segments;
}
