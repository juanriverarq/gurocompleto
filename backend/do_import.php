<?php
// Script para ejecutar la importación completa y debuggear

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\Cliente;
use App\Models\Vendedor;
use App\Models\Poliza;
use App\Models\Aseguradora;
use App\Models\Ramo;

$brokerId = 32;

echo "=== IMPORTACIÓN DIRECTA ===\n\n";

// ========== 1. IMPORTAR CLIENTES ==========
echo "1. IMPORTANDO CLIENTES...\n";

$clientesFile = '/Users/mac/Documents/GUROFINAL/plantilla_clientes.csv';
$clientesData = array_map('str_getcsv', file($clientesFile));
$clientesHeaders = array_shift($clientesData);

// Mapeo de columnas CSV -> campos BD (COMPLETO según el CSV)
$clientesMapping = [
    'tipo_cliente' => 'client_type',
    'nombre' => 'first_name',
    'apellidos' => 'last_name',
    'tipo_documento' => 'document_type',
    'documento' => 'document_number',
    'email' => 'email',
    'telefono' => 'phone',
    'celular' => 'mobile_phone',
    'fecha_nacimiento' => 'birth_date',
    'genero' => 'gender',
    'estado_civil' => 'marital_status',
    'direccion' => 'address',
    'Ciudad' => 'city',
    'departamento' => 'department',
    'pais' => 'country',
    'codigo_postal' => 'postal_code',
    'ocupacion' => 'occupation',
    'empresa' => 'company',
    'razon_social' => 'company_legal_name',
    'ingresos_mensuales' => 'monthly_income',
    'contacto_emergencia_nombre' => 'emergency_contact_name',
    'contacto_emergencia_telefono' => 'emergency_contact_phone',
    'contacto_emergencia_parentesco' => 'emergency_contact_relationship',
    'estado' => 'status',
    'prioridad' => 'priority',
    'origen' => 'source',
    'notas' => 'notes',
];

// Índice para relacionar después: valor_columna -> id_bd
$clientesIndex = [];
$insertedClientes = 0;
$failedClientes = 0;

// Encontrar índice de cada columna
$colIndices = [];
foreach ($clientesHeaders as $idx => $header) {
    $colIndices[trim($header)] = $idx;
}

$idRegistroIdx = $colIndices['ID de registro'] ?? null;

foreach ($clientesData as $i => $row) {
    try {
        $payload = ['broker_id' => $brokerId];
        
        foreach ($clientesMapping as $csvCol => $dbField) {
            $colIdx = $colIndices[$csvCol] ?? null;
            if ($colIdx !== null && isset($row[$colIdx])) {
                $value = trim($row[$colIdx]);
                if ($value !== '') {
                    $payload[$dbField] = $value;
                }
            }
        }
        
        // Mapear client_type - solo si tiene valor
        if (!empty($payload['client_type'])) {
            $tipoMap = [
                'natural' => 'persona', 'persona natural' => 'persona', 'persona' => 'persona',
                'juridica' => 'empresa', 'juridico' => 'empresa', 'empresa' => 'empresa',
            ];
            $tipoLower = strtolower($payload['client_type']);
            $payload['client_type'] = $tipoMap[$tipoLower] ?? null;
        }
        
        // Mapear status - solo si tiene valor
        if (!empty($payload['status'])) {
            $statusMap = [
                'activo' => 'active', 'activa' => 'active', 'active' => 'active',
                'inactivo' => 'inactive', 'inactiva' => 'inactive', 'inactive' => 'inactive',
                'prospecto' => 'prospect', 'prospect' => 'prospect',
                'bloqueado' => 'blocked', 'blocked' => 'blocked',
            ];
            $statusLower = strtolower($payload['status']);
            $payload['status'] = $statusMap[$statusLower] ?? null;
        }
        
        // Mapear genero - solo si tiene valor
        if (!empty($payload['gender'])) {
            $generoMap = [
                'm' => 'M', 'masculino' => 'M', 'hombre' => 'M', 'male' => 'M',
                'f' => 'F', 'femenino' => 'F', 'mujer' => 'F', 'female' => 'F',
                'o' => 'O', 'otro' => 'O', 'other' => 'O',
            ];
            $generoLower = strtolower($payload['gender']);
            $payload['gender'] = $generoMap[$generoLower] ?? null;
        }
        
        // Mapear priority - solo si tiene valor
        if (!empty($payload['priority'])) {
            $prioMap = [
                'alta' => 'high', 'high' => 'high',
                'media' => 'medium', 'medium' => 'medium',
                'baja' => 'low', 'low' => 'low',
            ];
            $prioLower = strtolower($payload['priority']);
            $payload['priority'] = $prioMap[$prioLower] ?? null;
        }
        
        $cliente = Cliente::create($payload);
        $insertedClientes++;
        
        // Guardar en índice usando ID de registro
        if ($idRegistroIdx !== null && isset($row[$idRegistroIdx])) {
            $idRegistro = trim($row[$idRegistroIdx]);
            if ($idRegistro !== '') {
                $clientesIndex[$idRegistro] = $cliente->id;
            }
        }
        
        // También guardar por documento
        if (!empty($payload['document_number'])) {
            $clientesIndex[$payload['document_number']] = $cliente->id;
        }
        
    } catch (\Throwable $e) {
        $failedClientes++;
        if ($failedClientes <= 3) {
            echo "  Error fila " . ($i+2) . ": " . $e->getMessage() . "\n";
        }
    }
}

