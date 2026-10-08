#!/usr/bin/env bash
# db-count.sh — Count rows in file_objects table via Docker network.
#
# Strategy: run psql INSIDE qcet-network using a one-shot postgres container,
# so that the Docker-internal hostname (qcet-db) resolves via Docker DNS.
# Falls back to docker exec on the DB container if qcet-network name differs.
#
# Security:
# - DATABASE_URL parsed with Python urllib.parse (handles percent-encoding)
# - PGPASSWORD written to a per-exec temp env-file; passed with --env-file
#   to docker run (never appears on CLI or in ps output)
# - No credential values appear in logs
# - Temp files cleaned up on EXIT trap
set -euo pipefail

# ── Cleanup trap ─────────────────────────────────────────────────────────────
TMPDIR_SCRIPT=$(mktemp -d /tmp/db-count.XXXXXX)
trap 'rm -rf "$TMPDIR_SCRIPT"' EXIT

# ── Parse DATABASE_URL with Python urllib.parse (proper percent-decoding) ─────
PARSE_PY="$TMPDIR_SCRIPT/parse.py"
cat > "$PARSE_PY" << 'PYEOF'
import os, sys, base64
from urllib.parse import urlsplit, unquote, parse_qs

url = os.environ.get("DATABASE_URL", "")
if not url:
    print('echo "ERROR: DATABASE_URL is empty" >&2; exit 1')
    sys.exit(0)

u = urlsplit(url)
pg_user  = unquote(u.username or "")
pg_pass  = unquote(u.password or "")
pg_host  = unquote(u.hostname or "localhost")
pg_port  = str(u.port or 5432)
pg_db    = unquote(u.path.lstrip("/").split("?")[0]) if u.path else "postgres"
qs = parse_qs(u.query or "")
pg_schema = qs.get("schema", [None])[0] or "public"

b64 = lambda s: base64.b64encode(s.encode()).decode()
print("PG_USER=$(printf '%s' '" + b64(pg_user) + "' | base64 -d)")
print("PG_PASS=$(printf '%s' '" + b64(pg_pass) + "' | base64 -d)")
print("PG_HOST=$(printf '%s' '" + b64(pg_host) + "' | base64 -d)")
print("PG_PORT=$(printf '%s' '" + b64(pg_port) + "' | base64 -d)")
print("PG_DB=$(printf '%s' '"   + b64(pg_db)   + "' | base64 -d)")
print("PG_SCHEMA=$(printf '%s' '" + b64(pg_schema) + "' | base64 -d)")
PYEOF

eval "$(python3 "$PARSE_PY")"
echo "psql target: host=$PG_HOST port=$PG_PORT db=$PG_DB schema=$PG_SCHEMA user=$PG_USER pass-len=${#PG_PASS}" >&2

# ── Write PGPASSWORD to env-file (docker run --env-file reads by name) ───────
ENV_FILE="$TMPDIR_SCRIPT/pgenv"
printf 'PGPASSWORD=%s\n' "$PG_PASS" > "$ENV_FILE"
chmod 600 "$ENV_FILE"

# ── Determine which Docker network connects to the DB host ────────────────────
# Docker Compose gives the network the custom name from docker-compose.yml
# (name: qcet-network). Find the network that the DB container is on.
DB_CTR_NAME=$(docker ps --filter "name=qcet" --format '{{.Names}}' \
  | grep -iE 'db' | grep -vE 'clamav|cloudflared|tunnel|app' | head -1)

if [ -z "$DB_CTR_NAME" ]; then
  echo "ERROR: No qcet DB container found; cannot determine network." >&2
  docker ps --format '{{.Names}}' >&2
  exit 1
fi
echo "DB container (for network discovery): $DB_CTR_NAME" >&2

# Extract network names the DB container is on
DB_NETWORKS=$(docker inspect "$DB_CTR_NAME" \
  --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null \
  | tr ' ' '\n' | grep -v '^$' | head -5)
echo "DB container networks: $DB_NETWORKS" >&2

