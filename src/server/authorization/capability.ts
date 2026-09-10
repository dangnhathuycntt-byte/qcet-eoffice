/**
 * CANONICAL CAPABILITY DEFINITIONS FOR QCET E-OFFICE
 * Re-exports canonical capabilities, action types, and categories.
 */

export type {
  CapabilityAction,
  TaskCapabilityAction,
  DocumentIncomingCapabilityAction,
  DocumentOutgoingCapabilityAction,
  DossierCapabilityAction,
  SystemCapabilityAction,
  StatutoryNonDelegableAction,
} from '@/lib/auth/hybrid-authorization';

export {
  TASK_CAPABILITIES,
  DOCUMENT_INCOMING_CAPABILITIES,
  DOCUMENT_OUTGOING_CAPABILITIES,
  DOSSIER_CAPABILITIES,
  SYSTEM_CAPABILITIES,
  NON_DELEGABLE_CAPABILITIES,
  PORTFOLIO_BOUND_ACTIONS,
} from '@/lib/auth/hybrid-authorization';
