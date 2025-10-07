<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Poliza;

class SaasReportesFinancierosController extends Controller
{
    private function getPeriodRange(?string $period): array
    {
        $start = $period ? \Carbon\Carbon::createFromFormat('Y-m', $period)->startOfMonth() : now()->startOfMonth();
        $end = (clone $start)->endOfMonth();
        return [$start, $end];
    }

    public function monthly(Request $request): JsonResponse
    {
        $brokerId = (int) ($request->user()->broker_id ?? $request->get('broker_id'));
        $months = max(1, (int) $request->get('months', 3));
        $basePeriod = $request->get('period', now()->format('Y-m'));

        $results = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $period = \Carbon\Carbon::createFromFormat('Y-m', $basePeriod)->copy()->subMonths($i)->format('Y-m');
            [$start, $end] = $this->getPeriodRange($period);

            $query = Poliza::byBroker($brokerId)
                ->whereBetween('issue_date', [$start->toDateString(), $end->toDateString()]);

            $totalPrimas = (float) $query->sum('premium_amount');
            $totalComisiones = (float) $query->sum('commission_amount');
            $comisionesPagadas = (float) $query->where('payment_status', 'paid')->sum('commission_amount');
            $comisionesPendientes = max(0.0, $totalComisiones - $comisionesPagadas);
            $anticipos = 0.0; // placeholder si luego hay tabla de anticipos
            $ajustes = 0.0; // placeholder si luego hay ajustes
            $margenBruto = $totalPrimas > 0 ? ($totalComisiones / $totalPrimas) * 100.0 : 0.0;

            $results[] = [
                'periodo' => $period,
                'totalPrimas' => $totalPrimas,
                'totalComisiones' => $totalComisiones,
                'comisionesPagadas' => $comisionesPagadas,
                'comisionesPendientes' => $comisionesPendientes,
                'anticipos' => $anticipos,
                'ajustes' => $ajustes,
                'margenBruto' => round($margenBruto, 1),
                // crecimiento se calcula frente al inmediatamente anterior (lo agregaremos en front)
                'crecimiento' => 0.0,
            ];
        }

        // Calcular crecimiento mes a mes
        for ($i = 1; $i < count($results); $i++) {
            $prev = $results[$i - 1]['totalPrimas'] ?? 0;
            $curr = $results[$i]['totalPrimas'] ?? 0;
            $results[$i]['crecimiento'] = $prev > 0 ? (($curr - $prev) / $prev) * 100.0 : 0.0;
        }

        return response()->json($results);
    }

    public function byAdvisor(Request $request): JsonResponse
    {
        $brokerId = (int) ($request->user()->broker_id ?? $request->get('broker_id'));
        [$start, $end] = $this->getPeriodRange($request->get('period'));

        $raw = Poliza::byBroker($brokerId)
            ->whereBetween('issue_date', [$start->toDateString(), $end->toDateString()])
            ->whereNotNull('assigned_user_id')
            ->with('assignedUser')
            ->get()
            ->groupBy('assigned_user_id')
            ->map(function ($items) {
                $asesor = optional($items->first()->assignedUser)->name ?: 'Sin asignar';
                $comisionesGeneradas = (float) $items->sum('commission_amount');
                $comisionesPagadas = (float) $items->where('payment_status', 'paid')->sum('commission_amount');
                $polizas = (int) $items->count();
                return [
                    'asesor' => $asesor,
                    'comisionesGeneradas' => $comisionesGeneradas,
                    'comisionesPagadas' => $comisionesPagadas,
                    'metaCumplida' => 0,
                    'porcentajeMeta' => 0,
                    'clientesActivos' => 0,
                    'polizasVendidas' => $polizas,
                ];
            })
            ->values();

        return response()->json($raw);
    }

    public function byInsurer(Request $request): JsonResponse
    {
        $brokerId = (int) ($request->user()->broker_id ?? $request->get('broker_id'));
        [$start, $end] = $this->getPeriodRange($request->get('period'));

        $polizas = Poliza::byBroker($brokerId)
            ->whereBetween('issue_date', [$start->toDateString(), $end->toDateString()])
            ->get();

        $totalPrimasPeriod = (float) $polizas->sum('premium_amount');

        $grouped = $polizas->groupBy('insurance_company')->map(function ($items, $aseguradora) use ($totalPrimasPeriod) {
            $primasTotal = (float) $items->sum('premium_amount');
            $comisiones = (float) $items->sum('commission_amount');
            $polizasActivas = (int) $items->count();
            $porcentajeParticipacion = $totalPrimasPeriod > 0 ? ($primasTotal / $totalPrimasPeriod) * 100.0 : 0.0;
            return [
                'aseguradora' => $aseguradora ?: 'N/A',
                'primasTotal' => $primasTotal,
                'comisiones' => $comisiones,
                'porcentajeParticipacion' => round($porcentajeParticipacion, 1),
                'polizasActivas' => $polizasActivas,
                'crecimientoMensual' => 0.0, // el front puede calcular tendencia si necesita serie
            ];
        })->values();

        return response()->json($grouped);
    }
}


