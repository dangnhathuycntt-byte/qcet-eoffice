/**
 * CANONICAL CAPABILITY DEFINITIONS FOR QCET E-OFFICE
 *
 * Architecture & Governance Reference:
 * - Vietnamese Higher Vocational Education Law (Luat Giao duc nghe nghiep)
 * - College Charter & Organization Regulation (QD 283/QD-CDKTCNQN)
 * - Executive Work Assignment Regulation (QD 420/QD-CDKTCNQN)
 * - Administrative Procedure & Clerical Decree (ND 30/2020/ND-CP)
 * - Personal Data Protection Decree (ND 13/2023/ND-CP)
 *
 * Invariants:
 * 1. Role Is Not Scope / Role String Checks Prohibited
 * 2. Fine-grained, typed capabilities across all functional domains
 * 3. Strict Separation of Powers (Technical Admin vs Institutional Leadership)
 * 4. Separation of Duties (Anti-Self-Approval, Signer != Numberer)
 * 5. Statutory Non-Delegable Thresholds
 */

// ============================================================================
// 1. CAPABILITY CATEGORIES
// ============================================================================

export type CapabilityCategory =
  | 'MEETING'
  | 'DOCUMENT'
  | 'TASK'
  | 'SYSTEM'
  | 'DOSSIER'
  | 'HR';

export const CAPABILITY_CATEGORIES: readonly CapabilityCategory[] = [
  'MEETING',
  'DOCUMENT',
  'TASK',
  'SYSTEM',
  'DOSSIER',
  'HR',
] as const;

// ============================================================================
// 2. MEETING CAPABILITIES (F05)
// ============================================================================

export const MEETING_CAPABILITIES = [
  'meeting.read',
  'meeting.create',
  'meeting.update',
  'meeting.manage_participants',
  'meeting.draft_minutes',
  'meeting.confirm_minutes',
  'meeting.create_resolution',
  'meeting.publish_resolution',
] as const;

export type MeetingCapabilityAction = (typeof MEETING_CAPABILITIES)[number];

// ============================================================================
// 3. DOCUMENT CAPABILITIES (F15 & CLERICAL DECREE 30/2020)
// ============================================================================

export const DOCUMENT_CANONICAL_CAPABILITIES = [
  'document.read',
  'document.read_restricted',
  'document.register',
  'document.direct',
  'document.assign_unit',
  'document.review_content',
  'document.review_format',
  'document.sign',
  'document.assign_number',
  'document.organization_sign',
  'document.issue',
  'document.archive',
] as const;

export type DocumentCanonicalCapabilityAction = (typeof DOCUMENT_CANONICAL_CAPABILITIES)[number];

export const DOCUMENT_INCOMING_CAPABILITIES = [
  'document.incoming.register',
  'document.incoming.present',
  'document.incoming.direct',
  'document.incoming.assign_unit',
  'document.incoming.assign_person',
  'document.incoming.execute',
  'document.incoming.file',
  'document.file',
] as const;

export type DocumentIncomingCapabilityAction = (typeof DOCUMENT_INCOMING_CAPABILITIES)[number];

export const DOCUMENT_OUTGOING_CAPABILITIES = [
  'document.outgoing.draft',
  'document.outgoing.review_content',
  'document.outgoing.submit_content_review',
  'document.outgoing.approve_content',
  'document.outgoing.review_format',
  'document.outgoing.check_format',
  'document.outgoing.submit_format_check',
  'document.outgoing.approve_format',
  'document.outgoing.sign',
  'document.outgoing.authorized_sign',
  'document.outgoing.sign_kt',
  'document.outgoing.sign_tuq',
  'document.outgoing.number',
  'document.outgoing.assign_number',
  'document.outgoing.organization_sign',
  'document.outgoing.issue',
] as const;

export type DocumentOutgoingCapabilityAction = (typeof DOCUMENT_OUTGOING_CAPABILITIES)[number];

export const DOCUMENT_CAPABILITIES = [
  ...DOCUMENT_CANONICAL_CAPABILITIES,
  ...DOCUMENT_INCOMING_CAPABILITIES,
  ...DOCUMENT_OUTGOING_CAPABILITIES,
] as const;

export type DocumentCapabilityAction = (typeof DOCUMENT_CAPABILITIES)[number];

// ============================================================================
// 4. TASK CAPABILITIES
// ============================================================================

