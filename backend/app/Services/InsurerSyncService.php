<?php

namespace App\Services;

use App\Models\CarteraAseguradora;
use App\Models\Cliente;
use App\Models\InsurerConnection;
use App\Models\Poliza;
use App\Models\PolizaCoverage;
use App\Models\RecibosComisionAseguradora;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Incremental sync: uses updateOrCreate (upsert) keyed on unique identifiers.
 * - Clients: (broker_id, document_number)
 * - Policies: (broker_id, policy_number)
 *
 * A data fingerprint (md5 of key fields) is stored in custom_fields['_sync_hash'].
 * On re-sync, records whose hash hasn't changed are skipped entirely — no DB write.
 * Changed records are updated in-place. New records are created.
 *
 * After each insurer finishes, sync counts and timestamp are stored on the
 * InsurerConnection row so the frontend can display "last synced X ago" and
 * totals without re-querying.
 */
class InsurerSyncService
{
    private const SLUG_MAP = [
        'sura' => 'sura',
        'bolivar' => 'bolivar',
        'hdi' => 'hdi',
        'axa-colpatria' => 'axa',
        'seguros-del-estado' => 'estado',
        'la-equidad' => 'equidad',
        'allianz' => 'allianz',
        'qualitas' => 'qualitas',
        'mundial' => 'mundial',
    ];

    private const DOC_TYPE_MAP = [
        'C' => 'CC', 'CC' => 'CC', 'CEDULA' => 'CC', 'CÉDULA' => 'CC',
        'CEDULA DE CIUDADANIA' => 'CC', 'CÉDULA DE CIUDADANÍA' => 'CC',
        'CED.CIUDADANIA' => 'CC', 'CED CIUDADANIA' => 'CC',
        'CE' => 'CE', 'CEDULA EXTRANJERIA' => 'CE', 'CÉDULA DE EXTRANJERÍA' => 'CE',
        'CED.EXTRANJERIA' => 'CE', 'CED EXTRANJERIA' => 'CE', 'CEDULA DE EXTRANJERIA' => 'CE',
        'NIT' => 'NIT', 'NT' => 'NIT',
        'TI' => 'TI', 'TARJ.IDENTIDAD' => 'TI', 'TARJETA DE IDENTIDAD' => 'TI',
        'RC' => 'RC', 'REGISTRO CIVIL' => 'RC',
        'PA' => 'PA', 'PP' => 'PA', 'PASAPORTE' => 'PA',
        'PEP' => 'PEP', 'PPT' => 'PPT',
        'PERMISO PROTECCION TEMPORAL' => 'PPT',
        'PERMISO POR PROTECCION TEMPORAL' => 'PPT',
        'PERMISO POR PROTECCION TEMPORL' => 'PPT', // SURA usa este recorte
        'PERMISO ESPECIAL DE PERMANENCIA' => 'PEP',
        // Bolívar numeric codes
        '1' => 'CC', '2' => 'NIT', '3' => 'CE', '4' => 'TI', '5' => 'PA', '6' => 'RC',
    ];

    public function syncAll(int $brokerId, array $insurerCodes, array $types): array
    {
        $summary = [];

        foreach ($insurerCodes as $code) {
            $conn = InsurerConnection::forBroker($brokerId)
                ->where('insurer_code', $code)
                ->where('status', 'connected')
                ->first();

            if (!$conn || !$conn->microservice_session_id) {
                $summary[$code] = ['error' => 'No hay conexión activa para esta aseguradora'];
                continue;
            }

            $result = [];

            try {
                if (in_array('clientes', $types)) {
                    $result['clientes'] = $this->syncClientes($conn);
                }
                if (in_array('polizas', $types)) {
                    $result['polizas'] = $this->syncPolizas($conn);
                }
                if (in_array('cartera', $types)) {
                    $result['cartera'] = $this->syncCartera($conn);
                }
            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                Log::error('[INSURER SYNC] Timeout sincronizando', ['insurer' => $code, 'error' => $e->getMessage()]);
                $result['error'] = "Tiempo de espera agotado al sincronizar con {$this->insurerDisplayName($code)}. La aseguradora tardó demasiado en responder. Intenta de nuevo en unos minutos.";
            } catch (\Throwable $e) {
                Log::error('[INSURER SYNC] Excepción sincronizando', ['insurer' => $code, 'error' => $e->getMessage()]);
                $msg = $e->getMessage();
                if (str_contains($msg, 'cURL error 28') || str_contains($msg, 'timed out')) {
                    $result['error'] = "Tiempo de espera agotado al sincronizar con {$this->insurerDisplayName($code)}. La aseguradora tardó demasiado en responder.";
                } else {
                    $result['error'] = $msg;
                }
            }

            $conn->update([
                'last_sync_at' => now(),
                'last_sync_clientes_count' => $result['clientes']['total_fetched'] ?? 0,
                'last_sync_polizas_count' => $result['polizas']['total_fetched'] ?? 0,
            ]);

            $summary[$code] = $result;
        }

        return $summary;
    }

    // ──────────────────────────────────────────────────────
    //  CLIENTES
    // ──────────────────────────────────────────────────────

    public function syncClientes(InsurerConnection $conn): array
    {
        $slug = self::SLUG_MAP[$conn->insurer_code] ?? $conn->insurer_code;

        if ($slug === 'estado') {
            return ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'errors' => 0, 'total_fetched' => 0,
                'message' => 'Seguros del Estado no expone un listado de clientes'];
        }

