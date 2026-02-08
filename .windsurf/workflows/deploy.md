---
description: Generar ZIPs de producción para deploy en cPanel
---

# Deploy - Generar ZIPs de Producción

## 1. Limpiar caché del backend
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

## Ubicación de los ZIPs generados
```
/Users/mac/Documents/GUROFINAL/
├── backend-prod.zip   (~89 MB)
└── frontend-prod.zip  (~38 MB)
```

## Post-deploy en cPanel (ejecutar en servidor)
```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan migrate --force
```
