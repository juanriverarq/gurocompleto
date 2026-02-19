<?php

namespace App\Traits;

use App\Models\Broker;
use App\Models\Poliza;
use App\Models\Cliente;
use App\Models\Siniestro;
use App\Models\Subscription;
use Illuminate\Support\Facades\Schema;

trait ChecksStorageLimit
{
    /**
     * Calculate total storage used by a broker (in bytes) from document JSON columns.
     */
    protected function calculateStorageUsedBytes(int $brokerId): int
    {
        $totalBytes = 0;

        // 1. Pólizas → documents
        $polizaDocs = Poliza::where('broker_id', $brokerId)
            ->whereNotNull('documents')
            ->pluck('documents');
        foreach ($polizaDocs as $docs) {
            $arr = is_array($docs) ? $docs : (is_string($docs) ? json_decode($docs, true) : []);
            if (!is_array($arr)) continue;
            foreach ($arr as $doc) {
                if (is_object($doc)) $doc = (array) $doc;
                if (isset($doc['size'])) $totalBytes += (int) $doc['size'];
            }
        }

        // 2. Clientes → documents
        $clienteDocs = Cliente::where('broker_id', $brokerId)
            ->whereNotNull('documents')
            ->pluck('documents');
        foreach ($clienteDocs as $docs) {
            $arr = is_array($docs) ? $docs : (is_string($docs) ? json_decode($docs, true) : []);
            if (!is_array($arr)) continue;
            foreach ($arr as $doc) {
                if (is_object($doc)) $doc = (array) $doc;
                if (isset($doc['size'])) $totalBytes += (int) $doc['size'];
            }
        }

        // 3. Siniestros → archivos_adjuntos
        if (Schema::hasTable('siniestros')) {
            $siniestroDocs = Siniestro::where('broker_id', $brokerId)
                ->whereNotNull('archivos_adjuntos')
                ->pluck('archivos_adjuntos');
            foreach ($siniestroDocs as $docs) {
                $arr = is_array($docs) ? $docs : (is_string($docs) ? json_decode($docs, true) : []);
                if (!is_array($arr)) continue;
                foreach ($arr as $doc) {
                    if (is_object($doc)) $doc = (array) $doc;
                    if (isset($doc['size'])) $totalBytes += (int) $doc['size'];
                }
            }
        }

        return $totalBytes;
    }

    /**
     * Get the storage limit in bytes for a broker.
     */
    protected function getStorageLimitBytes(int $brokerId): int
    {
        $broker = Broker::find($brokerId);
        if (!$broker) return 10 * 1024 * 1024 * 1024; // 10 GB default

        $settings = $broker->settings ?? [];
        $storageGb = is_array($settings) ? ($settings['storage_gb'] ?? 10) : 10;

        // Check subscription override
        if ($broker->owner_id) {
            $sub = Subscription::where('user_id', $broker->owner_id)
                ->whereIn('status', ['active', 'trialing'])
                ->orderBy('created_at', 'desc')
                ->first();
            if ($sub && $sub->storage_gb) {
                $storageGb = $sub->storage_gb;
            }
        }

        return (int) ($storageGb * 1024 * 1024 * 1024);
    }

    /**
     * Check if uploading additional bytes would exceed the storage limit.
     * Returns null if OK, or a JSON response if limit exceeded.
     */
    protected function checkStorageLimit(int $brokerId, int $additionalBytes = 0): ?\Illuminate\Http\JsonResponse
    {
        try {
            $usedBytes = $this->calculateStorageUsedBytes($brokerId);
            $limitBytes = $this->getStorageLimitBytes($brokerId);

            if (($usedBytes + $additionalBytes) > $limitBytes) {
                $usedGB = round($usedBytes / (1024 * 1024 * 1024), 2);
                $limitGB = round($limitBytes / (1024 * 1024 * 1024), 1);
                return response()->json([
                    'success' => false,
                    'message' => "Has alcanzado el límite de almacenamiento ({$usedGB} GB de {$limitGB} GB). Mejora tu plan para obtener más espacio.",
                    'storage' => [
                        'used_gb' => $usedGB,
                        'limit_gb' => $limitGB,
                    ],
                ], 403);
            }
        } catch (\Throwable $e) {
            // Don't block uploads if storage check fails
        }

        return null;
    }
}
