<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Papelera unificada: lista, restaura y elimina definitivamente los registros
 * soft-deleted de las entidades principales (clientes, pólizas, siniestros, etc.).
 * Todo se filtra por broker_id del usuario autenticado.
 */
class PapeleraController extends Controller
{
    /**
     * Mapa de entidades soportadas:
     *   key   = identificador usado por el frontend
     *   table = tabla en BD
     *   label = nombre legible
     *   fields = columnas que se devuelven en la lista
     *   search = columnas indexables para búsqueda
     *   display = mapeo de campo a label en CSV
     */
    private array $entidades = [
        'clientes' => [
            'table' => 'clientes',
            'label' => 'Clientes',
            'fields' => ['id','client_type','first_name','last_name','company','document_type','document_number','email','mobile_phone','phone','city','status','deleted_at','created_at'],
            'search' => ['first_name','last_name','company','document_number','email','mobile_phone'],
            'display' => [
                'id' => 'ID',
                'document_type' => 'Tipo Doc',
                'document_number' => 'Documento',
                'first_name' => 'Nombres',
                'last_name' => 'Apellidos',
                'company' => 'Empresa',
                'email' => 'Email',
                'mobile_phone' => 'Celular',
                'city' => 'Ciudad',
                'status' => 'Estado',
                'deleted_at' => 'Eliminado',
                'created_at' => 'Creado',
            ],
        ],
        'polizas' => [
            'table' => 'polizas',
            'label' => 'Pólizas',
            'fields' => ['id','policy_number','insurance_company','product_name','client_id','client_name','client_document','start_date','end_date','status','premium_amount','total_amount','deleted_at','created_at'],
            'search' => ['policy_number','insurance_company','product_name','client_name','client_document','description'],
            'display' => [
                'id' => 'ID',
                'policy_number' => 'N° Póliza',
                'insurance_company' => 'Aseguradora',
                'product_name' => 'Ramo',
                'client_name' => 'Cliente',
                'client_document' => 'Documento',
                'start_date' => 'Inicio',
                'end_date' => 'Fin',
                'status' => 'Estado',
                'premium_amount' => 'Prima',
                'total_amount' => 'Total',
                'deleted_at' => 'Eliminado',
                'created_at' => 'Creado',
            ],
        ],
        'siniestros' => [
            'table' => 'siniestros',
            'label' => 'Siniestros',
            'fields' => ['id','numero_siniestro','numero_poliza','aseguradora','tipo_siniestro','estado','prioridad','monto_reclamado','fecha_ocurrencia','deleted_at','created_at'],
            'search' => ['numero_siniestro','numero_poliza','aseguradora','descripcion_hechos'],
            'display' => [
                'id' => 'ID',
                'numero_siniestro' => 'N° Siniestro',
                'numero_poliza' => 'N° Póliza',
                'aseguradora' => 'Aseguradora',
                'tipo_siniestro' => 'Tipo',
                'estado' => 'Estado',
                'monto_reclamado' => 'Monto Reclamado',
                'fecha_ocurrencia' => 'Fecha Ocurrencia',
                'deleted_at' => 'Eliminado',
                'created_at' => 'Creado',
            ],
        ],
        'recibos_caja' => [
            'table' => 'recibos_caja',
            'label' => 'Recibos de Caja',
            'fields' => ['id','numero_recibo','fecha_recibo','cliente_id','cliente_nombre','aseguradora','total','deleted_at','created_at'],
            'search' => ['numero_recibo','cliente_nombre','aseguradora'],
            'display' => [
                'id' => 'ID',
                'numero_recibo' => 'N° Recibo',
                'fecha_recibo' => 'Fecha',
                'cliente_nombre' => 'Cliente',
                'aseguradora' => 'Aseguradora',
                'total' => 'Total',
                'deleted_at' => 'Eliminado',
                'created_at' => 'Creado',
            ],
        ],
        'sales_funnel' => [
            'table' => 'sales_funnels',
            'label' => 'Oportunidades (Embudo)',
            'fields' => ['id','client_name','product_type','stage','probability','estimated_value','created_at','deleted_at'],
            'search' => ['client_name','product_type','description'],
            'display' => [
                'id' => 'ID',
                'client_name' => 'Cliente',
                'product_type' => 'Tipo',
                'stage' => 'Etapa',
                'probability' => 'Probabilidad %',
                'estimated_value' => 'Valor Est.',
                'deleted_at' => 'Eliminado',
                'created_at' => 'Creado',
            ],
        ],
        'commercial_tasks' => [
            'table' => 'commercial_tasks',
            'label' => 'Tareas Comerciales',
            'fields' => ['id','title','task_type','status','priority','due_date','assigned_to','client_id','deleted_at','created_at'],
            'search' => ['title','description'],
            'display' => [
                'id' => 'ID',
                'title' => 'Título',
                'task_type' => 'Tipo',
                'status' => 'Estado',
                'priority' => 'Prioridad',
                'due_date' => 'Vence',
                'deleted_at' => 'Eliminado',
                'created_at' => 'Creado',
            ],
        ],
    ];

    private function getBrokerId(Request $request): ?int
    {
        return $request->attributes->get('authenticated_broker_id')
            ?? $request->input('authenticated_broker_id')
            ?? null;
    }

    private function ensureEntidad(string $entidad): array
    {
        if (!isset($this->entidades[$entidad])) {
            abort(404, "Entidad '$entidad' no soportada en la papelera.");
        }
        return $this->entidades[$entidad];
    }

