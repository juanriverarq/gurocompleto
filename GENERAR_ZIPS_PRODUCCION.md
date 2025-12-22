# 📦 Generación de ZIPs para Producción (cPanel)

## ⚠️ IMPORTANTE

**NO cachear configuración localmente** - La caché guarda valores del `.env` local y causa errores de CORS en producción. La caché se debe generar EN EL SERVIDOR después de subir.

---

## Requisitos Previos

### Backend (Laravel) - LIMPIAR caché antes de generar ZIP
```bash
cd /Users/mac/Documents/GUROFINAL/backend

# Ejecutar migraciones pendientes
php artisan migrate --force

# LIMPIAR caché (NO cachear - se hace en producción)
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan cache:clear
```

### Frontend (React/Vite)
```bash
cd /Users/mac/Documents/GUROFINAL/frontend

# Generar build de producción
npm run build
```

---

## Generar ZIPs

### 1. Backend (incluye vendor/, excluye .env, logs y caché)
```bash
cd /Users/mac/Documents/GUROFINAL

rm -f backend-prod.zip
zip -r backend-prod.zip backend \
  -x "backend/.env" \
  -x "backend/storage/logs/*.log" \
  -x "backend/.git/*" \
  -x "backend/bootstrap/cache/config.php" \
  -x "backend/bootstrap/cache/routes-v7.php"
```

### 2. Frontend (solo carpeta dist/)
```bash
cd /Users/mac/Documents/GUROFINAL

rm -f frontend-prod.zip
zip -r frontend-prod.zip frontend/dist
```

---

## Comando Rápido (Todo en uno)

```bash
cd /Users/mac/Documents/GUROFINAL

# Backend: LIMPIAR caché y generar ZIP
cd backend && \
php artisan config:clear && \
php artisan route:clear && \
php artisan view:clear && \
php artisan cache:clear && \
cd ..

# Frontend: build y generar ZIP
cd frontend && npm run build && cd ..

# Generar ZIPs (sin archivos de caché)
rm -f backend-prod.zip frontend-prod.zip
zip -r backend-prod.zip backend \
  -x "backend/.env" \
  -x "backend/storage/logs/*.log" \
  -x "backend/.git/*" \
  -x "backend/bootstrap/cache/config.php" \
  -x "backend/bootstrap/cache/routes-v7.php"
zip -r frontend-prod.zip frontend/dist

# Verificar tamaños
ls -lh backend-prod.zip frontend-prod.zip
```

---

## Ubicación de los ZIPs

Los archivos se generan en:
```
/Users/mac/Documents/GUROFINAL/
├── backend-prod.zip   (~89 MB)
└── frontend-prod.zip  (~38 MB)
```

---

## Notas para cPanel

### Backend
1. Subir `backend-prod.zip` a la carpeta del API (ej: `app.guro.co`)
2. Extraer el ZIP
3. Mover contenido de `backend/` a la raíz
4. Configurar el archivo `.env` manualmente (ver sección abajo)
5. Verificar permisos de `storage/` (775)
6. **IMPORTANTE:** Ejecutar en Terminal de cPanel:
   ```bash
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   ```

### Frontend
1. Subir `frontend-prod.zip` a la carpeta del frontend (ej: `guro.co`)
2. Extraer el ZIP
3. Mover contenido de `frontend/dist/` a la raíz (`public_html`)
4. Verificar que `.htaccess` esté presente

---

## Configuración .env en Producción

Asegúrate de que el `.env` en el servidor tenga estos valores para evitar errores CORS:

```env
APP_URL=https://app.guro.co
FRONTEND_URL=https://guro.co

SANCTUM_STATEFUL_DOMAINS=guro.co,www.guro.co,app.guro.co
SESSION_DOMAIN=.guro.co
```

---

## Comandos Post-Despliegue (ejecutar en servidor)

Después de subir el backend, ejecutar en Terminal de cPanel:

```bash
# Generar caché con valores de producción
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Ejecutar migraciones si hay nuevas
php artisan migrate --force

# Verificar que todo funcione
php artisan about
```

---

## Limpiar Caché Local (antes de generar ZIP)

```bash
cd /Users/mac/Documents/GUROFINAL/backend

php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

---

*Última actualización: Diciembre 2024*
