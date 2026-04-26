---
description: Generar ZIPs de producción para deploy en cPanel
---

# Deploy - Generar ZIPs y subir a producción

## 1. Limpiar caché del backend (local)
// turbo
```bash
cd /Users/mac/Documents/GUROFINAL/backend && php artisan config:clear && php artisan route:clear && php artisan view:clear && php artisan cache:clear
```

## 2. Build del frontend
```bash
cd /Users/mac/Documents/GUROFINAL/frontend && npm run build
```

## 3. Generar ZIP del backend
// turbo
```bash
cd /Users/mac/Documents/GUROFINAL && rm -f backend-prod.zip && zip -r backend-prod.zip backend -x "backend/.env" -x "backend/storage/logs/*.log" -x "backend/.git/*" -x "backend/bootstrap/cache/config.php" -x "backend/bootstrap/cache/routes-v7.php"
```

## 4. Generar ZIP del frontend
// turbo
```bash
cd /Users/mac/Documents/GUROFINAL && rm -f frontend-prod.zip && zip -r frontend-prod.zip frontend/dist
```

## 5. Verificar tamaños
// turbo
```bash
ls -lh /Users/mac/Documents/GUROFINAL/backend-prod.zip /Users/mac/Documents/GUROFINAL/frontend-prod.zip
```

## 6. Subir ZIPs al servidor
```bash
scp -i ~/.ssh/guro_deploy /Users/mac/Documents/GUROFINAL/backend-prod.zip /Users/mac/Documents/GUROFINAL/frontend-prod.zip root@178.18.246.209:/tmp/
```

## 7. Desplegar backend en servidor
IMPORTANTE: usar rsync --exclude='public/storage' para no romper el symlink de storage
```bash
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "unzip -o /tmp/backend-prod.zip -d /tmp/backend-extract && rsync -a --exclude='public/storage' /tmp/backend-extract/backend/ /home/guro/public_html/app.guro.co/ && rm -rf /tmp/backend-extract /tmp/backend-prod.zip && chown -R guro:guro /home/guro/public_html/app.guro.co/ && chmod 755 /home/guro/public_html/app.guro.co/ /home/guro/public_html/app.guro.co/public/ && echo 'Backend deployed OK'"
```

## 8. Desplegar frontend en servidor
IMPORTANTE: DocumentRoot de guro.co es /home/guro/public_html/ (NO /home/guro/public_html/guro.co/)
```bash
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "unzip -o /tmp/frontend-prod.zip -d /tmp/frontend-extract && rsync -a --exclude='.htaccess' /tmp/frontend-extract/frontend/dist/ /home/guro/public_html/ && chown -R guro:guro /home/guro/public_html/ && chmod 755 /home/guro/public_html/app.guro.co/public/ && rm -rf /tmp/frontend-extract /tmp/frontend-prod.zip && echo 'Frontend deployed OK'"
```

## 9. Limpiar cachés en servidor (SOLO clear, NUNCA config:cache ni route:cache)
```bash
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "cd /home/guro/public_html/app.guro.co && /opt/cpanel/ea-php83/root/usr/bin/php artisan cache:clear && /opt/cpanel/ea-php83/root/usr/bin/php artisan route:clear && /opt/cpanel/ea-php83/root/usr/bin/php artisan view:clear && /opt/cpanel/ea-php83/root/usr/bin/php artisan config:clear && echo 'Caches cleared OK'"
```

## Notas importantes
- SSH key: `~/.ssh/guro_deploy` para root@178.18.246.209
- PHP en servidor: `/opt/cpanel/ea-php83/root/usr/bin/php` (el `php` default es 8.1, no compatible)
- NUNCA ejecutar `config:cache` ni `route:cache` en producción (causan errores)
- Backend DocumentRoot: `/home/guro/public_html/app.guro.co/`
- Frontend DocumentRoot: `/home/guro/public_html/` (NO guro.co/)
- No sobrescribir `public/storage` (es un symlink) ni `.htaccess` del frontend
- Después de deploy siempre: `chmod 755` en `app.guro.co/` y `app.guro.co/public/` (Apache necesita execute para leer `.htaccess`; permisos 750 en `public/` provocan 403)

---

# Deploy Microservicio HUB (aseguradoras/cotizadores)

URL pública: **https://hub.guro.co** · Requiere **PHP 8.4** (no 8.3) · BD separada: `guro_centralizador` · Usuario: `guro_hubuser`

Arquitectura:
- **Laravel 13 API** en `/home/guro/public_html/hub.guro.co/` (docroot apunta a `public/`)
- **Frontend React SPA** compilado dentro de `/home/guro/public_html/hub.guro.co/public/` (convive con `index.php` de Laravel vía `.htaccess`)
- **Scraper Node + Playwright** en `/opt/guro-hub/scraper/` gestionado por **PM2** (nombre: `guro-hub-scraper`, puerto interno 3500)

