<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PagoPoliza;
use App\Models\CobroComision;
use App\Models\Poliza;
use App\Models\ReciboCaja;
use App\Models\Cliente;
use App\Models\RecaudoImport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

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
            'tipo_recaudo' => 'required|in:oficina,aseguradora,aseguradora_directo',
            'monto' => 'required|numeric|min:0.01',
            'metodo_pago' => 'nullable|string',
            'referencia_pago' => 'nullable|string',
            'fecha_pago' => 'nullable|date',
            'observaciones' => 'nullable|string',
            'cartera_item_id' => 'nullable|integer',
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
            $montoRecibido = (float) $request->monto;
            $currentRenovacion = (int) ($poliza->numero_renovacion ?? 0);
            $pago = null;

            // If cartera_item_id is provided, use its amounts instead of poliza totals
            // This is critical for cuotas (e.g. pago 1/2, 2/2) where each has different amounts
            $carteraItem = null;
            if ($request->filled('cartera_item_id')) {
                $carteraItem = DB::table('cartera_items')->where('id', $request->cartera_item_id)->first();
                if ($carteraItem) {
                    $currentRenovacion = (int) ($carteraItem->numero_renovacion ?? $currentRenovacion);
                }
            }

            // Para recaudo de oficina, crear SIEMPRE un registro individual por cada abono
            if ($request->tipo_recaudo === 'oficina') {
                // Use cartera_item's prima_total_pago if available (cuota-specific), else poliza total
                $montoTotalPoliza = $carteraItem
                    ? (float) $carteraItem->prima_total_pago
                    : ($poliza->total_amount ?? ($poliza->premium_amount + ($poliza->vat_amount ?? 0)));
                
                // Sumar todos los pagos anteriores de oficina para esta póliza (período actual)
                $totalRecaudadoAnterior = (float) PagoPoliza::where('poliza_id', $polizaId)
                    ->where('numero_renovacion', $currentRenovacion)
                    ->where('tipo_recaudo', 'oficina')
                    ->sum('monto_pagado');
                
                // Calcular el nuevo pendiente después de este pago
                $nuevoTotalRecaudado = $totalRecaudadoAnterior + $montoRecibido;
                $montoPendienteRestante = max(0, $montoTotalPoliza - $nuevoTotalRecaudado);
                
                // Determinar estado: 'pagado' si este abono completa el total
                $estado = $montoPendienteRestante <= 0 ? 'pagado' : 'parcial';
                
                // Crear registro individual para este abono
                $pago = PagoPoliza::create([
                    'broker_id' => $poliza->broker_id,
                    'poliza_id' => $polizaId,
                    'cliente_id' => $poliza->client_id,
                    'monto_total' => $montoTotalPoliza,
                    'monto_pagado' => $montoRecibido,
                    'monto_pendiente' => $montoPendienteRestante,
                    'tipo_recaudo' => 'oficina',
                    'metodo_pago' => $request->metodo_pago,
                    'referencia_pago' => $request->referencia_pago,
                    'fecha_pago' => $request->fecha_pago ?? now(),
                    'estado' => $estado,
                    'observaciones' => $request->observaciones,
                ]);
            } elseif ($request->tipo_recaudo === 'aseguradora_directo') {
                // Recaudo directo por aseguradora: el cliente pagó directamente a la aseguradora
                // NO se crea registro de oficina, solo el pago a aseguradora
                $primaNeta = $carteraItem
                    ? (float) $carteraItem->prima_total_pago
                    : ($poliza->premium_amount ?? 0);
                
                // Verificar si ya existe un pago a aseguradora pagado para este período
                $pagoAseguradoraExistente = PagoPoliza::where('poliza_id', $polizaId)
                    ->where('numero_renovacion', $currentRenovacion)
                    ->where('tipo_recaudo', 'aseguradora')
                    ->where('estado', 'pagado')
                    ->first();
                
                if (!$pagoAseguradoraExistente) {
                    // Eliminar cualquier pago pendiente a aseguradora que pudiera existir
                    PagoPoliza::where('poliza_id', $polizaId)
                        ->where('numero_renovacion', $currentRenovacion)
                        ->where('tipo_recaudo', 'aseguradora')
                        ->where('estado', 'pendiente')
                        ->delete();
                    
                    $pago = PagoPoliza::create([
                        'broker_id' => $poliza->broker_id,
                        'poliza_id' => $polizaId,
                        'cliente_id' => $poliza->client_id,
                        'monto_total' => $primaNeta,
                        'monto_pagado' => $montoRecibido ?: $primaNeta,
                        'monto_pendiente' => 0,
                        'tipo_recaudo' => 'aseguradora',
                        'metodo_pago' => $request->metodo_pago ?? 'aseguradora_directo',
                        'referencia_pago' => $request->referencia_pago,
                        'fecha_pago' => $request->fecha_pago ?? now(),
                        'estado' => 'pagado',
                        'observaciones' => $request->observaciones ?? 'Recaudo directo por aseguradora',
                    ]);
                } else {
                    $pago = $pagoAseguradoraExistente;
                }
            } else {
                // Para pago a aseguradora (desde Por Pagar)
                $pago = PagoPoliza::create([
                    'broker_id' => $poliza->broker_id,
                    'poliza_id' => $polizaId,
                    'cliente_id' => $poliza->client_id,
                    'monto_total' => $montoRecibido,
                    'monto_pagado' => $montoRecibido,
                    'monto_pendiente' => 0,
                    'tipo_recaudo' => 'aseguradora',
                    'metodo_pago' => $request->metodo_pago,
                    'referencia_pago' => $request->referencia_pago,
                    'fecha_pago' => $request->fecha_pago ?? now(),
                    'estado' => 'pagado',
                    'observaciones' => $request->observaciones,
                ]);
            }

            // Si es recaudo oficina COMPLETO (estado = pagado), crear automáticamente:
            // 1. Pago pendiente a la aseguradora (prima neta)
            // 2. Cobro de comisión pendiente
            if ($request->tipo_recaudo === 'oficina' && $pago->estado === 'pagado' && $pago->habilitaComision()) {
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

                // 2. Crear cobro de comisión pendiente (if doesn't already exist)
                $this->ensureCobroComisionExists($poliza, $pago->id);
            }

            // Para aseguradora_directo o pago a aseguradora: también crear cobro de comisión
            // (la aseguradora ya cobró, el broker necesita cobrar su comisión)
            if (in_array($request->tipo_recaudo, ['aseguradora_directo', 'aseguradora']) && $pago->exists) {
                $this->ensureCobroComisionExists($poliza, $pago->id);
            }
            
            // Si es pago a aseguradora, actualizar el registro pendiente existente
            if ($request->tipo_recaudo === 'aseguradora') {
                // Buscar si hay un pago pendiente a aseguradora para este período
                $pagoPendiente = PagoPoliza::where('poliza_id', $polizaId)
                    ->where('numero_renovacion', $currentRenovacion)
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

            // Auto-generate ReciboCaja for the payment (if not already created by frontend)
            $recibo = $this->autoGenerateRecibo($pago, $poliza, $request);

            // Sync cartera_items to reflect the new payment state
            $this->syncCarteraItems((int) $polizaId, null, $request->filled('cartera_item_id') ? (int) $request->cartera_item_id : null);

            DB::commit();

            $responseData = $pago->load(['poliza', 'cliente'])->toArray();
            if ($recibo) {
                $responseData['recibo_id'] = $recibo->id;
                $responseData['numero_recibo'] = $recibo->numero_recibo;
                $responseData['recibo'] = [
                    'id' => $recibo->id,
                    'numero_recibo' => $recibo->numero_recibo,
                    'fecha' => $recibo->fecha_realizo_pago_oficina,
                    'cliente_nombre' => $recibo->cliente_nombre,
                    'cliente_documento' => $recibo->cliente_documento,
                    'poliza_numero' => $recibo->poliza_numero,
                    'aseguradora_nombre' => $recibo->aseguradora_nombre,
                    'ramo_nombre' => $recibo->ramo_nombre,
                    'forma_pago' => $recibo->forma_pago,
                    'valor_recaudado_en_oficina' => (float) $recibo->valor_recaudado_en_oficina,
                    'valor_a_pagar' => (float) $recibo->valor_a_pagar,
                    'es_anticipo' => (bool) $recibo->es_anticipo,
                    'tipo_recaudo' => $recibo->tipo_recaudo,
                    'observaciones' => $recibo->observaciones,
                ];
            }

            return response()->json([
                'success' => true,
                'message' => 'Recaudo registrado exitosamente',
                'data' => $responseData,
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
                
                // Si la póliza no tiene comisión definida, usar el monto que se está cobrando
                // Esto permite registrar cobros incluso si la póliza no tiene el valor configurado
                if ($montoComision <= 0) {
                    $montoComision = $request->monto;
                }

                if ($montoComision <= 0) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => 'La póliza no tiene comisión definida y el monto a cobrar es inválido'
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

            // Sync cartera_items (comision changes tab from comision_por_cobrar → comision_recibida)
            $this->syncCarteraItems((int) $polizaId);

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
                // 1. Anular recibos asociados a este pago y pagos aseguradora
                $pagoIdsToAnull = [$pago->id];
                $pagosAseg = PagoPoliza::where('poliza_id', $polizaId)
                    ->where('tipo_recaudo', 'aseguradora')
                    ->pluck('id')->toArray();
                $pagoIdsToAnull = array_merge($pagoIdsToAnull, $pagosAseg);
                $this->anularRecibosDeReversion($pagoIdsToAnull);

                // 2. Eliminar el cobro de comisión asociado
                CobroComision::where('pago_poliza_id', $pago->id)->delete();
                // 3. Eliminar el pago pendiente a aseguradora
                PagoPoliza::where('poliza_id', $polizaId)
                    ->where('tipo_recaudo', 'aseguradora')
                    ->delete();
                // 4. Eliminar el recaudo de oficina
                $pago->delete();
                
            } elseif ($pago->tipo_recaudo === 'aseguradora') {
                // Anular recibo asociado a este pago
                $this->anularRecibosDeReversion([$pago->id]);

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

            // Sync cartera_items to reflect the reverted state
            $this->syncCarteraItems((int) $polizaId);

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
     * Marcar múltiples pólizas como recaudo completado (masivo)
     */
    public function recaudoMasivo(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'poliza_ids' => 'required_without:fecha_inicio|array',
            'poliza_ids.*' => 'integer|exists:polizas,id',
            'fecha_inicio' => 'required_without:poliza_ids|date',
            'fecha_fin' => 'required_with:fecha_inicio|date|after_or_equal:fecha_inicio',
            'tipo_recaudo' => 'required|in:oficina,aseguradora_directo',
            'metodo_pago' => 'nullable|string',
            'referencia_pago' => 'nullable|string',
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

            $brokerId = auth()->user()->broker_id;
            $procesadas = 0;
            $errores = [];

            // Obtener pólizas a procesar
            if ($request->has('poliza_ids') && !empty($request->poliza_ids)) {
                $polizas = Poliza::whereIn('id', $request->poliza_ids)
                    ->where('broker_id', $brokerId)
                    ->get();
            } else {
                // Filtrar por rango de fechas
                $polizas = Poliza::where('broker_id', $brokerId)
                    ->whereBetween('end_date', [$request->fecha_inicio, $request->fecha_fin])
                    ->whereDoesntHave('pagos', function($q) {
                        $q->where('tipo_recaudo', 'aseguradora')
                          ->where('estado', 'pagado');
                    })
                    ->get();
            }

            foreach ($polizas as $poliza) {
                try {
                    $montoTotalPoliza = $poliza->total_amount ?? ($poliza->premium_amount + ($poliza->vat_amount ?? 0));
                    $primaNeta = $poliza->premium_amount ?? 0;

                    if ($request->tipo_recaudo === 'aseguradora_directo') {
                        // Verificar si ya tiene pagos completados
                        $yaCompletado = PagoPoliza::where('poliza_id', $poliza->id)
                            ->where('tipo_recaudo', 'aseguradora')
                            ->where('estado', 'pagado')
                            ->exists();

                        if ($yaCompletado) {
                            continue; // Saltar pólizas ya completadas
                        }

                        // Crear registro de oficina como pagado
                        PagoPoliza::create([
                            'broker_id' => $poliza->broker_id,
                            'poliza_id' => $poliza->id,
                            'cliente_id' => $poliza->client_id,
                            'monto_total' => $montoTotalPoliza,
                            'monto_pagado' => $montoTotalPoliza,
                            'monto_pendiente' => 0,
                            'tipo_recaudo' => 'oficina',
                            'metodo_pago' => $request->metodo_pago,
                            'referencia_pago' => $request->referencia_pago,
                            'fecha_pago' => now(),
                            'estado' => 'pagado',
                            'observaciones' => 'Recaudo masivo - oficina automático',
                        ]);

                        // Crear pago a aseguradora como pagado
                        PagoPoliza::create([
                            'broker_id' => $poliza->broker_id,
                            'poliza_id' => $poliza->id,
                            'cliente_id' => $poliza->client_id,
                            'monto_total' => $primaNeta,
                            'monto_pagado' => $primaNeta,
                            'monto_pendiente' => 0,
                            'tipo_recaudo' => 'aseguradora',
                            'metodo_pago' => $request->metodo_pago,
                            'referencia_pago' => $request->referencia_pago,
                            'fecha_pago' => now(),
                            'estado' => 'pagado',
                            'observaciones' => $request->observaciones ?? 'Recaudo masivo directo por aseguradora',
                        ]);
                    } else {
                        // Recaudo por oficina - crear solo el pago de oficina completo
                        $yaRecaudadoOficina = PagoPoliza::where('poliza_id', $poliza->id)
                            ->where('tipo_recaudo', 'oficina')
                            ->where('estado', 'pagado')
                            ->exists();

                        if ($yaRecaudadoOficina) {
                            continue;
                        }

                        $pago = PagoPoliza::create([
                            'broker_id' => $poliza->broker_id,
                            'poliza_id' => $poliza->id,
                            'cliente_id' => $poliza->client_id,
                            'monto_total' => $montoTotalPoliza,
                            'monto_pagado' => $montoTotalPoliza,
                            'monto_pendiente' => 0,
                            'tipo_recaudo' => 'oficina',
                            'metodo_pago' => $request->metodo_pago,
                            'referencia_pago' => $request->referencia_pago,
                            'fecha_pago' => now(),
                            'estado' => 'pagado',
                            'observaciones' => $request->observaciones ?? 'Recaudo masivo por oficina',
                        ]);

                        // Crear pago pendiente a aseguradora
                        if ($primaNeta > 0) {
                            PagoPoliza::create([
                                'broker_id' => $poliza->broker_id,
                                'poliza_id' => $poliza->id,
                                'cliente_id' => $poliza->client_id,
                                'monto_total' => $primaNeta,
                                'monto_pagado' => 0,
                                'monto_pendiente' => $primaNeta,
                                'tipo_recaudo' => 'aseguradora',
                                'metodo_pago' => null,
                                'referencia_pago' => null,
                                'fecha_pago' => now(),
                                'estado' => 'pendiente',
                                'observaciones' => 'Pago pendiente a aseguradora - recaudo masivo',
                            ]);
                        }
                    }

                    // Sync cartera_items for this poliza
                    $this->syncCarteraItems((int) $poliza->id);

                    $procesadas++;
                } catch (\Exception $e) {
                    $errores[] = "Póliza {$poliza->policy_number}: {$e->getMessage()}";
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Se procesaron {$procesadas} pólizas exitosamente",
                'data' => [
                    'procesadas' => $procesadas,
                    'total' => $polizas->count(),
                    'errores' => $errores
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al procesar recaudo masivo: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Revertir todos los recaudos de oficina de una póliza
     */
    public function revertirRecaudosOficina(Request $request, $polizaId)
    {
        try {
            DB::beginTransaction();

            // Eliminar todos los pagos de oficina de esta póliza
            $pagosOficina = PagoPoliza::where('poliza_id', $polizaId)
                ->where('tipo_recaudo', 'oficina')
                ->get();

            if ($pagosOficina->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay recaudos de oficina para revertir'
                ], 404);
            }

            // Anular recibos asociados a todos los pagos de oficina
            $pagoIds = $pagosOficina->pluck('id')->toArray();
            $this->anularRecibosDeReversion($pagoIds);

            // Eliminar cobros de comisión asociados
            foreach ($pagosOficina as $pago) {
                CobroComision::where('pago_poliza_id', $pago->id)->delete();
            }

            // Eliminar pagos pendientes a aseguradora
            PagoPoliza::where('poliza_id', $polizaId)
                ->where('tipo_recaudo', 'aseguradora')
                ->whereIn('estado', ['pendiente', 'parcial'])
                ->delete();

            // Eliminar todos los pagos de oficina
            PagoPoliza::where('poliza_id', $polizaId)
                ->where('tipo_recaudo', 'oficina')
                ->delete();

            // Sync cartera_items to reflect reverted state
            $this->syncCarteraItems((int) $polizaId);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Recaudos de oficina revertidos exitosamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al revertir recaudos: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Procesar recaudo masivo desde archivo CSV
     */
    public function recaudoMasivoCsv(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'archivo' => 'required|file|mimes:csv,txt|max:5120',
            'tipo_recaudo' => 'required|in:oficina,aseguradora_directo',
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

            $brokerId = auth()->user()->broker_id;
            $archivo = $request->file('archivo');
            $tipoRecaudo = $request->tipo_recaudo;
            
            $procesadas = 0;
            $errores = [];
            $linea = 0;

            // Leer el archivo CSV
            $handle = fopen($archivo->getRealPath(), 'r');
            
            // Leer encabezados
            $headers = fgetcsv($handle, 0, ',');
            if (!$headers) {
                return response()->json([
                    'success' => false,
                    'message' => 'El archivo CSV está vacío o tiene formato incorrecto'
                ], 422);
            }

            // Normalizar encabezados (minúsculas, sin espacios)
            $headers = array_map(function($h) {
                return strtolower(trim(str_replace([' ', '_'], '', $h)));
            }, $headers);

            // Mapear columnas esperadas
            $columnMap = [
                'numeropoliza' => ['numeropoliza', 'poliza', 'nopoliza', 'policyno', 'policynumber'],
                'monto' => ['monto', 'valor', 'amount', 'total', 'valorpagado'],
                'metodopago' => ['metodopago', 'metodo', 'paymentmethod', 'formapago'],
                'fechapago' => ['fechapago', 'fecha', 'date', 'paymentdate'],
                'referencia' => ['referencia', 'ref', 'reference', 'comprobante'],
                'observaciones' => ['observaciones', 'obs', 'notas', 'notes', 'comentarios'],
            ];

            // Encontrar índices de columnas
            $indices = [];
            foreach ($columnMap as $key => $aliases) {
                foreach ($aliases as $alias) {
                    $idx = array_search($alias, $headers);
                    if ($idx !== false) {
                        $indices[$key] = $idx;
                        break;
                    }
                }
            }

            // Verificar columna obligatoria
            if (!isset($indices['numeropoliza'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'El archivo CSV debe tener una columna "numero_poliza" o "poliza"'
                ], 422);
            }

            // Procesar filas
            while (($row = fgetcsv($handle, 0, ',')) !== false) {
                $linea++;
                
                // Saltar filas vacías
                if (empty(array_filter($row))) {
                    continue;
                }

                $numeroPoliza = trim($row[$indices['numeropoliza']] ?? '');
                
                if (empty($numeroPoliza)) {
                    $errores[] = "Línea {$linea}: Número de póliza vacío";
                    continue;
                }

                // Buscar la póliza
                $poliza = Poliza::where('broker_id', $brokerId)
                    ->where('policy_number', $numeroPoliza)
                    ->first();

                if (!$poliza) {
                    $errores[] = "Línea {$linea}: Póliza '{$numeroPoliza}' no encontrada";
                    continue;
                }

                // Obtener valores del CSV o usar defaults
                $monto = isset($indices['monto']) && isset($row[$indices['monto']]) 
                    ? (float) str_replace([',', '$', ' '], '', $row[$indices['monto']]) 
                    : null;
                $metodoPago = isset($indices['metodopago']) && isset($row[$indices['metodopago']]) 
                    ? trim($row[$indices['metodopago']]) 
                    : null;
                $fechaPago = isset($indices['fechapago']) && isset($row[$indices['fechapago']]) 
                    ? trim($row[$indices['fechapago']]) 
                    : now()->format('Y-m-d');
                $referencia = isset($indices['referencia']) && isset($row[$indices['referencia']]) 
                    ? trim($row[$indices['referencia']]) 
                    : null;
                $observaciones = isset($indices['observaciones']) && isset($row[$indices['observaciones']]) 
                    ? trim($row[$indices['observaciones']]) 
                    : 'Recaudo masivo desde CSV';

                try {
                    $montoTotalPoliza = $poliza->total_amount ?? ($poliza->premium_amount + ($poliza->vat_amount ?? 0));
                    $primaNeta = $poliza->premium_amount ?? 0;
                    
                    // Si no se especificó monto, usar el total de la póliza
                    if (!$monto || $monto <= 0) {
                        $monto = $montoTotalPoliza;
                    }

                    // Verificar si ya tiene pagos completados
                    $yaCompletado = PagoPoliza::where('poliza_id', $poliza->id)
                        ->where('tipo_recaudo', 'aseguradora')
                        ->where('estado', 'pagado')
                        ->exists();

                    if ($yaCompletado) {
                        $errores[] = "Línea {$linea}: Póliza '{$numeroPoliza}' ya tiene recaudo completado";
                        continue;
                    }

                    if ($tipoRecaudo === 'aseguradora_directo') {
                        // Crear registro de oficina como pagado
                        PagoPoliza::create([
                            'broker_id' => $poliza->broker_id,
                            'poliza_id' => $poliza->id,
                            'cliente_id' => $poliza->client_id,
                            'monto_total' => $montoTotalPoliza,
                            'monto_pagado' => $montoTotalPoliza,
                            'monto_pendiente' => 0,
                            'tipo_recaudo' => 'oficina',
                            'metodo_pago' => $metodoPago,
                            'referencia_pago' => $referencia,
                            'fecha_pago' => $fechaPago,
                            'estado' => 'pagado',
                            'observaciones' => 'CSV: ' . $observaciones,
                        ]);

                        // Crear pago a aseguradora como pagado
                        PagoPoliza::create([
                            'broker_id' => $poliza->broker_id,
                            'poliza_id' => $poliza->id,
                            'cliente_id' => $poliza->client_id,
                            'monto_total' => $primaNeta,
                            'monto_pagado' => $primaNeta,
                            'monto_pendiente' => 0,
                            'tipo_recaudo' => 'aseguradora',
                            'metodo_pago' => $metodoPago,
                            'referencia_pago' => $referencia,
                            'fecha_pago' => $fechaPago,
                            'estado' => 'pagado',
                            'observaciones' => 'CSV: ' . $observaciones,
                        ]);
                    } else {
                        // Recaudo por oficina
                        $pago = PagoPoliza::create([
                            'broker_id' => $poliza->broker_id,
                            'poliza_id' => $poliza->id,
                            'cliente_id' => $poliza->client_id,
                            'monto_total' => $montoTotalPoliza,
                            'monto_pagado' => $monto,
                            'monto_pendiente' => max(0, $montoTotalPoliza - $monto),
                            'tipo_recaudo' => 'oficina',
                            'metodo_pago' => $metodoPago,
                            'referencia_pago' => $referencia,
                            'fecha_pago' => $fechaPago,
                            'estado' => $monto >= $montoTotalPoliza ? 'pagado' : 'parcial',
                            'observaciones' => 'CSV: ' . $observaciones,
                        ]);

                        // Si el pago completa el total, crear pago pendiente a aseguradora
                        if ($pago->estado === 'pagado' && $primaNeta > 0) {
                            PagoPoliza::create([
                                'broker_id' => $poliza->broker_id,
                                'poliza_id' => $poliza->id,
                                'cliente_id' => $poliza->client_id,
                                'monto_total' => $primaNeta,
                                'monto_pagado' => 0,
                                'monto_pendiente' => $primaNeta,
                                'tipo_recaudo' => 'aseguradora',
                                'metodo_pago' => null,
                                'referencia_pago' => null,
                                'fecha_pago' => now(),
                                'estado' => 'pendiente',
                                'observaciones' => 'Pendiente a aseguradora - CSV',
                            ]);
                        }
                    }

                    // Sync cartera_items for this poliza
                    $this->syncCarteraItems((int) $poliza->id);

                    $procesadas++;
                } catch (\Exception $e) {
                    $errores[] = "Línea {$linea}: Error procesando póliza '{$numeroPoliza}': " . $e->getMessage();
                }
            }

            fclose($handle);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Se procesaron {$procesadas} pólizas desde el CSV",
                'data' => [
                    'procesadas' => $procesadas,
                    'total_lineas' => $linea,
                    'errores' => $errores
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al procesar CSV: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Revertir recaudo completo (oficina + aseguradora) - regresa a Por Cobrar
     */
    public function revertirRecaudoCompleto(Request $request, $polizaId)
    {
        try {
            DB::beginTransaction();

            // Anular all guro-generated recibos for this poliza
            $allPagoIds = PagoPoliza::where('poliza_id', $polizaId)->pluck('id')->toArray();
            if (!empty($allPagoIds)) {
                $this->anularRecibosDeReversion($allPagoIds);
            }

            // Eliminar cobros de comisión
            CobroComision::where('poliza_id', $polizaId)->delete();

            // Eliminar TODOS los pagos (oficina y aseguradora)
            PagoPoliza::where('poliza_id', $polizaId)->delete();

            // Sync cartera_items to reflect fully reverted state
            $this->syncCarteraItems((int) $polizaId);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Recaudo completo revertido exitosamente. La póliza está nuevamente en Por Cobrar.'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al revertir recaudo completo: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Revertir solo el pago de aseguradora de una póliza (sin tocar oficina).
     * Moves from comision_por_cobrar → por_pagar (if oficina exists) or por_cobrar.
     * Also deletes any associated cobros_comisiones.
     */
    public function revertirPagoAseguradoraDePoliza(Request $request, $polizaId)
    {
        try {
            DB::beginTransaction();

            // Find pagos aseguradora (pagado) for this poliza
            $pagosAseg = PagoPoliza::where('poliza_id', $polizaId)
                ->where('tipo_recaudo', 'aseguradora')
                ->get();

            if ($pagosAseg->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontraron pagos de aseguradora para revertir'
                ], 404);
            }

            // Anular recibos asociados a pagos de aseguradora
            $pagoIds = $pagosAseg->pluck('id')->toArray();
            $this->anularRecibosDeReversion($pagoIds);

            // Delete cobros de comisión associated with this poliza
            CobroComision::where('poliza_id', $polizaId)->delete();

            // Check if there are oficina pagos
            $tieneOficina = PagoPoliza::where('poliza_id', $polizaId)
                ->where('tipo_recaudo', 'oficina')
                ->exists();

            if ($tieneOficina) {
                // Reset aseguradora pagos to pendiente (poliza goes back to por_pagar)
                foreach ($pagosAseg as $pago) {
                    if ($pago->estado === 'pagado') {
                        $pago->update([
                            'monto_pagado' => 0,
                            'monto_pendiente' => $pago->monto_total,
                            'estado' => 'pendiente',
                            'metodo_pago' => null,
                            'referencia_pago' => null,
                            'observaciones' => 'Pago aseguradora revertido - pendiente nuevamente',
                        ]);
                    }
                }
            } else {
                // No oficina — delete aseguradora pagos entirely (goes back to por_cobrar)
                PagoPoliza::where('poliza_id', $polizaId)
                    ->where('tipo_recaudo', 'aseguradora')
                    ->delete();
            }

            $this->syncCarteraItems((int) $polizaId);

            DB::commit();

            $destino = $tieneOficina ? 'Por Pagar' : 'Por Cobrar';
            return response()->json([
                'success' => true,
                'message' => "Pago de aseguradora revertido. La póliza regresó a \"{$destino}\"."
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al revertir pago aseguradora: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Revertir el último cobro de comisión de una póliza (sin necesidad de cobroId)
     */
    public function revertirUltimoCobroComision(Request $request, $polizaId)
    {
        try {
            DB::beginTransaction();

            // Find the latest cobrado cobro for this poliza
            $cobro = CobroComision::where('poliza_id', $polizaId)
                ->where(function ($q) {
                    $q->where('estado', 'cobrado')
                      ->orWhere('monto_cobrado', '>', 0);
                })
                ->orderByDesc('id')
                ->first();

            if (!$cobro) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontró un cobro de comisión registrado para revertir en esta póliza'
                ], 404);
            }

            $cobro->update([
                'monto_cobrado' => 0,
                'monto_pendiente' => $cobro->monto_comision,
                'estado' => 'pendiente',
                'fecha_cobro' => null,
                'referencia_cobro' => null,
                'observaciones' => 'Cobro revertido - pendiente nuevamente',
            ]);

            $this->syncCarteraItems((int) $polizaId);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Cobro de comisión revertido exitosamente',
                'data' => ['cobro_id' => $cobro->id],
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

            // Sync cartera_items (reverts from comision_recibida → comision_por_cobrar)
            $this->syncCarteraItems((int) $polizaId);

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
     * Registrar recaudo por número de póliza (para importación masiva)
     * Soporta búsqueda por últimos 5 dígitos y pagos parciales (positivos/negativos)
     */
    public function recaudoPorNumeroPoliza(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'numero_poliza' => 'required|string',
            'tipo_recaudo' => 'required|in:oficina,aseguradora_directo',
            'monto_pagado' => 'nullable|numeric', // Puede ser negativo para ajustes
            'fecha_pago' => 'nullable|string',
            'metodo_pago' => 'nullable|string',
            'referencia_pago' => 'nullable|string',
            'recaudo_import_id' => 'nullable|integer', // Para rastrear importación masiva
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos: ' . implode(', ', $validator->errors()->all())
            ], 422);
        }

        try {
            $brokerId = $request->get('authenticated_broker_id');
            $numeroPoliza = trim($request->numero_poliza);

            // Buscar la póliza por número exacto primero (cualquier estado)
            $poliza = Poliza::where('broker_id', $brokerId)
                ->where('policy_number', $numeroPoliza)
                ->first();

            $matchType = 'exacto';

            // Si no se encuentra, buscar por últimos 5 dígitos (cualquier estado)
            if (!$poliza && strlen($numeroPoliza) >= 5) {
                $ultimos5 = substr($numeroPoliza, -5);
                $polizasPosibles = Poliza::where('broker_id', $brokerId)
                    ->where('policy_number', 'LIKE', '%' . $ultimos5)
                    ->get();

                if ($polizasPosibles->count() === 1) {
                    $poliza = $polizasPosibles->first();
                    $matchType = 'ultimos_5_digitos';
                    Log::info("Póliza encontrada por últimos 5 dígitos: {$numeroPoliza} -> {$poliza->policy_number}");
                } elseif ($polizasPosibles->count() > 1) {
                    $numeros = $polizasPosibles->pluck('policy_number')->join(', ');
                    return response()->json([
                        'success' => false,
                        'message' => "Múltiples pólizas coinciden con los últimos 5 dígitos '{$ultimos5}': {$numeros}. Use el número completo.",
                        'match_type' => 'multiple'
                    ], 422);
                }
            }

            if (!$poliza) {
                return response()->json([
                    'success' => false,
                    'message' => "Póliza no encontrada: {$numeroPoliza}"
                ], 404);
            }

            DB::beginTransaction();

            $montoTotalPoliza = $poliza->total_amount ?? ($poliza->premium_amount + ($poliza->vat_amount ?? 0));
            $montoRecibido = $request->monto_pagado !== null ? (float)$request->monto_pagado : $montoTotalPoliza;
            
            // Parsear fecha si viene
            $fechaPago = null;
            if ($request->fecha_pago) {
                try {
                    $fechaPago = \Carbon\Carbon::parse($request->fecha_pago);
                } catch (\Exception $e) {
                    $fechaPago = now();
                }
            } else {
                $fechaPago = now();
            }

            // Para pagos positivos, validar duplicados
            if ($montoRecibido > 0) {
                $tipoRecaudoCheck = $request->tipo_recaudo === 'aseguradora_directo' ? 'aseguradora' : $request->tipo_recaudo;
                $duplicado = PagoPoliza::where('poliza_id', $poliza->id)
                    ->where('tipo_recaudo', $tipoRecaudoCheck)
                    ->where('monto_pagado', $montoRecibido)
                    ->where('estado', 'pagado')
                    ->whereDate('fecha_pago', $fechaPago->toDateString())
                    ->first();

                if ($duplicado) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'message' => "Recaudo duplicado: ya existe un pago de \${$montoRecibido} para la póliza {$poliza->policy_number} en la fecha {$fechaPago->toDateString()}"
                    ], 422);
                }
            }

            $pagoCreado = null;

            if ($request->tipo_recaudo === 'oficina') {
                // Recaudo por oficina - soporta pagos parciales y negativos (ajustes)
                $totalRecaudadoAnterior = (float) PagoPoliza::where('poliza_id', $poliza->id)
                    ->where('tipo_recaudo', 'oficina')
                    ->sum('monto_pagado');
                
                $nuevoTotalRecaudado = $totalRecaudadoAnterior + $montoRecibido;
                $montoPendienteRestante = max(0, $montoTotalPoliza - $nuevoTotalRecaudado);
                
                // Determinar estado basado en el monto (ENUM: pendiente, parcial, pagado)
                if ($montoPendienteRestante <= 0) {
                    $estado = 'pagado';
                } else {
                    $estado = 'parcial'; // Incluye pagos parciales y ajustes negativos
                }

                $pagoCreado = PagoPoliza::create([
                    'broker_id' => $poliza->broker_id,
                    'poliza_id' => $poliza->id,
                    'cliente_id' => $poliza->client_id,
                    'monto_total' => $montoTotalPoliza,
                    'monto_pagado' => $montoRecibido,
                    'monto_pendiente' => $montoPendienteRestante,
                    'tipo_recaudo' => 'oficina',
                    'metodo_pago' => $request->metodo_pago,
                    'referencia_pago' => $request->referencia_pago,
                    'fecha_pago' => $fechaPago,
                    'estado' => $estado,
                    'observaciones' => $matchType === 'ultimos_5_digitos' 
                        ? "Importado CSV (match por últimos 5 dígitos: {$numeroPoliza})" 
                        : 'Importado desde CSV',
                    'recaudo_import_id' => $request->recaudo_import_id,
                ]);
            } else {
                // Recaudo directo por aseguradora
                $primaNeta = $poliza->premium_amount;
                
                // Para recaudo directo aseguradora, siempre crear el pago
                // La validación de duplicados se hace a nivel de importación (mismo import_id)
                $pagoExactoDuplicado = null;
                if ($request->recaudo_import_id) {
                    // Solo verificar duplicados dentro de la misma importación
                    $pagoExactoDuplicado = PagoPoliza::where('poliza_id', $poliza->id)
                        ->where('tipo_recaudo', 'aseguradora')
                        ->where('monto_pagado', $montoRecibido ?: $primaNeta)
                        ->where('recaudo_import_id', $request->recaudo_import_id)
                        ->first();
                }

                if (!$pagoExactoDuplicado) {
                    // Eliminar pagos pendientes (placeholder) si existen
                    PagoPoliza::where('poliza_id', $poliza->id)
                        ->where('tipo_recaudo', 'aseguradora')
                        ->where('estado', 'pendiente')
                        ->delete();
                    
                    $montoEfectivo = $montoRecibido ?: $primaNeta;
                    // Recaudo directo aseguradora: siempre estado 'pagado' porque el cliente ya pagó
                    $montoPendiente = 0;
                    $estado = 'pagado';
                    
                    $pagoCreado = PagoPoliza::create([
                        'broker_id' => $poliza->broker_id,
                        'poliza_id' => $poliza->id,
                        'cliente_id' => $poliza->client_id,
                        'monto_total' => $primaNeta,
                        'monto_pagado' => $montoEfectivo,
                        'monto_pendiente' => $montoPendiente,
                        'tipo_recaudo' => 'aseguradora',
                        'metodo_pago' => $request->metodo_pago ?? 'aseguradora_directo',
                        'referencia_pago' => $request->referencia_pago,
                        'fecha_pago' => $fechaPago,
                        'estado' => $estado,
                        'observaciones' => $matchType === 'ultimos_5_digitos' 
                            ? "Recaudo directo aseguradora - CSV (match: {$numeroPoliza})" 
                            : 'Recaudo directo aseguradora - Importado CSV',
                        'recaudo_import_id' => $request->recaudo_import_id,
                    ]);
                }
            }

            // Sync cartera_items to reflect the new payment state
            $this->syncCarteraItems((int) $poliza->id);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Recaudo registrado para póliza {$poliza->policy_number}",
                'match_type' => $matchType,
                'poliza_encontrada' => $poliza->policy_number,
                'pago_id' => $pagoCreado ? $pagoCreado->id : null,
                'monto_pendiente' => $pagoCreado ? $pagoCreado->monto_pendiente : null,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Error en recaudoPorNumeroPoliza: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar recaudo: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Importación masiva de recaudos con registro para reversión
     */
    public function importarRecaudosMasivo(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tipo_recaudo' => 'required|in:oficina,aseguradora_directo',
            'recaudos' => 'required|array|min:1',
            'recaudos.*.numero_poliza' => 'required|string',
            'recaudos.*.monto_pagado' => 'nullable|numeric',
            'recaudos.*.fecha_pago' => 'nullable|string',
            'recaudos.*.metodo_pago' => 'nullable|string',
            'recaudos.*.referencia_pago' => 'nullable|string',
            'filename' => 'nullable|string',
            'mapping' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $brokerId = $request->get('authenticated_broker_id');
            $userId = $request->get('authenticated_user_id');
            
            $import = RecaudoImport::create([
                'broker_id' => $brokerId,
                'user_id' => $userId,
                'filename' => $request->filename,
                'tipo_recaudo' => $request->tipo_recaudo,
                'status' => 'running',
                'total_rows' => count($request->recaudos),
                'mapping' => $request->mapping,
                'started_at' => now(),
            ]);

            $exitosos = 0;
            $fallidos = 0;
            $montoTotal = 0;
            $pagoIds = [];
            $errores = [];

            foreach ($request->recaudos as $index => $recaudo) {
                try {
                    $internalRequest = new Request(array_merge($recaudo, [
                        'tipo_recaudo' => $request->tipo_recaudo,
                        'recaudo_import_id' => $import->id,
                    ]));
                    $internalRequest->merge(['authenticated_broker_id' => $brokerId]);

                    $response = $this->recaudoPorNumeroPoliza($internalRequest);
                    $responseData = json_decode($response->getContent(), true);

                    if ($responseData['success']) {
                        $exitosos++;
                        $montoTotal += abs((float)($recaudo['monto_pagado'] ?? 0));
                        if (isset($responseData['pago_id'])) {
                            $pagoIds[] = $responseData['pago_id'];
                        }
                    } else {
                        $fallidos++;
                        $errores[] = [
                            'fila' => $index + 2,
                            'poliza' => $recaudo['numero_poliza'] ?? '',
                            'motivo' => $responseData['message'] ?? 'Error desconocido',
                        ];
                    }
                } catch (\Exception $e) {
                    $fallidos++;
                    $errores[] = [
                        'fila' => $index + 2,
                        'poliza' => $recaudo['numero_poliza'] ?? '',
                        'motivo' => $e->getMessage(),
                    ];
                }
            }

            $import->update([
                'status' => 'completed',
                'exitosos' => $exitosos,
                'fallidos' => $fallidos,
                'monto_total_importado' => $montoTotal,
                'pago_ids' => $pagoIds,
                'errores' => array_slice($errores, 0, 100),
                'finished_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'message' => "Importación completada: {$exitosos} exitosos, {$fallidos} fallidos",
                'data' => [
                    'import_id' => $import->id,
                    'exitosos' => $exitosos,
                    'fallidos' => $fallidos,
                    'monto_total' => $montoTotal,
                    'errores' => $errores,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error("Error en importarRecaudosMasivo: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error en importación masiva: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Listar importaciones de recaudos del broker
     */
    public function listarImportaciones(Request $request)
    {
        try {
            $brokerId = $request->get('authenticated_broker_id');
            $limit = (int) $request->query('limit', 20);

            $imports = RecaudoImport::where('broker_id', $brokerId)
                ->orderBy('created_at', 'desc')
                ->limit($limit)
                ->get()
                ->map(function ($import) {
                    return [
                        'id' => $import->id,
                        'filename' => $import->filename,
                        'tipo_recaudo' => $import->tipo_recaudo,
                        'status' => $import->status,
                        'total_rows' => $import->total_rows,
                        'exitosos' => $import->exitosos,
                        'fallidos' => $import->fallidos,
                        'monto_total_importado' => $import->monto_total_importado,
                        'errores' => $import->errores ?? [],
                        'pagos_count' => $import->getPagosCount(),
                        'can_revert' => $import->canRevert(),
                        'created_at' => $import->created_at->format('Y-m-d H:i:s'),
                        'reverted_at' => $import->reverted_at ? $import->reverted_at->format('Y-m-d H:i:s') : null,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $imports
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al listar importaciones: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Revertir una importación masiva de recaudos
     */
    public function revertirImportacion(Request $request, $importId)
    {
        try {
            $brokerId = $request->get('authenticated_broker_id');
            $userId = $request->get('authenticated_user_id');

            $import = RecaudoImport::where('broker_id', $brokerId)
                ->where('id', $importId)
                ->first();

            if (!$import) {
                return response()->json([
                    'success' => false,
                    'message' => 'Importación no encontrada'
                ], 404);
            }

            if (!$import->canRevert()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta importación no puede ser revertida'
                ], 422);
            }

            DB::beginTransaction();

            // Collect affected poliza_ids BEFORE deleting
            $affectedPolizaIds = PagoPoliza::where('recaudo_import_id', $import->id)
                ->pluck('poliza_id')
                ->unique()
                ->toArray();

            if (!empty($import->pago_ids)) {
                $moreIds = PagoPoliza::whereIn('id', $import->pago_ids)
                    ->where('broker_id', $brokerId)
                    ->pluck('poliza_id')
                    ->unique()
                    ->toArray();
                $affectedPolizaIds = array_unique(array_merge($affectedPolizaIds, $moreIds));
            }

            $pagosEliminados = PagoPoliza::where('recaudo_import_id', $import->id)->delete();

            if (!empty($import->pago_ids)) {
                PagoPoliza::whereIn('id', $import->pago_ids)
                    ->where('broker_id', $brokerId)
                    ->delete();
            }

            // Sync cartera_items for all affected polizas
            foreach ($affectedPolizaIds as $pid) {
                $this->syncCarteraItems((int) $pid);
            }

            $import->update([
                'status' => 'reverted',
                'reverted_at' => now(),
                'reverted_by' => $userId,
                'notas' => "Revertida el " . now()->format('Y-m-d H:i:s') . ". Pagos eliminados: {$pagosEliminados}",
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Importación revertida. Se eliminaron {$pagosEliminados} pagos.",
                'pagos_eliminados' => $pagosEliminados
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Error al revertir importación: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al revertir importación: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener detalle de una importación
     */
    public function detalleImportacion(Request $request, $importId)
    {
        try {
            $brokerId = $request->get('authenticated_broker_id');

            $import = RecaudoImport::where('broker_id', $brokerId)
                ->where('id', $importId)
                ->first();

            if (!$import) {
                return response()->json([
                    'success' => false,
                    'message' => 'Importación no encontrada'
                ], 404);
            }

            $pagos = PagoPoliza::where('recaudo_import_id', $import->id)
                ->with(['poliza:id,policy_number,client_name'])
                ->get()
                ->map(function ($pago) {
                    return [
                        'id' => $pago->id,
                        'poliza_numero' => $pago->poliza->policy_number ?? 'N/A',
                        'cliente' => $pago->poliza->client_name ?? 'N/A',
                        'monto_pagado' => $pago->monto_pagado,
                        'monto_pendiente' => $pago->monto_pendiente,
                        'fecha_pago' => $pago->fecha_pago->format('Y-m-d'),
                        'estado' => $pago->estado,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => [
                    'import' => [
                        'id' => $import->id,
                        'filename' => $import->filename,
                        'tipo_recaudo' => $import->tipo_recaudo,
                        'status' => $import->status,
                        'total_rows' => $import->total_rows,
                        'exitosos' => $import->exitosos,
                        'fallidos' => $import->fallidos,
                        'monto_total_importado' => $import->monto_total_importado,
                        'errores' => $import->errores,
                        'can_revert' => $import->canRevert(),
                        'created_at' => $import->created_at->format('Y-m-d H:i:s'),
                        'reverted_at' => $import->reverted_at ? $import->reverted_at->format('Y-m-d H:i:s') : null,
                    ],
                    'pagos' => $pagos,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener detalle: ' . $e->getMessage()
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

    /**
     * Listar pagos de aseguradora individuales (para tab Recaudos Completados)
     */
    public function listarPagosAseguradora(Request $request)
    {
        try {
            $brokerId = $request->get('authenticated_broker_id');
            $perPage = min($request->input('per_page', 25), 100);
            $page = $request->input('page', 1);
            $search = $request->input('search', '');

            $query = PagoPoliza::where('pagos_polizas.broker_id', $brokerId)
                ->where('pagos_polizas.tipo_recaudo', 'aseguradora')
                ->where('pagos_polizas.estado', 'pagado')
                ->join('polizas', 'pagos_polizas.poliza_id', '=', 'polizas.id')
                ->leftJoin('clientes', 'polizas.client_id', '=', 'clientes.id')
                ->leftJoin('aseguradoras', 'polizas.aseguradora_id', '=', 'aseguradoras.id')
                ->select([
                    'pagos_polizas.id as pago_id',
                    'pagos_polizas.poliza_id',
                    'pagos_polizas.monto_pagado',
                    'pagos_polizas.monto_total',
                    'pagos_polizas.fecha_pago',
                    'pagos_polizas.metodo_pago',
                    'pagos_polizas.referencia_pago',
                    'pagos_polizas.observaciones',
                    'pagos_polizas.recaudo_import_id',
                    'pagos_polizas.created_at',
                    'polizas.policy_number',
                    'polizas.premium_amount',
                    'polizas.total_amount',
                    'polizas.commission_amount',
                    'polizas.commission_percentage',
                    DB::raw("CONCAT(COALESCE(clientes.first_name, ''), ' ', COALESCE(clientes.last_name, '')) as cliente_nombre"),
                    'clientes.document_number as cliente_documento',
                    'aseguradoras.nombre as aseguradora_nombre',
                ]);

            // Búsqueda
            if (!empty($search)) {
                $query->where(function($q) use ($search) {
                    $q->where('polizas.policy_number', 'LIKE', "%{$search}%")
                      ->orWhere('clientes.first_name', 'LIKE', "%{$search}%")
                      ->orWhere('clientes.last_name', 'LIKE', "%{$search}%")
                      ->orWhere('clientes.document_number', 'LIKE', "%{$search}%");
                });
            }

            $query->orderBy('pagos_polizas.fecha_pago', 'desc')
                  ->orderBy('pagos_polizas.id', 'desc');

            $paginated = $query->paginate($perPage, ['*'], 'page', $page);

            // Transformar datos
            $pagos = $paginated->getCollection()->map(function($pago) {
                $primaNeta = (float) $pago->premium_amount;
                $comision = (float) ($pago->commission_amount ?? ($primaNeta * ($pago->commission_percentage ?? 15) / 100));
                
                return [
                    'pago_id' => $pago->pago_id,
                    'poliza_id' => $pago->poliza_id,
                    'numero_poliza' => $pago->policy_number,
                    'cliente' => $pago->cliente_nombre ?? 'Sin nombre',
                    'documento' => $pago->cliente_documento ?? '',
                    'aseguradora' => $pago->aseguradora_nombre ?? '',
                    'prima_neta' => $primaNeta,
                    'monto_pagado' => (float) $pago->monto_pagado,
                    'comision' => $comision,
                    'fecha_pago' => $pago->fecha_pago,
                    'metodo_pago' => $pago->metodo_pago,
                    'referencia_pago' => $pago->referencia_pago,
                    'observaciones' => $pago->observaciones,
                    'import_id' => $pago->recaudo_import_id,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $pagos,
                'pagination' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                ],
            ]);

        } catch (\Exception $e) {
            Log::error("Error en listarPagosAseguradora: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al listar pagos: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Revertir un pago individual de aseguradora
     */
    public function revertirPagoAseguradora(Request $request, $pagoId)
    {
        try {
            $brokerId = $request->get('authenticated_broker_id');

            $pago = PagoPoliza::where('id', $pagoId)
                ->where('broker_id', $brokerId)
                ->where('tipo_recaudo', 'aseguradora')
                ->first();

            if (!$pago) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pago no encontrado'
                ], 404);
            }

            DB::beginTransaction();

            $polizaId = $pago->poliza_id;
            $montoPagado = $pago->monto_pagado;

            // Anular recibo asociado a este pago
            $this->anularRecibosDeReversion([$pago->id]);

            $pago->delete();

            // Sync cartera_items after reverting
            $this->syncCarteraItems($polizaId);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Pago de " . number_format($montoPagado, 0, ',', '.') . " revertido exitosamente",
                'poliza_id' => $polizaId
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Error al revertir pago aseguradora: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al revertir pago: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Auto-generate a ReciboCaja for a PagoPoliza if one doesn't already exist.
     * This ensures every payment from any entry point (CarteraClientes, PagosPoliza tab, CSV, etc.)
     * always has a corresponding recibo in the recibos_caja table.
     */
    private function autoGenerateRecibo(PagoPoliza $pago, Poliza $poliza, ?Request $request = null): ?ReciboCaja
    {
        try {
            // Skip if pago was deleted (e.g., duplicate handling in aseguradora flow)
            if (!$pago->exists) return null;

            // Skip for pending aseguradora payments (auto-generated placeholders)
            if ($pago->tipo_recaudo === 'aseguradora' && $pago->estado === 'pendiente') return null;

            // Check if a recibo already exists for this exact pago (prevent duplicates)
            $existingRecibo = ReciboCaja::withoutGlobalScopes()
                ->where('broker_id', $poliza->broker_id)
                ->where('pago_poliza_id', $pago->id)
                ->first();

            if ($existingRecibo) return $existingRecibo;

            // Generate next recibo number: use MAX to guarantee no gaps/duplicates per broker
            // REGEXP_REPLACE strips non-numeric chars so 'RC-032394' → 32394
            $maxNum = (int) DB::table('recibos_caja')
                ->where('broker_id', $poliza->broker_id)
                ->whereNull('deleted_at')
                ->max(DB::raw("CAST(REGEXP_REPLACE(numero_recibo, '[^0-9]', '') AS UNSIGNED)"));
            $nextNum = $maxNum + 1;

            $tipoRecaudo = $pago->tipo_recaudo;
            $esOficina = $tipoRecaudo === 'oficina';

            // Get client info
            $cliente = $poliza->client;
            $clienteNombre = $cliente
                ? trim(($cliente->first_name ?? '') . ' ' . ($cliente->last_name ?? ''))
                : ($poliza->client_name ?? null);

            $recibo = ReciboCaja::create([
                'broker_id' => $poliza->broker_id,
                'poliza_id' => $poliza->id,
                'cliente_id' => $poliza->client_id,
                'pago_poliza_id' => $pago->id,
                'numero_recibo' => (string) $nextNum,
                'tipo' => 'recibo',
                'tipo_recaudo' => $tipoRecaudo,
                'forma_pago' => $pago->metodo_pago,
                'fecha_realizo_pago_oficina' => $pago->fecha_pago,
                'valor_recaudado_en_oficina' => $pago->monto_pagado,
                'valor_a_pagar' => $pago->monto_pagado,
                'es_anticipo' => false,
                'recibo_pago_directo' => !$esOficina,
                'recaudo_directo' => !$esOficina,
                'recaudado_en_oficina' => $esOficina,
                'activo' => true,
                'recibo_anulado' => false,
                'source' => 'guro',
                'observaciones' => $pago->observaciones ?? ('Recibo auto-generado para pago #' . $pago->id),
                // Denormalized display fields
                'poliza_numero' => $poliza->policy_number ?? null,
                'cliente_nombre' => $clienteNombre,
                'cliente_documento' => $cliente->document_number ?? ($poliza->client_document ?? null),
                'aseguradora_nombre' => $poliza->aseguradora?->nombre ?? null,
                'ramo_nombre' => $poliza->ramo?->nombre ?? null,
            ]);

            return $recibo;
        } catch (\Throwable $e) {
            // Don't break the payment flow if recibo generation fails
            Log::warning("autoGenerateRecibo failed for pago {$pago->id}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Ensure a CobroComision record exists for a poliza.
     * Creates one (pendiente) if none exists. Idempotent — safe to call multiple times.
     */
    private function ensureCobroComisionExists(Poliza $poliza, ?int $pagoPolizaId = null): void
    {
        $currentRenovacion = (int) ($poliza->numero_renovacion ?? 0);
        $existing = CobroComision::where('poliza_id', $poliza->id)
            ->where('numero_renovacion', $currentRenovacion)
            ->first();
        if ($existing) return;

        $comision = $poliza->commission_amount ?? 0;
        if ($comision <= 0) return;

        CobroComision::create([
            'broker_id' => $poliza->broker_id,
            'poliza_id' => $poliza->id,
            'aseguradora_id' => $poliza->aseguradora_id,
            'pago_poliza_id' => $pagoPolizaId,
            'monto_comision' => $comision,
            'monto_cobrado' => 0,
            'monto_pendiente' => $comision,
            'estado' => 'pendiente',
            'observaciones' => 'Comisión generada automáticamente',
        ]);
    }

    /**
     * Anull (mark as anulado) all ReciboCaja linked to the given pago IDs or poliza.
     * Used when reverting payments so the recibos reflect the reversal.
     */
    private function anularRecibosDeReversion(array $pagoIds = [], ?int $polizaId = null): int
    {
        $query = ReciboCaja::where('recibo_anulado', false);

        if (!empty($pagoIds)) {
            $query->whereIn('pago_poliza_id', $pagoIds);
        } elseif ($polizaId) {
            $query->where('poliza_id', $polizaId)
                  ->where('source', 'guro');
        } else {
            return 0;
        }

        $count = $query->update([
            'recibo_anulado' => true,
            'activo' => false,
            'observaciones' => DB::raw("CONCAT(COALESCE(observaciones, ''), ' [Anulado por reversión de pago]')"),
        ]);

        return $count;
    }

    /**
     * Sync cartera_items for a given poliza based on current pagos_polizas state.
     * This keeps the cartera view (which reads from cartera_items) in sync with
     * actual payment operations done through Guro's PagoPoliza system.
     *
     * A poliza can have MULTIPLE cartera_items (one per cuota from SoftSeguros Excel).
     * When payment state changes, ALL cartera_items for this poliza transition together.
     *
     * SoftSeguros tab logic:
     * - por_cobrar: NOT recaudado_oficina AND NOT recaudado_aseguradora
     * - por_pagar: recaudado_oficina AND NOT recaudado_aseguradora
     * - comision_por_cobrar: recaudado_aseguradora AND NOT comisionada
     * - comision_recibida: recaudado_aseguradora AND comisionada
     */
    private function syncCarteraItems(int $polizaId, ?int $numeroRenovacion = null, ?int $carteraItemId = null): void
    {
        try {
            $poliza = Poliza::with(['aseguradora', 'ramo', 'client', 'vendedor'])->find($polizaId);
            if (!$poliza) return;

            $brokerId = $poliza->broker_id;
            // Use provided numero_renovacion or fall back to poliza's current value
            $currentRenovacion = $numeroRenovacion ?? ((int) ($poliza->numero_renovacion ?? 0));

            // Helper: build a cartera_items query scoped to a specific item or poliza+renovacion
            $carteraQuery = function () use ($brokerId, $polizaId, $currentRenovacion, $carteraItemId) {
                $q = DB::table('cartera_items')->where('broker_id', $brokerId);
                if ($carteraItemId) {
                    return $q->where('id', $carteraItemId);
                }
                return $q->where('poliza_id', $polizaId)->where('numero_renovacion', $currentRenovacion);
            };

            // Aggregate payment state from pagos_polizas — scoped to current renovation period
            $pagosOficina = PagoPoliza::where('poliza_id', $polizaId)
                ->where('numero_renovacion', $currentRenovacion)
                ->where('tipo_recaudo', 'oficina')
                ->get();
            $pagosAseguradora = PagoPoliza::where('poliza_id', $polizaId)
                ->where('numero_renovacion', $currentRenovacion)
                ->where('tipo_recaudo', 'aseguradora')
                ->get();
            $cobrosComision = CobroComision::where('poliza_id', $polizaId)
                ->where('numero_renovacion', $currentRenovacion)
                ->get();

            $totalRecaudadoOficina = (float) $pagosOficina->sum('monto_pagado');
            $recaudadoEnOficina = $totalRecaudadoOficina > 0;

            $totalPagadoAseguradora = (float) $pagosAseguradora->where('estado', 'pagado')->sum('monto_pagado');
            $recaudadoAseguradora = $totalPagadoAseguradora > 0;

            $totalComisionCobrada = (float) $cobrosComision->sum('monto_cobrado');
            $comisionada = $totalComisionCobrada > 0;

            // Determine target estado_cartera
            $nuevoEstado = 'por_cobrar';
            if ($recaudadoAseguradora && $comisionada) {
                $nuevoEstado = 'comision_recibida';
            } elseif ($recaudadoAseguradora) {
                $nuevoEstado = 'comision_por_cobrar';
            } elseif ($recaudadoEnOficina) {
                $nuevoEstado = 'por_pagar';
            }

            // Date fields from pagos
            $fechaRecaudadoOficina = $recaudadoEnOficina
                ? ($pagosOficina->sortByDesc('fecha_pago')->first()->fecha_pago ?? null)
                : null;
            $fechaPagoAseguradora = $recaudadoAseguradora
                ? ($pagosAseguradora->where('estado', 'pagado')->sortByDesc('fecha_pago')->first()->fecha_pago ?? null)
                : null;
            $fechaComisionada = $comisionada
                ? ($cobrosComision->sortByDesc('updated_at')->first()->updated_at?->format('Y-m-d') ?? null)
                : null;

            // Check if cartera_items exist for this poliza + renovation period
            $existingCount = $carteraQuery()->count();

            if ($existingCount > 0) {
                $hasPagosGuro = $pagosOficina->isNotEmpty() || $pagosAseguradora->isNotEmpty() || $cobrosComision->isNotEmpty();

                if ($hasPagosGuro) {
                    // For items imported from SoftSeguros, Guro payments should be ADDED
                    // on top of the original imported baseline, not replace them.
                    // We store the original imported baseline in softseguros_* fields or
                    // read from current values minus any previous Guro overlay.
                    // Simplest approach: only update estado + aseguradora/comision fields.
                    // For oficina: only update if there are Guro oficina pagos.
                    $updateData = [
                        'estado_cartera' => $nuevoEstado,
                        'valor_pagado_aseguradora' => $totalPagadoAseguradora,
                        'comision_recibida' => $totalComisionCobrada,
                        'fecha_pago_aseguradora' => $fechaPagoAseguradora,
                        'fecha_comisionada' => $fechaComisionada,
                        'updated_at' => now(),
                    ];

                    // Only overwrite oficina values if there are actual Guro oficina pagos
                    if ($pagosOficina->isNotEmpty()) {
                        $updateData['valor_recaudado_oficina'] = $totalRecaudadoOficina;
                        $updateData['fecha_recaudado_oficina'] = $fechaRecaudadoOficina;

                        // Recalculate saldo_pendiente_oficina using cartera_item's own total (cuota-specific)
                        $ciTotal = (float) $carteraQuery()->value('prima_total_pago');
                        $montoTotalCuota = $ciTotal ?: ($poliza->total_amount ?? ($poliza->premium_amount + ($poliza->vat_amount ?? 0)));
                        $saldoOficina = max(0, $montoTotalCuota - $totalRecaudadoOficina);
                        $updateData['saldo_pendiente_oficina'] = $saldoOficina;
                    } elseif ($recaudadoAseguradora) {
                        // Recaudo directo por aseguradora: no hay pagos de oficina pero
                        // el cliente ya pagó directo. Saldo oficina debe ser 0.
                        $updateData['valor_recaudado_oficina'] = (float) $carteraQuery()->value('prima_total_pago') ?: ($poliza->total_amount ?? ($poliza->premium_amount + ($poliza->vat_amount ?? 0)));
                        $updateData['saldo_pendiente_oficina'] = 0;
                    }

                    $carteraQuery()->update($updateData);
                } else {
                    // NO Guro pagos — restore estado_cartera from original imported flags.
                    // Don't overwrite financial values (they come from the SoftSeguros import).
                    // Determine original state from the first cartera_item's imported values.
                    $sample = $carteraQuery()->first(['valor_recaudado_oficina', 'valor_pagado_aseguradora', 'comision_recibida']);

                    $origOficina = $sample && (float) $sample->valor_recaudado_oficina > 0;
                    $origAseg = $sample && (float) $sample->valor_pagado_aseguradora > 0;
                    $origComision = $sample && (float) $sample->comision_recibida > 0;

                    $restoredEstado = 'por_cobrar';
                    if ($origAseg && $origComision) {
                        $restoredEstado = 'comision_recibida';
                    } elseif ($origAseg) {
                        $restoredEstado = 'comision_por_cobrar';
                    } elseif ($origOficina) {
                        $restoredEstado = 'por_pagar';
                    }

                    $carteraQuery()->update([
                            'estado_cartera' => $restoredEstado,
                            'fecha_pago_aseguradora' => null,
                            'fecha_comisionada' => null,
                            'updated_at' => now(),
                        ]);
                }
            } else {
                // CREATE a new cartera_item (poliza has no imported items from Excel)
                $cliente = $poliza->client;
                $clienteNombre = $cliente
                    ? trim(($cliente->first_name ?? '') . ' ' . ($cliente->last_name ?? ''))
                    : null;

                $montoTotalPoliza = $poliza->total_amount ?? ($poliza->premium_amount + ($poliza->vat_amount ?? 0));
                $primaNeta = $poliza->premium_amount ?? 0;
                $comisionPoliza = $poliza->commission_amount ?? 0;

                DB::table('cartera_items')->insert([
                    'broker_id' => $brokerId,
                    'poliza_id' => $polizaId,
                    'numero_renovacion' => $currentRenovacion,
                    'cliente_id' => $poliza->client_id,
                    'poliza_numero' => $poliza->policy_number,
                    'cliente_nombre' => $clienteNombre,
                    'cliente_documento' => $cliente->document_number ?? null,
                    'aseguradora_nombre' => $poliza->aseguradora?->nombre ?? null,
                    'ramo_principal' => $poliza->ramo?->nombre ?? null,
                    'vendedor_nombre' => $poliza->vendedor?->nombre ?? null,
                    'forma_pago' => $poliza->forma_pago ?? null,
                    'prima_neta' => $primaNeta,
                    'valor_neto_a_pagar' => max(0, $montoTotalPoliza - $comisionPoliza),
                    'prima_total_pago' => $montoTotalPoliza,
                    'prima_total' => $montoTotalPoliza,
                    'comision_a_recibir' => $comisionPoliza,
                    'comision_vendedor' => 0,
                    'estado_cartera' => $nuevoEstado,
                    'valor_recaudado_oficina' => $totalRecaudadoOficina,
                    'valor_pagado_aseguradora' => $totalPagadoAseguradora,
                    'saldo_pendiente_oficina' => max(0, $montoTotalPoliza - $totalRecaudadoOficina),
                    'saldo_pendiente_aseguradora' => $recaudadoEnOficina
                        ? max(0, $montoTotalPoliza - $comisionPoliza - $totalPagadoAseguradora)
                        : 0,
                    'comision_recibida' => $totalComisionCobrada,
                    'dias_vencidos' => 0,
                    'fecha_recaudado_oficina' => $fechaRecaudadoOficina,
                    'fecha_pago_aseguradora' => $fechaPagoAseguradora,
                    'fecha_comisionada' => $fechaComisionada,
                    'fecha_inicio_vigencia' => $poliza->start_date ?? null,
                    'fecha_fin_vigencia' => $poliza->end_date ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        } catch (\Throwable $e) {
            // Don't break the payment flow if cartera sync fails
            Log::warning("syncCarteraItems failed for poliza {$polizaId}: " . $e->getMessage());
        }
    }
}