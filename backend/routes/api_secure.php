<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\SaaS\OnboardingController;
use App\Http\Controllers\SaaS\SaasClientesController;
use App\Http\Controllers\SaaS\SaasPolizasController;
use App\Http\Controllers\SaaS\PolizaDocumentsController;
use App\Http\Controllers\SaaS\AutomovilesController;
use App\Http\Controllers\SaaS\EmpleadosController;
use App\Http\Controllers\SaaS\SaasCommercialTasksController;
use App\Http\Controllers\SaaS\SaasSalesFunnelController;
use App\Http\Controllers\SaaS\SaasSiniestroController;
use App\Http\Controllers\SaaS\SiniestroDocumentsController;
use App\Http\Controllers\SaaS\AuditLogsController;
use App\Http\Controllers\SaaS\InformacionAgenciaController;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\CampaignController;
use App\Http\Controllers\SaaS\CampaignTemplatesController;
use App\Http\Controllers\SaaS\EmailCampaignsController;
use App\Http\Controllers\SaaS\NotificationController;

// Enforce numeric-only route parameters to prevent static path collisions (e.g., "available-whatsapp-instances")
Route::pattern('id', '[0-9]+');
Route::pattern('campaign', '[0-9]+');

/*
|--------------------------------------------------------------------------
| API Routes - SECURE VERSION
|--------------------------------------------------------------------------
|
| Versión segura de las rutas API con protección adecuada y sin rutas de debug.
| Esta versión está lista para producción.
|
*/

// Ruta de salud pública (sin información sensible)
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now()->toISOString(),
    ]);
});

// Webhook público de SendGrid (eventos de email)
// Nota: Protege opcionalmente con Authorization: Bearer SENDGRID_WEBHOOK_TOKEN si defines la env.
Route::post('/webhooks/sendgrid/events', [\App\Http\Controllers\Api\SendgridWebhookController::class, 'handle']);

// =============================================================================
// RUTAS PÚBLICAS DE AUTENTICACIÓN
// =============================================================================

Route::prefix('auth')->group(function () {
    // Autenticación básica (sin middleware)
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
    Route::post('/two-steps/send', [AuthController::class, 'sendTwoStepCode']);
    Route::post('/two-steps/verify', [AuthController::class, 'verifyTwoStepCode']);
    Route::post('/email/send-verification', [AuthController::class, 'sendEmailVerification']);
    Route::post('/email/verify', [AuthController::class, 'verifyEmail']);
});

// Autenticación de empleados (sin middleware)
Route::prefix('empleado-auth')->group(function () {
    Route::post('/login', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'login']);
    Route::post('/verificar', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'verificarEmpleado']);
    
    // Rutas protegidas de empleados
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::post('/logout', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'logout']);
        Route::post('/cambiar-password', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'cambiarPassword']);
        Route::get('/perfil', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'perfil']);
        Route::post('/validar-token', [App\Http\Controllers\SaaS\EmpleadoAuthController::class, 'validarToken']);
    });
});

// =============================================================================
// RUTAS PROTEGIDAS CON FIREBASE AUTH
// =============================================================================

