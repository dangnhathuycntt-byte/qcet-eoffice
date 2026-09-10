# Domain & Authorization Architecture Freeze Rules (Phase 0)

These architectural freeze rules apply unconditionally across all files, tools, workflows, and operations in QCET E-Office during the re-architecture initiative.

## 1. Prohibit Role Expansion in UserRole Enum & Client UI
- Strictly prohibit adding new enum values to `UserRole` in `prisma/schema.prisma`.
- Strictly prohibit authoring new client-side role branches, switch statements, or ad-hoc conditions checking `user.role` (e.g., `if (user.role === '...')`).
- Strictly prohibit creating new viewpoint facades, simulated role selectors, or client-side masquerading components (`forcedRole`, role switcher pills, viewpoint banners).

## 2. Prohibit Collapsing Roles to ADMIN/MANAGER/STAFF for Business Authority
- Strictly prohibit reducing or mapping institutional positions and governance authorities to a generic three-tier SaaS triad (`ADMIN | MANAGER | STAFF`).
- Vietnamese public vocational higher-education governance (Luật Giáo dục nghề nghiệp, Điều lệ Trường Cao đẳng, QCET Organizational Regulations) operates on statutory institutional titles (Hiệu trưởng, Phó Hiệu trưởng, Trưởng phòng, Phó Trưởng phòng, Trưởng khoa, Phó Trưởng khoa, Chuyên viên, Giảng viên, Văn thư) with legally defined purviews, not generic SaaS roles.
- Do not introduce new authorization logic or access controls based on the synthetic `ADMIN | MANAGER | STAFF` classification.

## 3. Prohibit Using TaskScope as Permission or Access Control Model
- `TaskScope` (`SCHOOL`, `DEPARTMENT`/`UNIT`, `INDIVIDUAL`/`PERSONAL`) is purely a visual display scope and query aggregation filter for dashboards and tables.
- `TaskScope` must NEVER be used to evaluate, grant, assert, or restrict operational permissions, write authority, or approval rights.
- Scope selection by an authenticated user does NOT alter, widen, or narrow their statutory operational authorization.

## 4. Prohibit Equating DACUM Job Duties with Software Operational Permissions
- DACUM (Developing A CurriculUM) charts, job duties, tasks, and competency matrices represent occupational analysis and vocational training descriptions.
- DACUM elements are NOT software security permissions, functional authorization tokens, or statutory delegation grants.
- Strictly prohibit binding software operational permissions, workflow transitions, or administrative approval rights directly to DACUM occupational duty codes or job matrices.

## 5. Freeze All Active UX Role-Patching Plans
- All pending and active UX role-patching initiatives, role-based UI workarounds, and client-side authorization facades are formally frozen.
- No new features, refactors, or PRs may introduce temporary role adaptations or client-side permission workarounds until the Phase 1-10 domain and authorization re-architecture is implemented.
- Engineering effort is restricted to critical bugfixes that do not expand role semantics.
