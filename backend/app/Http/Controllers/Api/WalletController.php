<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use App\Traits\RequiresAuth;
use App\Models\Broker;

class WalletController extends Controller
{
    use RequiresAuth;

    /**
     * Obtener el saldo del wallet del usuario autenticado
     */
    public function getBalance(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $brokerId = $this->getBrokerId($request);

            if (!$user || !$brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario o broker no autenticado'
                ], 401);
            }

            // Obtener o crear wallet del broker (fuente de los débitos por llamadas)
            $wallet = Wallet::firstOrCreate(
                ['broker_id' => $brokerId],
                [
                    'user_id' => $user->id,
                    'balance_cop' => 0,
                    'balance_usd' => 0,
                    'pending_balance' => 0,
                    'total_earnings' => 0,
                    'is_active' => true
                ]
            );

            // Determinar moneda de visualización desde la configuración del broker (fallback COP)
            $broker = Broker::find($brokerId);
            $displayCurrency = strtoupper($broker->settings['currency'] ?? 'COP');
            if (!in_array($displayCurrency, ['COP', 'USD'])) {
                $displayCurrency = 'COP';
            }

            $displayBalance = $displayCurrency === 'USD' ? (float) $wallet->balance_usd : (float) $wallet->balance_cop;

            return response()->json([
                'success' => true,
                'data' => [
                    'balance_cop' => $wallet->balance_cop,
                    'balance_usd' => $wallet->balance_usd,
                    'pending_balance' => $wallet->pending_balance,
                    'total_earnings' => $wallet->total_earnings,
                    'formatted_balance_cop' => $wallet->formatted_balance_cop,
                    'available_balance_cop' => $wallet->available_balance_cop,
                    'is_active' => $wallet->is_active,
                    'display_currency' => $displayCurrency,
                    'display_balance' => $displayBalance,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('💰 [WALLET] Error obteniendo saldo', [
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al obtener saldo del wallet',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Agregar fondos al wallet
     */
    public function addFunds(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'amount' => 'required|numeric|min:0.01',
                'currency' => 'sometimes|in:COP,USD',
                'description' => 'nullable|string|max:255'
            ]);

            $user = $request->user();
            $brokerId = $this->getBrokerId($request);
            $wallet = Wallet::firstOrCreate(['broker_id' => $brokerId], [
                'user_id' => $user?->id,
                'balance_cop' => 0,
                'balance_usd' => 0,
                'pending_balance' => 0,
                'total_earnings' => 0,
                'is_active' => true,
            ]);

            $amount = $request->amount;
            $currency = $request->get('currency', 'COP');
            $description = $request->get('description', 'Fondos agregados');

            if ($wallet->addFunds($amount, $currency)) {
                Log::info('💰 [WALLET] Fondos agregados', [
                    'user_id' => $user->id,
                    'amount' => $amount,
                    'currency' => $currency,
                    'description' => $description
                ]);

                return response()->json([
                    'success' => true,
                    'message' => "Fondos agregados exitosamente: {$amount} {$currency}",
                    'data' => [
                        'new_balance' => $currency === 'COP' ? $wallet->balance_cop : $wallet->balance_usd,
                        'formatted_balance_cop' => $wallet->formatted_balance_cop
                    ]
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Error al agregar fondos'
            ], 400);

        } catch (\Exception $e) {
            Log::error('💰 [WALLET] Error agregando fondos', [
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al agregar fondos',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Retirar fondos del wallet
     */
    public function withdrawFunds(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'amount' => 'required|numeric|min:0.01',
                'currency' => 'sometimes|in:COP,USD',
                'description' => 'nullable|string|max:255'
            ]);

            $user = $request->user();
            $brokerId = $this->getBrokerId($request);
            $wallet = Wallet::where('broker_id', $brokerId)->first();

            if (!$wallet) {
                return response()->json([
                    'success' => false,
                    'message' => 'Wallet no encontrado'
                ], 404);
            }

            $amount = $request->amount;
            $currency = $request->get('currency', 'COP');
            $description = $request->get('description', 'Fondos retirados');

            // Verificar fondos suficientes
            $currentBalance = $currency === 'COP' ? $wallet->balance_cop : $wallet->balance_usd;
            if ($currentBalance < $amount) {
                return response()->json([
                    'success' => false,
                    'message' => 'Fondos insuficientes',
                    'data' => [
                        'requested_amount' => $amount,
                        'available_balance' => $currentBalance,
                        'currency' => $currency
                    ]
                ], 400);
            }

            if ($wallet->withdrawFunds($amount, $currency)) {
                Log::info('💰 [WALLET] Fondos retirados', [
                    'user_id' => $user->id,
                    'amount' => $amount,
                    'currency' => $currency,
                    'description' => $description
                ]);

                return response()->json([
                    'success' => true,
                    'message' => "Fondos retirados exitosamente: {$amount} {$currency}",
                    'data' => [
                        'new_balance' => $currency === 'COP' ? $wallet->balance_cop : $wallet->balance_usd,
                        'formatted_balance_cop' => $wallet->formatted_balance_cop
                    ]
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Error al retirar fondos'
            ], 400);

        } catch (\Exception $e) {
            Log::error('💰 [WALLET] Error retirando fondos', [
                'user_id' => $request->user()?->id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al retirar fondos',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener historial de transacciones (placeholder para futuro)
     */
    public function getTransactionHistory(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $brokerId = $this->getBrokerId($request);

            if (!$user || !$brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario o broker no autenticado'
                ], 401);
            }

            $wallet = Wallet::where('broker_id', $brokerId)->first();
            if (!$wallet) {
                return response()->json([
                    'success' => true,
                    'data' => [],
                ]);
            }

            $transactions = WalletTransaction::where('wallet_id', $wallet->id)
                ->orderBy('id', 'desc')
                ->take(20)
                ->get()
                ->map(function (WalletTransaction $tx) {
                    return [
                        'id' => $tx->id,
                        'type' => $tx->type,
                        'amount_cop' => (float) $tx->amount_cop,
                        'currency' => $tx->currency,
                        'description' => $tx->description,
                        'reference_type' => $tx->reference_type,
                        'reference_id' => $tx->reference_id,
                        'balance_cop_after' => (float) $tx->balance_cop_after,
                        'created_at' => $tx->created_at?->toDateTimeString(),
                        'metadata' => $tx->metadata,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => $transactions,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener historial',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Iniciar intento de pago con Wompi (Checkout Redirect)
     * Retorna el URL de checkout para redirigir al usuario
     */
    public function wompiCheckout(Request $request): JsonResponse
    {
        $request->validate([
            'amount_cents' => 'required|integer|min:100',
            'currency' => 'required|in:COP',
            'reference' => 'required|string|max:64',
            'customer_email' => 'required|email',
            'redirect_url' => 'required|url'
        ]);

        $env = config('wompi.env', 'sandbox');
        $baseUrl = config('wompi.base_urls.' . $env);
        $publicKey = config('wompi.public_key');
        $privateKey = config('wompi.private_key');

        if (!$publicKey) {
            return response()->json([
                'success' => false,
                'message' => 'WOMPI_PUBLIC_KEY no configurado'
            ], 500);
        }

        // Armar payload para Payment Link (Checkout Redirect)
        $payload = [
            'public_key' => $publicKey,
            'amount_in_cents' => (int) $request->integer('amount_cents'),
            'currency' => $request->string('currency'),
            'reference' => $request->string('reference'),
            'redirect_url' => $request->string('redirect_url'),
            'customer_email' => $request->string('customer_email'),
            // Campos requeridos por Wompi para payment_links
            'name' => 'Recarga Wallet',
            'description' => 'Recarga de saldo de Wallet',
            'single_use' => true,
            'collect_shipping' => false,
        ];

        // Crear Link de pago
        $http = Http::timeout(15);
        if ($privateKey) {
            $http = $http->withToken($privateKey);
        }
        $response = $http->post($baseUrl . '/payment_links', $payload);

        if (!$response->successful()) {
            Log::error('💳 [WOMPI] Error creando payment_link', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error creando link de pago con Wompi',
            ], 502);
        }

        $data = $response->json();
        $checkoutUrl = $data['data']['payment_link'] ?? ($data['data']['url'] ?? null);
        if (!$checkoutUrl) {
            // Wompi retorna el id del Payment Link; el URL público se arma como https://checkout.wompi.co/l/{id}
            $paymentLinkId = $data['data']['id'] ?? null;
            if ($paymentLinkId) {
                $checkoutUrl = 'https://checkout.wompi.co/l/' . $paymentLinkId;
            }
        }

        if (!$checkoutUrl) {
            Log::error('💳 [WOMPI] Respuesta sin checkout URL', [ 'data' => $data ]);
            return response()->json([
                'success' => false,
                'message' => 'Respuesta de Wompi inválida',
                'data' => $data,
            ], 502);
        }

        return response()->json([
            'success' => true,
            'checkout_url' => $checkoutUrl,
            'provider' => 'wompi',
        ]);
    }

    /**
     * Webhook de Wompi para confirmar pagos
     */
    public function wompiWebhook(Request $request): JsonResponse
    {
        try {
            $signature = $request->header('X-Event-Signature-256');
            $secret = config('wompi.webhook_secret');
            $raw = $request->getContent();

            if ($secret && $signature) {
                $expected = 'sha256=' . hash_hmac('sha256', $raw, $secret);
                if (!hash_equals($expected, $signature)) {
                    return response()->json(['success' => false, 'message' => 'Firma inválida'], 401);
                }
            }

            $event = $request->input('event');
            $data = $request->input('data');
            $transaction = $data['transaction'] ?? [];

            $status = $transaction['status'] ?? null;
            if (($event === 'transaction.updated') && $status === 'APPROVED') {
                $amountInCents = (int) ($transaction['amount_in_cents'] ?? 0);
                $currency = $transaction['currency'] ?? 'COP';
                $reference = $transaction['reference'] ?? null;

                // Recuperar broker y wallet por referencia (convención: ref "wallet:{brokerId}:{uuid}")
                $brokerId = null;
                if ($reference && str_starts_with($reference, 'wallet:')) {
                    $parts = explode(':', $reference);
                    $brokerId = isset($parts[1]) ? (int) $parts[1] : null;
                }

                if ($brokerId) {
                    $wallet = Wallet::firstOrCreate(['broker_id' => $brokerId], [
                        'balance_cop' => 0,
                        'balance_usd' => 0,
                        'pending_balance' => 0,
                        'total_earnings' => 0,
                        'is_active' => true,
                    ]);

                    $amount = $currency === 'COP' ? ($amountInCents / 100) : 0;
                    if ($amount > 0) {
                        // Si había saldo pendiente, restarlo
                        if ($wallet->pending_balance > 0) {
                            $wallet->pending_balance = max(0, (float)$wallet->pending_balance - $amount);
                            $wallet->save();
                        }
                        $wallet->addFunds($amount, 'COP', 'Wompi APPROVED', [ 'wompi_transaction' => $transaction ]);
                    }
                }
            } elseif ($event === 'transaction.updated') {
                // Registrar estados no aprobados para visibilidad en el historial
                $reference = $transaction['reference'] ?? null;
                $brokerId = null;
                if ($reference && str_starts_with($reference, 'wallet:')) {
                    $parts = explode(':', $reference);
                    $brokerId = isset($parts[1]) ? (int) $parts[1] : null;
                }
                if ($brokerId) {
                    $wallet = Wallet::firstOrCreate(['broker_id' => $brokerId], [
                        'balance_cop' => 0,
                        'balance_usd' => 0,
                        'pending_balance' => 0,
                        'total_earnings' => 0,
                        'is_active' => true,
                    ]);
                    $amountInCents = (int) ($transaction['amount_in_cents'] ?? 0);
                    $currency = $transaction['currency'] ?? 'COP';
                    $amount = $currency === 'COP' ? ($amountInCents / 100) : 0;
                    if (in_array($status, ['PENDING', 'IN_PROCESS', 'STARTED'])) {
                        // Aumentar saldo pendiente y registrar hold
                        if ($amount > 0) {
                            $wallet->pending_balance = (float)$wallet->pending_balance + $amount;
                            $wallet->save();
                            \App\Models\WalletTransaction::create([
                                'wallet_id' => $wallet->id,
                                'broker_id' => $wallet->broker_id,
                                'user_id' => $wallet->user_id,
                                'type' => 'hold',
                                'amount_cop' => $amount,
                                'amount_usd' => 0,
                                'currency' => 'COP',
                                'description' => 'Wompi PENDING',
                                'balance_cop_after' => (float) $wallet->balance_cop,
                                'metadata' => [ 'wompi_transaction' => $transaction ],
                            ]);
                        }
                    } elseif (in_array($status, ['DECLINED', 'VOIDED', 'ERROR'])) {
                        // Liberar saldo pendiente (si había) y registrar failed
                        if ($amount > 0 && $wallet->pending_balance > 0) {
                            $wallet->pending_balance = max(0, (float)$wallet->pending_balance - $amount);
                            $wallet->save();
                        }
                        \App\Models\WalletTransaction::create([
                            'wallet_id' => $wallet->id,
                            'broker_id' => $wallet->broker_id,
                            'user_id' => $wallet->user_id,
                            'type' => 'failed',
                            'amount_cop' => 0,
                            'amount_usd' => 0,
                            'currency' => 'COP',
                            'description' => 'Wompi ' . ($status ?: 'FAILED'),
                            'balance_cop_after' => (float) $wallet->balance_cop,
                            'metadata' => [ 'wompi_transaction' => $transaction ],
                        ]);
                    }
                }
            }

            return response()->json(['success' => true]);
        } catch (\Throwable $e) {
            Log::error('💳 [WOMPI] Error procesando webhook', [
                'error' => $e->getMessage(),
            ]);
            return response()->json(['success' => false], 500);
        }
    }

    /**
     * Generar firma de integridad para Wompi Widget/Web Checkout
     */
    public function wompiSignature(Request $request): JsonResponse
    {
        $request->validate([
            'reference' => 'required|string|max:128',
            'amount_in_cents' => 'required|integer|min:100',
            'currency' => 'required|in:COP',
            'expiration_time' => 'nullable|string|max:64',
        ]);

        $integrityKey = config('wompi.integrity_key');
        $publicKey = config('wompi.public_key');
        if (!$integrityKey || !$publicKey) {
            return response()->json([
                'success' => false,
                'message' => 'INTEGRITY_KEY o PUBLIC_KEY no configurados',
            ], 500);
        }

        $reference = (string) $request->string('reference');
        $amountInCents = (string) $request->integer('amount_in_cents');
        $currency = (string) $request->string('currency');
        $expiration = (string) $request->string('expiration_time');

        $concatenated = $reference . $amountInCents . $currency;
        if ($expiration) {
            $concatenated .= $expiration;
        }
        $concatenated .= $integrityKey;

        $signature = hash('sha256', $concatenated);

        return response()->json([
            'success' => true,
            'data' => [
                'signature' => $signature,
                'public_key' => $publicKey,
            ],
        ]);
    }

    /**
     * Confirmar pago con Wompi por referencia (fallback si el webhook no llega)
     */
    public function wompiConfirm(Request $request): JsonResponse
    {
        $request->validate([
            'reference' => 'nullable|string|max:128',
            'transaction_id' => 'nullable|string|max:128',
        ]);

        $reference = (string) $request->string('reference');
        $transactionId = (string) $request->string('transaction_id');
        $env = config('wompi.env', 'sandbox');
        $baseUrl = config('wompi.base_urls.' . $env);
        $privateKey = config('wompi.private_key');

        if (!$privateKey) {
            return response()->json([
                'success' => false,
                'message' => 'WOMPI_PRIVATE_KEY no configurado'
            ], 500);
        }

        try {
            \Log::info('💳 [WOMPI] Confirm init', [
                'reference' => $reference,
                'transaction_id' => $transactionId
            ]);
            // Buscar transacción
            $resp = null;
            if ($transactionId) {
                $resp = Http::withToken($privateKey)->timeout(15)
                    ->get($baseUrl . '/transactions/' . urlencode($transactionId));
            } else {
                $resp = Http::withToken($privateKey)->timeout(15)
                    ->get($baseUrl . '/transactions', [ 'reference' => $reference ]);
            }

            if (!$resp->ok()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se pudo consultar transacción en Wompi',
                    'status' => $resp->status(),
                ], 502);
            }

            $json = $resp->json();
            $transactions = [];
            if ($transactionId) {
                $transactions = [$json['data'] ?? []];
            } else {
                $transactions = $json['data'] ?? [];
            }
            $approved = null;
            foreach ($transactions as $tx) {
                if (($tx['status'] ?? null) === 'APPROVED') {
                    $approved = $tx;
                    break;
                }
            }

            if (!$approved) {
                return response()->json([
                    'success' => false,
                    'message' => 'Transacción no aprobada aún',
                    'data' => $transactions,
                ], 202);
            }

            $amountInCents = (int) ($approved['amount_in_cents'] ?? 0);
            $currency = $approved['currency'] ?? 'COP';

            // Extraer brokerId de la referencia "wallet:{brokerId}:{uuid}"
            $brokerId = null;
            if ($reference && str_starts_with($reference, 'wallet:')) {
                $parts = explode(':', $reference);
                $brokerId = isset($parts[1]) ? (int) $parts[1] : null;
            }

            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Referencia inválida: no se encontró broker_id',
                ], 422);
            }

            $wallet = Wallet::firstOrCreate(['broker_id' => $brokerId], [
                'balance_cop' => 0,
                'balance_usd' => 0,
                'pending_balance' => 0,
                'total_earnings' => 0,
                'is_active' => true,
            ]);

            $amount = $currency === 'COP' ? ($amountInCents / 100) : 0;
            if ($amount > 0) {
                $credited = $wallet->addFunds($amount, 'COP');
                \Log::info('💰 [WALLET] Credited by Wompi confirm', [
                    'broker_id' => $wallet->broker_id,
                    'wallet_id' => $wallet->id,
                    'amount' => $amount,
                    'credited' => $credited,
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Pago confirmado y saldo acreditado',
                'data' => [
                    'credited_cop' => $amount,
                    'balance_cop' => $wallet->balance_cop,
                    'transaction_id' => $transactionId ?: ($approved['id'] ?? null),
                ]
            ]);
        } catch (\Throwable $e) {
            \Log::error('💳 [WOMPI] Error confirmando referencia', [ 'error' => $e->getMessage() ]);
            return response()->json([
                'success' => false,
                'message' => 'Error confirmando pago',
            ], 500);
        }
    }
}
