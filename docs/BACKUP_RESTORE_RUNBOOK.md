# Boutinly CRM — Database Backup & Restore Runbook

## Architecture

PostgreSQL 16 on the `pgdata` Docker volume. Backups target an S3 bucket or local filesystem.

## Automated Backup

### Prerequisites

- `pg_dump` (bundled with postgres-client)
- AWS CLI configured (if targeting S3)
- `BACKUP_S3_BUCKET` env var set (optional)

### Scheduled Backup Script

```bash
# scripts/backup.sh
#!/bin/bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://boutinly:boutinly@localhost:5432/boutinly_crm}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/boutinly_crm_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "Starting backup at $TIMESTAMP..."

# Dump in custom format (supports parallel restore)
pg_dump "$DB_URL" \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup created: $BACKUP_FILE ($SIZE)"

# Upload to S3 if configured
if [ -n "$S3_BUCKET" ]; then
  aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/backups/${TIMESTAMP}/" \
    --storage-class STANDARD_IA \
    --metadata "created=${TIMESTAMP}"
  echo "Uploaded to s3://${S3_BUCKET}/backups/${TIMESTAMP}/"
fi

# Cleanup old local backups (keep last 7 days)
find "$BACKUP_DIR" -name "*.dump" -mtime +7 -delete

echo "Backup complete."
```

### Restore Procedure

```bash
# scripts/restore.sh
#!/bin/bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://boutinly:boutinly@localhost:5432/boutinly_crm}"
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: restore.sh <backup_file.dump>"
  echo "  or:  restore.sh s3://bucket/backups/20260731_120000/"
  exit 1
fi

# If S3 path, download first
if [[ "$BACKUP_FILE" == s3://* ]]; then
  LOCAL_FILE="/tmp/boutinly_restore_$(date +%s).dump"
  echo "Downloading from S3..."
  aws s3 cp "${BACKUP_FILE}/boutinly_crm_"*.dump "$LOCAL_FILE"
  BACKUP_FILE="$LOCAL_FILE"
fi

echo "WARNING: This will overwrite the current database!"
read -p "Type 'RESTORE' to confirm: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Aborted."
  exit 0
fi

echo "Restoring from $BACKUP_FILE..."

# Drop and recreate (runs in a transaction)
pg_restore "$DB_URL" \
  --clean \
  --if-exists \
  --verbose \
  --no-owner \
  --no-acl \
  "$BACKUP_FILE"

echo "Restore complete. Running migrations..."
npm run db:migrate

echo "Database restored and migrated."
```

### Scheduled via cron

```cron
# Daily at 2 AM UTC
0 2 * * * cd /app && bash scripts/backup.sh >> /var/log/backups.log 2>&1
```

## Point-in-Time Recovery (PITR)

Requires PostgreSQL WAL archiving enabled. Add to postgresql.conf:

```
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://${S3_BUCKET}/wal/%f'
```

Then PITR restore:
```bash
pg_restore --target-time="2026-07-31 14:30:00 UTC" db_url backup.dump
```

## Verification Checklist

- [ ] `pg_dump` runs without errors
- [ ] Backup file > 0 bytes
- [ ] S3 upload successful (check bucket)
- [ ] Test restore to staging environment monthly
- [ ] Retention policy configured (S3 lifecycle: 30 days STANDARD_IA, 90 days GLACIER, 365 days DEEP_ARCHIVE)
