<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Traits\BrokerScoped;

class CommercialTaskPriorityConfig extends Model
{
    use HasFactory, BrokerScoped;

    protected $fillable = [
        'broker_id',
        'priority_key',
        'label',
        'icon',
        'color',
        'bg_color',
        'text_color',
        'first_notification_minutes',
        'repeat_every_minutes',
        'max_notifications',
        'enabled',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'first_notification_minutes' => 'integer',
        'repeat_every_minutes' => 'integer',
        'max_notifications' => 'integer',
    ];

    /**
     * Obtener o crear configuración por defecto para un broker
     */
    public static function getOrCreateDefaults(int $brokerId): array
    {
        $defaults = [
            'baja' => [
                'label' => 'Baja',
                'icon' => 'solar:flag-bold-duotone',
                'color' => '#6B7280',
                'bg_color' => 'bg-gray-100',
                'text_color' => 'text-gray-800',
                'first_notification_minutes' => 1440, // 24h
                'repeat_every_minutes' => 0,
                'max_notifications' => 1,
            ],
            'media' => [
                'label' => 'Media',
                'icon' => 'solar:flag-2-bold-duotone',
                'color' => '#F59E0B',
                'bg_color' => 'bg-yellow-100',
                'text_color' => 'text-yellow-800',
                'first_notification_minutes' => 720, // 12h
                'repeat_every_minutes' => 1440, // cada 24h
                'max_notifications' => 2,
            ],
            'alta' => [
                'label' => 'Alta',
                'icon' => 'solar:shield-warning-bold-duotone',
                'color' => '#F97316',
                'bg_color' => 'bg-orange-100',
                'text_color' => 'text-orange-800',
                'first_notification_minutes' => 240, // 4h
                'repeat_every_minutes' => 240, // cada 4h
                'max_notifications' => 3,
            ],
            'critica' => [
                'label' => 'Crítica',
                'icon' => 'solar:danger-triangle-bold-duotone',
                'color' => '#EF4444',
                'bg_color' => 'bg-red-100',
                'text_color' => 'text-red-800',
                'first_notification_minutes' => 60, // 1h
                'repeat_every_minutes' => 120, // cada 2h
                'max_notifications' => 5,
            ],
        ];

        $configs = [];
        foreach ($defaults as $key => $data) {
            $config = self::firstOrCreate(
                ['broker_id' => $brokerId, 'priority_key' => $key],
                array_merge($data, ['broker_id' => $brokerId, 'priority_key' => $key])
            );
            $configs[$key] = $config;
        }

        return $configs;
    }

    /**
     * Obtener configuración de prioridad para un broker
     */
    public static function forBroker(int $brokerId): array
    {
        $configs = self::where('broker_id', $brokerId)
            ->where('enabled', true)
            ->get()
            ->keyBy('priority_key')
            ->toArray();

        if (count($configs) < 4) {
            $configs = self::getOrCreateDefaults($brokerId);
            $configs = collect($configs)->map(fn($c) => $c->toArray())->toArray();
        }

        return $configs;
    }
}