Route::middleware(['firebase.auth', 'throttle:api', 'clamp.pagination'])->group(function () {
    
    // Rutas de perfil y autenticación
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/profile', [AuthController::class, 'getProfile']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::post('/sync-firebase-user', [AuthController::class, 'syncFirebaseUser']);
    });
    
    // Dashboard básico
    Route::get('/dashboard', function (Request $request) {
        $user = $request->user();
        
        // Log de acceso para debugging
        \Illuminate\Support\Facades\Log::info('🔧 [DEBUG] Acceso al dashboard', [
            'user_id' => $user->id,
            'user_name' => $user->name,
            'user_email' => $user->email,
            'user_type' => $user->user_type,
            'broker_id' => $user->broker_id,
            'firebase_uid' => $user->firebase_uid,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'timestamp' => now()->toISOString(),
            'has_primary_broker' => $user->getPrimaryBroker() !== null,
        ]);
        
        $broker = $user->getPrimaryBroker();
        $needsOnboarding = !$broker;
        
        $response = [
            'success' => true,
            'message' => '¡Bienvenido al dashboard!',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'firebase_uid' => $user->firebase_uid,
                'email_verified' => !is_null($user->email_verified_at),
                'user_type' => $user->user_type,
                'broker_id' => $user->broker_id,
            ],
            'broker' => $broker ? [
                'id' => $broker->id,
                'name' => $broker->name,
                'status' => $broker->status,
                'legal_name' => $broker->legal_name,
            ] : null,
            'needs_onboarding' => $needsOnboarding,
            'server_time' => now()->toISOString(),
        ];
        
        \Illuminate\Support\Facades\Log::info('🔧 [DEBUG] Respuesta del dashboard', [
            'has_broker' => $broker !== null,
            'broker_id' => $broker ? $broker->id : null,
            'needs_onboarding' => $needsOnboarding,
        ]);
        
        return response()->json($response);
    });
    
    // Verificación de estado SaaS - RUTA ELIMINADA PARA EVITAR CONFLICTO
    // Route::get('/saas/me', [AuthController::class, 'me']); // COMENTADO - CONFLICTO CON /saas/me-simple
    Route::post('/saas/onboarding/create-broker', [AuthController::class, 'createBroker']);
});

// =============================================================================
// RUTAS SAAS: ONBOARDING (SOLO REQUIERE FIREBASE AUTH, SIN BROKER)
// =============================================================================

Route::middleware(['firebase.auth', 'throttle:api', 'clamp.pagination'])->prefix('saas')->group(function () {
    // Onboarding: crear broker sin requerir broker_id aún
    Route::post('onboarding/create-broker', [OnboardingController::class, 'createBrokerWithFirebase']);
});

// =============================================================================
// RUTAS SAAS PROTEGIDAS (FIREBASE + BROKER CONTEXT)
// =============================================================================

