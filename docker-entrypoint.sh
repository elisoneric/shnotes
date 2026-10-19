#!/bin/sh
set -e

echo "[shnotes] applying database migrations…"
node /opt/prisma/node_modules/prisma/build/index.js migrate deploy --schema=/app/prisma/schema.prisma

exec "$@"
