# QCET E-Office — Dependency Baseline & Security Audit (Phase 1)

**Document Status**: Canonical Reference  
**Scope**: Node.js Dependencies, Security CVE Audit, React 19/RSC Compatibility, Next 16 Migration Considerations  
**Date**: 2026-09-09  
**Branch**: `feat/dacum-role-delegation-workflow`  

---

## 1. Executive Summary

As part of Phase 1 (P0) of the QCET E-Office Source Architecture Improvement Plan, an end-to-end security and dependency baseline audit was conducted across all resolved dependencies in `package.json` and `package-lock.json`.

Key outcomes:
- **Next.js Version Baseline**: Upgraded declared dependency from `^15.2.1` to `^15.5.25`, targeting Next.js 15 LTS (>= 15.5.24). Resolved version confirmed at `15.5.25`.
- **Zero Known CVEs**: Resolved 5 security advisories (1 moderate, 4 high) present in transitive dependencies (`postcss` in `next@15.5.25` and `deepmerge-ts` in `@prisma/config@6.19.3` / `prisma@6.19.3`) via deterministic `package.json` overrides. `npm audit` now reports 0 vulnerabilities.
- **React 19 & RSC Alignment**: Audited runtime dependencies (`react@19.2.8`, `react-dom@19.2.8`, `lucide-react@1.40.0`, `vaul@1.1.2`, Radix UI primitives). All packages cleanly deduplicate to React 19 without peer dependency conflicts or runtime warnings.
- **Verification Integrity**: Executed full TypeScript typechecking (`npm run typecheck` — 0 errors) and the complete regression test suite (2,074 tests across 514 suites — 0 failures, 0 skipped).

---

## 2. Resolved Core Dependencies

### 2.1 Core Runtime Matrix

| Package | Declared Version | Resolved Version | Role | Compatibility / Notes |
|---|---|---|---|---|
| `next` | `^15.5.25` | `15.5.25` | Framework / App Router | Next 15 LTS release (>= 15.5.24). Fully compatible with React 19. |
| `react` | `^19.0.0` | `19.2.8` | UI Library | React 19 stable release. RSC-enabled. |
| `react-dom` | `^19.0.0` | `19.2.8` | DOM Renderer | React 19 stable release. Deduplicated across all component trees. |
| `typescript` | `^5.7.3` | `5.7.3` | Type Engine | Strict mode enabled; zero type errors across full codebase. |
| `tailwindcss` | `^4.0.9` | `4.0.9` | Styling Engine | Tailwind CSS v4 pipeline via `@tailwindcss/postcss@4.3.3`. |
| `@prisma/client` | `^6.19.3` | `6.19.3` | ORM Client | SQLite production schema interface. |
| `prisma` | `^6.19.3` | `6.19.3` | ORM CLI & Engine | Database migration and introspective tooling. |

### 2.2 Dependency Tree Resolution (`npm ls`)

