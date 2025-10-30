<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

use App\Models\EmailCampaign;
use App\Models\EmailCampaignRecipient;
use App\Models\UploadCsv;
use App\Models\Cliente;
use App\Models\Wallet;
use App\Models\WalletTransaction;

class EmailCampaignsController extends Controller
{
    private function getBrokerId(Request $request): ?int
    {
        // Preferir broker inyectado por middleware unificado
        $brokerId = $request->get('broker_id') ?? $request->get('authenticated_broker_id');
        if (!$brokerId && $request->user()) {
            $brokerId = $request->user()->broker_id;
        }
        return $brokerId ? (int) $brokerId : null;
    }

    public function index(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 403);
            }

            $query = EmailCampaign::forBroker($brokerId);

            if ($request->filled('status')) {
                $query->withStatus($request->get('status'));
            }

            $limit = (int) ($request->get('limit', 15));
            $offset = (int) ($request->get('offset', 0));

            $total = (clone $query)->count();
            $rows = $query->orderBy('created_at', 'desc')
                ->skip($offset)
                ->take($limit)
                ->get();

            return response()->json([
                'success' => true,
                'data' => $rows,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset,
            ]);
        } catch (\Throwable $e) {
            Log::error('EmailCampaignsController@index error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al listar campañas'], 500);
        }
    }

    public function show(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 403);
            }

            $campaign = EmailCampaign::forBroker($brokerId)->findOrFail($id);

            return response()->json(['success' => true, 'data' => $campaign]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Campaña no encontrada'], 404);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 403);
            }

            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'description' => 'nullable|string',
                'template_id' => 'nullable|integer',
                'subject' => 'required|string|max:255',
                'content' => 'nullable|string',
                'audience_type' => 'nullable|in:csv,segment',
                'csv_upload_id' => 'nullable|integer|exists:uploads_csv,id',
                'segment_filters' => 'nullable|array',
                'throttling_per_minute' => 'nullable|integer|min:1|max:120',
                'window_start' => 'nullable|string',
                'window_end' => 'nullable|string',
                'timezone' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Reglas Fase 1: solo audiencias basadas en clientes; CSV permitido; segment opcional para futuro
            $audienceType = $request->get('audience_type', $request->filled('csv_upload_id') ? 'csv' : 'segment');

            if ($audienceType === 'csv' && !$request->filled('csv_upload_id')) {
                return response()->json(['success' => false, 'message' => 'Debe adjuntar un CSV (csv_upload_id)'], 422);
            }

            // Para contenido: o se usa template_id (futuro) o content directo (Fase 1 permitimos subject + content)
            if (!$request->filled('content') && !$request->filled('template_id')) {
                return response()->json(['success' => false, 'message' => 'Debe especificar content o template_id'], 422);
            }

            $campaign = EmailCampaign::create([
                'broker_id' => $brokerId,
                'name' => $request->get('name'),
                'description' => $request->get('description'),
                'template_id' => $request->get('template_id'),
                'subject' => $request->get('subject'),
                'content' => $request->get('content'),
                'audience_type' => $audienceType,
                'csv_upload_id' => $request->get('csv_upload_id'),
                'segment_filters' => $request->get('segment_filters'),
                'throttling_per_minute' => $request->get('throttling_per_minute', 30),
                'window_start' => $request->get('window_start', '00:00'),
                'window_end' => $request->get('window_end', '23:59'),
                'timezone' => $request->get('timezone', 'America/Bogota'),
                'is_active' => false,
                'status' => 'draft',
                'created_by' => optional($request->user())->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Campaña de email creada',
                'data' => $campaign
            ], 201);
        } catch (\Throwable $e) {
            Log::error('EmailCampaignsController@store error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al crear campaña'], 500);
        }
    }

    public function uploadCsv(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 403);
            }

            $validator = Validator::make($request->all(), [
                'file' => 'required|file|mimes:csv,txt|max:20480'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Archivo inválido',
                    'errors' => $validator->errors()
                ], 422);
            }

            $file = $request->file('file');
            $storedDir = 'email_campaign_uploads/' . date('Y/m/d');
            $storedName = uniqid('csv_') . '.csv';
            $storedPath = $file->storeAs($storedDir, $storedName);

            // Parseo rápido para meta
            $absPath = Storage::path($storedPath);
            [$headers, $sampleRows] = $this->readCsvSample($absPath, 25);
            $detected = $headers;

            $upload = UploadCsv::create([
                'broker_id' => $brokerId,
                'created_by' => optional($request->user())->id,
                'original_name' => $file->getClientOriginalName(),
                'filename' => $storedName,
                'storage_path' => $storedPath,
                'size_bytes' => $file->getSize(),
                'detected_columns' => $detected,
                'mapping' => null,
                'total_rows' => count($sampleRows),
                'valid_rows' => 0,
                'invalid_rows' => 0,
                'sample_rows' => array_slice($sampleRows, 0, 10),
            ]);

            return response()->json([
                'success' => true,
                'upload_id' => $upload->id,
                'detected_columns' => $detected,
                'sample_rows' => $upload->sample_rows
            ]);
        } catch (\Throwable $e) {
            Log::error('EmailCampaignsController@uploadCsv error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al subir CSV'], 500);
        }
    }

    public function start(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 403);
            }

            /** @var EmailCampaign $campaign */
            $campaign = EmailCampaign::forBroker($brokerId)->findOrFail($id);

            if (!in_array($campaign->status, ['draft', 'paused', 'scheduled'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'La campaña no está en estado apto para iniciar'
                ], 422);
            }

            // Resolver audiencia SOLO desde clientes (regla)
            $resolved = $this->resolveAudience($campaign, $brokerId);
            $totalResolved = count($resolved);

            if ($totalResolved === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontraron clientes válidos con email para esta campaña'
                ], 422);
            }

            // Insertar recipients (evitar duplicados por campaña + cliente/email)
            $now = now();
            $insertBatch = [];
            $seenEmails = [];

            foreach ($resolved as $row) {
                $email = strtolower(trim($row['email']));
                if (!$email || isset($seenEmails[$email])) {
                    continue;
                }
                $seenEmails[$email] = true;

                $insertBatch[] = [
                    'campaign_id' => $campaign->id,
                    'broker_id' => $brokerId,
                    'cliente_id' => $row['cliente_id'] ?? null,
                    'email' => $email,
                    'name' => $row['name'] ?? null,
                    'variables_resolved' => json_encode($row['variables'] ?? []),
                    'status' => 'pending',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            if (!empty($insertBatch)) {
                // Insert masivo en lotes
                foreach (array_chunk($insertBatch, 1000) as $chunk) {
                    EmailCampaignRecipient::insert($chunk);
                }
            }

            // Marcar campaña como running
            $campaign->update([
                'status' => 'running',
                'is_active' => true,
                'last_execution' => now()
            ]);

            // Verificar saldo en wallet antes de enviar
            $wallet = Wallet::firstOrCreate(
                ['broker_id' => $brokerId],
                [
                    'user_id' => optional($request->user())->id,
                    'balance_cop' => 0,
                    'balance_usd' => 0,
                    'pending_balance' => 0,
                    'total_earnings' => 0,
                    'is_active' => true
                ]
            );

            $costPerEmail = 10; // 10 pesos COP por email
            $totalCost = $totalResolved * $costPerEmail;

            if ($wallet->balance_cop < $totalCost) {
                return response()->json([
                    'success' => false,
                    'message' => "Saldo insuficiente. Se requieren $" . number_format($totalCost, 0, ',', '.') . " COP para enviar {$totalResolved} emails. Saldo actual: $" . number_format($wallet->balance_cop, 0, ',', '.') . " COP",
                    'data' => [
                        'required_balance' => $totalCost,
                        'current_balance' => (float) $wallet->balance_cop,
                        'emails_count' => $totalResolved,
                        'cost_per_email' => $costPerEmail
                    ]
                ], 402);
            }

            // Envío directo vía Twilio SendGrid (sin n8n)
            $apiKey = (string) env('SENDGRID_API_KEY', '');
            $fromEmail = (string) env('SENDGRID_FROM_EMAIL', 'no-reply@guro.co');
            $fromName = (string) env('SENDGRID_FROM_NAME', 'GURO');
            $sentOk = 0;
            $attempted = 0;
            $emailsSent = 0;

            if (!$apiKey) {
                Log::warning('SendGrid no configurado: falta SENDGRID_API_KEY');
            } else {
                $sleepSeconds = max(0.0, 60.0 / max(1, (int) $campaign->throttling_per_minute));
                $pending = EmailCampaignRecipient::where('campaign_id', $campaign->id)
                    ->orderBy('id', 'asc')
                    ->get();

                foreach ($pending as $r) {
                    $attempted++;
                    try {
                        $vars = $r->variables_resolved;
                        if (is_string($vars)) {
                            $decoded = json_decode($vars, true);
                            $vars = is_array($decoded) ? $decoded : [];
                        } elseif (!is_array($vars)) {
                            $vars = [];
                        }

                        // Render simple de variables {{clave}}
                        $html = (string) ($campaign->content ?? '');
                        foreach ($vars as $k => $v) {
                            $html = str_replace('{{' . $k . '}}', (string) $v, $html);
                        }

                        $payload = [
                            'from' => ['email' => $fromEmail, 'name' => $fromName],
                            'personalizations' => [[
                                'to' => [[
                                    'email' => $r->email,
                                    'name' => $r->name ?: $r->email,
                                ]],
                                'subject' => (string) $campaign->subject,
                                'custom_args' => ['campaign_id' => $campaign->id, 'recipient_id' => $r->id],
                            ]],
                            'content' => [[
                                'type' => 'text/html',
                                'value' => $html,
                            ]],
                        ];

                        $resp = Http::withHeaders([
                                'Authorization' => 'Bearer ' . $apiKey,
                                'Content-Type' => 'application/json',
                            ])
                            ->timeout(20)
                            ->post('https://api.sendgrid.com/v3/mail/send', $payload);

                        if ($resp->status() === 202) {
                            $messageId = $resp->header('X-Message-Id') ?: $resp->header('x-message-id');
                            $r->update([
                                'status' => 'sent',
                                'provider_message_id' => $messageId ?: $r->provider_message_id,
                                'sent_at' => $r->sent_at ?: now(),
                            ]);
                            $sentOk++;
                            $emailsSent++;
                        } else {
                            $r->update([
                                'status' => 'failed',
                                'last_error' => 'HTTP ' . $resp->status() . ' ' . mb_substr($resp->body(), 0, 500),
                                'failed_at' => now(),
                            ]);
                            Log::warning('SendGrid devolvió error', [
                                'status' => $resp->status(),
                                'body' => $resp->body()
                            ]);
                        }
                    } catch (\Throwable $e) {
                        $r->update([
                            'status' => 'failed',
                            'last_error' => $e->getMessage(),
                            'failed_at' => now(),
                        ]);
                        Log::error('Error enviando email con SendGrid', ['e' => $e->getMessage()]);
                    }

                    if ($sleepSeconds > 0) {
                        usleep((int) round($sleepSeconds * 1_000_000));
                    }
                }
            }

            // Cobrar por emails enviados exitosamente
            if ($emailsSent > 0) {
                $totalCharged = $emailsSent * $costPerEmail;
                $wallet->balance_cop -= $totalCharged;
                $wallet->save();

                // Registrar transacción
                WalletTransaction::create([
                    'wallet_id' => $wallet->id,
                    'broker_id' => $brokerId,
                    'user_id' => optional($request->user())->id,
                    'type' => 'debit',
                    'amount_cop' => $totalCharged,
                    'amount_usd' => 0,
                    'currency' => 'COP',
                    'description' => "Envío de {$emailsSent} emails - Campaña: {$campaign->name}",
                    'reference_type' => 'email_campaign',
                    'reference_id' => $campaign->id,
                    'balance_cop_after' => $wallet->balance_cop,
                    'metadata' => [
                        'campaign_id' => $campaign->id,
                        'campaign_name' => $campaign->name,
                        'emails_sent' => $emailsSent,
                        'cost_per_email' => $costPerEmail,
                        'total_cost' => $totalCharged
                    ]
                ]);

                Log::info('💰 [WALLET] Cobro por emails enviados', [
                    'broker_id' => $brokerId,
                    'campaign_id' => $campaign->id,
                    'emails_sent' => $emailsSent,
                    'total_charged' => $totalCharged,
                    'new_balance' => $wallet->balance_cop
                ]);
            }

            // Refrescar métricas preliminares
            $campaign->refreshStats();

            return response()->json([
                'success' => true,
                'message' => 'Campaña iniciada',
                'campaign_id' => $campaign->id,
                'resolved_recipients' => $totalResolved,
                'sent_attempted' => $attempted,
                'sent_ok' => $sentOk,
                'wallet_charged' => $emailsSent > 0 ? ($emailsSent * $costPerEmail) : 0,
                'new_balance' => (float) $wallet->balance_cop
            ]);
        } catch (\Throwable $e) {
            Log::error('EmailCampaignsController@start error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al iniciar campaña'], 500);
        }
    }

    public function status(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 403);
            }

            /** @var EmailCampaign $campaign */
            $campaign = EmailCampaign::forBroker($brokerId)->findOrFail($id);
            $campaign->refreshStats();

            return response()->json([
                'success' => true,
                'data' => [
                    'campaign' => $campaign,
                    'stats' => $campaign->stats_json,
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Error al obtener estado'], 500);
        }
    }

    public function recipients(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 403);
            }

            $query = EmailCampaignRecipient::query()
                ->where('campaign_id', $id)
                ->where('broker_id', $brokerId);

            if ($request->filled('status')) {
                $query->where('status', $request->get('status'));
            }

            $limit = (int) ($request->get('limit', 25));
            $page = (int) ($request->get('page', 1));
            $offset = ($page - 1) * $limit;

            $total = (clone $query)->count();
            $rows = $query->orderBy('id', 'asc')->skip($offset)->take($limit)->get();

            return response()->json([
                'success' => true,
                'data' => $rows,
                'total' => $total,
                'page' => $page,
                'limit' => $limit
            ]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Error al obtener destinatarios'], 500);
        }
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 403);
            }

            /** @var EmailCampaign $campaign */
            $campaign = EmailCampaign::forBroker($brokerId)->findOrFail($id);

            // Eliminar recipients primero
            $campaign->recipients()->delete();
            
            // Eliminar la campaña
            $campaign->delete();

            return response()->json([
                'success' => true,
                'message' => 'Campaña eliminada correctamente'
            ]);
        } catch (\Throwable $e) {
            Log::error('EmailCampaignsController@destroy error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al eliminar campaña'], 500);
        }
    }

    public function bulkDelete(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 403);
            }

            $validator = Validator::make($request->all(), [
                'campaign_ids' => 'required|array|min:1',
                'campaign_ids.*' => 'required|integer|min:1',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'IDs de campañas inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $campaignIds = $request->get('campaign_ids');
            
            // Verificar que todas las campañas pertenezcan al broker
            $campaigns = EmailCampaign::forBroker($brokerId)
                ->whereIn('id', $campaignIds)
                ->get();

            if ($campaigns->count() !== count($campaignIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Algunas campañas no existen o no pertenecen a tu broker'
                ], 404);
            }

            $deleted = 0;
            foreach ($campaigns as $campaign) {
                // Eliminar recipients
                $campaign->recipients()->delete();
                // Eliminar campaña
                $campaign->delete();
                $deleted++;
            }

            return response()->json([
                'success' => true,
                'message' => "Se eliminaron {$deleted} campañas correctamente",
                'deleted' => $deleted
            ]);
        } catch (\Throwable $e) {
            Log::error('EmailCampaignsController@bulkDelete error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al eliminar campañas'], 500);
        }
    }

    // ------------------------
    // Helpers de CSV/Audiencia
    // ------------------------

    private function readCsvSample(string $absPath, int $maxRows = 25): array
    {
        $headers = [];
        $rows = [];

        if (!is_readable($absPath)) {
            return [[], []];
        }

        if (($handle = fopen($absPath, 'r')) !== false) {
            $line = 0;
            while (($data = fgetcsv($handle, 0, ',')) !== false) {
                if ($line === 0) {
                    $headers = array_map(function ($h) {
                        return Str::of($h)->lower()->trim()->toString();
                    }, $data);
                } else {
                    $assoc = [];
                    foreach ($headers as $idx => $name) {
                        $assoc[$name] = $data[$idx] ?? null;
                    }
                    $rows[] = $assoc;
                }
                $line++;
                if ($line > $maxRows) {
                    break;
                }
            }
            fclose($handle);
        }

        return [$headers, $rows];
    }

    private function readCsvAll(string $absPath): array
    {
        $headers = [];
        $rows = [];

        if (!is_readable($absPath)) {
            return [];
        }

        if (($handle = fopen($absPath, 'r')) !== false) {
            $line = 0;
            while (($data = fgetcsv($handle, 0, ',')) !== false) {
                if ($line === 0) {
                    $headers = array_map(fn($h) => Str::of($h)->lower()->trim()->toString(), $data);
                } else {
                    $assoc = [];
                    foreach ($headers as $idx => $name) {
                        $assoc[$name] = $data[$idx] ?? null;
                    }
                    $rows[] = $assoc;
                }
                $line++;
            }
            fclose($handle);
        }

        return $rows;
    }

    private function resolveAudience(EmailCampaign $campaign, int $brokerId): array
    {
        // Regla: los emails se obtienen únicamente de los clientes
        // CSV: columnas aceptadas: email_principal|email, numero_documento
        if ($campaign->audience_type === 'csv' && $campaign->csv_upload_id) {
            $upload = UploadCsv::find($campaign->csv_upload_id);
            if (!$upload || !$upload->storage_path) {
                return [];
            }

            $absPath = Storage::path($upload->storage_path);
            $rows = $this->readCsvAll($absPath);

            return $this->mapCsvRowsToClientes($rows, $brokerId);
        }

        // Segmentos: para versiones futuras (usaremos filtros para consultar clientes)
        if ($campaign->audience_type === 'segment') {
            // Resolver audiencia desde el catálogo de clientes del sistema (sin CSV)
            // Reglas mínimas: solo clientes del broker con email_principal válido (no nulo/ vacío y con '@')
            $filters = is_array($campaign->segment_filters) ? $campaign->segment_filters : [];

            // Soportar selección explícita de clientes: segment_filters['cliente_ids'] = [1,2,3,...]
            $clienteIds = [];
            if (isset($filters['cliente_ids']) && is_array($filters['cliente_ids'])) {
                $clienteIds = array_values(
                    array_filter(
                        array_map('intval', $filters['cliente_ids']),
                        fn ($v) => $v > 0
                    )
                );
            }

            // Soportar distintos esquemas: algunas instalaciones no tienen email_principal o usan email
            // Evitar errores SQL si la columna no existe, verificándola en tiempo de ejecución.
            $hasEmailPrincipal = \Illuminate\Support\Facades\Schema::hasColumn('clientes', 'email_principal');
            $hasEmail         = \Illuminate\Support\Facades\Schema::hasColumn('clientes', 'email');

            $query = Cliente::where('broker_id', $brokerId);

            // Si se envían IDs específicos, restringir a ese conjunto
            if (!empty($clienteIds)) {
                $query->whereIn('id', $clienteIds);
            }

            $query->where(function ($q) use ($hasEmailPrincipal, $hasEmail) {
                $added = false;
                if ($hasEmailPrincipal) {
                    $q->orWhere(function ($qq) {
                        $qq->whereNotNull('email_principal')
                           ->where('email_principal', '<>', '')
                           ->where('email_principal', 'like', '%@%');
                    });
                    $added = true;
                }
                if ($hasEmail) {
                    $q->orWhere(function ($qq) {
                        $qq->whereNotNull('email')
                           ->where('email', '<>', '')
                           ->where('email', 'like', '%@%');
                    });
                    $added = true;
                }
                // Si no existe ninguna columna de email conocida, forzar conjunto vacío
                if (!$added) {
                    $q->whereRaw('1=0');
                }
            });

            // Extensión opcional de filtros simples (si se envían en segment_filters)
            // Ejemplos tentativos; ajustar a tu modelo real si lo deseas:
            if (isset($filters['estado']) && is_string($filters['estado'])) {
                // $query->where('estado', $filters['estado']);
            }
            if (isset($filters['vendedor_id']) && is_numeric($filters['vendedor_id'])) {
                // $query->where('vendedor_id', (int) $filters['vendedor_id']);
            }

            // Límite de seguridad para evitar cargas extremas
            // Seleccionar todas las columnas para evitar errores por diferencias de esquema (nombre/nombres/first_name, etc.)
            $clientes = $query->limit(50000)->get();

            $resolved = [];
            foreach ($clientes as $c) {
                // Tomar email desde email_principal o email (según exista)
                $email = strtolower(trim((string) ($c->email_principal ?? $c->email ?? '')));
                if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    continue;
                }
                // Resolver nombre con tolerancia a distintos esquemas
                $firstName = $c->nombre ?? $c->nombres ?? $c->first_name ?? $c->primer_nombre ?? $c->name ?? null;
                $lastName  = $c->apellidos ?? $c->last_name ?? $c->segundo_apellido ?? null;
                $displayName = trim(trim((string)($firstName ?? '')) . ' ' . trim((string)($lastName ?? '')));

                $resolved[] = [
                    'cliente_id' => $c->id,
                    'email' => $email,
                    'name' => $displayName !== '' ? $displayName : null,
                    'variables' => [
                        'nombre' => (string) ($firstName ?? ''),
                        'apellidos' => (string) ($lastName ?? ''),
                        'email_principal' => (string) ($c->email_principal ?? ''),
                        'numero_documento' => (string) ($c->numero_documento ?? $c->documento ?? ''),
                    ],
                ];
            }

            return $resolved;
        }

        return [];
    }

    private function mapCsvRowsToClientes(array $rows, int $brokerId): array
    {
        $resolved = [];
        $seenCliente = [];

        foreach ($rows as $row) {
            // Normalizar cabeceras típicas
            $email = null;
            foreach (['email_principal', 'email', 'correo', 'mail'] as $key) {
                if (isset($row[$key]) && filter_var(trim($row[$key]), FILTER_VALIDATE_EMAIL)) {
                    $email = strtolower(trim($row[$key]));
                    break;
                }
            }

            $doc = null;
            foreach (['numero_documento', 'documento', 'dni', 'nit'] as $key) {
                if (isset($row[$key]) && trim((string)$row[$key]) !== '') {
                    $doc = trim((string)$row[$key]);
                    break;
                }
            }

            // Buscar cliente por email preferentemente
            $cliente = null;
            if ($email) {
                $cliente = Cliente::where('broker_id', $brokerId)
                    ->where(function ($q) use ($email) {
                        $q->where('email_principal', $email)
                          ->orWhere('email_principal', 'like', $email);
                    })
                    ->first();
            }

            // Si no hay por email, intentar por documento y que tenga email_principal
            if (!$cliente && $doc) {
                $cliente = Cliente::where('broker_id', $brokerId)
                    ->where(function ($q) use ($doc) {
                        $q->where('numero_documento', $doc)->orWhere('documento', $doc);
                    })
                    ->whereNotNull('email_principal')
                    ->first();
                if ($cliente) {
                    $email = strtolower(trim($cliente->email_principal ?? ''));
                }
            }

            if ($cliente && $email) {
                if (isset($seenCliente[$cliente->id])) {
                    continue;
                }
                $seenCliente[$cliente->id] = true;

                $nombre = trim(($cliente->nombre ?? '') . ' ' . ($cliente->apellidos ?? ''));
                $resolved[] = [
                    'cliente_id' => $cliente->id,
                    'email' => $email,
                    'name' => $nombre !== '' ? $nombre : null,
                    // Variables opcionales para merge (si se requieren)
                    'variables' => [
                        'nombre' => $cliente->nombre ?? '',
                        'apellidos' => $cliente->apellidos ?? '',
                        'email_principal' => $cliente->email_principal ?? '',
                        'numero_documento' => $cliente->numero_documento ?? '',
                    ],
                ];
            }
        }

        return $resolved;
    }
}