<?php

namespace App\Console\Commands;

use App\Models\CobroComision;
use App\Models\PagoPoliza;
use App\Models\Poliza;
use App\Models\ReciboCaja;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * SyncRecibosToCartera
 *
 * Cierra el gap entre recibos_caja (importados de SoftSeguros) y pagos_polizas
 * (tabla que usa el módulo de cartera de Guro).
 *
 * CONTEXTO DEL PROBLEMA:
 * ─────────────────────
 * SoftSeguros usa UN SOLO modelo "PagoPoliza" que funciona como recibo, recaudo,
 * comisión y liquidación en un solo registro. Cada cuota es un registro que va
 * evolucionando con flags: recaudado_en_oficina → recaudado → comisionada → pagada_vendedor.
 *
 * Guro separó esto en 3 tablas:
 *   - pagos_polizas  → estado de recaudo (oficina + aseguradora)
 *   - cobros_comisiones → comisiones cobradas a aseguradoras
 *   - recibos_caja → espejo del PagoPoliza de SoftSeguros (datos importados)
 *
 * El problema es que al importar de SS, los datos solo llegan a recibos_caja,
 * pero la cartera de Guro lee exclusivamente de pagos_polizas y cobros_comisiones.
 * Resultado: pólizas que en SS están pagadas aparecen como "Por Cobrar" en Guro.
 *
 * LÓGICA DE CONVERSIÓN:
 * ─────────────────────
 * Por cada póliza que tiene recibos importados de SS, se agrupan los recibos y
 * se genera la fotografía de pagos equivalente en pagos_polizas:
 *
 * 1. RECAUDO OFICINA:
 *    Si el recibo tiene recaudado_en_oficina=true Y valor_recaudado_en_oficina > 0:
 *    → Crear PagoPoliza(tipo_recaudo='oficina', monto_pagado=valor_recaudado_en_oficina)
 *    
 *    Si el recibo tiene saldo_pendiente_oficina > 0 y recaudo_parcial_oficina=true:
 *    → estado='parcial' en vez de 'pagado'
 *
 * 2. RECAUDO ASEGURADORA:
 *    Si el recibo tiene recaudado=true (flag global de "todo recaudado"):
 *    → Crear PagoPoliza(tipo_recaudo='aseguradora', estado='pagado')
 *    
 *    Si recibo_pago_directo=true:
 *    → PagoPoliza(tipo_recaudo='aseguradora', estado='pagado', obs='Pago directo')
 *
 * 3. COMISIÓN:
 *    Si el recibo tiene comisionada=true Y comision_a_recibir > 0:
 *    → Crear CobroComision(estado='cobrado', monto_cobrado=comision_a_recibir)
 *
 * 4. SKIP:
 *    - es_anticipo=true → anticipos no generan pagos de cartera
 *    - recibo_anulado=true → recibos anulados no cuentan
 *    - activo=false → inactivos no cuentan
 *    - poliza_id IS NULL → sin póliza vinculada, no se puede crear pago
 *
 * DEDUPLICACIÓN:
 * ──────────────
 * Usa recibo_caja_id en pagos_polizas y cobros_comisiones para evitar duplicados.
 * Si un pago con ese recibo_caja_id ya existe, se salta.
 *
 * MODO DRY-RUN:
 * ─────────────
 * Por defecto ejecuta en modo dry-run para previsualizar sin escribir.
 * Usar --execute para aplicar cambios reales.
 */
class SyncRecibosToCartera extends Command
{
    protected $signature = 'cartera:sync-recibos
        {--broker= : ID del broker (obligatorio)}
        {--execute : Ejecutar cambios reales (sin esto es dry-run)}
        {--poliza= : Sincronizar solo una póliza específica por ID}
        {--reset : Eliminar pagos_polizas y cobros_comisiones generados por SS antes de sincronizar}
        {--verbose-log : Mostrar detalle de cada recibo procesado}';

    protected $description = 'Sincroniza recibos_caja importados de SoftSeguros hacia pagos_polizas y cobros_comisiones para que la cartera refleje los pagos reales';

    private int $pagosCreados = 0;
    private int $comisionesCreadas = 0;
    private int $recibosSkipped = 0;
    private int $recibosProcessed = 0;
    private int $polizasSynced = 0;
    private array $errors = [];

