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
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "unzip -o /tmp/backend-prod.zip -d /tmp/backend-extract && rsync -a --exclude='public/storage' /tmp/backend-extract/backend/ /home/guro/public_html/app.guro.co/ && rm -rf /tmp/backend-extract /tmp/backend-prod.zip && chown -R guro:guro /home/guro/public_html/app.guro.co/ && chmod 755 /home/guro/public_html/app.guro.co/ && echo 'Backend deployed OK'"
```

## 8. Desplegar frontend en servidor
IMPORTANTE: DocumentRoot de guro.co es /home/guro/public_html/ (NO /home/guro/public_html/guro.co/)
```bash
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 "unzip -o /tmp/frontend-prod.zip -d /tmp/frontend-extract && rsync -a --exclude='.htaccess' /tmp/frontend-extract/frontend/dist/ /home/guro/public_html/ && chown -R guro:guro /home/guro/public_html/ && rm -rf /tmp/frontend-extract /tmp/frontend-prod.zip && echo 'Frontend deployed OK'"
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
- Después de deploy siempre: `chmod 755 /home/guro/public_html/app.guro.co/`