#!/usr/bin/env bash
# db-count.sh — Count rows in file_objects table via the app container.
#
# Strategy: run psql INSIDE the app container, which shares the Docker network
# with the actual DB endpoint (db:5432 resolves correctly from within that network).
# Falls back to direct psql in the DB container if app container lacks psql.
#
# Security:
# - DATABASE_URL parsed with urllib.parse (handles percent-encoding correctly)
# - PGPASSWORD written to a per-exec temp env-file; docker exec reads by name
# - No credential values appear on the CLI or in logs
# - Temp files cleaned up on exit
set -euo pipefail

# ── Cleanup trap ────────────────────────────────────────────────────────────
TMPDIR_SCRIPT=$(mktemp -d /tmp/db-count.XXXXXX)
trap 'rm -rf "$TMPDIR_SCRIPT"' EXIT

# ── Find app container (shares Docker network with DB) ───────────────────────
APP_CTR=$(docker ps --filter "name=qcet-app" --format '{{.Names}}' | head -1)
if [ -z "$APP_CTR" ]; then
  APP_CTR=$(docker ps --filter "name=qcet" --format '{{.Names}}' \
    | grep -v 'db\|clamav\|cloudflared\|tunnel' | head -1)
fi
if [ -z "$APP_CTR" ]; then
  echo "ERROR: No qcet app container found — cannot resolve internal DB hostname." >&2
  docker ps --format '{{.Names}}' >&2
  exit 1
fi
echo "App container: $APP_CTR" >&2

# ── Parse DATABASE_URL with Python urllib.parse (proper percent-decoding) ────
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
# database name: path starts with '/'
pg_db    = unquote(u.path.lstrip("/").split("?")[0]) if u.path else "postgres"
# Prisma may encode schema in query string: ?schema=xyz
qs = parse_qs(u.query or "")
pg_schema = qs.get("schema", [None])[0]

b64 = lambda s: base64.b64encode(s.encode()).decode()
print("PG_USER=$(printf '%s' '" + b64(pg_user) + "' | base64 -d)")
print("PG_PASS=$(printf '%s' '" + b64(pg_pass) + "' | base64 -d)")
print("PG_HOST=$(printf '%s' '" + b64(pg_host) + "' | base64 -d)")
print("PG_PORT=$(printf '%s' '" + b64(pg_port) + "' | base64 -d)")
print("PG_DB=$(printf '%s' '"   + b64(pg_db)   + "' | base64 -d)")
if pg_schema:
    print("PG_SCHEMA=$(printf '%s' '" + b64(pg_schema) + "' | base64 -d)")
else:
    print("PG_SCHEMA=public")
PYEOF

eval "$(python3 "$PARSE_PY")"

echo "psql target: host=$PG_HOST port=$PG_PORT db=$PG_DB schema=$PG_SCHEMA user=$PG_USER pass-len=${#PG_PASS}" >&2

# ── Write PGPASSWORD to an env-file (docker exec --env-file reads by name) ──
ENV_FILE="$TMPDIR_SCRIPT/pgenv"
printf 'PGPASSWORD=%s\n' "$PG_PASS" > "$ENV_FILE"
chmod 600 "$ENV_FILE"

# ── Check if psql is available in the app container ─────────────────────────
HAS_PSQL=$(docker exec "$APP_CTR" which psql 2>/dev/null || echo "")

if [ -n "$HAS_PSQL" ]; then
  EXEC_CTR="$APP_CTR"
  echo "Using psql in app container: $APP_CTR" >&2
else
  # Fall back to DB container — find it by grepping docker networks the app uses
  APP_NETWORKS=$(docker inspect "$APP_CTR" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null)
  echo "App container networks: $APP_NETWORKS" >&2

  # Find a DB container on the same network that has psql
  DB_CTR=""
  for NET in $APP_NETWORKS; do
    CANDIDATE=$(docker ps --format '{{.Names}}' \
      | grep -v 'clamav\|cloudflared\|tunnel' \
      | while read -r c; do
          docker inspect "$c" --format "{{range \$k,\$v := .NetworkSettings.Networks}}${NET}:{{end}}" 2>/dev/null \
            | grep -q "^${NET}:" && echo "$c" && break
        done 2>/dev/null | head -1)
    if [ -n "$CANDIDATE" ] && docker exec "$CANDIDATE" which psql &>/dev/null 2>&1; then
      DB_CTR="$CANDIDATE"
      break
    fi
  done

  if [ -z "$DB_CTR" ]; then
    # Last resort: find any qcet*db container
    DB_CTR=$(docker ps --filter "name=qcet" --format '{{.Names}}' \
      | grep -i 'db' | grep -v 'clamav\|cloudflared\|app\|tunnel' | head -1)
  fi

  if [ -z "$DB_CTR" ]; then
    echo "ERROR: No container with psql found (app or db)." >&2
    exit 1
  fi

  EXEC_CTR="$DB_CTR"
  echo "psql not in app container; using DB container: $DB_CTR" >&2
  echo "WARNING: DB container may be on different endpoint than DATABASE_URL target." >&2
fi

# ── Identity query: confirm which actual DB server we're connected to ─────────
# Runs inside EXEC_CTR connecting via the parsed URL components.
# If EXEC_CTR is the app container, PG_HOST resolves via Docker internal DNS.
IDENTITY_SQL="SELECT current_database(), current_schema(), current_setting('search_path'),"
IDENTITY_SQL+=" inet_server_addr()::text, inet_server_port()::text"

IDENTITY_OUT=$(docker exec \
  --env-file "$ENV_FILE" \
  "$EXEC_CTR" \
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "$IDENTITY_SQL" 2>&1 || echo "IDENTITY_FAILED")
echo "diag identity: $IDENTITY_OUT" >&2

# ── Find file_objects table across all schemas ────────────────────────────────
FO_LOCATION_SQL="SELECT table_schema, table_name FROM information_schema.tables"
FO_LOCATION_SQL+=" WHERE table_name='file_objects'"

FO_LOC=$(docker exec \
  --env-file "$ENV_FILE" \
  "$EXEC_CTR" \
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "$FO_LOCATION_SQL" 2>&1 || echo "PROBE_FAILED")
echo "diag file_objects location: $FO_LOC" >&2

# Determine which schema to use: prefer parsed schema, else discovered location
ACTUAL_SCHEMA="$PG_SCHEMA"
if echo "$FO_LOC" | grep -q '|file_objects'; then
  DISCOVERED=$(echo "$FO_LOC" | grep '|file_objects' | cut -d'|' -f1 | head -1)
  if [ -n "$DISCOVERED" ] && [ "$DISCOVERED" != "public" ]; then
    echo "file_objects found in schema '$DISCOVERED' (not public); using discovered schema" >&2
    ACTUAL_SCHEMA="$DISCOVERED"
  fi
fi

# ── COUNT(*) query ────────────────────────────────────────────────────────────
COUNT_SQL="SELECT COUNT(*) FROM \"${ACTUAL_SCHEMA}\".file_objects"

PSQL_OUT=$(docker exec \
  --env-file "$ENV_FILE" \
  "$EXEC_CTR" \
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "$COUNT_SQL" 2>&1 || echo "PSQL_FAILED")
echo "psql raw: $(echo "$PSQL_OUT" | head -1)" >&2

COUNT=$(echo "$PSQL_OUT" | tr -d '[:space:]')

if [ -z "$COUNT" ] || ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Could not get numeric file_objects count." >&2
  echo "       schema used: $ACTUAL_SCHEMA  container: $EXEC_CTR" >&2
  exit 1
fi

echo "$COUNT"
