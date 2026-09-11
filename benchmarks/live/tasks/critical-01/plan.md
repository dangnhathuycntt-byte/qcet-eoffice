# Workload Critical-01: Institutional RBAC Authorization & Document Clearance Boundary

## Objective
Implement server-side security authorization for confidential institutional document access based on QCET internal administrative roles (Hiệu trưởng, Phó Hiệu trưởng, Trưởng phòng, Chuyên viên) and document security classification levels (THUONG, MAT, TOI_MAT, TUYET_MAT).

> **Policy Fixture Notice**:
> For the purposes of this benchmark evaluation, assume the following QCET Internal Institutional Security & Document Clearance Policy (Fixture), aligned strictly with core QCET invariants (05-domain-freeze, 00-core):
> - `TaskScope` is strictly a visual display filter, never an authorization token.
> - Inactive user accounts (`isActive: false`) are denied unconditionally.
> - Role represents institutional authority, not SaaS tiering.

## Scope
- Permitted files:
  - `src/contracts/documents.ts`
  - `src/lib/auth/document-clearance.ts`
  - `tests/unit/document-clearance.test.ts`
- Prohibited files:
  - Any files outside the permitted list.

## Requirements
1. **Requirement 1 (Contract & Classification Schema)**:
   - In `src/contracts/documents.ts`, define `DocumentSecurityLevelSchema` supporting:
     * `THUONG` (Unclassified / Standard)
     * `MAT` (Confidential)
     * `TOI_MAT` (Secret)
     * `TUYET_MAT` (Top Secret)
   - Export type `DocumentSecurityLevel`.

2. **Requirement 2 (Clearance Evaluation Engine & Negative Assertions)**:
   - In `src/lib/auth/document-clearance.ts`, implement `assertDocumentReadAccess({ user, document, scope })`:
     * If `user.isActive === false`: unconditionally throw or return `{ allowed: false, reason: 'USER_INACTIVE' }`.
     * If `document.securityLevel === 'TUYET_MAT'`: only `HIEU_TRUONG` may access.
     * If `document.securityLevel === 'TOI_MAT'`: only `HIEU_TRUONG` and `PHO_HIEU_TRUONG` may access.
     * If `document.securityLevel === 'MAT'`: only `HIEU_TRUONG`, `PHO_HIEU_TRUONG`, `TRUONG_PHONG`, and `TRUONG_KHOA` may access.
     * If `document.securityLevel === 'THUONG'`: accessible by authenticated institutional roles (`CHUYEN_VIEN`, `GIANG_VIEN`, etc.).
     * **Scope Invariant**: `scope` (e.g. `TaskScope.SCHOOL`) must NEVER bypass or elevate security level checks. An unauthorized user requesting `SCHOOL` scope must still be rejected.

3. **Requirement 3 (Adversarial Security Unit Tests)**:
   - Provide unit tests in `tests/unit/document-clearance.test.ts` covering:
     * Chuyên viên rejected from `MAT`, `TOI_MAT`, `TUYET_MAT`.
     * Inactive Hiệu trưởng rejected from all levels.
     * Scope spoofing rejected.
     * Authorized reads permitted.
