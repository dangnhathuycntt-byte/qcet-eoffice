import type {
  AssignmentStatus,
  AssignmentType,
  BodyMemberRole,
  BodyStatus,
  DelegationStatus,
  JobCatalogGroup,
  OrganizationalBodyType,
  ResponsibilityCategory,
  UnitStatus,
  UnitType,
  UserRole,
} from '@prisma/client';

export enum SystemRole {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  SECURITY_ADMIN = 'SECURITY_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
}

export interface ActivePositionAssignment {
  id: string;
  userId: string;
  positionDefinitionId: string;
  positionCode: string;
  positionTitle: string;
  positionGroup?: JobCatalogGroup;
  positionLevel: number | null;
  isLeadership: boolean;
  unitId: string;
  unitCode: string;
  unitName: string;
  unitType: UnitType;
  unitStatus: UnitStatus;
  type: AssignmentType;
  isActing: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: AssignmentStatus;
  sourceDecisionNumber: string | null;
}

export interface ActiveResponsibilityArea {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: ResponsibilityCategory;
}

export interface ActivePortfolioAssignment {
  id: string;
  positionAssignmentId: string;
  responsibilityAreaId: string;
  responsibilityArea: ActiveResponsibilityArea;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  sourceDecisionNumber: string | null;
}

export interface ActiveDelegationScopeRule {
  id: string;
  delegationGrantId: string;
  entityType: string;
  entityId: string | null;
  constraintType: string;
}

export interface ActiveDelegationGrant {
  id: string;
  grantorAssignmentId: string;
  grantorUserId: string;
  grantorPositionCode?: string;
  grantorName?: string;
  grantorPositionTitle?: string;
  granteeAssignmentId: string;
  granteeUserId: string;
  granteePositionCode?: string;
  granteeName?: string;
  granteePositionTitle?: string;
  responsibilityAreaId: string | null;
  responsibilityArea?: ActiveResponsibilityArea | null;
  action: string;
  resourceScope: string;
  validFrom: Date;
  validUntil: Date;
  sourceDocumentNumber: string;
  reason: string | null;
  status: DelegationStatus;
  revokedAt: Date | null;
  revokedReason: string | null;
  scopeRules: ActiveDelegationScopeRule[];
}

export interface ActiveBodyMembership {
  id: string;
  bodyId: string;
  bodyCode: string;
  bodyName: string;
  bodyType: OrganizationalBodyType;
  bodyStatus: BodyStatus;
  role: BodyMemberRole;
  positionAssignmentId: string | null;
  userId: string | null;
  appointedAt: Date;
  expiresAt: Date | null;
}

export interface AuthorizationContext {
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    role?: UserRole;
    title?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
    provider?: string;
    departmentId?: string | null;
    isActive: boolean;
  };
  systemRoles: SystemRole[];
  positions: ActivePositionAssignment[];
  responsibilityAreas: ActiveResponsibilityArea[];
  portfolios: ActivePortfolioAssignment[];
  delegations: ActiveDelegationGrant[];
  bodyMemberships: ActiveBodyMembership[];
  primaryUnitIds: string[];
  generatedAt: Date;

  // Convenience query methods
  hasSystemRole(role: SystemRole): boolean;
  isSystemAdmin(): boolean;
  hasPosition(code: string): boolean;
  hasResponsibilityArea(code: string): boolean;
  hasLeadershipPosition(): boolean;
  getPositionsInUnit(unitId: string): ActivePositionAssignment[];
  getActiveDelegationsForAction(action: string): ActiveDelegationGrant[];
}

export class AuthorizationContextModel implements AuthorizationContext {
  public readonly userId: string;
  public readonly user: {
    id: string;
    email: string;
    name: string;
    role?: UserRole;
    title?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
    provider?: string;
    departmentId?: string | null;
    isActive: boolean;
  };
  public readonly systemRoles: SystemRole[];
  public readonly positions: ActivePositionAssignment[];
  public readonly responsibilityAreas: ActiveResponsibilityArea[];
  public readonly portfolios: ActivePortfolioAssignment[];
  public readonly delegations: ActiveDelegationGrant[];
  public readonly bodyMemberships: ActiveBodyMembership[];
  public readonly primaryUnitIds: string[];
  public readonly generatedAt: Date;

  constructor(data: {
    userId: string;
    user: {
      id: string;
      email: string;
      name: string;
      role?: UserRole;
      title?: string | null;
      phone?: string | null;
      avatarUrl?: string | null;
      provider?: string;
      departmentId?: string | null;
      isActive: boolean;
    };
    systemRoles: SystemRole[];
    positions: ActivePositionAssignment[];
    responsibilityAreas: ActiveResponsibilityArea[];
    portfolios: ActivePortfolioAssignment[];
    delegations: ActiveDelegationGrant[];
    bodyMemberships: ActiveBodyMembership[];
    primaryUnitIds: string[];
    generatedAt?: Date;
  }) {
    this.userId = data.userId;
    this.user = data.user;
    this.systemRoles = data.systemRoles;
    this.positions = data.positions;
    this.responsibilityAreas = data.responsibilityAreas;
    this.portfolios = data.portfolios;
    this.delegations = data.delegations;
    this.bodyMemberships = data.bodyMemberships;
    this.primaryUnitIds = data.primaryUnitIds;
    this.generatedAt = data.generatedAt ?? new Date();
  }

  hasSystemRole(role: SystemRole): boolean {
    return this.systemRoles.includes(role);
  }

  isSystemAdmin(): boolean {
    return this.hasSystemRole(SystemRole.SYSTEM_ADMIN);
  }

  hasPosition(code: string): boolean {
    return this.positions.some(
      (p) => p.positionCode === code || p.positionCode.startsWith(`${code}_`)
    );
  }

  hasResponsibilityArea(code: string): boolean {
    return this.responsibilityAreas.some(
      (a) => a.code === code || a.code.startsWith(`${code}_`)
    );
  }

  hasLeadershipPosition(): boolean {
    return this.positions.some((p) => p.isLeadership);
  }

  getPositionsInUnit(unitId: string): ActivePositionAssignment[] {
    return this.positions.filter((p) => p.unitId === unitId);
  }

  getActiveDelegationsForAction(action: string): ActiveDelegationGrant[] {
    return this.delegations.filter(
      (d) =>
        (!d.granteeUserId || d.granteeUserId === this.userId) &&
        (d.action === action || d.action === '*')
    );
  }
}
