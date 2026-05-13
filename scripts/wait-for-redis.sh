#!/bin/sh
# wait-for-redis.sh
# Waits for Redis to be ready before starting dependent services

set -e

host="$1"
port="$2"
shift 2
cmd="$@"

until redis-cli -h "$host" -p "$port" ping 2>/dev/null | grep -q "PONG"; do
  echo "Redis is unavailable - sleeping"
  sleep 1
done

echo "Redis is up - executing command"
exec $cmd
