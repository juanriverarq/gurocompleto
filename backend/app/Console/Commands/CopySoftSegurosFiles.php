<?php

namespace App\Console\Commands;

use App\Models\Broker;
use App\Models\Cliente;
use App\Models\Poliza;
use App\Models\Siniestro;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Storage as FirebaseStorageContract;

class CopySoftSegurosFiles extends Command
{
    protected $signature = 'ss:copy-files
        {broker_id : The broker ID to process}
        {--limit=0 : Limit number of files to process (0 = all)}
        {--dry-run : Show what would be copied without actually copying}
        {--entity=all : Entity to process (polizas, clientes, siniestros, all)}
        {--force : Re-download even if already in Firebase}';

    protected $description = 'Download SoftSeguros documents via SS API and upload to Firebase Storage';

    private $bucket;
    private int $copied = 0;
    private int $skipped = 0;
    private int $failed = 0;
    private int $alreadyInFirebase = 0;
    private ?string $ssToken = null;
    private ?int $ssUserId = null;

    public function handle(): int
    {
        $brokerId = (int) $this->argument('broker_id');
        $limit = (int) $this->option('limit');
        $dryRun = $this->option('dry-run');
        $entity = $this->option('entity');
        $force = $this->option('force');

        $this->info("Syncing SoftSeguros docs → Firebase Storage");
        $this->info("   Broker: {$brokerId} | Entity: {$entity} | Limit: " . ($limit ?: 'all'));
        if ($dryRun) $this->warn("   DRY RUN — no files will be copied");

        // Get SS auth
        if (!$this->initSsAuth($brokerId)) {
            $this->error("No SoftSeguros credentials found for broker {$brokerId}.");
            $this->error("The user must authenticate via SoftSeguros import first.");
            return 1;
        }
        $this->info("   SS User ID: {$this->ssUserId}");

        // Init Firebase
        if (!$dryRun) {
            if (!$this->initFirebase()) return 1;
            $this->info("   Firebase bucket: {$this->bucket->name()}");
        }

        if (in_array($entity, ['polizas', 'all'])) {
            $this->processEntity(Poliza::class, 'documents', $brokerId, $limit, $dryRun, $force);
            if ($limit && ($this->copied + $this->failed) >= $limit) { $this->printSummary(); return 0; }
        }

        if (in_array($entity, ['clientes', 'all'])) {
            $this->processEntity(Cliente::class, 'documents', $brokerId, $limit, $dryRun, $force);
            if ($limit && ($this->copied + $this->failed) >= $limit) { $this->printSummary(); return 0; }
        }

        if (in_array($entity, ['siniestros', 'all'])) {
            $this->processEntity(Siniestro::class, 'archivos_adjuntos', $brokerId, $limit, $dryRun, $force);
        }

        $this->printSummary();
        return 0;
    }

    private function initSsAuth(int $brokerId): bool
    {
        $broker = Broker::find($brokerId);
        if (!$broker) return false;

        $settings = $broker->settings ?? [];
        $ss = $settings['softseguros'] ?? null;
        if (!$ss) return false;

        // Try re-auth with credentials first
        if (!empty($ss['username']) && !empty($ss['password'])) {
            try {
                $username = decrypt($ss['username']);
                $password = decrypt($ss['password']);
                $response = Http::timeout(15)->post('https://app.softseguros.com/api-token-auth/', [
                    'username' => $username,
                    'password' => $password,
                ]);
                if ($response->successful()) {
                    $data = $response->json();
                    $this->ssToken = $data['token'] ?? null;
                    $this->ssUserId = $data['user_id'] ?? $data['id'] ?? $ss['user_id'] ?? null;
                    // Update stored token
                    $settings['softseguros']['token'] = $this->ssToken;
                    $settings['softseguros']['token_at'] = now()->toISOString();
                    $broker->settings = $settings;
                    $broker->save();
                    $this->info("   Authenticated with SS credentials");
                    return (bool) $this->ssToken && (bool) $this->ssUserId;
                }
            } catch (\Throwable $e) {
                $this->warn("   SS credential auth failed: " . $e->getMessage());
            }
        }

        // Fallback: use stored token
        $this->ssToken = $ss['token'] ?? null;
        $this->ssUserId = $ss['user_id'] ?? null;

        return (bool) $this->ssToken && (bool) $this->ssUserId;
    }

    private function initFirebase(): bool
    {
        try {
            $firebaseStorage = app(FirebaseStorageContract::class);
            $bucketName = env('FIREBASE_STORAGE_BUCKET') ?: config('firebase.storage_bucket');
            $projectId = config('firebase.project_id') ?: env('FIREBASE_PROJECT_ID');
            $candidates = array_filter([
                $bucketName,
                $projectId ? ($projectId . '.appspot.com') : null,
                $projectId ? ($projectId . '.firebasestorage.app') : null,
            ]);
            foreach ($candidates as $name) {
                try {
                    $b = $firebaseStorage->getBucket($name);
                    if (method_exists($b, 'exists') && $b->exists()) {
                        $this->bucket = $b;
                        break;
                    }
                } catch (\Throwable $e) {}
            }
            if (!$this->bucket) $this->bucket = $firebaseStorage->getBucket();
            return true;
        } catch (\Throwable $e) {
            $this->error("Firebase Storage not available: " . $e->getMessage());
            return false;
        }
    }