export const TASK_CAPABILITIES = [
  'task.read',
  'task.view',
  'task.create',
  'task.assign',
  'task.reassign',
  'task.update_execution',
  'task.submit_result',
  'task.review',
  'task.approve',
  'task.monitor',
  'task.remind',
  'task.close',
  'task.cancel',
] as const;

export type TaskCapabilityAction = (typeof TASK_CAPABILITIES)[number];

// ============================================================================
// 5. SYSTEM & ADMINISTRATIVE CAPABILITIES
// ============================================================================

export const SYSTEM_CAPABILITIES = [
  'account.manage',
  'org.manage',
  'position.manage',
  'system.configure',
  'audit.view',
  'system.account.manage',
  'system.org.manage',
  'system.position.manage',
  'system.system.configure',
  'system.audit.view',
] as const;

export type SystemCapabilityAction = (typeof SYSTEM_CAPABILITIES)[number];

// ============================================================================
// 6. DOSSIER CAPABILITIES
// ============================================================================

export const DOSSIER_CAPABILITIES = [
  'dossier.open',
  'dossier.add_item',
  'dossier.remove_item',
  'dossier.close',
  'dossier.transfer_archive',
  'dossier.submit_archive',
  'dossier.accept_archive',
  'document.archive',
] as const;

export type DossierCapabilityAction = (typeof DOSSIER_CAPABILITIES)[number];

// ============================================================================
// 7. HR & STATUTORY GOVERNANCE CAPABILITIES
// ============================================================================

export const HR_CAPABILITIES = [
  'hr.view',
  'payroll.view',
  'user.view_sensitive_personal_data',
  'position.manage_leadership',
  'hr.disciplinary_action',
] as const;

export type HrCapabilityAction = (typeof HR_CAPABILITIES)[number];

export const STATUTORY_GOVERNANCE_CAPABILITIES = [
  'position.manage_leadership',
  'hr.disciplinary_action',
  'finance.treasury_disbursement',
  'regulation.institutional_amend',
] as const;

export type StatutoryNonDelegableAction = (typeof STATUTORY_GOVERNANCE_CAPABILITIES)[number];

// ============================================================================
// 8. UNIFIED CAPABILITY ACTION TYPE
// ============================================================================

export type CapabilityAction =
  | MeetingCapabilityAction
  | DocumentCapabilityAction
  | TaskCapabilityAction
  | SystemCapabilityAction
  | DossierCapabilityAction
  | HrCapabilityAction
  | StatutoryNonDelegableAction;

// ============================================================================
// 9. BOUNDARY RESTRICTIONS & STATUTORY INVARIANTS
// ============================================================================

/**
 * Statutory Non-Delegable Capabilities:
 * Powers that cannot be transferred to any delegate under Vietnamese law
 * and institutional regulation QD 283/QD-CDKTCNQN.
 */
export const NON_DELEGABLE_CAPABILITIES: readonly CapabilityAction[] = [
  'position.manage_leadership',
  'hr.disciplinary_action',
  'finance.treasury_disbursement',
  'regulation.institutional_amend',
  'account.manage',
  'system.configure',
  'org.manage',
  'position.manage',
  'system.account.manage',
  'system.org.manage',
  'system.position.manage',
  'system.system.configure',
] as const;

/**
 * Statutory Official Signing Capabilities (Personal & Institutional Seal)
 */
export const STATUTORY_SIGNING_CAPABILITIES: readonly CapabilityAction[] = [
  'document.sign',
  'document.organization_sign',
  'document.outgoing.sign',
  'document.outgoing.authorized_sign',
  'document.outgoing.sign_kt',
  'document.outgoing.sign_tuq',
  'document.outgoing.organization_sign',
] as const;

export type StatutorySigningCapabilityAction = (typeof STATUTORY_SIGNING_CAPABILITIES)[number];

/**
 * Actions that are portfolio-bound under QD 420/QD-CDKTCNQN
 */
export const PORTFOLIO_BOUND_ACTIONS: readonly CapabilityAction[] = [
  'task.approve',
  'task.review',
  'task.cancel',
  'task.close',
  'document.direct',
  'document.assign_unit',
  'document.incoming.direct',
  'document.incoming.assign_unit',
  'document.sign',
  'document.review_content',
  'document.outgoing.sign',
  'document.outgoing.authorized_sign',
  'document.outgoing.sign_kt',
  'document.outgoing.review_content',
  'document.outgoing.approve_content',
  'meeting.confirm_minutes',
  'meeting.create_resolution',
  'meeting.publish_resolution',
] as const;

