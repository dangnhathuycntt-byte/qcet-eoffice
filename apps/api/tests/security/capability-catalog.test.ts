import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  MEETING_CAPABILITIES,
  DOCUMENT_CANONICAL_CAPABILITIES,
  DOCUMENT_CAPABILITIES,
  DOCUMENT_INCOMING_CAPABILITIES,
  DOCUMENT_OUTGOING_CAPABILITIES,
  TASK_CAPABILITIES,
  SYSTEM_CAPABILITIES,
  DOSSIER_CAPABILITIES,
  NON_DELEGABLE_CAPABILITIES,
  STATUTORY_SIGNING_CAPABILITIES,
  PORTFOLIO_BOUND_ACTIONS,
  CAPABILITY_CATEGORIES,
  isMeetingCapability,
  isDocumentCapability,
  isTaskCapability,
  isSystemCapability,
  isDossierCapability,
  isHrCapability,
  isStatutorySigningCapability,
  isNonDelegableCapability,
  isValidCapability,
  isCapabilityAction,
  getCapabilityCategory,
  getCapabilityMetadata,
  resolveCanonicalCapability,
  type CapabilityAction,
  type MeetingCapabilityAction,
  type DocumentCanonicalCapabilityAction,
  type TaskCapabilityAction,
  type SystemCapabilityAction,
} from '@/server/authorization/capability';

