<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Broker;
use App\Models\CarteraAseguradora;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class CarteraConsolidadaController extends Controller
{
    public function index(Request $request)
    {
        $brokerId = $this->resolveBrokerId($request);
        $perPage = (int) $request->input('per_page', 25);
        $page = (int) $request->input('page', 1);
        $tab = $request->input('tab', 'todos');
        $search = $request->input('search', '');
        $insurer = $request->input('insurer');

        // IMPORTANTE: cada fila de `cartera_aseguradoras` es UNA cuota/recibo
        // pendiente. Varias cuotas de la misma póliza se consolidan aquí para
        // mostrar una fila por póliza con el saldo pendiente total.
        //
        // Semántica de los valores:
        //   - `prima_cuotas`    : suma de importes de las cuotas PENDIENTES solamente
        //   - `valor_pendiente` : suma de saldos (lo que aún se debe pagar)
        //   - `valor_pagado`    : suma de abonos registrados en cuotas pendientes
        //   - `prima_poliza`    : viene de `polizas.premium_amount` (prima total contratada)
        //                         Si es NULL se cae en `prima_cuotas` como fallback.
        $sub = DB::table('cartera_aseguradoras')
            ->where('broker_id', $brokerId)
            ->when($insurer, fn ($q) => $q->where('insurer_code', $insurer))
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('client_name', 'like', "%{$search}%")
                  ->orWhere('client_document', 'like', "%{$search}%")
                  ->orWhere('policy_number', 'like', "%{$search}%");
            }))
            ->groupBy('broker_id', 'insurer_code', 'insurer_name', 'policy_number')
            ->selectRaw("
                MIN(id) as id,
                broker_id, insurer_code, insurer_name, policy_number,
                MAX(client_name) as client_name,
                MAX(client_document) as client_document,
                MAX(client_doc_type) as client_doc_type,
                MAX(ramo) as ramo,
                MAX(product_name) as product_name,
                SUM(prima_total) as prima_cuotas,
                SUM(valor_pendiente) as valor_pendiente,
                SUM(valor_pagado) as valor_pagado,
                SUM(bonificacion) as bonificacion,
                MAX(moneda) as moneda,
                MAX(dias_mora) as dias_mora,
                CASE
                    WHEN MAX(dias_mora) = 0 THEN 'al_dia'
                    WHEN MAX(dias_mora) <= 30 THEN 'mora_30'
                    WHEN MAX(dias_mora) <= 60 THEN 'mora_60'
                    WHEN MAX(dias_mora) <= 90 THEN 'mora_90'
                    ELSE 'mora_90_plus'
                END as rango_mora,
                COUNT(*) as cuotas_pendientes,
                MIN(fecha_inicio_vigencia) as fecha_inicio_vigencia,
                MIN(fecha_expedicion) as fecha_expedicion,
                MIN(fecha_vencimiento) as proxima_cuota_vence,
                MAX(fecha_vencimiento) as ultima_cuota_vence,
                MAX(numero_recibo) as numero_recibo,
                MAX(numero_pagare) as numero_pagare,
                MAX(total_cuotas) as total_cuotas,
                MAX(cuotas_pagadas) as cuotas_pagadas,
                MAX(cuotas_mora) as cuotas_mora,
                MAX(synced_at) as synced_at
            ");

        // LEFT JOIN con polizas para traer la prima real contratada.
        // Se usa un segundo wrap para que paginate trabaje bien con el JOIN.
        $query = DB::query()->fromSub($sub, 'agg')
            ->leftJoin('polizas as p', function ($join) {
                $join->on('p.broker_id', '=', 'agg.broker_id')
                     ->on('p.policy_number', '=', 'agg.policy_number')
                     ->whereNull('p.deleted_at');
            })
            ->selectRaw("
                agg.*,
                COALESCE(p.premium_amount, 0) as prima_poliza,
                COALESCE(p.total_amount, 0) as total_poliza,
                p.id as poliza_id,
                -- prima_total: prioridad a la prima real de la póliza; si es 0 usar suma de cuotas
                CASE WHEN p.premium_amount > 0 THEN p.premium_amount ELSE agg.prima_cuotas END as prima_total,
                -- valor_pagado_total: si hay prima real de póliza, derivar lo pagado como prima - pendiente
                CASE
                    WHEN p.premium_amount > 0 AND p.premium_amount >= agg.valor_pendiente
                        THEN p.premium_amount - agg.valor_pendiente
                    ELSE agg.valor_pagado
                END as valor_pagado_total
            ");

        if ($tab !== 'todos') {
            $query->where('rango_mora', $tab);
        }

        $query->orderByDesc('dias_mora')->orderByDesc('valor_pendiente');

        $paginated = $query->paginate($perPage, ['*'], 'page', $page);

        // fecha_vencimiento para UI = próxima cuota por vencer
        $items = array_map(function ($row) {
            $row = (array) $row;
            $row['fecha_vencimiento'] = $row['proxima_cuota_vence'] ?? null;
            return $row;
        }, $paginated->items());

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items,
                'pagination' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                ],
            ],
        ]);
    }

    /**
     * Desglose de cuotas pendientes para una póliza específica.
     * Usado por el modal de detalle para mostrar cuándo vence cada cuota.
     */
    public function cuotas(Request $request, string $policyNumber)
    {
        $brokerId = $this->resolveBrokerId($request);

        $items = CarteraAseguradora::forBroker($brokerId)
            ->where('policy_number', $policyNumber)
            ->orderBy('fecha_vencimiento', 'asc')
            ->orderBy('numero_recibo', 'asc')
            ->get();

        $totales = [
            'cuotas' => $items->count(),
            'prima_total' => (float) $items->sum('prima_total'),
            'valor_pendiente' => (float) $items->sum('valor_pendiente'),
            'valor_pagado' => (float) $items->sum('valor_pagado'),
            'dias_mora_max' => (int) ($items->max('dias_mora') ?? 0),
        ];

        return response()->json([
            'success' => true,
            'data' => ['items' => $items, 'totales' => $totales],
        ]);
    }

    public function stats(Request $request)
    {
        $brokerId = $this->resolveBrokerId($request);
        $insurer = $request->input('insurer');

        // Stats también se calculan sobre pólizas consolidadas, no sobre filas
        // individuales. Para ello usamos una subquery agrupada por póliza y el
        // rango_mora se deriva del MAX(dias_mora) de las cuotas pendientes.
        // Se LEFT JOIN con polizas para usar la prima real cuando esté disponible.
        $consolidadoSub = DB::table('cartera_aseguradoras as ca')
            ->leftJoin('polizas as p', function ($join) {
                $join->on('p.broker_id', '=', 'ca.broker_id')
                     ->on('p.policy_number', '=', 'ca.policy_number')
                     ->whereNull('p.deleted_at');
            })
            ->where('ca.broker_id', $brokerId)
            ->when($insurer, fn ($q) => $q->where('ca.insurer_code', $insurer))
            ->groupBy('ca.broker_id', 'ca.insurer_code', 'ca.insurer_name', 'ca.policy_number', 'p.premium_amount')
            ->selectRaw("
                ca.insurer_code, ca.insurer_name, ca.policy_number,
                SUM(ca.valor_pendiente) as valor_pendiente_total,
                CASE WHEN p.premium_amount > 0 THEN p.premium_amount ELSE SUM(ca.prima_total) END as prima_total,
                MAX(ca.dias_mora) as dias_mora_max,
                MAX(ca.synced_at) as synced_at,
                CASE
                    WHEN MAX(ca.dias_mora) = 0 THEN 'al_dia'
                    WHEN MAX(ca.dias_mora) <= 30 THEN 'mora_30'
                    WHEN MAX(ca.dias_mora) <= 60 THEN 'mora_60'
                    WHEN MAX(ca.dias_mora) <= 90 THEN 'mora_90'
                    ELSE 'mora_90_plus'
                END as rango_mora_calc
            ");

        $rangos = DB::query()->fromSub($consolidadoSub, 'c')
            ->select('rango_mora_calc as rango_mora',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(valor_pendiente_total) as total_pendiente'))
            ->groupBy('rango_mora_calc')
            ->get()
            ->keyBy('rango_mora');

        $byInsurer = DB::query()->fromSub($consolidadoSub, 'c')
            ->select('insurer_code', 'insurer_name',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(valor_pendiente_total) as total_pendiente'),
                DB::raw('MAX(dias_mora_max) as max_dias_mora'))
            ->groupBy('insurer_code', 'insurer_name')
            ->get();

        $totals = DB::query()->fromSub($consolidadoSub, 'c')
            ->selectRaw('COUNT(*) as total_items')
            ->selectRaw('SUM(valor_pendiente_total) as total_pendiente')
            ->selectRaw('SUM(prima_total) as total_primas')
            ->selectRaw('MAX(synced_at) as last_sync')
            ->first();

        // Total de cuotas individuales (para mostrar "X pólizas · Y cuotas")
        $cuotasCount = DB::table('cartera_aseguradoras')
            ->where('broker_id', $brokerId)
            ->when($insurer, fn ($q) => $q->where('insurer_code', $insurer))
            ->count();

        $tabCounts = [
            'todos' => (int) ($totals->total_items ?? 0),
            'al_dia' => (int) ($rangos['al_dia']->count ?? 0),
            'mora_30' => (int) ($rangos['mora_30']->count ?? 0),
            'mora_60' => (int) ($rangos['mora_60']->count ?? 0),
            'mora_90' => (int) ($rangos['mora_90']->count ?? 0),
            'mora_90_plus' => (int) ($rangos['mora_90_plus']->count ?? 0),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'totals' => [
                    'items' => (int) ($totals->total_items ?? 0), // pólizas únicas en cartera
                    'cuotas_pendientes' => (int) $cuotasCount,     // total de cuotas individuales
                    'valor_pendiente' => (float) ($totals->total_pendiente ?? 0),
                    'total_primas' => (float) ($totals->total_primas ?? 0),
                    'last_sync' => $totals->last_sync,
                ],
                'tab_counts' => $tabCounts,
                'by_rango' => $rangos,
                'by_insurer' => $byInsurer,
            ],
        ]);
    }

    private function resolveBrokerId(Request $request): int
    {
        if ($request->has('authenticated_broker_id')) {
            return (int) $request->get('authenticated_broker_id');
        }
        $user = $request->user() ?: Auth::user();
        if ($user && !empty($user->broker_id)) {
            return (int) $user->broker_id;
        }
        if (app()->environment(['local', 'development'])) {
            $devBrokerId = $request->header('X-Dev-Broker-Id');
            if ($devBrokerId) return (int) $devBrokerId;
            $firstBroker = Broker::first();
            if ($firstBroker) return (int) $firstBroker->id;
        }
        throw new \RuntimeException('No se pudo resolver broker_id.');
    }
}
