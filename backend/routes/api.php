<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SaaS\PdfLearningController;
use App\Http\Controllers\Api\BrokerController;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\PolizaController;
use App\Http\Controllers\SaaS\OnboardingController;
use App\Http\Controllers\SaaS\SaasClientesController;
use App\Http\Controllers\SaaS\SaasPolizasController;
use App\Http\Controllers\SaaS\PolizaDocumentsController;
use App\Http\Controllers\SaaS\AutomovilesController;
use App\Http\Controllers\SaaS\MasterAccountController;
use App\Http\Controllers\Api\BillingController;
// use App\Http\Controllers\SaaS\NotificationController; // TODO: Controlador no existe
use App\Http\Controllers\SaaS\AuditController;
use App\Http\Controllers\SaaS\EmpleadosController;
use App\Http\Controllers\SaaS\SaasCommercialTasksController;
use App\Http\Controllers\SaaS\SaasSalesFunnelController;
use App\Http\Controllers\SaaS\SaasSalesTeamsController;
use App\Http\Controllers\SaaS\SaasSalesGoalsController;
use App\Http\Controllers\SaaS\SaasSiniestroController;
use App\Http\Controllers\SaaS\SaasComisionesController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\Api\WhatsAppInstanceController;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\CallToolsController;
use App\Http\Controllers\SaaS\SaasSalesPerformanceController;

// Enforce numeric-only route parameters to prevent static path collisions (e.g., "available-whatsapp-instances")
Route::pattern('id', '[0-9]+');
Route::pattern('campaign', '[0-9]+');

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// Ruta de salud pública (sin información sensible)
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toISOString(),
    ]);
});

/**
 * CORS preflight handler solo para entornos no productivos.
 * Nota: En producción, el middleware de CORS (fruitcake/laravel-cors) ya maneja OPTIONS.
 * Un catch-all de OPTIONS en producción puede provocar 405 para GET.
 */
if (app()->environment(['local','development','testing'])) {
    Route::options('/{any}', function (Request $request) {
        $origin = $request->headers->get('Origin') ?: '*';
        $reqHeaders = $request->header('Access-Control-Request-Headers') ?: '*';

        return response('', 204)
            ->header('Access-Control-Allow-Origin', $origin)
            ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->header('Access-Control-Allow-Headers', $reqHeaders)
            ->header('Access-Control-Allow-Credentials', 'true');
    })->where('any', '.*');
}


// =============================================================
// RUTA PÚBLICA DEV: Confirmación Wompi sin auth (solo local)
// =============================================================
if (env('APP_ENV') !== 'production') {
    Route::post('/wompi/confirm-dev', [WalletController::class, 'wompiConfirm']);
}



// =============================================================
// Webhook WhatsApp bulk-send (PÚBLICO - llamado por microservicio)
// =============================================================
Route::post('/saas/whatsapp/webhook/bulk-send-complete', [\App\Http\Controllers\Api\WhatsAppWebhookController::class, 'bulkSendComplete']);

// =============================================================
// Webhook WhatsApp status change (PÚBLICO - llamado por microservicio)
// Permite sincronización automática de estado cuando QR se escanea
// =============================================================
Route::post('/webhooks/whatsapp-status', [\App\Http\Controllers\Api\WhatsAppWebhookController::class, 'statusChange']);

// =============================================================
// Webhook WhatsApp sync instances (PÚBLICO - llamado por microservicio al iniciar)
// Permite al microservicio obtener lista de instancias para restaurar
// =============================================================
Route::get('/webhooks/whatsapp-sync', [\App\Http\Controllers\Api\WhatsAppWebhookController::class, 'syncInstances']);

// =============================================================
// Webhook WhatsApp microservice startup (PÚBLICO - llamado por microservicio al iniciar)
// Notifica al backend que el microservicio ha reiniciado para re-registrar instancias
// =============================================================
Route::post('/webhooks/whatsapp-startup', [\App\Http\Controllers\Api\WhatsAppWebhookController::class, 'microserviceStartup']);

// =============================================================
// Webhook WhatsApp incoming message (PÚBLICO - llamado por microservicio)
// Procesa mensajes entrantes con el ChatbotProcessor
// =============================================================
Route::post('/webhooks/whatsapp-message', [\App\Http\Controllers\Api\WhatsAppWebhookController::class, 'incomingMessage'])
    ->name('api.whatsapp.webhook');

// =============================================================
// Webhook WhatsApp sync message (PÚBLICO - llamado por microservicio)
// Sincroniza mensajes enviados desde el móvil al Inbox
// =============================================================
Route::post('/webhooks/whatsapp-sync-message', [\App\Http\Controllers\Api\WhatsAppWebhookController::class, 'syncMessage']);

// =============================================================
// Webhook Meta Cloud API (PÚBLICO - llamado por Meta/Facebook)
// Para recibir mensajes de WhatsApp Business Cloud API
// =============================================================
Route::get('/webhooks/meta-whatsapp', [\App\Http\Controllers\Api\WhatsAppWebhookController::class, 'metaWebhookVerify']);
Route::post('/webhooks/meta-whatsapp', [\App\Http\Controllers\Api\WhatsAppWebhookController::class, 'metaWebhookReceive']);

// Rutas públicas de autenticación (sin middleware)
Route::prefix('auth')->group(function () {
    // Estas rutas no necesitan autenticación
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::post('/two-steps/send', [AuthController::class, 'sendTwoStepCode']);
    Route::post('/two-steps/verify', [AuthController::class, 'verifyTwoStepCode']);
    Route::post('/email/send-verification', [AuthController::class, 'sendEmailVerification']);
    Route::post('/email/verify', [AuthController::class, 'verifyEmail']);
    
    // Ruta para autenticación Google OAuth móvil (Opción A - OAuth puro)
    Route::post('/google-mobile', [\App\Http\Controllers\Api\AuthController::class, 'googleMobile']);
    
    // Ruta para sincronización Firebase + Backend (requiere ID Token)
    Route::post('/sync-firebase-user', [\App\Http\Controllers\Api\AuthController::class, 'syncFirebaseUser'])
        ->middleware('firebase.auth');

    // Ruta para verificar estado de email (requiere autenticación)
    Route::post('/check-email-verification', [\App\Http\Controllers\Api\AuthController::class, 'checkEmailVerification'])
        ->middleware('firebase.auth');

});

// =============================================================
// Pricing / Suscripciones - requiere Firebase Auth
// =============================================================
Route::middleware(['firebase.auth'])->prefix('pricing')->group(function () {
    Route::post('/subscription-intents', [\App\Http\Controllers\Api\SubscriptionIntentController::class, 'store']);
});

// =============================================================
// Billing - estado de suscripción
// =============================================================
Route::middleware(['firebase.auth'])->prefix('billing')->group(function () {
    Route::get('/status', [\App\Http\Controllers\Api\BillingController::class, 'status']);
    Route::post('/checkout-link', [\App\Http\Controllers\Api\BillingController::class, 'createCheckoutLink']);
    Route::post('/wompi/confirm', [\App\Http\Controllers\Api\BillingController::class, 'confirmWompi']);
});

// =============================================================
// Webhook ElevenLabs público (fuera de cualquier middleware)
// =============================================================
Route::post('/saas/voice-campaigns/webhooks/elevenlabs', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'receiveElevenLabsWebhook']);

// =============================================================
// Webhook VAPI público (fuera de cualquier middleware)
// =============================================================
Route::post('/saas/voice-campaigns/webhooks/vapi', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'receiveVapiWebhook']);

// =============================================================
// Custom Tools de ElevenLabs (públicos - llamados durante la llamada)
// =============================================================
Route::post('/saas/voice-campaigns/tools/collect-data/{conversationId}', [\App\Http\Controllers\Api\VoiceToolsController::class, 'collectData']);
Route::post('/saas/voice-campaigns/tools/collect-data', [\App\Http\Controllers\Api\VoiceToolsController::class, 'collectData']); // Sin conversation_id en URL
Route::post('/saas/voice-campaigns/tools/schedule-payment/{conversationId}', [\App\Http\Controllers\Api\VoiceToolsController::class, 'schedulePaymentLink']);
Route::post('/saas/voice-campaigns/tools/handle/{conversationId}', [\App\Http\Controllers\Api\VoiceToolsController::class, 'handleToolCall']);

// =============================================================
// Chatbot Query Tools (públicos - llamados durante la llamada)
// =============================================================
Route::post('/saas/voice-campaigns/tools/query-system/{conversationId}', [\App\Http\Controllers\Api\VoiceToolsController::class, 'querySystem']);
Route::post('/saas/voice-campaigns/tools/query-policies/{conversationId}', [\App\Http\Controllers\Api\VoiceToolsController::class, 'queryPolicies']);
Route::post('/saas/voice-campaigns/tools/query-clients/{conversationId}', [\App\Http\Controllers\Api\VoiceToolsController::class, 'queryClients']);

// =============================================================
// Proxy seguro para ElevenLabs TTS (sin exponer API key en frontend)
// =============================================================
Route::post('/saas/elevenlabs/tts/{voiceId}', [\App\Http\Controllers\Api\ElevenLabsProxyController::class, 'tts']);

// =============================================================================
// Rutas SaaS protegidas con autenticación unificada
// (Anteriormente públicas - ahora requieren Firebase token)
// =============================================================================
Route::middleware(['unified.auth', 'global.broker.auth'])->prefix('saas')->group(function () {
    // Mensajeros
    Route::prefix('mensajeros')->group(function () {
        Route::get('/vehiculos', [App\Http\Controllers\SaaS\MensajerosController::class, 'vehiculos']);
        Route::get('/', [App\Http\Controllers\SaaS\MensajerosController::class, 'index']);
        Route::post('/', [App\Http\Controllers\SaaS\MensajerosController::class, 'store']);
        Route::get('/{id}', [App\Http\Controllers\SaaS\MensajerosController::class, 'show'])->whereNumber('id');
        Route::put('/{id}', [App\Http\Controllers\SaaS\MensajerosController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [App\Http\Controllers\SaaS\MensajerosController::class, 'destroy'])->whereNumber('id');
    });

    // Cartera de Clientes
    Route::prefix('cartera-clientes')->group(function () {
        Route::get('/', [App\Http\Controllers\SaaS\CarteraClientesController::class, 'index']);
        Route::post('/', [App\Http\Controllers\SaaS\CarteraClientesController::class, 'store']);
        Route::get('/{id}', [App\Http\Controllers\SaaS\CarteraClientesController::class, 'show'])->whereNumber('id');
        Route::put('/{id}', [App\Http\Controllers\SaaS\CarteraClientesController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [App\Http\Controllers\SaaS\CarteraClientesController::class, 'destroy'])->whereNumber('id');
    });

    // Enlaces de Cotización
    Route::prefix('enlaces-cotizacion')->group(function () {
        Route::get('/', [App\Http\Controllers\SaaS\EnlacesCotizacionController::class, 'index']);
        Route::post('/', [App\Http\Controllers\SaaS\EnlacesCotizacionController::class, 'store']);
        Route::put('/{id}', [App\Http\Controllers\SaaS\EnlacesCotizacionController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [App\Http\Controllers\SaaS\EnlacesCotizacionController::class, 'destroy'])->whereNumber('id');
        Route::post('/{id}/toggle', [App\Http\Controllers\SaaS\EnlacesCotizacionController::class, 'toggle'])->whereNumber('id');
    });

    // Contratos de Intermediación
    Route::prefix('contratos')->group(function () {
        Route::get('/', [App\Http\Controllers\SaaS\ContratosIntermediacionController::class, 'index']);
        Route::post('/', [App\Http\Controllers\SaaS\ContratosIntermediacionController::class, 'store']);
        Route::put('/{id}', [App\Http\Controllers\SaaS\ContratosIntermediacionController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [App\Http\Controllers\SaaS\ContratosIntermediacionController::class, 'destroy'])->whereNumber('id');
    });

    // Estados de Cuenta
    Route::prefix('cartera/estados-cuenta')->group(function () {
        Route::get('/metrics', [App\Http\Controllers\SaaS\SaasEstadosCuentaController::class, 'metrics']);
        Route::get('/agents', [App\Http\Controllers\SaaS\SaasEstadosCuentaController::class, 'agents']);
        Route::get('/advisor/{userId}/summary', [App\Http\Controllers\SaaS\SaasEstadosCuentaController::class, 'advisorSummary'])->whereNumber('userId');
        Route::get('/advisor/{userId}/movements', [App\Http\Controllers\SaaS\SaasEstadosCuentaController::class, 'advisorMovements'])->whereNumber('userId');
    });

    // Reportes Financieros
    Route::prefix('cartera/reportes-financieros')->group(function () {
        Route::get('/monthly', [App\Http\Controllers\SaaS\SaasReportesFinancierosController::class, 'monthly']);
        Route::get('/by-advisor', [App\Http\Controllers\SaaS\SaasReportesFinancierosController::class, 'byAdvisor']);
        Route::get('/by-insurer', [App\Http\Controllers\SaaS\SaasReportesFinancierosController::class, 'byInsurer']);
    });

    // Anticipos y Ajustes
    Route::prefix('cartera/anticipos-ajustes')->group(function () {
        Route::get('/', [App\Http\Controllers\SaaS\AnticiposAjustesController::class, 'index']);
        Route::post('/', [App\Http\Controllers\SaaS\AnticiposAjustesController::class, 'store']);
        Route::get('/estadisticas', [App\Http\Controllers\SaaS\AnticiposAjustesController::class, 'estadisticas']);
        Route::post('/{id}/aprobar', [App\Http\Controllers\SaaS\AnticiposAjustesController::class, 'aprobar'])->whereNumber('id');
        Route::post('/{id}/rechazar', [App\Http\Controllers\SaaS\AnticiposAjustesController::class, 'rechazar'])->whereNumber('id');
        Route::delete('/{id}', [App\Http\Controllers\SaaS\AnticiposAjustesController::class, 'destroy'])->whereNumber('id');
    });
});

// Rutas de debug protegidas por bandera de entorno (solo si ENABLE_DEBUG_ROUTES=true)
if (env('ENABLE_DEBUG_ROUTES', false)) {
// Ruta temporal de debug: últimas llamadas de voz (id, conversation_id, status)
Route::get('/test/voice-calls-latest', function() {
    try {
        $rows = \App\Models\VoiceCampaignCall::orderBy('id', 'desc')
            ->limit(10)
            ->get(['id', 'voice_campaign_id', 'elevenlabs_conversation_id', 'status', 'duration_seconds', 'elevenlabs_cost_usd', 'twilio_minutes', 'total_cost_usd']);
        return response()->json(['success' => true, 'data' => $rows]);
    } catch (\Throwable $e) {
        return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
    }
});

// Ruta temporal de debug: comparar duración/costos con ElevenLabs para una conversación
Route::get('/test/voice-call-verify/{conversationId}', function(string $conversationId) {
    try {
        $row = \App\Models\VoiceCampaignCall::where('elevenlabs_conversation_id', $conversationId)
            ->first(['id','voice_campaign_id','elevenlabs_conversation_id','status','duration_seconds','elevenlabs_cost_usd','twilio_minutes','total_cost_usd']);
        $client = new \App\Services\ElevenLabsClient();
        $remote = $client->getConversationDetails($conversationId);
        $remoteDuration = (int) (\Illuminate\Support\Arr::get($remote, 'metadata.call_duration_secs') ?? 0);
        $remoteCostUsd = (float) (\Illuminate\Support\Arr::get($remote, 'metadata.cost_usd') ?? 0);
        $remoteCredits = (float) (\Illuminate\Support\Arr::get($remote, 'metadata.cost') ?? 0);
        return response()->json([
            'success' => true,
            'db' => $row,
            'remote_metadata' => [
                'duration_secs' => $remoteDuration,
                'cost_usd' => $remoteCostUsd,
                'credits' => $remoteCredits,
            ],
            'raw_remote' => $remote,
        ]);
    } catch (\Throwable $e) {
        return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
    }
});

// Ruta temporal de reparación: sincroniza duración/costos desde ElevenLabs a BD
Route::post('/test/voice-call-fix/{conversationId}', function(string $conversationId) {
    try {
        /** @var \App\Models\VoiceCampaignCall|null $call */
        $call = \App\Models\VoiceCampaignCall::where('elevenlabs_conversation_id', $conversationId)->first();
        if (!$call) {
            return response()->json(['success' => false, 'message' => 'Llamada no encontrada'], 404);
        }

        $client = new \App\Services\ElevenLabsClient();
        $remote = $client->getConversationDetails($conversationId);
        if (!$remote) {
            return response()->json(['success' => false, 'message' => 'No se pudo obtener datos remotos'], 502);
        }

        $durationSeconds = (int) (\Illuminate\Support\Arr::get($remote, 'metadata.call_duration_secs') ?? 0);
        $costUsd = \Illuminate\Support\Arr::get($remote, 'metadata.cost_usd');
        $credits = \Illuminate\Support\Arr::get($remote, 'metadata.cost');

        // Conversión oficial: $0.30 por 1000 créditos => 0.0003 USD/crédito
        $CREDITS_TO_USD_RATE = 0.0003;
        $elevenUsd = 0.0;
        if (is_numeric($costUsd)) {
            $elevenUsd = (float) $costUsd;
        } elseif (is_numeric($credits)) {
            $elevenUsd = (float) $credits * $CREDITS_TO_USD_RATE;
        }

        $twilioMinutes = (int) ceil(max(0, $durationSeconds) / 60);
        $TWILIO_RATE_PER_MINUTE = 0.0338; // Tarifa Colombia móvil por minuto anticipado
        $twilioUsd = $twilioMinutes * $TWILIO_RATE_PER_MINUTE;
        $totalUsd = $elevenUsd + $twilioUsd;

        $broker = $call->broker; $markupPercent = 40;
        if ($broker && is_array($broker->settings) && isset($broker->settings['voice_calls_markup_percent'])) {
            $markupPercent = (int) $broker->settings['voice_calls_markup_percent'];
        }
        $totalWithMarkup = $totalUsd * (1 + ($markupPercent / 100));

        $before = $call->only(['duration_seconds','elevenlabs_cost_usd','twilio_minutes','twilio_cost_usd','total_cost_usd','total_cost_with_markup_usd']);
        $call->update([
            'duration_seconds' => $durationSeconds,
            'elevenlabs_cost_usd' => round($elevenUsd, 6),
            'twilio_minutes' => $twilioMinutes,
            'twilio_cost_usd' => round($twilioUsd, 6),
            'total_cost_usd' => round($totalUsd, 6),
            'total_cost_with_markup_usd' => round($totalWithMarkup, 6)
        ]);
        $after = $call->only(['duration_seconds','elevenlabs_cost_usd','twilio_minutes','twilio_cost_usd','total_cost_usd','total_cost_with_markup_usd']);

        return response()->json(['success' => true, 'conversation_id' => $conversationId, 'before' => $before, 'after' => $after]);
    } catch (\Throwable $e) {
        return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
    }
});
}

// Rutas de autenticación para empleados
Route::prefix('empleado-auth')->group(function () {
    // Rutas públicas (necesarias para login)
    Route::post('/login', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'login']);
    Route::post('/verificar', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'verificarEmpleado']);
    Route::post('/validar-token', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'validarToken']);
    
    // Rutas protegidas (requieren Firebase token)
    Route::middleware(['firebase.auth'])->group(function () {
        Route::post('/logout', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'logout']);
        Route::post('/cambiar-password', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'cambiarPassword']);
        Route::get('/perfil', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'perfil']);
        Route::post('/generar-password-temporal', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'generarPasswordTemporal']);
        Route::get('/contexto', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'contexto']);
        Route::get('/version', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'version']);
    });
});

