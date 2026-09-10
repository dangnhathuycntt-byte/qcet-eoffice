/**
 * Document Numbering Module (ND 30/2020/ND-CP)
 * Canonical entry point for document sequence numbering and formatting.
 * Re-exports and enhances the underlying numbering engine with atomic race-free guarantees.
 */

export {
  formatDocumentDisplayNumber,
  formatRegistrationNumber,
  generateDocumentCode,
  simulateAtomicNumbering,
  getNextRegistrationNumber,
  getNextRegistrationNumberRawSql,
  getNextDocumentSequence,
  resetDocumentMemorySequences,
} from "./documents/numbering-engine";

export type { DocumentNumberingOptions } from "./documents/numbering-engine";
export type { DocumentType } from "@/types/document";
