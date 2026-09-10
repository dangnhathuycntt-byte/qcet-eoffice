import { ApiError } from '@/server/api/errors';

export class AuthorizationError extends ApiError {
  constructor(message = 'Truy cập bị từ chối do không đủ quyền hạn', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class InsufficientCapabilityError extends AuthorizationError {
  public readonly capability: string;
  constructor(capability: string, message = `Không có quyền thực hiện hành vi: ${capability}`) {
    super(message, 'INSUFFICIENT_CAPABILITY');
    this.capability = capability;
  }
}

export class SeparationOfPowersError extends AuthorizationError {
  constructor(
    message = 'Quản trị viên kỹ thuật (SYSTEM_ADMIN) bị nghiêm cấm truy cập hoặc can thiệp nghiệp vụ quản lý, hồ sơ và văn bản điều hành của Nhà trường.'
  ) {
    super(message, 'SEPARATION_OF_POWERS_VIOLATION');
  }
}

export class SeparationOfDutiesError extends AuthorizationError {
  constructor(message = 'Vi phạm nguyên tắc phân định quyền hạn (Separation of Duties)') {
    super(message, 'SOD_VIOLATION');
  }
}

export class DelegationExpiredError extends AuthorizationError {
  constructor(message = 'Quyết định ủy quyền đã hết hiệu lực') {
    super(message, 'DELEGATION_EXPIRED');
  }
}

export class DelegationRevokedError extends AuthorizationError {
  constructor(message = 'Quyết định ủy quyền đã bị thu hồi') {
    super(message, 'DELEGATION_REVOKED');
  }
}

export class NonDelegablePowerError extends AuthorizationError {
  constructor(message = 'Thẩm quyền là quyền luật định tối cao, tuyệt đối không được chuyển giao qua ủy quyền tác nghiệp.') {
    super(message, 'NON_DELEGABLE_POWER_VIOLATION');
  }
}

export class PortfolioMismatchError extends AuthorizationError {
  constructor(message = 'Hành động không thuộc mảng phụ trách / lĩnh vực công tác được giao') {
    super(message, 'PORTFOLIO_MISMATCH');
  }
}

export class UnitScopeDeniedError extends AuthorizationError {
  constructor(message = 'Hành động vượt ngoài phạm vi thẩm quyền của đơn vị') {
    super(message, 'UNIT_SCOPE_DENIED');
  }
}

export class SingleDRIError extends AuthorizationError {
  constructor(message = 'Vi phạm quy tắc người chịu trách nhiệm chính duy nhất (Single DRI)') {
    super(message, 'COLLABORATOR_CANNOT_REASSIGN_DRI');
  }
}

export class InvalidWorkflowStateError extends AuthorizationError {
  constructor(message = 'Trạng thái quy trình không hợp lệ để thực hiện hành động này') {
    super(message, 'INVALID_WORKFLOW_STATE');
  }
}

export class StateSecretProhibitionError extends AuthorizationError {
  constructor(message = 'Tài liệu thuộc phạm vi Bí mật nhà nước; tuyệt đối cấm xử lý trên môi trường mạng thông thường.') {
    super(message, 'STATE_SECRET_STRICT_PROHIBITION');
  }
}

export class PersonalDataPrivacyBreachError extends AuthorizationError {
  constructor(message = 'Dữ liệu cá nhân được bảo vệ theo Nghị định 13/2023/NĐ-CP; người dùng không có căn cứ pháp lý.') {
    super(message, 'PERSONAL_DATA_PRIVACY_BREACH');
  }
}

export class AccountDisabledAuthError extends ApiError {
  constructor(message = 'Tài khoản đã bị vô hiệu hóa hoặc tạm khóa') {
    super(401, 'ACCOUNT_DISABLED', message);
  }
}

export class AccountNotFoundError extends ApiError {
  constructor(message = 'Người dùng không tồn tại') {
    super(401, 'SESSION_INVALID', message);
  }
}
