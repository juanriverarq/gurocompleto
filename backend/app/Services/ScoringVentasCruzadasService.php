<?php

namespace App\Services;

use App\Models\Cliente;
use App\Models\Poliza;
use App\Models\Siniestro;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

/**
 * Servicio de Scoring Profesional para Ventas Cruzadas
 * 
 * Arquitectura basada en 5 dimensiones medibles:
 * 1. PERFIL DEL CLIENTE (datos demográficos y financieros)
 * 2. COMPORTAMIENTO HISTÓRICO (pagos, renovaciones, siniestros)
 * 3. ENGAGEMENT (interacciones, respuestas, canales)
 * 4. OPORTUNIDAD (timing, complementariedad, ciclo de vida)
 * 5. CONTEXTO EXTERNO (temporada, eventos, mercado)
 */
class ScoringVentasCruzadasService
{
    // Pesos de cada dimensión (deben sumar 100)
    private const PESO_PERFIL = 20;
    private const PESO_COMPORTAMIENTO = 30;
    private const PESO_ENGAGEMENT = 15;
    private const PESO_OPORTUNIDAD = 25;
    private const PESO_CONTEXTO = 10;

    /**
     * Calcular score total de una oportunidad de venta cruzada
     */
    public function calcularScore(Poliza $poliza, ?Cliente $cliente, array $recomendacion): array
    {
        $dimensiones = [
            'perfil' => $this->calcularScorePerfil($cliente, $poliza),
            'comportamiento' => $this->calcularScoreComportamiento($cliente, $poliza),
            'engagement' => $this->calcularScoreEngagement($cliente),
            'oportunidad' => $this->calcularScoreOportunidad($poliza, $recomendacion),
            'contexto' => $this->calcularScoreContexto($recomendacion),
        ];

        // Calcular score ponderado
        $scoreTotal = 
            ($dimensiones['perfil']['score'] * self::PESO_PERFIL / 100) +
            ($dimensiones['comportamiento']['score'] * self::PESO_COMPORTAMIENTO / 100) +
            ($dimensiones['engagement']['score'] * self::PESO_ENGAGEMENT / 100) +
            ($dimensiones['oportunidad']['score'] * self::PESO_OPORTUNIDAD / 100) +
            ($dimensiones['contexto']['score'] * self::PESO_CONTEXTO / 100);

        // Recopilar todos los factores
        $factores = [];
        foreach ($dimensiones as $dim => $data) {
            foreach ($data['factores'] as $factor) {
                $factores[] = $factor;
            }
        }

        return [
            'score_total' => round($scoreTotal),
            'dimensiones' => $dimensiones,
            'factores_principales' => array_slice($factores, 0, 5),
            'confianza' => $this->calcularNivelConfianza($dimensiones),
            'recomendacion_accion' => $this->recomendarAccion($scoreTotal, $dimensiones)
        ];
    }

    /**
     * DIMENSIÓN 1: PERFIL DEL CLIENTE
     * Evalúa características demográficas y capacidad financiera
     */
    private function calcularScorePerfil(?Cliente $cliente, Poliza $poliza): array
    {
        $score = 50;
        $factores = [];

        if (!$cliente) {
            return ['score' => 30, 'factores' => ['Sin datos de cliente']];
        }

        // 1.1 Antigüedad como cliente (máx +20)
        if ($cliente->created_at) {
            $antiguedadMeses = now()->diffInMonths($cliente->created_at);
            if ($antiguedadMeses >= 36) {
                $score += 20;
                $factores[] = "✓ Cliente fiel (+3 años)";
            } elseif ($antiguedadMeses >= 24) {
                $score += 15;
                $factores[] = "✓ Cliente establecido (2-3 años)";
            } elseif ($antiguedadMeses >= 12) {
                $score += 10;
                $factores[] = "○ Cliente reciente (1-2 años)";
            } else {
                $score += 5;
                $factores[] = "○ Cliente nuevo (<1 año)";
            }
        }

        // 1.2 Tipo de cliente (persona vs empresa)
        $tipoCliente = $cliente->client_type ?? 'persona';
        if ($tipoCliente === 'empresa') {
            $score += 10; // Empresas suelen tener más necesidades
            $factores[] = "✓ Cliente empresarial";
        }

        // 1.3 Valor de cartera actual (primas totales)
        $valorCartera = Poliza::where('client_id', $cliente->id)
            ->where('status', 'active')
            ->sum('premium_amount');
        
        if ($valorCartera >= 10000000) {
            $score += 15;
            $factores[] = "✓ Cartera alta (>$10M)";
        } elseif ($valorCartera >= 5000000) {
            $score += 10;
            $factores[] = "✓ Cartera media ($5M-$10M)";
        } elseif ($valorCartera >= 1000000) {
            $score += 5;
            $factores[] = "○ Cartera básica ($1M-$5M)";
        }

        // 1.4 Completitud de datos (contactabilidad)
        $completitud = $this->calcularCompletitudDatos($cliente);
        $score += $completitud['puntos'];
        $factores[] = $completitud['factor'];

        return [
            'score' => min(100, max(0, $score)),
            'factores' => $factores
        ];
    }

