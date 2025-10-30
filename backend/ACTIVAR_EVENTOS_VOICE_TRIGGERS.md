# 🔔 Guía para Activar Eventos de Voice Campaign Triggers

## 📋 Resumen

Para que los disparadores (triggers) funcionen automáticamente, necesitas activar los eventos en los modelos correspondientes. Esto hará que cuando se cree un Cliente, Póliza, Lead o Siniestro, se dispare automáticamente el listener correspondiente.

## ✅ Archivos Ya Creados

### Events
- ✅ `app/Events/ClienteCreated.php`
- ✅ `app/Events/PolizaCreated.php`
- ✅ `app/Events/LeadCreated.php`
- ✅ `app/Events/SiniestroCreated.php`

### Listeners
- ✅ `app/Listeners/ClienteCreatedListener.php`
- ✅ `app/Listeners/PolizaCreatedListener.php`
- ✅ `app/Listeners/LeadCreatedListener.php`
- ✅ `app/Listeners/SiniestroCreatedListener.php`

### Providers
- ✅ `app/Providers/EventServiceProvider.php` (registra todos los eventos)
- ✅ `bootstrap/providers.php` (incluye EventServiceProvider)

### Commands
- ✅ `app/Console/Commands/ProcessPolicyExpiryTriggers.php`

### Scheduler
- ✅ `routes/console.php` (job diario a las 06:00 AM)

## 🔧 Pasos para Activar

### 1. Activar Evento en Modelo Cliente

**Archivo**: `backend/app/Models/Cliente.php`

Agregar al inicio de la clase:

```php
use App\Events\ClienteCreated;

class Cliente extends Model
{
    // ... código existente ...

    /**
     * The event map for the model.
     *
     * @var array
     */
    protected $dispatchesEvents = [
        'created' => ClienteCreated::class,
    ];
}
```

### 2. Activar Evento en Modelo Poliza

**Archivo**: `backend/app/Models/Poliza.php`

```php
use App\Events\PolizaCreated;

class Poliza extends Model
{
    // ... código existente ...

    protected $dispatchesEvents = [
        'created' => PolizaCreated::class,
    ];
}
```

### 3. Activar Evento en Modelo Lead

**Archivo**: `backend/app/Models/Lead.php`

```php
use App\Events\LeadCreated;

class Lead extends Model
{
    // ... código existente ...

    protected $dispatchesEvents = [
        'created' => LeadCreated::class,
    ];
}
```

### 4. Activar Evento en Modelo Siniestro

**Archivo**: `backend/app/Models/Siniestro.php`

```php
use App\Events\SiniestroCreated;

class Siniestro extends Model
{
    // ... código existente ...

    protected $dispatchesEvents = [
        'created' => SiniestroCreated::class,
    ];
}
```

## 🧪 Probar el Sistema

### Prueba Manual de Eventos

```bash
# En tinker
php artisan tinker

# Crear un cliente de prueba (disparará el evento)
$cliente = new App\Models\Cliente();
$cliente->broker_id = 1;
$cliente->nombre = 'Test';
$cliente->apellidos = 'Trigger';
$cliente->celular_principal = '+573001234567';
$cliente->email_principal = 'test@example.com';
$cliente->save();

# Verificar en logs
tail -f storage/logs/laravel.log
```

### Prueba del Job de Vencimientos

```bash
# Modo dry-run (simula sin ejecutar)
php artisan voice-campaigns:process-policy-expiry --dry-run

# Ejecución real
php artisan voice-campaigns:process-policy-expiry

# Con opciones
php artisan voice-campaigns:process-policy-expiry --days-range=30 --broker-id=1
```

### Verificar Logs de Triggers

```sql
-- Ver últimos triggers procesados
SELECT 
    t.type,
    t.result,
    t.reason,
    t.entity_type,
    t.entity_id,
    t.fired_at,
    c.recipient_phone
FROM voice_campaign_trigger_logs t
LEFT JOIN voice_campaign_calls c ON c.id = t.voice_campaign_call_id
ORDER BY t.fired_at DESC
LIMIT 20;

-- Estadísticas por resultado
SELECT 
    result,
    COUNT(*) as total,
    DATE(fired_at) as date
FROM voice_campaign_trigger_logs
GROUP BY result, DATE(fired_at)
ORDER BY date DESC, total DESC;
```

## 📊 Monitoreo del Sistema

### Verificar que el Scheduler está Corriendo

```bash
# Ver tareas programadas
php artisan schedule:list

# Ejecutar manualmente el scheduler (para testing)
php artisan schedule:run

# Ver logs del scheduler
tail -f storage/logs/voice-campaign-triggers.log
```

### Verificar Queue Workers (si usas colas)

Los listeners implementan `ShouldQueue`, por lo que se ejecutan en background:

```bash
# Iniciar worker
php artisan queue:work --queue=default --tries=3

# Ver jobs fallidos
php artisan queue:failed

# Reintentar jobs fallidos
php artisan queue:retry all
```