```
qcet-eoffice@0.1.0 /Users/dnhhuy/Projects/QCET/QCET Work
├─┬ @tailwindcss/postcss@4.3.3
│ └── postcss@8.5.28 overridden
├─┬ lucide-react@1.40.0
│ └── react@19.2.8 deduped
├─┬ next@15.5.25
│ ├── postcss@8.5.28 deduped
│ ├── react-dom@19.2.8 deduped
│ ├── react@19.2.8 deduped
│ └─┬ styled-jsx@5.1.6
│   └── react@19.2.8 deduped
├─┬ prisma@6.19.3
│ └─┬ @prisma/config@6.19.3
│   └── deepmerge-ts@8.0.2 overridden
├─┬ react-dom@19.2.8
│ └── react@19.2.8 deduped
├── react@19.2.8
└─┬ vaul@1.1.2
  ├─┬ @radix-ui/react-dialog@1.1.23
  │ ├─┬ @radix-ui/react-compose-refs@1.1.5
  │ │ └── react@19.2.8 deduped
  │ ├─┬ @radix-ui/react-context@1.2.2
  │ │ └── react@19.2.8 deduped
  │ ├─┬ @radix-ui/react-dismissable-layer@1.1.19
  │ │ ├─┬ @radix-ui/react-use-callback-ref@1.1.4
  │ │ │ └── react@19.2.8 deduped
  │ │ ├─┬ @radix-ui/react-use-effect-event@0.0.5
  │ │ │ └── react@19.2.8 deduped
  │ │ ├── react-dom@19.2.8 deduped
  │ │ └── react@19.2.8 deduped
  │ ├─┬ @radix-ui/react-focus-guards@1.1.6
  │ │ └── react@19.2.8 deduped
  │ ├─┬ @radix-ui/react-focus-scope@1.1.16
  │ │ ├── react-dom@19.2.8 deduped
  │ │ └── react@19.2.8 deduped
  │ ├─┬ @radix-ui/react-id@1.1.4
  │ │ └── react@19.2.8 deduped
  │ ├─┬ @radix-ui/react-portal@1.1.17
  │ │ ├── react-dom@19.2.8 deduped
  │ │ └── react@19.2.8 deduped
  │ ├─┬ @radix-ui/react-presence@1.1.10
  │ │ ├── react-dom@19.2.8 deduped
  │ │ └── react@19.2.8 deduped
  │ ├─┬ @radix-ui/react-primitive@2.1.10
  │ │ ├── react-dom@19.2.8 deduped
  │ │ └── react@19.2.8 deduped
  │ ├─┬ @radix-ui/react-slot@1.3.3
  │ │ └── react@19.2.8 deduped
  │ ├─┬ @radix-ui/react-use-controllable-state@1.2.6
  │ │ └── react@19.2.8 deduped
  │ ├─┬ @radix-ui/react-use-layout-effect@1.1.4
  │ │ └── react@19.2.8 deduped
  │ ├── react-dom@19.2.8 deduped
  │ ├─┬ react-remove-scroll@2.7.2
  │ │ ├─┬ react-remove-scroll-bar@2.3.8
  │ │ │ └── react@19.2.8 deduped
  │ │ ├─┬ react-style-singleton@2.2.3
  │ │ │ └── react@19.2.8 deduped
  │ │ ├── react@19.2.8 deduped
  │ │ ├─┬ use-callback-ref@1.3.3
  │ │ │ └── react@19.2.8 deduped
  │ │ └─┬ use-sidecar@1.1.3
  │ │   └── react@19.2.8 deduped
  │ └── react@19.2.8 deduped
  ├── react-dom@19.2.8 deduped
  └── react@19.2.8 deduped
```

---

## 3. Security Vulnerability Audit & Remediation

### 3.1 Pre-Audit CVE Inventory

Prior to remediation, `npm audit` flagged 5 vulnerabilities (1 moderate, 4 high):

1. **GHSA-ggr8-5vv4-36mx** (`deepmerge-ts < 8.0.0`):
   - Severity: High
   - Description: Stack exhaustion denial-of-service when merging recursive object graphs.
   - Introduced via: `prisma@6.19.3` -> `@prisma/config@6.19.3` -> `deepmerge-ts@7.1.5`.
   - Default npm recommendation: Downgrade `prisma` to `6.12.0` (rejected as breaking change).

2. **GHSA-qx2v-qp2m-jg93** (`postcss <= 8.5.22`):
   - Severity: High
   - Description: XSS via unescaped `</style>` tags in CSS stringify output.
   - Introduced via: `next@15.5.25` -> internal bundled `postcss@8.4.31`.

3. **GHSA-6g55-p6wh-862q** (`postcss <= 8.5.22`):
   - Severity: High
   - Description: Arbitrary file read and information disclosure via attacker-controlled `sourceMappingURL` in CSS comments.
   - Introduced via: `next@15.5.25` -> internal bundled `postcss@8.4.31`.

4. **GHSA-fxqj-rqcc-2cmp** (`postcss <= 8.5.22`):
   - Severity: High
   - Description: Incomplete fix of GHSA-6g55-p6wh-862q when `from` option is unset.
   - Introduced via: `next@15.5.25` -> internal bundled `postcss@8.4.31`.

5. **GHSA-r28c-9q8g-f849** (`postcss <= 8.5.22`):
   - Severity: Moderate
   - Description: Path traversal in source map auto-loading leading to arbitrary file disclosure.
   - Introduced via: `next@15.5.25` -> internal bundled `postcss@8.4.31`.

