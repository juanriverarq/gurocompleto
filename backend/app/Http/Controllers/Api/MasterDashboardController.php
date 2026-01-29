<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Broker;
use App\Models\User;
use App\Models\Cliente;
use App\Models\Poliza;
use App\Models\Siniestro;
use App\Models\Campaign;
use App\Models\VoiceCampaign;
use App\Models\EmailCampaign;
use App\Models\Chatbot;
use App\Models\WhatsAppInstance;
use App\Models\Wallet;
use App\Models\Subscription;
use App\Models\PaymentSession;
use App\Models\WalletTransaction;
use App\Models\EmpleadoBroker;
use App\Models\VoiceCampaignCall;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

class MasterDashboardController extends Controller
{
    /**
     * Obtener todas las estadísticas globales para el panel master
     */
    public function getGlobalStats(Request $request)
    {
        try {
            $user = $request->user();
            
            // Verificar que sea usuario SUPERADMIN (role=superadmin)
            if (!$user || $user->role !== 'superadmin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Acceso denegado. Solo usuarios SUPERADMIN pueden acceder.'
                ], 403);
            }

            // ========== BROKERS ==========
            $totalBrokers = Broker::count();
            $brokersActivos = Broker::where('status', 'active')->count();
            $brokersInactivos = Broker::where('status', '!=', 'active')->count();
            $brokersPorPlan = Broker::selectRaw('COALESCE(plan, "basic") as plan, COUNT(*) as total')
                ->groupBy(DB::raw('COALESCE(plan, "basic")'))
                ->pluck('total', 'plan')
                ->toArray();

            // ========== USUARIOS ==========
            $totalUsuarios = User::count();
            $usuariosActivos = User::where('status', 'active')->count();
            $usuariosMasters = User::where('user_type', 'MASTER')->count();
            $usuariosAdmins = User::where('user_type', 'ADMIN')->count();
            $totalEmpleados = EmpleadoBroker::count();
            $empleadosActivos = EmpleadoBroker::where('estado', 'activo')->count();

            // ========== PÓLIZAS GLOBALES ==========
            $totalPolizas = Poliza::count();
            $polizasActivas = Poliza::where('status', 'active')->count();
            $valorTotalPrimas = Poliza::where('status', 'active')->sum('premium_amount') ?? 0;
            $valorTotalComisiones = Poliza::where('status', 'active')->sum('commission_amount') ?? 0;

            // ========== CLIENTES GLOBALES ==========
            $totalClientes = Cliente::count();
            $clientesActivos = Cliente::where('status', 'active')->count();

            // ========== SINIESTROS GLOBALES ==========
            $totalSiniestros = Siniestro::count();
            $siniestrosPendientes = Siniestro::whereIn('estado', ['reportado', 'en_revision', 'asignado', 'investigacion', 'peritaje'])->count();

            // ========== CAMPAÑAS Y AUTOMATIZACIÓN ==========
            $totalCampanasWhatsApp = Campaign::count();
            $campanasWhatsAppActivas = Campaign::where('status', 'active')->count();
            
            $totalCampanasVoz = VoiceCampaign::count();
            $campanasVozActivas = VoiceCampaign::where('status', 'active')->count();
            
            $totalCampanasEmail = EmailCampaign::count();
            $campanasEmailActivas = EmailCampaign::where('status', 'active')->count();
            
            $totalChatbots = Chatbot::count();
            $chatbotsActivos = Chatbot::where('is_active', true)->count();
            
            $totalInstanciasWhatsApp = WhatsAppInstance::count();
            $instanciasConectadas = WhatsAppInstance::where('status', 'connected')->count();

            // ========== LLAMADAS VOZ AI ==========
            $totalLlamadasVoz = VoiceCampaignCall::count();
            $llamadasCompletadas = VoiceCampaignCall::where('status', 'completed')->count();
            $duracionTotalMinutos = VoiceCampaignCall::sum('duration_seconds') / 60;
            $costoTotalLlamadas = VoiceCampaignCall::sum('total_cost_usd') ?? 0;

            // ========== WALLETS ==========
            $saldoTotalWallets = Wallet::sum('balance_cop') ?? 0;
            $walletsConSaldo = Wallet::where('balance_cop', '>', 0)->count();

            // ========== SUSCRIPCIONES ==========
            $totalSuscripciones = Subscription::count();
            $suscripcionesActivas = Subscription::where('status', 'active')->count();

            // ========== TOP BROKERS ==========
            $topBrokersPorPolizas = Broker::withCount('policies')
                ->orderByDesc('policies_count')
                ->limit(5)
                ->get(['id', 'name', 'status', 'plan'])
                ->map(fn($b) => [
                    'id' => $b->id,
                    'name' => $b->name,
                    'status' => $b->status,
                    'plan' => $b->plan ?? 'basic',
                    'polizas_count' => $b->policies_count
                ]);

