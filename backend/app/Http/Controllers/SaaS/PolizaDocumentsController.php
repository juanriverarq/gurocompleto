<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Poliza;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Auth\AuthenticationException;
use Kreait\Firebase\Contract\Storage as FirebaseStorageContract;

class PolizaDocumentsController extends Controller
{
    use \App\Traits\ChecksStorageLimit;
    public function __construct(private FirebaseStorageContract $firebaseStorage) {}

    private function getBrokerId(Request $request)
    {
        \Log::info('🔍 [DEBUG] PolizaDocumentsController::getBrokerId - INICIANDO', [
            'step' => 'inicio',
            'request_has_authenticated_broker_id' => $request->has('authenticated_broker_id'),
            'authenticated_broker_id_value' => $request->get('authenticated_broker_id'),
            'auth_type' => $request->get('auth_type')
        ]);

        // 1. Primero intentar obtener desde el middleware GlobalBrokerAuth
        if ($request->has('authenticated_broker_id')) {
            $brokerId = $request->get('authenticated_broker_id');
            \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde middleware', [
                'broker_id' => $brokerId,
                'source' => 'middleware_authenticated_broker_id'
            ]);
            return (int) $brokerId;
        }

        // 2. Intentar obtener desde broker_id directo del request
        if ($request->has('broker_id')) {
            $brokerId = $request->get('broker_id');
            \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde request broker_id', [
                'broker_id' => $brokerId,
                'source' => 'request_broker_id'
            ]);
            return (int) $brokerId;
        }

        \Log::info('🔍 [DEBUG] getBrokerId - No encontrado en middleware, probando usuarios autenticados');

        // 3. Verificar tipo de autenticación y obtener usuario correspondiente
        $authType = $request->get('auth_type');
        $user = null;

        if ($authType === 'empleado') {
            // Usuario autenticado como empleado
            $user = $request->get('authenticated_empleado');
            \Log::info('🔍 [DEBUG] getBrokerId - Usuario empleado', [
                'user_exists' => $user !== null,
                'user_id' => $user ? $user->id : null,
                'user_broker_id' => $user ? $user->broker_id : null
            ]);
        } else {
            // Usuario Firebase o tradicional
            $user = $request->user();

            \Log::info('🔍 [DEBUG] getBrokerId - Usuario Firebase del request', [
                'user_exists' => $user !== null,
                'user_id' => $user ? $user->id : null,
                'user_email' => $user ? $user->email : null,
                'user_broker_id' => $user ? $user->broker_id : null
            ]);

            // 4. Si no hay usuario, intentar obtenerlo de Auth (fallback)
            if (!$user) {
                \Log::info('🔍 [DEBUG] getBrokerId - No hay usuario en request, probando Auth::user()');
                $user = Auth::user();

                \Log::info('🔍 [DEBUG] getBrokerId - Usuario de Auth', [
                    'user_exists' => $user !== null,
                    'user_id' => $user ? $user->id : null,
                    'user_email' => $user ? $user->email : null,
                    'user_broker_id' => $user ? $user->broker_id : null
                ]);
            }
        }

        if ($user && isset($user->broker_id) && $user->broker_id) {
            \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde usuario', [
                'broker_id' => $user->broker_id,
                'user_id' => $user->id,
                'user_type' => get_class($user),
                'source' => 'authenticated_user'
            ]);
            return (int) $user->broker_id;
        }

        // Solo en desarrollo: Header de desarrollo
        if (app()->environment('local', 'development')) {
            $devBrokerId = $request->header('X-Dev-Broker-Id');
            if ($devBrokerId) {
                \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde header desarrollo', [
                    'broker_id' => (int) $devBrokerId,
                    'source' => 'dev_header'
                ]);
                return (int) $devBrokerId;
            }

            // Solo en desarrollo: Primer broker como último recurso
            $firstBroker = \App\Models\Broker::first();
            if ($firstBroker) {
                \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO primer broker desarrollo', [
                    'broker_id' => $firstBroker->id,
                    'source' => 'first_broker_dev'
                ]);
                return (int) $firstBroker->id;
            }
        }

        // Si no hay usuario autenticado, lanzar excepción
        if (!$user) {
            \Log::error('❌ [DEBUG] getBrokerId - FALLA: Usuario no autenticado', [
                'auth_type' => $authType,
                'has_authenticated_empleado' => $request->has('authenticated_empleado'),
                'has_authenticated_user' => $request->has('authenticated_user')
            ]);
            throw new AuthenticationException('Usuario no autenticado');
        }

        // Si el usuario no tiene broker_id, lanzar excepción
        if (!isset($user->broker_id) || !$user->broker_id) {
            \Log::error('❌ [DEBUG] getBrokerId - FALLA: Usuario no tiene broker asignado', [
                'user_id' => $user->id,
                'user_type' => get_class($user),
                'user_broker_id' => $user->broker_id ?? 'null'
            ]);
            throw new AuthenticationException('Usuario no tiene un broker asignado');
        }

        return null; // Nunca debería llegar aquí
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

    private function buildPath(int $brokerId, int $polizaId, string $fileName): string
    {
        $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', $fileName);
        return "brokers/{$brokerId}/polizas/{$polizaId}/{$safeName}";
    }

    public function index(Request $request, int $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $poliza = Poliza::where('broker_id', $brokerId)->where('id', $id)->first();
            if (!$poliza) {
                return response()->json(['success' => false, 'message' => 'Póliza no encontrada'], 404);
            }

            return response()->json([
                'success' => true,
                'message' => 'Documentos obtenidos exitosamente',
                'data' => $poliza->documents ?? [],
            ]);
        } catch (AuthenticationException $ae) {
            Log::warning(' [POLIZAS_LIST] No autenticado', ['poliza_id'=>$id,'error'=>$ae->getMessage()]);
            return response()->json(['success'=>false,'message'=>'No autenticado'],401);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al listar documentos: ' . $e->getMessage()], 500);
        }
    }

    public function indexAll(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // Obtener todas las pólizas del broker con documentos
            $polizas = Poliza::where('broker_id', $brokerId)
                ->whereNotNull('documents')
                ->where('documents', '!=', '[]')
                ->get();

            $allDocuments = [];
            foreach ($polizas as $poliza) {
                $documents = is_array($poliza->documents) ? $poliza->documents : [];
                foreach ($documents as $doc) {
                    // Normalizar campos según esquema actual (evitar null y [object Object])
                    $policyNumber = $poliza->policy_number ?? $poliza->numero_poliza ?? null;

                    $insuranceCompany = $poliza->insurance_company
                        ?? $poliza->aseguradora
                        ?? ($poliza->aseguradora_nombre ?? null);

                    if (is_array($insuranceCompany) || is_object($insuranceCompany)) {
                        $insuranceCompany = (string) (
                            (is_array($insuranceCompany) ? ($insuranceCompany['nombre'] ?? $insuranceCompany['name'] ?? null) : null)
                            ?? '[Sin nombre]'
                        );
                    }

                    $clientName = $poliza->client_name
                        ?? trim(($poliza->nombres_cliente ?? '') . ' ' . ($poliza->apellidos_cliente ?? ''));

                    $allDocuments[] = array_merge($doc, [
                        'poliza_id' => (int) $poliza->id,
                        'policy_number' => $policyNumber,
                        'insurance_company' => $insuranceCompany,
                        'client_name' => $clientName,
                    ]);
                }
            }

            // Aplicar filtros si se proporcionan
            $search = $request->query('search');
            $type = $request->query('type');
            $polizaId = $request->query('poliza_id');

            if ($search) {
                $allDocuments = array_filter($allDocuments, function($doc) use ($search) {
                    return stripos($doc['name'] ?? '', $search) !== false ||
                           stripos($doc['contentType'] ?? '', $search) !== false;
                });
            }

            if ($type) {
                $allDocuments = array_filter($allDocuments, function($doc) use ($type) {
                    return ($doc['type'] ?? 'otro') === $type;
                });
            }

            if ($polizaId) {
                $allDocuments = array_filter($allDocuments, function($doc) use ($polizaId) {
                    return $doc['poliza_id'] == $polizaId;
                });
            }

// Orden descendente por fecha de subida (más recientes primero). Si no hay fecha, orden por nombre desc.
usort($allDocuments, function ($a, $b) {
    $ad = isset($a['uploaded_at']) && $a['uploaded_at'] ? strtotime($a['uploaded_at']) : 0;
    $bd = isset($b['uploaded_at']) && $b['uploaded_at'] ? strtotime($b['uploaded_at']) : 0;
    if ($ad === $bd) {
        return strcmp((string)($b['name'] ?? ''), (string)($a['name'] ?? ''));
    }
    return $bd <=> $ad; // desc
});
            return response()->json([
                'success' => true,
                'message' => 'Documentos obtenidos exitosamente',
                'data' => array_values($allDocuments),
            ]);
        } catch (AuthenticationException $ae) {
            Log::warning('[POLIZAS_DOCS_ALL] No autenticado', ['error' => $ae->getMessage()]);
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Exception $e) {
            Log::error('[POLIZAS_DOCS_ALL] Error', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al listar documentos: ' . $e->getMessage()], 500);
        }
    }

    public function upload(Request $request, int $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $request->validate([
                'file' => 'required_without:files|file|max:20480', // 20MB
                'files.*' => 'required_without:file|file|max:20480',
                'type' => 'nullable|string|max:64',
            ]);

            $poliza = Poliza::where('broker_id', $brokerId)->where('id', $id)->first();
            if (!$poliza) {
                return response()->json(['success' => false, 'message' => 'Póliza no encontrada'], 404);
            }

            // Verificar límite de almacenamiento
            $uploadSize = 0;
            if ($request->hasFile('file')) $uploadSize += $request->file('file')->getSize();
            if ($request->hasFile('files')) foreach ($request->file('files') as $f) $uploadSize += $f->getSize();
            $storageCheck = $this->checkStorageLimit($brokerId, $uploadSize);
            if ($storageCheck) return $storageCheck;

            try { $bucket = $this->getBucket(); } catch (\Throwable $e) {
                Log::error(' [POLIZAS_UPLOAD] Error obteniendo bucket', ['poliza_id'=>$id,'error'=>$e->getMessage()]);
                return response()->json(['success'=>false,'message'=>'No se pudo acceder al almacenamiento'],500);
            }

            $uploadedFiles = [];

            $files = [];
            if ($request->hasFile('file')) {
                $files[] = $request->file('file');
            }
            if ($request->hasFile('files')) {
                foreach ($request->file('files') as $f) {
                    $files[] = $f;
                }
            }

            $docType = $request->input('type');

            foreach ($files as $file) {
                try {
                    $originalName = $file->getClientOriginalName();
                    $mime = $file->getClientMimeType() ?: 'application/octet-stream';
                    $path = $this->buildPath($brokerId, $poliza->id, $originalName);

                    $stream = fopen($file->getRealPath(), 'r');
                    $object = $bucket->upload($stream, [
                        'name' => $path,
                        'metadata' => ['contentType' => $mime],
                    ]);
                    if (is_resource($stream)) { fclose($stream); }
                    try { Log::info('[PolizaDocuments] Uploaded object', ['path' => $path, 'mime' => $mime, 'size' => (int) $file->getSize()]); } catch (\Throwable $e) {}
                    $url = null;
                    try { $url = $object->signedUrl((new \DateTimeImmutable('+1 year')), ['version' => 'v4']); } catch (\Throwable $e) {}
                    if (!$url) {
                        $enc = rawurlencode($path); $bn = $bucket->name();
                        $url = "https://firebasestorage.googleapis.com/v0/b/{$bn}/o/{$enc}?alt=media";
                    }

                    $doc = [
                        'name' => $originalName,
                        'path' => $path,
                        'size' => (int) $file->getSize(),
                        'contentType' => $mime,
                        'url' => $url,
                        'uploaded_at' => now()->toISOString(),
                        'type' => $docType ?: 'otro',
                    ];
                    $uploadedFiles[] = $doc;
                } catch (\Throwable $e) {
                    Log::error('🚨 [POLIZAS_UPLOAD] Error subiendo archivo', [
                         'broker_id' => $brokerId,
                         'poliza_id' => $id,
                         'file_name' => isset($originalName) ? $originalName : null,
                         'error' => $e->getMessage(),
                     ]);
                    return response()->json([
                        'success' => false,
                        'message' => 'Error al subir archivo: ' . $e->getMessage(),
                    ], 500);
                }
            }

            // Merge con documentos existentes
            $existing = $poliza->documents ?? [];
            if (!is_array($existing)) {
                $existing = [];
            }
            $poliza->documents = array_values(array_merge($existing, $uploadedFiles));
            $poliza->save();

            return response()->json([
                'success' => true,
                'message' => 'Archivo(s) subido(s) exitosamente',
                'data' => $uploadedFiles,
            ], 201);
        } catch (AuthenticationException $ae) {
            Log::warning(' [POLIZAS_UPLOAD] No autenticado', ['poliza_id'=>$id,'error'=>$ae->getMessage()]);
            return response()->json(['success'=>false,'message'=>'No autenticado'],401);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al subir archivo: ' . $e->getMessage()], 500);
        }
    }

    public function destroy(Request $request, int $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $poliza = Poliza::where('broker_id', $brokerId)->where('id', $id)->first();
            if (!$poliza) {
                return response()->json(['success' => false, 'message' => 'Póliza no encontrada'], 404);
            }

            $path = $request->input('path') ?: $request->query('path');
            $name = $request->input('name') ?: $request->query('name');
            if (!$path && !$name) {
                return response()->json(['success' => false, 'message' => 'Debe enviar "path" o "name" del documento a eliminar'], 422);
            }

            $bucket = $this->getBucket();

            $documents = is_array($poliza->documents) ? $poliza->documents : [];
            $remaining = [];
            $deletedAny = false;

            foreach ($documents as $doc) {
                $matches = ($path && isset($doc['path']) && $doc['path'] === $path) || ($name && isset($doc['name']) && $doc['name'] === $name);
                if ($matches) {
                    try { $object = $bucket->object($doc['path']); if ($object->exists()) { $object->delete(); } $deletedAny = true; } catch (\Throwable $e) {}
                    continue; // no agregar al remaining
                }
                $remaining[] = $doc;
            }

            $poliza->documents = array_values($remaining);
            $poliza->save();

            return response()->json([
                'success' => true,
                'message' => $deletedAny ? 'Documento eliminado' : 'No se encontró el documento a eliminar',
                'data' => $poliza->documents,
            ]);
        } catch (AuthenticationException $ae) {
            Log::warning(' [POLIZAS_DELETE] No autenticado', ['poliza_id'=>$id,'error'=>$ae->getMessage()]);
            return response()->json(['success'=>false,'message'=>'No autenticado'],401);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al eliminar documento: ' . $e->getMessage()], 500);
        }
    }

    public function signedUrl(Request $request, int $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $poliza = Poliza::where('broker_id', $brokerId)->where('id', $id)->first();
            if (!$poliza) {
                return response()->json(['success' => false, 'message' => 'Póliza no encontrada'], 404);
            }

            $path = $request->input('path') ?: $request->query('path');
            $name = $request->input('name') ?: $request->query('name');
            if (!$path && !$name) {
                return response()->json(['success' => false, 'message' => 'Debe enviar "path" o "name" del documento'], 422);
            }

            $doc = null;
            foreach ((array)($poliza->documents ?? []) as $d) {
                if (($path && isset($d['path']) && $d['path'] === $path) || ($name && isset($d['name']) && $d['name'] === $name)) {
                    $doc = $d;
                    break;
                }
            }
            if (!$doc) {
                return response()->json(['success' => false, 'message' => 'Documento no encontrado en la póliza'], 404);
            }

            $bucket = $this->getBucket();
            $object = $bucket->object($doc['path']);
            if (!$object->exists()) { return response()->json(['success'=>false,'message'=>'Archivo no existe en el almacenamiento'],404); }
            $url = $object->signedUrl((new \DateTimeImmutable('+30 minutes')), ['version' => 'v4']);
            return response()->json(['success' => true, 'data' => ['url' => $url]]);
        } catch (AuthenticationException $ae) {
            Log::warning(' [POLIZAS_SIGNED_URL] No autenticado', ['poliza_id'=>$id,'error'=>$ae->getMessage()]);
            return response()->json(['success'=>false,'message'=>'No autenticado'],401);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'No se pudo generar URL: ' . $e->getMessage()], 500);
        }
    }
}