echo "  Insertados: {$insertedClientes}\n";
echo "  Fallidos: {$failedClientes}\n";
echo "  Índice creado con " . count($clientesIndex) . " entradas\n";

// ========== 2. IMPORTAR VENDEDORES ==========
echo "\n2. IMPORTANDO VENDEDORES...\n";

$vendedoresFile = '/Users/mac/Documents/GUROFINAL/plantilla_vendedores.csv';
$vendedoresData = array_map('str_getcsv', file($vendedoresFile));
$vendedoresHeaders = array_shift($vendedoresData);

// Mapeo COMPLETO de vendedores
$vendedoresMapping = [
    'nombres' => 'nombres',
    'tipo_documento' => 'tipo_documento',
    'numero_documento' => 'numero_documento',
    'telefono' => 'telefono',
    'celular' => 'celular',
    'email' => 'email',
    'cuenta_bancaria' => 'cuenta_bancaria',
    'tipo_persona' => 'tipo_persona',
    'tipo_retencion' => 'tipo_retencion',
    'es_agencia' => 'es_agencia',
    'porcentaje_comision' => 'porcentaje_comision',
    'calcular_comision_sobre' => 'calcular_comision_sobre',
    'porcentaje_retencion' => 'porcentaje_retencion',
    'porcentaje_retencion_ica' => 'porcentaje_retencion_ica',
    'porcentaje_iva' => 'porcentaje_iva',
    'porcentaje_retencion_iva' => 'porcentaje_retencion_iva',
    'fecha_vinculacion' => 'fecha_vinculacion',
];

$vendedoresIndex = [];
$insertedVendedores = 0;
$failedVendedores = 0;

$colIndicesV = [];
foreach ($vendedoresHeaders as $idx => $header) {
    $colIndicesV[trim($header)] = $idx;
}

$idRegistroVIdx = $colIndicesV['ID de registro'] ?? null;

foreach ($vendedoresData as $i => $row) {
    try {
        $payload = ['broker_id' => $brokerId];
        
        foreach ($vendedoresMapping as $csvCol => $dbField) {
            $colIdx = $colIndicesV[$csvCol] ?? null;
            if ($colIdx !== null && isset($row[$colIdx])) {
                $value = trim($row[$colIdx]);
                if ($value !== '') {
                    $payload[$dbField] = $value;
                }
            }
        }
        
        // Mapear tipo_persona - solo si tiene valor
        if (!empty($payload['tipo_persona'])) {
            $tipoLower = strtolower($payload['tipo_persona']);
            // Buscar coincidencia parcial - primero juridica para evitar falso positivo con "natural"
            if (strpos($tipoLower, 'juridica') !== false || strpos($tipoLower, 'jurídica') !== false) {
                $payload['tipo_persona'] = 'juridica';
            } elseif (strpos($tipoLower, 'natural') !== false) {
                $payload['tipo_persona'] = 'natural';
            } else {
                $payload['tipo_persona'] = 'natural'; // default
            }
        }
        
        // Mapear calcular_comision_sobre - solo si tiene valor
        if (!empty($payload['calcular_comision_sobre'])) {
            $comisionMap = [
                'prima neta' => 'prima_neta', 'prima_neta' => 'prima_neta', 'prima' => 'prima_neta',
                'agencia' => 'agencia',
            ];
            $comisionLower = strtolower($payload['calcular_comision_sobre']);
            $payload['calcular_comision_sobre'] = $comisionMap[$comisionLower] ?? null;
        }
        
        // Porcentajes - normalizar
        $pctFields = ['porcentaje_comision', 'porcentaje_retencion', 'porcentaje_retencion_ica', 'porcentaje_iva', 'porcentaje_retencion_iva'];
        foreach ($pctFields as $pf) {
            if (isset($payload[$pf]) && $payload[$pf] !== '') {
                $payload[$pf] = min(100, max(0, floatval($payload[$pf])));
            }
        }
        
        // es_agencia - convertir a booleano
        if (isset($payload['es_agencia'])) {
            $val = strtolower(trim($payload['es_agencia']));
            $payload['es_agencia'] = in_array($val, ['1', 'true', 'si', 'sí', 'yes']);
        }
        
        $vendedor = Vendedor::create($payload);
        $insertedVendedores++;
        
        // Guardar en índice usando ID de registro
        if ($idRegistroVIdx !== null && isset($row[$idRegistroVIdx])) {
            $idRegistro = trim($row[$idRegistroVIdx]);
            if ($idRegistro !== '') {
                $vendedoresIndex[$idRegistro] = $vendedor->id;
            }
        }
        
    } catch (\Throwable $e) {
        $failedVendedores++;
        if ($failedVendedores <= 3) {
            echo "  Error fila " . ($i+2) . ": " . $e->getMessage() . "\n";
        }
    }
}

