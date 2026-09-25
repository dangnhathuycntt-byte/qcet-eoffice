import type { AuthorizationContext } from './authorization-context';
import { NON_DELEGABLE_CAPABILITIES } from './capability';
import { isExecutivePosition } from './authorization-engine';

export function isExecutiveAdministrator(context: AuthorizationContext): boolean {
  if (context.isSystemAdmin() || context.user.role === 'ADMIN') {
    return true;
  }
  if (context.user.role === 'BAN_GIAM_HIEU') {
    return true;
  }
  return context.positions.some((pos) => isExecutivePosition(pos.positionCode));
}

export function isNonDelegableAction(action: string): boolean {
  if (!action) return true;
  const trimmed = action.trim();
  const lower = trimmed.toLowerCase();

  // 1. Statutory non-delegable capabilities
  if ((NON_DELEGABLE_CAPABILITIES as readonly string[]).includes(trimmed)) {
    return true;
  }

  // 2. Budget sign-off & treasury disbursement
  if (
    lower.includes('budget') ||
    lower.includes('finance') ||
    lower.includes('disbursement') ||
    lower.includes('treasury') ||
    lower.includes('chi_tieu') ||
    lower.includes('ngan_sach') ||
    lower.includes('tai_chinh')
  ) {
    return true;
  }

  // 3. Disciplinary actions
  if (
    lower.includes('disciplinary') ||
    lower.includes('ky_luat') ||
    lower.includes('kỷ luật')
  ) {
    return true;
  }

  // 4. Institutional leadership & statutory governance
  if (
    lower.includes('position.manage_leadership') ||
    lower.includes('regulation.institutional_amend') ||
    lower.includes('system.configure') ||
    lower.includes('account.manage')
  ) {
    return true;
  }

  return false;
}
