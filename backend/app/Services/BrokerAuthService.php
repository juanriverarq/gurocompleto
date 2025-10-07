<?php

namespace App\Services;

use App\Models\User;
use App\Models\Broker;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class BrokerAuthService
{
    // Evitar estado estático compartido entre requests.
    // Mantener contexto vía contenedor (app()) por request.
    protected static $currentBroker = null;
    protected static $currentUser = null;

    /**
     * Obtener el broker del usuario autenticado
     */
    public function getUserBroker(User $user): ?Broker
    {
        try {
            // Primero intentar obtener desde caché
            $cacheKey = "user_broker_{$user->id}";
            $broker = Cache::remember($cacheKey, 300, function () use ($user) {
                return $user->getPrimaryBroker();
            });

            return $broker;
        } catch (\Exception $e) {
            Log::error('Error obteniendo broker del usuario', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Verificar si un broker está activo
     */
    public function isBrokerActive(Broker $broker): bool
    {
        if ($broker->status === 'trial') {
            return !$broker->isTrialExpired();
        }
        return $broker->status === 'active';
    }

    /**
     * Establecer el broker en el contexto global
     */
    public function setBrokerContext(Broker $broker): void
    {
        // Establecer solo en el contenedor de la aplicación (request scoped)
        app()->instance('current_broker', $broker);
    }

    /**
     * Obtener el broker del contexto actual
     */
    public static function getCurrentBroker(): ?Broker
    {
        try {
            return app()->has('current_broker') ? app('current_broker') : null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Obtener el ID del broker actual
     */
    public static function getCurrentBrokerId(): ?int
    {
        $broker = static::getCurrentBroker();
        return $broker ? $broker->id : null;
    }

    /**
     * Limpiar el contexto actual
     */
    public static function clearContext(): void
    {
        // Limpiar instancias de request si existen
        try {
            if (app()->has('current_broker')) {
                app()->forgetInstance('current_broker');
            }
        } catch (\Throwable $e) {
        }
    }

    /**
     * Obtener información completa del contexto actual
     */
    public function getCurrentContext(): array
    {
        $broker = static::getCurrentBroker();
        
        return [
            'broker_id' => $broker ? $broker->id : null,
            'broker' => $broker ? [
                'id' => $broker->id,
                'name' => $broker->name,
                'legal_name' => $broker->legal_name,
                'status' => $broker->status,
                'plan' => $broker->plan,
                'logo_url' => $broker->logo_url,
                'branding' => [
                    'primary_color' => $broker->primary_color ?? '#635BFF',
                    'secondary_color' => $broker->secondary_color ?? '#16CDC7',
                    'accent_color' => $broker->accent_color ?? '#36c96c',
                    'logo_url' => $broker->logo_url
                ]
            ] : null,
            'is_authenticated' => $broker !== null,
            'needs_onboarding' => $broker === null
        ];
    }

    /**
     * Validar permisos del usuario en el broker actual
     */
    public function hasPermission(User $user, string $permission): bool
    {
        // Si es MASTER del broker, tiene todos los permisos
        if ($user->user_type === 'MASTER') {
            return true;
        }

        // Verificar permisos específicos del usuario
        $permissions = $user->permissions ?? [];
        return in_array($permission, $permissions);
    }

    /**
     * Obtener el scope de base de datos para filtrar por broker
     */
    public function getBrokerScope(): array
    {
        $brokerId = static::getCurrentBrokerId();
        
        if (!$brokerId) {
            throw new \Exception('No hay broker en el contexto actual');
        }

        return ['broker_id' => $brokerId];
    }

    /**
     * Aplicar filtro de broker a una query
     */
    public function applyBrokerFilter($query)
    {
        $brokerId = static::getCurrentBrokerId();
        
        if (!$brokerId) {
            throw new \Exception('No hay broker en el contexto actual');
        }

        return $query->where('broker_id', $brokerId);
    }

    /**
     * Crear registro con broker_id automático
     */
    public function createWithBroker(array $data): array
    {
        $brokerId = static::getCurrentBrokerId();
        
        if (!$brokerId) {
            throw new \Exception('No hay broker en el contexto actual');
        }

        $data['broker_id'] = $brokerId;
        return $data;
    }

    /**
     * Validar que un recurso pertenece al broker actual
     */
    public function validateBrokerOwnership($model): bool
    {
        $currentBrokerId = static::getCurrentBrokerId();
        
        if (!$currentBrokerId) {
            return false;
        }

        if (!property_exists($model, 'broker_id') && !isset($model->broker_id)) {
            return false;
        }

        return $model->broker_id == $currentBrokerId;
    }

    /**
     * Obtener configuración de branding del broker actual
     */
    public function getBrokerBranding(): array
    {
        $broker = static::getCurrentBroker();
        
        if (!$broker) {
            return $this->getDefaultBranding();
        }

        return [
            'logo_url' => $broker->logo_url,
            'primary_color' => $broker->primary_color ?? '#635BFF',
            'secondary_color' => $broker->secondary_color ?? '#16CDC7',
            'accent_color' => $broker->accent_color ?? '#36c96c',
            'company_name' => $broker->name,
            'legal_name' => $broker->legal_name,
            'favicon_url' => $broker->favicon_url
        ];
    }

    /**
     * Obtener branding por defecto
     */
    private function getDefaultBranding(): array
    {
        return [
            'logo_url' => null,
            'primary_color' => '#635BFF',
            'secondary_color' => '#16CDC7',
            'accent_color' => '#36c96c',
            'company_name' => 'GURO',
            'legal_name' => 'GURO Insurance Platform',
            'favicon_url' => null
        ];
    }
}