// ============================================================================
// 10. CANONICAL ALIASES & NORMALIZATION
// ============================================================================

export const CAPABILITY_CANONICAL_ALIASES: Readonly<Record<string, CapabilityAction>> = {
  // Document Incoming aliases -> Canonical
  'document.incoming.register': 'document.register',
  'document.incoming.direct': 'document.direct',
  'document.incoming.assign_unit': 'document.assign_unit',
  'document.incoming.file': 'document.archive',
  'document.file': 'document.archive',
  // Document Outgoing aliases -> Canonical
  'document.outgoing.review_content': 'document.review_content',
  'document.outgoing.submit_content_review': 'document.review_content',
  'document.outgoing.approve_content': 'document.review_content',
  'document.outgoing.review_format': 'document.review_format',
  'document.outgoing.check_format': 'document.review_format',
  'document.outgoing.submit_format_check': 'document.review_format',
  'document.outgoing.approve_format': 'document.review_format',
  'document.outgoing.sign': 'document.sign',
  'document.outgoing.authorized_sign': 'document.sign',
  'document.outgoing.sign_kt': 'document.sign',
  'document.outgoing.sign_tuq': 'document.sign',
  'document.outgoing.number': 'document.assign_number',
  'document.outgoing.assign_number': 'document.assign_number',
  'document.outgoing.organization_sign': 'document.organization_sign',
  'document.outgoing.issue': 'document.issue',
  // Dossier aliases -> Canonical
  'dossier.remove_item': 'dossier.add_item',
  'dossier.submit_archive': 'dossier.transfer_archive',
  'dossier.accept_archive': 'document.archive',
  // Task aliases -> Canonical
  'task.view': 'task.read',
  // System aliases -> Canonical
  'system.account.manage': 'account.manage',
  'system.org.manage': 'org.manage',
  'system.position.manage': 'position.manage',
  'system.system.configure': 'system.configure',
  'system.audit.view': 'audit.view',
};

export function resolveCanonicalCapability(action: CapabilityAction): CapabilityAction {
  return CAPABILITY_CANONICAL_ALIASES[action] ?? action;
}

// ============================================================================
// 11. METADATA CATALOG
// ============================================================================

export interface CapabilityMetadata {
  action: CapabilityAction;
  category: CapabilityCategory;
  name: string;
  description?: string;
  isStatutoryNonDelegable: boolean;
  isPortfolioBound: boolean;
  isStatutorySigning?: boolean;
  canonicalAlias?: CapabilityAction;
}

