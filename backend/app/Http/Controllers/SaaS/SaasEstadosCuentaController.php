<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Poliza;
use App\Models\SalesPerformance;
use Illuminate\Support\Carbon;

class SaasEstadosCuentaController extends Controller
{
    private function getPeriodRange(?string $period): array
    {
        // period formato YYYY-MM
        $start = $period ? \Carbon\Carbon::createFromFormat('Y-m', $period)->startOfMonth() : now()->startOfMonth();
        $end = (clone $start)->endOfMonth();
        return [$start, $end];
    }

    public function metrics(Request $request): JsonResponse
    {
        $brokerId = (int) ($request->user()->broker_id ?? $request->get('broker_id'));
        [$start, $end] = $this->getPeriodRange($request->get('period'));

        $query = Poliza::byBroker($brokerId)
            ->whereBetween('issue_date', [$start->toDateString(), $end->toDateString()])
            ->where('commission_amount', '>', 0);

        $totalComisiones = (float) $query->sum('commission_amount');

        $pagadas = (float) Poliza::byBroker($brokerId)
            ->whereBetween('issue_date', [$start->toDateString(), $end->toDateString()])
            ->where('commission_amount', '>', 0)
            ->where('payment_status', 'paid')
            ->sum('commission_amount');

        $pendientes = max(0.0, $totalComisiones - $pagadas);

        return response()->json([
            'totalComisionesGeneradas' => $totalComisiones,
            'totalComisionesPagadas' => $pagadas,
            'totalComisionesPendientes' => $pendientes,
            'totalSaldos' => $pendientes, // asimilado a saldo pendiente
            'asesores' => (int) Poliza::byBroker($brokerId)
                ->whereBetween('issue_date', [$start->toDateString(), $end->toDateString()])
                ->whereNotNull('assigned_user_id')
                ->distinct('assigned_user_id')
                ->count('assigned_user_id'),
        ]);
    }

    public function agents(Request $request): JsonResponse
    {
        $brokerId = (int) ($request->user()->broker_id ?? $request->get('broker_id'));
        [$start, $end] = $this->getPeriodRange($request->get('period'));

        $polizas = Poliza::byBroker($brokerId)
            ->whereBetween('issue_date', [$start->toDateString(), $end->toDateString()])
            ->where('commission_amount', '>', 0)
            ->with('assignedUser')
            ->get();

        $grouped = $polizas->groupBy('assigned_user_id');

        $data = $grouped->map(function ($items, $userId) use ($brokerId, $request) {
            $nombre = optional($items->first()->assignedUser)->name ?: 'Sin asignar';
            $comisionesGeneradas = (float) $items->sum('commission_amount');
            $comisionesPagadas = (float) $items->where('payment_status', 'paid')->sum('commission_amount');
            $comisionesPendientes = max(0.0, $comisionesGeneradas - $comisionesPagadas);
            $polizasVendidas = (int) $items->count();

            $goal = SalesPerformance::query()
                ->where('broker_id', $brokerId)
                ->where('user_id', (int) $userId)
                ->where('period', $request->get('period', now()->format('Y-m')))
                ->first();
            $meta = (float) ($goal->monthly_goal ?? 0);
            $porcentajeMeta = $meta > 0 ? (($comisionesGeneradas / $meta) * 100.0) : 0.0;

            return [
                'id' => (string) $userId,
                'asesor' => $nombre,
                'comisionesGeneradas' => $comisionesGeneradas,
                'comisionesPagadas' => $comisionesPagadas,
                'comisionesPendientes' => $comisionesPendientes,
                'saldoFinal' => $comisionesPendientes,
                'polizasVendidas' => $polizasVendidas,
                'metaCumplida' => $meta,
                'porcentajeMeta' => round($porcentajeMeta, 1),
            ];
        })->values();

        return response()->json($data);
    }

    public function advisorSummary(Request $request, int $userId): JsonResponse
    {
        $brokerId = (int) ($request->user()->broker_id ?? $request->get('broker_id'));
        [$start, $end] = $this->getPeriodRange($request->get('period'));

        $polizas = Poliza::byBroker($brokerId)
            ->where('assigned_user_id', $userId)
            ->whereBetween('issue_date', [$start->toDateString(), $end->toDateString()])
            ->where('commission_amount', '>', 0)
            ->get();

        $comisionesGeneradas = (float) $polizas->sum('commission_amount');
        $comisionesPagadas = (float) $polizas->where('payment_status', 'paid')->sum('commission_amount');
        $comisionesPendientes = max(0.0, $comisionesGeneradas - $comisionesPagadas);
        $polizasVendidas = (int) $polizas->count();

        $goal = SalesPerformance::query()
            ->where('broker_id', $brokerId)
            ->where('user_id', (int) $userId)
            ->where('period', $request->get('period', now()->format('Y-m')))
            ->first();
        $meta = (float) ($goal->monthly_goal ?? 0);
        $porcentajeMeta = $meta > 0 ? (($comisionesGeneradas / $meta) * 100.0) : 0.0;

        return response()->json([
            'id' => (string) $userId,
            'asesor' => optional($polizas->first()?->assignedUser)->name ?: 'Sin asignar',
            'periodo' => $request->get('period', now()->format('Y-m')),
            'comisionesGeneradas' => $comisionesGeneradas,
            'comisionesPagadas' => $comisionesPagadas,
            'comisionesPendientes' => $comisionesPendientes,
            'anticipos' => 0,
            'ajustes' => 0,
            'descuentos' => 0,
            'saldoFinal' => $comisionesPendientes,
            'polizasVendidas' => $polizasVendidas,
            'metaCumplida' => $meta,
            'porcentajeMeta' => round($porcentajeMeta, 1),
        ]);
    }

    public function advisorMovements(Request $request, int $userId): JsonResponse
    {
        $brokerId = (int) ($request->user()->broker_id ?? $request->get('broker_id'));
        [$start, $end] = $this->getPeriodRange($request->get('period'));

        $polizas = Poliza::byBroker($brokerId)
            ->where('assigned_user_id', $userId)
            ->whereBetween('issue_date', [$start->toDateString(), $end->toDateString()])
            ->where('commission_amount', '>', 0)
            ->orderBy('issue_date')
            ->get();

        $movimientos = [];
        foreach ($polizas as $p) {
            $movimientos[] = [
                'id' => (string) $p->id . '-C',
                'fecha' => optional($p->issue_date)->format('Y-m-d'),
                'concepto' => 'Comisión ' . ($p->policy_number ?: ('POL-' . $p->id)),
                'tipo' => 'Comisión',
                'valor' => (float) $p->commission_amount,
            ];
            if ($p->payment_status === 'paid') {
                $movimientos[] = [
                    'id' => (string) $p->id . '-P',
                    'fecha' => optional($p->payment_due_date ?: $p->updated_at)->format('Y-m-d'),
                    'concepto' => 'Pago de comisiones',
                    'tipo' => 'Pago',
                    'valor' => -(float) $p->commission_amount,
                ];
            }
        }

        // Calcular saldo acumulado
        $saldo = 0.0;
        $movimientos = array_map(function ($m) use (&$saldo) {
            $saldo += $m['valor'];
            $m['saldo'] = $saldo;
            return $m;
        }, $movimientos);

        return response()->json($movimientos);
    }
}


