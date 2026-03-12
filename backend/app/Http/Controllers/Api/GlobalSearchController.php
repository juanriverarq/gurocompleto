<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;
use App\Models\Cliente;
use App\Models\Poliza;
use App\Models\Automovil;
use App\Models\Siniestro;
use App\Models\Campaign;
use App\Models\Vendedor;
// Modelos opcionales (la tabla puede no existir en algunas instalaciones)
use App\Models\VoiceCampaign;
use App\Models\EmailCampaign;
use App\Models\PolizaVinculado;

class GlobalSearchController extends Controller
{
    /**
     * Búsqueda global unificada por broker
     * GET /api/saas/search?q=...
     *
     * Retorna resultados combinados por tipo.
     */
    public function index(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        if ($q === '') {
            return response()->json([
                'success' => false,
                'message' => 'Parámetro q requerido',
            ], 400);
        }

        $perType = (int) $request->query('per_type', 5);
        $perType = max(1, min($perType, 10));

        // Debug: verificar broker_id resuelto
        $user = $request->user();
        $brokerId = $request->get('authenticated_broker_id')
            ?? ($user ? $user->broker_id : null)
            ?? \App\Services\BrokerAuthService::getCurrentBrokerId();

        // Si aún no hay broker_id, intentar obtenerlo desde el middleware
        if (!$brokerId) {
            try {
                $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request);
            } catch (\Throwable $e) {
                Log::warning('Error obteniendo broker_id desde middleware', ['error' => $e->getMessage()]);
            }
        }

        Log::info('GlobalSearch ejecutándose', [
            'q' => $q,
            'broker_id' => $brokerId,
            'user_id' => $user ? $user->id : null,
            'auth_type' => $request->get('auth_type'),
        ]);

        $results = [];
        $counts = [];

        // Clientes
        try {
            $clientes = Cliente::query()
                ->when($brokerId, fn($q) => $q->forBroker($brokerId))
                ->search($q)
                ->limit($perType)
                ->get();

            Log::info('GlobalSearch clientes', [
                'count' => $clientes->count(),
                'broker_id_used' => $brokerId,
                'q' => $q,
            ]);

            foreach ($clientes as $c) {
                $name = trim(
                    ($c->company_legal_name ?? '') !== ''
                        ? (string) $c->company_legal_name
                        : trim(($c->first_name ?? '') . ' ' . ($c->last_name ?? ''))
                );
                $subtitleParts = array_filter([
                    $c->document_number ? ('Doc: ' . $c->document_number) : null,
                    $c->email ?: null,
                    $c->mobile_phone ?: $c->phone,
                ]);
                $results[] = [
                    'type' => 'cliente',
                    'id' => $c->id,
                    'title' => $name !== '' ? $name : ('Cliente #' . $c->id),
                    'subtitle' => implode(' • ', $subtitleParts),
                    // Deep-link directo al modal de detalle del cliente
                    'url' => '/apps/seguros/clientes?open_client_id=' . $c->id,
                    'icon' => 'solar:user-bold-duotone',
                ];
            }
            $counts['cliente'] = isset($clientes) ? $clientes->count() : 0;
        } catch (\Throwable $e) {
            Log::warning('GlobalSearch clientes error', ['q' => $q, 'error' => $e->getMessage()]);
            $counts['cliente'] = 0;
        }

        // Pólizas
        try {
            $polizas = Poliza::query()
                ->when($brokerId, fn($q) => $q->forBroker($brokerId))
                ->search($q)
                ->limit($perType)
                ->get();

            Log::info('GlobalSearch polizas', [
                'count' => $polizas->count(),
                'q' => $q,
            ]);

            foreach ($polizas as $p) {
                $title = 'Póliza ' . ($p->policy_number ?: ('#' . $p->id));
                $subtitleParts = array_filter([
                    $p->client_name ? ('Cliente: ' . $p->client_name) : null,
                    $p->insurance_company ?: null,
                    $p->type ? ('Tipo: ' . $p->type) : null,
                ]);
                $results[] = [
                    'type' => 'poliza',
                    'id' => $p->id,
                    'title' => $title,
                    'subtitle' => implode(' • ', $subtitleParts),
                    // Deep-link directo al modal de detalle de la póliza
                    'url' => '/apps/seguros/polizas?open_policy_id=' . $p->id,
                    'icon' => 'solar:document-bold-duotone',
                ];
            }
            $counts['poliza'] = isset($polizas) ? $polizas->count() : 0;
        } catch (\Throwable $e) {
            Log::warning('GlobalSearch polizas error', ['q' => $q, 'error' => $e->getMessage()]);
            $counts['poliza'] = 0;
        }

