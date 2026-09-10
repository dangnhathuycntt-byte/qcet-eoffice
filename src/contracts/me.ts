import { z } from 'zod';
import {
  AssignmentType,
  UnitType,
  JobCatalogGroup,
  DelegationStatus,
  DataClassification,
} from '@prisma/client';

export const UserIdentitySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  avatarUrl: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  provider: z.string(),
});

export const UserActiveAssignmentSchema = z.object({
  id: z.string(),
  assignmentType: z.nativeEnum(AssignmentType),
  isActing: z.boolean().default(false),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable().optional(),
  position: z.object({
    id: z.string(),
    code: z.string(),
    title: z.string(),
    category: z.nativeEnum(JobCatalogGroup),
    standardDuties: z.string().nullable().optional(),
  }),
  unit: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    type: z.nativeEnum(UnitType),
  }),
});

export const UserResponsibilityAreaSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  sourceDecision: z.string().nullable().optional(),
});

export const UserDelegationSummarySchema = z.object({
  id: z.string(),
  direction: z.enum(['DELEGATED_TO_ME', 'DELEGATED_BY_ME']),
  status: z.nativeEnum(DelegationStatus),
  counterpartName: z.string(),
  counterpartPosition: z.string().optional(),
  capabilities: z.array(z.string()),
  responsibilityAreas: z.array(z.string()),
  effectiveFrom: z.string(),
  effectiveUntil: z.string(),
  reason: z.string().nullable().optional(),
  isExpiringSoon: z.boolean().default(false),
});

export const UserContextResponseSchema = z.object({
  identity: UserIdentitySchema,
  activeAssignments: z.array(UserActiveAssignmentSchema),
  viewScopes: z.array(z.enum(['PERSONAL', 'UNIT', 'SCHOOL'])),
  responsibilityAreas: z.array(UserResponsibilityAreaSchema),
  technicalCapabilities: z.array(z.string()),
  delegations: z.array(UserDelegationSummarySchema),
  highestPositionLevel: z.string().optional(),
});

export type UserContextResponse = z.infer<typeof UserContextResponseSchema>;

// Action Inbox Contract
export const ActionInboxItemSchema = z.object({
  id: z.string(),
  resourceType: z.enum(['TASK', 'INCOMING_DOCUMENT', 'OUTGOING_DOCUMENT', 'DOSSIER', 'DELEGATION']),
  resourceId: z.string(),
  resourceCode: z.string(),
  title: z.string(),
  requiredAction: z.string(),
  reasonWhyMe: z.string(),
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']),
  deadline: z.string().nullable().optional(),
  createdAt: z.string(),
  classification: z.nativeEnum(DataClassification).optional(),
  linkUrl: z.string(),
});

export type ActionInboxItem = z.infer<typeof ActionInboxItemSchema>;

export const ActionInboxResponseSchema = z.object({
  total: z.number(),
  urgentCount: z.number(),
  items: z.array(ActionInboxItemSchema),
});

export type ActionInboxResponse = z.infer<typeof ActionInboxResponseSchema>;
