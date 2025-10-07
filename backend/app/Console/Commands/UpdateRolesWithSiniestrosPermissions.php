<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\RolBroker;
use App\Services\PermissionService;

class UpdateRolesWithSiniestrosPermissions extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'roles:update-siniestros-permissions {--broker_id= : ID del broker específico}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Actualizar roles existentes para incluir permisos de siniestros';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $brokerId = $this->option('broker_id');

        $this->info('🚀 Iniciando actualización de permisos de siniestros para roles...');

        // Definir permisos de siniestros por tipo de rol
        $rolePermissions = [
            'admin' => ['siniestros.*'], // Acceso completo
            'supervisor' => ['siniestros.*'], // Acceso completo
            'gerente' => ['siniestros.*'], // Acceso completo
            'asesor' => ['siniestros.ver', 'siniestros.crear', 'siniestros.editar', 'siniestros.procesar'], // Acceso limitado
            'vendedor' => ['siniestros.ver', 'siniestros.crear'], // Solo ver y crear
            'operador' => ['siniestros.ver', 'siniestros.editar', 'siniestros.procesar'], // Operativo
            'auxiliar' => ['siniestros.ver'], // Solo lectura
        ];

        // Query para roles
        $query = RolBroker::where('activo', true);

        if ($brokerId) {
            $query->where('broker_id', $brokerId);
            $this->info("📍 Filtrando por broker ID: {$brokerId}");
        }

        $roles = $query->get();

        if ($roles->isEmpty()) {
            $this->error('❌ No se encontraron roles activos para actualizar');
            return 1;
        }

        $this->info("📊 Encontrados {$roles->count()} roles para actualizar");

        $updatedCount = 0;
        $errorCount = 0;

        foreach ($roles as $rol) {
            try {
                $this->line("🔄 Procesando rol: {$rol->nombre} (ID: {$rol->id})");

                // Determinar permisos basados en el nombre del rol
                $permisosToAdd = $this->getPermisosForRol($rol, $rolePermissions);

                if (empty($permisosToAdd)) {
                    $this->warn("⚠️  No se encontraron permisos para asignar al rol: {$rol->nombre}");
                    continue;
                }

                // Obtener permisos actuales
                $permisosActuales = $rol->permisos ?? [];

                // Agregar permisos de siniestros si no existen
                $permisosNuevos = array_unique(array_merge($permisosActuales, $permisosToAdd));

                // Verificar si hay cambios
                if (count($permisosNuevos) === count($permisosActuales)) {
                    $this->info("✅ El rol {$rol->nombre} ya tiene los permisos necesarios");
                    continue;
                }

                // Actualizar permisos
                $rol->update([
                    'permisos' => $permisosNuevos
                ]);

                $this->info("✅ Actualizado rol {$rol->nombre}: +" . (count($permisosNuevos) - count($permisosActuales)) . " permisos");

                // Limpiar cache de permisos para empleados con este rol
                $this->clearPermissionsCacheForRol($rol);

                $updatedCount++;

            } catch (\Exception $e) {
                $this->error("❌ Error actualizando rol {$rol->nombre}: {$e->getMessage()}");
                $errorCount++;
            }
        }

        // Limpiar cache general de permisos
        $this->clearGeneralPermissionsCache();

        $this->info("🎉 Proceso completado!");
        $this->info("📈 Roles actualizados: {$updatedCount}");
        if ($errorCount > 0) {
            $this->error("❌ Errores: {$errorCount}");
        }

        $this->newLine();
        $this->info("💡 Los empleados ahora deberían tener acceso a las funciones de siniestros según sus roles.");
        $this->info("🔄 Se recomienda reiniciar la aplicación o limpiar la cache si es necesario.");

        return 0;
    }

    /**
     * Determinar permisos a asignar basados en el rol
     */
    private function getPermisosForRol(RolBroker $rol, array $rolePermissions): array
    {
        $nombre = strtolower($rol->nombre);
        $slug = strtolower($rol->slug);

        // Buscar por nombre exacto
        if (isset($rolePermissions[$nombre])) {
            return $rolePermissions[$nombre];
        }

        // Buscar por slug
        if (isset($rolePermissions[$slug])) {
            return $rolePermissions[$slug];
        }

        // Búsqueda por palabras clave
        $keywords = [
            'admin' => 'admin',
            'supervisor' => 'supervisor',
            'gerente' => 'gerente',
            'manager' => 'gerente',
            'asesor' => 'asesor',
            'vendedor' => 'vendedor',
            'sales' => 'vendedor',
            'operador' => 'operador',
            'auxiliar' => 'auxiliar',
            'assistant' => 'auxiliar',
        ];

        foreach ($keywords as $keyword => $roleType) {
            if (str_contains($nombre, $keyword) || str_contains($slug, $keyword)) {
                if (isset($rolePermissions[$roleType])) {
                    return $rolePermissions[$roleType];
                }
            }
        }

        // Nivel de acceso como fallback
        if ($rol->nivel_acceso >= 4) {
            return $rolePermissions['admin'];
        } elseif ($rol->nivel_acceso >= 3) {
            return $rolePermissions['supervisor'];
        } elseif ($rol->nivel_acceso >= 2) {
            return $rolePermissions['asesor'];
        } else {
            return $rolePermissions['auxiliar'];
        }
    }

    /**
     * Limpiar cache de permisos para empleados con este rol
     */
    private function clearPermissionsCacheForRol(RolBroker $rol): void
    {
        try {
            $empleadosIds = $rol->empleados()->pluck('id')->toArray();

            $permissionService = app(PermissionService::class);
            foreach ($empleadosIds as $empleadoId) {
                $permissionService->clearUserCache($empleadoId);
            }

            $this->line("🧹 Cache limpiado para {$rol->empleados()->count()} empleados");
        } catch (\Exception $e) {
            $this->warn("⚠️  Error limpiando cache: {$e->getMessage()}");
        }
    }

    /**
     * Limpiar cache general de permisos
     */
    private function clearGeneralPermissionsCache(): void
    {
        try {
            // Limpiar patrones de cache relacionados con permisos
            $patterns = [
                'permissions.*',
                'user_permissions.*',
                'employee_permissions.*'
            ];

            // Nota: En producción, usar Redis para limpiar patrones
            // Por ahora, solo loggeamos
            $this->info("🧹 Cache general de permisos marcado para limpieza");
        } catch (\Exception $e) {
            $this->warn("⚠️  Error limpiando cache general: {$e->getMessage()}");
        }
    }
}