        // Automóviles
        try {
            $autos = Automovil::query()
                ->when($brokerId, fn($q) => $q->where('broker_id', $brokerId))
                ->where(function ($qBuilder) use ($q) {
                    $qBuilder->where('placa', 'like', '%' . $q . '%')
                        ->orWhere('vin', 'like', '%' . $q . '%')
                        ->orWhere('marca', 'like', '%' . $q . '%')
                        ->orWhere('modelo', 'like', '%' . $q . '%')
                        ->orWhere('linea', 'like', '%' . $q . '%');
                })
                ->limit($perType)
                ->get();

            foreach ($autos as $a) {
                $title = trim(($a->placa ? ('Placa ' . Str::upper($a->placa)) : 'Automóvil #' . $a->id));
                $subtitleParts = array_filter([
                    $a->marca ?: null,
                    $a->modelo ?: null,
                    $a->anio ? (string) $a->anio : null,
                    $a->vin ? ('VIN ' . $a->vin) : null,
                ]);
                $results[] = [
                    'type' => 'automovil',
                    'id' => $a->id,
                    'title' => $title,
                    'subtitle' => implode(' • ', $subtitleParts),
                    // Deep-link directo al modal de edición del automóvil
                    'url' => '/apps/seguros/automoviles?open_auto_id=' . $a->id,
                    'icon' => 'solar:car-bold-duotone',
                ];
            }
            $counts['automovil'] = isset($autos) ? $autos->count() : 0;
        } catch (\Throwable $e) {
            Log::warning('GlobalSearch automoviles error', ['q' => $q, 'error' => $e->getMessage()]);
            $counts['automovil'] = 0;
        }

        // Siniestros
        try {
            $siniestros = Siniestro::query()
                ->when($brokerId, fn($q) => $q->forBroker($brokerId))
                ->searchText($q)
                ->limit($perType)
                ->get();

            foreach ($siniestros as $s) {
                $title = 'Siniestro ' . ($s->numero_siniestro ?: ('#' . $s->id));
                $subtitleParts = array_filter([
                    $s->aseguradora ? ('Aseguradora: ' . $s->aseguradora) : null,
                    $s->numero_poliza ? ('Póliza: ' . $s->numero_poliza) : null,
                    $s->estado ? ('Estado: ' . $s->estado) : null,
                ]);
                $results[] = [
                    'type' => 'siniestro',
                    'id' => $s->id,
                    'title' => $title,
                    'subtitle' => implode(' • ', $subtitleParts),
                    // Deep-link directo al modal de detalle del siniestro
                    'url' => '/apps/seguros/siniestros?open_siniestro_id=' . $s->id,
                    'icon' => 'solar:shield-user-bold-duotone',
                ];
            }
            $counts['siniestro'] = isset($siniestros) ? $siniestros->count() : 0;
        } catch (\Throwable $e) {
            Log::warning('GlobalSearch siniestros error', ['q' => $q, 'error' => $e->getMessage()]);
            $counts['siniestro'] = 0;
        }

        // Campañas (WhatsApp genéricas)
        try {
            $campaigns = Campaign::query()
                ->when($brokerId, fn($q) => $q->where('broker_id', $brokerId))
                ->where(function ($qb) use ($q) {
                    $qb->where('name', 'like', '%' . $q . '%')
                       ->orWhere('description', 'like', '%' . $q . '%');
                })
                ->limit($perType)
                ->get();

            foreach ($campaigns as $cpg) {
                $title = 'Campaña ' . ($cpg->name ?: ('#' . $cpg->id));
                $subtitleParts = array_filter([
                    $cpg->campaign_type ? ('Tipo: ' . $cpg->campaign_type) : null,
                    $cpg->status ? ('Estado: ' . $cpg->status) : null,
                ]);
                $results[] = [
                    'type' => 'campaign_whatsapp',
                    'id' => $cpg->id,
                    'title' => $title,
                    'subtitle' => implode(' • ', $subtitleParts),
                    // Deep-link a ConfiguracionMasiva con modal de detalles de campaña
                    'url' => '/apps/saas/configuracion-masiva?open_whatsapp_campaign_id=' . $cpg->id,
                    'icon' => 'solar:chat-round-bold-duotone',
                ];
            }
            $counts['campaign_whatsapp'] = isset($campaigns) ? $campaigns->count() : 0;
        } catch (\Throwable $e) {
            Log::warning('GlobalSearch campaign_whatsapp error', ['q' => $q, 'error' => $e->getMessage()]);
            $counts['campaign_whatsapp'] = 0;
        }

