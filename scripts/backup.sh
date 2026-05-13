#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Database Backup Script
# Creates timestamped, gzip-compressed PostgreSQL dumps with
# automatic retention cleanup.
#
# Usage:
#   ./scripts/backup.sh
#
# Configuration via environment variables:
#   PGHOST       — Database host (default: localhost)
#   PGPORT       — Database port (default: 5432)
#   PGUSER       — Database user (default: internship)
#   PGPASSWORD   — Database password (required)
#   PGDATABASE   — Database name (default: internship_prod)
#   BACKUP_DIR   — Backup directory (default: ./backups)
#   RETENTION_DAYS — Days to keep backups (default: 30)
#
# The script:
#  - Uses PGPASSWORD environment variable (never -W or inline password)
#  - Creates a timestamped .sql.gz file
#  - Logs success/failure to stdout
#  - Exits non-zero on failure (for cron alerting)
#  - Rotates backups older than RETENTION_DAYS
# ─────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=internship}"
: "${PGDATABASE:=internship_prod}"
: "${BACKUP_DIR:=./backups}"
: "${RETENTION_DAYS:=30}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${PGDATABASE}_${TIMESTAMP}.sql.gz"

# ─── Validate Configuration ─────────────────────────────────

if [ -z "${PGPASSWORD:-}" ]; then
  echo "[ERROR] PGPASSWORD environment variable is required" >&2
  echo "Usage: PGPASSWORD=your_password ./scripts/backup.sh" >&2
  exit 1
fi

# ─── Create Backup Directory ────────────────────────────────

mkdir -p "${BACKUP_DIR}"

# ─── Perform Backup ─────────────────────────────────────────

echo "[INFO] Starting backup of database '${PGDATABASE}' on ${PGHOST}:${PGPORT}"
echo "[INFO] Backup target: ${BACKUP_FILE}"

START_TIME=$(date +%s)

pg_dump \
  --host="${PGHOST}" \
  --port="${PGPORT}" \
  --username="${PGUSER}" \
  --dbname="${PGDATABASE}" \
  --no-owner \
  --no-acl \
  | gzip > "${BACKUP_FILE}"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# ─── Verify Backup ──────────────────────────────────────────

if [ ! -s "${BACKUP_FILE}" ]; then
  echo "[ERROR] Backup file is empty or was not created: ${BACKUP_FILE}" >&2
  exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[SUCCESS] Backup completed successfully"
echo "  File:     ${BACKUP_FILE}"
echo "  Size:     ${BACKUP_SIZE}"
echo "  Duration: ${DURATION} seconds"

# ─── Retention Cleanup ──────────────────────────────────────

echo "[INFO] Removing backups older than ${RETENTION_DAYS} days from ${BACKUP_DIR}"
DELETED_COUNT=0

while IFS= read -r -d '' OLD_FILE; do
  rm -f "${OLD_FILE}"
  echo "[INFO] Deleted old backup: ${OLD_FILE}"
  DELETED_COUNT=$((DELETED_COUNT + 1))
done < <(find "${BACKUP_DIR}" -name "*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -print0)

if [ "${DELETED_COUNT}" -gt 0 ]; then
  echo "[INFO] Cleaned up ${DELETED_COUNT} old backup(s)"
else
  echo "[INFO] No old backups to clean up"
fi

exit 0