    /**
     * DIMENSIÓN 2: COMPORTAMIENTO HISTÓRICO
     * Evalúa historial de pagos, renovaciones y siniestros
     */
    private function calcularScoreComportamiento(?Cliente $cliente, Poliza $poliza): array
    {
        $score = 50;
        $factores = [];

        if (!$cliente) {
            return ['score' => 40, 'factores' => ['Sin historial disponible']];
        }

        // 2.1 Tasa de renovación histórica
        $polizasHistoricas = Poliza::where('client_id', $cliente->id)
            ->where('broker_id', $poliza->broker_id)
            ->count();
        
        $polizasRenovadas = Poliza::where('client_id', $cliente->id)
            ->where('broker_id', $poliza->broker_id)
            ->where('status', 'active')
            ->count();

        if ($polizasHistoricas > 0) {
            $tasaRenovacion = ($polizasRenovadas / $polizasHistoricas) * 100;
            if ($tasaRenovacion >= 80) {
                $score += 20;
                $factores[] = "✓ Alta tasa de renovación ({$tasaRenovacion}%)";
            } elseif ($tasaRenovacion >= 50) {
                $score += 10;
                $factores[] = "○ Tasa de renovación media ({$tasaRenovacion}%)";
            } else {
                $score -= 10;
                $factores[] = "✗ Baja tasa de renovación ({$tasaRenovacion}%)";
            }
        }

        // 2.2 Historial de siniestros (siniestralidad)
        try {
            $siniestrosUltimoAnio = Siniestro::where('cliente_id', $cliente->id)
                ->where('broker_id', $poliza->broker_id)
                ->where('created_at', '>=', now()->subYear())
                ->count();

            if ($siniestrosUltimoAnio == 0 && $polizasHistoricas > 0) {
                $score += 15;
                $factores[] = "✓ Sin siniestros recientes";
            } elseif ($siniestrosUltimoAnio <= 1) {
                $score += 5;
                $factores[] = "○ Siniestralidad baja";
            } else {
                $score -= 10;
                $factores[] = "✗ Siniestralidad alta ({$siniestrosUltimoAnio} último año)";
            }
        } catch (\Exception $e) {
            // Si hay error con siniestros, asumir sin siniestros
            $factores[] = "○ Sin datos de siniestros";
        }

        // 2.3 Estado de pagos (si hay información)
        try {
            $polizasPendientes = Poliza::where('client_id', $cliente->id)
                ->where('broker_id', $poliza->broker_id)
                ->where(function($q) {
                    $q->where('payment_status', 'pending')
                      ->orWhere('payment_status', 'overdue');
                })
                ->count();

            if ($polizasPendientes == 0) {
                $score += 10;
                $factores[] = "✓ Pagos al día";
            } else {
                $score -= 15;
                $factores[] = "✗ Tiene pagos pendientes ({$polizasPendientes})";
            }
        } catch (\Exception $e) {
            $factores[] = "○ Sin datos de pagos";
        }

        // 2.4 Diversificación de productos
        try {
            $tiposProductos = Poliza::where('client_id', $cliente->id)
                ->where('broker_id', $poliza->broker_id)
                ->where('status', 'active')
                ->distinct('type')
                ->count('type');

            if ($tiposProductos >= 3) {
                $score += 10;
                $factores[] = "✓ Cliente diversificado ({$tiposProductos} tipos)";
            } elseif ($tiposProductos == 2) {
                $score += 5;
                $factores[] = "○ Algo diversificado";
            }
        } catch (\Exception $e) {
            // Ignorar error
        }

        return [
            'score' => min(100, max(0, $score)),
            'factores' => $factores
        ];
    }

