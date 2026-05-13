<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Broker;
use App\Models\InsurerConnection;
use App\Models\RecibosComisionAseguradora;
use App\Services\InsurerSyncService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Expone recibos sincronizados con comisiones (tabla recibos_comisiones_aseguradoras).
 * Complementa CarteraConsolidadaController — misma forma de respuesta.
 */
class RecibosComisionesController extends Controller
{
    public function index(Request $request)
    {
        $brokerId = $this->resolveBrokerId($request);
        $perPage = (int) $request->input('per_page', 25);
        $page = (int) $request->input('page', 1);
        $search = $request->input('search', '');
        $insurer = $request->input('insurer');
        $anio = $request->input('anio');
        $mes = $request->input('mes');
        $ramo = $request->input('ramo');
        $policy = $request->input('policy');

        $query = RecibosComisionAseguradora::forBroker($brokerId);

        if ($insurer) $query->where('insurer_code', $insurer);
        if ($anio) $query->where('anio', $anio);
        if ($mes) $query->where('mes', str_pad($mes, 2, '0', STR_PAD_LEFT));
        if ($ramo && $ramo !== '00T') $query->where('ramo_codigo', $ramo);
        if ($policy) $query->where('policy_number', $policy);

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('client_name', 'like', "%{$search}%")
                  ->orWhere('client_document', 'like', "%{$search}%")
                  ->orWhere('policy_number', 'like', "%{$search}%")
                  ->orWhere('numero_recibo', 'like', "%{$search}%");
            });
        }

        $query->orderByDesc('fecha_recaudo')->orderByDesc('valor_comision');

        $paginated = $query->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $paginated->items(),
                'pagination' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                ],
            ],
        ]);
    }

    public function stats(Request $request)
    {
        $brokerId = $this->resolveBrokerId($request);
        $insurer = $request->input('insurer');
        $anio = $request->input('anio');
        $mes = $request->input('mes');

        $base = fn() => DB::table('recibos_comisiones_aseguradoras')
            ->where('broker_id', $brokerId)
            ->when($insurer, fn($q) => $q->where('insurer_code', $insurer))
            ->when($anio, fn($q) => $q->where('anio', $anio))
            ->when($mes, fn($q) => $q->where('mes', str_pad($mes, 2, '0', STR_PAD_LEFT)));

        $totals = $base()
            ->selectRaw('COUNT(*) as total_items')
            ->selectRaw('SUM(valor_comision) as total_comision')
            ->selectRaw('SUM(valor_pagado_tomador) as total_pagado')
            ->selectRaw('SUM(prima_neta) as total_prima_neta')
            ->selectRaw('MAX(synced_at) as last_sync')
            ->first();

        $byInsurer = $base()
            ->select('insurer_code', 'insurer_name',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(valor_comision) as total_comision'),
                DB::raw('SUM(valor_pagado_tomador) as total_pagado'))
            ->groupBy('insurer_code', 'insurer_name')
            ->orderByDesc('total_comision')
            ->get();

        $byPeriodo = $base()
            ->select('anio', 'mes',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(valor_comision) as total_comision'))
            ->groupBy('anio', 'mes')
            ->orderByDesc('anio')->orderByDesc('mes')
            ->limit(12)
            ->get();

        $byRamo = $base()
            ->select('ramo_codigo',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(valor_comision) as total_comision'))
            ->groupBy('ramo_codigo')
            ->orderByDesc('total_comision')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'totals' => [
                    'items' => (int) ($totals->total_items ?? 0),
                    'total_comision' => (float) ($totals->total_comision ?? 0),
                    'total_pagado' => (float) ($totals->total_pagado ?? 0),
                    'total_prima_neta' => (float) ($totals->total_prima_neta ?? 0),
                    'last_sync' => $totals->last_sync,
                ],
                'by_insurer' => $byInsurer,
                'by_periodo' => $byPeriodo,
                'by_ramo' => $byRamo,
            ],
        ]);
    }

    /**
     * Retorna los recibos de comisión de una póliza específica.
     * Usado por el modal de detalle en /apps/cartera/aseguradoras.
     */
    public function byPolicy(Request $request, string $policyNumber)
    {
        $brokerId = $this->resolveBrokerId($request);

        $items = RecibosComisionAseguradora::forBroker($brokerId)
            ->where('policy_number', $policyNumber)
            ->orderByDesc('fecha_recaudo')
            ->get();

        $total = [
            'recibos' => $items->count(),
            'valor_pagado' => (float) $items->sum('valor_pagado_tomador'),
            'valor_comision' => (float) $items->sum('valor_comision'),
            'prima_neta' => (float) $items->sum('prima_neta'),
        ];

        return response()->json([
            'success' => true,
            'data' => ['items' => $items, 'totales' => $total],
        ]);
    }

    /**
     * Dispara sync de comisiones para un mes específico, para todas las
     * aseguradoras conectadas (por ahora solo SURA).
     */
    public function sync(Request $request, InsurerSyncService $svc)
    {
        // Sincronización HTTP-síncrona: SURA + HDI en serie pueden tomar >60s.
        // PHP CLI ignora `php -d max_execution_time=N`, así que lo desactivamos aquí.
        @set_time_limit(0);
        @ini_set('max_execution_time', '0');

        $brokerId = $this->resolveBrokerId($request);
        $anio = (string) $request->input('anio', date('Y'));
        $mes = str_pad((string) $request->input('mes', date('m')), 2, '0', STR_PAD_LEFT);
        $ramo = $request->input('ramo', '00T');
        $insurer = $request->input('insurer');

        $connections = InsurerConnection::forBroker($brokerId)
            ->where('status', 'connected')
            ->when($insurer, fn($q) => $q->where('insurer_code', $insurer))
            ->get();

        $summary = [];
        foreach ($connections as $conn) {
            try {
                $r = $svc->syncComisiones($conn, $anio, $mes, $ramo);
                $summary[$conn->insurer_code] = $r;
            } catch (\Throwable $e) {
                $summary[$conn->insurer_code] = ['error' => $e->getMessage()];
            }
        }

        return response()->json([
            'success' => true,
            'anio' => $anio, 'mes' => $mes, 'ramo' => $ramo,
            'summary' => $summary,
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
