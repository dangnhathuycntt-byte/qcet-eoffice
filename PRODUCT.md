# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary users — all staff of Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET), in a professional daytime office environment on desktop browsers and increasingly on mobile:**

1. **Ban Giám hiệu** (Hiệu trưởng, Phó Hiệu trưởng) — institution-wide executive oversight, strategic task issuance, final approvals, bottleneck resolution. Default scope: `school`.
2. **Trưởng đơn vị / Trưởng phòng / Trưởng khoa / Phó phòng / Phó khoa** — department-level task decomposition, member assignment, deliverable review, department progress tracking. Default scope: `unit`.
3. **Chuyên viên / Giảng viên** — day-to-day task execution, deliverable submission, personal agenda tracking. Default scope: `my`.
4. **Văn thư (VAN_THU)** — administrative clerks managing incoming/outgoing document circulation and registry.
5. **Quản trị hệ thống (ADMIN)** — system configuration, user provisioning, global auditing, emergency overrides.

All users are Vietnamese-language speakers. Vietnamese diacritics must be correctly rendered in all UI contexts.

## Product Purpose

QCET E-Office is the digital governance and administrative operating system (hệ thống điều hành & quản lý công việc nội bộ) for Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn. It consolidates:

- **Task assignment & coordination** across three institutional authority tiers (DACUM-aligned: Ban Giám hiệu → Trưởng đơn vị → Chuyên viên/Giảng viên), with deliverable submission, review, and sign-off.
- **Official document management** (sổ văn bản đến/đi/nội bộ) conforming to Nghị định 30/2020/NĐ-CP: incoming, outgoing, and internal dispatch circulation with digital annotation and tracking.
- **Academic calendar scheduling** — institutional deadlines, week calculations, and KPI cycles in ICT (UTC+7). Administrative month cycle runs from the 25th of the prior month to the 24th of the current month.
- **File streaming** — up to 100 MB PDFs and evidence files served via HTTP 206 Byte-Range streaming with SHA-256 integrity checks.

Success means every staff member always knows exactly what they owe, to whom, and by when — and every executive has real-time visibility into institutional bottlenecks without leaving the system.

## Positioning

The only administrative platform built specifically for Vietnamese vocational college (Cao đẳng) governance structures, respecting Luật Giáo dục nghề nghiệp statutory titles and separation-of-duties requirements that generic SaaS task tools cannot model.

## Operating Context

- **Deployment**: On-premise, self-hosted on the institution's Windows Server 2019/2022 infrastructure. Architecture: IIS 10.0+ (reverse proxy / SSL offload) → Docker Compose (Next.js standalone + PostgreSQL 16 Alpine). Domain: `e-office.cdktcnqn.edu.vn`.
- **Environment**: Professional daytime office — desktops and laptops in administrative offices, occasionally tablets. No dark-mode requirement; the Light-Only standard is a product invariant.
- **Connectivity**: Internal network at the institution. Uploads stored at `D:\QCET-Eoffice-Data\uploads` (bind-mounted into Docker).
- **Timezone**: All date/time calculations use Indochina Time (ICT, UTC+7), enforced via `src/lib/academic-calendar.ts`.
- **Language**: Vietnamese throughout. Interface copy uses institutional Vietnamese administrative register (formal, no colloquial abbreviations in labels or headings).

## Capabilities and Constraints

**Capabilities:**
- Three-tier task workflow: issue → decompose → assign → execute → submit deliverable → review → approve/reject.
- Scope switcher (`school` / `unit` / `my`) for dataset view — does not alter permissions.
- Document circulation: văn bản đến, văn bản đi, v��n bản nội bộ with approval chains.
- Academic calendar integration: week numbers, semester boundaries, overdue detection in ICT.
- File upload/streaming up to 100 MB with byte-range serving and path-traversal protection.
- Push notifications (`web-push`), QR code generation (`qrcode`).
- Health check endpoint at `/api/health` for IIS ARR / Prometheus / Uptime Robot integration.
- Automated daily backup (01:00 AM) and disaster recovery via PowerShell + Windows Task Scheduler.