            $topBrokersPorClientes = Broker::withCount('clients')
                ->orderByDesc('clients_count')
                ->limit(5)
                ->get(['id', 'name', 'status', 'plan'])
                ->map(fn($b) => [
                    'id' => $b->id,
                    'name' => $b->name,
                    'status' => $b->status,
                    'plan' => $b->plan ?? 'basic',
                    'clientes_count' => $b->clients_count
                ]);

            // ========== ACTIVIDAD RECIENTE ==========
            $ultimosBrokers = Broker::orderByDesc('created_at')
                ->limit(5)
                ->get(['id', 'name', 'status', 'plan', 'created_at'])
                ->map(fn($b) => [
                    'id' => $b->id,
                    'name' => $b->name,
                    'status' => $b->status,
                    'plan' => $b->plan ?? 'basic',
                    'created_at' => $b->created_at->format('Y-m-d H:i:s')
                ]);

            $ultimosUsuarios = User::orderByDesc('created_at')
                ->limit(5)
                ->get(['id', 'name', 'email', 'user_type', 'status', 'created_at'])
                ->map(fn($u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'user_type' => $u->user_type,
                    'status' => $u->status,
                    'created_at' => $u->created_at->format('Y-m-d H:i:s')
                ]);

            // ========== CRECIMIENTO MENSUAL ==========
            $brokersEsteMes = Broker::whereMonth('created_at', Carbon::now()->month)
                ->whereYear('created_at', Carbon::now()->year)
                ->count();
            $brokersMesAnterior = Broker::whereMonth('created_at', Carbon::now()->subMonth()->month)
                ->whereYear('created_at', Carbon::now()->subMonth()->year)
                ->count();
            $crecimientoBrokers = $brokersMesAnterior > 0 
                ? round((($brokersEsteMes - $brokersMesAnterior) / $brokersMesAnterior) * 100, 1)
                : ($brokersEsteMes > 0 ? 100 : 0);

