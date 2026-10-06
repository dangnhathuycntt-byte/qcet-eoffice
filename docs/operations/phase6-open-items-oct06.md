# Phase 6 Open Items — Operational Status (2026-10-06)

**Scope**: Accurate status of the 6 unchecked tracker items as of 2026-10-06.  
**Source**: `docs/plans/active/system-api-and-screens-execution-plan-2026-09-28.md` (Git history, commit `b5e2f2ce`).  
**Evidence collected**: SSH config, Tailscale status, GitHub runner API, CI run logs, docker-compose, production health endpoint, ClamAV implementation source.

---

## Evidence Basis

| Evidence Source | Verified Fact |
|---|---|
| `~/.ssh/config` | Alias `xeon` → `100.78.3.20 User dnhhuy IdentityFile ~/.ssh/id_ed25519` |
| `tailscale status` | Node `dnhhuy` (100.78.3.20, Linux) = **offline, last seen 7 days ago** |
| SSH connect attempt | `100.78.3.20:22` → Operation timed out (all ports) |
| `gh api /repos/.../actions/runners` | `qcet-runner-01`: status=`online`, OS=Linux, version=2.337.0 |
| CI run 37354723272 logs | Runner home: `/home/dnhhuy/actions-runner/_work/`; Docker API 1.55 on host |
| `deploy.yml` (confirmed) | No SSH, no docker push steps; staging job writes `receipt.json` only |
| `qcet.dixxie.store/api/health` | `{"status":"ok","database":{"latencyMs":2},"uptimeSeconds":921233}` |
| `docker-compose.yml` | `CLAMAV_HOST: clamav` (service name), port defaults to 3310 via `CLAMAV_PORT` |
| `src/lib/services/file-service.ts:113-114` | `host = CLAMAV_HOST`, `port = parseInt(CLAMAV_PORT \|\| "3310")` — separate env vars |
| `cloudflared.yml` | Tunnel `514f4f82` → `qcet-app:3000` → `qcet.dixxie.store` |

---

## Item 67 — Phase 0: Digital-Signature Provider Choice

**Execution plan line 67:**
> Record the chosen digital-signature provider, delivery channels and evidence contract, and whether internal documents are pilot or later scope. Keep provider-dependent work out of the critical path until the decision is recorded.

**Status: `[ ]` DEFERRED — Owner decision required**

| Sub-item | State |
|---|---|
| Adapter boundary (`src/lib/crypto/digital-signature-adapter.ts`) | ✅ Ready |
| Provider-neutral interface + contract tests (13 adapter + 32 extended) | ✅ Pass |
| Delivery channels endpoint (`/api/documents/outgoing/[id]/actions/deliver/`) | ✅ Implemented |
| Internal documents scope | ✅ RESOLVED — conservative defaults authorized (commit `c37f2a12`) |
| Vendor selection (VNPT-CA, Viettel-CA, Ban Cơ yếu) | ⛔ No vendor contract/credentials exist |

**Concrete blocker**: Owner has not selected a CA vendor. No contract, no API credentials, no HSM endpoint.  
**When unblocked**: Owner provides vendor selection → adapter receives concrete `DigitalSignatureProvider` implementation.

---

## Item 157 — Phase 5: Digital-Signature Integration

**Execution plan line 157:**
> Integrate the selected digital-signature provider; verify cryptographic evidence, certificate chain/validity, timestamp, and exact signed content version before issuance.

**Status: `[ ]` BLOCKED — depends on item 67**

Same blocker as item 67. No execution is possible without a vendor contract.  
Provider-neutral WebCrypto SHA-256 pipeline in `src/lib/crypto/digital-signature-service.ts` (523 lines) is complete.

---

## Item 172 — Phase 6: Deploy Pilot

**Execution plan line 172:**
> Deploy the pilot to a bounded user group; observe authorization denials, command conflicts, outbox failures, upload/download failures, and workflow aging.

**Status: `[ ]` BLOCKED — production host network unreachable**

| Access method | Result |
|---|---|
| SSH via Tailscale (`100.78.3.20`) | Timeout — node offline 7 days |
| SSH via production domain (`qcet.dixxie.store:22`) | No route to host (Cloudflare blocks SSH) |
| `deploy.yml` staging job | Writes receipt only; no container push |
| `deploy.yml` production job | Requires `v*.*.*` tag + `production` environment — not triggered |
| Self-hosted runner `qcet-runner-01` | Online (runner process alive) but host unreachable for interactive commands |

**Infrastructure confirmed from runner logs**: Docker 1.55 on host, PostgreSQL 16 runs in Docker on host, runner at `/home/dnhhuy/actions-runner/`.  
**What production deployment requires**: `docker build -t qcet-eoffice-app:latest . && docker compose up -d` on the xeon host.  
**Unblock path**: Restore Tailscale connectivity to `100.78.3.20` OR owner executes manually on host.

---

## Item 173 — Phase 6: Reconcile Audit Findings (Post-Pilot)

