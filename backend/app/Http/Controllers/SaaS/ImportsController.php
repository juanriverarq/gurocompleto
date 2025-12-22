<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Traits\RequiresAuth;
use Symfony\Component\HttpFoundation\StreamedResponse;
use App\Models\ImportJob;

class ImportsController extends Controller
{
    use RequiresAuth;

    /**
     * Configuración de entidades con mapeo de campos y modelos
     */
    private function getEntitiesMeta(): array
    {
        return [
            'aseguradoras' => [
                'display_name' => 'Aseguradoras',
                'model' => \App\Models\Aseguradora::class,
                'has_broker_id' => true,
                'unique_keys' => ['nombre', 'nit'],
                'required_fields' => ['nombre'],
                'date_fields' => [],
                'number_fields' => ['retencion', 'iva', 'retencion_iva'],
                'boolean_fields' => [],
                'fields' => [
                    'nombre', 'nit', 'email', 'telefono', 'direccion',
                    'cuenta_bancaria', 'link_pago', 'codigo_intermediario',
                    'retencion', 'iva', 'retencion_iva'
                ],
                // Mapeo de campos del CSV a campos del modelo
                'field_mapping' => [
                    'nit' => 'cuit',
                ],
                'defaults' => [
                    'retencion' => 0,
                    'iva' => 0,
                    'retencion_iva' => 0,
                ],
            ],
            'ramos' => [
                'display_name' => 'Ramos',
                'model' => \App\Models\Ramo::class,
                'has_broker_id' => true,
                'unique_keys' => ['nombre'],
                'required_fields' => ['nombre'],
                'date_fields' => [],
                'number_fields' => [],
                'boolean_fields' => ['calcular_iva_pri_a_pre', 'vista_mapa_oportunidad'],
                'fields' => ['nombre', 'subramo', 'calcular_iva_pri_a_pre', 'vista_mapa_oportunidad'],
                'field_mapping' => [
                    'descripcion' => 'subramo',
                ],
                'defaults' => [],
            ],
            'vendedores' => [
                'display_name' => 'Vendedores/Asesores',
                'model' => \App\Models\Vendedor::class,
                'has_broker_id' => true,
                'unique_keys' => ['email', 'numero_documento'],
                'required_fields' => ['nombres'],  // Solo nombres es requerido
                'date_fields' => ['fecha_vinculacion'],
                'number_fields' => ['porcentaje_comision', 'porcentaje_retencion', 'porcentaje_retencion_ica', 'porcentaje_iva', 'porcentaje_retencion_iva'],
                'boolean_fields' => ['es_agencia', 'comisiones_diferentes_por_ano'],
                'fields' => [
                    // Datos básicos
                    'nombres', 'tipo_documento', 'numero_documento', 
                    // Contacto
                    'telefono', 'celular', 'email',
                    // Información bancaria
                    'cuenta_bancaria',
                    // Tipo y configuración
                    'tipo_persona', 'tipo_retencion', 'es_agencia',
                    // Comisiones
                    'porcentaje_comision', 'calcular_comision_sobre',
                    // Retenciones
                    'porcentaje_retencion', 'porcentaje_retencion_ica', 'porcentaje_iva', 'porcentaje_retencion_iva',
                    // Otros
                    'comisiones_diferentes_por_ano', 'fecha_vinculacion'
                ],
                'field_mapping' => [],
                'value_mapping' => [
                    'tipo_persona' => [
                        // ENUM válido: natural, juridica
                        'natural' => 'natural',
                        'persona natural' => 'natural',
                        'persona_natural' => 'natural',
                        'individual' => 'natural',
                        'persona' => 'natural',
                        'p' => 'natural',
                        'n' => 'natural',
                        'pn' => 'natural',
                        'juridica' => 'juridica',
                        'juridico' => 'juridica',
                        'persona juridica' => 'juridica',
                        'persona_juridica' => 'juridica',
                        'empresa' => 'juridica',
                        'company' => 'juridica',
                        'j' => 'juridica',
                        'pj' => 'juridica',
                        'e' => 'juridica',
                        'sociedad' => 'juridica',
                    ],
                    'calcular_comision_sobre' => [
                        'agencia' => 'agencia',
                        'prima neta' => 'prima_neta',
                        'prima' => 'prima_neta',
                        'prima_neta' => 'prima_neta',
                    ],
                ],
                // Defaults mínimos para campos requeridos por la BD
                'defaults' => [
                    'tipo_persona' => 'natural',
                ],
            ],
            'clientes' => [
                'display_name' => 'Clientes',
                'model' => \App\Models\Cliente::class,
                'has_broker_id' => true,
                'unique_keys' => ['email', 'documento', 'celular'],
                'required_fields' => ['nombre'],
                'date_fields' => ['fecha_nacimiento', 'fecha_expedicion_documento'],
                'number_fields' => ['ingresos_mensuales'],
                'boolean_fields' => [],
                'fields' => [
                    // Datos básicos
                    'tipo_cliente', 'nombre', 'apellidos', 
                    // Documento
                    'tipo_documento', 'documento', 'fecha_expedicion_documento',
                    // Contacto
                    'email', 'telefono', 'celular',
                    // Datos personales
                    'fecha_nacimiento', 'genero', 'estado_civil', 'ocupacion',
                    // Dirección
                    'direccion', 'ciudad', 'departamento', 'pais', 'codigo_postal',
                    // Empresa (para clientes jurídicos)
                    'empresa', 'razon_social', 'sucursal',
                    // Representante legal
                    'representante_legal_nombre', 'representante_legal_tipo_documento', 'representante_legal_documento',
                    // Información laboral
                    'ingresos_mensuales', 'direccion_trabajo',
                    // Contacto de emergencia
                    'contacto_emergencia_nombre', 'contacto_emergencia_telefono', 'contacto_emergencia_parentesco',
                    // Estado y otros
                    'estado', 'prioridad', 'origen', 'notas'
                ],
                // Mapeo de campos del CSV a campos del modelo Cliente
                'field_mapping' => [
                    'tipo_cliente' => 'client_type',
                    'nombre' => 'first_name',
                    'apellidos' => 'last_name',
                    'tipo_documento' => 'document_type',
                    'documento' => 'document_number',
                    'fecha_expedicion_documento' => 'document_issue_date',
                    'email' => 'email',
                    'telefono' => 'phone',
                    'celular' => 'mobile_phone',
                    'fecha_nacimiento' => 'birth_date',
                    'genero' => 'gender',
                    'estado_civil' => 'marital_status',
                    'ocupacion' => 'occupation',
                    'direccion' => 'address',
                    'ciudad' => 'city',
                    'departamento' => 'department',
                    'pais' => 'country',
                    'codigo_postal' => 'postal_code',
                    'empresa' => 'company',
                    'razon_social' => 'company_legal_name',
                    'sucursal' => 'branch_name',
                    'representante_legal_nombre' => 'legal_representative_name',
                    'representante_legal_tipo_documento' => 'legal_representative_document_type',
                    'representante_legal_documento' => 'legal_representative_document_number',
                    'ingresos_mensuales' => 'monthly_income',
                    'direccion_trabajo' => 'work_address',
                    'contacto_emergencia_nombre' => 'emergency_contact_name',
                    'contacto_emergencia_telefono' => 'emergency_contact_phone',
                    'contacto_emergencia_parentesco' => 'emergency_contact_relationship',
                    'estado' => 'status',
                    'prioridad' => 'priority',
                    'origen' => 'source',
                    'notas' => 'notes',
                ],
                'value_mapping' => [
                    'status' => [
                        'activo' => 'active',
                        'activa' => 'active',
                        'inactivo' => 'inactive',
                        'inactiva' => 'inactive',
                        'prospecto' => 'prospect',
                        'prospect' => 'prospect',
                        'bloqueado' => 'blocked',
                        'bloqueada' => 'blocked',
                    ],
                    'client_type' => [
                        // Valores que mapean a 'persona' (persona natural)
                        'natural' => 'persona',
                        'persona natural' => 'persona',
                        'individual' => 'persona',
                        'persona' => 'persona',
                        'p' => 'persona',
                        // Valores que mapean a 'empresa' (persona jurídica)
                        'juridica' => 'empresa',
                        'juridico' => 'empresa',
                        'persona juridica' => 'empresa',
                        'empresa' => 'empresa',
                        'company' => 'empresa',
                        'e' => 'empresa',
                    ],
                    'gender' => [
                        // ENUM: 'M', 'F', 'O'
                        'masculino' => 'M',
                        'hombre' => 'M',
                        'm' => 'M',
                        'male' => 'M',
                        'M' => 'M',
                        'femenino' => 'F',
                        'mujer' => 'F',
                        'f' => 'F',
                        'female' => 'F',
                        'F' => 'F',
                        'otro' => 'O',
                        'other' => 'O',
                        'O' => 'O',
                    ],
                    'marital_status' => [
                        'soltero' => 'soltero',
                        'soltera' => 'soltero',
                        'casado' => 'casado',
                        'casada' => 'casado',
                        'divorciado' => 'divorciado',
                        'divorciada' => 'divorciado',
                        'viudo' => 'viudo',
                        'viuda' => 'viudo',
                        'union libre' => 'union_libre',
                        'unión libre' => 'union_libre',
                    ],
                    'priority' => [
                        'alta' => 'high',
                        'high' => 'high',
                        'media' => 'medium',
                        'medium' => 'medium',
                        'baja' => 'low',
                        'low' => 'low',
                    ],
                ],
                // Sin defaults - preferimos null a datos inventados
                'defaults' => [],
            ],
            'polizas' => [
                'display_name' => 'Pólizas',
                'model' => \App\Models\Poliza::class,
                'has_broker_id' => true,
                'unique_keys' => ['policy_number'],
                'required_fields' => ['numero_poliza'],
                'date_fields' => ['fecha_emision', 'fecha_inicio', 'fecha_fin', 'fecha_vencimiento_pago', 'fecha_renovacion', 'fecha_recepcion'],
                'number_fields' => [
                    'prima_neta', 'valor_asegurado', 'deducible', 'porcentaje_comision', 'monto_comision',
                    'porcentaje_iva', 'monto_iva', 'total', 'gastos_adicionales', 'numero_cuotas',
                    'pri_a_pre', 'participacion', 'co_corretaje', 'comision_agencia', 
                    'porcentaje_retencion', 'porcentaje_reteiva'
                ],
                'boolean_fields' => ['es_renovable', 'gastos_adicionales_aplica_iva', 'pago_semestral', 'beneficiario_en_giro'],
                'fields' => [
                    // Identificación
                    'numero_poliza', 'numero_interno', 'tipo',
                    // Aseguradora y producto
                    'aseguradora', 'ramo', 'subramo', 'producto', 'descripcion',
                    // Cliente
                    'cliente_documento', 'cliente_nombre', 'cliente_email',
                    // Vendedor 1
                    'vendedor_email', 'vendedor_nombre',
                    // Vendedor 2 (opcional)
                    'vendedor_2_email', 'vendedor_2_nombre',
                    // Enlace externo
                    'enlace_externo',
                    // Fechas
                    'fecha_emision', 'fecha_inicio', 'fecha_fin', 'fecha_vencimiento_pago', 'fecha_renovacion', 'fecha_recepcion',
                    // Valores
                    'prima_neta', 'valor_asegurado', 'deducible', 'total',
                    // Comisiones
                    'porcentaje_comision', 'monto_comision', 'porcentaje_iva', 'monto_iva',
                    'gastos_adicionales', 'gastos_adicionales_aplica_iva',
                    // Pago
                    'frecuencia_pago', 'medio_pago', 'banco', 'pago_semestral', 'numero_cuotas',
                    'ultimos_4_tarjeta', 'numero_cheque', 'plazo_convenio', 'numero_cuenta_debito',
                    // Estado
                    'estado', 'estado_pago', 'notas_estado', 'motivo',
                    // Beneficiario
                    'beneficiario_nombre', 'beneficiario_documento', 'beneficiario_parentesco', 'beneficiario_telefono',
                    // Tomador
                    'tomador_nombre', 'tomador_documento',
                    // Asegurado
                    'asegurado_nombre', 'asegurado_documento',
                    // Vehículo
                    'placa_vehiculo',
                    // Renovación
                    'es_renovable', 'dias_aviso_renovacion',
                    // Otros campos de comisión
                    'pri_a_pre', 'participacion', 'co_corretaje', 'comision_agencia',
                    'porcentaje_retencion', 'porcentaje_reteiva', 'beneficiario_en_giro',
                    // Notas
                    'notas'
                ],
                'field_mapping' => [
                    'numero_poliza' => 'policy_number',
                    'numero_interno' => 'internal_number',
                    'tipo' => 'type',
                    'aseguradora' => 'insurance_company',
                    'producto' => 'product_name',
                    'descripcion' => 'description',
                    'fecha_emision' => 'issue_date',
                    'fecha_inicio' => 'start_date',
                    'fecha_fin' => 'end_date',
                    'fecha_vencimiento_pago' => 'payment_due_date',
                    'fecha_renovacion' => 'renewal_date',
                    'fecha_recepcion' => 'reception_date',
                    'prima_neta' => 'premium_amount',
                    'valor_asegurado' => 'insured_amount',
                    'deducible' => 'deductible',
                    'porcentaje_comision' => 'commission_percentage',
                    'monto_comision' => 'commission_amount',
                    'porcentaje_iva' => 'vat_percentage',
                    'monto_iva' => 'vat_amount',
                    'total' => 'total_amount',
                    'frecuencia_pago' => 'payment_frequency',
                    'medio_pago' => 'payment_method',
                    'banco' => 'bank_name',
                    'pago_semestral' => 'half_payment',
                    'numero_cuotas' => 'installments_count',
                    'ultimos_4_tarjeta' => 'card_last4',
                    'numero_cheque' => 'cheque_number',
                    'plazo_convenio' => 'agreement_term',
                    'numero_cuenta_debito' => 'debit_account_number',
                    'estado' => 'status',
                    'estado_pago' => 'payment_status',
                    'notas_estado' => 'status_notes',
                    'motivo' => 'reason',
                    'beneficiario_nombre' => 'beneficiary_name',
                    'beneficiario_documento' => 'beneficiary_document',
                    'beneficiario_parentesco' => 'beneficiary_relationship',
                    'beneficiario_telefono' => 'beneficiary_phone',
                    'tomador_nombre' => 'policy_holder_name',
                    'tomador_documento' => 'policy_holder_document',
                    'asegurado_nombre' => 'insured_name',
                    'asegurado_documento' => 'insured_document',
                    'placa_vehiculo' => 'vehicle_plates',
                    'es_renovable' => 'auto_renewal',
                    'dias_aviso_renovacion' => 'renewal_days_notice',
                    'participacion' => 'participation',
                    'co_corretaje' => 'co_brokerage',
                    'comision_agencia' => 'agency_commission',
                    'porcentaje_retencion' => 'withholding_percentage',
                    'porcentaje_reteiva' => 'reteiva_percentage',
                    'beneficiario_en_giro' => 'beneficiary_in_remittance',
                    'notas' => 'notes',
                    'ramo' => 'ramo_id',
                    // Vendedor 2
                    'vendedor_2_nombre' => 'seller_name_2',
                    // Enlace externo
                    'enlace_externo' => 'external_link',
                ],
                'value_mapping' => [
                    'status' => [
                        // ENUM válido: active, expired, cancelled, suspended, pending, quoted, accrued, issued, not_renewed, renewed
                        'activa' => 'active',
                        'activo' => 'active',
                        'active' => 'active',
                        'vigente' => 'active',
                        'en vigor' => 'active',
                        'cancelada' => 'cancelled',
                        'cancelado' => 'cancelled',
                        'cancelled' => 'cancelled',
                        'anulada' => 'cancelled',
                        'anulado' => 'cancelled',
                        'vencida' => 'expired',
                        'vencido' => 'expired',
                        'expired' => 'expired',
                        'expirada' => 'expired',
                        'pendiente' => 'pending',
                        'pending' => 'pending',
                        'nueva' => 'pending',
                        'nuevo' => 'pending',
                        'renovada' => 'renewed',
                        'renewed' => 'renewed',
                        'no renovada' => 'not_renewed',
                        'not_renewed' => 'not_renewed',
                        'suspendida' => 'suspended',
                        'suspendido' => 'suspended',
                        'suspended' => 'suspended',
                        'cotizada' => 'quoted',
                        'quoted' => 'quoted',
                        'cotizacion' => 'quoted',
                        'causada' => 'accrued',
                        'accrued' => 'accrued',
                        'emitida' => 'issued',
                        'issued' => 'issued',
                    ],
                    'payment_status' => [
                        // ENUM válido: paid, pending, overdue, cancelled
                        'pagado' => 'paid',
                        'pagada' => 'paid',
                        'paid' => 'paid',
                        'al dia' => 'paid',
                        'al día' => 'paid',
                        'pendiente' => 'pending',
                        'pending' => 'pending',
                        'por pagar' => 'pending',
                        'parcial' => 'pending',
                        'partial' => 'pending',
                        'vencido' => 'overdue',
                        'overdue' => 'overdue',
                        'mora' => 'overdue',
                        'en mora' => 'overdue',
                        'atrasado' => 'overdue',
                        'cancelado' => 'cancelled',
                        'cancelled' => 'cancelled',
                    ],
                    'payment_frequency' => [
                        // ENUM válido: monthly, quarterly, biannual, annual
                        'mensual' => 'monthly',
                        'monthly' => 'monthly',
                        'mes' => 'monthly',
                        'trimestral' => 'quarterly',
                        'quarterly' => 'quarterly',
                        'trimestre' => 'quarterly',
                        '3 meses' => 'quarterly',
                        'semestral' => 'biannual',
                        'semiannual' => 'biannual',
                        'biannual' => 'biannual',
                        'semestre' => 'biannual',
                        '6 meses' => 'biannual',
                        'anual' => 'annual',
                        'annual' => 'annual',
                        'año' => 'annual',
                        'ano' => 'annual',
                        '12 meses' => 'annual',
                        'unico' => 'annual',
                        'único' => 'annual',
                        'single' => 'annual',
                        'contado' => 'annual',
                    ],
                    'type' => [
                        // Valores para ENUM individual/collective
                        'individual' => 'individual',
                        'colectiva' => 'collective',
                        'colectivo' => 'collective',
                        'collective' => 'collective',
                        'grupo' => 'collective',
                        'grupal' => 'collective',
                        'familiar' => 'collective',
                        // Valores para ENUM vida/autos/hogar/etc (migración original)
                        'vida' => 'vida',
                        'autos' => 'autos',
                        'auto' => 'autos',
                        'vehiculo' => 'autos',
                        'vehiculos' => 'autos',
                        'hogar' => 'hogar',
                        'casa' => 'hogar',
                        'vivienda' => 'hogar',
                        'empresarial' => 'empresarial',
                        'empresa' => 'empresarial',
                        'pyme' => 'empresarial',
                        'salud' => 'salud',
                        'medicina' => 'salud',
                        'accidentes' => 'accidentes',
                        'accidente' => 'accidentes',
                        'ap' => 'accidentes',
                        'responsabilidad_civil' => 'responsabilidad_civil',
                        'rc' => 'responsabilidad_civil',
                        'responsabilidad' => 'responsabilidad_civil',
                        'otros' => 'otros',
                        'otro' => 'otros',
                        'other' => 'otros',
                    ],
                    'payment_method' => [
                        // ENUM válido: cash, transfer, check, card, financing
                        'efectivo' => 'cash',
                        'cash' => 'cash',
                        'contado' => 'cash',
                        'transferencia' => 'transfer',
                        'transfer' => 'transfer',
                        'consignacion' => 'transfer',
                        'consignación' => 'transfer',
                        'banco' => 'transfer',
                        'tarjeta' => 'card',
                        'card' => 'card',
                        'tarjeta_credito' => 'card',
                        'tarjeta_debito' => 'card',
                        'debito' => 'card',
                        'débito' => 'card',
                        'debit' => 'card',
                        'debito_automatico' => 'card',
                        'cheque' => 'check',
                        'check' => 'check',
                        'financiado' => 'financing',
                        'financed' => 'financing',
                        'financing' => 'financing',
                        'financiacion' => 'financing',
                        'financiación' => 'financing',
                        'credito' => 'financing',
                        'crédito' => 'financing',
                    ],
                ],
                // Defaults mínimos para campos requeridos por la BD
                'defaults' => [
                    'status' => 'active',  // Estado por defecto si no viene
                ],
                // Campos que pueden auto-crear entidades relacionadas si no existen
                'auto_create_relations' => [
                    'aseguradora' => [
                        'model' => \App\Models\Aseguradora::class,
                        'lookup_field' => 'nombre',
                        'target_field' => 'aseguradora_id',
                        'create_fields' => ['nombre'],
                        'display_name' => 'Aseguradora',
                    ],
                    'ramo' => [
                        'model' => \App\Models\Ramo::class,
                        'lookup_field' => 'nombre',
                        'target_field' => 'ramo_id',
                        'create_fields' => ['nombre'],
                        'display_name' => 'Ramo',
                    ],
                    'cliente_documento' => [
                        'model' => \App\Models\Cliente::class,
                        'lookup_field' => 'document_number',
                        'target_field' => 'client_id',
                        'create_fields' => ['document_number', 'first_name', 'email'],
                        'extra_fields_mapping' => [
                            'cliente_nombre' => 'first_name',
                            'cliente_email' => 'email',
                        ],
                        'display_name' => 'Cliente',
                        'defaults' => ['status' => 'active', 'client_type' => 'persona', 'last_name' => '', 'document_number' => ''],
                        // Campos alternativos para buscar si el principal está vacío
                        'fallback_lookups' => [
                            ['csv_field' => 'cliente_nombre', 'lookup_field' => 'first_name'],
                            ['csv_field' => 'cliente_email', 'lookup_field' => 'email'],
                        ],
                        // Campos adicionales donde buscar (identificadores únicos personalizados)
                        'alternative_lookup_fields' => ['id', 'document_number', 'email', 'phone'],
                    ],
                    'vendedor_email' => [
                        'model' => \App\Models\Vendedor::class,
                        'lookup_field' => 'email',
                        'target_field' => 'seller_id',
                        'name_field' => 'seller_name',
                        'create_fields' => ['email', 'nombres'],
                        'extra_fields_mapping' => [
                            'vendedor_nombre' => 'nombres',
                        ],
                        'display_name' => 'Vendedor/Asesor 1',
                        'defaults' => ['tipo_persona' => 'natural', 'es_agencia' => false, 'tipo_documento' => 'CC'],
                        // Campos adicionales donde buscar (identificadores únicos personalizados)
                        'alternative_lookup_fields' => ['id', 'email', 'numero_documento', 'nombres'],
                    ],
                    'vendedor_2_email' => [
                        'model' => \App\Models\Vendedor::class,
                        'lookup_field' => 'email',
                        'target_field' => 'seller_id_2',
                        'name_field' => 'seller_name_2',
                        'create_fields' => ['email', 'nombres'],
                        'extra_fields_mapping' => [
                            'vendedor_2_nombre' => 'nombres',
                        ],
                        'display_name' => 'Vendedor/Asesor 2',
                        'defaults' => ['tipo_persona' => 'natural', 'es_agencia' => false, 'tipo_documento' => 'CC'],
                        'optional' => true,
                        // Campos adicionales donde buscar (identificadores únicos personalizados)
                        'alternative_lookup_fields' => ['id', 'email', 'numero_documento', 'nombres'],
                    ],
                ],
            ],
        ];
    }

