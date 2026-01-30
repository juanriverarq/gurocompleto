<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\UnifiedAuthMiddleware;
use App\Models\Subscription;
use App\Models\SubscriptionIntent;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class SubscriptionController extends Controller
{
    /**
     * Obtener la suscripción activa del usuario/broker
     */
    public function current(Request $request): JsonResponse
    {
        try {
            $user = UnifiedAuthMiddleware::getAuthenticatedUser($request);
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }

            // Obtener el broker del usuario
            $broker = Broker::find($user->broker_id);
            
            // Obtener la suscripción activa
            $subscription = Subscription::where('user_id', $user->id)
                ->whereIn('status', ['active', 'trialing'])
                ->orderBy('created_at', 'desc')
                ->first();

            // Si no hay suscripción, verificar si está en trial
            $isInTrial = false;
            $trialDaysRemaining = 0;
            
            if ($broker && $broker->trial_ends_at) {
                $trialEndsAt = $broker->trial_ends_at;
                $now = now();
                
                if ($trialEndsAt->isFuture()) {
                    $isInTrial = true;
                    $trialDaysRemaining = $now->diffInDays($trialEndsAt);
                }
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'subscription' => $subscription ? [
                        'id' => $subscription->id,
                        'status' => $subscription->status,
                        'period' => $subscription->period,
                        'users_count' => $subscription->users_count,
                        'storage_gb' => $subscription->storage_gb,
                        'modules' => $subscription->modules,
                        'totals' => $subscription->totals,
                        'starts_at' => $subscription->starts_at?->toISOString(),
                        'current_period_end' => $subscription->current_period_end?->toISOString(),
                        'canceled_at' => $subscription->canceled_at?->toISOString(),
                        'created_at' => $subscription->created_at?->toISOString(),
                    ] : null,
                    'broker' => $broker ? [
                        'id' => $broker->id,
                        'name' => $broker->name,
                        'plan' => $broker->plan,
                        'status' => $broker->status,
                        'trial_ends_at' => $broker->trial_ends_at?->toISOString(),
                        'subscription_ends_at' => $broker->subscription_ends_at?->toISOString(),
                        'max_users' => $broker->max_users,
                        'max_clients' => $broker->max_clients,
                        'max_policies' => $broker->max_policies,
                        'features' => $broker->features,
                    ] : null,
                    'is_in_trial' => $isInTrial,
                    'trial_days_remaining' => $trialDaysRemaining,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo suscripción actual', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener la suscripción'
            ], 500);
        }
    }

    /**
     * Obtener historial de pagos/facturas
     */
    public function invoices(Request $request): JsonResponse
    {
        try {
            $user = UnifiedAuthMiddleware::getAuthenticatedUser($request);
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }

            // Combinar en un historial de facturas
            $invoices = [];
            $processedIntentIds = [];

            // 1. Obtener todos los intents completados (representan pagos)
            $completedIntents = SubscriptionIntent::where('user_id', $user->id)
                ->where('status', 'completed')
                ->orderBy('created_at', 'desc')
                ->get();
            
            foreach ($completedIntents as $intent) {
                $totals = $intent->totals ?? [];
                
                // Manejar diferentes formatos de totals
                $subtotal = $totals['subtotal'] ?? $totals['subtotalMonthly'] ?? 0;
                $total = $totals['total'] ?? $totals['subtotalMonthly'] ?? 0;
                
                // Si es anual, usar el total anual
                if ($intent->period === 'annual' && isset($totals['totalAnnualEquivalent'])) {
                    $total = $totals['totalAnnualEquivalent'];
                    $subtotal = $totals['totalAnnualEquivalent'];
                }
                
                $invoices[] = [
                    'id' => 'INV-' . str_pad($intent->id, 6, '0', STR_PAD_LEFT),
                    'type' => 'payment',
                    'date' => $intent->created_at->toISOString(),
                    'description' => $this->getInvoiceDescription($intent),
                    'period' => $intent->period,
                    'users_count' => $intent->users_count,
                    'storage_gb' => $intent->storage_gb,
                    'modules' => $intent->modules,
                    'subtotal' => $subtotal,
                    'discount' => $totals['discount'] ?? 0,
                    'tax' => $totals['tax'] ?? 0,
                    'total' => $total,
                    'currency' => 'COP',
                    'status' => 'paid',
                ];
                $processedIntentIds[] = $intent->id;
            }

            // 2. Obtener suscripciones activas/pagadas que no tengan intent asociado ya procesado
            // Esto cubre casos donde el pago se registró directamente en subscriptions
            $paidSubscriptions = Subscription::where('user_id', $user->id)
                ->whereIn('status', ['active', 'canceled']) // active = pagado, canceled = fue pagado pero cancelado
                ->where(function($query) use ($processedIntentIds) {
                    $query->whereNull('intent_id')
                          ->orWhereNotIn('intent_id', $processedIntentIds);
                })
                ->orderBy('created_at', 'desc')
                ->get();

            foreach ($paidSubscriptions as $subscription) {
                $totals = $subscription->totals ?? [];
                
                // Manejar diferentes formatos de totals
                // Formato nuevo: subtotalMonthly, totalAnnualEquivalent
                // Formato antiguo: subtotal, total
                $subtotal = $totals['subtotal'] ?? $totals['subtotalMonthly'] ?? 0;
                $total = $totals['total'] ?? $totals['subtotalMonthly'] ?? 0;
                
                // Si es anual, usar el total anual
                if ($subscription->period === 'annual' && isset($totals['totalAnnualEquivalent'])) {
                    $total = $totals['totalAnnualEquivalent'];
                    $subtotal = $totals['totalAnnualEquivalent'];
                }
                
                // Solo agregar si tiene un total > 0 (es un pago real, no trial)
                if ($total > 0) {
                    $invoices[] = [
                        'id' => 'SUB-' . str_pad($subscription->id, 6, '0', STR_PAD_LEFT),
                        'type' => 'payment',
                        'date' => $subscription->starts_at?->toISOString() ?? $subscription->created_at->toISOString(),
                        'description' => $this->getSubscriptionDescription($subscription),
                        'period' => $subscription->period,
                        'users_count' => $subscription->users_count,
                        'storage_gb' => $subscription->storage_gb,
                        'modules' => $subscription->modules ?? [],
                        'subtotal' => $subtotal,
                        'discount' => $totals['discount'] ?? 0,
                        'tax' => $totals['tax'] ?? 0,
                        'total' => $total,
                        'currency' => 'COP',
                        'status' => 'paid',
                    ];
                }
            }

            // Ordenar todas las facturas por fecha descendente
            usort($invoices, function($a, $b) {
                return strtotime($b['date']) - strtotime($a['date']);
            });

            // Si no hay pagos, mostrar al menos la info del trial
            if (empty($invoices)) {
                $broker = Broker::find($user->broker_id);
                if ($broker && $broker->trial_ends_at) {
                    $invoices[] = [
                        'id' => 'TRIAL-' . str_pad($broker->id, 6, '0', STR_PAD_LEFT),
                        'type' => 'trial',
                        'date' => $broker->created_at?->toISOString(),
                        'description' => 'Periodo de prueba gratuito - 7 días',
                        'period' => 'trial',
                        'users_count' => $broker->max_users ?? 5,
                        'storage_gb' => 5,
                        'modules' => $broker->features ?? [],
                        'subtotal' => 0,
                        'discount' => 0,
                        'tax' => 0,
                        'total' => 0,
                        'currency' => 'COP',
                        'status' => $broker->trial_ends_at->isFuture() ? 'active' : 'expired',
                    ];
                }
            }

            return response()->json([
                'success' => true,
                'data' => $invoices
            ]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo facturas', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las facturas'
            ], 500);
        }
    }

    /**
     * Obtener intención de suscripción pendiente (para mostrar en modal de pago)
     */
    public function pendingIntent(Request $request): JsonResponse
    {
        try {
            $user = UnifiedAuthMiddleware::getAuthenticatedUser($request);
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }

            // Buscar la intención de suscripción más reciente pendiente
            $pendingIntent = SubscriptionIntent::where('user_id', $user->id)
                ->where('status', 'pending')
                ->orderBy('created_at', 'desc')
                ->first();

            if (!$pendingIntent) {
                return response()->json([
                    'success' => true,
                    'data' => null,
                    'message' => 'No hay intención de suscripción pendiente'
                ]);
            }

            // Calcular totales si no existen o están incompletos
            $totals = $pendingIntent->totals ?? [];
            
            // Si no hay subtotalMonthly, calcular basado en módulos
            if (!isset($totals['subtotalMonthly']) || $totals['subtotalMonthly'] == 0) {
                $modules = $pendingIntent->modules ?? [];
                $usersCount = $pendingIntent->users_count ?? 1;
                $storageGb = $pendingIntent->storage_gb ?? 10;
                
                // Precios base por módulo (mensual por usuario)
                $modulePrices = [
                    'crm' => 25000,
                    'polizas' => 35000,
                    'cotizador' => 20000,
                    'marketing' => 15000,
                    'cobranza' => 20000,
                    'reportes' => 10000,
                    'voice_ai' => 30000,
                    'whatsapp' => 25000,
                ];
                
                // Calcular precio base por módulos
                $basePrice = 0;
                foreach ($modules as $module) {
                    $moduleKey = is_array($module) ? ($module['id'] ?? $module['key'] ?? '') : $module;
                    if (isset($modulePrices[$moduleKey])) {
                        $basePrice += $modulePrices[$moduleKey];
                    }
                }
                
                // Si no hay módulos seleccionados, usar precio base mínimo
                if ($basePrice == 0) {
                    $basePrice = 50000; // Precio base mínimo
                }
                
                // Multiplicar por usuarios
                $subtotalMonthly = $basePrice * $usersCount;
                
                // Agregar costo de almacenamiento extra (10GB incluidos)
                $extraStorage = max(0, $storageGb - 10);
                $storageCost = $extraStorage * 5000; // $5,000 por GB extra
                $subtotalMonthly += $storageCost;
                
                // Calcular anual con descuento del 20%
                $annualDiscount = 0.20;
                $totalAnnual = $subtotalMonthly * 12 * (1 - $annualDiscount);
                
                $totals = [
                    'subtotalMonthly' => $subtotalMonthly,
                    'totalAnnualEquivalent' => $totalAnnual,
                    'annualDiscount' => $annualDiscount * 100,
                    'total' => $pendingIntent->period === 'annual' ? $totalAnnual : $subtotalMonthly,
                ];
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $pendingIntent->id,
                    'period' => $pendingIntent->period,
                    'users_count' => $pendingIntent->users_count,
                    'storage_gb' => $pendingIntent->storage_gb,
                    'modules' => $pendingIntent->modules,
                    'totals' => $totals,
                    'created_at' => $pendingIntent->created_at->toISOString(),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo intención pendiente', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener la intención de suscripción'
            ], 500);
        }
    }

    /**
     * Obtener estadísticas de uso
     */
    public function usage(Request $request): JsonResponse
    {
        try {
            $user = UnifiedAuthMiddleware::getAuthenticatedUser($request);
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }

            $broker = Broker::find($user->broker_id);
            if (!$broker) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no encontrado'
                ], 404);
            }

            // Buscar suscripción activa para obtener los límites del plan
            $subscription = Subscription::where('user_id', $user->id)
                ->whereIn('status', ['active', 'trialing'])
                ->orderBy('created_at', 'desc')
                ->first();

            // Determinar límites según suscripción o valores por defecto del broker
            $maxUsers = $subscription->users_count ?? $broker->max_users ?? 5;
            $storageGb = $subscription->storage_gb ?? 5;
            
            // Si hay suscripción, usar los límites del plan según el periodo
            if ($subscription) {
                // Los límites pueden variar según el periodo (mensual/anual)
                // Por ahora usamos los valores de la suscripción directamente
                $maxUsers = $subscription->users_count;
                $storageGb = $subscription->storage_gb;
            }

            // Contar usuarios activos
            $usersCount = \App\Models\User::where('broker_id', $broker->id)->count();
            $empleadosCount = \App\Models\EmpleadoBroker::where('broker_id', $broker->id)->count();
            $totalUsers = $usersCount + $empleadosCount;

            // Contar clientes
            $clientsCount = \App\Models\Cliente::where('broker_id', $broker->id)->count();

            // Contar pólizas
            $policiesCount = \App\Models\Poliza::where('broker_id', $broker->id)->count();

            // Calcular almacenamiento usado (aproximado basado en archivos adjuntos)
            $storageUsedMB = 0;
            try {
                // Contar archivos en la tabla de adjuntos si existe
                if (\Schema::hasTable('adjuntos')) {
                    $adjuntosCount = \DB::table('adjuntos')
                        ->whereIn('poliza_id', function($query) use ($broker) {
                            $query->select('id')
                                ->from('polizas')
                                ->where('broker_id', $broker->id);
                        })
                        ->count();
                    $storageUsedMB = $adjuntosCount * 2; // Estimado 2MB por documento
                }
            } catch (\Exception $e) {
                // Si hay error, ignorar
                Log::warning('Error calculando almacenamiento', ['error' => $e->getMessage()]);
            }

            // Calcular límites de clientes y pólizas según el plan
            $maxClients = $broker->max_clients ?? 100;
            $maxPolicies = $broker->max_policies ?? 500;

            return response()->json([
                'success' => true,
                'data' => [
                    'users' => [
                        'used' => $totalUsers,
                        'limit' => $maxUsers,
                        'percentage' => $maxUsers > 0 
                            ? round(($totalUsers / $maxUsers) * 100, 1) 
                            : 0
                    ],
                    'clients' => [
                        'used' => $clientsCount,
                        'limit' => $maxClients,
                        'percentage' => $maxClients > 0 
                            ? round(($clientsCount / $maxClients) * 100, 1) 
                            : 0
                    ],
                    'policies' => [
                        'used' => $policiesCount,
                        'limit' => $maxPolicies,
                        'percentage' => $maxPolicies > 0 
                            ? round(($policiesCount / $maxPolicies) * 100, 1) 
                            : 0
                    ],
                    'storage' => [
                        'used_mb' => $storageUsedMB,
                        'limit_gb' => $storageGb,
                        'percentage' => $storageGb > 0 
                            ? round(($storageUsedMB / 1024 / $storageGb) * 100, 1) 
                            : 0
                    ],
                    'subscription' => $subscription ? [
                        'period' => $subscription->period,
                        'status' => $subscription->status,
                        'users_count' => $subscription->users_count,
                        'storage_gb' => $subscription->storage_gb,
                        'current_period_end' => $subscription->current_period_end?->toISOString(),
                    ] : null
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo uso', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas de uso'
            ], 500);
        }
    }

    /**
     * Generar descripción de factura desde intent
     */
    private function getInvoiceDescription(SubscriptionIntent $intent): string
    {
        $period = $intent->period === 'annual' ? 'Anual' : 'Mensual';
        $users = $intent->users_count;
        
        return "Suscripción {$period} - {$users} usuario(s)";
    }

    /**
     * Generar descripción de factura desde suscripción
     */
    private function getSubscriptionDescription(Subscription $subscription): string
    {
        $period = $subscription->period === 'annual' ? 'Anual' : 'Mensual';
        $users = $subscription->users_count;
        
        return "Suscripción {$period} - {$users} usuario(s)";
    }

    /**
     * Descargar factura en PDF
     */
    public function downloadInvoice(Request $request, string $invoiceId)
    {
        try {
            $user = UnifiedAuthMiddleware::getAuthenticatedUser($request);
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }

            $broker = Broker::find($user->broker_id);
            
            // Parsear el ID de la factura (INV-000014 o SUB-000002)
            $parts = explode('-', $invoiceId);
            if (count($parts) !== 2) {
                return response()->json([
                    'success' => false,
                    'message' => 'ID de factura inválido'
                ], 400);
            }

            $type = $parts[0];
            $id = (int) $parts[1];

            $invoice = null;
            $totals = [];
            $modules = [];

            if ($type === 'INV') {
                // Buscar en subscription_intents
                $intent = SubscriptionIntent::where('id', $id)
                    ->where('user_id', $user->id)
                    ->where('status', 'completed')
                    ->first();

                if (!$intent) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Factura no encontrada'
                    ], 404);
                }

                $totals = $intent->totals ?? [];
                $subtotal = $totals['subtotal'] ?? $totals['subtotalMonthly'] ?? 0;
                $total = $totals['total'] ?? $totals['subtotalMonthly'] ?? 0;
                
                if ($intent->period === 'annual' && isset($totals['totalAnnualEquivalent'])) {
                    $total = $totals['totalAnnualEquivalent'];
                    $subtotal = $totals['totalAnnualEquivalent'];
                }

                // Buscar la suscripción asociada para obtener fechas
                $subscription = Subscription::where('intent_id', $intent->id)->first();
                $periodStart = $subscription?->starts_at ?? $intent->created_at;
                $periodEnd = $subscription?->current_period_end ?? $intent->created_at->addMonth();

                $invoice = [
                    'id' => $invoiceId,
                    'type' => 'payment',
                    'date' => $intent->created_at->toISOString(),
                    'date_formatted' => $intent->created_at->format('d/m/Y'),
                    'description' => $this->getInvoiceDescription($intent),
                    'period' => $intent->period,
                    'users_count' => $intent->users_count,
                    'storage_gb' => $intent->storage_gb,
                    'modules' => $intent->modules ?? [],
                    'subtotal' => $subtotal,
                    'discount' => $totals['discount'] ?? 0,
                    'tax' => $totals['tax'] ?? 0,
                    'total' => $total,
                    'totals' => $totals,
                    'currency' => 'COP',
                    'status' => 'paid',
                    'period_start' => $periodStart->format('d/m/Y'),
                    'period_end' => $periodEnd->format('d/m/Y'),
                ];

            } elseif ($type === 'SUB') {
                // Buscar en subscriptions
                $subscription = Subscription::where('id', $id)
                    ->where('user_id', $user->id)
                    ->whereIn('status', ['active', 'canceled'])
                    ->first();

                if (!$subscription) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Factura no encontrada'
                    ], 404);
                }

                $totals = $subscription->totals ?? [];
                $subtotal = $totals['subtotal'] ?? $totals['subtotalMonthly'] ?? 0;
                $total = $totals['total'] ?? $totals['subtotalMonthly'] ?? 0;
                
                if ($subscription->period === 'annual' && isset($totals['totalAnnualEquivalent'])) {
                    $total = $totals['totalAnnualEquivalent'];
                    $subtotal = $totals['totalAnnualEquivalent'];
                }

                $invoice = [
                    'id' => $invoiceId,
                    'type' => 'payment',
                    'date' => $subscription->starts_at?->toISOString() ?? $subscription->created_at->toISOString(),
                    'date_formatted' => ($subscription->starts_at ?? $subscription->created_at)->format('d/m/Y'),
                    'description' => $this->getSubscriptionDescription($subscription),
                    'period' => $subscription->period,
                    'users_count' => $subscription->users_count,
                    'storage_gb' => $subscription->storage_gb,
                    'modules' => $subscription->modules ?? [],
                    'subtotal' => $subtotal,
                    'discount' => $totals['discount'] ?? 0,
                    'tax' => $totals['tax'] ?? 0,
                    'total' => $total,
                    'totals' => $totals,
                    'currency' => 'COP',
                    'status' => 'paid',
                    'period_start' => ($subscription->starts_at ?? $subscription->created_at)->format('d/m/Y'),
                    'period_end' => ($subscription->current_period_end ?? $subscription->created_at->addMonth())->format('d/m/Y'),
                ];
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Tipo de factura no soportado'
                ], 400);
            }

            // Preparar datos del broker
            $brokerData = [
                'name' => $broker->name ?? 'Cliente',
                'document_number' => $broker->document_number ?? null,
                'email' => $broker->email ?? $user->email,
                'phone' => $broker->phone ?? null,
                'address' => $broker->address ?? null,
            ];

            // Generar PDF
            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.factura-suscripcion', [
                'invoice' => $invoice,
                'broker' => $brokerData,
            ]);

            $pdf->setPaper('letter', 'portrait');

            $filename = "Factura-{$invoiceId}.pdf";

            return $pdf->download($filename);

        } catch (\Exception $e) {
            Log::error('Error descargando factura', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al generar la factura: ' . $e->getMessage()
            ], 500);
        }
    }
}