        // Campañas de Voz (opcional)
        try {
            if (class_exists(VoiceCampaign::class)) {
                $voice = VoiceCampaign::query()
                    ->when($brokerId, fn($q) => $q->where('broker_id', $brokerId))
                    ->where(function ($qb) use ($q) {
                        $qb->where('name', 'like', '%' . $q . '%')
                           ->orWhere('description', 'like', '%' . $q . '%')
                           ->orWhere('status', 'like', '%' . $q . '%');
                    })
                    ->limit($perType)
                    ->get();

                foreach ($voice as $vc) {
                    $title = 'Campaña Voz ' . ($vc->name ?? ('#' . $vc->id));
                    $subtitleParts = array_filter([
                        $vc->status ? ('Estado: ' . $vc->status) : null,
                    ]);
                    $results[] = [
                        'type' => 'campaign_voice',
                        'id' => $vc->id,
                        'title' => $title,
                        'subtitle' => implode(' • ', $subtitleParts),
                        // Deep-link a Voice AI Dashboard con pestaña de campañas
                        'url' => '/apps/voice-ai/dashboard?tab=campaigns&open_voice_campaign_id=' . $vc->id,
                        'icon' => 'solar:microphone-2-bold-duotone',
                    ];
                }
                $counts['campaign_voice'] = isset($voice) ? $voice->count() : 0;
            }
        } catch (\Throwable $e) {
            Log::warning('GlobalSearch campaign_voice error', ['q' => $q, 'error' => $e->getMessage()]);
            $counts['campaign_voice'] = $counts['campaign_voice'] ?? 0;
        }

        // Campañas de Email (opcional)
        try {
            if (class_exists(EmailCampaign::class)) {
                $emails = EmailCampaign::query()
                    ->when($brokerId, fn($q) => $q->where('broker_id', $brokerId))
                    ->where(function ($qb) use ($q) {
                        $qb->where('name', 'like', '%' . $q . '%')
                           ->orWhere('description', 'like', '%' . $q . '%')
                           ->orWhere('status', 'like', '%' . $q . '%');
                    })
                    ->limit($perType)
                    ->get();

                foreach ($emails as $ec) {
                    $title = 'Campaña Email ' . ($ec->name ?? ('#' . $ec->id));
                    $subtitleParts = array_filter([
                        $ec->status ? ('Estado: ' . $ec->status) : null,
                    ]);
                    $results[] = [
                        'type' => 'campaign_email',
                        'id' => $ec->id,
                        'title' => $title,
                        'subtitle' => implode(' • ', $subtitleParts),
                        // Deep-link a Plantillas con modal de detalles de campaña email
                        'url' => '/apps/marketing/plantillas?open_email_campaign_id=' . $ec->id,
                        'icon' => 'solar:mailbox-bold-duotone',
                    ];
                }
                $counts['campaign_email'] = isset($emails) ? $emails->count() : 0;
            }
        } catch (\Throwable $e) {
            Log::warning('GlobalSearch campaign_email error', ['q' => $q, 'error' => $e->getMessage()]);
            $counts['campaign_email'] = $counts['campaign_email'] ?? 0;
        }

