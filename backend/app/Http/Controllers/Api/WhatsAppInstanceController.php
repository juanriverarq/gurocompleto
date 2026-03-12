<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WhatsAppInstance;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use App\Services\WhatsAppCloudApiService;
use App\Http\Middleware\UnifiedAuthMiddleware;
use App\Models\EmpleadoBroker;

class WhatsAppInstanceController extends Controller
{
    private function resolveUserAndBroker(Request $request): array
    {
        $user = UnifiedAuthMiddleware::getAuthenticatedUser($request);
        if (!$user) return [null, null];
        $broker = ($user instanceof EmpleadoBroker) ? $user->broker : $user->getPrimaryBroker();
        return [$user, $broker];
    }

    private string $whatsappMicroserviceUrl;

    public function __construct()
    {
        // ✅ CORREGIDO: Puerto 3000 (no 3300)
        $this->whatsappMicroserviceUrl = rtrim(env('WHATSAPP_SERVICE_URL', 'http://127.0.0.1:3000/api/v1'), '/');
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        
        if (!$broker) {
            return response(['error' => 'No broker found for user'], 404);
        }

        $instances = WhatsAppInstance::with('broker')
            ->where('broker_id', $broker->id)
            ->get();
            
        return response($instances, 200);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        
        if (!$broker) {
            return response(['error' => 'No broker found for user'], 404);
        }

        $validated = $request->validate([
            'connection_type' => 'nullable|in:baileys,cloud_api,ycloud',
            'phone_number' => 'nullable|string',
            'webhook_url' => 'nullable|url',
            'settings' => 'nullable|array',
            'cloud_api_phone_id' => 'nullable|string',
            'cloud_api_business_id' => 'nullable|string',
            'cloud_api_token' => 'nullable|string',
            'cloud_api_verify_token' => 'nullable|string',
        ]);

        $connectionType = $validated['connection_type'] ?? 'baileys';

        // Validar credenciales de YCloud (coexistencia) antes de crear la instancia
        if ($connectionType === 'ycloud') {
            $ycloudApiKey = $validated['settings']['ycloud_api_key'] ?? env('YCLOUD_API_KEY');
            $phoneNumber = $validated['phone_number'] ?? null;

            if (empty($ycloudApiKey)) {
                return response([
                    'error' => 'Se requiere una API Key de YCloud. Configúrala en la instancia o en el .env del servidor.'
                ], 422);
            }

            if (empty($phoneNumber)) {
                return response([
                    'error' => 'Se requiere el número de teléfono de WhatsApp Business.'
                ], 422);
            }

            // Verificar credenciales con YCloud API
            try {
                $verifyResponse = Http::withHeaders([
                    'X-API-Key' => $ycloudApiKey,
                ])->timeout(10)->get('https://api.ycloud.com/v2/whatsapp/phoneNumbers');

                if (!$verifyResponse->successful()) {
                    Log::warning('❌ [YCLOUD] API Key inválida o error de conexión', [
                        'status' => $verifyResponse->status(),
                        'error' => $verifyResponse->body(),
                    ]);
                    return response([
                        'error' => 'Error al verificar credenciales de YCloud: ' . ($verifyResponse->json('message') ?? 'API Key inválida')
                    ], 422);
                }

                $phoneNumbers = $verifyResponse->json('items', []);
                Log::info('✅ [YCLOUD] Credenciales verificadas', [
                    'phone_numbers_count' => count($phoneNumbers),
                ]);

                // Try to find the matching phone number to get its ID and WABA ID
                $matchedPhone = null;
                $normalizedInput = preg_replace('/[^0-9]/', '', $phoneNumber);
                foreach ($phoneNumbers as $pn) {
                    $normalizedPn = preg_replace('/[^0-9]/', '', $pn['phoneNumber'] ?? '');
                    if ($normalizedPn === $normalizedInput || str_ends_with($normalizedPn, $normalizedInput) || str_ends_with($normalizedInput, $normalizedPn)) {
                        $matchedPhone = $pn;
                        break;
                    }
                }

                // Store phone number ID and WABA ID if found
                if ($matchedPhone) {
                    $validated['cloud_api_phone_id'] = $matchedPhone['id'] ?? null;
                    $validated['cloud_api_business_id'] = $matchedPhone['wabaId'] ?? null;
                    $validated['phone_number'] = $matchedPhone['phoneNumber'] ?? $phoneNumber;
                    Log::info('✅ [YCLOUD] Número encontrado en YCloud', [
                        'phone_id' => $matchedPhone['id'] ?? 'N/A',
                        'waba_id' => $matchedPhone['wabaId'] ?? 'N/A',
                        'phone' => $matchedPhone['phoneNumber'] ?? 'N/A',
                    ]);
                } else {
                    Log::warning('⚠️ [YCLOUD] Número no encontrado exacto en YCloud, usando primer número disponible', [
                        'input' => $phoneNumber,
                        'available' => array_column($phoneNumbers, 'phoneNumber'),
                    ]);
                    // Use the first available phone number if no exact match
                    if (!empty($phoneNumbers)) {
                        $validated['cloud_api_phone_id'] = $phoneNumbers[0]['id'] ?? null;
                        $validated['cloud_api_business_id'] = $phoneNumbers[0]['wabaId'] ?? null;
                        $validated['phone_number'] = $phoneNumbers[0]['phoneNumber'] ?? $phoneNumber;
                    }
                }

            } catch (\Exception $e) {
                Log::error('❌ [YCLOUD] Error al verificar credenciales', [
                    'error' => $e->getMessage(),
                ]);
                return response([
                    'error' => 'No se pudo conectar con YCloud: ' . $e->getMessage()
                ], 422);
            }

            // Auto-registrar webhook en YCloud
            try {
                $webhookUrl = rtrim(config('app.url', 'https://guro.co'), '/') . '/api/webhooks/ycloud-whatsapp';
                $ycloudEvents = [
                    'whatsapp.inbound_message.received',
                    'whatsapp.message.updated',
                    'whatsapp.smb.history',
                    'whatsapp.smb.message.echoes',
                    'whatsapp.smb.app.state.sync',
                    'whatsapp.template.reviewed',
                    'whatsapp.phone_number.quality_updated',
                ];

                // Check existing webhooks
                $existingResponse = Http::withHeaders([
                    'X-API-Key' => $ycloudApiKey,
                ])->timeout(10)->get('https://api.ycloud.com/v2/webhookEndpoints');

                $existingWebhooks = $existingResponse->json('items', []);
                $webhookFound = false;

                foreach ($existingWebhooks as $wh) {
                    // If there's already a webhook, update its URL and ensure it's active
                    if ($wh['url'] === $webhookUrl && $wh['status'] === 'active') {
                        $webhookFound = true;
                        Log::info('✅ [YCLOUD] Webhook ya configurado y activo', ['id' => $wh['id']]);
                        break;
                    }

                    // Update existing webhook with correct URL and activate it
                    $updateData = [];
                    if ($wh['url'] !== $webhookUrl) {
                        $updateData['url'] = $webhookUrl;
                    }
                    if ($wh['status'] !== 'active') {
                        $updateData['status'] = 'active';
                    }
                    if (!empty($updateData)) {
                        Http::withHeaders(['X-API-Key' => $ycloudApiKey])
                            ->timeout(10)
                            ->patch("https://api.ycloud.com/v2/webhookEndpoints/{$wh['id']}", $updateData);
                        Log::info('✅ [YCLOUD] Webhook actualizado', ['id' => $wh['id'], 'updates' => $updateData]);
                    }
                    $webhookFound = true;
                    break;
                }

                // Create new webhook if none exists
                if (!$webhookFound) {
                    $createResponse = Http::withHeaders([
                        'X-API-Key' => $ycloudApiKey,
                    ])->timeout(10)->post('https://api.ycloud.com/v2/webhookEndpoints', [
                        'url' => $webhookUrl,
                        'enabledEvents' => $ycloudEvents,
                        'status' => 'active',
                    ]);

                    if ($createResponse->successful()) {
                        Log::info('✅ [YCLOUD] Webhook creado automáticamente', [
                            'url' => $webhookUrl,
                            'webhook_id' => $createResponse->json('id'),
                        ]);
                    } else {
                        Log::warning('⚠️ [YCLOUD] No se pudo crear webhook automáticamente', [
                            'error' => $createResponse->body(),
                        ]);
                    }
                }
            } catch (\Exception $webhookError) {
                // Non-fatal: instance still created, webhook can be configured manually
                Log::warning('⚠️ [YCLOUD] Error configurando webhook automáticamente (no fatal)', [
                    'error' => $webhookError->getMessage(),
                ]);
            }
        }

        // Validar credenciales de Cloud API antes de crear la instancia
        if ($connectionType === 'cloud_api') {
            $phoneId = $validated['cloud_api_phone_id'] ?? null;
            $token = $validated['cloud_api_token'] ?? null;

            if (empty($phoneId) || empty($token)) {
                return response([
                    'error' => 'Phone Number ID y Access Token son requeridos para Cloud API'
                ], 422);
            }

            // Verificar credenciales con la API de Meta
            try {
                $verifyResponse = Http::withToken($token)
                    ->timeout(10)
                    ->get("https://graph.facebook.com/v22.0/{$phoneId}");

                if (!$verifyResponse->successful()) {
                    $errorData = $verifyResponse->json();
                    $errorMessage = $errorData['error']['message'] ?? 'Credenciales inválidas';
                    
                    Log::warning('❌ [CLOUD API] Credenciales inválidas', [
                        'phone_id' => $phoneId,
                        'error' => $errorMessage
                    ]);

                    return response([
                        'error' => 'Credenciales de Cloud API inválidas: ' . $errorMessage
                    ], 422);
                }

                $phoneData = $verifyResponse->json();
                Log::info('✅ [CLOUD API] Credenciales verificadas', [
                    'phone_id' => $phoneId,
                    'verified_name' => $phoneData['verified_name'] ?? 'N/A',
                    'display_phone' => $phoneData['display_phone_number'] ?? 'N/A'
                ]);

            } catch (\Exception $e) {
                Log::error('❌ [CLOUD API] Error al verificar credenciales', [
                    'phone_id' => $phoneId,
                    'error' => $e->getMessage()
                ]);

                return response([
                    'error' => 'No se pudo verificar las credenciales de Cloud API: ' . $e->getMessage()
                ], 422);
            }
        }

        // Generar instance_id único
        $instanceId = 'instance_' . $broker->id . '_' . Str::random(8);
        
        // Crear instancia en la base de datos
        $instance = WhatsAppInstance::create([
            'broker_id' => $broker->id,
            'instance_id' => $instanceId,
            'connection_type' => $connectionType,
            'cloud_api_phone_id' => $validated['cloud_api_phone_id'] ?? null,
            'cloud_api_business_id' => $validated['cloud_api_business_id'] ?? null,
            'cloud_api_token' => $validated['cloud_api_token'] ?? null,
            'cloud_api_verify_token' => $validated['cloud_api_verify_token'] ?? null,
            'phone_number' => $validated['phone_number'] ?? null,
            'webhook_url' => $validated['webhook_url'] ?? null,
            'settings' => $validated['settings'] ?? [],
            'status' => in_array($connectionType, ['cloud_api', 'ycloud']) ? 'connected' : 'disconnected',
        ]);

        // Solo sincronizar con microservicio si es tipo Baileys (QR)
        // Cloud API no necesita el microservicio, se conecta directamente a Meta
        if ($connectionType === 'baileys') {
            try {
                Log::info('🔄 [INSTANCE SYNC] Creando instancia en microservicio', [
                    'instance_id' => $instanceId,
                    'broker_id' => $broker->id,
                    'microservice_url' => $this->whatsappMicroserviceUrl
                ]);
                
                $response = Http::timeout(10)->post($this->whatsappMicroserviceUrl . '/instances', [
                    'instanceId' => $instanceId,
                    'webhook' => $validated['webhook_url'] ?? null,
                    'settings' => $validated['settings'] ?? [],
                ]);

                if ($response->successful()) {
                    $responseData = $response->json();
                    
                    Log::info('✅ [INSTANCE SYNC] Instancia creada en microservicio', [
                        'instance_id' => $instanceId,
                        'response' => $responseData
                    ]);
                    
                    $instance->update([
                        'status' => 'connecting',
                        'session_data' => $responseData,
                        'last_activity_at' => now()
                    ]);
                    
                    // Esperar un momento y verificar si se conectó automáticamente
                    sleep(2);
                    
                    try {
                        $statusResponse = Http::timeout(5)->get($this->whatsappMicroserviceUrl . '/instances/' . $instanceId . '/status');
                        if ($statusResponse->successful()) {
                            $statusData = $statusResponse->json();
                            $newStatus = $statusData['connected'] ? 'connected' : ($statusData['connecting'] ? 'connecting' : 'disconnected');
                            
                            Log::info('📊 [INSTANCE SYNC] Estado inicial de instancia', [
                                'instance_id' => $instanceId,
                                'status' => $newStatus,
                                'connected' => $statusData['connected'] ?? false
                            ]);
                            
                            $instance->update([
                                'status' => $newStatus,
                                'last_activity_at' => now()
                            ]);
                        }
                    } catch (\Exception $statusError) {
                        Log::warning('⚠️ [INSTANCE SYNC] No se pudo verificar estado inicial', [
                            'instance_id' => $instanceId,
                            'error' => $statusError->getMessage()
                        ]);
                    }
                } else {
                    Log::error('❌ [INSTANCE SYNC] Error al crear instancia en microservicio', [
                        'instance_id' => $instanceId,
                        'status_code' => $response->status(),
                        'response_body' => $response->body()
                    ]);
                    
                    // Marcar instancia como error pero no fallar la creación en BD
                    $instance->update([
                        'status' => 'error',
                        'error_message' => 'Failed to create in microservice: ' . $response->body()
                    ]);
                }
            } catch (\Exception $e) {
                Log::error('❌ [INSTANCE SYNC] Exception al crear instancia en microservicio', [
                    'instance_id' => $instanceId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
                
                // Marcar instancia como error pero no fallar la creación en BD
                $instance->update([
                    'status' => 'error',
                    'error_message' => 'Exception creating in microservice: ' . $e->getMessage()
                ]);
            }
        }

        return response($instance->load('broker'), 201);
    }

    /**
     * Handle Meta Embedded Signup callback
     * Receives the code from Facebook Login, exchanges it for a token,
     * then fetches WABA and phone number info to create the instance.
     */
    public function embeddedSignup(Request $request): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);

        if (!$broker) {
            return response(['error' => 'No broker found for user'], 404);
        }

        $validated = $request->validate([
            'code' => 'required|string',
            'waba_id' => 'nullable|string',
            'phone_number_id' => 'nullable|string',
        ]);

        $appId = env('META_APP_ID');
        $appSecret = env('META_APP_SECRET');

        if (!$appId || !$appSecret) {
            return response(['error' => 'META_APP_ID y META_APP_SECRET no configurados en el servidor'], 500);
        }

        // Check if sessionInfo was provided from frontend (sessionInfoVersion: 3)
        $sessionWabaId = $validated['waba_id'] ?? null;
        $sessionPhoneNumberId = $validated['phone_number_id'] ?? null;

        Log::info('📋 [EMBEDDED SIGNUP] Request received', [
            'has_session_waba_id' => !empty($sessionWabaId),
            'has_session_phone_number_id' => !empty($sessionPhoneNumberId),
            'session_waba_id' => $sessionWabaId,
            'session_phone_number_id' => $sessionPhoneNumberId,
        ]);

        try {
            // Step 1: Exchange code for user access token
            Log::info('🔄 [EMBEDDED SIGNUP] Exchanging code for token...');

            $tokenResponse = Http::get('https://graph.facebook.com/v22.0/oauth/access_token', [
                'client_id' => $appId,
                'client_secret' => $appSecret,
                'code' => $validated['code'],
            ]);

            if (!$tokenResponse->successful()) {
                $err = $tokenResponse->json('error.message', 'Error exchanging code');
                Log::error('❌ [EMBEDDED SIGNUP] Token exchange failed', ['error' => $err]);
                return response(['error' => 'Error al intercambiar código: ' . $err], 400);
            }

            $accessToken = $tokenResponse->json('access_token');

            if (!$accessToken) {
                return response(['error' => 'No se recibió access_token de Meta'], 400);
            }

            Log::info('✅ [EMBEDDED SIGNUP] Token obtained');

            // Step 2: Get WABA ID - use sessionInfo if available, otherwise discover via debug_token
            $wabaId = $sessionWabaId;

            if (!$wabaId) {
                // Use app access token to inspect the user token
                $appAccessToken = $appId . '|' . $appSecret;
                $sharedWabasResponse = Http::withToken($appAccessToken)
                    ->get('https://graph.facebook.com/v22.0/debug_token', [
                        'input_token' => $accessToken,
                    ]);

                $debugData = $sharedWabasResponse->json('data', []);
                Log::info('🔍 [EMBEDDED SIGNUP] debug_token response', [
                    'scopes' => $debugData['scopes'] ?? [],
                    'granular_scopes' => $debugData['granular_scopes'] ?? [],
                    'app_id' => $debugData['app_id'] ?? null,
                    'type' => $debugData['type'] ?? null,
                ]);
                $granularScopes = $debugData['granular_scopes'] ?? [];

                // Extract WABA ID from granular scopes
                foreach ($granularScopes as $gs) {
                    $scopeName = $gs['scope'] ?? $gs['permission'] ?? '';
                    if ($scopeName === 'whatsapp_business_management' && !empty($gs['target_ids'])) {
                        $wabaId = $gs['target_ids'][0];
                        break;
                    }
                }

                // Alternative: try to get WABAs directly
                if (!$wabaId) {
                    $wabasResponse = Http::withToken($accessToken)
                        ->get('https://graph.facebook.com/v22.0/me/businesses');

                    $businesses = $wabasResponse->json('data', []);
                    if (!empty($businesses)) {
                        $businessId = $businesses[0]['id'];
                        $wabaListResponse = Http::withToken($accessToken)
                            ->get("https://graph.facebook.com/v22.0/{$businessId}/owned_whatsapp_business_accounts");
                        $wabas = $wabaListResponse->json('data', []);
                        if (!empty($wabas)) {
                            $wabaId = $wabas[0]['id'];
                        }
                    }
                }
            }

            if (!$wabaId) {
                Log::warning('⚠️ [EMBEDDED SIGNUP] No WABA ID found');
                return response(['error' => 'No se encontró una cuenta de WhatsApp Business. Asegúrate de completar el proceso de registro.'], 400);
            }

            Log::info('✅ [EMBEDDED SIGNUP] WABA found', ['waba_id' => $wabaId, 'from_session' => !empty($sessionWabaId)]);

            // Step 3: Get phone number info
            $phoneNumberId = $sessionPhoneNumberId;
            $displayPhone = '';
            $verifiedName = '';

            if ($phoneNumberId) {
                // Use the phone_number_id from sessionInfo directly
                $phoneResponse = Http::withToken($accessToken)
                    ->get("https://graph.facebook.com/v22.0/{$phoneNumberId}");

                if ($phoneResponse->successful()) {
                    $phoneData = $phoneResponse->json();
                    $displayPhone = $phoneData['display_phone_number'] ?? '';
                    $verifiedName = $phoneData['verified_name'] ?? '';
                }

                Log::info('✅ [EMBEDDED SIGNUP] Phone from sessionInfo', [
                    'phone_number_id' => $phoneNumberId,
                    'display_phone' => $displayPhone,
                    'verified_name' => $verifiedName,
                ]);
            } else {
                // Fallback: list phone numbers from the WABA
                $phonesResponse = Http::withToken($accessToken)
                    ->get("https://graph.facebook.com/v22.0/{$wabaId}/phone_numbers");

                $phones = $phonesResponse->json('data', []);

                if (empty($phones)) {
                    return response(['error' => 'No se encontraron números de teléfono en la cuenta WABA. Completa la verificación del número.'], 400);
                }

                $phoneData = $phones[0];
                $phoneNumberId = $phoneData['id'];
                $displayPhone = $phoneData['display_phone_number'] ?? '';
                $verifiedName = $phoneData['verified_name'] ?? '';

                Log::info('✅ [EMBEDDED SIGNUP] Phone from WABA listing', [
                    'phone_number_id' => $phoneNumberId,
                    'display_phone' => $displayPhone,
                    'verified_name' => $verifiedName,
                ]);
            }

            // Step 4: Subscribe the app to the WABA for webhooks (including coexistence fields)
            $subscribeResponse = Http::withToken($accessToken)
                ->post("https://graph.facebook.com/v22.0/{$wabaId}/subscribed_apps", [
                    'subscribed_fields' => ['messages', 'message_echoes', 'smb_message_echoes', 'smb_app_state_sync', 'history'],
                ]);

            Log::info('📡 [EMBEDDED SIGNUP] Webhook subscription', [
                'waba_id' => $wabaId,
                'success' => $subscribeResponse->successful(),
                'response' => $subscribeResponse->json(),
                'fields' => ['messages', 'message_echoes', 'smb_message_echoes', 'smb_app_state_sync', 'history'],
            ]);

            // Step 5: Check if instance already exists for this phone
            $existing = WhatsAppInstance::where('broker_id', $broker->id)
                ->where('cloud_api_phone_id', $phoneNumberId)
                ->first();

            if ($existing) {
                // Update existing instance with new token
                $existing->update([
                    'cloud_api_token' => $accessToken,
                    'cloud_api_business_id' => $wabaId,
                    'phone_number' => $displayPhone,
                    'status' => 'connected',
                    'is_active' => true,
                    'last_activity_at' => now(),
                ]);

                Log::info('✅ [EMBEDDED SIGNUP] Existing instance updated', ['instance_id' => $existing->id]);

                return response([
                    'success' => true,
                    'instance' => $existing->fresh(),
                    'message' => 'Conexión actualizada exitosamente',
                    'phone' => $displayPhone,
                    'verified_name' => $verifiedName,
                ], 200);
            }

            // Step 6: Create new instance
            $instanceId = 'instance_' . $broker->id . '_' . Str::random(8);
            $verifyToken = 'guro_' . Str::random(16);

            $instance = WhatsAppInstance::create([
                'broker_id' => $broker->id,
                'instance_id' => $instanceId,
                'connection_type' => 'cloud_api',
                'cloud_api_phone_id' => $phoneNumberId,
                'cloud_api_business_id' => $wabaId,
                'cloud_api_token' => $accessToken,
                'cloud_api_verify_token' => $verifyToken,
                'phone_number' => $displayPhone,
                'status' => 'connected',
                'is_active' => true,
                'last_activity_at' => now(),
            ]);

            Log::info('✅ [EMBEDDED SIGNUP] New instance created', [
                'instance_id' => $instance->id,
                'waba_id' => $wabaId,
                'phone_number_id' => $phoneNumberId,
                'display_phone' => $displayPhone,
            ]);

            return response([
                'success' => true,
                'instance' => $instance,
                'message' => 'WhatsApp conectado exitosamente via Embedded Signup',
                'phone' => $displayPhone,
                'verified_name' => $verifiedName,
            ], 201);

        } catch (\Exception $e) {
            Log::error('❌ [EMBEDDED SIGNUP] Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response([
                'error' => 'Error en el proceso de conexión: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, WhatsAppInstance $whatsAppInstance): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }

        return response($whatsAppInstance->load('broker'), 200);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, WhatsAppInstance $whatsAppInstance): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'phone_number' => 'nullable|string',
            'webhook_url' => 'nullable|url',
            'settings' => 'nullable|array',
        ]);

