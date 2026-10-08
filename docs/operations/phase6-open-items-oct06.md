# Phase 6 Open Items — Operational Status (2026-10-06)

**Scope**: Accurate status of the 6 unchecked tracker items as of 2026-10-06.  
**Source**: `docs/plans/active/system-api-and-screens-execution-plan-2026-09-28.md` (Git history, commit `b5e2f2ce`).  
**Evidence collected**: SSH config, Tailscale status, GitHub runner API, CI run logs, docker-compose, production health endpoint, ClamAV implementation source.

---

## Evidence Basis

| Evidence Source | Verified Fact | Caveat |
|---|---|---|
| `~/.ssh/config` | Alias `xeon` → `100.78.3.20 User dnhhuy IdentityFile ~/.ssh/id_ed25519` | Config entry only; does not prove host is reachable |
| `tailscale status` | Node `dnhhuy` (100.78.3.20, Linux) = **offline, last seen 7 days ago** | Tailscale client on local machine is the observer; host status accurate |
| SSH connect attempt | `100.78.3.20:22` → Operation timed out | **Only port 22 attempted via Tailscale IP.** Other ports and other paths (workflow_dispatch via runner) not ruled out. |
| `qcet.dixxie.store:22` | No route to host | Cloudflare Tunnel routes HTTP/HTTPS only; SSH over port 22 via domain name was not expected to work. **Does NOT prove SSH is unavailable via all paths.** |
| `gh api /repos/.../actions/runners` | `qcet-runner-01`: status=`online`, OS=Linux, version=2.337.0 | Runner process online means its host machine is reachable via GitHub Actions network. |
| CI run 37354723272 logs | Runner home: `/home/dnhhuy/actions-runner/_work/`; Docker API 1.55 on host | Runner executes on the host that also runs production Docker containers. **This IS the production host.** |
| CI PostgreSQL service | `postgres:16-alpine` service container used in tests | **Not evidence of production DB.** CI uses an ephemeral service container, not the production database. |
| `deploy.yml` (confirmed) | No SSH, no docker push steps; staging job writes `receipt.json` only | Production deploy job requires `v*.*.*` tag and `production` environment |
| `host-diagnostics.yml` run 37402290999 | Host: `debian` (Debian 13), runner `qcet-runner-01`, Docker 29.7.2/API 1.55, `qcet-eoffice-app` up 10 days (healthy), uploads bind-mount `/home/dnhhuy/projects/qcet-eoffice/uploads` → `/app/uploads [rw]`, ClamAV container **NOT FOUND**, health `{"status":"ok","latencyMs":3}` | **Independently established via runner execution — not inferred from config files.** |
| `qcet.dixxie.store/api/health` | `{"status":"ok","database":{"latencyMs":2},"uptimeSeconds":921233}` | Proves app + DB running; does not prove version or container identity |
| `docker-compose.yml` | `CLAMAV_HOST: clamav` (service name), port defaults to 3310 via `CLAMAV_PORT` | Declared config; whether daemon is healthy on host requires `host-diagnostics.yml` run |
| `src/lib/services/file-service.ts:113-114` | `host = CLAMAV_HOST`, `port = parseInt(CLAMAV_PORT \|\| "3310")` — separate env vars | Source truth; confirms format |
| `cloudflared.yml` | Tunnel `514f4f82` → `qcet-app:3000` → `qcet.dixxie.store` | App reachable at domain; does not prove SSH blocked everywhere |

### Corrections to prior evidence claims

| Prior claim | Correction |
|---|---|
| "SSH timeout on all ports" | Only port 22 via Tailscale IP `100.78.3.20` was attempted. No scan of other ports; no attempt via workflow_dispatch runner execution. |
| "SSH via production domain blocked by Cloudflare" | Cloudflare Tunnel routes HTTP only — port 22 on the domain was never expected to work. This is not evidence that SSH is unavailable on all paths. |
| "CI Docker PostgreSQL proves production DB" | CI uses an ephemeral `postgres:16-alpine` service container. It has no relation to the production database. |
| "Runner online but host unreachable for interactive commands" | The runner IS on the production host. `workflow_dispatch` can execute read-only diagnostics on that host without SSH. `host-diagnostics.yml` created for this purpose. |

---

## Runner as Production Host — Evidence Chain

`qcet-runner-01` (online, Linux) runs at `/home/dnhhuy/actions-runner/_work/qcet-eoffice/`. CI run logs confirm Docker API 1.55 on the same machine. `docker-compose.yml` defines `qcet-app` (app), `qcet-db` (PostgreSQL), `clamav`, and `cloudflared` services. The Cloudflare tunnel routes `qcet.dixxie.store → qcet-app:3000`. The runner therefore executes on the same host as all production containers.

