<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\EnlaceCotizacion;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class EnlacesCotizacionController extends Controller
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
        $query = EnlaceCotizacion::forBroker($brokerId);
        if ($tipo = $request->get('tipo')) $query->where('tipo', $tipo);
        if (!is_null($request->get('activo'))) $query->where('activo', (bool)$request->get('activo'));
        $per = (int) $request->get('per_page', 20);
        return response()->json($query->orderByDesc('id')->paginate($per));
    }

    public function store(Request $request): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success'=>false,'message'=>'broker_id no resuelto'], 400);
        $data = $request->validate([
            'nombre' => 'required|string|max:255',
            'tipo' => 'required|string|max:50',
            'descripcion' => 'nullable|string',
            'mensaje_bienvenida' => 'nullable|string',
        ]);
        $slug = str($data['nombre'])->slug('-');
        $enlace = "fgr.link/latamseguros/co/{$data['tipo']}/{$slug}";
        $row = EnlaceCotizacion::create([
            'broker_id' => $brokerId,
            'nombre' => $data['nombre'],
            'tipo' => $data['tipo'],
            'descripcion' => $data['descripcion'] ?? null,
            'slug' => (string) $slug,
            'enlace' => $enlace,
            'activo' => true,
            'config' => [ 'mensaje_bienvenida' => $data['mensaje_bienvenida'] ?? null ],
        ]);
        return response()->json(['success'=>true,'data'=>$row], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success'=>false,'message'=>'broker_id no resuelto'], 400);
        $row = EnlaceCotizacion::forBroker($brokerId)->findOrFail($id);
        $data = $request->validate([
            'nombre' => 'sometimes|required|string|max:255',
            'tipo' => 'sometimes|required|string|max:50',
            'descripcion' => 'nullable|string',
            'activo' => 'nullable|boolean',
            'mensaje_bienvenida' => 'nullable|string',
        ]);
        if (isset($data['nombre']) || isset($data['tipo'])) {
            $slug = str($data['nombre'] ?? $row->nombre)->slug('-');
            $tipo = $data['tipo'] ?? $row->tipo;
            $row->slug = (string) $slug;
            $row->enlace = "fgr.link/latamseguros/co/{$tipo}/{$slug}";
        }
        if (array_key_exists('activo', $data)) $row->activo = (bool)$data['activo'];
        if (isset($data['nombre'])) $row->nombre = $data['nombre'];
        if (isset($data['tipo'])) $row->tipo = $data['tipo'];
        if (array_key_exists('descripcion', $data)) $row->descripcion = $data['descripcion'];
        if (array_key_exists('mensaje_bienvenida', $data)) {
            $cfg = $row->config ?? [];
            $cfg['mensaje_bienvenida'] = $data['mensaje_bienvenida'];
            $row->config = $cfg;
        }
        $row->save();
        return response()->json(['success'=>true,'data'=>$row->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success'=>false,'message'=>'broker_id no resuelto'], 400);
        $row = EnlaceCotizacion::forBroker($brokerId)->findOrFail($id);
        $row->delete();
        return response()->json(['success'=>true]);
    }

    public function toggle(Request $request, int $id): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) return response()->json(['success'=>false,'message'=>'broker_id no resuelto'], 400);
        $row = EnlaceCotizacion::forBroker($brokerId)->findOrFail($id);
        $row->activo = !$row->activo;
        $row->save();
        return response()->json(['success'=>true,'data'=>$row]);
    }
}


