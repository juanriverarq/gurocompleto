<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Auth\AuthenticationException;
use Kreait\Firebase\Contract\Storage as FirebaseStorageContract;

class ClienteDocumentsController extends Controller
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

    private function buildPath(int $brokerId, int $clienteId, string $fileName): string
    {
        $safe = preg_replace('/[^A-Za-z0-9._-]/', '_', $fileName);
        return "brokers/{$brokerId}/clientes/{$clienteId}/{$safe}";
    }

    public function index(Request $request, int $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $cliente = Cliente::where('broker_id', $brokerId)->find($id);
            if (!$cliente) return response()->json(['success'=>false,'message'=>'Cliente no encontrado'],404);
            return response()->json(['success'=>true,'data'=>$cliente->documents ?? []]);
        } catch (AuthenticationException $ae) {
            Log::warning(' [CLIENTES_LIST] No autenticado', ['cliente_id'=>$id,'error'=>$ae->getMessage()]);
            return response()->json(['success'=>false,'message'=>'No autenticado'],401);
        } catch (\Throwable $e) {
            Log::error(' [CLIENTES_LIST] Error al listar documentos', [
                'cliente_id' => $id,
                'error' => $e->getMessage(),
            ]);
            return response()->json(['success'=>false,'message'=>'Error al listar documentos: '.$e->getMessage()],500);
        }
    }

    /**
     * Listar todos los documentos de todos los clientes del broker autenticado,
     * con filtros opcionales (search, type, cliente_id). Respuesta plana como en pólizas.
     */
    public function indexAll(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // Obtener clientes con documentos
            $clientes = Cliente::where('broker_id', $brokerId)
                ->whereNotNull('documents')
                ->where('documents', '!=', '[]')
                ->select(['id','first_name','last_name','company','company_legal_name','document_number','documents'])
                ->get();

            $allDocuments = [];
            foreach ($clientes as $c) {
                $docs = is_array($c->documents) ? $c->documents : [];
                foreach ($docs as $doc) {
                    if (is_object($doc)) { $doc = (array) $doc; }
                    if (!is_array($doc)) { continue; }

                    // Construir etiqueta del cliente usando el nuevo esquema del modelo:
                    // - company_legal_name (razón social) si existe
                    // - caso contrario: first_name + last_name
                    $clienteNombre = $c->company_legal_name
                        ? (string) $c->company_legal_name
                        : trim((string)($c->first_name ?? '') . ' ' . (string)($c->last_name ?? ''));

                    // No existe campo CUIT en el esquema actual; usar document_number como identificador visible
                    $clienteCuit = $c->document_number;

                    $allDocuments[] = array_merge($doc, [
                        'cliente_id' => (int) $c->id,
                        'cliente_nombre' => $clienteNombre,
                        'cliente_cuit' => $clienteCuit,
                    ]);
                }
            }

            // Filtros
            $search = trim((string) $request->query('search', ''));
            $type = trim((string) $request->query('type', ''));
            $clienteId = $request->query('cliente_id');

            if ($search !== '') {
                $allDocuments = array_values(array_filter($allDocuments, function ($doc) use ($search) {
                    return stripos((string)($doc['name'] ?? ''), $search) !== false
                        || stripos((string)($doc['contentType'] ?? ''), $search) !== false;
                }));
            }

            if ($type !== '') {
                $allDocuments = array_values(array_filter($allDocuments, function ($doc) use ($type) {
                    return ($doc['type'] ?? 'otro') === $type;
                }));
            }

            if (!empty($clienteId)) {
                $allDocuments = array_values(array_filter($allDocuments, function ($doc) use ($clienteId) {
                    return (string)($doc['cliente_id'] ?? '') === (string)$clienteId;
                }));
            }

            // Orden descendente por fecha de subida (más recientes primero). Si no hay fecha, ordenar por nombre desc.
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
    'data' => $allDocuments,
]);
        } catch (AuthenticationException $ae) {
            Log::warning('[CLIENTES_DOCS_ALL] No autenticado', ['error' => $ae->getMessage()]);
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        } catch (\Throwable $e) {
            Log::error('[CLIENTES_DOCS_ALL] Error', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al listar documentos: ' . $e->getMessage()], 500);
        }
    }

    public function upload(Request $request, int $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $request->validate([
                'file' => 'required_without:files|file|max:20480',
                'files.*' => 'required_without:file|file|max:20480',
                'type' => 'nullable|string|max:64',
            ]);
            $cliente = Cliente::where('broker_id',$brokerId)->find($id);
            if (!$cliente) return response()->json(['success'=>false,'message'=>'Cliente no encontrado'],404);

            try { $bucket = $this->getBucket(); } catch (\Throwable $e) {
                Log::error(' [CLIENTES_UPLOAD] Error obteniendo bucket', ['cliente_id'=>$id,'error'=>$e->getMessage()]);
                return response()->json(['success'=>false,'message'=>'No se pudo acceder al almacenamiento'],500);
            }

            $files = [];
            if ($request->hasFile('file')) $files[] = $request->file('file');
            if ($request->hasFile('files')) foreach ($request->file('files') as $f) $files[] = $f;
            $docType = $request->input('type');
            $uploaded = [];
            foreach ($files as $file) {
                try {
                    $name = $file->getClientOriginalName();
                    $mime = $file->getClientMimeType() ?: 'application/octet-stream';
                    $path = $this->buildPath($brokerId, $cliente->id, $name);
                    $stream = fopen($file->getRealPath(), 'r');
                    $object = $bucket->upload($stream, [
                        'name' => $path,
                        'metadata' => ['contentType' => $mime],
                    ]);
                    if (is_resource($stream)) { fclose($stream); }
                    try { Log::info('[ClienteDocuments] Uploaded', ['path'=>$path,'mime'=>$mime,'size'=>(int)$file->getSize()]); } catch (\Throwable $e) {}
                    try {
                        $url = $object->signedUrl((new \DateTimeImmutable('+1 year')), ['version' => 'v4']);
                    } catch (\Throwable $e) {
                        $enc = rawurlencode($path); $bn = $bucket->name();
                        $url = "https://firebasestorage.googleapis.com/v0/b/{$bn}/o/{$enc}?alt=media";
                    }
                    $uploaded[] = [
                        'name'=>$name,
                        'path'=>$path,
                        'size'=>(int)$file->getSize(),
                        'contentType'=>$mime,
                        'url'=>$url,
                        'uploaded_at'=>now()->toISOString(),
                        'type'=>$docType ?: 'otro',
                    ];
                } catch (\Throwable $e) {
                    Log::error(' [CLIENTES_UPLOAD] Error subiendo archivo', [
                        'cliente_id' => $id,
                        'file_name' => isset($name) ? $name : null,
                        'error' => $e->getMessage(),
                    ]);
                    return response()->json(['success'=>false,'message'=>'Error al subir archivo: '.$e->getMessage()],500);
                }
            }
            $existing = $cliente->documents ?? [];
            if (!is_array($existing)) $existing = [];
            $cliente->documents = array_values(array_merge($existing, $uploaded));
            $cliente->save();
            return response()->json(['success'=>true,'data'=>$uploaded],201);
        } catch (AuthenticationException $ae) {
            Log::warning(' [CLIENTES_UPLOAD] No autenticado', ['cliente_id'=>$id,'error'=>$ae->getMessage()]);
            return response()->json(['success'=>false,'message'=>'No autenticado'],401);
        } catch (\Illuminate\Validation\ValidationException $ve) {
            return response()->json(['success'=>false,'message'=>'Validación fallida','errors'=>$ve->errors()],422);
        } catch (\Throwable $e) {
            Log::error(' [CLIENTES_UPLOAD] Error inesperado', ['cliente_id'=>$id,'error'=>$e->getMessage()]);
            return response()->json(['success'=>false,'message'=>'Error interno al subir archivo: '.$e->getMessage()],500);
        }
    }

    public function destroy(Request $request, int $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $cliente = Cliente::where('broker_id',$brokerId)->find($id);
            if (!$cliente) return response()->json(['success'=>false,'message'=>'Cliente no encontrado'],404);
            $path = $request->input('path') ?: $request->query('path');
            $name = $request->input('name') ?: $request->query('name');
            if (!$path && !$name) return response()->json(['success'=>false,'message'=>'Debe enviar path o name'],422);
            $bucket = $this->getBucket();
            $docs = is_array($cliente->documents) ? $cliente->documents : [];
            $remaining = []; $deleted = false;
            foreach ($docs as $doc) {
                $matches = ($path && ($doc['path']??'')===$path) || ($name && ($doc['name']??'')===$name);
                if ($matches) {
                    try { $object = $bucket->object($doc['path']); if ($object->exists()) { $object->delete(); } $deleted=true; } catch (\Throwable $e) {}
                    continue;
                }
                $remaining[] = $doc;
            }
            $cliente->documents = array_values($remaining);
            $cliente->save();
            return response()->json(['success'=>true,'data'=>$cliente->documents,'message'=>$deleted?'Documento eliminado':'No se encontró el documento'],200);
        } catch (AuthenticationException $ae) {
            Log::warning(' [CLIENTES_DELETE] No autenticado', ['cliente_id'=>$id,'error'=>$ae->getMessage()]);
            return response()->json(['success'=>false,'message'=>'No autenticado'],401);
        } catch (\Throwable $e) {
            Log::error(' [CLIENTES_DELETE] Error al eliminar documento', ['cliente_id'=>$id,'error'=>$e->getMessage()]);
            return response()->json(['success'=>false,'message'=>'Error al eliminar documento: '.$e->getMessage()],500);
        }
    }

    public function signedUrl(Request $request, int $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $cliente = Cliente::where('broker_id',$brokerId)->find($id);
            if (!$cliente) return response()->json(['success'=>false,'message'=>'Cliente no encontrado'],404);
            $path = $request->input('path') ?: $request->query('path');
            $name = $request->input('name') ?: $request->query('name');
            if (!$path && !$name) return response()->json(['success'=>false,'message'=>'Debe enviar path o name'],422);
            $doc=null; foreach ((array)($cliente->documents??[]) as $d){ if (($path && ($d['path']??'')===$path)||($name && ($d['name']??'')===$name)){ $doc=$d; break; } }
            if (!$doc) return response()->json(['success'=>false,'message'=>'Documento no encontrado'],404);
            $bucket = $this->getBucket(); $object=$bucket->object($doc['path']); if (!$object->exists()) return response()->json(['success'=>false,'message'=>'Archivo no existe'],404);
            $url = $object->signedUrl((new \DateTimeImmutable('+30 minutes')), ['version'=>'v4']);
            return response()->json(['success'=>true,'data'=>['url'=>$url]]);
        } catch (AuthenticationException $ae) {
            Log::warning(' [CLIENTES_SIGNED_URL] No autenticado', ['cliente_id'=>$id,'error'=>$ae->getMessage()]);
            return response()->json(['success'=>false,'message'=>'No autenticado'],401);
        } catch (\Throwable $e) {
            Log::error(' [CLIENTES_SIGNED_URL] Error al generar URL firmada', ['cliente_id'=>$id,'error'=>$e->getMessage()]);
            return response()->json(['success'=>false,'message'=>'No se pudo generar URL: '.$e->getMessage()],500);
        }
    }
}