Route::middleware(['unified.auth', 'global.broker.auth', 'throttle:api', 'clamp.pagination'])->prefix('saas')->group(function () {
    
    // Ruta de verificación de usuario autenticado
    Route::get('me-simple', function(Request $request) {
        \Log::info('🎯 API_SECURE - RUTA EJECUTANDOSE - middleware ejecutado');
        
        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'No autenticado'
            ], 401);
        }
        
        $broker = $user->getPrimaryBroker();
        $needsOnboarding = !$broker;

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'nombre' => $user->name,
                    'email' => $user->email,
                    'user_type' => $user->user_type,
                    'broker_id' => $user->broker_id,
                ],
                'broker' => $broker ? [
                    'id' => $broker->id,
                    'name' => $broker->name,
                    'status' => $broker->status,
                    'plan' => $broker->plan,
                    'trial_ends_at' => optional($broker->trial_ends_at)->toISOString(),
                ] : null,
                'needs_onboarding' => $needsOnboarding,
            ],
            'source' => 'api_secure.php'
        ]);
    });
    
    // Onboarding (mantenido arriba sin broker context)
    
    // Rutas SaaS protegidas (permisos, etc.)
    Route::middleware(['saas.auth'])->group(function () {
            // Dashboard - primas por periodo
            Route::get('dashboard/primas-chart', [DashboardController::class, 'getPrimasChart']);
        
        // Clientes
        Route::prefix('clientes')->group(function () {
            Route::get('/', [SaasClientesController::class, 'index']);
            Route::post('/', [SaasClientesController::class, 'store']);
            Route::get('/{cliente}', [SaasClientesController::class, 'show']);
            Route::put('/{cliente}', [SaasClientesController::class, 'update']);
            Route::delete('/{cliente}', [SaasClientesController::class, 'destroy']);
            Route::post('/{cliente}/asignar-asesor', [SaasClientesController::class, 'asignarAsesor']);
            Route::get('/exportar/excel', [SaasClientesController::class, 'exportar']);
        });
        
        // Empleados
        Route::prefix('empleados')->group(function () {
            Route::get('/', [EmpleadosController::class, 'index']);
            Route::post('/', [EmpleadosController::class, 'store']);
            Route::get('/{empleado}', [EmpleadosController::class, 'show']);
            Route::put('/{empleado}', [EmpleadosController::class, 'update']);
            Route::delete('/{empleado}', [EmpleadosController::class, 'destroy']);
        });
        
        // Pólizas
        Route::prefix('polizas')->group(function () {
            Route::get('/', [SaasPolizasController::class, 'index']);
            Route::post('/', [SaasPolizasController::class, 'store']);
            Route::get('/estadisticas', [SaasPolizasController::class, 'estadisticas']);

            // Reconciliar placas para pólizas existentes (backfill/mapeo de placas desde Automóviles)
            Route::post('/reconciliar-placas', [SaasPolizasController::class, 'reconciliarPlacas']);

            Route::get('/{id}', [SaasPolizasController::class, 'show']);
            Route::put('/{id}', [SaasPolizasController::class, 'update']);
            Route::delete('/{id}', [SaasPolizasController::class, 'destroy']);
            Route::put('/{id}/estado', [SaasPolizasController::class, 'cambiarEstado']);
            // Documentos globales de pólizas
            Route::get('/documents', [PolizaDocumentsController::class, 'indexAll']);
            // Documentos de póliza (auth)
            Route::get('/{id}/documents', [PolizaDocumentsController::class, 'index']);
            Route::post('/{id}/documents', [PolizaDocumentsController::class, 'upload']);
            Route::delete('/{id}/documents', [PolizaDocumentsController::class, 'destroy']);
            Route::get('/{id}/documents/signed-url', [PolizaDocumentsController::class, 'signedUrl']);
        });

        // Automóviles (SaaS protegido)
        // Ruta explícita para catálogos (evitar colisión con /{id})
        Route::get('automoviles/catalogos', [AutomovilesController::class, 'catalogos']);
        Route::prefix('automoviles')->group(function () {
            Route::get('/', [AutomovilesController::class, 'index']);
            Route::post('/', [AutomovilesController::class, 'store']);
            Route::get('/{id}', [AutomovilesController::class, 'show']);
            Route::put('/{id}', [AutomovilesController::class, 'update']);
            Route::delete('/{id}', [AutomovilesController::class, 'destroy']);
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
        
        // Tareas comerciales
        Route::prefix('commercial-tasks')->group(function () {
            Route::get('/', [SaasCommercialTasksController::class, 'index']);
            Route::post('/', [SaasCommercialTasksController::class, 'store']);
            Route::get('/statistics', [SaasCommercialTasksController::class, 'statistics']);
            Route::get('/{task}', [SaasCommercialTasksController::class, 'show']);
            Route::put('/{task}', [SaasCommercialTasksController::class, 'update']);
            Route::delete('/{task}', [SaasCommercialTasksController::class, 'destroy']);
        });
        
        // Siniestros
        Route::prefix('siniestros')->group(function () {
            // CRUD básico
            Route::get('/', [SaasSiniestroController::class, 'index'])->middleware('saas.auth:siniestros.ver');
            Route::post('/', [SaasSiniestroController::class, 'store'])->middleware('saas.auth:siniestros.crear');
            Route::get('/statistics', [SaasSiniestroController::class, 'statistics'])->middleware('saas.auth:siniestros.ver');
            Route::get('/{siniestro}', [SaasSiniestroController::class, 'show'])->middleware('saas.auth:siniestros.ver');
            Route::put('/{siniestro}', [SaasSiniestroController::class, 'update'])->middleware('saas.auth:siniestros.editar');
            Route::delete('/{siniestro}', [SaasSiniestroController::class, 'destroy'])->middleware('saas.auth:siniestros.eliminar');

            // Endpoints adicionales (alineados al frontend)
            Route::get('/needing-attention', [SaasSiniestroController::class, 'needingAttention'])->middleware('saas.auth:siniestros.ver');
            Route::post('/{id}/change-state', [SaasSiniestroController::class, 'changeState'])->middleware('saas.auth:siniestros.procesar');
            Route::post('/{id}/assign-adjuster', [SaasSiniestroController::class, 'assignAdjuster'])->middleware('saas.auth:siniestros.editar');
            Route::post('/{id}/approve', [SaasSiniestroController::class, 'approve'])->middleware('saas.auth:siniestros.procesar');
            Route::post('/{id}/reject', [SaasSiniestroController::class, 'reject'])->middleware('saas.auth:siniestros.procesar');
            Route::post('/{id}/pay', [SaasSiniestroController::class, 'pay'])->middleware('saas.auth:siniestros.procesar');
            Route::post('/{id}/reopen', [SaasSiniestroController::class, 'reopen'])->middleware('saas.auth:siniestros.editar');
            Route::post('/{id}/close', [SaasSiniestroController::class, 'close'])->middleware('saas.auth:siniestros.cerrar');
            Route::post('/{id}/add-communication', [SaasSiniestroController::class, 'addCommunication'])->middleware('saas.auth:siniestros.editar');
            Route::post('/{id}/add-observation', [SaasSiniestroController::class, 'addObservation'])->middleware('saas.auth:siniestros.editar');

            // Auxiliares
            Route::get('/adjusters', [SaasSiniestroController::class, 'getAvailableAdjusters'])->middleware('saas.auth:siniestros.ver');
            Route::get('/constants', [SaasSiniestroController::class, 'getConstants']);
            Route::get('/exportar', [SaasSiniestroController::class, 'exportarSiniestros'])->middleware('saas.auth:siniestros.ver');

            // Documentos de siniestro
            Route::get('/documents', [SiniestroDocumentsController::class, 'indexAll'])->middleware('saas.auth:siniestros.ver');
            Route::get('/{id}/documents', [SiniestroDocumentsController::class, 'index'])->middleware('saas.auth:siniestros.ver');
            Route::post('/{id}/documents', [SiniestroDocumentsController::class, 'upload'])->middleware('saas.auth:siniestros.editar');
            Route::delete('/{id}/documents', [SiniestroDocumentsController::class, 'destroy'])->middleware('saas.auth:siniestros.editar');
            Route::get('/{id}/documents/signed-url', [SiniestroDocumentsController::class, 'signedUrl'])->middleware('saas.auth:siniestros.ver');
        });
        
        // Sales Funnel
        Route::prefix('sales-funnel')->group(function () {
            Route::get('/', [SaasSalesFunnelController::class, 'index']);
            Route::post('/', [SaasSalesFunnelController::class, 'store']);
            Route::get('/statistics', [SaasSalesFunnelController::class, 'statistics']);
            Route::get('/{lead}', [SaasSalesFunnelController::class, 'show']);
            Route::put('/{lead}', [SaasSalesFunnelController::class, 'update']);
            Route::delete('/{lead}', [SaasSalesFunnelController::class, 'destroy']);
        });

        // Campañas de WhatsApp
        Route::prefix('campaigns')->group(function () {
            Route::get('/', [CampaignController::class, 'index']);
            Route::post('/', [CampaignController::class, 'createImmediate']);
            Route::post('/immediate', [CampaignController::class, 'createImmediate']);
            Route::post('/scheduled', [CampaignController::class, 'createScheduled']);
            Route::post('/policy-based', [CampaignController::class, 'createPolicyBased']);
            Route::get('/stats', [CampaignController::class, 'getStats']);
            Route::get('/available-whatsapp-instances', [CampaignController::class, 'getAvailableWhatsAppInstances']);
            Route::get('/send-history', [CampaignController::class, 'getSendHistory']);
            // Subida de media para campañas (multipart/form-data: media)
            Route::post('/media-upload', [CampaignController::class, 'uploadMedia']);
            Route::get('/{id}', [CampaignController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [CampaignController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [CampaignController::class, 'destroy'])->whereNumber('id');
            Route::post('/{id}/execute', [CampaignController::class, 'executeCampaign'])->whereNumber('id');
            Route::post('/{id}/toggle', [CampaignController::class, 'toggle'])->whereNumber('id');
            Route::post('/{id}/activate', [CampaignController::class, 'activate'])->whereNumber('id');
            Route::post('/{id}/execute-now', [CampaignController::class, 'executeNow'])->whereNumber('id');
            Route::get('/{id}/executions', [CampaignController::class, 'getExecutions'])->whereNumber('id');
            Route::post('/test-call', [CampaignController::class, 'testCall']);
        });
        
        // Alias estable para lista de instancias disponibles (evita colisión con /campaigns/{id})
        // Nuevo endpoint: GET /api/saas/whatsapp/available-instances
        Route::get('/whatsapp/available-instances', [\App\Http\Controllers\Api\CampaignController::class, 'getAvailableWhatsAppInstances']);

        // Instancias de WhatsApp
        Route::prefix('whatsapp-instances')->group(function () {
            Route::get('/', [App\Http\Controllers\Api\WhatsAppInstanceController::class, 'index']);
            Route::post('/', [App\Http\Controllers\Api\WhatsAppInstanceController::class, 'store']);
            Route::get('/{whatsAppInstance}', [App\Http\Controllers\Api\WhatsAppInstanceController::class, 'show']);
            Route::put('/{whatsAppInstance}', [App\Http\Controllers\Api\WhatsAppInstanceController::class, 'update']);
            Route::delete('/{whatsAppInstance}', [App\Http\Controllers\Api\WhatsAppInstanceController::class, 'destroy']);
            Route::get('/{whatsAppInstance}/qr', [App\Http\Controllers\Api\WhatsAppInstanceController::class, 'getQrCode']);
            Route::get('/{whatsAppInstance}/status', [App\Http\Controllers\Api\WhatsAppInstanceController::class, 'getStatus']);
            Route::post('/{whatsAppInstance}/restart', [App\Http\Controllers\Api\WhatsAppInstanceController::class, 'restart']);
            Route::post('/{whatsAppInstance}/disconnect', [App\Http\Controllers\Api\WhatsAppInstanceController::class, 'disconnect']);
            Route::post('/refresh-all-statuses', [App\Http\Controllers\Api\WhatsAppInstanceController::class, 'refreshAllStatuses']);
        });
        
        // =============================
        // RUTAS DE PLANTILLAS DE CAMPAÑAS (EMAIL ONLY)
        // =============================
        Route::prefix('campaign-templates')->group(function () {
            Route::get('/', [CampaignTemplatesController::class, 'index']);
            Route::post('/', [CampaignTemplatesController::class, 'store']);
            Route::get('/categories', [CampaignTemplatesController::class, 'categories']);
            Route::get('/{id}', [CampaignTemplatesController::class, 'show'])->whereNumber('id');
            Route::put('/{id}', [CampaignTemplatesController::class, 'update'])->whereNumber('id');
            Route::delete('/{id}', [CampaignTemplatesController::class, 'destroy'])->whereNumber('id');
            Route::post('/{id}/duplicate', [CampaignTemplatesController::class, 'duplicate'])->whereNumber('id');
            Route::post('/{id}/preview', [CampaignTemplatesController::class, 'preview'])->whereNumber('id');
        });

        // =============================
        // RUTAS DE CAMPAÑAS DE EMAIL (audiencias solo desde clientes)
        // =============================
        Route::prefix('email-campaigns')->group(function () {
            Route::get('/', [EmailCampaignsController::class, 'index']);
            Route::post('/', [EmailCampaignsController::class, 'store']);
            Route::post('/uploads', [EmailCampaignsController::class, 'uploadCsv']);
            Route::get('/{id}', [EmailCampaignsController::class, 'show'])->whereNumber('id');
            Route::post('/{id}/start', [EmailCampaignsController::class, 'start'])->whereNumber('id');
            Route::get('/{id}/status', [EmailCampaignsController::class, 'status'])->whereNumber('id');
            Route::get('/{id}/recipients', [EmailCampaignsController::class, 'recipients'])->whereNumber('id');
        });

        // =============================
        // NOTIFICACIONES (stub para evitar 404 en UI)
        // =============================
        Route::get('notifications', function (Request $request) {
            $perPage = (int) ($request->query('per_page', 50));
            return response()->json([
                'success' => true,
                'data' => [],
                'pagination' => [
                    'current_page' => 1,
                    'per_page' => $perPage,
                    'total' => 0,
                    'last_page' => 1,
                ],
            ]);
        });

        // Catálogos de solo lectura (para usuarios no admin)
        Route::get('catalogos/aseguradoras', [App\Http\Controllers\SaaS\AseguradorasController::class, 'index']);
        Route::get('catalogos/ramos', [App\Http\Controllers\SaaS\RamosController::class, 'index']);
        Route::get('catalogos/sedes', [App\Http\Controllers\SaaS\SedesController::class, 'index']);
        Route::get('catalogos/vendedores', [App\Http\Controllers\SaaS\VendedoresController::class, 'index']);

        // CRUD de configuración (protegido con permisos)
        Route::middleware(['saas.permission:admin'])->group(function () {
            
            // Tipos de Afiliación
            Route::apiResource('tipos-afiliacion', App\Http\Controllers\SaaS\TiposAfiliacionController::class);
            
            // Coberturas
            Route::apiResource('coberturas', App\Http\Controllers\SaaS\CoberturasController::class);
            
            // Estados de Siniestros
            Route::apiResource('estados-siniestros', App\Http\Controllers\SaaS\EstadosSiniestrosController::class);
            
            // Sedes
            Route::apiResource('sedes', App\Http\Controllers\SaaS\SedesController::class);
            
            // Aseguradoras
            Route::apiResource('aseguradoras', App\Http\Controllers\SaaS\AseguradorasController::class);
            
            // Vendedores
            Route::apiResource('vendedores', App\Http\Controllers\SaaS\VendedoresController::class);
            
            // Ramos
            Route::apiResource('ramos', App\Http\Controllers\SaaS\RamosController::class);
            Route::get('ramos/categorias', [App\Http\Controllers\SaaS\RamosController::class, 'categorias']);
            
            // Mensajeros
            Route::apiResource('mensajeros', App\Http\Controllers\SaaS\MensajerosController::class);
            Route::get('mensajeros/vehiculos', [App\Http\Controllers\SaaS\MensajerosController::class, 'vehiculos']);
            
            // Roles
            Route::apiResource('roles', App\Http\Controllers\SaaS\RolesBrokerController::class);
            Route::get('roles/permisos', [App\Http\Controllers\SaaS\RolesBrokerController::class, 'permisos']);
            
            // Empleados del broker
            Route::apiResource('empleados-broker', App\Http\Controllers\SaaS\EmpleadosBrokerController::class);
            Route::get('empleados-broker/estados', [App\Http\Controllers\SaaS\EmpleadosBrokerController::class, 'estados']);

            // Información de Agencia (Broker)
            Route::get('informacion-agencia', [InformacionAgenciaController::class, 'show']);
            Route::put('informacion-agencia', [InformacionAgenciaController::class, 'update']);
            Route::post('informacion-agencia/branding', [InformacionAgenciaController::class, 'uploadBranding']);

            // Auditoría de accesos
            Route::get('audit-logs', [AuditLogsController::class, 'index']);
            Route::post('audit-logs', [AuditLogsController::class, 'store']);
        });

        // Wallet - recarga por Wompi
        Route::prefix('wallet')->group(function () {
            Route::get('/balance', [WalletController::class, 'getBalance']);
            Route::get('/transactions', [WalletController::class, 'getTransactionHistory']);
            Route::post('/checkout/wompi', [WalletController::class, 'wompiCheckout']);
        });
    });
});

// =============================================================================
// RUTAS DE ADMINISTRACIÓN (SOLO PARA USUARIOS ADMIN)
// =============================================================================

Route::middleware(['firebase.auth', 'admin.only', 'throttle:api'])->prefix('admin')->group(function () {
    Route::get('/stats', [AdminController::class, 'getStats']);
    Route::get('/users', [AdminController::class, 'getUsers']);
    Route::post('/users', [AdminController::class, 'createUser']);
    Route::put('/users/{id}', [AdminController::class, 'updateUser']);
    Route::delete('/users/{id}', [AdminController::class, 'deleteUser']);
    Route::get('/roles', [AdminController::class, 'getRoles']);
    Route::get('/companies', [AdminController::class, 'getCompanies']);
});

// =============================================================================
// MANEJO DE ERRORES PARA RUTAS NO ENCONTRADAS
// =============================================================================

Route::fallback(function () {
    return response()->json([
        'success' => false,
        'message' => 'Endpoint no encontrado',
        'error' => 'NOT_FOUND'
    ], 404);
});

// Webhook público de Wompi (usar verificación de firma)
Route::post('/wompi/webhook', [WalletController::class, 'wompiWebhook']);
