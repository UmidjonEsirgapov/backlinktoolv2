#!/bin/sh
set -e

echo "==> [entrypoint] Prisma migratsiyalar ishga tushirilmoqda..."
node /app/node_modules/prisma/build/index.js migrate deploy
echo "==> [entrypoint] Migratsiyalar tugadi."

echo "==> [entrypoint] Ilova ishga tushirilmoqda: $*"
exec "$@"
