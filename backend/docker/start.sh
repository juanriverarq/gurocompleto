#!/usr/bin/env bash
set -euo pipefail

cd /var/www/html

echo "[start] Preparando entorno Laravel..."

# 1) .env
if [[ ! -f .env ]]; then
  if [[ -f env.docker.example ]]; then
    cp env.docker.example .env
    echo "[start] Copiado env.docker.example -> .env"
  elif [[ -f .env.example ]]; then
    cp .env.example .env
    echo "[start] Copiado .env.example -> .env"
  else
    echo "[start] WARNING: No se encontró env.docker.example ni .env.example"
  fi
fi

# 2) Composer install (necesario porque el bind mount sobreescribe vendor)
if [[ ! -d vendor ]]; then
  echo "[start] Ejecutando composer install..."
  composer install --no-interaction --prefer-dist --optimize-autoloader || composer install --no-interaction
fi

# 3) Permisos mínimos
mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache || true
chmod -R 777 storage bootstrap/cache || true

# 4) Generar APP_KEY si falta
if ! grep -qE '^APP_KEY=base64:' .env 2>/dev/null; then
  echo "[start] Generando APP_KEY..."
  php artisan key:generate --force || true
fi

# 5) Esperar a MySQL (usa root/root del servicio db)
echo "[start] Esperando a MySQL en $DB_HOST..."
until mysqladmin ping -h"${DB_HOST:-db}" -uroot -proot --silent; do
  sleep 2
done
echo "[start] MySQL disponible."

# 6) Importar dump SQL si existe y no se ha importado antes
DUMP_PATH="database/Guro.sql"
MARKER="storage/app/.db_import_done"
if [[ -f "$DUMP_PATH" && ! -f "$MARKER" ]]; then
  echo "[start] Importando $DUMP_PATH (puede tardar)..."
  mysql -h"${DB_HOST:-db}" -uroot -proot "${DB_DATABASE:-guro}" < "$DUMP_PATH" || true
  touch "$MARKER"
  echo "[start] Importación de dump completada."
fi

# 7) Migraciones (idempotente)
echo "[start] Ejecutando migraciones..."
php artisan migrate --force || true

# 8) Opcional: php artisan storage:link (si aplica)
php artisan storage:link >/dev/null 2>&1 || true

echo "[start] Arrancando PHP-FPM..."
exec php-fpm


