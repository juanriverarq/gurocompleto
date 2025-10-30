<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PagoPoliza;
use App\Models\CobroComision;
use App\Models\Poliza;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PagoPolizaController extends Controller
{
    /**
     * Listar recaudos de una póliza
     */
    public function index(Request $request, $polizaId)
    {
        try {
            $pagos = PagoPoliza::where('poliza_id', $polizaId)
                ->with(['poliza', 'cliente'])
                ->orderBy('fecha_pago', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $pagos
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener recaudos: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Registrar un recaudo de póliza
     */
    public function store(Request $request, $polizaId)
    {
        $validator = Validator::make($request->all(), [
            'tipo_recaudo' => 'required|in:oficina,aseguradora',
            'monto' => 'required|numeric|min:0.01',
            'metodo_pago' => 'nullable|string',
            'referencia_pago' => 'nullable|string',
            'fecha_pago' => 'nullable|date',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $poliza = Poliza::findOrFail($polizaId);

            // Crear el recaudo
            $pago = PagoPoliza::create([
                'broker_id' => $poliza->broker_id,
                'poliza_id' => $polizaId,
                'cliente_id' => $poliza->client_id,
                'monto_total' => $request->monto,
                'monto_pagado' => $request->monto,
                'monto_pendiente' => 0,
                'tipo_recaudo' => $request->tipo_recaudo,
                'metodo_pago' => $request->metodo_pago,
                'referencia_pago' => $request->referencia_pago,
                'fecha_pago' => $request->fecha_pago ?? now(),
                'estado' => 'pagado',
                'observaciones' => $request->observaciones,
            ]);

            // Si es recaudo oficina, crear automáticamente:
            // 1. Pago pendiente a la aseguradora (prima neta)
            // 2. Cobro de comisión pendiente
            if ($request->tipo_recaudo === 'oficina' && $pago->habilitaComision()) {
                // 1. Crear pago pendiente a aseguradora por la prima neta
                $primaNeta = $poliza->premium_amount ?? 0;
                if ($primaNeta > 0) {
                    PagoPoliza::create([
                        'broker_id' => $poliza->broker_id,
                        'poliza_id' => $polizaId,
                        'cliente_id' => $poliza->client_id,
                        'monto_total' => $primaNeta,
                        'monto_pagado' => 0,
                        'monto_pendiente' => $primaNeta,
                        'tipo_recaudo' => 'aseguradora',
                        'metodo_pago' => null,
                        'referencia_pago' => null,
                        'fecha_pago' => now(),
                        'estado' => 'pendiente',
                        'observaciones' => 'Pago pendiente a aseguradora generado por recaudo de oficina',
                    ]);
                }

                // 2. Crear cobro de comisión pendiente
                CobroComision::create([
                    'broker_id' => $poliza->broker_id,
                    'poliza_id' => $polizaId,
                    'aseguradora_id' => $poliza->aseguradora_id,
                    'pago_poliza_id' => $pago->id,
                    'monto_comision' => $poliza->commission_amount ?? 0,
                    'monto_cobrado' => 0,
                    'monto_pendiente' => $poliza->commission_amount ?? 0,
                    'estado' => 'pendiente',
                    'observaciones' => 'Comisión generada por recaudo de póliza',
                ]);
            }
            
            // Si es pago a aseguradora, actualizar el registro pendiente existente
            if ($request->tipo_recaudo === 'aseguradora') {
                // Buscar si hay un pago pendiente a aseguradora para esta póliza
                $pagoPendiente = PagoPoliza::where('poliza_id', $polizaId)
                    ->where('tipo_recaudo', 'aseguradora')
                    ->where('estado', 'pendiente')
                    ->first();
                
                if ($pagoPendiente) {
                    // Actualizar el registro pendiente en lugar de crear uno nuevo
                    $pagoPendiente->update([
                        'monto_pagado' => $request->monto,
                        'monto_pendiente' => max(0, $pagoPendiente->monto_total - $request->monto),
                        'estado' => 'pagado',
                        'metodo_pago' => $request->metodo_pago,
                        'referencia_pago' => $request->referencia_pago,
                        'fecha_pago' => $request->fecha_pago ?? now(),
                        'observaciones' => $request->observaciones,
                    ]);
                    
                    // Eliminar el pago que acabamos de crear para evitar duplicados
                    $pago->delete();
                    
                    // Usar el pago actualizado como respuesta
                    $pago = $pagoPendiente;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Recaudo registrado exitosamente',
                'data' => $pago->load(['poliza', 'cliente'])
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar recaudo: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Registrar cobro de comisión
     */
    public function registrarCobroComision(Request $request, $polizaId)
    {
        $validator = Validator::make($request->all(), [
            'monto' => 'required|numeric|min:0.01',
            'referencia_cobro' => 'nullable|string',
            'fecha_cobro' => 'nullable|date',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $poliza = Poliza::findOrFail($polizaId);

            // Buscar cobro de comisión pendiente o crear uno nuevo
            $cobroComision = CobroComision::where('poliza_id', $polizaId)
                ->whereIn('estado', ['pendiente', 'parcial'])
                ->first();

            if (!$cobroComision) {
                // Si no existe, crear uno nuevo con la comisión de la póliza
                $montoComision = $poliza->commission_amount ?? 0;
                
                if ($montoComision <= 0) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'La póliza no tiene comisión definida'
                    ], 422);
                }

                $cobroComision = CobroComision::create([
                    'broker_id' => $poliza->broker_id,
                    'poliza_id' => $polizaId,
                    'aseguradora_id' => $poliza->aseguradora_id,
                    'pago_poliza_id' => null,
                    'monto_comision' => $montoComision,
                    'monto_cobrado' => 0,
                    'monto_pendiente' => $montoComision,
                    'estado' => 'pendiente',
                    'observaciones' => 'Comisión creada manualmente',
                ]);
            }

            // Registrar el cobro
            $cobroComision->registrarCobro($request->monto, [
                'referencia_cobro' => $request->referencia_cobro,
                'observaciones' => $request->observaciones,
                'fecha_cobro' => $request->fecha_cobro ?? now(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Cobro de comisión registrado exitosamente',
                'data' => $cobroComision->load(['poliza', 'aseguradora'])
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar cobro: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Revertir un pago de póliza
     */
    public function revertirPago(Request $request, $polizaId, $pagoId)
    {
        try {
            DB::beginTransaction();

            $pago = PagoPoliza::where('poliza_id', $polizaId)
                ->where('id', $pagoId)
                ->first();

            if (!$pago) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pago no encontrado'
                ], 404);
            }

            if ($pago->tipo_recaudo === 'oficina') {
                // Revertir recaudo por oficina:
                // 1. Eliminar el recaudo de oficina
                // 2. Eliminar el cobro de comisión asociado
                // 3. Eliminar el pago pendiente a aseguradora
                CobroComision::where('pago_poliza_id', $pago->id)->delete();
                PagoPoliza::where('poliza_id', $polizaId)
                    ->where('tipo_recaudo', 'aseguradora')
                    ->delete();
                $pago->delete();
                
            } elseif ($pago->tipo_recaudo === 'aseguradora') {
                // Revertir pago a aseguradora:
                // Si tiene recaudo por oficina, volver a estado pendiente
                // Si NO tiene recaudo por oficina, eliminar completamente
                $tieneRecaudoOficina = PagoPoliza::where('poliza_id', $polizaId)
                    ->where('tipo_recaudo', 'oficina')
                    ->where('estado', 'pagado')
                    ->exists();
                
                if ($tieneRecaudoOficina) {
                    // Volver a estado pendiente (regresa a "Por Pagar")
                    $pago->update([
                        'monto_pagado' => 0,
                        'monto_pendiente' => $pago->monto_total,
                        'estado' => 'pendiente',
                        'metodo_pago' => null,
                        'referencia_pago' => null,
                        'observaciones' => 'Pago revertido - pendiente nuevamente',
                    ]);
                } else {
                    // Eliminar completamente (regresa a "Por Cobrar")
                    $pago->delete();
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Pago revertido exitosamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al revertir pago: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Revertir un cobro de comisión
     */
    public function revertirCobroComision(Request $request, $polizaId, $cobroId)
    {
        try {
            DB::beginTransaction();

            $cobro = CobroComision::where('poliza_id', $polizaId)
                ->where('id', $cobroId)
                ->first();

            if (!$cobro) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cobro de comisión no encontrado'
                ], 404);
            }

            // Volver el cobro a estado pendiente
            $cobro->update([
                'monto_cobrado' => 0,
                'monto_pendiente' => $cobro->monto_comision,
                'estado' => 'pendiente',
                'fecha_cobro' => null,
                'referencia_cobro' => null,
                'observaciones' => 'Cobro revertido - pendiente nuevamente',
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Cobro de comisión revertido exitosamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al revertir cobro: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener estadísticas de pagos
     */
    public function estadisticas(Request $request)
    {
        try {
            $brokerId = $request->get('authenticated_broker_id');

            $estadisticas = [
                'recaudo_oficina' => [
                    'total' => PagoPoliza::where('broker_id', $brokerId)
                        ->recaudadosOficina()
                        ->sum('monto_pagado'),
                    'pendiente' => PagoPoliza::where('broker_id', $brokerId)
                        ->recaudadosOficina()
                        ->whereIn('estado', ['pendiente', 'parcial'])
                        ->sum('monto_pendiente'),
                ],
                'pago_aseguradora' => [
                    'total' => PagoPoliza::where('broker_id', $brokerId)
                        ->recaudadosAseguradora()
                        ->sum('monto_pagado'),
                    'pendiente' => PagoPoliza::where('broker_id', $brokerId)
                        ->recaudadosAseguradora()
                        ->whereIn('estado', ['pendiente', 'parcial'])
                        ->sum('monto_pendiente'),
                ],
                'cobro_comision' => [
                    'total' => CobroComision::where('broker_id', $brokerId)
                        ->cobradas()
                        ->sum('monto_cobrado'),
                    'pendiente' => CobroComision::where('broker_id', $brokerId)
                        ->pendientes()
                        ->sum('monto_pendiente'),
                ],
            ];

            return response()->json([
                'success' => true,
                'data' => $estadisticas
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas: ' . $e->getMessage()
            ], 500);
        }
    }
}