    public function handle(): int
    {
        $brokerId = $this->option('broker');
        if (!$brokerId) {
            $this->error('Debe especificar --broker=ID');
            return 1;
        }

        $isDryRun = !$this->option('execute');
        $polizaId = $this->option('poliza');
        $reset = $this->option('reset');
        $verboseLog = $this->option('verbose-log');

        $this->info('');
        $this->info('╔══════════════════════════════════════════════════════════╗');
        $this->info('║   SYNC RECIBOS → CARTERA (SoftSeguros → pagos_polizas) ║');
        $this->info('╚══════════════════════════════════════════════════════════╝');
        $this->info('');
        $this->info("  Broker ID:  {$brokerId}");
        $this->info("  Modo:       " . ($isDryRun ? '🔍 DRY-RUN (preview)' : '⚡ EJECUTAR (cambios reales)'));
        if ($polizaId) $this->info("  Póliza:     #{$polizaId}");
        if ($reset) $this->info("  Reset:      ⚠️  Eliminará pagos/comisiones previos de SS");
        $this->info('');

        // Paso 0: Reset si se pidió
        if ($reset && !$isDryRun) {
            $this->resetSyncedData($brokerId, $polizaId);
        }

        // Paso 1: Obtener recibos elegibles
        $query = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->where('source', 'softseguros')
            ->whereNotNull('poliza_id')
            ->where('activo', true)
            ->where('recibo_anulado', false)
            ->where('es_anticipo', false);

        if ($polizaId) {
            $query->where('poliza_id', $polizaId);
        }

        $totalRecibos = $query->count();
        $this->info("  Recibos SS elegibles: {$totalRecibos}");

        if ($totalRecibos === 0) {
            $this->warn('  No hay recibos elegibles para sincronizar.');
            return 0;
        }

        // Paso 2: Contar pólizas únicas
        $polizaCount = (clone $query)->distinct('poliza_id')->count('poliza_id');
        $this->info("  Pólizas a procesar:   {$polizaCount}");
        $this->info('');

        // Precargar IDs de pagos/comisiones existentes (solo IDs, bajo uso de memoria)
        $existingPagosByCaja = DB::table('pagos_polizas')
            ->where('broker_id', $brokerId)
            ->whereNotNull('recibo_caja_id')
            ->pluck('recibo_caja_id')
            ->flip()
            ->toArray();

        $existingComisionesByCaja = DB::table('cobros_comisiones')
            ->where('broker_id', $brokerId)
            ->whereNotNull('recibo_caja_id')
            ->pluck('recibo_caja_id')
            ->flip()
            ->toArray();

        $this->info("  Pagos ya sincronizados:     " . count($existingPagosByCaja));
        $this->info("  Comisiones ya sincronizadas: " . count($existingComisionesByCaja));
        $this->info('');

        $bar = $this->output->createProgressBar($polizaCount);
        $bar->setFormat(' %current%/%max% [%bar%] %percent:3s%% -- %message%');
        $bar->setMessage('Iniciando...');

        // Paso 3: Procesar en chunks por poliza_id (bajo uso de memoria)
        $polizaIdsQuery = (clone $query)->select('poliza_id')->distinct();

        // Procesar en lotes de 200 póliza IDs
        $polizaIdsQuery->orderBy('poliza_id')->chunk(200, function ($chunk) use (
            $brokerId, $isDryRun, $verboseLog, &$existingPagosByCaja, &$existingComisionesByCaja, $bar
        ) {
            $pIds = $chunk->pluck('poliza_id')->unique()->toArray();

            // Cargar pólizas de este lote
            $polizasMap = Poliza::withoutGlobalScopes()
                ->whereIn('id', $pIds)
                ->get(['id', 'policy_number', 'broker_id', 'client_id', 'aseguradora_id',
                    'premium_amount', 'total_amount', 'vat_amount', 'commission_amount',
                    'commission_percentage'])
                ->keyBy('id');

            // Cargar recibos de este lote
            $recibos = ReciboCaja::withoutGlobalScopes()
                ->where('broker_id', $brokerId)
                ->whereIn('poliza_id', $pIds)
                ->where('source', 'softseguros')
                ->where('activo', true)
                ->where('recibo_anulado', false)
                ->where('es_anticipo', false)
                ->orderBy('poliza_id')
                ->orderBy('fecha_pago', 'asc')
                ->orderBy('numero_pago', 'asc')
                ->get();

            // Agrupar recibos por poliza_id
            $recibosByPoliza = $recibos->groupBy('poliza_id');

            foreach ($pIds as $pId) {
                $poliza = $polizasMap[$pId] ?? null;
                if (!$poliza) {
                    $bar->advance();
                    continue;
                }

                $bar->setMessage("Póliza #{$poliza->policy_number}");

                $polizaRecibos = $recibosByPoliza[$pId] ?? collect();
                $polizaSynced = false;

                foreach ($polizaRecibos as $recibo) {
                    $this->recibosProcessed++;

                    // Skip si ya fue sincronizado
                    if (isset($existingPagosByCaja[$recibo->id])) {
                        $this->recibosSkipped++;
                        if ($verboseLog) {
                            $this->line("    ⏭  Recibo #{$recibo->id} ya sincronizado (skip)");
                        }
                        continue;
                    }

                    $result = $this->processRecibo($recibo, $poliza, $isDryRun, $verboseLog, $existingComisionesByCaja);
                    if ($result) $polizaSynced = true;
                }

                if ($polizaSynced) $this->polizasSynced++;
                $bar->advance();
            }

            // Liberar memoria del lote
            unset($polizasMap, $recibos, $recibosByPoliza);
        });

        $bar->setMessage('¡Completado!');
        $bar->finish();
        $this->info('');
        $this->info('');

        // Resumen
        $this->info('╔══════════════════════════════════════════╗');
        $this->info('║              RESUMEN                     ║');
        $this->info('╚══════════════════════════════════════════╝');
        $this->table(
            ['Métrica', 'Valor'],
            [
                ['Recibos procesados', $this->recibosProcessed],
                ['Recibos skipped (ya sincronizados)', $this->recibosSkipped],
                ['Pagos creados en pagos_polizas', $this->pagosCreados],
                ['Comisiones creadas en cobros_comisiones', $this->comisionesCreadas],
                ['Pólizas afectadas', $this->polizasSynced],
                ['Errores', count($this->errors)],
            ]
        );

        if (!empty($this->errors)) {
            $this->warn('');
            $this->warn('Errores encontrados:');
            foreach (array_slice($this->errors, 0, 30) as $err) {
                $this->line("  ⚠ {$err}");
            }
            if (count($this->errors) > 30) {
                $this->line("  ... y " . (count($this->errors) - 30) . " errores más");
            }
        }

        if ($isDryRun) {
            $this->info('');
            $this->warn('══════════════════════════════════════════════════════');
            $this->warn('  DRY-RUN: No se realizaron cambios.');
            $this->warn('  Para aplicar, ejecute con --execute');
            $this->warn('══════════════════════════════════════════════════════');
        }

        return 0;
    }

