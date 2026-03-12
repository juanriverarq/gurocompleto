<?php

namespace App\Console\Commands;

use App\Models\ReciboCaja;
use App\Models\Poliza;
use App\Models\Cliente;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BackfillRecibosCajaFields extends Command
{
    protected $signature = 'recibos:backfill
        {--broker= : Broker ID (default: first active)}
        {--from-api : Re-fetch from Softseguros API to fill missing fields}
        {--dry-run : Show what would be updated without changing anything}';

    protected $description = 'Backfill denormalized fields on existing recibos_caja records from local relations and optionally from the Softseguros API';

    private string $ssBaseUrl = 'https://app.softseguros.com';

    public function handle(): int
    {
        $brokerId = $this->option('broker') ?: \App\Models\Broker::query()->orderBy('id')->value('id');
        if (!$brokerId) {
            $this->error('No broker found');
            return 1;
        }

        $dryRun = $this->option('dry-run');
        $fromApi = $this->option('from-api');

        $this->info("Broker ID: {$brokerId}" . ($dryRun ? ' [DRY RUN]' : ''));

        // Step 1: Backfill from local relations (poliza, cliente)
        $this->backfillFromRelations($brokerId, $dryRun);

        // Step 2: Optionally re-fetch from Softseguros API
        if ($fromApi) {
            $this->backfillFromApi($brokerId, $dryRun);
        }

        $this->info('Done!');
        return 0;
    }

    private function backfillFromRelations(int $brokerId, bool $dryRun): void
    {
        $this->info('── Step 1: Backfill from local relations ──');

        $totalNeed = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->where(function ($q) {
                $q->whereNull('cliente_nombre')
                  ->orWhere('cliente_nombre', '')
                  ->orWhereNull('poliza_numero')
                  ->orWhere('poliza_numero', '');
            })
            ->count();

        $this->info("  Records needing relation backfill: {$totalNeed}");
        $updated = 0;

        ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->where(function ($q) {
                $q->whereNull('cliente_nombre')
                  ->orWhere('cliente_nombre', '')
                  ->orWhereNull('poliza_numero')
                  ->orWhere('poliza_numero', '');
            })
            ->select('id', 'poliza_id', 'cliente_id', 'cliente_nombre', 'poliza_numero', 'aseguradora_nombre', 'ramo_nombre')
            ->chunkById(500, function ($recibos) use ($brokerId, $dryRun, &$updated) {
                // Collect IDs needed for this chunk
                $polizaIds = $recibos->pluck('poliza_id')->filter()->unique()->values()->toArray();
                $clienteIds = $recibos->pluck('cliente_id')->filter()->unique()->values()->toArray();

                $polizas = !empty($polizaIds)
                    ? Poliza::withoutGlobalScopes()->whereIn('id', $polizaIds)
                        ->select('id', 'policy_number', 'aseguradora_id', 'ramo_id')
                        ->with(['aseguradora:id,nombre', 'ramo:id,nombre'])
                        ->get()->keyBy('id')
                    : collect();

                $clientes = !empty($clienteIds)
                    ? Cliente::withoutGlobalScopes()->whereIn('id', $clienteIds)
                        ->select('id', 'first_name', 'last_name', 'company', 'document_number')
                        ->get()->keyBy('id')
                    : collect();

                foreach ($recibos as $recibo) {
                    $changes = [];

                    if (empty($recibo->cliente_nombre) && $recibo->cliente_id) {
                        $cliente = $clientes->get($recibo->cliente_id);
                        if ($cliente) {
                            $nombre = trim(($cliente->first_name ?? '') . ' ' . ($cliente->last_name ?? ''));
                            if (!$nombre) $nombre = $cliente->company;
                            if ($nombre) $changes['cliente_nombre'] = $nombre;
                            if ($cliente->document_number) $changes['cliente_documento'] = $cliente->document_number;
                        }
                    }

                    if (empty($recibo->poliza_numero) && $recibo->poliza_id) {
                        $poliza = $polizas->get($recibo->poliza_id);
                        if ($poliza) {
                            if ($poliza->policy_number) $changes['poliza_numero'] = $poliza->policy_number;
                            if ($poliza->aseguradora && empty($recibo->aseguradora_nombre)) {
                                $changes['aseguradora_nombre'] = $poliza->aseguradora->nombre;
                            }
                            if ($poliza->ramo && empty($recibo->ramo_nombre)) {
                                $changes['ramo_nombre'] = $poliza->ramo->nombre;
                            }
                        }
                    }

                    if (!empty($changes)) {
                        if (!$dryRun) {
                            ReciboCaja::withoutGlobalScopes()->where('id', $recibo->id)->update($changes);
                        }
                        $updated++;
                    }
                }
            });

        $this->info("  Updated from relations: {$updated}" . ($dryRun ? ' (dry run)' : ''));
    }

    private function backfillFromApi(int $brokerId, bool $dryRun): void
    {
        $this->info('── Step 2: Backfill from Softseguros API ──');

        // Get SS token from broker settings
        $broker = \App\Models\Broker::find($brokerId);
        $token = $broker->settings['softseguros']['token'] ?? null;
        if (!$token) {
            $this->error('  No Softseguros token found in broker settings. Run a sync first.');
            return;
        }

        // Process each recaudo subtype
        foreach (['recaudos-activos', 'recaudos-directos', 'recaudos-anulados'] as $ssTipo) {
            $this->backfillRecaudosFromApi($brokerId, $token, $ssTipo, $dryRun);
        }

        // Process recibos/anticipos
        $this->backfillRecibosFromApi($brokerId, $token, $dryRun);
    }

    private function backfillRecaudosFromApi(int $brokerId, string $token, string $ssTipo, bool $dryRun): void
    {
        $this->info("  Fetching {$ssTipo} from SS API...");

        // Get all softseguros_recaudo_ids that are missing fields
        $missingIds = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNotNull('softseguros_recaudo_id')
            ->where(function ($q) {
                $q->whereNull('numero_pago')
                  ->orWhereNull('cliente_nombre')
                  ->orWhere('cliente_nombre', '')
                  ->orWhereNull('poliza_numero')
                  ->orWhere('poliza_numero', '');
            })
            ->pluck('softseguros_recaudo_id')
            ->flip()
            ->toArray();

        if (empty($missingIds)) {
            $this->info("    No records need API backfill for {$ssTipo}");
            return;
        }

        $this->info("    Records needing backfill: " . count($missingIds));

        $page = 1;
        $updated = 0;
        $checked = 0;

        while (true) {
            $response = $this->ssGet($token, "{$this->ssBaseUrl}/api/recaudopagopoliza/list_recaudo_filtro_paginados/", [
                'sede' => -1, 'texto_busqueda' => '', 'tipo_busqueda_recibos' => -1,
                'anticipos_aplicados' => -1, 'marca_usuario' => -1, 'tipo_recaudo' => '',
                'field_search' => 'created_at', 'tipo' => $ssTipo,
                'order_by' => 'recaudo__numero_recibo', 'sort_by' => 'desc',
                'page' => $page,
            ]);

            if (!$response || !$response->successful()) {
                $this->warn("    API error on page {$page}, stopping.");
                break;
            }

            $json = $response->json();
            $results = $json['results'] ?? [];
            if (empty($results)) break;

            foreach ($results as $row) {
                $ssId = $row['id'] ?? null;
                if (!$ssId || !isset($missingIds[$ssId])) continue;

                $changes = [];
                if (!empty($row['pago_numero_pago'])) $changes['numero_pago'] = $row['pago_numero_pago'];
                if (!empty($row['pago_poliza_consecutivo'])) $changes['pago_poliza_consecutivo'] = $row['pago_poliza_consecutivo'];
                if (!empty($row['cliente_nombre_completo'])) $changes['cliente_nombre'] = $row['cliente_nombre_completo'];
                if (!empty($row['cliente_numero_documento'])) $changes['cliente_documento'] = $row['cliente_numero_documento'];
                if (!empty($row['poliza_numero_poliza'])) $changes['poliza_numero'] = $row['poliza_numero_poliza'];
                if (!empty($row['poliza_objeto_asegurado'])) $changes['poliza_objeto_asegurado'] = $row['poliza_objeto_asegurado'];
                if (!empty($row['aseguradora_nombre'])) $changes['aseguradora_nombre'] = $row['aseguradora_nombre'];
                if (!empty($row['ramo_nombre'])) $changes['ramo_nombre'] = $row['ramo_nombre'];
                if (!empty($row['sede_nombre'])) $changes['sede_nombre'] = $row['sede_nombre'];
                if (!empty($row['usuario_recauda'])) $changes['usuario_recauda'] = $row['usuario_recauda'];

                if (!empty($changes) && !$dryRun) {
                    ReciboCaja::withoutGlobalScopes()
                        ->where('broker_id', $brokerId)
                        ->where('softseguros_recaudo_id', $ssId)
                        ->update($changes);
                    $updated++;
                } elseif (!empty($changes)) {
                    $updated++;
                }

                $checked++;
                // Remove from missing set — once all found, we can stop
                unset($missingIds[$ssId]);
            }

            if (empty($missingIds)) break;
            if (empty($json['next']) || $json['next'] === 'null') break;

            $page++;

            if ($page % 50 === 0) {
                $this->info("    Page {$page}, updated {$updated}, remaining " . count($missingIds));
            }

            usleep(200000); // 200ms between requests
        }

        $this->info("    {$ssTipo}: checked {$checked}, updated {$updated}" . ($dryRun ? ' (dry run)' : ''));
    }

    private function backfillRecibosFromApi(int $brokerId, string $token, bool $dryRun): void
    {
        $this->info("  Fetching recibos_anticipos from SS API...");

        // Get all softseguros_ids that are missing fields
        $missingIds = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNotNull('softseguros_id')
            ->where(function ($q) {
                $q->whereNull('cliente_nombre')
                  ->orWhere('cliente_nombre', '')
                  ->orWhereNull('numero_pago');
            })
            ->pluck('softseguros_id')
            ->flip()
            ->toArray();

        if (empty($missingIds)) {
            $this->info("    No recibos need API backfill");
            return;
        }

        $this->info("    Recibos needing backfill: " . count($missingIds));

        $page = 1;
        $updated = 0;

        while (true) {
            $response = $this->ssGet($token, "{$this->ssBaseUrl}/api/pagopoliza/list_recibos_filtro_paginados/", [
                'sede' => -1, 'texto_busqueda' => '', 'tipo_busqueda_recibos' => -1,
                'anticipos_aplicados' => -1, 'marca_usuario' => -1, 'tipo_recaudo' => '',
                'field_search' => 'created_at', 'tipo' => 'recibos_anticipos',
                'order_by' => 'fecha_realizo_pago_oficina', 'sort_by' => 'asc',
                'page' => $page,
            ]);

            if (!$response || !$response->successful()) {
                $this->warn("    API error on page {$page}, stopping.");
                break;
            }

            $json = $response->json();
            $results = $json['results'] ?? [];
            if (empty($results)) break;

            foreach ($results as $row) {
                $ssId = $row['id'] ?? null;
                if (!$ssId || !isset($missingIds[$ssId])) continue;

                $changes = [];
                $nombre = trim(($row['cliente_nombres'] ?? '') . ' ' . ($row['cliente_apellidos'] ?? ''));
                if ($nombre) $changes['cliente_nombre'] = $nombre;
                if (!empty($row['cliente_numero_documento'])) $changes['cliente_documento'] = $row['cliente_numero_documento'];
                if (!empty($row['vendedores_nombre'])) $changes['vendedor_nombre'] = $row['vendedores_nombre'];
                if (!empty($row['numero_pago'])) $changes['numero_pago'] = $row['numero_pago'];

                if (!empty($changes) && !$dryRun) {
                    ReciboCaja::withoutGlobalScopes()
                        ->where('broker_id', $brokerId)
                        ->where('softseguros_id', $ssId)
                        ->update($changes);
                    $updated++;
                } elseif (!empty($changes)) {
                    $updated++;
                }

                unset($missingIds[$ssId]);
            }

            if (empty($missingIds)) break;
            if (empty($json['next']) || $json['next'] === 'null') break;

            $page++;

            if ($page % 50 === 0) {
                $this->info("    Page {$page}, updated {$updated}, remaining " . count($missingIds));
            }

            usleep(200000);
        }

        $this->info("    Recibos: updated {$updated}" . ($dryRun ? ' (dry run)' : ''));
    }

    private function ssGet(string $token, string $url, array $params = []): ?\Illuminate\Http\Client\Response
    {
        $maxRetries = 3;
        for ($attempt = 0; $attempt <= $maxRetries; $attempt++) {
            $response = Http::timeout(30)
                ->withHeaders(['Authorization' => "Token {$token}"])
                ->get($url, $params);

            if ($response->status() !== 429) {
                return $response;
            }

            $wait = pow(2, $attempt + 1);
            $this->warn("    Rate limited, waiting {$wait}s...");
            sleep($wait);
        }

        return $response ?? null;
    }
}
