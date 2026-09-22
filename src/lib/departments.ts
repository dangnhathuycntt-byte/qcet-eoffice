/**
 * Danh sách 16 đơn vị quy chuẩn của QCET (1 BGH + 6 Phòng/TT + 9 Khoa + TT_NNTH)
 */
export const QCET_CANONICAL_UNITS = [
  "BGH",
  "P_QLDT",
  "P_TC",
  "P_TCDBCL",
  "P_HCQT",
  "P_TSHTQT",
  "TT_STT",
  "K_CNTT",
  "K_CK",
  "K_DIEN",
  "K_CNOTO",
  "K_DULICH",
  "K_KTQT",
  "K_KTNN",
  "K_VHNT",
  "K_DAICUONG",
  "TT_NNTH",
] as const;

export type QCETCanonicalUnit = typeof QCET_CANONICAL_UNITS[number];

/**
 * Bảng ánh xạ tương thích ngược và chuẩn hóa mã đơn vị QCET
 * Ánh xạ tất cả mã cũ / kebab-case / alias về mã chuẩn quy chuẩn
 */
export const QCET_UNIT_CANONICAL_MAP: Record<string, string> = {
  // Ban Giám hiệu
  BGH: "BGH",
  bgh: "BGH",
  BAN_GIAM_HIEU: "BGH",
  "ban-giam-hieu": "BGH",
  "dept-bgh": "BGH",

  // 6 Phòng / Trung tâm chức năng
  P_QLDT: "P_QLDT",
  p_qldt: "P_QLDT",
  P_DTQLKH: "P_QLDT",
  DT_QLKH: "P_QLDT",
  DAO_TAO: "P_QLDT",
  dao_tao: "P_QLDT",
  "phong-dao-tao": "P_QLDT",
  "dept-p-qldt": "P_QLDT",

  P_TC: "P_TC",
  p_tc: "P_TC",
  P_KHTC: "P_TC",
  KHTC: "P_TC",
  TAI_CHINH: "P_TC",
  tai_chinh: "P_TC",
  "phong-tckt": "P_TC",
  "dept-p-tc": "P_TC",

  P_TCDBCL: "P_TCDBCL",
  p_tcdbcl: "P_TCDBCL",
  P_KTDBCL: "P_TCDBCL",
  TC_DBCL: "P_TCDBCL",
  KHAO_THI: "P_TCDBCL",
  khao_thi: "P_TCDBCL",
  "dept-p-tcdbcl": "P_TCDBCL",

  P_HCQT: "P_HCQT",
  p_hcqt: "P_HCQT",
  P_HC: "P_HCQT",
  HCQT: "P_HCQT",
  HANH_CHINH: "P_HCQT",
  hanh_chinh: "P_HCQT",
  "phong-qctb": "P_HCQT",
  "dept-p-hcqt": "P_HCQT",

  P_TSHTQT: "P_TSHTQT",
  p_tshtqt: "P_TSHTQT",
  P_CTHSSV: "P_TSHTQT",
  TS_HTQT: "P_TSHTQT",
  CTHSSV: "P_TSHTQT",
  cthssv: "P_TSHTQT",
  "phong-cthssv": "P_TSHTQT",
  "tt-tuyensinh": "P_TSHTQT",
  "dept-p-tshtqt": "P_TSHTQT",

  TT_STT: "TT_STT",
  tt_stt: "TT_STT",
  TT_DCC: "TT_STT",
  QTM_CNTT: "TT_STT",
  TRUYEN_THONG: "TT_STT",
  truyen_thong: "TT_STT",
  "dept-tt-stt": "TT_STT",
  "tt-laixe": "TT_STT",

  // 9 Khoa chuyên môn
  K_CNTT: "K_CNTT",
  k_cntt: "K_CNTT",
  K_DTTH: "K_CNTT",
  CNTT: "K_CNTT",
  cntt: "K_CNTT",
  "khoa-cntt": "K_CNTT",
  "dept-k-dtth": "K_CNTT",
  "dept-k-cntt": "K_CNTT",

  K_CK: "K_CK",
  k_ck: "K_CK",
  K_COKHI: "K_CK",
  "khoa-co-khi": "K_CK",
  "dept-k-ck": "K_CK",

  K_DIEN: "K_DIEN",
  k_dien: "K_DIEN",
  "khoa-dien": "K_DIEN",
  "dept-k-dien": "K_DIEN",

  K_CNOTO: "K_CNOTO",
  k_cnoto: "K_CNOTO",
  K_KTCN: "K_CNOTO",
  "khoa-oto": "K_CNOTO",
  "dept-k-cnoto": "K_CNOTO",
  KY_THUAT: "K_CNOTO",
  ky_thuat: "K_CNOTO",

  K_DULICH: "K_DULICH",
  k_dulich: "K_DULICH",
  K_DL: "K_DULICH",
  "khoa-dulich": "K_DULICH",
  "dept-k-dulich": "K_DULICH",

  K_KTQT: "K_KTQT",
  k_ktqt: "K_KTQT",
  K_KTTH: "K_KTQT",
  KINH_TE: "K_KTQT",
  kinh_te: "K_KTQT",
  "dept-k-ktth": "K_KTQT",
  "dept-k-ktqt": "K_KTQT",

  K_KTNN: "K_KTNN",
  k_ktnn: "K_KTNN",
  "khoa-nongnghiep": "K_KTNN",
  "dept-k-ktnn": "K_KTNN",

  K_VHNT: "K_VHNT",
  k_vhnt: "K_VHNT",
  "khoa-vhnt": "K_VHNT",
  "dept-k-vhnt": "K_VHNT",

  K_DAICUONG: "K_DAICUONG",
  k_daicuong: "K_DAICUONG",
  "k-daicuong": "K_DAICUONG",
  "khoa-daicuong": "K_DAICUONG",
  K_VHTHPT: "K_DAICUONG",
  K_COBAN: "K_DAICUONG",
  "dept-k-daicuong": "K_DAICUONG",

  // Trung tâm Ngoại ngữ - Tin học
  TT_NNTH: "TT_NNTH",
  tt_nnth: "TT_NNTH",
  "dept-tt-nnth": "TT_NNTH",
  thu_vien: "TT_NNTH",
  THU_VIEN: "TT_NNTH",
};

export function toCanonicalUnitCode(rawCode: string): string {
  if (!rawCode) return "";
  const trimmed = rawCode.trim();
  return (
    QCET_UNIT_CANONICAL_MAP[trimmed] ||
    QCET_UNIT_CANONICAL_MAP[trimmed.toUpperCase()] ||
    QCET_UNIT_CANONICAL_MAP[trimmed.toLowerCase()] ||
    trimmed
  );
}

export function isCanonicalUnitCode(code: string): boolean {
  if (!code) return false;
  const canonical = toCanonicalUnitCode(code);
  return (QCET_CANONICAL_UNITS as readonly string[]).includes(canonical);
}