echo "  Insertados: {$insertedVendedores}\n";
echo "  Fallidos: {$failedVendedores}\n";
echo "  Índice creado con " . count($vendedoresIndex) . " entradas\n";

// ========== 3. IMPORTAR PÓLIZAS ==========
echo "\n3. IMPORTANDO PÓLIZAS...\n";

$polizasFile = '/Users/mac/Documents/GUROFINAL/plantilla_polizas.csv';
$polizasData = array_map('str_getcsv', file($polizasFile));
$polizasHeaders = array_shift($polizasData);

$colIndicesP = [];
foreach ($polizasHeaders as $idx => $header) {
    $colIndicesP[trim($header)] = $idx;
}

// Crear índices de aseguradoras y ramos únicos del CSV
$aseguradoraIdx = $colIndicesP['aseguradora'] ?? null;
$ramoIdx = $colIndicesP['ramo'] ?? null;

$aseguradorasCache = []; // nombre => id
$ramosCache = []; // nombre => id

// Pre-crear aseguradoras únicas
if ($aseguradoraIdx !== null) {
    $aseguradorasUnicas = [];
    foreach ($polizasData as $row) {
        $nombre = trim($row[$aseguradoraIdx] ?? '');
        if ($nombre !== '' && !isset($aseguradorasUnicas[$nombre])) {
            $aseguradorasUnicas[$nombre] = true;
        }
    }
    
    foreach (array_keys($aseguradorasUnicas) as $nombre) {
        $aseg = Aseguradora::where('broker_id', $brokerId)->where('nombre', $nombre)->first();
        if (!$aseg) {
            $aseg = Aseguradora::create([
                'broker_id' => $brokerId,
                'nombre' => $nombre,
                'activo' => true,
            ]);
        }
        $aseguradorasCache[$nombre] = $aseg->id;
    }
    echo "  Aseguradoras creadas/encontradas: " . count($aseguradorasCache) . "\n";
}

// Pre-crear ramos únicos
if ($ramoIdx !== null) {
    $ramosUnicos = [];
    foreach ($polizasData as $row) {
        $nombre = trim($row[$ramoIdx] ?? '');
        if ($nombre !== '' && !isset($ramosUnicos[$nombre])) {
            $ramosUnicos[$nombre] = true;
        }
    }
    
    foreach (array_keys($ramosUnicos) as $nombre) {
        $ramo = Ramo::where('broker_id', $brokerId)->where('nombre', $nombre)->first();
        if (!$ramo) {
            $ramo = Ramo::create([
                'broker_id' => $brokerId,
                'nombre' => $nombre,
                'activo' => true,
            ]);
        }
        $ramosCache[$nombre] = $ramo->id;
    }
    echo "  Ramos creados/encontrados: " . count($ramosCache) . "\n";
}

$tomadorIdIdx = $colIndicesP['tomador.id'] ?? null;
$asesorIdIdx = $colIndicesP['Asesor.id'] ?? null;
$asesor2IdIdx = $colIndicesP['Asesor 2.id'] ?? null;

