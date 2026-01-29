<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Contract\Auth as FirebaseAuthContract;
use Kreait\Firebase\Contract\Storage as FirebaseStorageContract;
use Illuminate\Support\Facades\Log;

class FirebaseServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->app->singleton(FirebaseAuthContract::class, function () {
            $projectId = config('firebase.project_id', env('FIREBASE_PROJECT_ID'));
            $factory = (new Factory())->withProjectId($projectId);

            $path = env('GOOGLE_APPLICATION_CREDENTIALS');
            // Fallback a base_path si la ruta no es absoluta o no existe
            if ($path && !@is_readable($path)) {
                $basePath = base_path($path);
                if (@is_readable($basePath)) {
                    $path = $basePath;
                }
            }
            // También intentar firebase-admin.json en la raíz del proyecto
            if (!$path || !@is_readable($path)) {
                $defaultPath = base_path('firebase-admin.json');
                if (@is_readable($defaultPath)) {
                    $path = $defaultPath;
                }
            }
            if ($path && @is_readable($path)) {
                try { Log::info('[Firebase] Using service account file', ['path' => $path]); } catch (\Throwable $e) {}
                $factory = $factory->withServiceAccount($path);
            } else {
                $key = config('firebase.credentials', []);
                if (!empty($key['client_email']) && !empty($key['private_key'])) {
                    // Normalizar saltos de línea del private_key
                    $key['private_key'] = str_replace("\\n", "\n", (string) $key['private_key']);
                    try { Log::info('[Firebase] Using service account array'); } catch (\Throwable $e) {}
                    $factory = $factory->withServiceAccount($key);
                } else {
                    try { Log::warning('[Firebase] No credentials provided; using application default credentials (ADC)'); } catch (\Throwable $e) {}
                }
            }

            return $factory->createAuth();
        });

        // Firebase Storage binding
        $this->app->singleton(FirebaseStorageContract::class, function () {
            $projectId = config('firebase.project_id', env('FIREBASE_PROJECT_ID'));
            $factory = (new Factory())->withProjectId($projectId);

            $path = env('GOOGLE_APPLICATION_CREDENTIALS');
            // Fallback a base_path si la ruta no es absoluta o no existe
            if ($path && !@is_readable($path)) {
                $basePath = base_path($path);
                if (@is_readable($basePath)) {
                    $path = $basePath;
                }
            }
            // También intentar firebase-admin.json en la raíz del proyecto
            if (!$path || !@is_readable($path)) {
                $defaultPath = base_path('firebase-admin.json');
                if (@is_readable($defaultPath)) {
                    $path = $defaultPath;
                }
            }
            if ($path && @is_readable($path)) {
                try { Log::info('[Firebase] Using service account file (storage)', ['path' => $path]); } catch (\Throwable $e) {}
                $factory = $factory->withServiceAccount($path);
            } else {
                $key = config('firebase.credentials', []);
                if (!empty($key['client_email']) && !empty($key['private_key'])) {
                    $key['private_key'] = str_replace("\\n", "\n", (string) $key['private_key']);
                    try { Log::info('[Firebase] Using service account array (storage)'); } catch (\Throwable $e) {}
                    $factory = $factory->withServiceAccount($key);
                } else {
                    try { Log::warning('[Firebase] No credentials provided for storage; using ADC'); } catch (\Throwable $e) {}
                }
            }

            return $factory->createStorage();
        });
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}
