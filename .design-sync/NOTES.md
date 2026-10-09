# QCET Design System Sync Notes

## Overview
- Project: `QCET Design System` (`qcet-eoffice`)
- Shape: `package` (synthesized from `src/components/ui/`)
- Target: `6074e7f8-0648-41ac-9a42-6f2d592f4e3b`
- Styling: Tailwind CSS v4 compiled to `.design-sync/styles.css` via `@tailwindcss/cli`

## Known render warns
- `[RENDER_BLANK]` on subcomponents (`BottomSheetFooter`, `BottomSheetHandle`, `BottomSheetHeader`, `DrawerFooter`, `DrawerHeader`, `ProgressTrack`): these are compound subparts designed to render within their parent compound components (`BottomSheet`, `Drawer`, `Progress`), which have full rich previews authored.
- `[TOKENS_MISSING]` 7 CSS variables (`--available-height`, `--available-width`, `--transform-origin`, `--property-*`): runtime positioning variables injected dynamically by Base UI popover/dialog/property controls.
- `CharacterCountTextarea`, `InlineAlertBanner`: no authored preview (110/112 authored); their cards render the plain control.

## Build gotchas (re-sync 2026-10-03)
- **Always pass `--entry ./dist/index.es.js`** (the path doesn't exist, on purpose). Without it the converter looks for `node_modules/qcet-eoffice` (npm never self-installs) and crashes in `dts.mjs`. With it, PKG_DIR walks up to the repo root (`qcet-eoffice@0.1.0`) and synthesizes the entry from `src/components/ui`.
- **Root-owned `.gstack/` (mode 700, owner root since 2026-09-11)** breaks every repo-wide directory walk with EACCES. Real fix (user's call): `sudo chown -R "$USER" .gstack`. Until then:
  - `.design-sync/overrides/detect.mjs` (declared in `libOverrides`) skips unreadable dirs in the storybook-dir walk.
  - `dts.mjs` must ALSO be patched in the *staged* copy, because `source-kit.mjs` imports `./dts.mjs` directly and bypasses overrides. Patched copy: `.design-sync/.cache/dts-fork.mjs` (gitignored). After re-staging run `cp .design-sync/.cache/dts-fork.mjs .ds-sync/lib/dts.mjs` (or re-apply: replace the `addSourceFilesAtPaths` glob with a readdir walk that skips `node_modules`, dot-dirs and unreadable dirs, adding files via `addSourceFileAtPath`).
- **`next/link` crashes the bundle** (`process is not defined` from `next/dist/client/*`, so `window.QCET` ends up empty). `CompletionState` imports it. Fixed via `cfg.tsconfig: .design-sync/tsconfig.json`, which maps `next/link` to `.design-sync/shims/next-link.tsx` (plain `<a>`). Any new `next/*` import in `src/components/ui` needs the same treatment.
- **The build is slow (~17 min for previews)**: 45/110 previews import `lucide-react` (4114-icon barrel), about 22 s each through the converter's JS resolve plugins. That's normal, not a hang. Don't wrap the driver in short timeouts; budget ~25 min for build + validate + capture.

## Re-sync risks
- The staged `dts.mjs` patch lives only in the gitignored cache. On a fresh clone the build fails with EACCES until it is re-applied or `.gstack` ownership is fixed.
- The `next/link` shim drops router behavior on purpose. If more Next-only modules (`next/image`, `next/navigation`) enter `src/components/ui`, the bundle breaks again the same way (`[BUNDLE_EXPORT] 112/112`).
- Root `tsconfig.json` includes `**/*.ts`, so it also typechecks `ds-bundle/**/*.d.ts`. Running `npm run typecheck` while a sync rewrites `ds-bundle/` gives spurious TS6053 errors. Run it after the sync.
- The 2026-10-03 grades were set from the full-card contact sheets after a bundle-only change (preview sources unchanged), not from per-cell review sheets.

## Rebuild CSS before every re-sync
- `resync.mjs` does NOT run `buildCmd`. After adding/changing `src/components/ui` classes, run `npx @tailwindcss/cli -i src/app/globals.css -o .design-sync/styles.css` first, otherwise new utilities (e.g. `data-[checked]:`, `data-[pressed]:`) are missing and states look unselected in the cards (seen on RadioGroup and SegmentedControl, 2026-10-03).
- Thin sub-parts are hidden with `componentSrcMap: {Name: null}`; their previews live in `.design-sync/previews-hidden/`. Presentation fixes go in `overrides` (`cardMode: column` for wide stories, `single` + `primaryStory` for portal popups like Select/Combobox).
- Token kinds: `.design-sync/annotate-kinds.mjs` appends `/* @kind other */` after `--ease-*`, `--animate-*`, `--aspect-video`, `--default-transition-*`, `--tw-translate-*` declarations in `.design-sync/styles.css` (wired into `buildCmd`). `cssEntry` is appended raw to `_ds_bundle.css`, so the comments survive. Always build CSS with `buildCmd` (not just tailwind) before a re-sync, then check `grep -c "@kind other" ds-bundle/_ds_bundle.css`.

## Task-page components (2026-10-09)
- `.design-sync/overrides/source-kit.mjs` (declared in `libOverrides`) adds a hardcoded `TASK_FILES` list from `src/components/tasks` (group `tasks`) to the synthesized entry, and merges src-derived components with `componentSrcMap` pins (without the merge, the two pins `StackedBarChart`/`TrendLine` hid all other components). To add a task component: append its path to `TASK_FILES`.
- Do NOT add `saved-views-selector`: it pulls `scope-switcher` -> `auth-context` -> `next-auth`, which breaks the whole bundle (`process is not defined`, `[BUNDLE_EXPORT] N/N`). Same for anything importing `@/lib/auth-context` (e.g. `subtask-row-group`).
- The fork needs `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules` on a fresh clone. On macOS `sed -i` needs `''`; edit with python.
- Only `TaskStatusCircle` and `PrioritySignalBars` have authored previews; the other task components ship as floor cards. Known warn: `[RENDER_BLANK]` on `TaskTableViewOptionsPopover` (popover trigger only).
- Adding the fork reset every grade (grade contract moves); all 92 older previews were re-graded `good` from contact sheets, not per-cell.
- Upload had to be sent as explicit file lists (540 files); `tokens/` is absent in this DS.