**Constraints:**
- **Nghị định 30/2020/NĐ-CP compliance** — document numbering, formatting, security classification (thường/khẩn/thượng khẩn/hỏa tốc), and circulation workflow must conform to this Vietnamese government decree. This is a legal constraint, not a preference.
- **Light-Only standard** — `dark:` classes, `.dark` selectors, and theme switching are permanently prohibited. `@custom-variant dark (&:not(*))` enforces this at the CSS level.
- **No synthetic operational data** — all KPIs and metrics derive from live database rows; zero hardcoded or placeholder values.
- **Maker-Checker invariant** — a task submitter cannot be their own sole approver; reviewer must be a Trưởng phòng or Ban Giám hiệu.
- **Role ≠ Scope** — switching the dataset scope (school/unit/my) never alters the authenticated user's operational authority.
- **Server truth wins** — JWT session and PostgreSQL database are the sole authorities; client state is ephemeral cache.
- Stack is fixed: Next.js 15 (App Router) / React 19 / Tailwind CSS v4 / Prisma 6 / TypeScript 5.7 / PostgreSQL 16. No new framework additions without explicit decision.

**Undecided / open:**
- No native mobile app. The web app ships as a PWA (`display: standalone`, `orientation: portrait-primary`, maskable icons, Web Push) and is actively designed for mobile ergonomics alongside desktop use.

## Brand Commitments

- **Institution** (canonical — Quy Nhơn, Bình Định):
  - officialName: `"Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"`
  - shortName: `"QCET"`
  - address: 172 An Dương Vương, TP. Quy Nhơn, Tỉnh Bình Định
  - domain: `cdktcnqn.edu.vn` / logoUrl: `/logo-qcet.png`
- **System name**: QCET E-Office (Hệ thống Quản lý Điều hành Điện tử).
- **App title**: `"QCET E-Office - Trường CĐ Kỹ thuật Công nghệ Quy Nhơn"`
- **Support contact**: `quantrimang@cdktcnqn.edu.vn`
- **Typography** (as implemented in `src/app/layout.tsx`): Be Vietnam Pro (`font-sans`, body), Plus Jakarta Sans (`font-heading`, headings), JetBrains Mono (`font-mono`, codes/figures). Be Vietnam Pro preserves full Vietnamese tone diacritics (ể, ễ, ệ, ở, ỡ, ợ, ứ, ừ).
- **Color**: Administrative Navy (`#0284C7`, `sky-600`) as the singular primary accent. Strictly calibrated OKLCH Light-Only palette (see DESIGN.md). Saturation below 80%. No neon blues, purples, or glows.
- **Icons**: Lucide React, `strokeWidth={1.5}` — no gray square enclosure boxes behind icons.
- **No emojis** anywhere in the interface.

## Evidence on Hand

- `README.md` — full Vietnamese product description, deployment topology, engineering rules.
- `ARCHITECTURE.md` — canonical system architecture and technology stack.
- `docs/product/invariants.md` — universal product invariants (Light-Only, Role≠Scope, Server Truth, Zero Synthetic Data, Maker-Checker, Deterministic Verification).
- `docs/product/roles-and-scopes.md` — institutional role definitions, normalization hierarchy, and scope permission matrix.
- `docs/product/metrics.md` — metric definitions and aggregation pipeline specification.
- `prisma/schema.prisma` — canonical data model (Task, Document, User, Department, Deliverable, AcademicCalendar).
- `DESIGN.md` — incumbent design system (Executive Cockpit visual world, OKLCH tokens, component catalogue).

## Product Principles

1. **Institutional clarity over SaaS convenience** — every interface decision defers to the statutory titles, authority structures, and document conventions of Vietnamese vocational college governance. Generic SaaS patterns that flatten or misrepresent institutional hierarchy are rejected.
2. **Zero invented data** — the system shows what is actually true in the database or shows nothing. Calculated metrics, empty states, and aggregated KPIs must all derive from real records.
3. **One canonical implementation** — no parallel engines, duplicate stores, or temporary workarounds promoted to features. Each domain capability has exactly one owner.
4. **Authority and visibility are orthogonal** — what a user can see (scope) and what they are authorized to do (role) are always independently evaluated. Switching a scope filter never implicitly grants or revokes any permission.
5. **On-premise reliability** — the system must remain fully functional on the institution's own infrastructure with no dependency on external cloud services for core operations.

## Accessibility & Inclusion

WCAG 2.2 AA is the confirmed standard. Minimum touch targets 44px on mobile/tablet. Focus-visible rings on all interactive elements (`focus-visible:ring-2 ring-primary ring-inset`). Vietnamese diacritics must not be clipped, truncated, or misrendered by font fallback stacks.
