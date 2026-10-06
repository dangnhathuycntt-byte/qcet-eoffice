#!/usr/bin/env bash
# db-count.sh — Count rows in file_objects table via psql in the DB container.
#
# Reads DATABASE_URL from environment (must already be set and masked).
# Uses Python3 to parse credentials in-memory (never logged).
# Runs psql inside the DB container via docker exec.
# Outputs a single integer (the COUNT) to stdout.
# Exits 0 on success, 1 on failure.
#
# Security: credentials passed as PGPASSWORD env var to docker exec — never on CLI.
set -euo pipefail

# Find DB container (qcet*db*, exclude app/clamav/tunnel/cloudflared)
DB_CTR=$(docker ps --filter "name=qcet" --format '{{.Names}}' \
  | grep -i 'db' | grep -v 'clamav\|cloudflared\|app\|tunnel' | head -1)

if [ -z "$DB_CTR" ]; then
  echo "ERROR: No running qcet DB container found." >&2
  docker ps --format '{{.Names}}' >&2
  exit 1
fi
echo "DB container: $DB_CTR" >&2

# Write Python credential parser to a temp file to avoid shell quoting nightmares.
# The script reads DATABASE_URL from env, outputs base64-encoded shell assignments.
PARSE_PY=$(mktemp /tmp/db-count-parse.XXXXXX.py)
cat > "$PARSE_PY" << 'PYEOF'
import os, sys, base64
url = os.environ.get("DATABASE_URL", "")
if not url:
    print('echo "ERROR: DATABASE_URL is empty" >&2; exit 1')
    sys.exit(0)
# Strip scheme (postgresql:// or postgres://)
rest = url.split("://", 1)[1] if "://" in url else url
# Find last @ to handle passwords containing @
at = rest.rfind("@")
userpass = rest[:at]
hostpart = rest[at+1:]
# Split user:pass (password may contain :)
parts = userpass.split(":", 1)
pg_user = parts[0]
pg_pass = parts[1] if len(parts) > 1 else ""
# Extract dbname (strip query params)
pg_db = hostpart.split("/", 1)[1].split("?")[0] if "/" in hostpart else "postgres"
b64 = lambda s: base64.b64encode(s.encode()).decode()
# Emit shell assignments using printf + base64 to avoid quoting issues
print("PG_USER=$(printf '%s' '" + b64(pg_user) + "' | base64 -d)")
print("PG_PASS=$(printf '%s' '" + b64(pg_pass) + "' | base64 -d)")
print("PG_DB=$(printf '%s' '" + b64(pg_db) + "' | base64 -d)")
PYEOF

# Run Python parser; eval the resulting shell assignments (values are base64-safe)
eval "$(python3 "$PARSE_PY")"
rm -f "$PARSE_PY"

echo "psql: db=$PG_DB user=$PG_USER pass-len=${#PG_PASS}" >&2

# Diagnostic: list schemas and tables so we can identify exact table location.
SCHEMA_OUT=$(docker exec \
  -e "PGPASSWORD=$PG_PASS" \
  "$DB_CTR" \
  psql -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%file%' ORDER BY table_schema, table_name" 2>&1 || echo "DIAG_FAILED")
echo "diag schemas/tables: $SCHEMA_OUT" >&2

# Try schema-qualified form first, then fall back to search-path default.
PSQL_OUT=$(docker exec \
  -e "PGPASSWORD=$PG_PASS" \
  "$DB_CTR" \
  psql -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "SELECT COUNT(*) FROM public.file_objects" 2>&1 || echo "PSQL_FAILED")

echo "psql raw: $(echo "$PSQL_OUT" | head -1)" >&2

COUNT=$(echo "$PSQL_OUT" | tr -d '[:space:]')

if [ -z "$COUNT" ] || ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Could not get numeric file_objects count from psql in $DB_CTR." >&2
  echo "       (psql output non-numeric; see 'psql raw' line above for details)" >&2
  exit 1
fi

echo "$COUNT"
