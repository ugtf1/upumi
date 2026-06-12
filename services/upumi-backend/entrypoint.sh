#!/bin/sh
set -e

if [ "$SKIP_MIGRATIONS" != "true" ]; then
  echo "Running prisma migrate deploy..."
  npx prisma migrate deploy
else
  echo "SKIP_MIGRATIONS=true, skipping prisma migrate deploy"
fi

echo "Starting app..."
exec "$@"