## ⚠️ Consideraciones Importantes

### 1. Cron Job Requerido

Para que el scheduler funcione, necesitas un cron job en el servidor:

```bash
* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1
```

### 2. Queue Workers en Producción

En producción, usa Supervisor para mantener los workers corriendo:

```ini
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/backend/artisan queue:work --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/path/to/backend/storage/logs/worker.log
stopwaitsecs=3600
```

### 3. Performance

Los listeners se ejecutan en cola (background) para no bloquear la creación de registros:

- ✅ Creación de Cliente: rápida (no espera al trigger)
- ✅ Trigger se procesa en background
- ✅ Si falla, se reintenta automáticamente

### 4. Debugging

Si los triggers no se disparan:

```bash
# 1. Verificar que los eventos están registrados
php artisan event:list

# 2. Verificar logs
tail -f storage/logs/laravel.log | grep -i trigger

# 3. Verificar que hay triggers activos
SELECT * FROM voice_campaign_triggers WHERE enabled = 1;

# 4. Ejecutar listener manualmente (testing)
php artisan tinker
>>> event(new App\Events\ClienteCreated(App\Models\Cliente::first()));
```

## 🎯 Flujo Completo de Ejemplo

### Escenario: Bienvenida Automática a Nuevos Clientes

1. **Configurar campaña con trigger**:
   - Dashboard → Nueva Campaña
   - Agente: Bienvenida
   - Voz: Marcela
   - Herramientas → Disparadores:
     - ✓ Nuevo Cliente
     - Ventana: 10:00-16:00, lun-sáb
     - Cupo: 50/día
   - Guardar y Activar Disparadores

2. **Sistema queda esperando**:
   - Campaña en estado: `draft`
   - Trigger activo: `enabled = 1`
   - Esperando evento: `new_client`

3. **Se registra un nuevo cliente**:
   ```php
   $cliente = Cliente::create([
       'broker_id' => 1,
       'nombre' => 'Juan',
       'apellidos' => 'Pérez',
       'celular_principal' => '+573001234567',
       // ...
   ]);
   ```

4. **Evento se dispara automáticamente**:
   - Laravel dispara: `ClienteCreated`
   - Listener captura: `ClienteCreatedListener`
   - Procesa: `VoiceCampaignTriggerProcessor::processEvent()`

5. **Evaluación del trigger**:
   - ✓ ¿Está en ventana horaria? (10:00-16:00, lun-sáb)
   - ✓ ¿Hay cupo disponible hoy? (< 50 llamadas)
   - ✓ ¿No se llamó recientemente? (dedup)
   - ✓ ¿Cumple filtros? (si hay)
   
6. **Si cumple → Llamada automática**:
   - Crea `VoiceCampaignCall`
   - Llama a ElevenLabs API
   - Registra en `voice_campaign_trigger_logs`
   - Cliente recibe llamada de bienvenida

7. **Resultado registrado**:
   ```sql
   INSERT INTO voice_campaign_trigger_logs (
       trigger_id, 
       entity_type, 
       entity_id, 
       result, 
       fired_at
   ) VALUES (
       1, 
       'Cliente', 
       123, 
       'fired', 
       NOW()
   );
   ```

## 🚀 Comandos Útiles

```bash
# Listar todos los comandos disponibles
php artisan list

# Ver ayuda del comando de triggers
php artisan voice-campaigns:process-policy-expiry --help

# Ejecutar en modo dry-run (simular)
php artisan voice-campaigns:process-policy-expiry --dry-run

# Procesar solo un broker
php artisan voice-campaigns:process-policy-expiry --broker-id=1

# Ver eventos registrados
php artisan event:list

# Limpiar caché de eventos
php artisan event:clear
php artisan cache:clear
php artisan config:clear
```

## 📝 Checklist de Activación

- [ ] Agregar `protected $dispatchesEvents` en Cliente.php
- [ ] Agregar `protected $dispatchesEvents` en Poliza.php
- [ ] Agregar `protected $dispatchesEvents` en Lead.php
- [ ] Agregar `protected $dispatchesEvents` en Siniestro.php
- [ ] Verificar que EventServiceProvider está en bootstrap/providers.php ✅
- [ ] Configurar cron job para `php artisan schedule:run`
- [ ] Iniciar queue workers: `php artisan queue:work`
- [ ] Probar creando un registro de prueba
- [ ] Verificar logs en `storage/logs/laravel.log`
- [ ] Verificar registros en `voice_campaign_trigger_logs`

## 🎓 Mejores Prácticas

1. **Empezar con dry-run**: Siempre probar primero con `--dry-run`
2. **Monitorear logs**: Revisar `storage/logs/voice-campaign-triggers.log` diariamente
3. **Ajustar horarios**: El job corre a las 06:00 AM, ajusta según necesidad
4. **Cupos conservadores**: Empezar con límites bajos y aumentar gradualmente
5. **Testing en staging**: Probar con datos reales antes de producción

---

**Última actualización**: 19 de Octubre, 2025
**Versión**: 1.0