<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\CarteraCliente;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CarteraClientesController extends Controller
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

    public function index(Request $request): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) {
            return response()->json(['success' => false, 'message' => 'broker_id no resuelto'], 400);
        }
        $query = CarteraCliente::forBroker($brokerId);
        if ($s = $request->get('search')) {
            $query->where(function($q) use ($s){
                $q->where('nombre', 'like', "%$s%")
                  ->orWhere('documento', 'like', "%$s%")
                  ->orWhere('email', 'like', "%$s%");
            });
        }
        if ($estado = $request->get('estado')) $query->where('estado', $estado);
        if ($segmento = $request->get('segmento')) $query->where('segmento', $segmento);
        $perPage = (int) $request->get('per_page', 20);
        return response()->json($query->orderByDesc('id')->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success'=>false,'message'=>'broker_id no resuelto'], 400);
        $data = $request->validate([
            'nombre' => 'required|string|max:255',
            'tipo_documento' => 'nullable|string|max:10',
            'documento' => 'nullable|string|max:50',
            'email' => 'nullable|email',
            'telefono' => 'nullable|string|max:50',
            'asesor' => 'nullable|string|max:255',
            'polizas_activas' => 'nullable|integer|min:0',
            'prima_total' => 'nullable|integer|min:0',
            'comisiones_generadas' => 'nullable|integer|min:0',
            'ultima_renovacion' => 'nullable|date',
            'proximo_vencimiento' => 'nullable|date',
            'estado' => 'nullable|in:Activo,Inactivo,Prospecto',
            'segmento' => 'nullable|in:Premium,Estándar,Básico',
            'antiguedad' => 'nullable|integer|min:0',
        ]);
        $data['broker_id'] = $brokerId;
        $row = CarteraCliente::create($data);
        return response()->json(['success'=>true,'data'=>$row], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success'=>false,'message'=>'broker_id no resuelto'], 400);
        $row = CarteraCliente::forBroker($brokerId)->findOrFail($id);
        return response()->json(['success'=>true,'data'=>$row]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success'=>false,'message'=>'broker_id no resuelto'], 400);
        $row = CarteraCliente::forBroker($brokerId)->findOrFail($id);
        $data = $request->validate([
            'nombre' => 'sometimes|required|string|max:255',
            'tipo_documento' => 'nullable|string|max:10',
            'documento' => 'nullable|string|max:50',
            'email' => 'nullable|email',
            'telefono' => 'nullable|string|max:50',
            'asesor' => 'nullable|string|max:255',
            'polizas_activas' => 'nullable|integer|min:0',
            'prima_total' => 'nullable|integer|min:0',
            'comisiones_generadas' => 'nullable|integer|min:0',
            'ultima_renovacion' => 'nullable|date',
            'proximo_vencimiento' => 'nullable|date',
            'estado' => 'nullable|in:Activo,Inactivo,Prospecto',
            'segmento' => 'nullable|in:Premium,Estándar,Básico',
            'antiguedad' => 'nullable|integer|min:0',
        ]);
        $row->update($data);
        return response()->json(['success'=>true,'data'=>$row->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success'=>false,'message'=>'broker_id no resuelto'], 400);
        $row = CarteraCliente::forBroker($brokerId)->findOrFail($id);
        $row->delete();
        return response()->json(['success'=>true]);
    }
}