    /**
     * DIMENSIÓN 3: ENGAGEMENT
     * Evalúa nivel de interacción y respuesta del cliente
     */
    private function calcularScoreEngagement(?Cliente $cliente): array
    {
        $score = 50;
        $factores = [];

        if (!$cliente) {
            return ['score' => 40, 'factores' => ['Sin datos de engagement']];
        }

        // 3.1 Último contacto
        if ($cliente->last_contact_at) {
            $diasUltimoContacto = now()->diffInDays($cliente->last_contact_at);
            if ($diasUltimoContacto <= 30) {
                $score += 20;
                $factores[] = "✓ Contacto reciente (<30 días)";
            } elseif ($diasUltimoContacto <= 90) {
                $score += 10;
                $factores[] = "○ Contacto moderado (1-3 meses)";
            } else {
                $score -= 5;
                $factores[] = "✗ Sin contacto reciente (>{$diasUltimoContacto} días)";
            }
        }

        // 3.2 Canales de contacto disponibles
        $canales = 0;
        if (!empty($cliente->email)) $canales++;
        if (!empty($cliente->phone)) $canales++;
        if (!empty($cliente->mobile_phone)) $canales++;

        if ($canales >= 3) {
            $score += 15;
            $factores[] = "✓ Múltiples canales de contacto";
        } elseif ($canales >= 2) {
            $score += 10;
            $factores[] = "○ Canales de contacto suficientes";
        } elseif ($canales == 1) {
            $score += 5;
            $factores[] = "○ Canal de contacto limitado";
        } else {
            $score -= 20;
            $factores[] = "✗ Sin canales de contacto";
        }

        // 3.3 Tiene seguimiento programado
        if ($cliente->next_follow_up_at && $cliente->next_follow_up_at > now()) {
            $score += 10;
            $factores[] = "✓ Seguimiento programado";
        }

        return [
            'score' => min(100, max(0, $score)),
            'factores' => $factores
        ];
    }

    /**
     * DIMENSIÓN 4: OPORTUNIDAD
     * Evalúa timing y relevancia del producto recomendado
     */
    private function calcularScoreOportunidad(Poliza $poliza, array $recomendacion): array
    {
        $score = 50;
        $factores = [];

        // 4.1 Complementariedad lógica del producto
        $tipoActual = strtolower($poliza->type ?? '');
        $tipoRecomendado = strtolower($recomendacion['producto'] ?? '');
        
        $complementariedad = $this->evaluarComplementariedad($tipoActual, $tipoRecomendado);
        $score += $complementariedad['puntos'];
        $factores[] = $complementariedad['factor'];

        // 4.2 Timing - Proximidad a vencimiento de póliza actual
        if ($poliza->end_date) {
            $diasParaVencer = now()->diffInDays($poliza->end_date, false);
            if ($diasParaVencer > 0 && $diasParaVencer <= 60) {
                $score += 15;
                $factores[] = "✓ Póliza próxima a renovar ({$diasParaVencer} días)";
            } elseif ($diasParaVencer > 60 && $diasParaVencer <= 120) {
                $score += 10;
                $factores[] = "○ Ventana de renovación abierta";
            }
        }

        // 4.3 Ciclo de vida del cliente
        try {
            $polizasActivas = Poliza::where('client_id', $poliza->client_id)
                ->where('broker_id', $poliza->broker_id)
                ->where('status', 'active')
                ->count();

            if ($polizasActivas == 1) {
                $score += 15; // Cliente con una sola póliza = alta oportunidad
                $factores[] = "✓ Cliente con potencial de expansión";
            } elseif ($polizasActivas <= 3) {
                $score += 10;
                $factores[] = "○ Oportunidad de diversificación";
            }
        } catch (\Exception $e) {
            // Ignorar
        }

        // 4.4 Nivel de urgencia de la recomendación
        $urgencia = strtolower($recomendacion['nivel_urgencia'] ?? 'media');
        if ($urgencia === 'alta') {
            $score += 10;
            $factores[] = "✓ Necesidad identificada como urgente";
        }

        return [
            'score' => min(100, max(0, $score)),
            'factores' => $factores
        ];
    }

    /**
     * DIMENSIÓN 5: CONTEXTO EXTERNO
     * Evalúa factores externos y temporales
     */
    private function calcularScoreContexto(array $recomendacion): array
    {
        $score = 50;
        $factores = [];

        $mes = now()->month;
        $tipoProducto = strtolower($recomendacion['producto'] ?? '');

        // 5.1 Temporada alta para ciertos productos
        // Enero-Febrero: Renovación de SOAT
        if (in_array($mes, [1, 2]) && str_contains($tipoProducto, 'soat')) {
            $score += 20;
            $factores[] = "✓ Temporada alta de SOAT";
        }
        
        // Diciembre-Enero: Seguros de vida (propósitos de año nuevo)
        if (in_array($mes, [12, 1]) && str_contains($tipoProducto, 'vida')) {
            $score += 15;
            $factores[] = "✓ Temporada de planificación financiera";
        }

        // Octubre-Noviembre: Seguros empresariales (cierre fiscal)
        if (in_array($mes, [10, 11]) && str_contains($tipoProducto, 'empresarial')) {
            $score += 15;
            $factores[] = "✓ Temporada de cierre fiscal";
        }

        // 5.2 Día de la semana (martes-jueves mejor para contacto)
        $diaSemana = now()->dayOfWeek;
        if (in_array($diaSemana, [2, 3, 4])) { // Martes, Miércoles, Jueves
            $score += 5;
            $factores[] = "○ Buen momento para contactar";
        }

        if (empty($factores)) {
            $factores[] = "○ Contexto neutral";
        }

        return [
            'score' => min(100, max(0, $score)),
            'factores' => $factores
        ];
    }

