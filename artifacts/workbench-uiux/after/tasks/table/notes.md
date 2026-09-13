# baseline — tasks/table

- Surface: `src/app/tasks/page.tsx (view=table)`
- Route: `/tasks (view: Bảng)`
- Capture method: click view switcher button "Bảng"
- Auth: authenticated `qcet_session` (seed user `admin@cdktcnqn.edu.vn`) via tools/auth-proxy.mjs
- Capture tool: `node scripts/capture-baseline.mjs` (headless Chromium + raw CDP)
- Same-data: session cookie + canonical route (no legacy ?zone=) + pinned dataset snapshot
- First-visit interruptions: welcome modal + PWA install prompt dismissed via their own controls when present (read-only proxy swallows the onboarding PATCH)
- Frames:
  - 1440x900: `baseline.1440x900.png` — CAPTURED
  - 1280x800: `baseline.1280x800.png` — CAPTURED
  - 768x1024: `baseline.768x1024.png` — CAPTURED
  - 390x844: `baseline.390x844.png` — CAPTURED

No frame was synthesized. Captured before any UX V5.1 code mutation.
