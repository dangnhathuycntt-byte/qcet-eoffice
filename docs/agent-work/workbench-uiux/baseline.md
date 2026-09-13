# T00 — Baseline

Plan: `docs/plans/active/qcet-workbench-uiux-agent-execution-plan.md` (T00).
Spec input `qcet-workbench-uiux-source-audit-spec.md` is **not present in this repository at any
commit** (`git log --all --full-history` for that path returns nothing). The plan itself is the
only input available; findings F01–F15 / AC01–AC15 are known to this workstream only through the
plan's own traceability tables (§16) and the defects re-verified against HEAD below. This is
recorded as a limitation, not worked around.

## Checkout

| | |
|---|---|
| Branch | `feat/workbench-uiux-remediation` (created for this task from `main`) |
| HEAD at start | `65f99561631ca47f44a4b678479bd8f1c62e49f2` |
| Audit reference HEAD named by the plan | `2ae829dc` — not an ancestor of current `main`; symbols were re-verified against HEAD instead of applying patches blind |
| Node | v22.23.2 |
| Started | 2026-09-13 |

`git status --short` at start:

```
 M Dockerfile
 M docker-compose.yml
```

Both are pre-existing user changes, unrelated to this task (container/nginx config). They were
**preserved untouched** (AGENTS.md "Preserve Unrelated Changes"). No commit in this workstream
includes them.

## Test runner

- `npm test` → `node scripts/run-tests.mjs` → `tsx --test --test-concurrency=1 <all tests/**/*.test.ts>`.
- Discovery is a recursive scan of `tests/` for `*.test.ts` only (no `.tsx`, no `.test.js`).
- Env forced: `TZ=UTC`, `NODE_ENV=test`, `QCET_ALLOW_DB_TESTS=1`, `DATABASE_URL` rewritten `qcet_eoffice` → `qcet_test`.
- Single file: `./node_modules/.bin/tsx --test tests/<file>.test.ts`.

### Harness availability (decisive for T10)

| Capability | Available | Evidence |
|---|---|---|
| Server-side React render | **Yes, already used** | `renderToStaticMarkup` from `react-dom/server` in 57 test files |
| jsdom / happy-dom | **No** | absent from `package.json` and `node_modules` |
| @testing-library/* | **No** | absent |
| Playwright / Puppeteer / Cypress | **No** | absent |
| vitest / jest | **No** | absent |
| Headless Chromium (out of process) | **Yes** | `/usr/bin/chromium`, driven over raw CDP by `scripts/capture-baseline.mjs` |

Consequence: component tests are real SSR renders (`renderToStaticMarkup`) — no clicks, no DOM
events, no `screen.getByRole`. Real interaction/visual evidence must come from the CDP capture
harness, not from the unit suite. Tests are never described as E2E.

## Baseline failures

`npm run typecheck` at HEAD: **exit 0, no output**.

The full suite was not pre-run as a single baseline block (long-running, and the plan says not to
repeat full runs without a specific risk). Targeted runs were taken per milestone instead; every
result is recorded in `implementation-report.md` with its command and exit code.

## Fixture

D = **13/09/2026** (the plan's business reference date), used to write expected results by hand in
`tests/fixtures/workbench-queue-fixture.ts`. Note the application's own reference date is a
*different*, hardcoded constant — see `contract-map.md` §Date, which is one of the defects.

Fixture data comes from **real schema shapes**, not invented enum values: `Task.dueDate` is
`DateTime` (`prisma/schema.prisma:217`), and there is **no `Subtask` model** — subtasks are `Task`
rows linked by `parentTaskId`. The fixture mirrors that.

## Screenshots

Captured with the canonical harness (`scripts/capture-baseline.mjs`, raw CDP + read-only auth
proxy). Two additive, env-gated options were added to that script so a later workstream can
capture its own breakpoints without forking a second capture engine:

- `QCET_CAPTURE_OUT` — output root (default remains the immutable `artifacts/ux-v5-1/baseline/states`).
- `QCET_CAPTURE_VIEWPORTS` — comma-separated `WxH` list (default remains `1440x900,390x844`).

Before-image written to `artifacts/workbench-uiux/baseline/` — the tracked UX V5.1 baseline under
`artifacts/ux-v5-1/` is left byte-identical (verified with `git status`).

```bash
QCET_CAPTURE_OUT=artifacts/workbench-uiux/baseline \
QCET_CAPTURE_VIEWPORTS="1440x900,1280x800,768x1024,390x844" \
node scripts/capture-baseline.mjs --only=dashboard/home,tasks/table,tasks/detail,org/home
```

Viewports: 1440×900, 1280×800, 768×1024, 390×844 (the four the plan names; the harness previously
supported only two).

| State | Route | Frames |
|---|---|---|
| `dashboard/home` | `/` | 4 |
| `tasks/table` | `/tasks?view=table` | 4 |
| `tasks/detail` | `/tasks?taskId=…` | 4 |
| `org/home` | `/org` | 4 |

16 frames total.

Auth: seeded admin session injected by the read-only proxy; the proxy drops every non-GET, so no
capture can mutate the database. Reference date renders as **09/09/2026** in the app, versus the
real current date — recorded in `contract-map.md` §Date.

## Baseline observations (from the 1440×900 frame)

These are the visible defects the plan's findings name, confirmed on screen at HEAD:

1. Header shows a role chip **"Bàn làm việc Điều hành"** *and* an H1 **"Bàn làm việc Ban Giám hiệu"** *and* a subtitle asserting **"16 đơn vị trực thuộc"** — three overlapping labels, and the unit count is hardcoded and contradicts the 11/17 shown elsewhere (plan T05.5, T06.1).
2. The action queue renders the empty state **"Hàng đợi điều hành thông suốt"** with a **"Verified Clear"** badge — while the SITUATION strip directly beneath reports **0 nhiệm vụ**. It claims health it cannot support (plan F13, T06.7).
3. SITUATION reads **"0% tiến độ · 0 nhiệm vụ · 11 đơn vị cần chú ý"**: eleven units "need attention" on a dataset with zero tasks. That number is produced by a `<60%` progress threshold (plan T05.1).
4. Section order is ACTION → SITUATION → CONTEXT, so the summary sits *below* the queue (plan T06.2).
5. CONTEXT renders the full 17-row department ranking with medal badges and per-row progress bars on the dashboard itself (plan T07.2).
6. The 390×844 frame is a **different information architecture** from desktop: a greeting, two KPI cards, no action rows, no unit attention, no upcoming, no activity (plan T09, F14).

## Limitations recorded

- No production `NEXT_PUBLIC_REFERENCE_DATE` is set in this environment, so the app runs on the hardcoded fallback. Whether production sets it is not determinable from the repo — recorded as UNRESOLVED in `contract-map.md`.
- No human participants were available for the T12 usability task; `usability_validation: not_run`.