    /**
     * Evaluar complementariedad entre productos
     */
    private function evaluarComplementariedad(string $tipoActual, string $tipoRecomendado): array
    {
        // Matriz de complementariedad (basada en lógica de negocio real)
        $matriz = [
            'soat' => [
                'auto' => ['puntos' => 25, 'razon' => 'SOAT → Todo Riesgo Auto (protección completa)'],
                'vida' => ['puntos' => 15, 'razon' => 'SOAT → Vida (protección personal)'],
            ],
            'auto' => [
                'vida' => ['puntos' => 20, 'razon' => 'Auto → Vida (protección familiar)'],
                'hogar' => ['puntos' => 20, 'razon' => 'Auto → Hogar (protección patrimonial)'],
            ],
            'vida' => [
                'salud' => ['puntos' => 25, 'razon' => 'Vida → Salud (protección integral)'],
                'hogar' => ['puntos' => 15, 'razon' => 'Vida → Hogar (patrimonio)'],
                'accidentes' => ['puntos' => 20, 'razon' => 'Vida → Accidentes (cobertura complementaria)'],
            ],
            'hogar' => [
                'vida' => ['puntos' => 20, 'razon' => 'Hogar → Vida (protección familiar)'],
            ],
            'empresarial' => [
                'cumplimiento' => ['puntos' => 25, 'razon' => 'Empresarial → Cumplimiento (operación)'],
                'responsabilidad' => ['puntos' => 25, 'razon' => 'Empresarial → RC (protección legal)'],
            ],
            'cumplimiento' => [
                'responsabilidad' => ['puntos' => 20, 'razon' => 'Cumplimiento → RC (cobertura legal)'],
            ],
        ];

        foreach ($matriz as $tipo => $complementos) {
            if (str_contains($tipoActual, $tipo)) {
                foreach ($complementos as $comp => $data) {
                    if (str_contains($tipoRecomendado, $comp)) {
                        return [
                            'puntos' => $data['puntos'],
                            'factor' => "✓ " . $data['razon']
                        ];
                    }
                }
            }
        }

        return [
            'puntos' => 5,
            'factor' => "○ Complementariedad general"
        ];
    }

    /**
     * Calcular completitud de datos del cliente
     */
    private function calcularCompletitudDatos(?Cliente $cliente): array
    {
        if (!$cliente) {
            return ['puntos' => 0, 'factor' => '✗ Sin datos de cliente'];
        }

        $campos = [
            'email' => !empty($cliente->email),
            'phone' => !empty($cliente->phone),
            'mobile_phone' => !empty($cliente->mobile_phone),
            'address' => !empty($cliente->address),
            'city' => !empty($cliente->city),
            'document_number' => !empty($cliente->document_number),
        ];

        $completados = array_filter($campos);
        $porcentaje = (count($completados) / count($campos)) * 100;

        if ($porcentaje >= 80) {
            return ['puntos' => 10, 'factor' => '✓ Datos completos'];
        } elseif ($porcentaje >= 50) {
            return ['puntos' => 5, 'factor' => '○ Datos parciales'];
        } else {
            return ['puntos' => 0, 'factor' => '✗ Datos incompletos'];
        }
    }

    /**
     * Calcular nivel de confianza del score
     */
    private function calcularNivelConfianza(array $dimensiones): string
    {
        // La confianza depende de cuántos datos tenemos
        $factoresPositivos = 0;
        $factoresNegativos = 0;

        foreach ($dimensiones as $dim) {
            foreach ($dim['factores'] as $factor) {
                if (str_starts_with($factor, '✓')) $factoresPositivos++;
                if (str_starts_with($factor, '✗')) $factoresNegativos++;
            }
        }

        $total = $factoresPositivos + $factoresNegativos;
        if ($total == 0) return 'Baja';

        $ratio = $factoresPositivos / max(1, $total);

        if ($ratio >= 0.7 && $factoresPositivos >= 5) return 'Alta';
        if ($ratio >= 0.5 && $factoresPositivos >= 3) return 'Media';
        return 'Baja';
    }

    /**
     * Recomendar acción basada en el score
     */
    private function recomendarAccion(float $score, array $dimensiones): string
    {
        if ($score >= 80) {
            return 'Contactar inmediatamente - Alta probabilidad de conversión';
        } elseif ($score >= 65) {
            return 'Programar contacto esta semana';
        } elseif ($score >= 50) {
            return 'Incluir en campaña de nurturing';
        } else {
            return 'Mantener en observación';
        }
    }
}