**`workflow_dispatch` can execute bounded read-only commands on this host without SSH.** The `host-diagnostics.yml` workflow (created this PR) collects:
- Physical hostname and kernel
- Running container names, image digests, mounts, network IPs
- ClamAV TCP:3310 health probe
- Uploads mount source path
- Environment variable NAMES in app container (no values)

Dispatch result will be recorded in this document once available.

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

**Status: `[ ]` BLOCKED — ClamAV not running; `PRODUCTION_UPLOADS_DIR` secret not yet set**

Host identity **confirmed** via diagnostics run 37402290999:
- Machine `debian` (Debian 13 Trixie), runner `qcet-runner-01`, user `dnhhuy`
- `qcet-eoffice-app` running healthy (10 days uptime)
- Uploads bind-mount: `/home/dnhhuy/projects/qcet-eoffice/uploads` → `/app/uploads [rw]`
- Production health endpoint live: `{"status":"ok","database":{"latencyMs":3}}`

Remaining blockers before deploy:
1. Owner must set `PRODUCTION_UPLOADS_DIR=/home/dnhhuy/projects/qcet-eoffice/uploads` in GitHub repo secrets
2. Owner must start ClamAV: `docker compose up -d clamav` on the production host

| Access method | Result | Notes |
|---|---|---|
| SSH via Tailscale (`100.78.3.20:22`) | Timeout | Only port 22 attempted; Tailscale node offline 7 days |
| SSH via `qcet.dixxie.store:22` | No route | Domain goes through Cloudflare Tunnel (HTTP only) — this result was expected, not evidence SSH is unavailable everywhere |
| `deploy.yml` staging job | Writes receipt only; no container push | Confirmed from source |
| `deploy.yml` production job | Requires `v*.*.*` tag + `production` environment | Not triggered |
| `workflow_dispatch` via `qcet-runner-01` | **Available** — runner is on the production host | `host-diagnostics.yml` uses this path for read-only evidence; deploy commands also executable here |

**What production deployment requires**: `docker build -t qcet-eoffice-app:latest . && docker compose up -d` on the xeon host — executable via `workflow_dispatch` on `qcet-runner-01`.  
**Unblock path**: Verify host identity via `host-diagnostics.yml` run, then authorise deploy workflow on runner.

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
| Backup-restore drill (row-count parity) | `backup-restore-drill.mjs` executed 2026-09-28 on local `qcet_eoffice` — 46/46 tables MATCH | Production backup content checksum not verified (no interactive SSH yet) |
| Outbox replay | 21/21 `outbox-pattern.test.ts` pass on `qcet_test` (2026-09-28) | Production outbox table state: query via runner possible after host identity confirmed |
| Audit evidence retrieval | 19/19 `audit-events.test.ts` pass on `qcet_test`; 63,483 non-null `request_id` rows confirmed | Production audit log volume: query via runner possible after host identity confirmed |
| Support runbooks | `docs/operations/recovery-paths.md` (11 scenarios), `docs/operations/rollback.md` | Physical drill (interactive SSH) blocked; runner-based execution feasible for read-only steps |
| ClamAV scan gate | `CLAMAV_HOST=clamav` (service name) + `CLAMAV_PORT=3310` (default) in `docker-compose.yml` | **ClamAV container NOT RUNNING** (confirmed by diagnostics run 37402290999). Backfill apply is blocked until owner starts `docker compose up -d clamav`. |

**ClamAV config**: `CLAMAV_HOST` is the hostname only (`clamav` Docker service name). Port is a **separate** `CLAMAV_PORT` env var defaulting to `3310`. `docker-compose.yml` does not set `CLAMAV_PORT` (3310 default applies). This is correct for intra-container communication.

---

## Provider-Independent Preparations (2026-10-06)

| Preparation | Location | Status |
|---|---|---|
| Host diagnostics workflow | `.github/workflows/host-diagnostics.yml` | ✅ Created — read-only, dispatched via `workflow_dispatch`, captures container/ClamAV/uploads identity |
| Production backfill workflow (hardened) | `.github/workflows/backfill-production.yml` | ✅ Updated — 7 gates: non-empty secrets, absolute uploads path, dir existence, mount match, DB reachability, ClamAV health, concurrency lock |
| ClamAV env var format corrected | This document + source verified | ✅ `CLAMAV_HOST=clamav`, `CLAMAV_PORT=3310` (default) — no change needed |
| Recovery runbooks | `docs/operations/recovery-paths.md`, `rollback.md` | ✅ Complete (11 failure scenarios) |
| Outbox replay evidence | `tests/outbox-pattern.test.ts` 21/21 on `qcet_test` | ✅ Verified |
| Audit retrieval evidence | `tests/audit-events.test.ts` 19/19 on `qcet_test` | ✅ Verified |