    public function meta(Request $request)
    {
        // Devolver solo los campos necesarios para el frontend (sin el modelo)
        $meta = $this->getEntitiesMeta();
        $publicMeta = [];
        foreach ($meta as $key => $config) {
            // Extraer info de auto-creación para el frontend
            $autoCreateInfo = [];
            if (isset($config['auto_create_relations'])) {
                foreach ($config['auto_create_relations'] as $field => $relConfig) {
                    $autoCreateInfo[$field] = [
                        'display_name' => $relConfig['display_name'] ?? $field,
                        'lookup_field' => $relConfig['lookup_field'],
                    ];
                }
            }
            
            $publicMeta[$key] = [
                'display_name' => $config['display_name'],
                'unique_keys' => $config['unique_keys'],
                'required_fields' => $config['required_fields'],
                'date_fields' => $config['date_fields'],
                'number_fields' => $config['number_fields'],
                'boolean_fields' => $config['boolean_fields'],
                'fields' => $config['fields'],
                'auto_create_relations' => $autoCreateInfo,
            ];
        }
        return response()->json([
            'success' => true,
            'entities' => $publicMeta,
        ]);
    }

    /**
     * Procesar importación CSV (dry-run o ejecutar)
     */
    public function process(Request $request)
    {
        return $this->executeWithAuth($request, function ($user, $brokerId) use ($request) {
            // Debug: verificar si el archivo llegó
            \Log::info('Import process - Request info', [
                'has_file' => $request->hasFile('file'),
                'file_valid' => $request->hasFile('file') ? $request->file('file')->isValid() : false,
                'file_error' => $request->hasFile('file') ? $request->file('file')->getError() : 'no file',
                'all_files' => array_keys($_FILES),
                'files_detail' => $_FILES,
                'content_length' => $request->header('Content-Length'),
            ]);
            
            // Si el archivo no es válido, dar más información
            if ($request->hasFile('file') && !$request->file('file')->isValid()) {
                $errorCode = $request->file('file')->getError();
                $errorMessages = [
                    UPLOAD_ERR_INI_SIZE => 'El archivo excede upload_max_filesize en php.ini',
                    UPLOAD_ERR_FORM_SIZE => 'El archivo excede MAX_FILE_SIZE del formulario',
                    UPLOAD_ERR_PARTIAL => 'El archivo se subió parcialmente',
                    UPLOAD_ERR_NO_FILE => 'No se subió ningún archivo',
                    UPLOAD_ERR_NO_TMP_DIR => 'Falta carpeta temporal',
                    UPLOAD_ERR_CANT_WRITE => 'Error al escribir en disco',
                    UPLOAD_ERR_EXTENSION => 'Extensión PHP detuvo la subida',
                ];
                return response()->json([
                    'success' => false,
                    'message' => $errorMessages[$errorCode] ?? "Error de subida código: $errorCode",
                    'error_code' => $errorCode,
                ], 422);
            }
            
            $validator = Validator::make($request->all(), [
                'entity' => 'required|string',
                'file' => 'required|file',  // Aceptar cualquier archivo, validamos extensión manualmente
                'mapping' => 'nullable',
                'dry_run' => 'nullable',
                'upsert_key' => 'nullable|string',
                'auto_create' => 'nullable', // Permitir auto-crear entidades relacionadas
                'limit' => 'nullable|integer|min:1|max:10000', // Límite de registros a importar (para pruebas)
            ]);

            if ($validator->fails()) {
                \Log::warning('Import validation failed', ['errors' => $validator->errors()->toArray()]);
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $entity = $request->input('entity');
            $mappingInput = $request->input('mapping', []);
            
            // Permitir envío de mapping como JSON string en multipart
            if (is_string($mappingInput)) {
                $decoded = json_decode($mappingInput, true);
                $mapping = is_array($decoded) ? $decoded : [];
            } else {
                $mapping = is_array($mappingInput) ? $mappingInput : [];
            }
            
            // Manejar dry_run como string o boolean
            $dryRunInput = $request->input('dry_run', '1');
            $dryRun = $dryRunInput === '1' || $dryRunInput === 1 || $dryRunInput === true || $dryRunInput === 'true';
            
            // Manejar auto_create como string o boolean
            $autoCreateInput = $request->input('auto_create', '0');
            $autoCreate = $autoCreateInput === '1' || $autoCreateInput === 1 || $autoCreateInput === true || $autoCreateInput === 'true';
            
            $upsertKey = $request->input('upsert_key');
            
            // Límite de registros (null = todos, número = cantidad máxima)
            $limitInput = $request->input('limit');
            $limit = $limitInput !== null && $limitInput !== '' ? (int)$limitInput : null;
            
            // Relation mappings: indica cómo buscar entidades relacionadas por campos personalizados
            $relationMappingsInput = $request->input('relation_mappings', []);
            if (is_string($relationMappingsInput)) {
                $relationMappings = json_decode($relationMappingsInput, true) ?? [];
            } else {
                $relationMappings = is_array($relationMappingsInput) ? $relationMappingsInput : [];
            }
            
            // Imported index: índice de entidades ya importadas para relacionar por columnas temporales
            // Formato: { "clientes": { "valor_identificador": id_en_bd, ... }, ... }
            $importedIndexInput = $request->input('imported_index', []);
            if (is_string($importedIndexInput)) {
                $importedIndex = json_decode($importedIndexInput, true) ?? [];
            } else {
                $importedIndex = is_array($importedIndexInput) ? $importedIndexInput : [];
            }
            
            $meta = $this->getEntitiesMeta();
            if (!isset($meta[$entity])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Entidad no soportada: ' . $entity,
                ], 422);
            }

            $entityConfig = $meta[$entity];

            // Leer archivo
            $file = $request->file('file');
            
            // Validar extensión manualmente
            $extension = strtolower($file->getClientOriginalExtension());
            if (!in_array($extension, ['csv', 'txt', 'xlsx', 'xls'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Formato de archivo no soportado. Use CSV, TXT, XLSX o XLS.',
                ], 422);
            }
            
            $tabular = $this->readTabularFile($file->getRealPath(), $extension);
            
            if (!$tabular['success']) {
                return response()->json([
                    'success' => false,
                    'message' => $tabular['message'] ?? 'No se pudo leer el archivo',
                ], 400);
            }
            
            $headers = $tabular['headers'] ?? [];
            $rows = $tabular['rows'] ?? [];
            
            if (empty($headers)) {
                return response()->json([
                    'success' => true,
                    'mode' => 'dry_run',
                    'headers' => [],
                    'preview' => [],
                    'total_rows' => 0,
                    'errors' => [['error' => 'El archivo no tiene encabezados']],
                ]);
            }

            // Si no hay mapping, devolver solo headers (para configurar mapeo en frontend)
            if (empty($mapping)) {
                return response()->json([
                    'success' => true,
                    'mode' => 'dry_run',
                    'headers' => $headers,
                    'preview' => [],
                    'total_rows' => count($rows),
                    'errors' => [],
                ]);
            }

            // Obtener mapeo de campos del CSV a campos del modelo
            $fieldMapping = $entityConfig['field_mapping'] ?? [];
            $valueMapping = $entityConfig['value_mapping'] ?? [];
            $defaults = $entityConfig['defaults'] ?? [];
            $hasBrokerId = $entityConfig['has_broker_id'] ?? true;

            // Previsualización y validación
            $preview = [];
            $errors = [];
            $rowIndex = 1;

            foreach ($rows as $row) {
                $rowIndex++;
                $rowData = $this->extractRowData($row, $headers, $mapping);
                
                // Validar campos requeridos
                $requiredFields = $entityConfig['required_fields'] ?? [];
                foreach ($requiredFields as $required) {
                    $value = $rowData[$required] ?? null;
                    if ($value === null || $value === '') {
                        $errors[] = [
                            'row' => $rowIndex,
                            'field' => $required,
                            'value' => $value,
                            'error' => "Campo requerido '{$required}' está vacío",
                        ];
                    }
                }

                // Validar upsert_key si está definido
                if ($upsertKey && !$dryRun) {
                    $upsertValue = $rowData[$upsertKey] ?? null;
                    if ($upsertValue === null || $upsertValue === '') {
                        $errors[] = [
                            'row' => $rowIndex,
                            'field' => $upsertKey,
                            'value' => $upsertValue,
                            'error' => "Clave de actualización '{$upsertKey}' está vacía",
                        ];
                    }
                }

                if (count($preview) < 20) {
                    $preview[] = $rowData;
                }
            }

            // Aplicar límite a las filas si está definido
            $totalRowsOriginal = count($rows);
            if ($limit !== null && $limit > 0) {
                $rows = array_slice($rows, 0, $limit);
            }
            $totalRowsToProcess = count($rows);

            if ($dryRun) {
                return response()->json([
                    'success' => true,
                    'mode' => 'dry_run',
                    'headers' => $headers,
                    'preview' => $preview,
                    'total_rows' => $totalRowsOriginal,
                    'rows_to_import' => $totalRowsToProcess,
                    'limit_applied' => $limit,
                    'errors' => $errors,
                ]);
            }

            // Si no es dry-run y no hay mapping válido, error
            if (empty($mapping)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Mapping requerido para importar',
                ], 422);
            }