### 3.2 Remediation Strategy (Zero Breaking Changes)

Rather than forcing a disruptive major version upgrade to Next 16 or downgrading Prisma to 6.12.0, the root vulnerabilities were resolved using npm package overrides in `package.json`:

```json
"overrides": {
  "postcss": "^8.5.28",
  "deepmerge-ts": "^8.0.2"
}
```

- **PostCSS Pinning (`^8.5.28`)**: Forces both `@tailwindcss/postcss` and `next@15.5.25` to resolve to `postcss@8.5.28`, which contains the upstream security fixes for all four PostCSS advisories.
- **DeepmergeTS Pinning (`^8.0.2`)**: Overrides the transitive `@prisma/config` dependency to use safe `deepmerge-ts@8.0.2`, eliminating recursive stack exhaustion risk while maintaining Prisma 6.19.3.

### 3.3 Post-Remediation Verification

```
$ npm audit
found 0 vulnerabilities
```

---

## 4. React 19 & React Server Components (RSC) Audit

### 4.1 React 19 Architecture Assessment

- **Single React Instance**: Verified that exactly one copy of `react@19.2.8` and `react-dom@19.2.8` is resolved across the entire dependency graph.
- **Component Ecosystem Compatibility**:
  - `lucide-react@1.40.0`: Fully compatible with React 19; icon components render as standard JSX without deprecated React APIs.
  - `vaul@1.1.2`: Radix UI Dialog primitives cleanly bind to React 19 without warning.
  - `class-variance-authority@0.7.1` & `clsx@2.1.1`: Pure utility libraries, independent of React internals.
  - `tailwind-merge@3.0.2`: Pure utility library, fully compatible.
  - `zod@4.5.4`: Schema validation operates identically on client and server runtimes.

### 4.2 Server Component Invariants

- **Async Request APIs**: Next.js 15 requires dynamic request APIs (`params`, `searchParams`, `cookies()`, `headers()`) to be accessed asynchronously in Server Components and Route Handlers.
- **Server/Client Boundary Separation**: Route pages should not default to `"use client"` when reading initial domain data. Server Components should directly call domain services, passing initial data to client interaction islands (addressed in Task 2).
- **Serialization Safety**: RSC boundaries strictly enforce JSON-serializable payloads. Date objects, Map/Set instances, and database class instances must be transformed via DTO mappers before crossing boundaries.

---

## 5. Next 16 Migration Considerations

While QCET E-Office remains stabilized on Next.js 15 LTS (`15.5.25`), the following architectural factors must be tracked for a future Next 16 transition:

1. **Turbopack as Default**:
   - Next 16 promotes Turbopack as the default bundler for both `next dev` and `next build`.
   - Ensure custom PostCSS plugins and Tailwind CSS v4 configurations remain compatible with Turbopack native CSS handling.

2. **Strict Async Request APIs**:
   - Next 15 introduced deprecation warnings when accessing `params` or `searchParams` synchronously. In Next 16, synchronous access is completely removed and throws at runtime.
   - All server page components and layouts must adopt `Promise<{ [key: string]: string | string[] }>` for `params` and `searchParams`.

3. **Built-in PostCSS Upgrades**:
   - Next 16 bundles patched PostCSS libraries out of the box. Once upgraded to Next 16, the `"postcss"` override in `package.json` can be cleanly removed.

4. **Strict React 19 Primitives**:
   - Next 16 deprecates legacy React patterns including `defaultProps` on function components and string refs.
   - Any third-party component library relying on legacy React lifecycles must be verified or replaced prior to Next 16 cutover.

---

## 6. Verification and Quality Gates

| Verification Gate | Command | Expected Result | Actual Result |
|---|---|---|---|
| Core Dependency Tree | `npm ls next react react-dom` | next@15.5.25, react@19.2.8 deduped | Verified |
| Security Audit | `npm audit` | 0 vulnerabilities | 0 vulnerabilities |
| TypeScript Typecheck | `npm run typecheck` (`tsc --noEmit`) | 0 type errors | 0 type errors |
| Regression Test Suite | `npm test` (`tsx --test tests/**/*.test.ts`) | All suites passing | 2,074 tests, 514 suites, 0 failures |