## Secrets Required Before Production Backfill Apply

Owner must add to GitHub repository secrets before triggering `backfill-production.yml` with `apply=true`:

| Secret | Value | Status |
|---|---|---|
| `PRODUCTION_DATABASE_URL` | Already configured (used by `deploy.yml`) | Assumed set; not independently verified |
| `PRODUCTION_UPLOADS_DIR` | Host path for uploads bind-mount — value of `UPLOADS_HOST_PATH` in `.env.production` on xeon host | **Must be set before apply** |

The backfill workflow will fail closed if either secret is empty, if `PRODUCTION_UPLOADS_DIR` is not an absolute path, or if the path does not match the running container's `/app/uploads` mount.

## Host Diagnostics Evidence (run ID 37402290999)

Dispatched 2026-10-06T02:03:48Z via `gh workflow run host-diagnostics.yml --ref main`.  
Run: https://github.com/dangnhathuycntt-byte/qcet-eoffice/actions/runs/37402290999  
Result: ✅ SUCCESS (33s)

| Evidence Field | Verified Value |
|---|---|
| Diagnostics run ID | `37402290999` |
| Runner name | `qcet-runner-01` |
| Machine hostname | `debian` |
| OS | Debian GNU/Linux 13 (Trixie) |
| Kernel | `6.12.107+deb13-amd64` |
| Runner user | `uid=1000(dnhhuy)` — member of `docker` group (gid 986) |
| Docker server | `29.7.2`, API `1.55` |
| App container | `qcet-eoffice-app` — `Up 10 days (healthy)` |
| App image digest | `sha256:b4b6864a01dcf6b9c778e0f6febc9369380e4c7f078d26b138e50edfe97971d0` |
| DB container | `qcet-eoffice-db` — `Up 10 days (healthy)` |
| Cloudflare tunnel | `qcet-eoffice-tunnel` — `Up 10 days` |
| App network | `qcet-network`, container IP `172.19.0.3` |
| Uploads mount | `/home/dnhhuy/projects/qcet-eoffice/uploads` → `/app/uploads [rw]` — exists, readable |
| Top-level file count | `0` (directory exists, no files at root level) |
| ClamAV container | **NOT FOUND** — no container named `clamav` running |
| ClamAV TCP:3310 | **UNAVAILABLE** — no container to probe |
| Health endpoint | `{"status":"ok","database":{"status":"healthy","latencyMs":3},"uptimeSeconds":927971}` ✅ |
| App env vars present | `UPLOADS_DIR`, `DATABASE_URL`, `NEXTAUTH_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `NODE_ENV`, `PORT` (values redacted) |

**Critical finding**: ClamAV container is **not running** on this host at time of diagnostics.  
The `docker-compose.yml` declares a `clamav` service, but `docker ps` shows no container named `clamav`.  
Gate 7 in `backfill-production.yml` will **block** the apply until ClamAV is running.  
Owner must start the ClamAV container (`docker compose up -d clamav`) before backfill apply is possible.

**Uploads path for secret**: Set `PRODUCTION_UPLOADS_DIR=/home/dnhhuy/projects/qcet-eoffice/uploads` in GitHub repository secrets (confirmed from mount evidence above).

---

## Summary (2026-10-06)

| Item | ID | Status | Unblock condition |
|---|---|---|---|
| Digital-signature provider choice | 67 | `[ ]` DEFERRED | Owner selects CA vendor |
| Digital-signature integration | 157 | `[ ]` BLOCKED | Item 67 unblocked |
| Deploy pilot | 172 | `[ ]` BLOCKED | Host identity ✅ confirmed (run 37402290999). Remaining: set `PRODUCTION_UPLOADS_DIR` secret + start ClamAV container |
| Reconcile post-pilot findings | 173 | `[ ]` PARTIAL | Item 172 deployed |
| Observation + legacy removal | 174 | `[ ]` BLOCKED | Item 172 deployed |
| Backup/restore + runbook verification | 175 | `[ ]` PARTIAL | Host confirmed; ClamAV not running → backfill apply blocked |

**35/41 items complete. 6 open items all have concrete blockers documented above.**  
**No items are declared complete without independently verified production evidence.**

*Last updated: 2026-10-06T02:09Z — host diagnostics evidence populated from run 37402290999*
