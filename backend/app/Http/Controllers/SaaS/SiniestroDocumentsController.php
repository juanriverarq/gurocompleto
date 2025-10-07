<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Siniestro;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Auth\AuthenticationException;
use Kreait\Firebase\Contract\Storage as FirebaseStorageContract;

class SiniestroDocumentsController extends Controller
{
    public function __construct(private FirebaseStorageContract $firebaseStorage) {}

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

    private function buildPath(int $brokerId, int $siniestroId, string $fileName): string
    {
        $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', $fileName);
        return "brokers/{$brokerId}/siniestros/{$siniestroId}/{$safeName}";
    }

    public function index(Request $request, int $id)
    {
        try {
            // Obtener broker_id del parámetro de query o del usuario autenticado
            $brokerId = $request->get('authenticated_broker_id');
            if (!$brokerId) {
                $user = Auth::user();
                if (!$user || !$user->broker_id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Usuario no tiene un broker asignado',
                    ], 403);
                }
                $brokerId = $user->broker_id;
            }

            $siniestro = Siniestro::where('broker_id', $brokerId)->where('id', $id)->first();
            if (!$siniestro) {
                return response()->json(['success' => false, 'message' => 'Siniestro no encontrado'], 404);
            }

            return response()->json([
                'success' => true,
                'message' => 'Documentos obtenidos exitosamente',
                'data' => $siniestro->archivos_adjuntos ?? [],
            ]);
        } catch (AuthenticationException $ae) {
            Log::warning(' [SINIESTROS_LIST] No autenticado', ['siniestro_id'=>$id,'error'=>$ae->getMessage()]);
            return response()->json(['success'=>false,'message'=>'No autenticado'],401);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al listar documentos: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Listar todos los documentos de todos los siniestros del broker autenticado
     * con filtros opcionales y paginación simple en memoria.
     */
    public function indexAll(Request $request)
    {
        try {
            // Obtener broker_id del parámetro de query o del usuario autenticado
            $brokerId = $request->get('authenticated_broker_id');
            if (!$brokerId) {
                $user = Auth::user();
                if (!$user || !$user->broker_id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Usuario no tiene un broker asignado',
                    ], 403);
                }
                $brokerId = $user->broker_id;
            }

            // Filtros
            $search = trim((string) $request->get('search', ''));
            $typeFilter = trim((string) $request->get('type', ''));
            $siniestroIdFilter = $request->get('siniestro_id');

            // Paginación
            $perPage = (int) ($request->get('per_page', 50));
            if ($perPage <= 0) { $perPage = 50; }
            $page = (int) ($request->get('page', 1));
            if ($page <= 0) { $page = 1; }

            // Obtener siniestros del broker (opcionalmente filtrar por un siniestro específico)
            $siniestrosQuery = Siniestro::where('broker_id', $brokerId)->select(['id','numero_siniestro','tipo_siniestro','estado','numero_poliza','archivos_adjuntos','updated_at','created_at']);
            if (!empty($siniestroIdFilter)) {
                $siniestrosQuery->where('id', (int) $siniestroIdFilter);
            }
            $siniestros = $siniestrosQuery->orderByDesc('updated_at')->get();

            // Aplanar documentos
            $allDocs = [];
            foreach ($siniestros as $siniestro) {
                $docs = is_array($siniestro->archivos_adjuntos) ? $siniestro->archivos_adjuntos : [];
                foreach ($docs as $doc) {
                    try {
                        // Normalizar estructura (soportar stdClass)
                        if (is_object($doc)) { $doc = (array) $doc; }
                        if (!is_array($doc)) { continue; }

                        $name = isset($doc['name']) ? (string) $doc['name'] : '';
                        $contentType = isset($doc['contentType']) ? (string) $doc['contentType'] : null;
                        $docType = isset($doc['type']) ? (string) $doc['type'] : 'otro';

                        // Filtros en memoria
                        if ($search !== '') {
                            $haystack = strtolower(($name.' '.($contentType ?: '')).' '.($docType ?: ''));
                            if (!str_contains($haystack, strtolower($search))) { continue; }
                        }
                        if ($typeFilter !== '' && $docType !== $typeFilter) {
                            continue;
                        }

                        $allDocs[] = [
                            'siniestro_id' => (int) $siniestro->id,
                            'numero_siniestro' => (string) ($siniestro->numero_siniestro ?? ''),
                            'tipo_siniestro' => (string) ($siniestro->tipo_siniestro ?? ''),
                            'estado' => (string) ($siniestro->estado ?? ''),
                            'numero_poliza' => (string) ($siniestro->numero_poliza ?? ''),
                            'name' => $name,
                            'path' => isset($doc['path']) ? (string) $doc['path'] : null,
                            'size' => isset($doc['size']) ? (int) $doc['size'] : null,
                            'contentType' => $contentType,
                            'uploaded_at' => isset($doc['uploaded_at']) ? (string) $doc['uploaded_at'] : null,
                            'type' => $docType,
                        ];
                    } catch (\Throwable $e) {
                        try { Log::warning('[SiniestroDocuments] Documento inválido omitido', ['siniestro_id' => $siniestro->id, 'error' => $e->getMessage()]); } catch (\Throwable $ignored) {}
                        continue;
                    }
                }
            }

            // Orden por fecha subida desc (si existe), si no por nombre
            usort($allDocs, function ($a, $b) {
                $ad = isset($a['uploaded_at']) && $a['uploaded_at'] ? strtotime($a['uploaded_at']) : 0;
                $bd = isset($b['uploaded_at']) && $b['uploaded_at'] ? strtotime($b['uploaded_at']) : 0;
                if ($ad === $bd) {
                    return strcmp((string)($b['name'] ?? ''), (string)($a['name'] ?? ''));
                }
                return $bd <=> $ad; // desc
            });

            // Paginar en memoria
            $total = count($allDocs);
            $lastPage = (int) max(1, (int) ceil($total / $perPage));
            if ($page > $lastPage) { $page = $lastPage; }
            $offset = ($page - 1) * $perPage;
            $slice = array_slice($allDocs, $offset, $perPage);
            $from = $total === 0 ? 0 : $offset + 1;
            $to = $total === 0 ? 0 : $offset + count($slice);

            return response()->json([
                'success' => true,
                'message' => 'Documentos obtenidos exitosamente',
                'data' => $slice,
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
                'from' => $from,
                'to' => $to,
            ]);
        } catch (AuthenticationException $ae) {
            Log::warning(' [SINIESTROS_LIST_ALL_DOCS] No autenticado', ['error' => $ae->getMessage()]);
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Exception $e) {
            try { Log::error('[SiniestroDocuments] Error al listar documentos', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]); } catch (\Throwable $ignored) {}
            return response()->json(['success' => false, 'message' => 'Error al listar documentos: ' . $e->getMessage()], 500);
        }
    }

    public function upload(Request $request, int $id)
    {
        try {
            // Obtener broker_id del parámetro de query o del usuario autenticado
            $brokerId = $request->get('authenticated_broker_id');
            if (!$brokerId) {
                $user = Auth::user();
                if (!$user || !$user->broker_id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Usuario no tiene un broker asignado',
                    ], 403);
                }
                $brokerId = $user->broker_id;
            }

            $request->validate([
                'file' => 'required_without:files|file|max:20480', // 20MB
                'files.*' => 'required_without:file|file|max:20480',
                'type' => 'nullable|string|max:64',
            ]);

            $siniestro = Siniestro::where('broker_id', $brokerId)->where('id', $id)->first();
            if (!$siniestro) {
                return response()->json(['success' => false, 'message' => 'Siniestro no encontrado'], 404);
            }

            try { $bucket = $this->getBucket(); } catch (\Throwable $e) {
                Log::error(' [SINIESTROS_UPLOAD] Error obteniendo bucket', ['siniestro_id'=>$id,'error'=>$e->getMessage()]);
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
                    $path = $this->buildPath($brokerId, $siniestro->id, $originalName);

                    $stream = fopen($file->getRealPath(), 'r');
                    $object = $bucket->upload($stream, [
                        'name' => $path,
                        'metadata' => ['contentType' => $mime],
                    ]);
                    if (is_resource($stream)) { fclose($stream); }
                    try { Log::info('[SiniestroDocuments] Uploaded object', ['path' => $path, 'mime' => $mime, 'size' => (int) $file->getSize()]); } catch (\Throwable $e) {}
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
                    Log::error('🚨 [SINIESTROS_UPLOAD] Error subiendo archivo', [
                         'broker_id' => $brokerId,
                         'siniestro_id' => $id,
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
            $existing = $siniestro->archivos_adjuntos ?? [];
            if (!is_array($existing)) {
                $existing = [];
            }
            $siniestro->archivos_adjuntos = array_values(array_merge($existing, $uploadedFiles));
            $siniestro->save();

            return response()->json([
                'success' => true,
                'message' => 'Archivo(s) subido(s) exitosamente',
                'data' => $uploadedFiles,
            ], 201);
        } catch (AuthenticationException $ae) {
            Log::warning(' [SINIESTROS_UPLOAD] No autenticado', ['siniestro_id'=>$id,'error'=>$ae->getMessage()]);
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
            // Obtener broker_id del parámetro de query o del usuario autenticado
            $brokerId = $request->get('authenticated_broker_id');
            if (!$brokerId) {
                $user = Auth::user();
                if (!$user || !$user->broker_id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Usuario no tiene un broker asignado',
                    ], 403);
                }
                $brokerId = $user->broker_id;
            }

            $siniestro = Siniestro::where('broker_id', $brokerId)->where('id', $id)->first();
            if (!$siniestro) {
                return response()->json(['success' => false, 'message' => 'Siniestro no encontrado'], 404);
            }

            $path = $request->input('path') ?: $request->query('path');
            $name = $request->input('name') ?: $request->query('name');
            if (!$path && !$name) {
                return response()->json(['success' => false, 'message' => 'Debe enviar "path" o "name" del documento a eliminar'], 422);
            }

            $bucket = $this->getBucket();

            $documents = is_array($siniestro->archivos_adjuntos) ? $siniestro->archivos_adjuntos : [];
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

            $siniestro->archivos_adjuntos = array_values($remaining);
            $siniestro->save();

            return response()->json([
                'success' => true,
                'message' => $deletedAny ? 'Documento eliminado' : 'No se encontró el documento a eliminar',
                'data' => $siniestro->archivos_adjuntos,
            ]);
        } catch (AuthenticationException $ae) {
            Log::warning(' [SINIESTROS_DELETE] No autenticado', ['siniestro_id'=>$id,'error'=>$ae->getMessage()]);
            return response()->json(['success'=>false,'message'=>'No autenticado'],401);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al eliminar documento: ' . $e->getMessage()], 500);
        }
    }

    public function signedUrl(Request $request, int $id)
    {
        try {
            // Obtener broker_id del parámetro de query o del usuario autenticado
            $brokerId = $request->get('authenticated_broker_id');
            if (!$brokerId) {
                $user = Auth::user();
                if (!$user || !$user->broker_id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Usuario no tiene un broker asignado',
                    ], 403);
                }
                $brokerId = $user->broker_id;
            }
            $siniestro = Siniestro::where('broker_id', $brokerId)->where('id', $id)->first();
            if (!$siniestro) {
                return response()->json(['success' => false, 'message' => 'Siniestro no encontrado'], 404);
            }

            $path = $request->input('path') ?: $request->query('path');
            $name = $request->input('name') ?: $request->query('name');
            if (!$path && !$name) {
                return response()->json(['success' => false, 'message' => 'Debe enviar "path" o "name" del documento'], 422);
            }

            $doc = null;
            foreach ((array)($siniestro->archivos_adjuntos ?? []) as $d) {
                if (($path && isset($d['path']) && $d['path'] === $path) || ($name && isset($d['name']) && $d['name'] === $name)) {
                    $doc = $d;
                    break;
                }
            }
            if (!$doc) {
                return response()->json(['success' => false, 'message' => 'Documento no encontrado en el siniestro'], 404);
            }

            $bucket = $this->getBucket();
            $object = $bucket->object($doc['path']);
            if (!$object->exists()) { return response()->json(['success'=>false,'message'=>'Archivo no existe en el almacenamiento'],404); }
            $url = $object->signedUrl((new \DateTimeImmutable('+30 minutes')), ['version' => 'v4']);
            return response()->json(['success' => true, 'data' => ['url' => $url]]);
        } catch (AuthenticationException $ae) {
            Log::warning(' [SINIESTROS_SIGNED_URL] No autenticado', ['siniestro_id'=>$id,'error'=>$ae->getMessage()]);
            return response()->json(['success'=>false,'message'=>'No autenticado'],401);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'No se pudo generar URL: ' . $e->getMessage()], 500);
        }
    }
}