## HUB 1. Build frontend del hub
```bash
cd /Users/mac/Documents/GUROFINAL/hub/frontend && npm run build
```

## HUB 2. Limpiar cachés del backend hub (local)
// turbo
```bash
cd /Users/mac/Documents/GUROFINAL/hub/backend && php artisan config:clear && php artisan route:clear && php artisan view:clear && php artisan cache:clear 2>/dev/null || true
```

## HUB 3. Generar ZIPs (backend + frontend + scraper)
// turbo
```bash
cd /Users/mac/Documents/GUROFINAL && rm -f hub-backend.zip hub-scraper.zip hub-frontend.zip && zip -rq hub-backend.zip hub/backend -x "hub/backend/.env" "hub/backend/vendor/*" "hub/backend/node_modules/*" "hub/backend/storage/logs/*" "hub/backend/storage/framework/cache/*" "hub/backend/storage/framework/sessions/*" "hub/backend/storage/framework/views/*" "hub/backend/bootstrap/cache/*.php" && zip -rq hub-scraper.zip hub/scraper -x "hub/scraper/node_modules/*" && zip -rq hub-frontend.zip hub/frontend/dist && ls -lh hub-*.zip
```

## HUB 4. Subir ZIPs al servidor
```bash
scp -i ~/.ssh/guro_deploy /Users/mac/Documents/GUROFINAL/hub-backend.zip /Users/mac/Documents/GUROFINAL/hub-scraper.zip /Users/mac/Documents/GUROFINAL/hub-frontend.zip root@178.18.246.209:/tmp/
```

## HUB 5. Desplegar backend Laravel del hub
Preserva `.env`, `vendor/`, `storage/` y `public/storage` (symlink). El `.htaccess` custom también se preserva.
```bash
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "unzip -qo /tmp/hub-backend.zip -d /tmp/hub-extract && rsync -a --exclude='.env' --exclude='vendor/' --exclude='storage/' --exclude='public/storage' --exclude='public/.htaccess' /tmp/hub-extract/hub/backend/ /home/guro/public_html/hub.guro.co/ && chown -R guro:guro /home/guro/public_html/hub.guro.co && chmod 755 /home/guro/public_html/hub.guro.co /home/guro/public_html/hub.guro.co/public && echo 'Hub backend deployed OK'"
```

## HUB 6. Desplegar frontend del hub
```bash
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "unzip -qo /tmp/hub-frontend.zip -d /tmp/hub-extract && rsync -a --exclude='.htaccess' /tmp/hub-extract/hub/frontend/dist/ /home/guro/public_html/hub.guro.co/public/ && chown -R guro:guro /home/guro/public_html/hub.guro.co/public && echo 'Hub frontend deployed OK'"
```

## HUB 7. Desplegar scraper Node (si cambió)
```bash
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "unzip -qo /tmp/hub-scraper.zip -d /tmp/hub-extract && rsync -a --exclude='node_modules/' /tmp/hub-extract/hub/scraper/ /opt/guro-hub/scraper/ && cd /opt/guro-hub/scraper && npm install --omit=dev 2>&1 | tail -3 && pm2 restart guro-hub-scraper --update-env && echo 'Scraper deployed OK'"
```

## HUB 8. Composer install + migrations (solo si cambiaron deps o migrations)
```bash
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "cd /home/guro/public_html/hub.guro.co && /opt/cpanel/ea-php84/root/usr/bin/php -d memory_limit=512M /usr/local/bin/composer install --no-dev --optimize-autoloader --no-interaction 2>&1 | tail -5 && /opt/cpanel/ea-php84/root/usr/bin/php artisan migrate --force 2>&1 | tail -10"
```

## HUB 9. Limpiar cachés en servidor + cleanup temp
```bash
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "cd /home/guro/public_html/hub.guro.co && /opt/cpanel/ea-php84/root/usr/bin/php artisan cache:clear && /opt/cpanel/ea-php84/root/usr/bin/php artisan config:clear && /opt/cpanel/ea-php84/root/usr/bin/php artisan route:clear && /opt/cpanel/ea-php84/root/usr/bin/php artisan view:clear && rm -rf /tmp/hub-extract /tmp/hub-backend.zip /tmp/hub-frontend.zip /tmp/hub-scraper.zip && echo 'Hub caches cleared OK'"
```

## HUB 10. Verificar despliegue
```bash
curl -sI https://hub.guro.co/ | head -3 && curl -s https://hub.guro.co/api/connectors | head -c 200 && echo "" && ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "pm2 list | grep guro-hub-scraper"
```

