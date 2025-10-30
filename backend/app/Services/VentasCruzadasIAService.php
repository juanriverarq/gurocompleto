<?php

namespace App\Services;

use App\Models\Cliente;
use App\Models\Poliza;
use App\Models\Automovil;
use App\Models\VentasCruzadasAnalisis;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
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

            // Preparar datos de entrada
            $datosEntrada = $this->prepararDatosEntrada($poliza);
 
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
     * Preparar datos de entrada para el análisis de IA
     */
    private function prepararDatosEntrada(Poliza $poliza): array
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
            'contexto' => $contexto
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
        $json = json_encode($datos, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        return <<<PROMPT
Analiza el siguiente perfil de cliente y sus pólizas actuales para identificar oportunidades de ventas cruzadas en Colombia:

{$json}

Genera recomendaciones de productos de seguros complementarios que NO tenga actualmente. Para cada recomendación incluye:

1. **producto**: Nombre del seguro recomendado
2. **aseguradora**: Aseguradora sugerida (preferir las que ya usa el cliente)
3. **motivo**: Explicación clara de por qué necesita este seguro (2-3 líneas)
4. **proteccion_complementaria**: Qué cubre que sus pólizas actuales no cubren
5. **nivel_urgencia**: Alta/Media/Baja
6. **canal_recomendado**: WhatsApp/Correo/Llamada (según perfil del cliente)
7. **probabilidad_conversion**: Número entre 0 y 1 (ej: 0.85 = 85%)
8. **mensaje**: Mensaje personalizado para contactar al cliente (máximo 200 caracteres, tono amigable)
9. **cta**: Call-to-action específico (ej: "Cotizar mi seguro de vida")

Responde ÚNICAMENTE con este JSON (sin markdown, sin explicaciones):
{
  "recomendaciones": [
    {
      "producto": "...",
      "aseguradora": "...",
      "motivo": "...",
      "proteccion_complementaria": "...",
      "nivel_urgencia": "...",
      "canal_recomendado": "...",
      "probabilidad_conversion": 0.XX,
      "mensaje": "...",
      "cta": "..."
    }
  ]
}

Genera entre 2 y 4 recomendaciones priorizadas por urgencia y probabilidad de conversión.
PROMPT;
    }

    /**
     * Análisis básico de fallback si DeepSeek no está disponible
     */
    private function analisisBasicoFallback(array $datosEntrada): array
    {
        $recomendaciones = [];
        $productosActuales = array_map('strtolower', $datosEntrada['historial']['productos_previos'] ?? []);

        // Seguro de Vida
        if (!in_array('vida', $productosActuales)) {
            $recomendaciones[] = [
                'producto' => 'Seguro de Vida Individual',
                'aseguradora' => $datosEntrada['polizas'][0]['aseguradora'] ?? 'Suramericana',
                'motivo' => 'Protege a tu familia ante cualquier eventualidad. Complementa tu cobertura actual con protección por fallecimiento o invalidez.',
                'proteccion_complementaria' => 'Cobertura por fallecimiento o invalidez por enfermedad',
                'nivel_urgencia' => 'Alta',
                'canal_recomendado' => $datosEntrada['historial']['medio_preferido_contacto'] ?? 'WhatsApp',
                'probabilidad_conversion' => 0.75,
                'mensaje' => 'Hola ' . explode(' ', $datosEntrada['cliente']['nombre'])[0] . ' 👋, protege a tu familia con un Seguro de Vida desde $25.000 mensuales 💚.',
                'cta' => 'Cotizar mi seguro de vida'
            ];
        }

        // SOAT si tiene vehículos
        if (!empty($datosEntrada['vehiculos']) && !in_array('soat', $productosActuales)) {
            $recomendaciones[] = [
                'producto' => 'SOAT y Asistencia Vehicular',
                'aseguradora' => 'AXA Colpatria',
                'motivo' => 'El SOAT es obligatorio y puede complementarse con asistencia en carretera y grúa 24/7.',
                'proteccion_complementaria' => 'Cobertura legal y asistencia vehicular',
                'nivel_urgencia' => 'Alta',
                'canal_recomendado' => 'WhatsApp',
                'probabilidad_conversion' => 0.9,
                'mensaje' => 'Renueva tu SOAT y agrega asistencia vehicular 24/7. Ahorra tiempo y evita sanciones 🚗.',
                'cta' => 'Renovar mi SOAT ahora'
            ];
        }

        // Seguro de Hogar
        if (!in_array('hogar', $productosActuales)) {
            $recomendaciones[] = [
                'producto' => 'Seguro de Hogar',
                'aseguradora' => 'SURA',
                'motivo' => 'Protege tu vivienda, electrodomésticos y bienes personales contra incendio, robo y daños.',
                'proteccion_complementaria' => 'Bienes personales y vivienda',
                'nivel_urgencia' => 'Media',
                'canal_recomendado' => 'Correo',
                'probabilidad_conversion' => 0.65,
                'mensaje' => 'Protege tu hogar y tus electrodomésticos con cobertura completa y asistencia 24/7.',
                'cta' => 'Conoce tu cobertura'
            ];
        }

        return $recomendaciones;
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