**Execution plan line 173:**
> Reconcile audit and operational findings into the canonical tracker; fix release blockers before expanding access.

**Status: `[ ]` PARTIAL — pre-pilot findings complete; post-pilot blocked**

Pre-pilot reconciliation (2026-09-28): 642/642 contract tests, 199/199 security tests, typecheck clean, 0 net new failures — documented in `docs/plans/active/canonical-findings-tracker-2026-09-28.md` (Git history).

Post-pilot findings require a deployed pilot to observe: authorization denials, command conflicts, outbox failure patterns, workflow aging data, notification delivery reliability.

---

## Item 174 — Phase 6: Observation Window + Legacy Removal

**Execution plan line 174:**
> Complete the observation window defined by the migration plan; then remove each legacy read/write path in a separately reviewed contract migration.

**Status: `[ ]` BLOCKED — depends on item 172 (deployed pilot)**

No observation data exists. Legacy paths cannot be safely removed without confirmed pilot stability.

---

## Item 175 — Phase 6: Verify Backup/Restore, Outbox Replay, Evidence Retrieval, Runbooks

**Execution plan line 175:**
> Verify backup/restore, outbox replay, signature/delivery evidence retrieval, and support runbooks before general production rollout.

**Status: `[ ]` PARTIAL — local drills complete; production verification blocked**

| Sub-item | Evidence | Gap |
|---|---|---|
| Backup-restore drill (row-count parity) | `backup-restore-drill.mjs` executed 2026-09-28 on local `qcet_eoffice` — 46/46 tables MATCH | Production backup content checksum not verified (host unreachable) |
| Outbox replay | 21/21 `outbox-pattern.test.ts` pass on `qcet_test` (2026-09-28) | Production outbox table state unknown |
| Audit evidence retrieval | 19/19 `audit-events.test.ts` pass on `qcet_test`; 63,483 non-null `request_id` rows confirmed | Production audit log volume unverified |
| Support runbooks | `docs/operations/recovery-paths.md` (11 scenarios), `docs/operations/rollback.md` | Physical drill (SSH-based) blocked |
| ClamAV scan gate | `CLAMAV_HOST=clamav` (service name) + `CLAMAV_PORT=3310` (default) set in `docker-compose.yml` | No evidence ClamAV daemon is healthy on production host |

**ClamAV config correction** (prior report error): `CLAMAV_HOST` is the hostname only (`clamav` service name in Docker network). Port is a **separate** `CLAMAV_PORT` env var defaulting to `3310` — not `host:port` format. `docker-compose.yml` does NOT set `CLAMAV_PORT` (so 3310 default applies). This is correct for intra-container communication.

---

## Provider-Independent Preparations Completed (2026-10-06)

| Preparation | Location | Status |
|---|---|---|
| Production backfill workflow | `.github/workflows/backfill-production.yml` | ✅ Created — triggers via `workflow_dispatch`, runs on self-hosted runner, supports dry-run/apply |
| ClamAV env var format corrected | This document + `docker-compose.yml` verified | ✅ `CLAMAV_HOST=clamav`, `CLAMAV_PORT=3310` (default) — no change needed |
| Recovery runbooks | `docs/operations/recovery-paths.md`, `rollback.md` | ✅ Complete (11 failure scenarios) |
| Outbox replay evidence | `tests/outbox-pattern.test.ts` 21/21 on `qcet_test` | ✅ Verified |
| Audit retrieval evidence | `tests/audit-events.test.ts` 19/19 on `qcet_test` | ✅ Verified |

## Secrets Required Before Production Backfill

Owner must add to GitHub repository secrets before triggering `.github/workflows/backfill-production.yml`:

| Secret | Value |
|---|---|
| `PRODUCTION_DATABASE_URL` | Already configured (used by `deploy.yml`) |
| `PRODUCTION_UPLOADS_DIR` | Host path for uploads bind-mount — value of `UPLOADS_HOST_PATH` in `.env.production` on xeon host |

---

## Summary (2026-10-06)

| Item | ID | Status | Unblock condition |
|---|---|---|---|
| Digital-signature provider choice | 67 | `[ ]` DEFERRED | Owner selects CA vendor |
| Digital-signature integration | 157 | `[ ]` BLOCKED | Item 67 unblocked |
| Deploy pilot | 172 | `[ ]` BLOCKED | Tailscale restored to xeon OR owner runs `docker compose up -d` on host |
| Reconcile post-pilot findings | 173 | `[ ]` PARTIAL | Item 172 deployed |
| Observation + legacy removal | 174 | `[ ]` BLOCKED | Item 172 deployed |
| Backup/restore + runbook verification | 175 | `[ ]` PARTIAL | Host access for production backup drill |

**35/41 items complete. 6 open items all have concrete blockers documented above.**  
**No items are policy-blocked only — all have specific infrastructure or vendor dependencies.**

*Last updated: 2026-10-06 by operational closeout workflow*
