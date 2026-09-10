---
status: active
domain: architecture
phase: 0
created: 2026-09-09
---

# QCET E-Office: Domain Architecture Freeze & Institutional Re-Architecture Plan

## Executive Summary & Freeze Declaration

Effective immediately, this document issues an unconditional architectural freeze on all business-role modifications, role-based UI adaptations, and ad-hoc authorization patching across the QCET E-Office codebase.

The current authorization and role model is fundamentally misaligned with the institutional reality of Quang Ninh College of Economic and Technology (Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn  - QCET). Continuing to layer client-side viewpoint patches, synthetic role enums, or ad-hoc permission overrides upon flawed assumptions introduces compounding technical debt and architectural incoherence.

Phase 0 locks the domain boundary. Engineering effort is strictly restricted to non-semantic maintenance and bugfixes while the system undergoes a phased re-architecture (Phases 0 through 10) to establish a legally grounded, enterprise-grade institutional domain model.

---

## Analysis: Fundamental Flaws in Current Models

### 1. The Enum Schism: Database vs. Client vs. Middleware
The codebase suffers from a three-way structural contradiction regarding user roles:

- **Database Layer (`prisma/schema.prisma`)**:
  ```prisma
  enum UserRole {
    BAN_GIAM_HIEU
    TRUONG_PHONG
    CHUYEN_VIEN
    VAN_THU
    ADMIN
  }
  ```
- **TypeScript Auth Layer (`src/types/auth.ts`)**:
  ```typescript
  export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';
  ```
- **Server Middleware & Request Context (`src/server/api/request-context.ts`)**:
  Performs lossy, arbitrary normalization:
  ```typescript
  BAN_GIAM_HIEU -> ADMIN
  BGH -> ADMIN
  HIEU_TRUONG -> ADMIN
  PHO_HIEU_TRUONG -> ADMIN
  TRUONG_PHONG -> MANAGER
  CHUYEN_VIEN -> STAFF
  ```

This schism causes catastrophic loss of business semantics:
- The Principal (Hiệu trưởng - head of institution, legal representative) and Vice Principals (Phó Hiệu trưởng - assisting in assigned fields) are lumped together as generic `ADMIN`.
- Academic Deans (Trưởng khoa) and Administrative Department Heads (Trưởng phòng) are flattened into `MANAGER`, ignoring distinct statutory operational purviews.
- Lecturers/Faculty (Giảng viên) and Administrative Officers (Chuyên viên) are collapsed into `STAFF`.

### 2. The SaaS Anti-Pattern: Generic Three-Tier Triad (`ADMIN / MANAGER / STAFF`)
The system attempts to force a Vietnamese public vocational college into a generic SaaS three-role paradigm.

Public higher-education and vocational institutions in Vietnam are governed by:
- **Luật Giáo dục nghề nghiệp số 74/2014/QH13**
- **Thông tư số 15/2021/TT-BLĐTBXH** ban hành Điều lệ Trường cao đẳng
- **Quy chế tổ chức và hoạt động** của Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn 
- Quyết định phân công nhiệm vụ trong Ban Giám hiệu và chức năng nhiệm vụ của 12 phòng, khoa, trung tâm.

In this legal structure:
- Authority is defined by **Statutory Position (Chức vụ)**, **Organizational Unit (Đơn vị)**, and **Official Written Delegation (Văn bản ủy quyền / Phân công nhiệm vụ)**.
- A generic `ADMIN` role violates institutional separation of duties and legal accountability. An IT system administrator (`ADMIN`) has database maintenance privileges, but zero statutory authority to issue school directives, approve academic curricula, or sign financial disbursements.

### 3. Conflation of Authority (Role) with Display Scope (`TaskScope`)
A core universal invariant of QCET E-Office is: **Role Is Not Scope**.
- **Authority (Who can do what)**: Determined by institutional appointment and delegation.
- **Scope (What slice of data is currently viewed)**: `SCHOOL` (toàn trường), `DEPARTMENT` (đơn vị), `INDIVIDUAL` (cá nhân).

The legacy implementation repeatedly inverted this rule. Code patterns like:
```typescript
// Anti-pattern in legacy API:
if (existingTask.scope === TaskScope.SCHOOL && actor.role !== "ADMIN") {
  throw new ForbiddenError();
}
```
This conflation causes two failure modes:
- Users with legitimate authority over a unit-level task cannot execute administrative steps if the task was labeled with school-wide impact.
- Switching UI scope filters in the client was mistakenly perceived as switching user privileges, creating confusion between navigation filters and access control.

### 4. Category Error: Equating DACUM Competence Analysis with Software Operational Permissions
DACUM (Developing A CurriculUM) is an occupational analysis methodology used in technical education to analyze job duties, tasks, and worker competencies for vocational curriculum creation and job performance appraisal.

