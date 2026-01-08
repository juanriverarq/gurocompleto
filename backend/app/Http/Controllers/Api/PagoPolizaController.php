<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PagoPoliza;
use App\Models\CobroComision;
use App\Models\Poliza;
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
            $pago = null;

            // Para recaudo de oficina, crear SIEMPRE un registro individual por cada abono
            if ($request->tipo_recaudo === 'oficina') {
                // Calcular el total de la póliza y lo ya recaudado
                $montoTotalPoliza = $poliza->total_amount ?? ($poliza->premium_amount + ($poliza->vat_amount ?? 0));
                
                // Sumar todos los pagos anteriores de oficina para esta póliza
                $totalRecaudadoAnterior = (float) PagoPoliza::where('poliza_id', $polizaId)
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
                $primaNeta = $poliza->premium_amount ?? 0;
                
                // Verificar si ya existe un pago a aseguradora pagado para esta póliza
                $pagoAseguradoraExistente = PagoPoliza::where('poliza_id', $polizaId)
                    ->where('tipo_recaudo', 'aseguradora')
                    ->where('estado', 'pagado')
                    ->first();
                
                if (!$pagoAseguradoraExistente) {
                    // Eliminar cualquier pago pendiente a aseguradora que pudiera existir
                    PagoPoliza::where('poliza_id', $polizaId)
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

            // Eliminar cobros de comisión
            CobroComision::where('poliza_id', $polizaId)->delete();

            // Eliminar TODOS los pagos (oficina y aseguradora)
            PagoPoliza::where('poliza_id', $polizaId)->delete();

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

            // Buscar la póliza por número exacto primero
            $poliza = Poliza::where('broker_id', $brokerId)
                ->where('policy_number', $numeroPoliza)
                ->where('status', 'active')
                ->first();

            $matchType = 'exacto';

            // Si no se encuentra, buscar por últimos 5 dígitos
            if (!$poliza && strlen($numeroPoliza) >= 5) {
                $ultimos5 = substr($numeroPoliza, -5);
                $polizasPosibles = Poliza::where('broker_id', $brokerId)
                    ->where('status', 'active')
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

            $pagosEliminados = PagoPoliza::where('recaudo_import_id', $import->id)->delete();

            if (!empty($import->pago_ids)) {
                PagoPoliza::whereIn('id', $import->pago_ids)
                    ->where('broker_id', $brokerId)
                    ->delete();
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
            $pago->delete();

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
}