describe('Sprint 2: Task 3 - Fine-Grained Capability Catalog & Boundary Classification', () => {
  describe('1. Meeting Capabilities', () => {
    const requiredMeetingActions: readonly string[] = [
      'meeting.read',
      'meeting.create',
      'meeting.update',
      'meeting.manage_participants',
      'meeting.draft_minutes',
      'meeting.confirm_minutes',
      'meeting.create_resolution',
      'meeting.publish_resolution',
    ];

    test('declares all 8 required meeting capabilities in MEETING_CAPABILITIES catalog', () => {
      for (const action of requiredMeetingActions) {
        assert.ok(
          (MEETING_CAPABILITIES as readonly string[]).includes(action),
          `Missing required meeting capability: ${action}`
        );
      }
      assert.equal(MEETING_CAPABILITIES.length, 8);
    });

    test('type guard isMeetingCapability identifies meeting actions correctly', () => {
      for (const action of requiredMeetingActions) {
        assert.equal(
          isMeetingCapability(action),
          true,
          `Expected isMeetingCapability('${action}') to be true`
        );
        assert.equal(isValidCapability(action), true);
      }

      assert.equal(isMeetingCapability('task.read'), false);
      assert.equal(isMeetingCapability('document.sign'), false);
      assert.equal(isMeetingCapability('meeting.unknown'), false);
      assert.equal(isMeetingCapability(null), false);
      assert.equal(isMeetingCapability(undefined), false);
    });

    test('meeting capabilities have MEETING category metadata', () => {
      for (const action of requiredMeetingActions) {
        assert.equal(getCapabilityCategory(action as CapabilityAction), 'MEETING');
        const meta = getCapabilityMetadata(action as CapabilityAction);
        assert.ok(meta, `Metadata should exist for ${action}`);
        assert.equal(meta.category, 'MEETING');
        assert.ok(meta.name.length > 0);
      }
    });

    test('meeting resolutions and minutes confirmation are marked portfolio-bound', () => {
      const boundMeetingActions = [
        'meeting.confirm_minutes',
        'meeting.create_resolution',
        'meeting.publish_resolution',
      ];
      for (const action of boundMeetingActions) {
        assert.ok(
          (PORTFOLIO_BOUND_ACTIONS as readonly string[]).includes(action),
          `Expected ${action} to be portfolio-bound`
        );
        const meta = getCapabilityMetadata(action as CapabilityAction);
        assert.equal(meta?.isPortfolioBound, true);
      }
    });
  });

  describe('2. Document Capabilities & Statutory Signing', () => {
    const requiredDocumentActions: readonly string[] = [
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
    ];

    test('declares all 12 canonical document capabilities including read_restricted', () => {
      for (const action of requiredDocumentActions) {
        assert.ok(
          (DOCUMENT_CANONICAL_CAPABILITIES as readonly string[]).includes(action),
          `Missing canonical document action: ${action}`
        );
        assert.ok(
          (DOCUMENT_CAPABILITIES as readonly string[]).includes(action),
          `Missing action in general document catalog: ${action}`
        );
        assert.equal(isDocumentCapability(action), true);
        assert.equal(isValidCapability(action), true);
      }
    });

    test('declares document.read_restricted with restricted access metadata', () => {
      assert.ok((DOCUMENT_CANONICAL_CAPABILITIES as readonly string[]).includes('document.read_restricted'));
      const meta = getCapabilityMetadata('document.read_restricted');
      assert.ok(meta);
      assert.equal(meta.category, 'DOCUMENT');
      assert.ok(meta.name.toLowerCase().includes('mật') || meta.name.toLowerCase().includes('restricted'));
    });

    test('identifies statutory signing capabilities correctly', () => {
      const statutorySigningActions = [
        'document.sign',
        'document.organization_sign',
        'document.outgoing.sign',
        'document.outgoing.authorized_sign',
        'document.outgoing.sign_kt',
        'document.outgoing.sign_tuq',
        'document.outgoing.organization_sign',
      ];

      for (const action of statutorySigningActions) {
        assert.ok(
          (STATUTORY_SIGNING_CAPABILITIES as readonly string[]).includes(action),
          `Expected ${action} in STATUTORY_SIGNING_CAPABILITIES`
        );
        assert.equal(
          isStatutorySigningCapability(action),
          true,
          `Expected isStatutorySigningCapability('${action}') to be true`
        );
        const meta = getCapabilityMetadata(action as CapabilityAction);
        assert.equal(meta?.isStatutorySigning, true);
      }

      assert.equal(isStatutorySigningCapability('document.read'), false);
      assert.equal(isStatutorySigningCapability('document.review_format'), false);
      assert.equal(isStatutorySigningCapability('task.approve'), false);
    });

    test('preserves incoming and outgoing compatibility aliases and resolves them to canonical', () => {
      const aliasMappings: Record<string, DocumentCanonicalCapabilityAction> = {
        'document.incoming.register': 'document.register',
        'document.incoming.direct': 'document.direct',
        'document.incoming.assign_unit': 'document.assign_unit',
        'document.outgoing.review_content': 'document.review_content',
        'document.outgoing.approve_content': 'document.review_content',
        'document.outgoing.review_format': 'document.review_format',
        'document.outgoing.check_format': 'document.review_format',
        'document.outgoing.approve_format': 'document.review_format',
        'document.outgoing.sign': 'document.sign',
        'document.outgoing.authorized_sign': 'document.sign',
        'document.outgoing.sign_kt': 'document.sign',
        'document.outgoing.sign_tuq': 'document.sign',
        'document.outgoing.number': 'document.assign_number',
        'document.outgoing.assign_number': 'document.assign_number',
        'document.outgoing.organization_sign': 'document.organization_sign',
        'document.outgoing.issue': 'document.issue',
      };

      for (const [alias, canonical] of Object.entries(aliasMappings)) {
        assert.ok(
          (DOCUMENT_CAPABILITIES as readonly string[]).includes(alias),
          `Alias ${alias} must exist in DOCUMENT_CAPABILITIES`
        );
        assert.equal(isDocumentCapability(alias), true);
        assert.equal(isValidCapability(alias), true);
        assert.equal(
          resolveCanonicalCapability(alias as CapabilityAction),
          canonical,
          `Expected ${alias} to resolve to canonical ${canonical}`
        );
      }

      // Canonical capability resolves to itself
      assert.equal(resolveCanonicalCapability('document.sign'), 'document.sign');
      assert.equal(resolveCanonicalCapability('document.read_restricted'), 'document.read_restricted');
    });

    test('type guard isDocumentCapability rejects non-document actions', () => {
      assert.equal(isDocumentCapability('meeting.read'), false);
      assert.equal(isDocumentCapability('task.create'), false);
      assert.equal(isDocumentCapability('system.configure'), false);
    });
  });

  describe('3. Task Capabilities', () => {
    const requiredTaskActions: readonly string[] = [
      'task.read',
      'task.create',
      'task.review',
      'task.approve',
      'task.reassign',
      'task.monitor',
    ];

    test('declares all required task capabilities including task.read and task.view', () => {
      for (const action of requiredTaskActions) {
        assert.ok(
          (TASK_CAPABILITIES as readonly string[]).includes(action),
          `Missing task action: ${action}`
        );
        assert.equal(isTaskCapability(action), true);
        assert.equal(isValidCapability(action), true);
      }

      // Backward compatibility with task.view
      assert.ok((TASK_CAPABILITIES as readonly string[]).includes('task.view'));
      assert.equal(isTaskCapability('task.view'), true);
      assert.equal(resolveCanonicalCapability('task.view' as CapabilityAction), 'task.read');
    });

    test('type guard isTaskCapability identifies task actions correctly', () => {
      assert.equal(isTaskCapability('task.create'), true);
      assert.equal(isTaskCapability('task.approve'), true);
      assert.equal(isTaskCapability('task.reassign'), true);
      assert.equal(isTaskCapability('meeting.create'), false);
      assert.equal(isTaskCapability('document.read'), false);
    });

    test('task capabilities have TASK category metadata', () => {
      for (const action of requiredTaskActions) {
        assert.equal(getCapabilityCategory(action as CapabilityAction), 'TASK');
        const meta = getCapabilityMetadata(action as CapabilityAction);
        assert.ok(meta);
        assert.equal(meta.category, 'TASK');
      }
    });
  });

  describe('4. System & Administrative Capabilities', () => {
    const requiredSystemActions: readonly string[] = [
      'account.manage',
      'org.manage',
      'position.manage',
      'system.configure',
      'audit.view',
    ];

    test('declares all required system administrative capabilities', () => {
      for (const action of requiredSystemActions) {
        assert.ok(
          (SYSTEM_CAPABILITIES as readonly string[]).includes(action),
          `Missing system action: ${action}`
        );
        assert.equal(isSystemCapability(action), true);
        assert.equal(isValidCapability(action), true);
        assert.equal(getCapabilityCategory(action as CapabilityAction), 'SYSTEM');
      }
    });

    test('supports system.* namespace aliases for administrative actions', () => {
      const prefixed = [
        'system.account.manage',
        'system.org.manage',
        'system.position.manage',
        'system.system.configure',
        'system.audit.view',
      ];
      for (const action of prefixed) {
        assert.ok((SYSTEM_CAPABILITIES as readonly string[]).includes(action));
        assert.equal(isSystemCapability(action), true);
        assert.equal(isValidCapability(action), true);
      }
    });
  });

  describe('5. Statutory Non-Delegable Boundaries & Legal Invariants', () => {
    const statutoryNonDelegableActions: readonly string[] = [
      'position.manage_leadership',
      'hr.disciplinary_action',
      'finance.treasury_disbursement',
      'regulation.institutional_amend',
      'account.manage',
      'system.configure',
      'org.manage',
      'position.manage',
    ];

    test('strictly marks statutory leadership, discipline, treasury and amendment as non-delegable', () => {
      for (const action of statutoryNonDelegableActions) {
        assert.ok(
          (NON_DELEGABLE_CAPABILITIES as readonly string[]).includes(action),
          `Action ${action} must be in NON_DELEGABLE_CAPABILITIES`
        );
        assert.equal(
          isNonDelegableCapability(action),
          true,
          `Expected isNonDelegableCapability('${action}') to be true`
        );
        const meta = getCapabilityMetadata(action as CapabilityAction);
        assert.equal(
          meta?.isStatutoryNonDelegable,
          true,
          `Metadata for ${action} must have isStatutoryNonDelegable: true`
        );
      }
    });

    test('regular operational capabilities are delegable under valid DelegationGrant', () => {
      const delegableActions: readonly string[] = [
        'task.read',
        'task.review',
        'document.register',
        'meeting.draft_minutes',
        'dossier.open',
      ];

      for (const action of delegableActions) {
        assert.equal(
          isNonDelegableCapability(action),
          false,
          `Action ${action} should NOT be non-delegable`
        );
        const meta = getCapabilityMetadata(action as CapabilityAction);
        assert.equal(meta?.isStatutoryNonDelegable, false);
      }
    });
  });

  describe('6. Capability Categories & General Metadata Integrity', () => {
    test('declares all canonical categories: MEETING, DOCUMENT, TASK, SYSTEM, DOSSIER, HR', () => {
      const expectedCategories = ['MEETING', 'DOCUMENT', 'TASK', 'SYSTEM', 'DOSSIER', 'HR'];
      for (const cat of expectedCategories) {
        assert.ok(
          (CAPABILITY_CATEGORIES as readonly string[]).includes(cat),
          `Category ${cat} must be declared in CAPABILITY_CATEGORIES`
        );
      }
    });

    test('every capability registered in catalogs has valid metadata and category', () => {
      const allActionLists = [
        ...MEETING_CAPABILITIES,
        ...DOCUMENT_CAPABILITIES,
        ...TASK_CAPABILITIES,
        ...SYSTEM_CAPABILITIES,
        ...DOSSIER_CAPABILITIES,
      ];

      for (const action of allActionLists) {
        const meta = getCapabilityMetadata(action as CapabilityAction);
        assert.ok(meta, `Capability ${action} must have registered metadata`);
        assert.ok(
          (CAPABILITY_CATEGORIES as readonly string[]).includes(meta.category),
          `Invalid category ${meta.category} for ${action}`
        );
        assert.ok(typeof meta.isStatutoryNonDelegable === 'boolean');
        assert.ok(typeof meta.isPortfolioBound === 'boolean');
      }
    });
  });

  describe('7. Prohibition of Role Checks & Security Guardrails', () => {
    test('isValidCapability rejects role names, fake permissions, and malicious inputs', () => {
      // Role names must never be accepted as capabilities
      const forbiddenRoles = [
        'ADMIN',
        'MANAGER',
        'STAFF',
        'HIEU_TRUONG',
        'PHO_HIEU_TRUONG',
        'TRUONG_PHONG',
        'VAN_THU',
        'user.role',
      ];

      for (const fakeCap of forbiddenRoles) {
        assert.equal(isValidCapability(fakeCap), false, `Role name ${fakeCap} must not be a capability`);
        assert.equal(isCapabilityAction(fakeCap), false);
      }

      // Arbitrary inputs
      assert.equal(isValidCapability(''), false);
      assert.equal(isValidCapability('task.*'), false);
      assert.equal(isValidCapability('__proto__'), false);
      assert.equal(isValidCapability({}), false);
      assert.equal(isValidCapability(123), false);
      assert.equal(isValidCapability(null), false);
      assert.equal(isValidCapability(undefined), false);
    });

    test('backward compatibility alias isCapabilityAction mirrors isValidCapability', () => {
      assert.equal(isCapabilityAction('meeting.read'), true);
      assert.equal(isCapabilityAction('document.read_restricted'), true);
      assert.equal(isCapabilityAction('task.approve'), true);
      assert.equal(isCapabilityAction('invalid.capability'), false);
    });
  });
});
