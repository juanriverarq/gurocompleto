<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Poliza;
use App\Models\PolicyNotificationConfig;
use App\Services\WhatsAppCloudApiService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

/**
 * Cartera Simple — API minimalista que reemplaza CarteraClientes,
 * ComisionesPorPoliza y RecibosCuadreCaja con UNA SOLA experiencia
 * agrupada por urgencia.
 *
 * Filosofía: el broker no debe pensar en "tabs", solo ve las cuotas
 * agrupadas por lo más urgente y actúa con 1 click.
 */
class CarteraSimpleController extends Controller
{
    /**
     * Timeline unificado: cuotas agrupadas por urgencia.
     * GET /api/saas/cartera-simple/timeline
     *
     * Grupos devueltos:
     *  - vencidas: pendientes con fecha < hoy
     *  - hoy: pendientes con fecha == hoy
     *  - proximos_7: pendientes con fecha entre hoy+1 y hoy+7
     *  - proximos_30: pendientes con fecha entre hoy+8 y hoy+30
     *  - sin_fecha: pendientes sin fecha_limite_pago
     *  - por_pagar_aseguradora: recaudado en oficina, pendiente pagar a aseguradora
     *  - comision_por_cobrar: pagado a aseguradora, comisión sin cobrar
     *  - cerradas: comisión cobrada (últimos 30 días)
     *  - anuladas: anuladas (últimos 30 días, opcional)
     *
     * Query params:
     *  - search: string — busca por cliente, documento, póliza
     *  - group: string — limita a un solo grupo (ej. "vencidas")
     *  - limit: int — máximo de items por grupo (default 50)
     */
    public function timeline(Request $request)
    {
        $brokerId = Auth::user()->broker_id ?? null;
        if (!$brokerId) {
            return response()->json(['success' => false, 'message' => 'Broker no identificado'], 403);
        }

        $search = trim((string) $request->query('search', ''));
        $group = $request->query('group');
        $limit = (int) $request->query('limit', 50);
        $today = Carbon::today();

        $base = function () use ($brokerId, $search) {
            $q = DB::table('cartera_items')
                ->where('broker_id', $brokerId);

            if ($search !== '') {
                $like = '%' . $search . '%';
                $q->where(function ($w) use ($like) {
                    $w->where('cliente_nombre', 'like', $like)
                        ->orWhere('cliente_documento', 'like', $like)
                        ->orWhere('poliza_numero', 'like', $like)
                        ->orWhere('aseguradora_nombre', 'like', $like)
                        ->orWhere('ramo_principal', 'like', $like);
                });
            }
            return $q;
        };

        $columns = [
            'id', 'poliza_id', 'cliente_id', 'poliza_numero', 'numero_pago',
            'anexo_numero', 'riesgo', 'aseguradora_nombre', 'ramo_principal',
            'cliente_nombre', 'cliente_documento', 'vendedor_nombre', 'forma_pago',
            'prima_total_pago', 'valor_neto_a_pagar',
            'saldo_pendiente_oficina', 'saldo_pendiente_aseguradora',
            'valor_recaudado_oficina', 'valor_pagado_aseguradora',
            'comision_a_recibir', 'comision_recibida',
            'fecha_limite_pago', 'fecha_recaudado_oficina', 'fecha_pago_aseguradora',
            'fecha_comisionada',
            'recaudado_en_oficina', 'recaudado_aseguradora', 'comisionada',
            'recibo_pago_directo', 'es_anticipo', 'recibo_anulado',
            'estado_cartera', 'numero_renovacion',
            'updated_at',
        ];

        $groups = [];

        // ─── Pendientes (no recaudadas) ───
        $pendientesBase = function () use ($base) {
            return $base()
                ->where('recaudado_en_oficina', false)
                ->where('recaudado_aseguradora', false)
                ->where('recibo_pago_directo', false)
                ->where('es_anticipo', false)
                ->where('recibo_anulado', false);
        };

        if (!$group || $group === 'vencidas') {
            $groups['vencidas'] = $pendientesBase()
                ->whereNotNull('fecha_limite_pago')
                ->whereDate('fecha_limite_pago', '<', $today)
                ->orderBy('fecha_limite_pago', 'asc')
                ->limit($limit)
                ->get($columns);
        }

        if (!$group || $group === 'hoy') {
            $groups['hoy'] = $pendientesBase()
                ->whereDate('fecha_limite_pago', $today)
                ->orderBy('fecha_limite_pago', 'asc')
                ->limit($limit)
                ->get($columns);
        }

        if (!$group || $group === 'proximos_7') {
            $groups['proximos_7'] = $pendientesBase()
                ->whereDate('fecha_limite_pago', '>', $today)
                ->whereDate('fecha_limite_pago', '<=', $today->copy()->addDays(7))
                ->orderBy('fecha_limite_pago', 'asc')
                ->limit($limit)
                ->get($columns);
        }

        if (!$group || $group === 'proximos_30') {
            $groups['proximos_30'] = $pendientesBase()
                ->whereDate('fecha_limite_pago', '>', $today->copy()->addDays(7))
                ->whereDate('fecha_limite_pago', '<=', $today->copy()->addDays(30))
                ->orderBy('fecha_limite_pago', 'asc')
                ->limit($limit)
                ->get($columns);
        }

        if (!$group || $group === 'sin_fecha') {
            $groups['sin_fecha'] = $pendientesBase()
                ->whereNull('fecha_limite_pago')
                ->orderBy('updated_at', 'desc')
                ->limit($limit)
                ->get($columns);
        }

        // ─── Recaudado en oficina, pendiente pagar a aseguradora ───
        if (!$group || $group === 'por_pagar_aseguradora') {
            $groups['por_pagar_aseguradora'] = $base()
                ->where('recaudado_en_oficina', true)
                ->where('recaudado_aseguradora', false)
                ->where('recibo_pago_directo', false)
                ->where('recibo_anulado', false)
                ->orderBy('fecha_recaudado_oficina', 'asc')
                ->limit($limit)
                ->get($columns);
        }

        // ─── Comisión por cobrar ───
        if (!$group || $group === 'comision_por_cobrar') {
            $groups['comision_por_cobrar'] = $base()
                ->where('recaudado_aseguradora', true)
                ->where('comisionada', false)
                ->where('recibo_anulado', false)
                ->orderBy('fecha_pago_aseguradora', 'asc')
                ->limit($limit)
                ->get($columns);
        }

        // ─── Cerradas recientes ───
        if (!$group || $group === 'cerradas') {
            $groups['cerradas'] = $base()
                ->where('comisionada', true)
                ->where('recibo_anulado', false)
                ->whereDate('fecha_comisionada', '>=', $today->copy()->subDays(30))
                ->orderBy('fecha_comisionada', 'desc')
                ->limit($limit)
                ->get($columns);
        }

        // ─── Resumen contadores y montos (sin filtro de límite) ───
        $stats = [
            'vencidas_count' => $pendientesBase()->whereDate('fecha_limite_pago', '<', $today)->count(),
            'vencidas_monto' => (float) $pendientesBase()->whereDate('fecha_limite_pago', '<', $today)->sum('saldo_pendiente_oficina'),
            'hoy_count' => $pendientesBase()->whereDate('fecha_limite_pago', $today)->count(),
            'proximos_7_count' => $pendientesBase()
                ->whereDate('fecha_limite_pago', '>', $today)
                ->whereDate('fecha_limite_pago', '<=', $today->copy()->addDays(7))->count(),
            'proximos_30_count' => $pendientesBase()
                ->whereDate('fecha_limite_pago', '>', $today->copy()->addDays(7))
                ->whereDate('fecha_limite_pago', '<=', $today->copy()->addDays(30))->count(),
            'por_pagar_aseguradora_count' => $base()
                ->where('recaudado_en_oficina', true)
                ->where('recaudado_aseguradora', false)
                ->where('recibo_pago_directo', false)
                ->where('recibo_anulado', false)->count(),
            'por_pagar_aseguradora_monto' => (float) $base()
                ->where('recaudado_en_oficina', true)
                ->where('recaudado_aseguradora', false)
                ->where('recibo_pago_directo', false)
                ->where('recibo_anulado', false)
                ->sum('saldo_pendiente_aseguradora'),
            'comision_por_cobrar_count' => $base()
                ->where('recaudado_aseguradora', true)
                ->where('comisionada', false)
                ->where('recibo_anulado', false)->count(),
            'comision_por_cobrar_monto' => (float) $base()
                ->where('recaudado_aseguradora', true)
                ->where('comisionada', false)
                ->where('recibo_anulado', false)
                ->sum('comision_a_recibir'),
        ];

        return response()->json([
            'success' => true,
            'data' => $groups,
            'stats' => $stats,
            'today' => $today->toDateString(),
        ]);
    }