const CAPABILITY_NAMES: Readonly<Record<string, string>> = {
  // Meeting
  'meeting.read': 'Xem thông tin cuộc họp',
  'meeting.create': 'Tạo cuộc họp mới',
  'meeting.update': 'Cập nhật cuộc họp',
  'meeting.manage_participants': 'Quản lý thành phần tham dự họp',
  'meeting.draft_minutes': 'Soạn thảo biên bản họp',
  'meeting.confirm_minutes': 'Xác nhận biên bản họp',
  'meeting.create_resolution': 'Tạo nghị quyết/kết luận họp',
  'meeting.publish_resolution': 'Ban hành kết luận/nghị quyết họp',
  // Document Canonical
  'document.read': 'Xem văn bản',
  'document.read_restricted': 'Xem văn bản mật/hạn chế (restricted)',
  'document.register': 'Đăng ký vào sổ văn bản',
  'document.direct': 'Chỉ đạo xử lý văn bản',
  'document.assign_unit': 'Phân công đơn vị xử lý văn bản',
  'document.review_content': 'Thẩm định nội dung văn bản',
  'document.review_format': 'Thẩm định thể thức văn bản',
  'document.sign': 'Ký duyệt văn bản (thẩm quyền cá nhân)',
  'document.assign_number': 'Cấp số văn bản',
  'document.organization_sign': 'Ký số cơ quan / Đóng dấu pháp nhân',
  'document.issue': 'Phát hành văn bản chính thức',
  'document.archive': 'Lưu trữ hồ sơ văn bản',
  // Document Incoming
  'document.incoming.register': 'Đăng ký văn bản đến',
  'document.incoming.present': 'Trình văn bản đến cho lãnh đạo',
  'document.incoming.direct': 'Lãnh đạo cho ý kiến chỉ đạo văn bản đến',
  'document.incoming.assign_unit': 'Phân công đơn vị chủ trì văn bản đến',
  'document.incoming.assign_person': 'Phân công cán bộ thụ lý văn bản đến',
  'document.incoming.execute': 'Thực thi xử lý văn bản đến',
  'document.incoming.file': 'Lập hồ sơ lưu văn bản đến',
  'document.file': 'Lập hồ sơ lưu văn bản',
  // Document Outgoing
  'document.outgoing.draft': 'Soạn thảo dự thảo văn bản đi',
  'document.outgoing.review_content': 'Duyệt nội dung dự thảo văn bản',
  'document.outgoing.submit_content_review': 'Trình duyệt nội dung dự thảo',
  'document.outgoing.approve_content': 'Phê duyệt nội dung dự thảo',
  'document.outgoing.review_format': 'Kiểm tra thể thức văn bản đi',
  'document.outgoing.check_format': 'Kiểm tra thể thức văn bản đi',
  'document.outgoing.submit_format_check': 'Trình kiểm tra thể thức văn bản',
  'document.outgoing.approve_format': 'Duyệt thể thức văn bản',
  'document.outgoing.sign': 'Ký văn bản đi',
  'document.outgoing.authorized_sign': 'Ký thừa ủy quyền văn bản đi',
  'document.outgoing.sign_kt': 'Ký thay người đứng đầu (KT.)',
  'document.outgoing.sign_tuq': 'Ký thừa ủy quyền (TUQ.)',
  'document.outgoing.number': 'Lấy số văn bản đi',
  'document.outgoing.assign_number': 'Cấp số văn bản đi',
  'document.outgoing.organization_sign': 'Đóng dấu / Ký số cơ quan văn bản đi',
  'document.outgoing.issue': 'Phát hành văn bản đi',
  // Task
  'task.read': 'Xem thông tin nhiệm vụ',
  'task.view': 'Xem nhiệm vụ (tương thích ngược)',
  'task.create': 'Khởi tạo nhiệm vụ',
  'task.assign': 'Phân công nhiệm vụ',
  'task.reassign': 'Điều chuyển nhiệm vụ / Thay đổi DRI',
  'task.update_execution': 'Cập nhật tiến độ thực hiện',
  'task.submit_result': 'Nộp sản phẩm / kết quả thực hiện',
  'task.review': 'Đánh giá sản phẩm nhiệm vụ',
  'task.approve': 'Phê duyệt hoàn thành nhiệm vụ',
  'task.monitor': 'Theo dõi tiến độ nhiệm vụ',
  'task.remind': 'Đôn đốc nhắc nhở nhiệm vụ',
  'task.close': 'Đóng hoàn tất nhiệm vụ',
  'task.cancel': 'Hủy bỏ nhiệm vụ',
  // System
  'account.manage': 'Quản trị tài khoản người dùng',
  'org.manage': 'Quản lý cơ cấu tổ chức & phòng ban',
  'position.manage': 'Quản lý danh mục vị trí việc làm',
  'system.configure': 'Cấu hình tham số kỹ thuật hệ thống',
  'audit.view': 'Xem nhật ký kiểm toán hệ thống',
  'system.account.manage': 'Quản trị tài khoản (namespace system)',
  'system.org.manage': 'Quản lý tổ chức (namespace system)',
  'system.position.manage': 'Quản lý vị trí (namespace system)',
  'system.system.configure': 'Cấu hình hệ thống (namespace system)',
  'system.audit.view': 'Xem nhật ký kiểm toán (namespace system)',
  // Dossier
  'dossier.open': 'Mở hồ sơ công việc',
  'dossier.add_item': 'Thêm tài liệu vào hồ sơ',
  'dossier.remove_item': 'Bớt tài liệu khỏi hồ sơ',
  'dossier.close': 'Đóng kết thúc hồ sơ công việc',
  'dossier.transfer_archive': 'Nộp lưu hồ sơ vào lưu trữ cơ quan',
  'dossier.submit_archive': 'Trình nộp lưu hồ sơ',
  'dossier.accept_archive': 'Tiếp nhận hồ sơ vào lưu trữ lịch sử',
  // HR & Governance
  'hr.view': 'Xem hồ sơ nhân sự',
  'payroll.view': 'Xem thông tin lương',
  'user.view_sensitive_personal_data': 'Xem dữ liệu cá nhân nhạy cảm',
  'position.manage_leadership': 'Bổ nhiệm/miễn nhiệm lãnh đạo đơn vị',
  'hr.disciplinary_action': 'Xử lý kỷ luật cán bộ viên chức',
  'finance.treasury_disbursement': 'Rút dự toán ngân sách Nhà nước tại Kho bạc',
  'regulation.institutional_amend': 'Sửa đổi quy chế tổ chức hoạt động của Nhà trường',
};

