<?php

/**
 * Script para actualizar la configuración de locale a español
 * Ejecutar: php update_locale.php
 */

echo "Actualizando configuración de locale a español...\n";

$envFile = '.env';
if (!file_exists($envFile)) {
    echo "Error: No se encuentra el archivo .env\n";
    exit(1);
}

$content = file_get_contents($envFile);

// Reemplazar las configuraciones de locale
$patterns = [
    '/^APP_LOCALE=.*$/m',
    '/^APP_FALLBACK_LOCALE=.*$/m', 
    '/^APP_FAKER_LOCALE=.*$/m'
];

$replacements = [
    'APP_LOCALE=es',
    'APP_FALLBACK_LOCALE=es',
    'APP_FAKER_LOCALE=es_CO'
];

$content = preg_replace($patterns, $replacements, $content);

if (file_put_contents($envFile, $content)) {
    echo "¡Configuración de locale actualizada exitosamente!\n";
    echo "Se han configurado:\n";
    echo "- APP_LOCALE=es\n";
    echo "- APP_FALLBACK_LOCALE=es\n";
    echo "- APP_FAKER_LOCALE=es_CO\n\n";
    echo "Los mensajes de validación ahora estarán en español.\n";
    echo "Reinicia el servidor de Laravel para aplicar los cambios.\n";
} else {
    echo "Error: No se pudo actualizar el archivo .env\n";
    exit(1);
}
