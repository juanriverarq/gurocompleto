# Reconexión Automática de WhatsApp

## Descripción

Esta solución permite que las instancias de WhatsApp se reconecten automáticamente cuando el microservicio se reinicia, **sin necesidad de borrar datos ni escanear QR nuevamente**.

## Arquitectura

```
┌─────────────────┐         ┌──────────────────────┐
│   Laravel       │◄───────►│  Microservicio       │
│   Backend       │         │  WhatsApp (Baileys)  │
│                 │         │                      │
│  - BD instancias│         │  - Sesiones en disco │
│  - Webhooks     │         │  - Reconexión auto   │
└─────────────────┘         └──────────────────────┘
```

## Métodos de Reconexión

### 1. Comando Artisan (Recomendado)

Ejecutar después de reiniciar el microservicio:

```bash
# Sincronizar todas las instancias
php artisan whatsapp:sync-instances

# Solo instancias que estaban conectadas
php artisan whatsapp:sync-instances --only-connected

# Esperar 10 segundos antes de intentar (útil si el microservicio está iniciando)
php artisan whatsapp:sync-instances --wait-for-microservice=10

# Forzar recreación de todas las instancias
php artisan whatsapp:sync-instances --force

# Verificar si el microservicio está activo
php artisan whatsapp:sync-instances --check-microservice
```

### 2. Script de Shell

```bash
# Desde el directorio backend
./scripts/whatsapp-reconnect.sh

# Con opciones
./scripts/whatsapp-reconnect.sh --wait 10 --only-connected
```

### 3. Endpoints de Webhook (Para el Microservicio)

El microservicio puede llamar estos endpoints al iniciar:

#### GET `/api/webhooks/whatsapp-sync`
Obtiene lista de instancias que deben restaurarse.

**Response:**
```json
{
  "success": true,
  "instances": [
    {
      "instanceId": "broker_1_main",
      "brokerId": 1,
      "phoneNumber": "+573001234567",
      "status": "connected",
      "webhookUrl": "https://api.guro.co/api/webhooks/whatsapp-message",
      "settings": {},
      "lastConnectedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1,
  "timestamp": "2024-01-15T12:00:00Z"
}
```

#### POST `/api/webhooks/whatsapp-startup`
Notifica al backend que el microservicio ha iniciado. El backend intentará re-registrar todas las instancias conectadas.

**Request:**
```json
{
  "timestamp": "2024-01-15T12:00:00Z",
  "version": "1.0.0"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Startup procesado",
  "instances_to_reconnect": 3,
  "results": [
    {
      "instance_id": "broker_1_main",
      "status": "reconnecting",
      "success": true
    }
  ]
}
```

## Flujo de Reconexión

1. **Microservicio se reinicia** → Pierde instancias en memoria
2. **Backend detecta desconexión** (vía webhook o polling)
3. **Ejecutar sincronización**:
   - Opción A: Comando artisan manual
   - Opción B: Microservicio llama `/api/webhooks/whatsapp-startup`
   - Opción C: Cron job periódico
4. **Backend re-registra instancias** en el microservicio
5. **Microservicio carga sesiones** desde disco (si existen)
6. **Instancias reconectadas** automáticamente

## Configuración Recomendada

### Cron Job (Opcional)

Para verificación periódica, agregar en `app/Console/Kernel.php`:

```php
protected function schedule(Schedule $schedule)
{
    // Verificar y sincronizar cada 5 minutos
    $schedule->command('whatsapp:sync-instances --only-connected')
             ->everyFiveMinutes()
             ->withoutOverlapping();
}
```

### Variables de Entorno

```env
WHATSAPP_SERVICE_URL=http://127.0.0.1:3000
```

## Notas Importantes

1. **No se modifica el microservicio**: Toda la lógica está en Laravel
2. **Sesiones persistentes**: El microservicio debe guardar sesiones en disco (configuración de Baileys)
3. **Sin pérdida de datos**: Las instancias mantienen su configuración y estado
4. **Idempotente**: Ejecutar múltiples veces no causa problemas

## Troubleshooting

### El microservicio no responde
```bash
php artisan whatsapp:sync-instances --check-microservice
```

### Instancia no reconecta
1. Verificar que la sesión existe en el microservicio
2. Revisar logs: `storage/logs/laravel.log`
3. Forzar recreación: `php artisan whatsapp:sync-instances --force`

### Múltiples instancias con error
```bash
# Ver estado de todas las instancias
php artisan tinker
>>> WhatsAppInstance::pluck('status', 'instance_id')
```
