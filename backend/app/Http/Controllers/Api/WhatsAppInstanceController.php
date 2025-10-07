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

class WhatsAppInstanceController extends Controller
{
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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();
        
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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();
        
        if (!$broker) {
            return response(['error' => 'No broker found for user'], 404);
        }

        $validated = $request->validate([
            'phone_number' => 'nullable|string',
            'webhook_url' => 'nullable|url',
            'settings' => 'nullable|array',
        ]);

        // Generar instance_id único
        $instanceId = 'instance_' . $broker->id . '_' . Str::random(8);
        
        // Crear instancia en la base de datos
        $instance = WhatsAppInstance::create([
            'broker_id' => $broker->id,
            'instance_id' => $instanceId,
            'phone_number' => $validated['phone_number'] ?? null,
            'webhook_url' => $validated['webhook_url'] ?? null,
            'settings' => $validated['settings'] ?? [],
            'status' => 'disconnected',
        ]);

        // Inicializar instancia en el microservicio - SINCRONIZACIÓN AUTOMÁTICA
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

        return response($instance->load('broker'), 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, WhatsAppInstance $whatsAppInstance): Response
    {
        $user = $request->user();
        $broker = $user->getPrimaryBroker();
        
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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();
        
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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();
        
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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();
        
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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();
        
        if (!$broker || $whatsAppInstance->broker_id !== $broker->id) {
            return response(['error' => 'Unauthorized'], 403);
        }

        try {
            $response = Http::timeout(10)->get($this->whatsappMicroserviceUrl . '/instances/' . $whatsAppInstance->instance_id . '/status');
            
            if ($response->successful()) {
                $data = $response->json();
                
                // Verificar que la respuesta corresponde a esta instancia específica
                if (isset($data['instanceId']) && $data['instanceId'] === $whatsAppInstance->instance_id) {
                    // Solo actualizar si el estado ha cambiado
                    if (isset($data['status']) && $data['status'] !== $whatsAppInstance->status) {
                        Log::info('Actualizando estado de instancia', [
                            'instance_id' => $whatsAppInstance->instance_id,
                            'old_status' => $whatsAppInstance->status,
                            'new_status' => $data['status']
                        ]);
                        
                        $whatsAppInstance->update([
                            'status' => $data['status'],
                            'last_activity_at' => now(),
                            'phone_number' => $data['phoneNumber'] ?? $whatsAppInstance->phone_number,
                        ]);
                    }
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
                
                return response(['error' => 'Failed to get status', 'status' => 'disconnected'], 500);
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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();
        
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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();
        
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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();
        
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
}