            // ========== EJECUTAR IMPORTACIÓN ==========
            $inserted = 0;
            $updated = 0;
            $failed = 0;
            $detailedErrors = [];
            $autoCreated = []; // Registro de entidades auto-creadas

            // Crear registro de job
            $job = ImportJob::create([
                'broker_id' => $brokerId,
                'user_id' => $user->id ?? null,
                'entity' => $entity,
                'filename' => $file->getClientOriginalName(),
                'status' => 'running',
                'mapping' => $mapping,
                'started_at' => now(),
            ]);

            $modelClass = $entityConfig['model'];
            $autoCreateRelations = $entityConfig['auto_create_relations'] ?? [];
            $rowIndex = 1;
            
            // Índice de registros creados: { valor_columna_identificador: id_en_bd }
            // Se devuelve al frontend para que lo use en las siguientes importaciones
            $createdIndex = [];
            // Columna identificadora del CSV (para construir el índice)
            $identifierColumn = $request->input('identifier_column') ?? $upsertKey;

            foreach ($rows as $row) {
                $rowIndex++;
                
                try {
                    // Extraer datos de la fila según el mapping
                    $rowData = $this->extractRowData($row, $headers, $mapping);
                    
                    // Transformar campos al formato del modelo
                    $payload = $this->transformPayload($rowData, $entityConfig, $brokerId);
                    
                    // Resolver/Auto-crear relaciones si está habilitado
                    if (!empty($autoCreateRelations)) {
                        $payload = $this->resolveOrCreateRelations(
                            $payload, 
                            $rowData,
                            $autoCreateRelations, 
                            $brokerId, 
                            $rowIndex, 
                            $autoCreate,
                            $detailedErrors,
                            $autoCreated,
                            $relationMappings, // Pasar los mappings de relación personalizados
                            $importedIndex // Pasar el índice de entidades ya importadas
                        );
                    }
                    
                    // Agregar broker_id si corresponde
                    if ($hasBrokerId) {
                        $payload['broker_id'] = $brokerId;
                    }
                    
                    // Aplicar defaults para campos vacíos (si hay alguno configurado)
                    foreach ($defaults as $field => $defaultValue) {
                        if (!isset($payload[$field]) || $payload[$field] === '' || $payload[$field] === null) {
                            $payload[$field] = $defaultValue;
                        }
                    }
                    
                    // Normalizar porcentajes para evitar overflow (máximo 100%)
                    $percentageFields = ['commission_percentage', 'vat_percentage', 'withholding_percentage', 'reteiva_percentage', 'participation'];
                    foreach ($percentageFields as $pctField) {
                        if (isset($payload[$pctField]) && is_numeric($payload[$pctField])) {
                            // Si el valor es mayor a 100, probablemente está mal formateado
                            if ($payload[$pctField] > 100) {
                                // Intentar dividir por 100 si parece un porcentaje mal formateado (ej: 1500 -> 15.00)
                                if ($payload[$pctField] > 1000) {
                                    $payload[$pctField] = $payload[$pctField] / 100;
                                }
                                // Clamp a 100 máximo
                                $payload[$pctField] = min(100, $payload[$pctField]);
                            }
                            // Asegurar que no sea negativo
                            $payload[$pctField] = max(0, $payload[$pctField]);
                        }
                    }
                    
                    // Determinar clave de upsert normalizada
                    $normalizedUpsertKey = $fieldMapping[$upsertKey] ?? $upsertKey;
                    
                    // Buscar registro existente por la clave de upsert O por cualquier clave única
                    $existing = null;
                    $uniqueKeys = $entityConfig['unique_keys'] ?? [];
                    
                    // Primero intentar con la clave de upsert especificada
                    if ($normalizedUpsertKey && isset($payload[$normalizedUpsertKey]) && $payload[$normalizedUpsertKey] !== '') {
                        $query = $modelClass::query();
                        $query->where($normalizedUpsertKey, $payload[$normalizedUpsertKey]);
                        
                        if ($hasBrokerId) {
                            $query->where('broker_id', $brokerId);
                        }
                        
                        $existing = $query->first();
                    }
                    
                    // Si no se encontró, buscar por cualquier clave única definida
                    if (!$existing && !empty($uniqueKeys)) {
                        foreach ($uniqueKeys as $uniqueKey) {
                            // El uniqueKey puede ser el nombre del campo CSV o del modelo
                            $modelUniqueKey = $fieldMapping[$uniqueKey] ?? $uniqueKey;
                            
                            // Buscar el valor en el payload (puede estar con el nombre del modelo o del CSV)
                            $searchValue = $payload[$modelUniqueKey] ?? $payload[$uniqueKey] ?? null;
                            
                            if ($searchValue !== null && $searchValue !== '') {
                                $query = $modelClass::query();
                                $query->where($modelUniqueKey, $searchValue);
                                
                                if ($hasBrokerId) {
                                    $query->where('broker_id', $brokerId);
                                }
                                
                                $existing = $query->first();
                                if ($existing) {
                                    break; // Encontrado, salir del loop
                                }
                            }
                        }
                    }

                    if ($existing) {
                        // Actualizar registro existente
                        $existing->fill($payload);
                        $existing->save();
                        $updated++;
                        
                        // Agregar al índice usando TODAS las columnas del CSV como posibles identificadores
                        foreach ($rowData as $colName => $colValue) {
                            if ($colValue !== null && $colValue !== '') {
                                $createdIndex[trim($colValue)] = $existing->id;
                            }
                        }
                    } else {
                        // Crear nuevo registro
                        $newRecord = $modelClass::create($payload);
                        $inserted++;
                        
                        // Agregar al índice usando TODAS las columnas del CSV como posibles identificadores
                        foreach ($rowData as $colName => $colValue) {
                            if ($colValue !== null && $colValue !== '') {
                                $createdIndex[trim($colValue)] = $newRecord->id;
                            }
                        }
                    }

                } catch (\Throwable $e) {
                    $failed++;
                    $detailedErrors[] = [
                        'row' => $rowIndex,
                        'data' => $rowData ?? [],
                        'error' => $this->formatErrorMessage($e),
                        'field' => $this->extractFieldFromError($e->getMessage()),
                    ];
                    
                    Log::warning("Error importando fila {$rowIndex} de {$entity}", [
                        'broker_id' => $brokerId,
                        'error' => $e->getMessage(),
                        'row_data' => $rowData ?? [],
                    ]);
                }
            }

