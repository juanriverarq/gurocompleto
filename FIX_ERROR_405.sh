#!/bin/bash

# ============================================
# SOLUCIÓN AL ERROR 405 - Method Not Allowed
# ============================================

# El error 405 ocurre porque:
# 1. Las rutas están cacheadas con una versión antigua
# 2. El servidor está usando rutas antiguas que no coinciden con el código actual
# 3. Necesitas limpiar y regenerar la caché de rutas

# ============================================
# SOLUCIÓN RÁPIDA (EJECUTA ESTO EN SSH)
# ============================================

# Navega al directorio del backend:
cd /home/guro/public_html/app.guro.co

# Limpia TODAS las cachés usando PHP 8.3:
/opt/cpanel/ea-php83/root/usr/bin/php artisan route:clear
/opt/cpanel/ea-php83/root/usr/bin/php artisan config:clear
/opt/cpanel/ea-php83/root/usr/bin/php artisan cache:clear
/opt/cpanel/ea-php83/root/usr/bin/php artisan view:clear

# Regenera las cachés:
/opt/cpanel/ea-php83/root/usr/bin/php artisan config:cache
/opt/cpanel/ea-php83/root/usr/bin/php artisan route:cache

# Verifica que las rutas estén correctas:
/opt/cpanel/ea-php83/root/usr/bin/php artisan route:list | grep wallet

# ============================================
# COMANDO TODO EN UNO
# ============================================

cd /home/guro/public_html/app.guro.co && /opt/cpanel/ea-php83/root/usr/bin/php artisan route:clear && /opt/cpanel/ea-php83/root/usr/bin/php artisan config:clear && /opt/cpanel/ea-php83/root/usr/bin/php artisan cache:clear && /opt/cpanel/ea-php83/root/usr/bin/php artisan view:clear && /opt/cpanel/ea-php83/root/usr/bin/php artisan config:cache && /opt/cpanel/ea-php83/root/usr/bin/php artisan route:cache && echo "✅ Cachés limpiadas - Error 405 solucionado"

# ============================================
# SI EL PROBLEMA PERSISTE
# ============================================

# 1. Verifica que el archivo de rutas esté actualizado:
cat routes/api.php | grep wallet

# 2. Verifica los permisos:
chmod -R 775 storage bootstrap/cache

# 3. Elimina manualmente los archivos de caché:
rm -rf bootstrap/cache/*.php
rm -rf storage/framework/cache/*

# 4. Regenera todo:
/opt/cpanel/ea-php83/root/usr/bin/php artisan config:cache
/opt/cpanel/ea-php83/root/usr/bin/php artisan route:cache

# 5. Reinicia PHP-FPM (si tienes acceso):
# En cPanel: MultiPHP Manager > Restart PHP-FPM

# ============================================
# VERIFICACIÓN
# ============================================

# Verifica que la ruta existe:
/opt/cpanel/ea-php83/root/usr/bin/php artisan route:list | grep "saas/wallet/balance"

# Debería mostrar algo como:
# GET|HEAD  api/saas/wallet/balance .... WalletController@balance

# ============================================
# EXPLICACIÓN DEL ERROR
# ============================================

# El error dice:
# "The GET method is not supported for route api/saas/wallet/balance. 
#  Supported methods: OPTIONS."

# Esto significa que:
# 1. La ruta existe pero solo acepta OPTIONS (preflight CORS)
# 2. Las rutas cacheadas no incluyen el método GET
# 3. Necesitas limpiar la caché de rutas

# ============================================
# PREVENCIÓN FUTURA
# ============================================

# Después de cada deploy del backend, SIEMPRE ejecuta:
/opt/cpanel/ea-php83/root/usr/bin/php artisan route:clear
/opt/cpanel/ea-php83/root/usr/bin/php artisan config:clear
/opt/cpanel/ea-php83/root/usr/bin/php artisan route:cache
/opt/cpanel/ea-php83/root/usr/bin/php artisan config:cache

# O mejor aún, NO cachees las rutas en producción si cambias frecuentemente:
# Solo ejecuta:
/opt/cpanel/ea-php83/root/usr/bin/php artisan route:clear
/opt/cpanel/ea-php83/root/usr/bin/php artisan config:cache

# ============================================
# NOTAS IMPORTANTES
# ============================================

# 1. El error 405 es SIEMPRE un problema de caché de rutas
# 2. NUNCA subas archivos cacheados (bootstrap/cache/*.php)
# 3. Siempre limpia la caché después de subir código nuevo
# 4. Si usas Git, agrega a .gitignore:
#    bootstrap/cache/*.php
#    storage/framework/cache/*