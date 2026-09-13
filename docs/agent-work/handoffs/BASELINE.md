# HANDOFF — Wave 0 Baseline (shard-baseline)

From: qcet-builder / shard-baseline
To: Integrator + candidate implementation lanes
Date: 2026-09-13
Status: COMPLETE — metadata + DB proof + 26 same-data frames captured and verified.

## 1. Frozen reference point

- Branch `main`, HEAD `7363c4309007a776269f57cb3058bb64cf059c2e`.
- Runtime: node `v22.23.2`, npm `10.9.8`, Chromium `152.0.7977.82`.
- 54 preserve-only dirty files unrelated to this lane (`git-snapshot.txt`).
- `npm test` is proven to target a disposable DB (`qcet_test`), not the dev DB.

Evidence root: `artifacts/ux-v5-1/baseline/`
- `git-snapshot.txt`, `env-disposal-proof.txt`, `browser-probe.txt`
- `states/BASELINE-STATES.md` (state matrix) and `states/<route>/<state>/` (frames + notes)
- `tools/{capture-baseline,auth-proxy,env-probe,git-snapshot,inspect-dom}.mjs`
- Canonical driver: `scripts/capture-baseline.mjs`

## 2. What was captured

26 frames (13 states × 1440x900 + 390x844): `/`, `/tasks`
(default|table|kanban|detail|create-task|bulk-selection), `/calendar`, `/notifications`,
`/documents`, `/org`, command-search palette, offline banner. No frame was fabricated.

## 3. How candidate lanes produce `candidate.png`

1. Start the app server (observed `http://127.0.0.1:3000`).
2. `node scripts/capture-baseline.mjs --only=<state>,...` OR start
   `tools/auth-proxy.mjs` yourself (see env at the top of the file) and capture with
   Chromium at the same viewport.
3. Write `candidate.<vp>.png` beside each `baseline.<vp>.png` with **identical**
   route / user / role / department / scope / query / period / dataset / viewport / zoom
   (§42.2). Record the pinned scope and the task id
   (`cmtwgbysl002xi5nosto6ykr4`) in your notes.

## 4. What candidate lanes must NOT do

- Do NOT mutate `artifacts/ux-v5-1/baseline/**` — it is the frozen before image.
- Do NOT capture bare/unauthenticated frames and call them "same-data" — a
  `qcet_session` cookie is required or the frame is a zero-state shell.
- Do NOT use `?zone=` URLs (middleware 308-redirects to canonical routes).
- Do NOT touch the PRESERVE-ONLY dirty files listed in `git-snapshot.txt`.
- Do NOT reseed the DB between baseline and candidate capture (dataset drift invalidates T91).

## 5. Same-data pin (reproduce exactly)

- User: seed `admin@cdktcnqn.edu.vn` (role ADMIN, dept BGH), scope = Toàn trường (school).
- Viewports: 1440x900, 390x844, zoom 100%.
- Overlays: dismiss the welcome modal ("Vào bàn làm việc ngay" / "Đóng bảng chào mừng")
  and the PWA install prompt ("Để sau") before the shot.
- `/tasks` defaults to Kanban (ignores `?view=table`); `tasks/table` and
  `tasks/bulk-selection` use the "Bảng" view switcher. `tasks/detail` uses
  `?taskId=cmtwgbysl002xi5nosto6ykr4`.

## 6. Known caveats

- The dev DB is shared with other lanes' processes and may drift; capture baseline and
  candidate back-to-back on an unpaused snapshot.
- `calendar/create-event` is not in this shard's required list and was not captured.
