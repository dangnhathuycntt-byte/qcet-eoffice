# Workload Critical-01: Statutory RBAC Authorization & Document Classification Boundary

## Objective
Implement server-side security authorization for confidential document access based on Vietnamese statutory positions (Hiệu trưởng, Phó Hiệu trưởng, Trưởng phòng, Chuyên viên) and document security classification levels (THUONG, MAT, TOI_MAT, TUYET_MAT) under Decree 30/2020/ND-CP.

## Scope
- Permitted files:
  - `src/contracts/documents.ts`
  - `src/lib/auth/document-clearance.ts`
  - `tests/unit/document-clearance.test.ts`
- Prohibited files:
  - Any files outside the permitted list.

## Requirements
1. **Requirement 1 (Contract & Clearance Levels)**:
   - Ensure `DocumentSecurityLevelSchema` in `src/contracts/documents.ts` is strictly typed.
   - Define statutory clearance mapping in `src/lib/auth/document-clearance.ts`:
     * `TUYET_MAT` & `TOI_MAT`: Only accessible by `HIEU_TRUONG` or explicit statutory designee.
     * `MAT`: Accessible by `HIEU_TRUONG`, `PHO_HIEU_TRUONG`, and `TRUONG_PHONG` of the owning department.
     * `THUONG`: Standard institutional access.

2. **Requirement 2 (Negative Security Assertion & Tamper Resistance)**:
   - Implement `assertDocumentReadAccess({ user, document })`:
     * Throws or returns `{ allowed: false, reason: string }` if user lacks statutory clearance.
     * Rejects disabled or inactive user accounts immediately regardless of role.
     * Prevents scope masquerading (client cannot claim school-wide clearance through TaskScope).

3. **Requirement 3 (Adversarial Security Tests)**:
   - Comprehensive test suite in `tests/unit/document-clearance.test.ts` proving negative assertions:
     * Staff/Chuyên viên cannot access `MAT` or `TOI_MAT`.
     * Disabled Hiệu trưởng account cannot access any document.
     * Scope manipulation does not grant unauthorized clearance.