        // Vendedores/Asesores - con pólizas, clientes y autos relacionados
        try {
            // Usar withoutGlobalScope para evitar conflictos y aplicar filtro manualmente
            $vendedoresQuery = Vendedor::withoutGlobalScope('broker')
                ->where(function ($qb) use ($q) {
                    $qb->where('nombres', 'like', '%' . $q . '%')
                       ->orWhere('email', 'like', '%' . $q . '%')
                       ->orWhere('numero_documento', 'like', '%' . $q . '%')
                       ->orWhere('celular', 'like', '%' . $q . '%');
                });
            
            // Aplicar filtro de broker si existe
            if ($brokerId) {
                $vendedoresQuery->where('broker_id', $brokerId);
            }
            
            $vendedores = $vendedoresQuery->limit($perType)->get();
            
            Log::info('GlobalSearch vendedores', [
                'count' => $vendedores->count(),
                'q' => $q,
                'broker_id' => $brokerId,
            ]);

            foreach ($vendedores as $v) {
                // Contar pólizas, clientes y autos relacionados
                $polizasCount = Poliza::where('vendedor_id', $v->id)
                    ->when($brokerId, fn($qb) => $qb->forBroker($brokerId))
                    ->count();
                $polizasCount2 = Poliza::where('vendedor_id_2', $v->id)
                    ->when($brokerId, fn($qb) => $qb->forBroker($brokerId))
                    ->count();
                $totalPolizas = $polizasCount + $polizasCount2;
                
                // Clientes únicos de las pólizas del vendedor
                $clientesCount = Poliza::where('vendedor_id', $v->id)
                    ->orWhere('vendedor_id_2', $v->id)
                    ->when($brokerId, fn($qb) => $qb->forBroker($brokerId))
                    ->distinct('client_id')
                    ->count('client_id');

                $title = $v->nombres ?: ('Vendedor #' . $v->id);
                $subtitleParts = array_filter([
                    $v->email ?: null,
                    $v->celular ?: $v->telefono,
                    $totalPolizas > 0 ? ($totalPolizas . ' póliza' . ($totalPolizas > 1 ? 's' : '')) : null,
                    $clientesCount > 0 ? ($clientesCount . ' cliente' . ($clientesCount > 1 ? 's' : '')) : null,
                ]);
                $results[] = [
                    'type' => 'vendedor',
                    'id' => $v->id,
                    'title' => $title,
                    'subtitle' => implode(' • ', $subtitleParts),
                    'url' => '/apps/admin/vendedores?open_vendedor_id=' . $v->id,
                    'icon' => 'solar:user-id-bold-duotone',
                    'extra' => [
                        'polizas_count' => $totalPolizas,
                        'clientes_count' => $clientesCount,
                    ],
                ];
            }
            $counts['vendedor'] = isset($vendedores) ? $vendedores->count() : 0;
        } catch (\Throwable $e) {
            Log::warning('GlobalSearch vendedores error', ['q' => $q, 'error' => $e->getMessage()]);
            $counts['vendedor'] = 0;
        }

        // Vinculados (asegurados de pólizas colectivas)
        try {
            $vinculados = PolizaVinculado::query()
                ->when($brokerId, fn($qb) => $qb->where('broker_id', $brokerId))
                ->where(function ($qb) use ($q) {
                    $qb->where('nombre_asegurado', 'like', '%' . $q . '%')
                       ->orWhere('documento', 'like', '%' . $q . '%')
                       ->orWhere('identificador', 'like', '%' . $q . '%')
                       ->orWhere('email', 'like', '%' . $q . '%')
                       ->orWhere('telefono', 'like', '%' . $q . '%');
                })
                ->with('poliza:id,policy_number,insurance_company')
                ->limit($perType)
                ->get();

            foreach ($vinculados as $vin) {
                $title = $vin->nombre_asegurado ?: ('Vinculado #' . $vin->id);
                $polizaNum = $vin->poliza?->policy_number ?? '';
                $subtitleParts = array_filter([
                    $vin->documento ? ('Doc: ' . $vin->documento) : null,
                    $vin->identificador ? ('ID: ' . $vin->identificador) : null,
                    $polizaNum ? ('Póliza: ' . $polizaNum) : null,
                    $vin->poliza?->insurance_company ?: null,
                ]);
                $results[] = [
                    'type' => 'vinculado',
                    'id' => $vin->poliza_id,
                    'title' => $title,
                    'subtitle' => implode(' • ', $subtitleParts),
                    'url' => '/apps/seguros/polizas/editar/' . $vin->poliza_id . '?tab=vinculados',
                    'icon' => 'solar:users-group-two-rounded-bold-duotone',
                ];
            }
            $counts['vinculado'] = isset($vinculados) ? $vinculados->count() : 0;
        } catch (\Throwable $e) {
            Log::warning('GlobalSearch vinculados error', ['q' => $q, 'error' => $e->getMessage()]);
            $counts['vinculado'] = 0;
        }

        // Ordenar por tipo y por título
        $typeOrder = [
            'vendedor' => 1,
            'cliente' => 2,
            'poliza' => 3,
            'vinculado' => 4,
            'automovil' => 5,
            'siniestro' => 6,
            'campaign_whatsapp' => 7,
            'campaign_voice' => 8,
            'campaign_email' => 9,
        ];
        try {
            usort($results, function ($a, $b) use ($typeOrder) {
                $oa = $typeOrder[$a['type']] ?? 99;
                $ob = $typeOrder[$b['type']] ?? 99;
                if ($oa === $ob) {
                    return strcmp(Str::lower($a['title']), Str::lower($b['title']));
                }
                return $oa <=> $ob;
            });
        } catch (\Throwable $e) {
            Log::warning('GlobalSearch sort error', ['error' => $e->getMessage()]);
        }

        return response()->json([
            'success' => true,
            'query' => $q,
            'counts' => $counts,
            'data' => $results,
        ]);
    }
}