echo "  Índices de columnas de relación:\n";
echo "    tomador.id: " . ($tomadorIdIdx ?? 'NO ENCONTRADO') . "\n";
echo "    Asesor.id: " . ($asesorIdIdx ?? 'NO ENCONTRADO') . "\n";
echo "    Asesor 2.id: " . ($asesor2IdIdx ?? 'NO ENCONTRADO') . "\n";

// Mapeo COMPLETO de pólizas según el CSV
$polizasMapping = [
    // Identificación
    'numero_poliza' => 'policy_number',
    'numero_interno' => 'internal_number',
    'tipo' => 'type',
    // Aseguradora y producto
    'aseguradora' => 'insurance_company',
    // 'ramo' no tiene campo directo, se usa ramo_id
    'subramo' => 'sub_branch',
    'producto' => 'product_name',
    'descripcion' => 'description',
    // Cliente
    'cliente_documento' => 'client_document',
    'cliente_nombre' => 'client_name',
    'cliente_email' => 'client_email',
    // Vendedor
    'vendedor_email' => 'seller_email',
    'vendedor_nombre' => 'seller_name',
    'vendedor2_nombre' => 'seller_name_2',
    // Fechas
    'fecha_emision' => 'issue_date',
    'fecha_inicio' => 'start_date',
    'fecha_fin' => 'end_date',
    'fecha_vencimiento_pago' => 'payment_due_date',
    'fecha_renovacion' => 'renewal_date',
    'fecha_recepcion' => 'reception_date',
    // Valores monetarios
    'prima_neta' => 'premium_amount',
    'valor_asegurado' => 'insured_amount',
    'deducible' => 'deductible',
    'total' => 'total_amount',
    // Comisiones
    'porcentaje_comision' => 'commission_percentage',
    'monto_comision' => 'commission_amount',
    'porcentaje_iva' => 'vat_percentage',
    'monto_iva' => 'vat_amount',
    'gastos_adicionales' => 'gastos_adicionales',
    // Pago
    'frecuencia_pago' => 'payment_frequency',
    'medio_pago' => 'payment_method',
    'banco' => 'bank',
    'pago_semestral' => 'biannual_payment',
    'numero_cuotas' => 'installments_count',
    'ultimos_4_tarjeta' => 'card_last4',
    'numero_cheque' => 'cheque_number',
    'plazo_convenio' => 'agreement_term',
    'numero_cuenta_debito' => 'debit_account_number',
    // Estado
    'estado' => 'status',
    'estado_pago' => 'payment_status',
    'notas_estado' => 'status_notes',
    'motivo' => 'reason',
    // Beneficiario
    'beneficiario_nombre' => 'beneficiary_name',
    'beneficiario_documento' => 'beneficiary_document',
    'beneficiario_parentesco' => 'beneficiary_relationship',
    'beneficiario_telefono' => 'beneficiary_phone',
    // Tomador
    'tomador_nombre' => 'policy_holder_name',
    'tomador_documento' => 'policy_holder_document',
    // Asegurado
    'asegurado_nombre' => 'insured_name',
    'asegurado_documento' => 'insured_document',
    // Vehículo
    'placa_vehiculo' => 'vehicle_plate',
    // Renovación
    'es_renovable' => 'auto_renewal',
    'dias_aviso_renovacion' => 'renewal_days_notice',
    // Otros campos financieros
    'pri_a_pre' => 'pri_a_pre',
    'participacion' => 'participation',
    'co_corretaje' => 'co_brokerage',
    'comision_agencia' => 'agency_commission',
    'porcentaje_retencion' => 'withholding_percentage',
    'porcentaje_reteiva' => 'reteiva_percentage',
    'beneficiario_en_giro' => 'beneficiary_in_transfer',
    // Notas y enlaces
    'notas' => 'notes',
    'url_externa' => 'external_link',
];

$insertedPolizas = 0;
$updatedPolizas = 0;
$failedPolizas = 0;
$relacionadosCliente = 0;
$relacionadosVendedor1 = 0;
$relacionadosVendedor2 = 0;