// Rutas temporales de catálogos solo en modo DEBUG y con autenticación unificada
if (env('ENABLE_DEBUG_ROUTES', false)) {
    Route::middleware(['unified.auth', 'global.broker.auth', 'saas.auth'])->prefix('saas/temp-catalogos')->group(function () {
        Route::get('/aseguradoras', function(Request $request) {
            try {
                $brokerId = $request->get('authenticated_broker_id');
                if (!$brokerId && app()->environment('local', 'development')) {
                    $brokerId = (int) ($request->header('X-Dev-Broker-Id') ?: 0);
                }
                if (!$brokerId) {
                    return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 400);
                }
                $aseguradoras = \App\Models\Aseguradora::where('broker_id', $brokerId)
                    ->select(['id', 'nombre', 'cuit', 'email', 'telefono'])
                    ->orderBy('nombre')
                    ->get();
                return response()->json(['success' => true, 'message' => 'Aseguradoras obtenidas exitosamente', 'data' => $aseguradoras]);
            } catch (\Exception $e) {
                return response()->json(['success' => false, 'message' => 'Error al obtener aseguradoras: ' . $e->getMessage(), 'data' => []], 500);
            }
        });

        Route::get('/ramos', function(Request $request) {
            try {
                $brokerId = $request->get('authenticated_broker_id') ?: (app()->environment('local', 'development') ? (int) ($request->header('X-Dev-Broker-Id') ?: 0) : 0);
                if (!$brokerId) {
                    return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 400);
                }
                $ramos = \App\Models\Ramo::where('broker_id', $brokerId)
                    ->select(['id', 'nombre', 'subramo'])
                    ->orderBy('nombre')
                    ->get();
                return response()->json(['success' => true, 'message' => 'Ramos obtenidos exitosamente', 'data' => $ramos]);
            } catch (\Exception $e) {
                return response()->json(['success' => false, 'message' => 'Error al obtener ramos: ' . $e->getMessage(), 'data' => []], 500);
            }
        });

        Route::get('/vendedores', function(Request $request) {
            try {
                $brokerId = $request->get('authenticated_broker_id') ?: (app()->environment('local', 'development') ? (int) ($request->header('X-Dev-Broker-Id') ?: 0) : 0);
                if (!$brokerId) {
                    return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 400);
                }
                $vendedores = \App\Models\Vendedor::where('broker_id', $brokerId)
                    ->select(['id', 'nombres', 'numero_documento', 'email', 'telefono'])
                    ->orderBy('nombres')
                    ->get();
                return response()->json(['success' => true, 'message' => 'Vendedores obtenidos exitosamente', 'data' => $vendedores]);
            } catch (\Exception $e) {
                return response()->json(['success' => false, 'message' => 'Error al obtener vendedores: ' . $e->getMessage(), 'data' => []], 500);
            }
        });

        Route::get('/sedes', function(Request $request) {
            try {
                $brokerId = $request->get('authenticated_broker_id') ?: (app()->environment('local', 'development') ? (int) ($request->header('X-Dev-Broker-Id') ?: 0) : 0);
                if (!$brokerId) {
                    return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 400);
                }
                $sedes = \App\Models\Sede::where('broker_id', $brokerId)
                    ->select(['id', 'nombre', 'direccion', 'telefono', 'email'])
                    ->orderBy('nombre')
                    ->get();
                return response()->json(['success' => true, 'message' => 'Sedes obtenidas exitosamente', 'data' => $sedes]);
            } catch (\Exception $e) {
                return response()->json(['success' => false, 'message' => 'Error al obtener sedes: ' . $e->getMessage(), 'data' => []], 500);
            }
        });

        Route::get('/motivos-estados-poliza', function(Request $request) {
            try {
                $brokerId = $request->get('authenticated_broker_id') ?: (app()->environment('local', 'development') ? (int) ($request->header('X-Dev-Broker-Id') ?: 0) : 0);
                if (!$brokerId) {
                    return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 400);
                }
                $motivos = \App\Models\MotivoEstadoPoliza::where('broker_id', $brokerId)
                    ->select(['id', 'nombre'])
                    ->orderBy('nombre')
                    ->get();
                return response()->json(['success' => true, 'message' => 'Motivos estados póliza obtenidos exitosamente', 'data' => $motivos]);
            } catch (\Exception $e) {
                return response()->json(['success' => false, 'message' => 'Error al obtener motivos: ' . $e->getMessage(), 'data' => []], 500);
            }
        });

        Route::get('/usuarios', function(Request $request) {
            try {
                $brokerId = $request->get('authenticated_broker_id') ?: (app()->environment('local', 'development') ? (int) ($request->header('X-Dev-Broker-Id') ?: 0) : 0);
                if (!$brokerId) {
                    return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 400);
                }

                $usuarios = \App\Models\User::where('broker_id', $brokerId)
                    ->select(['id', 'name', 'email'])
                    ->orderBy('name')
                    ->get();

                $empleados = [];
                if (\Schema::hasTable('empleados')) {
                    $empleados = \App\Models\Empleado::where('broker_id', $brokerId)
                        ->where('estado', 'activo')
                        ->select(['id', 'nombre', 'apellidos', 'email'])
                        ->orderBy('nombre')
                        ->get();
                }

                $data = [];
                foreach ($usuarios as $usuario) {
                    $data[] = [
                        'id' => $usuario->id,
                        'nombre' => $usuario->name,
                        'apellidos' => '',
                        'email' => $usuario->email,
                        'tipo' => 'usuario'
                    ];
                }
                foreach ($empleados as $empleado) {
                    $data[] = [
                        'id' => $empleado->id,
                        'nombre' => $empleado->nombre,
                        'apellidos' => $empleado->apellidos,
                        'email' => $empleado->email,
                        'tipo' => 'empleado'
                    ];
                }
                return response()->json(['success' => true, 'message' => 'Usuarios obtenidos exitosamente', 'data' => $data]);
            } catch (\Exception $e) {
                return response()->json(['success' => false, 'message' => 'Error al obtener usuarios: ' . $e->getMessage(), 'data' => []], 500);
            }
        });
    });

// Rutas que requieren autenticación con Firebase
Route::middleware('firebase.auth')->group(function () {
    
    // Rutas que requieren autenticación con Firebase
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/profile', [AuthController::class, 'getProfile']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        // Ruta de sync-firebase-user movida a la sección pública (línea 70)
    });
    
    // Rutas de Firebase específicas
    Route::prefix('firebase')->group(function () {
        Route::get('/profile', [AuthController::class, 'getProfile']);
    });
    
// Rutas de Wallet (expuestas también en api.php para compatibilidad)
// Usamos unified.auth + global.broker.auth para autenticación
Route::middleware(['unified.auth','global.broker.auth','saas.auth'])->prefix('saas')->group(function () {
    Route::prefix('wallet')->group(function () {
        Route::get('/balance', [WalletController::class, 'getBalance']);
        Route::get('/transactions', [WalletController::class, 'getTransactionHistory']);
        Route::post('/checkout/wompi', [WalletController::class, 'wompiCheckout']);
        Route::post('/signature/wompi', [WalletController::class, 'wompiSignature']);
        // Fallback manual para confirmar pago si el webhook se demora
        Route::post('/confirm/wompi', [WalletController::class, 'wompiConfirm']);
    });
    // Dashboard - primas por periodo (compatibilidad en api.php)
    Route::get('dashboard/primas-chart', [DashboardController::class, 'getPrimasChart']);

    // Notificaciones - estadísticas
    Route::prefix('notifications')->group(function () {
        Route::get('/stats', function(Request $request) {
            // Estadísticas básicas de notificaciones
            return response()->json([
                'success' => true,
                'data' => [
                    'total_notifications' => 0,
                    'unread_count' => 0,
                    'today_count' => 0,
                    'this_week_count' => 0,
                    'categories' => [
                        'system' => 0,
                        'policy' => 0,
                        'claim' => 0,
                        'payment' => 0,
                    ]
                ]
            ]);
        });
    });

    // =============================
    // Documentos de pólizas (compat)
    // =============================
    Route::prefix('polizas')->group(function () {
        // Lista global de documentos de todas las pólizas del broker
        Route::get('/documents', [\App\Http\Controllers\SaaS\PolizaDocumentsController::class, 'indexAll']);
        // Documentos por póliza específica
        Route::get('/{id}/documents', [\App\Http\Controllers\SaaS\PolizaDocumentsController::class, 'index'])->whereNumber('id');
        Route::post('/{id}/documents', [\App\Http\Controllers\SaaS\PolizaDocumentsController::class, 'upload'])->whereNumber('id');
        Route::delete('/{id}/documents', [\App\Http\Controllers\SaaS\PolizaDocumentsController::class, 'destroy'])->whereNumber('id');
        Route::get('/{id}/documents/signed-url', [\App\Http\Controllers\SaaS\PolizaDocumentsController::class, 'signedUrl'])->whereNumber('id');
    });

    // Equipos comerciales
    Route::prefix('sales-teams')->group(function () {
        Route::get('/', [SaasSalesTeamsController::class, 'index']);
        Route::post('/', [SaasSalesTeamsController::class, 'store']);
        Route::get('/{team}', [SaasSalesTeamsController::class, 'show']);
        Route::put('/{team}', [SaasSalesTeamsController::class, 'update']);
        Route::delete('/{team}', [SaasSalesTeamsController::class, 'destroy']);
        Route::get('/{team}/members', [SaasSalesTeamsController::class, 'members']);
        Route::post('/{team}/members', [SaasSalesTeamsController::class, 'addMember']);
        Route::delete('/{team}/members/{userId}', [SaasSalesTeamsController::class, 'removeMember']);
    });

    // Metas
    Route::prefix('goals')->group(function () {
        Route::get('/', [SaasSalesGoalsController::class, 'index']);
        Route::post('/', [SaasSalesGoalsController::class, 'store']);
        Route::get('/statistics', [SaasSalesGoalsController::class, 'statistics']);
        Route::get('/{goal}', [SaasSalesGoalsController::class, 'show']);
        Route::put('/{goal}', [SaasSalesGoalsController::class, 'update']);
        Route::delete('/{goal}', [SaasSalesGoalsController::class, 'destroy']);
    });

    // Rendimiento de Vendedores
    Route::prefix('sales-performance')->group(function () {
        Route::get('/metrics', [SaasSalesPerformanceController::class, 'getMetrics']);
        Route::get('/agents', [SaasSalesPerformanceController::class, 'getAgentsPerformance']);
        Route::get('/teams', [SaasSalesPerformanceController::class, 'getTeamsPerformance']);
        Route::get('/statistics', [SaasSalesPerformanceController::class, 'getStatistics']);
        Route::get('/export', [SaasSalesPerformanceController::class, 'exportPerformance']);
    });
});

    // Herramientas durante llamada (tool-calls)
    Route::prefix('voice-calls')->group(function () {
        Route::post('/{conversationId}/tools/send-payment-link', [CallToolsController::class, 'sendPaymentLink']);
        Route::post('/{conversationId}/tools/schedule-payment-link', [CallToolsController::class, 'schedulePaymentLink']);
        // Alternativa por ID interno de call
        Route::post('/by-call/{callId}/tools/schedule-payment-link', function(Request $request, int $callId) {
            $call = \App\Models\VoiceCampaignCall::find($callId);
            if (!$call) { return response()->json(['success'=>false,'message'=>'Llamada no encontrada'],404); }
            $controller = new \App\Http\Controllers\Api\CallToolsController();
            // Proxy a schedule usando conversationId del registro
            $request->merge([
                'phone' => $request->get('phone', $call->recipient_phone),
                'amount_cop' => $request->get('amount_cop'),
                'customer_name' => $request->get('customer_name', $call->recipient_name),
                'reference' => $request->get('reference'),
            ]);
            return $controller->schedulePaymentLink($request, (string) $call->elevenlabs_conversation_id);
        });
    });
    
    // Rutas de administración
    Route::prefix('admin')->group(function () {
        // Estadísticas y dashboard
        Route::get('/stats', [AdminController::class, 'getStats']);
        
        // Gestión de usuarios
        Route::get('/users', [AdminController::class, 'getUsers']);
        Route::post('/users', [AdminController::class, 'createUser']);
        Route::put('/users/{id}', [AdminController::class, 'updateUser']);
        Route::delete('/users/{id}', [AdminController::class, 'deleteUser']);
        Route::patch('/users/{id}/status', [AdminController::class, 'toggleUserStatus']);
        
        // Gestión de roles
        Route::get('/roles', [AdminController::class, 'getRoles']);
        
        // Gestión de compañías
        Route::get('/companies', [AdminController::class, 'getCompanies']);
        
        // Gestión de sucursales
        Route::get('/sucursales', [AdminController::class, 'getSucursales']);
    });
    
    // Ruta de dashboard de prueba con logging mejorado
    Route::get('/dashboard', function (Request $request) {
        $user = $request->user();
        
        // Obtener información del broker usando getPrimaryBroker()
        $broker = $user->getPrimaryBroker();
        $needsOnboarding = !$broker;
        $brokerInfo = $broker ? "Broker ID: {$broker->id} - {$broker->name}" : 'Sin broker asignado';
        
        
        $response = [
            'success' => true,
            'message' => '¡Bienvenido al dashboard!',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'firebase_uid' => $user->firebase_uid,
                'user_type' => $user->user_type,
                'broker_id' => $user->broker_id,
                'broker_info' => $brokerInfo,
                'email_verified' => !is_null($user->email_verified_at),
                'avatar' => $user->avatar,
                'provider' => $user->provider,
                'last_login' => $user->last_login_at,
            ],
            'broker' => $broker ? [
                'id' => $broker->id,
                'name' => $broker->name,
                'legal_name' => $broker->legal_name,
                'status' => $broker->status,
                'plan' => $broker->plan ?? 'basic',
                'trial_ends_at' => $broker->trial_ends_at,
            ] : null,
            'needs_onboarding' => $needsOnboarding,
            'firebase_claims' => $request->firebase_claims ?? [],
            'server_time' => now()->toISOString(),
            'auth_method' => 'Firebase Admin SDK'
        ];
        
        
        return response()->json($response);
    });
});