    /**
     * Procesa un recibo individual y genera los pagos_polizas + cobros_comisiones correspondientes.
     *
     * MAPEO DE FLAGS SOFTSEGUROS → GURO:
     *
     * En SoftSeguros, un "PagoPoliza" (que nosotros importamos como ReciboCaja) representa
     * una cuota de la póliza. El ciclo de vida de esa cuota es:
     *
     *   1. Se crea la cuota → valor_a_pagar, fecha_pago
     *   2. Cliente paga en oficina → recaudado_en_oficina=true, valor_recaudado_en_oficina
     *   3. Se registra recaudo a aseguradora → recaudado=true, tipo_recaudo, fecha_realizo_pago
     *   4. Se comisiona → comisionada=true, comision_a_recibir, fecha_recibio_comision
     *
     * Dependiendo de en qué fase está cada recibo, generamos diferentes registros en Guro:
     */
    private function processRecibo(ReciboCaja $recibo, Poliza $poliza, bool $isDryRun, bool $verboseLog, array &$existingComisionesByCaja): bool
    {
        $created = false;

        try {
            // ──────────────────────────────────────────────────────────
            // PASO A: DETERMINAR SI HAY RECAUDO DE OFICINA
            // ──────────────────────────────────────────────────────────
            //
            // En SoftSeguros, cuando el cliente paga en la oficina del broker:
            //   - recaudado_en_oficina = true
            //   - valor_recaudado_en_oficina = monto que pagó el cliente
            //   - fecha_realizo_pago_oficina = cuándo pagó
            //
            // También puede haber pagos directos donde el cliente paga a la aseguradora:
            //   - recibo_pago_directo = true → NO pasó por oficina
            //   - tipo_recaudo = 'directo' o 'aseguradora'
            //
            // Para la cartera de Guro necesitamos:
            //   - PagoPoliza(tipo_recaudo='oficina') si hubo recaudo en oficina
            //   - El monto es valor_recaudado_en_oficina (no valor_a_pagar)

            $montoOficina = (float) ($recibo->valor_recaudado_en_oficina ?? 0);
            $recaudadoEnOficina = (bool) $recibo->recaudado_en_oficina;
            $esPagoDirecto = (bool) $recibo->recibo_pago_directo;
            $recaudoTotal = (bool) $recibo->recaudado; // flag global "todo recaudado"

            // Determinar monto total de la póliza para cálculos de estado
            $totalPoliza = (float) ($poliza->total_amount ?? ($poliza->premium_amount + ($poliza->vat_amount ?? 0)));
            $primaNeta = (float) ($poliza->premium_amount ?? 0);

            if ($recaudadoEnOficina && $montoOficina > 0 && !$esPagoDirecto) {
                // Cliente pagó en oficina — crear pago de tipo oficina
                //
                // IMPORTANTE: Cada PagoPoliza representa UNA cuota/recibo individual,
                // NO el total de la póliza. La cartera calcula el estado usando:
                //   SUM(monto_pagado) de todos los pagos vs poliza.total_amount
                // Por eso monto_total = monto_pagado = valor de esta cuota.
                // Si el saldo_pendiente del recibo > 0, es un pago parcial de esta cuota.

                $saldoPendiente = (float) ($recibo->saldo_pendiente ?? 0);
                $esParcial = $saldoPendiente > 1;

                $estadoOficina = $esParcial ? 'parcial' : 'pagado';
                $montoPendienteOficina = $esParcial ? $saldoPendiente : 0;

                // monto_total de esta cuota = lo pagado + lo pendiente
                $montoTotalCuota = $montoOficina + $montoPendienteOficina;

                if ($verboseLog) {
                    $this->line("    💰 Oficina: \${$montoOficina} ({$estadoOficina}) — Recibo #{$recibo->id}");
                }

                if (!$isDryRun) {
                    PagoPoliza::create([
                        'broker_id'      => $recibo->broker_id,
                        'poliza_id'      => $poliza->id,
                        'cliente_id'     => $recibo->cliente_id ?? $poliza->client_id,
                        'monto_total'    => $montoTotalCuota,
                        'monto_pagado'   => $montoOficina,
                        'monto_pendiente' => $montoPendienteOficina,
                        'tipo_recaudo'   => 'oficina',
                        'metodo_pago'    => $this->normalizeFormaPago($recibo->forma_pago),
                        'fecha_pago'     => $recibo->fecha_realizo_pago_oficina ?? $recibo->fecha_pago ?? now(),
                        'referencia_pago' => $recibo->numero_recibo ? "RC-{$recibo->numero_recibo}" : null,
                        'estado'         => $estadoOficina,
                        'observaciones'  => "Sincronizado desde SoftSeguros — Recibo #{$recibo->numero_recibo}, Pago #{$recibo->numero_pago}",
                        'recibo_caja_id' => $recibo->id,
                        'source'         => 'softseguros',
                    ]);
                }

                $this->pagosCreados++;
                $created = true;
            }

            // ──────────────────────────────────────────────────────────
            // PASO B: DETERMINAR SI HAY RECAUDO A ASEGURADORA
            // ──────────────────────────────────────────────────────────
            //
            // En SoftSeguros, el flag "recaudado" (sin _en_oficina) significa que
            // el ciclo de recaudo está COMPLETO: se pagó a la aseguradora.
            //
            // Esto puede pasar de 2 formas:
            //   a) Oficina cobró al cliente → broker pagó a aseguradora → recaudado=true
            //   b) Pago directo → cliente pagó directo a aseguradora → recibo_pago_directo=true
            //
            // El monto pagado a la aseguradora es valor_pagado o valor_a_pagar.
            // La prima neta de la póliza es lo que se debe a la aseguradora.
            //
            // Para la cartera de Guro:
            //   - Si recaudado=true → PagoPoliza(tipo_recaudo='aseguradora', estado='pagado')
            //   - Si solo recaudado_en_oficina=true pero recaudado=false → no crear aseguradora
            //     (queda en "Por Pagar" en cartera, que es correcto)

            if ($recaudoTotal || $esPagoDirecto) {
                // El recaudo está completo o es pago directo
                $montoAseguradora = (float) ($recibo->valor_pagado ?? $recibo->valor_a_pagar ?? 0);
                if ($montoAseguradora <= 0) {
                    $montoAseguradora = $primaNeta;
                }

                $saldoPendienteAseg = (float) ($recibo->saldo_pendiente_aseguradora ?? 0);
                $estadoAseg = $saldoPendienteAseg > 1 ? 'parcial' : 'pagado';

                if ($verboseLog) {
                    $tipo = $esPagoDirecto ? 'Pago directo' : 'Aseguradora';
                    $this->line("    🏛  {$tipo}: \${$montoAseguradora} ({$estadoAseg}) — Recibo #{$recibo->id}");
                }

                if (!$isDryRun) {
                    PagoPoliza::create([
                        'broker_id'      => $recibo->broker_id,
                        'poliza_id'      => $poliza->id,
                        'cliente_id'     => $recibo->cliente_id ?? $poliza->client_id,
                        'monto_total'    => $primaNeta > 0 ? $primaNeta : $montoAseguradora,
                        'monto_pagado'   => $montoAseguradora,
                        'monto_pendiente' => max(0, ($primaNeta > 0 ? $primaNeta : $montoAseguradora) - $montoAseguradora),
                        'tipo_recaudo'   => 'aseguradora',
                        'metodo_pago'    => $this->normalizeFormaPago($recibo->forma_pago_aseguradora ?? $recibo->forma_pago),
                        'fecha_pago'     => $recibo->fecha_realizo_pago ?? $recibo->fecha_pago ?? now(),
                        'referencia_pago' => $recibo->numero_recibo ? "RC-{$recibo->numero_recibo}" : null,
                        'estado'         => $estadoAseg,
                        'observaciones'  => $esPagoDirecto
                            ? "Pago directo sincronizado desde SoftSeguros — Recibo #{$recibo->numero_recibo}"
                            : "Recaudo aseguradora sincronizado desde SoftSeguros — Recibo #{$recibo->numero_recibo}",
                        'recibo_caja_id' => $recibo->id,
                        'source'         => 'softseguros',
                    ]);
                }

                $this->pagosCreados++;
                $created = true;

                // Si es pago directo y NO hubo registro de oficina, crear también el de oficina
                // para mantener consistencia (en SS un pago directo marca tanto oficina como aseg.)
                if ($esPagoDirecto && !$recaudadoEnOficina) {
                    if ($verboseLog) {
                        $this->line("    💰 Oficina (auto pago directo): \${$montoAseguradora} — Recibo #{$recibo->id}");
                    }

                    if (!$isDryRun) {
                        PagoPoliza::create([
                            'broker_id'      => $recibo->broker_id,
                            'poliza_id'      => $poliza->id,
                            'cliente_id'     => $recibo->cliente_id ?? $poliza->client_id,
                            'monto_total'    => $totalPoliza,
                            'monto_pagado'   => $totalPoliza,
                            'monto_pendiente' => 0,
                            'tipo_recaudo'   => 'oficina',
                            'metodo_pago'    => 'pago_directo',
                            'fecha_pago'     => $recibo->fecha_realizo_pago ?? $recibo->fecha_pago ?? now(),
                            'referencia_pago' => $recibo->numero_recibo ? "RC-{$recibo->numero_recibo}-DIR" : null,
                            'estado'         => 'pagado',
                            'observaciones'  => "Pago directo (oficina implícita) sincronizado desde SoftSeguros — Recibo #{$recibo->numero_recibo}",
                            'recibo_caja_id' => $recibo->id,
                            'source'         => 'softseguros',
                        ]);
                    }

                    $this->pagosCreados++;
                }
            }

            // ──────────────────────────────────────────────────────────
            // PASO C: DETERMINAR SI HAY COMISIÓN COBRADA
            // ──────────────────────────────────────────────────────────
            //
            // En SoftSeguros, cuando la aseguradora paga la comisión al broker:
            //   - comisionada = true (nota: en SS es "comicionada" con typo)
            //   - comision_a_recibir = monto esperado
            //   - comision_recibida = monto efectivamente cobrado
            //   - fecha_recibio_comision = cuándo se cobró
            //
            // Para Guro → crear CobroComision con estado según datos

            $comisionada = (bool) $recibo->comisionada;
            $comisionARecibir = (float) ($recibo->comision_a_recibir ?? 0);

            if ($comisionARecibir > 0 && !isset($existingComisionesByCaja[$recibo->id])) {
                $comisionRecibida = (float) ($recibo->comision_recibida ?? 0);

                // Determinar estado de la comisión
                if ($comisionada) {
                    $estadoComision = 'cobrado';
                    $montoCobrado = $comisionRecibida > 0 ? $comisionRecibida : $comisionARecibir;
                } else {
                    $estadoComision = 'pendiente';
                    $montoCobrado = $comisionRecibida;
                }

                $montoPendienteComision = max(0, $comisionARecibir - $montoCobrado);

                if ($verboseLog) {
                    $this->line("    📋 Comisión: \${$comisionARecibir} ({$estadoComision}, cobrado \${$montoCobrado}) — Recibo #{$recibo->id}");
                }

                if (!$isDryRun) {
                    CobroComision::create([
                        'broker_id'       => $recibo->broker_id,
                        'poliza_id'       => $poliza->id,
                        'aseguradora_id'  => $poliza->aseguradora_id,
                        'pago_poliza_id'  => null, // no hay pago_poliza directo para estos
                        'recibo_caja_id'  => $recibo->id,
                        'monto_comision'  => $comisionARecibir,
                        'monto_cobrado'   => $montoCobrado,
                        'monto_pendiente' => $montoPendienteComision,
                        'fecha_cobro'     => $recibo->fecha_recibio_comision ?? ($comisionada ? ($recibo->fecha_pago ?? now()) : null),
                        'estado'          => $estadoComision,
                        'observaciones'   => "Sincronizado desde SoftSeguros — Recibo #{$recibo->numero_recibo}, Pago #{$recibo->numero_pago}",
                        'source'          => 'softseguros',
                    ]);
                }

                $this->comisionesCreadas++;
                $created = true;
                $existingComisionesByCaja[$recibo->id] = true;
            }

        } catch (\Throwable $e) {
            $this->errors[] = "Recibo #{$recibo->id} (Póliza #{$poliza->policy_number}): {$e->getMessage()}";
            Log::warning("SyncRecibosToCartera error", [
                'recibo_id' => $recibo->id,
                'poliza_id' => $poliza->id,
                'error' => $e->getMessage(),
            ]);
        }

        return $created;
    }