    private function processEntity(string $modelClass, string $docsField, int $brokerId, int $limit, bool $dryRun, bool $force): void
    {
        $entityName = class_basename($modelClass);
        $this->info("\n── {$entityName} ──");

        $query = $modelClass::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNotNull($docsField)
            ->where($docsField, 'like', '%softseguros%');

        $total = $query->count();
        $this->info("   Records with SS docs: {$total}");

        $isWeb = !$this->output->isDecorated() && app()->runningInConsole() === false;
        $bar = null;
        if (!$isWeb) {
            try {
                $bar = $this->output->createProgressBar($total);
                $bar->start();
            } catch (\Throwable $e) { $bar = null; }
        }

        $query->chunkById(50, function ($records) use ($docsField, $limit, $dryRun, $force, $bar, $entityName) {
            foreach ($records as $record) {
                $docs = $record->{$docsField};
                if (!is_array($docs)) { if ($bar) $bar->advance(); continue; }

                $modified = false;
                foreach ($docs as $i => $doc) {
                    if (is_object($doc)) $doc = (array) $doc;
                    if (($doc['source'] ?? '') !== 'softseguros') continue;

                    $fbPath = $doc['path'] ?? null;
                    if (!$fbPath) { $this->skipped++; continue; }

                    // Check if already in Firebase
                    if (!$force && !$dryRun) {
                        try {
                            $obj = $this->bucket->object($fbPath);
                            if ($obj->exists()) {
                                $this->alreadyInFirebase++;
                                continue;
                            }
                        } catch (\Throwable $e) {}
                    }

                    $anexoId = $doc['softseguros_anexo_id'] ?? null;
                    if (!$anexoId) { $this->skipped++; continue; }

                    if ($dryRun) {
                        $this->copied++;
                        continue;
                    }

                    // Download from SS with fresh token
                    $downloadUrl = "https://app.softseguros.com/download/{$anexoId}/{$this->ssUserId}/?session={$this->ssToken}";
                    try {
                        $response = Http::timeout(60)
                            ->withHeaders(['Authorization' => "Token {$this->ssToken}"])
                            ->get($downloadUrl);

                        if (!$response->successful()) {
                            $this->failed++;
                            continue;
                        }

                        $body = $response->body();
                        $ct = $response->header('Content-Type') ?: '';

                        // Verify it's not an HTML error page
                        if (strlen($body) < 100 || str_contains($ct, 'text/html')) {
                            $this->failed++;
                            continue;
                        }

                        // Upload to Firebase
                        $mime = $doc['contentType'] ?? $ct ?: 'application/octet-stream';
                        $this->bucket->upload($body, [
                            'name' => $fbPath,
                            'metadata' => ['contentType' => $mime],
                        ]);

                        // Update doc metadata — mark as synced to firebase
                        $docs[$i]['source'] = 'firebase';
                        $docs[$i]['synced_at'] = now()->toISOString();
                        $docs[$i]['size'] = strlen($body);
                        $modified = true;
                        $this->copied++;
                    } catch (\Throwable $e) {
                        $this->failed++;
                        Log::warning("ss:copy-files failed", [
                            'entity' => $entityName, 'id' => $record->id,
                            'anexo_id' => $anexoId, 'error' => $e->getMessage(),
                        ]);
                    }

                    if ($limit && ($this->copied + $this->failed) >= $limit) break;
                }

                if ($modified) {
                    $record->{$docsField} = array_values($docs);
                    $record->save();
                }

                if ($bar) $bar->advance();
                if ($limit && ($this->copied + $this->failed) >= $limit) return;
            }
        });

        if ($bar) { $bar->finish(); $this->newLine(); }
    }

    private function printSummary(): void
    {
        $this->newLine();
        $this->info("═══════════════════════════════════════");
        $this->info("  Uploaded to Firebase:  {$this->copied}");
        $this->info("  Already in Firebase:   {$this->alreadyInFirebase}");
        $this->info("  Skipped (no anexo):    {$this->skipped}");
        if ($this->failed > 0) {
            $this->warn("  Failed:                {$this->failed}");
        }
        $this->info("═══════════════════════════════════════");
    }

    /**
     * Static helper: get sync status counts for a broker.
     * Used by the API endpoint.
     */
    public static function getSyncStatus(int $brokerId): array
    {
        $stats = [
            'polizas' => ['total' => 0, 'firebase' => 0, 'softseguros' => 0],
            'clientes' => ['total' => 0, 'firebase' => 0, 'softseguros' => 0],
            'siniestros' => ['total' => 0, 'firebase' => 0, 'softseguros' => 0],
        ];

        $entities = [
            'polizas' => [Poliza::class, 'documents'],
            'clientes' => [Cliente::class, 'documents'],
            'siniestros' => [Siniestro::class, 'archivos_adjuntos'],
        ];

        foreach ($entities as $key => [$modelClass, $docsField]) {
            $records = $modelClass::withoutGlobalScopes()
                ->where('broker_id', $brokerId)
                ->whereNotNull($docsField)
                ->where($docsField, 'like', '%softseguros%')
                ->select(['id', $docsField])
                ->get();

            foreach ($records as $record) {
                $docs = $record->{$docsField};
                if (!is_array($docs)) continue;
                foreach ($docs as $doc) {
                    if (is_object($doc)) $doc = (array) $doc;
                    $source = $doc['source'] ?? '';
                    if ($source === 'softseguros') {
                        $stats[$key]['total']++;
                        $stats[$key]['softseguros']++;
                    } elseif ($source === 'firebase' && !empty($doc['softseguros_anexo_id'])) {
                        $stats[$key]['total']++;
                        $stats[$key]['firebase']++;
                    }
                }
            }
        }

        $stats['total'] = [
            'total' => $stats['polizas']['total'] + $stats['clientes']['total'] + $stats['siniestros']['total'],
            'firebase' => $stats['polizas']['firebase'] + $stats['clientes']['firebase'] + $stats['siniestros']['firebase'],
            'softseguros' => $stats['polizas']['softseguros'] + $stats['clientes']['softseguros'] + $stats['siniestros']['softseguros'],
        ];

        return $stats;
    }
}
