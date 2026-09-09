# QCET E-Office — Deployment Architecture & Operations Guide

**Document Status**: Canonical Operational Reference  
**Scope**: Production Deployments, CI/CD Pipeline, Reverse Proxy Configuration, Health Checks  
**Infrastructure Target**: On-Premise Enterprise Host (Ubuntu Linux / Windows Server IIS/Docker)  
**Last Updated**: 2026-09-09  

---

## 1. Architectural Principles

QCET E-Office is deployed using a self-contained, enterprise-grade architecture engineered for stability, institutional privacy, and operational resilience:

1. **Immutable Artifact Strategy**: Every deployment produces a hermetic, versioned build artifact (Docker image or Next.js `standalone` bundle). Code is never modified or built directly on the production host.
2. **Strict CI/CD Promotion**: Code transitions deterministically through four gates: `Local Dev` -> `Automated CI` -> `Staging Validation` -> `Production Release`.
3. **Zero Manual Server Edits**: Direct modification of files in the deployment target is strictly prohibited. All configuration is managed through external environment variables and version-controlled declarative descriptors.
4. **Isolated Network Boundaries**: The Node.js application process runs unexposed on loopback (`127.0.0.1:3001`), shielded by a dedicated Reverse Proxy (Nginx or IIS) enforcing TLS, rate limits, and payload inspection.

---

## 2. CI/CD Promotion Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1. DEV      │ ──> │    2. CI     │ ──> │  3. STAGING  │ ──> │   4. PROD    │
│ Branch Work  │     │ Automated    │     │ Pre-Release  │     │ Production   │
│ & Local Test │     │ Checks & Test│     │ Verification │     │ Blue/Green   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Stage 1: Local Development
- Developer implements features or fixes within an isolated branch.
- Pre-commit verifications: `npm run typecheck`, unit tests, linting.

### Stage 2: Continuous Integration (CI)
- Triggered automatically on Pull Request to `main`.
- Enforces strict quality gates:
  - Full TypeScript validation (`npm run typecheck`).
  - Automated test suite execution (`npm test`).
  - Architectural invariant checks (no forbidden mock fallbacks, light-only UI tokens).
  - Secret scanning across git diff.

### Stage 3: Staging Verification
- Automated build of immutable Docker container tagged with git commit SHA (`qcet-eoffice:sha-<commit>`).
- Deployed to staging host with production parity.
- Integration tests and user acceptance sign-off.

### Stage 4: Production Release
- Promotion of the verified staging artifact to production.
- Database migration execution (non-destructive schema expansion).
- Graceful container reload or port switchover.

---

## 3. Reverse Proxy Architecture & Boundary Specification

The Node.js Next.js application server must **never** be exposed directly to the public internet or external campus network. A robust reverse proxy layer (Nginx on Linux or IIS with URL Rewrite on Windows Server) sits at the boundary.

```
 Internet / Campus Network
            │
            ▼
┌──────────────────────────────────────┐
│  REVERSE PROXY (Nginx / IIS)         │
│  - TLS 1.3 Termination (HTTPS 443)  │
│  - HSTS, CSP, & Security Headers     │
│  - Rate Limiting (API: 60 req/min)   │
│  - Payload Cap: 50MB (Client Uploads)│
│  - Static Asset Edge Caching (_next) │
└──────────────────────────────────────┘
            │  (HTTP Loopback: 127.0.0.1:3001)
            ▼
┌──────────────────────────────────────┐
│  QCET NEXT.JS STANDALONE ENGINE      │
│  - Port 3001                         │
│  - Server-side Session Auth (JWT)    │
│  - API Business Logic & RBAC         │
│  - PostgreSQL Client Connection Pool │
└──────────────────────────────────────┘
```

### 3.1 Nginx Reference Configuration (`/etc/nginx/sites-available/qcet-eoffice.conf`)

```nginx
# Rate limiting zone for API routes
limit_req_zone $binary_remote_addr zone=qcet_api_limit:10m rate=30r/s;

server {
    listen 80;
    server_name e-office.cdktcnqn.edu.vn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name e-office.cdktcnqn.edu.vn;

    # TLS Certificates (Institutional Certificate Authority or Let's Encrypt)
    ssl_certificate /etc/ssl/certs/qcet_eoffice_fullchain.pem;
    ssl_certificate_key /etc/ssl/private/qcet_eoffice.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Institutional Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Payload Caps: Allow up to 50MB for document uploads and task deliverables
    client_max_body_size 50M;

    # Static Asset Caching (Next.js immutable hashed chunks)
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # API Routes Rate Limiting & Proxying
    location /api/ {
        limit_req zone=qcet_api_limit burst=20 nodelay;
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Default Next.js App Routing
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Production Deployment Execution

### 4.1 Automated Docker Build & Run
QCET E-Office utilizes the Next.js `standalone` output mode to minimize container footprint (<150MB):

```bash
# 1. Build immutable production image
docker build \
  --build-arg SKIP_ENV_VALIDATION=true \
  --build-arg NEXT_PHASE=phase-production-build \
  -t qcet-eoffice:v1.0.0 .

# 2. Execute database schema migration
docker run --rm \
  --env-file /etc/qcet/production.env \
  qcet-eoffice:v1.0.0 npx prisma migrate deploy

# 3. Launch production container with mounted persistent volumes
docker run -d \
  --name qcet-eoffice-app \
  --restart always \
  -p 127.0.0.1:3001:3001 \
  --env-file /etc/qcet/production.env \
  -v /var/qcet/uploads:/app/uploads \
  -v /var/qcet/storage:/app/storage \
  qcet-eoffice:v1.0.0
```

---

## 5. Health Checks & Verification Procedures

Following every deployment, automated probes must confirm service availability before traffic switchover:

### 5.1 Endpoint Health Probes
1. **System & Network Info Endpoint**:
   ```bash
   curl -f -s http://127.0.0.1:3001/api/system/network-info | jq .
   ```
   *Expected Response*: HTTP 200 with server status, port (3001), and environment (`production`).

2. **Public Runtime Config Endpoint**:
   ```bash
   curl -f -s http://127.0.0.1:3001/api/runtime-config | jq .
   ```
   *Expected Response*: HTTP 200 with runtime features, application version, and zero leaked secrets.

3. **Database Readiness Probe**:
   Ensure Prisma client connects cleanly and executes query heartbeat without connection pool exhaustion.
