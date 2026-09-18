#!/usr/bin/env bash
# ==============================================================================
# QCET E-Office Production Database & Storage Restore Script
# Sprint 10: Production Readiness & Disaster Recovery
#
# Restores a PostgreSQL custom-format dump (-F c) using pg_restore
# and optionally restores private storage archive.
# ==============================================================================

set -euo pipefail

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [RESTORE] $*"
}

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path_to_dump_file> [path_to_storage_tar_gz] [target_storage_dir]"
  echo "Example: $0 ./backups/qcet_db_20260910_120000.dump ./backups/qcet_storage_20260910_120000.tar.gz ./storage/private"
  exit 1
fi

DUMP_FILE="$1"
STORAGE_ARCHIVE="${2:-}"
TARGET_STORAGE="${3:-./storage/private}"

if [[ ! -f "${DUMP_FILE}" ]]; then
  log "ERROR: Dump file not found: ${DUMP_FILE}"
  exit 1
fi

# Parse DATABASE_URL if available
if [[ -n "${DATABASE_URL:-}" ]]; then
  PROTO="$(echo "$DATABASE_URL" | grep :// | sed -e's,^\(.*://\).*,\1,g')"
  URL_NO_PROTO="${DATABASE_URL#"$PROTO"}"
  USER_PASS="$(echo "$URL_NO_PROTO" | grep @ | cut -d@ -f1 || true)"
  HOST_PORT_DB="$(echo "$URL_NO_PROTO" | sed -e "s,^$USER_PASS@,,g")"

  if [[ -n "$USER_PASS" ]]; then
    DB_USER="$(echo "$USER_PASS" | cut -d: -f1)"
    DB_PASS="$(echo "$USER_PASS" | cut -s -d: -f2 || true)"
  fi

  HOST_PORT="$(echo "$HOST_PORT_DB" | cut -d/ -f1)"
  DB_NAME="$(echo "$HOST_PORT_DB" | cut -d/ -f2 | cut -d? -f1)"

  DB_HOST="$(echo "$HOST_PORT" | cut -d: -f1)"
  DB_PORT="$(echo "$HOST_PORT" | cut -s -d: -f2)"
  DB_PORT="${DB_PORT:-5432}"

  export PGHOST="${DB_HOST}"
  export PGPORT="${DB_PORT}"
  export PGUSER="${DB_USER:-postgres}"
  export PGDATABASE="${DB_NAME:-qcet_eoffice}"
  if [[ -n "${DB_PASS:-}" ]]; then
    export PGPASSWORD="${DB_PASS}"
  fi
fi

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-qcet_eoffice}"

log "Starting restoration process..."
log "Target Database: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
log "Source Dump: ${DUMP_FILE}"

if command -v pg_restore >/dev/null 2>&1; then
  log "Executing pg_restore (clean, if-exists, no-owner)..."
  pg_restore -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" \
    --clean --if-exists --no-owner --no-privileges --exit-on-error -v "${DUMP_FILE}"
  log "Database restoration completed successfully."
else
  log "ERROR: pg_restore command not found in PATH."
  exit 1
fi

# Restore storage archive if provided
if [[ -n "${STORAGE_ARCHIVE}" && -f "${STORAGE_ARCHIVE}" ]]; then
  log "Extracting storage archive: ${STORAGE_ARCHIVE} -> ${TARGET_STORAGE}"
  mkdir -p "${TARGET_STORAGE}"
  tar -xzf "${STORAGE_ARCHIVE}" -C "$(dirname "${TARGET_STORAGE}")"
  log "Storage files restored successfully."
fi

log "Restore drill / process completed successfully."
