<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Jobs\SyncInsurerJob;
use App\Models\Broker;
use App\Models\SyncJob;
use App\Services\InsurerSyncService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class InsurerSyncController extends Controller
{
    public function __construct(private readonly InsurerSyncService $syncService)
    {
    }

    public function sync(Request $request)
    {
        try {
            $request->validate([
                'insurers' => 'required|array|min:1',
                'insurers.*' => 'string',
                'types' => 'required|array|min:1',
                'types.*' => 'string|in:clientes,polizas,cartera,comisiones',
            ]);

            $brokerId = $this->resolveBrokerId($request);
            $types = $request->input('types');
            $batchId = Str::uuid()->toString();

            foreach ($request->input('insurers') as $insurerCode) {
                $syncJob = SyncJob::create([
                    'batch_id' => $batchId,
                    'broker_id' => $brokerId,
                    'insurer_code' => $insurerCode,
                    'types' => $types,
                    'status' => 'pending',
                ]);

                // Always dispatch async — never block the HTTP process.
                // Requires: php artisan queue:work --queue=default --timeout=600
                SyncInsurerJob::dispatch(
                    $syncJob->id,
                    $brokerId,
                    $insurerCode,
                    $types,
                );
            }

            return response()->json([
                'success' => true,
                'message' => 'Sincronización iniciada',
                'data' => ['batch_id' => $batchId],
            ], 202);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de sincronización inválidos',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al iniciar la sincronización',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function status(string $batchId)
    {
        $jobs = SyncJob::forBatch($batchId)->get();

        if ($jobs->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Batch no encontrado',
            ], 404);
        }

        $details = [];
        $totals = [
            'clientes_created' => 0, 'clientes_updated' => 0, 'clientes_unchanged' => 0, 'clientes_skipped_manual' => 0, 'clientes_fetched' => 0, 'clientes_errors' => 0,
            'polizas_created' => 0, 'polizas_updated' => 0, 'polizas_unchanged' => 0, 'polizas_skipped_manual' => 0, 'polizas_fetched' => 0, 'polizas_errors' => 0,
            'cartera_created' => 0, 'cartera_updated' => 0, 'cartera_unchanged' => 0, 'cartera_skipped_manual' => 0, 'cartera_fetched' => 0, 'cartera_errors' => 0,
            'comisiones_created' => 0, 'comisiones_updated' => 0, 'comisiones_unchanged' => 0, 'comisiones_skipped_manual' => 0, 'comisiones_fetched' => 0, 'comisiones_errors' => 0,
        ];

        foreach ($jobs as $job) {
            $progress = $job->progress ?? [];

            // Acumular siempre que haya progress (también durante processing) para
            // que la UI muestre avance en vivo, no solo al terminar.
            if (!empty($progress)) {
                foreach (['clientes', 'polizas', 'cartera', 'comisiones'] as $type) {
                    if (isset($progress[$type])) {
                        $totals["{$type}_created"] += $progress[$type]['created'] ?? 0;
                        $totals["{$type}_updated"] += $progress[$type]['updated'] ?? 0;
                        $totals["{$type}_unchanged"] += $progress[$type]['unchanged'] ?? 0;
                        $totals["{$type}_skipped_manual"] += $progress[$type]['skipped_manual'] ?? 0;
                        $totals["{$type}_fetched"] += $progress[$type]['total_fetched'] ?? 0;
                        $totals["{$type}_errors"] += $progress[$type]['errors'] ?? 0;
                    }
                }
                // Insurers that derive clients/polizas from cartera (e.g. Mundial):
                // their counts live inside progress['cartera'], not progress['clientes'/'polizas'].
                $carteraProgress = $progress['cartera'] ?? [];
                $derivedCC = (int) ($carteraProgress['clientes_created'] ?? 0);
                $derivedCU = (int) ($carteraProgress['clientes_updated'] ?? 0);
                $derivedPC = (int) ($carteraProgress['polizas_created'] ?? 0);
                $derivedPU = (int) ($carteraProgress['polizas_updated'] ?? 0);
                $totals['clientes_created'] += $derivedCC;
                $totals['clientes_updated'] += $derivedCU;
                $totals['clientes_fetched'] += $derivedCC + $derivedCU;
                $totals['polizas_created']  += $derivedPC;
                $totals['polizas_updated']  += $derivedPU;
                $totals['polizas_fetched']  += $derivedPC + $derivedPU;
            }

            $details[$job->insurer_code] = [
                'status' => $job->status,
                'progress' => $progress,
                'error' => $job->error,
                'started_at' => $job->started_at?->toIso8601String(),
                'completed_at' => $job->completed_at?->toIso8601String(),
            ];
        }

        $overallStatus = SyncJob::overallStatus($batchId);

        return response()->json([
            'success' => true,
            'data' => [
                'batch_id' => $batchId,
                'overall_status' => $overallStatus,
                'totals' => $totals,
                'details' => $details,
            ],
        ]);
    }

    public function history(Request $request)
    {
        $brokerId = $this->resolveBrokerId($request);
        $limit = (int) $request->input('limit', 20);

        $batches = SyncJob::where('broker_id', $brokerId)
            ->selectRaw('batch_id, MIN(created_at) as started, MAX(completed_at) as finished')
            ->groupBy('batch_id')
            ->orderByDesc('started')
            ->limit($limit)
            ->get();

        $result = [];
        foreach ($batches as $batch) {
            $jobs = SyncJob::forBatch($batch->batch_id)->get();
            $overall = SyncJob::overallStatus($batch->batch_id);

            $insurers = [];
            foreach ($jobs as $j) {
                $insurers[$j->insurer_code] = [
                    'status' => $j->status,
                    'types' => $j->types,
                    'progress' => $j->progress,
                    'error' => $j->error,
                ];
            }

            $result[] = [
                'batch_id' => $batch->batch_id,
                'overall_status' => $overall,
                'started_at' => $batch->started,
                'finished_at' => $batch->finished,
                'insurers' => $insurers,
            ];
        }

        return response()->json(['success' => true, 'data' => $result]);
    }

    public function cancel(Request $request, string $batchId)
    {
        $brokerId = $this->resolveBrokerId($request);
        $jobs = SyncJob::forBatch($batchId)
            ->where('broker_id', $brokerId)
            ->get();

        if ($jobs->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Batch no encontrado',
            ], 404);
        }

        $cancellable = $jobs->filter(fn($job) => in_array($job->status, ['pending', 'processing'], true));
        foreach ($cancellable as $job) {
            $job->markCancelled(
                'Sincronización detenida por el usuario.',
                is_array($job->progress) ? $job->progress : null,
            );
        }

        return response()->json([
            'success' => true,
            'message' => $cancellable->count() > 0
                ? 'Sincronización detenida correctamente.'
                : 'El batch ya estaba finalizado.',
            'data' => [
                'batch_id' => $batchId,
                'cancelled_jobs' => $cancellable->count(),
                'overall_status' => SyncJob::overallStatus($batchId),
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
            if ($devBrokerId) {
                return (int) $devBrokerId;
            }
            $firstBroker = Broker::first();
            if ($firstBroker) {
                return (int) $firstBroker->id;
            }
        }

        throw new \RuntimeException('No se pudo resolver broker_id para la solicitud.');
    }
}
