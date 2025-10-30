<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\AnticipoAjuste;
use App\Models\User;
use App\Models\Poliza;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AnticiposAjustesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brokerId = (int) ($request->user()->broker_id ?? $request->get('broker_id') ?? 2);

        $query = AnticipoAjuste::byBroker($brokerId)
            ->with(['vendedor', 'poliza', 'aprobador']);

        // Filtros
        if ($request->filled('tipo')) {
            $query->where('tipo', $request->get('tipo'));
        }

        if ($request->filled('estado')) {
            $query->where('estado', $request->get('estado'));
        }

        if ($request->filled('vendedor_id')) {
            $query->where('vendedor_id', $request->get('vendedor_id'));
        }

        if ($request->filled('fecha_desde')) {
            $query->where('fecha', '>=', $request->get('fecha_desde'));
        }

        if ($request->filled('fecha_hasta')) {
            $query->where('fecha', '<=', $request->get('fecha_hasta'));
        }

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->where(function ($q) use ($search) {
                $q->where('concepto', 'like', "%{$search}%")
                  ->orWhereHas('vendedor', function ($vq) use ($search) {
                      $vq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        $movimientos = $query->orderBy('fecha', 'desc')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($m) {
                return [
                    'id' => $m->id,
                    'tipo' => $m->tipo,
                    'vendedor_id' => $m->vendedor_id,
                    'vendedor_nombre' => $m->vendedor->nombres ?? $m->vendedor->nombre ?? null,
                    'concepto' => $m->concepto,
                    'valor' => (float) $m->valor,
                    'fecha' => $m->fecha->format('Y-m-d'),
                    'estado' => $m->estado,
                    'observaciones' => $m->observaciones,
                    'poliza_id' => $m->poliza_id,
                    'numero_poliza' => $m->poliza->policy_number ?? null,
                    'aprobado_por' => $m->aprobador->name ?? null,
                    'fecha_aprobacion' => $m->fecha_aprobacion?->format('Y-m-d'),
                    'created_at' => $m->created_at->toISOString(),
                    'updated_at' => $m->updated_at->toISOString(),
                ];
            });

        return response()->json(['data' => $movimientos]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tipo' => 'required|in:anticipo,ajuste,descuento',
            'vendedor_id' => 'required|integer',
            'concepto' => 'required|string|max:255',
            'valor' => 'required|numeric',
            'observaciones' => 'nullable|string',
            'poliza_id' => 'nullable|integer',
        ]);

        $brokerId = (int) ($request->user()->broker_id ?? $request->get('broker_id') ?? 2);

        $movimiento = AnticipoAjuste::create([
            'broker_id' => $brokerId,
            'tipo' => $validated['tipo'],
            'vendedor_id' => $validated['vendedor_id'],
            'concepto' => $validated['concepto'],
            'valor' => $validated['valor'],
            'fecha' => now()->toDateString(),
            'estado' => 'pendiente',
            'observaciones' => $validated['observaciones'] ?? null,
            'poliza_id' => $validated['poliza_id'] ?? null,
        ]);

        $movimiento->load(['vendedor', 'poliza']);

        return response()->json([
            'success' => true,
            'message' => 'Movimiento creado exitosamente',
            'data' => [
                'id' => $movimiento->id,
                'tipo' => $movimiento->tipo,
                'vendedor_id' => $movimiento->vendedor_id,
                'vendedor_nombre' => $movimiento->vendedor->nombres ?? $movimiento->vendedor->nombre ?? null,
                'concepto' => $movimiento->concepto,
                'valor' => (float) $movimiento->valor,
                'fecha' => $movimiento->fecha->format('Y-m-d'),
                'estado' => $movimiento->estado,
                'observaciones' => $movimiento->observaciones,
                'poliza_id' => $movimiento->poliza_id,
                'numero_poliza' => $movimiento->poliza->policy_number ?? null,
            ]
        ], 201);
    }

    public function aprobar(Request $request, int $id): JsonResponse
    {
        $brokerId = (int) ($request->user()->broker_id ?? $request->get('broker_id') ?? 2);
        $userId = $request->user()->id ?? 1;

        $movimiento = AnticipoAjuste::byBroker($brokerId)->findOrFail($id);

        if ($movimiento->estado !== 'pendiente') {
            return response()->json([
                'success' => false,
                'message' => 'Solo se pueden aprobar movimientos pendientes'
            ], 400);
        }

        $movimiento->update([
            'estado' => 'aprobado',
            'aprobado_por' => $userId,
            'fecha_aprobacion' => now(),
        ]);

        $movimiento->load(['vendedor', 'poliza', 'aprobador']);

        return response()->json([
            'success' => true,
            'message' => 'Movimiento aprobado exitosamente',
            'data' => [
                'id' => $movimiento->id,
                'tipo' => $movimiento->tipo,
                'vendedor_id' => $movimiento->vendedor_id,
                'vendedor_nombre' => $movimiento->vendedor->nombres ?? $movimiento->vendedor->nombre ?? null,
                'concepto' => $movimiento->concepto,
                'valor' => (float) $movimiento->valor,
                'fecha' => $movimiento->fecha->format('Y-m-d'),
                'estado' => $movimiento->estado,
                'aprobado_por' => $movimiento->aprobador->name ?? null,
                'fecha_aprobacion' => $movimiento->fecha_aprobacion?->format('Y-m-d'),
            ]
        ]);
    }

    public function rechazar(Request $request, int $id): JsonResponse
    {
        $brokerId = (int) ($request->user()->broker_id ?? $request->get('broker_id') ?? 2);
        $userId = $request->user()->id ?? 1;

        $movimiento = AnticipoAjuste::byBroker($brokerId)->findOrFail($id);

        if ($movimiento->estado !== 'pendiente') {
            return response()->json([
                'success' => false,
                'message' => 'Solo se pueden rechazar movimientos pendientes'
            ], 400);
        }

        $motivo = $request->get('motivo');
        if ($motivo) {
            $movimiento->observaciones = ($movimiento->observaciones ? $movimiento->observaciones . ' | ' : '') . "Rechazado: {$motivo}";
        }

        $movimiento->update([
            'estado' => 'rechazado',
            'aprobado_por' => $userId,
            'fecha_aprobacion' => now(),
        ]);

        $movimiento->load(['vendedor', 'poliza', 'aprobador']);

        return response()->json([
            'success' => true,
            'message' => 'Movimiento rechazado',
            'data' => [
                'id' => $movimiento->id,
                'estado' => $movimiento->estado,
                'aprobado_por' => $movimiento->aprobador->name ?? null,
                'fecha_aprobacion' => $movimiento->fecha_aprobacion?->format('Y-m-d'),
            ]
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $brokerId = (int) ($request->user()->broker_id ?? $request->get('broker_id') ?? 2);

        $movimiento = AnticipoAjuste::byBroker($brokerId)->findOrFail($id);

        // Solo permitir eliminar movimientos rechazados
        if ($movimiento->estado !== 'rechazado') {
            return response()->json([
                'success' => false,
                'message' => 'Solo se pueden eliminar movimientos rechazados'
            ], 400);
        }

        $movimiento->delete();

        return response()->json([
            'success' => true,
            'message' => 'Movimiento eliminado exitosamente'
        ]);
    }

    public function estadisticas(Request $request): JsonResponse
    {
        $brokerId = (int) ($request->user()->broker_id ?? $request->get('broker_id') ?? 2);

        $query = AnticipoAjuste::byBroker($brokerId);

        if ($request->filled('fecha_desde')) {
            $query->where('fecha', '>=', $request->get('fecha_desde'));
        }

        if ($request->filled('fecha_hasta')) {
            $query->where('fecha', '<=', $request->get('fecha_hasta'));
        }

        $movimientos = $query->get();

        $totalAnticipos = (float) $movimientos->where('tipo', 'anticipo')
            ->where('estado', 'aprobado')
            ->sum('valor');

        $totalAjustes = (float) $movimientos->where('tipo', 'ajuste')
            ->where('estado', 'aprobado')
            ->sum('valor');

        $totalDescuentos = (float) $movimientos->where('tipo', 'descuento')
            ->where('estado', 'aprobado')
            ->sum('valor');

        $pendientesAprobacion = $movimientos->where('estado', 'pendiente')->count();

        return response()->json([
            'data' => [
                'totalAnticipos' => $totalAnticipos,
                'totalAjustes' => $totalAjustes,
                'totalDescuentos' => abs($totalDescuentos),
                'pendientesAprobacion' => $pendientesAprobacion,
                'totalMovimientos' => $movimientos->count(),
            ]
        ]);
    }
}