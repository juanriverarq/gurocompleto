<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Auth\AuthenticationException;
use Kreait\Firebase\Contract\Storage as FirebaseStorageContract;

class InternalDocumentsController extends Controller
{
    public function __construct(private FirebaseStorageContract $firebaseStorage) {}

    private function getBrokerId(Request $request)
    {
        if ($request->has('authenticated_broker_id')) return (int)$request->get('authenticated_broker_id');
        $user = $request->user() ?: Auth::user();
        if ($user && $user->broker_id) return (int)$user->broker_id;
        throw new AuthenticationException('Usuario no autenticado o sin broker asignado');
    }

    private function getBucket()
    {
        $bucketName = env('FIREBASE_STORAGE_BUCKET') ?: config('firebase.storage_bucket');
        $projectId = config('firebase.project_id') ?: env('FIREBASE_PROJECT_ID');
        $candidates = array_filter([
            $bucketName,
            $projectId ? ($projectId.'.appspot.com') : null,
            $projectId ? ($projectId.'.firebasestorage.app') : null,
        ]);
        foreach ($candidates as $name) {
            try {
                $b = $this->firebaseStorage->getBucket($name);
                if (method_exists($b, 'exists') && $b->exists()) return $b;
            } catch (\Throwable $e) {}
        }
        return $this->firebaseStorage->getBucket();
    }

    private function buildPath(int $brokerId, string $type, string $fileName): string
    {
        $safe = preg_replace('/[^A-Za-z0-9._-]/', '_', $fileName);
        $date = now();
        $yyyy = $date->format('Y');
        $mm = $date->format('m');
        $timestamp = $date->timestamp;
        return "brokers/{$brokerId}/internos/{$type}/{$yyyy}/{$mm}/{$timestamp}-{$safe}";
    }

