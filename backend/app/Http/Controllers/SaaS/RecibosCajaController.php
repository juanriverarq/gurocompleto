<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\ReciboCaja;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class RecibosCajaController extends Controller
{
    private function resolveBrokerId(Request $request): ?int
    {
        $id = (int) ($request->input('broker_id') ?? $request->query('broker_id') ?? 0);
        if ($id > 0) return $id;
        $user = $request->user();
        if ($user && isset($user->broker_id)) return (int) $user->broker_id;
        $fallback = (int) (env('DEV_FALLBACK_BROKER_ID') ?? 0);
        if ($fallback > 0) return $fallback;
        $first = \App\Models\Broker::query()->active()->orderBy('id')->value('id');
        return $first ? (int) $first : null;
    }

    /**
     * List recibos with filters and pagination
     */
    public function index(Request $request): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'broker_id no resuelto'], 400);

        $query = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->with(['poliza:id,policy_number', 'cliente:id,first_name,last_name,document_number']);

        // Filters
        if ($polizaId = $request->get('poliza_id')) {
            $query->where('poliza_id', (int) $polizaId);
        }
        if ($tipo = $request->get('tipo')) {
            $query->where('tipo', $tipo);
        }
        if ($tipoRecaudo = $request->get('tipo_recaudo')) {
            $query->where('tipo_recaudo', $tipoRecaudo);
        }
        if ($request->has('es_anticipo')) {
            $query->where('es_anticipo', $request->boolean('es_anticipo'));
        }
        if ($request->has('recibo_anulado')) {
            $query->where('recibo_anulado', $request->boolean('recibo_anulado'));
        }
        if ($request->has('recibo_pago_directo')) {
            $query->where('recibo_pago_directo', $request->boolean('recibo_pago_directo'));
        }
        if ($request->has('activo')) {
            $query->where('activo', $request->boolean('activo'));
        }
        // Tab filter matching Softseguros categories
        if ($tab = $request->get('tab')) {
            switch ($tab) {
                case 'anticipos':
                    $query->where('es_anticipo', true)
                          ->where('recibo_anulado', false);
                    break;
                case 'activos':
                    $query->where('activo', true)
                          ->where('recibo_anulado', false)
                          ->where('es_anticipo', false)
                          ->where('recibo_pago_directo', false);
                    break;
                case 'pago_directo':
                    $query->where('recibo_pago_directo', true)
                          ->where('recibo_anulado', false);
                    break;
                case 'anulados':
                    $query->where('recibo_anulado', true);
                    break;
                case 'certificados':
                    $query->where('tipo', 'certificado_cobro');
                    break;
            }
        }
        if ($request->has('recaudado_en_oficina')) {
            $query->where('recaudado_en_oficina', $request->boolean('recaudado_en_oficina'));
        }
        if ($request->has('comisionada')) {
            $query->where('comisionada', $request->boolean('comisionada'));
        }
        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('numero_recibo', 'like', "%{$search}%")
                  ->orWhere('observaciones', 'like', "%{$search}%")
                  ->orWhere('forma_pago', 'like', "%{$search}%")
                  ->orWhere('cliente_nombre', 'like', "%{$search}%")
                  ->orWhere('cliente_documento', 'like', "%{$search}%")
                  ->orWhere('poliza_numero', 'like', "%{$search}%")
                  ->orWhere('aseguradora_nombre', 'like', "%{$search}%")
                  ->orWhere('ramo_nombre', 'like', "%{$search}%")
                  ->orWhere('poliza_objeto_asegurado', 'like', "%{$search}%")
                  ->orWhereHas('cliente', function ($cq) use ($search) {
                      $cq->where('first_name', 'like', "%{$search}%")
                         ->orWhere('last_name', 'like', "%{$search}%")
                         ->orWhere('document_number', 'like', "%{$search}%");
                  });
            });
        }
        if ($fechaDesde = $request->get('fecha_desde')) {
            $query->where('fecha_realizo_pago_oficina', '>=', $fechaDesde);
        }
        if ($fechaHasta = $request->get('fecha_hasta')) {
            $query->where('fecha_realizo_pago_oficina', '<=', $fechaHasta);
        }

        // Sort
        $sortField = $request->get('sort_field', 'fecha_realizo_pago_oficina');
        $sortDir = $request->get('sort_dir', 'desc');
        $query->orderBy($sortField, $sortDir);

        $perPage = (int) $request->get('per_page', 25);
        $paginated = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $paginated->items(),
            'pagination' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
        ]);
    }

    /**
     * Cuadre de caja: summary for a date range
     */
    public function cuadreCaja(Request $request): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'broker_id no resuelto'], 400);

        $fechaDesde = $request->get('fecha_desde', now()->startOfDay()->toDateString());
        $fechaHasta = $request->get('fecha_hasta', now()->endOfDay()->toDateString());

        $base = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->where('activo', true)
            ->where('recibo_anulado', false)
            ->whereBetween('fecha_realizo_pago_oficina', [$fechaDesde, $fechaHasta]);

        // Totals
        $totalRecaudadoOficina = (clone $base)->where('recaudado_en_oficina', true)->sum('valor_recaudado_en_oficina');
        $totalRecibos = (clone $base)->count();
        $totalAnticipos = (clone $base)->where('es_anticipo', true)->count();
        $totalAnulados = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->where('recibo_anulado', true)
            ->whereBetween('fecha_realizo_pago_oficina', [$fechaDesde, $fechaHasta])
            ->count();

        // By payment method
        $porFormaPago = (clone $base)
            ->select('forma_pago', DB::raw('COUNT(*) as cantidad'), DB::raw('SUM(valor_recaudado_en_oficina) as total'))
            ->groupBy('forma_pago')
            ->orderByDesc('total')
            ->get();

        // By type
        $porTipo = (clone $base)
            ->select('tipo', DB::raw('COUNT(*) as cantidad'), DB::raw('SUM(valor_recaudado_en_oficina) as total'))
            ->groupBy('tipo')
            ->get();

        // Comisiones
        $totalComisiones = (clone $base)->sum('comision_a_recibir');
        $comisionesPagadas = (clone $base)->where('comisionada', true)->sum('comision_recibida');

        return response()->json([
            'success' => true,
            'data' => [
                'periodo' => ['desde' => $fechaDesde, 'hasta' => $fechaHasta],
                'total_recaudado_oficina' => round((float) $totalRecaudadoOficina, 2),
                'total_recibos' => $totalRecibos,
                'total_anticipos' => $totalAnticipos,
                'total_anulados' => $totalAnulados,
                'por_forma_pago' => $porFormaPago,
                'por_tipo' => $porTipo,
                'comisiones' => [
                    'total' => round((float) $totalComisiones, 2),
                    'pagadas' => round((float) $comisionesPagadas, 2),
                    'pendientes' => round((float) ($totalComisiones - $comisionesPagadas), 2),
                ],
            ],
        ]);
    }

    /**
     * Get a single recibo
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'broker_id no resuelto'], 400);

        $recibo = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->with(['poliza:id,policy_number,premium_amount,total_amount', 'cliente:id,first_name,last_name,document_number,email,phone'])
            ->findOrFail($id);

        return response()->json(['success' => true, 'data' => $recibo]);
    }

    /**
     * Create a new recibo
     */
    public function store(Request $request): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'broker_id no resuelto'], 400);

        $data = $request->validate([
            'poliza_id' => 'nullable|integer|exists:polizas,id',
            'cliente_id' => 'required|integer|exists:clientes,id',
            'tipo' => 'required|in:recibo,anticipo,ajuste',
            'tipo_recaudo' => 'required|in:oficina,aseguradora,directo',
            'forma_pago' => 'nullable|string|max:100',
            'fecha_realizo_pago_oficina' => 'nullable|date',
            'valor_recaudado_en_oficina' => 'nullable|numeric|min:0',
            'valor_a_pagar' => 'nullable|numeric|min:0',
            'observaciones' => 'nullable|string',
        ]);

        // Auto-generate numero_recibo: extract numeric part even from prefixed values like 'RC-032394'
        $maxNum = (int) DB::table('recibos_caja')
            ->where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->max(DB::raw("CAST(REGEXP_REPLACE(numero_recibo, '[^0-9]', '') AS UNSIGNED)"));
        $nextNum = $maxNum + 1;

        $data['broker_id'] = $brokerId;
        $data['numero_recibo'] = (string) $nextNum;
        $data['es_anticipo'] = $data['tipo'] === 'anticipo';
        // Recaudo por oficina → recibo activo | Recaudo por aseguradora → pago directo
        $data['recibo_pago_directo'] = in_array($data['tipo_recaudo'], ['aseguradora', 'directo']);
        $data['recaudo_directo'] = in_array($data['tipo_recaudo'], ['aseguradora', 'directo']);
        $data['recaudado_en_oficina'] = $data['tipo_recaudo'] === 'oficina';
        $data['activo'] = true;
        $data['recibo_anulado'] = false;
        $data['source'] = 'guro';

        // Ensure valor_a_pagar is never NULL — default to valor_recaudado_en_oficina
        if (empty($data['valor_a_pagar']) && !empty($data['valor_recaudado_en_oficina'])) {
            $data['valor_a_pagar'] = $data['valor_recaudado_en_oficina'];
        }

        // Populate denormalized display fields
        if (!empty($data['cliente_id'])) {
            $cliente = Cliente::withoutGlobalScopes()->find($data['cliente_id']);
            if ($cliente) {
                $data['cliente_nombre'] = trim(($cliente->first_name ?? '') . ' ' . ($cliente->last_name ?? '')) ?: ($cliente->company ?? null);
                $data['cliente_documento'] = $cliente->document_number ?? null;
            }
        }
        if (!empty($data['poliza_id'])) {
            $poliza = \App\Models\Poliza::withoutGlobalScopes()
                ->with(['aseguradora:id,nombre', 'ramo:id,nombre'])
                ->find($data['poliza_id']);
            if ($poliza) {
                $data['poliza_numero'] = $poliza->policy_number ?? null;
                $data['aseguradora_nombre'] = $poliza->aseguradora?->nombre ?? null;
                $data['ramo_nombre'] = $poliza->ramo?->nombre ?? null;
            }
        }

        $recibo = ReciboCaja::create($data);

        return response()->json(['success' => true, 'data' => $recibo], 201);
    }

    /**
     * Anular recibo — saves pre-state so it can be reverted
     */
    public function anular(Request $request, int $id): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'broker_id no resuelto'], 400);

        $recibo = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->findOrFail($id);

        if ($recibo->recibo_anulado) {
            return response()->json(['success' => false, 'message' => 'Este recibo ya está anulado'], 422);
        }

        $motivo = $request->input('motivo');

        // Save pre-anulación state in metadata so we can revert
        $metadata = $recibo->metadata ?? [];
        $metadata['pre_anulacion'] = [
            'activo' => $recibo->activo,
            'recibo_pago_directo' => $recibo->recibo_pago_directo,
            'recaudo_directo' => $recibo->recaudo_directo,
        ];

        $recibo->update([
            'recibo_anulado' => true,
            'activo' => false,
            'fecha_recibo_anulado' => now(),
            'usuario_anulo_recibo' => $request->user()?->name ?? 'Sistema',
            'metadata' => $metadata,
            'observaciones' => $motivo
                ? trim(($recibo->observaciones ? $recibo->observaciones . "\n" : '') . "[ANULADO] " . $motivo)
                : $recibo->observaciones,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Recibo anulado correctamente',
            'data' => $recibo->fresh(),
        ]);
    }

    /**
     * Revertir anulación — restores pre-anulación state
     */
    public function revertir(Request $request, int $id): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'broker_id no resuelto'], 400);

        $recibo = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->findOrFail($id);

        if (!$recibo->recibo_anulado) {
            return response()->json(['success' => false, 'message' => 'Este recibo no está anulado'], 422);
        }

        // Restore pre-anulación state if available
        $metadata = $recibo->metadata ?? [];
        $preState = $metadata['pre_anulacion'] ?? null;
        unset($metadata['pre_anulacion']);

        $recibo->update([
            'recibo_anulado' => false,
            'activo' => $preState['activo'] ?? true,
            'recibo_pago_directo' => $preState['recibo_pago_directo'] ?? $recibo->recibo_pago_directo,
            'recaudo_directo' => $preState['recaudo_directo'] ?? $recibo->recaudo_directo,
            'fecha_recibo_anulado' => null,
            'usuario_anulo_recibo' => null,
            'metadata' => $metadata ?: null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Anulación revertida correctamente',
            'data' => $recibo->fresh(),
        ]);
    }

    /**
     * Associate a recibo with a poliza — creates PagoPoliza + syncs cartera
     */
    public function asociarPoliza(Request $request, int $id): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'broker_id no resuelto'], 400);

        $recibo = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->findOrFail($id);

        if ($recibo->poliza_id) {
            return response()->json(['success' => false, 'message' => 'Este recibo ya está asociado a una póliza'], 422);
        }
        if ($recibo->recibo_anulado) {
            return response()->json(['success' => false, 'message' => 'No se puede asociar un recibo anulado'], 422);
        }

        $validated = $request->validate([
            'poliza_id' => 'required|integer|exists:polizas,id',
        ]);

        $poliza = \App\Models\Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->findOrFail($validated['poliza_id']);

        $monto = (float) ($recibo->valor_recaudado_en_oficina ?: $recibo->valor_a_pagar ?: 0);
        $tipoRecaudo = $recibo->tipo_recaudo ?: 'oficina';
        $esOficina = $tipoRecaudo === 'oficina';

        \DB::beginTransaction();
        try {
            // 1. Update recibo with poliza info
            $recibo->update([
                'poliza_id' => $poliza->id,
                'poliza_numero' => $poliza->policy_number,
                'aseguradora_nombre' => $poliza->aseguradora?->nombre ?? $poliza->insurance_company,
                'ramo_nombre' => $poliza->ramo?->nombre ?? null,
            ]);

            // 2. Create PagoPoliza to register in cartera
            $montoTotalPoliza = $poliza->total_amount ?? ($poliza->premium_amount + ($poliza->vat_amount ?? 0));

            if ($esOficina) {
                $totalRecaudadoAnterior = (float) \App\Models\PagoPoliza::where('poliza_id', $poliza->id)
                    ->where('tipo_recaudo', 'oficina')->sum('monto_pagado');
                $nuevoTotal = $totalRecaudadoAnterior + $monto;
                $pendiente = max(0, $montoTotalPoliza - $nuevoTotal);
                $estado = $pendiente <= 0 ? 'pagado' : 'parcial';
            } elseif ($tipoRecaudo === 'aseguradora' || $tipoRecaudo === 'directo') {
                $pendiente = 0;
                $estado = 'pagado';
            } else {
                $pendiente = 0;
                $estado = 'pagado';
            }

            $pago = \App\Models\PagoPoliza::create([
                'broker_id' => $brokerId,
                'poliza_id' => $poliza->id,
                'cliente_id' => $poliza->client_id,
                'monto_total' => $montoTotalPoliza,
                'monto_pagado' => $monto,
                'monto_pendiente' => $pendiente,
                'tipo_recaudo' => $esOficina ? 'oficina' : 'aseguradora',
                'metodo_pago' => $recibo->forma_pago,
                'fecha_pago' => $recibo->fecha_realizo_pago_oficina ?? now(),
                'estado' => $estado,
                'observaciones' => 'Cruce desde recibo #' . ($recibo->numero_recibo ?? $recibo->id),
            ]);

            // Link recibo to pago
            $recibo->update(['pago_poliza_id' => $pago->id]);

            // 3. If oficina payment completes total, auto-create pending aseg payment + comision
            if ($esOficina && $estado === 'pagado' && $pago->habilitaComision()) {
                $primaNeta = $poliza->premium_amount ?? 0;
                if ($primaNeta > 0) {
                    \App\Models\PagoPoliza::create([
                        'broker_id' => $brokerId,
                        'poliza_id' => $poliza->id,
                        'cliente_id' => $poliza->client_id,
                        'monto_total' => $primaNeta,
                        'monto_pagado' => 0,
                        'monto_pendiente' => $primaNeta,
                        'tipo_recaudo' => 'aseguradora',
                        'fecha_pago' => now(),
                        'estado' => 'pendiente',
                        'observaciones' => 'Pago pendiente a aseguradora generado por cruce de recibo',
                    ]);
                }
                \App\Models\CobroComision::create([
                    'broker_id' => $brokerId,
                    'poliza_id' => $poliza->id,
                    'aseguradora_id' => $poliza->aseguradora_id,
                    'pago_poliza_id' => $pago->id,
                    'monto_comision' => $poliza->commission_amount ?? 0,
                    'monto_cobrado' => 0,
                    'monto_pendiente' => $poliza->commission_amount ?? 0,
                    'estado' => 'pendiente',
                    'observaciones' => 'Comisión generada por cruce de recibo',
                ]);
            }

            // 4. Sync cartera_items
            $controller = app(\App\Http\Controllers\Api\PagoPolizaController::class);
            $reflection = new \ReflectionMethod($controller, 'syncCarteraItems');
            $reflection->setAccessible(true);
            $reflection->invoke($controller, (int) $poliza->id);

            \DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Recibo asociado a póliza ' . $poliza->policy_number . ' exitosamente. Pago registrado en cartera.',
                'data' => $recibo->fresh(),
            ]);
        } catch (\Throwable $e) {
            \DB::rollBack();
            \Log::error('Error asociando recibo a poliza: ' . $e->getMessage(), ['recibo_id' => $id, 'poliza_id' => $poliza->id]);
            return response()->json([
                'success' => false,
                'message' => 'Error al asociar: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get polizas for a client (for associating recibos)
     */
    public function polizasCliente(Request $request, int $clienteId): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'broker_id no resuelto'], 400);

        $polizas = \App\Models\Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->where('client_id', $clienteId)
            ->whereIn('status', ['active', 'pending', 'issued'])
            ->with(['aseguradora:id,nombre', 'ramo:id,nombre'])
            ->select('id', 'policy_number', 'insurance_company', 'aseguradora_id', 'ramo_id', 'product_name',
                'premium_amount', 'vat_amount', 'total_amount', 'commission_amount',
                'payment_frequency', 'start_date', 'end_date', 'status', 'client_name')
            ->orderByDesc('start_date')
            ->limit(50)
            ->get();

        $result = $polizas->map(function ($p) {
            $total = $p->total_amount ?? ($p->premium_amount + ($p->vat_amount ?? 0));
            $totalPagadoOficina = (float) \DB::table('pagos_polizas')
                ->where('poliza_id', $p->id)->where('tipo_recaudo', 'oficina')->sum('monto_pagado');
            $pendiente = max(0, $total - $totalPagadoOficina);

            // Calculate cuotas
            $freq = $p->payment_frequency;
            $meses = match($freq) { 'monthly' => 1, 'quarterly' => 3, 'biannual' => 6, default => 12 };
            $inicio = $p->start_date ? new \DateTime($p->start_date) : null;
            $fin = $p->end_date ? new \DateTime($p->end_date) : null;
            $numCuotas = 1;
            if ($inicio && $fin) {
                $diffMeses = max(1, (int) round($inicio->diff($fin)->days / 30.44));
                $numCuotas = max(1, (int) round($diffMeses / $meses));
            }
            $montoCuota = $numCuotas > 0 ? round($total / $numCuotas) : $total;

            return [
                'id' => $p->id,
                'policy_number' => $p->policy_number,
                'aseguradora' => $p->aseguradora?->nombre ?? $p->insurance_company,
                'ramo' => $p->ramo?->nombre ?? $p->product_name,
                'total' => $total,
                'prima_neta' => $p->premium_amount,
                'pendiente' => $pendiente,
                'pagado' => $totalPagadoOficina,
                'num_cuotas' => $numCuotas,
                'monto_cuota' => $montoCuota,
                'periodicidad' => $freq,
                'fecha_inicio' => $p->start_date,
                'fecha_fin' => $p->end_date,
            ];
        });

        return response()->json(['success' => true, 'data' => $result]);
    }

    /**
     * Stats for dashboard cards
     */
    public function estadisticas(Request $request): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'broker_id no resuelto'], 400);

        $base = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->where('activo', true);

        $totalRecibos = (clone $base)->count();
        $totalAnticipos = (clone $base)->where('es_anticipo', true)->count();
        $totalAnulados = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->where('recibo_anulado', true)->count();
        $totalRecaudado = (clone $base)->where('recibo_anulado', false)->sum('valor_recaudado_en_oficina');
        $pendienteOficina = (clone $base)->where('recibo_anulado', false)->sum('saldo_pendiente_oficina');
        $pendienteAseguradora = (clone $base)->where('recibo_anulado', false)->sum('saldo_pendiente_aseguradora');

        // Tab counts for Softseguros-style tabs
        $allBase = ReciboCaja::withoutGlobalScopes()->where('broker_id', $brokerId);
        $countAnticipos = (clone $allBase)->where('es_anticipo', true)->where('recibo_anulado', false)->count();
        $countActivos = (clone $allBase)->where('activo', true)->where('recibo_anulado', false)->where('es_anticipo', false)->where('recibo_pago_directo', false)->count();
        $countPagoDirecto = (clone $allBase)->where('recibo_pago_directo', true)->where('recibo_anulado', false)->count();
        $countAnulados2 = (clone $allBase)->where('recibo_anulado', true)->count();
        $countCertificados = (clone $allBase)->where('tipo', 'certificado_cobro')->count();

        return response()->json([
            'success' => true,
            'data' => [
                'total_recibos' => $totalRecibos,
                'total_anticipos' => $totalAnticipos,
                'total_anulados' => $totalAnulados,
                'total_recaudado' => round((float) $totalRecaudado, 2),
                'pendiente_oficina' => round((float) $pendienteOficina, 2),
                'pendiente_aseguradora' => round((float) $pendienteAseguradora, 2),
                'tabs' => [
                    'anticipos' => $countAnticipos,
                    'activos' => $countActivos,
                    'pago_directo' => $countPagoDirecto,
                    'anulados' => $countAnulados2,
                    'certificados' => $countCertificados,
                ],
            ],
        ]);
    }
}