        if ($slug === 'qualitas') {
            return ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'errors' => 0, 'total_fetched' => 0,
                'message' => 'Qualitas no expone un listado independiente de clientes (se derivan de pólizas)'];
        }

        if ($slug === 'mundial') {
            return ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'errors' => 0, 'total_fetched' => 0,
                'message' => 'Clientes de Seguros Mundial se derivan de la cartera'];
        }

        $allClients = $this->fetchRecords($slug, 'clientes', $conn->microservice_session_id);
        if (isset($allClients['_error'])) {
            return ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'errors' => 0, 'total_fetched' => 0,
                'error' => $allClients['_error']];
        }

        Log::info("[INSURER SYNC] Clientes obtenidos de {$conn->insurer_code}", ['count' => count($allClients)]);

        $created = 0;
        $updated = 0;
        $unchanged = 0;
        $errors = 0;
        $skippedManual = 0;

        foreach ($allClients as $raw) {
            try {
                $normalized = $this->normalizeCliente($conn->insurer_code, $raw);
                if (!$normalized || empty($normalized['document_number'])) {
                    $errors++;
                    continue;
                }

                $hash = md5(json_encode($normalized));

                // Incluir borrados lógicos: el UNIQUE (broker_id, document_number) sigue bloqueando inserts
                // y antes el create() fallaba con Duplicate → se contaba como "unchanged".
                $existing = Cliente::withTrashed()
                    ->where('broker_id', $conn->broker_id)
                    ->where('document_number', $normalized['document_number'])
                    ->first();

                if ($existing) {
                    // Si el cliente es manual (nunca lo tocó el sync), no lo tocamos.
                    // Marca: custom_fields._sync_source ausente.
                    if (empty($existing->custom_fields['_sync_source'] ?? null)) {
                        $skippedManual++;
                        continue;
                    }
                    $wasDeleted = $existing->trashed();
                    if ($wasDeleted) {
                        $existing->restore();
                    }
                    $existingHash = $existing->custom_fields['_sync_hash'] ?? null;
                    if (!$wasDeleted && $existingHash === $hash) {
                        $unchanged++;
                        continue;
                    }
                    $updateData = array_filter($normalized, fn($v) => $v !== null && $v !== '');
                    unset($updateData['document_number']);
                    $updateData['custom_fields'] = array_merge($existing->custom_fields ?? [], ['_sync_hash' => $hash, '_sync_source' => "{$conn->insurer_code}_sync", '_sync_at' => now()->toIso8601String()]);
                    $existing->update($updateData);
                    if ($wasDeleted) {
                        $created++;
                    } else {
                        $updated++;
                    }
                    continue;
                }

                $normalized['custom_fields'] = ['_sync_hash' => $hash, '_sync_source' => "{$conn->insurer_code}_sync", '_sync_at' => now()->toIso8601String()];

                Cliente::create(array_merge($normalized, [
                    'broker_id' => $conn->broker_id,
                    'source' => "{$conn->insurer_code}_sync",
                    'status' => 'active',
                ]));
                $created++;
            } catch (\Throwable $e) {
                if (str_contains($e->getMessage(), 'Duplicate entry') || str_contains($e->getMessage(), '1062')) {
                    $retry = Cliente::withTrashed()
                        ->where('broker_id', $conn->broker_id)
                        ->where('document_number', $normalized['document_number'])
                        ->first();
                    if ($retry) {
                        // Cliente manual: no tocar.
                        if (empty($retry->custom_fields['_sync_source'] ?? null)) {
                            $skippedManual++;
                            continue;
                        }
                        $wasDeleted = $retry->trashed();
                        if ($wasDeleted) {
                            $retry->restore();
                        }
                        $h = $retry->custom_fields['_sync_hash'] ?? null;
                        if (!$wasDeleted && $h === $hash) {
                            $unchanged++;
                        } else {
                            $updateData = array_filter($normalized, fn($v) => $v !== null && $v !== '');
                            unset($updateData['document_number']);
                            $updateData['custom_fields'] = array_merge($retry->custom_fields ?? [], ['_sync_hash' => $hash, '_sync_source' => "{$conn->insurer_code}_sync", '_sync_at' => now()->toIso8601String()]);
                            $retry->update($updateData);
                            if ($wasDeleted) {
                                $created++;
                            } else {
                                $updated++;
                            }
                        }
                    } else {
                        $errors++;
                        Log::warning('[INSURER SYNC] Duplicate cliente sin fila coincidente', [
                            'insurer' => $conn->insurer_code,
                            'doc' => $normalized['document_number'] ?? '?',
                        ]);
                    }
                } else {
                    $errors++;
                    Log::warning('[INSURER SYNC] Error cliente', [
                        'insurer' => $conn->insurer_code,
                        'doc' => $raw['numero_documento'] ?? '?',
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        return ['created' => $created, 'updated' => $updated, 'unchanged' => $unchanged, 'skipped_manual' => $skippedManual, 'errors' => $errors, 'total_fetched' => count($allClients)];
    }

    private function normalizeCliente(string $insurerCode, array $raw): ?array
    {
        $fullName = '';
        $docType = '';
        $docNumber = '';
        $phone = '';
        $mobile = '';
        $email = '';
        $address = '';
        $city = '';
        $tipoPersona = 'N';
        $vinculacion = '';

        switch ($insurerCode) {
            case 'sura':
                $fullName = trim($raw['nombre'] ?? '');
                $docType = strtoupper(trim($raw['tipo_documento'] ?? 'CC'));
                $docNumber = trim($raw['numero_documento'] ?? '');
                $phone = trim($raw['telefono'] ?? '');
                $mobile = trim($raw['celular'] ?? '');
                $email = trim($raw['correo'] ?? '');
                $address = trim($raw['direccion'] ?? '');
                $city = trim($raw['ciudad'] ?? '');
                $tipoPersona = $raw['tipo_persona'] ?? 'N';
                $vinculacion = $raw['tipo_vinculacion'] ?? '';
                break;

            case 'hdi':
                $fullName = trim($raw['nombre'] ?? '');
                $docType = strtoupper(trim($raw['tipo_documento'] ?? 'CC'));
                $docNumber = trim($raw['numero_documento'] ?? '');
                break;

            case 'axa-colpatria':
                $fullName = trim($raw['nombre'] ?? '');
                $docType = strtoupper(trim($raw['tipo_documento'] ?? 'CC'));
                $docNumber = trim($raw['numero_documento'] ?? '');
                $mobile = trim($raw['celular'] ?? '');
                $email = trim($raw['email'] ?? '');
                $tipoPersona = ($raw['tipo_persona'] ?? 'PN') === 'PJ' ? 'J' : 'N';
                break;

            case 'bolivar':
                $fullName = trim($raw['nombres'] ?? '');
                if (empty($fullName)) {
                    $fn = trim($raw['primerNombre'] ?? $raw['nombre'] ?? '');
                    $sn = trim($raw['segundoNombre'] ?? '');
                    $fl = trim($raw['primerApellido'] ?? '');
                    $sl = trim($raw['segundoApellido'] ?? '');
                    $fullName = trim(implode(' ', array_filter([$fn, $sn, $fl, $sl])));
                }
                if (empty($fullName)) {
                    $fullName = trim($raw['nombreCompleto'] ?? '');
                }
                $descIdent = $raw['descIdentificacion'] ?? null;
                $numIdent = isset($raw['tipoIdentificacion']) ? (string) $raw['tipoIdentificacion'] : null;
                $docType = strtoupper(trim($descIdent ?? $numIdent ?? $raw['tipo_documento'] ?? 'CC'));
                $docNumber = trim($raw['numeroIdentificacion'] ?? $raw['numero_documento'] ?? '');
                $email = trim($raw['correoElectronico'] ?? $raw['email'] ?? '');
                $mobile = trim($raw['celular'] ?? '');
                $city = trim($raw['ciudad'] ?? '');
                $address = trim($raw['direccion'] ?? '');
                $tipoCliente = $raw['tipoCliente'] ?? null;
                if ($tipoCliente == 2 || $docType === 'NIT' || $docType === 'NT') {
                    $tipoPersona = 'J';
                }
                break;

            case 'seguros-del-estado':
                return null;

            case 'la-equidad':
                $fullName = trim($raw['nombre'] ?? '');
                $docType = strtoupper(trim($raw['tipo_documento'] ?? 'CC'));
                $docNumber = trim($raw['numero_documento'] ?? '');
                $phone = trim($raw['telefono'] ?? '');
                $mobile = trim($raw['celular'] ?? $raw['telefono'] ?? '');
                $address = trim($raw['direccion'] ?? '');
                $city = trim($raw['ciudad'] ?? '');
                if ($docType === 'NIT' || (ctype_digit($docNumber) && strlen($docNumber) >= 9)) {
                    $tipoPersona = 'J';
                    if ($docType !== 'NIT') {
                        $docType = 'NIT';
                    }
                }
                break;

            default:
                return null;
        }

        if (empty($docNumber)) {
            return null;
        }

        $mappedDocType = self::DOC_TYPE_MAP[$docType] ?? $docType;
        $clientType = ($tipoPersona === 'J' || $mappedDocType === 'NIT') ? 'empresa' : 'persona';

        $nameParts = preg_split('/\s+/', $fullName);
        $firstN = $nameParts[0] ?? '';
        $lastN = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : '';

        if (empty($email)) {
            $email = strtolower(str_replace(' ', '', $docNumber)) . '@sinregistro.com';
        }
        if (empty($mobile)) {
            $mobile = '0000000000';
        }

        $result = [
            'client_type' => $clientType,
            'first_name' => $firstN,
            'last_name' => $lastN,
            'document_type' => $mappedDocType,
            'document_number' => $docNumber,
            'email' => $email,
            'phone' => $phone,
            'mobile_phone' => $mobile,
            'address' => $address ?: 'Sin dirección',
            'city' => $city,
            'notes' => "Importado desde " . $this->insurerDisplayName($insurerCode)
                . ($vinculacion ? " - Vinculación: {$vinculacion}" : ''),
        ];

        if ($clientType === 'empresa') {
            $result['company'] = $fullName;
        }

        return $result;
    }

    // ──────────────────────────────────────────────────────
    //  PÓLIZAS — Complete field mappings per insurer
    // ──────────────────────────────────────────────────────

    public function syncPolizas(InsurerConnection $conn): array
    {
        $slug = self::SLUG_MAP[$conn->insurer_code] ?? $conn->insurer_code;

        if ($slug === 'mundial') {
            return ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'errors' => 0, 'total_fetched' => 0,
                'message' => 'Pólizas de Seguros Mundial se derivan de la cartera'];
        }

        $allPolizas = $this->fetchRecords($slug, 'polizas', $conn->microservice_session_id);
        if (isset($allPolizas['_error'])) {
            return ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'errors' => 0, 'total_fetched' => 0,
                'error' => $allPolizas['_error']];
        }

        Log::info("[INSURER SYNC] Pólizas obtenidas de {$conn->insurer_code}", ['count' => count($allPolizas)]);

        $created = 0;
        $updated = 0;
        $unchanged = 0;
        $errors = 0;
        $skippedManual = 0;
        $adoptedManual = 0;
        $clientsCreated = 0;
        $clientsUpdated = 0;

        // Resolver aseguradora_id una sola vez (constante por insurer del broker).
        // Sin esto, las pólizas creadas por sync quedan sin FK y la UI no muestra el insurer.
        $aseguradoraId = \App\Models\Aseguradora::where('broker_id', $conn->broker_id)
            ->whereRaw('LOWER(nombre) = ?', [strtolower($this->insurerDisplayName($conn->insurer_code))])
            ->value('id');

        foreach ($allPolizas as $raw) {
            try {
                $normalized = $this->normalizePoliza($conn->insurer_code, $raw);
                if (!$normalized || empty($normalized['policy_number'])) {
                    $errors++;
                    continue;
                }

                $branchName = $normalized['_branch_name'] ?? '';
                unset($normalized['_branch_name']);

                $hash = md5(json_encode($normalized));
                $detailMeta = $this->polizaDetailMetaFromListing($conn->insurer_code, $raw);

                $existing = Poliza::withTrashed()
                    ->where('broker_id', $conn->broker_id)
                    ->where('policy_number', $normalized['policy_number'])
                    ->first();

                $clientId = null;
                $docNumber = $normalized['client_document'] ?? null;
                if ($docNumber) {
                    $client = Cliente::withTrashed()
                        ->where('broker_id', $conn->broker_id)
                        ->where('document_number', $docNumber)
                        ->first();
                    if ($client && $client->trashed()) {
                        $client->restore();
                    }
                    $clientId = $client?->id;
                    if ($client && empty($normalized['client_name'])) {
                        $normalized['client_name'] = trim($client->first_name . ' ' . $client->last_name);
                    }
                    if (!$client) {
                        $clientResult = $this->syncClienteFromPoliza($conn, $normalized);
                        $client = $clientResult['client'];
                        $clientId = $client?->id;
                        if (($clientResult['status'] ?? null) === 'created') {
                            $clientsCreated++;
                        } elseif (($clientResult['status'] ?? null) === 'updated') {
                            $clientsUpdated++;
                        }
                    }
                }

                $sourceTag = "Sincronizado desde " . $this->insurerDisplayName($conn->insurer_code);
                if ($branchName) {
                    $normalized['description'] = ($normalized['description'] ?? '') ?: "Ramo: {$branchName}";
                    $ramoId = $this->resolveOrCreateRamoForBroker($conn->broker_id, $branchName);
                    if ($ramoId) {
                        $normalized['ramo_id'] = $ramoId;
                    }
                }

                if ($existing) {
                    // Detectar si la póliza era manual (sin _sync_source). Antes la
                    // saltábamos; ahora la "adoptamos" pero SOLO sobrescribimos
                    // campos que difieren del sync (para no machacar info que el
                    // usuario hubiera puesto a mano si ya coincide).
                    $wasManualBefore = empty($existing->custom_fields['_sync_source'] ?? null);

                    $wasDeleted = $existing->trashed();
                    if ($wasDeleted) {
                        $existing->restore();
                    }
                    $existingHash = $existing->custom_fields['_sync_hash'] ?? null;
                    if (!$wasDeleted && $existingHash === $hash) {
                        if ($detailMeta !== []) {
                            $cf = array_merge($existing->custom_fields ?? [], [
                                '_detail' => array_merge($existing->custom_fields['_detail'] ?? [], $detailMeta),
                            ]);
                            $existing->update(['custom_fields' => $cf]);
                        }
                        $unchanged++;
                        continue;
                    }

                    $candidateUpdates = array_filter($normalized, fn($v) => $v !== null && $v !== '');
                    unset($candidateUpdates['policy_number']);

                    if ($wasManualBefore) {
                        // Manual: comparar campo por campo. Solo escribir lo que cambia.
                        $diff = [];
                        foreach ($candidateUpdates as $k => $v) {
                            $cur = $existing->$k;
                            $changed = false;
                            if (is_numeric($v) && is_numeric($cur)) {
                                $changed = abs((float) $v - (float) $cur) > 0.0001;
                            } else {
                                $changed = trim((string) $v) !== trim((string) ($cur ?? ''));
                            }
                            if ($changed) {
                                $diff[$k] = $v;
                            }
                        }
                        if (empty($diff)) {
                            // Data ya coincide. Solo marcar como "adoptada" para que
                            // futuros syncs hagan el hash-skip rápido.
                            $cf = array_merge($existing->custom_fields ?? [], [
                                '_sync_hash'   => $hash,
                                '_sync_source' => "{$conn->insurer_code}_sync",
                                '_sync_at'     => now()->toIso8601String(),
                                '_was_manual'  => true,
                            ]);
                            if ($branchName !== '') {
                                $cf['_branch_name'] = $branchName;
                            }
                            if ($detailMeta !== []) {
                                $cf['_detail'] = array_merge($cf['_detail'] ?? [], $detailMeta);
                            }
                            $existing->update(['custom_fields' => $cf]);
                            $adoptedManual++;
                            continue;
                        }
                        // Hay campos que difieren — actualizar solo esos + marker.
                        $updateData = $diff;
                        if ($clientId && empty($existing->client_id)) {
                            $updateData['client_id'] = $clientId;
                        }
                        if ($aseguradoraId && empty($existing->aseguradora_id)) {
                            $updateData['aseguradora_id'] = $aseguradoraId;
                        }
                        $updateData['custom_fields'] = $this->mergePolizaSyncCustomFields(
                            array_merge($existing->custom_fields ?? [], ['_was_manual' => true]),
                            $conn->insurer_code,
                            $hash,
                            $detailMeta,
                            $branchName
                        );
                        $existing->update($updateData);
                        $adoptedManual++;
                        continue;
                    }

                    // Ya era sync-managed — comportamiento original (sobrescribe todo).
                    $updateData = $candidateUpdates;
                    $updateData['client_id'] = $clientId ?? $existing->client_id;
                    if ($aseguradoraId && empty($existing->aseguradora_id)) {
                        $updateData['aseguradora_id'] = $aseguradoraId;
                    }
                    $updateData['custom_fields'] = $this->mergePolizaSyncCustomFields(
                        $existing->custom_fields ?? [],
                        $conn->insurer_code,
                        $hash,
                        $detailMeta,
                        $branchName
                    );
                    // Reparar type si quedó como 'vida' por bug histórico
                    if ($existing->type === 'vida' || empty($existing->type)) {
                        $newType = $this->mapBranchNameToType($branchName, $detailMeta);
                        if ($newType !== 'vida' || stripos($branchName, 'vida') !== false || stripos($branchName, 'masvida') !== false) {
                            $updateData['type'] = $newType;
                        }
                    }
                    $existing->update($updateData);
                    if ($wasDeleted) {
                        $created++;
                    } else {
                        $updated++;
                    }
                    continue;
                }

                $normalized['notes'] = $sourceTag;
                $normalized['custom_fields'] = $this->mergePolizaSyncCustomFields(
                    [],
                    $conn->insurer_code,
                    $hash,
                    $detailMeta,
                    $branchName
                );

                Poliza::create(array_merge([
                    'numero_renovacion' => 0,
                    'is_renewal' => false,
                    'auto_renewal' => false,
                ], $normalized, [
                    'broker_id' => $conn->broker_id,
                    'client_id' => $clientId,
                    'aseguradora_id' => $aseguradoraId,
                    'insurance_company' => $this->insurerDisplayName($conn->insurer_code),
                    // type: enum DB con default 'vida'. Si no lo seteamos, TODAS
                    // las pólizas sincronizadas quedan como 'vida' aunque sean
                    // autos/hogar/etc. Mapeamos desde branchName.
                    'type' => $this->mapBranchNameToType($branchName, $detailMeta),
                ]));
                $created++;
            } catch (\Throwable $e) {
                if (str_contains($e->getMessage(), 'Duplicate entry') || str_contains($e->getMessage(), '1062')) {
                    $retry = Poliza::withTrashed()
                        ->where('broker_id', $conn->broker_id)
                        ->where('policy_number', $normalized['policy_number'])
                        ->first();
                    if ($retry) {
                        // Si era manual, la "adoptamos" igual que el path principal.
                        // Marcamos _was_manual y dejamos que el update overwrite los
                        // campos (esta rama solo corre en race conditions raros).
                        $wasManualRetry = empty($retry->custom_fields['_sync_source'] ?? null);
                        $wasDeleted = $retry->trashed();
                        if ($wasDeleted) {
                            $retry->restore();
                        }
                        $h = $retry->custom_fields['_sync_hash'] ?? null;
                        if (!$wasDeleted && !$wasManualRetry && $h === $hash) {
                            $unchanged++;
                        } else {
                            $updateData = array_filter($normalized, fn($v) => $v !== null && $v !== '');
                            unset($updateData['policy_number']);
                            $updateData['client_id'] = $clientId ?? $retry->client_id;
                            $updateData['custom_fields'] = $this->mergePolizaSyncCustomFields(
                                $retry->custom_fields ?? [],
                                $conn->insurer_code,
                                $hash,
                                $detailMeta
                            );
                            // Marcar _was_manual si venía de retry sobre manual.
                            if ($wasManualRetry) {
                                $cfNow = is_array($updateData['custom_fields']) ? $updateData['custom_fields'] : [];
                                $cfNow['_was_manual'] = true;
                                $updateData['custom_fields'] = $cfNow;
                            }
                            $retry->update($updateData);
                            if ($wasDeleted) {
                                $created++;
                            } elseif ($wasManualRetry) {
                                $adoptedManual++;
                            } else {
                                $updated++;
                            }
                        }
                    } else {
                        $errors++;
                        Log::warning('[INSURER SYNC] Duplicate póliza sin fila coincidente', [
                            'insurer' => $conn->insurer_code,
                            'policy' => $normalized['policy_number'] ?? '?',
                        ]);
                    }
                } else {
                    $errors++;
                    Log::warning('[INSURER SYNC] Error póliza', [
                        'insurer' => $conn->insurer_code,
                        'policy' => $raw['numero_poliza'] ?? '?',
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }

        $result = ['created' => $created, 'updated' => $updated, 'unchanged' => $unchanged, 'skipped_manual' => $skippedManual, 'adopted_manual' => $adoptedManual, 'errors' => $errors, 'total_fetched' => count($allPolizas)];
        if ($clientsCreated > 0 || $clientsUpdated > 0) {
            $result['clientes_derivados_created'] = $clientsCreated;
            $result['clientes_derivados_updated'] = $clientsUpdated;
        }
        return $result;
    }

    // ──────────────────────────────────────────────────────
    //  DETALLE DE PÓLIZA (coberturas + campos ampliados)
    // ──────────────────────────────────────────────────────

    /**
     * @return array<string, mixed>
     */
    private function mergePolizaSyncCustomFields(array $existingCf, string $insurerCode, string $hash, array $detailMeta, string $branchName = ''): array
    {
        $base = array_merge($existingCf, [
            '_sync_hash' => $hash,
            '_sync_source' => "{$insurerCode}_sync",
            '_sync_at' => now()->toIso8601String(),
        ]);
        if ($branchName !== '') {
            $base['_branch_name'] = $branchName;
        }
        $mergedDetail = array_merge($existingCf['_detail'] ?? [], $detailMeta);
        if ($mergedDetail !== []) {
            $base['_detail'] = $mergedDetail;
        }

        return $base;
    }

    /**
     * Identificadores del listado necesarios para llamar al detalle en el microservicio.
     *
     * @return array<string, mixed>
     */
    private function polizaDetailMetaFromListing(string $insurerCode, array $raw): array
    {
        switch ($insurerCode) {
            case 'sura':
                $rc = trim((string) ($raw['ramo_codigo'] ?? ''));
                $rn = trim((string) ($raw['ramo_nombre'] ?? ''));
                // Derive ramo_codigo from name when API omits it
                if ($rc === '' && $rn !== '') {
                    $rc = $this->suraGuessRamoFromName($rn);
                }
                if ($rc === '' && $rn === '') {
                    return [];
                }

                return array_filter([
                    'ramo_codigo' => $rc !== '' ? $rc : null,
                    'ramo_nombre' => $rn !== '' ? $rn : null,
                ]);
            case 'bolivar':
                $cr = $raw['codigoRamo'] ?? $raw['codRamoEmision'] ?? $raw['codRamo'] ?? $raw['cod_ramo'] ?? $raw['_codRamo'] ?? null;
                $cp = $raw['codigoProducto'] ?? $raw['codProducto'] ?? $raw['cod_producto'] ?? $raw['_codigoProducto'] ?? $cr;
                $cc = $raw['codCompania'] ?? $raw['cod_compania'] ?? '3';
                if ($cr === null) {
                    return [];
                }

                return [
                    'cod_ramo' => (int) $cr,
                    'cod_producto' => (int) $cp,
                    'cod_compania' => (string) $cc,
                ];
            case 'hdi':
                $ss = $raw['_sseguro'] ?? $raw['sseguro'] ?? null;
                $pc = $raw['_product_code'] ?? $raw['product_code'] ?? null;
                if ($ss === null || $ss === '' || $pc === null || $pc === '') {
                    return [];
                }

                return [
                    'sseguro' => (int) $ss,
                    'product_code' => (int) $pc,
                ];
            default:
                return [];
        }
    }

    /**
     * Sincroniza detalle (microservicio) → póliza + filas en poliza_coverages.
     *
     * @return array{success: bool, partial?: bool, error?: ?string, coverages_count: int}
     */
    public function syncPolizaDetail(Poliza $poliza, InsurerConnection $conn): array
    {
        if (! Schema::hasTable('poliza_coverages') || ! Schema::hasColumn('polizas', 'detail_sync_status')) {
            return [
                'success' => false,
                'error' => 'Ejecuta la migración add_detail_sync_to_polizas_and_coverages.',
                'coverages_count' => 0,
            ];
        }

        $slug = self::SLUG_MAP[$conn->insurer_code] ?? $conn->insurer_code;

        // Insurers that derive polizas from cartera have no dedicated detail endpoint.
        if (in_array($slug, ['mundial'], true)) {
            return ['success' => true, 'partial' => false, 'not_applicable' => true, 'coverages_count' => 0];
        }

        $expectedSource = "{$conn->insurer_code}_sync";
        $src = $poliza->custom_fields['_sync_source'] ?? '';
        if ($src !== $expectedSource) {
            return [
                'success' => false,
                'error' => 'La póliza no está vinculada a esta aseguradora (sync_source distinto).',
                'coverages_count' => 0,
            ];
        }

        $sessionId = $conn->microservice_session_id;
        $detailCf = $poliza->custom_fields['_detail'] ?? [];
        $numero = rawurlencode((string) $poliza->policy_number);

        // Bolívar: populate cod_ramo/cod_producto from client poliza listing when _detail is missing
        if ($slug === 'bolivar' && empty($detailCf['cod_ramo'])) {
            try {
                $detailCf = $this->bolivarLookupRamoCodes($poliza, $sessionId, $detailCf);
            } catch (\RuntimeException $e) {
                return ['success' => false, 'error' => $e->getMessage(), 'coverages_count' => 0];
            }
        }

        try {
            $response = match ($slug) {
                'sura' => $this->fetchSuraPolizaDetail($numero, $sessionId, $detailCf, $poliza),
                'bolivar' => $this->fetchBolivarPolizaDetail($numero, $sessionId, $detailCf),
                'hdi' => $this->fetchHdiPolizaDetail($numero, $sessionId, $detailCf),
                default => null,
            };

            if ($response === null) {
                return ['success' => true, 'partial' => true, 'error' => null, 'coverages_count' => 0];
            }

            if (! $response->ok()) {
                return [
                    'success' => false,
                    'error' => $this->extractErrorMessage($response),
                    'coverages_count' => 0,
                ];
            }

            $json = $response->json() ?? [];
            if (($json['success'] ?? true) === false) {
                $msg = (string) ($json['detail'] ?? $json['message'] ?? 'Error en microservicio');

                return ['success' => false, 'error' => $msg, 'coverages_count' => 0];
            }

            $data = $json['data'] ?? $json;
            if (! is_array($data)) {
                return ['success' => false, 'error' => 'Respuesta de detalle inválida', 'coverages_count' => 0];
            }

            $rows = $this->coveragesRowsFromDetail($slug, $data, $conn->insurer_code);
            $partial = $rows === [] && in_array($slug, ['sura', 'bolivar', 'hdi'], true);
            $polizaUpdates = $this->polizaFieldUpdatesFromDetail($slug, $data);

            DB::transaction(function () use ($poliza, $rows, $polizaUpdates, $data) {
                PolizaCoverage::withoutGlobalScopes()->where('poliza_id', $poliza->id)->delete();
                foreach ($rows as $row) {
                    PolizaCoverage::withoutGlobalScopes()->create(array_merge($row, [
                        'poliza_id' => $poliza->id,
                        'broker_id' => $poliza->broker_id,
                    ]));
                }
                $cf = $poliza->custom_fields ?? [];
                $cf['_detail_sync_snapshot_at'] = now()->toIso8601String();
                if (isset($data['_recibos_pendientes'])) {
                    $cf['_recibos_pendientes'] = $data['_recibos_pendientes'];
                }
                if (isset($data['_reclamaciones'])) {
                    $cf['_reclamaciones'] = $data['_reclamaciones'];
                }
                // Cachear sseguro/product_code retornados por el microservicio (HDI auto-lookup)
                if (isset($data['_sseguro']) && isset($data['_product_code'])) {
                    $cf['_detail'] = array_merge($cf['_detail'] ?? [], [
                        'sseguro' => (int) $data['_sseguro'],
                        'product_code' => (int) $data['_product_code'],
                    ]);
                }
                $poliza->custom_fields = $cf;
                // Extract internal keys before fill()
                $suraVehiculo = $polizaUpdates['_sura_vehiculo'] ?? null;
                unset($polizaUpdates['_sura_vehiculo']);
                if ($polizaUpdates !== []) {
                    // Resolver ramo si viene del listing
                    $branchName = $polizaUpdates['_branch_name_for_detail'] ?? null;
                    unset($polizaUpdates['_branch_name_for_detail']);
                    if ($branchName) {
                        $ramoId = $this->resolveOrCreateRamoForBroker($poliza->broker_id, $branchName);
                        if ($ramoId) {
                            $polizaUpdates['ramo_id'] = $ramoId;
                        }
                    }
                    $poliza->fill($polizaUpdates);
                }
                $poliza->save();

                // Upsert automóvil — HDI (objeto_asegurado)
                if (! empty($data['objeto_asegurado']['placa'])) {
                    $obj = $data['objeto_asegurado'];
                    $brand = \App\Models\VehBrand::whereRaw('LOWER(name) = ?', [strtolower($obj['marca'] ?? '')])->first();
                    $anio = ! empty($obj['anio']) ? (int) $obj['anio'] : null;
                    \App\Models\Automovil::withoutGlobalScopes()->updateOrCreate(
                        ['broker_id' => $poliza->broker_id, 'poliza_id' => $poliza->id],
                        array_filter([
                            'broker_id'      => $poliza->broker_id,
                            'client_id'      => $poliza->client_id,
                            'placa'          => strtoupper($obj['placa']),
                            'marca'          => $obj['marca'] ?? null,
                            'modelo'         => $obj['vehiculo'] ?? $obj['modelo'] ?? null,
                            'anio'           => $anio,
                            'vin'            => $obj['vin'] ?? null,
                            'color'          => $obj['color'] ?? null,
                            'tipo_servicio'  => $obj['uso'] ?? null,
                            'linea'          => $obj['version'] ?? null,
                            'numero_motor'   => $obj['motor'] ?? null,
                            'numero_chasis'  => $obj['chasis'] ?? null,
                            'numero_serie'   => $obj['vin'] ?? null,
                            'brand_id'       => $brand?->id,
                            'custom_fields'  => array_filter([
                                'fasecolda'    => $obj['fasecolda'] ?? null,
                                'tipo_placa'   => $obj['tipo_placa'] ?? null,
                                'sync_source'  => 'hdi',
                            ]),
                        ], fn ($v) => $v !== null && $v !== '')
                    );
                }

                // Upsert automóvil — SURA (vehiculo/riesgo de autos)
                // Busca primero por placa (unique(broker_id, placa)) y luego por poliza_id
                // para evitar violación de constraint cuando una placa tuvo varias pólizas.
                if (! empty($suraVehiculo) && !empty($suraVehiculo['placa'])) {
                    $obj = $suraVehiculo;
                    $brand = \App\Models\VehBrand::whereRaw('LOWER(name) = ?', [strtolower($obj['marca'] ?? '')])->first();
                    $attrs = array_filter([
                        'broker_id'     => $poliza->broker_id,
                        'client_id'     => $poliza->client_id,
                        'poliza_id'     => $poliza->id,
                        'placa'         => $obj['placa'],
                        'marca'         => $obj['marca'] ?? null,
                        'modelo'        => $obj['modelo'] ?? null,
                        'anio'          => $obj['anio'] ?? null,
                        'color'         => $obj['color'] ?? null,
                        'vin'           => $obj['vin'] ?? null,
                        'numero_motor'  => $obj['motor'] ?? null,
                        'brand_id'      => $brand?->id,
                        'custom_fields' => ['sync_source' => 'sura'],
                    ], fn ($v) => $v !== null && $v !== '');
                    \App\Models\Automovil::withoutGlobalScopes()->updateOrCreate(
                        ['broker_id' => $poliza->broker_id, 'placa' => $obj['placa']],
                        $attrs
                    );
                }
            });

            return [
                'success' => true,
                'partial' => $partial,
                'error' => null,
                'coverages_count' => count($rows),
            ];
        } catch (\Throwable $e) {
            Log::error('[INSURER SYNC] syncPolizaDetail', ['poliza_id' => $poliza->id, 'error' => $e->getMessage()]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
                'coverages_count' => 0,
            ];
        }
    }

    private function fetchSuraPolizaDetail(string $numeroEncoded, string $sessionId, array $detailCf, Poliza $poliza): ?\Illuminate\Http\Client\Response
    {
        $ramo = $this->resolveSuraRamoQueryParam($detailCf, $poliza);

        if ($ramo === '') {
            throw new \RuntimeException(
                'No se pudo determinar el ramo SURA para esta póliza. ' .
                'Vuelve a sincronizar la lista de pólizas desde la aseguradora.'
            );
        }

        // Persist resolved ramo so next sync skips resolution
        if (empty($detailCf['ramo_codigo'])) {
            $this->suraStoreRamo($poliza, $ramo);
        }

        $fechaFin        = $poliza->end_date?->format('Y-m-d');
        $tipoDoc         = $poliza->policy_holder_doc_type ?? $poliza->custom_fields['_ph_doc_type'] ?? '';
        $numDoc          = $poliza->policy_holder_document  ?? $poliza->client_document ?? '';
        // Pass the original 3-digit SURA ramo code so the microservice can build the correct body.
        // Only pass if it's a genuine 3-digit code (not a 2-digit resolved code stored by old runs).
        $rawRamoCodigo   = trim((string) ($detailCf['ramo_codigo'] ?? ''));
        $ramoCodigoOrig  = (strlen($rawRamoCodigo) === 3 && ctype_digit($rawRamoCodigo)) ? $rawRamoCodigo : '';
        $response = $this->suraDetailRequest($numeroEncoded, $sessionId, $ramo, $ramoCodigoOrig, $fechaFin, $tipoDoc, $numDoc);

        // If SURA returns 404 for the primary ramo, probe fallback ramos.
        // This handles products that are stored under a different SURA API backend
        // than what the product_name keyword mapping predicts (e.g. oracle-based endpoints).
        if ($response->status() === 502) {
            $errorBody = $response->json('detail') ?? '';
            // SURA Plan Salud (PES) endpoints require EPS-level auth — treat as partial (not failed)
            if (str_contains((string) $errorBody, 'hoja de estado salud') ||
                str_contains((string) $errorBody, 'búsqueda de hoja de estado salud')) {
                return null; // Signals caller to treat as partial
            }
            $is404 = str_contains((string) $errorBody, 'HTTP 404') || str_contains((string) $errorBody, 'No se encontró');
            if ($is404) {
                // Try oracle-based ramos and vida grupo as fallbacks
                $fallbacks = array_values(array_diff(['06', '10', '02', '04', '03', '09', '01', '07', '08'], [$ramo]));
                foreach ($fallbacks as $fallbackRamo) {
                    $fb = $this->suraDetailRequest($numeroEncoded, $sessionId, $fallbackRamo, '', $fechaFin, $tipoDoc, $numDoc);
                    if ($fb->ok()) {
                        // Found it — persist the working ramo
                        $this->suraStoreRamo($poliza, $fallbackRamo);
                        Log::info('[SURA DETAIL] fallback ramo worked', [
                            'poliza_id' => $poliza->id,
                            'primary'   => $ramo,
                            'working'   => $fallbackRamo,
                        ]);
                        return $fb;
                    }
                    $fbErr = $fb->json('detail') ?? '';
                    if (! str_contains((string) $fbErr, 'HTTP 404') && ! str_contains((string) $fbErr, 'No se encontró')) {
                        // Non-404 error on a fallback — stop probing, return original response
                        break;
                    }
                }
            }
        }

        return $response;
    }

    private function suraDetailRequest(
        string $numeroEncoded,
        string $sessionId,
        string $ramo,
        string $ramoCodigoOrig = '',
        ?string $fechaFin = null,
        string $tipoDoc = '',
        string $numDoc = ''
    ): \Illuminate\Http\Client\Response {
        return Http::acceptJson()
            ->timeout(120)
            ->connectTimeout(15)
            ->withHeaders(['X-Session-Id' => $sessionId])
            ->get($this->baseUrl() . "/sura/polizas/{$numeroEncoded}/detail", array_filter([
                'ramo'        => $ramo,
                'ramo_codigo' => $ramoCodigoOrig ?: null,
                'fecha_fin'   => $fechaFin,
                'tipo_doc'    => $tipoDoc ?: null,
                'num_doc'     => $numDoc  ?: null,
            ]));
    }

    private function suraStoreRamo(Poliza $poliza, string $ramo): void
    {
        $cf = $poliza->custom_fields ?? [];
        // Store the resolved 2-digit code in _ramo_resolved (separate from ramo_codigo which
        // holds the original 3-digit SURA code from the listing and must not be overwritten)
        $cf['_detail'] = array_merge($cf['_detail'] ?? [], ['_ramo_resolved' => $ramo]);
        $poliza->custom_fields = $cf;
        $poliza->saveQuietly();
    }

    /**
     * Prefetch ramo codes from resumen-ramos and bulk-update _detail on all Bolívar polizas
     * that are missing cod_ramo. Called once before queuing detail jobs.
     * Returns number of polizas updated.
     */
    public function bolivarPrefetchRamoCodes(int $brokerId, string $sessionId): int
    {
        $res = Http::acceptJson()
            ->timeout(30)
            ->withHeaders(['X-Session-Id' => $sessionId])
            ->get($this->baseUrl() . '/bolivar/resumen-ramos');

        if (! $res->ok()) {
            Log::warning('[BOLIVAR PREFETCH] resumen-ramos returned ' . $res->status());
            return 0;
        }

        $body = $res->json() ?? [];
        // resumen-ramos returns { success, ramos: [...] } — try multiple keys
        $ramos = $body['ramos'] ?? $body['data'] ?? (is_array($body) && isset($body[0]) ? $body : []);
        if (! is_array($ramos) || empty($ramos)) {
            Log::warning('[BOLIVAR PREFETCH] resumen-ramos empty', ['body_keys' => array_keys($body)]);
            return 0;
        }

        // Build map: normalized_name → [cod_ramo, cod_producto]
        $map = [];
        foreach ($ramos as $r) {
            if (! is_array($r)) {
                continue;
            }
            $code = $r['codigoRamo'] ?? $r['codRamo'] ?? $r['cod_ramo'] ?? null;
            $name = strtolower(trim($r['nombreRamo'] ?? $r['nombre'] ?? $r['ramo'] ?? ''));
            $prod = $r['codigoProducto'] ?? $r['codProducto'] ?? $r['cod_producto'] ?? $code;
            if ($code !== null && $name !== '') {
                $entry = ['cod_ramo' => (int) $code, 'cod_producto' => (int) ($prod ?? $code)];
                $map[$name] = $entry;
                // Register common naming aliases so that e.g. 'automoviles' matches 'autos'
                $aliases = match ($name) {
                    'autos'      => ['automoviles', 'auto', 'vehiculos', 'vehiculo', 'automotor', 'automovil'],
                    'vida'       => ['vida individual', 'vida grupo', 'vida colectiva', 'seguro de vida'],
                    'generales'  => ['incendio', 'hogar', 'pymes', 'empresarial'],
                    'soat'       => ['soat', 'accidentes de transito'],
                    default      => [],
                };
                foreach ($aliases as $alias) {
                    $map[$alias] ??= $entry;
                }
            }
        }

        Log::info('[BOLIVAR PREFETCH] ramo map built', ['keys' => array_keys($map)]);

        if (empty($map)) {
            return 0;
        }

        // Find all Bolívar polizas missing cod_ramo, eager-load ramo relationship
        $polizas = Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(custom_fields, '\\$._sync_source')) = 'bolivar_sync'")
            ->whereRaw("(JSON_EXTRACT(custom_fields, '\\$._detail.cod_ramo') IS NULL)")
            ->with('ramo')
            ->select('id', 'custom_fields', 'ramo_id', 'product_name')
            ->get();

        $updated = 0;
        foreach ($polizas as $poliza) {
            // Try branch name first, then product name as fallback
            $candidates = array_unique(array_filter([
                strtolower(trim(optional($poliza->ramo)->nombre ?? '')),
                strtolower(trim($poliza->custom_fields['_branch_name'] ?? '')),
                strtolower(trim($poliza->product_name ?? '')),
            ]));

            $match = null;
            foreach ($candidates as $candidate) {
                if ($candidate === '') {
                    continue;
                }
                // Exact match
                if (isset($map[$candidate])) {
                    $match = $map[$candidate];
                    break;
                }
                // Partial/substring match: candidate contains a map key or vice-versa
                foreach ($map as $mapKey => $mapEntry) {
                    if (str_contains($candidate, $mapKey) || str_contains($mapKey, $candidate)) {
                        $match = $mapEntry;
                        break 2;
                    }
                }
            }

            if ($match) {
                $cf = $poliza->custom_fields ?? [];
                $cf['_detail'] = array_merge($cf['_detail'] ?? [], $match);
                DB::table('polizas')->where('id', $poliza->id)->update([
                    'custom_fields' => json_encode($cf),
                ]);
                $updated++;
            } else {
                // Fallback: call /bolivar/polizas?doc=... for this specific policy
                // (used when resumen-ramos doesn't list the policy's ramo, e.g. CREDITOS)
                $poliza->loadMissing('client');
                $clientDoc = optional($poliza->client)->document_number ?? $poliza->client_document ?? null;
                if ($clientDoc) {
                    try {
                        $fallbackRes = Http::acceptJson()
                            ->timeout(30)
                            ->withHeaders(['X-Session-Id' => $sessionId])
                            ->get($this->baseUrl() . '/bolivar/polizas', ['doc' => $clientDoc]);
                        if ($fallbackRes->ok()) {
                            foreach ($fallbackRes->json('polizas') ?? [] as $fp) {
                                if (! is_array($fp)) continue;
                                $fpNum = (string) ($fp['numeroPoliza'] ?? $fp['numero_poliza'] ?? '');
                                if ($fpNum !== (string) $poliza->policy_number) continue;
                                $cr = $fp['codigoRamo'] ?? $fp['_codRamo'] ?? $fp['codRamoEmision'] ?? $fp['codRamo'] ?? null;
                                $cp = $fp['codigoProducto'] ?? $fp['_codigoProducto'] ?? $fp['codProducto'] ?? $cr;
                                if ($cr !== null) {
                                    $cf = $poliza->custom_fields ?? [];
                                    $cf['_detail'] = array_merge($cf['_detail'] ?? [], [
                                        'cod_ramo'     => (int) $cr,
                                        'cod_producto' => (int) ($cp ?? $cr),
                                        'cod_compania' => (string) ($fp['codCompania'] ?? '3'),
                                    ]);
                                    DB::table('polizas')->where('id', $poliza->id)->update([
                                        'custom_fields' => json_encode($cf),
                                    ]);
                                    $updated++;
                                }
                                break;
                            }
                        }
                    } catch (\Throwable $e) {
                        Log::debug('[BOLIVAR PREFETCH] fallback lookup failed', ['id' => $poliza->id, 'error' => $e->getMessage()]);
                    }
                } else {
                    Log::debug('[BOLIVAR PREFETCH] no match and no client doc', [
                        'id'         => $poliza->id,
                        'candidates' => $candidates,
                    ]);
                }
            }
        }

        Log::info('[BOLIVAR PREFETCH] done', ['updated' => $updated, 'total' => $polizas->count()]);

        return $updated;
    }

    /**
     * Derive ramo_codigo for SURA polizas that are missing it, using product_name keyword matching.
     * No API call needed — pure local resolution. Returns number of polizas updated.
     */
    public function suraPrefetchRamoCodes(int $brokerId): int
    {
        $polizas = Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(custom_fields, '\\$._sync_source')) = 'sura_sync'")
            ->whereRaw("(JSON_EXTRACT(custom_fields, '\\$._detail.ramo_codigo') IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(custom_fields, '\\$._detail.ramo_codigo')) = '')")
            ->select('id', 'custom_fields', 'product_name')
            ->get();

        $updated = 0;
        foreach ($polizas as $poliza) {
            $candidates = array_unique(array_filter([
                trim($poliza->custom_fields['_branch_name'] ?? ''),
                trim($poliza->product_name ?? ''),
            ]));

            $ramo = '';
            foreach ($candidates as $candidate) {
                if ($candidate !== '') {
                    $ramo = $this->suraGuessRamoFromName($candidate);
                    if ($ramo !== '') {
                        break;
                    }
                }
            }

            if ($ramo !== '') {
                $cf = $poliza->custom_fields ?? [];
                $cf['_detail'] = array_merge($cf['_detail'] ?? [], ['ramo_codigo' => $ramo]);
                DB::table('polizas')->where('id', $poliza->id)->update([
                    'custom_fields' => json_encode($cf),
                ]);
                $updated++;
            }
        }

        Log::info('[SURA PREFETCH] ramo codes resolved', ['updated' => $updated, 'total' => $polizas->count()]);

        return $updated;
    }

    private function bolivarLookupRamoCodes(\App\Models\Poliza $poliza, string $sessionId, array $detailCf): array
    {
        // Get client document from relationship or stored field
        $clientDoc = optional($poliza->client)->document
            ?? $poliza->client_document
            ?? null;

        if (! $clientDoc) {
            throw new \RuntimeException('No se encontró documento del cliente para consultar los códigos de ramo en Bolívar.');
        }

        $res = Http::acceptJson()
            ->timeout(60)
            ->withHeaders(['X-Session-Id' => $sessionId])
            ->get($this->baseUrl() . '/bolivar/polizas', ['doc' => $clientDoc]);

        if ($res->status() === 401) {
            throw new \RuntimeException('Sesión Bolívar expirada. Reconecta la aseguradora desde Configuración.');
        }

        if (! $res->ok()) {
            return $detailCf;
        }

        $polizas = $res->json('polizas') ?? [];
        $policyNumber = (string) $poliza->policy_number;

        foreach ($polizas as $p) {
            if (! is_array($p)) {
                continue;
            }
            $num = (string) ($p['numeroPoliza'] ?? $p['numero_poliza'] ?? '');
            if ($num !== $policyNumber) {
                continue;
            }
            // Found the matching poliza — extract codes (enriched by microservice)
            $cr = $p['codigoRamo'] ?? $p['_codRamo'] ?? $p['codRamoEmision'] ?? $p['codRamo'] ?? $p['cod_ramo'] ?? null;
            $cp = $p['codigoProducto'] ?? $p['_codigoProducto'] ?? $p['codProducto'] ?? $cr;
            if ($cr !== null) {
                $detailCf = array_merge($detailCf, [
                    'cod_ramo' => (int) $cr,
                    'cod_producto' => (int) ($cp ?? $cr),
                    'cod_compania' => (string) ($p['codCompania'] ?? $p['cod_compania'] ?? '3'),
                ]);
                // Persist so next detail sync skips this lookup
                $cf = $poliza->custom_fields ?? [];
                $cf['_detail'] = $detailCf;
                $poliza->custom_fields = $cf;
                $poliza->saveQuietly();
            }
            break;
        }

        return $detailCf;
    }

    private function fetchBolivarPolizaDetail(string $numeroEncoded, string $sessionId, array $detailCf): \Illuminate\Http\Client\Response
    {
        $cr = $detailCf['cod_ramo'] ?? null;
        if ($cr === null) {
            throw new \RuntimeException('Faltan códigos de ramo (cod_ramo) para consultar el detalle en Bolívar. Ejecuta una nueva sincronización principal o usa Resincronizar en la póliza individual.');
        }
        $cp = $detailCf['cod_producto'] ?? $cr;
        $cc = $detailCf['cod_compania'] ?? '3';

        return Http::acceptJson()
            ->timeout(120)
            ->connectTimeout(15)
            ->withHeaders(['X-Session-Id' => $sessionId])
            ->get($this->baseUrl() . "/bolivar/polizas/{$numeroEncoded}/detalle", [
                'cod_ramo'     => $cr,
                'cod_producto' => $cp,
                'cod_compania' => $cc,
            ]);
    }

    private function fetchHdiPolizaDetail(string $numeroEncoded, string $sessionId, array $detailCf): \Illuminate\Http\Client\Response
    {
        $ss = $detailCf['sseguro'] ?? null;
        $pc = $detailCf['product_code'] ?? null;

        return Http::acceptJson()
            ->timeout(120)
            ->connectTimeout(15)
            ->withHeaders(['X-Session-Id' => $sessionId])
            ->get($this->baseUrl() . "/hdi/polizas/{$numeroEncoded}/detail", array_filter([
                'sseguro' => $ss,
                'product_code' => $pc,
            ]));
    }

    private function resolveSuraRamoQueryParam(array $detailCf, ?Poliza $poliza = null): string
    {
        $name = strtoupper((string) ($detailCf['ramo_nombre'] ?? ''));

        // 3-digit → 2-digit mapping
        static $codeMap = [
            '12' => '10',  // ltrimmed alias for 012
            '012' => '10', '013' => '10',
            '028' => '06',
            '030' => '02',
            '040' => '01', '041' => '09', '042' => '01',
            '050' => '05', '060' => '06',
            '081' => '03', '083' => '04', '085' => '03', '086' => '07',
            '090' => '05',
            '100' => '10',
            '181' => '03', '196' => '03',
        ];

        // 1. Use the previously-resolved 2-digit code (_ramo_resolved is set by suraStoreRamo
        //    after a successful fallback resolution — it never overwrites the 3-digit ramo_codigo)
        $resolved = trim((string) ($detailCf['_ramo_resolved'] ?? ''));
        if ($resolved !== '' && strlen($resolved) === 2 && ctype_digit($resolved)) {
            return $resolved;
        }

        // 2. Use the 3-digit listing code from ramo_codigo (set during listing sync, preserved)
        $code = trim((string) ($detailCf['ramo_codigo'] ?? ''));
        if (isset($codeMap[$code])) {
            return $codeMap[$code];
        }
        // Already a clean 2-digit code (guard: only trust if in a known set)
        if (strlen($code) === 2 && ctype_digit($code)) {
            return $code;
        }
        // Leading-zero ltrimmed codes
        $trimCode = ltrim($code, '0');
        if ($trimCode !== '' && strlen($trimCode) <= 2 && ctype_digit($code)) {
            return str_pad($trimCode, 2, '0', STR_PAD_LEFT);
        }

        // 2. Resolve by ramo name stored in _detail
        if ($name !== '') {
            $guessed = $this->suraGuessRamoFromName($name);
            if ($guessed !== '') {
                return $guessed;
            }
        }

        // 3. Fallback to poliza's stored branch_name or product_name
        if ($poliza !== null) {
            $branchName = strtoupper(trim($poliza->custom_fields['_branch_name'] ?? ''));
            if ($branchName !== '') {
                $guessed = $this->suraGuessRamoFromName($branchName);
                if ($guessed !== '') {
                    return $guessed;
                }
            }
            $productName = strtoupper(trim($poliza->product_name ?? ''));
            if ($productName !== '') {
                $guessed = $this->suraGuessRamoFromName($productName);
                if ($guessed !== '') {
                    return $guessed;
                }
            }

            // 4. Fallback: infer ramo from the first 3 digits of the policy number (SURA prefix convention)
            // e.g. "041042648773" → prefix "041" → SOAT → "09"
            //      "012003356796" → prefix "012" → CUMPLIMIENTO → "10"
            //      "086000166942" → prefix "086" → EXEQUIAL → "07"
            $policyNum = trim($poliza->policy_number ?? '');
            if (strlen($policyNum) >= 3) {
                $prefix = substr($policyNum, 0, 3);
                if (ctype_digit($prefix) && isset($codeMap[$prefix])) {
                    // Store the inferred ramo_codigo in custom_fields for next run
                    $cf = $poliza->custom_fields ?? [];
                    $cf['_detail'] = array_merge($cf['_detail'] ?? [], ['ramo_codigo' => $prefix]);
                    $poliza->custom_fields = $cf;
                    $poliza->saveQuietly();
                    return $codeMap[$prefix];
                }
            }
        }

        return $code; // may be empty — caller handles that
    }

    /**
     * Keyword-based guess of SURA ramo code (2-digit) from any name string.
     * Returns '' when no match is found.
     */
    private function suraGuessRamoFromName(string $name): string
    {
        $u = strtoupper($name);
        // Order matters: check more specific patterns first
        if (str_contains($u, 'SOAT')) {
            return '09';
        }
        if (str_contains($u, 'AUTOSURA') || str_contains($u, 'AUTOMOVIL') || str_contains($u, 'AUTOS ') || str_contains($u, 'AUTO ') || $u === 'AUTOMOVILES') {
            return '01';
        }
        if (str_contains($u, 'HOGAR') || str_contains($u, 'HOGARSURA')) {
            return '06';
        }
        if (str_contains($u, 'EXEQUI')) {
            return '07';
        }
        if (str_contains($u, 'ACCIDENTE')) {
            return '08';
        }
        if (str_contains($u, 'CUMPLIMIENTO') || str_contains($u, 'ARRENDAMIENTO')) {
            return '10';
        }
        if (str_contains($u, 'INCENDIO') || str_contains($u, 'EMPRESARIAL')) {
            return '02';
        }
        // Enfermedades Graves is accidentes personales in SURA (not salud, not vida)
        if (str_contains($u, 'ENFERMEDAD')) {
            return '08';
        }
        if (str_contains($u, 'SALUD') || str_contains($u, 'PES ') || str_contains($u, 'SALUD FAMILIAR')) {
            return '05';
        }
        // Colectivo / grupo life
        if (str_contains($u, 'COLECTIVO') || str_contains($u, 'GRUPO') || str_contains($u, 'EMPLEADOS') || str_contains($u, 'VIDA DE GRUPO')) {
            return '04';
        }
        // Individual life / savings products
        if (
            str_contains($u, 'VIDA') ||
            str_contains($u, 'SUCAPITAL') ||
            str_contains($u, 'PLAN VIVE') ||
            str_contains($u, 'CREDITO') ||
            str_contains($u, 'CRÉDITO') ||
            str_contains($u, 'PRORROGADO') ||
            str_contains($u, 'EDUCATIVA') ||
            str_contains($u, 'EDUCACION') ||
            str_contains($u, 'MASVIDA') ||
            str_contains($u, 'JUVENIL') ||
            str_contains($u, 'RENTA')
        ) {
            return '03';
        }
        // Responsabilidad civil — map to cumplimiento when paired with civil
        if (str_contains($u, 'RESPONSABILIDAD')) {
            return '10';
        }
        return '';
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function coveragesRowsFromDetail(string $slug, array $data, string $insurerCode): array
    {
        $rows = [];
        if ($slug === 'hdi') {
            foreach ($data['coberturas'] ?? [] as $c) {
                if (! is_array($c)) {
                    continue;
                }
                $rows[] = [
                    'coverage_type' => null,
                    'coverage_name' => trim(is_scalar($c['nombre'] ?? null) ? (string) ($c['nombre'] ?? 'Cobertura') : 'Cobertura'),
                    'coverage_code' => null,
                    'insured_value' => $this->parseDecimal($c['valor_asegurado'] ?? null),
                    'deductible' => is_scalar($c['deducible'] ?? null) ? (string) $c['deducible'] : null,
                    'deductible_value' => null,
                    'deductible_percentage' => null,
                    'source_insurer' => 'hdi',
                    'raw_data' => $c,
                ];
            }

            return $rows;
        }

        if ($slug === 'sura') {
            $this->collectSuraLikeCoverages($data, $rows, 'sura');

            return $rows;
        }

        if ($slug === 'bolivar') {
            $this->collectBolivarCoverages($data, $rows);

            return $rows;
        }

        return $rows;
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function collectSuraLikeCoverages(array $node, array &$rows, string $source, int $depth = 0): void
    {
        if ($depth > 12) {
            return;
        }
        foreach ($node as $key => $v) {
            if (! is_array($v)) {
                continue;
            }
            // Skip non-coverage arrays: asesores, recibos, reclamaciones, others
            if (in_array($key, ['asesores', '_recibos_pendientes', '_reclamaciones', 'recibos', 'reclamaciones',
                                 'afiliados', 'tomadores', 'beneficiarios', 'otros'], true)) {
                continue;
            }
            if (isset($v[0]) && is_array($v[0])) {
                foreach ($v as $item) {
                    if (! is_array($item)) {
                        continue;
                    }
                    // Coverage name fields (in priority order):
                    // amparos/amparosAdicionales: nombreAmparo
                    // SOAT: cobertura; cumplimiento: amparo; others: nombreCobertura/nombre
                    $name = $item['nombreAmparo'] ?? $item['nombreCobertura'] ?? $item['nombre']
                          ?? $item['descripcionCobertura'] ?? $item['descripcion']
                          ?? $item['cobertura'] ?? $item['amparo'] ?? null;
                    $tipo = $item['tipoCobertura'] ?? $item['tipo'] ?? null;
                    if (is_string($name) && $name !== '' && (is_string($tipo) || $tipo === null)) {
                        // Skip asesor-like entries (have 'codigo' and 'esLider' but no coverage-specific fields)
                        if (isset($item['esLider']) && ! isset($item['tipoCobertura'])) {
                            continue;
                        }
                        // For SOAT: valorAsegurado comes as "$702" — strip $
                        // For amparos: valorAseguradoAlcanzado is the current insured value
                        $rawInsured = $item['ptaAsegurado'] ?? $item['valorAseguradoAlcanzado']
                                   ?? $item['valorAseguradoInicial'] ?? $item['valorAsegurado']
                                   ?? $item['valor_asegurado'] ?? $item['sumaAsegurada'] ?? null;
                        if (is_string($rawInsured)) {
                            $rawInsured = ltrim($rawInsured, '$');
                        }
                        $rows[] = [
                            'coverage_type' => $tipo ?? ($item['articulo'] ?? null),
                            'coverage_name' => trim($name),
                            'coverage_code' => isset($item['codigoCobertura']) ? (string) $item['codigoCobertura'] : null,
                            'insured_value' => $this->parseDecimal($rawInsured),
                            'deductible' => isset($item['porcentajeDeducibleMinimo'])
                                ? (is_scalar($item['porcentajeDeducibleMinimo']) ? (string) $item['porcentajeDeducibleMinimo'] : null)
                                : (isset($item['deducible']) ? (is_scalar($item['deducible']) ? (string) $item['deducible'] : null) : null),
                            'deductible_value' => null,
                            'deductible_percentage' => null,
                            'source_insurer' => $source,
                            'raw_data' => $item,
                        ];
                    } else {
                        $this->collectSuraLikeCoverages($item, $rows, $source, $depth + 1);
                    }
                }
            } else {
                $this->collectSuraLikeCoverages($v, $rows, $source, $depth + 1);
            }
        }
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function collectBolivarCoverages(array $data, array &$rows): void
    {
        $lists = [
            $data['listaCoberturas'] ?? null,
            $data['coberturas'] ?? null,
            $data['detalleCoberturas'] ?? null,
        ];
        foreach ($lists as $list) {
            if (! is_array($list)) {
                continue;
            }
            foreach ($list as $c) {
                if (! is_array($c)) {
                    continue;
                }
                $name = $c['nombre'] ?? $c['descripcion'] ?? $c['nombreCobertura'] ?? null;
                if (! is_string($name) || $name === '') {
                    continue;
                }
                $rows[] = [
                    'coverage_type' => $c['tipo'] ?? null,
                    'coverage_name' => trim($name),
                    'coverage_code' => isset($c['codigo']) ? (string) $c['codigo'] : null,
                    'insured_value' => $this->parseDecimal($c['valorAsegurado'] ?? $c['valor_asegurado'] ?? null),
                    'deductible' => isset($c['deducible']) ? (is_scalar($c['deducible']) ? (string) $c['deducible'] : null) : null,
                    'deductible_value' => null,
                    'deductible_percentage' => null,
                    'source_insurer' => 'bolivar',
                    'raw_data' => $c,
                ];
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function polizaFieldUpdatesFromDetail(string $slug, array $data): array
    {
        if ($slug === 'sura') {
            return $this->polizaFieldUpdatesFromSuraDetail($data);
        }

        if ($slug !== 'hdi') {
            return [];
        }
        $out = [];
        if (! empty($data['tomador']) && is_array($data['tomador'])) {
            $t = $data['tomador'];
            foreach ([
                'policy_holder_name'     => $t['nombre'] ?? null,
                'policy_holder_document' => $t['documento'] ?? null,
                'policy_holder_doc_type' => isset($t['tipo_documento'])
                    ? (self::DOC_TYPE_MAP[strtoupper($t['tipo_documento'])] ?? $t['tipo_documento'])
                    : null,
                'policy_holder_phone'    => $t['telefono'] ?? null,
                'policy_holder_email'    => $t['email'] ?? null,
                'policy_holder_address'  => $t['direccion'] ?? null,
                'policy_holder_city'     => $t['ciudad'] ?? null,
            ] as $k => $v) {
                if ($v !== null && $v !== '') {
                    $out[$k] = $v;
                }
            }
        }
        if (! empty($data['objeto_asegurado']) && is_array($data['objeto_asegurado'])) {
            $obj = $data['objeto_asegurado'];
            $out['datos_objeto_asegurado'] = json_encode($obj, JSON_UNESCAPED_UNICODE);
            // Campos individuales del vehículo
            if (! empty($obj['valor_comercial'])) {
                $out['insured_amount'] = $this->parseDecimal($obj['valor_comercial']);
            }
            if (! empty($obj['placa'])) {
                $out['vehicle_plates'] = [$obj['placa']];
                // Descripción del riesgo: placa + marca/modelo/año
                $descParts = array_filter([
                    strtoupper($obj['placa']),
                    ! empty($obj['marca']) ? $obj['marca'] : null,
                    ! empty($obj['vehiculo']) ? $obj['vehiculo'] : (! empty($obj['modelo']) ? $obj['modelo'] : null),
                    ! empty($obj['anio']) ? $obj['anio'] : null,
                ]);
                $out['description'] = implode(' - ', $descParts);
            }
            if (! empty($obj['accesorios']) && is_array($obj['accesorios'])) {
                $out['accesorios'] = json_encode($obj['accesorios'], JSON_UNESCAPED_UNICODE);
            }
        }

        // Asegurado
        if (! empty($data['asegurado']) && is_array($data['asegurado'])) {
            $a = $data['asegurado'];
            if (! empty($a['nombre'])) $out['insured_name']     = $a['nombre'];
            if (! empty($a['documento'])) $out['insured_document'] = $a['documento'];
        }

        // Beneficiario
        if (! empty($data['beneficiario']) && is_array($data['beneficiario'])) {
            $b = $data['beneficiario'];
            if (! empty($b['nombre'])) $out['beneficiary_name']     = $b['nombre'];
            if (! empty($b['documento'])) $out['beneficiary_document'] = $b['documento'];
            if (! empty($b['tipo_beneficiario'])) $out['beneficiary_relationship'] = $b['tipo_beneficiario'];
        }

        // Datos del listing (prima, vigencias, estado, ramo) — sólo presentes en el primer sync (auto-lookup)
        if (! empty($data['_listing']) && is_array($data['_listing'])) {
            $l = $data['_listing'];
            $prima = $this->parseDecimal($l['prima'] ?? null);
            $map = [
                'start_date'             => $this->parseDate($l['fecha_inicio'] ?? ''),
                'end_date'               => $this->parseDate($l['fecha_fin'] ?? ''),
                'issue_date'             => $this->parseDate($l['fecha_expedicion'] ?? ''),
                'status'                 => $this->normalizePolizaStatus($l['estado'] ?? ''),
                'product_name'           => (($l['producto'] ?? '') === '' || ($l['producto'] ?? '') === '-')
                                               ? ($l['ramo_nombre'] ?? null)
                                               : $l['producto'],
                'premium_amount'         => $prima,
                'total_amount'           => $prima,   // HDI sólo da un valor de prima
                'payment_frequency'      => $this->mapPaymentFrequency($l['forma_pago'] ?? ''),
                // Tomador desde listing (fallback si el detail no los trajo)
                'client_name'            => ! empty($l['nombre_tomador']) ? trim($l['nombre_tomador']) : null,
                'client_document'        => ! empty($l['documento_tomador']) ? trim($l['documento_tomador']) : null,
                'policy_holder_doc_type' => ! empty($l['tipo_doc_tomador'])
                    ? (self::DOC_TYPE_MAP[strtoupper($l['tipo_doc_tomador'])] ?? $l['tipo_doc_tomador'])
                    : null,
            ];
            // Sólo actualizar campos que tengan valor real
            foreach ($map as $k => $v) {
                if ($v !== null && $v !== '' && $v !== 0.0) {
                    $out[$k] = $v;
                }
            }
            // Comisión (puede venir como % "10%", "12,50%" o como monto "330761")
            if (! empty($l['comision'])) {
                $comStr = trim((string) $l['comision']);
                if (str_ends_with($comStr, '%')) {
                    // Reemplazar coma decimal antes de castear (ej: "12,50%" → 12.5)
                    $rawPct = str_replace(',', '.', rtrim($comStr, '%'));
                    $pct = is_numeric($rawPct) ? (float) $rawPct : null;
                    if ($pct !== null) $out['commission_percentage'] = $pct;
                } else {
                    $amt = $this->parseDecimal($comStr);
                    if ($amt !== null && $amt > 0) $out['commission_amount'] = $amt;
                }
            }

            // Ramo: buscar o crear
            if (! empty($l['ramo_nombre'])) {
                $out['_branch_name_for_detail'] = $l['ramo_nombre'];
            }
        }

        return $out;
    }

    /**
     * Extract poliza field updates from a SURA detail response.
     * SURA returns ramo-specific JSON; we try common field names defensively.
     *
     * @return array<string, mixed>
     */
    private function polizaFieldUpdatesFromSuraDetail(array $data): array
    {
        $out = [];

        // ── SOAT: basicInformation flat object ──────────────────────────────
        // Endpoint: /ohs-oracle/polizas/soat → response has {basicInformation:{...}, coberturas:[]}
        $bi = $data['basicInformation'] ?? null;
        if (is_array($bi) && ! empty($bi)) {
            $nombre = trim($bi['nombreTomador'] ?? '');
            $doc    = trim((string) ($bi['numeroIdTomador'] ?? ''));
            $tipo   = trim($bi['tipoIdTomador'] ?? '');
            if ($nombre !== '') { $out['policy_holder_name'] = $nombre; $out['client_name'] = $nombre; }
            if ($doc    !== '') { $out['policy_holder_document'] = $doc; $out['client_document'] = $doc; }
            if ($tipo   !== '') { $out['policy_holder_doc_type'] = self::DOC_TYPE_MAP[strtoupper($tipo)] ?? $tipo; }
            foreach ([
                'policy_holder_phone'   => $bi['telefono']  ?? null,
                'policy_holder_address' => $bi['direccion'] ?? null,
                'policy_holder_city'    => $bi['ciudad']    ?? $bi['nomCiudad'] ?? null,
            ] as $field => $value) {
                if ($value !== null && $value !== '') $out[$field] = trim((string) $value);
            }
            $fi = $this->parseDate($bi['fechaInicioVigencia'] ?? '');
            $ff = $this->parseDate($bi['fechaFinVigencia']    ?? '');
            $fe = $this->parseDate($bi['fechaExpedicion']     ?? '');
            if ($fi) $out['start_date'] = $fi;
            if ($ff) $out['end_date']   = $ff;
            if ($fe) $out['issue_date'] = $fe;
            $estado = $bi['estado'] ?? '';
            if ($estado !== '') $out['status'] = $this->normalizePolizaStatus($estado);
            // SOAT vehicle data
            $soatPlaca = strtoupper(trim($bi['placa'] ?? ''));
            if ($soatPlaca !== '') {
                $out['vehicle_plates'] = [$soatPlaca];
                $out['_sura_vehiculo'] = array_filter([
                    'placa'   => $soatPlaca,
                    'marca'   => $bi['marca']   ?? null,
                    'modelo'  => $bi['modelo']  ?? null,
                    'motor'   => $bi['motor']   ?? null,
                    'chasis'  => $bi['chasis']  ?? null,
                ], fn ($v) => $v !== null && $v !== '');
            }
        }

        // ── Oracle/Hogar: informacionBasica flat object ──────────────────────
        $ib = $data['informacionBasica'] ?? null;
        if (is_array($ib) && ! empty($ib)) {
            $nombre = trim($ib['nombreTomador'] ?? '');
            $doc    = trim((string) ($ib['numeroIdTomador'] ?? ''));
            $tipo   = trim($ib['tipoIdTomador'] ?? '');
            if ($nombre !== '' && empty($out['policy_holder_name'])) {
                $out['policy_holder_name'] = $nombre;
                $out['client_name']        = $nombre;
            }
            if ($doc !== '' && empty($out['policy_holder_document'])) {
                $out['policy_holder_document'] = $doc;
                $out['client_document']        = $doc;
            }
            if ($tipo !== '' && empty($out['policy_holder_doc_type'])) {
                $out['policy_holder_doc_type'] = self::DOC_TYPE_MAP[strtoupper($tipo)] ?? $tipo;
            }
            foreach ([
                'policy_holder_email'   => $ib['email']    ?? null,
                'policy_holder_phone'   => $ib['telefono'] ?? null,
                'policy_holder_address' => $ib['direccion'] ?? null,
                'policy_holder_city'    => $ib['ciudad']   ?? null,
            ] as $field => $value) {
                if ($value !== null && $value !== '' && empty($out[$field])) {
                    $out[$field] = trim((string) $value);
                }
            }
            // Asegurado
            $nombreAs = trim($ib['nombreAsegurado'] ?? '');
            $docAs    = trim((string) ($ib['numeroIdAsegurado'] ?? ''));
            if ($nombreAs !== '') $out['insured_name']     = $nombreAs;
            if ($docAs    !== '') $out['insured_document'] = $docAs;
            // Beneficiario
            $nombreBen = trim($ib['nombreBeneficiario'] ?? '');
            $docBen    = trim((string) ($ib['numeroIdBeneficiario'] ?? ''));
            if ($nombreBen !== '') $out['beneficiary_name']     = $nombreBen;
            if ($docBen    !== '') $out['beneficiary_document'] = $docBen;
            // Fechas
            if (empty($out['start_date'])) {
                $fi = $this->parseDate($ib['fechaInicioVigencia'] ?? '');
                $ff = $this->parseDate($ib['fechaFinVigencia']    ?? '');
                $fe = $this->parseDate($ib['fechaExpedicion']     ?? '');
                if ($fi) $out['start_date']  = $fi;
                if ($ff) $out['end_date']    = $ff;
                if ($fe) $out['issue_date']  = $fe;
            }
            // Estado
            $estado = $ib['estado'] ?? '';
            if ($estado !== '' && empty($out['status'])) $out['status'] = $this->normalizePolizaStatus($estado);
        }

        // ── Vida Individual: informacionBasicaPoliza nested object ───────────
        // Endpoint: /ohs-aseguramiento/polizas/vidaindividual
        $ibp = $data['informacionBasicaPoliza'] ?? null;
        if (is_array($ibp) && ! empty($ibp) && empty($out['start_date'])) {
            $fi = $this->parseDate($ibp['fechaInicioVigencia'] ?? '');
            $ff = $this->parseDate($ibp['fechaFinVigencia']    ?? '');
            $fe = $this->parseDate($ibp['fechaExpedicion']     ?? $ibp['fechaNuevaExpedicion'] ?? '');
            if ($fi) $out['start_date'] = $fi;
            if ($ff) $out['end_date']   = $ff;
            if ($fe) $out['issue_date'] = $fe;
            $estado = $ibp['estado'] ?? '';
            if ($estado !== '' && empty($out['status'])) $out['status'] = $this->normalizePolizaStatus($estado);
            $sumaV = $this->parseDecimal($ibp['valorAsegurado'] ?? null);
            if ($sumaV !== null && $sumaV > 0 && empty($out['insured_amount'])) $out['insured_amount'] = $sumaV;
        }

        // ── Exequiales / MasVida / VidaGrupo / VidaIndividual: poliza nested + tomadores[] ──
        // tomadores is an array, tomador may be an object
        $polizaNested = $data['poliza'] ?? null;
        if (is_array($polizaNested) && ! empty($polizaNested) && empty($out['start_date'])) {
            $fi = $this->parseDate($polizaNested['fechaInicioVigencia'] ?? '');
            $ff = $this->parseDate($polizaNested['fechaFinVigencia']    ?? '');
            $fe = $this->parseDate($polizaNested['fechaExpedicion']     ?? '');
            if ($fi) $out['start_date'] = $fi;
            if ($ff) $out['end_date']   = $ff;
            if ($fe) $out['issue_date'] = $fe;
            $estado = $polizaNested['estado'] ?? '';
            if ($estado !== '' && empty($out['status'])) $out['status'] = $this->normalizePolizaStatus($estado);
            $sumaPoliza = $this->parseDecimal($polizaNested['valorAseguradoPoliza'] ?? $polizaNested['valorAsegurado'] ?? null);
            if ($sumaPoliza !== null && $sumaPoliza > 0 && empty($out['insured_amount'])) $out['insured_amount'] = $sumaPoliza;
        }
        // tomadores[] array (exequiales, masvida, vidaindividual)
        $tomadoresArr = $data['tomadores'] ?? null;
        if (is_array($tomadoresArr) && ! empty($tomadoresArr) && empty($out['policy_holder_name'])) {
            $t = $tomadoresArr[0];
            $nombre = trim($t['nombreTomador'] ?? $t['nombre'] ?? '');
            $doc    = trim((string) ($t['numeroDni'] ?? $t['nroIdentificacion'] ?? ''));
            $tipo   = trim($t['tipoDni'] ?? $t['tipoIdentificacion'] ?? '');
            $email  = trim($t['email']   ?? '');
            $tel    = trim($t['telefono'] ?? '');
            $dir    = trim($t['direccion'] ?? '');
            $ciudad = trim($t['ciudad']   ?? '');
            if ($nombre !== '') { $out['policy_holder_name'] = $nombre; $out['client_name'] = $nombre; }
            if ($doc    !== '') { $out['policy_holder_document'] = $doc; $out['client_document'] = $doc; }
            if ($tipo   !== '') { $out['policy_holder_doc_type'] = self::DOC_TYPE_MAP[strtoupper($tipo)] ?? $tipo; }
            if ($email  !== '') $out['policy_holder_email']   = $email;
            if ($tel    !== '') $out['policy_holder_phone']   = $tel;
            if ($dir    !== '') $out['policy_holder_address'] = $dir;
            if ($ciudad !== '') $out['policy_holder_city']    = $ciudad;
        }

        // ── Vida Individual/Grupo: tomador as array [{nroIdentificacion, tipoIdentificacion, nombreTomador}] ──
        // In vidaindividual response the field is also 'tomador' (array not object)
        $tomadorRaw = $data['tomador'] ?? null;
        if (is_array($tomadorRaw) && isset($tomadorRaw[0]) && empty($out['policy_holder_name'])) {
            $t = $tomadorRaw[0];
            $nombre = trim($t['nombreTomador'] ?? $t['nombre'] ?? '');
            $doc    = trim((string) ($t['nroIdentificacion'] ?? $t['numeroDni'] ?? $t['dni'] ?? ''));
            $tipo   = trim($t['tipoIdentificacion'] ?? $t['tipoDni'] ?? '');
            if ($nombre !== '') { $out['policy_holder_name'] = $nombre; $out['client_name'] = $nombre; }
            if ($doc    !== '') { $out['policy_holder_document'] = $doc; $out['client_document'] = $doc; }
            if ($tipo   !== '') { $out['policy_holder_doc_type'] = self::DOC_TYPE_MAP[strtoupper($tipo)] ?? $tipo; }
        }

        // ── Juvenil oracle: flat tomadorNombre/tomadorDni fields ────────────
        $jNombre = trim($data['tomadorNombre'] ?? '');
        if ($jNombre !== '' && empty($out['policy_holder_name'])) {
            $out['policy_holder_name'] = $jNombre;
            $out['client_name']        = $jNombre;
            $jDni  = trim((string) ($data['tomadorDni'] ?? ''));
            $jTipo = trim($data['tomadorTipoDni'] ?? '');
            if ($jDni  !== '') { $out['policy_holder_document'] = $jDni;  $out['client_document'] = $jDni; }
            if ($jTipo !== '') $out['policy_holder_doc_type'] = self::DOC_TYPE_MAP[strtoupper($jTipo)] ?? $jTipo;
            foreach ([
                'policy_holder_phone'   => $data['tomadorTelefono']  ?? null,
                'policy_holder_address' => $data['tomadorDireccion'] ?? null,
                'policy_holder_city'    => $data['tomadorCiudad']    ?? null,
            ] as $field => $value) {
                if ($value !== null && $value !== '' && empty($out[$field])) $out[$field] = trim((string) $value);
            }
        }

        // ── Educacion oracle: basic{} with English field names ───────────────
        $basicObj = $data['basic'] ?? null;
        if (is_array($basicObj) && ! empty($basicObj) && empty($out['policy_holder_name'])) {
            $nombre = trim($basicObj['taker'] ?? '');
            $doc    = trim((string) ($basicObj['dniTaker'] ?? ''));
            $tipo   = trim($basicObj['typeDniTaker'] ?? '');
            if ($nombre !== '') { $out['policy_holder_name'] = $nombre; $out['client_name'] = $nombre; }
            if ($doc    !== '') { $out['policy_holder_document'] = $doc; $out['client_document'] = $doc; }
            if ($tipo   !== '') $out['policy_holder_doc_type'] = self::DOC_TYPE_MAP[strtoupper($tipo)] ?? $tipo;
            foreach (['policy_holder_phone' => 'phoneTaker', 'policy_holder_address' => 'addressTaker', 'policy_holder_city' => 'cityTaker'] as $field => $key) {
                if (! empty($basicObj[$key]) && empty($out[$field])) $out[$field] = trim((string) $basicObj[$key]);
            }
            // Dates are stored as separate year/month/day fields
            if (empty($out['start_date']) && ! empty($basicObj['insuredStartValidityYear'])) {
                $fi = $this->parseDate(sprintf('%s/%s/%s',
                    $basicObj['insuredStartValidityYear'],
                    $basicObj['insuredStartValidityMonth'] ?? '01',
                    $basicObj['insuredStartValidityDay']   ?? '01'
                ));
                if ($fi) $out['start_date'] = $fi;
            }
            if (empty($out['end_date']) && ! empty($basicObj['insuredEndValidityYear'])) {
                $ff = $this->parseDate(sprintf('%s/%s/%s',
                    $basicObj['insuredEndValidityYear'],
                    $basicObj['insuredEndValidityMonth'] ?? '01',
                    $basicObj['insuredEndValidityDay']   ?? '01'
                ));
                if ($ff) $out['end_date'] = $ff;
            }
        }

        // ── Prima: primasTotales (oracle hogar endpoint) ─────────────────────
        $pt = $data['primasTotales'] ?? null;
        if (is_array($pt)) {
            $prima = $this->parseDecimal($pt['primaTotalAnual'] ?? $pt['primaSegunFormaPago'] ?? null);
            if ($prima !== null && $prima > 0) {
                $out['premium_amount'] = $prima;
                $out['total_amount']   = $prima;
            }
        }

        // ── Prima: primas{} (vida grupo / vida individual endpoints) ────────
        $primasObj = $data['primas'] ?? null;
        if (is_array($primasObj) && empty($out['premium_amount'])) {
            // vidagrupo uses primaTotal; vidaindividual uses total (fraccionada) or produccionAcumulada
            $prima = $this->parseDecimal(
                $primasObj['primaTotal'] ?? $primasObj['primaSegunFormaPago'] ??
                $primasObj['total'] ?? null
            );
            if ($prima !== null && $prima > 0) {
                $out['premium_amount'] = $prima;
                $out['total_amount']   = $prima;
            }
        }

        // ── Prima: sum amparos[].primaAnual for vida individual annual premium ──
        if (empty($out['premium_amount'])) {
            $totalPrimaAnual = 0.0;
            foreach (array_merge($data['amparos'] ?? [], $data['amparosAdicionales'] ?? []) as $amp) {
                $pa = $this->parseDecimal($amp['primaAnual'] ?? null);
                if ($pa !== null) $totalPrimaAnual += $pa;
            }
            if ($totalPrimaAnual > 0) {
                $out['premium_amount'] = $totalPrimaAnual;
                $out['total_amount']   = $totalPrimaAnual;
            }
        }

        // ── Suma asegurada: largest valorAseguradoAlcanzado across amparos ───
        if (empty($out['insured_amount'])) {
            $maxSuma = 0.0;
            foreach (array_merge($data['amparos'] ?? [], $data['amparosAdicionales'] ?? []) as $amp) {
                $sv = $this->parseDecimal($amp['valorAseguradoAlcanzado'] ?? $amp['valorAseguradoInicial'] ?? null);
                if ($sv !== null && $sv > $maxSuma) $maxSuma = $sv;
            }
            if ($maxSuma > 0) $out['insured_amount'] = $maxSuma;
        }

        // ── Tomador object (non-array) ────────────────────────────────────────
        // Vida Grupo returns tomador as {"tipoDni":"NIT","dni":"...","nombre":"...","telefono":"..."}
        // (We already handled tomador-as-array above; handle as-object here)
        $tomador = $data['tomador'] ?? $data['informacionTomador'] ?? $data['dataTomador'] ?? null;
        if (is_string($tomador) && $tomador !== '' && empty($out['policy_holder_document'])) {
            // Cumplimiento: tomador is a string like "NIT 9015517633"
            $parts = preg_split('/\s+/', trim($tomador), 2);
            if (count($parts) === 2) {
                $tipo = strtoupper($parts[0]);
                $doc  = $parts[1];
                $out['policy_holder_document'] = $doc;
                $out['client_document']        = $doc;
                $out['policy_holder_doc_type'] = self::DOC_TYPE_MAP[$tipo] ?? $tipo;
            }
        }
        if (is_array($tomador) && ! isset($tomador[0])) {
            // Object form: {tipoDni, dni, nombre, telefono, ...}
            if (empty($out['policy_holder_name'])) {
                $tn = trim($tomador['nombre'] ?? $tomador['nombreTomador'] ?? '');
                $td = trim((string) ($tomador['dni'] ?? $tomador['documento'] ?? $tomador['dniTomador'] ?? ''));
                $tt = trim($tomador['tipoDni'] ?? $tomador['tipoDocumento'] ?? '');
                if ($tn !== '') { $out['policy_holder_name'] = $tn; $out['client_name'] = $tn; }
                if ($td !== '') { $out['policy_holder_document'] = $td; $out['client_document'] = $td; }
                if ($tt !== '') $out['policy_holder_doc_type'] = self::DOC_TYPE_MAP[strtoupper($tt)] ?? $tt;
                if (! empty($tomador['telefono']) && empty($out['policy_holder_phone'])) $out['policy_holder_phone'] = trim($tomador['telefono']);
            }
        }
        // (indexed-array tomador is already handled in the tomadores[]/tomador[] sections above)
        // Nothing to do for is_array($tomador) && isset($tomador[0]) here.

        // ── Flat aseguramiento format (autos, salud, vida, etc.) ────────────────
        // The SURA aseguramiento endpoints return flat fields, not nested objects.
        $flatNombre = trim($data['nombreTomador'] ?? '');
        $flatDni    = trim((string) ($data['dniTomador'] ?? ''));
        $flatTipo   = trim($data['tipoDniTomador'] ?? '');
        if ($flatNombre !== '' && empty($out['policy_holder_name'])) {
            $out['policy_holder_name'] = $flatNombre;
            $out['client_name']        = $flatNombre;
        }
        if ($flatDni !== '' && empty($out['policy_holder_document'])) {
            // dniTomador sometimes includes prefix like "C98496590" → strip it
            $cleanDni = ltrim($flatDni, 'CNE');
            $out['policy_holder_document'] = $cleanDni ?: $flatDni;
            $out['client_document']        = $cleanDni ?: $flatDni;
        }
        if ($flatTipo !== '' && empty($out['policy_holder_doc_type'])) {
            $out['policy_holder_doc_type'] = self::DOC_TYPE_MAP[strtoupper($flatTipo)] ?? $flatTipo;
        }
        foreach ([
            'policy_holder_phone'   => $data['numeroTelefono'] ?? null,
            'policy_holder_address' => $data['direccion'] ?? null,
            'policy_holder_city'    => $data['ciudad'] ?? null,
            'policy_holder_email'   => $data['correoAsegurado'] ?? null,
        ] as $field => $value) {
            if ($value !== null && (string) $value !== '' && empty($out[$field])) {
                $out[$field] = trim((string) $value);
            }
        }
        // Flat dates (riesgo dates from aseguramiento autos/salud)
        foreach ([
            'start_date' => $data['fechaInicioVigenciaRiesgo'] ?? $data['fechaInicioVigencia'] ?? null,
            'end_date'   => $data['fechaFinVigenciaRiesgo']    ?? $data['fechaFinVigencia']    ?? null,
            'issue_date' => $data['fechaExpedicion'] ?? null,
        ] as $field => $value) {
            if ($value !== null && (string) $value !== '' && empty($out[$field])) {
                $parsed = $this->parseDate((string) $value);
                if ($parsed) $out[$field] = $parsed;
            }
        }
        // Flat estado
        $flatEstado = $data['estado'] ?? '';
        if ($flatEstado !== '' && empty($out['status'])) {
            $out['status'] = $this->normalizePolizaStatus($flatEstado);
        }

        // ── Prima / valor asegurado ──────────────────────────────────────────
        $prima = $this->parseDecimal(
            $data['ptprimaformapago'] ??  // SURA autos flat format
            $data['primaTotal'] ?? $data['prima'] ?? $data['valorPrima'] ??
            $data['primaAnual'] ?? $data['primaTotalAsegurada'] ?? null
        );
        if ($prima !== null && $prima > 0) {
            $out['premium_amount'] = $prima;
            $out['total_amount']   = $prima;
        }

        $sumaAsegurada = $this->parseDecimal(
            $data['valorVehiculo'] ??     // SURA autos flat format
            $data['sumaAsegurada'] ?? $data['valorAsegurado'] ??
            $data['montoAsegurado'] ?? $data['valorTotal'] ?? null
        );
        if ($sumaAsegurada !== null && $sumaAsegurada > 0) {
            $out['insured_amount'] = $sumaAsegurada;
        }

        // ── Asegurado (beneficiario principal en vida/salud) ─────────────────
        $asegurado = $data['asegurado'] ?? $data['informacionAsegurado'] ?? null;
        if (is_array($asegurado)) {
            $an = $asegurado['nombre'] ?? $asegurado['nombreAsegurado'] ?? null;
            $ad = $asegurado['documento'] ?? $asegurado['numeroDocumento'] ?? null;
            if ($an !== null && $an !== '') $out['insured_name']     = trim((string) $an);
            if ($ad !== null && $ad !== '') $out['insured_document'] = trim((string) $ad);
        }
        // Flat asegurado (autos format)
        $flatNombreAs = trim($data['nombreAsegurado'] ?? '');
        if ($flatNombreAs !== '' && empty($out['insured_name'])) {
            $out['insured_name'] = $flatNombreAs;
        }

        // ── Objeto asegurado / vehículo (ramo 01 – autos) ────────────────────
        // SURA autos: vehicle info is flat in the root of the response
        // (data['vehiculo'] is a string like "CAMPEROS Y PICKUPS", not an array)
        $flatPlaca = strtoupper(trim($data['placa'] ?? ''));
        if ($flatPlaca !== '' && ! is_array($data['vehiculo'] ?? null)) {
            $flatMarca  = $data['marca']  ?? null;
            $flatModelo = $data['modelo'] ?? null;
            $flatMotor  = $data['motor']  ?? null;
            $flatChasis = $data['chasis'] ?? null;
            $flatFasecolda = $data['cdFaseColda'] ?? null;
            $flatValor  = $this->parseDecimal($data['valorVehiculo'] ?? null);
            $out['vehicle_plates'] = [$flatPlaca];
            $descParts = array_filter([$flatPlaca, $flatMarca ? (string) $flatMarca : null, $flatModelo ? (string) $flatModelo : null]);
            if ($descParts) $out['description'] = implode(' - ', $descParts);
            if ($flatValor !== null && $flatValor > 0) $out['insured_amount'] = $flatValor;
            $out['_sura_vehiculo'] = array_filter([
                'placa'        => $flatPlaca,
                'marca'        => $flatMarca,
                'modelo'       => $flatModelo,
                'anio'         => null,
                'motor'        => $flatMotor,
                'chasis'       => $flatChasis,
                'fasecolda'    => $flatFasecolda,
                'valor'        => $flatValor,
            ], fn ($v) => $v !== null && $v !== '');
        }

        $vehiculo = $data['vehiculo'] ?? $data['riesgo'] ?? $data['objetoAsegurado'] ?? null;
        if (is_array($vehiculo)) {
            $placa = strtoupper(trim($vehiculo['placa'] ?? $vehiculo['numeroPlaca'] ?? $vehiculo['matricula'] ?? ''));
            if ($placa !== '') {
                $out['vehicle_plates'] = [$placa];
                $marca   = $vehiculo['marca']    ?? $vehiculo['nombreMarca']   ?? null;
                $modelo  = $vehiculo['linea']    ?? $vehiculo['modelo']        ?? $vehiculo['nombreModelo'] ?? null;
                $anio    = $vehiculo['anio']     ?? $vehiculo['modeloAnio']    ?? $vehiculo['modelo_anio']  ?? null;
                $color   = $vehiculo['color']    ?? null;
                $vin     = $vehiculo['vin']      ?? $vehiculo['chasis']        ?? $vehiculo['numeroChasis'] ?? null;
                $motor   = $vehiculo['motor']    ?? $vehiculo['numeroMotor']   ?? null;
                $valor   = $this->parseDecimal($vehiculo['valorComercial'] ?? $vehiculo['valor'] ?? null);

                $descParts = array_filter([
                    $placa,
                    $marca  ? (string) $marca  : null,
                    $modelo ? (string) $modelo : null,
                    $anio   ? (string) $anio   : null,
                ]);
                if ($descParts) {
                    $out['description'] = implode(' - ', $descParts);
                }
                if ($valor !== null && $valor > 0) {
                    $out['insured_amount'] = $valor;
                }

                // Store full vehicle object for Automovil upsert (handled in sync loop)
                $out['_sura_vehiculo'] = array_filter([
                    'placa'   => $placa,
                    'marca'   => $marca,
                    'modelo'  => $modelo,
                    'anio'    => $anio   !== null ? (int) $anio : null,
                    'color'   => $color,
                    'vin'     => $vin,
                    'motor'   => $motor,
                    'valor'   => $valor,
                ], fn ($v) => $v !== null && $v !== '');
            }
        }

        // ── FALLBACK GENÉRICO: buscar prima recursivamente ───────────────────
        // Sura devuelve estructuras muy distintas por ramo (Salud, Incendio,
        // Hogar, Empresariales, etc.). Como no podemos hardcodear todas las
        // variantes, hacemos búsqueda recursiva de claves tipo prima* y nos
        // quedamos con el mayor valor encontrado (suele ser la prima anual).
        if (empty($out['premium_amount'])) {
            $found = $this->findPrimaRecursive($data);
            if ($found !== null && $found > 0) {
                $out['premium_amount'] = $found;
                $out['total_amount']   = $found;
            }
        }
        // Idem para suma asegurada (sumaAsegurada, valorAsegurado, valorMaxAsegurado)
        if (empty($out['insured_amount'])) {
            $suma = $this->findSumaAseguradaRecursive($data);
            if ($suma !== null && $suma > 0) {
                $out['insured_amount'] = $suma;
            }
        }

        return $out;
    }

    /**
     * Busca recursivamente claves tipo `prima*` / `valorPrima*` / `*Prima*`
     * y devuelve el mayor valor numérico encontrado. Ignora porcentajes
     * (valores <= 100) y campos claramente no-monetarios.
     */
    private function findPrimaRecursive(mixed $data, int $depth = 0): ?float
    {
        if ($depth > 8 || !is_array($data)) return null;
        $max = null;
        foreach ($data as $key => $val) {
            if (is_array($val)) {
                $sub = $this->findPrimaRecursive($val, $depth + 1);
                if ($sub !== null && ($max === null || $sub > $max)) $max = $sub;
                continue;
            }
            if (!is_string($key)) continue;
            $lk = strtolower($key);
            // Coincidencia de claves tipo prima
            $isPrimaKey = (
                str_starts_with($lk, 'prima') ||
                str_starts_with($lk, 'valorprima') ||
                str_starts_with($lk, 'ptprima') ||       // Sura autos (ptprimaformapago)
                (str_contains($lk, 'prima') && str_contains($lk, 'total'))
            );
            // Excluir campos claramente de porcentaje/impuesto/iva
            $excluded = (
                str_contains($lk, 'iva') ||
                str_contains($lk, 'porcentaje') ||
                str_contains($lk, 'descuento') ||
                str_contains($lk, 'recargo') ||
                str_contains($lk, 'comision')
            );
            if (!$isPrimaKey || $excluded) continue;
            $num = $this->parseDecimal($val);
            if ($num === null || $num <= 100.0) continue;  // descartar porcentajes
            if ($max === null || $num > $max) $max = $num;
        }
        return $max;
    }

    /**
     * Busca recursivamente claves tipo `valorAsegurado*` / `sumaAsegurada*`
     * y devuelve el mayor valor numérico encontrado.
     */
    private function findSumaAseguradaRecursive(mixed $data, int $depth = 0): ?float
    {
        if ($depth > 8 || !is_array($data)) return null;
        $max = null;
        foreach ($data as $key => $val) {
            if (is_array($val)) {
                $sub = $this->findSumaAseguradaRecursive($val, $depth + 1);
                if ($sub !== null && ($max === null || $sub > $max)) $max = $sub;
                continue;
            }
            if (!is_string($key)) continue;
            $lk = strtolower($key);
            $isMatch = (
                str_contains($lk, 'valorasegurado') ||
                str_contains($lk, 'sumaasegurada') ||
                str_contains($lk, 'montoasegurado') ||
                str_contains($lk, 'valorvehiculo')
            );
            if (!$isMatch) continue;
            $num = $this->parseDecimal($val);
            if ($num === null || $num <= 100.0) continue;
            if ($max === null || $num > $max) $max = $num;
        }
        return $max;
    }

    private function normalizePoliza(string $insurerCode, array $raw): ?array
    {
        switch ($insurerCode) {
            case 'sura':
                // Fields: ramo_codigo, ramo_nombre, producto, numero_poliza,
                // tipo_dni_tomador, dni_tomador, nombre_tomador, correo_tomador,
                // ciudad, fecha_inicio, fecha_fin, estado, codigo_asesor, nombre_asesor
                return [
                    'policy_number' => $raw['numero_poliza'] ?? '',
                    'product_name' => $raw['producto'] ?? $raw['ramo_nombre'] ?? '',
                    '_branch_name' => $raw['ramo_nombre'] ?? '',
                    'client_name' => trim($raw['nombre_tomador'] ?? ''),
                    'client_document' => trim($raw['dni_tomador'] ?? ''),
                    'policy_holder_name' => trim($raw['nombre_tomador'] ?? ''),
                    'policy_holder_document' => trim($raw['dni_tomador'] ?? ''),
                    'policy_holder_doc_type' => self::DOC_TYPE_MAP[strtoupper($raw['tipo_dni_tomador'] ?? '')] ?? ($raw['tipo_dni_tomador'] ?? ''),
                    'policy_holder_email' => $raw['correo_tomador'] ?? null,
                    'policy_holder_city' => $raw['ciudad'] ?? null,
                    'start_date' => $this->parseDate($raw['fecha_inicio'] ?? ''),
                    'end_date' => $this->parseDate($raw['fecha_fin'] ?? ''),
                    'status' => $this->normalizePolizaStatus($raw['estado'] ?? ''),
                    'seller_name' => $raw['nombre_asesor'] ?? null,
                    'notes' => ($raw['codigo_asesor'] ?? '') ? "Cód. Asesor SURA: {$raw['codigo_asesor']}" : null,
                ];

            case 'hdi':
                // Fields: numero_poliza, ramo, grupo, producto, nombre_tomador,
                // documento_tomador, tipo_doc_tomador, fecha_emision, fecha_inicio,
                // fecha_fin, estado, prima, riesgos, _sseguro, _product_code
                return [
                    'policy_number' => $raw['numero_poliza'] ?? '',
                    'product_name' => $raw['producto'] ?? '',
                    '_branch_name' => $raw['ramo'] ?? '',
                    'client_name' => trim($raw['nombre_tomador'] ?? ''),
                    'client_document' => trim($raw['documento_tomador'] ?? ''),
                    'policy_holder_name' => trim($raw['nombre_tomador'] ?? ''),
                    'policy_holder_document' => trim($raw['documento_tomador'] ?? ''),
                    'policy_holder_doc_type' => self::DOC_TYPE_MAP[strtoupper($raw['tipo_doc_tomador'] ?? '')] ?? ($raw['tipo_doc_tomador'] ?? ''),
                    'issue_date' => $this->parseDate($raw['fecha_emision'] ?? ''),
                    'start_date' => $this->parseDate($raw['fecha_inicio'] ?? ''),
                    'end_date' => $this->parseDate($raw['fecha_fin'] ?? ''),
                    'status' => $this->normalizePolizaStatus($raw['estado'] ?? ''),
                    'premium_amount' => $this->parseDecimal($raw['prima'] ?? null),
                    'description' => $raw['grupo'] ? "Grupo: {$raw['grupo']}" : null,
                ];

            case 'axa-colpatria':
                // Fields: numero_poliza, producto, sub_producto, valor_asegurado,
                // fecha_inicio, fecha_fin, nombre_tomador, documento_tomador,
                // tipo_persona, ramo, sucursal, encoded_info
                return [
                    'policy_number' => $raw['numero_poliza'] ?? '',
                    'product_name' => $raw['producto'] ?? '',
                    '_branch_name' => $raw['ramo'] ?? '',
                    'client_name' => trim($raw['nombre_tomador'] ?? ''),
                    'client_document' => trim($raw['documento_tomador'] ?? ''),
                    'policy_holder_name' => trim($raw['nombre_tomador'] ?? ''),
                    'policy_holder_document' => trim($raw['documento_tomador'] ?? ''),
                    'start_date' => $this->parseDate($raw['fecha_inicio'] ?? ''),
                    'end_date' => $this->parseDate($raw['fecha_fin'] ?? ''),
                    'status' => 'active',
                    'insured_amount' => $this->parseDecimal($raw['valor_asegurado'] ?? null),
                    'description' => $raw['sub_producto'] ?? null,
                ];

            case 'bolivar':
                $policyNumber = $raw['numeroPoliza'] ?? $raw['numero_poliza'] ?? '';
                $startDate = $this->parseTimestampOrDate($raw['vigenciaInicio'] ?? $raw['fechaInicioVigencia'] ?? null);
                $endDate = $this->parseTimestampOrDate($raw['vigenciaFinal'] ?? $raw['fechaFinVigencia'] ?? null);
                $holderDocType = self::DOC_TYPE_MAP[strtoupper(trim($raw['descIdentificacion'] ?? (string) ($raw['tipoIdentificacion'] ?? '')))] ?? 'CC';

                return [
                    'policy_number' => trim((string) $policyNumber),
                    'product_name' => $raw['nombreProducto'] ?? $raw['producto'] ?? '',
                    '_branch_name' => $raw['nombreRamo'] ?? $raw['ramo'] ?? '',
                    'client_name' => trim($raw['_clienteNombre'] ?? $raw['nombreTomador'] ?? ''),
                    'client_document' => trim($raw['_clienteDoc'] ?? $raw['numeroIdentificacion'] ?? ''),
                    'policy_holder_name' => trim($raw['_clienteNombre'] ?? $raw['nombreTomador'] ?? ''),
                    'policy_holder_document' => trim($raw['_clienteDoc'] ?? $raw['numeroIdentificacion'] ?? ''),
                    'policy_holder_doc_type' => $holderDocType,
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'status' => $this->normalizePolizaStatus($raw['estadoPoliza'] ?? $raw['estado'] ?? ''),
                    'premium_amount' => $this->parseDecimal($raw['valorPrimaAnual'] ?? $raw['primaTotal'] ?? null),
                    'payment_frequency' => $this->mapPaymentFrequency($raw['formaCobro'] ?? ''),
                    'tipo_poliza' => strtolower($raw['tipoPoliza'] ?? '') === 'colectiva' ? 'colectiva' : null,
                    'colectiva' => !empty($raw['polizaColectiva']),
                ];

            case 'la-equidad':
                // Fields emitted by /equidad/polizas (combina XLSX producción + GET /polizas):
                // compania, agencia, numero_poliza, certificado, tipo_certificado,
                // documento_cliente, nombre_cliente, factura, fecha_factura,
                // fecha_expedicion, fecha_inicio, fecha_fin, forma_pago,
                // producto, prima, placa, sucursal, codigo_plan.
                // El microservicio ya suma todos los movimientos (expedición + IVA +
                // gastos + anexos + anulaciones) y emite `prima` como número plano.
                $docCliente = trim((string) ($raw['documento_cliente'] ?? ''));
                $clientDocType = (ctype_digit($docCliente) && strlen($docCliente) >= 9) ? 'NIT' : 'CC';
                $prima = $this->parseDecimal($raw['prima'] ?? null);
                $desc = trim(implode(' · ', array_filter([
                    !empty($raw['agencia']) ? $raw['agencia'] : null,
                    !empty($raw['certificado']) ? "Certif. {$raw['certificado']}" : null,
                    !empty($raw['forma_pago']) ? $raw['forma_pago'] : null,
                    !empty($raw['placa']) ? "Placa: {$raw['placa']}" : null,
                ]))) ?: null;
                $rawEstado = strtolower(trim((string) ($raw['estado'] ?? 'active')));
                $polizaStatus = in_array($rawEstado, ['cancelled', 'canceled', 'anulada', 'cancelada'], true)
                    ? 'cancelled'
                    : 'active';
                return [
                    'policy_number' => trim((string) ($raw['numero_poliza'] ?? '')),
                    'product_name' => trim((string) ($raw['producto'] ?? '')),
                    '_branch_name' => trim((string) ($raw['producto'] ?? $raw['compania'] ?? '')),
                    'client_name' => trim((string) ($raw['nombre_cliente'] ?? '')),
                    'client_document' => $docCliente,
                    'policy_holder_name' => trim((string) ($raw['nombre_cliente'] ?? '')),
                    'policy_holder_document' => $docCliente,
                    'policy_holder_doc_type' => $clientDocType,
                    'issue_date' => $this->parseDate($raw['fecha_expedicion'] ?? ''),
                    'start_date' => $this->parseDate($raw['fecha_inicio'] ?? ''),
                    'end_date' => $this->parseDate($raw['fecha_fin'] ?? ''),
                    'status' => $polizaStatus,
                    'premium_amount' => $prima,
                    // Fallback 'annual': en La Equidad "Contado" = pago único anual; si no
                    // hay forma_pago legible el esquema requiere NOT NULL.
                    'payment_frequency' => $this->mapPaymentFrequency($raw['forma_pago'] ?? '') ?? 'annual',
                    'description' => $desc,
                ];

            case 'seguros-del-estado':
                // Headers reales devueltos por el portal Estado:
                //   DocumentId, DocDefId, Nro. Póliza, Modif, Tipo, Estado,
                //   Código Identificación, Tomador, Dirección, Telefono,
                //   Ciudad, Fecha Emision, Desde, Hasta, Tipo Anexo,
                //   Nro Anexo, Valor Total, Emitido en
                $pn = $raw['Nro. Póliza']
                    ?? $raw['Nro Póliza']
                    ?? $raw['No. Póliza']
                    ?? $raw['Póliza']
                    ?? $raw['Poliza']
                    ?? $raw['numero_poliza']
                    ?? '';
                $tipo = trim((string) ($raw['Tipo'] ?? $raw['tipo'] ?? ''));
                $tomadorName = trim((string) ($raw['Tomador'] ?? $raw['tomador'] ?? ''));
                $tomadorDoc = trim((string) (
                    $raw['Código Identificación']
                    ?? $raw['Codigo Identificación']
                    ?? $raw['Código Identificacion']
                    ?? $raw['Codigo Identificacion']
                    ?? $raw['Documento']
                    ?? $raw['documento']
                    ?? ''
                ));
                $valorTotal = $this->parseDecimal(
                    $raw['Valor Total'] ?? $raw['valor_total'] ?? null
                );
                return [
                    'policy_number' => trim((string) $pn),
                    'product_name' => $tipo,
                    '_branch_name' => $tipo,  // "Tipo" = ramo en este portal (CUMPLIMIENTO ESTATAL, etc.)
                    'client_name' => $tomadorName,
                    'client_document' => $tomadorDoc,
                    'policy_holder_name' => $tomadorName,
                    'policy_holder_document' => $tomadorDoc,
                    'policy_holder_address' => trim((string) ($raw['Dirección'] ?? $raw['Direccion'] ?? '')) ?: null,
                    'policy_holder_phone' => trim((string) ($raw['Telefono'] ?? $raw['Teléfono'] ?? '')) ?: null,
                    'policy_holder_city' => trim((string) ($raw['Ciudad'] ?? '')) ?: null,
                    'issue_date' => $this->parseDate($raw['Fecha Emision'] ?? $raw['Fecha Emisión'] ?? ''),
                    'start_date' => $this->parseDate($raw['Desde'] ?? $raw['Vigencia desde'] ?? $raw['fecha_inicio'] ?? ''),
                    'end_date' => $this->parseDate($raw['Hasta'] ?? $raw['Vigencia hasta'] ?? $raw['fecha_fin'] ?? ''),
                    'status' => $this->normalizePolizaStatus($raw['Estado'] ?? $raw['estado'] ?? ''),
                    'premium_amount' => $valorTotal,
                    'total_amount' => $valorTotal,
                    'description' => trim(implode(' · ', array_filter([
                        $raw['Tipo Anexo'] ?? null,
                        ($raw['Nro Anexo'] ?? '') !== '' && ($raw['Nro Anexo'] ?? '0') !== '0'
                            ? "Anexo {$raw['Nro Anexo']}" : null,
                        $raw['Emitido en'] ?? null,
                    ]))) ?: null,
                ];

            case 'qualitas':
                // Campos DWR: {certificado, endoso, fchEmision, moneda, nombreAseg, poliza,
                //              prima, ramo, tipoOperacion, tomador, vigencia}
                // Qualitas no devuelve fin de vigencia en este listado — se infiere o queda null.
                // tipoOperacion: "Poliza" (nueva), "Sin Prima" (endoso sin valor), "Rehabilitacion",
                // "Incremento de Recargos", etc. Solo nos interesan las "Poliza" como pólizas nuevas;
                // las otras son endosos del mismo numero_poliza.
                $polNum = trim((string) ($raw['poliza'] ?? ''));
                if ($polNum === '') return null;
                $prima = $this->parseDecimal($raw['prima'] ?? null);
                $tipoOp = trim((string) ($raw['tipoOperacion'] ?? ''));
                $tomador = trim((string) ($raw['tomador'] ?? ''));
                $aseg = trim((string) ($raw['nombreAseg'] ?? ''));
                $ramoCodigo = trim((string) ($raw['ramo'] ?? ''));
                $ramoNombre = $this->qualitasRamoName($ramoCodigo);
                return [
                    'policy_number' => $polNum,
                    'product_name' => $ramoNombre,
                    '_branch_name' => $ramoNombre,
                    'client_name' => $tomador ?: $aseg,
                    'policy_holder_name' => $tomador ?: $aseg,
                    // Qualitas no devuelve documento del tomador en este listado.
                    'client_document' => null,
                    'policy_holder_document' => null,
                    'issue_date' => $this->parseDate($raw['fchEmision'] ?? ''),
                    'start_date' => $this->parseDate($raw['vigencia'] ?? $raw['fchEmision'] ?? ''),
                    'end_date' => null,  // detalle por póliza puede aportar end_date
                    'status' => $tipoOp === 'Poliza' ? 'active' : ($tipoOp === 'Sin Prima' ? 'active' : 'active'),
                    'premium_amount' => $prima,
                    'description' => trim(implode(' · ', array_filter([
                        $tipoOp !== 'Poliza' ? $tipoOp : null,
                        $ramoCodigo !== '' ? "Código ramo {$ramoCodigo}" : null,
                    ]))) ?: null,
                ];

            default:
                return null;
        }
    }

    private function syncClienteFromPoliza(InsurerConnection $conn, array $poliza): array
    {
        $docNumber = trim((string) ($poliza['client_document'] ?? $poliza['policy_holder_document'] ?? ''));
        if ($docNumber === '') {
            return ['client' => null, 'status' => 'skipped'];
        }

        $fullName = trim((string) ($poliza['client_name'] ?? $poliza['policy_holder_name'] ?? ''));
        if ($fullName === '') {
            $fullName = 'Cliente ' . $docNumber;
        }

        $docType = self::DOC_TYPE_MAP[strtoupper(trim((string) ($poliza['policy_holder_doc_type'] ?? 'CC')))] ?? 'CC';
        $clientType = $docType === 'NIT' ? 'empresa' : 'persona';
        $nameParts = preg_split('/\s+/', $fullName) ?: [];
        $firstName = $nameParts[0] ?? $fullName;
        $lastName = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : '';
        $hashPayload = [
            'name' => $fullName,
            'document_type' => $docType,
            'document_number' => $docNumber,
            'address' => $poliza['policy_holder_address'] ?? null,
            'phone' => $poliza['policy_holder_phone'] ?? null,
            'city' => $poliza['policy_holder_city'] ?? null,
        ];
        $hash = md5(json_encode($hashPayload));

        $client = Cliente::withTrashed()
            ->where('broker_id', $conn->broker_id)
            ->where('document_number', $docNumber)
            ->first();

        $data = [
            'broker_id' => $conn->broker_id,
            'client_type' => $clientType,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'company' => $clientType === 'empresa' ? $fullName : null,
            'document_type' => $docType,
            'document_number' => $docNumber,
            'email' => strtolower(str_replace(' ', '', $docNumber)) . '@sinregistro.com',
            'phone' => trim((string) ($poliza['policy_holder_phone'] ?? '')),
            'mobile_phone' => trim((string) ($poliza['policy_holder_phone'] ?? '')) ?: '0000000000',
            'address' => trim((string) ($poliza['policy_holder_address'] ?? '')) ?: 'Sin dirección',
            'city' => trim((string) ($poliza['policy_holder_city'] ?? '')),
            'source' => $conn->insurer_code,
            'status' => 'active',
            'notes' => "Importado desde " . $this->insurerDisplayName($conn->insurer_code) . " a partir de póliza",
            'custom_fields' => [
                '_sync_hash' => $hash,
                '_sync_source' => "{$conn->insurer_code}_sync",
                '_sync_at' => now()->toIso8601String(),
            ],
        ];

        if ($client) {
            if ($client->trashed()) {
                $client->restore();
            }
            $existingHash = $client->custom_fields['_sync_hash'] ?? null;
            if ($existingHash !== $hash) {
                unset($data['broker_id'], $data['document_number'], $data['source']);
                $data['custom_fields'] = array_merge($client->custom_fields ?? [], $data['custom_fields']);
                $client->update(array_filter($data, fn($v) => $v !== null && $v !== ''));
                return ['client' => $client->refresh(), 'status' => 'updated'];
            }
            return ['client' => $client, 'status' => 'unchanged'];
        }

        return ['client' => Cliente::create($data), 'status' => 'created'];
    }

    // ──────────────────────────────────────────────────────
    //  CARTERA
    // ──────────────────────────────────────────────────────

    public function syncCartera(InsurerConnection $conn): array
    {
        $slug = self::SLUG_MAP[$conn->insurer_code] ?? $conn->insurer_code;
        $brokerId = $conn->broker_id;
        $insurerName = $this->insurerDisplayName($conn->insurer_code);
        $sessionId = $conn->microservice_session_id;

        $allItems = [];

        try {
            switch ($slug) {
                case 'sura':
                    $allItems = $this->fetchCarteraSura($sessionId);
                    break;
                case 'bolivar':
                    $allItems = $this->fetchCarteraBolivar($conn);
                    break;
                case 'hdi':
                    $allItems = $this->fetchCarteraHdi($sessionId);
                    break;
                case 'axa':
                    $allItems = $this->fetchCarteraAxa($sessionId);
                    break;
                case 'equidad':
                    $allItems = $this->fetchCarteraEquidad($sessionId);
                    break;
                case 'allianz':
                    $allItems = $this->fetchCarteraAllianz($sessionId);
                    break;
                case 'qualitas':
                    $allItems = $this->fetchCarteraQualitas($sessionId, $conn);
                    break;
                case 'mundial':
                    $allItems = $this->fetchCarteraMundial($sessionId);
                    break;
                default:
                    return ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'total_fetched' => 0,
                        'message' => "Cartera no disponible para {$insurerName}"];
            }
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            return ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'total_fetched' => 0,
                'error' => "Tiempo de espera agotado al obtener cartera de {$insurerName}."];
        } catch (\Throwable $e) {
            if ($e->getCode() === 401 || str_contains($e->getMessage(), '401') || str_contains($e->getMessage(), 'expirada')) {
                // Marcar la conexión como reconnect_required para que la UI muestre el botón
                // "Reconectar" sin que el usuario tenga que adivinar por qué falla el sync.
                $conn->update([
                    'status' => 'reconnect_required',
                    'last_error' => "Sesión expirada al sincronizar cartera de {$insurerName}",
                    'last_healthcheck_at' => now(),
                ]);
                return ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'total_fetched' => 0,
                    'error' => "Sesión expirada. Reconecta {$insurerName} desde Integraciones."];
            }
            return ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'total_fetched' => 0,
                'error' => $e->getMessage()];
        }

        Log::info("[INSURER SYNC] Cartera obtenida de {$conn->insurer_code}", ['count' => count($allItems)]);

        $created = 0;
        $errors = 0;
        $clientsCreated = 0;
        $clientsUpdated = 0;

        // Cartera is a point-in-time snapshot — replace atomically so that:
        // (a) no duplicate rows accumulate across resyncs, and
        // (b) if inserts fail mid-way, the old data is preserved (transaction rollback).
        // Days-in-mora, paid installments, etc. are always taken from the fresh API response.
        DB::transaction(function () use ($allItems, $brokerId, $conn, $insurerName, &$created, &$errors, &$clientsCreated, &$clientsUpdated) {
            CarteraAseguradora::where('broker_id', $brokerId)
                ->where('insurer_code', $conn->insurer_code)
                ->delete();

            foreach ($allItems as $item) {
                try {
                    $item['broker_id']     = $brokerId;
                    $item['insurer_code']  = $conn->insurer_code;
                    $item['insurer_name']  = $insurerName;
                    $item['synced_at']     = now();
                    // Strip internal-only fields before hashing/inserting
                    unset($item['_client_phone'], $item['_client_mobile'], $item['_client_email'], $item['_abs']);
                    $item['sync_hash']     = md5(json_encode($item));
                    // Resolver link a póliza local: exact match primero; si no, suffix
                    // match con mismo cliente (SURA reporta 081003691040 vs póliza 3691040).
                    $item['matched_poliza_id'] = $this->resolveMatchedPolizaId(
                        $brokerId,
                        (string) ($item['policy_number'] ?? ''),
                        (string) ($item['client_document'] ?? '')
                    );

                    CarteraAseguradora::create($item);
                    $created++;

                    if ($conn->insurer_code === 'qualitas') {
                        $raw = is_array($item['raw_data'] ?? null) ? $item['raw_data'] : [];
                        $clientResult = $this->syncClienteFromPoliza($conn, [
                            'client_name' => $item['client_name'] ?? $raw['nomAsegurado'] ?? $raw['tomador'] ?? null,
                            'policy_holder_name' => $item['client_name'] ?? $raw['nomAsegurado'] ?? $raw['tomador'] ?? null,
                            'client_document' => $raw['idAsegurado'] ?? null,
                            'policy_holder_document' => $raw['idAsegurado'] ?? null,
                            'policy_holder_doc_type' => 'CC',
                        ]);
                        if (($clientResult['status'] ?? null) === 'created') {
                            $clientsCreated++;
                        } elseif (($clientResult['status'] ?? null) === 'updated') {
                            $clientsUpdated++;
                        }
                    }
                } catch (\Throwable $e) {
                    $errors++;
                    Log::warning('[INSURER SYNC] Error cartera row', [
                        'insurer' => $conn->insurer_code,
                        'error'   => $e->getMessage(),
                    ]);
                }
            }
        });

        $result = ['created' => $created, 'updated' => 0, 'unchanged' => 0, 'errors' => $errors, 'total_fetched' => count($allItems)];
        if ($clientsCreated > 0 || $clientsUpdated > 0) {
            $result['clientes_derivados_created'] = $clientsCreated;
            $result['clientes_derivados_updated'] = $clientsUpdated;
        }

        // Mundial: importar clientes y pólizas desde los mismos datos de cartera
        if ($conn->insurer_code === 'mundial' && count($allItems) > 0) {
            $cpResult = $this->syncClientesPolizasFromCarteraMundial($conn, $allItems);
            $result = array_merge($result, $cpResult);
        }

        return $result;
    }

    /**
     * Cartera Bolívar.
     * Estrategia: primero intentar /bolivar/carterav2 (portal SISEBOL legacy: una fila
     * por póliza pendiente, con días de mora reales). Fallback a /bolivar/cartera v1.
     */
    private function fetchCarteraBolivar(InsurerConnection $conn): array
    {
        $sessionId = $conn->microservice_session_id;

        // ── PRIMARY: carterav2 (SISEBOL) ──────────────────────────
        try {
            $creds = $conn->credentials ?? [];
            $docNumber = (string) ($creds['doc_number'] ?? '');
            $password = (string) ($creds['password'] ?? '');
            if ($docNumber !== '' && $password !== '') {
                $loginResp = Http::acceptJson()
                    ->timeout(90)->connectTimeout(15)
                    ->post($this->baseUrl() . '/bolivar/carterav2/login', [
                        'session_id' => $sessionId,
                        'doc_number' => $docNumber,
                        'password' => $password,
                    ]);
                if ($loginResp->ok() && ($loginResp->json('success') === true)) {
                    $v2Sid = (string) $loginResp->json('session_id');
                    $resp = Http::acceptJson()
                        ->timeout(180)->connectTimeout(15)
                        ->withHeaders(['X-Session-Id' => $v2Sid])
                        ->get($this->baseUrl() . '/bolivar/carterav2');
                    if ($resp->ok()) {
                        $items = $resp->json('items') ?? [];
                        if (is_array($items) && !empty($items)) {
                            $mapped = [];
                            foreach ($items as $it) {
                                $row = $this->mapBolivarCarteraV2Row($it);
                                if ($row !== null) {
                                    $mapped[] = $row;
                                }
                            }
                            Log::info('[INSURER SYNC] Bolívar carterav2 OK', ['rows' => count($mapped)]);
                            return $mapped;
                        }
                    } else {
                        Log::warning('[INSURER SYNC] carterav2 fetch falló, fallback v1', [
                            'status' => $resp->status(),
                        ]);
                    }
                } else {
                    Log::warning('[INSURER SYNC] carterav2 login falló, fallback v1', [
                        'status' => $loginResp->status(),
                        'body' => mb_substr((string) $loginResp->body(), 0, 200),
                    ]);
                }
            }
        } catch (\Throwable $e) {
            Log::warning('[INSURER SYNC] carterav2 excepción, fallback v1', ['error' => $e->getMessage()]);
        }

        // ── FALLBACK: /bolivar/cartera v1 ─────────────────────────
        $response = $this->apiGetLong('/bolivar/cartera', $sessionId, 180);
        if (!$response->ok()) {
            if (in_array($response->status(), [404, 422, 405])) {
                return [];
            }
            if ($response->status() === 401) {
                throw new \RuntimeException('Sesión expirada', 401);
            }

            return [];
        }

        $data = $response->json();
        $clientes = $data['clientes'] ?? $data['cartera'] ?? $data['items'] ?? [];
        if (!is_array($clientes)) {
            return [];
        }

        $items = [];

        foreach ($clientes as $cl) {
            if (!is_array($cl)) {
                continue;
            }

            $clientDoc = $this->bolivarPickScalar($cl, ['nroDocumento', 'numeroIdentificacion', 'numero_documento', 'documento']);
            $tipoDoc = $this->bolivarPickInt($cl, ['tipoDocumento', 'tipoIdentificacion']) ?? 1;

            if ($clientDoc === '') {
                continue;
            }

            // Fetch product-level detail for this client
            $productos = [];
            try {
                $detailUrl = "/bolivar/cartera/{$clientDoc}/productos?tipo_doc={$tipoDoc}";
                $detailResp = $this->apiGetLong($detailUrl, $sessionId, 60);
                if ($detailResp->ok()) {
                    $detailData = $detailResp->json();
                    $productos = $detailData['productos'] ?? [];
                    if (!is_array($productos)) {
                        $productos = [];
                    }
                }
            } catch (\Throwable $e) {
                Log::warning('[INSURER SYNC] Bolívar cartera productos error', [
                    'doc' => $clientDoc, 'error' => $e->getMessage(),
                ]);
            }

            if (!empty($productos)) {
                foreach ($productos as $prod) {
                    if (!is_array($prod)) {
                        continue;
                    }
                    $row = $this->mapBolivarCarteraRow($cl, $prod);
                    if ($row !== null) {
                        $items[] = $row;
                    }
                }
            } else {
                // Fallback: save the aggregate client row if no products returned
                $row = $this->mapBolivarCarteraRow($cl, null);
                if ($row !== null) {
                    $items[] = $row;
                }
            }
        }

        return $items;
    }

    /**
     * @param  array<string, mixed>  $cliente  Fila cliente (mora agregada, documento, nombre)
     * @param  array<string, mixed>|null  $detalle  Fila póliza/recibo o null si solo viene agregado
     * @return array<string, mixed>|null
     */
    private function mapBolivarCarteraRow(array $cliente, ?array $detalle): ?array
    {
        $src = $cliente;
        if ($detalle !== null) {
            $src = array_merge($cliente, $detalle);
        }

        // dias_mora / diasMora are actual day counts.
        // carteraTreinta, carteraSesenta, etc. are MONETARY amounts per aging bucket — NOT days.
        $diasMora = max(
            (int) ($src['dias_mora'] ?? 0),
            (int) ($src['diasMora'] ?? 0),
        );

        // Note: carteraTreinta/carteraSesenta/carteraNoventa/carteraMas are MONETARY bucket amounts,
        // not day counts. We do NOT use them to infer dias_mora because assigning fixed midpoint
        // values (15/45/75/91) would produce incorrect mora data for individual policies.
        // Only use the explicit diasMora / dias_mora field from the API response.

        $valorPendiente = $this->bolivarPickFloat($src, [
            'valorPendiente', 'valor_pendiente', 'saldo', 'saldoPendiente', 'saldo_pendiente',
            'totalCarteraPend', 'total_cartera_pend', 'valorTotal', 'importe', 'valorCuota',
            'valorMora', 'totalPagar', 'total_pagar',
        ]);

        if ($valorPendiente <= 0 && $diasMora > 0 && $detalle === null) {
            $valorPendiente = $this->bolivarPickFloat($cliente, ['totalCarteraPend', 'total_cartera_pend']);
        }

        if ($valorPendiente <= 0 && $diasMora <= 0) {
            return null;
        }

        $clientName = $this->bolivarPickScalar($src, [
            'nombreCliente', 'nombreCompleto', 'nombreTomador', 'nombres', 'nombre_tomador',
            'razonSocial', 'razon_social',
        ]);
        $clientDoc = $this->bolivarPickScalar($src, [
            'nroDocumento', 'numeroIdentificacion', 'numero_documento', 'documento', 'nit', 'cedula',
        ]);

        $docTipRaw = $this->bolivarPickScalar($src, ['desTipDocCliente', 'descIdentificacion', 'tipoIdentificacion', 'tipo_documento']);
        $clientDocType = $docTipRaw !== ''
            ? (self::DOC_TYPE_MAP[strtoupper(trim(preg_replace('/\s+/', ' ', $docTipRaw)))] ?? strtoupper(substr($docTipRaw, 0, 10)))
            : 'CC';

        $policyNumber = $this->bolivarPickScalar($src, [
            'nroPoliza', 'numeroPoliza', 'numero_poliza', 'numPoliza', 'poliza', 'noPoliza',
            'numeroPolizaCartera', 'policyNumber', 'nro_poliza',
        ]);

        $ramo = $this->bolivarPickScalar($src, ['nombreRamoEmi', 'nombreRamo', 'ramo', 'descRamo', 'descripcionRamo', 'ramoDescripcion']);
        $product = $this->bolivarPickScalar($src, ['nombreProducto', 'producto', 'descProducto', 'subProducto']);

        $primaTotal = $this->bolivarPickFloat($src, ['primaTotal', 'prima_total', 'valorPrima', 'prima', 'valor_prima']);
        if ($primaTotal <= 0) {
            $primaTotal = $valorPendiente;
        }

        $fechaIni = $this->bolivarPickDate($src, [
            'vigenciaInicio', 'fechaInicioVigencia', 'fecIniVigencia', 'fecha_inicio_vigencia',
            'inicioVigencia', 'fechaDesde', 'vigencia_desde',
        ]);
        $fechaFin = $this->bolivarPickDate($src, [
            'vigenciaFinal', 'fechaFinVigencia', 'fecFinVigencia', 'fecha_fin_vigencia',
            'finVigencia', 'fechaHasta', 'vigencia_hasta',
        ]);
        $fechaExp = $this->bolivarPickDate($src, ['fechaExpedicion', 'fecha_expedicion', 'fecExpedicion', 'fechaEmision']);

        $cuotasPagadas = $this->bolivarPickInt($src, ['cuotasPagadas', 'cuotas_pagadas', 'nroCuotasPagadas']);
        $cuotasMora = $this->bolivarPickInt($src, ['cuotasMora', 'cuotas_mora', 'cuotasEnMora']);
        $totalCuotas = $this->bolivarPickInt($src, ['numeroCuotas', 'totalCuotas', 'total_cuotas', 'nroCuotas', 'cuotasTotales']);

        $numeroRecibo = $this->bolivarPickScalar($src, ['numeroRecibo', 'nroRecibo', 'recibo', 'contrato', 'referencia']);
        $numeroPagare = $this->bolivarPickScalar($src, ['numeroPagare', 'nroPagare', 'pagare']);

        $rawForStorage = $detalle !== null ? ['cliente' => $cliente, 'detalle' => $detalle] : $cliente;

        return [
            'client_name' => $clientName,
            'client_document' => $clientDoc,
            'client_doc_type' => $clientDocType,
            'policy_number' => $policyNumber,
            'ramo' => $ramo !== '' ? $ramo : null,
            'product_name' => $product !== '' ? $product : null,
            'prima_total' => $primaTotal,
            'valor_pendiente' => $valorPendiente,
            'valor_pagado' => $this->bolivarPickFloat($src, ['valorPagado', 'valor_pagado', 'pagado']),
            'bonificacion' => $this->bolivarPickFloat($src, ['bonificacion', 'descuento']),
            'dias_mora' => $diasMora,
            'rango_mora' => CarteraAseguradora::calcRangoMora($diasMora),
            'fecha_inicio_vigencia' => $fechaIni,
            'fecha_expedicion' => $fechaExp,
            'fecha_vencimiento' => $fechaFin,
            'numero_recibo' => $numeroRecibo !== '' ? $numeroRecibo : null,
            'numero_pagare' => $numeroPagare !== '' ? $numeroPagare : null,
            'cuotas_pagadas' => $cuotasPagadas,
            'cuotas_mora' => $cuotasMora,
            'total_cuotas' => $totalCuotas,
            'source_endpoint' => '/bolivar/cartera',
            'raw_data' => $rawForStorage,
        ];
    }

    /**
     * Mapea una fila de /bolivar/carterav2 (formato SISEBOL parseado) al schema
     * de cartera_aseguradoras.
     *
     * Campos esperados (string salvo donde se indique):
     *   poliza, ramo, numero_factura, valor_pendiente (float), valor_pagado_hoy (float),
     *   valor_neto (float), tomador, identificacion, fecha_vigencia (DD-MMM-YY),
     *   fecha_facturacion (DD-MM-YYYY), coaseguro, dias_mora (int), direccion,
     *   telefono, email
     */
    private function mapBolivarCarteraV2Row(array $row): ?array
    {
        $valorPendiente = (float) ($row['valor_pendiente'] ?? 0);
        $diasMora = (int) ($row['dias_mora'] ?? 0);
        if ($valorPendiente <= 0 && $diasMora <= 0) {
            return null;
        }

        $valorPagado = (float) ($row['valor_pagado_hoy'] ?? 0);
        $valorNeto = (float) ($row['valor_neto'] ?? $valorPendiente);

        $clientName = trim((string) ($row['tomador'] ?? ''));
        $clientDoc = trim((string) ($row['identificacion'] ?? ''));
        $policyNumber = trim((string) ($row['poliza'] ?? ''));
        $ramo = trim((string) ($row['ramo'] ?? ''));
        $numeroFactura = trim((string) ($row['numero_factura'] ?? ''));

        // Tipo de doc: SISEBOL no lo discrimina explícitamente.
        // Heurística: NIT si empieza con 8 o 9 y tiene 9-10 dígitos; si no, CC.
        $clientDocType = (preg_match('/^[89]\d{8,9}$/', $clientDoc)) ? 'NIT' : 'CC';

        $fechaVig = $this->parseBolivarV2Date((string) ($row['fecha_vigencia'] ?? ''));
        $fechaFact = $this->parseBolivarV2Date((string) ($row['fecha_facturacion'] ?? ''));

        return [
            'client_name' => $clientName,
            'client_document' => $clientDoc,
            'client_doc_type' => $clientDocType,
            'policy_number' => $policyNumber,
            'ramo' => $ramo !== '' ? $ramo : null,
            'product_name' => null,
            'prima_total' => $valorPendiente,
            'valor_pendiente' => $valorPendiente,
            'valor_pagado' => $valorPagado,
            'bonificacion' => 0,
            'dias_mora' => $diasMora,
            'rango_mora' => CarteraAseguradora::calcRangoMora($diasMora),
            'fecha_inicio_vigencia' => $fechaVig,
            'fecha_expedicion' => $fechaFact,
            'fecha_vencimiento' => null,
            'numero_recibo' => $numeroFactura !== '' ? $numeroFactura : null,
            'numero_pagare' => null,
            'cuotas_pagadas' => null,
            'cuotas_mora' => null,
            'total_cuotas' => null,
            'source_endpoint' => '/bolivar/carterav2',
            'raw_data' => $row,
        ];
    }

    /**
     * Parsea fechas de SISEBOL: "11-APR-26" o "11-04-2026".
     */
    private function parseBolivarV2Date(string $s): ?string
    {
        $s = trim($s);
        if ($s === '') {
            return null;
        }
        foreach (['d-M-y', 'd-m-Y', 'd-m-y', 'd/m/Y'] as $fmt) {
            try {
                $d = \Carbon\Carbon::createFromFormat($fmt, $s);
                if ($d) {
                    return $d->format('Y-m-d');
                }
            } catch (\Throwable $e) {
                // siguiente formato
            }
        }
        return null;
    }

    private function bolivarPickScalar(array $row, array $keys): string
    {
        foreach ($keys as $k) {
            if (!array_key_exists($k, $row)) {
                continue;
            }
            $v = $row[$k];
            if ($v === null || $v === '') {
                continue;
            }

            return trim((string) $v);
        }

        return '';
    }

    private function bolivarPickInt(array $row, array $keys): ?int
    {
        foreach ($keys as $k) {
            if (!array_key_exists($k, $row)) {
                continue;
            }
            $v = $row[$k];
            if ($v === null || $v === '') {
                continue;
            }
            if (is_numeric($v)) {
                return (int) $v;
            }
        }

        return null;
    }

    private function bolivarPickFloat(array $row, array $keys): float
    {
        foreach ($keys as $k) {
            if (!array_key_exists($k, $row)) {
                continue;
            }
            $v = $row[$k];
            if ($v === null || $v === '') {
                continue;
            }
            $parsed = $this->parseDecimal($v);
            if ($parsed !== null) {
                return $parsed;
            }
        }

        return 0.0;
    }

    private function bolivarPickDate(array $row, array $keys): ?string
    {
        foreach ($keys as $k) {
            if (!array_key_exists($k, $row)) {
                continue;
            }
            $v = $row[$k];
            if ($v === null || $v === '') {
                continue;
            }
            if (is_numeric($v)) {
                $p = $this->parseTimestampOrDate($v);
                if ($p !== null) {
                    return $p;
                }
            }
            $p = $this->parseHdiDate($v);
            if ($p !== null) {
                return $p;
            }
        }

        return null;
    }

    /**
     * HDI devuelve claves heterogéneas (snake_case / camelCase / español). Evitamos usar solo
     * file_identifier como documento (suele ser id interno) y ampliamos fechas DD/MM/YYYY.
     */
    private function fetchCarteraHdi(string $sessionId): array
    {
        $items = [];

        // /hdi/cartera pagina con start/end (default 1-50). Iteramos en bloques de
        // 200 hasta que el microservicio devuelva una página corta.
        $pageSize = 200;
        $start = 1;
        $allRows = [];
        $maxPages = 50; // tope defensivo
        for ($p = 0; $p < $maxPages; $p++) {
            $end = $start + $pageSize - 1;
            $response = $this->apiGetWithQuery('/hdi/cartera', $sessionId, [
                'start' => $start,
                'end' => $end,
            ]);
            if (!$response->ok()) {
                if ($response->status() === 401) {
                    throw new \RuntimeException('Sesión expirada', 401);
                }
                break;
            }
            $rows = $response->json('cartera') ?? [];
            if (empty($rows)) {
                break;
            }
            $allRows = array_merge($allRows, $rows);
            if (count($rows) < $pageSize) {
                break;
            }
            $start += $pageSize;
        }
        Log::info('[INSURER SYNC] HDI cartera paginada', ['total_rows' => count($allRows)]);

        foreach ($allRows as $row) {
                if (!is_array($row)) {
                    continue;
                }

                $diasMora = max(
                    (int) ($row['dias_mora'] ?? 0),
                    (int) ($row['dias_mora_min'] ?? 0),
                    (int) ($row['dias_mora_max'] ?? 0),
                );

                $totalPagar = $this->hdiPickFloat($row, [
                    'total_pagar', 'saldo', 'saldo_pendiente', 'valor_pendiente', 'totalPagar', 'saldoTotal',
                ]);

                if ($totalPagar <= 0 && $diasMora <= 0) {
                    continue;
                }

                $policyNumber = $this->hdiPickScalar($row, [
                    'numero_poliza', 'numeroPoliza', 'nro_poliza', 'poliza', 'policy_number', 'num_poliza',
                ]);
                $clientName = $this->hdiPickScalar($row, [
                    'tomador', 'nombre_tomador', 'nombreTomador', 'asegurado', 'nombre_asegurado', 'cliente',
                ]);
                $clientDoc = $this->hdiPickScalar($row, [
                    'documento_tomador', 'numero_documento_tomador', 'cedula_tomador', 'nit_tomador',
                    'documento', 'numero_documento', 'cedula', 'nit', 'identificacion', 'identificación',
                    'numeroDocumento', 'documentoTomador',
                    'file_identifier', 'fileIdentifier', 'id_archivo',
                ]);

                $docTypeRaw = $this->hdiPickScalar($row, ['tipo_documento', 'tipo_doc_tomador', 'tipoDocumento']);
                $clientDocType = $docTypeRaw !== ''
                    ? (self::DOC_TYPE_MAP[strtoupper($docTypeRaw)] ?? strtoupper($docTypeRaw))
                    : null;

                $ramo = $this->hdiPickScalar($row, ['ramo', 'nombre_ramo', 'desc_ramo', 'nombreRamo']);
                $product = $this->hdiPickScalar($row, ['tipo', 'producto', 'nombre_producto', 'desc_producto', 'producto_descripcion']);

                // 'prima_total' en la API de HDI contado es el total agregado del portafolio completo,
                // no la prima individual del recibo. El valor correcto por recibo es 'total_pagar'.
                $primaTotal = $totalPagar;

                $valorPagado = $this->hdiPickFloat($row, ['valor_pagado', 'valorPagado', 'pagado', 'total_pagado']);

                $cuotasPagadas = $this->hdiPickInt($row, ['cuotas_pagadas', 'cuotasPagadas', 'nro_cuotas_pagadas', 'pagadas']);
                $cuotasMora = $this->hdiPickInt($row, ['cuotas_mora', 'cuotasMora', 'cuotas_en_mora']);
                $totalCuotas = $this->hdiPickInt($row, ['total_cuotas', 'totalCuotas', 'nro_cuotas', 'cuotas_totales', 'numero_cuotas']);

                $items[] = [
                    'policy_number' => $policyNumber,
                    'client_name' => $clientName,
                    'client_document' => $clientDoc,
                    'client_doc_type' => $clientDocType,
                    'ramo' => $ramo !== '' ? $ramo : null,
                    'product_name' => $product !== '' ? $product : null,
                    'prima_total' => $primaTotal,
                    'valor_pendiente' => $totalPagar,
                    'valor_pagado' => $valorPagado,
                    'bonificacion' => $this->hdiPickFloat($row, ['bonificacion', 'bonificación', 'descuento']),
                    'dias_mora' => $diasMora,
                    'rango_mora' => CarteraAseguradora::calcRangoMora($diasMora),
                    'fecha_inicio_vigencia' => $this->hdiPickDate($row, [
                        'inicio_vigencia', 'fecha_inicio_vigencia', 'inicioVigencia', 'fechaInicioVigencia',
                        'vigencia_desde', 'fecha_inicio', 'fechaInicio', 'ini_vigencia', 'desde',
                    ]),
                    'fecha_expedicion' => $this->hdiPickDate($row, [
                        'expedicion', 'fecha_expedicion', 'fechaExpedicion', 'fecha_emision', 'fechaEmision',
                    ]),
                    'fecha_vencimiento' => $this->hdiPickDate($row, [
                        'fin_vigencia', 'fecha_fin_vigencia', 'finVigencia', 'fechaFinVigencia',
                        'vigencia_hasta', 'fecha_vencimiento', 'fechaVencimiento', 'fecha_fin', 'fechaFin', 'hasta',
                    ]),
                    'numero_recibo' => ($r = $this->hdiPickScalar($row, ['contrato', 'numero_recibo', 'recibo', 'nro_recibo', 'id_recibo'])) !== '' ? $r : null,
                    'cuotas_pagadas' => $cuotasPagadas,
                    'cuotas_mora' => $cuotasMora,
                    'total_cuotas' => $totalCuotas,
                    'source_endpoint' => '/hdi/cartera',
                    'raw_data' => $row,
                ];
        }

        // /hdi/cartera/financiada también pagina (registro_inicial/registro_final, default 1-50).
        $finPageSize = 200;
        $finStart = 1;
        $allPagares = [];
        for ($pp = 0; $pp < 50; $pp++) {
            $finResponse = $this->apiGetWithQuery('/hdi/cartera/financiada', $sessionId, [
                'registro_inicial' => $finStart,
                'registro_final' => $finStart + $finPageSize - 1,
            ]);
            if (!$finResponse->ok()) {
                if ($finResponse->status() === 401) {
                    throw new \RuntimeException('Sesión expirada', 401);
                }
                break;
            }
            $batch = $finResponse->json('pagares') ?? [];
            if (empty($batch)) {
                break;
            }
            $allPagares = array_merge($allPagares, $batch);
            if (count($batch) < $finPageSize) {
                break;
            }
            $finStart += $finPageSize;
        }
        Log::info('[INSURER SYNC] HDI cartera financiada paginada', ['total_pagares' => count($allPagares)]);

        foreach ($allPagares as $p) {
                if (!is_array($p)) {
                    continue;
                }

                $diasMora = (int) ($p['dias_mora'] ?? $p['diasMora'] ?? 0);

                $saldoTotal = $this->hdiPickFloat($p, ['saldo_total', 'saldoTotal', 'saldo', 'saldo_pendiente', 'valor_pendiente']);
                $valorMora = $this->hdiPickFloat($p, ['valor_mora', 'valorMora']);
                $cuotasPagadasFin = $this->hdiPickInt($p, ['cuotas_pagadas', 'cuotasPagadas']) ?? 0;
                $totalCuotasFin = $this->hdiPickInt($p, ['total_cuotas', 'totalCuotas', 'nro_cuotas']) ?? 0;

                // Para financiada, "Pendiente" debe reflejar el valor de la(s) cuota(s)
                // por cobrar AHORA — no el saldo total del crédito (que incluye cuotas
                // futuras aún no devengadas). Prioridad:
                //  1) valor_mora si HDI lo reporta (suma de cuotas vencidas)
                //  2) cuota estimada = saldo_total / cuotas restantes
                //  3) saldo_total como último recurso
                $cuotasRestantes = max(0, $totalCuotasFin - $cuotasPagadasFin);
                $valorCuotaEstimado = ($cuotasRestantes > 0 && $saldoTotal > 0)
                    ? round($saldoTotal / $cuotasRestantes, 2)
                    : 0.0;
                $valorPendiente = $valorMora > 0
                    ? $valorMora
                    : ($valorCuotaEstimado > 0 ? $valorCuotaEstimado : $saldoTotal);

                if ($valorPendiente <= 0 && $diasMora <= 0) {
                    continue;
                }

                $policyNumber = $this->hdiPickScalar($p, ['numero_poliza', 'numeroPoliza', 'poliza', 'nro_poliza']);
                $clientName = $this->hdiPickScalar($p, ['tomador_nombre', 'tomadorNombre', 'nombre_tomador', 'tomador']);
                $clientDoc = $this->hdiPickScalar($p, ['tomador_documento', 'tomadorDocumento', 'documento_tomador', 'documento']);

                $items[] = [
                    'policy_number' => $policyNumber,
                    'client_name' => $clientName,
                    'client_document' => $clientDoc,
                    'client_doc_type' => null,
                    'ramo' => ($rm = $this->hdiPickScalar($p, ['ramo', 'nombre_ramo'])) !== '' ? $rm : null,
                    'product_name' => ($lf = $this->hdiPickScalar($p, ['linea_financiacion', 'lineaFinanciacion', 'producto', 'tipo'])) !== '' ? $lf : null,
                    'prima_total' => $valorPendiente > 0 ? $valorPendiente : $saldoTotal,
                    'valor_pendiente' => $valorPendiente,
                    'valor_pagado' => $this->hdiPickFloat($p, ['valor_pagado', 'pagado']),
                    'bonificacion' => $this->hdiPickFloat($p, ['bonificacion']),
                    'dias_mora' => $diasMora,
                    'rango_mora' => CarteraAseguradora::calcRangoMora($diasMora),
                    'fecha_inicio_vigencia' => $this->hdiPickDate($p, [
                        'fecha_inicio', 'fechaInicio', 'inicio_vigencia', 'inicioVigencia',
                    ]),
                    'fecha_expedicion' => $this->hdiPickDate($p, ['fecha_expedicion', 'fechaExpedicion', 'expedicion']),
                    'fecha_vencimiento' => $this->hdiPickDate($p, [
                        'fecha_vencimiento', 'fechaVencimiento', 'fin_vigencia', 'vencimiento',
                    ]),
                    'numero_pagare' => ($np = $this->hdiPickScalar($p, ['numero_pagare', 'numeroPagare', 'pagare', 'nro_pagare'])) !== '' ? $np : null,
                    'cuotas_pagadas' => $this->hdiPickInt($p, ['cuotas_pagadas', 'cuotasPagadas']) ?? 0,
                    'cuotas_mora' => $this->hdiPickInt($p, ['cuotas_mora', 'cuotasMora']) ?? 0,
                    'total_cuotas' => $this->hdiPickInt($p, ['total_cuotas', 'totalCuotas', 'nro_cuotas']) ?? 0,
                    'source_endpoint' => '/hdi/cartera/financiada',
                    'raw_data' => $p,
                ];
        }

        return $items;
    }

    private function hdiPickScalar(array $row, array $keys): string
    {
        foreach ($keys as $k) {
            if (!array_key_exists($k, $row)) {
                continue;
            }
            $v = $row[$k];
            if ($v === null || $v === '') {
                continue;
            }

            return trim((string) $v);
        }

        return '';
    }

    private function hdiPickInt(array $row, array $keys): ?int
    {
        foreach ($keys as $k) {
            if (!array_key_exists($k, $row)) {
                continue;
            }
            $v = $row[$k];
            if ($v === null || $v === '') {
                continue;
            }
            if (is_numeric($v)) {
                return (int) $v;
            }
        }

        return null;
    }

    private function hdiPickFloat(array $row, array $keys): float
    {
        foreach ($keys as $k) {
            if (!array_key_exists($k, $row)) {
                continue;
            }
            $v = $row[$k];
            if ($v === null || $v === '') {
                continue;
            }
            $parsed = $this->parseDecimal($v);
            if ($parsed !== null) {
                return $parsed;
            }
        }

        return 0.0;
    }

    private function hdiPickDate(array $row, array $keys): ?string
    {
        foreach ($keys as $k) {
            if (!array_key_exists($k, $row)) {
                continue;
            }
            $v = $row[$k];
            if ($v === null || $v === '') {
                continue;
            }
            $parsed = $this->parseHdiDate($v);
            if ($parsed !== null) {
                return $parsed;
            }
        }

        return null;
    }

    /** Fechas HDI: timestamps, ISO, DD/MM/YYYY (común en portales CO). */
    private function parseHdiDate(mixed $val): ?string
    {
        if ($val === null || $val === '') {
            return null;
        }
        if (is_numeric($val)) {
            return $this->parseTimestampOrDate($val);
        }
        $s = trim((string) $val);
        if ($s === '') {
            return null;
        }
        if (preg_match('/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/', $s, $m)) {
            $d = (int) $m[1];
            $mo = (int) $m[2];
            $y = (int) $m[3];
            if ($y < 100) {
                $y += ($y >= 70 ? 1900 : 2000);
            }
            if (checkdate($mo, $d, $y)) {
                return sprintf('%04d-%02d-%02d', $y, $mo, $d);
            }
        }

        return $this->parseDate($s);
    }

    /**
     * Cartera AXA Colpatria vía microservicio GET /axa/cartera.
     * Respuesta esperada: { "cartera": [ ... ] } o { "items": [ ... ] } (filas tipo HDI / campos snake_case).
     */
    private function fetchCarteraAxa(string $sessionId): array
    {
        $timeout = $this->endpointTimeout('axa', 'cartera');
        $response = $this->apiGetLong('/axa/cartera', $sessionId, $timeout);
        if (!$response->ok()) {
            if (in_array($response->status(), [404, 422, 405], true)) {
                Log::warning('[INSURER SYNC] AXA cartera no disponible en microservicio', ['status' => $response->status()]);

                return [];
            }
            if ($response->status() === 401) {
                throw new \RuntimeException('Sesión expirada', 401);
            }

            return [];
        }

        $data = $response->json();
        $rows = $data['cartera'] ?? $data['items'] ?? $data['data'] ?? [];
        if (!is_array($rows)) {
            return [];
        }

        $items = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $diasMora = max(
                (int) ($row['dias_mora'] ?? 0),
                (int) ($row['dias_mora_max'] ?? 0),
                (int) ($row['dias_mora_min'] ?? 0),
                (int) ($row['diasMora'] ?? 0),
            );

            $valorPendiente = (float) (
                $row['valor_pendiente']
                ?? $row['total_pagar']
                ?? $row['saldo']
                ?? $row['saldo_total']
                ?? $row['saldoPendiente']
                ?? 0
            );

            if ($valorPendiente <= 0 && $diasMora <= 0) {
                continue;
            }

            $docTypeRaw = $row['tipo_documento']
                ?? $row['tipo_doc_tomador']
                ?? $row['tipoDocumento']
                ?? '';

            $items[] = [
                'policy_number' => trim((string) ($row['numero_poliza'] ?? $row['policy_number'] ?? $row['numeroPoliza'] ?? '')),
                'client_name' => trim((string) ($row['tomador'] ?? $row['nombre_tomador'] ?? $row['client_name'] ?? $row['nombreTomador'] ?? '')),
                'client_document' => trim((string) ($row['documento_tomador'] ?? $row['file_identifier'] ?? $row['documento'] ?? $row['numero_documento'] ?? $row['documentoTomador'] ?? '')),
                'client_doc_type' => $docTypeRaw !== ''
                    ? (self::DOC_TYPE_MAP[strtoupper(trim((string) $docTypeRaw))] ?? strtoupper(trim((string) $docTypeRaw)))
                    : null,
                'ramo' => $row['ramo'] ?? $row['nombre_ramo'] ?? null,
                'product_name' => $row['producto'] ?? $row['tipo'] ?? $row['product_name'] ?? null,
                'prima_total' => (float) ($row['prima_total'] ?? $row['prima'] ?? $valorPendiente),
                'valor_pendiente' => $valorPendiente,
                'valor_pagado' => (float) ($row['valor_pagado'] ?? $row['pagado'] ?? 0),
                'bonificacion' => (float) ($row['bonificacion'] ?? 0),
                'dias_mora' => $diasMora,
                'rango_mora' => CarteraAseguradora::calcRangoMora($diasMora),
                'fecha_inicio_vigencia' => $this->parseDate((string) ($row['inicio_vigencia'] ?? $row['fecha_inicio'] ?? $row['fechaInicioVigencia'] ?? '')),
                'fecha_expedicion' => $this->parseDate((string) ($row['expedicion'] ?? $row['fecha_expedicion'] ?? $row['fechaExpedicion'] ?? '')),
                'fecha_vencimiento' => $this->parseDate((string) ($row['fecha_vencimiento'] ?? $row['fecha_fin'] ?? $row['fechaVencimiento'] ?? '')),
                'numero_recibo' => $row['numero_recibo'] ?? $row['contrato'] ?? $row['recibo'] ?? null,
                'numero_pagare' => $row['numero_pagare'] ?? $row['pagare'] ?? null,
                'cuotas_pagadas' => isset($row['cuotas_pagadas']) ? (int) $row['cuotas_pagadas'] : null,
                'cuotas_mora' => isset($row['cuotas_mora']) ? (int) $row['cuotas_mora'] : null,
                'total_cuotas' => isset($row['total_cuotas']) ? (int) $row['total_cuotas'] : null,
                'source_endpoint' => '/axa/cartera',
                'raw_data' => $row,
            ];
        }

        return $items;
    }

    /**
     * Cartera La Equidad vía microservicio GET /equidad/cartera.
     * El microservicio descarga el XLSX /reportes/cartera/doc del portal y lo parsea.
     * Respuesta: { "cartera": [ { agencia, numero_poliza, certificado, producto,
     *   documento_tomador, nombre_tomador, placa, fecha_expedicion, fecha_inicio,
     *   fecha_fin, fecha_ultimo_cobro, tipo_cobro, dias_vigencia, dias_causados,
     *   dias_a_cancelar, total_cartera, clasificacion, direccion, telefono
     * }, ... ] }
     */
    /**
     * Habla con el flujo async del microservicio:
     *   1. POST /sura/cartera/iniciar       → report_id
     *   2. GET  /sura/cartera/estado/{id}   → poll hasta status=ready
     *   3. GET  /sura/cartera/resultado/{id} → payload (success/total/cartera[])
     *
     * Devuelve el array `data` con clave `cartera`, igual que el endpoint legacy.
     * Lanza RuntimeException con el mismo formato de errores que antes para que
     * `fetchCarteraSura` siga funcionando.
     */
    private function fetchCarteraSuraAsync(string $sessionId): array
    {
        // Paso 1 — iniciar (corto)
        $startResp = $this->apiPost('/sura/cartera/iniciar', $sessionId, [], 60);
        if (!$startResp->ok()) {
            $this->throwSuraCarteraError($startResp);
        }
        $reportId = (string) ($startResp->json('report_id') ?? '');
        if ($reportId === '') {
            throw new \RuntimeException('Microservicio SURA no devolvió report_id al iniciar');
        }

        Log::info("[SURA-CARTERA-ASYNC] Iniciado report_id={$reportId}");

        // Paso 2 — polling
        // Worst-case 80 polls × 15s = 1200s (20 min). El portal SURA con brokers
        // grandes (1000+ pólizas) tarda 7-15 min en horas pico. El queue worker
        // tolera 1800s, así que hay margen aún para retornar el payload.
        $maxPolls = 80;
        $pollIntervalS = 15;
        $finalEstado = null;
        for ($i = 1; $i <= $maxPolls; $i++) {
            sleep($pollIntervalS);
            $estadoResp = $this->apiGet("/sura/cartera/estado/{$reportId}", $sessionId);
            if (!$estadoResp->ok()) {
                // 404 = job purgado (timeout interno o restart), 401 = sesión muerta
                if ($estadoResp->status() === 404) {
                    throw new \RuntimeException(
                        "Job SURA {$reportId} expiró o el microservicio fue reiniciado. Reintenta la sincronización."
                    );
                }
                $this->throwSuraCarteraError($estadoResp);
            }
            $estado = $estadoResp->json();
            $status = (string) ($estado['status'] ?? '');
            Log::info("[SURA-CARTERA-ASYNC] poll {$i}/{$maxPolls} report_id={$reportId} status={$status} elapsed=" . ($estado['elapsed_s'] ?? '?') . 's');
            if ($status === 'ready') {
                $finalEstado = $estado;
                break;
            }
            if ($status === 'error') {
                throw new \RuntimeException(
                    'SURA cartera falló: ' . ($estado['error'] ?? 'error desconocido'),
                    (int) ($estado['http_status'] ?? 500)
                );
            }
            // status=running → seguir polleando
        }
        if ($finalEstado === null) {
            throw new \RuntimeException(
                "Cartera SURA no estuvo lista en " . ($maxPolls * $pollIntervalS) . "s. "
                . "Reporte muy grande o portal SURA lento."
            );
        }

        // Paso 3 — descargar payload
        $resultResp = $this->apiGetLong("/sura/cartera/resultado/{$reportId}", $sessionId, 120);
        if (!$resultResp->ok()) {
            $this->throwSuraCarteraError($resultResp);
        }
        $total = $resultResp->json('total') ?? 0;
        Log::info("[SURA-CARTERA-ASYNC] Descargado report_id={$reportId} total={$total} items");
        return $resultResp->json() ?: [];
    }

    /**
     * Mapea errores HTTP del flujo SURA cartera a RuntimeException con mensajes
     * útiles para el usuario. Comparte la misma lógica que tenía fetchCarteraSura.
     */
    private function throwSuraCarteraError(\Illuminate\Http\Client\Response $response): void
    {
        if (in_array($response->status(), [404, 422, 405], true)) {
            throw new \RuntimeException('Endpoint SURA cartera no disponible: ' . $this->extractErrorMessage($response));
        }
        if ($response->status() === 401) {
            $msg = $this->extractErrorMessage($response);
            if (str_contains((string) $msg, 'perfil') || str_contains((string) $msg, 'Perfil')) {
                throw new \RuntimeException(
                    'Perfil de cartera SURA no inicializado. '
                    . 'El broker debe hacer login una vez en el portal de cartera.',
                    401
                );
            }
            throw new \RuntimeException('Sesión SURA expirada', 401);
        }
        if ($response->status() === 502) {
            throw new \RuntimeException(
                'El portal de cartera SURA no respondió a tiempo. Intenta de nuevo en un minuto.'
            );
        }
        throw new \RuntimeException($this->extractErrorMessage($response));
    }

    /**
     * Cartera SURA: el microservicio usa Playwright (SAML + Angular del portal
     * asistenteserviciosfinancieros) para capturar /carteraedades. Para brokers
     * grandes (>10k pólizas) SURA exige generar un informe Excel que puede
     * tardar 3-9 minutos, lo cual excede el límite de Cloudflare de 100s.
     *
     * Por eso usamos el flujo async (3 endpoints cortos):
     *   POST /sura/cartera/iniciar    → devuelve report_id en ~5s
     *   GET  /sura/cartera/estado/{id} → polling cada 15s, cada llamada <30s
     *   GET  /sura/cartera/resultado/{id} → descarga payload final
     *
     * El job de Laravel corre en queue worker (timeout 600s), así que tolera
     * todo el polling. Cada request HTTP individual se mantiene bajo CF.
     */
    private function fetchCarteraSura(string $sessionId): array
    {
        $response = $this->fetchCarteraSuraAsync($sessionId);
        $data = $response;
        $rows = $data['cartera'] ?? [];
        if (!is_array($rows)) {
            return [];
        }

        // Mapa código SURA → tipo de documento interno
        static $docTypeMap = [
            '13' => 'CC', '22' => 'CE', '06' => 'D',  // CC, CE, Diplomático
            '31' => 'NIT', '41' => 'PA', '43' => 'TI', '11' => 'RC',
        ];

        $items = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $saldo = (float) ($row['saldo'] ?? 0);
            $importe = (float) ($row['importe'] ?? 0);
            $abonos = (float) ($row['abonos'] ?? 0);

            // diasCartera: negativo = aún no vence (cartera al día / futura).
            // El frontend distingue por rango_mora.
            $diasCartera = (int) ($row['dias_cartera'] ?? 0);
            $diasMora = max(0, $diasCartera);

            // Descartar créditos a favor (saldo ≤ 0) — no son cartera pendiente real
            if ($saldo <= 0) {
                continue;
            }

            $docType = $docTypeMap[$row['tipo_id_codigo'] ?? ''] ?? null;
            if (!$docType) {
                // Fallback por nombre
                $nombreTipo = strtoupper((string) ($row['tipo_id'] ?? ''));
                if (str_contains($nombreTipo, 'NIT')) $docType = 'NIT';
                elseif (str_contains($nombreTipo, 'CÉDULA DE EXTRANJ')) $docType = 'CE';
                elseif (str_contains($nombreTipo, 'TARJETA')) $docType = 'TI';
                elseif (str_contains($nombreTipo, 'PASAPORTE')) $docType = 'PA';
                else $docType = 'CC';
            }

            // SURA devuelve policy_number en cartera con prefijo ramo + ceros
            // (ej: "081000331816" = ramo "081" + "000331816" → póliza "331816").
            // Las tablas `polizas` y `recibos_comisiones_aseguradoras` guardan el
            // número corto. Normalizamos para habilitar joins consistentes.
            $polNumRaw = (string) ($row['numero_poliza'] ?? '');
            $ramoCod = (string) ($row['ramo_codigo'] ?? '');
            $polNum = $this->suraStripPolicyPrefix($polNumRaw, $ramoCod);

            $items[] = [
                'policy_number' => $polNum,
                'client_name' => (string) ($row['nombre_tomador'] ?? ''),
                'client_document' => (string) ($row['numero_id'] ?? ''),
                'client_doc_type' => $docType,
                'ramo' => $row['producto'] ?? null,
                'product_name' => $row['producto'] ?? null,
                'prima_total' => 0,
                'valor_pendiente' => $saldo,
                'valor_pagado' => $abonos,
                'bonificacion' => 0,
                'dias_mora' => $diasMora,
                'rango_mora' => CarteraAseguradora::calcRangoMora($diasMora),
                'fecha_inicio_vigencia' => $this->parseDate((string) ($row['fecha_inicio_vigencia'] ?? '')),
                'fecha_expedicion' => $this->parseDate((string) ($row['fecha_expedicion'] ?? '')),
                'fecha_vencimiento' => $this->parseDate((string) ($row['fecha_pago_maximo'] ?? '')),
                'numero_recibo' => !empty($row['referencia']) ? (string) $row['referencia'] : null,
                'source_endpoint' => '/sura/cartera',
                'raw_data' => array_merge($row, ['_policy_number_raw' => $polNumRaw]),
            ];
        }

        return $items;
    }

    /**
     * SURA retorna policy_number en cartera como "{RAMO 3-dig}{0000…}{POLIZA}".
     * Quita ese prefijo para que matchee con los policy_number que devuelve
     * el API de /sura/polizas y /sura/comisiones.
     *
     * Ejemplos:
     *   ("081000331816", "081") → "331816"
     *   ("030000634236", "030") → "634236"
     *   ("900001007277", "")    → "900001007277" (sin cambio)
     */
    private function suraStripPolicyPrefix(string $polNum, string $ramoCod): string
    {
        $polNum = trim($polNum);
        $ramoCod = trim($ramoCod);
        if ($polNum === '') {
            return $polNum;
        }
        // Solo strippear si hay ramo de 3 dígitos y el number comienza con él
        if ($ramoCod !== '' && strlen($ramoCod) === 3 && ctype_digit($ramoCod) && str_starts_with($polNum, $ramoCod)) {
            $tail = substr($polNum, 3);
            $stripped = ltrim($tail, '0');
            if ($stripped !== '') {
                return $stripped;
            }
            return $tail; // caso edge: quedó solo ceros, retornar como estaba
        }
        return $polNum;
    }

    private function fetchCarteraEquidad(string $sessionId): array
    {
        $response = $this->apiGetLong('/equidad/cartera', $sessionId, 180);
        if (!$response->ok()) {
            if (in_array($response->status(), [404, 422, 405], true)) {
                return [];
            }
            if ($response->status() === 401) {
                throw new \RuntimeException('Sesión expirada', 401);
            }
            return [];
        }

        $data = $response->json();
        $rows = $data['cartera'] ?? [];
        if (!is_array($rows)) {
            return [];
        }

        $items = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $totalCartera = (float) ($row['total_cartera'] ?? 0);
            $diasMora = (int) ($row['dias_a_cancelar'] ?? 0);

            // Descartar filas vacías (cartera ya saldada sin mora)
            if ($totalCartera <= 0 && $diasMora <= 0) {
                continue;
            }

            $docTomador = trim((string) ($row['documento_tomador'] ?? ''));
            $clientDocType = (ctype_digit($docTomador) && strlen($docTomador) >= 9) ? 'NIT' : 'CC';

            $items[] = [
                'policy_number' => trim((string) ($row['numero_poliza'] ?? '')),
                'client_name' => trim((string) ($row['nombre_tomador'] ?? '')),
                'client_document' => $docTomador,
                'client_doc_type' => $clientDocType,
                'ramo' => $row['producto'] ?? null,
                'product_name' => $row['producto'] ?? null,
                'prima_total' => $totalCartera,
                'valor_pendiente' => $totalCartera,
                'valor_pagado' => 0,
                'bonificacion' => 0,
                'dias_mora' => $diasMora,
                'rango_mora' => CarteraAseguradora::calcRangoMora($diasMora),
                'fecha_inicio_vigencia' => $this->parseDate((string) ($row['fecha_inicio'] ?? '')),
                'fecha_expedicion' => $this->parseDate((string) ($row['fecha_expedicion'] ?? '')),
                'fecha_vencimiento' => $this->parseDate((string) ($row['fecha_fin'] ?? '')),
                'numero_recibo' => !empty($row['certificado']) ? trim((string) $row['certificado']) : null,
                'source_endpoint' => '/equidad/cartera',
                'raw_data' => $row,
            ];
        }

        return $items;
    }

    /**
     * Cartera Allianz vía microservicio GET /allianz/cartera.
     *
     * NOTA: Allianz ePAC no expone una "cartera de cobro" tradicional en /api/bookings/paginar
     * sino el listado de Recibos Bancarios (RCB) con saldos de comisión pendientes del
     * periodo en curso. Cada recibo = una fila en CarteraAseguradora con:
     *   policy_number  ← policyExt (sin el sufijo /0)
     *   client_name    ← name / completeName
     *   prima_total    ← amount  (prima recibida por el cliente)
     *   valor_pendiente← balance (saldo de comisión a favor del mediador)
     *
     * Respuesta esperada:
     *   { "periodo":"YYYYMM", "tipo":"RCB", "items":[{bookingReferenceId, paidDate, amount,
     *     balance, comission, name, completeName, policyExt, retentionExt, ...}] }
     */
    private function fetchCarteraAllianz(string $sessionId): array
    {
        $response = $this->apiGetLong('/allianz/cartera', $sessionId, 120);
        if (!$response->ok()) {
            if (in_array($response->status(), [404, 422, 405], true)) {
                return [];
            }
            if ($response->status() === 401) {
                throw new \RuntimeException('Sesión expirada', 401);
            }
            return [];
        }

        $data = $response->json();
        $rows = $data['items'] ?? $data['cartera'] ?? $data['data'] ?? [];
        if (!is_array($rows)) {
            return [];
        }

        $periodo = (string) ($data['periodo'] ?? '');

        $parseMoney = static function ($v): float {
            if ($v === null || $v === '') return 0.0;
            $s = preg_replace('/[^0-9\-.,]/', '', (string) $v) ?? '';
            // Allianz usa formato "1,234,567.89" (coma miles, punto decimales)
            $s = str_replace(',', '', $s);
            return is_numeric($s) ? (float) $s : 0.0;
        };

        $parseDate = function ($v) {
            if (!$v) return null;
            $s = trim((string) $v);
            // Allianz: "01/05/2026" (DD/MM/YYYY)
            if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $s, $m)) {
                return "{$m[3]}-{$m[2]}-{$m[1]}";
            }
            return $this->parseDate($s);
        };

        $items = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            // policyExt formato "23819062/0" → extraer número de póliza
            $policyRaw = trim((string) ($row['policyExt'] ?? $row['policy_number'] ?? ''));
            $policyNumber = $policyRaw;
            if (str_contains($policyRaw, '/')) {
                $policyNumber = trim(explode('/', $policyRaw, 2)[0]);
            }

            $amount = $parseMoney($row['amount'] ?? $row['commisionExt'] ?? 0);
            $balance = $parseMoney($row['balance'] ?? 0);
            $retencion = $parseMoney($row['retentionExt'] ?? 0);

            // Si tanto balance como amount son 0, saltar (sin datos útiles)
            if ($amount <= 0 && $balance <= 0) {
                continue;
            }

            $clientName = trim((string) ($row['completeName'] ?? $row['name'] ?? ''));
            $items[] = [
                'policy_number'        => $policyNumber,
                'client_name'          => $clientName,
                'client_document'      => '', // Allianz RCB no lo expone
                'client_doc_type'      => null,
                'ramo'                 => $row['branchAgrupationExt'] ?? null,
                'product_name'         => null,
                'prima_total'          => $amount,
                'valor_pendiente'      => $balance > 0 ? $balance : $amount,
                'valor_pagado'         => max(0.0, $amount - $balance),
                'bonificacion'         => 0,
                'dias_mora'            => 0, // RCB son recibos del periodo actual
                'rango_mora'           => CarteraAseguradora::calcRangoMora(0),
                'fecha_inicio_vigencia'=> null,
                'fecha_expedicion'     => null,
                'fecha_vencimiento'    => $parseDate($row['paidDate'] ?? null),
                'numero_recibo'        => (string) ($row['bookingReferenceId'] ?? ''),
                'numero_pagare'        => null,
                'cuotas_pagadas'       => null,
                'cuotas_mora'          => null,
                'total_cuotas'         => null,
                'source_endpoint'      => '/allianz/cartera',
                'raw_data'             => array_merge($row, [
                    '_periodo'    => $periodo,
                    '_retencion'  => $retencion,
                ]),
            ];
        }

        return $items;
    }

    /**
     * Cartera Qualitas vía microservicio POST /qualitas/cartera.
     *
     * NOTA importante: el portal Qualitas Colombia NO expone "cartera pendiente"
     * en este endpoint — devuelve pólizas PAGADAS en el rango de fechas. Esto sirve
     * como histórico de recibos cobrados, pero no es saldo vivo por cobrar.
     * Para cartera pendiente real necesitaríamos otro endpoint (no presente en HARs aún).
     *
     * Respuesta:
     *   { polizas_pagadas: [{agentId, poliza, ramo, certificado, endoso, recibo, remesa,
     *     fEmision, fIniVigencia, fVencimiento, fPago, idAsegurado, nomAsegurado,
     *     primaNeta, primaAbonada, ivaMl, ivaMe, oficina, serie, moneda, tomador}, ...] }
     */
    private function fetchCarteraQualitas(string $sessionId, InsurerConnection $conn): array
    {
        return [];

        $rows = [];
        foreach ($this->qualitasDateWindows() as $window) {
            $response = $this->apiPost('/qualitas/cartera', $sessionId, [
                'desde' => $window['desde'],
                'hasta' => $window['hasta'],
            ], 90);
            if (!$response->ok()) {
                if ($response->status() === 401) {
                    throw new \RuntimeException('Sesión expirada', 401);
                }
                continue;
            }
            $data = $response->json();
            $windowRows = $data['polizas_pagadas'] ?? [];
            if (is_array($windowRows)) {
                $rows = array_merge($rows, $windowRows);
            }
        }

        if (!is_array($rows)) return [];

        $items = [];
        foreach ($rows as $row) {
            if (!is_array($row)) continue;
            $polNum = trim((string) ($row['poliza'] ?? ''));
            if ($polNum === '') continue;
            $primaNeta = (float) ($row['primaNeta'] ?? 0);
            $primaAbonada = (float) ($row['primaAbonada'] ?? 0);
            $iva = (float) ($row['ivaMl'] ?? 0);
            $items[] = [
                'policy_number' => $polNum,
                'client_name' => trim((string) ($row['tomador'] ?? $row['nomAsegurado'] ?? '')),
                'client_document' => trim((string) ($row['idAsegurado'] ?? '')) ?: null,
                'ramo' => (string) ($row['ramo'] ?? ''),
                'product_name' => "Ramo {$row['ramo']}",
                'prima_total' => $primaNeta > 0 ? $primaNeta : 0,
                'valor_pendiente' => 0,  // Qualitas pagadas = ya cobradas, saldo 0
                'valor_pagado' => $primaAbonada,
                'bonificacion' => 0,
                'dias_mora' => 0,
                'rango_mora' => CarteraAseguradora::calcRangoMora(0),
                'fecha_inicio_vigencia' => $this->parseDate((string) ($row['fIniVigencia'] ?? '')),
                'fecha_expedicion' => $this->parseDate((string) ($row['fEmision'] ?? '')),
                'fecha_vencimiento' => $this->parseDate((string) ($row['fVencimiento'] ?? '')),
                'numero_recibo' => trim((string) ($row['recibo'] ?? '')) ?: null,
                'source_endpoint' => '/qualitas/cartera',
                'raw_data' => $row,
            ];
        }
        return $items;
    }

    // ──────────────────────────────────────────────────────
    //  COMISIONES
    // ──────────────────────────────────────────────────────

    /**
     * Sincroniza recibos + comisiones de un mes específico desde la aseguradora.
     * Actualmente solo implementado para SURA. Escalable a otras aseguradoras.
     *
     * Retorna: ['created' => N, 'updated' => N, 'total_fetched' => N, 'error' => ?]
     */
    public function syncComisiones(InsurerConnection $conn, string $anio, string $mes, string $ramo = '00T'): array
    {
        $slug = self::SLUG_MAP[$conn->insurer_code] ?? $conn->insurer_code;
        $brokerId = $conn->broker_id;
        $insurerName = $this->insurerDisplayName($conn->insurer_code);
        $sessionId = $conn->microservice_session_id;
        $anio = trim($anio);
        $mes = str_pad(trim($mes), 2, '0', STR_PAD_LEFT);

        $allItems = [];

        try {
            switch ($slug) {
                case 'sura':
                    $allItems = $this->fetchComisionesSura($sessionId, $anio, $mes, $ramo);
                    break;
                case 'hdi':
                    // HDI: mes corriente trae detalle por póliza, mes histórico
                    // trae 1 fila resumen del período (totales reales del mes).
                    $allItems = $this->fetchComisionesHdi($sessionId, $anio, $mes);
                    break;
                case 'qualitas':
                    $allItems = $this->fetchComisionesQualitas($sessionId, $anio, $mes);
                    break;
                default:
                    return [
                        'created' => 0, 'updated' => 0, 'total_fetched' => 0,
                        'message' => "Comisiones no disponibles para {$insurerName}",
                    ];
            }
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            return [
                'created' => 0, 'updated' => 0, 'total_fetched' => 0,
                'error' => "Tiempo de espera agotado al obtener comisiones de {$insurerName}.",
            ];
        } catch (\Throwable $e) {
            $msg = $e->getMessage();
            if ($e->getCode() === 401 || str_contains($msg, '401') || str_contains($msg, 'expirada')) {
                return [
                    'created' => 0, 'updated' => 0, 'total_fetched' => 0,
                    'error' => "Sesión expirada. Reconecta {$insurerName} desde Integraciones.",
                ];
            }
            return ['created' => 0, 'updated' => 0, 'total_fetched' => 0, 'error' => $msg];
        }

        Log::info("[INSURER SYNC] Comisiones obtenidas de {$conn->insurer_code}", [
            'count' => count($allItems), 'anio' => $anio, 'mes' => $mes,
        ]);

        $created = 0;
        $updated = 0;
        $errors = 0;

        // Replace atomic por (broker, insurer, anio, mes): snapshot fresco del mes
        DB::transaction(function () use ($allItems, $brokerId, $conn, $insurerName, $anio, $mes, &$created, &$updated, &$errors) {
            RecibosComisionAseguradora::where('broker_id', $brokerId)
                ->where('insurer_code', $conn->insurer_code)
                ->where('anio', $anio)
                ->where('mes', $mes)
                ->delete();

            foreach ($allItems as $item) {
                try {
                    $item['broker_id'] = $brokerId;
                    $item['insurer_code'] = $conn->insurer_code;
                    $item['insurer_name'] = $insurerName;
                    $item['anio'] = $anio;
                    $item['mes'] = $mes;
                    $item['synced_at'] = now();
                    $item['sync_hash'] = md5(json_encode($item));
                    RecibosComisionAseguradora::create($item);
                    $created++;
                } catch (\Throwable $e) {
                    $errors++;
                    Log::warning('[INSURER SYNC] Error comision row', [
                        'insurer' => $conn->insurer_code,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        });

        return [
            'created' => $created,
            'updated' => $updated,
            'errors' => $errors,
            'total_fetched' => count($allItems),
            'anio' => $anio,
            'mes' => $mes,
        ];
    }

    /**
     * Llama al endpoint del microservicio /sura/comisiones y normaliza al schema
     * de recibos_comisiones_aseguradoras.
     */
    private function fetchComisionesSura(string $sessionId, string $anio, string $mes, string $ramo): array
    {
        $response = Http::acceptJson()
            ->timeout(60)
            ->connectTimeout(15)
            ->withHeaders(['X-Session-Id' => $sessionId])
            ->get($this->baseUrl() . '/sura/comisiones', [
                'anio' => $anio,
                'mes' => $mes,
                'ramo' => $ramo,
            ]);

        if (!$response->ok()) {
            if ($response->status() === 401) {
                throw new \RuntimeException('Sesión SURA expirada', 401);
            }
            if (in_array($response->status(), [404, 422], true)) {
                return [];
            }
            throw new \RuntimeException($this->extractErrorMessage($response));
        }

        $data = $response->json() ?? [];
        $rows = $data['comisiones'] ?? [];
        if (!is_array($rows)) {
            return [];
        }

        $items = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            // Fecha viene como "YYYY/MM/DD" desde SURA
            $fecha = trim((string) ($row['fecha_recaudo'] ?? ''));
            $fechaNorm = str_replace('/', '-', $fecha);
            $fechaDate = $this->parseDate($fechaNorm);

            $items[] = [
                'ramo_codigo' => (string) ($row['ramo_codigo'] ?? ''),
                'producto' => null, // SURA no retorna nombre de producto en comisiones-detalladas
                'policy_number' => (string) ($row['numero_poliza'] ?? ''),
                'numero_recibo' => (string) ($row['numero_recibo'] ?? ''),
                'client_name' => (string) ($row['cliente_nombre'] ?? ''),
                'client_document' => (string) ($row['cliente_documento'] ?? ''),
                'client_doc_type' => null,
                'oficina' => (string) ($row['oficina'] ?? ''),
                'fecha_recaudo' => $fechaDate,
                'fecha_pago_asesor' => null, // Fuente 1 no lo devuelve
                'prima_neta' => (float) ($row['prima_neta'] ?? 0),
                'valor_pagado_tomador' => (float) ($row['valor_pagado_tomador'] ?? 0),
                'porcentaje_comision' => (float) ($row['porcentaje_comision'] ?? 0),
                'valor_comision' => (float) ($row['valor_comision'] ?? 0),
                'estado' => 'legalizada',
                'concepto' => null,
                'subramo' => null,
                'source_endpoint' => '/sura/comisiones',
                'raw_data' => $row,
            ];
        }

        return $items;
    }

    /**
     * Llama al endpoint del microservicio /hdi/comisiones y normaliza al schema
     * de recibos_comisiones_aseguradoras.
     *
     * Nota: HDI sólo expone la liquidación CORRIENTE (no permite filtrar histórico
     * por anio/mes). Los parámetros se usan como etiqueta para agrupar el snapshot
     * en la tabla. El primer día del mes seleccionado se usa como `fecha_recaudo`
     * sintética para que la UI pueda ordenar/agrupar.
     */
    private function fetchComisionesHdi(string $sessionId, string $anio, string $mes): array
    {
        $response = Http::acceptJson()
            ->timeout(60)
            ->connectTimeout(15)
            ->withHeaders(['X-Session-Id' => $sessionId])
            ->get($this->baseUrl() . '/hdi/comisiones', [
                'anio' => $anio,
                'mes' => $mes,
            ]);

        if (!$response->ok()) {
            if ($response->status() === 401) {
                throw new \RuntimeException('Sesión HDI expirada', 401);
            }
            if (in_array($response->status(), [404, 422], true)) {
                return [];
            }
            throw new \RuntimeException($this->extractErrorMessage($response));
        }

        $data = $response->json() ?? [];
        $rows = $data['comisiones'] ?? [];
        $totales = is_array($data['totales'] ?? null) ? $data['totales'] : [];
        if (!is_array($rows)) {
            return [];
        }

        $fechaSyn = null;
        if ($anio && $mes) {
            $fechaSyn = $this->parseDate("{$anio}-{$mes}-01");
        }

        $items = [];
        if (!empty($totales)) {
            $gross = (float) ($totales['gross'] ?? 0);
            $total = (float) ($totales['total'] ?? 0);
            if ($gross !== 0.0 || $total !== 0.0) {
                $period = "{$anio}{$mes}";
                $items[] = [
                    'ramo_codigo' => null,
                    'producto' => 'RESUMEN_PERIODO',
                    'policy_number' => "PERIODO_{$period}",
                    'numero_recibo' => null,
                    'client_name' => "TOTAL HDI {$mes}/{$anio}",
                    'client_document' => null,
                    'client_doc_type' => null,
                    'oficina' => $totales['broker_city'] ?? null,
                    'fecha_recaudo' => $fechaSyn,
                    'fecha_pago_asesor' => null,
                    'prima_neta' => $gross,
                    'valor_pagado_tomador' => $gross,
                    'porcentaje_comision' => 0,
                    'valor_comision' => $gross,
                    'estado' => 'legalizada',
                    'concepto' => 'Total periodo HDI',
                    'subramo' => null,
                    'source_endpoint' => '/hdi/comisiones',
                    'raw_data' => ['totales' => $totales, 'is_summary' => true],
                ];
            }
        }
        foreach ($rows as $row) {
            if (!is_array($row) || (($row['is_summary'] ?? false) && !empty($totales))) {
                continue;
            }
            $premium = $this->hdiPickFloat($row, [
                'premium_value', 'premiumValue', 'prima_neta', 'primaNeta', 'premium',
                'gross', 'valor_prima', 'valorPrima', 'valor_pagado', 'valorPagado',
            ]);
            $commission = $this->hdiPickFloat($row, [
                'commission_value', 'commissionValue', 'valor_comision', 'valorComision',
                'commission', 'comision', 'total_commission', 'totalCommission', 'total',
            ]);
            if ($premium <= 0 && $commission <= 0) {
                continue;
            }
            $items[] = [
                'ramo_codigo' => null,
                'producto' => (string) ($row['product_type'] ?? ''),
                'policy_number' => (string) ($row['policy_number'] ?? ''),
                'numero_recibo' => null,
                'client_name' => (string) ($row['client_name'] ?? ''),
                'client_document' => null,
                'client_doc_type' => null,
                'oficina' => null,
                'fecha_recaudo' => $fechaSyn,
                'fecha_pago_asesor' => null,
                'prima_neta' => $premium,
                'valor_pagado_tomador' => $premium,
                'porcentaje_comision' => $this->hdiPickFloat($row, [
                    'commission_percentage', 'commissionPercentage', 'porcentaje_comision',
                    'porcentajeComision', 'percentage', 'porcentaje',
                ]),
                'valor_comision' => $commission,
                'estado' => 'legalizada',
                'concepto' => null,
                'subramo' => null,
                'source_endpoint' => '/hdi/comisiones',
                'raw_data' => $row,
            ];
        }

        return $items;
    }

    private function fetchComisionesQualitas(string $sessionId, string $anio, string $mes): array
    {
        $response = Http::acceptJson()
            ->timeout(90)
            ->connectTimeout(15)
            ->withHeaders(['X-Session-Id' => $sessionId])
            ->post($this->baseUrl() . '/qualitas/comisiones');

        if (!$response->ok()) {
            if ($response->status() === 401) {
                throw new \RuntimeException('Sesión Qualitas expirada', 401);
            }
            if (in_array($response->status(), [404, 422], true)) {
                return [];
            }
            throw new \RuntimeException($this->extractErrorMessage($response));
        }

        $data = $response->json() ?? [];
        $rows = $data['edos_cuenta'] ?? [];
        if (!is_array($rows)) {
            return [];
        }

        $items = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $primaNeta = (float) ($row['primaNeta'] ?? $row['prima_neta'] ?? $row['prima'] ?? 0);
            $valorPagado = (float) ($row['primaAbonada'] ?? $row['valor_pagado'] ?? $row['valorPagado'] ?? $row['pagado'] ?? 0);
            $valorComision = (float) ($row['valorComision'] ?? $row['valor_comision'] ?? $row['comision'] ?? $row['commission'] ?? 0);
            $fecha = $this->parseDate((string) ($row['fecha'] ?? ''));
            if ($fecha) {
                $dt = \Carbon\Carbon::parse($fecha);
                if ($dt->format('Y') !== $anio || $dt->format('m') !== $mes) {
                    continue;
                }
            }
            $items[] = [
                'ramo_codigo' => null,
                'producto' => 'Estado de cuenta',
                'policy_number' => null,
                'numero_recibo' => (string) ($row['clave'] ?? ''),
                'client_name' => null,
                'client_document' => null,
                'client_doc_type' => null,
                'oficina' => null,
                'fecha_recaudo' => $fecha,
                'fecha_pago_asesor' => $fecha,
                'prima_neta' => $primaNeta,
                'valor_pagado_tomador' => $valorPagado,
                'porcentaje_comision' => $primaNeta > 0 ? round(($valorComision / $primaNeta) * 100, 4) : 0,
                'valor_comision' => $valorComision,
                'estado' => 'legalizada',
                'concepto' => (string) ($row['descripcion'] ?? ''),
                'subramo' => null,
                'source_endpoint' => '/qualitas/comisiones',
                'raw_data' => $row,
            ];
        }

        return $items;
    }

    // ──────────────────────────────────────────────────────
    //  Data fetching with pagination support
    // ──────────────────────────────────────────────────────

    private function fetchRecords(string $slug, string $dataType, string $sessionId): array
    {
        // SURA: page/per_page. BOLÍVAR clientes: pagina/tamano (sin query solo devuelve 1 página × 50).
        if ($slug === 'sura') {
            try {
                // SURA API only accepts per_page ≤ 50; pagination loop fetches all pages.
                return $this->fetchPaginated("/{$slug}/{$dataType}", $sessionId, $dataType, 50, null);
            } catch (\RuntimeException $e) {
                return ['_error' => $e->getMessage()];
            }
        }
        if ($slug === 'bolivar' && $dataType === 'clientes') {
            try {
                return $this->fetchPaginated("/{$slug}/{$dataType}", $sessionId, $dataType, 200, [
                    'page' => 'pagina',
                    'per_page' => 'tamano',
                ]);
            } catch (\RuntimeException $e) {
                return ['_error' => $e->getMessage()];
            }
        }

        // HDI: los endpoints /hdi/polizas y /hdi/clientes del microservicio NO
        // soportan paginación real — internamente iteran 36 meses extrayendo
        // de pólizas y devuelven la lista. Si Laravel pagina con page/per_page,
        // el microservicio recalcula TODO en cada page → miles de POST /index al
        // portal y HDI nos bloquea. Solución: una sola llamada con per_page muy
        // grande para que devuelva todo de un golpe.
        if ($slug === 'hdi' && in_array($dataType, ['polizas', 'clientes'], true)) {
            try {
                $endpoint = "/{$slug}/{$dataType}";
                $timeout = $this->endpointTimeout($slug, $dataType);
                $response = $this->apiGetLongWithQuery(
                    $endpoint,
                    $sessionId,
                    ['page' => 1, 'per_page' => 10000, 'meses' => 36],
                    $timeout,
                );
                if (!$response->ok()) {
                    if ($response->status() === 401) {
                        return ['_error' => "Sesión expirada. Reconecta HDI desde Integraciones."];
                    }
                    return ['_error' => $this->extractErrorMessage($response)];
                }
                $data = $response->json() ?? [];
                if (($data['success'] ?? null) === false && !empty($data['detail'] ?? $data['message'] ?? null)) {
                    return ['_error' => (string) ($data['detail'] ?? $data['message'])];
                }
                return $data[$dataType] ?? [];
            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                return ['_error' => "Tiempo de espera agotado al obtener {$dataType} de HDI."];
            } catch (\Throwable $e) {
                return ['_error' => $e->getMessage()];
            }
        }

        // Seguros del Estado: portal nuevo de intermediarios devuelve XLSX parseado a rows.
        // El endpoint /estado/produccion reemplaza al viejo /estado/polizas (Grid scraping).
        if ($slug === 'estado' && $dataType === 'polizas') {
            try {
                $desde = now()->subYear()->format('d/m/Y');
                $hasta = now()->format('d/m/Y');
                $response = $this->apiPost('/estado/produccion', $sessionId, [
                    'start' => $desde,
                    'end'   => $hasta,
                    // branch_code: 65 es valor por defecto (Medellín). Si el broker tiene
                    // otra agencia, esto traerá vacío — habría que iterar branches.
                    'branch_code' => '65',
                ], 600);
                if (!$response->ok()) {
                    if ($response->status() === 401) {
                        return ['_error' => 'Sesión expirada. Reconecta Seguros del Estado desde Integraciones.'];
                    }
                    return ['_error' => $this->extractErrorMessage($response)];
                }
                $data = $response->json() ?? [];
                return $data['rows'] ?? [];
            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                return ['_error' => 'Tiempo de espera agotado al obtener producción de Seguros del Estado.'];
            } catch (\Throwable $e) {
                return ['_error' => $e->getMessage()];
            }
        }

        // Qualitas: POST con body {desde, hasta}. Devuelve {polizas: [...]} (alias del endpoint).
        if ($slug === 'qualitas' && in_array($dataType, ['polizas', 'cartera'], true)) {
            try {
                $endpoint = $dataType === 'polizas' ? '/qualitas/polizas' : '/qualitas/cartera';
                $rows = [];
                foreach ($this->qualitasDateWindows() as $window) {
                    $response = $this->apiPost($endpoint, $sessionId, [
                        'desde' => $window['desde'],
                        'hasta' => $window['hasta'],
                    ], 90);
                    if (!$response->ok()) {
                        if ($response->status() === 401) {
                            return ['_error' => "Sesión expirada. Reconecta Qualitas desde Integraciones."];
                        }
                        return ['_error' => $this->extractErrorMessage($response)];
                    }
                    $data = $response->json() ?? [];
                    $windowRows = $data['polizas'] ?? $data['polizas_pagadas'] ?? [];
                    if (is_array($windowRows)) {
                        $rows = array_merge($rows, $windowRows);
                    }
                }
                return $rows;
            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                return ['_error' => "Tiempo de espera agotado al obtener {$dataType} de Qualitas."];
            } catch (\Throwable $e) {
                return ['_error' => $e->getMessage()];
            }
        }

        // AXA polizas: use /axa/polizas-fast (direct portlet POST, 4x faster)
        $endpoint = "/{$slug}/{$dataType}";
        if ($slug === 'axa' && $dataType === 'polizas') {
            $endpoint = '/axa/polizas-fast';
        }

        try {
            $timeout = $this->endpointTimeout($slug, $dataType);
            $response = $this->apiGetLong($endpoint, $sessionId, $timeout);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            $displayName = $this->insurerDisplayName($slug === 'axa' ? 'axa-colpatria' : $slug);
            return ['_error' => "Tiempo de espera agotado al obtener {$dataType} de {$displayName}. El servidor tardó demasiado en responder. Intenta de nuevo."];
        }

        if (!$response->ok()) {
            if ($response->status() === 401) {
                return ['_error' => "Sesión expirada. Reconecta la aseguradora desde Integraciones."];
            }
            return ['_error' => $this->extractErrorMessage($response)];
        }

        $data = $response->json() ?? [];
        if (($data['success'] ?? null) === false && !empty($data['detail'] ?? $data['message'] ?? null)) {
            return ['_error' => (string) ($data['detail'] ?? $data['message'])];
        }

        return $data[$dataType] ?? [];
    }

    private function endpointTimeout(string $slug, string $dataType): int
    {
        $slowEndpoints = [
            'bolivar:clientes' => 300,
            'bolivar:polizas' => 300,
            'hdi:clientes' => 300,
            'axa:clientes' => 360,
            'axa:polizas' => 180,
            'axa:cartera' => 300,
            'estado:polizas' => 1800,  // ~25 min: portal lento, ~25s/pág × ~50 pág
        ];
        return $slowEndpoints["{$slug}:{$dataType}"] ?? 90;
    }

    private function fetchPaginated(string $endpoint, string $sessionId, string $key, int $perPage = 10_000, ?array $queryParamNames = null): array
    {
        $qn = $queryParamNames ?? ['page' => 'page', 'per_page' => 'per_page'];
        $all = [];
        $page = 1;
        $total = 0;

        // Status HTTP que típicamente son transitorios (microservicio caído, gateway, timeouts).
        $transientStatuses = [408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 524];
        $maxRetries = 4;

        while (true) {
            $attempt = 0;
            $response = null;
            while (true) {
                $attempt++;
                $response = $this->apiGetWithQuery($endpoint, $sessionId, [
                    $qn['page'] => $page,
                    $qn['per_page'] => $perPage,
                ]);
                if ($response->ok()) break;

                $status = $response->status();
                $isTransient = in_array($status, $transientStatuses, true);
                if ($isTransient && $attempt < $maxRetries) {
                    // Backoff exponencial: 5s, 15s, 45s
                    $sleep = (int) min(60, 5 * (3 ** ($attempt - 1)));
                    Log::warning("[INSURER SYNC] Reintentando {$endpoint} page={$page} (intento {$attempt}/{$maxRetries})", [
                        'status' => $status,
                        'sleep_s' => $sleep,
                    ]);
                    sleep($sleep);
                    continue;
                }
                break; // No transient o agotó reintentos
            }

            if (!$response->ok()) {
                Log::warning("[INSURER SYNC] Paginación falló en {$endpoint} page={$page}", [
                    'status' => $response->status(),
                    'body' => substr($response->body(), 0, 200),
                    'attempts' => $attempt,
                ]);
                // Page 1 failure = total failure; report error instead of silently returning 0.
                if ($page === 1) {
                    $body = $response->json() ?? [];
                    $detail = $body['detail'] ?? $body['message'] ?? '';
                    if ($response->status() === 401 || str_contains((string) $detail, 'Sesión') || str_contains((string) $detail, 'login')) {
                        throw new \RuntimeException("Sesión expirada. Reconecta la aseguradora desde Integraciones.");
                    }
                    throw new \RuntimeException("HTTP {$response->status()}: " . ($detail ?: substr($response->body(), 0, 200)));
                }
                // Partial failure on page N>1: si tenemos total reportado y faltan muchas
                // páginas por bajar, hacer fallar el sync para que el usuario pueda reintentar
                // todo en vez de marcarlo "completed" con data incompleta.
                if ($total > 0 && count($all) < $total * 0.9) {
                    throw new \RuntimeException(
                        "Microservicio no responde tras {$attempt} intentos en {$endpoint} (página {$page}). "
                        . 'Bajadas ' . count($all) . " de {$total} pólizas. Reintenta la sincronización."
                    );
                }
                break; // Pérdida tolerable: devolver lo que hay
            }

            $data = $response->json() ?? [];
            if (($data['success'] ?? null) === false && !empty($data['detail'] ?? $data['message'] ?? null)) {
                Log::warning("[INSURER SYNC] Paginación respuesta success=false", [
                    'endpoint' => $endpoint,
                    'page' => $page,
                    'detail' => $data['detail'] ?? $data['message'] ?? '',
                ]);
                break;
            }
            $items = $data[$key] ?? [];
            if (!is_array($items)) {
                $items = [];
            }
            $all = array_merge($all, $items);

            // Prefer a global total (totalRegistros is SURA, cantidadRespuesta is Bolívar global).
            // Some APIs return per-page counts — only trust totals strictly larger than page size.
            $reportedTotal = (int) ($data['total'] ?? $data['totalRegistros'] ?? $data['cantidadRespuesta'] ?? 0);
            if ($reportedTotal > 0 && $reportedTotal > count($items)) {
                $total = $reportedTotal; // likely a global total
            } elseif ($total === 0) {
                $total = 0; // unknown total, keep paginating until empty page
            }

            Log::info("[INSURER SYNC] Página {$page} de {$endpoint}: " . count($items) . " registros (acumulado: " . count($all) . "/{$total})");
            $page++;

            if (count($items) === 0) {
                break;
            }
            // Stop if we've fetched all known records
            if ($total > 0 && count($all) >= $total) {
                break;
            }
        }

        Log::info("[INSURER SYNC] Paginación {$endpoint}", [
            'pages' => $page - 1,
            'requested_per_page' => $perPage,
            'total_rows' => count($all),
            'reported_total' => $total,
        ]);

        return $all;
    }

    // ──────────────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────────────

    private function parseDate(string $val): ?string
    {
        if (empty($val)) {
            return null;
        }
        $val = trim($val);
        // Caso especial Seguros del Estado: "19/05/2021 8:25:43 a. m."
        // Carbon::parse interpreta "/" como formato americano (m/d/Y) y falla
        // con meses > 12. Probamos formatos colombianos explícitos primero.
        $normalized = preg_replace('/\s*a\.?\s*m\.?$/iu', ' AM', $val) ?? $val;
        $normalized = preg_replace('/\s*p\.?\s*m\.?$/iu', ' PM', $normalized) ?? $normalized;
        foreach (['d/m/Y g:i:s A', 'd/m/Y H:i:s', 'd/m/Y G:i:s', 'd/m/Y H:i', 'd/m/Y', 'd-m-Y'] as $fmt) {
            $d = \DateTime::createFromFormat($fmt, $normalized);
            if ($d instanceof \DateTime && $d->format($fmt) === $normalized) {
                return $d->format('Y-m-d');
            }
        }
        try {
            return \Carbon\Carbon::parse($val)->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseTimestampOrDate(mixed $val): ?string
    {
        if ($val === null || $val === '' || $val === 0) {
            return null;
        }
        if (is_numeric($val)) {
            $ts = (int) $val;
            if ($ts > 1e12) {
                $ts = (int) ($ts / 1000);
            }
            try {
                return \Carbon\Carbon::createFromTimestamp($ts)->format('Y-m-d');
            } catch (\Throwable) {
                return null;
            }
        }
        return $this->parseDate((string) $val);
    }

    private function mapPaymentFrequency(string $formaCobro): ?string
    {
        $lower = mb_strtolower(trim($formaCobro));
        if (str_contains($lower, 'anual') || str_contains($lower, 'annual')) return 'annual';
        if (str_contains($lower, 'contado') || str_contains($lower, 'unico') || str_contains($lower, 'único')) return 'annual';
        if (str_contains($lower, 'semestral') || str_contains($lower, 'biannual')) return 'biannual';
        if (str_contains($lower, 'trimestral') || str_contains($lower, 'quarterly')) return 'quarterly';
        if (str_contains($lower, 'mensual') || str_contains($lower, 'monthly')) return 'monthly';
        return null;
    }

    private function parseDecimal(mixed $val): ?float
    {
        if ($val === null || $val === '' || is_array($val)) {
            return null;
        }
        if (is_int($val) || is_float($val)) {
            return (float) $val;
        }
        $str = trim((string) $val);
        if ($str === '') return null;

        // Quitar símbolo de moneda y espacios
        $str = preg_replace('/[^\d.,\-]/', '', $str);
        if ($str === '' || $str === '-') return null;

        // Detectar formato según separadores presentes:
        //   "2.450.000,00" (colombiano) → 2450000.00
        //   "2,450,000.00" (inglés)     → 2450000.00
        //   "2.450.000"    (col miles)  → 2450000
        //   "2450000.00"   (plano)      → 2450000.00
        $hasComma = str_contains($str, ',');
        $hasDot   = str_contains($str, '.');
        if ($hasComma && $hasDot) {
            // El último separador es el decimal
            $lastComma = strrpos($str, ',');
            $lastDot   = strrpos($str, '.');
            if ($lastComma > $lastDot) {
                // Coma es decimal → quitar puntos, convertir coma a punto
                $str = str_replace('.', '', $str);
                $str = str_replace(',', '.', $str);
            } else {
                // Punto es decimal → quitar comas
                $str = str_replace(',', '', $str);
            }
        } elseif ($hasComma) {
            // Solo coma: si tiene exactamente 2 dígitos finales, coma=decimal;
            // si tiene 3 o más, coma=separador de miles.
            if (preg_match('/,\d{1,2}$/', $str)) {
                $str = str_replace(',', '.', $str);
            } else {
                $str = str_replace(',', '', $str);
            }
        } elseif ($hasDot) {
            // Solo puntos: si hay múltiples puntos (miles latinos) o si el punto
            // tiene exactamente 3 dígitos (separador de miles), quitarlos.
            $dotCount = substr_count($str, '.');
            if ($dotCount > 1) {
                // Ej: "2.450.000" → quitar todos los puntos
                $str = str_replace('.', '', $str);
            } elseif (preg_match('/\.\d{3}(?!\d)/', $str)) {
                // Ej: "450.000" → separador de miles
                $str = str_replace('.', '', $str);
            }
            // else: "450.50" se mantiene como decimal
        }
        return is_numeric($str) ? (float) $str : null;
    }

    private function normalizePolizaStatus(string $status): string
    {
        $lower = mb_strtolower(trim($status));
        if (str_contains($lower, 'vigente') || str_contains($lower, 'activ') || $lower === 'v') {
            return 'active';
        }
        if (str_contains($lower, 'cancel') || str_contains($lower, 'anulad')) {
            return 'cancelled';
        }
        if (str_contains($lower, 'vencid') || str_contains($lower, 'expir')) {
            return 'expired';
        }
        if (str_contains($lower, 'suspend')) {
            return 'suspended';
        }
        if (str_contains($lower, 'prorroga') || str_contains($lower, 'renov')) {
            return 'renewed';
        }
        return $lower ? 'active' : 'pending';
    }

    /**
     * Resuelve qué póliza local linkear con un row de cartera_aseguradoras.
     *  1) Exact match policy_number = policy_number
     *  2) Suffix match: la policy_number local es sufijo del policy_number de cartera
     *     Y el cliente coincide (mismo client_document). Aplica al patrón SURA donde
     *     cartera reporta "081003691040" y la póliza local es "3691040".
     * Devuelve poliza.id o null.
     */
    private function resolveMatchedPolizaId(int $brokerId, string $policyNumber, string $clientDoc): ?int
    {
        $pn = trim($policyNumber);
        if ($pn === '') return null;

        // 1) Exact match
        $exact = \DB::table('polizas')
            ->where('broker_id', $brokerId)
            ->where('policy_number', $pn)
            ->whereNull('deleted_at')
            ->value('id');
        if ($exact) return (int) $exact;

        // 2) Suffix match — requiere cliente conocido para evitar matches falsos
        $doc = trim($clientDoc);
        if ($doc === '' || strlen($pn) < 6) return null;
        $row = \DB::table('polizas')
            ->where('broker_id', $brokerId)
            ->where('client_document', $doc)
            ->whereNull('deleted_at')
            ->whereRaw('CHAR_LENGTH(policy_number) BETWEEN 5 AND ?', [strlen($pn) - 1])
            ->whereRaw('? LIKE CONCAT(\'%\', policy_number)', [$pn])
            ->orderByRaw('CHAR_LENGTH(policy_number) DESC')
            ->limit(1)
            ->value('id');
        return $row ? (int) $row : null;
    }

    /**
     * Resuelve ramo_id para un broker a partir del branch_name de la aseguradora.
     * Si el ramo no existe en el catálogo del broker, lo crea con ese nombre.
     * Aplica alias canónicos para nombres comunes (AUTOMOVILES → Autos Livianos, etc).
     */
    private function resolveOrCreateRamoForBroker(int $brokerId, string $branchName): ?int
    {
        $branchName = trim($branchName);
        if ($branchName === '') {
            return null;
        }

        $b = strtolower($branchName);

        $aliases = [
            'automoviles' => 'Autos Livianos',
            'automovil' => 'Autos Livianos',
            'autos' => 'Autos Livianos',
            'autoplus' => 'Autos Livianos',
            'vida individual' => 'Vida individual',
            'vida grupo' => 'VG voluntario',
            'vida deudores' => 'VG deudores',
            'hogar' => 'Hogar',
            'hogarsura' => 'Hogar',
            'salud' => 'Salud familiar',
            'soat' => 'SOAT',
            'arl' => 'ARL',
            'incendio' => 'Incendio',
            'transporte' => 'Transporte mercancías',
            'cumplimiento' => 'Cumplimiento',
            'responsabilidad civil' => 'Responsabilidad Civil Extracontractual',
            'rce' => 'Responsabilidad Civil Extracontractual',
        ];
        $targetName = $aliases[$b] ?? $branchName;

        $existing = \App\Models\Ramo::where('broker_id', $brokerId)
            ->whereRaw('LOWER(nombre) = ?', [strtolower($targetName)])
            ->first();
        if ($existing) {
            return $existing->id;
        }

        $created = \App\Models\Ramo::create([
            'broker_id' => $brokerId,
            'nombre' => $targetName,
            'subramo' => [],
        ]);
        return $created->id;
    }

    /**
     * Mapea el nombre del ramo (de la aseguradora) al enum 'type' de polizas.
     * Sin esto, todas las pólizas sincronizadas caen al default 'vida' de la DB
     * (aunque sean autos, hogar, salud, etc).
     *
     * Enum válido: 'vida','autos','hogar','empresarial','salud','accidentes','responsabilidad_civil','otros'
     */
    private function mapBranchNameToType(string $branchName, array $detailMeta = []): string
    {
        $b = strtolower(trim($branchName));
        // Códigos SURA 3-digit cuando disponibles (más precisos que el nombre)
        $code = strtolower((string) ($detailMeta['ramo_codigo'] ?? ''));
        if ($code !== '') {
            // 040 = autos, 042 = SOAT, 081 vida individual, 083 vida grupo,
            // 086 exequial (vida), 084 masvida (vida), 028 salud, 030 hogar/incendio,
            // 012 hogarsura (hogar). Mapping conservador.
            $byCode = [
                '040' => 'autos', '041' => 'autos', '042' => 'autos', '043' => 'autos',
                '081' => 'vida',  '082' => 'vida',  '083' => 'vida',  '084' => 'vida',
                '086' => 'vida',  '087' => 'vida',  '088' => 'vida',  '181' => 'vida',
                '028' => 'salud', '029' => 'salud',
                '012' => 'hogar', '030' => 'hogar',
                '050' => 'responsabilidad_civil',
                '060' => 'accidentes', '061' => 'accidentes',
            ];
            if (isset($byCode[$code])) {
                return $byCode[$code];
            }
        }
        if ($b === '') return 'otros';

        // Match por palabra clave en nombre
        if (str_contains($b, 'auto') || str_contains($b, 'vehic') || str_contains($b, 'soat')) {
            return 'autos';
        }
        if (str_contains($b, 'vida') || str_contains($b, 'masvida') || str_contains($b, 'exequ')
            || str_contains($b, 'juvenil') || str_contains($b, 'pension') || str_contains($b, 'surenta')
            || str_contains($b, 'capitaliz')) {
            return 'vida';
        }
        if (str_contains($b, 'hogar') || str_contains($b, 'incendio') || str_contains($b, 'copropied')) {
            return 'hogar';
        }
        if (str_contains($b, 'salud') || str_contains($b, 'medic') || str_contains($b, 'enferm')) {
            return 'salud';
        }
        if (str_contains($b, 'accidente') || str_contains($b, ' ap ') || str_starts_with($b, 'ap ')
            || $b === 'ap' || str_contains($b, 'educacion') || str_contains($b, 'educación')) {
            return 'accidentes';
        }
        if (str_contains($b, 'responsab') || str_contains($b, ' rc ') || str_starts_with($b, 'rc ')
            || $b === 'rc' || str_contains($b, 'rce')) {
            return 'responsabilidad_civil';
        }
        if (str_contains($b, 'empresa') || str_contains($b, 'pyme') || str_contains($b, 'industr')
            || str_contains($b, 'comerc') || str_contains($b, 'bancaseguros')) {
            return 'empresarial';
        }
        return 'otros';
    }

    private function insurerDisplayName(string $code): string
    {
        return match ($code) {
            'sura' => 'Sura',
            'bolivar' => 'Bolívar',
            'hdi' => 'HDI',
            'axa-colpatria' => 'Axa Colpatria',
            'seguros-del-estado' => 'Seguros del Estado',
            'la-equidad' => 'La Equidad',
            'allianz' => 'Allianz',
            default => $code,
        };
    }

    private function extractErrorMessage($response): string
    {
        $body = $response->json();
        $detail = $body['detail'] ?? $body['message'] ?? $body['error'] ?? '';
        if ($detail) {
            $text = is_array($detail) ? json_encode($detail, JSON_UNESCAPED_UNICODE) : (string) $detail;
            return "HTTP {$response->status()}: {$text}";
        }
        return "HTTP {$response->status()}: " . substr($response->body(), 0, 300);
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('services.microservicio.base_url'), '/');
    }

    private function qualitasDateWindows(): array
    {
        $years = max(1, min(10, (int) env('QUALITAS_SYNC_YEARS', 5)));
        $end = now()->startOfDay();
        $limit = now()->subYears($years)->startOfDay();
        $windows = [];

        while ($end->greaterThan($limit)) {
            $start = $end->copy()->subYear()->addDay();
            if ($start->lessThan($limit)) {
                $start = $limit->copy();
            }
            $windows[] = [
                'desde' => $start->format('d/m/Y'),
                'hasta' => $end->format('d/m/Y'),
            ];
            $end = $start->copy()->subDay();
        }

        return $windows;
    }

    private function qualitasRamoName(string $code): string
    {
        $normalized = str_pad(trim($code), 2, '0', STR_PAD_LEFT);
        return match ($normalized) {
            '01' => 'Responsabilidad Civil',
            '02' => 'Transporte',
            '03' => 'Autos',
            '04' => 'SOAT',
            '05' => 'Cumplimiento',
            '06' => 'Todo Riesgo Construcción',
            '07' => 'Manejo',
            '08' => 'Incendio',
            '09' => 'Hogar',
            '10' => 'Accidentes Personales',
            default => $code !== '' ? "Ramo {$code}" : 'Sin ramo',
        };
    }

    private function apiGet(string $endpoint, string $sessionId)
    {
        $url = $this->baseUrl() . $endpoint;

        return Http::acceptJson()
            ->timeout(90)
            ->connectTimeout(15)
            ->withHeaders(['X-Session-Id' => $sessionId])
            ->get($url);
    }

    private function apiGetLong(string $endpoint, string $sessionId, int $timeout = 90)
    {
        $url = $this->baseUrl() . $endpoint;

        return Http::acceptJson()
            ->timeout($timeout)
            ->connectTimeout(15)
            ->withHeaders(['X-Session-Id' => $sessionId])
            ->get($url);
    }

    private function apiGetWithQuery(string $endpoint, string $sessionId, array $query = [])
    {
        $url = $this->baseUrl() . $endpoint;

        return Http::acceptJson()
            ->timeout(90)
            ->connectTimeout(15)
            ->withHeaders(['X-Session-Id' => $sessionId])
            ->get($url, $query);
    }

    private function apiGetLongWithQuery(string $endpoint, string $sessionId, array $query = [], int $timeout = 90)
    {
        $url = $this->baseUrl() . $endpoint;

        return Http::acceptJson()
            ->timeout($timeout)
            ->connectTimeout(15)
            ->withHeaders(['X-Session-Id' => $sessionId])
            ->get($url, $query);
    }

    private function apiPost(string $endpoint, string $sessionId, array $body = [], int $timeout = 60)
    {
        $url = $this->baseUrl() . $endpoint;

        return Http::acceptJson()
            ->timeout($timeout)
            ->connectTimeout(15)
            ->withHeaders(['X-Session-Id' => $sessionId])
            ->post($url, $body);
    }

    // ──────────────────────────────────────────────────────────────────
    // MUNDIAL
    // ──────────────────────────────────────────────────────────────────

    /**
     * Cartera Seguros Mundial vía microservicio GET /mundial/cartera.
     *
     * El portal retorna filas con nivel_proceso=9 (pendientes de pago).
     * Campos clave: poliza, certificado, Tomador, nit_tomador, Ramo,
     * prima_total, ValorTotalPagar, antiguedad, fec_vig_desde, fec_vig_hasta.
     *
     * `antiguedad` usa la notación "1-Entre 0 y 30", "2-Entre 31 y 60", etc.
     * Mapeamos al límite inferior del rango para dias_mora.
     */
    private function fetchCarteraMundial(string $sessionId): array
    {
        $response = $this->apiGetLong('/mundial/cartera', $sessionId, 180);
        if (!$response->ok()) {
            if (in_array($response->status(), [404, 422, 405], true)) {
                return [];
            }
            if ($response->status() === 401) {
                throw new \RuntimeException('Sesión expirada', 401);
            }
            return [];
        }

        $data = $response->json();
        $rows = $data['cartera'] ?? [];
        if (!is_array($rows)) {
            return [];
        }

        // Excel already maps all fields; Python router returns normalized names.
        $items = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $valor          = (float) ($row['valor_pendiente']      ?? 0);
            $primaNeta      = (float) ($row['prima_total']         ?? $row['prima_directa'] ?? $valor);
            $valorIva       = (float) ($row['valor_iva']           ?? 0);
            $gastosEmision  = (float) ($row['valor_gastos_emision'] ?? 0);
            $tasaRunt       = (float) ($row['valor_tasa_runt']     ?? 0);
            $diasMora       = (int)   ($row['dias_mora']            ?? 0);

            $clientDoc = trim((string) ($row['client_document'] ?? ''));
            $docType   = ($clientDoc && strlen($clientDoc) >= 9 && ctype_digit($clientDoc)) ? 'NIT' : 'CC';

            $items[] = [
                'policy_number'          => trim((string) ($row['policy_number'] ?? '')),
                'client_name'            => $row['client_name'] ?? null,
                'client_document'        => $clientDoc ?: null,
                'client_doc_type'        => $docType,
                'ramo'                   => $row['ramo'] ?? null,
                'product_name'           => $row['ramo'] ?? null,
                'prima_total'            => $primaNeta,
                'valor_pendiente'        => $valor,
                'valor_pagado'           => 0.0,
                'valor_iva'              => $valorIva,
                'valor_gastos_emision'   => $gastosEmision,
                'valor_tasa_runt'        => $tasaRunt,
                'bonificacion'           => 0,
                'dias_mora'              => $diasMora,
                'rango_mora'             => CarteraAseguradora::calcRangoMora($diasMora),
                'fecha_inicio_vigencia'  => $row['fecha_inicio_vigencia'] ?? null,
                'fecha_expedicion'       => $row['fecha_expedicion']      ?? null,
                'fecha_vencimiento'      => $row['fecha_vencimiento']     ?? null,
                'numero_recibo'          => $row['numero_recibo'] ?? null,
                'source_endpoint'        => '/mundial/cartera',
                'raw_data'               => $row,
                // Contact fields parsed by Python
                '_client_phone'          => $row['client_phone']  ?? null,
                '_client_mobile'         => $row['client_mobile'] ?? null,
                '_client_email'          => $row['client_email']  ?? null,
            ];
        }

        return $items;
    }

    /**
     * Importa clientes y pólizas a partir de los ítems de cartera de Mundial.
     * Se llama justo después de que syncCartera inserta las filas de cartera.
     *
     * Estrategia:
     *  - Clientes: upsert por document_number, una sola vez por cliente único.
     *  - Pólizas:  upsert por policy_number; cuando la misma póliza aparece en
     *    múltiples endosos, se usa el endoso con mayor valor absoluto como referencia
     *    para las fechas de vigencia y el monto.
     */
    private function syncClientesPolizasFromCarteraMundial(InsurerConnection $conn, array $allItems): array
    {
        $brokerId    = $conn->broker_id;
        $insurerName = $this->insurerDisplayName($conn->insurer_code);

        $aseguradoraId = \App\Models\Aseguradora::where('broker_id', $brokerId)
            ->whereRaw('LOWER(nombre) = ?', [strtolower($insurerName)])
            ->value('id');

        $clientsCreated = 0;
        $clientsUpdated = 0;
        $polizasCreated = 0;
        $polizasUpdated = 0;

        // ── 1. Deduplicate: best row per poliza ──
        // Prefer positive-valor rows; among same sign, take highest absolute value.
        // This ensures that policies where ALL rows are credit notes (valor < 0)
        // are still represented — they'll be created with payment_status = 'paid'.
        $byPoliza = [];
        foreach ($allItems as $item) {
            $polNum = trim((string) ($item['policy_number'] ?? ''));
            if ($polNum === '') {
                continue;
            }
            $valor = (float) ($item['valor_pendiente'] ?? 0);
            $abs   = abs($valor);
            if (!isset($byPoliza[$polNum])) {
                $byPoliza[$polNum] = array_merge($item, ['_abs' => $abs]);
            } else {
                $existingValor = (float) ($byPoliza[$polNum]['valor_pendiente'] ?? 0);
                // Positive row always beats a negative row
                if ($valor > 0 && $existingValor <= 0) {
                    $byPoliza[$polNum] = array_merge($item, ['_abs' => $abs]);
                } elseif (($valor > 0) === ($existingValor > 0) && $abs > $byPoliza[$polNum]['_abs']) {
                    $byPoliza[$polNum] = array_merge($item, ['_abs' => $abs]);
                }
            }
        }

        // ── 2. Deduplicate clients by document ──
        $seenDocs = [];

        foreach ($byPoliza as $polNum => $item) {
            $clientDoc  = trim((string) ($item['client_document'] ?? ''));
            $clientName = trim((string) ($item['client_name']     ?? ''));
            $docType    = $item['client_doc_type'] ?? 'CC';

            // ── Sync cliente ──────────────────────────────────────────────
            $clientId = null;
            if ($clientDoc !== '' && !isset($seenDocs[$clientDoc])) {
                $seenDocs[$clientDoc] = true;
                $phone  = $item['_client_phone']  ?? null;
                $mobile = $item['_client_mobile'] ?? null;
                $email  = $item['_client_email']  ?? null;

                $clientResult = $this->syncClienteFromPoliza($conn, [
                    'client_name'            => $clientName,
                    'policy_holder_name'     => $clientName,
                    'client_document'        => $clientDoc,
                    'policy_holder_document' => $clientDoc,
                    'policy_holder_doc_type' => $docType,
                    'policy_holder_phone'    => $phone ?? $mobile,
                    'policy_holder_email'    => $email,
                ]);

                // Patch contact data if we have better info than the default placeholder
                $client = $clientResult['client'];
                if ($client && ($phone || $mobile || $email)) {
                    $patch = [];
                    if ($phone  && empty($client->phone))        $patch['phone']        = $phone;
                    if ($mobile && empty($client->mobile_phone)) $patch['mobile_phone'] = $mobile;
                    if ($email  && (empty($client->email) || str_ends_with($client->email, '@sinregistro.com'))) {
                        $patch['email'] = strtolower($email);
                    }
                    if ($patch) {
                        $client->update($patch);
                    }
                }

                if (($clientResult['status'] ?? null) === 'created') {
                    $clientsCreated++;
                } elseif (($clientResult['status'] ?? null) === 'updated') {
                    $clientsUpdated++;
                }
                $clientId = $client?->id;
            } elseif ($clientDoc !== '') {
                $clientId = Cliente::withTrashed()
                    ->where('broker_id', $brokerId)
                    ->where('document_number', $clientDoc)
                    ->value('id');
            }

            // ── Sync póliza ───────────────────────────────────────────────
            if ($polNum === '') {
                continue;
            }

            try {
                $valorPendiente = (float) ($item['valor_pendiente'] ?? 0);
                $ramoName = trim((string) ($item['ramo'] ?? ''));
                $ramoId   = $ramoName ? $this->resolveOrCreateRamoForBroker($brokerId, $ramoName) : null;

                $hash = md5(json_encode([
                    'policy_number' => $polNum,
                    'client_doc'    => $clientDoc,
                    'start_date'    => $item['fecha_inicio_vigencia'] ?? null,
                    'end_date'      => $item['fecha_vencimiento']     ?? null,
                    'premium'       => $valorPendiente,
                ]));

                $existing = Poliza::withTrashed()
                    ->where('broker_id', $brokerId)
                    ->where('policy_number', $polNum)
                    ->first();

                // When all cartera rows are credit notes (val <= 0) use prima_total
                // for the premium and mark the policy as paid. Use abs() because
                // credit-note rows have negative prima_total values too.
                $rawPrima      = (float) ($item['prima_total'] ?? 0);
                $premiumAmount = abs($rawPrima) ?: abs($valorPendiente);
                $paymentStatus = $valorPendiente > 0 ? 'pending' : 'paid';

                $polizaData = [
                    'broker_id'         => $brokerId,
                    'policy_number'     => $polNum,
                    'client_id'         => $clientId,
                    'client_name'       => $clientName ?: null,
                    'client_document'   => $clientDoc  ?: null,
                    'insurance_company' => $insurerName,
                    'aseguradora_id'    => $aseguradoraId,
                    'ramo_id'           => $ramoId,
                    'product_name'      => $ramoName ?: null,
                    'issue_date'        => $item['fecha_expedicion']     ?? null,
                    'start_date'        => $item['fecha_inicio_vigencia'] ?? null,
                    'end_date'          => $item['fecha_vencimiento']    ?? null,
                    'premium_amount'    => $premiumAmount,
                    'total_amount'      => $valorPendiente > 0 ? $valorPendiente : $premiumAmount,
                    'vat_amount'        => (float) ($item['valor_iva']           ?? 0),
                    'gastos_adicionales'=> (float) ($item['valor_gastos_emision'] ?? 0) + (float) ($item['valor_tasa_runt'] ?? 0),
                    'status'            => 'active',
                    'payment_status'    => $paymentStatus,
                    'type'              => $this->mapBranchNameToType($ramoName),
                    'custom_fields'     => [
                        '_sync_hash'          => $hash,
                        '_sync_source'        => 'mundial_sync',
                        '_sync_at'            => now()->toIso8601String(),
                        'valor_iva'           => (float) ($item['valor_iva']           ?? 0),
                        'valor_gastos_emision'=> (float) ($item['valor_gastos_emision'] ?? 0),
                        'valor_tasa_runt'     => (float) ($item['valor_tasa_runt']     ?? 0),
                    ],
                ];

                if ($existing) {
                    if ($existing->trashed()) {
                        $existing->restore();
                    }
                    $existingHash = $existing->custom_fields['_sync_hash'] ?? null;
                    if ($existingHash !== $hash) {
                        $updates = array_diff_key($polizaData, ['broker_id' => 1, 'policy_number' => 1]);
                        $updates['custom_fields'] = array_merge($existing->custom_fields ?? [], $polizaData['custom_fields']);
                        $existing->update(array_filter($updates, fn($v) => $v !== null && $v !== ''));
                        $polizasUpdated++;
                    }
                } else {
                    Poliza::create($polizaData);
                    $polizasCreated++;
                }
            } catch (\Throwable $e) {
                Log::warning('[MUNDIAL] Error upsert póliza', ['poliza' => $polNum, 'error' => $e->getMessage()]);
            }
        }

        return [
            'clientes_created' => $clientsCreated,
            'clientes_updated' => $clientsUpdated,
            'polizas_created'  => $polizasCreated,
            'polizas_updated'  => $polizasUpdated,
        ];
    }
}