// Ruta segura para dashboard principal con autenticación Firebase
Route::middleware(['firebase.auth'])->get('/dashboard-data', [\App\Http\Controllers\Api\DashboardController::class, 'getDashboardData']);

// =============================================================================
// RUTAS DE CONTEXTO GLOBAL - AUTENTICACIÓN Y BROKER
// =============================================================================

// Rutas para el contexto global de autenticación
Route::middleware(['security.auth'])->prefix('global')->group(function () {
    // Obtener contexto completo (usuario, broker, branding)
    Route::get('/context', [\App\Http\Controllers\Api\GlobalAuthController::class, 'getGlobalContext']);
    
    // Obtener información del broker actual
    Route::get('/broker', [\App\Http\Controllers\Api\GlobalAuthController::class, 'getCurrentBroker']);
    
    // Obtener branding del broker actual
    Route::get('/branding', [\App\Http\Controllers\Api\GlobalAuthController::class, 'getBranding']);
    
    // Verificar permisos
    Route::post('/check-permission', [\App\Http\Controllers\Api\GlobalAuthController::class, 'checkPermission']);
    
    // Obtener estadísticas básicas del broker
    Route::get('/stats', [\App\Http\Controllers\Api\GlobalAuthController::class, 'getBrokerStats']);
});

// =============================================================================
// RUTAS SAAS: INSTANCIAS WHATSAPP (PROTEGIDAS)
// =============================================================================

Route::middleware(['security.auth'])->prefix('saas/whatsapp-instances')->group(function () {
    Route::get('/', [WhatsAppInstanceController::class, 'index']);
    Route::post('/', [WhatsAppInstanceController::class, 'store']);
    Route::get('{whatsAppInstance}/qr', [WhatsAppInstanceController::class, 'getQrCode']);
    Route::get('{whatsAppInstance}/status', [WhatsAppInstanceController::class, 'getStatus']);
    Route::post('{whatsAppInstance}/restart', [WhatsAppInstanceController::class, 'restart']);
    Route::post('{whatsAppInstance}/disconnect', [WhatsAppInstanceController::class, 'disconnect']);
    Route::delete('{whatsAppInstance}', [WhatsAppInstanceController::class, 'destroy']);
    Route::post('refresh-all-statuses', [WhatsAppInstanceController::class, 'refreshAllStatuses']);
    
    // Cloud API endpoints
    Route::post('{whatsAppInstance}/cloud-api/send', [WhatsAppInstanceController::class, 'sendCloudApiMessage']);
    Route::post('{whatsAppInstance}/cloud-api/test', [WhatsAppInstanceController::class, 'testCloudApiConnection']);
});

// =============================================================================
// RUTAS SAAS: WHATSAPP INBOX (PROTEGIDAS)
// =============================================================================

Route::middleware(['unified.auth', 'security.auth'])->prefix('saas/whatsapp-inbox')->group(function () {
    // Estadísticas
    Route::get('stats', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'getStats']);
    
    // Departamentos
    Route::get('departments', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'getDepartments']);
    Route::post('departments', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'createDepartment']);
    Route::put('departments/{department}', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'updateDepartment']);
    Route::delete('departments/{department}', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'deleteDepartment']);
    Route::post('departments/{department}/members', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'addMemberToDepartment']);
    Route::delete('departments/{department}/members/{userId}', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'removeMemberFromDepartment']);
    
    // Conversaciones
    Route::get('conversations', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'getConversations']);
    Route::get('conversations/mine', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'getMyConversations']);
    Route::get('conversations/{conversation}', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'getConversation']);
    Route::put('conversations/{conversation}', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'updateConversation']);
    Route::get('conversations/{conversation}/messages', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'getConversationMessages']);
    Route::post('conversations/{conversation}/messages', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'sendMessage']);
    Route::post('conversations/{conversation}/media', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'sendMediaMessage']);
    Route::post('conversations/{conversation}/assign', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'assignConversation']);
    Route::post('conversations/{conversation}/assign-department', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'assignToDepartment']);
    Route::post('conversations/{conversation}/resolve', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'resolveConversation']);
    Route::post('conversations/{conversation}/notes', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'addNote']);
    
    // Respuestas rápidas
    Route::get('quick-replies', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'getQuickReplies']);
    Route::post('quick-replies', [\App\Http\Controllers\Api\WhatsAppInboxController::class, 'createQuickReply']);
});

// =============================================================================
// RUTAS SAAS: CHATBOTS WHATSAPP (PROTEGIDAS)
// =============================================================================

Route::middleware(['unified.auth', 'security.auth'])->prefix('saas/chatbots')->group(function () {
    // CRUD Chatbots
    Route::get('/', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'index']);
    Route::post('/', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'store']);
    Route::get('{id}', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'show']);
    Route::put('{id}', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'update']);
    Route::delete('{id}', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'destroy']);
    Route::post('{id}/duplicate', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'duplicate']);
    
    // Flows
    Route::get('{chatbotId}/flows', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'getFlows']);
    Route::post('{chatbotId}/flows', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'createFlow']);
    Route::put('flows/{flowId}', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'updateFlow']);
    Route::delete('flows/{flowId}', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'deleteFlow']);
    
    // Nodes
    Route::post('flows/{flowId}/nodes', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'createNode']);
    Route::put('flows/{flowId}/nodes/bulk', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'updateNodesBulk']);
    Route::put('nodes/{nodeId}', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'updateNode']);
    Route::delete('nodes/{nodeId}', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'deleteNode']);
    
    // Triggers
    Route::get('{chatbotId}/triggers', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'getTriggers']);
    Route::post('{chatbotId}/triggers', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'createTrigger']);
    Route::put('triggers/{triggerId}', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'updateTrigger']);
    Route::delete('triggers/{triggerId}', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'deleteTrigger']);
    
    // Sessions
    Route::get('{chatbotId}/sessions', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'getSessions']);
    Route::delete('sessions/{sessionId}', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'endSession']);
    
    // Analytics
    Route::get('{chatbotId}/analytics', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'getAnalytics']);
    Route::get('{chatbotId}/analytics/detailed', [\App\Http\Controllers\Api\WhatsAppChatbotController::class, 'getDetailedAnalytics']);
});

// Rutas protegidas (requieren autenticación Sanctum - para compatibilidad)
Route::middleware('auth:sanctum')->group(function () {
    // Aquí irán las rutas de la aplicación principal que usen Sanctum
    Route::get('/sanctum/dashboard', function () {
        return response()->json(['message' => 'Dashboard con Sanctum']);
    });
});

// Rutas de autenticación para cuentas master
Route::prefix('master/auth')->group(function () {
    Route::post('login', [App\Http\Controllers\Auth\MasterAuthController::class, 'login']);
    Route::post('register', [App\Http\Controllers\Auth\MasterAuthController::class, 'register']);
    
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [App\Http\Controllers\Auth\MasterAuthController::class, 'logout']);
        Route::get('me', [App\Http\Controllers\Auth\MasterAuthController::class, 'me']);
        Route::post('refresh', [App\Http\Controllers\Auth\MasterAuthController::class, 'refresh']);
    });
});

// =============================================================================
// PANEL MASTER (SUPERADMIN) - Dashboard global de la plataforma
// =============================================================================
Route::prefix('master-panel')->group(function () {
    // Login público (sin middleware)
    Route::post('/login', [\App\Http\Controllers\Api\MasterDashboardController::class, 'login']);
    
    // Rutas protegidas con Sanctum
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [\App\Http\Controllers\Api\MasterDashboardController::class, 'logout']);
        Route::get('/me', [\App\Http\Controllers\Api\MasterDashboardController::class, 'me']);
        Route::get('/stats', [\App\Http\Controllers\Api\MasterDashboardController::class, 'getGlobalStats']);
        Route::get('/brokers', [\App\Http\Controllers\Api\MasterDashboardController::class, 'getBrokers']);
        Route::get('/usuarios', [\App\Http\Controllers\Api\MasterDashboardController::class, 'getUsuarios']);
        Route::get('/facturacion', [\App\Http\Controllers\Api\MasterDashboardController::class, 'getFacturacion']);
        Route::get('/logs', [\App\Http\Controllers\Api\MasterDashboardController::class, 'getLogs']);
        
        // Rutas específicas de broker (deben ir antes de la ruta genérica {brokerId})
        Route::get('/brokers/{brokerId}/full-detail', [\App\Http\Controllers\Api\MasterDashboardController::class, 'getBrokerFullDetail']);
        Route::get('/brokers/{brokerId}/payments', [\App\Http\Controllers\Api\MasterDashboardController::class, 'getBrokerPayments']);
        Route::patch('/brokers/{brokerId}/toggle-status', [\App\Http\Controllers\Api\MasterDashboardController::class, 'toggleBrokerStatus']);
        Route::post('/brokers/{brokerId}/wallet', [\App\Http\Controllers\Api\MasterDashboardController::class, 'updateBrokerWallet']);
        Route::put('/brokers/{brokerId}/subscription', [\App\Http\Controllers\Api\MasterDashboardController::class, 'updateBrokerSubscription']);
        
        // Ruta genérica de broker (debe ir al final)
        Route::get('/brokers/{brokerId}', [\App\Http\Controllers\Api\MasterDashboardController::class, 'getBrokerDetail']);
    });
});

// =============================================================================
// RUTAS SAAS CON AUTENTICACIÓN UNIFICADA - SISTEMA UNIFICADO
// =============================================================================

// Rutas SaaS - ONBOARDING (solo autenticación unificada, sin broker requerido)
Route::middleware(['unified.auth', 'security.auth'])->prefix('saas')->group(function () {
    Route::post('onboarding/create-broker', [OnboardingController::class, 'createBrokerWithFirebase']);
    // Nuevo endpoint simplificado para el flujo de registro rápido
    Route::post('onboarding/create-broker-simple', [OnboardingController::class, 'createBrokerSimplified']);
    // Obtener perfil del broker (para verificar datos de onboarding)
    Route::get('broker/profile', [OnboardingController::class, 'getBrokerProfile']);
    // Actualizar perfil del broker (para completar datos después del registro)
    Route::put('broker/profile', [OnboardingController::class, 'updateBrokerProfile']);
});

// Rutas SaaS con Autenticación Unificada (Firebase + Empleados)
// Aisladas por broker y protegidas por permisos
// Billing endpoints que deben funcionar incluso con trial expirado (solo autenticación, sin verificar broker activo)
Route::middleware(['unified.auth'])->prefix('saas/billing')->group(function () {
    Route::get('/pending-intent', [\App\Http\Controllers\Api\SubscriptionController::class, 'pendingIntent']);
    Route::get('/subscription', [\App\Http\Controllers\Api\SubscriptionController::class, 'current']);
});

