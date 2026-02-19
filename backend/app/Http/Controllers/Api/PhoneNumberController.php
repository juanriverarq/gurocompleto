<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Cache;

class PhoneNumberController extends Controller
{
    /**
     * Step 1: Initiate Twilio Verified Caller ID.
     * Twilio will call the user's phone. Returns the validation_code to show on screen.
     */
    public function initiateVerification(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'phone_number'  => 'required|string|min:10|max:20',
            'friendly_name' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Datos inválidos'], 422);
        }

        $twilioSid   = env('TWILIO_ACCOUNT_SID');
        $twilioToken = env('TWILIO_AUTH_TOKEN');

        if (!$twilioSid || !$twilioToken) {
            return response()->json(['success' => false, 'message' => 'Twilio no está configurado.'], 500);
        }

        $phoneNumber  = $this->formatE164($request->phone_number);
        $friendlyName = $request->friendly_name ?: 'Guro Voice AI - ' . $phoneNumber;

        try {
            // Check if already verified
            $existing = $this->findTwilioCallerId($phoneNumber, $twilioSid, $twilioToken);
            if ($existing) {
                // Already verified in Twilio — skip call, go straight to ElevenLabs
                $brokerId = $this->getBrokerId($request);
                Cache::put("phone_verify:{$brokerId}:{$phoneNumber}", [
                    'friendly_name' => $friendlyName,
                ], 600);

                return response()->json([
                    'success'          => true,
                    'already_verified' => true,
                    'message'          => 'Este número ya está verificado en Twilio.',
                ]);
            }

            // Initiate Twilio Outgoing Caller ID verification (phone call)
            $response = Http::withBasicAuth($twilioSid, $twilioToken)
                ->asForm()
                ->post("https://api.twilio.com/2010-04-01/Accounts/{$twilioSid}/OutgoingCallerIds.json", [
                    'PhoneNumber'  => $phoneNumber,
                    'FriendlyName' => $friendlyName,
                ]);

            if (!$response->successful()) {
                $error = $response->json();
                Log::error('📞 [PHONE] Twilio Caller ID initiation failed', [
                    'status' => $response->status(),
                    'error'  => $error,
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'Error de Twilio: ' . ($error['message'] ?? 'No se pudo iniciar la verificación'),
                ], 400);
            }

            $data            = $response->json();
            $validationCode  = $data['validation_code'] ?? null;
            $callSid         = $data['call_sid'] ?? null;

            // Cache for polling
            $brokerId = $this->getBrokerId($request);
            Cache::put("phone_verify:{$brokerId}:{$phoneNumber}", [
                'friendly_name'   => $friendlyName,
                'validation_code' => $validationCode,
                'call_sid'        => $callSid,
                'initiated_at'    => now()->toISOString(),
            ], 600);

            Log::info('📞 [PHONE] Verification call initiated', [
                'broker_id'       => $brokerId,
                'phone'           => $phoneNumber,
                'validation_code' => $validationCode,
            ]);

            return response()->json([
                'success'         => true,
                'validation_code' => $validationCode,
                'message'         => 'Twilio está llamando a tu número. Contesta y digita el código que aparece en pantalla.',
            ]);

        } catch (\Throwable $e) {
            Log::error('📞 [PHONE] Initiation error', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Step 2: Check if the Twilio Caller ID verification completed.
     * If verified, auto-register in ElevenLabs + save to broker.
     */
    public function checkVerification(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'phone_number' => 'required|string|min:10|max:20',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Número requerido'], 422);
        }

        $twilioSid   = env('TWILIO_ACCOUNT_SID');
        $twilioToken = env('TWILIO_AUTH_TOKEN');

        if (!$twilioSid || !$twilioToken) {
            return response()->json(['success' => false, 'message' => 'Twilio no configurado'], 500);
        }

        $phoneNumber = $this->formatE164($request->phone_number);

        try {
            // Check if the number is now in Twilio's Verified Caller IDs
            $callerId = $this->findTwilioCallerId($phoneNumber, $twilioSid, $twilioToken);

            if (!$callerId) {
                return response()->json([
                    'success'  => true,
                    'verified' => false,
                    'message'  => 'Aún no verificado. Contesta la llamada y digita el código.',
                ]);
            }

            // Verified! Now register in ElevenLabs + save
            $brokerId        = $this->getBrokerId($request);
            $cacheKey         = "phone_verify:{$brokerId}:{$phoneNumber}";
            $cached           = Cache::get($cacheKey, []);
            $friendly         = $cached['friendly_name'] ?? 'Guro Voice AI - ' . $phoneNumber;
            $elevenLabsApiKey = env('ELEVENLABS_API_KEY');

            // Register in ElevenLabs
            $phoneNumberId = null;
            if ($elevenLabsApiKey) {
                try {
                    $elResponse = Http::withHeaders([
                        'xi-api-key'   => $elevenLabsApiKey,
                        'Content-Type' => 'application/json',
                    ])->post('https://api.elevenlabs.io/v1/convai/phone-numbers', [
                        'phone_number' => $phoneNumber,
                        'label'        => $friendly,
                        'provider'     => 'twilio',
                        'sid'          => $twilioSid,
                        'token'        => $twilioToken,
                    ]);

                    if ($elResponse->successful()) {
                        $elData = $elResponse->json();
                        $phoneNumberId = $elData['phone_number_id'] ?? $elData['id'] ?? null;
                        Log::info('📞 [PHONE] Registered in ElevenLabs', ['id' => $phoneNumberId]);
                    } else {
                        $elError = $elResponse->json();
                        Log::warning('📞 [PHONE] ElevenLabs registration failed', [
                            'status' => $elResponse->status(),
                            'body'   => $elError,
                        ]);
                        $phoneNumberId = $this->findExistingElevenLabsPhoneNumber($phoneNumber, $elevenLabsApiKey);
                    }
                } catch (\Throwable $e) {
                    Log::warning('📞 [PHONE] ElevenLabs error', ['msg' => $e->getMessage()]);
                }
            }

            // Register in VAPI
            $vapiPhoneNumberId = null;
            $vapiApiKey = env('VAPI_PRIVATE_KEY');
            if ($vapiApiKey) {
                try {
                    $vapiResponse = Http::withHeaders([
                        'Authorization' => 'Bearer ' . $vapiApiKey,
                        'Content-Type'  => 'application/json',
                    ])->post('https://api.vapi.ai/phone-number', [
                        'provider'         => 'twilio',
                        'number'           => $phoneNumber,
                        'twilioAccountSid' => $twilioSid,
                        'twilioAuthToken'  => $twilioToken,
                        'name'             => $friendly,
                    ]);

                    if ($vapiResponse->successful()) {
                        $vapiData = $vapiResponse->json();
                        $vapiPhoneNumberId = $vapiData['id'] ?? null;
                        Log::info('📞 [PHONE] Registered in VAPI', ['id' => $vapiPhoneNumberId]);
                    } else {
                        Log::warning('📞 [PHONE] VAPI registration failed', [
                            'status' => $vapiResponse->status(),
                            'body'   => $vapiResponse->json(),
                        ]);
                    }
                } catch (\Throwable $e) {
                    Log::warning('📞 [PHONE] VAPI error', ['msg' => $e->getMessage()]);
                }
            }

            // Save to broker
            $this->saveBrokerPhoneNumber($request, $phoneNumber, $phoneNumberId, $friendly, $vapiPhoneNumberId);
            Cache::forget($cacheKey);

            Log::info('📞 [PHONE] Full registration complete', [
                'broker_id'            => $brokerId,
                'phone'                => $phoneNumber,
                'phone_number_id'      => $phoneNumberId,
                'vapi_phone_number_id' => $vapiPhoneNumberId,
            ]);

            return response()->json([
                'success'              => true,
                'verified'             => true,
                'message'              => '¡Número verificado y registrado! Ya puedes usarlo en campañas de Voice AI.',
                'phone_number'         => $phoneNumber,
                'phone_number_id'      => $phoneNumberId,
                'vapi_phone_number_id' => $vapiPhoneNumberId,
            ]);

        } catch (\Throwable $e) {
            Log::error('📞 [PHONE] Check error', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get the broker's registered phone numbers.
     */
    public function getPhoneNumbers(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $broker = \App\Models\Broker::find($brokerId);
            if (!$broker) {
                return response()->json(['success' => true, 'phone_numbers' => []]);
            }

            $settings = is_array($broker->settings) ? $broker->settings : [];
            $phoneNumbers = $settings['voice_phone_numbers'] ?? [];

            return response()->json([
                'success'       => true,
                'phone_numbers' => $phoneNumbers,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['success' => true, 'phone_numbers' => []]);
        }
    }

    /**
     * Delete a registered phone number.
     */
    public function deletePhoneNumber(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'phone_number_id' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'ID requerido'], 422);
        }

        try {
            $brokerId      = $this->getBrokerId($request);
            $phoneNumberId = $request->phone_number_id;

            // Delete from ElevenLabs
            $elevenLabsApiKey = env('ELEVENLABS_API_KEY');
            if ($elevenLabsApiKey) {
                Http::withHeaders([
                    'xi-api-key' => $elevenLabsApiKey,
                ])->delete("https://api.elevenlabs.io/v1/convai/phone-numbers/{$phoneNumberId}");
            }

            // Remove from broker settings
            $broker = \App\Models\Broker::find($brokerId);
            if ($broker) {
                $settings     = is_array($broker->settings) ? $broker->settings : [];
                $phoneNumbers = $settings['voice_phone_numbers'] ?? [];
                $phoneNumbers = array_values(array_filter($phoneNumbers, fn($p) => ($p['phone_number_id'] ?? '') !== $phoneNumberId));
                $settings['voice_phone_numbers'] = $phoneNumbers;
                $broker->settings = $settings;
                $broker->save();
            }

            return response()->json(['success' => true, 'message' => 'Número eliminado exitosamente.']);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // ─── Helpers ──────────────────────────────────────────────

    private function formatE164(string $phone): string
    {
        $phone = preg_replace('/[^0-9+]/', '', $phone);
        if (!str_starts_with($phone, '+')) {
            if (strlen($phone) === 10) {
                $phone = '+57' . $phone;
            } else {
                $phone = '+' . $phone;
            }
        }
        return $phone;
    }

    private function getBrokerId(Request $request)
    {
        if ($request->has('authenticated_broker_id')) {
            return (int) $request->get('authenticated_broker_id');
        }
        $user = $request->user() ?: \Illuminate\Support\Facades\Auth::user();
        if ($user && $user->broker_id) return (int) $user->broker_id;
        return null;
    }

    /**
     * Check if a phone number exists in Twilio Verified Caller IDs.
     */
    private function findTwilioCallerId(string $phoneNumber, string $sid, string $token): ?string
    {
        try {
            $response = Http::withBasicAuth($sid, $token)
                ->get("https://api.twilio.com/2010-04-01/Accounts/{$sid}/OutgoingCallerIds.json", [
                    'PhoneNumber' => $phoneNumber,
                ]);

            if ($response->successful()) {
                $callerIds = $response->json('outgoing_caller_ids') ?? [];
                foreach ($callerIds as $cid) {
                    if (($cid['phone_number'] ?? '') === $phoneNumber) {
                        return $cid['sid'] ?? null;
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::warning('📞 [PHONE] Could not check Twilio Caller IDs', ['error' => $e->getMessage()]);
        }
        return null;
    }

    private function saveBrokerPhoneNumber(Request $request, string $phoneNumber, ?string $phoneNumberId, string $label, ?string $vapiPhoneNumberId = null): void
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $broker = \App\Models\Broker::find($brokerId);
            if (!$broker) return;

            $settings     = is_array($broker->settings) ? $broker->settings : [];
            $phoneNumbers = $settings['voice_phone_numbers'] ?? [];

            $exists = false;
            foreach ($phoneNumbers as &$p) {
                if (($p['phone_number'] ?? '') === $phoneNumber) {
                    $p['phone_number_id'] = $phoneNumberId;
                    $p['label']           = $label;
                    $p['updated_at']      = now()->toISOString();
                    if ($vapiPhoneNumberId) $p['vapi_phone_number_id'] = $vapiPhoneNumberId;
                    $exists = true;
                    break;
                }
            }
            unset($p);

            if (!$exists) {
                $entry = [
                    'phone_number'    => $phoneNumber,
                    'phone_number_id' => $phoneNumberId,
                    'label'           => $label,
                    'verified'        => true,
                    'created_at'      => now()->toISOString(),
                ];
                if ($vapiPhoneNumberId) $entry['vapi_phone_number_id'] = $vapiPhoneNumberId;
                $phoneNumbers[] = $entry;
            }

            $settings['voice_phone_numbers'] = $phoneNumbers;
            $broker->settings = $settings;
            $broker->save();

            Log::info('📞 [PHONE] Saved to broker', [
                'broker_id'       => $brokerId,
                'phone'           => $phoneNumber,
                'phone_number_id' => $phoneNumberId,
            ]);
        } catch (\Throwable $e) {
            Log::warning('📞 [PHONE] Could not save to broker', ['error' => $e->getMessage()]);
        }
    }

    private function findExistingElevenLabsPhoneNumber(string $phoneNumber, string $apiKey): ?string
    {
        try {
            $response = Http::withHeaders([
                'xi-api-key' => $apiKey,
            ])->get('https://api.elevenlabs.io/v1/convai/phone-numbers');

            if ($response->successful()) {
                $numbers = $response->json('phone_numbers') ?? $response->json() ?? [];
                foreach ($numbers as $num) {
                    if (($num['phone_number'] ?? '') === $phoneNumber) {
                        return $num['phone_number_id'] ?? $num['id'] ?? null;
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::warning('📞 [PHONE] Could not search ElevenLabs numbers', ['error' => $e->getMessage()]);
        }
        return null;
    }
}
