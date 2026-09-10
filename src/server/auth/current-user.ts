import { prisma } from '@/lib/prisma';
import { AuthenticationError } from '@/server/api/errors';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
}

/**
 * Loads and validates the current database user for authentication context.
 * Invariant: Does NOT return a business role snapshot as final authority.
 * Invariant: Throws 401 ACCOUNT_DISABLED if user.isActive = false.
 * Invariant: Throws 401 SESSION_INVALID if user does not exist in DB.
 */
export async function loadCurrentUser(userId: string): Promise<CurrentUser> {
  if (!userId || typeof userId !== 'string') {
    throw new AuthenticationError('Mã người dùng không hợp lệ', 'SESSION_INVALID');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
    },
  });

  if (!user) {
    throw new AuthenticationError('Người dùng không tồn tại', 'SESSION_INVALID');
  }

  if (!user.isActive) {
    throw new AuthenticationError('Tài khoản đã bị vô hiệu hóa hoặc tạm khóa', 'ACCOUNT_DISABLED');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
  };
}
