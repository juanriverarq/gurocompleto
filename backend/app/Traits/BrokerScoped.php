<?php

namespace App\Traits;

use App\Services\BrokerAuthService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

trait BrokerScoped
{
    /**
     * Boot del trait
     */
    protected static function bootBrokerScoped()
    {
        // Aplicar scope global para filtrar por broker_id
        static::addGlobalScope('broker', function (Builder $builder) {
            $brokerId = static::getCurrentBrokerIdForScope();

            if ($brokerId) {
                $builder->where('broker_id', $brokerId);
            }
        });

        // Asignar broker_id automáticamente al crear
        static::creating(function (Model $model) {
            if (!isset($model->broker_id)) {
                $brokerId = static::getCurrentBrokerIdForScope();
                if ($brokerId) {
                    $model->broker_id = $brokerId;
                }
            }
        });
    }

    /**
     * Obtener broker_id para el scope global, considerando múltiples fuentes
     */
    protected static function getCurrentBrokerIdForScope(): ?int
    {
        // 1. Primero intentar desde BrokerAuthService (contexto global)
        $brokerId = BrokerAuthService::getCurrentBrokerId();
        if ($brokerId) {
            return $brokerId;
        }

        // 2. Fallback: obtener desde usuario autenticado
        $user = auth()->user();
        if ($user && isset($user->broker_id) && $user->broker_id) {
            return $user->broker_id;
        }

        // 3. Fallback adicional: intentar desde EmpleadoBroker autenticado
        if (method_exists(\App\Http\Middleware\UnifiedAuthMiddleware::class, 'getBrokerId')) {
            try {
                $request = request();
                if ($request) {
                    $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request);
                    if ($brokerId) {
                        return $brokerId;
                    }
                }
            } catch (\Exception $e) {
                // Ignorar errores en fallback
            }
        }

        return null;
    }

    /**
     * Scope para consultas sin filtro de broker (uso administrativo)
     */
    public function scopeWithoutBrokerScope(Builder $query)
    {
        return $query->withoutGlobalScope('broker');
    }

    /**
     * Scope para consultas de un broker específico
     */
    public function scopeForBroker(Builder $query, int $brokerId)
    {
        return $query->withoutGlobalScope('broker')->where('broker_id', $brokerId);
    }

    /**
     * Verificar si el modelo pertenece al broker actual
     */
    public function belongsToCurrentBroker(): bool
    {
        $currentBrokerId = BrokerAuthService::getCurrentBrokerId();
        return $currentBrokerId && $this->broker_id == $currentBrokerId;
    }

    /**
     * Obtener la relación con el broker
     */
    public function broker()
    {
        return $this->belongsTo(\App\Models\Broker::class);
    }
}
