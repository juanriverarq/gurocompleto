<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\BrokerScoped;

class PdfExtractionRecord extends Model
{
    use HasFactory, BrokerScoped;

    protected $fillable = [
        'broker_id',
        'user_id',
        'file_name',
        'file_size',
        'file_hash',
        'page_count',
        'has_selectable_text',
        'detected_insurer',
        'document_type',
        'document_quality',
        'extraction_method',
        'processing_time_ms',
        'extracted_data',
        'corrected_data',
        'confidence_overall',
        'confidence_extraction',
        'confidence_validation',
        'confidence_consistency',
        'confidence_historical',
        'user_rating',
        'user_comments',
        'user_feedback',
        'has_corrections',
        'is_validated',
        'corrected_at'
    ];

    protected $casts = [
        'file_size' => 'integer',
        'page_count' => 'integer',
        'has_selectable_text' => 'boolean',
        'processing_time_ms' => 'integer',
        'extracted_data' => 'array',
        'corrected_data' => 'array',
        'confidence_overall' => 'decimal:2',
        'confidence_extraction' => 'decimal:2',
        'confidence_validation' => 'decimal:2',
        'confidence_consistency' => 'decimal:2',
        'confidence_historical' => 'decimal:2',
        'user_rating' => 'integer',
        'user_feedback' => 'array',
        'has_corrections' => 'boolean',
        'is_validated' => 'boolean',
        'corrected_at' => 'datetime'
    ];

    // ===== RELACIONES =====

    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ===== SCOPES =====

    public function scopeByInsurer($query, string $insurer)
    {
        return $query->where('detected_insurer', $insurer);
    }

    public function scopeByMethod($query, string $method)
    {
        return $query->where('extraction_method', $method);
    }

    public function scopeWithCorrections($query)
    {
        return $query->where('has_corrections', true);
    }

    public function scopeHighConfidence($query, float $threshold = 80.0)
    {
        return $query->where('confidence_overall', '>=', $threshold);
    }

