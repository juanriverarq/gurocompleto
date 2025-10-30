<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Poliza;
use App\Models\Cliente;
use App\Models\VentasCruzadasAnalisis;
use App\Services\VentasCruzadasIAService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class VentasCruzadasController extends Controller
{
    protected $iaService;

    public function __construct(VentasCruzadasIAService $iaService)
    {
        $this->iaService = $iaService;
    }

    /**
     * Obtener oportunidades de ventas cruzadas analizadas por IA
     */
    public function getOportunidades(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            Log::info("Obteniendo oportunidades de ventas cruzadas para broker {$brokerId}");

            // Obtener filtros
            $filtros = $request->only([
                'tipo_oportunidad',
                'prioridad',
                'scoring_min',
                'scoring_max',
                'vendedor_id',
                'cliente_id',
                'forzar_reanalisis'
            ]);

            // Query base con pólizas activas que tengan client_id (exclusión de empresas por heurística en runtime)
            $query = Poliza::where('broker_id', $brokerId)
                ->where('status', 'active')
                ->whereNotNull('client_id')
                ->with(['client', 'assignedUser', 'ramo', 'aseguradora']);

            // Aplicar filtros
            if (isset($filtros['vendedor_id'])) {
                $query->where('assigned_user_id', $filtros['vendedor_id']);
            }

            if (isset($filtros['cliente_id'])) {
                $query->where('client_id', $filtros['cliente_id']);
            }

            $polizas = $query->get();

            Log::info("Procesando " . count($polizas) . " pólizas activas");

            // Procesar cada póliza con IA
            $oportunidades = [];
            $forzarReanalisis = $filtros['forzar_reanalisis'] ?? false;

            foreach ($polizas as $poliza) {
                try {
                    // Saltar pólizas sin client_id
                    if (!$poliza->client_id) {
                        Log::warning("Póliza {$poliza->id} no tiene client_id, saltando");
                        continue;
                    }

                    // Excluir empresas (clientes jurídicos) por heurística
                    $cliente = $poliza->client;
                    if ($this->esEmpresa($cliente)) {
                        Log::info("Póliza {$poliza->id} pertenece a cliente empresa, excluida del análisis");
                        continue;
                    }
 
                    // Si se fuerza reanálisis, invalidar caché
                    if ($forzarReanalisis) {
                        VentasCruzadasAnalisis::where('poliza_id', $poliza->id)
                            ->update(['vigente' => false]);
                    }

                    // Analizar con IA (usa caché si está disponible)
                    $recomendaciones = $this->iaService->analizarPoliza($poliza);

                    // Convertir recomendaciones a formato de oportunidades
                    foreach ($recomendaciones as $index => $rec) {
                        $oportunidades[] = $this->convertirRecomendacionAOportunidad(
                            $rec,
                            $poliza,
                            $index
                        );
                    }
                } catch (\Exception $e) {
                    Log::error("Error procesando póliza {$poliza->id}: " . $e->getMessage());
                    continue;
                }
            }

            // Aplicar filtros adicionales
            $oportunidades = $this->aplicarFiltros($oportunidades, $filtros);

            // Ordenar por scoring/probabilidad
            usort($oportunidades, function($a, $b) {
                return ($b['probabilidad'] ?? 0) <=> ($a['probabilidad'] ?? 0);
            });

            Log::info("Generadas " . count($oportunidades) . " oportunidades");

            // Paginación como en Pólizas: per_page y page
            $perPage = (int) ($request->input('per_page', 15));
            if ($perPage <= 0) { $perPage = 15; }
            $currentPage = max(1, (int) ($request->input('page', 1)));

            $total = count($oportunidades);
            $lastPage = max(1, (int) ceil($total / $perPage));
            $offset = ($currentPage - 1) * $perPage;
            $dataPage = array_slice($oportunidades, $offset, $perPage);

            $from = $total > 0 ? ($offset + 1) : 0;
            $to = min($offset + count($dataPage), $total);

            return response()->json([
                'success' => true,
                'data' => $dataPage,
                'total' => $total,
                'current_page' => $currentPage,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'from' => $from,
                'to' => $to,
                'metadata' => [
                    'polizas_analizadas' => count($polizas),
                    'usa_cache' => !$forzarReanalisis
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo oportunidades de ventas cruzadas: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error al obtener oportunidades de ventas cruzadas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Convertir recomendación de IA a formato de oportunidad
     */
    private function convertirRecomendacionAOportunidad(array $recomendacion, Poliza $poliza, int $index): array
    {
        $cliente = $poliza->client;
        $probabilidad = ($recomendacion['probabilidad_conversion'] ?? 0.5) * 100;

        $nombreCliente = $poliza->client_name;
        if ($cliente) {
            $nombreCliente = trim(
                ($cliente->client_name ?? $cliente->nombres ?? $cliente->first_name ?? '') . ' ' .
                ($cliente->apellidos ?? $cliente->last_name ?? '')
            );
        }

        return [
            'id' => "OP-{$poliza->id}-{$index}",
            'cliente' => $nombreCliente ?: 'Cliente',
            'cliente_id' => $poliza->client_id,
            'polizaActual' => $poliza->policy_number ?? $poliza->internal_number ?? 'POL-' . $poliza->id,
            'tipoActual' => $poliza->ramo ? $poliza->ramo->nombre : ($poliza->type ?? 'Desconocido'),
            'oportunidad' => $recomendacion['producto'] ?? 'Producto recomendado',
            'tipoOportunidad' => $this->determinarTipoOportunidad($recomendacion['producto'] ?? ''),
            'scoring' => round($probabilidad),
            'probabilidad' => round($probabilidad),
            'valorEstimado' => $this->estimarValor($recomendacion),
            'razonamiento' => $recomendacion['motivo'] ?? '',
            'estado' => $this->mapearNivelUrgencia($recomendacion['nivel_urgencia'] ?? 'Media'),
            'estadoColor' => $this->getEstadoColor($this->mapearNivelUrgencia($recomendacion['nivel_urgencia'] ?? 'Media')),
            'fechaDeteccion' => now()->format('d/m/Y'),
            'accionRecomendada' => $recomendacion['canal_recomendado'] ?? 'WhatsApp',
            'vendedor_id' => $poliza->assigned_user_id,
            'vendedor_nombre' => $poliza->assignedUser ? $poliza->assignedUser->name : $poliza->seller_name,
            'mensaje_ia' => $recomendacion['mensaje'] ?? '',
            'cta' => $recomendacion['cta'] ?? 'Más información',
            'proteccion_complementaria' => $recomendacion['proteccion_complementaria'] ?? '',
            'aseguradora_recomendada' => $recomendacion['aseguradora'] ?? ''
        ];
    }

    /**
     * Determinar tipo de oportunidad basado en el nombre del producto
     */
    private function determinarTipoOportunidad(string $producto): string
    {
        $producto = strtolower($producto);
        
        if (str_contains($producto, 'vida')) return 'vida';
        if (str_contains($producto, 'hogar') || str_contains($producto, 'vivienda')) return 'hogar';
        if (str_contains($producto, 'salud') || str_contains($producto, 'médico')) return 'salud';
        if (str_contains($producto, 'empresarial') || str_contains($producto, 'pyme')) return 'empresarial';
        if (str_contains($producto, 'auto') || str_contains($producto, 'soat') || str_contains($producto, 'vehicular')) return 'auto';
        
        return 'otro';
    }

    /**
     * Estimar valor del producto recomendado
     */
    private function estimarValor(array $recomendacion): string
    {
        $producto = strtolower($recomendacion['producto'] ?? '');
        
        // Estimaciones basadas en promedios del mercado colombiano
        $valor = 2000000; // Valor por defecto
        
        if (str_contains($producto, 'vida')) {
            $valor = rand(1500000, 4000000);
        } elseif (str_contains($producto, 'hogar')) {
            $valor = rand(1000000, 3000000);
        } elseif (str_contains($producto, 'salud')) {
            $valor = rand(2000000, 5000000);
        } elseif (str_contains($producto, 'soat')) {
            $valor = rand(400000, 800000);
        } elseif (str_contains($producto, 'empresarial')) {
            $valor = rand(5000000, 15000000);
        }

        return '$' . number_format($valor, 0, ',', '.');
    }

    /**
     * Mapear nivel de urgencia a prioridad
     */
    private function mapearNivelUrgencia(string $urgencia): string
    {
        switch (strtolower($urgencia)) {
            case 'alta':
                return 'Alta Prioridad';
            case 'media':
                return 'Media Prioridad';
            case 'baja':
                return 'Baja Prioridad';
            default:
                return 'Media Prioridad';
        }
    }

    /**
     * Obtener color del estado
     */
    private function getEstadoColor(string $estado): string
    {
        switch ($estado) {
            case 'Crítica':
                return 'purple';
            case 'Alta Prioridad':
                return 'failure';
            case 'Media Prioridad':
                return 'warning';
            case 'Baja Prioridad':
                return 'info';
            default:
                return 'gray';
        }
    }

    /**
     * Aplicar filtros a las oportunidades
     */
    private function aplicarFiltros(array $oportunidades, array $filtros): array
    {
        if (isset($filtros['tipo_oportunidad'])) {
            $oportunidades = array_filter($oportunidades, function($op) use ($filtros) {
                return $op['tipoOportunidad'] === $filtros['tipo_oportunidad'];
            });
        }

        if (isset($filtros['prioridad'])) {
            $oportunidades = array_filter($oportunidades, function($op) use ($filtros) {
                return $op['estado'] === $filtros['prioridad'];
            });
        }

        if (isset($filtros['scoring_min'])) {
            $oportunidades = array_filter($oportunidades, function($op) use ($filtros) {
                return $op['scoring'] >= $filtros['scoring_min'];
            });
        }

        if (isset($filtros['scoring_max'])) {
            $oportunidades = array_filter($oportunidades, function($op) use ($filtros) {
                return $op['scoring'] <= $filtros['scoring_max'];
            });
        }

        return array_values($oportunidades);
    }

    /**
     * Determinar si un cliente es empresa (jurídica) usando heurísticas robustas.
     */
    private function esEmpresa(?Cliente $cliente): bool
    {
        if (!$cliente) {
            return false;
        }

        // 1) Tipo de persona explícito
        $tipoPersona = strtolower((string)($cliente->tipo_persona ?? $cliente->tipoCliente ?? $cliente->tipo ?? ''));
        if (in_array($tipoPersona, ['juridica','empresa','company','corporativo'])) {
            return true;
        }

        // 2) Tipo de documento típico de empresas
        $docType = strtoupper((string)($cliente->tipo_documento ?? $cliente->document_type ?? ''));
        if (in_array($docType, ['NIT','RUT'])) {
            return true;
        }

        // 3) Heurística por razón social / nombre
        $razon = (string)($cliente->razon_social ?? $cliente->company_legal_name ?? '');
        $nombre = (string)($cliente->client_name ?? $cliente->nombres ?? '');
        $texto = strtoupper(trim($razon !== '' ? $razon : $nombre));
        if ($texto !== '') {
            $patrones = [
                ' S.A', ' S.A.', ' SAS', ' S.A.S', ' S.A.S.', ' LTDA', ' LTDA.', ' CIA', ' CIA.',
                ' COMPAÑIA', ' COMPAÑÍA', ' COMPANIA', ' EMPRESA', ' CORP', ' CORPORACION', ' CORPORACIÓN',
                ' INDUSTRIA', ' E.U', ' E.U.'
            ];
            foreach ($patrones as $p) {
                if (str_contains($texto, $p)) {
                    return true;
                }
            }
        }

        // 4) Flags explícitos
        $flag = (bool)($cliente->es_empresa ?? $cliente->is_company ?? false);
        if ($flag) return true;

        return false;
    }
 
    /**
     * Obtener estadísticas de oportunidades
     */
    public function getEstadisticas(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // IMPORTANTE: NO volver a llamar getOportunidades() para evitar reprocesar.
            // Tomamos los análisis vigentes de caché y calculamos sobre sus recomendaciones.
            $analisis = VentasCruzadasAnalisis::forBroker($brokerId)
                ->vigente()
                ->get(['recomendaciones']);

            $total = 0;
            $altaPrioridad = 0;
            $valorTotalEstimado = 0;
            $scoringSum = 0;
            $scoringCount = 0;

            $porTipo = [
                'vida' => 0,
                'hogar' => 0,
                'salud' => 0,
                'empresarial' => 0,
                'auto' => 0,
            ];

            foreach ($analisis as $a) {
                $recs = is_array($a->recomendaciones) ? $a->recomendaciones : [];
                foreach ($recs as $rec) {
                    $total++;

                    $nivel = strtolower($rec['nivel_urgencia'] ?? '');
                    if (in_array($nivel, ['alta', 'crítica', 'critica'])) {
                        $altaPrioridad++;
                    }

                    // Reutilizamos el estimador existente para cada recomendación y sumamos su valor numérico
                    $valorStr = $this->estimarValor($rec);
                    $valorNum = (int) preg_replace('/[^\d]/', '', (string) $valorStr);
                    $valorTotalEstimado += $valorNum;

                    $prob = isset($rec['probabilidad_conversion']) ? (float) $rec['probabilidad_conversion'] : 0.0;
                    $scoringSum += ($prob * 100);
                    $scoringCount++;

                    $tipo = $this->determinarTipoOportunidad((string) ($rec['producto'] ?? ''));
                    if (isset($porTipo[$tipo])) {
                        $porTipo[$tipo]++;
                    }
                }
            }

            $scoringPromedio = $scoringCount > 0 ? $scoringSum / $scoringCount : 0;

            $estadisticas = [
                'total_oportunidades' => $total,
                'alta_prioridad' => $altaPrioridad,
                'valor_total_estimado' => $valorTotalEstimado,
                'scoring_promedio' => $scoringPromedio,
                'por_tipo' => $porTipo,
                'estadisticas_ia' => $this->iaService->obtenerEstadisticasIA($brokerId),
            ];

            return response()->json([
                'success' => true,
                'data' => $estadisticas
            ]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo estadísticas de ventas cruzadas: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Forzar reanálisis de todas las pólizas
     */
    public function forzarReanalisis(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // Invalidar todos los análisis vigentes
            $invalidados = VentasCruzadasAnalisis::forBroker($brokerId)
                ->vigente()
                ->update(['vigente' => false]);

            Log::info("Invalidados {$invalidados} análisis para broker {$brokerId}");

            // Obtener nuevas oportunidades (esto generará nuevos análisis)
            $request->merge(['forzar_reanalisis' => true]);
            return $this->getOportunidades($request);

        } catch (\Exception $e) {
            Log::error('Error forzando reanálisis: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error al forzar reanálisis',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Ejecutar acción sobre una oportunidad
     */
    public function ejecutarAccion(Request $request, $oportunidadId)
    {
        try {
            $accion = $request->input('accion');
            $datos = $request->input('datos', []);

            // Aquí se implementarían las acciones específicas:
            // - crear_campana_whatsapp
            // - enviar_email
            // - crear_tarea_seguimiento
            // - generar_cotizacion

            Log::info("Ejecutando acción {$accion} para oportunidad {$oportunidadId}", [
                'datos' => $datos,
                'broker_id' => $this->getBrokerId($request)
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Acción ejecutada exitosamente'
            ]);

        } catch (\Exception $e) {
            Log::error('Error ejecutando acción en ventas cruzadas: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Error al ejecutar la acción',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener broker ID del contexto actual
     */
    private function getBrokerId(Request $request)
    {
        // Intentar obtener de diferentes fuentes
        $brokerId = $request->get('authenticated_broker_id') 
            ?? $request->get('broker_id')
            ?? $request->header('X-Dev-Broker-Id')
            ?? session('broker_id');

        // Si hay usuario autenticado
        if (!$brokerId && auth()->check()) {
            $brokerId = auth()->user()->broker_id;
        }

        // Si hay request user
        if (!$brokerId && $request->user()) {
            $brokerId = $request->user()->broker_id;
        }

        // Fallback para desarrollo
        if (!$brokerId && app()->environment(['local', 'development'])) {
            $brokerId = env('DEV_FALLBACK_BROKER_ID', 2);
        }

        if (!$brokerId) {
            throw new \Exception('No se pudo determinar el broker_id');
        }

        return $brokerId;
    }
}