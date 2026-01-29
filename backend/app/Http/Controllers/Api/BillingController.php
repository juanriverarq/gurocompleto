<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Subscription;
use App\Models\SubscriptionIntent;
use App\Models\PaymentSession;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BillingController extends Controller
{
    /**
     * Devuelve el estado de suscripción del usuario autenticado.
     * - has_active_subscription
     * - active_subscription (si existe)
     * - pending_intent (última intención pendiente si no hay activa)
     * - is_first_purchase (verdadero si nunca ha tenido suscripciones)
     */
    public function status(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        }

        $now = now();
        $active = Subscription::where('user_id', $user->id)
            ->where('status', 'active')
            ->where(function ($q) use ($now) {
                $q->whereNull('current_period_end')->orWhere('current_period_end', '>=', $now);
            })
            ->latest('id')
            ->first();

        $hasActive = !!$active;
        $hasAny = Subscription::where('user_id', $user->id)->exists();
        $isFirstPurchase = !$hasAny;

        $pendingIntent = null;
        if (!$hasActive) {
            $pendingIntent = SubscriptionIntent::where('user_id', $user->id)
                ->where('status', 'pending')
                ->latest('id')
                ->first();
        }

        return response()->json([
            'success' => true,
            'data' => [
                'has_active_subscription' => $hasActive,
                'active_subscription' => $active,
                'pending_intent' => $pendingIntent,
                'is_first_purchase' => $isFirstPurchase,
            ],
        ]);
    }

    /**
     * Crear link de pago Wompi Checkout usando firma de integridad.
     */
    public function createCheckoutLink(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        }

        $intentId = $request->input('intent_id');
        $intent = null;
        if ($intentId) {
            $intent = SubscriptionIntent::where('user_id', $user->id)->where('id', $intentId)->first();
        }
        if (!$intent) {
            $intent = SubscriptionIntent::where('user_id', $user->id)->where('status', 'pending')->latest('id')->first();
        }
        if (!$intent) {
            return response()->json(['success' => false, 'message' => 'No hay intención de suscripción pendiente'], 404);
        }

        // Calcular monto
        $currency = 'COP';
        $totals = is_array($intent->totals) ? $intent->totals : [];
        $coupon = is_array($intent->coupon) ? $intent->coupon : [];
        $hasSuraCoupon = ($coupon['code'] ?? '') === 'SURA30';
        
        $amount = 0;
        if ($intent->period === 'annual') {
            if ($hasSuraCoupon) {
                // Para Sura: usar subtotal SIN descuento 12%, luego aplicar 30% Sura
                $subtotalWithDiscount = (int) ($totals['subtotalAnnual'] ?? $totals['totalAnnualEquivalent'] ?? 0);
                $discountAnnual = (int) ($totals['discountAnnual'] ?? 0);
                $subtotalBeforeDiscount = $subtotalWithDiscount + $discountAnnual;
                // Aplicar solo 30% de Sura
                $suraDiscount = (int) round($subtotalBeforeDiscount * 0.30);
                $amount = $subtotalBeforeDiscount - $suraDiscount;
            } else {
                // Flujo normal: usar subtotalAnnual o totalAnnualEquivalent (calculado dinámicamente)
                $amount = (int) ($totals['subtotalAnnual'] ?? $totals['totalAnnualEquivalent'] ?? $totals['total'] ?? 0);
            }
        } else {
            $amount = (int) ($totals['subtotalMonthly'] ?? $totals['total'] ?? 0);
        }
        
        // Si el monto sigue siendo 0, calcular dinámicamente basado en módulos
        if ($amount <= 0) {
            $modules = is_array($intent->modules) ? $intent->modules : [];
            $usersCount = $intent->users_count ?? 1;
            $storageGb = $intent->storage_gb ?? 10;
            
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
            
            $basePrice = 0;
            foreach ($modules as $module) {
                $moduleKey = is_array($module) ? ($module['id'] ?? $module['key'] ?? '') : $module;
                if (isset($modulePrices[$moduleKey])) {
                    $basePrice += $modulePrices[$moduleKey];
                }
            }
            
            if ($basePrice == 0) {
                $basePrice = 50000; // Precio base mínimo
            }
            
            $subtotalMonthly = $basePrice * $usersCount;
            $extraStorage = max(0, $storageGb - 10);
            $subtotalMonthly += $extraStorage * 5000;
            
            if ($intent->period === 'annual') {
                $amount = (int) ($subtotalMonthly * 12 * 0.80); // 20% descuento anual
            } else {
                $amount = $subtotalMonthly;
            }
        }
        
        // Wompi espera el monto en centavos para COP (pero COP no tiene centavos, así que es el valor directo)
        $amountInCents = $amount * 100; // Convertir a centavos para Wompi
        if ($amountInCents <= 0) {
            return response()->json(['success' => false, 'message' => 'El monto es inválido'], 422);
        }

        // Construir referencia y firma
        $reference = 'GURO-' . $intent->id . '-' . time();
        $integrityKey = (string) config('wompi.integrity_key');
        $publicKey = (string) config('wompi.public_key');
        $env = config('wompi.env', 'sandbox');
        $checkoutBase = 'https://checkout.wompi.co/p/';

        $signatureRaw = $reference . $amountInCents . $currency . $integrityKey;
        $signature = hash('sha256', $signatureRaw);

        // URL de retorno (frontend) - siempre usar el Origin del request para obtener la URL del frontend
        $origin = $request->headers->get('Origin');
        if ($origin) {
            $frontendBase = rtrim($origin, '/');
        } else {
            // Fallback: usar APP_URL o construir desde el host
            $frontendBase = rtrim(config('app.frontend_url', config('app.url')), '/');
            // Si sigue apuntando al backend, usar el referer
            if (str_contains($frontendBase, ':8001') || str_contains($frontendBase, '/api')) {
                $referer = $request->headers->get('Referer');
                if ($referer) {
                    $parsed = parse_url($referer);
                    $frontendBase = ($parsed['scheme'] ?? 'http') . '://' . ($parsed['host'] ?? 'localhost') . (isset($parsed['port']) ? ':' . $parsed['port'] : '');
                }
            }
        }
        // Anexar referencia y monto al redirect para que el frontend pueda confirmar sin consultar primero a Wompi
        $redirectUrl = $frontendBase . '/wallet/return?ref=' . urlencode($reference) . '&amount=' . $amountInCents;

        // Construir query
        $query = http_build_query([
            'public-key' => $publicKey,
            'currency' => $currency,
            'amount-in-cents' => $amountInCents,
            'reference' => $reference,
            'redirect-url' => $redirectUrl,
            'signature:integrity' => $signature,
            'customer-data:email' => $user->email,
            'customer-data:full-name' => $user->name,
        ]);

        $checkoutUrl = $checkoutBase . '?' . $query;

        // Registrar sesión de pago
        $session = PaymentSession::create([
            'user_id' => $user->id,
            'intent_id' => $intent->id,
            'reference' => $reference,
            'amount_in_cents' => $amountInCents,
            'currency' => $currency,
            'status' => 'pending',
            'checkout_url' => $checkoutUrl,
            'redirect_url' => $redirectUrl,
            'metadata' => [
                'period' => $intent->period,
            ],
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'reference' => $reference,
                'checkout_url' => $checkoutUrl,
            ],
        ]);
    }

    /**
     * Confirmación de pago (retorno desde Wompi).
     * Verifica la transacción en Wompi y activa la suscripción si corresponde.
     */
    public function confirmWompi(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
        }

        $reference = trim((string) $request->input('reference', ''));
        $transactionId = trim((string) $request->input('transaction_id', ''));

        $status = 'pending';
        $txReference = null;
        try {
            if ($transactionId !== '') {
                $base = config('wompi.base_urls.' . config('wompi.env', 'sandbox'));
                $resp = Http::withToken(config('wompi.private_key'))->get($base . '/transactions/' . $transactionId);
                if ($resp->ok()) {
                    $data = $resp->json();
                    $status = strtolower($data['data']['status'] ?? 'PENDING');
                    $txReference = (string) ($data['data']['reference'] ?? '');
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Error consultando transacción Wompi', ['error' => $e->getMessage()]);
        }

        // Resolver referencia si no llegó en el request
        if ($reference === '' && $txReference) {
            $reference = $txReference;
        }

        // Resolver sesión de pago
        $session = null;
        if ($reference !== '') {
            $session = PaymentSession::where('reference', $reference)->where('user_id', $user->id)->latest('id')->first();
        }
        if (!$session && $transactionId !== '') {
            $session = PaymentSession::where('wompi_transaction_id', $transactionId)->where('user_id', $user->id)->latest('id')->first();
        }
        if (!$session) {
            return response()->json(['success' => false, 'message' => 'Sesión de pago no encontrada'], 404);
        }

        // Si ya aprobada, responder OK
        if ($session->status === 'approved') {
            return response()->json(['success' => true, 'message' => 'Pago ya confirmado previamente']);
        }

        // Actualizar info conocida de la transacción
        try {
            if ($transactionId !== '') {
                if (!$txReference) {
                    // Ya consultado arriba, pero si falló, intentarlo nuevamente mínimo
                    $base = config('wompi.base_urls.' . config('wompi.env', 'sandbox'));
                    $resp = Http::withToken(config('wompi.private_key'))->get($base . '/transactions/' . $transactionId);
                    if ($resp->ok()) {
                        $data = $resp->json();
                        $status = strtolower($data['data']['status'] ?? $status);
                        $txReference = (string) ($data['data']['reference'] ?? $txReference);
                    }
                }
                if ($session->wompi_transaction_id !== $transactionId) {
                    $session->wompi_transaction_id = $transactionId;
                }
            }
        } catch (\Throwable $e) {}

        // Normalizar estados
        if (in_array($status, ['approved', 'success', 'approved_partial'])) {
            $session->status = 'approved';
        } elseif (in_array($status, ['declined', 'voided'])) {
            $session->status = 'declined';
        } else {
            $session->status = 'pending';
        }
        $session->save();

        if ($session->status === 'approved') {
            // Activar suscripción a partir del intent
            $intent = $session->intent_id ? SubscriptionIntent::find($session->intent_id) : null;
            if ($intent) {
                $periodEnd = $intent->period === 'annual' ? now()->addYear() : now()->addMonth();
                Subscription::create([
                    'user_id' => $user->id,
                    'status' => 'active',
                    'period' => $intent->period,
                    'users_count' => $intent->users_count,
                    'storage_gb' => $intent->storage_gb,
                    'modules' => $intent->modules,
                    'totals' => $intent->totals,
                    'intent_id' => $intent->id,
                    'starts_at' => now(),
                    'current_period_end' => $periodEnd,
                ]);
                $intent->status = 'completed';
                $intent->save();
            }
            return response()->json(['success' => true]);
        }

        return response()->json(['success' => false, 'message' => 'Pago pendiente o no aprobado aún']);
    }
}


