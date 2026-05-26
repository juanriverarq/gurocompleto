<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Broker;
use App\Models\CarteraAseguradora;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class CarteraConsolidadaController extends Controller
{
    public function index(Request $request)
    {
        $brokerId = $this->resolveBrokerId($request);
        $perPage = (int) $request->input('per_page', 25);
        $page = (int) $request->input('page', 1);
        $tab = $request->input('tab', 'todos');
        $search = $request->input('search', '');
        $insurer = $request->input('insurer');
        // link_filter: 'all' | 'linked' | 'unlinked' — filtra por vínculo con
        // cliente Y póliza en Guro (LEFT JOIN). Por defecto no filtra.
        $linkFilter = $request->input('link_filter', 'all');
        // seller_filter: 'all' | 'with' | 'without' — filtra por asignación de
        // asesor/vendedor en la póliza vinculada. 'without' incluye también
        // pólizas no vinculadas (sin polizas.id), porque tampoco tienen seller.
        $sellerFilter = $request->input('seller_filter', 'all');

        // IMPORTANTE: cada fila de `cartera_aseguradoras` es UNA cuota/recibo
        // pendiente. Varias cuotas de la misma póliza se consolidan aquí para
        // mostrar una fila por póliza con el saldo pendiente total.
        //
        // Semántica de los valores:
        //   - `prima_cuotas`    : suma de importes de las cuotas PENDIENTES solamente
        //   - `valor_pendiente` : suma de saldos (lo que aún se debe pagar)
        //   - `valor_pagado`    : suma de abonos registrados en cuotas pendientes
        //   - `prima_poliza`    : viene de `polizas.premium_amount` (prima total contratada)
        //                         Si es NULL se cae en `prima_cuotas` como fallback.
        $sub = DB::table('cartera_aseguradoras')
            ->where('broker_id', $brokerId)
            ->where(function ($q) {
                $q->where('valor_pendiente', '!=', 0)
                  ->orWhere('insurer_code', 'qualitas');
            })
            ->when($insurer, fn ($q) => $q->where('insurer_code', $insurer))
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('client_name', 'like', "%{$search}%")
                  ->orWhere('client_document', 'like', "%{$search}%")
                  ->orWhere('policy_number', 'like', "%{$search}%");
            }))
            ->groupBy('broker_id', 'insurer_code', 'insurer_name', 'policy_number')
            ->selectRaw("
                MIN(id) as id,
                broker_id, insurer_code, insurer_name, policy_number,
                MAX(matched_poliza_id) as matched_poliza_id,
                MAX(client_name) as client_name,
                MAX(client_document) as client_document,
                MAX(client_doc_type) as client_doc_type,
                MAX(ramo) as ramo,
                MAX(product_name) as product_name,
                SUM(prima_total) as prima_cuotas,
                SUM(valor_pendiente) as valor_pendiente,
                SUM(valor_pagado) as valor_pagado,
                SUM(bonificacion) as bonificacion,
                SUM(valor_iva) as valor_iva,
                SUM(valor_gastos_emision) as valor_gastos_emision,
                SUM(valor_tasa_runt) as valor_tasa_runt,
                MAX(moneda) as moneda,
                MAX(dias_mora) as dias_mora,
                MAX(source_endpoint) as source_endpoint,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.financiada'))) as sura_financiada,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.forma_pago'))) as forma_pago,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.medio_pago'))) as medio_pago,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.banco'))) as banco,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.tipo_cuenta'))) as tipo_cuenta,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.cuenta_bancaria'))) as cuenta_bancaria,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.dias_cancelacion'))) as dias_cancelacion,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.tipo_cobro'))) as tipo_cobro_fuente,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.linea_financiacion'))) as linea_financiacion,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.clasificacion'))) as clasificacion,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.convenio'))) as convenio,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.placa'))) as placa,
                CASE
                    WHEN MAX(dias_mora) = 0 THEN 'al_dia'
                    WHEN MAX(dias_mora) <= 30 THEN 'mora_30'
                    WHEN MAX(dias_mora) <= 60 THEN 'mora_60'
                    WHEN MAX(dias_mora) <= 90 THEN 'mora_90'
                    ELSE 'mora_90_plus'
                END as rango_mora,
                COUNT(*) as cuotas_pendientes,
                MIN(fecha_inicio_vigencia) as fecha_inicio_vigencia,
                MIN(fecha_expedicion) as fecha_expedicion,
                MIN(fecha_vencimiento) as proxima_cuota_vence,
                MAX(fecha_vencimiento) as ultima_cuota_vence,
                MAX(numero_recibo) as numero_recibo,
                MAX(numero_pagare) as numero_pagare,
                MAX(total_cuotas) as total_cuotas,
                MAX(cuotas_pagadas) as cuotas_pagadas,
                MAX(cuotas_mora) as cuotas_mora,
                CASE
                    WHEN MAX(numero_pagare) IS NOT NULL OR MAX(total_cuotas) > 1 OR COUNT(*) > 1 OR MAX(source_endpoint) LIKE '%financiada%' OR MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.financiada'))) = 'S'
                        THEN 1
                    ELSE 0
                END as es_financiada,
                MAX(synced_at) as synced_at
            ");

        // LEFT JOIN con polizas para traer la prima real contratada.
        // Se usa un segundo wrap para que paginate trabaje bien con el JOIN.
        // Match con polizas usando matched_poliza_id (precomputado al sincronizar:
        // exact match O suffix+cliente — SURA reporta 081003691040 vs póliza 3691040).
        // Filas sin matched_poliza_id quedan sin póliza linkeada en el LEFT JOIN.
        $query = DB::query()->fromSub($sub, 'agg')
            ->leftJoin('polizas as p', function ($join) {
                $join->on('p.id', '=', 'agg.matched_poliza_id')
                     ->whereNull('p.deleted_at');
            })
            ->selectRaw("
                agg.*,
                COALESCE(p.premium_amount, 0) as prima_poliza,
                COALESCE(p.total_amount, 0) as total_poliza,
                p.id as poliza_id,
                p.client_id as client_id,
                -- Asesor/vendedor de la póliza (puede haber 1 o 2). Se desnormalizó
                -- en polizas.seller_name / seller_name_2 al momento de crear/editar.
                p.seller_id as seller_id,
                p.seller_name as seller_name,
                p.seller_id_2 as seller_id_2,
                p.seller_name_2 as seller_name_2,
                NULLIF(p.premium_amount, 0) as prima_total,
                agg.prima_cuotas as importe_cuotas,
                CASE WHEN p.premium_amount > 0 THEN 1 ELSE 0 END as prima_disponible,
                CASE WHEN agg.es_financiada = 1 THEN 'financiada' ELSE 'contado' END as tipo_cobro,
                CASE
                    WHEN p.premium_amount > 0 AND p.premium_amount >= agg.valor_pendiente
                        THEN p.premium_amount - agg.valor_pendiente
                    ELSE agg.valor_pagado
                END as valor_pagado_total
            ");

        if ($tab !== 'todos') {
            $query->where('rango_mora', $tab);
        }

        // Filtro por vínculo: 'linked' = ambos (cliente y póliza); 'unlinked' = falta alguno.
        if ($linkFilter === 'linked') {
            $query->whereNotNull('p.id')->whereNotNull('p.client_id');
        } elseif ($linkFilter === 'unlinked') {
            $query->where(function ($q) {
                $q->whereNull('p.id')->orWhereNull('p.client_id');
            });
        }

        // Filtro por asesor: 'with' requiere seller_name; 'without' incluye
        // pólizas sin vendedor asignado Y carteras sin póliza vinculada.
        if ($sellerFilter === 'with') {
            $query->whereNotNull('p.seller_name')->where('p.seller_name', '!=', '');
        } elseif ($sellerFilter === 'without') {
            $query->where(function ($q) {
                $q->whereNull('p.seller_name')->orWhere('p.seller_name', '');
            });
        }

        $query->orderByDesc('dias_mora')->orderByDesc('valor_pendiente');

        $paginated = $query->paginate($perPage, ['*'], 'page', $page);

        // fecha_vencimiento para UI = próxima cuota por vencer
        $items = array_map(function ($row) {
            $row = (array) $row;
            $row['fecha_vencimiento'] = $row['proxima_cuota_vence'] ?? null;
            return $row;
        }, $paginated->items());

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $items,
                'pagination' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                ],
            ],
        ]);
    }

    /**
     * Export CSV con los mismos filtros que index() pero sin paginar.
     * Streaming para no cargar miles de filas en memoria.
     *
     * Query params soportados:
     *   tab           — todos | al_dia | mora_30 | mora_60 | mora_90 | mora_90_plus
     *   insurer       — código de aseguradora (opcional)
     *   search        — texto libre (cliente, doc, póliza)
     *   link_filter   — all | linked | unlinked
     *   seller_filter — all | with | without
     */
    public function export(Request $request)
    {
        $brokerId = $this->resolveBrokerId($request);
        $tab = $request->input('tab', 'todos');
        $search = $request->input('search', '');
        $insurer = $request->input('insurer');
        $linkFilter = $request->input('link_filter', 'all');
        $sellerFilter = $request->input('seller_filter', 'all');

        // Sub-query agregando una fila por póliza (idéntica a index())
        $sub = DB::table('cartera_aseguradoras')
            ->where('broker_id', $brokerId)
            ->where(function ($q) {
                $q->where('valor_pendiente', '!=', 0)
                  ->orWhere('insurer_code', 'qualitas');
            })
            ->when($insurer, fn ($q) => $q->where('insurer_code', $insurer))
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('client_name', 'like', "%{$search}%")
                  ->orWhere('client_document', 'like', "%{$search}%")
                  ->orWhere('policy_number', 'like', "%{$search}%");
            }))
            ->groupBy('broker_id', 'insurer_code', 'insurer_name', 'policy_number')
            ->selectRaw("
                MIN(id) as id,
                broker_id, insurer_code, insurer_name, policy_number,
                MAX(matched_poliza_id) as matched_poliza_id,
                MAX(client_name) as client_name,
                MAX(client_document) as client_document,
                MAX(client_doc_type) as client_doc_type,
                MAX(ramo) as ramo,
                MAX(product_name) as product_name,
                SUM(prima_total) as prima_cuotas,
                SUM(valor_pendiente) as valor_pendiente,
                SUM(valor_iva) as valor_iva,
                SUM(valor_gastos_emision) as valor_gastos_emision,
                SUM(valor_tasa_runt) as valor_tasa_runt,
                MAX(source_endpoint) as source_endpoint,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.financiada'))) as sura_financiada,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.forma_pago'))) as forma_pago,
                MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.medio_pago'))) as medio_pago,
                MAX(dias_mora) as dias_mora,
                CASE
                    WHEN MAX(dias_mora) = 0 THEN 'al_dia'
                    WHEN MAX(dias_mora) <= 30 THEN 'mora_30'
                    WHEN MAX(dias_mora) <= 60 THEN 'mora_60'
                    WHEN MAX(dias_mora) <= 90 THEN 'mora_90'
                    ELSE 'mora_90_plus'
                END as rango_mora,
                MIN(fecha_inicio_vigencia) as fecha_inicio_vigencia,
                MAX(fecha_vencimiento) as fecha_vencimiento,
                COUNT(*) as cuotas_pendientes,
                MAX(numero_pagare) as numero_pagare,
                MAX(total_cuotas) as total_cuotas,
                CASE
                    WHEN MAX(numero_pagare) IS NOT NULL OR MAX(total_cuotas) > 1 OR COUNT(*) > 1 OR MAX(source_endpoint) LIKE '%financiada%' OR MAX(JSON_UNQUOTE(JSON_EXTRACT(raw_data, '$.financiada'))) = 'S'
                        THEN 1
                    ELSE 0
                END as es_financiada
            ");

        // Match con polizas usando matched_poliza_id (precomputado al sincronizar:
        // exact match O suffix+cliente — SURA reporta 081003691040 vs póliza 3691040).
        // Filas sin matched_poliza_id quedan sin póliza linkeada en el LEFT JOIN.
        $query = DB::query()->fromSub($sub, 'agg')
            ->leftJoin('polizas as p', function ($join) {
                $join->on('p.id', '=', 'agg.matched_poliza_id')
                     ->whereNull('p.deleted_at');
            })
            ->selectRaw("
                agg.insurer_name,
                agg.policy_number,
                agg.client_name,
                agg.client_doc_type,
                agg.client_document,
                agg.ramo,
                agg.product_name,
                COALESCE(p.seller_name, '') as seller_name,
                COALESCE(p.seller_name_2, '') as seller_name_2,
                NULLIF(p.premium_amount, 0) as prima_total,
                agg.prima_cuotas as importe_cuotas,
                CASE WHEN agg.es_financiada = 1 THEN 'financiada' ELSE 'contado' END as tipo_cobro,
                agg.valor_pendiente,
                agg.dias_mora,
                agg.rango_mora,
                agg.fecha_inicio_vigencia,
                agg.fecha_vencimiento,
                agg.cuotas_pendientes,
                CASE WHEN p.id IS NOT NULL AND p.client_id IS NOT NULL THEN 'vinculada' ELSE 'sin vincular' END as vinculo
            ");

        if ($tab !== 'todos') {
            $query->where('rango_mora', $tab);
        }
        if ($linkFilter === 'linked') {
            $query->whereNotNull('p.id')->whereNotNull('p.client_id');
        } elseif ($linkFilter === 'unlinked') {
            $query->where(function ($q) {
                $q->whereNull('p.id')->orWhereNull('p.client_id');
            });
        }
        if ($sellerFilter === 'with') {
            $query->whereNotNull('p.seller_name')->where('p.seller_name', '!=', '');
        } elseif ($sellerFilter === 'without') {
            $query->where(function ($q) {
                $q->whereNull('p.seller_name')->orWhere('p.seller_name', '');
            });
        }
        $query->orderByDesc('dias_mora')->orderByDesc('valor_pendiente');

        $filenameParts = ['cartera'];
        if ($tab !== 'todos') $filenameParts[] = $tab;
        if ($linkFilter !== 'all') $filenameParts[] = $linkFilter;
        if ($sellerFilter !== 'all') $filenameParts[] = "asesor_{$sellerFilter}";
        $filenameParts[] = now()->format('Ymd_His');
        $filename = implode('_', $filenameParts) . '.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache',
        ];

        return response()->stream(function () use ($query) {
            $out = fopen('php://output', 'w');
            // BOM para que Excel detecte UTF-8
            fwrite($out, "\xEF\xBB\xBF");
            // Encabezados
            fputcsv($out, [
                'Aseguradora', 'Póliza', 'Cliente', 'Tipo Doc', 'Documento',
                'Ramo', 'Producto', 'Asesor', 'Asesor 2',
                'Prima póliza', 'Importe cuotas', 'Pendiente', 'Tipo cobro', 'Días mora', 'Rango mora',
                'Vigencia desde', 'Próximo vence', 'Cuotas pendientes', 'Vínculo',
            ]);
            // Streaming en chunks de 500 filas para no cargar todo en memoria
            $query->chunk(500, function ($rows) use ($out) {
                foreach ($rows as $r) {
                    fputcsv($out, [
                        $r->insurer_name,
                        $r->policy_number,
                        $r->client_name,
                        $r->client_doc_type,
                        $r->client_document,
                        $r->ramo,
                        $r->product_name,
                        $r->seller_name,
                        $r->seller_name_2,
                        $r->prima_total !== null ? number_format((float) $r->prima_total, 2, '.', '') : '',
                        number_format((float) $r->importe_cuotas, 2, '.', ''),
                        number_format((float) $r->valor_pendiente, 2, '.', ''),
                        $r->tipo_cobro,
                        (int) $r->dias_mora,
                        $r->rango_mora,
                        $r->fecha_inicio_vigencia,
                        $r->fecha_vencimiento,
                        (int) ($r->cuotas_pendientes ?? 0),
                        $r->vinculo,
                    ]);
                }
                ob_flush();
                flush();
            });
            fclose($out);
        }, 200, $headers);
    }

    /**
     * Desglose de cuotas pendientes para una póliza específica.
     * Usado por el modal de detalle para mostrar cuándo vence cada cuota.
     */
    public function cuotas(Request $request, string $policyNumber)
    {
        $brokerId = $this->resolveBrokerId($request);

        $items = CarteraAseguradora::forBroker($brokerId)
            ->where('policy_number', $policyNumber)
            ->orderBy('fecha_vencimiento', 'asc')
            ->orderBy('numero_recibo', 'asc')
            ->get();

        $totales = [
            'cuotas' => $items->count(),
            'prima_total' => (float) $items->sum('prima_total'),
            'valor_pendiente' => (float) $items->sum('valor_pendiente'),
            'valor_pagado' => (float) $items->sum('valor_pagado'),
            'dias_mora_max' => (int) ($items->max('dias_mora') ?? 0),
        ];

        return response()->json([
            'success' => true,
            'data' => ['items' => $items, 'totales' => $totales],
        ]);
    }

    public function stats(Request $request)
    {
        $brokerId = $this->resolveBrokerId($request);
        $insurer = $request->input('insurer');
        $linkFilter = $request->input('link_filter', 'all');

        // Stats también se calculan sobre pólizas consolidadas, no sobre filas
        // individuales. Para ello usamos una subquery agrupada por póliza y el
        // rango_mora se deriva del MAX(dias_mora) de las cuotas pendientes.
        // Se LEFT JOIN con polizas para usar la prima real cuando esté disponible.
        $consolidadoSub = DB::table('cartera_aseguradoras as ca')
            ->leftJoin('polizas as p', function ($join) {
                $join->on('p.id', '=', 'ca.matched_poliza_id')
                     ->whereNull('p.deleted_at');
            })
            ->where('ca.broker_id', $brokerId)
            ->where(function ($q) {
                $q->where('ca.valor_pendiente', '!=', 0)
                  ->orWhere('ca.insurer_code', 'qualitas');
            })
            ->when($insurer, fn ($q) => $q->where('ca.insurer_code', $insurer))
            ->when($linkFilter === 'linked', fn ($q) => $q->whereNotNull('p.id')->whereNotNull('p.client_id'))
            ->when($linkFilter === 'unlinked', fn ($q) => $q->where(function ($qq) {
                $qq->whereNull('p.id')->orWhereNull('p.client_id');
            }))
            ->groupBy('ca.broker_id', 'ca.insurer_code', 'ca.insurer_name', 'ca.policy_number', 'p.premium_amount')
            ->selectRaw("
                ca.insurer_code, ca.insurer_name, ca.policy_number,
                SUM(ca.valor_pendiente) as valor_pendiente_total,
                NULLIF(p.premium_amount, 0) as prima_total,
                MAX(ca.dias_mora) as dias_mora_max,
                MAX(ca.synced_at) as synced_at,
                CASE
                    WHEN MAX(ca.dias_mora) = 0 THEN 'al_dia'
                    WHEN MAX(ca.dias_mora) <= 30 THEN 'mora_30'
                    WHEN MAX(ca.dias_mora) <= 60 THEN 'mora_60'
                    WHEN MAX(ca.dias_mora) <= 90 THEN 'mora_90'
                    ELSE 'mora_90_plus'
                END as rango_mora_calc
            ");

        $rangos = DB::query()->fromSub($consolidadoSub, 'c')
            ->select('rango_mora_calc as rango_mora',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(valor_pendiente_total) as total_pendiente'))
            ->groupBy('rango_mora_calc')
            ->get()
            ->keyBy('rango_mora');

        $byInsurer = DB::query()->fromSub($consolidadoSub, 'c')
            ->select('insurer_code', 'insurer_name',
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(valor_pendiente_total) as total_pendiente'),
                DB::raw('MAX(dias_mora_max) as max_dias_mora'))
            ->groupBy('insurer_code', 'insurer_name')
            ->get();

        $totals = DB::query()->fromSub($consolidadoSub, 'c')
            ->selectRaw('COUNT(*) as total_items')
            ->selectRaw('SUM(valor_pendiente_total) as total_pendiente')
            ->selectRaw('SUM(COALESCE(prima_total, 0)) as total_primas')
            ->selectRaw('MAX(synced_at) as last_sync')
            ->first();

        // Total de cuotas individuales (para mostrar "X pólizas · Y cuotas").
        // Si hay link_filter activo, contar solo las cuotas de pólizas que matchean.
        $cuotasCount = DB::table('cartera_aseguradoras as ca')
            ->leftJoin('polizas as p', function ($join) {
                $join->on('p.id', '=', 'ca.matched_poliza_id')
                     ->whereNull('p.deleted_at');
            })
            ->where('ca.broker_id', $brokerId)
            ->where(function ($q) {
                $q->where('ca.valor_pendiente', '!=', 0)
                  ->orWhere('ca.insurer_code', 'qualitas');
            })
            ->when($insurer, fn ($q) => $q->where('ca.insurer_code', $insurer))
            ->when($linkFilter === 'linked', fn ($q) => $q->whereNotNull('p.id')->whereNotNull('p.client_id'))
            ->when($linkFilter === 'unlinked', fn ($q) => $q->where(function ($qq) {
                $qq->whereNull('p.id')->orWhereNull('p.client_id');
            }))
            ->count();

        $tabCounts = [
            'todos' => (int) ($totals->total_items ?? 0),
            'al_dia' => (int) ($rangos['al_dia']->count ?? 0),
            'mora_30' => (int) ($rangos['mora_30']->count ?? 0),
            'mora_60' => (int) ($rangos['mora_60']->count ?? 0),
            'mora_90' => (int) ($rangos['mora_90']->count ?? 0),
            'mora_90_plus' => (int) ($rangos['mora_90_plus']->count ?? 0),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'totals' => [
                    'items' => (int) ($totals->total_items ?? 0), // pólizas únicas en cartera
                    'cuotas_pendientes' => (int) $cuotasCount,     // total de cuotas individuales
                    'valor_pendiente' => (float) ($totals->total_pendiente ?? 0),
                    'total_primas' => (float) ($totals->total_primas ?? 0),
                    'last_sync' => $totals->last_sync,
                ],
                'tab_counts' => $tabCounts,
                'by_rango' => $rangos,
                'by_insurer' => $byInsurer,
            ],
        ]);
    }

    public function destroyData(Request $request)
    {
        $brokerId = $this->resolveBrokerId($request);
        $insurer = $request->input('insurer');

        $query = CarteraAseguradora::where('broker_id', $brokerId);
        if ($insurer) {
            $query->where('insurer_code', $insurer);
        }

        $deleted = $query->delete();

        return response()->json([
            'success' => true,
            'message' => $deleted > 0
                ? 'Datos de cartera eliminados correctamente.'
                : 'No había datos de cartera para eliminar.',
            'data' => [
                'deleted' => $deleted,
                'broker_id' => $brokerId,
                'insurer' => $insurer,
            ],
        ]);
    }

    private function resolveBrokerId(Request $request): int
    {
        if ($request->has('authenticated_broker_id')) {
            return (int) $request->get('authenticated_broker_id');
        }
        $user = $request->user() ?: Auth::user();
        if ($user && !empty($user->broker_id)) {
            return (int) $user->broker_id;
        }
        if (app()->environment(['local', 'development'])) {
            $devBrokerId = $request->header('X-Dev-Broker-Id');
            if ($devBrokerId) return (int) $devBrokerId;
            $firstBroker = Broker::first();
            if ($firstBroker) return (int) $firstBroker->id;
        }
        throw new \RuntimeException('No se pudo resolver broker_id.');
    }
}