Route::middleware(['unified.auth', 'global.broker.auth', 'saas.auth'])->prefix('saas')->group(function () {
    
    // Catálogos de solo lectura (empleados activos y usuarios) - protegidos por unified.auth + global.broker.auth + saas.auth (del grupo padre)
    Route::prefix('catalogos')->group(function () {
        Route::get('/aseguradoras', [App\Http\Controllers\SaaS\AseguradorasController::class, 'index']);
        Route::get('/ramos', [App\Http\Controllers\SaaS\RamosController::class, 'index']);
        Route::get('/vendedores', [App\Http\Controllers\SaaS\VendedoresController::class, 'index']);
        Route::get('/usuarios', [EmpleadosController::class, 'getUsuarios']);
        Route::get('/sedes', [App\Http\Controllers\SaaS\SedesController::class, 'index']);
        Route::get('/estados-siniestros', [App\Http\Controllers\SaaS\EstadosSiniestrosController::class, 'index']);
        Route::get('/motivos-estados-poliza', [App\Http\Controllers\SaaS\MotivosEstadosPolizaController::class, 'index']);
    });
    // Verificar estado del usuario SaaS
    // Route::get('me', [SaasAuthController::class, 'firebaseMe']); // Comentado temporalmente
    
    // Billing - Suscripción y Facturas (rutas que requieren broker activo)
    Route::prefix('billing')->group(function () {
        Route::get('/invoices', [\App\Http\Controllers\Api\SubscriptionController::class, 'invoices']);
        Route::get('/invoices/{invoiceId}/download', [\App\Http\Controllers\Api\SubscriptionController::class, 'downloadInvoice']);
        Route::get('/usage', [\App\Http\Controllers\Api\SubscriptionController::class, 'usage']);
    });
    
    // Wallet - Balance y transacciones
    Route::prefix('wallet')->group(function () {
        Route::get('/balance', [WalletController::class, 'getBalance']);
        Route::get('/transactions', [WalletController::class, 'getTransactionHistory']);
        Route::post('/checkout/wompi', [WalletController::class, 'wompiCheckout']);
        Route::post('/signature/wompi', [WalletController::class, 'wompiSignature']);
        Route::post('/confirm/wompi', [WalletController::class, 'wompiConfirm']);
    });
    
    // Rutas protegidas SaaS con Autenticación Unificada + verificación de permisos
    Route::middleware(['saas.auth'])->group(function () {
        
        // Pólizas SaaS con aislamiento multi-tenant
        Route::prefix('polizas')->group(function () {
            Route::get('/', [SaasPolizasController::class, 'indexDev']);
            Route::get('/estadisticas', [SaasPolizasController::class, 'estadisticasDev']);
            Route::get('/activas-para-siniestros', [SaasPolizasController::class, 'activasParaSiniestrosDev']);
            Route::get('/exportar', [SaasPolizasController::class, 'exportar']);
            Route::post('/', [SaasPolizasController::class, 'store']);
            Route::get('/{id}', [SaasPolizasController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [SaasPolizasController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [SaasPolizasController::class, 'destroy'])->whereNumber('id');
            // Documentos de póliza (desarrollo/no auth)
            Route::get('/{id}/documents', [PolizaDocumentsController::class, 'index'])->whereNumber('id');
            Route::post('/{id}/documents', [PolizaDocumentsController::class, 'upload'])->whereNumber('id');
            Route::delete('/{id}/documents', [PolizaDocumentsController::class, 'destroy'])->whereNumber('id');
            Route::get('/{id}/documents/signed-url', [PolizaDocumentsController::class, 'signedUrl'])->whereNumber('id');
            Route::post('/{id}/cambiar-estado', [SaasPolizasController::class, 'cambiarEstado'])->whereNumber('id');

            // Renovaciones
            Route::get('/renovaciones', [SaasPolizasController::class, 'renovacionesDev']);
            Route::get('/renovaciones/estadisticas', [SaasPolizasController::class, 'estadisticasRenovacionesDev']);
            Route::get('/renovaciones/exportar', [SaasPolizasController::class, 'exportarRenovaciones']);
            Route::get('/{id}/renovaciones/historial', [SaasPolizasController::class, 'historialRenovaciones'])->whereNumber('id');
            Route::post('/{id}/renovaciones/contacto', [SaasPolizasController::class, 'registrarContactoRenovacion'])->whereNumber('id');
            Route::post('/{id}/renovaciones/procesar', [SaasPolizasController::class, 'procesarRenovacion'])->whereNumber('id');
            // Anexos (desarrollo/no auth)
            Route::get('/{id}/anexos', [\App\Http\Controllers\SaaS\AnexosController::class, 'index'])->whereNumber('id');
            Route::post('/{id}/anexos', [\App\Http\Controllers\SaaS\AnexosController::class, 'store'])->whereNumber('id');
            Route::put('/{id}/anexos/{anexoId}', [\App\Http\Controllers\SaaS\AnexosController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}/anexos/{anexoId}', [\App\Http\Controllers\SaaS\AnexosController::class, 'destroy'])->whereNumber('id');

            // Endpoint de debug
            Route::get('/debug/broker', [SaasPolizasController::class, 'debugBroker']);
        });

        // Automóviles (SaaS protegido)
        // Ruta explícita para catálogos (evitar colisión con /{id})
        Route::get('automoviles/catalogos', [AutomovilesController::class, 'catalogos']);
        Route::prefix('automoviles')->group(function () {
            Route::get('/', [AutomovilesController::class, 'index']);
            Route::post('/', [AutomovilesController::class, 'store']);
            Route::get('/{id}', [AutomovilesController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [AutomovilesController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [AutomovilesController::class, 'destroy'])->whereNumber('id');
        });

        // Comisiones Manuales de Pólizas
        Route::get('comisiones-manuales/constants', [\App\Http\Controllers\SaaS\ComisionesManualesController::class, 'constants']);
        Route::get('comisiones-manuales/pendientes', [\App\Http\Controllers\SaaS\ComisionesManualesController::class, 'pendientesPorVendedor']);
        Route::prefix('polizas/{polizaId}/comisiones-manuales')->group(function () {
            Route::get('/', [\App\Http\Controllers\SaaS\ComisionesManualesController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\SaaS\ComisionesManualesController::class, 'store']);
            Route::get('/{id}', [\App\Http\Controllers\SaaS\ComisionesManualesController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [\App\Http\Controllers\SaaS\ComisionesManualesController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [\App\Http\Controllers\SaaS\ComisionesManualesController::class, 'destroy'])->whereNumber('id');
            Route::post('/{id}/anular', [\App\Http\Controllers\SaaS\ComisionesManualesController::class, 'anular'])->whereNumber('id');
        });
        
        // Rutas para reportes
        Route::get('/reports/policies', [SaasPolizasController::class, 'reportsData']);
        Route::get('/reports/renewals', [SaasPolizasController::class, 'renewalsData']);
        Route::get('/reports/claims', [SaasPolizasController::class, 'claimsData']);
        Route::get('/reports/commissions', [SaasPolizasController::class, 'commissionsData']);
        Route::get('/reports/dashboard', [SaasPolizasController::class, 'dashboardData']);
        Route::get('/reports/analytics', [SaasPolizasController::class, 'analyticsData']);
        Route::get('/reports/financial', [SaasPolizasController::class, 'financialData']);
        Route::get('/reports/operational', [SaasPolizasController::class, 'operationalData']);
        Route::get('/reports/compliance', [SaasPolizasController::class, 'complianceData']);
        Route::get('/reports/export', [SaasPolizasController::class, 'exportData']);
        
        // Rutas para tareas de seguimiento comercial
        Route::prefix('commercial-tasks')->group(function () {
            Route::get('/', [SaasCommercialTasksController::class, 'index']);
            Route::post('/', [SaasCommercialTasksController::class, 'store']);
            Route::get('/statistics', [SaasCommercialTasksController::class, 'statistics']);
            Route::get('/needing-attention', [SaasCommercialTasksController::class, 'needingAttention']);
            Route::get('/clients', [SaasCommercialTasksController::class, 'getClients']);
            Route::get('/users', [SaasCommercialTasksController::class, 'getUsers']);
            Route::get('/{task}', [SaasCommercialTasksController::class, 'show']);
            Route::put('/{task}', [SaasCommercialTasksController::class, 'update']);
            Route::delete('/{task}', [SaasCommercialTasksController::class, 'destroy']);
            Route::post('/{task}/start', [SaasCommercialTasksController::class, 'start']);
            Route::post('/{task}/complete', [SaasCommercialTasksController::class, 'complete']);
            Route::post('/{task}/pause', [SaasCommercialTasksController::class, 'pause']);
            Route::post('/{task}/cancel', [SaasCommercialTasksController::class, 'cancel']);
            Route::post('/{task}/assign', [SaasCommercialTasksController::class, 'assign']);
            Route::post('/{task}/add-note', [SaasCommercialTasksController::class, 'addNote']);
        });
        
        // Rutas para siniestros - alineadas con permisos unificados (SaasAuth)
        Route::prefix('siniestros')->group(function () {
            Route::get('/', [SaasSiniestroController::class, 'index'])->middleware('saas.auth:siniestros.ver');
            Route::post('/', [SaasSiniestroController::class, 'store'])->middleware('saas.auth:siniestros.crear');
            Route::get('/statistics', [SaasSiniestroController::class, 'statistics'])->middleware('saas.auth:siniestros.ver');
            Route::get('/needing-attention', [SaasSiniestroController::class, 'needingAttention'])->middleware('saas.auth:siniestros.ver');
            Route::get('/adjusters', [SaasSiniestroController::class, 'getAvailableAdjusters'])->middleware('saas.auth:siniestros.ver');
            Route::get('/constants', [SaasSiniestroController::class, 'getConstants']);
            Route::get('/exportar', [SaasSiniestroController::class, 'exportarSiniestros'])->middleware('saas.auth:siniestros.ver');
            Route::get('/{id}', [SaasSiniestroController::class, 'show'])->middleware('saas.auth:siniestros.ver');
            Route::put('/{id}', [SaasSiniestroController::class, 'update'])->middleware('saas.auth:siniestros.editar');
            Route::delete('/{id}', [SaasSiniestroController::class, 'destroy'])->middleware('saas.auth:siniestros.eliminar');
            Route::post('/{id}/change-state', [SaasSiniestroController::class, 'changeState'])->middleware('saas.auth:siniestros.procesar');
            Route::post('/{id}/assign-adjuster', [SaasSiniestroController::class, 'assignAdjuster'])->middleware('saas.auth:siniestros.editar');
            Route::post('/{id}/approve', [SaasSiniestroController::class, 'approve'])->middleware('saas.auth:siniestros.procesar');
            Route::post('/{id}/reject', [SaasSiniestroController::class, 'reject'])->middleware('saas.auth:siniestros.procesar');
            Route::post('/{id}/pay', [SaasSiniestroController::class, 'pay'])->middleware('saas.auth:siniestros.procesar');
            Route::post('/{id}/reopen', [SaasSiniestroController::class, 'reopen'])->middleware('saas.auth:siniestros.editar');
            Route::post('/{id}/close', [SaasSiniestroController::class, 'close'])->middleware('saas.auth:siniestros.cerrar');
            Route::post('/{id}/add-communication', [SaasSiniestroController::class, 'addCommunication'])->middleware('saas.auth:siniestros.editar');
            Route::post('/{id}/add-observation', [SaasSiniestroController::class, 'addObservation'])->middleware('saas.auth:siniestros.editar');
        });
        
        // Rutas para embudo de ventas
        Route::prefix('sales-funnel')->group(function () {
            Route::get('/', [SaasSalesFunnelController::class, 'index']);
            Route::post('/', [SaasSalesFunnelController::class, 'store']);
            Route::get('/statistics', [SaasSalesFunnelController::class, 'statistics']);
            Route::get('/needing-attention', [SaasSalesFunnelController::class, 'needingAttention']);
            Route::get('/constants', [SaasSalesFunnelController::class, 'getConstants']);
            Route::get('/agents', [SaasSalesFunnelController::class, 'getAvailableAgents']);
            Route::get('/{lead}', [SaasSalesFunnelController::class, 'show']);
            Route::put('/{lead}', [SaasSalesFunnelController::class, 'update']);
            Route::delete('/{lead}', [SaasSalesFunnelController::class, 'destroy']);
            Route::post('/{lead}/move-to-next-stage', [SaasSalesFunnelController::class, 'moveToNextStage']);
            Route::post('/{lead}/move-to-stage', [SaasSalesFunnelController::class, 'moveToStage']);
            Route::post('/{lead}/close-as-won', [SaasSalesFunnelController::class, 'closeAsWon']);
            Route::post('/{lead}/close-as-lost', [SaasSalesFunnelController::class, 'closeAsLost']);
            Route::post('/{lead}/schedule-follow-up', [SaasSalesFunnelController::class, 'scheduleFollowUp']);
            Route::post('/{lead}/record-contact', [SaasSalesFunnelController::class, 'recordContact']);
            Route::post('/{lead}/update-score', [SaasSalesFunnelController::class, 'updateScore']);
            Route::post('/{lead}/convert-to-client', [SaasSalesFunnelController::class, 'convertToClient']);
        });
        
        // ==========================================
        // ADMIN CRUD ROUTES - CONFIGURACIÓN AGENCIA
        // ==========================================
        
        // Tipos de Afiliación
        Route::prefix('tipos-afiliacion')->group(function () {
            Route::get('/', [App\Http\Controllers\SaaS\TiposAfiliacionController::class, 'index']);
            Route::post('/', [App\Http\Controllers\SaaS\TiposAfiliacionController::class, 'store']);
            Route::get('/{id}', [App\Http\Controllers\SaaS\TiposAfiliacionController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [App\Http\Controllers\SaaS\TiposAfiliacionController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [App\Http\Controllers\SaaS\TiposAfiliacionController::class, 'destroy'])->whereNumber('id');
        });
        
        // Coberturas
        Route::prefix('coberturas')->group(function () {
            Route::get('/', [App\Http\Controllers\SaaS\CoberturasController::class, 'index']);
            Route::post('/', [App\Http\Controllers\SaaS\CoberturasController::class, 'store']);
            Route::get('/{id}', [App\Http\Controllers\SaaS\CoberturasController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [App\Http\Controllers\SaaS\CoberturasController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [App\Http\Controllers\SaaS\CoberturasController::class, 'destroy'])->whereNumber('id');
        });
        
        // Estados de Siniestros
        Route::prefix('estados-siniestros')->group(function () {
            Route::get('/', [App\Http\Controllers\SaaS\EstadosSiniestrosController::class, 'index']);
            Route::post('/', [App\Http\Controllers\SaaS\EstadosSiniestrosController::class, 'store']);
            Route::get('/{id}', [App\Http\Controllers\SaaS\EstadosSiniestrosController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [App\Http\Controllers\SaaS\EstadosSiniestrosController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [App\Http\Controllers\SaaS\EstadosSiniestrosController::class, 'destroy'])->whereNumber('id');
        });
        
        // Motivos Estados Póliza
        Route::prefix('motivos-estados-poliza')->group(function () {
            Route::get('/', [App\Http\Controllers\SaaS\MotivosEstadosPolizaController::class, 'index']);
            Route::post('/', [App\Http\Controllers\SaaS\MotivosEstadosPolizaController::class, 'store']);
            Route::get('/{id}', [App\Http\Controllers\SaaS\MotivosEstadosPolizaController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [App\Http\Controllers\SaaS\MotivosEstadosPolizaController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [App\Http\Controllers\SaaS\MotivosEstadosPolizaController::class, 'destroy'])->whereNumber('id');
        });
        
        // Sedes
        Route::prefix('sedes')->group(function () {
            Route::get('/', [App\Http\Controllers\SaaS\SedesController::class, 'index']);
            Route::post('/', [App\Http\Controllers\SaaS\SedesController::class, 'store']);
            Route::get('/{id}', [App\Http\Controllers\SaaS\SedesController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [App\Http\Controllers\SaaS\SedesController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [App\Http\Controllers\SaaS\SedesController::class, 'destroy'])->whereNumber('id');
        });
        
        // Aseguradoras
        Route::prefix('aseguradoras')->group(function () {
            Route::get('/', [App\Http\Controllers\SaaS\AseguradorasController::class, 'index']);
            Route::post('/', [App\Http\Controllers\SaaS\AseguradorasController::class, 'store']);
            Route::post('/bulk-delete', [App\Http\Controllers\SaaS\AseguradorasController::class, 'bulkDelete']);
            Route::get('/{id}', [App\Http\Controllers\SaaS\AseguradorasController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [App\Http\Controllers\SaaS\AseguradorasController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [App\Http\Controllers\SaaS\AseguradorasController::class, 'destroy'])->whereNumber('id');
        });
        
        // Vendedores
        Route::prefix('vendedores')->group(function () {
            Route::get('/', [App\Http\Controllers\SaaS\VendedoresController::class, 'index']);
            Route::post('/', [App\Http\Controllers\SaaS\VendedoresController::class, 'store']);
            Route::get('/{id}', [App\Http\Controllers\SaaS\VendedoresController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [App\Http\Controllers\SaaS\VendedoresController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [App\Http\Controllers\SaaS\VendedoresController::class, 'destroy'])->whereNumber('id');
        });
        
        // Liquidaciones de Vendedores
        Route::prefix('liquidaciones-vendedores')->group(function () {
            Route::get('/comisiones-disponibles', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'comisionesDisponibles']);
            Route::get('/reporte', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'reporteLiquidaciones']);
            Route::get('/reporte-vendedor', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'reporteVendedor']);
            Route::post('/vista-previa', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'vistaPrevia']);
            Route::get('/', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'index']);
            Route::post('/', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'store']);
            Route::get('/{id}', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'show'])->whereNumber('id');
            Route::post('/{id}/aprobar', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'aprobar'])->whereNumber('id');
            Route::post('/{id}/registrar-pago', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'registrarPago'])->whereNumber('id');
            Route::post('/{id}/revertir', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'revertir'])->whereNumber('id');
            Route::get('/{id}/pdf', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'generarPDF'])->whereNumber('id');
            Route::delete('/{id}', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'destroy'])->whereNumber('id');
        });

        // Liquidaciones Manuales (desde comisiones manuales de pólizas)
        Route::post('liquidaciones-manuales', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'crearDesdeComisionesManuales']);
        Route::post('liquidaciones-manuales-poliza', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'crearDesdePoliza']);
        Route::put('liquidaciones-manuales-poliza/{id}', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'actualizarDesdePoliza'])->whereNumber('id');
        Route::get('liquidaciones-vendedores/{id}/detalles', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'obtenerDetalles'])->whereNumber('id');
        Route::get('polizas/{polizaId}/comisiones-manuales/liquidaciones', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'liquidacionesPorPoliza']);
        Route::get('polizas/{polizaId}/datos-liquidacion', [App\Http\Controllers\SaaS\LiquidacionesVendedoresController::class, 'datosLiquidacionPoliza']);
        
        // Ramos
Route::prefix('ramos')->group(function () {
Route::get('/categorias', [App\Http\Controllers\SaaS\RamosController::class, 'categorias']);
Route::get('/', [App\Http\Controllers\SaaS\RamosController::class, 'index']);
Route::post('/', [App\Http\Controllers\SaaS\RamosController::class, 'store']);
Route::post('/bulk-delete', [App\Http\Controllers\SaaS\RamosController::class, 'bulkDelete']);
Route::get('/{id}', [App\Http\Controllers\SaaS\RamosController::class, 'show'])->whereNumber('id');
Route::put('/{id}', [App\Http\Controllers\SaaS\RamosController::class, 'update'])->whereNumber('id');
Route::delete('/{id}', [App\Http\Controllers\SaaS\RamosController::class, 'destroy'])->whereNumber('id');
        });

       
        // Roles Broker - proteger por permisos
        Route::prefix('roles')->group(function () {
            Route::get('/', [App\Http\Controllers\SaaS\RolesBrokerController::class, 'index'])->middleware('saas.auth:roles_permisos.ver');
            Route::post('/', [App\Http\Controllers\SaaS\RolesBrokerController::class, 'store'])->middleware('saas.auth:roles_permisos.crear');
            Route::get('/permisos', [App\Http\Controllers\SaaS\RolesBrokerController::class, 'permisos'])->middleware('saas.auth:roles_permisos.ver');
            Route::get('/niveles-acceso', [App\Http\Controllers\SaaS\RolesBrokerController::class, 'nivelesAcceso'])->middleware('saas.auth:roles_permisos.ver');
            Route::get('/{id}', [App\Http\Controllers\SaaS\RolesBrokerController::class, 'show'])->middleware('saas.auth:roles_permisos.ver');
            Route::put('/{id}', [App\Http\Controllers\SaaS\RolesBrokerController::class, 'update'])->middleware('saas.auth:roles_permisos.editar');
            Route::delete('/{id}', [App\Http\Controllers\SaaS\RolesBrokerController::class, 'destroy'])->middleware('saas.auth:roles_permisos.eliminar');
        });

        // Empleados Broker
        Route::prefix('empleados')->group(function () {
            Route::get('/estados', [App\Http\Controllers\SaaS\EmpleadosBrokerController::class, 'estados']);
            Route::get('/tipos-vinculacion', [App\Http\Controllers\SaaS\EmpleadosBrokerController::class, 'tiposVinculacion']);
            Route::get('/tipos-documento', [App\Http\Controllers\SaaS\EmpleadosBrokerController::class, 'tiposDocumento']);
            Route::get('/', [App\Http\Controllers\SaaS\EmpleadosBrokerController::class, 'index']);
            Route::post('/', [App\Http\Controllers\SaaS\EmpleadosBrokerController::class, 'store']);
            Route::get('/{id}', [App\Http\Controllers\SaaS\EmpleadosBrokerController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [App\Http\Controllers\SaaS\EmpleadosBrokerController::class, 'update'])->whereNumber('id');
            Route::put('/{id}/cambiar-password', [App\Http\Controllers\SaaS\EmpleadosBrokerController::class, 'cambiarPassword'])->whereNumber('id');
            Route::post('/{id}/generar-password-temporal', [App\Http\Controllers\SaaS\EmpleadosBrokerController::class, 'generarPasswordTemporal'])->whereNumber('id');
            Route::post('/{id}/reset-password', [App\Http\Controllers\SaaS\EmpleadosBrokerController::class, 'resetPassword'])->whereNumber('id');
            Route::delete('/{id}', [App\Http\Controllers\SaaS\EmpleadosBrokerController::class, 'destroy'])->whereNumber('id');
        });
        
        
    });
});

// =============================================================================
// RUTAS SAAS - SISTEMA MULTI-TENANT (SISTEMA ANTERIOR) - COMENTADO TEMPORALMENTE
// =============================================================================

// Rutas de autenticación SaaS
Route::prefix('saas/auth')->group(function () {
    // Route::post('login', [SaasAuthController::class, 'login']); // Comentado temporalmente
    // Route::post('logout', [SaasAuthController::class, 'logout'])->middleware('auth:sanctum'); // Comentado temporalmente
    // Route::post('refresh', [SaasAuthController::class, 'refreshToken'])->middleware('auth:sanctum'); // Comentado temporalmente
    // Route::get('me', [SaasAuthController::class, 'me'])->middleware('auth:sanctum'); // Comentado temporalmente
});

// Rutas protegidas SaaS - COMENTADO PARA EVITAR CONFLICTO CON FIREBASE AUTH
    // Empleados SaaS - Gestión de usuarios del broker
    Route::prefix('empleados')->group(function () {
        Route::get('/', [EmpleadosController::class, 'index']);
        Route::get('/usuarios', [EmpleadosController::class, 'getUsuarios']);
        Route::post('/', [EmpleadosController::class, 'store']); // Solo MASTER
        Route::get('/{empleado}', [EmpleadosController::class, 'show']);
        Route::put('/{empleado}', [EmpleadosController::class, 'update']);
        Route::delete('/{empleado}', [EmpleadosController::class, 'destroy']); // Solo MASTER
        });

    // Facturación y Pagos
    Route::middleware('saas.auth')->group(function () {
        Route::get('billing/info', [BillingController::class, 'getBillingInfo']);
        Route::post('billing/change-plan', [BillingController::class, 'changePlan']);
        Route::post('billing/process-payment', [BillingController::class, 'processPayment']);
        Route::get('billing/invoices', [BillingController::class, 'getInvoices']);
        Route::post('billing/generate-invoice', [BillingController::class, 'generateInvoice']);
    });

// 🔔 Webhook ElevenLabs (post-call) SIN autenticación (definición pública, fuera de middleware)
Route::post('saas/voice-campaigns/webhooks/elevenlabs', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'receiveElevenLabsWebhook'])->name('webhooks.elevenlabs');
// Ruta adicional explícita con slash inicial para evitar ambigüedad de prefijos
Route::post('/saas/voice-campaigns/webhooks/elevenlabs', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'receiveElevenLabsWebhook'])->name('webhooks.elevenlabs.alt');

    // Notificaciones - TODO: NotificationController no existe
    // Route::middleware('saas.auth')->group(function () {
    //     Route::get('notifications', [NotificationController::class, 'getNotifications']);
    //     Route::post('notifications', [NotificationController::class, 'createNotification']);
    //     Route::patch('notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
    //     Route::patch('notifications/mark-all-read', [NotificationController::class, 'markAllAsRead']);
    //     Route::patch('notifications/preferences', [NotificationController::class, 'updateNotificationPreferences']);
    // });

    // Webhooks - TODO: NotificationController no existe
    // Route::middleware('saas.auth')->group(function () {
    //     Route::get('webhooks', [NotificationController::class, 'getWebhooks']);
    //     Route::post('webhooks', [NotificationController::class, 'configureWebhook']);
    //     Route::post('webhooks/{webhook}/test', [NotificationController::class, 'testWebhook']);
    // });

    // Auditoría y Seguridad
    Route::middleware('saas.auth')->group(function () {
        Route::get('audit/logs', [AuditController::class, 'getAuditLogs']);
        Route::post('audit/logs', [AuditController::class, 'createAuditLog']);
        Route::get('audit/stats', [AuditController::class, 'getAuditStats']);
        Route::get('audit/export', [AuditController::class, 'exportAuditLogs']);
        Route::get('audit/security-alerts', [AuditController::class, 'getSecurityAlerts']);
        Route::get('audit/users-dashboard', [AuditController::class, 'getUsersDashboard']);
        Route::get('audit/user/{userId}', [AuditController::class, 'getUserActivity']);
    });

// Rutas para cuentas master (usuarios propietarios de brokers)
Route::middleware('auth:sanctum')->prefix('master')->group(function () {
    Route::get('/profile', [MasterAccountController::class, 'getProfile']);
    Route::put('/profile', [MasterAccountController::class, 'updateProfile']);
    Route::post('/change-password', [MasterAccountController::class, 'changePassword']);
    Route::post('/brokers', [MasterAccountController::class, 'createBroker']);
    Route::get('/stats', [MasterAccountController::class, 'getGlobalStats']);
    Route::get('/activity', [MasterAccountController::class, 'getRecentActivity']);
});

/*
|--------------------------------------------------------------------------
| Rutas de compatibilidad (mantenemos algunas rutas del sistema anterior)
|--------------------------------------------------------------------------
*/

// ===== RUTAS DE COMPATIBILIDAD =====
// Para que el frontend actual funcione mientras se actualiza

// RUTA DUPLICADA ELIMINADA - YA ESTÁ DEFINIDA ARRIBA

// ====================================================================
// RUTAS PARA ELEVENLABS WEBHOOK - SIN AUTENTICACIÓN (REQUERIDO)
// ====================================================================
Route::get('/v1/customer/{phone_number}', [SaasClientesController::class, 'getCustomerByPhone'])->where('phone_number', '.*');
Route::post('/v1/conversation-initiation', [SaasClientesController::class, 'getConversationInitiationData']);



// RUTA ESPECÍFICA ANTES DEL GRUPO SAAS GENERAL (orden crítico en Laravel)
Route::middleware('unified.auth')->get('/saas/me-simple', function(Request $request) {
    // Obtener el usuario autenticado por el middleware UnifiedAuthMiddleware
    $user = \App\Http\Middleware\UnifiedAuthMiddleware::getAuthenticatedUser($request);
    
    // Si llegamos aquí sin usuario, el middleware falló
    if (!$user) {
        return response()->json([
            'success' => false,
            'message' => 'Usuario no autenticado'
        ], 401);
    }
    
    $broker = $user->getPrimaryBroker();
    $needsOnboarding = !$broker;
    
    if ($needsOnboarding) {
        return response()->json([
            'success' => false,
            'needs_onboarding' => true,
            'onboarding_step' => 'create_broker',
            'message' => 'Usuario necesita crear un broker',
            'user_info' => [
                'name' => $user->name,
                'email' => $user->email,
                'tipo_usuario' => $user->user_type
            ]
        ], 403);
    }
    
    // Verificar si el trial ha expirado
    $isTrialExpired = $broker->status === 'trial' && 
                      $broker->trial_ends_at && 
                      $broker->trial_ends_at->isPast();
    
    // También verificar si el estado ya es trial_expired
    $isTrialExpired = $isTrialExpired || $broker->status === 'trial_expired';
    
    if ($isTrialExpired) {
        return response()->json([
            'success' => false,
            'error_code' => 'TRIAL_EXPIRED',
            'message' => 'Tu periodo de prueba ha expirado. Por favor, actualiza tu plan para continuar.',
            'trial_ends_at' => $broker->trial_ends_at?->toISOString(),
            'broker_id' => $broker->id,
            'broker_name' => $broker->name,
        ], 403);
    }
    
    return response()->json([
        'success' => true,
        'data' => [
            'user' => [
                'id' => $user->id,
                'nombre' => $user->name,
                'email' => $user->email,
                'user_type' => $user->user_type,
                'broker_id' => $user->broker_id,
                'permisos' => $user->permissions ?? [],
                'rol' => $user->role ?? 'super_admin'
            ],
            'broker' => [
                'id' => $broker->id,
                'nombre' => $broker->name,
                'name' => $broker->name,
                'email' => $broker->email,
                'nit' => $broker->document_number,
                'document_number' => $broker->document_number,
                'telefono' => $broker->phone,
                'phone' => $broker->phone,
                'ciudad' => $broker->city,
                'city' => $broker->city,
                'direccion' => $broker->address,
                'plan' => $broker->plan,
                'status' => $broker->status,
                'trial_ends_at' => $broker->trial_ends_at?->toISOString(),
                'subscription_ends_at' => $broker->subscription_ends_at?->toISOString(),
                'branding' => [
                    'logo' => $broker->getLogoUrl(),
                    'colores' => [
                        'primario' => '#635BFF',
                        'secundario' => '#16CDC7',
                        'acento' => '#36c96c'
                    ],
                    'nombre_comercial' => $broker->name
                ]
            ]
        ]
    ]);
});

// Rutas de pólizas SaaS con filtrado global por broker
    Route::middleware(['unified.auth','global.broker.auth','security.auth'])->prefix('saas')->group(function () {
    // Rutas de pólizas - LAS RUTAS ESPECÍFICAS DEBEN IR ANTES QUE LAS RUTAS CON PARÁMETROS
    Route::get('/polizas', [SaasPolizasController::class, 'indexDev']);
    Route::get('/polizas/estadisticas', [SaasPolizasController::class, 'estadisticasDev']);
    Route::get('/polizas/activas-para-siniestros', [SaasPolizasController::class, 'getPolizasActivasParaSiniestros']);
    Route::post('/polizas', [SaasPolizasController::class, 'store']);

    // Documentos de póliza: definir ANTES de las rutas con parámetro {id} y con restricción numérica
    Route::get('/polizas/documents', [PolizaDocumentsController::class, 'indexAll']);
    Route::get('/polizas/{id}/documents', [PolizaDocumentsController::class, 'index'])->whereNumber('id');
    Route::post('/polizas/{id}/documents', [PolizaDocumentsController::class, 'upload'])->whereNumber('id');
    Route::delete('/polizas/{id}/documents', [PolizaDocumentsController::class, 'destroy'])->whereNumber('id');
    Route::get('/polizas/{id}/documents/signed-url', [PolizaDocumentsController::class, 'signedUrl'])->whereNumber('id');

    // Rutas con {id} (constricción numérica para evitar capturar 'documents')
    Route::get('/polizas/{id}', [SaasPolizasController::class, 'show'])->whereNumber('id');
    Route::put('/polizas/{id}', [SaasPolizasController::class, 'update'])->whereNumber('id');
    Route::put('/polizas/{id}/estado', [SaasPolizasController::class, 'cambiarEstado'])->whereNumber('id');
    Route::delete('/polizas/{id}', [SaasPolizasController::class, 'destroy'])->whereNumber('id');

    // =============================
    // Documentos de siniestros (fuera del grupo prefix por rutas duplicadas dev)
    // =============================
    // IMPORTANTE: Rutas de documentos ANTES de la ruta genérica {id} (sin autenticación para desarrollo)
    Route::get('/siniestros/documents', [\App\Http\Controllers\SaaS\SiniestroDocumentsController::class, 'indexAll']);
    Route::get('/siniestros/{id}/documents', [\App\Http\Controllers\SaaS\SiniestroDocumentsController::class, 'index']);
    Route::post('/siniestros/{id}/documents', [\App\Http\Controllers\SaaS\SiniestroDocumentsController::class, 'upload']);
    Route::delete('/siniestros/{id}/documents', [\App\Http\Controllers\SaaS\SiniestroDocumentsController::class, 'destroy']);
    Route::get('/siniestros/{id}/documents/signed-url', [\App\Http\Controllers\SaaS\SiniestroDocumentsController::class, 'signedUrl']);


    
    // Rutas de dashboard con el mismo middleware que pólizas y clientes
    Route::get('/dashboard', [\App\Http\Controllers\Api\DashboardController::class, 'getDashboardData']);
    Route::get('/dashboard/data', [\App\Http\Controllers\Api\DashboardController::class, 'getDashboardData']);
    Route::get('/dashboard/metrics', [\App\Http\Controllers\Api\DashboardController::class, 'getMetrics']);
    
    // Rutas de renovaciones (basadas en pólizas)
    Route::get('/renovaciones', [SaasPolizasController::class, 'renovacionesDev']);
    Route::get('/renovaciones/estadisticas', [SaasPolizasController::class, 'estadisticasRenovacionesDev']);
    Route::post('/renovaciones/{id}/contacto', [SaasPolizasController::class, 'registrarContactoRenovacion']);
    Route::post('/renovaciones/{id}/procesar', [SaasPolizasController::class, 'procesarRenovacion']);
    // Anexos (autenticados)
    Route::get('/polizas/{id}/anexos', [\App\Http\Controllers\SaaS\AnexosController::class, 'index']);
    Route::post('/polizas/{id}/anexos', [\App\Http\Controllers\SaaS\AnexosController::class, 'store']);
    Route::put('/polizas/{id}/anexos/{anexoId}', [\App\Http\Controllers\SaaS\AnexosController::class, 'update']);
    Route::delete('/polizas/{id}/anexos/{anexoId}', [\App\Http\Controllers\SaaS\AnexosController::class, 'destroy']);
    Route::post('/polizas/{id}/anexos/{anexoId}/documents', [\App\Http\Controllers\SaaS\AnexosController::class, 'uploadDocuments']);
    Route::get('/renovaciones/export', [SaasPolizasController::class, 'exportarRenovaciones']);
    
    // Rutas de Calendario
    Route::get('/calendar/events', [\App\Http\Controllers\SaaS\CalendarEventController::class, 'index']);
    Route::post('/calendar/events', [\App\Http\Controllers\SaaS\CalendarEventController::class, 'store']);
    Route::get('/calendar/events/{id}', [\App\Http\Controllers\SaaS\CalendarEventController::class, 'show']);
    Route::put('/calendar/events/{id}', [\App\Http\Controllers\SaaS\CalendarEventController::class, 'update']);
    Route::delete('/calendar/events/{id}', [\App\Http\Controllers\SaaS\CalendarEventController::class, 'destroy']);
    
    // Ruta de debug para verificar el middleware Firebase
    Route::middleware(['firebase.auth'])->get('/clientes/debug-auth', function (Request $request) {
        $user = $request->user();
        return response()->json([
            'success' => true,
            'message' => 'Middleware Firebase funcionando',
            'user' => $user ? [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'broker_id' => $user->broker_id,
                'firebase_uid' => $user->firebase_uid,
            ] : null,
            'firebase_uid' => $request->get('firebase_uid'),
            'firebase_claims' => $request->get('firebase_claims')
        ]);
    });
    
    // Rutas de clientes (con autenticación Firebase)
    Route::middleware(['firebase.auth'])->group(function () {
        
    // Rutas para WhatsApp Instances
    Route::prefix('whatsapp-instances')->group(function () {
        Route::get('/', [WhatsAppInstanceController::class, 'index']);
        Route::post('/', [WhatsAppInstanceController::class, 'store']);
        Route::get('/{whatsAppInstance}', [WhatsAppInstanceController::class, 'show']);
        Route::put('/{whatsAppInstance}', [WhatsAppInstanceController::class, 'update']);
        Route::delete('/{whatsAppInstance}', [WhatsAppInstanceController::class, 'destroy']);
        
        // WhatsApp Instance specific actions
        Route::get('/{whatsAppInstance}/qr', [WhatsAppInstanceController::class, 'getQrCode']);
        Route::get('/{whatsAppInstance}/status', [WhatsAppInstanceController::class, 'getStatus']);
        Route::post('/{whatsAppInstance}/restart', [WhatsAppInstanceController::class, 'restart']);
        Route::post('/{whatsAppInstance}/disconnect', [WhatsAppInstanceController::class, 'disconnect']);
        
        // Actualizar estados de todas las instancias
        Route::post('/refresh-all-statuses', [WhatsAppInstanceController::class, 'refreshAllStatuses']);
    });

    // Alias estable para lista de instancias disponibles (evita colisión con /campaigns/{id})
    // Nuevo endpoint: GET /api/saas/whatsapp/available-instances
    Route::get('/whatsapp/available-instances', [\App\Http\Controllers\Api\CampaignController::class, 'getAvailableWhatsAppInstances']);
        
        // RUTAS DE CLIENTES (CON FIREBASE AUTH)
        Route::get('/clientes', [SaasClientesController::class, 'index']);
        Route::get('/clientes/all', [SaasClientesController::class, 'all']); // ✅ MOVIDA AL LUGAR CORRECTO
        Route::get('/clientes/estadisticas', [SaasClientesController::class, 'estadisticas']);
        Route::post('/clientes', [SaasClientesController::class, 'store']);
        Route::get('/clientes/{id}', [SaasClientesController::class, 'show'])->whereNumber('id');
        Route::put('/clientes/{id}', [SaasClientesController::class, 'update'])->whereNumber('id');
        Route::delete('/clientes/{id}', [SaasClientesController::class, 'destroy'])->whereNumber('id');
        
        // =============================
        // RUTAS DE CAMPAÑAS (CON FIREBASE AUTH IGUAL QUE CLIENTES)
        // =============================
        Route::prefix('campaigns')->group(function () {
            // IMPORTANT: Specific routes MUST come before the general /{id} route to avoid conflicts
            // Estadísticas y recursos específicos
            Route::get('/stats', [\App\Http\Controllers\Api\CampaignController::class, 'getStats']);
            Route::get('/send-history', [\App\Http\Controllers\Api\CampaignController::class, 'getSendHistory']);
            
            // ⚠️ DEPRECATED: Usar /saas/whatsapp/available-instances en su lugar
            // Mantenido temporalmente para compatibilidad con frontend antiguo
            Route::get('/available-whatsapp-instances', [\App\Http\Controllers\Api\CampaignController::class, 'getAvailableWhatsAppInstances']);
            
            Route::post('/preview-targets', [\App\Http\Controllers\Api\CampaignController::class, 'previewTargets']);
            Route::post('/test-call', [\App\Http\Controllers\Api\CampaignController::class, 'testCall']);
          
           // Subida de media para campañas (multipart/form-data: media)
            Route::post('/media-upload', [\App\Http\Controllers\Api\CampaignController::class, 'uploadMedia']);
          
           Route::post('/media-upload', [\App\Http\Controllers\Api\CampaignController::class, 'uploadMedia']);
          
          
           // Nuevas acciones de control de ejecución
            Route::post('/{id}/stop', [\App\Http\Controllers\Api\CampaignController::class, 'stop'])->whereNumber('id');     // Pausar campaña "sending" -> "paused"
            Route::post('/{id}/cancel', [\App\Http\Controllers\Api\CampaignController::class, 'cancel'])->whereNumber('id'); // Cancelar y marcar pendientes como failed

          
          

            // Crear diferentes tipos de campañas
            Route::post('/immediate', [\App\Http\Controllers\Api\CampaignController::class, 'createImmediate']);
            Route::post('/scheduled', [\App\Http\Controllers\Api\CampaignController::class, 'createScheduled']);
            Route::post('/policy-based', [\App\Http\Controllers\Api\CampaignController::class, 'createPolicyBased']);

            // Gestión general de campañas
            Route::get('/', [\App\Http\Controllers\Api\CampaignController::class, 'index']);

            // Rutas dependientes de ID (deben ir al final)
            Route::get('/{id}', [\App\Http\Controllers\Api\CampaignController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [\App\Http\Controllers\Api\CampaignController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [\App\Http\Controllers\Api\CampaignController::class, 'destroy'])->whereNumber('id');

            // Gestión de estado y ejecuciones para una campaña
            Route::patch('/{id}/toggle', [\App\Http\Controllers\Api\CampaignController::class, 'toggle'])->whereNumber('id');
            Route::post('/{id}/activate', [\App\Http\Controllers\Api\CampaignController::class, 'activate'])->whereNumber('id');
            Route::post('/{id}/execute-now', [\App\Http\Controllers\Api\CampaignController::class, 'executeNow'])->whereNumber('id');
            Route::post('/{id}/execute', [\App\Http\Controllers\Api\CampaignController::class, 'executeCampaign'])->whereNumber('id');
            Route::get('/{id}/executions', [\App\Http\Controllers\Api\CampaignController::class, 'getExecutions'])->whereNumber('id');
        });

        // =============================
        // RUTAS DE PLANTILLAS DE CAMPAÑAS
        // =============================
        Route::prefix('campaign-templates')->group(function () {
            Route::get('/', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'store']);
            Route::get('/categories', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'categories']);
            Route::get('/{id}', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'destroy'])->whereNumber('id');
            Route::post('/{id}/duplicate', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'duplicate'])->whereNumber('id');
            Route::post('/{id}/preview', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'preview'])->whereNumber('id');
        });
        // =============================
        // RUTAS DE CAMPAÑAS DE EMAIL (solo audiencias desde clientes)
        // =============================
        Route::prefix('email-campaigns')->group(function () {
            Route::get('/', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'index']);
            Route::post('/', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'store']);
            Route::post('/uploads', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'uploadCsv']);
            Route::get('/{id}', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'show'])->whereNumber('id');
            Route::post('/{id}/start', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'start'])->whereNumber('id');
            Route::get('/{id}/status', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'status'])->whereNumber('id');
            Route::get('/{id}/recipients', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'recipients'])->whereNumber('id');
        });
        
        // =============================
        // RUTAS DE CAMPAÑAS DE VOZ (CON FIREBASE AUTH IGUAL QUE CLIENTES)
        // =============================
        Route::prefix('voice-campaigns')->group(function () {
            // IMPORTANT: Specific GET routes MUST come before the general /{id} route
            // to avoid route parameter conflicts
            
            // Estadísticas de campañas de voz
            Route::get('/stats', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'getStats']);
            
            // Historial de llamadas
            Route::get('/call-history', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'getCallHistory']);
            
            // Sincronizar datos de llamadas desde VAPI (cuando webhook falló)
            Route::post('/calls/{callId}/sync-vapi', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'syncCallFromVapi']);
            Route::post('/calls/sync-pending', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'syncPendingCallsFromVapi']);
            
            // Sincronización en tiempo real de campaña desde VAPI API (para polling)
            Route::post('/{id}/sync-realtime', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'syncCampaignRealtime'])->whereNumber('id');
            
