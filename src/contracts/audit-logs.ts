import { z } from 'zod';
import { PaginationQuerySchema, IsoDateStringSchema } from './common';

export const AuditLogQuerySchema = PaginationQuerySchema.extend({
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(100).optional(),
  actorId: z.string().trim().max(128).optional(),
  from: IsoDateStringSchema.optional(),
  to: IsoDateStringSchema.optional(),
});

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

export interface AuditLogEntryDTO {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string | null;
  createdAt: string;
}
