<?php

namespace App\Services;

use App\Models\Cliente;
use App\Models\Poliza;
use App\Models\Automovil;
use App\Models\Ramo;
use App\Models\Aseguradora;
use App\Models\VentasCruzadasAnalisis;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;

class VentasCruzadasIAService
{
    private $aiApiKey;
    private $aiApiUrl;

    public function __construct()
    {
        // Variables de entorno genéricas para no exponer proveedor
        $this->aiApiKey = env('AI_API_KEY', env('DEEPSEEK_API_KEY'));
        $this->aiApiUrl = env('AI_API_URL', env('DEEPSEEK_API_URL'));
    }

    /**
     * Analizar oportunidades de ventas cruzadas para una póliza usando IA
     */
    public function analizarPoliza(Poliza $poliza): array
    {
        try {
            // Verificar si ya existe un análisis vigente
            $analisisExistente = VentasCruzadasAnalisis::where('poliza_id', $poliza->id)
                ->where('broker_id', $poliza->broker_id)
                ->vigente()
                ->first();

            if ($analisisExistente && !$analisisExistente->necesitaActualizacion()) {
                Log::info("Usando análisis en caché para póliza {$poliza->id}");
                $analisisExistente->incrementarConsultas();
                return $analisisExistente->recomendaciones;
            }

            // Invalidar análisis anterior si existe
            if ($analisisExistente) {
                $analisisExistente->invalidar();
            }

            // Preparar datos de entrada incluyendo catálogo del broker
            $catalogoBroker = $this->obtenerCatalogoBroker($poliza->broker_id);
            $datosEntrada = $this->prepararDatosEntrada($poliza, $catalogoBroker);
 
            // Llamar al proveedor de IA para análisis
            $recomendaciones = $this->analizarConIA($datosEntrada);
 
            // Si no hay recomendaciones, no re-procesar ni guardar
            if (empty($recomendaciones)) {
                Log::info("IA sin recomendaciones para póliza {$poliza->id}, no se crea análisis");
                return [];
            }
 
            // Calcular scoring promedio
            $scoringPromedio = $this->calcularScoringPromedio($recomendaciones);

            // Guardar análisis en base de datos solo si hay client_id
            if (!$poliza->client_id) {
                Log::warning("Póliza {$poliza->id} no tiene client_id, saltando guardado en BD");
                return $recomendaciones;
            }

            $analisis = VentasCruzadasAnalisis::create([
                'broker_id' => $poliza->broker_id,
                'cliente_id' => $poliza->client_id,
                'poliza_id' => $poliza->id,
                'datos_entrada' => $datosEntrada,
                'recomendaciones' => $recomendaciones,
                'scoring_promedio' => $scoringPromedio,
                'modelo_ia' => 'ia',
                'fecha_analisis' => now(),
                'vigente' => true,
                'valido_hasta' => now()->addDays(30), // Válido por 30 días
                'veces_consultado' => 1,
                'ultima_consulta' => now()
            ]);

            Log::info("Análisis IA creado para póliza {$poliza->id}", [
                'analisis_id' => $analisis->id,
                'recomendaciones_count' => count($recomendaciones),
                'scoring_promedio' => $scoringPromedio
            ]);

            return $recomendaciones;

        } catch (\Exception $e) {
            Log::error("Error analizando póliza {$poliza->id} con IA: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Obtener catálogo de productos del broker (ramos y aseguradoras disponibles)
     */
    private function obtenerCatalogoBroker(int $brokerId): array
    {
        // Cachear por 1 hora para no consultar en cada análisis
        return Cache::remember("broker_{$brokerId}_catalogo", 3600, function() use ($brokerId) {
            // Obtener ramos que el broker maneja (basado en pólizas activas)
            $ramosActivos = Poliza::where('broker_id', $brokerId)
                ->where('status', 'active')
                ->whereNotNull('ramo_id')
                ->with('ramo')
                ->get()
                ->pluck('ramo')
                ->filter()
                ->unique('id')
                ->map(function($ramo) {
                    return [
                        'id' => $ramo->id,
                        'nombre' => $ramo->nombre,
                        'categoria' => $this->categorizarRamo($ramo->nombre)
                    ];
                })
                ->values()
                ->toArray();

            // Obtener aseguradoras que el broker maneja
            $aseguradoras = Poliza::where('broker_id', $brokerId)
                ->where('status', 'active')
                ->whereNotNull('aseguradora_id')
                ->with('aseguradora')
                ->get()
                ->pluck('aseguradora')
                ->filter()
                ->unique('id')
                ->map(function($aseg) {
                    return [
                        'id' => $aseg->id,
                        'nombre' => $aseg->nombre ?? $aseg->name ?? 'N/A'
                    ];
                })
                ->values()
                ->toArray();

            // Agrupar ramos por categoría para facilitar recomendaciones
            $ramosPorCategoria = collect($ramosActivos)->groupBy('categoria')->map(function($items) {
                return $items->pluck('nombre')->toArray();
            })->toArray();

            return [
                'ramos' => $ramosActivos,
                'aseguradoras' => $aseguradoras,
                'ramos_por_categoria' => $ramosPorCategoria,
                'categorias_disponibles' => array_keys($ramosPorCategoria)
            ];
        });
    }

    /**
     * Categorizar un ramo para facilitar matching
     */
    private function categorizarRamo(string $nombreRamo): string
    {
        $nombre = strtolower($nombreRamo);
        
        if (str_contains($nombre, 'vida') || str_contains($nombre, 'exequial')) {
            return 'vida';
        }
        if (str_contains($nombre, 'auto') || str_contains($nombre, 'soat') || str_contains($nombre, 'vehículo')) {
            return 'autos';
        }
        if (str_contains($nombre, 'hogar') || str_contains($nombre, 'residencial') || str_contains($nombre, 'incendio') || str_contains($nombre, 'copropiedades')) {
            return 'hogar';
        }
        if (str_contains($nombre, 'salud') || str_contains($nombre, 'hospital') || str_contains($nombre, 'accidentes personales')) {
            return 'salud';
        }
        if (str_contains($nombre, 'empresarial') || str_contains($nombre, 'pyme') || str_contains($nombre, 'multirriesgo') || str_contains($nombre, 'cumplimiento') || str_contains($nombre, 'responsabilidad')) {
            return 'empresarial';
        }
        if (str_contains($nombre, 'transporte') || str_contains($nombre, 'navegacion') || str_contains($nombre, 'carga')) {
            return 'transporte';
        }
        
        return 'otros';
    }

    /**
     * Preparar datos de entrada para el análisis de IA
     */
    private function prepararDatosEntrada(Poliza $poliza, array $catalogoBroker = []): array
    {
        $cliente = $poliza->client;
        
        // Datos del cliente
    $datosCliente = [
        'tipo_cliente' => ($cliente->tipo_persona ?? 'natural') === 'juridica' ? 'empresa' : 'persona',
        'estado' => 'activo',
        'documento' => ($cliente->tipo_documento ?? $cliente->document_type ?? 'CC') . ' ' . ($cliente->numero_documento ?? $cliente->document_number ?? ''),
        'nombre' => ($cliente->tipo_persona ?? 'natural') === 'juridica'
            ? ($cliente->razon_social ?? $cliente->company_legal_name ?? $cliente->client_name ?? $poliza->client_name)
            : trim(($cliente->nombres ?? $cliente->first_name ?? '') . ' ' . ($cliente->apellidos ?? $cliente->last_name ?? '')),
        'fecha_nacimiento' => $cliente->fecha_nacimiento ? \Carbon\Carbon::parse($cliente->fecha_nacimiento)->format('Y-m-d') : null,
        'fecha_registro' => $cliente->created_at ? \Carbon\Carbon::parse($cliente->created_at)->format('Y-m-d') : now()->format('Y-m-d'),
        'contacto' => [
            'email' => $cliente->email ?? '',
            'telefono' => $cliente->telefono ?? $cliente->phone ?? '',
            'celular' => $cliente->celular ?? $cliente->mobile ?? '',
            'direccion' => $cliente->direccion ?? $cliente->address ?? '',
            'ciudad' => $cliente->ciudad ?? $cliente->city ?? '',
            'departamento' => $cliente->departamento ?? $cliente->state ?? '',
            'pais' => $cliente->pais ?? $cliente->country ?? 'Colombia'
        ]
    ];

        // Todas las pólizas del cliente
        $todasPolizas = Poliza::where('client_id', $poliza->client_id)
            ->where('broker_id', $poliza->broker_id)
            ->with(['ramo', 'aseguradora'])
            ->get();

        $polizasData = $todasPolizas->map(function($p) {
            return [
                'numero' => $p->policy_number ?? $p->internal_number ?? 'POL-' . $p->id,
                'aseguradora' => $p->aseguradora ? $p->aseguradora->nombre : ($p->insurance_company ?? 'Desconocida'),
                'ramo' => $p->ramo ? $p->ramo->nombre : ($p->type ?? 'Desconocido'),
                'estado' => ucfirst($p->status ?? 'active'),
                'prima_neta' => $p->premium_amount ?? 0,
                'iva' => $p->vat_amount ?? 0,
                'total' => $p->total_amount ?? 0,
                'vigencia_inicio' => $p->start_date ? \Carbon\Carbon::parse($p->start_date)->format('Y-m-d') : null,
                'vigencia_fin' => $p->end_date ? \Carbon\Carbon::parse($p->end_date)->format('Y-m-d') : null,
                'forma_pago' => $p->payment_frequency ?? 'Anual'
            ];
        })->toArray();

        // Vehículos del cliente
        $vehiculos = Automovil::where('client_id', $cliente->id)->get();
        $vehiculosData = $vehiculos->map(function($v) {
            return [
                'placa' => $v->placa ?? '',
                'marca' => $v->marca ?? '',
                'modelo' => $v->anio ?? null,
                'uso' => 'particular', // Por defecto
                'valor_comercial' => $v->valor_asegurado ?? 0,
                'tiene_soat_vigente' => false, // Verificar con pólizas
                'aseguradora_anterior' => null
            ];
        })->toArray();

        // Historial
        $productosUnicos = $todasPolizas->pluck('ramo.nombre')->filter()->unique()->values()->toArray();
        
        $historial = [
            'productos_previos' => $productosUnicos,
            'siniestralidad' => 0, // TODO: Calcular desde siniestros reales
            'nivel_interaccion' => 'medio',
            'medio_preferido_contacto' => $cliente->celular ? 'WhatsApp' : 'Correo'
        ];

        // Contexto
        $contexto = [
            'canales_disponibles' => ['WhatsApp', 'Correo', 'Llamada'],
            'fecha_actual' => now()->format('Y-m-d'),
            'moneda' => 'COP'
        ];

        return [
            'cliente' => $datosCliente,
            'polizas' => $polizasData,
            'vehiculos' => $vehiculosData,
            'historial' => $historial,
            'contexto' => $contexto,
            'catalogo_broker' => $catalogoBroker
        ];
    }

    /**
     * Analizar con DeepSeek API
     */
    private function analizarConIA(array $datosEntrada): array
    {
        if (!$this->aiApiKey || !$this->aiApiUrl) {
            Log::warning('Proveedor IA no configurado, usando análisis básico');
            return $this->analisisBasicoFallback($datosEntrada);
        }

        try {
            $prompt = $this->construirPrompt($datosEntrada);

            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->aiApiKey,
                'Content-Type' => 'application/json',
            ])->timeout(30)->post($this->aiApiUrl, [
                'model' => env('AI_MODEL', 'assistant'),
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'Eres un experto asesor de seguros en Colombia. Analiza el perfil del cliente y sus pólizas actuales para recomendar productos complementarios de ventas cruzadas. Responde ÚNICAMENTE con un JSON válido sin texto adicional.'
                    ],
                    [
                        'role' => 'user',
                        'content' => $prompt
                    ]
                ],
                'temperature' => 0.7,
                'max_tokens' => 2000,
                'response_format' => ['type' => 'json_object']
            ]);

            if (!$response->successful()) {
                Log::error('Error en proveedor IA', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);
                return $this->analisisBasicoFallback($datosEntrada);
            }

            $resultado = $response->json();
            $contenido = $resultado['choices'][0]['message']['content'] ?? '{}';

            $analisisIA = json_decode($contenido, true);

            if (!isset($analisisIA['recomendaciones']) || !is_array($analisisIA['recomendaciones'])) {
                Log::warning('Respuesta de IA no tiene formato esperado', ['contenido' => $contenido]);
                return $this->analisisBasicoFallback($datosEntrada);
            }

            return $analisisIA['recomendaciones'];

        } catch (\Exception $e) {
            Log::error('Error llamando al proveedor IA: ' . $e->getMessage());
            return $this->analisisBasicoFallback($datosEntrada);
        }
    }

    /**
     * Construir prompt para DeepSeek
     */
    private function construirPrompt(array $datos): string
    {
        // Extraer catálogo del broker para el prompt
        $catalogoBroker = $datos['catalogo_broker'] ?? [];
        $ramosDisponibles = collect($catalogoBroker['ramos'] ?? [])->pluck('nombre')->implode(', ');
        $aseguradorasDisponibles = collect($catalogoBroker['aseguradoras'] ?? [])->pluck('nombre')->implode(', ');
        $categorias = $catalogoBroker['categorias_disponibles'] ?? [];
        
        // Datos del cliente sin el catálogo (para no duplicar)
        $datosCliente = $datos;
        unset($datosCliente['catalogo_broker']);
        $jsonCliente = json_encode($datosCliente, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        // Productos que ya tiene el cliente
        $productosActuales = collect($datos['polizas'] ?? [])->pluck('ramo')->implode(', ');

        return <<<PROMPT
Eres un asesor experto de seguros en Colombia. Analiza el perfil del cliente para identificar oportunidades de VENTA CRUZADA precisas y relevantes.

## DATOS DEL CLIENTE:
{$jsonCliente}

## PRODUCTOS QUE YA TIENE EL CLIENTE:
{$productosActuales}

## CATÁLOGO DE PRODUCTOS DISPONIBLES DEL BROKER (SOLO PUEDES RECOMENDAR ESTOS):
**Ramos/Productos disponibles:** {$ramosDisponibles}

**Aseguradoras con las que trabajamos:** {$aseguradorasDisponibles}

## REGLAS CRÍTICAS:
1. **SOLO recomienda productos del catálogo del broker** - NO inventes productos que no están en la lista
2. **NO recomiendes productos que el cliente YA TIENE** - Revisa sus pólizas actuales
3. **Prioriza productos complementarios lógicos:**
   - Si tiene SOAT → recomendar Seguro de Autos completo
   - Si tiene Auto → recomendar Vida, Hogar
   - Si tiene Vida → recomendar Salud, Hogar
   - Si tiene Empresarial → recomendar RC Profesional, Cumplimiento
4. **Usa SOLO aseguradoras del catálogo** - Preferir las que el cliente ya usa
5. **Sé específico con el nombre del producto** - Usa el nombre exacto del ramo disponible
6. **Calcula probabilidad realista** basada en:
   - Perfil del cliente (edad, ubicación, tipo)
   - Productos actuales (complementariedad)
   - Valor de primas actuales (capacidad de pago)

## FORMATO DE RESPUESTA (JSON estricto):
{
  "recomendaciones": [
    {
      "producto": "NOMBRE EXACTO del ramo del catálogo",
      "aseguradora": "NOMBRE EXACTO de aseguradora del catálogo",
      "motivo": "Explicación clara y personalizada de por qué este cliente necesita este producto (2-3 líneas)",
      "proteccion_complementaria": "Qué protege que sus pólizas actuales NO cubren",
      "nivel_urgencia": "Alta/Media/Baja",
      "canal_recomendado": "WhatsApp/Correo/Llamada",
      "probabilidad_conversion": 0.XX,
      "mensaje": "Mensaje personalizado para WhatsApp (máx 180 caracteres, incluir nombre del cliente, tono amigable colombiano)",
      "cta": "Acción específica (ej: 'Cotizar mi seguro de vida')"
    }
  ]
}

## INSTRUCCIONES FINALES:
- Genera entre 1 y 3 recomendaciones (solo las más relevantes)
- Si no hay oportunidades claras, devuelve array vacío: {"recomendaciones": []}
- Ordena por probabilidad de conversión (mayor primero)
- El mensaje debe ser natural, no robótico
- Responde SOLO con el JSON, sin texto adicional
PROMPT;
    }

    /**
     * Análisis básico de fallback si DeepSeek no está disponible
     * Usa los productos reales del catálogo del broker
     */
    private function analisisBasicoFallback(array $datosEntrada): array
    {
        $recomendaciones = [];
        $productosActuales = array_map('strtolower', $datosEntrada['historial']['productos_previos'] ?? []);
        $catalogoBroker = $datosEntrada['catalogo_broker'] ?? [];
        $ramosPorCategoria = $catalogoBroker['ramos_por_categoria'] ?? [];
        $aseguradoras = collect($catalogoBroker['aseguradoras'] ?? [])->pluck('nombre')->toArray();
        
        // Aseguradora preferida del cliente o primera disponible
        $aseguradoraCliente = $datosEntrada['polizas'][0]['aseguradora'] ?? ($aseguradoras[0] ?? 'SEGUROS GENERALES SURAMERICANA S.A');
        $nombreCliente = explode(' ', $datosEntrada['cliente']['nombre'] ?? 'Cliente')[0];
        $canalPreferido = $datosEntrada['historial']['medio_preferido_contacto'] ?? 'WhatsApp';

        // Verificar si tiene productos de cada categoría
        $tieneVida = $this->clienteTieneCategoria($productosActuales, ['vida', 'exequial', 'sucapital']);
        $tieneHogar = $this->clienteTieneCategoria($productosActuales, ['hogar', 'residencial', 'incendio', 'copropiedades']);
        $tieneSalud = $this->clienteTieneCategoria($productosActuales, ['salud', 'hospital', 'accidentes']);
        $tieneAuto = $this->clienteTieneCategoria($productosActuales, ['auto', 'soat', 'vehículo']);

        // Recomendar Vida si no tiene y el broker lo ofrece
        if (!$tieneVida && !empty($ramosPorCategoria['vida'])) {
            $productoVida = $ramosPorCategoria['vida'][0] ?? 'VIDA INDIVIDUAL';
            $recomendaciones[] = [
                'producto' => $productoVida,
                'aseguradora' => $this->buscarAseguradoraParaCategoria($aseguradoras, 'vida', $aseguradoraCliente),
                'motivo' => "Protege a tu familia ante cualquier eventualidad. {$productoVida} te brinda tranquilidad financiera.",
                'proteccion_complementaria' => 'Cobertura por fallecimiento, invalidez y enfermedades graves',
                'nivel_urgencia' => 'Alta',
                'canal_recomendado' => $canalPreferido,
                'probabilidad_conversion' => 0.75,
                'mensaje' => "Hola {$nombreCliente} 👋, protege a tu familia con {$productoVida}. ¿Te comparto una cotización? 💚",
                'cta' => 'Cotizar seguro de vida'
            ];
        }

        // Recomendar Hogar si no tiene y el broker lo ofrece
        if (!$tieneHogar && !empty($ramosPorCategoria['hogar'])) {
            $productoHogar = $ramosPorCategoria['hogar'][0] ?? 'MULTIRRIESGO RESIDENCIAL';
            $recomendaciones[] = [
                'producto' => $productoHogar,
                'aseguradora' => $this->buscarAseguradoraParaCategoria($aseguradoras, 'hogar', $aseguradoraCliente),
                'motivo' => "Protege tu vivienda y bienes personales contra incendio, robo y daños naturales.",
                'proteccion_complementaria' => 'Bienes personales, electrodomésticos y estructura de la vivienda',
                'nivel_urgencia' => 'Media',
                'canal_recomendado' => 'Correo',
                'probabilidad_conversion' => 0.65,
                'mensaje' => "Hola {$nombreCliente}, protege tu hogar con {$productoHogar}. Cobertura completa desde $30.000/mes 🏠",
                'cta' => 'Conocer cobertura hogar'
            ];
        }

        // Recomendar Salud si no tiene y el broker lo ofrece
        if (!$tieneSalud && !empty($ramosPorCategoria['salud'])) {
            $productoSalud = $ramosPorCategoria['salud'][0] ?? 'ACCIDENTES PERSONALES';
            $recomendaciones[] = [
                'producto' => $productoSalud,
                'aseguradora' => $this->buscarAseguradoraParaCategoria($aseguradoras, 'salud', $aseguradoraCliente),
                'motivo' => "Complementa tu EPS con cobertura adicional para gastos médicos y accidentes.",
                'proteccion_complementaria' => 'Gastos médicos, hospitalización y accidentes no cubiertos por EPS',
                'nivel_urgencia' => 'Media',
                'canal_recomendado' => $canalPreferido,
                'probabilidad_conversion' => 0.60,
                'mensaje' => "Hola {$nombreCliente}, complementa tu salud con {$productoSalud}. ¿Te cuento más? 🏥",
                'cta' => 'Cotizar seguro de salud'
            ];
        }

        // Recomendar Auto si tiene vehículos, no tiene seguro y el broker lo ofrece
        if (!empty($datosEntrada['vehiculos']) && !$tieneAuto && !empty($ramosPorCategoria['autos'])) {
            $productoAuto = $ramosPorCategoria['autos'][0] ?? 'AUTOMOVILES';
            $recomendaciones[] = [
                'producto' => $productoAuto,
                'aseguradora' => $this->buscarAseguradoraParaCategoria($aseguradoras, 'auto', $aseguradoraCliente),
                'motivo' => "Protege tu vehículo con cobertura todo riesgo, responsabilidad civil y asistencia 24/7.",
                'proteccion_complementaria' => 'Daños propios, robo, responsabilidad civil y asistencia vehicular',
                'nivel_urgencia' => 'Alta',
                'canal_recomendado' => 'WhatsApp',
                'probabilidad_conversion' => 0.80,
                'mensaje' => "Hola {$nombreCliente}, asegura tu vehículo con {$productoAuto}. Cotización sin compromiso 🚗",
                'cta' => 'Cotizar seguro de auto'
            ];
        }

        return array_slice($recomendaciones, 0, 3); // Máximo 3 recomendaciones
    }

    /**
     * Verificar si el cliente tiene productos de una categoría
     */
    private function clienteTieneCategoria(array $productosActuales, array $keywords): bool
    {
        foreach ($productosActuales as $producto) {
            foreach ($keywords as $keyword) {
                if (str_contains($producto, $keyword)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Buscar aseguradora apropiada para una categoría
     */
    private function buscarAseguradoraParaCategoria(array $aseguradoras, string $categoria, string $default): string
    {
        // Mapeo de categorías a aseguradoras preferidas
        $preferencias = [
            'vida' => ['SURAMERICANA', 'BOLIVAR', 'POSITIVA', 'PREVISORA'],
            'hogar' => ['SURAMERICANA', 'BOLIVAR', 'LIBERTY', 'MAPFRE'],
            'salud' => ['SURAMERICANA', 'COLPATRIA', 'ALLIANZ'],
            'auto' => ['SURAMERICANA', 'LIBERTY', 'BOLIVAR', 'HDI', 'MAPFRE']
        ];

        $preferidas = $preferencias[$categoria] ?? [];
        
        foreach ($preferidas as $preferida) {
            foreach ($aseguradoras as $aseg) {
                if (str_contains(strtoupper($aseg), $preferida)) {
                    return $aseg;
                }
            }
        }

        return $default;
    }

    /**
     * Calcular scoring promedio de las recomendaciones
     */
    private function calcularScoringPromedio(array $recomendaciones): float
    {
        if (empty($recomendaciones)) {
            return 0;
        }

        $suma = array_reduce($recomendaciones, function($carry, $rec) {
            return $carry + ($rec['probabilidad_conversion'] ?? 0);
        }, 0);

        return round(($suma / count($recomendaciones)) * 100, 2);
    }

    /**
     * Obtener análisis para múltiples pólizas
     */
    public function analizarMultiplesPolizas(array $polizas): array
    {
        $resultados = [];

        foreach ($polizas as $poliza) {
            try {
                $recomendaciones = $this->analizarPoliza($poliza);
                
                if (!empty($recomendaciones)) {
                    $cliente = $poliza->client;
                    $resultados[] = [
                        'poliza_id' => $poliza->id,
                        'cliente_id' => $poliza->client_id,
                        'cliente_nombre' => $cliente ? ($cliente->client_name ?? $cliente->nombres ?? 'Cliente') : $poliza->client_name,
                        'poliza_numero' => $poliza->policy_number ?? $poliza->internal_number ?? 'POL-' . $poliza->id,
                        'recomendaciones' => $recomendaciones
                    ];
                }
            } catch (\Exception $e) {
                Log::error("Error procesando póliza {$poliza->id}: " . $e->getMessage());
                continue;
            }
        }

        return $resultados;
    }

    /**
     * Invalidar análisis antiguos (ejecutar periódicamente)
     */
    public function limpiarAnalisisAntiguos(int $diasAntiguedad = 60): int
    {
        return VentasCruzadasAnalisis::where('fecha_analisis', '<', now()->subDays($diasAntiguedad))
            ->update(['vigente' => false]);
    }

    /**
     * Obtener estadísticas de uso del sistema de IA
     */
    public function obtenerEstadisticasIA(int $brokerId): array
    {
        $analisis = VentasCruzadasAnalisis::forBroker($brokerId);

        return [
            'total_analisis' => $analisis->count(),
            'analisis_vigentes' => $analisis->vigente()->count(),
            'total_consultas' => $analisis->sum('veces_consultado'),
            'scoring_promedio_global' => $analisis->vigente()->avg('scoring_promedio'),
            'ultimo_analisis' => $analisis->latest('fecha_analisis')->first()?->fecha_analisis,
            'recomendaciones_generadas' => $analisis->vigente()->get()->sum(function($a) {
                return count($a->recomendaciones);
            })
        ];
    }
}