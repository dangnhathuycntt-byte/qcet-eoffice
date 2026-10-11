import { prisma } from '@/lib/prisma';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
}
