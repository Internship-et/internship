#!/bin/sh
# wait-for-postgres.sh
# Waits for PostgreSQL to be ready before starting dependent services

set -e

host="$1"
port="$2"
user="$3"
db="$4"
shift 4
cmd="$@"

until PGPASSWORD="internship_dev" psql -h "$host" -p "$port" -U "$user" -d "$db" -c '\q' 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is up - executing command"
exec $cmd
