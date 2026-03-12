<?php

namespace App\Traits;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

/**
 * Streams a document from Firebase Storage or external URL (SoftSeguros / Azure).
 * Resolves the "expired token" issue by always going through the backend.
 */
trait StreamsDocuments
{
    /**
     * Stream a document directly to the browser.
     *
     * @param  object  $bucket        Google Cloud Storage bucket
     * @param  array   $doc           Document metadata array (path, url, azure_url, ss_download_url, contentType, name, source, softseguros_anexo_id)
     * @param  int|null $brokerId     Broker ID (needed for SS re-auth)
     * @return \Symfony\Component\HttpFoundation\StreamedResponse|\Illuminate\Http\JsonResponse
     */
    protected function streamFromBucketOrFallback($bucket, array $doc, ?int $brokerId = null)
    {
        $path = $doc['path'] ?? null;
        $name = $doc['name'] ?? basename($path ?? 'document');
        $contentType = $doc['contentType'] ?? 'application/octet-stream';

        // 1. Try Firebase Storage first
        if ($path) {
            try {
                $object = $bucket->object($path);
                if ($object->exists()) {
                    $stream = $object->downloadAsStream();

                    return response()->stream(function () use ($stream) {
                        while (!$stream->eof()) {
                            echo $stream->read(8192);
                            flush();
                        }
                    }, 200, [
                        'Content-Type' => $contentType,
                        'Content-Disposition' => 'inline; filename="' . addslashes($name) . '"',
                        'Cache-Control' => 'private, max-age=3600',
                        'X-Source' => 'firebase-storage',
                    ]);
                }
            } catch (\Throwable $e) {
                Log::warning('[StreamsDocuments] Firebase download failed, trying fallback', [
                    'path' => $path,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // 2. SoftSeguros documents: re-authenticate and download with fresh token
        $isSsDoc = ($doc['source'] ?? null) === 'softseguros';
        $ssAnexoId = $doc['softseguros_anexo_id'] ?? null;

        if ($isSsDoc && $ssAnexoId && $brokerId) {
            $downloadResult = $this->downloadFromSoftSeguros($brokerId, (int) $ssAnexoId, $contentType, $name);
            if ($downloadResult) {
                return $downloadResult;
            }
        }

        // 3. Try any stored URL directly (azure_url, url) — may work if public
        $directUrls = array_filter([
            $doc['azure_url'] ?? null,
            $doc['url'] ?? null,
        ]);

        foreach ($directUrls as $directUrl) {
            // Skip SS download URLs (they need session auth handled above)
            if (str_contains($directUrl, 'softseguros.com/download')) continue;

            try {
                $response = Http::timeout(30)->get($directUrl);
                if ($response->successful()) {
                    $body = $response->body();
                    $detectedType = $response->header('Content-Type') ?: $contentType;
                    if (strlen($body) > 100 && !str_contains($detectedType, 'text/html')) {
                        return response($body, 200, [
                            'Content-Type' => $detectedType,
                            'Content-Disposition' => 'inline; filename="' . addslashes($name) . '"',
                            'Content-Length' => strlen($body),
                            'Cache-Control' => 'private, max-age=3600',
                            'X-Source' => 'external-proxy',
                        ]);
                    }
                }
            } catch (\Throwable $e) {
                // Continue to next URL
            }
        }

        // 4. Last resort: return a fresh signed URL (short-lived)
        if ($path) {
            try {
                $object = $bucket->object($path);
                if ($object->exists()) {
                    $url = $object->signedUrl((new \DateTimeImmutable('+30 minutes')), ['version' => 'v4']);
                    return response()->json(['success' => true, 'data' => ['url' => $url, 'redirect' => true]]);
                }
            } catch (\Throwable $e) {
                // Already tried above
            }
        }

        return response()->json(['success' => false, 'message' => 'No se pudo obtener el documento. Si es un documento importado de SoftSeguros, vuelve a conectar tu cuenta en la sección de importación.'], 404);
    }

    /**
     * Download a file from SoftSeguros using stored credentials.
     * Gets a fresh token (cached 23h), builds the download URL, and proxies the file.
     */
    private function downloadFromSoftSeguros(int $brokerId, int $anexoId, string $contentType, string $name)
    {
        try {
            $ssAuth = $this->getSsAuth($brokerId);
            if (!$ssAuth) {
                Log::warning('[StreamsDocuments] No SS credentials for broker', ['broker_id' => $brokerId]);
                return null;
            }

            $token = $ssAuth['token'];
            $userId = $ssAuth['user_id'];

            // Build fresh download URL with the fresh session/token
            $downloadUrl = "https://app.softseguros.com/download/{$anexoId}/{$userId}/?session={$token}";

            $response = Http::timeout(30)
                ->withHeaders(['Authorization' => "Token {$token}"])
                ->get($downloadUrl);

            if ($response->successful()) {
                $body = $response->body();
                $detectedType = $response->header('Content-Type') ?: $contentType;

                // Check it's not an HTML error page
                if (strlen($body) > 100 && !str_contains($detectedType, 'text/html')) {
                    return response($body, 200, [
                        'Content-Type' => $detectedType,
                        'Content-Disposition' => 'inline; filename="' . addslashes($name) . '"',
                        'Content-Length' => strlen($body),
                        'Cache-Control' => 'private, max-age=3600',
                        'X-Source' => 'softseguros-proxy',
                    ]);
                }

                // If we got HTML, the token might be expired — force re-auth
                Cache::forget("ss_auth_broker_{$brokerId}");
                $ssAuth = $this->getSsAuth($brokerId);
                if ($ssAuth) {
                    $downloadUrl = "https://app.softseguros.com/download/{$anexoId}/{$ssAuth['user_id']}/?session={$ssAuth['token']}";
                    $response = Http::timeout(30)
                        ->withHeaders(['Authorization' => "Token {$ssAuth['token']}"])
                        ->get($downloadUrl);

                    if ($response->successful()) {
                        $body = $response->body();
                        $detectedType = $response->header('Content-Type') ?: $contentType;
                        if (strlen($body) > 100 && !str_contains($detectedType, 'text/html')) {
                            return response($body, 200, [
                                'Content-Type' => $detectedType,
                                'Content-Disposition' => 'inline; filename="' . addslashes($name) . '"',
                                'Content-Length' => strlen($body),
                                'Cache-Control' => 'private, max-age=3600',
                                'X-Source' => 'softseguros-proxy-retry',
                            ]);
                        }
                    }
                }
            }

            Log::warning('[StreamsDocuments] SS download failed', [
                'anexo_id' => $anexoId,
                'status' => $response->status(),
            ]);
        } catch (\Throwable $e) {
            Log::error('[StreamsDocuments] SS download exception', [
                'anexo_id' => $anexoId,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * Get a SoftSeguros auth token for a broker.
     * Strategy:
     *   1. Use stored token if available (from last import/authenticate)
     *   2. If credentials (username/password) are stored, re-authenticate for a fresh token
     * Cached for 12 hours to avoid hitting SS API on every document view.
     */
    private function getSsAuth(int $brokerId): ?array
    {
        $cacheKey = "ss_auth_broker_{$brokerId}";

        return Cache::remember($cacheKey, 12 * 60 * 60, function () use ($brokerId) {
            $broker = \App\Models\Broker::find($brokerId);
            if (!$broker) return null;

            $settings = $broker->settings ?? [];
            $ss = $settings['softseguros'] ?? null;
            if (!$ss) return null;

            $userId = $ss['user_id'] ?? null;

            // Strategy 1: If we have credentials, get a fresh token
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
                        $freshToken = $data['token'] ?? null;
                        $freshUserId = $data['user_id'] ?? $data['id'] ?? $userId;

                        if ($freshToken && $freshUserId) {
                            // Update stored token
                            try {
                                $settings['softseguros']['token'] = $freshToken;
                                $settings['softseguros']['token_at'] = now()->toISOString();
                                if ($freshUserId) $settings['softseguros']['user_id'] = $freshUserId;
                                $broker->settings = $settings;
                                $broker->save();
                            } catch (\Throwable $e) {}

                            return ['token' => $freshToken, 'user_id' => $freshUserId];
                        }
                    }
                } catch (\Throwable $e) {
                    Log::warning('[StreamsDocuments] SS re-auth with credentials failed', [
                        'broker_id' => $brokerId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // Strategy 2: Use stored token directly (from last import)
            $storedToken = $ss['token'] ?? null;
            if ($storedToken && $userId) {
                return ['token' => $storedToken, 'user_id' => $userId];
            }

            return null;
        });
    }
}