- DACUM defines: "A mechanical maintenance worker must be able to align shaft couplings (Duty B, Task 3)."
- DACUM does NOT define: "User ID 102 has permission to approve database record #492 in the institutional task tracking system."

Equating DACUM duties to software operational authorization tokens or approval delegation rights conflates vocational pedagogy with enterprise cybersecurity and statutory delegation.

### 5. Client-Side Illusion & Mock Facades
The presence of client-side role mocking mechanisms (`forcedRole`, `RoleSwitcherPill`, `RoleViewpointBanner`) creates an architectural illusion:
- Developers and QA test interfaces by forcing local state, masking severe server-side authorization deficits.
- Security and workflow transitions are checked in React components rather than evaluated authoritatively in transactional server policies.

---

## The Migration Roadmap: Phases 0 through 10

```
Phase 0: Architectural Freeze (Current)
   │
Phase 1: Legal & Institutional Grounding
   │
Phase 2: Domain Specification & Bounded Contexts
   │
Phase 3: Authorization Model & Policy Architecture (ABAC / ReBAC)
   │
Phase 4: Database Schema & Migration Strategy
   │
Phase 5: Authoritative Server-Side Policy Engine
   │
Phase 6: API Layer Harmonization & Policy Enforcement
   │
Phase 7: Clean Data Migration & Institutional Seed Alignment
   │
Phase 8: Client UI De-SaaSification & Capability Binding
   │
Phase 9: Adversarial Security Verification & Audit
   │
Phase 10: Production Cutover, Decommissioning & Documentation Handover
```

### Phase 0: Freeze Business-Role Changes (Current)
- **Objective**: Halt expanding legacy role enums and client-side role facades.
- **Deliverables**:
  - Publication of `.claude/rules/05-domain-freeze.md`.
  - Publication of this master freeze plan (`docs/plans/2026-09-09-domain-architecture-freeze.md`).
  - Strict enforcement across all development agents.

### Phase 1: Legal & Institutional Grounding
- **Objective**: Collect, formalize, and index the statutory governance framework of QCET.
- **Scope**:
  - Regulatory basis: Luật GDNN 2014, Thông tư 15/2021/TT-BLĐTBXH.
  - Institutional statutes: QCET Organizational Regulations, Executive Allocation Decisions (Quyết định phân công Ban Giám hiệu).
  - Organizational Units: Exact charter and statutory scope for all 12 functional departments, academic faculties, and centers.
  - Document & Task regulations: Quy chế công tác văn thư, quy trình giao và theo dõi nhiệm vụ.

### Phase 2: Domain Specification & Bounded Contexts
- **Objective**: Formalize domain models representing authentic institutional dynamics.
- **Entities**:
  - `OrganizationalUnit`: Department, Faculty, Center, Board of Rectors (Ban Giám hiệu).
  - `InstitutionalPosition`: Hiệu trưởng, Phó Hiệu trưởng, Trưởng phòng, Phó Trưởng phòng, Trưởng khoa, Phó Trưởng khoa, Giảng viên, Chuyên viên, Văn thư.
  - `PersonnelAppointment`: Association of an authenticated user with one or more positions in specific units, with start/end dates.
  - `StatutoryDelegation`: Formal written delegation of specific administrative signing/approval authority with validity dates and scope.
  - `TaskLifecycle`: Institutional task issuance, co-assignment, execution reporting, verification, and closure.
  - `DocumentFlow`: Official dispatch processing according to Nghị định 30/2020/NĐ-CP.

### Phase 3: Authorization Model & Policy Architecture
- **Objective**: Design an Attribute-Based / Relationship-Based Access Control (ABAC/ReBAC) architecture.
- **Decoupling**:
  - **Identity (Authentication)**: Who is the user (Google Workspace SSO, email, account status).
  - **Institutional Office**: What positions and units does the user hold.
  - **Operational Capabilities (Authorization Grants)**: What exact actions can the user take on a specific resource in a specific context (e.g., `task:approve`, `document:sign`, `report:submit`).

### Phase 4: Database Schema & Migration Strategy
- **Objective**: Design normalized schema changes in PostgreSQL/Prisma.
- **Requirements**:
  - Replace hardcoded `UserRole` enum with relational tables: `Unit`, `Position`, `UserPositionAssignment`, `DelegationGrant`.
  - Provide a backward-compatible migration plan that prevents data loss for existing tasks, documents, and user records.
  - Prepare Prisma migration scripts and verification tests.

