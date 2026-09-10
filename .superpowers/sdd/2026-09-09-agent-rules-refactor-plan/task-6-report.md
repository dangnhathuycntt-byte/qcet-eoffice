# Task 6 Report: Plan & Spec Organization and Migration (Batch 5 - Phase 20)

**Date:** 2026-09-09  
**Status:** DONE  
**Branch:** `feat/dacum-role-delegation-workflow`  

---

## 1. Executive Summary

Successfully restructured the QCET documentation and planning lifecycle into a clean, predictable hierarchy under `docs/plans/`:
- `docs/plans/active/`: Strictly contains at most 1 master active plan per domain (`ux`, `security`, `data`, `agent`, `architecture`).
- `docs/plans/completed/`: Historical execution plans whose feature milestones have been fully implemented and verified.
- `docs/plans/superseded/`: Earlier plans superseded by newer master consolidation plans, with explicit `superseded_by:` links.

Every single plan and specification has been normalized with standardized YAML frontmatter, and POSIX relative symlinks have been installed in `docs/superpowers/plans/` to ensure zero broken paths for existing tools, agents, and references.

---

## 2. Directory Structure & Domain Constraints

### 2.1 Lifecycle Structure
```
docs/plans/
├── active/         # 4 active master plans (strictly <= 1 per domain)
├── completed/      # 31 completed historical plans
└── superseded/     # 38 superseded plans with superseded_by pointers
```

### 2.2 Active Master Plans Breakdown (Strict <= 1 per domain)
| Domain | Master Active Plan | Created | Description |
|---|---|---|---|
| `ux` | `2026-09-09-master-ux-consolidation-plan.md` | 2026-09-09 | Consolidates all UI/UX redesigns, ergonomic layouts, and anti-slop rules |
| `agent` | `2026-09-09-agent-rules-refactor-plan.md` | 2026-09-09 | Canonical agent rules refactor, multi-agent invariants, and SDD framework |
| `data` | `2026-09-09-database-architecture-hardening-plan.md` | 2026-09-09 | Referential integrity, optimistic concurrency, and audit logs |
| `architecture` | `2026-09-09-remaining-source-improvement-master-plan.md` | 2026-09-09 | System hardening, private file boundary, env config, and runtime safety |
| `security` | *(None active - 0)* | — | `2026-09-08-security-and-architecture-remediation-plan.md` completed |

*Constraint Verification: UX: 1, Agent: 1, Data: 1, Architecture: 1, Security: 0. Every domain strictly satisfies `<= 1 master active plan`.*

---

## 3. Metadata Frontmatter Standard

Every migrated plan in `docs/plans/` now begins with normalized YAML frontmatter:

```yaml
---
status: active | completed | superseded
domain: ux | security | data | agent | architecture
created: YYYY-MM-DD
supersedes:       # For master active plans that supersede older plans
  - <plan-file>
# or
superseded_by: <plan-file>  # For superseded plans
---
```

Specifications in root `docs/` (`SPEC_BAN_LAM_VIEC_UIUX_STANDARD.md`, `SPEC_DASHBOARD_DATA_CONSISTENCY_AND_AGGREGATION.md`, `SPEC_ERADICATE_MOCKUPS_AND_REAL_QCET_ALIGNMENT.md`, `SPEC-QCET-PERF-2025-01.md`) were also enriched with matching YAML frontmatter.

---

## 4. Complete Inventory of Migrated Plans

### 4.1 Active Plans (4 files)
1. `2026-09-09-agent-rules-refactor-plan.md` (`agent`)
2. `2026-09-09-database-architecture-hardening-plan.md` (`data`)
3. `2026-09-09-master-ux-consolidation-plan.md` (`ux`)
4. `2026-09-09-remaining-source-improvement-master-plan.md` (`architecture`)

