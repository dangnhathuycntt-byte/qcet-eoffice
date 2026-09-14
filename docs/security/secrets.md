# QCET E-Office — Secrets Management & Lifecycle Policy

**Document Status**: Canonical Security Reference  
**Scope**: Cryptographic Keys, Database Credentials, OAuth Tokens, Secret Lifecycles  
**Authority**: Quản trị mạng / Ban Giám hiệu, Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn   
**Last Updated**: 2026-09-09  

---

## 1. Scope & Invariant Principles

Secrets represent the cryptographic foundation of trust within QCET E-Office. Compromise of a single production secret undermines user authenticity, institutional integrity, and database confidentiality.

### Core Security Invariants:
1. **Zero Secrets in Source Control**: Production secrets, development passwords, private keys, and live API tokens must never be committed to Git repositories under any circumstance.
2. **Environment Isolation**: Cryptographic secrets, connection strings, and credentials must never be shared across environments (`DEV != STAGING != PROD`).
3. **Fail-Fast Startup Validation**: In production (`NODE_ENV=production`), missing, empty, or insecure fallback secrets cause immediate process termination before accepting network traffic.

---

## 2. Inventory of Institutional Secrets

| Secret Key | Description | Minimum Length / Format | Scope |
| :--- | :--- | :--- | :--- |
| `AUTH_SECRET` | Primary HMAC-SHA256 key for signing and validating session JWTs (`qcet_session`) | >= 32 characters (Base64 or Hex) | Server-Only |
| `JWT_SECRET` | Backward-compatibility alias for `AUTH_SECRET` | >= 32 characters | Server-Only |
| `DATABASE_URL` | PostgreSQL connection string including user, password, host, and database name | `postgresql://user:pass@host:5432/db` | Server-Only |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth 2.0 client secret for Google Workspace SSO | Alphanumeric secret from GCP Console | Server-Only |
| `VAPID_PRIVATE_KEY` | Elliptic Curve (NIST P-256) private key for Web Push protocol signing | Base64 URL-safe (43-44 chars) | Server-Only |
| `POSTGRES_PASSWORD` | PostgreSQL root/superuser password for Docker engine host | >= 16 characters, high entropy | Infrastructure |
| `NOTION_TOKEN` | Bearer token for legacy Notion calendar reading (read-only integration) | `secret_...` format | Server-Only |

---

## 3. Secret Lifecycle Management

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. CREATION │ ──> │  2. STORAGE  │ ──> │3.DISTRIBUTION│
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
┌──────────────┐     ┌──────────────┐            ▼
│6.INVALIDATION│ <── │ 5.REVOCATION │ <── ┌──────────────┐
│ (EMERGENCY)  │     │  & ROTATION  │     │ 4. RUNTIME   │
└──────────────┘     └──────────────┘     │  CONSUMPTION │
                                          └──────────────┘
