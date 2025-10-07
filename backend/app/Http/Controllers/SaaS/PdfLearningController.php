<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\PdfExtractionRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Auth\AuthenticationException;

class PdfLearningController extends Controller
{
    private function getBrokerId(Request $request)
    {
        if ($request->has('authenticated_broker_id')) {
            return (int) $request->get('authenticated_broker_id');
        }

        $user = $request->user() ?: Auth::user();
        if ($user && $user->broker_id) {
            return (int) $user->broker_id;
        }

        throw new AuthenticationException('Usuario no autenticado o sin broker asignado');
    }

    /**
     * Registrar una nueva extracción PDF
     */
    public function recordExtraction(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $user = Auth::user();

            $validated = $request->validate([
                'file_name' => 'required|string|max:255',
                'file_size' => 'required|integer|min:1',
                'file_hash' => 'nullable|string|max:64',
                'page_count' => 'required|integer|min:1',
                'has_selectable_text' => 'required|boolean',
                'detected_insurer' => 'nullable|string|max:100',
                'document_type' => 'required|in:policy,certificate,endorsement,addendum,unknown',
                'document_quality' => 'required|in:high,medium,low',
                'extraction_method' => 'required|string|max:100',
                'processing_time_ms' => 'required|integer|min:0',
                'extracted_data' => 'required|array',
                'confidence_overall' => 'required|numeric|min:0|max:100',
                'confidence_extraction' => 'required|numeric|min:0|max:100',
                'confidence_validation' => 'required|numeric|min:0|max:100',
                'confidence_consistency' => 'required|numeric|min:0|max:100',
                'confidence_historical' => 'required|numeric|min:0|max:100'
            ]);

            $record = PdfExtractionRecord::create([
                'broker_id' => $brokerId,
                'user_id' => $user?->id,
                ...$validated
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Extracción registrada exitosamente',
                'data' => [
                    'record_id' => $record->id,
                    'confidence' => $record->confidence_overall
                ]
            ], 201);

        } catch (AuthenticationException $e) {
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Error registrando extracción PDF', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar extracción: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Registrar corrección de datos extraídos
     */
    public function recordCorrection(Request $request, int $recordId)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $record = PdfExtractionRecord::where('broker_id', $brokerId)
                ->where('id', $recordId)
                ->first();

            if (!$record) {
                return response()->json([
                    'success' => false,
                    'message' => 'Registro de extracción no encontrado'
                ], 404);
            }

            $validated = $request->validate([
                'corrected_data' => 'required|array',
                'user_rating' => 'nullable|integer|min:1|max:5',
                'user_comments' => 'nullable|string|max:1000',
                'user_feedback' => 'nullable|array'
            ]);

            $record->recordCorrection(
                $validated['corrected_data'],
                array_filter([
                    'rating' => $validated['user_rating'] ?? null,
                    'comments' => $validated['user_comments'] ?? null,
                    'feedback' => $validated['user_feedback'] ?? null
                ])
            );

            // Actualizar métricas de usuario si se proporcionó rating
            if (isset($validated['user_rating'])) {
                $record->update(['user_rating' => $validated['user_rating']]);
            }

            if (isset($validated['user_comments'])) {
                $record->update(['user_comments' => $validated['user_comments']]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Corrección registrada exitosamente',
                'data' => [
                    'record_id' => $record->id,
                    'accuracy' => $record->calculateAccuracy()
                ]
            ]);

        } catch (AuthenticationException $e) {
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Error registrando corrección PDF', [
                'record_id' => $recordId,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar corrección: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener métricas de rendimiento
     */
    public function getPerformanceMetrics(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $days = $request->query('days', 30);

            $stats = PdfExtractionRecord::getPerformanceStats($brokerId, $days);
            $recommendations = PdfExtractionRecord::getImprovementRecommendations($brokerId);

            return response()->json([
                'success' => true,
                'message' => 'Métricas obtenidas exitosamente',
                'data' => [
                    'metrics' => $stats,
                    'recommendations' => $recommendations,
                    'period_days' => $days
                ]
            ]);

        } catch (AuthenticationException $e) {
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Exception $e) {
            Log::error('Error obteniendo métricas PDF', [
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener métricas: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener historial de extracciones
     */
    public function getExtractionHistory(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $query = PdfExtractionRecord::where('broker_id', $brokerId)
                ->with(['user:id,name,email']);

            // Filtros opcionales
            if ($request->has('insurer')) {
                $query->byInsurer($request->insurer);
            }

            if ($request->has('method')) {
                $query->byMethod($request->method);
            }

            if ($request->has('with_corrections')) {
                $query->withCorrections();
            }

            if ($request->has('min_confidence')) {
                $query->highConfidence($request->min_confidence);
            }

            if ($request->has('days')) {
                $query->recentExtractions($request->days);
            }

            // Paginación
            $perPage = $request->query('per_page', 15);
            $records = $query->orderByDesc('created_at')->paginate($perPage);

            // Transformar datos para el frontend
            $transformedRecords = $records->through(function ($record) {
                return [
                    'id' => $record->id,
                    'file_name' => $record->file_name,
                    'file_size' => $record->file_size,
                    'detected_insurer' => $record->detected_insurer,
                    'document_type' => $record->document_type,
                    'extraction_method' => $record->extraction_method,
                    'confidence_overall' => $record->confidence_overall,
                    'has_corrections' => $record->has_corrections,
                    'user_rating' => $record->user_rating,
                    'accuracy' => $record->calculateAccuracy(),
                    'processing_time_ms' => $record->processing_time_ms,
                    'created_at' => $record->created_at->toISOString(),
                    'user_name' => $record->user?->name
                ];
            });

            return response()->json([
                'success' => true,
                'message' => 'Historial obtenido exitosamente',
                'data' => $transformedRecords->toArray()
            ]);

        } catch (AuthenticationException $e) {
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Exception $e) {
            Log::error('Error obteniendo historial PDF', [
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener historial: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener detalles de un registro específico
     */
    public function getExtractionDetails(Request $request, int $recordId)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $record = PdfExtractionRecord::where('broker_id', $brokerId)
                ->where('id', $recordId)
                ->with(['user:id,name,email'])
                ->first();

            if (!$record) {
                return response()->json([
                    'success' => false,
                    'message' => 'Registro no encontrado'
                ], 404);
            }

            $details = [
                'id' => $record->id,
                'file_info' => [
                    'name' => $record->file_name,
                    'size' => $record->file_size,
                    'hash' => $record->file_hash,
                    'pages' => $record->page_count,
                    'has_selectable_text' => $record->has_selectable_text
                ],
                'document_info' => [
                    'insurer' => $record->detected_insurer,
                    'type' => $record->document_type,
                    'quality' => $record->document_quality
                ],
                'extraction_info' => [
                    'method' => $record->extraction_method,
                    'processing_time_ms' => $record->processing_time_ms,
                    'extracted_data' => $record->extracted_data,
                    'corrected_data' => $record->corrected_data
                ],
                'confidence_metrics' => [
                    'overall' => $record->confidence_overall,
                    'extraction' => $record->confidence_extraction,
                    'validation' => $record->confidence_validation,
                    'consistency' => $record->confidence_consistency,
                    'historical' => $record->confidence_historical
                ],
                'user_feedback' => [
                    'rating' => $record->user_rating,
                    'comments' => $record->user_comments,
                    'feedback' => $record->user_feedback
                ],
                'status' => [
                    'has_corrections' => $record->has_corrections,
                    'is_validated' => $record->is_validated,
                    'accuracy' => $record->calculateAccuracy(),
                    'field_errors' => $record->getFieldErrors()
                ],
                'timestamps' => [
                    'created_at' => $record->created_at->toISOString(),
                    'corrected_at' => $record->corrected_at?->toISOString(),
                    'updated_at' => $record->updated_at->toISOString()
                ],
                'user' => $record->user ? [
                    'id' => $record->user->id,
                    'name' => $record->user->name,
                    'email' => $record->user->email
                ] : null
            ];

            return response()->json([
                'success' => true,
                'message' => 'Detalles obtenidos exitosamente',
                'data' => $details
            ]);

        } catch (AuthenticationException $e) {
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Exception $e) {
            Log::error('Error obteniendo detalles de extracción PDF', [
                'record_id' => $recordId,
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener detalles: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener reporte de aprendizaje
     */
    public function getLearningReport(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $days = $request->query('days', 30);

            // Estadísticas generales
            $stats = PdfExtractionRecord::getPerformanceStats($brokerId, $days);
            
            // Recomendaciones
            $recommendations = PdfExtractionRecord::getImprovementRecommendations($brokerId);

            // Tendencias (comparar con período anterior)
            $previousStats = PdfExtractionRecord::getPerformanceStats($brokerId, $days * 2);
            $trends = $this->calculateTrends($stats, $previousStats);

            // Top errores por campo
            $topFieldErrors = array_slice($stats['top_errors'], 0, 10, true);

            // Rendimiento por aseguradora
            $insurerPerformance = $stats['insurer_performance'];

            // Distribución de métodos de extracción
            $methodDistribution = PdfExtractionRecord::where('broker_id', $brokerId)
                ->recentExtractions($days)
                ->selectRaw('extraction_method, COUNT(*) as count, AVG(confidence_overall) as avg_confidence')
                ->groupBy('extraction_method')
                ->get()
                ->mapWithKeys(function ($item) {
                    return [$item->extraction_method => [
                        'count' => $item->count,
                        'avg_confidence' => round($item->avg_confidence, 2)
                    ]];
                });

            $report = [
                'summary' => [
                    'period_days' => $days,
                    'total_extractions' => $stats['total_extractions'],
                    'success_rate' => $stats['success_rate'],
                    'average_confidence' => $stats['average_confidence'],
                    'average_processing_time' => $stats['average_processing_time']
                ],
                'trends' => $trends,
                'top_field_errors' => $topFieldErrors,
                'insurer_performance' => $insurerPerformance,
                'method_distribution' => $methodDistribution,
                'recommendations' => $recommendations,
                'generated_at' => now()->toISOString()
            ];

            return response()->json([
                'success' => true,
                'message' => 'Reporte generado exitosamente',
                'data' => $report
            ]);

        } catch (AuthenticationException $e) {
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Exception $e) {
            Log::error('Error generando reporte de aprendizaje PDF', [
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al generar reporte: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Predecir éxito de extracción
     */
    public function predictExtractionSuccess(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $validated = $request->validate([
                'file_name' => 'required|string',
                'file_size' => 'required|integer',
                'detected_insurer' => 'nullable|string'
            ]);

            // Buscar registros similares
            $similarRecords = PdfExtractionRecord::where('broker_id', $brokerId)
                ->when($validated['detected_insurer'], function ($query, $insurer) {
                    return $query->byInsurer($insurer);
                })
                ->where('file_size', '>=', $validated['file_size'] * 0.5)
                ->where('file_size', '<=', $validated['file_size'] * 1.5)
                ->recentExtractions(90) // Últimos 3 meses
                ->get();

            if ($similarRecords->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'message' => 'Predicción generada (sin datos históricos)',
                    'data' => [
                        'expected_confidence' => 70,
                        'recommended_method' => 'advanced-hybrid',
                        'estimated_time_ms' => 5000,
                        'risk_factors' => ['Sin datos históricos para predicción precisa'],
                        'recommendations' => ['Procesar con configuración estándar']
                    ]
                ]);
            }

            // Calcular predicciones basadas en datos históricos
            $avgConfidence = $similarRecords->avg('confidence_overall');
            $avgTime = $similarRecords->avg('processing_time_ms');

            // Determinar mejor método
            $methodStats = $similarRecords->groupBy('extraction_method')
                ->map(function ($records) {
                    return [
                        'count' => $records->count(),
                        'avg_confidence' => $records->avg('confidence_overall'),
                        'avg_time' => $records->avg('processing_time_ms')
                    ];
                })
                ->sortByDesc('avg_confidence');

            $recommendedMethod = $methodStats->keys()->first() ?? 'advanced-hybrid';

            // Identificar factores de riesgo
            $riskFactors = [];
            if ($validated['file_size'] > 10 * 1024 * 1024) {
                $riskFactors[] = 'Archivo grande (>10MB)';
            }
            if ($avgConfidence < 60) {
                $riskFactors[] = 'Baja confianza histórica para documentos similares';
            }
            if ($avgTime > 10000) {
                $riskFactors[] = 'Tiempo de procesamiento alto esperado';
            }

            // Generar recomendaciones
            $recommendations = [];
            if ($avgConfidence < 80) {
                $recommendations[] = 'Revisar cuidadosamente los datos extraídos';
            }
            if (count($riskFactors) > 0) {
                $recommendations[] = 'Considerar procesamiento manual para mayor precisión';
            }

            return response()->json([
                'success' => true,
                'message' => 'Predicción generada exitosamente',
                'data' => [
                    'expected_confidence' => round($avgConfidence, 1),
                    'recommended_method' => $recommendedMethod,
                    'estimated_time_ms' => round($avgTime),
                    'risk_factors' => $riskFactors,
                    'recommendations' => $recommendations,
                    'similar_documents_count' => $similarRecords->count()
                ]
            ]);

        } catch (AuthenticationException $e) {
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Error en predicción PDF', [
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al generar predicción: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Exportar datos de aprendizaje
     */
    public function exportLearningData(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $records = PdfExtractionRecord::where('broker_id', $brokerId)
                ->with(['user:id,name,email'])
                ->get();

            $exportData = [
                'broker_id' => $brokerId,
                'export_date' => now()->toISOString(),
                'total_records' => $records->count(),
                'records' => $records->map(function ($record) {
                    return [
                        'id' => $record->id,
                        'file_name' => $record->file_name,
                        'detected_insurer' => $record->detected_insurer,
                        'extraction_method' => $record->extraction_method,
                        'confidence_overall' => $record->confidence_overall,
                        'extracted_data' => $record->extracted_data,
                        'corrected_data' => $record->corrected_data,
                        'has_corrections' => $record->has_corrections,
                        'accuracy' => $record->calculateAccuracy(),
                        'created_at' => $record->created_at->toISOString()
                    ];
                })
            ];

            return response()->json([
                'success' => true,
                'message' => 'Datos exportados exitosamente',
                'data' => $exportData
            ]);

        } catch (AuthenticationException $e) {
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Exception $e) {
            Log::error('Error exportando datos de aprendizaje PDF', [
                'error' => $e->getMessage()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al exportar datos: ' . $e->getMessage()
            ], 500);
        }
    }

    // ===== MÉTODOS PRIVADOS =====

    private function calculateTrends(array $currentStats, array $previousStats): array
    {
        $trends = [];

        // Tendencia de tasa de éxito
        if ($previousStats['success_rate'] > 0) {
            $successTrend = (($currentStats['success_rate'] - $previousStats['success_rate']) / $previousStats['success_rate']) * 100;
            $trends['success_rate'] = [
                'value' => round($successTrend, 2),
                'direction' => $successTrend > 0 ? 'up' : ($successTrend < 0 ? 'down' : 'stable')
            ];
        }

        // Tendencia de confianza
        if ($previousStats['average_confidence'] > 0) {
            $confidenceTrend = (($currentStats['average_confidence'] - $previousStats['average_confidence']) / $previousStats['average_confidence']) * 100;
            $trends['confidence'] = [
                'value' => round($confidenceTrend, 2),
                'direction' => $confidenceTrend > 0 ? 'up' : ($confidenceTrend < 0 ? 'down' : 'stable')
            ];
        }

        // Tendencia de tiempo de procesamiento
        if ($previousStats['average_processing_time'] > 0) {
            $timeTrend = (($currentStats['average_processing_time'] - $previousStats['average_processing_time']) / $previousStats['average_processing_time']) * 100;
            $trends['processing_time'] = [
                'value' => round($timeTrend, 2),
                'direction' => $timeTrend < 0 ? 'up' : ($timeTrend > 0 ? 'down' : 'stable') // Menos tiempo es mejor
            ];
        }

        return $trends;
    }
}