### 4.2 Completed Plans (31 files)
1. `2026-09-03-eoffice-phase1.md` (`architecture`)
2. `2026-09-04-eoffice-sprint2.md` (`architecture`)
3. `2026-09-04-rbac-role-filtering.md` (`security`)
4. `2026-09-06-academic-month-task-schedule-plan.md` (`data`)
5. `2026-09-06-dacum-ai-approval-workflow.md` (`architecture`)
6. `2026-09-06-dacum-role-delegation-workflow-plan.md` (`architecture`)
7. `2026-09-06-department-task-organization-plan.md` (`architecture`)
8. `2026-09-06-executive-department-command-center-plan.md` (`architecture`)
9. `2026-09-06-real-user-auth-postgresql-plan.md` (`security`)
10. `2026-09-06-role-delegation-workflow.md` (`architecture`)
11. `2026-09-06-unified-task-management-hub.md` (`architecture`)
12. `2026-09-07-calendar-and-email-notification-plan.md` (`architecture`)
13. `2026-09-07-dashboard-architecture-refactor-plan.md` (`architecture`)
14. `2026-09-07-mobile-task-push-pwa-plan.md` (`architecture`)
15. `2026-09-07-nd30-document-registry-plan.md` (`architecture`)
16. `2026-09-07-onpremise-docker-production-plan.md` (`architecture`)
17. `2026-09-07-prisma-persistence-task-hub-plan.md` (`data`)
18. `2026-09-07-remove-mock-data-prisma-persistence-plan.md` (`data`)
19. `2026-09-07-task-ownership-model-plan.md` (`architecture`)
20. `2026-09-07-user-onboarding-plan.md` (`ux`)
21. `2026-09-08-comprehensive-system-remediation-plan.md` (`architecture`)
22. `2026-09-08-eradicate-mockups-and-real-qcet-alignment-plan.md` (`data`)
23. `2026-09-08-google-workspace-signin-plan.md` (`security`)
24. `2026-09-08-remove-mock-data-and-test-accounts-plan.md` (`data`)
25. `2026-09-08-security-and-architecture-remediation-plan.md` (`security`)
26. `2026-09-08-web-performance-optimization-plan.md` (`architecture`)
27. `2026-09-09-dashboard-data-consistency-and-aggregation.md` (`data`)
28. `2026-09-09-data-trust-and-ux-correctness-plan.md` (`data`)
29. `2026-09-09-onboarding-enhancement-plan.md` (`ux`)
30. `2026-09-09-system-wide-monthly-partitioning.md` (`data`)
31. `2026-09-09-work-operations-calendar-plan.md` (`architecture`)

### 4.3 Superseded Plans (38 files)
All 38 plans include `superseded_by:` targeting their respective master consolidation plan:
- 35 UX plans superseded by `2026-09-09-master-ux-consolidation-plan.md`
- 3 Architecture plans superseded by `2026-09-09-remaining-source-improvement-master-plan.md`

---

## 5. Backward Compatibility & Symlink Integrity

All 73 plans in `docs/superpowers/plans/` have been converted to relative symbolic links:
`docs/superpowers/plans/<plan-file>.md -> ../../plans/<category>/<plan-file>.md`

Automated verification confirmed:
- Zero broken symlinks (`73 / 73` resolved successfully).
- All tools and agent runtimes reading from `docs/superpowers/plans/` continue functioning without modification.

---

## 6. Verification Results

1. **Automated Plan Invariant Verification:**
   ```
   Active plans count: 4
     - [ACTIVE] 2026-09-09-agent-rules-refactor-plan.md (domain: agent)
     - [ACTIVE] 2026-09-09-database-architecture-hardening-plan.md (domain: data)
     - [ACTIVE] 2026-09-09-master-ux-consolidation-plan.md (domain: ux)
     - [ACTIVE] 2026-09-09-remaining-source-improvement-master-plan.md (domain: architecture)
   Active domain distribution: { agent: 1, data: 1, ux: 1, architecture: 1 }
   PASS: <= 1 master active plan per domain constraint satisfied.
   Completed plans count: 31
   PASS: All completed plans have valid frontmatter.
   Superseded plans count: 38
   PASS: All superseded plans have valid frontmatter and superseded_by.
   Checking symlinks in docs/superpowers/plans (73 files)...
   PASS: All symlinks resolve successfully.
   ```
2. **Automated Test Suite (`npm test`):**
   - 61 tests passing across 21 suites, 0 failures.
3. **No Dev Build Cache Poisoning:**
   - Adhered to `CLAUDE.md` invariant: dev server not interrupted with `next build`.