// =============================
// Voice Campaign Triggers (CRUD + utilities)
// IMPORTANT: Keep these BEFORE '/{id}' routes to avoid conflicts
// =============================
Route::get('/{campaignId}/triggers', [\App\Http\Controllers\Api\VoiceCampaignTriggersController::class, 'index'])->whereNumber('campaignId');
Route::post('/{campaignId}/triggers', [\App\Http\Controllers\Api\VoiceCampaignTriggersController::class, 'store'])->whereNumber('campaignId');
Route::put('/triggers/{triggerId}', [\App\Http\Controllers\Api\VoiceCampaignTriggersController::class, 'update'])->whereNumber('triggerId');
Route::delete('/triggers/{triggerId}', [\App\Http\Controllers\Api\VoiceCampaignTriggersController::class, 'destroy'])->whereNumber('triggerId');
Route::post('/triggers/{triggerId}/test-run', [\App\Http\Controllers\Api\VoiceCampaignTriggersController::class, 'testRun'])->whereNumber('triggerId');
Route::post('/triggers/{triggerId}/preview-targets', [\App\Http\Controllers\Api\VoiceCampaignTriggersController::class, 'previewTargets'])->whereNumber('triggerId');
Route::post('/triggers/process-event', [\App\Http\Controllers\Api\VoiceCampaignTriggersController::class, 'processEvent']);
            // Gestión general de campañas de voz
            Route::get('/', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'index']);
            Route::get('/{id}', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'show'])->whereNumber('id');
            
            // Crear diferentes tipos de campañas de voz
            Route::post('/immediate', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'createImmediate']);
            Route::post('/scheduled', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'createScheduled']);
            
            // Editar y eliminar campañas de voz
            Route::put('/{id}', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'destroy'])->whereNumber('id');
            
            // Gestión de estado de campañas de voz
            Route::patch('/{id}/toggle', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'toggle'])->whereNumber('id');
            // Controles explícitos (pausar, reanudar, cancelar)
            Route::post('/{id}/pause', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'pause'])->whereNumber('id');
            Route::post('/{id}/resume', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'resume'])->whereNumber('id');
            Route::post('/{id}/cancel', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'cancel'])->whereNumber('id');
            Route::post('/{id}/restart', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'restart'])->whereNumber('id');
            // Ejecutar campaña manualmente (para inmediatas/programadas)
            Route::post('/{id}/execute', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'execute'])->whereNumber('id');
            
            // 🔊 Prueba de llamada de voz con ElevenLabs
            Route::post('/test-call', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'testCall']);
            
            // 📅 Llamadas programadas
            Route::get('/{id}/scheduled-calls', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'getScheduledCalls'])->whereNumber('id');
            Route::post('/{id}/schedule-calls', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'scheduleCallsForCampaign'])->whereNumber('id');
            Route::post('/{id}/refresh-calls', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'refreshScheduledCalls'])->whereNumber('id');
            Route::post('/scheduled-calls/{scheduledCallId}/execute', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'executeScheduledCall'])->whereNumber('scheduledCallId');
            Route::post('/scheduled-calls/{scheduledCallId}/retry', [\App\Http\Controllers\Api\VoiceCampaignController::class, 'retryScheduledCall'])->whereNumber('scheduledCallId');
        });

        // =============================
        // IMPORTACIONES MASIVAS
        // =============================
        Route::prefix('imports')->group(function () {
            Route::get('/meta', [\App\Http\Controllers\SaaS\ImportsController::class, 'meta']);
            Route::post('/process', [\App\Http\Controllers\SaaS\ImportsController::class, 'process']);
            Route::get('/template', [\App\Http\Controllers\SaaS\ImportsController::class, 'template']);
            Route::get('/jobs', [\App\Http\Controllers\SaaS\ImportsController::class, 'jobs']);
            Route::get('/jobs/{id}', [\App\Http\Controllers\SaaS\ImportsController::class, 'showJob']);
        });

        // Configuración de broker (markup de llamadas)
        Route::prefix('broker')->group(function () {
            Route::get('/settings', [BrokerController::class, 'getSettings']);
            Route::patch('/settings', [BrokerController::class, 'updateSettings']);
        });
        
    });


    // Rutas básicas para WhatsApp
    Route::prefix('whatsapp-basic')->group(function () {
        Route::post('/initialize', [App\Http\Controllers\WhatsAppBasicController::class, 'initialize']);
        Route::get('/status', [App\Http\Controllers\WhatsAppBasicController::class, 'status']);
        Route::get('/qr', [App\Http\Controllers\WhatsAppBasicController::class, 'getQR']);
        Route::post('/stop', [App\Http\Controllers\WhatsAppBasicController::class, 'stop']);
        Route::post('/restart', [App\Http\Controllers\WhatsAppBasicController::class, 'restart']);
        Route::get('/info', [App\Http\Controllers\WhatsAppBasicController::class, 'info']);
        Route::post('/clear-auth', [App\Http\Controllers\WhatsAppBasicController::class, 'clearAuth']);
        Route::get('/logs', [App\Http\Controllers\WhatsAppBasicController::class, 'logs']);
        
        // Envío masivo para campañas
        Route::post('/bulk-send', [App\Http\Controllers\WhatsAppBasicController::class, 'sendBulkMessages']);
        Route::get('/bulk-status', [App\Http\Controllers\WhatsAppBasicController::class, 'getBulkStatus']);
    });
    
    // Alias para WhatsApp API
    Route::prefix('whatsapp')->group(function () {
        Route::post('/bulk-send', [App\Http\Controllers\WhatsAppBasicController::class, 'sendBulkMessages']);
        Route::get('/bulk-status', [App\Http\Controllers\WhatsAppBasicController::class, 'getBulkStatus']);
    });
    
    // Rutas de tareas de seguimiento comercial (temporalmente sin autenticación para desarrollo)
    Route::prefix('tasks')->group(function () {
        Route::get('/', [TaskController::class, 'index']);
        Route::post('/', [TaskController::class, 'store']);
        Route::get('/estadisticas', [TaskController::class, 'estadisticas']);
        Route::get('/opciones', [TaskController::class, 'opciones']);
        Route::get('/export', [TaskController::class, 'export']);
        Route::get('/{id}', [TaskController::class, 'show'])->whereNumber('id');
        Route::put('/{id}', [TaskController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [TaskController::class, 'destroy'])->whereNumber('id');
        Route::post('/{id}/completar', [TaskController::class, 'marcarCompletada'])->whereNumber('id');
    });
    
    // Rutas de Sales Funnel (protegidas)
    Route::prefix('sales-funnel')->middleware(['unified.auth','global.broker.auth','saas.auth'])->group(function () {
        Route::get('/', [SaasSalesFunnelController::class, 'index']);
        Route::get('/statistics', [SaasSalesFunnelController::class, 'statistics']);
        Route::get('/constants', [SaasSalesFunnelController::class, 'getConstants']);
        Route::get('/agents', [SaasSalesFunnelController::class, 'getAvailableAgents']);
        Route::post('/', [SaasSalesFunnelController::class, 'store']);
        Route::get('/{id}', [SaasSalesFunnelController::class, 'show'])->whereNumber('id');
        Route::put('/{id}', [SaasSalesFunnelController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [SaasSalesFunnelController::class, 'destroy'])->whereNumber('id');
    });
    
    // Rutas de comisiones SaaS
    Route::prefix('comisiones')->group(function () {
        Route::get('/', [\App\Http\Controllers\SaaS\SaasComisionesController::class, 'index']);
        Route::get('/estadisticas', [\App\Http\Controllers\SaaS\SaasComisionesController::class, 'estadisticas']);
        Route::post('/calcular', [\App\Http\Controllers\SaaS\SaasComisionesController::class, 'calcularComisiones']);
        Route::get('/exportar', [\App\Http\Controllers\SaaS\SaasComisionesController::class, 'exportar']);
        Route::get('/{id}', [\App\Http\Controllers\SaaS\SaasComisionesController::class, 'show'])->whereNumber('id');
    });

    // ⚠️ RUTAS TEMPORALES ELIMINADAS POR SEGURIDAD
    // /temp/comisiones/* - Exponían datos financieros sin autenticación
    // /debug/polizas/* - Exponían datos de pólizas sin autenticación  
    // /automoviles/* - Exponían datos de automóviles sin autenticación
    // Usar rutas protegidas: /saas/comisiones/*, /saas/polizas/*, /saas/automoviles/* (con autenticación)
});


