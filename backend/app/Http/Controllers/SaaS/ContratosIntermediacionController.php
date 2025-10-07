<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\ContratoIntermediacion;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ContratosIntermediacionController extends Controller
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
        if (!$brokerId) return response()->json(['success'=>false,'message'=>'broker_id no resuelto'], 400);
        $q = ContratoIntermediacion::forBroker($brokerId);
        if ($estado = $request->get('estado')) $q->where('estado', $estado);
        if ($tipo = $request->get('tipo_contrato')) $q->where('tipo_contrato', $tipo);
        if ($s = $request->get('search')) {
            $q->where(function($w) use ($s){
                $w->where('numero_contrato','like',"%$s%")
                  ->orWhere('aseguradora','like',"%$s%");
            });
        }
        $per = (int) $request->get('per_page', 20);
        return response()->json($q->orderByDesc('id')->paginate($per));
    }

    public function store(Request $request): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success'=>false,'message'=>'broker_id no resuelto'], 400);
        $data = $request->validate([
            'numero_contrato' => 'required|string|max:255',
            'aseguradora' => 'required|string|max:255',
            'tipo_contrato' => 'required|in:intermediacion,comision,exclusividad,marco',
            'fecha_inicio' => 'required|date',
            'fecha_vencimiento' => 'required|date',
            'estado' => 'nullable|in:activo,vencido,por_vencer,cancelado,borrador',
            'comision_base' => 'nullable|numeric|min:0|max:100',
            'comision_adicional' => 'nullable|numeric|min:0|max:100',
            'productos_autorizados' => 'nullable|array',
            'territorio' => 'nullable|string',
            'responsable' => 'nullable|string',
            'archivo_url' => 'nullable|string',
            'fecha_firma' => 'nullable|date',
            'firmado_digitalmente' => 'nullable|boolean',
            'renovacion_automatica' => 'nullable|boolean',
            'valor_estimado_anual' => 'nullable|integer|min:0',
            'clausulas_especiales' => 'nullable|array',
            'observaciones' => 'nullable|string',
        ]);
        $data['broker_id'] = $brokerId;
        $row = ContratoIntermediacion::create($data);
        return response()->json(['success'=>true,'data'=>$row], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success'=>false,'message'=>'broker_id no resuelto'], 400);
        $row = ContratoIntermediacion::forBroker($brokerId)->findOrFail($id);
        $data = $request->validate([
            'numero_contrato' => 'sometimes|required|string|max:255',
            'aseguradora' => 'sometimes|required|string|max:255',
            'tipo_contrato' => 'sometimes|required|in:intermediacion,comision,exclusividad,marco',
            'fecha_inicio' => 'nullable|date',
            'fecha_vencimiento' => 'nullable|date',
            'estado' => 'nullable|in:activo,vencido,por_vencer,cancelado,borrador',
            'comision_base' => 'nullable|numeric|min:0|max:100',
            'comision_adicional' => 'nullable|numeric|min:0|max:100',
            'productos_autorizados' => 'nullable|array',
            'territorio' => 'nullable|string',
            'responsable' => 'nullable|string',
            'archivo_url' => 'nullable|string',
            'fecha_firma' => 'nullable|date',
            'firmado_digitalmente' => 'nullable|boolean',
            'renovacion_automatica' => 'nullable|boolean',
            'valor_estimado_anual' => 'nullable|integer|min:0',
            'clausulas_especiales' => 'nullable|array',
            'observaciones' => 'nullable|string',
        ]);
        $row->update($data);
        return response()->json(['success'=>true,'data'=>$row->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success'=>false,'message'=>'broker_id no resuelto'], 400);
        $row = ContratoIntermediacion::forBroker($brokerId)->findOrFail($id);
        $row->delete();
        return response()->json(['success'=>true]);
    }
}


