WAVE 0 — SAME-DATA STATE MATRIX
Captured: 2026-09-13
Source plan: §8 WAVE 0 (lines 650-699); §42.4 evidence layout (line 2250)

Capture tool: `node scripts/capture-baseline.mjs` (headless Chromium 152 + raw CDP)
Auth: authenticated `qcet_session` (seed `admin@cdktcnqn.edu.vn`, role ADMIN, dept BGH)
      injected by `tools/auth-proxy.mjs` (read-only: non-GET dropped).
Viewports: 1440x900 and 390x844, zoom 100%.

| # | State id              | Route / surface                                   | Method                                  | Status                    |
|---|-----------------------|---------------------------------------------------|-----------------------------------------|---------------------------|
| 1 | dashboard/home        | `/` (src/app/page.tsx)                             | direct navigation                       | CAPTURED @1440,@390        |
| 2 | tasks/default         | `/tasks` (lands Kanban today)                      | direct navigation                       | CAPTURED @1440,@390        |
| 3 | tasks/table           | `/tasks` view Bảng                                 | click view switcher "Bảng"              | CAPTURED @1440,@390        |
| 4 | tasks/kanban          | `/tasks` view Kanban (default)                     | direct navigation                       | CAPTURED @1440,@390        |
| 5 | tasks/detail          | side sheet `?taskId=cmtwgbysl002xi5nosto6ykr4`     | URL-addressable ?taskId=                | CAPTURED @1440,@390        |
| 6 | tasks/create-task     | modal components/dashboard/create-task-modal.tsx   | click toolbar "+ Giao việc"             | CAPTURED @1440,@390        |
| 7 | tasks/bulk-selection  | bar tasks/table/components/batch-action-bar.tsx    | view Bảng + select first row            | CAPTURED @1440,@390        |
| 8 | calendar/home         | `/calendar`                                        | direct navigation                       | CAPTURED @1440,@390        |
| 9 | notifications/home    | `/notifications`                                   | direct navigation                       | CAPTURED @1440,@390        |
|10 | documents/home        | `/documents`                                       | direct navigation                       | CAPTURED @1440,@390        |
|11 | org/home              | `/org`                                             | direct navigation                       | CAPTURED @1440,@390        |
|12 | shell/command-search  | layout/command-search-modal.tsx                    | dispatch `qcet:open-command-search`     | CAPTURED @1440,@390        |
|13 | shell/offline         | offline-banner.tsx + PWASyncStatusBar              | CDP offline + navigator.onLine=false    | CAPTURED @1440,@390        |
|14 | calendar/create-event | create-event modal in src/app/calendar/page.tsx    | click "+ Tạo" then "Tạo sự kiện"         | CAPTURED @1440,@390        |

Evidence layout (§42.4): artifacts/ux-v5-1/baseline/states/<route>/<state>/baseline.<vp>.png
Candidate lanes add `candidate.png` beside each `baseline.png` with identical
route/user/role/dept/scope/query/period/dataset/viewport/zoom (§42.2).

SAME-DATA PRECONDITIONS (mandatory for every frame above):
- route: canonical path only; NEVER `?zone=` (middleware 308-redirects legacy zone params).
- session: valid `qcet_session` cookie (SESSION_COOKIE_NAME, src/lib/jwt-session.ts).
- scope: the workspace scope must be pinned identically for baseline and candidate.
- viewport: 1440x900 and 390x844; zoom 100%.
- data snapshot: same database state for baseline vs candidate (no reseed in between).

CAVEATS RECORDED HONESTLY:
- `/tasks` currently lands in Kanban and IGNORES `?view=table` (the hardcoded
  `initialViewMode="kanban"` in task-management-workspace.tsx overrides the URL view —
  plan P1-01 / T09). `tasks/table` is therefore captured by clicking the visible
  "Bảng" view switcher, and `tasks/default` is byte-identical to `tasks/kanban`.
- The task-detail frame pins task `cmtwgbysl002xi5nosto6ykr4` (NV-2026-09-006), the
  first row of `/api/tasks`; record this id in the candidate notes to preserve same-data.
- First-visit overlays (welcome modal, PWA install prompt) are dismissed via their own
  controls so the primary surface is unobscured; the read-only proxy swallows the
  onboarding PATCH. Candidate lanes must apply the identical dismissal.
- The dev DB is shared with other lanes' processes and may drift; avoid reseeding
  between baseline and candidate capture.
