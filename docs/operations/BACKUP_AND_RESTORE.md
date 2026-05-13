# BACKUP_AND_RESTORE.md

> **Database backup and restore procedures.**

---

## 1. Backup Strategy

### 1.1 Automated Backups

| Frequency | Type | Retention |
|-----------|------|-----------|
| Daily | Full database dump | 30 days |
| Weekly | Full database dump | 3 months |
| Monthly | Full database dump | 1 year |

### 1.2 Backup Format

- Plain SQL dump (portable across PostgreSQL versions)
- Compressed with gzip
- Encrypted at rest

---

## 2. Creating Backups

### 2.1 Manual Backup

```bash
# Full database dump
pg_dump \
  --host=localhost \
  --port=5432 \
  --username=internship \
  --dbname=internship_prod \
  --no-owner \
  --no-acl \
  --format=custom \
  --file=backup_$(date +%Y%m%d_%H%M%S).dump

# Compressed SQL dump
pg_dump \
  --host=localhost \
  --port=5432 \
  --username=internship \
  --dbname=internship_prod \
  --no-owner \
  --no-acl \
  | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 2.2 Docker Backup

```bash
# Backup from Docker container
docker exec -t internship-postgres \
  pg_dump -U internship internship_prod \
  | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 2.3 Automated Backup Script

A production-ready backup script is available at [`scripts/backup.sh`](../scripts/backup.sh).

**Features:**
- Configurable via environment variables (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, BACKUP_DIR, RETENTION_DAYS)
- Timestamped, gzip-compressed SQL dumps
- Automatic retention cleanup (configurable, default 30 days)
- Success/failure logging to stdout
- Non-zero exit on failure (for cron alerting)
- Secure — uses `PGPASSWORD` environment variable, never passes password on command line

**Usage:**

```bash
# Basic usage (requires PGPASSWORD)
PGPASSWORD=your_password ./scripts/backup.sh

# Custom configuration via environment variables
export PGHOST=prod-db.example.com
export PGPORT=5432
export PGUSER=internship
export PGPASSWORD=your_password
export PGDATABASE=internship_prod
export BACKUP_DIR=/var/backups/postgres
export RETENTION_DAYS=60
./scripts/backup.sh
```

**Automation (cron):**

```bash
# Run daily at 2 AM
0 2 * * * PGPASSWORD=your_password /path/to/scripts/backup.sh >> /var/log/backup.log 2>&1
```

> ⚠️ **Security note:** Never pass `PGPASSWORD` directly in the cron command line.
> Use a dedicated environment file or a secrets manager to supply credentials.

---

## 3. Restoring Backups

### 3.1 Restore to Same Database

```bash
# Restore custom format dump
pg_restore \
  --host=localhost \
  --port=5432 \
  --username=internship \
  --dbname=internship_prod \
  --clean \
  --no-owner \
  --no-acl \
  backup_20240101_120000.dump
```

### 3.2 Restore from Compressed SQL

```bash
# Decompress and restore
gunzip -c backup_20240101_120000.sql.gz | \
  psql -h localhost -U internship -d internship_prod
```

### 3.3 Restore to Docker

```bash
# Copy backup to container
docker cp backup_20240101_120000.sql.gz internship-postgres:/tmp/

# Restore inside container
docker exec -t internship-postgres \
  sh -c "gunzip -c /tmp/backup_20240101_120000.sql.gz | psql -U internship internship_prod"
```

---

## 4. Restoration Testing

- Backups are tested monthly by restoring to a staging environment
- Test includes: data integrity check, application smoke tests, application health check
- Restoration time is measured and documented
- The `scripts/backup.sh` script's `pg_dump` output is compatible with all restore methods below

---

## 5. Point-in-Time Recovery (Future)

For production, consider:
- Continuous WAL archiving
- Point-in-time recovery (PITR) capability
- Recovery Time Objective (RTO): 1 hour
- Recovery Point Objective (RPO): 5 minutes

---

## 6. Backup Security

- Backups are encrypted at rest
- Backup files are stored in a separate, access-restricted location
- Backup access is logged and audited
- Backup encryption keys are stored separately

---

## 7. Disaster Recovery

In the event of catastrophic failure:

1. Provision new database server
2. Restore latest backup
3. Verify data integrity
4. Update application connection string
5. Restart application
6. Verify functionality

---

*Backups are your safety net. Test them regularly.*
