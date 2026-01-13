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
                $subtotalWithDiscount = (int) ($totals['subtotalAnnual'] ?? 0);
                $discountAnnual = (int) ($totals['discountAnnual'] ?? 0);
                $subtotalBeforeDiscount = $subtotalWithDiscount + $discountAnnual;
                // Aplicar solo 30% de Sura
                $suraDiscount = (int) round($subtotalBeforeDiscount * 0.30);
                $amount = $subtotalBeforeDiscount - $suraDiscount;
            } else {
                // Flujo normal: ya incluye descuento 12%
                $amount = (int) ($totals['subtotalAnnual'] ?? 0);
            }
        } else {
            $amount = (int) ($totals['subtotalMonthly'] ?? 0);
        }
        
        $amountInCents = $amount;
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

        // URL de retorno (frontend)
        $frontendBase = rtrim(config('app.url'), '/'); // en .env APP_URL debe apuntar al frontend si es monorepo
        // Si APP_URL apunta al backend, construir desde Origin de la request
        if (!$frontendBase || str_contains($frontendBase, '/api')) {
            $origin = $request->headers->get('Origin') ?: $request->getSchemeAndHttpHost();
            $frontendBase = rtrim($origin, '/');
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


