<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class LiquidacionVendedor extends Model
{
    use HasFactory;

    protected $table = 'liquidaciones_vendedores_cabecera';

    protected $fillable = [
        'codigo',
        'broker_id',
        'vendedor_id',
        'periodo_inicio',
        'periodo_fin',
        'fecha_generacion',
        'filtros_aplicados',
        'prima_total',
        'monto_bruto_total',
        'monto_retencion_total',
        'monto_retencion_ica_total',
        'monto_iva_total',
        'monto_neto_total',
        'cantidad_polizas',
        'estado',
        'fecha_pago',
        'metodo_pago',
        'referencia_pago',
        'comprobante_url',
        'pdf_url',
        'observaciones',
        'creado_por',
        'aprobado_por',
        'fecha_aprobacion',
        'revertido_por',
        'fecha_reversion',
        'motivo_reversion',
    ];

    protected $casts = [
        'periodo_inicio' => 'date',
        'periodo_fin' => 'date',
        'fecha_generacion' => 'date',
        'filtros_aplicados' => 'array',
        'prima_total' => 'decimal:2',
        'monto_bruto_total' => 'decimal:2',
        'monto_retencion_total' => 'decimal:2',
        'monto_retencion_ica_total' => 'decimal:2',
        'monto_iva_total' => 'decimal:2',
        'monto_neto_total' => 'decimal:2',
        'fecha_pago' => 'date',
        'fecha_aprobacion' => 'datetime',
        'fecha_reversion' => 'datetime',
    ];

    // Relaciones
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function vendedor(): BelongsTo
    {
        return $this->belongsTo(Vendedor::class);
    }

    public function detalles(): HasMany
    {
        return $this->hasMany(LiquidacionVendedorDetalle::class, 'liquidacion_id');
    }

    public function creadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public function aprobadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'aprobado_por');
    }

    public function revertidoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revertido_por');
    }

    // Scopes
    public function scopeByBroker($query, $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopeGeneradas($query)
    {
        return $query->where('estado', 'generada');
    }

    public function scopeAprobadas($query)
    {
        return $query->where('estado', 'aprobada');
    }

    public function scopePagadas($query)
    {
        return $query->where('estado', 'pagada');
    }

    public function scopeRevertidas($query)
    {
        return $query->where('estado', 'revertida');
    }

    public function scopeByVendedor($query, $vendedorId)
    {
        return $query->where('vendedor_id', $vendedorId);
    }

    public function scopeByPeriodo($query, $inicio, $fin)
    {
        return $query->whereBetween('periodo_inicio', [$inicio, $fin])
                    ->orWhereBetween('periodo_fin', [$inicio, $fin]);
    }

    // Métodos de negocio
    public function aprobar($userId): bool
    {
        if ($this->estado !== 'generada') {
            return false;
        }

        $this->estado = 'aprobada';
        $this->aprobado_por = $userId;
        $this->fecha_aprobacion = now();
        return $this->save();
    }

    public function registrarPago(array $datos, $userId): bool
    {
        if (!in_array($this->estado, ['generada', 'aprobada'])) {
            return false;
        }

        $this->estado = 'pagada';
        $this->fecha_pago = $datos['fecha_pago'] ?? now();
        $this->metodo_pago = $datos['metodo_pago'] ?? null;
        $this->referencia_pago = $datos['referencia_pago'] ?? null;
        $this->comprobante_url = $datos['comprobante_url'] ?? null;
        $this->observaciones = $datos['observaciones'] ?? $this->observaciones;
        
        return $this->save();
    }

    public function revertir(string $motivo, $userId): bool
    {
        if ($this->estado === 'revertida') {
            return false;
        }

        DB::beginTransaction();
        try {
            $this->estado = 'revertida';
            $this->revertido_por = $userId;
            $this->fecha_reversion = now();
            $this->motivo_reversion = $motivo;
            $this->save();

            // Aquí podrías agregar lógica adicional, como revertir
            // el estado de las pólizas si fuera necesario

            DB::commit();
            return true;
        } catch (\Exception $e) {
            DB::rollBack();
            return false;
        }
    }

    public function puedeRevertirse(): bool
    {
        return in_array($this->estado, ['generada', 'aprobada', 'pagada']);
    }

    public function estaPagada(): bool
    {
        return $this->estado === 'pagada';
    }

    public function estaRevertida(): bool
    {
        return $this->estado === 'revertida';
    }

    /**
     * Generar código único de liquidación con bloqueo para evitar duplicados
     */
    public static function generarCodigo($brokerId): string
    {
        $year = date('Y');
        $prefijo = "LIQ-{$year}-";
        $longitudPrefijo = strlen($prefijo); // 9 caracteres: "LIQ-2025-"
        
        // Extraer el número después del prefijo y obtener el máximo
        // SUBSTRING(codigo, 10) extrae todo después de "LIQ-2025-"
        $maxNumero = self::where('broker_id', $brokerId)
            ->where('codigo', 'like', "{$prefijo}%")
            ->lockForUpdate()
            ->selectRaw("MAX(CAST(SUBSTRING(codigo, ?) AS UNSIGNED)) as max_num", [$longitudPrefijo + 1])
            ->value('max_num');

        $nuevo_numero = ($maxNumero ?? 0) + 1;

        // Usar mínimo 3 dígitos, pero permitir más si es necesario
        return sprintf('LIQ-%s-%d', $year, $nuevo_numero);
    }

    /**
     * Crear liquidación con reintento automático si hay conflicto de código
     */
    public static function crearConReintento(array $datos, int $maxReintentos = 3): self
    {
        $intento = 0;
        
        while ($intento < $maxReintentos) {
            try {
                $datos['codigo'] = self::generarCodigo($datos['broker_id']);
                return self::create($datos);
            } catch (\Illuminate\Database\QueryException $e) {
                // Error 1062 = Duplicate entry
                if ($e->errorInfo[1] === 1062 && str_contains($e->getMessage(), 'codigo_unique')) {
                    $intento++;
                    if ($intento >= $maxReintentos) {
                        throw $e;
                    }
                    // Pequeña pausa antes de reintentar
                    usleep(100000); // 100ms
                    continue;
                }
                throw $e;
            }
        }
        
        throw new \Exception('No se pudo generar un código único después de ' . $maxReintentos . ' intentos');
    }
}