foreach ($polizasData as $i => $row) {
    try {
        $payload = ['broker_id' => $brokerId];
        
        foreach ($polizasMapping as $csvCol => $dbField) {
            $colIdx = $colIndicesP[$csvCol] ?? null;
            if ($colIdx !== null && isset($row[$colIdx])) {
                $value = trim($row[$colIdx]);
                if ($value !== '') {
                    $payload[$dbField] = $value;
                }
            }
        }
        
        // Mapear status - solo si tiene valor
        if (!empty($payload['status'])) {
            $statusMap = [
                'vigente' => 'active', 'activa' => 'active', 'activo' => 'active', 'active' => 'active',
                'vencida' => 'expired', 'expirada' => 'expired', 'expired' => 'expired',
                'cancelada' => 'cancelled', 'anulada' => 'cancelled', 'cancelled' => 'cancelled',
                'pendiente' => 'pending', 'pending' => 'pending',
                'cotizada' => 'quoted', 'quoted' => 'quoted',
                'emitida' => 'issued', 'issued' => 'issued',
                'renovada' => 'renewed', 'renewed' => 'renewed',
                'no renovada' => 'not_renewed', 'not_renewed' => 'not_renewed',
            ];
            $statusLower = strtolower($payload['status']);
            $payload['status'] = $statusMap[$statusLower] ?? null;
        }
        
        // Mapear type - solo si tiene valor
        if (!empty($payload['type'])) {
            $typeMap = [
                'vida' => 'vida', 'life' => 'vida',
                'autos' => 'autos', 'auto' => 'autos', 'vehiculo' => 'autos', 'carro' => 'autos',
                'hogar' => 'hogar', 'home' => 'hogar', 'casa' => 'hogar',
                'empresarial' => 'empresarial', 'empresa' => 'empresarial', 'business' => 'empresarial',
                'salud' => 'salud', 'health' => 'salud',
                'accidentes' => 'accidentes', 'accident' => 'accidentes',
                'responsabilidad_civil' => 'responsabilidad_civil', 'rc' => 'responsabilidad_civil',
                'otros' => 'otros', 'other' => 'otros', 'otro' => 'otros',
            ];
            $typeLower = strtolower($payload['type']);
            $payload['type'] = $typeMap[$typeLower] ?? null;
        }
        
        // Mapear payment_frequency - solo si tiene valor
        if (!empty($payload['payment_frequency'])) {
            $freqMap = [
                'mensual' => 'monthly', 'monthly' => 'monthly', 'mes' => 'monthly',
                'trimestral' => 'quarterly', 'quarterly' => 'quarterly',
                'semestral' => 'biannual', 'biannual' => 'biannual',
                'anual' => 'annual', 'annual' => 'annual', 'año' => 'annual',
            ];
            $freqLower = strtolower($payload['payment_frequency']);
            $payload['payment_frequency'] = $freqMap[$freqLower] ?? null;
        }
        
        // Mapear payment_method - solo si tiene valor
        if (!empty($payload['payment_method'])) {
            $methodMap = [
                'efectivo' => 'cash', 'cash' => 'cash',
                'transferencia' => 'transfer', 'transfer' => 'transfer',
                'cheque' => 'check', 'check' => 'check',
                'tarjeta' => 'card', 'card' => 'card', 'débito automático' => 'card', 'debito automatico' => 'card',
                'financiamiento' => 'financing', 'financing' => 'financing', 'financiado' => 'financing',
            ];
            $methodLower = strtolower($payload['payment_method']);
            $payload['payment_method'] = $methodMap[$methodLower] ?? null;
        }
        
        // Mapear payment_status - solo si tiene valor
        if (!empty($payload['payment_status'])) {
            $payStatusMap = [
                'pagado' => 'paid', 'paid' => 'paid',
                'pendiente' => 'pending', 'pending' => 'pending',
                'vencido' => 'overdue', 'overdue' => 'overdue', 'mora' => 'overdue',
                'cancelado' => 'cancelled', 'cancelled' => 'cancelled',
            ];
            $payStatusLower = strtolower($payload['payment_status']);
            $payload['payment_status'] = $payStatusMap[$payStatusLower] ?? null;
        }
        
        // Porcentaje comisión
        if (isset($payload['commission_percentage'])) {
            $payload['commission_percentage'] = min(100, max(0, floatval($payload['commission_percentage'])));
        }
        
        // auto_renewal - convertir a booleano
        if (isset($payload['auto_renewal'])) {
            $val = strtolower(trim($payload['auto_renewal']));
            $payload['auto_renewal'] = in_array($val, ['1', 'true', 'si', 'sí', 'yes']) ? 1 : 0;
        }
        
        // ========== ASIGNAR ASEGURADORA ID ==========
        if ($aseguradoraIdx !== null && isset($row[$aseguradoraIdx])) {
            $asegNombre = trim($row[$aseguradoraIdx]);
            if ($asegNombre !== '' && isset($aseguradorasCache[$asegNombre])) {
                $payload['aseguradora_id'] = $aseguradorasCache[$asegNombre];
            }
        }
        
        // ========== ASIGNAR RAMO ID ==========
        if ($ramoIdx !== null && isset($row[$ramoIdx])) {
            $ramoNombre = trim($row[$ramoIdx]);
            if ($ramoNombre !== '' && isset($ramosCache[$ramoNombre])) {
                $payload['ramo_id'] = $ramosCache[$ramoNombre];
            }
        }
        
        // ========== RELACIONAR CLIENTE ==========
        if ($tomadorIdIdx !== null && isset($row[$tomadorIdIdx])) {
            $tomadorId = trim($row[$tomadorIdIdx]);
            if ($tomadorId !== '' && isset($clientesIndex[$tomadorId])) {
                $clienteId = $clientesIndex[$tomadorId];
                $cliente = Cliente::find($clienteId);
                if ($cliente) {
                    $payload['client_id'] = $cliente->id;
                    $payload['client_name'] = trim($cliente->first_name . ' ' . $cliente->last_name);
                    $payload['client_document'] = $cliente->document_number ?? '';
                    $relacionadosCliente++;
                }
            }
        }
        
        // ========== RELACIONAR VENDEDOR 1 ==========
        if ($asesorIdIdx !== null && isset($row[$asesorIdIdx])) {
            $asesorId = trim($row[$asesorIdIdx]);
            if ($asesorId !== '' && isset($vendedoresIndex[$asesorId])) {
                $vendedorId = $vendedoresIndex[$asesorId];
                $vendedor = Vendedor::find($vendedorId);
                if ($vendedor) {
                    $payload['seller_id'] = $vendedor->id;
                    $payload['seller_name'] = $vendedor->nombres ?? '';
                    $relacionadosVendedor1++;
                }
            }
        }
        
        // ========== RELACIONAR VENDEDOR 2 ==========
        if ($asesor2IdIdx !== null && isset($row[$asesor2IdIdx])) {
            $asesor2Id = trim($row[$asesor2IdIdx]);
            if ($asesor2Id !== '' && isset($vendedoresIndex[$asesor2Id])) {
                $vendedor2Id = $vendedoresIndex[$asesor2Id];
                $vendedor2 = Vendedor::find($vendedor2Id);
                if ($vendedor2) {
                    $payload['seller_id_2'] = $vendedor2->id;
                    $payload['seller_name_2'] = $vendedor2->nombres ?? '';
                    $relacionadosVendedor2++;
                }
            }
        }
        
        // Buscar póliza existente
        $existing = Poliza::where('policy_number', $payload['policy_number'])
            ->where('broker_id', $brokerId)
            ->first();
        
        if ($existing) {
            $existing->fill($payload);
            $existing->save();
            $updatedPolizas++;
        } else {
            Poliza::create($payload);
            $insertedPolizas++;
        }
        
    } catch (\Throwable $e) {
        $failedPolizas++;
        if ($failedPolizas <= 5) {
            echo "  Error fila " . ($i+2) . ": " . $e->getMessage() . "\n";
        }
    }
}