// ===== RUTAS PARA SISTEMA DE APRENDIZAJE PDF =====
Route::prefix('saas/pdf-learning')->middleware(['auth:sanctum'])->group(function () {
    Route::post('/extractions', [PdfLearningController::class, 'recordExtraction']);
    Route::post('/extractions/{recordId}/corrections', [PdfLearningController::class, 'recordCorrection']);
    Route::get('/metrics', [PdfLearningController::class, 'getPerformanceMetrics']);
    Route::get('/history', [PdfLearningController::class, 'getExtractionHistory']);
    Route::get('/extractions/{recordId}', [PdfLearningController::class, 'getExtractionDetails']);
    Route::get('/report', [PdfLearningController::class, 'getLearningReport']);
    Route::post('/predict', [PdfLearningController::class, 'predictExtractionSuccess']);
    Route::get('/export', [PdfLearningController::class, 'exportLearningData']);
});

// =============================
// TEST ROUTES - Comercial (sin autenticación) solo entornos no productivos
// Habilita navegación de Metas, Equipos y Rendimiento sin login en frontend
// Simula usuario autenticado por broker (query ?broker_id=, header X-Dev-Broker-Id) o usa 2 por defecto
// =============================
Route::prefix('test')->group(function () {

        // Helper para resolver usuario de broker en closures
        $resolveUser = function (\Illuminate\Http\Request $request) {
            $brokerId = (int) ($request->query('broker_id') ?: ($request->header('X-Dev-Broker-Id') ?: 2));
            $user = \App\Models\User::where('broker_id', $brokerId)->first();
            if (!$user) {
                return [null, response()->json(['error' => 'Usuario no encontrado para broker_id ' . $brokerId], 404)];
            }
            $request->setUserResolver(fn () => $user);
            return [$user, null];
        };

        // ---- Goals (metas) ----
        Route::get('/goals', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesGoalsController::class)->index($request);
        });
        Route::get('/goals/statistics', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesGoalsController::class)->statistics($request);
        });
        Route::post('/goals', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesGoalsController::class)->store($request);
        });
        Route::get('/goals/{goal}', function (\Illuminate\Http\Request $request, \App\Models\SalesGoal $goal) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesGoalsController::class)->show($request, $goal);
        })->whereNumber('goal');
        Route::put('/goals/{goal}', function (\Illuminate\Http\Request $request, \App\Models\SalesGoal $goal) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesGoalsController::class)->update($request, $goal);
        })->whereNumber('goal');
        Route::delete('/goals/{goal}', function (\Illuminate\Http\Request $request, \App\Models\SalesGoal $goal) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesGoalsController::class)->destroy($request, $goal);
        })->whereNumber('goal');

        // ---- Sales Teams (equipos) ----
        Route::get('/sales-teams', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesTeamsController::class)->index($request);
        });
        Route::post('/sales-teams', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesTeamsController::class)->store($request);
        });
        Route::get('/sales-teams/{team}', function (\Illuminate\Http\Request $request, \App\Models\SalesTeam $team) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesTeamsController::class)->show($request, $team);
        })->whereNumber('team');
        Route::put('/sales-teams/{team}', function (\Illuminate\Http\Request $request, \App\Models\SalesTeam $team) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesTeamsController::class)->update($request, $team);
        })->whereNumber('team');
        Route::delete('/sales-teams/{team}', function (\Illuminate\Http\Request $request, \App\Models\SalesTeam $team) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesTeamsController::class)->destroy($request, $team);
        })->whereNumber('team');
        Route::get('/sales-teams/{team}/members', function (\Illuminate\Http\Request $request, \App\Models\SalesTeam $team) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesTeamsController::class)->members($request, $team);
        })->whereNumber('team');
        Route::post('/sales-teams/{team}/members', function (\Illuminate\Http\Request $request, \App\Models\SalesTeam $team) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesTeamsController::class)->addMember($request, $team);
        })->whereNumber('team');
        Route::delete('/sales-teams/{team}/members/{userId}', function (\Illuminate\Http\Request $request, \App\Models\SalesTeam $team, int $userId) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesTeamsController::class)->removeMember($request, $team, $userId);
        })->whereNumber('team')->whereNumber('userId');

        // ---- Sales Funnel (rendimiento) ----
        Route::get('/sales-funnel/statistics', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesFunnelController::class)->statistics($request);
        });
        Route::get('/sales-funnel/agents', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesFunnelController::class)->getAvailableAgents($request);
        });
        Route::get('/sales-funnel/constants', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesFunnelController::class)->getConstants();
        });
        Route::get('/sales-funnel', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesFunnelController::class)->index($request);
        });
    // ---- Sales Performance (rendimiento) ----
    Route::get('/sales-performance/metrics', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesPerformanceController::class)->getMetrics($request);
        });

        Route::get('/sales-performance/agents', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesPerformanceController::class)->getAgentsPerformance($request);
        });

        Route::get('/sales-performance/teams', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesPerformanceController::class)->getTeamsPerformance($request);
        });

        Route::get('/sales-performance/statistics', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesPerformanceController::class)->getStatistics($request);
        });

        Route::get('/sales-performance/export', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesPerformanceController::class)->exportPerformance($request);
        });

        Route::post('/sales-performance/calculate', function (\Illuminate\Http\Request $request) use ($resolveUser) {
            [, $err] = $resolveUser($request); if ($err) return $err;
            return app(\App\Http\Controllers\SaaS\SaasSalesPerformanceController::class)->calculateMetrics($request);
        });
    });
}