    public function scopeRecentExtractions($query, int $days = 30)
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }

    // ===== MÉTODOS DE UTILIDAD =====

    /**
     * Calcular la precisión de la extracción comparando con datos corregidos
     */
    public function calculateAccuracy(): ?float
    {
        if (!$this->has_corrections || !$this->corrected_data) {
            return null;
        }

        $extracted = $this->extracted_data;
        $corrected = $this->corrected_data;
        
        $totalFields = count($corrected);
        if ($totalFields === 0) return null;

        $correctFields = 0;
        foreach ($corrected as $field => $correctValue) {
            $extractedValue = $extracted[$field] ?? '';
            if ($this->normalizeValue($extractedValue) === $this->normalizeValue($correctValue)) {
                $correctFields++;
            }
        }

        return ($correctFields / $totalFields) * 100;
    }

    /**
     * Obtener errores por campo
     */
    public function getFieldErrors(): array
    {
        if (!$this->has_corrections || !$this->corrected_data) {
            return [];
        }

        $errors = [];
        $extracted = $this->extracted_data;
        $corrected = $this->corrected_data;

        foreach ($corrected as $field => $correctValue) {
            $extractedValue = $extracted[$field] ?? '';
            if ($this->normalizeValue($extractedValue) !== $this->normalizeValue($correctValue)) {
                $errors[$field] = [
                    'extracted' => $extractedValue,
                    'correct' => $correctValue,
                    'error_type' => $this->classifyError($field, $extractedValue, $correctValue)
                ];
            }
        }

        return $errors;
    }

    /**
     * Marcar como validado
     */
    public function markAsValidated(): bool
    {
        return $this->update(['is_validated' => true]);
    }

    /**
     * Registrar corrección
     */
    public function recordCorrection(array $correctedData, ?array $userFeedback = null): bool
    {
        return $this->update([
            'corrected_data' => $correctedData,
            'user_feedback' => $userFeedback,
            'has_corrections' => true,
            'corrected_at' => now()
        ]);
    }

    // ===== MÉTODOS PRIVADOS =====

    private function normalizeValue($value): string
    {
        return trim(strtolower((string) $value));
    }

    private function classifyError(string $field, $extracted, $correct): string
    {
        if (empty($extracted) && !empty($correct)) {
            return 'missing_extraction';
        }
        
        if (!empty($extracted) && empty($correct)) {
            return 'false_positive';
        }
        
        if (str_contains($field, 'fecha')) {
            return 'date_format_error';
        }
        
        if (str_contains($field, 'monto') || str_contains($field, 'prima') || str_contains($field, 'iva') || str_contains($field, 'total')) {
            return 'amount_format_error';
        }
        
        return 'content_error';
    }

    // ===== MÉTODOS ESTÁTICOS =====

    /**
     * Obtener estadísticas de rendimiento para un broker
     */
    public static function getPerformanceStats(int $brokerId, int $days = 30): array
    {
        $records = static::where('broker_id', $brokerId)
            ->recentExtractions($days)
            ->get();

        if ($records->isEmpty()) {
            return [
                'total_extractions' => 0,
                'success_rate' => 0,
                'average_confidence' => 0,
                'average_processing_time' => 0,
                'top_errors' => [],
                'insurer_performance' => []
            ];
        }

        $totalExtractions = $records->count();
        $withCorrections = $records->where('has_corrections', true);
        
        // Calcular tasa de éxito basada en correcciones
        $successfulExtractions = 0;
        foreach ($withCorrections as $record) {
            $accuracy = $record->calculateAccuracy();
            if ($accuracy && $accuracy >= 70) {
                $successfulExtractions++;
            }
        }

        $successRate = $withCorrections->count() > 0 
            ? ($successfulExtractions / $withCorrections->count()) * 100 
            : 0;

        $averageConfidence = $records->avg('confidence_overall');
        $averageProcessingTime = $records->avg('processing_time_ms');

        // Errores más frecuentes
        $topErrors = [];
        foreach ($withCorrections as $record) {
            $fieldErrors = $record->getFieldErrors();
            foreach ($fieldErrors as $field => $error) {
                $topErrors[$field] = ($topErrors[$field] ?? 0) + 1;
            }
        }
        arsort($topErrors);

        // Rendimiento por aseguradora
        $insurerPerformance = $records->groupBy('detected_insurer')
            ->map(function ($insurerRecords) {
                return [
                    'count' => $insurerRecords->count(),
                    'avg_confidence' => $insurerRecords->avg('confidence_overall'),
                    'avg_processing_time' => $insurerRecords->avg('processing_time_ms')
                ];
            })
            ->toArray();

        return [
            'total_extractions' => $totalExtractions,
            'success_rate' => round($successRate, 2),
            'average_confidence' => round($averageConfidence, 2),
            'average_processing_time' => round($averageProcessingTime),
            'top_errors' => array_slice($topErrors, 0, 10, true),
            'insurer_performance' => $insurerPerformance
        ];
    }

    /**
     * Obtener recomendaciones de mejora para un broker
     */
    public static function getImprovementRecommendations(int $brokerId): array
    {
        $stats = static::getPerformanceStats($brokerId);
        $recommendations = [];

        // Recomendaciones basadas en tasa de éxito
        if ($stats['success_rate'] < 80) {
            $recommendations[] = [
                'type' => 'accuracy',
                'priority' => 'high',
                'message' => 'Considere habilitar más APIs de IA para mejorar la precisión',
                'action' => 'configure_additional_apis'
            ];
        }

        // Recomendaciones basadas en confianza
        if ($stats['average_confidence'] < 75) {
            $recommendations[] = [
                'type' => 'confidence',
                'priority' => 'medium',
                'message' => 'Active la validación cruzada para mejorar la confianza',
                'action' => 'enable_cross_validation'
            ];
        }

        // Recomendaciones basadas en rendimiento
        if ($stats['average_processing_time'] > 10000) {
            $recommendations[] = [
                'type' => 'performance',
                'priority' => 'medium',
                'message' => 'Active el procesamiento paralelo para mejorar velocidad',
                'action' => 'enable_parallel_processing'
            ];
        }

        // Recomendaciones basadas en errores frecuentes
        foreach (array_slice($stats['top_errors'], 0, 3, true) as $field => $count) {
            if ($count > 5) {
                $recommendations[] = [
                    'type' => 'field_specific',
                    'priority' => 'medium',
                    'message' => "Campo '{$field}' tiene {$count} errores frecuentes",
                    'action' => 'improve_field_patterns',
                    'field' => $field
                ];
            }
        }

        return $recommendations;
    }
}