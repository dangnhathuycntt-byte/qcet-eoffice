import { prisma } from '@qcet/db/prisma';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
}
