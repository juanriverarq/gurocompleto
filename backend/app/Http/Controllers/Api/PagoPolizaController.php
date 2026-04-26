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
     * Editar una cuota (cartera_item) — fecha de vencimiento, monto, comisión.
     * Recalcula campos dependientes (saldos, valor_neto_a_pagar) automáticamente.
     */
    public function updateCarteraItem(Request $request, $polizaId, $itemId)
    {
        $validator = Validator::make($request->all(), [
            'fecha_limite_pago' => 'nullable|date',
            'prima_total_pago' => 'nullable|numeric|min:0',
            'comision_a_recibir' => 'nullable|numeric|min:0',
            'anexo_numero' => 'nullable|string|max:100',
            'numero_pago' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

            $ci = DB::table('cartera_items')
                ->where('id', $itemId)
                ->where('poliza_id', $polizaId)
                ->first();

            if (!$ci) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cuota no encontrada',
                ], 404);
            }

            $updateData = ['updated_at' => now()];

            if ($request->filled('fecha_limite_pago')) {
                $updateData['fecha_limite_pago'] = $request->fecha_limite_pago;
            }
            if ($request->has('anexo_numero')) {
                $updateData['anexo_numero'] = $request->anexo_numero ?: null;
            }
            if ($request->has('numero_pago')) {
                $updateData['numero_pago'] = $request->numero_pago ?: null;
            }

            // Si cambia el monto de la cuota, recalcular saldos y valor neto
            if ($request->filled('prima_total_pago')) {
                $nuevoTotal = (float) $request->prima_total_pago;
                $comisionActual = $request->filled('comision_a_recibir')
                    ? (float) $request->comision_a_recibir
                    : (float) ($ci->comision_a_recibir ?? 0);
                $valorNeto = max(0, $nuevoTotal - $comisionActual);
                $valorRecaudado = (float) ($ci->valor_recaudado_oficina ?? 0);
                $valorPagadoAseg = (float) ($ci->valor_pagado_aseguradora ?? 0);

                $updateData['prima_total_pago'] = $nuevoTotal;
                $updateData['prima_total'] = $nuevoTotal;
                $updateData['comision_a_recibir'] = $comisionActual;
                $updateData['valor_neto_a_pagar'] = $valorNeto;
                $updateData['saldo_pendiente_oficina'] = max(0, $nuevoTotal - $valorRecaudado);
                $updateData['saldo_pendiente_aseguradora'] = max(0, $valorNeto - $valorPagadoAseg);
            } elseif ($request->filled('comision_a_recibir')) {
                // Sólo cambió la comisión: recalcular valor neto
                $comisionNueva = (float) $request->comision_a_recibir;
                $totalActual = (float) ($ci->prima_total_pago ?? 0);
                $valorPagadoAseg = (float) ($ci->valor_pagado_aseguradora ?? 0);
                $valorNeto = max(0, $totalActual - $comisionNueva);
                $updateData['comision_a_recibir'] = $comisionNueva;
                $updateData['valor_neto_a_pagar'] = $valorNeto;
                $updateData['saldo_pendiente_aseguradora'] = max(0, $valorNeto - $valorPagadoAseg);
            }

            DB::table('cartera_items')->where('id', $itemId)->update($updateData);

            // Re-sincronizar para que los flags (recaudado_en_oficina, etc.) queden correctos
            $this->syncCarteraItems((int) $polizaId, null, (int) $itemId);

            DB::commit();

            $updated = DB::table('cartera_items')->where('id', $itemId)->first();
            return response()->json([
                'success' => true,
                'message' => 'Cuota actualizada',
                'data' => $updated,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar cuota: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get cartera_items for a specific poliza (real cuotas from SS)
     */
    public function carteraItemsByPoliza(Request $request, $polizaId)
    {
        try {
            $brokerId = $request->attributes->get('broker_id');
            $items = DB::table('cartera_items')
                ->where('broker_id', $brokerId)
                ->where('poliza_id', $polizaId)
                ->orderBy('softseguros_pago_id')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $items
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
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
                    : (((float)($poliza->total_amount ?? 0) > 0 ? (float)$poliza->total_amount : ((float)($poliza->premium_amount ?? 0) + (float)($poliza->vat_amount ?? 0))));
                
                // Sumar pagos anteriores: si hay cartera_item_id, solo los de esa cuota; si no, todos los de la póliza
                $queryAnterior = PagoPoliza::where('poliza_id', $polizaId)
                    ->where('tipo_recaudo', 'oficina');
                if ($carteraItem) {
                    $queryAnterior->where('cartera_item_id', $carteraItem->id);
                } else {
                    $queryAnterior->where('numero_renovacion', $currentRenovacion);
                }
                $totalRecaudadoAnterior = (float) $queryAnterior->sum('monto_pagado');
                
                // Calcular el nuevo pendiente después de este pago
                $nuevoTotalRecaudado = $totalRecaudadoAnterior + $montoRecibido;
                $montoPendienteRestante = max(0, $montoTotalPoliza - $nuevoTotalRecaudado);
                
                // Determinar estado: 'pagado' si este abono completa el total
                $estado = $montoPendienteRestante <= 0 ? 'pagado' : 'parcial';
                
                // Crear registro individual para este abono
                $pagoData = [
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
                ];
                if ($request->filled('cartera_item_id')) {
                    $pagoData['cartera_item_id'] = (int) $request->cartera_item_id;
                }
                $pago = PagoPoliza::create($pagoData);
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
                    
                    $pagoDirectoData = [
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
                    ];
                    if ($request->filled('cartera_item_id')) {
                        $pagoDirectoData['cartera_item_id'] = (int) $request->cartera_item_id;
                    }
                    $pago = PagoPoliza::create($pagoDirectoData);
                } else {
                    $pago = $pagoAseguradoraExistente;
                }
            } else {
                // Para pago a aseguradora (desde Por Pagar)
                $pagoAsegData = [
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
                ];
                if ($request->filled('cartera_item_id')) {
                    $pagoAsegData['cartera_item_id'] = (int) $request->cartera_item_id;
                }
                $pago = PagoPoliza::create($pagoAsegData);
            }

            // Si es recaudo oficina COMPLETO (estado = pagado), crear automáticamente:
            // 1. Pago pendiente a la aseguradora (prima neta)
            // 2. Cobro de comisión pendiente
            $requestCarteraItemId = $request->filled('cartera_item_id') ? (int) $request->cartera_item_id : null;

            if ($request->tipo_recaudo === 'oficina' && $pago->estado === 'pagado' && $pago->habilitaComision()) {
                // 1. Crear pago pendiente a aseguradora por la prima neta
                $primaNeta = $carteraItem
                    ? (float) ($carteraItem->valor_neto_a_pagar ?: $carteraItem->prima_total_pago)
                    : ($poliza->premium_amount ?? 0);
                if ($primaNeta > 0) {
                    $pagoAsegAutoData = [
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
                    ];
                    if ($requestCarteraItemId) {
                        $pagoAsegAutoData['cartera_item_id'] = $requestCarteraItemId;
                    }
                    PagoPoliza::create($pagoAsegAutoData);
                }

                // 2. Crear cobro de comisión pendiente (if doesn't already exist)
                $this->ensureCobroComisionExists($poliza, $pago->id, $requestCarteraItemId);
            }

            // Para aseguradora_directo o pago a aseguradora: también crear cobro de comisión
            // (la aseguradora ya cobró, el broker necesita cobrar su comisión)
            if (in_array($request->tipo_recaudo, ['aseguradora_directo', 'aseguradora']) && $pago->exists) {
                $this->ensureCobroComisionExists($poliza, $pago->id, $requestCarteraItemId);

                // Auto-cobro de comisión: si el broker tiene activado settings.auto_cobrar_comision,
                // marcar la comisión como cobrada inmediatamente. Ahorra un click al broker.
                $broker = \App\Models\Broker::find($poliza->broker_id);
                $autoCobrar = (bool) data_get($broker?->settings ?? [], 'auto_cobrar_comision', false);
                if ($autoCobrar) {
                    $this->autoMarcarComisionCobrada($poliza, $requestCarteraItemId);
                }
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
            $ciIdForSync = $request->filled('cartera_item_id') ? (int) $request->cartera_item_id : null;
            Log::info("PagoPoliza::store sync", [
                'poliza_id' => $polizaId,
                'tipo_recaudo' => $request->tipo_recaudo,
                'pago_id' => $pago->id ?? null,
                'pago_ci' => $pago->cartera_item_id ?? null,
                'ciIdForSync' => $ciIdForSync,
            ]);
            $this->syncCarteraItems((int) $polizaId, null, $ciIdForSync);

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

                $cobroData = [
                    'broker_id' => $poliza->broker_id,
                    'poliza_id' => $polizaId,
                    'aseguradora_id' => $poliza->aseguradora_id,
                    'pago_poliza_id' => null,
                    'monto_comision' => $montoComision,
                    'monto_cobrado' => 0,
                    'monto_pendiente' => $montoComision,
                    'estado' => 'pendiente',
                    'observaciones' => 'Comisión creada manualmente',
                ];
                if ($request->filled('cartera_item_id')) {
                    $cobroData['cartera_item_id'] = (int) $request->cartera_item_id;
                }
                $cobroComision = CobroComision::create($cobroData);
            }

            // Registrar el cobro
            $cobroComision->registrarCobro($request->monto, [
                'referencia_cobro' => $request->referencia_cobro,
                'observaciones' => $request->observaciones,
                'fecha_cobro' => $request->fecha_cobro ?? now(),
            ]);

            // Sync cartera_items (comision changes tab from comision_por_cobrar → comision_recibida)
            $this->syncCarteraItems((int) $polizaId, null, $request->filled('cartera_item_id') ? (int) $request->cartera_item_id : null);

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
     * Editar un pago de póliza existente.
     * Permite forzar fecha de pago, monto, método, referencia y observaciones.
     * Sincroniza recibo de caja vinculado y cartera_items al terminar.
     */
    public function updatePago(Request $request, $polizaId, $pagoId)
    {
        $validator = Validator::make($request->all(), [
            'fecha_pago' => 'nullable|date',
            'monto' => 'nullable|numeric|min:0.01',
            'metodo_pago' => 'nullable|string|max:50',
            'referencia_pago' => 'nullable|string|max:255',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

            $pago = PagoPoliza::where('poliza_id', $polizaId)
                ->where('id', $pagoId)
                ->first();

            if (!$pago) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pago no encontrado',
                ], 404);
            }

            $updateData = [];

            if ($request->filled('fecha_pago')) {
                $updateData['fecha_pago'] = $request->fecha_pago;
            }
            if ($request->filled('metodo_pago')) {
                $updateData['metodo_pago'] = $request->metodo_pago;
            }
            if ($request->has('referencia_pago')) {
                $updateData['referencia_pago'] = $request->referencia_pago;
            }
            if ($request->has('observaciones')) {
                $updateData['observaciones'] = $request->observaciones;
            }

            // Monto: recalcular estado/saldo en base al nuevo valor
            if ($request->filled('monto')) {
                $nuevoMonto = (float) $request->monto;
                $total = (float) ($pago->monto_total ?? $nuevoMonto);
                if ($total <= 0) { $total = $nuevoMonto; }
                $updateData['monto_pagado'] = $nuevoMonto;
                $updateData['monto_pendiente'] = max(0, $total - $nuevoMonto);
                if ($nuevoMonto >= $total - 0.01) {
                    $updateData['estado'] = 'pagado';
                } elseif ($nuevoMonto > 0) {
                    $updateData['estado'] = 'parcial';
                } else {
                    $updateData['estado'] = 'pendiente';
                }
            }

            if (!empty($updateData)) {
                $pago->update($updateData);
            }

            // Sincronizar recibo de caja vinculado (si existe)
            $reciboQuery = ReciboCaja::query();
            if ($pago->recibo_caja_id) {
                $reciboQuery->where('id', $pago->recibo_caja_id);
            } else {
                $reciboQuery->where('pago_poliza_id', $pago->id);
            }
            $recibo = $reciboQuery->first();
            if ($recibo) {
                $reciboUpdate = [];
                if ($request->filled('fecha_pago')) {
                    $reciboUpdate['fecha_realizo_pago_oficina'] = $request->fecha_pago;
                    $reciboUpdate['fecha_realizo_pago'] = $request->fecha_pago;
                    $reciboUpdate['fecha_pago'] = $request->fecha_pago;
                }
                if ($request->filled('metodo_pago')) {
                    $reciboUpdate['forma_pago'] = $request->metodo_pago;
                }
                if ($request->filled('monto')) {
                    $nuevoMonto = (float) $request->monto;
                    if ($pago->tipo_recaudo === 'oficina') {
                        $reciboUpdate['valor_recaudado_en_oficina'] = $nuevoMonto;
                    } else {
                        $reciboUpdate['valor_a_pagar'] = $nuevoMonto;
                    }
                }
                if ($request->has('observaciones')) {
                    $reciboUpdate['observaciones'] = $request->observaciones;
                }
                if (!empty($reciboUpdate)) {
                    $recibo->update($reciboUpdate);
                }
            }

            // Sincronizar cartera_items para reflejar los nuevos montos/fechas
            $this->syncCarteraItems((int) $polizaId, null, $pago->cartera_item_id ?? null);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Pago actualizado exitosamente',
                'data' => $pago->fresh(),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar pago: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Marcar toda la póliza como totalmente pagada (usado cuando se cambia
     * estado_cartera a "Pagado" desde la edición de la póliza).
     *
     * Crea (si no existen) los PagoPoliza de oficina + aseguradora y el
     * CobroComision correspondiente para cada cuota; luego sincroniza
     * cartera_items vía syncCarteraItems para reflejar el estado final
     * (recaudado_en_oficina, recaudado_aseguradora, comisionada = true).
     */
    public function marcarPolizaPagada(Request $request, $polizaId)
    {
        try {
            DB::beginTransaction();

            $poliza = Poliza::findOrFail($polizaId);
            $brokerId = $poliza->broker_id;
            $renovacion = (int) ($poliza->numero_renovacion ?? 0);
            $fecha = $request->input('fecha') ?: now()->toDateString();
            $metodoPago = $request->input('metodo_pago', 'efectivo');
            $observaciones = $request->input('observaciones', 'Marcado como pagado desde edición de póliza');

            // Modos: por defecto ambos; el usuario puede elegir solo uno.
            $marcarOficina = $request->boolean('oficina', true);
            $marcarAseguradora = $request->boolean('aseguradora', true);
            if (!$marcarOficina && !$marcarAseguradora) {
                $marcarOficina = $marcarAseguradora = true; // fallback seguro
            }

            $created = ['oficina' => 0, 'aseguradora' => 0, 'comision' => 0];
            $itemsTouched = 0;

            // Validar aseguradora_id contra la tabla aseguradoras (algunos imports tienen FKs huérfanas)
            $aseguradoraId = $poliza->aseguradora_id;
            if ($aseguradoraId && !DB::table('aseguradoras')->where('id', $aseguradoraId)->exists()) {
                $aseguradoraId = null;
            }

            $items = DB::table('cartera_items')
                ->where('poliza_id', $polizaId)
                ->where('broker_id', $brokerId)
                ->where('numero_renovacion', $renovacion)
                ->get();

            if ($items->isEmpty()) {
                // Sin cartera_items: trabajar a nivel de póliza
                $montoTotal = ((float) ($poliza->total_amount ?? 0) > 0)
                    ? (float) $poliza->total_amount
                    : ((float) ($poliza->premium_amount ?? 0) + (float) ($poliza->vat_amount ?? 0));
                $comision = (float) ($poliza->commission_amount ?? 0);
                $valorNeto = max(0, $montoTotal - $comision);

                if ($montoTotal > 0) {
                    $this->ensurePagosForPagada(
                        $poliza, null, $renovacion, $aseguradoraId,
                        $montoTotal, $valorNeto, $comision,
                        $fecha, $metodoPago, $observaciones, $created,
                        $marcarOficina, $marcarAseguradora
                    );
                    $itemsTouched++;
                }
                $this->syncCarteraItems((int) $polizaId);
            } else {
                foreach ($items as $ci) {
                    if ($ci->recibo_anulado) { continue; }
                    $montoTotal = (float) $ci->prima_total_pago;
                    $valorNeto = (float) $ci->valor_neto_a_pagar;
                    $comision = (float) $ci->comision_a_recibir;
                    if ($valorNeto <= 0 && $montoTotal > 0) {
                        $valorNeto = max(0, $montoTotal - $comision);
                    }

                    $this->ensurePagosForPagada(
                        $poliza, (int) $ci->id, $renovacion, $aseguradoraId,
                        $montoTotal, $valorNeto, $comision,
                        $fecha, $metodoPago, $observaciones, $created,
                        $marcarOficina, $marcarAseguradora
                    );
                    $itemsTouched++;

                    $this->syncCarteraItems((int) $polizaId, null, (int) $ci->id);
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Póliza marcada como pagada ({$itemsTouched} cuota(s))",
                'data' => [
                    'items_procesados' => $itemsTouched,
                    'pagos_creados' => $created,
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('marcarPolizaPagada falló: ' . $e->getMessage(), ['poliza_id' => $polizaId]);
            return response()->json([
                'success' => false,
                'message' => 'Error al marcar como pagada: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Helper: asegura que existan PagoPoliza oficina + aseguradora y CobroComision
     * para una cuota (cartera_item) o para la póliza si no hay cuotas.
     */
    private function ensurePagosForPagada(
        Poliza $poliza,
        ?int $carteraItemId,
        int $renovacion,
        ?int $aseguradoraId,
        float $montoTotal,
        float $valorNeto,
        float $comision,
        string $fecha,
        string $metodoPago,
        string $observaciones,
        array &$created,
        bool $marcarOficina = true,
        bool $marcarAseguradora = true
    ): void {
        $base = [
            'broker_id' => $poliza->broker_id,
            'poliza_id' => $poliza->id,
            'numero_renovacion' => $renovacion,
            'cliente_id' => $poliza->client_id,
            'cartera_item_id' => $carteraItemId,
        ];

        // 1. Pago oficina (sólo si marcarOficina)
        if ($marcarOficina) {
            $existsOficina = PagoPoliza::where('poliza_id', $poliza->id)
                ->where('numero_renovacion', $renovacion)
                ->where('tipo_recaudo', 'oficina')
                ->where('estado', 'pagado')
                ->when($carteraItemId, fn($q) => $q->where('cartera_item_id', $carteraItemId))
                ->when(!$carteraItemId, fn($q) => $q->whereNull('cartera_item_id'))
                ->exists();
            if (!$existsOficina && $montoTotal > 0) {
                PagoPoliza::create(array_merge($base, [
                    'monto_total' => $montoTotal,
                    'monto_pagado' => $montoTotal,
                    'monto_pendiente' => 0,
                    'tipo_recaudo' => 'oficina',
                    'metodo_pago' => $metodoPago,
                    'fecha_pago' => $fecha,
                    'estado' => 'pagado',
                    'observaciones' => $observaciones,
                ]));
                $created['oficina']++;
            }
        }

        // 2. Pago aseguradora (sólo si marcarAseguradora)
        $pagoAseg = null;
        if ($marcarAseguradora) {
            $pagoAseg = PagoPoliza::where('poliza_id', $poliza->id)
                ->where('numero_renovacion', $renovacion)
                ->where('tipo_recaudo', 'aseguradora')
                ->where('estado', 'pagado')
                ->when($carteraItemId, fn($q) => $q->where('cartera_item_id', $carteraItemId))
                ->when(!$carteraItemId, fn($q) => $q->whereNull('cartera_item_id'))
                ->first();
            if (!$pagoAseg && $valorNeto > 0) {
                $pagoAseg = PagoPoliza::create(array_merge($base, [
                    'monto_total' => $valorNeto,
                    'monto_pagado' => $valorNeto,
                    'monto_pendiente' => 0,
                    'tipo_recaudo' => 'aseguradora',
                    'metodo_pago' => $metodoPago,
                    'fecha_pago' => $fecha,
                    'estado' => 'pagado',
                    'observaciones' => 'Pago automático a aseguradora (póliza marcada Pagada)',
                ]));
                $created['aseguradora']++;
            }
        }

        // 3. Cobro comisión (sólo si hubo pago a aseguradora)
        if ($pagoAseg && $comision > 0) {
            $existsComision = CobroComision::where('poliza_id', $poliza->id)
                ->where('numero_renovacion', $renovacion)
                ->where('estado', 'cobrado')
                ->when($carteraItemId, fn($q) => $q->where('cartera_item_id', $carteraItemId))
                ->when(!$carteraItemId, fn($q) => $q->whereNull('cartera_item_id'))
                ->exists();
            if (!$existsComision) {
                CobroComision::create([
                    'broker_id' => $poliza->broker_id,
                    'poliza_id' => $poliza->id,
                    'numero_renovacion' => $renovacion,
                    'aseguradora_id' => $aseguradoraId,
                    'pago_poliza_id' => $pagoAseg->id,
                    'cartera_item_id' => $carteraItemId,
                    'monto_comision' => $comision,
                    'monto_cobrado' => $comision,
                    'monto_pendiente' => 0,
                    'fecha_cobro' => $fecha,
                    'estado' => 'cobrado',
                    'observaciones' => 'Comisión recibida automática (póliza marcada Pagada)',
                ]);
                $created['comision']++;
            }
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

            $carteraItemId = $pago->cartera_item_id;

            if ($pago->tipo_recaudo === 'oficina') {
                // Revertir recaudo por oficina:
                // 1. Find related aseguradora payments (scoped to same cartera_item if applicable)
                $asegQuery = PagoPoliza::where('poliza_id', $polizaId)
                    ->where('tipo_recaudo', 'aseguradora');
                if ($carteraItemId) {
                    $asegQuery->where('cartera_item_id', $carteraItemId);
                }
                $pagosAsegIds = $asegQuery->pluck('id')->toArray();

                // 2. Anular recibos asociados a este pago y pagos aseguradora relacionados
                $pagoIdsToAnull = array_merge([$pago->id], $pagosAsegIds);
                $this->anularRecibosDeReversion($pagoIdsToAnull);

                // 3. Eliminar el cobro de comisión asociado
                CobroComision::where('pago_poliza_id', $pago->id)->delete();
                // 4. Eliminar los pagos de aseguradora relacionados
                if (!empty($pagosAsegIds)) {
                    // Also delete comisiones linked to those aseguradora pagos
                    CobroComision::whereIn('pago_poliza_id', $pagosAsegIds)->delete();
                    PagoPoliza::whereIn('id', $pagosAsegIds)->delete();
                }
                // 5. Eliminar el recaudo de oficina
                $pago->delete();
                
            } elseif ($pago->tipo_recaudo === 'aseguradora') {
                // Anular recibo asociado a este pago
                $this->anularRecibosDeReversion([$pago->id]);

                // Eliminar comisiones vinculadas a este pago de aseguradora
                CobroComision::where('pago_poliza_id', $pago->id)->delete();

                // Revertir pago a aseguradora:
                // Si tiene recaudo por oficina (para misma cuota), volver a estado pendiente
                // Si NO tiene recaudo por oficina, eliminar completamente
                $oficinaQuery = PagoPoliza::where('poliza_id', $polizaId)
                    ->where('tipo_recaudo', 'oficina')
                    ->where('estado', 'pagado');
                if ($carteraItemId) {
                    $oficinaQuery->where('cartera_item_id', $carteraItemId);
                }
                $tieneRecaudoOficina = $oficinaQuery->exists();
                
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
            $this->syncCarteraItems((int) $polizaId, $carteraItemId);

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
                    $montoTotalPoliza = ((float)($poliza->total_amount ?? 0) > 0 ? (float)$poliza->total_amount : ((float)($poliza->premium_amount ?? 0) + (float)($poliza->vat_amount ?? 0)));
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
                    $montoTotalPoliza = ((float)($poliza->total_amount ?? 0) > 0 ? (float)$poliza->total_amount : ((float)($poliza->premium_amount ?? 0) + (float)($poliza->vat_amount ?? 0)));
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
     * Revertir un cartera_item individual a por_cobrar.
     * Elimina todos los pagos, comisiones y recibos vinculados a este cartera_item.
     * Works from any state: por_pagar, comision_por_cobrar, comision_recibida, pago_directo.
     */
    public function revertirCarteraItem(Request $request, $polizaId, $carteraItemId)
    {
        try {
            DB::beginTransaction();

            $item = \DB::table('cartera_items')->where('id', $carteraItemId)->where('poliza_id', $polizaId)->first();
            if (!$item) {
                return response()->json(['success' => false, 'message' => 'Cartera item no encontrado'], 404);
            }

            $estadoAnterior = $item->estado_cartera;

            // 1. Find all pagos linked to this cartera_item
            $pagos = PagoPoliza::where('poliza_id', $polizaId)
                ->where('cartera_item_id', $carteraItemId)
                ->get();
            $pagoIds = $pagos->pluck('id')->toArray();

            // 2. Anular recibos asociados
            if (!empty($pagoIds)) {
                $this->anularRecibosDeReversion($pagoIds);
            }

            // 3. Delete comisiones linked to these pagos
            if (!empty($pagoIds)) {
                CobroComision::whereIn('pago_poliza_id', $pagoIds)->delete();
            }

            // 4. Delete all pagos for this cartera_item
            PagoPoliza::where('poliza_id', $polizaId)
                ->where('cartera_item_id', $carteraItemId)
                ->delete();

            // 5. Sync this cartera_item (will go back to por_cobrar since no pagos remain)
            $this->syncCarteraItems((int) $polizaId, null, (int) $carteraItemId);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Cuota {$item->numero_pago} revertida de \"{$estadoAnterior}\" a \"por_cobrar\"."
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al revertir cuota: ' . $e->getMessage()
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

            $montoTotalPoliza = ((float)($poliza->total_amount ?? 0) > 0 ? (float)$poliza->total_amount : ((float)($poliza->premium_amount ?? 0) + (float)($poliza->vat_amount ?? 0)));
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

            // Only generate recibos for oficina payments (client paying at office).
            // Payments to aseguradora are internal broker→insurer transfers, not client receipts.
            if ($pago->tipo_recaudo !== 'oficina') return null;

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
    private function ensureCobroComisionExists(Poliza $poliza, ?int $pagoPolizaId = null, ?int $carteraItemId = null): void
    {
        $currentRenovacion = (int) ($poliza->numero_renovacion ?? 0);
        $query = CobroComision::where('poliza_id', $poliza->id)
            ->where('numero_renovacion', $currentRenovacion);
        if ($carteraItemId) {
            $query->where('cartera_item_id', $carteraItemId);
        }
        if ($query->exists()) return;

        $comision = $poliza->commission_amount ?? 0;
        if ($comision <= 0) return;

        $cobroData = [
            'broker_id' => $poliza->broker_id,
            'poliza_id' => $poliza->id,
            'aseguradora_id' => $poliza->aseguradora_id,
            'pago_poliza_id' => $pagoPolizaId,
            'monto_comision' => $comision,
            'monto_cobrado' => 0,
            'monto_pendiente' => $comision,
            'estado' => 'pendiente',
            'observaciones' => 'Comisión generada automáticamente',
        ];
        if ($carteraItemId) {
            $cobroData['cartera_item_id'] = $carteraItemId;
        }
        CobroComision::create($cobroData);
    }

    /**
     * Marca como cobradas todas las comisiones pendientes de la póliza/cuota.
     * Usado por la opción broker.settings.auto_cobrar_comision.
     */
    private function autoMarcarComisionCobrada(Poliza $poliza, ?int $carteraItemId = null): void
    {
        $currentRenovacion = (int) ($poliza->numero_renovacion ?? 0);
        $query = CobroComision::where('poliza_id', $poliza->id)
            ->where('numero_renovacion', $currentRenovacion)
            ->where('estado', '!=', 'cobrado');

        if ($carteraItemId) {
            $query->where('cartera_item_id', $carteraItemId);
        }

        $cobros = $query->get();
        foreach ($cobros as $cobro) {
            $monto = (float) ($cobro->monto_pendiente ?: $cobro->monto_comision);
            $cobro->update([
                'monto_cobrado' => $monto,
                'monto_pendiente' => 0,
                'estado' => 'cobrado',
                'fecha_cobro' => now()->toDateString(),
                'observaciones' => trim(($cobro->observaciones ?? '') . ' [Auto-cobrada]'),
            ]);
        }
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
            $currentRenovacion = $numeroRenovacion ?? ((int) ($poliza->numero_renovacion ?? 0));

            // ─── CASE A: Specific cartera_item_id provided (single-cuota payment) ───
            if ($carteraItemId) {
                $this->syncSingleCarteraItem($poliza, $carteraItemId, $currentRenovacion);
                return;
            }

            // ─── Determine effective renovacion (R=0 fallback for SS imports) ───
            $effectiveRenovacion = $currentRenovacion;
            if ($currentRenovacion > 0) {
                $countCurrent = DB::table('cartera_items')
                    ->where('broker_id', $brokerId)
                    ->where('poliza_id', $polizaId)
                    ->where('numero_renovacion', $currentRenovacion)
                    ->count();
                if ($countCurrent === 0) {
                    $countR0 = DB::table('cartera_items')
                        ->where('broker_id', $brokerId)
                        ->where('poliza_id', $polizaId)
                        ->where('numero_renovacion', 0)
                        ->count();
                    if ($countR0 > 0) {
                        $effectiveRenovacion = 0;
                    }
                }
            }

            // ─── Check if this poliza has multiple SS-imported cartera_items ───
            $ssItemCount = DB::table('cartera_items')
                ->where('broker_id', $brokerId)
                ->where('poliza_id', $polizaId)
                ->where('numero_renovacion', $effectiveRenovacion)
                ->whereNotNull('softseguros_pago_id')
                ->count();

            // ─── CASE B: Multiple SS-imported items (cuotas/anexos) ───
            // Each item has its own financial values from SoftSeguros.
            // We must NOT do a bulk update that mixes values across items.
            if ($ssItemCount > 1) {
                $this->syncMultiItemCartera($poliza, $effectiveRenovacion, $currentRenovacion);
                return;
            }

            // ─── CASE C: Single item or Guro-only poliza (original behavior) ───
            $this->syncSinglePolizaCartera($poliza, $effectiveRenovacion, $currentRenovacion);

        } catch (\Throwable $e) {
            Log::warning("syncCarteraItems failed for poliza {$polizaId}: " . $e->getMessage());
        }

        // Después de sincronizar items, refrescar polizas.payment_due_date
        // con la fecha de la próxima cuota pendiente. Esto mantiene en sync
        // el campo legacy que algunos reportes/UI todavía consultan.
        $this->refreshPolizaPaymentDueDate($polizaId);
    }

    /**
     * Actualiza polizas.payment_due_date con la fecha_limite_pago más temprana
     * de los cartera_items pendientes (no recaudados, no anulados, no anticipos).
     * Si no hay pendientes, deja el campo en null.
     */
    private function refreshPolizaPaymentDueDate(int $polizaId): void
    {
        try {
            $proxima = DB::table('cartera_items')
                ->where('poliza_id', $polizaId)
                ->where('recaudado_en_oficina', false)
                ->where('recaudado_aseguradora', false)
                ->where('recibo_pago_directo', false)
                ->where('es_anticipo', false)
                ->where('recibo_anulado', false)
                ->whereNotNull('fecha_limite_pago')
                ->min('fecha_limite_pago');

            $payload = ['payment_due_date' => $proxima];

            // Estado de pago derivado simple
            if ($proxima === null) {
                // No hay cuotas pendientes → marcar como pagado si existían items
                $tieneItems = DB::table('cartera_items')->where('poliza_id', $polizaId)->exists();
                if ($tieneItems) {
                    $payload['payment_status'] = 'paid';
                }
            } else {
                $payload['payment_status'] = strtotime($proxima) < strtotime(date('Y-m-d')) ? 'overdue' : 'pending';
            }

            DB::table('polizas')->where('id', $polizaId)->update($payload);
        } catch (\Throwable $e) {
            Log::warning("refreshPolizaPaymentDueDate failed for poliza {$polizaId}: " . $e->getMessage());
        }
    }

    /**
     * Sync a single specific cartera_item by ID.
     * Used when a payment is made against a specific cuota.
     */
    private function syncSingleCarteraItem(Poliza $poliza, int $carteraItemId, int $currentRenovacion): void
    {
        $brokerId = $poliza->broker_id;
        $polizaId = $poliza->id;

        $ci = DB::table('cartera_items')->where('id', $carteraItemId)->where('broker_id', $brokerId)->first();
        if (!$ci) return;

        // Use the cartera_item's own numero_renovacion for scoping pagos
        $itemRenovacion = (int) ($ci->numero_renovacion ?? $currentRenovacion);
        $pagoRenovaciones = array_unique([$itemRenovacion, $currentRenovacion, 0]);

        // Get pagos scoped to this specific cartera_item_id
        $pagosOficina = PagoPoliza::where('poliza_id', $polizaId)
            ->where('cartera_item_id', $carteraItemId)
            ->where('tipo_recaudo', 'oficina')
            ->get();
        $pagosAseguradora = PagoPoliza::where('poliza_id', $polizaId)
            ->where('cartera_item_id', $carteraItemId)
            ->where('tipo_recaudo', 'aseguradora')
            ->get();
        $cobrosComision = CobroComision::where('poliza_id', $polizaId)
            ->where('cartera_item_id', $carteraItemId)
            ->get();

        // If no pagos found scoped to this cartera_item, try broader scope ONLY for single-item polizas
        if ($pagosOficina->isEmpty() && $pagosAseguradora->isEmpty() && $cobrosComision->isEmpty()) {
            $multiSsItems = DB::table('cartera_items')
                ->where('broker_id', $brokerId)
                ->where('poliza_id', $polizaId)
                ->whereNotNull('softseguros_pago_id')
                ->count() > 1;

            // For multi-SS-item polizas, don't use broader scope — it would mix pagos across items
            if ($multiSsItems) {
                // No pagos for this specific item — preserve its SS-imported state
                $pagosOficina = collect();
                $pagosAseguradora = collect();
                $cobrosComision = collect();
            } else {
                // Single-item poliza: safe to use broader scope
                $pagosOficina = PagoPoliza::where('poliza_id', $polizaId)
                    ->whereIn('numero_renovacion', $pagoRenovaciones)
                    ->where('tipo_recaudo', 'oficina')
                    ->where(function ($q) { $q->where('monto_pagado', '>', 0)->orWhere('estado', '!=', 'pendiente'); })
                    ->get();
                $pagosAseguradora = PagoPoliza::where('poliza_id', $polizaId)
                    ->whereIn('numero_renovacion', $pagoRenovaciones)
                    ->where('tipo_recaudo', 'aseguradora')
                    ->where(function ($q) { $q->where('monto_pagado', '>', 0)->orWhere('estado', '!=', 'pendiente'); })
                    ->get();
                $cobrosComision = CobroComision::where('poliza_id', $polizaId)
                    ->whereIn('numero_renovacion', $pagoRenovaciones)
                    ->get();
            }
        }

        Log::info("syncSingleCarteraItem", [
            'ci_id' => $carteraItemId,
            'pagosOficina' => $pagosOficina->count(),
            'pagosAseguradora' => $pagosAseguradora->count(),
            'cobrosComision' => $cobrosComision->count(),
            'multiSsCheck' => $pagosOficina->isEmpty() && $pagosAseguradora->isEmpty() && $cobrosComision->isEmpty() ? 'empty_entering_fallback' : 'has_pagos',
        ]);

        $this->applyPaymentStateToItem($ci, $poliza, $pagosOficina, $pagosAseguradora, $cobrosComision);
    }

    /**
     * Sync cartera for a poliza with multiple SS-imported items (cuotas/anexos).
     * Each item is updated individually using its own prima_total_pago.
     * Pagos are matched to items via cartera_item_id when available.
     */
    private function syncMultiItemCartera(Poliza $poliza, int $effectiveRenovacion, int $currentRenovacion): void
    {
        $brokerId = $poliza->broker_id;
        $polizaId = $poliza->id;

        $pagoRenovaciones = array_unique([$currentRenovacion, $effectiveRenovacion, 0]);

        // Load ALL pagos for this poliza in the relevant renovation periods
        // Exclude ghost pagos (monto=0, pendiente) that were created by old sync logic
        $allPagosOficina = PagoPoliza::where('poliza_id', $polizaId)
            ->whereIn('numero_renovacion', $pagoRenovaciones)
            ->where('tipo_recaudo', 'oficina')
            ->where(function ($q) { $q->where('monto_pagado', '>', 0)->orWhere('estado', '!=', 'pendiente'); })
            ->get();
        $allPagosAseguradora = PagoPoliza::where('poliza_id', $polizaId)
            ->whereIn('numero_renovacion', $pagoRenovaciones)
            ->where('tipo_recaudo', 'aseguradora')
            ->where(function ($q) { $q->where('monto_pagado', '>', 0)->orWhere('estado', '!=', 'pendiente'); })
            ->get();
        $allCobrosComision = CobroComision::where('poliza_id', $polizaId)
            ->whereIn('numero_renovacion', $pagoRenovaciones)
            ->get();

        // Group pagos by cartera_item_id (null = unassigned)
        $pagosOfByItem = $allPagosOficina->groupBy('cartera_item_id');
        $pagosAsByItem = $allPagosAseguradora->groupBy('cartera_item_id');
        $cobrosByItem = $allCobrosComision->groupBy('cartera_item_id');

        // Get all cartera_items for this poliza + renovation
        $items = DB::table('cartera_items')
            ->where('broker_id', $brokerId)
            ->where('poliza_id', $polizaId)
            ->where('numero_renovacion', $effectiveRenovacion)
            ->get();

        foreach ($items as $ci) {
            $itemId = $ci->id;

            // Get pagos specifically assigned to this item
            $itemPagosOf = $pagosOfByItem->get($itemId, collect());
            $itemPagosAs = $pagosAsByItem->get($itemId, collect());
            $itemCobros = $cobrosByItem->get($itemId, collect());

            // If this is the ONLY item and there are unassigned pagos, assign them here
            // (shouldn't happen for multi-item, but safety net)

            $this->applyPaymentStateToItem($ci, $poliza, $itemPagosOf, $itemPagosAs, $itemCobros);
        }

        // Handle unassigned pagos: pagos without cartera_item_id (legacy)
        // For SS multi-item polizas, only assign to Guro-created items (no softseguros_pago_id)
        // to avoid corrupting SS-imported item states
        $unassignedPagosOf = $pagosOfByItem->get('', collect())->merge($pagosOfByItem->get(null, collect()))
            ->filter(fn($p) => (float) $p->monto_pagado > 0);
        $unassignedPagosAs = $pagosAsByItem->get('', collect())->merge($pagosAsByItem->get(null, collect()))
            ->filter(fn($p) => (float) $p->monto_pagado > 0);
        $unassignedCobros = $cobrosByItem->get('', collect())->merge($cobrosByItem->get(null, collect()));

        if ($unassignedPagosOf->isNotEmpty() || $unassignedPagosAs->isNotEmpty() || $unassignedCobros->isNotEmpty()) {
            // Only target Guro-created items (no softseguros_pago_id) to avoid corrupting SS data
            $targetItem = $items->first(fn($i) => !$i->softseguros_pago_id);
            if ($targetItem) {
                $existingOf = $pagosOfByItem->get($targetItem->id, collect());
                $existingAs = $pagosAsByItem->get($targetItem->id, collect());
                $existingCo = $cobrosByItem->get($targetItem->id, collect());

                $this->applyPaymentStateToItem(
                    $targetItem,
                    $poliza,
                    $existingOf->merge($unassignedPagosOf),
                    $existingAs->merge($unassignedPagosAs),
                    $existingCo->merge($unassignedCobros)
                );
            }
            // If no Guro-created item exists, ignore unassigned pagos — don't corrupt SS items
        }
    }

    /**
     * Sync cartera for a poliza with a single cartera_item or no SS items (Guro-only).
     * This preserves the original behavior for simple polizas.
     */
    private function syncSinglePolizaCartera(Poliza $poliza, int $effectiveRenovacion, int $currentRenovacion): void
    {
        $brokerId = $poliza->broker_id;
        $polizaId = $poliza->id;

        $carteraQuery = function () use ($brokerId, $polizaId, $effectiveRenovacion) {
            return DB::table('cartera_items')
                ->where('broker_id', $brokerId)
                ->where('poliza_id', $polizaId)
                ->where('numero_renovacion', $effectiveRenovacion);
        };

        $pagoRenovaciones = array_unique([$currentRenovacion, $effectiveRenovacion, 0]);

        $pagosOficina = PagoPoliza::where('poliza_id', $polizaId)
            ->whereIn('numero_renovacion', $pagoRenovaciones)
            ->where('tipo_recaudo', 'oficina')
            ->get();
        $pagosAseguradora = PagoPoliza::where('poliza_id', $polizaId)
            ->whereIn('numero_renovacion', $pagoRenovaciones)
            ->where('tipo_recaudo', 'aseguradora')
            ->get();
        $cobrosComision = CobroComision::where('poliza_id', $polizaId)
            ->whereIn('numero_renovacion', $pagoRenovaciones)
            ->get();

        $existingCount = $carteraQuery()->count();

        if ($existingCount > 0) {
            $ci = $carteraQuery()->first();
            $this->applyPaymentStateToItem($ci, $poliza, $pagosOficina, $pagosAseguradora, $cobrosComision);
        } else {
            // CREATE a new cartera_item (poliza has no imported items from Excel)
            $totalRecaudadoOficina = (float) $pagosOficina->sum('monto_pagado');
            $totalPagadoAseguradora = (float) $pagosAseguradora->where('estado', 'pagado')->sum('monto_pagado');
            $totalComisionCobrada = (float) $cobrosComision->sum('monto_cobrado');
            $recaudadoAseguradora = $totalPagadoAseguradora > 0;
            $comisionada = $totalComisionCobrada > 0;

            $cliente = $poliza->client;
            $clienteNombre = $cliente ? trim(($cliente->first_name ?? '') . ' ' . ($cliente->last_name ?? '')) : null;
            $montoTotalPoliza = ((float)($poliza->total_amount ?? 0) > 0 ? (float)$poliza->total_amount : ((float)($poliza->premium_amount ?? 0) + (float)($poliza->vat_amount ?? 0)));
            $comisionPoliza = $poliza->commission_amount ?? 0;

            // Determine if office collection is complete or partial
            $saldoPendienteOf = max(0, $montoTotalPoliza - $totalRecaudadoOficina);
            $recaudadoEnOficina = $totalRecaudadoOficina > 0 && $saldoPendienteOf <= 0;
            $recaudoParcialOficina = $totalRecaudadoOficina > 0 && $saldoPendienteOf > 0;

            $nuevoEstado = 'por_cobrar';
            if ($recaudadoAseguradora && $comisionada) $nuevoEstado = 'comision_recibida';
            elseif ($recaudadoAseguradora) $nuevoEstado = 'comision_por_cobrar';
            elseif ($recaudadoEnOficina) $nuevoEstado = 'por_pagar';

            $fechaRecOf = ($recaudadoEnOficina || $recaudoParcialOficina) ? ($pagosOficina->sortByDesc('fecha_pago')->first()->fecha_pago ?? null) : null;
            $fechaPagoAs = $recaudadoAseguradora ? ($pagosAseguradora->where('estado', 'pagado')->sortByDesc('fecha_pago')->first()->fecha_pago ?? null) : null;
            $fechaCom = $comisionada ? ($cobrosComision->sortByDesc('updated_at')->first()->updated_at?->format('Y-m-d') ?? null) : null;

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
                'prima_neta' => $poliza->premium_amount ?? 0,
                'valor_neto_a_pagar' => max(0, $montoTotalPoliza - $comisionPoliza),
                'prima_total_pago' => $montoTotalPoliza,
                'prima_total' => $montoTotalPoliza,
                'comision_a_recibir' => $comisionPoliza,
                'comision_vendedor' => 0,
                'estado_cartera' => $nuevoEstado,
                'recaudado_en_oficina' => $recaudadoEnOficina,
                'recaudo_parcial_oficina' => $recaudoParcialOficina,
                'recaudado_aseguradora' => $recaudadoAseguradora,
                'comisionada' => $comisionada,
                'valor_recaudado_oficina' => $totalRecaudadoOficina,
                'valor_pagado_aseguradora' => $totalPagadoAseguradora,
                'saldo_pendiente_oficina' => $saldoPendienteOf,
                'saldo_pendiente_aseguradora' => $recaudadoEnOficina
                    ? max(0, $montoTotalPoliza - $comisionPoliza - $totalPagadoAseguradora)
                    : 0,
                'comision_recibida' => $totalComisionCobrada,
                'dias_vencidos' => 0,
                'fecha_recaudado_oficina' => $fechaRecOf,
                'fecha_pago_aseguradora' => $fechaPagoAs,
                'fecha_comisionada' => $fechaCom,
                'fecha_inicio_vigencia' => $poliza->start_date ?? null,
                'fecha_fin_vigencia' => $poliza->end_date ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Apply payment state to a single cartera_item based on its associated pagos.
     * Uses the item's own prima_total_pago (cuota amount), NOT the poliza total.
     * This is the core function that correctly handles both single-item and multi-item polizas.
     */
    private function applyPaymentStateToItem(
        object $ci,
        Poliza $poliza,
        $pagosOficina,
        $pagosAseguradora,
        $cobrosComision
    ): void {
        $totalRecaudadoOficina = (float) $pagosOficina->sum('monto_pagado');

        $totalPagadoAseguradora = (float) $pagosAseguradora->where('estado', 'pagado')->sum('monto_pagado');
        $recaudadoAseguradora = $totalPagadoAseguradora > 0;

        $totalComisionCobrada = (float) $cobrosComision->sum('monto_cobrado');
        $comisionada = $totalComisionCobrada > 0;

        $hasPagosGuro = $pagosOficina->isNotEmpty() || $pagosAseguradora->isNotEmpty() || $cobrosComision->isNotEmpty();

        if (!$hasPagosGuro) {
            // No Guro pagos for this item.
            // If this is a SS-imported item, preserve its original imported state.
            // If it's a Guro-only item (or was previously modified by Guro), reset to por_cobrar.
            $wasModifiedByGuro = in_array($ci->estado_cartera, ['por_pagar', 'comision_por_cobrar', 'comision_recibida'])
                && !$ci->softseguros_pago_id;
            $hasGuroFlags = $ci->recaudado_en_oficina || $ci->recaudo_parcial_oficina
                || $ci->recaudado_aseguradora || $ci->comisionada
                || ((float)($ci->valor_recaudado_oficina ?? 0) > 0);

            if ($wasModifiedByGuro || $hasGuroFlags) {
                // Delete any split sibling items (from partial recaudo)
                DB::table('cartera_items')->where('split_from_id', $ci->id)->delete();

                // If this item IS a split sibling, just delete it — the parent will be reset
                if ($ci->split_from_id) {
                    DB::table('cartera_items')->where('id', $ci->id)->delete();
                    return;
                }

                // Restore original prima_total_pago if it was modified by a partial split
                $originalTotal = (float) ($ci->prima_total_pago ?? 0);
                if ($ci->recaudo_parcial_oficina) {
                    // Recover full amount from poliza
                    $originalTotal = ((float)($poliza->total_amount ?? 0) > 0)
                        ? (float) $poliza->total_amount
                        : ((float)($poliza->premium_amount ?? 0) + (float)($poliza->vat_amount ?? 0));
                }

                // Reset to por_cobrar — all pagos were reverted
                DB::table('cartera_items')->where('id', $ci->id)->update([
                    'estado_cartera' => 'por_cobrar',
                    'recaudado_en_oficina' => false,
                    'recaudo_parcial_oficina' => false,
                    'recaudado_aseguradora' => false,
                    'comisionada' => false,
                    'valor_recaudado_oficina' => 0,
                    'valor_pagado_aseguradora' => 0,
                    'comision_recibida' => 0,
                    'prima_total_pago' => $originalTotal,
                    'prima_total' => $originalTotal,
                    'prima_neta' => $poliza->premium_amount ?? 0,
                    'valor_neto_a_pagar' => max(0, $originalTotal - (float)($poliza->commission_amount ?? 0)),
                    'comision_a_recibir' => $poliza->commission_amount ?? 0,
                    'saldo_pendiente_oficina' => $originalTotal,
                    'saldo_pendiente_aseguradora' => 0,
                    'fecha_recaudado_oficina' => null,
                    'fecha_pago_aseguradora' => null,
                    'fecha_comisionada' => null,
                    'updated_at' => now(),
                ]);
            }
            return;
        }

        // Use the ITEM's own prima_total_pago (cuota-specific), not the poliza total
        $ciTotal = (float) ($ci->prima_total_pago ?? 0);
        $montoTotalCuota = $ciTotal ?: (((float)($poliza->total_amount ?? 0) > 0 ? (float)$poliza->total_amount : ((float)($poliza->premium_amount ?? 0) + (float)($poliza->vat_amount ?? 0))));
        $comisionPoliza = (float) ($poliza->commission_amount ?? 0);
        $valorNetoAPagar = (float) ($ci->valor_neto_a_pagar ?? 0);

        if ($valorNetoAPagar <= 0) {
            $valorNetoAPagar = max(0, $montoTotalCuota - $comisionPoliza);
        }

        // Determine if office collection is COMPLETE (not just partial)
        $saldoPendienteOficina = max(0, $montoTotalCuota - $totalRecaudadoOficina);
        $recaudadoEnOficina = $totalRecaudadoOficina > 0 && $saldoPendienteOficina <= 0;
        $recaudoParcialOficina = $totalRecaudadoOficina > 0 && $saldoPendienteOficina > 0;

        // ─── PARTIAL OFFICE RECAUDO: Split into 2 cartera_items ───
        // Recaudado portion → por_pagar (ready to transfer to insurer)
        // Pendiente portion → por_cobrar (still owed by client)
        if ($recaudoParcialOficina && !$recaudadoAseguradora && !$comisionada) {
            $comisionProporcional = $montoTotalCuota > 0
                ? round($comisionPoliza * ($totalRecaudadoOficina / $montoTotalCuota), 2)
                : 0;
            $comisionPendiente = $comisionPoliza - $comisionProporcional;
            $netoRecaudado = max(0, $totalRecaudadoOficina - $comisionProporcional);
            $netoPendiente = max(0, $saldoPendienteOficina - $comisionPendiente);

            $fechaRecOf = $pagosOficina->sortByDesc('fecha_pago')->first()->fecha_pago ?? null;

            // Update original item → por_pagar (the recaudado portion)
            DB::table('cartera_items')->where('id', $ci->id)->update([
                'estado_cartera' => 'por_pagar',
                'recaudado_en_oficina' => true,
                'recaudo_parcial_oficina' => true,
                'recaudado_aseguradora' => false,
                'comisionada' => false,
                'prima_total_pago' => $totalRecaudadoOficina,
                'prima_total' => $totalRecaudadoOficina,
                'prima_neta' => round(($poliza->premium_amount ?? 0) * ($totalRecaudadoOficina / $montoTotalCuota), 2),
                'valor_neto_a_pagar' => $netoRecaudado,
                'comision_a_recibir' => $comisionProporcional,
                'valor_recaudado_oficina' => $totalRecaudadoOficina,
                'saldo_pendiente_oficina' => 0,
                'saldo_pendiente_aseguradora' => $netoRecaudado,
                'valor_pagado_aseguradora' => 0,
                'comision_recibida' => 0,
                'fecha_recaudado_oficina' => $fechaRecOf,
                'updated_at' => now(),
            ]);

            // Create or update the pendiente sibling item → por_cobrar
            $existingSibling = DB::table('cartera_items')
                ->where('split_from_id', $ci->id)
                ->first();

            $siblingData = [
                'estado_cartera' => 'por_cobrar',
                'recaudado_en_oficina' => false,
                'recaudo_parcial_oficina' => false,
                'recaudado_aseguradora' => false,
                'comisionada' => false,
                'prima_total_pago' => $saldoPendienteOficina,
                'prima_total' => $saldoPendienteOficina,
                'prima_neta' => round(($poliza->premium_amount ?? 0) * ($saldoPendienteOficina / $montoTotalCuota), 2),
                'valor_neto_a_pagar' => $netoPendiente,
                'comision_a_recibir' => $comisionPendiente,
                'valor_recaudado_oficina' => 0,
                'saldo_pendiente_oficina' => $saldoPendienteOficina,
                'saldo_pendiente_aseguradora' => 0,
                'valor_pagado_aseguradora' => 0,
                'comision_recibida' => 0,
                'fecha_recaudado_oficina' => null,
                'fecha_pago_aseguradora' => null,
                'fecha_comisionada' => null,
                'updated_at' => now(),
            ];

            if ($existingSibling) {
                DB::table('cartera_items')->where('id', $existingSibling->id)->update($siblingData);
            } else {
                // Clone metadata from parent + insert
                $siblingData = array_merge($siblingData, [
                    'broker_id' => $ci->broker_id,
                    'poliza_id' => $ci->poliza_id,
                    'numero_renovacion' => $ci->numero_renovacion,
                    'cliente_id' => $ci->cliente_id,
                    'poliza_numero' => $ci->poliza_numero,
                    'cliente_nombre' => $ci->cliente_nombre,
                    'cliente_documento' => $ci->cliente_documento,
                    'aseguradora_nombre' => $ci->aseguradora_nombre,
                    'ramo_principal' => $ci->ramo_principal,
                    'vendedor_nombre' => $ci->vendedor_nombre,
                    'forma_pago' => $ci->forma_pago,
                    'fecha_inicio_vigencia' => $ci->fecha_inicio_vigencia,
                    'fecha_fin_vigencia' => $ci->fecha_fin_vigencia,
                    'comision_vendedor' => 0,
                    'dias_vencidos' => 0,
                    'split_from_id' => $ci->id,
                    'created_at' => now(),
                ]);
                DB::table('cartera_items')->insert($siblingData);
            }

            return;
        }

        // ─── NON-PARTIAL: Standard state update ───
        // Split siblings are independent items with their own lifecycle.
        // They are only deleted on REVERT (no-pagos path above), not on state progression.

        $nuevoEstado = 'por_cobrar';
        if ($recaudadoAseguradora && $comisionada) $nuevoEstado = 'comision_recibida';
        elseif ($recaudadoAseguradora) $nuevoEstado = 'comision_por_cobrar';
        elseif ($recaudadoEnOficina) $nuevoEstado = 'por_pagar';

        // Date fields
        $fechaRecOf = ($recaudadoEnOficina || $totalRecaudadoOficina > 0) ? ($pagosOficina->sortByDesc('fecha_pago')->first()->fecha_pago ?? null) : null;
        $fechaPagoAs = $recaudadoAseguradora ? ($pagosAseguradora->where('estado', 'pagado')->sortByDesc('fecha_pago')->first()->fecha_pago ?? null) : null;
        $fechaCom = $comisionada ? ($cobrosComision->sortByDesc('updated_at')->first()->updated_at?->format('Y-m-d') ?? null) : null;

        $updateData = [
            'estado_cartera' => $nuevoEstado,
            'recaudado_en_oficina' => $recaudadoEnOficina,
            'recaudo_parcial_oficina' => false,
            'recaudado_aseguradora' => $recaudadoAseguradora,
            'comisionada' => $comisionada,
            'valor_pagado_aseguradora' => $totalPagadoAseguradora,
            'comision_recibida' => $totalComisionCobrada,
            'fecha_pago_aseguradora' => $fechaPagoAs,
            'fecha_comisionada' => $fechaCom,
            'updated_at' => now(),
        ];

        if ((float) ($ci->valor_neto_a_pagar ?? 0) <= 0) {
            $updateData['valor_neto_a_pagar'] = $valorNetoAPagar;
        }
        if ((float) ($ci->comision_a_recibir ?? 0) <= 0 && $comisionPoliza > 0) {
            $updateData['comision_a_recibir'] = $comisionPoliza;
        }

        if ($recaudadoEnOficina) {
            $updateData['saldo_pendiente_aseguradora'] = max(0, $valorNetoAPagar - $totalPagadoAseguradora);
        } elseif ($recaudadoAseguradora) {
            $updateData['saldo_pendiente_aseguradora'] = 0;
        }

        if ($pagosOficina->isNotEmpty()) {
            $updateData['valor_recaudado_oficina'] = $totalRecaudadoOficina;
            $updateData['fecha_recaudado_oficina'] = $fechaRecOf;
            $updateData['saldo_pendiente_oficina'] = max(0, $montoTotalCuota - $totalRecaudadoOficina);
        } elseif ($recaudadoAseguradora) {
            $updateData['valor_recaudado_oficina'] = $montoTotalCuota;
            $updateData['saldo_pendiente_oficina'] = 0;
        }

        DB::table('cartera_items')->where('id', $ci->id)->update($updateData);
    }

    /**
     * Bulk action on cartera_items (SoftSeguros-style).
     * Actions: recaudar_oficina, recaudar_aseguradora, comisionar
     */
    public function accionMasivaCartera(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'accion' => 'required|in:recaudar_oficina,recaudar_aseguradora,comisionar',
            'item_ids' => 'required|array|min:1',
            'item_ids.*' => 'integer',
            'fecha' => 'nullable|date',
            'observaciones' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            DB::beginTransaction();

            $accion = $request->accion;
            $ids = $request->item_ids;
            $fecha = $request->fecha ?? now()->toDateString();
            $obs = $request->observaciones;
            $exitosos = 0;
            $errores = [];

            foreach ($ids as $itemId) {
                try {
                    $ci = DB::table('cartera_items')->where('id', $itemId)->first();
                    if (!$ci) {
                        $errores[] = ['id' => $itemId, 'error' => 'Item no encontrado'];
                        continue;
                    }

                    $updateData = ['updated_at' => now()];

                    switch ($accion) {
                        case 'recaudar_oficina':
                            if ($ci->recaudado_en_oficina) {
                                $errores[] = ['id' => $itemId, 'error' => 'Ya recaudado en oficina'];
                                continue 2;
                            }
                            $updateData['recaudado_en_oficina'] = true;
                            $updateData['fecha_recaudado_oficina'] = $fecha;
                            $updateData['valor_recaudado_oficina'] = (float) $ci->prima_total_pago;
                            $updateData['saldo_pendiente_oficina'] = 0;
                            $updateData['saldo_pendiente_aseguradora'] = (float) $ci->valor_neto_a_pagar;
                            $updateData['estado_cartera'] = 'por_pagar';
                            if ($obs) $updateData['observaciones_pago'] = $obs;
                            break;

                        case 'recaudar_aseguradora':
                            if ($ci->recaudado_aseguradora) {
                                $errores[] = ['id' => $itemId, 'error' => 'Ya recaudado por aseguradora'];
                                continue 2;
                            }
                            $updateData['recaudado_aseguradora'] = true;
                            $updateData['recaudado_en_oficina'] = true; // ensure oficina is also marked
                            $updateData['fecha_pago_aseguradora'] = $fecha;
                            $updateData['valor_pagado_aseguradora'] = (float) $ci->valor_neto_a_pagar;
                            $updateData['saldo_pendiente_aseguradora'] = 0;
                            $updateData['estado_cartera'] = 'comision_por_cobrar';
                            if ($obs) $updateData['observaciones_pago'] = $obs;
                            break;

                        case 'comisionar':
                            if ($ci->comisionada) {
                                $errores[] = ['id' => $itemId, 'error' => 'Ya comisionado'];
                                continue 2;
                            }
                            $updateData['comisionada'] = true;
                            $updateData['recaudado_aseguradora'] = true;
                            $updateData['recaudado_en_oficina'] = true;
                            $updateData['fecha_comisionada'] = $fecha;
                            $updateData['comision_recibida'] = (float) $ci->comision_a_recibir;
                            $updateData['estado_cartera'] = 'comision_recibida';
                            if ($obs) $updateData['observaciones_pago'] = $obs;
                            break;
                    }

                    DB::table('cartera_items')->where('id', $itemId)->update($updateData);
                    $exitosos++;
                } catch (\Throwable $e) {
                    $errores[] = ['id' => $itemId, 'error' => $e->getMessage()];
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Acción '{$accion}' completada: {$exitosos} exitosos, " . count($errores) . " errores",
                'data' => ['exitosos' => $exitosos, 'errores' => $errores],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Void a cartera_item (mark as anulado)
     */
    public function anularCarteraItem(Request $request, int $itemId)
    {
        try {
            $ci = DB::table('cartera_items')->where('id', $itemId)->first();
            if (!$ci) return response()->json(['success' => false, 'message' => 'Item no encontrado'], 404);

            DB::table('cartera_items')->where('id', $itemId)->update([
                'recibo_anulado' => true,
                'fecha_anulado' => now(),
                'updated_at' => now(),
            ]);

            return response()->json(['success' => true, 'message' => 'Item anulado']);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Reactivate a voided cartera_item
     */
    public function reactivarCarteraItem(Request $request, int $itemId)
    {
        try {
            $ci = DB::table('cartera_items')->where('id', $itemId)->first();
            if (!$ci) return response()->json(['success' => false, 'message' => 'Item no encontrado'], 404);

            DB::table('cartera_items')->where('id', $itemId)->update([
                'recibo_anulado' => false,
                'fecha_anulado' => null,
                'updated_at' => now(),
            ]);

            return response()->json(['success' => true, 'message' => 'Item reactivado']);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
}