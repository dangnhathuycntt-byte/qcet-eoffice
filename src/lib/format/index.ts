/**
 * Canonical formatting utilities barrel (C19 — Content & Terminology Contract).
 *
 * Single import surface for the date/time, relative-date, and academic-period formats
 * frozen in docs/ux/QCET_UI_VOCABULARY.md §G. Pure presentation only.
 *
 * Consolidation status (C19 §J): this barrel is the intended single implementation, but
 * as of v1 no production surface imports it — the only consumer is the C19 contract test,
 * so it does not yet change runtime output. The owning copy-cleanup surfaces listed in
 * docs/ux/QCET_UI_VOCABULARY.md §J (the §J.1 relative-deadline map, starting with
 * `formatRelativeDate`) must be wired to these helpers before this module is authoritative
 * in runtime; until then the in-repo copies they replace remain the de-facto renderers.
 */

export * from "./date";
export * from "./relative-date";
export * from "./academic-period";