    /**
     * GET /api/saas/papelera/entidades
     * Devuelve la lista de entidades soportadas con su conteo de elementos eliminados.
     */
    public function entidades(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'Broker no identificado'], 403);

        $resp = [];
        foreach ($this->entidades as $key => $cfg) {
            $count = DB::table($cfg['table'])
                ->where('broker_id', $brokerId)
                ->whereNotNull('deleted_at')
                ->count();
            $resp[] = ['key' => $key, 'label' => $cfg['label'], 'count' => $count];
        }
        return response()->json(['success' => true, 'data' => $resp]);
    }

    /**
     * GET /api/saas/papelera/{entidad}
     * Lista los registros soft-deleted con paginación y búsqueda.
     */
    public function index(Request $request, string $entidad)
    {
        $cfg = $this->ensureEntidad($entidad);
        $brokerId = $this->getBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'Broker no identificado'], 403);

        $perPage = min((int) $request->input('per_page', 25), 100);
        $search = trim((string) $request->input('search', ''));

        $q = DB::table($cfg['table'])
            ->where('broker_id', $brokerId)
            ->whereNotNull('deleted_at');

        if ($search !== '') {
            $like = '%' . $search . '%';
            $q->where(function ($w) use ($like, $cfg) {
                foreach ($cfg['search'] as $col) {
                    $w->orWhere($col, 'like', $like);
                }
            });
        }

        $paginated = $q->orderByDesc('deleted_at')->paginate($perPage, $cfg['fields']);

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $paginated->items(),
                'pagination' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                ],
                'columns' => $cfg['display'],
            ],
        ]);
    }

    /**
     * POST /api/saas/papelera/{entidad}/restaurar
     * Body: { ids: [int, ...] }
     */
    public function restaurar(Request $request, string $entidad)
    {
        $cfg = $this->ensureEntidad($entidad);
        $brokerId = $this->getBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'Broker no identificado'], 403);

        $ids = $request->input('ids', []);
        if (!is_array($ids) || empty($ids)) {
            return response()->json(['success' => false, 'message' => 'Se requiere al menos un id'], 422);
        }
        $ids = array_filter(array_map('intval', $ids));

        $affected = DB::table($cfg['table'])
            ->where('broker_id', $brokerId)
            ->whereIn('id', $ids)
            ->whereNotNull('deleted_at')
            ->update(['deleted_at' => null, 'updated_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => "Se restauraron $affected registros",
            'data' => ['restored' => $affected, 'ids' => $ids],
        ]);
    }

    /**
     * POST /api/saas/papelera/{entidad}/eliminar
     * Body: { ids: [int, ...] }
     * Eliminación DEFINITIVA — sin retorno. Sólo aplica si ya está soft-deleted.
     */
    public function eliminarDefinitivo(Request $request, string $entidad)
    {
        $cfg = $this->ensureEntidad($entidad);
        $brokerId = $this->getBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'Broker no identificado'], 403);

        $deleteAll = $request->boolean('delete_all', false);
        $ids = $request->input('ids', []);

        if (!$deleteAll && (!is_array($ids) || empty($ids))) {
            return response()->json(['success' => false, 'message' => 'Se requiere delete_all o al menos un id'], 422);
        }

        $q = DB::table($cfg['table'])
            ->where('broker_id', $brokerId)
            ->whereNotNull('deleted_at');

        if (!$deleteAll) {
            $ids = array_filter(array_map('intval', $ids));
            $q->whereIn('id', $ids);
        }

        $affected = $q->delete();

        return response()->json([
            'success' => true,
            'message' => "Se eliminaron definitivamente $affected registros",
            'data' => ['deleted' => $affected],
        ]);
    }

    /**
     * GET /api/saas/papelera/{entidad}/exportar
     * Exporta a CSV todos los soft-deleted de esta entidad (respetando búsqueda).
     */
    public function exportar(Request $request, string $entidad)
    {
        $cfg = $this->ensureEntidad($entidad);
        $brokerId = $this->getBrokerId($request);
        if (!$brokerId) return response()->json(['success' => false, 'message' => 'Broker no identificado'], 403);

        $search = trim((string) $request->input('search', ''));

        $q = DB::table($cfg['table'])
            ->where('broker_id', $brokerId)
            ->whereNotNull('deleted_at');

        if ($search !== '') {
            $like = '%' . $search . '%';
            $q->where(function ($w) use ($like, $cfg) {
                foreach ($cfg['search'] as $col) {
                    $w->orWhere($col, 'like', $like);
                }
            });
        }

        $q->orderByDesc('deleted_at');
        $filename = 'papelera_' . $entidad . '_' . date('Y-m-d_H-i-s') . '.csv';

        return response()->stream(function () use ($q, $cfg) {
            set_time_limit(0);
            if (ob_get_level()) ob_end_clean();
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF"); // BOM UTF-8

            $headers = array_values($cfg['display']);
            fputcsv($handle, $headers, ';');
            fflush($handle);

            $cols = array_keys($cfg['display']);
            $q->chunk(500, function ($rows) use ($handle, $cols) {
                foreach ($rows as $row) {
                    $line = [];
                    foreach ($cols as $c) {
                        $val = $row->{$c} ?? '';
                        $line[] = is_numeric($val) ? $val : (string) $val;
                    }
                    fputcsv($handle, $line, ';');
                }
                fflush($handle);
                flush();
            });

            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }
}