## Notas importantes del HUB
- **PHP para el hub es 8.4**: `/opt/cpanel/ea-php84/root/usr/bin/php` (Laravel 13 requiere 8.4, no 8.3)
- **Composer para hub**: `/opt/cpanel/ea-php84/root/usr/bin/php /usr/local/bin/composer ...`
- **DocumentRoot**: `/home/guro/public_html/hub.guro.co/public/` (patrón Laravel — docroot ya configurado en `/var/cpanel/userdata/guro/hub.guro.co`)
- **BD**: `guro_centralizador` / user `guro_hubuser` (credencial en `.env` del hub, NO en repo)
- **Scraper PM2**: si cambian env vars, usar `pm2 restart guro-hub-scraper --update-env` (variables: `PORT=3500 BACKEND_URL=https://hub.guro.co/api`)
- **Playwright Chromium**: ya instalado en `/root/.cache/ms-playwright/` (NO re-instalar salvo que Playwright suba versión)
- **.htaccess del hub**: custom, NO sobrescribir. Enruta `/api /sanctum /storage` → `index.php` (Laravel) y resto → `index.html` (SPA)
- **Primera vez**: ver memoria `Guro Hub Microservice Production Deploy` para setup inicial (crear subdominio + BD + instalar PHP 8.4 + deps de Playwright)

---

# Deploy Microservicio Aseguradoras (FastAPI + Playwright)

Microservicio **diferente** del HUB — es el que usa `app.guro.co` (Laravel) para conectarse con aseguradoras en tiempo real.

Ubicación local: **`~/Documents/microservicio/`** (NO está dentro de GUROFINAL)
Ubicación en servidor: `/opt/guro-microservicio/`
Puerto: **8002** (interno, accedido por app.guro.co vía `MICROSERVICIO_API_URL=http://127.0.0.1:8002`)
Rutas: `/sura/login`, `/hdi/login`, `/bolivar/login`, `/axa/login`, `/estado/login`, `/equidad/login` + `/cotizador/*`
Stack: FastAPI + uvicorn + Playwright (Python) + Chrome (canal real, no Chromium headless)
Proceso: PM2 `guro-microservicio` con **1 worker** (Playwright no soporta fork de workers)

## MS 1. Preparar ZIP (excluir sessions/ y carpetas pesadas)
// turbo
```bash
cd ~/Documents/microservicio && rm -f /tmp/guro-microservicio.zip && zip -rq /tmp/guro-microservicio.zip app.py session_store.py sura_cookie_parse.py requirements.txt routers cotizadores static -x "*/__pycache__/*" "*.pyc" && ls -lh /tmp/guro-microservicio.zip
```

## MS 2. Subir y desplegar código (preservando sessions/ existentes)
```bash
scp -i ~/.ssh/guro_deploy /tmp/guro-microservicio.zip root@178.18.246.209:/tmp/ && ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "unzip -qo /tmp/guro-microservicio.zip -d /opt/guro-microservicio && rm -f /tmp/guro-microservicio.zip && echo 'Microservicio deployed OK'"
```

## MS 3. Instalar/actualizar dependencias Python (si requirements.txt cambió)
```bash
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "cd /opt/guro-microservicio && source .venv/bin/activate && pip install -r requirements.txt lxml 2>&1 | tail -5"
```

## MS 4. Reiniciar con PM2
```bash
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "pm2 restart guro-microservicio 2>&1 | tail -3 && sleep 3 && curl -s http://127.0.0.1:8002/openapi.json -o /dev/null -w 'HTTP %{http_code}\n'"
```

## MS 5. Verificar logs del microservicio
```bash
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "pm2 logs guro-microservicio --lines 30 --nostream 2>&1 | tail -30"
```

## Notas importantes del microservicio Aseguradoras
- **PM2 name:** `guro-microservicio` (NO confundir con `guro-hub-scraper`)
- **Arranque inicial** (primera vez en servidor nuevo):
  ```bash
  cd /opt/guro-microservicio && python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt lxml && playwright install chromium
  # Chrome real (requerido por SURA con channel='chrome'):
  # Ver memoria 'Microservicio Aseguradoras Deploy' para yum install de Google Chrome + symlink
  pm2 start .venv/bin/uvicorn --name guro-microservicio --interpreter none -- app:app --host 127.0.0.1 --port 8002 --workers 1
  pm2 save
  ```
- **Workers debe ser 1** (Playwright singleton no soporta fork de workers uvicorn)
- **Chrome real** en `/usr/bin/google-chrome` con symlink a `/opt/google/chrome/chrome` (SURA usa `channel='chrome'`)
- **sessions/** y **captures/** son datos persistentes locales del servidor (no sobrescribir en deploy)
- **Relación con app.guro.co:** El backend Laravel lo consume vía `MICROSERVICIO_API_URL=http://127.0.0.1:8002` en `.env` (ya configurado en producción)
- **NO requiere** ningún subdominio ni docroot — es solo interno en `127.0.0.1:8002`