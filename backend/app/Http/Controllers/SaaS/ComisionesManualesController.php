<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\ComisionManualPoliza;
use App\Models\Poliza;
use App\Models\Vendedor;
use App\Models\Aseguradora;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ComisionesManualesController extends Controller
{
    /**
     * Obtener broker_id desde request
     */
    private function getBrokerId(Request $request): int
    {
        if ($request->has('authenticated_broker_id')) {
            return (int) $request->get('authenticated_broker_id');
        }

        if ($request->has('broker_id')) {
            return (int) $request->get('broker_id');
        }

        $authType = $request->get('auth_type');
        
        if ($authType === 'empleado') {
            $user = $request->get('authenticated_empleado');
            if ($user && $user->broker_id) {
                return (int) $user->broker_id;
            }
        } else {
            $user = $request->user();
            if ($user && isset($user->broker_id) && $user->broker_id) {
                return (int) $user->broker_id;
            }
        }

        if (app()->environment('local', 'development')) {
            $devBrokerId = $request->header('X-Dev-Broker-Id');
            if ($devBrokerId) {
                return (int) $devBrokerId;
            }
        }

        return (int) env('DEV_FALLBACK_BROKER_ID', 0);
    }

    /**
     * Obtener user_id del usuario autenticado
     */
    private function getUserId(Request $request): ?int
    {
        $authType = $request->get('auth_type');
        
        if ($authType === 'empleado') {
            return null;
        }
        
        $user = $request->user();
        if ($user && isset($user->id)) {
            return (int) $user->id;
        }
        
        return null;
    }

    /**
     * Listar comisiones manuales de una póliza
     */
    public function index(Request $request, $polizaId)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            // Verificar que la póliza pertenece al broker
            $poliza = Poliza::where('broker_id', $brokerId)->find($polizaId);
            if (!$poliza) {
                return response()->json([
                    'success' => false,
                    'message' => 'Póliza no encontrada',
                ], 404);
            }

            $comisiones = ComisionManualPoliza::where('broker_id', $brokerId)
                ->where('poliza_id', $polizaId)
                ->with(['vendedor', 'aseguradora', 'liquidacion', 'creadoPor'])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $comisiones,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener comisiones: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Crear comisión manual
     */
    public function store(Request $request, $polizaId)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $userId = $this->getUserId($request);
            
            // Verificar que la póliza pertenece al broker
            $poliza = Poliza::where('broker_id', $brokerId)
                ->with(['client', 'aseguradora', 'vendedor', 'ramo'])
                ->find($polizaId);
                
            if (!$poliza) {
                return response()->json([
                    'success' => false,
                    'message' => 'Póliza no encontrada',
                ], 404);
            }

            $validator = Validator::make($request->all(), [
                'vendedor_id' => 'required|exists:vendedores,id',
                'anexo' => 'nullable|string|max:50',
                'tipo_movimiento' => 'required|string|max:50',
                'saldo' => 'nullable|numeric|min:0',
                'abono_prima' => 'required|numeric|min:0',
                'porcentaje_comision' => 'required|numeric|min:0|max:100',
                'porcentaje_agencia' => 'nullable|numeric|min:0|max:100',
                'porcentaje_rtf' => 'nullable|numeric|min:0|max:100',
                'reteiva' => 'nullable|numeric|min:0',
                'ica' => 'nullable|numeric|min:0',
                'cree' => 'nullable|numeric|min:0',
                'tipo_documento' => 'nullable|string|max:50',
                'observaciones' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            // Verificar que el vendedor pertenece al broker
            $vendedor = Vendedor::where('broker_id', $brokerId)->find($request->vendedor_id);
            if (!$vendedor) {
                return response()->json([
                    'success' => false,
                    'message' => 'Vendedor no encontrado',
                ], 404);
            }

            // Obtener nombre del asegurado
            $aseguradoNombre = $poliza->client 
                ? trim($poliza->client->first_name . ' ' . $poliza->client->last_name)
                : ($poliza->client_name ?? 'Sin nombre');

            // Crear comisión manual
            $comision = new ComisionManualPoliza([
                'broker_id' => $brokerId,
                'poliza_id' => $polizaId,
                'vendedor_id' => $request->vendedor_id,
                'aseguradora_id' => $poliza->aseguradora_id,
                'numero_poliza' => $poliza->policy_number,
                'anexo' => $request->anexo,
                'tipo_movimiento' => $request->tipo_movimiento,
                'asegurado_nombre' => $aseguradoNombre,
                'ramo' => $poliza->ramo?->nombre ?? $poliza->type,
                'saldo' => $request->saldo ?? 0,
                'abono_prima' => $request->abono_prima,
                'porcentaje_comision' => $request->porcentaje_comision,
                'porcentaje_agencia' => $request->porcentaje_agencia ?? 0,
                'porcentaje_rtf' => $request->porcentaje_rtf ?? 0,
                'reteiva' => $request->reteiva ?? 0,
                'ica' => $request->ica ?? 0,
                'cree' => $request->cree ?? 0,
                'tipo_documento' => $request->tipo_documento ?? $vendedor->tipo_documento,
                'estado' => 'pendiente',
                'observaciones' => $request->observaciones,
                'creado_por' => $userId,
            ]);

            // Calcular valores
            $comision->calcularComision();
            $comision->save();

            return response()->json([
                'success' => true,
                'message' => 'Comisión creada exitosamente',
                'data' => $comision->load(['vendedor', 'aseguradora']),
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear comisión: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Ver detalle de comisión
     */
    public function show(Request $request, $polizaId, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $comision = ComisionManualPoliza::where('broker_id', $brokerId)
                ->where('poliza_id', $polizaId)
                ->with(['vendedor', 'aseguradora', 'poliza.client', 'liquidacion', 'creadoPor'])
                ->find($id);

            if (!$comision) {
                return response()->json([
                    'success' => false,
                    'message' => 'Comisión no encontrada',
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $comision,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener comisión: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Actualizar comisión
     */
    public function update(Request $request, $polizaId, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $comision = ComisionManualPoliza::where('broker_id', $brokerId)
                ->where('poliza_id', $polizaId)
                ->find($id);

            if (!$comision) {
                return response()->json([
                    'success' => false,
                    'message' => 'Comisión no encontrada',
                ], 404);
            }

            // No permitir editar si ya está liquidada o pagada
            if (in_array($comision->estado, ['liquidada', 'pagada'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede editar una comisión que ya ha sido liquidada o pagada',
                ], 400);
            }

            $validator = Validator::make($request->all(), [
                'vendedor_id' => 'sometimes|exists:vendedores,id',
                'anexo' => 'nullable|string|max:50',
                'tipo_movimiento' => 'sometimes|string|max:50',
                'saldo' => 'nullable|numeric|min:0',
                'abono_prima' => 'sometimes|numeric|min:0',
                'porcentaje_comision' => 'sometimes|numeric|min:0|max:100',
                'porcentaje_agencia' => 'nullable|numeric|min:0|max:100',
                'porcentaje_rtf' => 'nullable|numeric|min:0|max:100',
                'reteiva' => 'nullable|numeric|min:0',
                'ica' => 'nullable|numeric|min:0',
                'cree' => 'nullable|numeric|min:0',
                'tipo_documento' => 'nullable|string|max:50',
                'observaciones' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            // Actualizar campos
            $comision->fill($request->only([
                'vendedor_id', 'anexo', 'tipo_movimiento', 'saldo', 'abono_prima',
                'porcentaje_comision', 'porcentaje_agencia', 'porcentaje_rtf',
                'reteiva', 'ica', 'cree', 'tipo_documento', 'observaciones'
            ]));

            // Recalcular valores
            $comision->calcularComision();
            $comision->save();

            return response()->json([
                'success' => true,
                'message' => 'Comisión actualizada exitosamente',
                'data' => $comision->load(['vendedor', 'aseguradora']),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar comisión: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Eliminar comisión
     */
    public function destroy(Request $request, $polizaId, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $comision = ComisionManualPoliza::where('broker_id', $brokerId)
                ->where('poliza_id', $polizaId)
                ->find($id);

            if (!$comision) {
                return response()->json([
                    'success' => false,
                    'message' => 'Comisión no encontrada',
                ], 404);
            }

            // No permitir eliminar si ya está liquidada o pagada
            if (in_array($comision->estado, ['liquidada', 'pagada'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede eliminar una comisión que ya ha sido liquidada o pagada',
                ], 400);
            }

            $comision->delete();

            return response()->json([
                'success' => true,
                'message' => 'Comisión eliminada exitosamente',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar comisión: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Anular comisión
     */
    public function anular(Request $request, $polizaId, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $comision = ComisionManualPoliza::where('broker_id', $brokerId)
                ->where('poliza_id', $polizaId)
                ->find($id);

            if (!$comision) {
                return response()->json([
                    'success' => false,
                    'message' => 'Comisión no encontrada',
                ], 404);
            }

            if (!$comision->anular()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede anular esta comisión',
                ], 400);
            }

            return response()->json([
                'success' => true,
                'message' => 'Comisión anulada exitosamente',
                'data' => $comision,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al anular comisión: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtener comisiones manuales pendientes para liquidar (por vendedor)
     */
    public function pendientesPorVendedor(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $query = ComisionManualPoliza::where('broker_id', $brokerId)
                ->where('estado', 'pendiente')
                ->with(['vendedor', 'aseguradora', 'poliza.client']);

            // Filtrar por vendedor si se especifica
            if ($request->has('vendedor_id') && $request->vendedor_id) {
                $query->where('vendedor_id', $request->vendedor_id);
            }

            $comisiones = $query->get();

            // Agrupar por vendedor
            $porVendedor = $comisiones->groupBy('vendedor_id')->map(function ($items, $vendedorId) {
                $vendedor = $items->first()->vendedor;
                return [
                    'vendedor_id' => $vendedorId,
                    'vendedor_nombre' => $vendedor?->nombres ?? 'Sin vendedor',
                    'tipo_documento' => $vendedor?->tipo_documento,
                    'numero_documento' => $vendedor?->numero_documento,
                    'total_comisiones' => $items->count(),
                    'total_valor_comision' => $items->sum('valor_comision'),
                    'total_neto_comision' => $items->sum('neto_comision'),
                    'comisiones' => $items->map(function ($c) {
                        return [
                            'id' => $c->id,
                            'poliza_id' => $c->poliza_id,
                            'numero_poliza' => $c->numero_poliza,
                            'anexo' => $c->anexo,
                            'tipo_movimiento' => $c->tipo_movimiento,
                            'asegurado_nombre' => $c->asegurado_nombre,
                            'aseguradora' => $c->aseguradora?->nombre,
                            'ramo' => $c->ramo,
                            'abono_prima' => $c->abono_prima,
                            'valor_comision' => $c->valor_comision,
                            'neto_comision' => $c->neto_comision,
                            'created_at' => $c->created_at,
                        ];
                    }),
                ];
            })->values();

            return response()->json([
                'success' => true,
                'data' => $porVendedor,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener comisiones pendientes: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtener constantes para el formulario
     */
    public function constants(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => [
                'tipos_movimiento' => ComisionManualPoliza::TIPOS_MOVIMIENTO,
                'estados' => ComisionManualPoliza::ESTADOS,
            ],
        ]);
    }
}
