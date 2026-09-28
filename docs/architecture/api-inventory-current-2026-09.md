# Current API Route and Method Inventory — 2026-09-28

> Phase 0.1 static surface inventory, refreshed 2026-09-28 for the `qcet-api-screens` implementation worktree after adding dossier archival and canonical FileObject download routes. Route/method exports are reconciled against that source tree. Security and side-effect labels inherited from the earlier generated route-level table are provisional triage only, not a verified authorization audit. Middleware and shared helpers can affect behavior outside the route file; inspect the cited implementation before remediation.

- Route files: **98**.
- Distinct route/method pairs declared in route files: **131**.
- Total exported HTTP method handlers: **133**, including NextAuth `GET` and `POST` exported through the `handlers` object. Overload signatures count as one handler for their route/method pair.
- Evidence: route export file and line are linked in the last column.
- Limitations: this static pass does not prove runtime reachability, effective authorization, schema coverage, or safe side effects. Values marked `None`/`Unknown` are not findings until helper and middleware behavior is checked.

| Route Path | Method | Preliminary Auth Marker | Preliminary Authorization Marker | Preliminary Validation Marker | CSRF Marker | Rate Limit Marker | Domain | Side Effects | Export Evidence |
|---|---|---|---|---|---|---|---|---|---|
| `/api/audit-logs` | GET | Session | Canonical capability `system.audit.view` | Zod (`AuditLogQuerySchema`) | No | No | audit | Read-only, minimal metadata DTO; implementation inspected | `src/app/api/audit-logs/route.ts:11` |
| `/api/auth/[...nextauth]` | GET | None | None | None | No | No | auth | Read/preflight; not reviewed | `src/app/api/auth/[...nextauth]/route.ts:3` |
| `/api/auth/[...nextauth]` | POST | None | None | None | No | No | auth | Mutation/dispatch; not reviewed | `src/app/api/auth/[...nextauth]/route.ts:3` |
| `/api/auth/google` | GET | None | None | None | No | No | auth | Read/preflight; not reviewed | `src/app/api/auth/google/route.ts:6` |
| `/api/auth/google/verify` | POST | None | None | None | No | No | auth | Mutation/dispatch; not reviewed | `src/app/api/auth/google/verify/route.ts:9` |
| `/api/auth/login` | POST | None | None | None | No | No | auth | Mutation/dispatch; not reviewed | `src/app/api/auth/login/route.ts:4` |
| `/api/auth/logout` | GET | None | None | None | Yes | No | auth | Read/preflight; not reviewed | `src/app/api/auth/logout/route.ts:71` |
| `/api/auth/logout` | POST | None | None | None | Yes | No | auth | Mutation/dispatch; not reviewed | `src/app/api/auth/logout/route.ts:24` |
| `/api/auth/me` | GET | Session | None | Zod | Yes | No | auth | Read/preflight; not reviewed | `src/app/api/auth/me/route.ts:10` |
| `/api/auth/me` | PATCH | Session | None | Zod | Yes | No | auth | Mutation/dispatch; not reviewed | `src/app/api/auth/me/route.ts:99` |
| `/api/auth/register` | POST | Session | None | None | No | No | auth | Mutation/dispatch; not reviewed | `src/app/api/auth/register/route.ts:5` |
| `/api/cron/document-deadline-check` | GET | None | None | None | No | No | cron | Read/preflight; not reviewed | `src/app/api/cron/document-deadline-check/route.ts:47` |
| `/api/cron/document-deadline-check` | POST | None | None | None | No | No | cron | Mutation/dispatch; not reviewed | `src/app/api/cron/document-deadline-check/route.ts:96` |
| `/api/csp-report` | OPTIONS | None | None | Zod | No | No | csp-report | Read/preflight; not reviewed | `src/app/api/csp-report/route.ts:72` |
| `/api/csp-report` | POST | None | None | Zod | No | No | csp-report | Mutation/dispatch; not reviewed | `src/app/api/csp-report/route.ts:18` |
| `/api/dashboard/overview` | GET | Session | Resource-based | None | No | No | dashboard | Read/preflight; not reviewed | `src/app/api/dashboard/overview/route.ts:13` |
| `/api/delegations/[id]/revoke` | POST | Session | RBAC / ACL | Zod | No | No | delegations | Mutation/dispatch; not reviewed | `src/app/api/delegations/[id]/revoke/route.ts:37` |
| `/api/delegations` | GET | Session | RBAC / ACL | Zod | No | No | delegations | Read/preflight; not reviewed | `src/app/api/delegations/route.ts:58` |
| `/api/delegations` | POST | Session | RBAC / ACL | Zod | No | No | delegations | Mutation/dispatch; not reviewed | `src/app/api/delegations/route.ts:229` |
| `/api/departments` | GET | Session | RBAC / ACL | None | No | No | departments | Read/preflight; not reviewed | `src/app/api/departments/route.ts:5` |
| `/api/documents/[id]/actions/approve-content` | POST | Session | None | Zod | Yes | No | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/approve-content/route.ts:22` |
| `/api/documents/[id]/actions/approve-format` | POST | Session | None | Zod | Yes | No | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/approve-format/route.ts:22` |
| `/api/documents/[id]/actions/assign-number` | POST | Session | None | Zod | Yes | No | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/assign-number/route.ts:27` |
| `/api/documents/[id]/actions/assign-unit` | POST | Session | None | Zod | Yes | No | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/assign-unit/route.ts:27` |
| `/api/documents/[id]/actions/direct` | POST | Session | None | Zod | Yes | No | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/direct/route.ts:40` |
| `/api/documents/[id]/actions/file` | POST | Session | None | Zod | Yes | No | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/file/route.ts:28` |
| `/api/documents/[id]/actions/issue` | POST | Session | None | Zod | Yes | No | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/issue/route.ts:24` |
| `/api/documents/[id]/actions/organization-sign` | POST | Session | None | Zod | Yes | No | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/organization-sign/route.ts:23` |
| `/api/documents/[id]/actions/present` | POST | Session | None | Zod | Yes | Yes | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/present/route.ts:14` |
| `/api/documents/[id]/actions/reject-content` | POST | Session | None | Zod | Yes | No | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/reject-content/route.ts:13` |
| `/api/documents/[id]/actions/resolve` | POST | Session | None | Zod | Yes | Yes | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/resolve/route.ts:14` |
| `/api/documents/[id]/actions/revision` | POST | Session | None | Zod | Yes | Yes | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/revision/route.ts:14` |
| `/api/documents/[id]/actions/sign` | POST | Session | None | Zod | Yes | Yes | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/sign/route.ts:15` |
| `/api/documents/[id]/actions/submit-content-review` | POST | Session | None | Zod | Yes | Yes | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/submit-content-review/route.ts:14` |
| `/api/documents/[id]/actions/submit-format-check` | POST | Session | None | Zod | Yes | Yes | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/actions/submit-format-check/route.ts:14` |
| `/api/documents/[id]/audit-logs` | GET | Session | RBAC / ACL | None | No | No | documents | Read/preflight; not reviewed | `src/app/api/documents/[id]/audit-logs/route.ts:67` |
| `/api/documents/[id]/directives` | GET | Session | None | Zod | Yes | Yes | documents | Read/preflight; not reviewed | `src/app/api/documents/[id]/directives/route.ts:47` |
| `/api/documents/[id]/directives` | POST | Session | None | Zod | Yes | Yes | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/directives/route.ts:123` |
| `/api/documents/[id]` | DELETE | Session | RBAC / ACL | Zod | Yes | Yes | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/route.ts:221` |
| `/api/documents/[id]` | GET | Session | RBAC / ACL | Zod | Yes | Yes | documents | Read/preflight; not reviewed | `src/app/api/documents/[id]/route.ts:42` |
| `/api/documents/[id]` | PATCH | Session | RBAC / ACL | Zod | Yes | Yes | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/[id]/route.ts:101` |
| `/api/documents/[id]/workflow` | GET | Session | RBAC / ACL | None | No | No | documents | Read/preflight; not reviewed | `src/app/api/documents/[id]/workflow/route.ts:15` |
| `/api/documents/batch` | POST | Session | RBAC / ACL | Zod | Yes | Yes | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/batch/route.ts:88` |
| `/api/documents/download` | GET | Session | RBAC / ACL | None | No | Yes | documents | Read/preflight; not reviewed | `src/app/api/documents/download/route.ts:24` |
| `/api/documents/export-excel` | GET | Session | None | None | Yes | Yes | documents | Read/preflight; not reviewed | `src/app/api/documents/export-excel/route.ts:20` |
| `/api/documents/export-excel` | POST | Session | None | None | Yes | Yes | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/export-excel/route.ts:121` |
| `/api/documents/incoming/[id]` | GET | Session | RBAC / ACL | None | No | No | documents | Read/preflight; not reviewed | `src/app/api/documents/incoming/[id]/route.ts:15` |
| `/api/documents/incoming` | GET | Session | None | None | No | No | documents | Read/preflight; not reviewed | `src/app/api/documents/incoming/route.ts:10` |
| `/api/documents/incoming` | POST | Session | None | None | No | No | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/incoming/route.ts:45` |
| `/api/documents/outgoing/[id]/actions/deliver` | POST | Session | None | None | No | No | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/outgoing/[id]/actions/deliver/route.ts:10` |
| `/api/documents/outgoing/[id]` | GET | Session | RBAC / ACL | None | No | No | documents | Read/preflight; not reviewed | `src/app/api/documents/outgoing/[id]/route.ts:15` |
| `/api/documents/outgoing` | GET | Session | None | None | No | No | documents | Read/preflight; not reviewed | `src/app/api/documents/outgoing/route.ts:8` |
| `/api/documents/outgoing` | POST | Session | None | None | No | No | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/outgoing/route.ts:64` |
| `/api/documents` | GET | Session | None | Zod | Yes | Yes | documents | Read/preflight; not reviewed | `src/app/api/documents/route.ts:26` |
| `/api/documents` | POST | Session | None | Zod | Yes | Yes | documents | Mutation/dispatch; not reviewed | `src/app/api/documents/route.ts:93` |
| `/api/documents/stats` | GET | Session | None | None | No | Yes | documents | Read/preflight; not reviewed | `src/app/api/documents/stats/route.ts:11` |
| `/api/dossiers/[id]/actions/accept-archive` | POST | Session | None | None | No | No | dossiers | Mutation/dispatch; not reviewed | `src/app/api/dossiers/[id]/actions/accept-archive/route.ts:10` |
| `/api/dossiers/[id]/actions/close` | POST | Session | None | None | No | No | dossiers | Mutation/dispatch; not reviewed | `src/app/api/dossiers/[id]/actions/close/route.ts:10` |
| `/api/dossiers/[id]/actions/finalize-archive` | POST | Session | DossierService capability + SoD | Zod | Yes | Yes | dossiers | ACCEPTED → ARCHIVED; audited | `src/app/api/dossiers/[id]/actions/finalize-archive/route.ts:14` |
| `/api/dossiers/[id]/actions/mark-ready-for-archive` | POST | Session | DossierService capability | Zod | Yes | Yes | dossiers | CLOSED/ACTIVE → READY_FOR_ARCHIVE; audited | `src/app/api/dossiers/[id]/actions/mark-ready-for-archive/route.ts:14` |
| `/api/dossiers/[id]/actions/reject-archive` | POST | Session | Archivist capability + SoD | Zod | Yes | Yes | dossiers | SUBMITTED_TO_ARCHIVE → READY_FOR_ARCHIVE; audited | `src/app/api/dossiers/[id]/actions/reject-archive/route.ts:14` |
| `/api/dossiers/[id]/actions/submit-archive` | POST | Session | None | None | No | No | dossiers | Mutation/dispatch; not reviewed | `src/app/api/dossiers/[id]/actions/submit-archive/route.ts:10` |
| `/api/dossiers/[id]/items` | DELETE | Session | None | None | No | No | dossiers | Mutation/dispatch; not reviewed | `src/app/api/dossiers/[id]/items/route.ts:75` |
| `/api/dossiers/[id]/items` | GET | Session | None | None | No | No | dossiers | Read/preflight; not reviewed | `src/app/api/dossiers/[id]/items/route.ts:13` |
| `/api/dossiers/[id]/items` | POST | Session | None | None | No | No | dossiers | Mutation/dispatch; not reviewed | `src/app/api/dossiers/[id]/items/route.ts:54` |
| `/api/dossiers/[id]` | GET | Session | None | None | No | No | dossiers | Read/preflight; not reviewed | `src/app/api/dossiers/[id]/route.ts:10` |
| `/api/dossiers` | GET | Session | None | None | No | No | dossiers | Read/preflight; not reviewed | `src/app/api/dossiers/route.ts:7` |
| `/api/dossiers` | POST | Session | None | None | No | No | dossiers | Mutation/dispatch; not reviewed | `src/app/api/dossiers/route.ts:39` |
| `/api/executive/resolutions` | GET | Session | RBAC / ACL | Zod | Yes | No | executive | Read/preflight; not reviewed | `src/app/api/executive/resolutions/route.ts:110` |
| `/api/executive/resolutions` | POST | Session | RBAC / ACL | Zod | Yes | No | executive | Mutation/dispatch; not reviewed | `src/app/api/executive/resolutions/route.ts:194` |
| `/api/file-objects/[id]` | GET | Session | Resource-scoped RBAC / ACL | UUID | No | Yes | files | Read/stream; not reviewed | `src/app/api/file-objects/[id]/route.ts:24` |
| `/api/files/[...path]` | GET | Session | RBAC / ACL | None | No | Yes | files | Read/preflight; not reviewed | `src/app/api/files/[...path]/route.ts:26` |
| `/api/health/live` | GET | None | None | None | No | No | health | Read/preflight; not reviewed | `src/app/api/health/live/route.ts:10` |
| `/api/health/ready` | GET | None | None | None | No | Yes | health | Read/preflight; not reviewed | `src/app/api/health/ready/route.ts:18` |
| `/api/health` | GET | None | None | None | No | No | health | Read/preflight; not reviewed | `src/app/api/health/route.ts:7` |
| `/api/me/context` | GET | Session | None | None | No | No | me | Read/preflight; not reviewed | `src/app/api/me/context/route.ts:19` |
| `/api/me/inbox` | GET | Session | None | None | No | No | me | Read/preflight; not reviewed | `src/app/api/me/inbox/route.ts:6` |
| `/api/meetings/[id]/actions/confirm-minutes` | POST | Session | None | Zod | Yes | Yes | meetings | Mutation/dispatch; not reviewed | `src/app/api/meetings/[id]/actions/confirm-minutes/route.ts:15` |
| `/api/meetings/[id]/actions/draft-minutes` | POST | Session | None | Zod | Yes | Yes | meetings | Mutation/dispatch; not reviewed | `src/app/api/meetings/[id]/actions/draft-minutes/route.ts:15` |
| `/api/meetings/[id]/actions/hold` | POST | Session | None | None | Yes | Yes | meetings | Mutation/dispatch; not reviewed | `src/app/api/meetings/[id]/actions/hold/route.ts:13` |
| `/api/meetings/[id]/participants` | POST | Session | None | Zod | Yes | Yes | meetings | Mutation/dispatch; not reviewed | `src/app/api/meetings/[id]/participants/route.ts:15` |
| `/api/meetings/[id]/resolutions` | GET | Session | None | Zod | Yes | Yes | meetings | Read/preflight; not reviewed | `src/app/api/meetings/[id]/resolutions/route.ts:17` |
| `/api/meetings/[id]/resolutions` | POST | Session | None | Zod | Yes | Yes | meetings | Mutation/dispatch; not reviewed | `src/app/api/meetings/[id]/resolutions/route.ts:51` |
| `/api/meetings/[id]` | GET | Session | None | None | No | No | meetings | Read/preflight; not reviewed | `src/app/api/meetings/[id]/route.ts:11` |
| `/api/meetings` | GET | Session | None | Zod | No | Yes | meetings | Read/preflight; not reviewed | `src/app/api/meetings/route.ts:14` |
| `/api/meetings` | POST | Session | None | Zod | No | Yes | meetings | Mutation/dispatch; not reviewed | `src/app/api/meetings/route.ts:40` |
| `/api/notifications/[id]/read` | PATCH | Session | None | Zod | Yes | Yes | notifications | Mutation/dispatch; not reviewed | `src/app/api/notifications/[id]/read/route.ts:81` |
| `/api/notifications/[id]/read` | POST | Session | None | Zod | Yes | Yes | notifications | Mutation/dispatch; not reviewed | `src/app/api/notifications/[id]/read/route.ts:85` |
| `/api/notifications/push/key` | GET | Session | None | None | No | No | notifications | Read/preflight; not reviewed | `src/app/api/notifications/push/key/route.ts:9` |
| `/api/notifications/push` | DELETE | Session | None | Zod | Yes | Yes | notifications | Mutation/dispatch; not reviewed | `src/app/api/notifications/push/route.ts:222` |
| `/api/notifications/push` | GET | Session | None | Zod | Yes | Yes | notifications | Read/preflight; not reviewed | `src/app/api/notifications/push/route.ts:51` |
| `/api/notifications/push` | POST | Session | None | Zod | Yes | Yes | notifications | Mutation/dispatch; not reviewed | `src/app/api/notifications/push/route.ts:106` |
| `/api/notifications/push/subscribe` | DELETE | Session | None | Zod | Yes | Yes | notifications | Mutation/dispatch; not reviewed | `src/app/api/notifications/push/subscribe/route.ts:96` |
| `/api/notifications/push/subscribe` | GET | Session | None | Zod | Yes | Yes | notifications | Read/preflight; not reviewed | `src/app/api/notifications/push/subscribe/route.ts:20` |
| `/api/notifications/push/subscribe` | POST | Session | None | Zod | Yes | Yes | notifications | Mutation/dispatch; not reviewed | `src/app/api/notifications/push/subscribe/route.ts:38` |
| `/api/notifications/push/test` | POST | Session | None | Zod | Yes | Yes | notifications | Mutation/dispatch; not reviewed | `src/app/api/notifications/push/test/route.ts:19` |
| `/api/notifications/read-all` | POST | Session | None | None | Yes | Yes | notifications | Mutation/dispatch; not reviewed | `src/app/api/notifications/read-all/route.ts:11` |
| `/api/notifications` | GET | Session | None | Zod | Yes | Yes | notifications | Read/preflight; not reviewed | `src/app/api/notifications/route.ts:13` |
| `/api/notifications` | PATCH | Session | None | Zod | Yes | Yes | notifications | Mutation/dispatch; not reviewed | `src/app/api/notifications/route.ts:81` |
| `/api/organization/bodies/[id]` | GET | Session | RBAC / ACL | Zod | Yes | Yes | organization | Read/preflight; not reviewed | `src/app/api/organization/bodies/[id]/route.ts:20` |
| `/api/organization/bodies/[id]` | POST | Session | RBAC / ACL | Zod | Yes | Yes | organization | Mutation/dispatch; not reviewed | `src/app/api/organization/bodies/[id]/route.ts:79` |
| `/api/organization/bodies` | GET | Session | RBAC / ACL | Zod | Yes | Yes | organization | Read/preflight; not reviewed | `src/app/api/organization/bodies/route.ts:19` |
| `/api/organization/bodies` | POST | Session | RBAC / ACL | Zod | Yes | Yes | organization | Mutation/dispatch; not reviewed | `src/app/api/organization/bodies/route.ts:67` |
| `/api/push/subscribe` | DELETE | None | None | None | No | No | push | Mutation/dispatch; not reviewed | `src/app/api/push/subscribe/route.ts:19` |
| `/api/push/subscribe` | GET | None | None | None | No | No | push | Read/preflight; not reviewed | `src/app/api/push/subscribe/route.ts:11` |
| `/api/push/subscribe` | POST | None | None | None | No | No | push | Mutation/dispatch; not reviewed | `src/app/api/push/subscribe/route.ts:15` |
| `/api/push/test` | POST | None | None | None | No | No | push | Mutation/dispatch; not reviewed | `src/app/api/push/test/route.ts:7` |
| `/api/runtime-config` | GET | None | None | None | No | No | runtime-config | Read/preflight; not reviewed | `src/app/api/runtime-config/route.ts:7` |
| `/api/search` | GET | Session | RBAC / ACL | None | No | Yes | search | Read/preflight; not reviewed | `src/app/api/search/route.ts:84` |
| `/api/system/network-info` | GET | Session | None | None | No | No | system | Read/preflight; not reviewed | `src/app/api/system/network-info/route.ts:10` |
| `/api/tasks/[id]/actions/approve` | POST | None | None | None | No | No | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/actions/approve/route.ts:11` |
| `/api/tasks/[id]/actions/archive` | POST | None | None | None | No | No | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/actions/archive/route.ts:11` |
| `/api/tasks/[id]/actions/cancel` | POST | None | None | None | No | No | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/actions/cancel/route.ts:11` |
| `/api/tasks/[id]/actions/reassign` | POST | None | None | None | No | No | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/actions/reassign/route.ts:11` |
| `/api/tasks/[id]/actions/remind` | POST | None | None | None | No | No | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/actions/remind/route.ts:11` |
| `/api/tasks/[id]/actions/request-revision` | POST | None | None | None | No | No | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/actions/request-revision/route.ts:11` |
| `/api/tasks/[id]/actions/review` | POST | None | None | None | No | No | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/actions/review/route.ts:11` |
| `/api/tasks/[id]/actions/start` | POST | None | None | None | No | No | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/actions/start/route.ts:11` |
| `/api/tasks/[id]/actions/submit-result` | POST | None | None | None | No | No | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/actions/submit-result/route.ts:11` |
| `/api/tasks/[id]/actions/update-progress` | POST | None | None | None | No | No | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/actions/update-progress/route.ts:11` |
| `/api/tasks/[id]/actions/update-status` | POST | None | None | None | No | No | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/actions/update-status/route.ts:11` |
| `/api/tasks/[id]/deliverables` | DELETE | Session | RBAC / ACL | Zod | Yes | Yes | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/deliverables/route.ts:146` |
| `/api/tasks/[id]/deliverables` | PATCH | Session | RBAC / ACL | Zod | Yes | Yes | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/deliverables/route.ts:88` |
| `/api/tasks/[id]/deliverables` | POST | Session | RBAC / ACL | Zod | Yes | Yes | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/deliverables/route.ts:23` |
| `/api/tasks/[id]` | DELETE | Session | RBAC / ACL | Zod | Yes | Yes | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/route.ts:265` |
| `/api/tasks/[id]` | GET | Session | RBAC / ACL | Zod | Yes | Yes | tasks | Read/preflight; not reviewed | `src/app/api/tasks/[id]/route.ts:32` |
| `/api/tasks/[id]` | PATCH | Session | RBAC / ACL | Zod | Yes | Yes | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/[id]/route.ts:112` |
| `/api/tasks` | GET | Session | RBAC / ACL | Zod | Yes | Yes | tasks | Read/preflight; not reviewed | `src/app/api/tasks/route.ts:21` |
| `/api/tasks` | POST | Session | RBAC / ACL | Zod | Yes | Yes | tasks | Mutation/dispatch; not reviewed | `src/app/api/tasks/route.ts:155` |
| `/api/telemetry` | OPTIONS | None | None | Zod | No | No | telemetry | Read/preflight; not reviewed | `src/app/api/telemetry/route.ts:134` |
| `/api/telemetry` | POST | None | None | Zod | No | No | telemetry | Mutation/dispatch; not reviewed | `src/app/api/telemetry/route.ts:24` |
| `/api/upload` | POST | Session | None | None | Yes | Yes | upload | Mutation/dispatch; not reviewed | `src/app/api/upload/route.ts:14` |
| `/api/users` | GET | Session | Resource-based | Zod | No | Yes | users | Read/preflight; not reviewed | `src/app/api/users/route.ts:9` |
