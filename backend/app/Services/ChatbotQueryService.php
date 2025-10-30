<?php

namespace App\Services;

use App\Models\Poliza;
use App\Models\Cliente;
use App\Models\Siniestro;
use App\Models\Ramo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Servicio para procesar consultas del chatbot con acceso a la base de datos
 */
class ChatbotQueryService
{
    /**
     * Procesar una consulta del chatbot y retornar la respuesta
     */
    public function processQuery(string $query, int $brokerId, ?array $context = []): array
    {
        Log::info('🤖 [CHATBOT] Procesando consulta', [
            'query' => $query,
            'broker_id' => $brokerId,
            'context' => $context
        ]);

        // Detectar el tipo de consulta
        $queryType = $this->detectQueryType($query);
        
        try {
            $result = match($queryType) {
                'polizas_count' => $this->getPolizasCount($brokerId, $query),
                'polizas_ramo' => $this->getPolizasByRamo($brokerId, $query),
                'polizas_vencimiento' => $this->getPolizasProximasVencer($brokerId, $query),
                'polizas_cliente' => $this->getPolizasCliente($brokerId, $query, $context),
                'clientes_count' => $this->getClientesCount($brokerId),
                'siniestros_count' => $this->getSiniestrosCount($brokerId, $query),
                'estadisticas_generales' => $this->getEstadisticasGenerales($brokerId),
                'poliza_detalle' => $this->getPolizaDetalle($brokerId, $query, $context),
                default => $this->getDefaultResponse($query)
            };

            Log::info('🤖 [CHATBOT] Consulta procesada exitosamente', [
                'query_type' => $queryType,
                'result' => $result
            ]);

            return [
                'success' => true,
                'query_type' => $queryType,
                'data' => $result,
                'formatted_response' => $this->formatResponse($queryType, $result)
            ];

        } catch (\Exception $e) {
            Log::error('🤖 [CHATBOT] Error procesando consulta', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return [
                'success' => false,
                'error' => 'No pude procesar tu consulta. Por favor, intenta reformularla.',
                'query_type' => $queryType
            ];
        }
    }

    /**
     * Detectar el tipo de consulta basado en palabras clave
     */
    private function detectQueryType(string $query): string
    {
        $query = strtolower($query);

        // Consultas sobre pólizas
        if (preg_match('/cuántas?\s+pólizas?|número\s+de\s+pólizas?|total\s+de\s+pólizas?/i', $query)) {
            if (preg_match('/automóvil|auto|vehículo|carro/i', $query)) {
                return 'polizas_ramo';
            }
            if (preg_match('/vida|salud|hogar/i', $query)) {
                return 'polizas_ramo';
            }
            return 'polizas_count';
        }

        // Consultas sobre vencimientos
        if (preg_match('/próximas?\s+a\s+vencer|vencimiento|expira|caducan/i', $query)) {
            return 'polizas_vencimiento';
        }

        // Consultas sobre clientes
        if (preg_match('/cuántos?\s+clientes?|número\s+de\s+clientes?|total\s+de\s+clientes?/i', $query)) {
            return 'clientes_count';
        }

        // Consultas sobre siniestros
        if (preg_match('/cuántos?\s+siniestros?|número\s+de\s+siniestros?|reclamos?/i', $query)) {
            return 'siniestros_count';
        }

        // Consultas sobre estadísticas
        if (preg_match('/estadísticas?|resumen|dashboard|métricas?/i', $query)) {
            return 'estadisticas_generales';
        }

        // Consultas sobre detalle de póliza
        if (preg_match('/póliza\s+número|número\s+de\s+póliza|detalle\s+de\s+póliza/i', $query)) {
            return 'poliza_detalle';
        }

        // Consultas sobre pólizas de un cliente
        if (preg_match('/pólizas?\s+de|cliente\s+con/i', $query)) {
            return 'polizas_cliente';
        }

        return 'general';
    }

    /**
     * Obtener conteo total de pólizas
     */
    private function getPolizasCount(int $brokerId, string $query): array
    {
        $totalPolizas = Poliza::where('broker_id', $brokerId)->count();
        $polizasActivas = Poliza::where('broker_id', $brokerId)
            ->where('status', 'active')
            ->count();

        return [
            'total' => $totalPolizas,
            'activas' => $polizasActivas,
            'inactivas' => $totalPolizas - $polizasActivas
        ];
    }

    /**
     * Obtener pólizas por ramo
     */
    private function getPolizasByRamo(int $brokerId, string $query): array
    {
        $query = strtolower($query);
        
        // Detectar el ramo solicitado
        $ramoMap = [
            'automóvil' => ['automovil', 'auto', 'vehiculo', 'carro'],
            'vida' => ['vida'],
            'salud' => ['salud', 'medico'],
            'hogar' => ['hogar', 'casa', 'vivienda'],
        ];

        $ramoDetectado = null;
        foreach ($ramoMap as $ramo => $keywords) {
            foreach ($keywords as $keyword) {
                if (str_contains($query, $keyword)) {
                    $ramoDetectado = $ramo;
                    break 2;
                }
            }
        }

        if (!$ramoDetectado) {
            // Retornar todas las pólizas agrupadas por ramo
            $polizasPorRamo = Poliza::where('broker_id', $brokerId)
                ->select('type', DB::raw('count(*) as total'))
                ->groupBy('type')
                ->get()
                ->mapWithKeys(function ($item) {
                    return [$item->type => $item->total];
                });

            return [
                'por_ramo' => $polizasPorRamo->toArray(),
                'total' => $polizasPorRamo->sum()
            ];
        }

        // Retornar pólizas del ramo específico
        $count = Poliza::where('broker_id', $brokerId)
            ->where('type', $ramoDetectado)
            ->count();

        $activas = Poliza::where('broker_id', $brokerId)
            ->where('type', $ramoDetectado)
            ->where('status', 'active')
            ->count();

        return [
            'ramo' => $ramoDetectado,
            'total' => $count,
            'activas' => $activas
        ];
    }

    /**
     * Obtener pólizas próximas a vencer
     */
    private function getPolizasProximasVencer(int $brokerId, string $query): array
    {
        // Detectar el período (30 días por defecto)
        $dias = 30;
        if (preg_match('/(\d+)\s*días?/i', $query, $matches)) {
            $dias = (int)$matches[1];
        }

        $polizas = Poliza::where('broker_id', $brokerId)
            ->where('status', 'active')
            ->where('end_date', '>=', now())
            ->where('end_date', '<=', now()->addDays($dias))
            ->orderBy('end_date', 'asc')
            ->get(['id', 'policy_number', 'client_name', 'type', 'end_date', 'premium_amount']);

        return [
            'dias' => $dias,
            'total' => $polizas->count(),
            'polizas' => $polizas->map(function ($poliza) {
                return [
                    'numero' => $poliza->policy_number,
                    'cliente' => $poliza->client_name,
                    'tipo' => $poliza->type,
                    'vencimiento' => $poliza->end_date->format('Y-m-d'),
                    'dias_restantes' => now()->diffInDays($poliza->end_date),
                    'prima' => $poliza->premium_amount
                ];
            })->toArray()
        ];
    }

    /**
     * Obtener pólizas de un cliente
     */
    private function getPolizasCliente(int $brokerId, string $query, array $context): array
    {
        // Intentar extraer nombre o documento del cliente
        $clienteId = $context['cliente_id'] ?? null;
        
        if (!$clienteId) {
            // Buscar por nombre en la consulta
            $clientes = Cliente::where('broker_id', $brokerId)
                ->where(function ($q) use ($query) {
                    $q->where('first_name', 'like', "%{$query}%")
                      ->orWhere('last_name', 'like', "%{$query}%")
                      ->orWhere('document_number', 'like', "%{$query}%");
                })
                ->limit(5)
                ->get();

            if ($clientes->isEmpty()) {
                return [
                    'encontrado' => false,
                    'mensaje' => 'No encontré ningún cliente con ese nombre o documento'
                ];
            }

            if ($clientes->count() > 1) {
                return [
                    'encontrado' => false,
                    'multiple' => true,
                    'clientes' => $clientes->map(fn($c) => [
                        'id' => $c->id,
                        'nombre' => $c->full_name,
                        'documento' => $c->document_number
                    ])->toArray()
                ];
            }

            $clienteId = $clientes->first()->id;
        }

        $polizas = Poliza::where('broker_id', $brokerId)
            ->where('client_id', $clienteId)
            ->get(['id', 'policy_number', 'type', 'status', 'start_date', 'end_date', 'premium_amount']);

        $cliente = Cliente::find($clienteId);

        return [
            'encontrado' => true,
            'cliente' => [
                'nombre' => $cliente->full_name,
                'documento' => $cliente->document_number
            ],
            'total_polizas' => $polizas->count(),
            'polizas' => $polizas->map(function ($poliza) {
                return [
                    'numero' => $poliza->policy_number,
                    'tipo' => $poliza->type,
                    'estado' => $poliza->status,
                    'vigencia' => $poliza->start_date->format('Y-m-d') . ' a ' . $poliza->end_date->format('Y-m-d'),
                    'prima' => $poliza->premium_amount
                ];
            })->toArray()
        ];
    }

    /**
     * Obtener conteo de clientes
     */
    private function getClientesCount(int $brokerId): array
    {
        $total = Cliente::where('broker_id', $brokerId)->count();
        $activos = Cliente::where('broker_id', $brokerId)
            ->where('status', 'active')
            ->count();

        return [
            'total' => $total,
            'activos' => $activos,
            'prospectos' => Cliente::where('broker_id', $brokerId)
                ->where('status', 'prospect')
                ->count()
        ];
    }

    /**
     * Obtener conteo de siniestros
     */
    private function getSiniestrosCount(int $brokerId, string $query): array
    {
        $total = Siniestro::where('broker_id', $brokerId)->count();
        
        $porEstado = Siniestro::where('broker_id', $brokerId)
            ->select('estado', DB::raw('count(*) as total'))
            ->groupBy('estado')
            ->get()
            ->mapWithKeys(fn($item) => [$item->estado => $item->total]);

        return [
            'total' => $total,
            'por_estado' => $porEstado->toArray(),
            'pendientes' => $porEstado['pendiente'] ?? 0,
            'aprobados' => $porEstado['aprobado'] ?? 0
        ];
    }

    /**
     * Obtener estadísticas generales
     */
    private function getEstadisticasGenerales(int $brokerId): array
    {
        return [
            'polizas' => [
                'total' => Poliza::where('broker_id', $brokerId)->count(),
                'activas' => Poliza::where('broker_id', $brokerId)->where('status', 'active')->count(),
                'proximas_vencer' => Poliza::where('broker_id', $brokerId)
                    ->where('status', 'active')
                    ->where('end_date', '>=', now())
                    ->where('end_date', '<=', now()->addDays(30))
                    ->count()
            ],
            'clientes' => [
                'total' => Cliente::where('broker_id', $brokerId)->count(),
                'activos' => Cliente::where('broker_id', $brokerId)->where('status', 'active')->count()
            ],
            'siniestros' => [
                'total' => Siniestro::where('broker_id', $brokerId)->count(),
                'pendientes' => Siniestro::where('broker_id', $brokerId)->where('estado', 'pendiente')->count()
            ],
            'primas_totales' => Poliza::where('broker_id', $brokerId)
                ->where('status', 'active')
                ->sum('premium_amount')
        ];
    }

    /**
     * Obtener detalle de una póliza específica
     */
    private function getPolizaDetalle(int $brokerId, string $query, array $context): array
    {
        // Extraer número de póliza
        $policyNumber = $context['policy_number'] ?? null;
        
        if (!$policyNumber && preg_match('/\d+/', $query, $matches)) {
            $policyNumber = $matches[0];
        }

        if (!$policyNumber) {
            return [
                'encontrado' => false,
                'mensaje' => 'No pude identificar el número de póliza'
            ];
        }

        $poliza = Poliza::where('broker_id', $brokerId)
            ->where('policy_number', 'like', "%{$policyNumber}%")
            ->first();

        if (!$poliza) {
            return [
                'encontrado' => false,
                'mensaje' => 'No encontré ninguna póliza con ese número'
            ];
        }

        return [
            'encontrado' => true,
            'poliza' => [
                'numero' => $poliza->policy_number,
                'cliente' => $poliza->client_name,
                'tipo' => $poliza->type,
                'aseguradora' => $poliza->insurance_company,
                'estado' => $poliza->status,
                'vigencia' => [
                    'inicio' => $poliza->start_date->format('Y-m-d'),
                    'fin' => $poliza->end_date->format('Y-m-d'),
                    'dias_restantes' => $poliza->getDaysUntilExpiration()
                ],
                'montos' => [
                    'prima' => $poliza->premium_amount,
                    'suma_asegurada' => $poliza->insured_amount,
                    'deducible' => $poliza->deductible
                ]
            ]
        ];
    }

    /**
     * Respuesta por defecto
     */
    private function getDefaultResponse(string $query): array
    {
        return [
            'mensaje' => 'Puedo ayudarte con información sobre pólizas, clientes y siniestros. ¿Qué te gustaría saber?'
        ];
    }

    /**
     * Formatear la respuesta para el chatbot
     */
    private function formatResponse(string $queryType, array $data): string
    {
        return match($queryType) {
            'polizas_count' => "Tienes un total de {$data['total']} pólizas, de las cuales {$data['activas']} están activas.",
            'polizas_ramo' => isset($data['ramo']) 
                ? "Tienes {$data['total']} pólizas de {$data['ramo']}, de las cuales {$data['activas']} están activas."
                : "Aquí está el desglose de pólizas por ramo: " . json_encode($data['por_ramo']),
            'polizas_vencimiento' => "Tienes {$data['total']} pólizas que vencen en los próximos {$data['dias']} días.",
            'clientes_count' => "Tienes {$data['total']} clientes registrados, de los cuales {$data['activos']} están activos.",
            'siniestros_count' => "Tienes {$data['total']} siniestros registrados, con {$data['pendientes']} pendientes de resolución.",
            'estadisticas_generales' => "Resumen: {$data['polizas']['total']} pólizas ({$data['polizas']['activas']} activas), {$data['clientes']['total']} clientes, {$data['siniestros']['total']} siniestros.",
            default => $data['mensaje'] ?? 'Información procesada correctamente.'
        };
    }
}