            // Actualizar job con resultados
            $job->update([
                'status' => $failed > 0 && $inserted === 0 && $updated === 0 ? 'failed' : 'completed',
                'inserted' => $inserted,
                'updated' => $updated,
                'failed' => $failed,
                'errors_count' => count($detailedErrors),
                'errors' => array_slice($detailedErrors, 0, 100), // Guardar máximo 100 errores
                'finished_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'mode' => 'execute',
                'summary' => [
                    'inserted' => $inserted,
                    'updated' => $updated,
                    'failed' => $failed,
                    'total' => count($rows),
                    'auto_created' => $autoCreated,
                ],
                'errors' => $detailedErrors,
                'job_id' => $job->id,
                // Índice de registros creados para relacionar en siguientes importaciones
                'created_index' => $createdIndex,
            ]);
        });
    }

    /**
     * Extraer datos de una fila según el mapping
     */
    private function extractRowData(array $row, array $headers, array $mapping): array
    {
        $data = [];
        foreach ($mapping as $targetField => $sourceHeader) {
            $colIdx = array_search($sourceHeader, $headers);
            $value = $colIdx !== false ? ($row[$colIdx] ?? null) : null;
            // Limpiar espacios en blanco
            if (is_string($value)) {
                $value = trim($value);
            }
            $data[$targetField] = $value;
        }
        return $data;
    }

    /**
     * Transformar payload del CSV al formato del modelo
     */
    private function transformPayload(array $rowData, array $entityConfig, int $brokerId): array
    {
        $fieldMapping = $entityConfig['field_mapping'] ?? [];
        $valueMapping = $entityConfig['value_mapping'] ?? [];
        $dateFields = $entityConfig['date_fields'] ?? [];
        $numberFields = $entityConfig['number_fields'] ?? [];
        $booleanFields = $entityConfig['boolean_fields'] ?? [];
        
        // Campos ENUM que deben ser null si no se reconoce el valor
        $enumFields = ['client_type', 'gender', 'marital_status', 'status', 'priority', 'payment_status', 'payment_frequency', 'type', 'payment_method', 'tipo_persona'];

        $payload = [];

        foreach ($rowData as $csvField => $value) {
            // Mapear nombre del campo si es necesario
            $modelField = $fieldMapping[$csvField] ?? $csvField;
            
            // Si el valor está vacío, saltar
            if ($value === null || $value === '') {
                continue;
            }
            
            // Transformar valor según el tipo de campo
            if (in_array($csvField, $dateFields) || in_array($modelField, $dateFields)) {
                $value = $this->parseDate($value);
            } elseif (in_array($csvField, $numberFields) || in_array($modelField, $numberFields)) {
                $value = $this->parseNumber($value);
            } elseif (in_array($csvField, $booleanFields) || in_array($modelField, $booleanFields)) {
                $value = $this->parseBoolean($value);
            }
            
            // Aplicar mapeo de valores si existe
            if (isset($valueMapping[$modelField]) && is_string($value)) {
                $normalizedValue = strtolower(trim($value));
                if (isset($valueMapping[$modelField][$normalizedValue])) {
                    $value = $valueMapping[$modelField][$normalizedValue];
                } elseif (in_array($modelField, $enumFields)) {
                    // Si es un campo ENUM y el valor no está mapeado, ignorarlo (usar null/default)
                    continue;
                }
                // Si no es ENUM, mantener el valor original
            }

            $payload[$modelField] = $value;
        }

        return $payload;
    }

    /**
     * Resolver o auto-crear relaciones según configuración
     */
    private function resolveOrCreateRelations(
        array $payload, 
        array $rowData,
        array $autoCreateRelations, 
        int $brokerId, 
        int $rowIndex, 
        bool $autoCreate,
        array &$errors,
        array &$autoCreated,
        array $relationMappings = [], // Mappings personalizados del frontend
        array $importedIndex = [] // Índice de entidades ya importadas
    ): array {
        foreach ($autoCreateRelations as $csvField => $config) {
            $modelClass = $config['model'];
            $lookupField = $config['lookup_field'];
            $targetField = $config['target_field'];
            $displayName = $config['display_name'] ?? $csvField;
            
            // Verificar si hay un mapping personalizado para este campo
            // El frontend envía: { "cliente_documento": { targetEntityKey, columnInThisFile, columnInTargetFile } }
            $customMapping = $relationMappings[$csvField] ?? null;
            
            // Obtener el valor de búsqueda del campo CSV original
            $lookupValue = $rowData[$csvField] ?? null;
            $usedLookupField = $lookupField;
            
            // Si hay mapping personalizado, usar la columna que el usuario seleccionó
            if ($customMapping && !empty($customMapping['columnInTargetFile'])) {
                // El usuario eligió buscar por un campo específico de la entidad relacionada
                // columnInTargetFile es el nombre del campo en el CSV de la entidad relacionada
                // Necesitamos mapear ese nombre de columna CSV al campo del modelo
                $targetEntityKey = $customMapping['targetEntityKey'] ?? null;
                $columnInTarget = $customMapping['columnInTargetFile'] ?? null;
                
                if ($targetEntityKey && $columnInTarget) {
                    // Obtener el field_mapping de la entidad relacionada para traducir columna CSV -> campo modelo
                    $targetEntityMeta = $this->getEntitiesMeta()[$targetEntityKey] ?? null;
                    if ($targetEntityMeta) {
                        $targetFieldMapping = $targetEntityMeta['field_mapping'] ?? [];
                        // Buscar el campo del modelo que corresponde a la columna CSV
                        $modelFieldForColumn = $targetFieldMapping[$columnInTarget] ?? $columnInTarget;
                        $usedLookupField = $modelFieldForColumn;
                        
                        Log::info("Usando mapping personalizado para {$csvField}: buscar por '{$usedLookupField}' = '{$lookupValue}'");
                    }
                }
            }
            
            // Si el valor principal está vacío, intentar con fallback_lookups
            if (($lookupValue === null || $lookupValue === '') && isset($config['fallback_lookups'])) {
                foreach ($config['fallback_lookups'] as $fallback) {
                    $fallbackValue = $rowData[$fallback['csv_field']] ?? null;
                    if ($fallbackValue !== null && $fallbackValue !== '') {
                        $lookupValue = $fallbackValue;
                        $usedLookupField = $fallback['lookup_field'];
                        break;
                    }
                }
            }
            
            // Si el campo es opcional y no tiene valor, saltar sin error
            $isOptional = $config['optional'] ?? false;
            if ($lookupValue === null || $lookupValue === '') {
                if ($isOptional) {
                    continue; // Campo opcional vacío, no es error
                }
                continue;
            }

            $lookupValue = trim($lookupValue);
            
            // PRIMERO: Buscar en el índice de entidades ya importadas (para columnas temporales que no están en BD)
            $targetEntityKey = $customMapping['targetEntityKey'] ?? null;
            if ($targetEntityKey && isset($importedIndex[$targetEntityKey][$lookupValue])) {
                $foundId = $importedIndex[$targetEntityKey][$lookupValue];
                $relatedModel = $modelClass::find($foundId);
            } else {
                $relatedModel = null;
            }

            // Si no se encontró en el índice, buscar en BD usando campos válidos de la BD
            // IMPORTANTE: Solo buscar en BD si usedLookupField es un campo válido (no un nombre de columna CSV)
            $validDbFields = $config['alternative_lookup_fields'] ?? [$lookupField];
            $isValidDbField = in_array($usedLookupField, $validDbFields);
            
            if (!$relatedModel && $isValidDbField) {
                $relatedModel = $modelClass::query()
                    ->where($usedLookupField, $lookupValue)
                    ->where('broker_id', $brokerId)
                    ->first();
            }
            
            // Si no se encontró, intentar buscar por campos alternativos válidos (id, email, phone, etc.)
            if (!$relatedModel && isset($config['alternative_lookup_fields'])) {
                foreach ($config['alternative_lookup_fields'] as $altField) {
                    if ($altField === $usedLookupField) continue; // Ya lo intentamos
                    
                    try {
                        $relatedModel = $modelClass::query()
                            ->where($altField, $lookupValue)
                            ->where('broker_id', $brokerId)
                            ->first();
                        
                        if ($relatedModel) {
                            Log::info("Encontrado por campo alternativo '{$altField}': {$lookupValue}");
                            break;
                        }
                    } catch (\Throwable $e) {
                        // Campo no existe en la BD, ignorar
                        continue;
                    }
                }
            }
            
            // Si no se encontró con el campo usado, intentar con los otros campos de fallback
            if (!$relatedModel && isset($config['fallback_lookups'])) {
                foreach ($config['fallback_lookups'] as $fallback) {
                    $fallbackValue = $rowData[$fallback['csv_field']] ?? null;
                    if ($fallbackValue !== null && $fallbackValue !== '' && $fallback['lookup_field'] !== $usedLookupField) {
                        try {
                            $relatedModel = $modelClass::query()
                                ->where($fallback['lookup_field'], trim($fallbackValue))
                                ->where('broker_id', $brokerId)
                                ->first();
                            if ($relatedModel) {
                                break;
                            }
                        } catch (\Throwable $e) {
                            // Campo no existe en la BD, ignorar
                            continue;
                        }
                    }
                }
            }

            if ($relatedModel) {
                // Encontrado: asignar el ID
                $payload[$targetField] = $relatedModel->id;
                
                // Si es un cliente, llenar también los campos de nombre y documento en la póliza
                if ($targetField === 'client_id') {
                    $payload['client_name'] = trim(($relatedModel->first_name ?? '') . ' ' . ($relatedModel->last_name ?? ''));
                    $payload['client_document'] = $relatedModel->document_number ?? '';
                }
                
                // Si tiene name_field configurado (ej: seller_name, seller_name_2), asignar el nombre
                if (isset($config['name_field'])) {
                    $payload[$config['name_field']] = $relatedModel->nombres ?? $relatedModel->nombre ?? '';
                }
            } elseif ($autoCreate) {
                // No encontrado pero auto-crear está habilitado
                // NOTA: Solo auto-crear si tenemos datos suficientes del CSV
                // Si solo tenemos el identificador, reportar error en lugar de crear datos vacíos
                $hasEnoughData = false;
                
                // Verificar si hay datos extra del CSV para crear el registro
                if (isset($config['extra_fields_mapping'])) {
                    foreach ($config['extra_fields_mapping'] as $csvExtraField => $modelExtraField) {
                        $extraValue = $rowData[$csvExtraField] ?? null;
                        if ($extraValue !== null && $extraValue !== '') {
                            $hasEnoughData = true;
                            break;
                        }
                    }
                }
                
                if (!$hasEnoughData) {
                    // No hay datos suficientes para crear, reportar que no se encontró
                    if (!$isOptional) {
                        $errors[] = [
                            'row' => $rowIndex,
                            'field' => $csvField,
                            'value' => $lookupValue,
                            'error' => "{$displayName} '{$lookupValue}' no encontrado. Asegúrese de importar primero la entidad relacionada.",
                        ];
                    }
                    continue;
                }
                
                try {
                    $newData = [
                        'broker_id' => $brokerId,
                        $lookupField => $lookupValue,
                    ];
                    
                    // Agregar campos extra del mapeo si existen
                    if (isset($config['extra_fields_mapping'])) {
                        foreach ($config['extra_fields_mapping'] as $csvExtraField => $modelExtraField) {
                            $extraValue = $rowData[$csvExtraField] ?? null;
                            if ($extraValue !== null && $extraValue !== '') {
                                $newData[$modelExtraField] = trim($extraValue);
                            }
                        }
                    }
                    
                    // Si es un cliente y first_name tiene nombre completo, separar en first_name y last_name
                    if ($targetField === 'client_id' && isset($newData['first_name']) && strpos($newData['first_name'], ' ') !== false) {
                        $fullName = trim($newData['first_name']);
                        $nameParts = explode(' ', $fullName);
                        if (count($nameParts) >= 2) {
                            // Tomar las primeras 2 palabras como nombre, el resto como apellido
                            $newData['first_name'] = implode(' ', array_slice($nameParts, 0, 2));
                            $newData['last_name'] = implode(' ', array_slice($nameParts, 2));
                        } else {
                            $newData['last_name'] = '';
                        }
                    }
                    
                    // Aplicar defaults de la configuración
                    if (isset($config['defaults'])) {
                        foreach ($config['defaults'] as $defField => $defValue) {
                            if (!isset($newData[$defField]) || $newData[$defField] === '') {
                                $newData[$defField] = $defValue;
                            }
                        }
                    }
                    
                    // Crear el registro
                    $newRecord = $modelClass::create($newData);
                    $payload[$targetField] = $newRecord->id;
                    
                    // Si es un cliente, llenar también los campos de nombre y documento en la póliza
                    if ($targetField === 'client_id') {
                        $payload['client_name'] = trim(($newRecord->first_name ?? '') . ' ' . ($newRecord->last_name ?? ''));
                        $payload['client_document'] = $newRecord->document_number ?? '';
                    }
                    
                    // Si tiene name_field configurado (ej: seller_name, seller_name_2), asignar el nombre
                    if (isset($config['name_field'])) {
                        $payload[$config['name_field']] = $newRecord->nombres ?? $newRecord->nombre ?? '';
                    }
                    
                    // Registrar la auto-creación
                    if (!isset($autoCreated[$displayName])) {
                        $autoCreated[$displayName] = [];
                    }
                    $autoCreated[$displayName][] = $lookupValue;
                    
                    Log::info("Auto-creado {$displayName}: {$lookupValue}", [
                        'broker_id' => $brokerId,
                        'model' => $modelClass,
                        'id' => $newRecord->id,
                    ]);
                    
                } catch (\Throwable $e) {
                    $errors[] = [
                        'row' => $rowIndex,
                        'field' => $csvField,
                        'value' => $lookupValue,
                        'error' => "Error al crear {$displayName} '{$lookupValue}': " . $this->formatErrorMessage($e),
                    ];
                }
            } else {
                // No encontrado y auto-crear está deshabilitado
                // Si es opcional, no generar error
                if (!$isOptional) {
                    $errors[] = [
                        'row' => $rowIndex,
                        'field' => $csvField,
                        'value' => $lookupValue,
                        'error' => "{$displayName} '{$lookupValue}' no existe. Activa 'Crear automáticamente' para crearlo.",
                    ];
                }
            }
            
            // Remover el campo CSV del payload (ya se asignó el ID o se reportó error)
            unset($payload[$csvField]);
        }

        return $payload;
    }

    /**
     * Resolver campos de relación (ej: documento de cliente -> client_id) - LEGACY
     */
    private function resolveRelations(array $payload, array $relationFields, int $brokerId, int $rowIndex, array &$errors): array
    {
        foreach ($relationFields as $csvField => $config) {
            $lookupValue = $payload[$config['target_field']] ?? null;
            
            if ($lookupValue === null || $lookupValue === '') {
                continue;
            }

            $relatedModel = $config['model']::query()
                ->where($config['lookup_field'], $lookupValue)
                ->where('broker_id', $brokerId)
                ->first();

            if ($relatedModel) {
                $payload[$config['target_field']] = $relatedModel->id;
            } else {
                $errors[] = [
                    'row' => $rowIndex,
                    'field' => $csvField,
                    'value' => $lookupValue,
                    'error' => "No se encontró registro relacionado con {$config['lookup_field']} = '{$lookupValue}'",
                ];
                unset($payload[$config['target_field']]);
            }
        }

        return $payload;
    }

    /**
     * Parsear fecha
     */
    private function parseDate($value): ?string
    {
        if (empty($value)) {
            return null;
        }
        
        // Intentar varios formatos de fecha
        $formats = ['Y-m-d', 'd/m/Y', 'd-m-Y', 'm/d/Y', 'Y/m/d'];
        foreach ($formats as $format) {
            $date = \DateTime::createFromFormat($format, $value);
            if ($date !== false) {
                return $date->format('Y-m-d');
            }
        }
        
        // Intentar con strtotime como fallback
        $ts = strtotime($value);
        return $ts ? date('Y-m-d', $ts) : null;
    }

    /**
     * Parsear número
     */
    private function parseNumber($value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        
        // Remover separadores de miles y normalizar decimales
        $value = str_replace(['.', ','], ['', '.'], (string)$value);
        
        // Manejar caso de múltiples puntos (ej: 1.234.567)
        if (substr_count($value, '.') > 1) {
            $value = str_replace('.', '', $value);
        }
        
        return is_numeric($value) ? (float)$value : null;
    }

    /**
     * Parsear booleano
     */
    private function parseBoolean($value): bool
    {
        if ($value === null || $value === '') {
            return false;
        }
        
        $v = strtolower(trim((string)$value));
        return in_array($v, ['1', 'true', 'sí', 'si', 'y', 'yes', 'verdadero', 'activo', 'activa']);
    }

    /**
     * Formatear mensaje de error para el usuario
     */
    private function formatErrorMessage(\Throwable $e): string
    {
        $message = $e->getMessage();
        
        // Detectar errores comunes y dar mensajes más claros
        if (strpos($message, 'Duplicate entry') !== false) {
            preg_match("/Duplicate entry '(.+?)' for key/", $message, $matches);
            $value = $matches[1] ?? '';
            return "Registro duplicado: '{$value}' ya existe";
        }
        
        if (strpos($message, 'cannot be null') !== false) {
            preg_match("/Column '(.+?)' cannot be null/", $message, $matches);
            $field = $matches[1] ?? '';
            return "El campo '{$field}' es obligatorio y está vacío";
        }
        
        if (strpos($message, 'Data too long') !== false) {
            preg_match("/Data too long for column '(.+?)'/", $message, $matches);
            $field = $matches[1] ?? '';
            return "El valor del campo '{$field}' es demasiado largo";
        }
        
        if (strpos($message, 'Incorrect date value') !== false) {
            return "Formato de fecha inválido";
        }
        
        if (strpos($message, 'foreign key constraint') !== false) {
            return "Error de referencia: el registro relacionado no existe";
        }
        
        if (strpos($message, 'Out of range') !== false) {
            preg_match("/column '(.+?)'/", $message, $matches);
            $field = $matches[1] ?? 'desconocido';
            return "Valor numérico fuera de rango para el campo '{$field}' (verifique que los porcentajes no excedan 100)";
        }
        
        if (strpos($message, "doesn't have a default value") !== false) {
            preg_match("/Field '(.+?)'/", $message, $matches);
            $field = $matches[1] ?? 'desconocido';
            return "El campo '{$field}' es obligatorio y no tiene valor";
        }

        // Mensaje genérico pero informativo
        return "Error: " . substr($message, 0, 200);
    }

    /**
     * Extraer nombre del campo del mensaje de error
     */
    private function extractFieldFromError(string $message): ?string
    {
        // Intentar extraer el nombre del campo de varios patrones de error
        $patterns = [
            "/Column '(.+?)'/",
            "/field '(.+?)'/",
            "/for key '(.+?)'/",
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $message, $matches)) {
                return $matches[1];
            }
        }
        
        return null;
    }

    /**
     * Leer archivo tabular (CSV o XLSX) y retornar headers+rows
     */
    private function readTabularFile(string $path, ?string $ext = null): array
    {
        $ext = strtolower($ext ?? pathinfo($path, PATHINFO_EXTENSION));
        if ($ext === 'xlsx' || $ext === 'xls') {
            if (!class_exists('PhpOffice\\PhpSpreadsheet\\IOFactory')) {
                return ['success' => false, 'message' => 'XLSX no soportado: falta PhpSpreadsheet'];
            }
            try {
                $io = \PhpOffice\PhpSpreadsheet\IOFactory::load($path);
                $sheet = $io->getActiveSheet();
                $highestRow = $sheet->getHighestRow();
                $highestCol = $sheet->getHighestColumn();
                $highestColIndex = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestCol);
                $rows = [];
                for ($r = 1; $r <= $highestRow; $r++) {
                    $row = [];
                    for ($c = 1; $c <= $highestColIndex; $c++) {
                        $row[] = (string)($sheet->getCellByColumnAndRow($c, $r)->getValue());
                    }
                    $rows[] = $row;
                }
                if (empty($rows)) return ['success' => true, 'headers' => [], 'rows' => []];
                $headers = array_map('strval', $rows[0]);
                $dataRows = array_slice($rows, 1);
                return ['success' => true, 'headers' => $headers, 'rows' => $dataRows];
            } catch (\Throwable $e) {
                return ['success' => false, 'message' => $e->getMessage()];
            }
        }
        // CSV por defecto
        $h = @fopen($path, 'r');
        if (!$h) return ['success' => false, 'message' => 'No se pudo abrir archivo'];
        $firstLine = fgets($h);
        if ($firstLine === false) { fclose($h); return ['success' => true, 'headers' => [], 'rows' => []]; }
        // Detectar delimitador por ocurrencias
        $candidates = ["," , ";", "\t"]; // coma, punto y coma, tab
        $delim = ",";
        $maxParts = 0;
        foreach ($candidates as $cand) {
            $parts = str_getcsv($firstLine, $cand);
            if (count($parts) > $maxParts) { $maxParts = count($parts); $delim = $cand; }
        }
        // Procesar headers y filas restantes
        $headers = array_map('trim', str_getcsv($firstLine, $delim));
        $rows = [];
        while (($line = fgets($h)) !== false) {
            $row = str_getcsv($line, $delim);
            if ($row === null) continue;
            $rows[] = $row;
        }
        fclose($h);
        return ['success' => true, 'headers' => $headers ?: [], 'rows' => $rows];
    }

    /**
     * Descargar plantilla de importación (CSV por defecto; XLSX si disponible)
     */
    public function template(Request $request)
    {
        $entity = $request->query('entity');
        $format = strtolower($request->query('format', 'csv'));
        $meta = $this->getEntitiesMeta();
        if (!isset($meta[$entity])) {
            return response()->json(['success' => false, 'message' => 'Entidad no soportada'], 422);
        }
        $headers = $meta[$entity]['fields'] ?? [];
        $filename = 'plantilla_' . $entity . '.' . ($format === 'xlsx' ? 'xlsx' : 'csv');

        if ($format === 'xlsx') {
            if (!class_exists('PhpOffice\\PhpSpreadsheet\\Spreadsheet')) {
                $format = 'csv';
            } else {
                $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
                $sheet = $spreadsheet->getActiveSheet();
                foreach ($headers as $idx => $h) {
                    $sheet->setCellValueByColumnAndRow($idx + 1, 1, $h);
                }
                $writer = \PhpOffice\PhpSpreadsheet\IOFactory::createWriter($spreadsheet, 'Xlsx');
                return new StreamedResponse(function () use ($writer) {
                    $writer->save('php://output');
                }, 200, [
                    'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                ]);
            }
        }
        // CSV fallback
        $csv = implode(',', $headers) . "\n"; // solo encabezados
        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * Listar jobs de importación del broker autenticado
     */
    public function jobs(Request $request)
    {
        return $this->executeWithAuth($request, function ($user, $brokerId) use ($request) {
            $limit = (int) $request->query('limit', 20);
            $jobs = ImportJob::where('broker_id', $brokerId)
                ->orderBy('id', 'desc')
                ->limit($limit)
                ->get();
            return response()->json([
                'success' => true,
                'data' => $jobs,
            ]);
        });
    }

    /**
     * Obtener detalle de un job
     */
    public function showJob(Request $request, $id)
    {
        return $this->executeWithAuth($request, function ($user, $brokerId) use ($id) {
            $job = ImportJob::where('broker_id', $brokerId)->where('id', $id)->first();
            if (!$job) {
                return response()->json(['success' => false, 'message' => 'Job no encontrado'], 404);
            }
            return response()->json(['success' => true, 'data' => $job]);
        });
    }
}