# Use first network (usually the only compose network)
DOCKER_NETWORK=$(echo "$DB_NETWORKS" | head -1)
if [ -z "$DOCKER_NETWORK" ]; then
  echo "ERROR: Could not determine Docker network from DB container." >&2
  exit 1
fi
echo "Using Docker network: $DOCKER_NETWORK" >&2

# ── Check if postgres image is available locally (avoid pull delay in CI) ─────
PG_IMAGE="postgres:16-alpine"
if ! docker image inspect "$PG_IMAGE" &>/dev/null 2>&1; then
  echo "Pulling $PG_IMAGE for psql..." >&2
  docker pull "$PG_IMAGE" >&2
fi

# ── Identity query — confirm which actual DB server we're connected to ─────────
IDENTITY_SQL="SELECT current_database(), current_schema(), current_setting('search_path'), inet_server_addr()::text, inet_server_port()::text"

IDENTITY_OUT=$(docker run --rm \
  --network "$DOCKER_NETWORK" \
  --env-file "$ENV_FILE" \
  "$PG_IMAGE" \
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "$IDENTITY_SQL" 2>&1 || echo "IDENTITY_FAILED")
echo "diag identity: $IDENTITY_OUT" >&2

# ── Find file_objects table across all schemas ─────────────────────────────────
FO_LOCATION_SQL="SELECT table_schema, table_name FROM information_schema.tables WHERE table_name='file_objects'"

FO_LOC=$(docker run --rm \
  --network "$DOCKER_NETWORK" \
  --env-file "$ENV_FILE" \
  "$PG_IMAGE" \
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "$FO_LOCATION_SQL" 2>&1 || echo "PROBE_FAILED")
echo "diag file_objects location: $FO_LOC" >&2

# ── Check migration state ──────────────────────────────────────────────────────
MIGRATION_SQL="SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL"
MIGRATION_COUNT=$(docker run --rm \
  --network "$DOCKER_NETWORK" \
  --env-file "$ENV_FILE" \
  "$PG_IMAGE" \
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "$MIGRATION_SQL" 2>&1 | tr -d '[:space:]' || echo "MIGRATION_PROBE_FAILED")
echo "diag applied migrations: $MIGRATION_COUNT" >&2

# ── Determine schema to query ──────────────────────────────────────────────────
ACTUAL_SCHEMA="$PG_SCHEMA"
if echo "$FO_LOC" | grep -q '|file_objects'; then
  DISCOVERED=$(echo "$FO_LOC" | grep '|file_objects' | cut -d'|' -f1 | head -1)
  if [ -n "$DISCOVERED" ] && [ "$DISCOVERED" != "$ACTUAL_SCHEMA" ]; then
    echo "file_objects found in schema '$DISCOVERED' (not '$ACTUAL_SCHEMA'); using discovered schema" >&2
    ACTUAL_SCHEMA="$DISCOVERED"
  fi
fi

# ── COUNT(*) query ─────────────────────────────────────────────────────────────
COUNT_SQL="SELECT COUNT(*) FROM \"${ACTUAL_SCHEMA}\".file_objects"

PSQL_OUT=$(docker run --rm \
  --network "$DOCKER_NETWORK" \
  --env-file "$ENV_FILE" \
  "$PG_IMAGE" \
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "$COUNT_SQL" 2>&1 || echo "PSQL_FAILED")
echo "psql raw: $(echo "$PSQL_OUT" | head -1)" >&2

COUNT=$(echo "$PSQL_OUT" | tr -d '[:space:]')

if [ -z "$COUNT" ] || ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Could not get numeric file_objects count." >&2
  echo "       schema used: $ACTUAL_SCHEMA  network: $DOCKER_NETWORK" >&2
  echo "       diag identity: $IDENTITY_OUT" >&2
  echo "       diag file_objects: $FO_LOC" >&2
  echo "       applied migrations: $MIGRATION_COUNT" >&2
  exit 1
fi

echo "$COUNT"