// ============================================================================
// 12. TYPE GUARDS & VALIDATION FUNCTIONS
// ============================================================================

export function isMeetingCapability(action: unknown): action is MeetingCapabilityAction {
  return typeof action === 'string' && (MEETING_CAPABILITIES as readonly string[]).includes(action);
}

export function isDocumentCapability(action: unknown): action is DocumentCapabilityAction {
  return typeof action === 'string' && (DOCUMENT_CAPABILITIES as readonly string[]).includes(action);
}

export function isTaskCapability(action: unknown): action is TaskCapabilityAction {
  return typeof action === 'string' && (TASK_CAPABILITIES as readonly string[]).includes(action);
}

export function isSystemCapability(action: unknown): action is SystemCapabilityAction {
  return typeof action === 'string' && (SYSTEM_CAPABILITIES as readonly string[]).includes(action);
}

export function isDossierCapability(action: unknown): action is DossierCapabilityAction {
  return typeof action === 'string' && (DOSSIER_CAPABILITIES as readonly string[]).includes(action);
}

export function isHrCapability(action: unknown): action is HrCapabilityAction {
  return typeof action === 'string' && (HR_CAPABILITIES as readonly string[]).includes(action);
}

export function isStatutorySigningCapability(action: unknown): action is StatutorySigningCapabilityAction {
  return typeof action === 'string' && (STATUTORY_SIGNING_CAPABILITIES as readonly string[]).includes(action);
}

export function isNonDelegableCapability(action: unknown): boolean {
  return typeof action === 'string' && (NON_DELEGABLE_CAPABILITIES as readonly string[]).includes(action);
}

export function isValidCapability(action: unknown): action is CapabilityAction {
  if (typeof action !== 'string') return false;
  return (
    isMeetingCapability(action) ||
    isDocumentCapability(action) ||
    isTaskCapability(action) ||
    isSystemCapability(action) ||
    isDossierCapability(action) ||
    isHrCapability(action) ||
    (STATUTORY_GOVERNANCE_CAPABILITIES as readonly string[]).includes(action)
  );
}

/**
 * Backward compatibility alias for isCapabilityAction
 */
export const isCapabilityAction = isValidCapability;

// ============================================================================
// 13. METADATA HELPERS
// ============================================================================

export function getCapabilityCategory(action: string): CapabilityCategory | undefined {
  if (isMeetingCapability(action)) return 'MEETING';
  if (isDocumentCapability(action)) return 'DOCUMENT';
  if (isTaskCapability(action)) return 'TASK';
  if (isSystemCapability(action)) return 'SYSTEM';
  if (isDossierCapability(action)) return 'DOSSIER';
  if (isHrCapability(action)) return 'HR';
  if ((STATUTORY_GOVERNANCE_CAPABILITIES as readonly string[]).includes(action)) return 'HR';
  return undefined;
}

export function getCapabilityMetadata(action: string): CapabilityMetadata | undefined {
  if (!isValidCapability(action)) return undefined;
  const category = getCapabilityCategory(action);
  if (!category) return undefined;

  const isNonDelegable = (NON_DELEGABLE_CAPABILITIES as readonly string[]).includes(action);
  const isBound = (PORTFOLIO_BOUND_ACTIONS as readonly string[]).includes(action);
  const isSigning = (STATUTORY_SIGNING_CAPABILITIES as readonly string[]).includes(action);
  const canonicalAlias = CAPABILITY_CANONICAL_ALIASES[action];
  const name = CAPABILITY_NAMES[action] || action;

  return {
    action,
    category,
    name,
    isStatutoryNonDelegable: isNonDelegable,
    isPortfolioBound: isBound,
    isStatutorySigning: isSigning || undefined,
    canonicalAlias,
  };
}
