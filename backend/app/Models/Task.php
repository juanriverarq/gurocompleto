<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;
use App\Traits\BrokerScoped;

class Task extends Model
{
    use HasFactory, BrokerScoped;

    protected $fillable = [
        'broker_id',
        'titulo',
        'descripcion',
        'tipo',
        'prioridad',
        'estado',
        'fecha_vencimiento',
        'asignado_a',
        'cliente',
        'numero_poliza',
        'progreso',
        'observaciones',
        'usuario_id'
    ];

    protected $casts = [
        'fecha_vencimiento' => 'date',
        'progreso' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
    ];

    // Constantes para valores permitidos
    const TIPOS = [
        'Seguimiento Cliente',
        'Documentación',
        'Inspección',
        'Renovación',
        'Siniestro',
        'Cotización'
    ];

    const PRIORIDADES = [
        'Baja',
        'Media',
        'Alta',
        'Crítica'
    ];

    const ESTADOS = [
        'Pendiente',
        'En Progreso',
        'Completada',
        'Vencida',
        'Cancelada'
    ];

    // Relación con el usuario
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    // Scopes para filtros
    public function scopeByEstado($query, $estado)
    {
        return $query->where('estado', $estado);
    }

    public function scopeByTipo($query, $tipo)
    {
        return $query->where('tipo', $tipo);
    }

    public function scopeByPrioridad($query, $prioridad)
    {
        return $query->where('prioridad', $prioridad);
    }

    public function scopeByAsignado($query, $asignado)
    {
        return $query->where('asignado_a', $asignado);
    }

    public function scopeVencidas($query)
    {
        return $query->where('fecha_vencimiento', '<', Carbon::now())
                    ->whereNotIn('estado', ['Completada', 'Cancelada']);
    }

    public function scopeVencenHoy($query)
    {
        return $query->whereDate('fecha_vencimiento', Carbon::today());
    }

    public function scopeVencenEstaSemana($query)
    {
        return $query->whereBetween('fecha_vencimiento', [
            Carbon::now()->startOfWeek(),
            Carbon::now()->endOfWeek()
        ]);
    }

    public function scopeSearch($query, $search)
    {
        return $query->where(function($q) use ($search) {
            $q->where('titulo', 'like', "%{$search}%")
              ->orWhere('descripcion', 'like', "%{$search}%")
              ->orWhere('cliente', 'like', "%{$search}%")
              ->orWhere('numero_poliza', 'like', "%{$search}%")
              ->orWhere('asignado_a', 'like', "%{$search}%");
        });
    }

    // Accessor para verificar si está vencida
    public function getIsVencidaAttribute()
    {
        return $this->fecha_vencimiento < Carbon::now() && 
               !in_array($this->estado, ['Completada', 'Cancelada']);
    }

    // Accessor para obtener días restantes
    public function getDiasRestantesAttribute()
    {
        if ($this->estado === 'Completada' || $this->estado === 'Cancelada') {
            return null;
        }
        
        return Carbon::now()->diffInDays($this->fecha_vencimiento, false);
    }

    // Mutator para actualizar progreso y estado automáticamente
    public function setProgresoAttribute($value)
    {
        $this->attributes['progreso'] = $value;
        
        if ($value >= 100) {
            $this->attributes['estado'] = 'Completada';
        } elseif ($value > 0 && $this->estado === 'Pendiente') {
            $this->attributes['estado'] = 'En Progreso';
        }
    }

    // Método para marcar como completada
    public function marcarCompletada()
    {
        $this->update([
            'estado' => 'Completada',
            'progreso' => 100
        ]);
    }

    // Método para verificar y actualizar tareas vencidas
    public static function actualizarTareasVencidas()
    {
        return self::where('fecha_vencimiento', '<', Carbon::now())
                   ->whereNotIn('estado', ['Completada', 'Cancelada', 'Vencida'])
                   ->update(['estado' => 'Vencida']);
    }
}