    /**
     * Normaliza la forma de pago de SoftSeguros al formato de Guro.
     *
     * SS usa strings libres como "Efectivo", "Transferencia Bancaria", "Nequi", etc.
     * Guro usa: efectivo, transferencia, cheque, tarjeta, consignacion, debito_automatico, otro.
     */
    private function normalizeFormaPago(?string $formaPago): ?string
    {
        if (!$formaPago) return null;

        $lower = strtolower(trim($formaPago));

        return match (true) {
            str_contains($lower, 'efectivo')              => 'efectivo',
            str_contains($lower, 'transfer')              => 'transferencia',
            str_contains($lower, 'cheque')                => 'cheque',
            str_contains($lower, 'tarjeta')               => 'tarjeta',
            str_contains($lower, 'consignac')             => 'consignacion',
            str_contains($lower, 'débito') ||
            str_contains($lower, 'debito')                => 'debito_automatico',
            str_contains($lower, 'nequi') ||
            str_contains($lower, 'daviplata') ||
            str_contains($lower, 'pse')                   => 'transferencia',
            default                                        => 'otro',
        };
    }

    /**
     * Elimina pagos_polizas y cobros_comisiones que fueron generados por este sync.
     * Permite re-ejecutar la sincronización desde cero.
     */
    private function resetSyncedData(int $brokerId, ?string $polizaId): void
    {
        $this->warn('  Reseteando datos sincronizados previamente...');

        $pagosQuery = PagoPoliza::where('broker_id', $brokerId)->where('source', 'softseguros');
        $comisionesQuery = CobroComision::where('broker_id', $brokerId)->where('source', 'softseguros');

        if ($polizaId) {
            $pagosQuery->where('poliza_id', $polizaId);
            $comisionesQuery->where('poliza_id', $polizaId);
        }

        $pagosDeleted = $pagosQuery->delete();
        $comisionesDeleted = $comisionesQuery->delete();

        $this->info("  ✓ Eliminados: {$pagosDeleted} pagos, {$comisionesDeleted} comisiones");
        $this->info('');
    }
}
