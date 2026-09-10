#!/usr/bin/env bash
# ==============================================================================
# QCET E-Office Production Database & Storage Backup Script
# Sprint 10: Production Readiness & Disaster Recovery
#
# Creates a compressed PostgreSQL custom-format dump (-F c) and archives
# private uploaded attachments. Enforces retention policy.
# ==============================================================================

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STORAGE_DIR="${STORAGE_DIR:-./storage/private}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "${BACKUP_DIR}"

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [BACKUP] $*"
}

log "Starting QCET E-Office backup routine..."

# Parse DATABASE_URL if available
if [[ -n "${DATABASE_URL:-}" ]]; then
  # postgresql://user:password@host:port/dbname?schema=public
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

DUMP_FILE="${BACKUP_DIR}/qcet_db_${TIMESTAMP}.dump"
FILES_FILE="${BACKUP_DIR}/qcet_storage_${TIMESTAMP}.tar.gz"

log "Target Database: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
log "Output Database Dump: ${DUMP_FILE}"

# 1. Database Dump using custom format
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" \
    -F c -b -v -f "${DUMP_FILE}"
  DUMP_SIZE=$(du -h "${DUMP_FILE}" | cut -f1)
  log "Database dump completed successfully (Size: ${DUMP_SIZE})."
elif [[ -n "${DOCKER_CONTAINER:-}" ]] && command -v docker >/dev/null 2>&1; then
  log "pg_dump not found locally; executing inside container ${DOCKER_CONTAINER}..."
  docker exec "${DOCKER_CONTAINER}" pg_dump -U "${PGUSER}" -d "${PGDATABASE}" -F c -b -f "/tmp/dump.tmp"
  docker cp "${DOCKER_CONTAINER}:/tmp/dump.tmp" "${DUMP_FILE}"
  docker exec "${DOCKER_CONTAINER}" rm -f "/tmp/dump.tmp"
  log "Container database dump completed successfully."
else
  log "ERROR: Neither pg_dump nor DOCKER_CONTAINER found. Cannot dump database."
  exit 1
fi

# 2. File Storage Archive
if [[ -d "${STORAGE_DIR}" ]]; then
  log "Archiving storage directory: ${STORAGE_DIR} -> ${FILES_FILE}"
  tar -czf "${FILES_FILE}" -C "$(dirname "${STORAGE_DIR}")" "$(basename "${STORAGE_DIR}")"
  STORAGE_SIZE=$(du -h "${FILES_FILE}" | cut -f1)
  log "Storage archive completed successfully (Size: ${STORAGE_SIZE})."
else
  log "Storage directory '${STORAGE_DIR}' does not exist or is empty; skipping archive."
fi

# 3. Retention Cleanup
log "Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f \( -name "qcet_db_*.dump" -o -name "qcet_storage_*.tar.gz" \) -mtime "+${RETENTION_DAYS}" -exec rm -f {} + || true

log "Backup completed successfully for timestamp ${TIMESTAMP}."