            return response()->json([
                'success' => true,
                'data' => [
                    'brokers' => [
                        'total' => $totalBrokers,
                        'activos' => $brokersActivos,
                        'inactivos' => $brokersInactivos,
                        'en_trial' => Broker::where('status', 'trial')->count(),
                        'por_plan' => $brokersPorPlan,
                        'este_mes' => $brokersEsteMes,
                        'crecimiento_porcentaje' => $crecimientoBrokers
                    ],
                    'usuarios' => [
                        'total' => $totalUsuarios,
                        'activos' => $usuariosActivos,
                        'masters' => $usuariosMasters,
                        'admins' => $usuariosAdmins,
                        'empleados_total' => $totalEmpleados,
                        'empleados_activos' => $empleadosActivos
                    ],
                    'polizas' => [
                        'total' => $totalPolizas,
                        'activas' => $polizasActivas,
                        'valor_primas' => $valorTotalPrimas,
                        'valor_primas_formato' => number_format($valorTotalPrimas, 0, ',', '.'),
                        'valor_comisiones' => $valorTotalComisiones,
                        'valor_comisiones_formato' => number_format($valorTotalComisiones, 0, ',', '.')
                    ],
                    'clientes' => [
                        'total' => $totalClientes,
                        'activos' => $clientesActivos
                    ],
                    'siniestros' => [
                        'total' => $totalSiniestros,
                        'pendientes' => $siniestrosPendientes
                    ],
                    'automatizacion' => [
                        'campanas_whatsapp' => [
                            'total' => $totalCampanasWhatsApp,
                            'activas' => $campanasWhatsAppActivas
                        ],
                        'campanas_voz' => [
                            'total' => $totalCampanasVoz,
                            'activas' => $campanasVozActivas
                        ],
                        'campanas_email' => [
                            'total' => $totalCampanasEmail,
                            'activas' => $campanasEmailActivas
                        ],
                        'chatbots' => [
                            'total' => $totalChatbots,
                            'activos' => $chatbotsActivos
                        ],
                        'instancias_whatsapp' => [
                            'total' => $totalInstanciasWhatsApp,
                            'conectadas' => $instanciasConectadas
                        ]
                    ],
                    'llamadas_voz' => [
                        'total' => $totalLlamadasVoz,
                        'completadas' => $llamadasCompletadas,
                        'duracion_minutos' => round($duracionTotalMinutos, 1),
                        'costo_total_usd' => round($costoTotalLlamadas, 2)
                    ],
                    'finanzas' => [
                        'saldo_wallets' => $saldoTotalWallets,
                        'saldo_wallets_formato' => number_format($saldoTotalWallets, 0, ',', '.'),
                        'wallets_con_saldo' => $walletsConSaldo,
                        'suscripciones_total' => $totalSuscripciones,
                        'suscripciones_activas' => $suscripcionesActivas
                    ],
                    'top_brokers' => [
                        'por_polizas' => $topBrokersPorPolizas,
                        'por_clientes' => $topBrokersPorClientes
                    ],
                    'actividad_reciente' => [
                        'ultimos_brokers' => $ultimosBrokers,
                        'ultimos_usuarios' => $ultimosUsuarios
                    ],
                    'timestamp' => now()->toISOString()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error en MasterDashboard::getGlobalStats', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Listar todos los brokers con paginación
     */
    public function getBrokers(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user || $user->role !== 'superadmin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Acceso denegado'
                ], 403);
            }

            $query = Broker::query();

            // Filtros
            if ($request->has('search') && $request->search) {
                $query->where(function($q) use ($request) {
                    $q->where('name', 'like', '%' . $request->search . '%')
                      ->orWhere('legal_name', 'like', '%' . $request->search . '%')
                      ->orWhere('email', 'like', '%' . $request->search . '%');
                });
            }

            if ($request->has('status') && $request->status) {
                $query->where('status', $request->status);
            }

            if ($request->has('plan') && $request->plan) {
                $query->where('plan', $request->plan);
            }

            // Incluir conteos
            $query->withCount(['policies', 'clients', 'users']);

            // Ordenamiento
            $sortBy = $request->get('sort_by', 'created_at');
            $sortDir = $request->get('sort_dir', 'desc');
            $query->orderBy($sortBy, $sortDir);

            // Paginación
            $perPage = $request->get('per_page', 15);
            $brokers = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'data' => $brokers
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener brokers: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener detalle de un broker específico
     */
    public function getBrokerDetail(Request $request, int $brokerId)
    {
        try {
            $user = $request->user();
            
            if (!$user || $user->role !== 'superadmin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Acceso denegado'
                ], 403);
            }

            $broker = Broker::withCount(['policies', 'clients', 'users'])
                ->with(['owner:id,name,email'])
                ->find($brokerId);

            if (!$broker) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no encontrado'
                ], 404);
            }

            // Estadísticas adicionales
            $polizasActivas = Poliza::where('broker_id', $brokerId)->where('status', 'active')->count();
            $valorPrimas = Poliza::where('broker_id', $brokerId)->where('status', 'active')->sum('premium_amount');
            $wallet = Wallet::where('broker_id', $brokerId)->first();

            return response()->json([
                'success' => true,
                'data' => [
                    'broker' => $broker,
                    'estadisticas' => [
                        'polizas_activas' => $polizasActivas,
                        'valor_primas' => $valorPrimas,
                        'saldo_wallet' => $wallet ? $wallet->balance : 0
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener broker: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Cambiar estado de un broker
     */
    public function toggleBrokerStatus(Request $request, int $brokerId)
    {
        try {
            $user = $request->user();
            
            if (!$user || $user->role !== 'superadmin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Acceso denegado'
                ], 403);
            }

            $broker = Broker::find($brokerId);

            if (!$broker) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no encontrado'
                ], 404);
            }

            $newStatus = $broker->status === 'active' ? 'suspended' : 'active';
            $broker->update(['status' => $newStatus]);

            return response()->json([
                'success' => true,
                'message' => 'Estado del broker actualizado',
                'data' => [
                    'broker_id' => $brokerId,
                    'new_status' => $newStatus
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al cambiar estado: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Login específico para panel master (sin Firebase)
     */
    public function login(Request $request)
    {
        try {
            $request->validate([
                'email' => 'required|email',
                'password' => 'required|string'
            ]);

            $user = User::where('email', $request->email)
                ->where('role', 'superadmin')
                ->first();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Credenciales incorrectas o usuario no autorizado'
                ], 401);
            }

            if (!Hash::check($request->password, $user->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Credenciales incorrectas'
                ], 401);
            }

            if ($user->status !== 'active') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cuenta suspendida'
                ], 401);
            }

            // Crear token Sanctum
            $token = $user->createToken('master-panel-token')->plainTextToken;

            $user->update(['last_login_at' => now()]);

            return response()->json([
                'success' => true,
                'message' => 'Login exitoso',
                'data' => [
                    'token' => $token,
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'user_type' => $user->user_type,
                        'avatar' => $user->avatar,
                        'last_login_at' => $user->last_login_at
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error en login: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Logout del panel master
     */
    public function logout(Request $request)
    {
        try {
            $request->user()->currentAccessToken()->delete();

            return response()->json([
                'success' => true,
                'message' => 'Sesión cerrada correctamente'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al cerrar sesión'
            ], 500);
        }
    }

    /**
     * Obtener usuario actual del panel master
     */
    public function me(Request $request)
    {
        try {
            $user = $request->user();

            if (!$user || $user->role !== 'superadmin') {
                return response()->json([
                    'success' => false,
                    'message' => 'No autorizado'
                ], 401);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'user_type' => $user->user_type,
                    'avatar' => $user->avatar,
                    'last_login_at' => $user->last_login_at
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Listar todos los usuarios con paginación
     */
    public function getUsuarios(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user || $user->role !== 'superadmin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Acceso denegado'
                ], 403);
            }

            $query = User::query();

            // Filtros
            if ($request->has('search') && $request->search) {
                $query->where(function($q) use ($request) {
                    $q->where('name', 'like', '%' . $request->search . '%')
                      ->orWhere('email', 'like', '%' . $request->search . '%');
                });
            }

            if ($request->has('user_type') && $request->user_type) {
                $query->where('user_type', $request->user_type);
            }

            if ($request->has('status') && $request->status) {
                $query->where('status', $request->status);
            }

            // Ordenamiento
            $query->orderBy('created_at', 'desc');

            // Paginación
            $perPage = $request->get('per_page', 20);
            $usuarios = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'data' => $usuarios
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener usuarios: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener información de facturación de brokers
     */
    public function getFacturacion(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user || $user->role !== 'superadmin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Acceso denegado'
                ], 403);
            }

            // Obtener brokers con información de suscripción
            $brokers = Broker::with(['owner'])
                ->select('brokers.*')
                ->get()
                ->map(function($broker) {
                    // Obtener suscripción del owner
                    $subscription = null;
                    $payments = [];
                    $enMora = false;
                    $diasMora = 0;
                    
                    if ($broker->owner_id) {
                        $subscription = Subscription::where('user_id', $broker->owner_id)
                            ->orderBy('created_at', 'desc')
                            ->first();
                        
                        $payments = PaymentSession::where('user_id', $broker->owner_id)
                            ->orderBy('created_at', 'desc')
                            ->limit(10)
                            ->get();
                        
                        // Calcular mora
                        if ($subscription && $subscription->current_period_end) {
                            $fechaVencimiento = Carbon::parse($subscription->current_period_end);
                            if ($fechaVencimiento->isPast() && $subscription->status !== 'canceled') {
                                $enMora = true;
                                $diasMora = $fechaVencimiento->diffInDays(now());
                            }
                        }
                    }
                    
                    return [
                        'id' => $broker->id,
                        'name' => $broker->name,
                        'email' => $broker->email,
                        'plan' => $broker->plan ?? 'basic',
                        'status' => $broker->status,
                        'created_at' => $broker->created_at,
                        'trial_ends_at' => $broker->trial_ends_at,
                        'subscription_ends_at' => $broker->subscription_ends_at,
                        'owner' => $broker->owner ? [
                            'id' => $broker->owner->id,
                            'name' => $broker->owner->name,
                            'email' => $broker->owner->email,
                        ] : null,
                        'subscription' => $subscription ? [
                            'id' => $subscription->id,
                            'status' => $subscription->status,
                            'period' => $subscription->period,
                            'starts_at' => $subscription->starts_at,
                            'current_period_end' => $subscription->current_period_end,
                            'totals' => $subscription->totals,
                        ] : null,
                        'en_mora' => $enMora,
                        'dias_mora' => $diasMora,
                        'ultimo_pago' => $payments->first() ? [
                            'id' => $payments->first()->id,
                            'reference' => $payments->first()->reference,
                            'amount' => $payments->first()->amount_in_cents / 100,
                            'status' => $payments->first()->status,
                            'created_at' => $payments->first()->created_at,
                            'wompi_transaction_id' => $payments->first()->wompi_transaction_id,
                        ] : null,
                        'total_pagos' => $payments->where('status', 'approved')->count(),
                        'monto_total_pagado' => $payments->where('status', 'approved')->sum('amount_in_cents') / 100,
                    ];
                });

            // Filtrar por estado de mora si se solicita
            if ($request->has('en_mora') && $request->en_mora === 'true') {
                $brokers = $brokers->filter(fn($b) => $b['en_mora'] === true)->values();
            }

            // Estadísticas globales
            $stats = [
                'total_brokers' => $brokers->count(),
                'brokers_en_mora' => $brokers->where('en_mora', true)->count(),
                'brokers_al_dia' => $brokers->where('en_mora', false)->count(),
                'total_recaudado' => $brokers->sum('monto_total_pagado'),
                'suscripciones_activas' => $brokers->filter(fn($b) => $b['subscription'] && $b['subscription']['status'] === 'active')->count(),
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'brokers' => $brokers,
                    'stats' => $stats,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener facturación: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener historial de pagos de un broker específico
     */
    public function getBrokerPayments(Request $request, $brokerId)
    {
        try {
            $user = $request->user();
            
            if (!$user || $user->role !== 'superadmin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Acceso denegado'
                ], 403);
            }

            $broker = Broker::with(['owner'])->find($brokerId);
            
            if (!$broker) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no encontrado'
                ], 404);
            }

            $payments = [];
            $subscriptions = [];
            
            if ($broker->owner_id) {
                $payments = PaymentSession::where('user_id', $broker->owner_id)
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->map(fn($p) => [
                        'id' => $p->id,
                        'reference' => $p->reference,
                        'amount' => $p->amount_in_cents / 100,
                        'amount_formatted' => '$' . number_format($p->amount_in_cents / 100, 0, ',', '.'),
                        'currency' => $p->currency,
                        'status' => $p->status,
                        'wompi_transaction_id' => $p->wompi_transaction_id,
                        'created_at' => $p->created_at,
                        'metadata' => $p->metadata,
                    ]);
                
                $subscriptions = Subscription::where('user_id', $broker->owner_id)
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->map(fn($s) => [
                        'id' => $s->id,
                        'status' => $s->status,
                        'period' => $s->period,
                        'users_count' => $s->users_count,
                        'storage_gb' => $s->storage_gb,
                        'modules' => $s->modules,
                        'totals' => $s->totals,
                        'starts_at' => $s->starts_at,
                        'current_period_end' => $s->current_period_end,
                        'canceled_at' => $s->canceled_at,
                        'created_at' => $s->created_at,
                    ]);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'broker' => [
                        'id' => $broker->id,
                        'name' => $broker->name,
                        'email' => $broker->email,
                        'plan' => $broker->plan,
                        'status' => $broker->status,
                        'created_at' => $broker->created_at,
                        'trial_ends_at' => $broker->trial_ends_at,
                        'subscription_ends_at' => $broker->subscription_ends_at,
                    ],
                    'owner' => $broker->owner ? [
                        'id' => $broker->owner->id,
                        'name' => $broker->owner->name,
                        'email' => $broker->owner->email,
                    ] : null,
                    'payments' => $payments,
                    'subscriptions' => $subscriptions,
                    'resumen' => [
                        'total_pagos' => $payments->count(),
                        'pagos_aprobados' => $payments->where('status', 'approved')->count(),
                        'monto_total' => $payments->where('status', 'approved')->sum('amount') ?? 0,
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener pagos: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener detalle completo de un broker con toda su información
     */
    public function getBrokerFullDetail(Request $request, $brokerId)
    {
        try {
            Log::info('getBrokerFullDetail called', ['brokerId' => $brokerId]);
            
            $user = $request->user();
            
            if (!$user || $user->role !== 'superadmin') {
                Log::warning('getBrokerFullDetail: Acceso denegado', ['user' => $user?->id]);
                return response()->json([
                    'success' => false,
                    'message' => 'Acceso denegado'
                ], 403);
            }

            $broker = Broker::with(['owner'])->find($brokerId);
            
            if (!$broker) {
                Log::warning('getBrokerFullDetail: Broker no encontrado', ['brokerId' => $brokerId]);
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no encontrado'
                ], 404);
            }
            
            Log::info('getBrokerFullDetail: Broker encontrado', ['broker' => $broker->name]);

            // Información básica
            $brokerData = [
                'id' => $broker->id,
                'name' => $broker->name,
                'legal_name' => $broker->legal_name,
                'email' => $broker->email,
                'phone' => $broker->phone,
                'address' => $broker->address,
                'city' => $broker->city,
                'country' => $broker->country,
                'plan' => $broker->plan,
                'status' => $broker->status,
                'created_at' => $broker->created_at,
                'trial_ends_at' => $broker->trial_ends_at,
                'subscription_ends_at' => $broker->subscription_ends_at,
                'owner' => $broker->owner ? [
                    'id' => $broker->owner->id,
                    'name' => $broker->owner->name,
                    'email' => $broker->owner->email,
                ] : null,
            ];

            // Wallet y transacciones
            $wallet = Wallet::where('broker_id', $brokerId)->first();
            $walletTransactions = WalletTransaction::where('broker_id', $brokerId)
                ->orderBy('created_at', 'desc')
                ->limit(100)
                ->get();

            // Pólizas
            $polizas = Poliza::where('broker_id', $brokerId)
                ->orderBy('created_at', 'desc')
                ->limit(50)
                ->get(['id', 'policy_number', 'status', 'premium_amount', 'commission_amount', 'start_date', 'end_date', 'created_at']);
            
            $polizasStats = [
                'total' => Poliza::where('broker_id', $brokerId)->count(),
                'activas' => Poliza::where('broker_id', $brokerId)->where('status', 'active')->count(),
                'valor_primas' => Poliza::where('broker_id', $brokerId)->where('status', 'active')->sum('premium_amount'),
                'valor_comisiones' => Poliza::where('broker_id', $brokerId)->where('status', 'active')->sum('commission_amount'),
            ];

            // Clientes
            $clientes = Cliente::where('broker_id', $brokerId)
                ->orderBy('created_at', 'desc')
                ->limit(50)
                ->get(['id', 'first_name', 'last_name', 'email', 'phone', 'status', 'created_at']);
            
            $clientesStats = [
                'total' => Cliente::where('broker_id', $brokerId)->count(),
                'activos' => Cliente::where('broker_id', $brokerId)->where('status', 'active')->count(),
            ];

            // Campañas WhatsApp
            $campanasWhatsApp = Campaign::where('broker_id', $brokerId)
                ->orderBy('created_at', 'desc')
                ->get();

            // Campañas Voz
            $campanasVoz = VoiceCampaign::where('broker_id', $brokerId)
                ->orderBy('created_at', 'desc')
                ->get();
            
            // Llamadas de voz con detalles de errores
            $llamadasVoz = VoiceCampaignCall::where('broker_id', $brokerId)
                ->orderBy('created_at', 'desc')
                ->limit(100)
                ->get();

            // Campañas Email
            $campanasEmail = EmailCampaign::where('broker_id', $brokerId)
                ->orderBy('created_at', 'desc')
                ->get();

            // Chatbots
            $chatbots = Chatbot::where('broker_id', $brokerId)->get();

            // Instancias WhatsApp
            $instanciasWhatsApp = WhatsAppInstance::where('broker_id', $brokerId)->get();

            // Usuarios del broker
            $usuarios = User::where('broker_id', $brokerId)
                ->orWhere('id', $broker->owner_id)
                ->get(['id', 'name', 'email', 'user_type', 'status', 'last_login_at', 'created_at']);

            // Empleados
            $empleados = EmpleadoBroker::where('broker_id', $brokerId)
                ->with('rol')
                ->get()
                ->map(fn($e) => [
                    'id' => $e->id,
                    'nombre' => $e->nombre_completo,
                    'nombres' => $e->nombres,
                    'apellidos' => $e->apellidos,
                    'email' => $e->email,
                    'usuario' => $e->usuario,
                    'cargo' => $e->cargo,
                    'departamento' => $e->departamento,
                    'estado' => $e->estado,
                    'telefono' => $e->telefono_principal,
                    'rol' => $e->rol?->nombre,
                    'acceso_activo' => $e->acceso_activo,
                    'ultimo_acceso' => $e->ultimo_acceso,
                    'created_at' => $e->created_at,
                ]);

            // Siniestros
            $siniestros = Siniestro::where('broker_id', $brokerId)
                ->orderBy('created_at', 'desc')
                ->limit(50)
                ->get();

            // Suscripción detallada
            $subscription = null;
            $subscriptionHistory = [];
            if ($broker->owner_id) {
                $subscription = Subscription::where('user_id', $broker->owner_id)
                    ->orderBy('created_at', 'desc')
                    ->first();
                
                $subscriptionHistory = Subscription::where('user_id', $broker->owner_id)
                    ->orderBy('created_at', 'desc')
                    ->get();
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'broker' => $brokerData,
                    'wallet' => $wallet ? [
                        'id' => $wallet->id,
                        'balance_cop' => $wallet->balance_cop,
                        'balance_cop_formatted' => '$' . number_format($wallet->balance_cop, 0, ',', '.'),
                        'balance_usd' => $wallet->balance_usd,
                        'pending_balance' => $wallet->pending_balance,
                        'total_earnings' => $wallet->total_earnings,
                        'is_active' => $wallet->is_active,
                    ] : null,
                    'wallet_transactions' => $walletTransactions->map(fn($t) => [
                        'id' => $t->id,
                        'type' => $t->type,
                        'amount_cop' => $t->amount_cop,
                        'amount_usd' => $t->amount_usd,
                        'currency' => $t->currency,
                        'description' => $t->description,
                        'reference_type' => $t->reference_type,
                        'reference_id' => $t->reference_id,
                        'balance_cop_after' => $t->balance_cop_after,
                        'metadata' => $t->metadata,
                        'created_at' => $t->created_at,
                    ]),
                    'polizas' => [
                        'stats' => $polizasStats,
                        'items' => $polizas,
                    ],
                    'clientes' => [
                        'stats' => $clientesStats,
                        'items' => $clientes,
                    ],
                    'campanas' => [
                        'whatsapp' => $campanasWhatsApp->map(fn($c) => [
                            'id' => $c->id,
                            'name' => $c->name,
                            'status' => $c->status,
                            'type' => $c->type ?? 'message',
                            'total_recipients' => $c->total_recipients ?? 0,
                            'sent_count' => $c->sent_count ?? 0,
                            'failed_count' => $c->failed_count ?? 0,
                            'error_message' => $c->error_message ?? null,
                            'created_at' => $c->created_at,
                            'executed_at' => $c->executed_at ?? null,
                        ]),
                        'voz' => $campanasVoz->map(fn($c) => [
                            'id' => $c->id,
                            'name' => $c->name,
                            'status' => $c->status,
                            'total_calls' => $c->total_calls ?? 0,
                            'completed_calls' => $c->completed_calls ?? 0,
                            'failed_calls' => $c->failed_calls ?? 0,
                            'error_message' => $c->error_message ?? null,
                            'created_at' => $c->created_at,
                        ]),
                        'email' => $campanasEmail->map(fn($c) => [
                            'id' => $c->id,
                            'name' => $c->name ?? $c->subject,
                            'status' => $c->status,
                            'total_recipients' => $c->total_recipients ?? 0,
                            'sent_count' => $c->sent_count ?? 0,
                            'failed_count' => $c->failed_count ?? 0,
                            'created_at' => $c->created_at,
                        ]),
                    ],
                    'llamadas_voz' => $llamadasVoz->map(fn($l) => [
                        'id' => $l->id,
                        'phone_number' => $l->recipient_phone,
                        'status' => $l->status,
                        'duration_seconds' => $l->duration_seconds,
                        'total_cost_usd' => $l->total_cost_usd,
                        'error_message' => $l->error_message ?? null,
                        'vapi_call_id' => $l->elevenlabs_call_id ?? null,
                        'created_at' => $l->created_at,
                        'started_at' => $l->call_initiated_at ?? null,
                        'ended_at' => $l->call_ended_at ?? null,
                    ]),
                    'chatbots' => $chatbots,
                    'instancias_whatsapp' => $instanciasWhatsApp->map(fn($i) => [
                        'id' => $i->id,
                        'name' => $i->name,
                        'phone_number' => $i->phone_number,
                        'status' => $i->status,
                        'created_at' => $i->created_at,
                    ]),
                    'usuarios' => $usuarios,
                    'empleados' => $empleados,
                    'siniestros' => [
                        'total' => Siniestro::where('broker_id', $brokerId)->count(),
                        'pendientes' => Siniestro::where('broker_id', $brokerId)->whereIn('estado', ['reportado', 'en_revision'])->count(),
                        'items' => $siniestros,
                    ],
                    'subscription' => $subscription ? [
                        'id' => $subscription->id,
                        'status' => $subscription->status,
                        'period' => $subscription->period,
                        'users_count' => $subscription->users_count,
                        'storage_gb' => $subscription->storage_gb,
                        'modules' => $subscription->modules,
                        'totals' => $subscription->totals,
                        'starts_at' => $subscription->starts_at,
                        'current_period_end' => $subscription->current_period_end,
                        'canceled_at' => $subscription->canceled_at,
                        'created_at' => $subscription->created_at,
                    ] : null,
                    'subscription_history' => $subscriptionHistory->map(fn($s) => [
                        'id' => $s->id,
                        'status' => $s->status,
                        'period' => $s->period,
                        'totals' => $s->totals,
                        'starts_at' => $s->starts_at,
                        'current_period_end' => $s->current_period_end,
                        'created_at' => $s->created_at,
                    ]),
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener detalle del broker: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar wallet de un broker
     */
    public function updateBrokerWallet(Request $request, $brokerId)
    {
        try {
            $user = $request->user();
            
            if (!$user || $user->role !== 'superadmin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Acceso denegado'
                ], 403);
            }

            $wallet = Wallet::where('broker_id', $brokerId)->first();
            
            if (!$wallet) {
                return response()->json([
                    'success' => false,
                    'message' => 'Wallet no encontrado'
                ], 404);
            }

            $action = $request->input('action'); // 'add' or 'subtract'
            $amount = floatval($request->input('amount', 0));
            $description = $request->input('description', 'Ajuste manual por administrador');

            if ($amount <= 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'El monto debe ser mayor a 0'
                ], 400);
            }

            if ($action === 'add') {
                $wallet->addFunds($amount, 'COP', $description, ['admin_id' => $user->id]);
            } elseif ($action === 'subtract') {
                if ($wallet->balance_cop < $amount) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Saldo insuficiente'
                    ], 400);
                }
                $wallet->balance_cop -= $amount;
                $wallet->save();
                
                WalletTransaction::create([
                    'wallet_id' => $wallet->id,
                    'broker_id' => $brokerId,
                    'user_id' => $wallet->user_id,
                    'type' => 'debit',
                    'amount_cop' => $amount,
                    'currency' => 'COP',
                    'description' => $description,
                    'balance_cop_after' => $wallet->balance_cop,
                    'metadata' => ['admin_id' => $user->id],
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Acción no válida'
                ], 400);
            }

            return response()->json([
                'success' => true,
                'message' => 'Wallet actualizado correctamente',
                'data' => [
                    'balance_cop' => $wallet->balance_cop,
                    'balance_cop_formatted' => '$' . number_format($wallet->balance_cop, 0, ',', '.'),
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar wallet: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar suscripción de un broker
     */
    public function updateBrokerSubscription(Request $request, $brokerId)
    {
        try {
            $user = $request->user();
            
            if (!$user || $user->role !== 'superadmin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Acceso denegado'
                ], 403);
            }

            $broker = Broker::with(['owner'])->find($brokerId);
            
            if (!$broker || !$broker->owner_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker o propietario no encontrado'
                ], 404);
            }

            $subscription = Subscription::where('user_id', $broker->owner_id)
                ->orderBy('created_at', 'desc')
                ->first();

            if (!$subscription) {
                return response()->json([
                    'success' => false,
                    'message' => 'Suscripción no encontrada'
                ], 404);
            }

            // Actualizar campos permitidos
            if ($request->has('status')) {
                $subscription->status = $request->input('status');
            }
            if ($request->has('period')) {
                $subscription->period = $request->input('period');
            }
            if ($request->has('current_period_end')) {
                $subscription->current_period_end = $request->input('current_period_end');
            }
            if ($request->has('users_count')) {
                $subscription->users_count = $request->input('users_count');
            }
            if ($request->has('storage_gb')) {
                $subscription->storage_gb = $request->input('storage_gb');
            }
            
            // Actualizar totals (montos)
            if ($request->has('totals')) {
                $subscription->totals = $request->input('totals');
            }
            
            // Actualizar monto mensual/anual específico
            if ($request->has('monthly_amount') || $request->has('annual_amount')) {
                $totals = $subscription->totals ?? [];
                if ($request->has('monthly_amount')) {
                    $totals['monthly'] = floatval($request->input('monthly_amount'));
                }
                if ($request->has('annual_amount')) {
                    $totals['annual'] = floatval($request->input('annual_amount'));
                }
                $subscription->totals = $totals;
            }

            $subscription->save();

            // También actualizar el plan del broker si se especifica
            if ($request->has('plan')) {
                $broker->plan = $request->input('plan');
                $broker->save();
            }

            return response()->json([
                'success' => true,
                'message' => 'Suscripción actualizada correctamente',
                'data' => [
                    'subscription' => [
                        'id' => $subscription->id,
                        'status' => $subscription->status,
                        'period' => $subscription->period,
                        'users_count' => $subscription->users_count,
                        'storage_gb' => $subscription->storage_gb,
                        'totals' => $subscription->totals,
                        'starts_at' => $subscription->starts_at,
                        'current_period_end' => $subscription->current_period_end,
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar suscripción: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener logs del sistema
     */
    public function getLogs(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user || $user->role !== 'superadmin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Acceso denegado'
                ], 403);
            }

            $logFile = $request->input('file', 'laravel');
            $lines = intval($request->input('lines', 500));
            $search = $request->input('search', '');

            $logPath = storage_path("logs/{$logFile}.log");
            
            if (!file_exists($logPath)) {
                // Listar archivos de log disponibles
                $logFiles = glob(storage_path('logs/*.log'));
                $availableFiles = array_map(fn($f) => basename($f, '.log'), $logFiles);
                
                return response()->json([
                    'success' => false,
                    'message' => 'Archivo de log no encontrado',
                    'available_files' => $availableFiles
                ], 404);
            }

            // Leer las últimas N líneas del archivo
            $file = new \SplFileObject($logPath, 'r');
            $file->seek(PHP_INT_MAX);
            $totalLines = $file->key();
            
            $startLine = max(0, $totalLines - $lines);
            $logLines = [];
            
            $file->seek($startLine);
            while (!$file->eof()) {
                $line = $file->fgets();
                if (!empty(trim($line))) {
                    if (empty($search) || stripos($line, $search) !== false) {
                        $logLines[] = $line;
                    }
                }
            }

            // Listar archivos disponibles
            $logFiles = glob(storage_path('logs/*.log'));
            $availableFiles = array_map(function($f) {
                return [
                    'name' => basename($f, '.log'),
                    'size' => filesize($f),
                    'modified' => date('Y-m-d H:i:s', filemtime($f)),
                ];
            }, $logFiles);

            return response()->json([
                'success' => true,
                'data' => [
                    'file' => $logFile,
                    'total_lines' => $totalLines,
                    'showing_lines' => count($logLines),
                    'lines' => array_reverse($logLines),
                    'available_files' => $availableFiles,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener logs: ' . $e->getMessage()
            ], 500);
        }
    }
}