    /**
     * Pagar una cuota — endpoint 1-click.
     * POST /api/saas/cartera-simple/cuota/{itemId}/pagar
     *
     * Body:
     *  - accion: 'recaudar_oficina' | 'pagar_directo' | 'pagar_aseguradora' | 'cobrar_comision'
     *  - monto: opcional (default según acción)
     *  - metodo_pago: opcional (default 'efectivo')
     *  - referencia: opcional
     *  - fecha: opcional (default hoy)
     *  - observaciones: opcional
     *
     * Internamente reusa PagoPolizaController para no duplicar la lógica
     * de sincronización de flags.
     */
    public function pagar(Request $request, int $itemId)
    {
        $brokerId = Auth::user()->broker_id ?? null;
        if (!$brokerId) {
            return response()->json(['success' => false, 'message' => 'Broker no identificado'], 403);
        }

        $ci = DB::table('cartera_items')->where('id', $itemId)->where('broker_id', $brokerId)->first();
        if (!$ci) {
            return response()->json(['success' => false, 'message' => 'Cuota no encontrada'], 404);
        }

        $accion = $request->input('accion', 'recaudar_oficina');
        $polizaId = $ci->poliza_id;

        if (!$polizaId) {
            return response()->json(['success' => false, 'message' => 'Cuota sin póliza vinculada'], 422);
        }

        $pagoCtrl = app(PagoPolizaController::class);

        // Mapeo acción → tipo_recaudo + monto default
        $config = match ($accion) {
            'recaudar_oficina' => [
                'tipo_recaudo' => 'oficina',
                'monto_default' => (float) $ci->saldo_pendiente_oficina,
                'endpoint' => 'store',
            ],
            'pagar_directo' => [
                'tipo_recaudo' => 'aseguradora_directo',
                'monto_default' => (float) $ci->prima_total_pago,
                'endpoint' => 'store',
            ],
            'pagar_aseguradora' => [
                'tipo_recaudo' => 'aseguradora',
                'monto_default' => (float) $ci->saldo_pendiente_aseguradora,
                'endpoint' => 'store',
            ],
            'cobrar_comision' => [
                'tipo_recaudo' => null,
                'monto_default' => (float) $ci->comision_a_recibir - (float) $ci->comision_recibida,
                'endpoint' => 'registrarCobroComision',
            ],
            default => null,
        };

        if (!$config) {
            return response()->json(['success' => false, 'message' => 'Acción no válida'], 422);
        }

        $monto = (float) ($request->input('monto') ?: $config['monto_default']);
        if ($monto <= 0) {
            return response()->json(['success' => false, 'message' => 'No hay saldo pendiente para esta acción'], 422);
        }

        // Forward al controller existente (reutiliza toda la lógica de sync/comisiones)
        $forwardRequest = new Request();
        $forwardRequest->merge([
            'monto' => $monto,
            'metodo_pago' => $request->input('metodo_pago', 'efectivo'),
            'referencia_pago' => $request->input('referencia'),
            'fecha_pago' => $request->input('fecha', now()->toDateString()),
            'fecha_cobro' => $request->input('fecha', now()->toDateString()),
            'observaciones' => $request->input('observaciones'),
            'cartera_item_id' => $itemId,
        ]);

        if ($config['tipo_recaudo']) {
            $forwardRequest->merge(['tipo_recaudo' => $config['tipo_recaudo']]);
        }
        if (!empty($request->input('referencia'))) {
            $forwardRequest->merge(['referencia_cobro' => $request->input('referencia')]);
        }

        try {
            return $pagoCtrl->{$config['endpoint']}($forwardRequest, $polizaId);
        } catch (\Throwable $e) {
            Log::error('CarteraSimple::pagar failed', [
                'item' => $itemId, 'accion' => $accion, 'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error al procesar: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Enviar aviso de WhatsApp para una cuota específica.
     * POST /api/saas/cartera-simple/cuota/{itemId}/avisar
     */
    public function avisar(Request $request, int $itemId)
    {
        $brokerId = Auth::user()->broker_id ?? null;
        if (!$brokerId) {
            return response()->json(['success' => false, 'message' => 'Broker no identificado'], 403);
        }

        $ci = DB::table('cartera_items')->where('id', $itemId)->where('broker_id', $brokerId)->first();
        if (!$ci || !$ci->poliza_id) {
            return response()->json(['success' => false, 'message' => 'Cuota sin póliza'], 404);
        }

        $poliza = Poliza::with('client')->find($ci->poliza_id);
        if (!$poliza || !$poliza->client) {
            return response()->json(['success' => false, 'message' => 'Póliza o cliente no encontrado'], 404);
        }

        $cliente = $poliza->client;
        $phone = $cliente->phone ?? $cliente->mobile ?? null;
        if (!$phone) {
            return response()->json(['success' => false, 'message' => 'Cliente sin teléfono'], 422);
        }

        // Obtener config de notificaciones del broker (para template + instancia WA)
        $config = PolicyNotificationConfig::where('broker_id', $brokerId)
            ->with('whatsappInstance')
            ->first();

        if (!$config || !$config->whatsappInstance) {
            return response()->json(['success' => false, 'message' => 'WhatsApp no configurado'], 422);
        }

        $template = $config->payment_template ?: 'poliza_pago_pendiente';
        $clientName = trim(($cliente->first_name ?? '') . ' ' . ($cliente->last_name ?? '')) ?: ($ci->cliente_nombre ?? 'Cliente');
        $fecha = $ci->fecha_limite_pago ? Carbon::parse($ci->fecha_limite_pago)->format('d/m/Y') : 'N/A';
        $monto = '$' . number_format((float) $ci->saldo_pendiente_oficina, 0, ',', '.');

        try {
            $params = [
                $clientName,
                $ci->poliza_numero ?? '-',
                $fecha,
                $monto,
                $ci->ramo_principal ?? '-',
                $ci->riesgo ?? '-',
            ];
            $components = [[
                'type' => 'body',
                'parameters' => array_map(fn($v) => ['type' => 'text', 'text' => (string) $v], $params),
            ]];

            // Normalizar teléfono (Colombia +57 default)
            $clean = preg_replace('/[^0-9+]/', '', $phone);
            if (strlen($clean) === 10 && $clean[0] === '3') {
                $clean = '+57' . $clean;
            } elseif (substr($clean, 0, 1) !== '+' && strlen($clean) === 12 && substr($clean, 0, 2) === '57') {
                $clean = '+' . $clean;
            }

            $service = app(WhatsAppCloudApiService::class);
            $result = $service->sendTemplateMessage(
                $config->whatsappInstance,
                $clean,
                $template,
                'es',
                $components
            );

            return response()->json([
                'success' => true,
                'message' => 'Aviso enviado',
                'result' => $result,
            ]);
        } catch (\Throwable $e) {
            Log::error('CarteraSimple::avisar failed', [
                'item' => $itemId, 'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error al enviar: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Anular cuota (delegado al controller existente).
     * POST /api/saas/cartera-simple/cuota/{itemId}/anular
     */
    public function anular(Request $request, int $itemId)
    {
        return app(PagoPolizaController::class)->anularCarteraItem($request, $itemId);
    }

    /**
     * Reactivar cuota.
     * POST /api/saas/cartera-simple/cuota/{itemId}/reactivar
     */
    public function reactivar(Request $request, int $itemId)
    {
        return app(PagoPolizaController::class)->reactivarCarteraItem($request, $itemId);
    }

    /**
     * Detalle de una cuota con sus pagos y recibos asociados.
     * GET /api/saas/cartera-simple/cuota/{itemId}
     */
    public function detalle(int $itemId)
    {
        $brokerId = Auth::user()->broker_id ?? null;
        if (!$brokerId) {
            return response()->json(['success' => false, 'message' => 'Broker no identificado'], 403);
        }

        $ci = DB::table('cartera_items')->where('id', $itemId)->where('broker_id', $brokerId)->first();
        if (!$ci) {
            return response()->json(['success' => false, 'message' => 'Cuota no encontrada'], 404);
        }

        $pagos = DB::table('pagos_polizas')
            ->where('cartera_item_id', $itemId)
            ->orderBy('fecha_pago', 'desc')
            ->get();

        $recibos = DB::table('recibos_caja')
            ->whereIn('pago_poliza_id', $pagos->pluck('id'))
            ->get();

        $cobros = DB::table('cobros_comisiones')
            ->where('cartera_item_id', $itemId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'cuota' => $ci,
            'pagos' => $pagos,
            'recibos' => $recibos,
            'cobros_comision' => $cobros,
        ]);
    }
}