echo "  Insertadas: {$insertedPolizas}\n";
echo "  Actualizadas: {$updatedPolizas}\n";
echo "  Fallidas: {$failedPolizas}\n";
echo "\n  RELACIONES ESTABLECIDAS:\n";
echo "    Clientes relacionados: {$relacionadosCliente}\n";
echo "    Vendedor 1 relacionados: {$relacionadosVendedor1}\n";
echo "    Vendedor 2 relacionados: {$relacionadosVendedor2}\n";

echo "\n=== IMPORTACIÓN COMPLETADA ===\n";

// Verificar en BD
echo "\n=== VERIFICACIÓN EN BD ===\n";
$totalClientes = Cliente::where('broker_id', $brokerId)->count();
$totalVendedores = Vendedor::where('broker_id', $brokerId)->count();
$totalPolizas = Poliza::where('broker_id', $brokerId)->count();
$polizasConCliente = Poliza::where('broker_id', $brokerId)->whereNotNull('client_id')->count();
$polizasConVendedor = Poliza::where('broker_id', $brokerId)->whereNotNull('seller_id')->count();

echo "Total clientes: {$totalClientes}\n";
echo "Total vendedores: {$totalVendedores}\n";
echo "Total pólizas: {$totalPolizas}\n";
echo "Pólizas con cliente asignado: {$polizasConCliente}\n";
echo "Pólizas con vendedor asignado: {$polizasConVendedor}\n";
