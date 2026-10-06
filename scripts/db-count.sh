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

# Parse DATABASE_URL → base64-encoded shell assignments (nothing logged)
eval "$(python3 - <<'PY'
import os, sys, base64
url = os.environ.get('DATABASE_URL', '')
if not url:
    print('echo "ERROR: DATABASE_URL is empty" >&2; exit 1')
    sys.exit(0)
rest = url.split('://', 1)[1] if '://' in url else url
at = rest.rfind('@')
userpass = rest[:at]
hostpart = rest[at+1:]
parts = userpass.split(':', 1)
pg_user = parts[0]
pg_pass = parts[1] if len(parts) > 1 else ''
pg_db = hostpart.split('/', 1)[1].split('?')[0] if '/' in hostpart else 'postgres'
b64 = lambda s: base64.b64encode(s.encode()).decode()
print("PG_USER=$(echo '" + b64(pg_user) + "' | base64 -d)")
print("PG_PASS=$(echo '" + b64(pg_pass) + "' | base64 -d)")
print("PG_DB=$(echo '" + b64(pg_db) + "' | base64 -d)")
PY
)"

# Run COUNT(*) inside DB container; PGPASSWORD as env var, not CLI arg
COUNT=$(docker exec \
  -e "PGPASSWORD=$PG_PASS" \
  "$DB_CTR" \
  psql -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "SELECT COUNT(*) FROM file_objects" 2>/dev/null || echo "")

COUNT=$(echo "$COUNT" | tr -d '[:space:]')

if [ -z "$COUNT" ] || ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Could not get numeric file_objects count from psql in $DB_CTR." >&2
  echo "       (result was non-numeric or empty)" >&2
  exit 1
fi

echo "$COUNT"
