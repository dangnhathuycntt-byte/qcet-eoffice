# SDD ledger — plan: docs/plans/active/2026-09-09-agent-rules-refactor-plan.md

## Pre-flight Conflict Scan Table

| Task Pair / Focus | Interface / Shared Element | Finding | Ruling |
| :--- | :--- | :--- | :--- |
| Task 1 & Task 2 | Global vs Scoped Rules | Task 1 defines 00-core.md (unconditional global); Task 2 defines scoped rules with `paths:`. No conflict. | Clean. 00-core is the only global rule. |
| Task 2 & Task 3 | Domain coverage | Tasks 2 covers UI/Mobile/Tasks/Docs/Calendar; Task 3 covers API/Auth/Data/Testing/Docs. Distinct scopes. | Clean. Clear path boundaries. |
| Task 4 & Task 2/3 | Codex AGENTS vs Claude rules | Codex uses directory-scoped AGENTS.md; Claude uses .claude/rules/*. Invariants match 1:1. | Clean. Invariants align across models. |
| Task 5 & Task 2/3/4 | Docs vs Rules | Rules reference docs for deep architecture. Line budgets kept lean. | Clean. Rules stay under budget. |
| Task 6 & Existing Docs | Plan migration | Docs/plans active, completed, superseded. Does not overwrite code. | Clean. Safe folder migration. |
| Task 7 & Task 1 | Permissions & Hooks vs Rules | Settings and hooks enforce hard invariants (dev server, secrets). | Clean. Complementary enforcement. |
| Task 8 & Task 7 | Reviewer agents & Skills | Reviewer agents use corresponding audit skills. | Clean. Agents use standard schemas. |
| Task 9 & All Tasks | Line budget & verification | Checks line counts, anti-duplication, runs typecheck and tests. | Clean. Final verification gate. |

Task 1: complete (commits 7e1c5cf..6ffeb09, review clean)
Task 2: complete (commits 6ffeb09..5e6e2fe, review clean - scoped rules: 10-ui.md, 11-mobile.md, 20-tasks.md, 21-documents.md, 22-calendar.md)
Task 3: complete (commits e413d00..5e933aa, review clean - scoped rules: 30-api.md, 31-auth-security.md, 40-data-integrity.md, 50-testing.md, 60-docs.md)
Task 4: complete (commits ceec13f..73d07e3, review clean - scoped AGENTS.md in tasks, api, lib, tests, docs)
Task 5: complete (commits 73d07e3..04f2025, review clean - ARCHITECTURE.md, docs/product/invariants.md, roles-and-scopes.md, metrics.md, docs/architecture/task-workspace.md, navigation.md, authentication.md, mobile.md)
Task 6: complete (commits d0ab6a9..215070e, review clean - docs/plans/ active, completed, superseded lifecycle migration & frontmatter)
Task 7: complete (commits 19144b6..3ce469c, review clean - skills: qcet-verify, qcet-ux-audit, qcet-data-audit, qcet-db-change; permissions in settings.json; hooks: protect-sensitive-files, guard-next-build, fast-changed-file-check)
Task 8: complete (commits eec5155..2a4e263, review clean - specialized reviewer agents: ux-reviewer, data-reviewer, security-reviewer, verifier; navigation index: docs/agent/index.md)
Task 9: complete (commits b503472..5c3ff35, review clean - line budget verified, anti-duplication audit clean, 233 tests pass)

