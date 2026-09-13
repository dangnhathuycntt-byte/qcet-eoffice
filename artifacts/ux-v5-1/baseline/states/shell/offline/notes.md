# baseline — shell/offline

- Surface: `src/components/layout/offline-banner.tsx + PWASyncStatusBar (navigator.onLine=false)`
- Route: `/tasks (offline)`
- Capture method: CDP offline emulation + navigator.onLine override
- Auth: authenticated `qcet_session` (seed user `admin@cdktcnqn.edu.vn`) via tools/auth-proxy.mjs
- Capture tool: `node scripts/capture-baseline.mjs` (headless Chromium + raw CDP)
- Same-data: session cookie + canonical route (no legacy ?zone=) + pinned dataset snapshot
- First-visit interruptions: welcome modal + PWA install prompt dismissed via their own controls when present (read-only proxy swallows the onboarding PATCH)
- Frames:
  - 1440x900: `baseline.1440x900.png` — CAPTURED
  - 390x844: `baseline.390x844.png` — CAPTURED

No frame was synthesized. Captured before any UX V5.1 code mutation.