// ===== HOTFIX: Endpoints críticos fuera de flags/debug para evitar 404 en entornos locales =====

// Dashboard principal protegido con Firebase Auth (controlador real)
Route::middleware(['firebase.auth'])->get('/dashboard', [\App\Http\Controllers\Api\DashboardController::class, 'getDashboardData']);

 // Verificación de sesión unificada mínima (Firebase o Empleado) + contexto de broker
Route::middleware(['unified.auth', 'global.broker.auth'])->prefix('saas')->group(function () {
    Route::get('me-simple', function (Request $request) {
        // Intentar obtener usuario autenticado (Firebase o Empleado) desde UnifiedAuthMiddleware
        $user = \App\Http\Middleware\UnifiedAuthMiddleware::getAuthenticatedUser($request);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'No autenticado'
            ], 401);
        }

        // Resolver broker actual (inyectado por GlobalBrokerAuth)
        $broker = $request->get('authenticated_broker');

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'nombre' => $user->name ?? ($user->nombres ?? null),
                    'email' => $user->email ?? null,
                    'user_type' => $user->user_type ?? 'EMPLEADO',
                    'broker_id' => $user->broker_id ?? $request->get('broker_id'),
                ],
                'broker' => $broker ? [
                    'id' => $broker->id,
                    'name' => $broker->name,
                    'status' => $broker->status,
                    'plan' => $broker->plan,
                    'trial_ends_at' => optional($broker->trial_ends_at)->toISOString(),
                ] : null,
            ],
            'source' => 'api.php hotfix'
        ]);
    });

    // Alias estándar para obtener contexto SaaS (evita 404 desde frontend)
    Route::get('me', function (Request $request) {
        $user = \App\Http\Middleware\UnifiedAuthMiddleware::getAuthenticatedUser($request);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        }
        $broker = $request->get('authenticated_broker') ?: ($user->getPrimaryBroker() ?? null);

        if (!$broker) {
            return response()->json([
                'success' => false,
                'needs_onboarding' => true,
                'onboarding_step' => 'create_broker',
                'message' => 'Usuario necesita crear un broker',
            ], 403);
        }

        // Compose branding payload with computed URLs to ensure frontend always receives them
        $branding = is_array($broker->branding) ? $broker->branding : [];
        $branding['primary_color'] = $branding['primary_color'] ?? null;
        $branding['logo'] = method_exists($broker, 'getLogoUrl') ? $broker->getLogoUrl() : ($branding['logo'] ?? null);
        $branding['favicon'] = method_exists($broker, 'getFaviconUrl') ? $broker->getFaviconUrl() : ($branding['favicon'] ?? null);

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'nombre' => $user->name ?? ($user->nombres ?? null),
                    'email' => $user->email ?? null,
                    'user_type' => $user->user_type ?? 'EMPLEADO',
                    'broker_id' => $user->broker_id ?? $request->get('broker_id'),
                ],
                'broker' => [
                    'id' => $broker->id,
                    'name' => $broker->name,
                    'status' => $broker->status,
                    'plan' => $broker->plan,
                    'trial_ends_at' => optional($broker->trial_ends_at)->toISOString(),
                    'logo' => $broker->logo,
                    'branding' => $branding,
                ],
            ],
        ]);
    });// Cierre de sesión SaaS (token es manejado por el cliente; aquí solo acuse)
    Route::post('logout', function (Request $request) {
        return response()->json(['success' => true, 'message' => 'Sesión finalizada']);
    });
});

// ===== HOTFIX COMPAT: Endpoints de Dashboard sin prefijo /saas para evitar 404 en UI legacy =====
Route::middleware(['firebase.auth','security.auth','global.broker.auth'])->group(function () {
    // Primas por Mes (alias de /saas/dashboard/primas-chart)
    Route::get('/dashboard/primas-chart', [\App\Http\Controllers\Api\DashboardController::class, 'getPrimasChart']);
    // Aliases de data/metrics usados por versiones anteriores del frontend
    Route::get('/dashboard/data', [\App\Http\Controllers\Api\DashboardController::class, 'getDashboardData']);
    Route::get('/dashboard/metrics', [\App\Http\Controllers\Api\DashboardController::class, 'getMetrics']);
});

# ===== Dashboard SaaS - Endpoints consolidados =====
Route::middleware(['unified.auth','global.broker.auth','saas.auth'])->prefix('saas')->group(function () {
    Route::prefix('dashboard')->group(function () {
        Route::get('/data', [\App\Http\Controllers\Api\DashboardController::class, 'getDashboardData']);
        Route::get('/metrics', [\App\Http\Controllers\Api\DashboardController::class, 'getMetrics']);
        Route::get('/clientes-chart', [\App\Http\Controllers\Api\DashboardController::class, 'getClientesChart']);
        Route::get('/polizas-chart', [\App\Http\Controllers\Api\DashboardController::class, 'getPolizasChart']);
        Route::get('/primas-chart', [\App\Http\Controllers\Api\DashboardController::class, 'getPrimasChart']);
    });
});

# ===== Asistente IA Guro - Chatbot con acceso a BD =====
Route::middleware(['unified.auth','global.broker.auth','saas.auth'])->prefix('saas')->group(function () {
    Route::prefix('assistant')->group(function () {
        Route::post('/query', [\App\Http\Controllers\Api\ChatbotController::class, 'assistant']);
        Route::post('/chat', [\App\Http\Controllers\Api\ChatbotController::class, 'assistant']);
    });
    
    // Soporte - Tickets por email
    Route::post('/support/ticket', [\App\Http\Controllers\Api\ChatbotController::class, 'sendSupportTicket']);
});

// Ruta pública stub para evitar 404 en flujos que intenten login SaaS tradicional
Route::post('/saas/login', function (\Illuminate\Http\Request $request) {
    return response()->json([
        'success' => false,
        'message' => 'Login SaaS no implementado. Use Firebase ID token o EmpleadoAuth.'
    ], 501);
});

// ===== HOTFIX: Endpoints adicionales SaaS (usuarios, auditoría, configuración) =====
Route::middleware(['unified.auth','global.broker.auth'])->prefix('saas')->group(function () {
    // Usuarios (alias de /admin/users para compatibilidad con frontend)
    Route::get('/usuarios', [\App\Http\Controllers\AdminController::class, 'getUsers']);
    Route::post('/usuarios', [\App\Http\Controllers\AdminController::class, 'createUser']);
    Route::put('/usuarios/{id}', [\App\Http\Controllers\AdminController::class, 'updateUser'])->whereNumber('id');
    Route::delete('/usuarios/{id}', [\App\Http\Controllers\AdminController::class, 'deleteUser'])->whereNumber('id');
    Route::put('/usuarios/{id}/permisos', function (int $id) {
        return response()->json(['success' => false, 'message' => 'Gestión de permisos no disponible en este endpoint'], 501);
    })->whereNumber('id');

    // Auditoría
    Route::get('/audit-logs', [\App\Http\Controllers\SaaS\AuditController::class, 'getAuditLogs']);
    Route::post('/audit-logs', [\App\Http\Controllers\SaaS\AuditController::class, 'createAuditLog']);
    Route::get('/audit/logs', [\App\Http\Controllers\SaaS\AuditController::class, 'getAuditLogs']);
    Route::get('/audit/stats', [\App\Http\Controllers\SaaS\AuditController::class, 'getAuditStats']);
    Route::get('/audit/users-dashboard', [\App\Http\Controllers\SaaS\AuditController::class, 'getUsersDashboard']);
    Route::get('/audit/user/{userId}', [\App\Http\Controllers\SaaS\AuditController::class, 'getUserActivity']);
    Route::get('/audit/security-alerts', [\App\Http\Controllers\SaaS\AuditController::class, 'getSecurityAlerts']);
    Route::get('/audit/export', [\App\Http\Controllers\SaaS\AuditController::class, 'exportAuditLogs']);

    // Configuración (proxy a BrokerController settings)
    Route::get('/configuracion', function (\Illuminate\Http\Request $request) {
        return app(\App\Http\Controllers\Api\BrokerController::class)->getSettings($request);
    });
    Route::match(['put','patch'], '/configuracion/{seccion}', function (\Illuminate\Http\Request $request, string $seccion) {
        $request->merge(['section' => $seccion]);
        return app(\App\Http\Controllers\Api\BrokerController::class)->updateSettings($request);
    })->where('seccion', '.*');
});


