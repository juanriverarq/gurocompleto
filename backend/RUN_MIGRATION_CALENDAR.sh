#!/bin/bash

echo "🔄 Ejecutando migración de calendario..."
php artisan migrate --path=database/migrations/2025_01_14_000001_create_calendar_events_table.php

echo "✅ Migración completada"