```

### 3.1 Creation (Generation Standards)
- **Entropy Requirement**: Secrets must be cryptographically pseudo-random numbers generated using system entropy (`/dev/urandom` or Node.js `crypto.randomBytes`).
- **Generation Procedures**:
  ```bash
  # Generate strong AUTH_SECRET / JWT_SECRET (384-bit entropy)
  openssl rand -base64 48

  # Generate VAPID Keypair
  npx web-push generate-vapid-keys

  # Generate database password (256-bit entropy)
  openssl rand -hex 32
  ```
- **Prohibited Sources**: Never use dictionary words, institutional acronyms (`QCET2026!`), phone numbers, or predictable date patterns as secrets.

### 3.2 Storage
- **Local Development**: Developer workstations use untracked `.env.local` files.
- **Production & Staging**: Secrets reside in external secret stores (e.g. Docker Secrets, systemd service environment files with permissions `0600`, or CI/CD protected variables).
- **Filesystem Permissions**: Environment files on production servers must be owned by the application service account (`qcet:qcet`) with POSIX permissions `chmod 600`.

### 3.3 Distribution
- Secrets are injected into running processes via standard environment variables at container launch or systemd startup.
- Secrets are **never baked into Docker build images** (`Dockerfile` layers). Docker builds run with `NEXT_PHASE=phase-production-build` or `SKIP_ENV_VALIDATION=true` to allow static compilation without requiring runtime production secrets.

### 3.4 Runtime Consumption & Validation
- Validated at startup via `src/config/env.server.ts` (`validateServerEnv`).
- `ServerEnvSchema` enforces:
  - In production (`NODE_ENV === "production"`), `DATABASE_URL` and `AUTH_SECRET` must be non-empty.
  - `AUTH_SECRET` must be at least 32 characters in length.
  - If `GOOGLE_CLIENT_ID` is present, `GOOGLE_CLIENT_SECRET` must also be provided.
  - If `VAPID_PRIVATE_KEY` is present, `VAPID_PUBLIC_KEY` must also be provided.
- If validation fails, the process exits immediately with a descriptive error message and exit code 1.

### 3.5 Scheduled Rotation Policy
- **Session Keys (`AUTH_SECRET`)**: Rotated every 180 days.
  - *Graceful Transition*: Support dual-secret validation if zero-downtime session re-auth is required.
- **Database Passwords**: Rotated every 365 days or upon staff transition within the IT department.
- **VAPID Keys**: Rotated every 365 days. (Note: Rotating VAPID keys requires re-subscribing client browsers).
- **OAuth Client Secrets**: Rotated annually via the Google Cloud Console.

### 3.6 Emergency Invalidation & Compromise Runbook
In the event of suspected or confirmed secret leakage:
1. **Immediate Invalidation**:
   - Change the secret in the production environment configuration.
   - For `AUTH_SECRET`: Restarting the Next.js process with a new secret immediately invalidates all active sessions (`qcet_session`), forcing all users to re-authenticate.
   - For `DATABASE_URL`: Alter the PostgreSQL user password directly in the database (`ALTER USER qcet_admin WITH PASSWORD '...'`), update the server environment file, and restart containers.
   - For Google OAuth: Invalidate the compromised Client Secret in Google Cloud Console immediately and generate a replacement.
2. **Audit Inspection**:
   - Query `AuditEvent` table for unauthorized transactions executed during the window of compromise.
   - Inspect reverse proxy logs and server access logs for anomalous IP addresses or unexpected endpoints.
3. **Post-Mortem**: Document root cause, timeline, affected records, and corrective measures.

---

## 4. Environment Isolation Policy

QCET E-Office strictly enforces physical and logical isolation across deployment tiers:

| Attribute | Development (`development`) | Staging (`staging`) | Production (`production`) |
| :--- | :--- | :--- | :--- |
| **Database Host** | Localhost or Dev Docker (`qcet_dev`) | Isolated Staging Server (`qcet_staging`) | Dedicated Production DB (`qcet_prod`) |
| **Data Fidelity** | Synthetic seed data (`npm run db:seed`) | Anonymized production clone / synthetic | Live institutional data |
| **`AUTH_SECRET`** | Development fallback permitted | Unique, randomly generated 48-byte key | Unique, vault-managed 64-byte key |
| **Google SSO** | Test OAuth client or dev bypass | Staging OAuth client | Production OAuth client (`cdktcnqn.edu.vn`) |
| **Web Push (VAPID)** | Mock / Test VAPID keys | Isolated Staging VAPID keys | Production VAPID keys |
| **Fallback Behaviors** | `DEV_AUTH_SECRET_FALLBACK` allowed | **STRICTLY FORBIDDEN** | **STRICTLY FORBIDDEN** |

---

## 5. Automated Git & CI Prevention Controls

To ensure zero secrets enter version control:
1. **Repository `.gitignore`**:
   - Excludes `.env`, `.env.local`, `.env.*.local`, `*.pem`, `*.key`, `credentials.json`.
2. **Deterministic Pre-Tool / Pre-Commit Hooks**:
   - Hook `./.claude/hooks/protect-sensitive-files` blocks any tool or command attempting to read, edit, or commit sensitive secret files.
   - Only `.env.example` and `*.example` templates are permitted.
3. **CI Secret Scanner**:
   - Automated CI workflows run regex checks against all commits, flagging patterns such as `BEGIN PRIVATE KEY`, `postgres://...`, and high-entropy base64 strings.