// ===== HOTFIX: Exponer endpoints mínimos de Clientes y Pólizas para evitar 404 en UI =====
Route::middleware(['unified.auth','global.broker.auth','saas.auth'])->prefix('saas')->group(function () {
    // Clientes
    Route::prefix('clientes')->group(function () {
        Route::get('/', [\App\Http\Controllers\SaaS\SaasClientesController::class, 'index']);
        // Endpoint utilizado por el frontend para cargar todo (sin paginación)
        Route::get('/all', [\App\Http\Controllers\SaaS\SaasClientesController::class, 'all']);
        Route::get('/estadisticas', [\App\Http\Controllers\SaaS\SaasClientesController::class, 'estadisticas']);
        Route::post('/', [\App\Http\Controllers\SaaS\SaasClientesController::class, 'store']);
        Route::get('/{id}', [\App\Http\Controllers\SaaS\SaasClientesController::class, 'show'])->whereNumber('id');
        Route::put('/{id}', [\App\Http\Controllers\SaaS\SaasClientesController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [\App\Http\Controllers\SaaS\SaasClientesController::class, 'destroy'])->whereNumber('id');
        
        // Borrado masivo de clientes
        Route::post('/bulk-delete', [\App\Http\Controllers\SaaS\SaasClientesController::class, 'bulkDelete']);

        // Alias esperado por el frontend: /{id}/asignar
        Route::post('/{id}/asignar', [\App\Http\Controllers\SaaS\SaasClientesController::class, 'asignarAsesor'])->whereNumber('id');
        // Alias previo: /{id}/asignar-asesor (compatibilidad)
        Route::post('/{id}/asignar-asesor', [\App\Http\Controllers\SaaS\SaasClientesController::class, 'asignarAsesor'])->whereNumber('id');

        // Exportación usada por el frontend
        Route::get('exportar/excel', [\App\Http\Controllers\SaaS\SaasClientesController::class, 'exportar']);
        // Documentos de cliente (global y por cliente)
        // Lista global de documentos de todos los clientes del broker (debe ir ANTES de /{id})
        Route::get('/documents', [\App\Http\Controllers\SaaS\ClienteDocumentsController::class, 'indexAll']);
        // Documentos por cliente específico
        Route::get('/{id}/documents', [\App\Http\Controllers\SaaS\ClienteDocumentsController::class, 'index'])->whereNumber('id');
        Route::post('/{id}/documents', [\App\Http\Controllers\SaaS\ClienteDocumentsController::class, 'upload'])->whereNumber('id');
        Route::delete('/{id}/documents', [\App\Http\Controllers\SaaS\ClienteDocumentsController::class, 'destroy'])->whereNumber('id');
        Route::get('/{id}/documents/signed-url', [\App\Http\Controllers\SaaS\ClienteDocumentsController::class, 'signedUrl'])->whereNumber('id');
    });

    // Pólizas
    Route::prefix('polizas')->group(function () {
        // Listado y CRUD (coincide con polizaService.ts)
        Route::get('/', [\App\Http\Controllers\SaaS\SaasPolizasController::class, 'indexDev']);
        Route::get('/cartera', [\App\Http\Controllers\SaaS\SaasPolizasController::class, 'carteraDev']); // OPTIMIZACIÓN: Endpoint específico para cartera
        Route::get('/estadisticas', [\App\Http\Controllers\SaaS\SaasPolizasController::class, 'estadisticasDev']);
        Route::post('/', [\App\Http\Controllers\SaaS\SaasPolizasController::class, 'store']);
        Route::get('/{id}', [\App\Http\Controllers\SaaS\SaasPolizasController::class, 'show'])->whereNumber('id');
        Route::put('/{id}', [\App\Http\Controllers\SaaS\SaasPolizasController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [\App\Http\Controllers\SaaS\SaasPolizasController::class, 'destroy'])->whereNumber('id');
        // Ambos alias soportados por el frontend
        Route::put('/{id}/estado', [\App\Http\Controllers\SaaS\SaasPolizasController::class, 'cambiarEstado'])->whereNumber('id');
        Route::post('/{id}/cambiar-estado', [\App\Http\Controllers\SaaS\SaasPolizasController::class, 'cambiarEstado'])->whereNumber('id');

        // Pagos y cobros
        Route::get('/{id}/pagos', [\App\Http\Controllers\Api\PagoPolizaController::class, 'index'])->whereNumber('id');
        Route::post('/{id}/pagos', [\App\Http\Controllers\Api\PagoPolizaController::class, 'store'])->whereNumber('id');
        Route::delete('/{id}/pagos/{pagoId}', [\App\Http\Controllers\Api\PagoPolizaController::class, 'revertirPago'])->whereNumber('id')->whereNumber('pagoId');
        Route::delete('/{id}/pagos/revertir-oficina', [\App\Http\Controllers\Api\PagoPolizaController::class, 'revertirRecaudosOficina'])->whereNumber('id');
        Route::delete('/{id}/pagos/revertir-completo', [\App\Http\Controllers\Api\PagoPolizaController::class, 'revertirRecaudoCompleto'])->whereNumber('id');
        Route::post('/recaudo-masivo', [\App\Http\Controllers\Api\PagoPolizaController::class, 'recaudoMasivo']);
        Route::post('/recaudo-masivo-csv', [\App\Http\Controllers\Api\PagoPolizaController::class, 'recaudoMasivoCsv']);
        Route::post('/recaudo-por-numero', [\App\Http\Controllers\Api\PagoPolizaController::class, 'recaudoPorNumeroPoliza']);
        
        // Importación masiva de recaudos con registro y reversión
        Route::post('/importar-recaudos', [\App\Http\Controllers\Api\PagoPolizaController::class, 'importarRecaudosMasivo']);
        Route::get('/importaciones', [\App\Http\Controllers\Api\PagoPolizaController::class, 'listarImportaciones']);
        Route::get('/importaciones/{importId}', [\App\Http\Controllers\Api\PagoPolizaController::class, 'detalleImportacion'])->whereNumber('importId');
        Route::delete('/importaciones/{importId}/revertir', [\App\Http\Controllers\Api\PagoPolizaController::class, 'revertirImportacion'])->whereNumber('importId');
        
        Route::post('/{id}/cobrar-comision', [\App\Http\Controllers\Api\PagoPolizaController::class, 'registrarCobroComision'])->whereNumber('id');
        Route::delete('/{id}/cobrar-comision/{cobroId}', [\App\Http\Controllers\Api\PagoPolizaController::class, 'revertirCobroComision'])->whereNumber('id')->whereNumber('cobroId');

        // Documentos de póliza
        // Lista global de documentos de todas las pólizas del broker (debe ir antes de /{id})
        Route::get('/documents', [\App\Http\Controllers\SaaS\PolizaDocumentsController::class, 'indexAll']);
        // Documentos por póliza específica
        Route::get('/{id}/documents', [\App\Http\Controllers\SaaS\PolizaDocumentsController::class, 'index'])->whereNumber('id');
        Route::post('/{id}/documents', [\App\Http\Controllers\SaaS\PolizaDocumentsController::class, 'upload'])->whereNumber('id');
        Route::delete('/{id}/documents', [\App\Http\Controllers\SaaS\PolizaDocumentsController::class, 'destroy'])->whereNumber('id');
        Route::get('/{id}/documents/signed-url', [\App\Http\Controllers\SaaS\PolizaDocumentsController::class, 'signedUrl'])->whereNumber('id');

        // Anexos
        Route::get('/{id}/anexos', [\App\Http\Controllers\SaaS\AnexosController::class, 'index'])->whereNumber('id');
        Route::post('/{id}/anexos', [\App\Http\Controllers\SaaS\AnexosController::class, 'store'])->whereNumber('id');
        Route::put('/{id}/anexos/{anexoId}', [\App\Http\Controllers\SaaS\AnexosController::class, 'update'])->where(['id' => '[0-9]+', 'anexoId' => '[0-9]+']);
        Route::delete('/{id}/anexos/{anexoId}', [\App\Http\Controllers\SaaS\AnexosController::class, 'destroy'])->where(['id' => '[0-9]+', 'anexoId' => '[0-9]+']);
    });

    // Estadísticas de pagos
    Route::get('/pagos/estadisticas', [\App\Http\Controllers\Api\PagoPolizaController::class, 'estadisticas']);
});

// Pagos de aseguradora individuales (para tab Recaudos Completados)
Route::middleware(['unified.auth','global.broker.auth','saas.auth'])->prefix('saas')->group(function () {
    Route::get('/pagos/aseguradora', [\App\Http\Controllers\Api\PagoPolizaController::class, 'listarPagosAseguradora']);
    Route::delete('/pagos/aseguradora/{pagoId}', [\App\Http\Controllers\Api\PagoPolizaController::class, 'revertirPagoAseguradora'])->whereNumber('pagoId');
});

// Siniestros - Documentos (alineado con siniestroDocumentsService)
Route::middleware(['unified.auth','global.broker.auth','saas.auth'])->prefix('saas')->group(function () {
    Route::prefix('siniestros')->group(function () {
        // Lista global de documentos de todos los siniestros del broker
        Route::get('/documents', [\App\Http\Controllers\SaaS\SiniestroDocumentsController::class, 'indexAll']);
        // Documentos por siniestro específico
        Route::get('/{id}/documents', [\App\Http\Controllers\SaaS\SiniestroDocumentsController::class, 'index'])->whereNumber('id');
        Route::post('/{id}/documents', [\App\Http\Controllers\SaaS\SiniestroDocumentsController::class, 'upload'])->whereNumber('id');
        Route::delete('/{id}/documents', [\App\Http\Controllers\SaaS\SiniestroDocumentsController::class, 'destroy'])->whereNumber('id');
        Route::get('/{id}/documents/signed-url', [\App\Http\Controllers\SaaS\SiniestroDocumentsController::class, 'signedUrl'])->whereNumber('id');
    });
    // Documentos Internos (sin asociación a entidades)
    Route::prefix('internal-documents')->group(function () {
        Route::get('/', [\App\Http\Controllers\SaaS\InternalDocumentsController::class, 'index']);
        Route::post('/', [\App\Http\Controllers\SaaS\InternalDocumentsController::class, 'upload']);
        Route::delete('/', [\App\Http\Controllers\SaaS\InternalDocumentsController::class, 'destroy']);
        Route::get('/signed-url', [\App\Http\Controllers\SaaS\InternalDocumentsController::class, 'signedUrl']);
    });


    // =============================
    // RUTAS DE PLANTILLAS DE CAMPAÑAS (EMAIL ONLY) - HOTFIX
    // =============================
    Route::prefix('campaign-templates')->group(function () {
        Route::get('/', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'index']);
        Route::post('/', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'store']);
        Route::get('/categories', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'categories']);
        Route::get('/{id}', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'show'])->whereNumber('id');
        Route::put('/{id}', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'update'])->whereNumber('id');
        Route::delete('/{id}', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'destroy'])->whereNumber('id');
        Route::post('/{id}/duplicate', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'duplicate'])->whereNumber('id');
        Route::post('/{id}/preview', [\App\Http\Controllers\SaaS\CampaignTemplatesController::class, 'preview'])->whereNumber('id');
    });

    // =============================
    // RUTAS DE CAMPAÑAS DE EMAIL (audiencias solo desde clientes) - HOTFIX
    // =============================
    Route::prefix('email-campaigns')->group(function () {
        Route::get('/', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'index']);
        Route::post('/', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'store']);
        Route::post('/uploads', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'uploadCsv']);
        Route::post('/bulk-delete', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'bulkDelete']);
        Route::get('/{id}', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'show'])->whereNumber('id');
        Route::post('/{id}/start', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'start'])->whereNumber('id');
        Route::get('/{id}/status', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'status'])->whereNumber('id');
        Route::get('/{id}/recipients', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'recipients'])->whereNumber('id');
        Route::delete('/{id}', [\App\Http\Controllers\SaaS\EmailCampaignsController::class, 'destroy'])->whereNumber('id');
    });
    // =============================
    // RUTAS DE NOTIFICACIONES DE PÓLIZAS
    // =============================
    Route::prefix('policy-notifications')->group(function () {
        Route::get('/config', [\App\Http\Controllers\Api\PolicyNotificationController::class, 'getConfig']);
        Route::put('/config', [\App\Http\Controllers\Api\PolicyNotificationController::class, 'updateConfig']);
        Route::get('/logs', [\App\Http\Controllers\Api\PolicyNotificationController::class, 'getLogs']);
        Route::get('/stats', [\App\Http\Controllers\Api\PolicyNotificationController::class, 'getStats']);
        Route::get('/pending-policies', [\App\Http\Controllers\Api\PolicyNotificationController::class, 'getPendingPolicies']);
        Route::get('/scheduled', [\App\Http\Controllers\Api\PolicyNotificationController::class, 'getScheduledNotifications']);
        Route::post('/skip', [\App\Http\Controllers\Api\PolicyNotificationController::class, 'skipNotification']);
        Route::post('/test', [\App\Http\Controllers\Api\PolicyNotificationController::class, 'testNotification']);
    });

});

// ===== HOTFIX: Importación de clientes (compatibilidad con frontend) =====
Route::middleware(['unified.auth','global.broker.auth','saas.auth'])->prefix('saas')->group(function () {
    Route::post('/clientes/importar', [\App\Http\Controllers\SaaS\SaasClientesController::class, 'importar']);
});

// ===== HOTFIX: Tenants (compatibilidad con frontend) =====
Route::middleware(['security.auth','global.broker.auth'])->prefix('saas/tenants')->group(function () {
    Route::get('/{id}', function (Request $request, $id) {
        // Obtener usuario autenticado por unified.auth o firebase.auth
        $user = \App\Http\Middleware\UnifiedAuthMiddleware::getAuthenticatedUser($request) ?: $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        }

        // Resolver broker actual desde middleware GlobalBrokerAuth o fallback
        $broker = $request->get('authenticated_broker') ?? ($user && method_exists($user, 'getPrimaryBroker') ? $user->getPrimaryBroker() : null);
        if (!$broker) {
            return response()->json(['success' => false, 'message' => 'Broker no resuelto'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $broker->id,
                'name' => $broker->name,
                'status' => $broker->status,
                'plan' => $broker->plan,
                'trial_ends_at' => optional($broker->trial_ends_at)->toISOString(),
                'branding' => [
                    'logo' => method_exists($broker, 'getLogoUrl') ? $broker->getLogoUrl() : null,
                ],
            ]
        ]);
    })->whereNumber('id');

    // Stubs 501 para evitar 404 hasta implementar actualización de tenant/branding
    Route::match(['put','patch'], '/{id}', function () {
        return response()->json(['success' => false, 'message' => 'Actualizar tenant no implementado en este endpoint'], 501);
    })->whereNumber('id');

    Route::match(['put','patch'], '/{id}/branding', function () {
        return response()->json(['success' => false, 'message' => 'Actualizar branding no implementado en este endpoint'], 501);
    })->whereNumber('id');
});

// ===== Webhook n8n Email Status (protegido por Bearer) =====
 // ===== Webhook SendGrid events =====
 Route::post('/webhooks/sendgrid/events', [\App\Http\Controllers\Api\SendgridWebhookController::class, 'handle']);

// === Global Search endpoint (unificado) ===
// Se agrega como HOTFIX al final para evitar conflictos de orden con otros grupos.
// Protegido con unified.auth + global.broker.auth + saas.auth, bajo prefijo /saas
Route::middleware(['unified.auth','global.broker.auth','saas.auth'])->prefix('saas')->group(function () {
    Route::get('/search', [\App\Http\Controllers\Api\GlobalSearchController::class, 'index']);
    
    // Información de Agencia (Broker)
    Route::get('/informacion-agencia', [\App\Http\Controllers\SaaS\InformacionAgenciaController::class, 'show']);
    Route::put('/informacion-agencia', [\App\Http\Controllers\SaaS\InformacionAgenciaController::class, 'update']);
    Route::post('/informacion-agencia/branding', [\App\Http\Controllers\SaaS\InformacionAgenciaController::class, 'uploadBranding']);

    // Ventas Cruzadas
    Route::prefix('ventas-cruzadas')->group(function () {
        Route::get('/', [\App\Http\Controllers\SaaS\VentasCruzadasController::class, 'getOportunidades']);
        Route::get('/estadisticas', [\App\Http\Controllers\SaaS\VentasCruzadasController::class, 'getEstadisticas']);
        Route::post('/forzar-reanalisis', [\App\Http\Controllers\SaaS\VentasCruzadasController::class, 'forzarReanalisis']);
        Route::post('/{oportunidadId}/ejecutar-accion', [\App\Http\Controllers\SaaS\VentasCruzadasController::class, 'ejecutarAccion']);
    });
});