    /**
     * Listar todos los documentos internos del broker autenticado
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $bucket = $this->getBucket();
            
            // Listar recursivamente todos los archivos bajo brokers/{brokerId}/internos/
            $prefix = "brokers/{$brokerId}/internos/";
            $objects = $bucket->objects(['prefix' => $prefix]);
            
            $allDocuments = [];
            foreach ($objects as $object) {
                try {
                    $info = $object->info();
                    $path = $info['name'] ?? '';
                    $name = basename($path);
                    
                    // Extraer tipo del path: brokers/{brokerId}/internos/{tipo}/{yyyy}/{mm}/archivo
                    $parts = explode('/', $path);
                    $type = (count($parts) >= 4) ? $parts[3] : 'otro';
                    
                    $allDocuments[] = [
                        'path' => $path,
                        'name' => $name,
                        'contentType' => $info['contentType'] ?? null,
                        'size' => isset($info['size']) ? (int)$info['size'] : null,
                        'uploaded_at' => $info['timeCreated'] ?? $info['updated'] ?? null,
                        'type' => $type,
                    ];
                } catch (\Throwable $e) {
                    // Omitir objetos con errores
                    continue;
                }
            }
            
            // Filtros opcionales
            $search = trim((string) $request->query('search', ''));
            $type = trim((string) $request->query('type', ''));
            
            if ($search !== '') {
                $allDocuments = array_filter($allDocuments, function($doc) use ($search) {
                    return stripos($doc['name'] ?? '', $search) !== false ||
                           stripos($doc['contentType'] ?? '', $search) !== false;
                });
            }
            
            if ($type !== '') {
                $allDocuments = array_filter($allDocuments, function($doc) use ($type) {
                    return ($doc['type'] ?? 'otro') === $type;
                });
            }
            
            // Ordenar por fecha descendente
            usort($allDocuments, function ($a, $b) {
                $ad = isset($a['uploaded_at']) && $a['uploaded_at'] ? strtotime($a['uploaded_at']) : 0;
                $bd = isset($b['uploaded_at']) && $b['uploaded_at'] ? strtotime($b['uploaded_at']) : 0;
                if ($ad === $bd) {
                    return strcmp((string)($b['name'] ?? ''), (string)($a['name'] ?? ''));
                }
                return $bd <=> $ad;
            });
            
            return response()->json([
                'success' => true,
                'message' => 'Documentos internos obtenidos exitosamente',
                'data' => array_values($allDocuments),
            ]);
        } catch (AuthenticationException $ae) {
            Log::warning('[INTERNAL_DOCS] No autenticado', ['error' => $ae->getMessage()]);
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Throwable $e) {
            Log::error('[INTERNAL_DOCS] Error al listar', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al listar documentos: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Subir documento(s) interno(s)
     */
    public function upload(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $request->validate([
                'file' => 'required_without:files|file|max:20480',
                'files.*' => 'required_without:file|file|max:20480',
                'type' => 'nullable|string|max:64',
            ]);
            
            try { 
                $bucket = $this->getBucket(); 
            } catch (\Throwable $e) {
                Log::error('[INTERNAL_DOCS_UPLOAD] Error obteniendo bucket', ['error' => $e->getMessage()]);
                return response()->json(['success' => false, 'message' => 'No se pudo acceder al almacenamiento'], 500);
            }
            
            $files = [];
            if ($request->hasFile('file')) $files[] = $request->file('file');
            if ($request->hasFile('files')) foreach ($request->file('files') as $f) $files[] = $f;
            
            $docType = $request->input('type', 'otro');
            $uploaded = [];
            
            foreach ($files as $file) {
                try {
                    $name = $file->getClientOriginalName();
                    $mime = $file->getClientMimeType() ?: 'application/octet-stream';
                    $path = $this->buildPath($brokerId, $docType, $name);
                    $stream = fopen($file->getRealPath(), 'r');
                    $object = $bucket->upload($stream, [
                        'name' => $path,
                        'metadata' => ['contentType' => $mime],
                    ]);
                    if (is_resource($stream)) { fclose($stream); }
                    
                    Log::info('[INTERNAL_DOCS] Uploaded', ['path' => $path, 'mime' => $mime, 'size' => (int)$file->getSize()]);
                    
                    try {
                        $url = $object->signedUrl((new \DateTimeImmutable('+1 year')), ['version' => 'v4']);
                    } catch (\Throwable $e) {
                        $enc = rawurlencode($path); 
                        $bn = $bucket->name();
                        $url = "https://firebasestorage.googleapis.com/v0/b/{$bn}/o/{$enc}?alt=media";
                    }
                    
                    $uploaded[] = [
                        'name' => $name,
                        'path' => $path,
                        'size' => (int)$file->getSize(),
                        'contentType' => $mime,
                        'url' => $url,
                        'uploaded_at' => now()->toISOString(),
                        'type' => $docType,
                    ];
                } catch (\Throwable $e) {
                    Log::error('[INTERNAL_DOCS_UPLOAD] Error subiendo archivo', [
                        'file_name' => isset($name) ? $name : null,
                        'error' => $e->getMessage(),
                    ]);
                    return response()->json(['success' => false, 'message' => 'Error al subir archivo: ' . $e->getMessage()], 500);
                }
            }
            
            return response()->json(['success' => true, 'data' => $uploaded], 201);
        } catch (AuthenticationException $ae) {
            Log::warning('[INTERNAL_DOCS_UPLOAD] No autenticado', ['error' => $ae->getMessage()]);
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Illuminate\Validation\ValidationException $ve) {
            return response()->json(['success' => false, 'message' => 'Validación fallida', 'errors' => $ve->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('[INTERNAL_DOCS_UPLOAD] Error inesperado', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error interno al subir archivo: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Eliminar documento interno
     */
    public function destroy(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $path = $request->input('path') ?: $request->query('path');
            
            if (!$path) {
                return response()->json(['success' => false, 'message' => 'Debe enviar path'], 422);
            }
            
            // Verificar que el path pertenece al broker
            $expectedPrefix = "brokers/{$brokerId}/internos/";
            if (strpos($path, $expectedPrefix) !== 0) {
                return response()->json(['success' => false, 'message' => 'Acceso denegado'], 403);
            }
            
            $bucket = $this->getBucket();
            $object = $bucket->object($path);
            
            if ($object->exists()) {
                $object->delete();
                return response()->json(['success' => true, 'message' => 'Documento eliminado'], 200);
            } else {
                return response()->json(['success' => false, 'message' => 'Documento no encontrado'], 404);
            }
        } catch (AuthenticationException $ae) {
            Log::warning('[INTERNAL_DOCS_DELETE] No autenticado', ['error' => $ae->getMessage()]);
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Throwable $e) {
            Log::error('[INTERNAL_DOCS_DELETE] Error al eliminar', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al eliminar documento: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Obtener URL firmada para ver documento
     */
    public function signedUrl(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $path = $request->input('path') ?: $request->query('path');
            
            if (!$path) {
                return response()->json(['success' => false, 'message' => 'Debe enviar path'], 422);
            }
            
            // Verificar que el path pertenece al broker
            $expectedPrefix = "brokers/{$brokerId}/internos/";
            if (strpos($path, $expectedPrefix) !== 0) {
                return response()->json(['success' => false, 'message' => 'Acceso denegado'], 403);
            }
            
            $bucket = $this->getBucket();
            $object = $bucket->object($path);
            
            if (!$object->exists()) {
                return response()->json(['success' => false, 'message' => 'Archivo no existe'], 404);
            }
            
            $url = $object->signedUrl((new \DateTimeImmutable('+30 minutes')), ['version' => 'v4']);
            return response()->json(['success' => true, 'data' => ['url' => $url]]);
        } catch (AuthenticationException $ae) {
            Log::warning('[INTERNAL_DOCS_SIGNED_URL] No autenticado', ['error' => $ae->getMessage()]);
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Throwable $e) {
            Log::error('[INTERNAL_DOCS_SIGNED_URL] Error al generar URL', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'No se pudo generar URL: ' . $e->getMessage()], 500);
        }
    }
}