        $whatsAppInstance->update($validated);
        return response($whatsAppInstance, 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, WhatsAppInstance $whatsAppInstance): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }

        // Eliminar instancia en el microservicio
        try {
            Http::delete($this->whatsappMicroserviceUrl . '/instances/' . $whatsAppInstance->instance_id);
        } catch (\Exception $e) {
            Log::error('Failed to delete WhatsApp instance in microservice', [
                'instance_id' => $whatsAppInstance->instance_id,
                'error' => $e->getMessage()
            ]);
        }

        $whatsAppInstance->delete();
        return response(null, 204);
    }

    /**
     * Get QR code for WhatsApp authentication
     */
    public function getQrCode(Request $request, WhatsAppInstance $whatsAppInstance): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }

        try {
            Log::info('🔲 Solicitando QR para instancia', [
                'instance_id' => $whatsAppInstance->instance_id,
                'current_status' => $whatsAppInstance->status,
                'broker_id' => $broker->id
            ]);
            
            $response = Http::get($this->whatsappMicroserviceUrl . '/instances/' . $whatsAppInstance->instance_id . '/qr');
            
            if ($response->successful()) {
                $data = $response->json();
                
                Log::info('🔲 Respuesta exitosa del microservicio para QR', [
                    'instance_id' => $whatsAppInstance->instance_id,
                    'has_qr' => isset($data['qr']),
                    'response_data' => $data
                ]);
                
                // Si hay QR disponible, guardarlo SOLO cambiando a qr_pending
                if (isset($data['qr'])) {
                    Log::info('🔲 Guardando QR code y cambiando estado a qr_pending', [
                        'instance_id' => $whatsAppInstance->instance_id,
                        'old_status' => $whatsAppInstance->status
                    ]);
                    
                    $whatsAppInstance->setQrCode($data['qr']);
                    
                    Log::info('🔲 Estado actualizado después de setQrCode', [
                        'instance_id' => $whatsAppInstance->instance_id,
                        'new_status' => $whatsAppInstance->fresh()->status
                    ]);
                }
                
                return response($data, 200);
            } else {
                // Si el microservicio no responde exitosamente, intentar obtener la respuesta de error
                $errorData = $response->json();
                
                Log::info('🔲 Respuesta no exitosa del microservicio para QR', [
                    'instance_id' => $whatsAppInstance->instance_id,
                    'status_code' => $response->status(),
                    'response_data' => $errorData
                ]);
                
                // Si es un error específico sobre instancia ya conectada, devolverlo tal como viene
                if (isset($errorData['success']) && $errorData['success'] === false) {
                    return response($errorData, $response->status());
                }
                
                return response(['error' => 'Failed to get QR code'], 500);
            }
        } catch (\Exception $e) {
            Log::error('Failed to get QR code', [
                'instance_id' => $whatsAppInstance->instance_id,
                'error' => $e->getMessage()
            ]);
            
            return response(['error' => 'Service unavailable'], 503);
        }
    }

    /**
     * Get connection status
     */
    public function getStatus(Request $request, WhatsAppInstance $whatsAppInstance): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }

        // Para instancias YCloud, verificar con YCloud API
        if ($whatsAppInstance->isYCloud()) {
            return $this->getYCloudStatus($whatsAppInstance);
        }

        // Para instancias Cloud API, verificar directamente con Meta (no usar microservicio Baileys)
        if ($whatsAppInstance->isCloudApi()) {
            return $this->getCloudApiStatus($whatsAppInstance);
        }

        try {
            $response = Http::timeout(10)->get($this->whatsappMicroserviceUrl . '/instances/' . $whatsAppInstance->instance_id . '/status');
            
            if ($response->successful()) {
                $data = $response->json();
                
                // Verificar que la respuesta corresponde a esta instancia específica
                if (isset($data['instanceId']) && $data['instanceId'] === $whatsAppInstance->instance_id) {
                    // Determinar el estado real basado en connected/connecting
                    $realStatus = 'disconnected';
                    if ($data['connected'] ?? false) {
                        $realStatus = 'connected';
                    } elseif ($data['connecting'] ?? false) {
                        $realStatus = 'connecting';
                    }
                    
                    // Preparar datos de actualización
                    $updateData = [
                        'last_activity_at' => now(),
                    ];
                    
                    // Actualizar estado si cambió
                    if ($realStatus !== $whatsAppInstance->status) {
                        Log::info('📊 [STATUS SYNC] Actualizando estado de instancia', [
                            'instance_id' => $whatsAppInstance->instance_id,
                            'old_status' => $whatsAppInstance->status,
                            'new_status' => $realStatus,
                            'microservice_data' => $data
                        ]);
                        
                        $updateData['status'] = $realStatus;
                        
                        // Si se conectó, limpiar QR y actualizar timestamp
                        if ($realStatus === 'connected') {
                            $updateData['qr_code'] = null;
                            $updateData['qr_expires_at'] = null;
                            $updateData['last_connected_at'] = now();
                            $updateData['error_message'] = null;
                            $updateData['reconnect_attempts'] = 0;
                        }
                    }
                    
                    // Actualizar phone_number si viene
                    if (!empty($data['phoneNumber'])) {
                        $updateData['phone_number'] = $data['phoneNumber'];
                    }
                    
                    // Guardar session_id si viene en la respuesta
                    if (!empty($data['sessionId'])) {
                        $updateData['session_id'] = $data['sessionId'];
                    }
                    
                    $whatsAppInstance->update($updateData);
                } else {
                    // Si no hay instanceId en la respuesta o no coincide, marcar como desconectado
                    Log::warning('Respuesta de estado no coincide con instancia', [
                        'expected_instance_id' => $whatsAppInstance->instance_id,
                        'received_instance_id' => $data['instanceId'] ?? 'null',
                        'marking_as_disconnected' => true
                    ]);
                    
                    if ($whatsAppInstance->status !== 'disconnected') {
                        $whatsAppInstance->update([
                            'status' => 'disconnected',
                            'last_activity_at' => now(),
                        ]);
                    }
                }
                
                return response($data, 200);
            } else {
                // Si la instancia no existe en el microservicio (404), intentar recrearla
                if ($response->status() === 404) {
                    Log::info('🔄 [STATUS SYNC] Instancia no existe en microservicio, intentando recrear', [
                        'instance_id' => $whatsAppInstance->instance_id
                    ]);
                    
                    try {
                        $createResponse = Http::post($this->whatsappMicroserviceUrl . '/instances', [
                            'instanceId' => $whatsAppInstance->instance_id,
                            'settings' => $whatsAppInstance->settings ?? []
                        ]);
                        
                        if ($createResponse->successful()) {
                            Log::info('✅ [STATUS SYNC] Instancia recreada en microservicio', [
                                'instance_id' => $whatsAppInstance->instance_id
                            ]);
                            
                            $whatsAppInstance->update([
                                'status' => 'disconnected',
                                'last_activity_at' => now(),
                            ]);
                            
                            return response([
                                'success' => true,
                                'instanceId' => $whatsAppInstance->instance_id,
                                'status' => 'disconnected',
                                'connected' => false,
                                'connecting' => false,
                                'message' => 'Instancia recreada. Escanea el QR para conectar.'
                            ], 200);
                        }
                    } catch (\Exception $recreateError) {
                        Log::warning('⚠️ [STATUS SYNC] No se pudo recrear instancia', [
                            'instance_id' => $whatsAppInstance->instance_id,
                            'error' => $recreateError->getMessage()
                        ]);
                    }
                }
                
                // Si el microservicio no responde exitosamente, marcar como desconectado
                Log::warning('Microservicio no respondió exitosamente para instancia', [
                    'instance_id' => $whatsAppInstance->instance_id,
                    'status_code' => $response->status(),
                    'marking_as_disconnected' => true
                ]);
                
                if ($whatsAppInstance->status !== 'disconnected') {
                    $whatsAppInstance->update([
                        'status' => 'disconnected',
                        'last_activity_at' => now(),
                    ]);
                }
                
                return response([
                    'success' => true,
                    'instanceId' => $whatsAppInstance->instance_id,
                    'status' => 'disconnected',
                    'connected' => false,
                    'connecting' => false
                ], 200);
            }
        } catch (\Exception $e) {
            Log::error('Error al obtener estado de instancia', [
                'instance_id' => $whatsAppInstance->instance_id,
                'error' => $e->getMessage(),
                'marking_as_disconnected' => true
            ]);
            
            // En caso de error de conexión, marcar como desconectado
            if ($whatsAppInstance->status !== 'disconnected') {
                $whatsAppInstance->update([
                    'status' => 'disconnected',
                    'last_activity_at' => now(),
                ]);
            }
            
            return response(['error' => 'Service unavailable', 'status' => 'disconnected'], 503);
        }
    }

    /**
     * Restart WhatsApp instance
     */
    public function restart(Request $request, WhatsAppInstance $whatsAppInstance): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }

        try {
            $response = Http::post($this->whatsappMicroserviceUrl . '/instances/' . $whatsAppInstance->instance_id . '/restart');
            
            if ($response->successful()) {
                $whatsAppInstance->update([
                    'status' => 'connecting',
                    'qr_code' => null,
                    'qr_expires_at' => null,
                ]);
                
                return response(['message' => 'Instance restarted successfully'], 200);
            }
            
            return response(['error' => 'Failed to restart instance'], 500);
        } catch (\Exception $e) {
            Log::error('Failed to restart instance', [
                'instance_id' => $whatsAppInstance->instance_id,
                'error' => $e->getMessage()
            ]);
            
            return response(['error' => 'Service unavailable'], 503);
        }
    }

    /**
     * Disconnect WhatsApp instance
     */
    public function disconnect(Request $request, WhatsAppInstance $whatsAppInstance): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }

        try {
            $response = Http::post($this->whatsappMicroserviceUrl . '/instances/' . $whatsAppInstance->instance_id . '/disconnect');
            
            if ($response->successful()) {
                $whatsAppInstance->setDisconnected();
                return response(['message' => 'Instance disconnected successfully'], 200);
            }
            
            return response(['error' => 'Failed to disconnect instance'], 500);
        } catch (\Exception $e) {
            Log::error('Failed to disconnect instance', [
                'instance_id' => $whatsAppInstance->instance_id,
                'error' => $e->getMessage()
            ]);
            
            return response(['error' => 'Service unavailable'], 503);
        }
    }

    /**
     * Actualizar estados de todas las instancias del broker de forma individual
     */
    public function refreshAllStatuses(Request $request): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        
        if (!$broker) {
            return response(['error' => 'No broker found for user'], 404);
        }

        $instances = WhatsAppInstance::where('broker_id', $broker->id)->get();
        $results = [];
        
        foreach ($instances as $instance) {
            try {
                Log::info('Actualizando estado individual para instancia', [
                    'instance_id' => $instance->instance_id,
                    'current_status' => $instance->status
                ]);
                
                $response = Http::timeout(5)->get($this->whatsappMicroserviceUrl . '/instances/' . $instance->instance_id . '/status');
                
                if ($response->successful()) {
                    $data = $response->json();
                    
                    // Verificar que la respuesta corresponde a esta instancia específica
                    if (isset($data['instanceId']) && $data['instanceId'] === $instance->instance_id) {
                        $oldStatus = $instance->status;
                        $newStatus = $data['status'] ?? 'disconnected';
                        
                        // Solo actualizar si el estado ha cambiado
                        if ($newStatus !== $oldStatus) {
                            Log::info('Estado cambió para instancia', [
                                'instance_id' => $instance->instance_id,
                                'old_status' => $oldStatus,
                                'new_status' => $newStatus
                            ]);
                            
                            $instance->update([
                                'status' => $newStatus,
                                'last_activity_at' => now(),
                                'phone_number' => $data['phoneNumber'] ?? $instance->phone_number,
                            ]);
                        }
                        
                        $results[] = [
                            'instance_id' => $instance->instance_id,
                            'status' => $newStatus,
                            'updated' => $newStatus !== $oldStatus,
                            'phone_number' => $data['phoneNumber'] ?? null
                        ];
                    } else {
                        // Respuesta no corresponde a esta instancia, marcar como desconectado
                        Log::warning('Respuesta no corresponde a instancia en refresh', [
                            'expected_instance_id' => $instance->instance_id,
                            'received_instance_id' => $data['instanceId'] ?? 'null'
                        ]);
                        
                        if ($instance->status !== 'disconnected') {
                            $instance->update([
                                'status' => 'disconnected',
                                'last_activity_at' => now(),
                            ]);
                        }
                        
                        $results[] = [
                            'instance_id' => $instance->instance_id,
                            'status' => 'disconnected',
                            'updated' => true,
                            'reason' => 'Instance ID mismatch'
                        ];
                    }
                } else {
                    // Error de conexión o respuesta no exitosa
                    Log::warning('No se pudo obtener estado para instancia en refresh', [
                        'instance_id' => $instance->instance_id,
                        'status_code' => $response->status()
                    ]);
                    
                    if ($instance->status !== 'disconnected') {
                        $instance->update([
                            'status' => 'disconnected',
                            'last_activity_at' => now(),
                        ]);
                    }
                    
                    $results[] = [
                        'instance_id' => $instance->instance_id,
                        'status' => 'disconnected',
                        'updated' => true,
                        'reason' => 'Service unavailable'
                    ];
                }
            } catch (\Exception $e) {
                // Error de conexión, marcar como desconectado
                Log::error('Error al actualizar estado en refresh', [
                    'instance_id' => $instance->instance_id,
                    'error' => $e->getMessage()
                ]);
                
                if ($instance->status !== 'disconnected') {
                    $instance->update([
                        'status' => 'disconnected',
                        'last_activity_at' => now(),
                    ]);
                }
                
                $results[] = [
                    'instance_id' => $instance->instance_id,
                    'status' => 'disconnected',
                    'updated' => true,
                    'reason' => 'Connection error: ' . $e->getMessage()
                ];
            }
        }
        
        Log::info('Refresh de estados completado', [
            'broker_id' => $broker->id,
            'total_instances' => count($instances),
            'results' => $results
        ]);
        
        return response([
            'message' => 'Estados actualizados',
            'total_instances' => count($instances),
            'results' => $results
        ], 200);
    }

    /**
     * Enviar mensaje usando Cloud API
     */
    public function sendCloudApiMessage(Request $request, WhatsAppInstance $whatsAppInstance): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }

        if (!$whatsAppInstance->isCloudApi()) {
            return response(['error' => 'Esta instancia no está configurada para Cloud API'], 400);
        }

        $validated = $request->validate([
            'to' => 'required|string',
            'message' => 'required_without:template|string|nullable',
            'template' => 'required_without:message|string|nullable',
            'template_language' => 'nullable|string',
            'template_components' => 'nullable|array',
        ]);

        $cloudApiService = new WhatsAppCloudApiService();

        if (!empty($validated['template'])) {
            // Enviar mensaje con plantilla
            $result = $cloudApiService->sendTemplateMessage(
                $whatsAppInstance,
                $validated['to'],
                $validated['template'],
                $validated['template_language'] ?? 'es',
                $validated['template_components'] ?? []
            );
        } else {
            // Enviar mensaje de texto
            $result = $cloudApiService->sendTextMessage(
                $whatsAppInstance,
                $validated['to'],
                $validated['message']
            );
        }

        if ($result['success']) {
            return response([
                'success' => true,
                'message' => 'Mensaje enviado correctamente',
                'message_id' => $result['message_id'] ?? null
            ], 200);
        }

        return response([
            'success' => false,
            'error' => $result['error'] ?? 'Error al enviar mensaje',
            'error_details' => $result['error_details'] ?? null
        ], 400);
    }

    /**
     * Probar conexión Cloud API
     */
    public function testCloudApiConnection(Request $request, WhatsAppInstance $whatsAppInstance): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }

        if (!$whatsAppInstance->isCloudApi()) {
            return response(['error' => 'Esta instancia no está configurada para Cloud API'], 400);
        }

        $cloudApiService = new WhatsAppCloudApiService();
        $result = $cloudApiService->getBusinessProfile($whatsAppInstance);

        if ($result['success']) {
            $whatsAppInstance->update([
                'status' => 'connected',
                'last_connected_at' => now(),
                'last_activity_at' => now(),
                'error_message' => null
            ]);

            return response([
                'success' => true,
                'message' => 'Conexión exitosa con Cloud API',
                'business_profile' => $result['data']
            ], 200);
        }

        $whatsAppInstance->update([
            'status' => 'error',
            'error_message' => $result['error'] ?? 'Error de conexión'
        ]);

        return response([
            'success' => false,
            'error' => $result['error'] ?? 'Error al conectar con Cloud API'
        ], 400);
    }

    /**
     * Obtener estado de instancia YCloud verificando con YCloud API
     */
    protected function getYCloudStatus(WhatsAppInstance $whatsAppInstance): Response
    {
        try {
            $apiKey = $whatsAppInstance->settings['ycloud_api_key'] ?? env('YCLOUD_API_KEY');
            if (!$apiKey) {
                return response([
                    'success' => false,
                    'instanceId' => $whatsAppInstance->instance_id,
                    'status' => 'error',
                    'connected' => false,
                    'connecting' => false,
                    'connection_type' => 'ycloud',
                    'error' => 'YCLOUD_API_KEY no configurada'
                ], 200);
            }

            $response = Http::withHeaders([
                'X-API-Key' => $apiKey,
            ])->timeout(10)->get('https://api.ycloud.com/v2/whatsapp/phoneNumbers');

            if ($response->successful()) {
                $phoneNumbers = $response->json('items', []);

                // Find our phone number
                $matchedPhone = null;
                $normalizedInstance = preg_replace('/[^0-9]/', '', $whatsAppInstance->phone_number ?? '');
                foreach ($phoneNumbers as $pn) {
                    $normalizedPn = preg_replace('/[^0-9]/', '', $pn['phoneNumber'] ?? '');
                    if ($normalizedPn === $normalizedInstance || str_ends_with($normalizedPn, $normalizedInstance) || str_ends_with($normalizedInstance, $normalizedPn)) {
                        $matchedPhone = $pn;
                        break;
                    }
                }

                if (!$matchedPhone && !empty($phoneNumbers)) {
                    $matchedPhone = $phoneNumbers[0];
                }

                $isConnected = !empty($matchedPhone);
                $newStatus = $isConnected ? 'connected' : 'disconnected';

                $whatsAppInstance->update([
                    'status' => $newStatus,
                    'last_activity_at' => now(),
                    'error_message' => null,
                ]);

                Log::info('✅ [YCLOUD STATUS] Estado verificado', [
                    'instance_id' => $whatsAppInstance->instance_id,
                    'status' => $newStatus,
                    'phone' => $matchedPhone['phoneNumber'] ?? 'N/A',
                    'phone_count' => count($phoneNumbers),
                ]);

                return response([
                    'success' => true,
                    'instanceId' => $whatsAppInstance->instance_id,
                    'status' => $newStatus,
                    'connected' => $isConnected,
                    'connecting' => false,
                    'connection_type' => 'ycloud',
                    'phoneNumber' => $matchedPhone['phoneNumber'] ?? $whatsAppInstance->phone_number,
                    'verifiedName' => $matchedPhone['displayName'] ?? null,
                    'qualityRating' => $matchedPhone['qualityRating'] ?? null,
                ], 200);
            }

            $error = $response->json('message', 'Error conectando con YCloud');
            Log::warning('⚠️ [YCLOUD STATUS] Error verificando', [
                'instance_id' => $whatsAppInstance->instance_id,
                'status' => $response->status(),
                'error' => $error,
            ]);

            $whatsAppInstance->update([
                'status' => 'error',
                'error_message' => $error,
                'last_activity_at' => now(),
            ]);

            return response([
                'success' => false,
                'instanceId' => $whatsAppInstance->instance_id,
                'status' => 'error',
                'connected' => false,
                'connecting' => false,
                'connection_type' => 'ycloud',
                'error' => $error,
            ], 200);

        } catch (\Exception $e) {
            Log::error('❌ [YCLOUD STATUS] Exception', [
                'instance_id' => $whatsAppInstance->instance_id,
                'error' => $e->getMessage(),
            ]);

            return response([
                'success' => false,
                'instanceId' => $whatsAppInstance->instance_id,
                'status' => 'error',
                'connected' => false,
                'connecting' => false,
                'connection_type' => 'ycloud',
                'error' => $e->getMessage(),
            ], 200);
        }
    }

    /**
     * Obtener estado de instancia Cloud API verificando con Meta
     */
    protected function getCloudApiStatus(WhatsAppInstance $whatsAppInstance): Response
    {
        try {
            // Verificar credenciales con la API de Meta
            $response = Http::withToken($whatsAppInstance->cloud_api_token)
                ->timeout(10)
                ->get("https://graph.facebook.com/v22.0/{$whatsAppInstance->cloud_api_phone_id}", [
                    'fields' => 'id,display_phone_number,verified_name,quality_rating,status,is_pin_enabled'
                ]);

            if ($response->successful()) {
                $data = $response->json();
                
                // Determinar estado basado en la respuesta de Meta
                $metaStatus = $data['status'] ?? 'UNKNOWN';
                $isConnected = in_array($metaStatus, ['CONNECTED', 'READY', 'UNKNOWN']); // UNKNOWN suele significar OK
                
                $newStatus = $isConnected ? 'connected' : 'disconnected';
                
                // Actualizar instancia
                $whatsAppInstance->update([
                    'status' => $newStatus,
                    'phone_number' => $data['display_phone_number'] ?? $whatsAppInstance->phone_number,
                    'last_activity_at' => now(),
                    'error_message' => null
                ]);

                Log::info('✅ [CLOUD API STATUS] Estado verificado con Meta', [
                    'instance_id' => $whatsAppInstance->instance_id,
                    'meta_status' => $metaStatus,
                    'new_status' => $newStatus,
                    'phone' => $data['display_phone_number'] ?? 'N/A'
                ]);

                return response([
                    'success' => true,
                    'instanceId' => $whatsAppInstance->instance_id,
                    'status' => $newStatus,
                    'connected' => $isConnected,
                    'connecting' => false,
                    'connection_type' => 'cloud_api',
                    'phoneNumber' => $data['display_phone_number'] ?? null,
                    'verifiedName' => $data['verified_name'] ?? null,
                    'qualityRating' => $data['quality_rating'] ?? null,
                    'metaStatus' => $metaStatus
                ], 200);
            }

            // Error de credenciales o conexión
            $error = $response->json()['error'] ?? ['message' => 'Error desconocido'];
            
            Log::warning('⚠️ [CLOUD API STATUS] Error verificando con Meta', [
                'instance_id' => $whatsAppInstance->instance_id,
                'error' => $error
            ]);

            $whatsAppInstance->update([
                'status' => 'error',
                'error_message' => $error['message'] ?? 'Error de conexión con Meta',
                'last_activity_at' => now()
            ]);

            return response([
                'success' => false,
                'instanceId' => $whatsAppInstance->instance_id,
                'status' => 'error',
                'connected' => false,
                'connecting' => false,
                'connection_type' => 'cloud_api',
                'error' => $error['message'] ?? 'Error de conexión'
            ], 200);

        } catch (\Exception $e) {
            Log::error('❌ [CLOUD API STATUS] Exception verificando estado', [
                'instance_id' => $whatsAppInstance->instance_id,
                'error' => $e->getMessage()
            ]);

            return response([
                'success' => false,
                'instanceId' => $whatsAppInstance->instance_id,
                'status' => 'error',
                'connected' => false,
                'connecting' => false,
                'connection_type' => 'cloud_api',
                'error' => $e->getMessage()
            ], 200);
        }
    }

    // ─────────────────────────────────────────────────────────
    //  YCLOUD CONTACTS
    // ─────────────────────────────────────────────────────────

    /**
     * List YCloud contacts (paginated).
     * GET /whatsapp-instances/{id}/ycloud-contacts
     */
    public function ycloudContacts(Request $request, WhatsAppInstance $whatsAppInstance): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }
        if (!$whatsAppInstance->isYCloud()) {
            return response(['error' => 'Esta instancia no es de tipo YCloud'], 400);
        }

        $service = app(\App\Services\YCloudWhatsAppService::class);
        $result = $service->getContacts(
            $whatsAppInstance,
            (int) $request->input('limit', 100),
            (int) $request->input('offset', 0),
            $request->input('filter')
        );

        return response($result, $result['success'] ? 200 : 400);
    }

    /**
     * Get a single YCloud contact.
     * GET /whatsapp-instances/{id}/ycloud-contacts/{contactId}
     */
    public function ycloudContactShow(Request $request, WhatsAppInstance $whatsAppInstance, string $contactId): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }
        if (!$whatsAppInstance->isYCloud()) {
            return response(['error' => 'Esta instancia no es de tipo YCloud'], 400);
        }

        $service = app(\App\Services\YCloudWhatsAppService::class);
        $result = $service->getContact($whatsAppInstance, $contactId);

        return response($result, $result['success'] ? 200 : 404);
    }

    /**
     * Update a YCloud contact.
     * PATCH /whatsapp-instances/{id}/ycloud-contacts/{contactId}
     */
    public function ycloudContactUpdate(Request $request, WhatsAppInstance $whatsAppInstance, string $contactId): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }
        if (!$whatsAppInstance->isYCloud()) {
            return response(['error' => 'Esta instancia no es de tipo YCloud'], 400);
        }

        $service = app(\App\Services\YCloudWhatsAppService::class);
        $result = $service->updateContact($whatsAppInstance, $contactId, $request->all());

        return response($result, $result['success'] ? 200 : 400);
    }

    /**
     * Delete a YCloud contact.
     * DELETE /whatsapp-instances/{id}/ycloud-contacts/{contactId}
     */
    public function ycloudContactDelete(Request $request, WhatsAppInstance $whatsAppInstance, string $contactId): Response
    {
        [$user, $broker] = $this->resolveUserAndBroker($request);
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }
        if (!$whatsAppInstance->isYCloud()) {
            return response(['error' => 'Esta instancia no es de tipo YCloud'], 400);
        }

        $service = app(\App\Services\YCloudWhatsAppService::class);
        $result = $service->deleteContact($whatsAppInstance, $contactId);

        return response($result, $result['success'] ? 200 : 400);
    }
}
