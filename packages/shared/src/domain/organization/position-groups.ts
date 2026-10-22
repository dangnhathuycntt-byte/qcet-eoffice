/**
 * Nhóm chức vụ theo mã `PositionDefinition.code`: Ban Giám hiệu và trưởng đơn vị. Thuần túy, không đọc DB; máy chủ dùng để
 * phân quyền, trình duyệt dùng để chọn nhanh theo phạm vi (bộ chọn người dự họp). Chuyển nguyên văn từ
 * `authorization-engine.ts` để web không phải chép lại; `hybrid-authorization.ts` còn bản riêng chưa gộp.
 */

export function isExecutivePosition(posCode?: string): boolean {
  const code = (posCode || '').toUpperCase();
  return (
    code === 'HIEU_TRUONG' ||
    code === 'PHO_HIEU_TRUONG' ||
    code === 'PHO_HIEU_TRUONG_DT' ||
    code === 'PHO_HIEU_TRUONG_HC' ||
    code === 'BGH' ||
    code === 'BAN_GIAM_HIEU' ||
    code === 'BGH_HT' ||
    code === 'BGH_PHT_DT' ||
    code === 'BGH_PHT_CSVC'
  );
}

export function isUnitLeaderPosition(posCode?: string): boolean {
  const code = (posCode || '').toUpperCase();
  return (
    code === 'TRUONG_DON_VI' ||
    code === 'TRUONG_DON_VI_CANONICAL' ||
    code === 'TRUONG_PHONG' ||
    code === 'TRUONG_KHOA' ||
    code === 'GIAM_DOC_TRUNG_TAM' ||
    code === 'TRUONG_BO_MON' ||
    code === 'TRUONG_XUONG' ||
    code === 'KE_TOAN_TRUONG' ||
    code.startsWith('TRUONG_') ||
    code.startsWith('POS_MGR_')
  );
}

export function isDeputyUnitLeaderPosition(posCode?: string): boolean {
  const code = (posCode || '').toUpperCase();
  return (
    code === 'PHO_TRUONG_DON_VI' ||
    code === 'PHO_TRUONG_PHONG' ||
    code === 'PHO_TRUONG_KHOA' ||
    code === 'PHO_GIAM_DOC_TRUNG_TAM' ||
    code === 'PHO_DON_VI' ||
    code === 'PHO_TRUONG_BO_MON' ||
    code === 'PHO_TRUONG_XUONG'
  );
}

/** Giảng viên (mã `GIANG_VIEN…`): nhóm đông nhất của trường, thường được mời họp cả nhóm. */
export function isLecturerPosition(posCode?: string): boolean {
  return (posCode || '').toUpperCase().startsWith('GIANG_VIEN');
}
