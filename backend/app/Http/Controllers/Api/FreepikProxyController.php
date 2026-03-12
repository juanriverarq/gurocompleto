<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FreepikProxyController extends Controller
{
    private function apiKey(): string
    {
        return env('FREEPIK_API_KEY', '');
    }

    /**
     * Proxy GET requests to Freepik API.
     * e.g. /api/freepik/resources?term=... → https://api.freepik.com/v1/resources?term=...
     */
    public function proxyGet(Request $request, string $path)
    {
        $key = $this->apiKey();
        if (!$key) {
            return response()->json(['message' => 'FREEPIK_API_KEY no configurada en .env'], 500);
        }

        $url = 'https://api.freepik.com/v1/' . $path;
        $query = $request->query();

        try {
            $response = Http::withHeaders([
                'x-freepik-api-key' => $key,
                'Accept' => 'application/json',
            ])->timeout(30)->get($url, $query);

            return response($response->body(), $response->status())
                ->header('Content-Type', $response->header('Content-Type', 'application/json'));
        } catch (\Throwable $e) {
            Log::error('[FreepikProxy] GET error', ['url' => $url, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Error conectando con Freepik API'], 502);
        }
    }

    /**
     * Proxy POST requests to Freepik API.
     * e.g. /api/freepik/ai/improve-prompt → https://api.freepik.com/v1/ai/improve-prompt
     */
    public function proxyPost(Request $request, string $path)
    {
        $key = $this->apiKey();
        if (!$key) {
            return response()->json(['message' => 'FREEPIK_API_KEY no configurada en .env'], 500);
        }

        $url = 'https://api.freepik.com/v1/' . $path;

        try {
            $response = Http::withHeaders([
                'x-freepik-api-key' => $key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ])->timeout(30)->post($url, $request->all());

            return response($response->body(), $response->status())
                ->header('Content-Type', $response->header('Content-Type', 'application/json'));
        } catch (\Throwable $e) {
            Log::error('[FreepikProxy] POST error', ['url' => $url, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Error conectando con Freepik API'], 502);
        }
    }
}