### Phase 5: Authoritative Server-Side Policy Engine
- **Objective**: Implement a centralized, pure server-side policy evaluation layer (`src/server/auth/policies/`).
- **Invariants**:
  - Server truth is absolute: authorization decisions run exclusively on the server in database transactions or server action entry points.
  - Eliminate all client-supplied authority claims.
  - Introduce structured audit logging for all policy decisions and delegations.

### Phase 6: API Layer Harmonization & Policy Enforcement
- **Objective**: Refactor API endpoints to enforce canonical server policies.
- **Actions**:
  - Remove all ad-hoc role queries and query-param overrides (`?role=ADMIN`, `forcedRole`).
  - Return typed capabilities with entity responses (e.g., `{ task, capabilities: { canEdit: boolean, canApprove: boolean, canDelegate: boolean } }`).

### Phase 7: Clean Data Migration & Institutional Seed Alignment
- **Objective**: Seed and migrate real QCET organizational units and personnel accounts.
- **Actions**:
  - Populate authentic organizational structure: 12 functional units, academic faculties, executive office.
  - Migrate active tasks to reference canonical units and assignees.
  - Verify referential integrity with zero synthetic fallback records.

### Phase 8: Client UI De-SaaSification & Capability Binding
- **Objective**: Align user interface with server capabilities and remove role facades.
- **Actions**:
  - Remove `forcedRole`, `RoleSwitcherPill`, `RoleViewpointBanner`, and mock role selectors.
  - Bind UI controls (buttons, modals, approval dialogs) to server-provided capability flags (`capabilities.canApprove`).
  - Ensure UI accurately displays institutional position titles and unit affiliations.

### Phase 9: Adversarial Security Verification & Audit
- **Objective**: Execute comprehensive adversarial testing of the authorization engine.
- **Test Scenarios**:
  - Privilege escalation attempts across departmental boundaries.
  - Self-approval attempts by task owners and evidence submitters.
  - Expired and out-of-scope delegation attempts.
  - Verification of complete audit trails for high-privilege operations.

### Phase 10: Production Cutover, Decommissioning & Documentation Handover
- **Objective**: Decommission legacy code, finalize canonical documentation, and hand over.
- **Deliverables**:
  - Remove deprecated legacy enums and compatibility shims.
  - Update `ARCHITECTURE.md` and operational manuals.
  - Archive all superseded plans into `docs/plans/superseded/`.

---

## Operational Guidelines: Bugfixes vs. Forbidden Semantic Expansions

During the Phase 0 Freeze, engineers and autonomous agents must strictly distinguish between permitted system maintenance and forbidden semantic modifications.

### 1. Permitted Maintenance (Allowed)
- **UI & Layout Defect Repairs**:
  - Fixing broken CSS layout, flex/grid alignment, scrollbar behaviors, or visual cutoffs.
  - Repairing broken responsive layouts on mobile or tablet viewports.
  - Enforcing typographic standards (e.g., `font-mono tabular-nums`, removing emojis, Lucide icon consistency).
- **Client Crash & Exception Fixes**:
  - Adding null/undefined checks to prevent React runtime unhandled exceptions.
  - Resolving client memory leaks or infinite re-render loops in hooks.
- **Database & Query Performance**:
  - Adding database indexes to optimize slow queries without changing schema semantics.
  - Resolving N+1 query patterns in existing server routes.
- **Preservation of Existing Functionality**:
  - Bugfixes that restore previously working flows without adding new role logic or altering authorization rules.

### 2. Forbidden Semantic Expansions (Strictly Prohibited)
- **Adding Role Enum Values**:
  - Adding any new value to `enum UserRole` in `prisma/schema.prisma` (e.g., adding `GIANG_VIEN`, `PHO_HIEU_TRUONG`, `TO_TRUONG`).
- **Expanding Client Role Branching**:
  - Adding new `if (user.role === '...')` or `switch (user.role)` conditions in components.
  - Authoring new mock roles, role switcher controls, or viewpoint simulators.
- **Expanding the Triad (`ADMIN | MANAGER | STAFF`)**:
  - Adding new business logic or access control based on the synthetic `ADMIN | MANAGER | STAFF` classification.
  - Adding mapping functions that normalize real positions to `ADMIN`/`MANAGER`/`STAFF`.
- **Using TaskScope in Authorization**:
  - Using `task.scope` (`SCHOOL`, `DEPARTMENT`, `INDIVIDUAL`) to gate or grant edit/approval permissions.
- **Binding Permissions to DACUM Codes**:
  - Implementing access controls or approval rights tied to DACUM duty codes, competency trees, or job matrices.
- **Creating Parallel Authorization Engines**:
  - Writing new standalone permission helper libraries or ad-hoc RBAC decorators outside the planned Phase 3-5 architecture.
