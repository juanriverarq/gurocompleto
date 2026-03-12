<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Http\Middleware\UnifiedAuthMiddleware;
use App\Models\Broker;
use App\Models\Aseguradora;
use App\Models\Ramo;
use App\Models\ComisionAseguradora;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Database\Seeders\DemoDataSeeder;

class OnboardingController extends Controller
{
    public function createBrokerWithFirebase(Request $request)
    {
        Log::info('🚀 [ONBOARDING] Iniciando createBrokerWithFirebase', [
            'headers' => $request->headers->all(),
            'data' => $request->all()
        ]);

        try {
            // Obtener el usuario autenticado del middleware
            $user = UnifiedAuthMiddleware::getAuthenticatedUser($request);
            
            if (!$user) {
                Log::error('🚀 [ONBOARDING] Usuario no autenticado');
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }

            Log::info('🚀 [ONBOARDING] Usuario autenticado', [
                'user_id' => $user->id,
                'email' => $user->email,
                'user_type' => $user->user_type
            ]);

            // Verificar si el usuario ya tiene un broker
            $existingBroker = $user->getPrimaryBroker();
            if ($existingBroker) {
                Log::warning('🚀 [ONBOARDING] Usuario ya tiene broker', [
                    'broker_id' => $existingBroker->id,
                    'broker_name' => $existingBroker->name
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'El usuario ya tiene un broker asociado',
                    'broker' => [
                        'id' => $existingBroker->id,
                        'name' => $existingBroker->name
                    ]
                ], 400);
            }

            // Validar datos del formulario
            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'document_number' => 'required|string|max:50|unique:brokers,document_number',
                'email' => 'required|email|max:255',
                'phone' => 'required|string|max:20',
                'city' => 'required|string|max:100',
                'country' => 'required|string|max:100',
                'industry' => 'required|string|max:100',
                // Campos opcionales con valores por defecto
                'legal_name' => 'nullable|string|max:255',
                'document_type' => 'nullable|string|in:NIT,CC,CE',
                'address' => 'nullable|string|max:500',
                'plan' => 'nullable|string|in:basic,professional,enterprise'
            ]);

            if ($validator->fails()) {
                Log::warning('🚀 [ONBOARDING] Validación fallida', [
                    'errors' => $validator->errors()->toArray()
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'Datos de validación incorrectos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $validatedData = $validator->validated();

            // Generar subdominio único
            $baseSubdomain = Str::slug($validatedData['name']);
            $subdomain = $baseSubdomain;
            $counter = 1;
            
            while (Broker::where('subdomain', $subdomain)->exists()) {
                $subdomain = $baseSubdomain . '-' . $counter;
                $counter++;
            }

            // Configurar características según el plan
            $plan = $validatedData['plan'] ?? 'basic';
            $planFeatures = $this->getPlanFeatures($plan);

            DB::beginTransaction();

            try {
                // Crear el broker
                $broker = Broker::create([
                    'name' => $validatedData['name'],
                    'legal_name' => $validatedData['legal_name'] ?? $validatedData['name'],
                    'document_type' => $validatedData['document_type'] ?? 'NIT',
                    'document_number' => $validatedData['document_number'],
                    'email' => $validatedData['email'],
                    'phone' => $validatedData['phone'],
                    'address' => $validatedData['address'] ?? 'No especificada',
                    'city' => $validatedData['city'],
                    'country' => $validatedData['country'],
                    'industry' => $validatedData['industry'],
                    'subdomain' => $subdomain,
                    'plan' => $plan,
                    'max_users' => $planFeatures['max_users'],
                    'max_clients' => $planFeatures['max_clients'],
                    'max_policies' => $planFeatures['max_policies'],
                    'features' => $planFeatures['features'],
                    'status' => 'trial',
                    // Cambiado a 7 días de prueba
                    'trial_ends_at' => Carbon::now()->addDays(7),
                    'owner_id' => $user->id,
                    'settings' => [
                        'timezone' => 'America/Bogota',
                        'currency' => 'COP',
                        'language' => 'es'
                    ],
                    'brand_colors' => [
                        'primary' => '#3b82f6',
                        'secondary' => '#64748b',
                        'accent' => '#10b981'
                    ]
                ]);

                // Actualizar el usuario para asociarlo al broker
                $user->update([
                    'broker_id' => $broker->id,
                    'user_type' => 'MASTER'
                ]);

                DB::commit();

                Log::info('🚀 [ONBOARDING] Broker creado exitosamente', [
                    'broker_id' => $broker->id,
                    'broker_name' => $broker->name,
                    'user_id' => $user->id,
                    'subdomain' => $subdomain
                ]);

                // Sembrar catálogos base (aseguradoras, ramos, comisiones) para este broker
                try {
                    $this->seedCatalogsForBroker($broker);
                } catch (\Throwable $se) {
                    Log::warning('🚀 [ONBOARDING] Seed de catálogos post-creación falló', [
                        'error' => $se->getMessage(),
                    ]);
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Broker creado exitosamente',
                    'data' => [
                        'broker' => [
                            'id' => $broker->id,
                            'name' => $broker->name,
                            'legal_name' => $broker->legal_name,
                            'email' => $broker->email,
                            'subdomain' => $broker->subdomain,
                            'plan' => $broker->plan,
                            'status' => $broker->status,
                            'trial_ends_at' => $broker->trial_ends_at->toISOString(),
                            'subdomain_url' => $broker->getSubdomainUrl()
                        ],
                        'user' => [
                            'id' => $user->id,
                            'name' => $user->name,
                            'email' => $user->email,
                            'user_type' => $user->user_type,
                            'broker_id' => $user->broker_id
                        ]
                    ]
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                Log::error('🚀 [ONBOARDING] Error al crear broker en base de datos', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString()
                ]);
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('🚀 [ONBOARDING] Error general en createBrokerWithFirebase', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error interno del servidor: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear broker simplificado desde el flujo de onboarding rápido
     * Solo requiere: nombre, teléfono, tipo de negocio, empleados y módulos
     */
    public function createBrokerSimplified(Request $request)
    {
        Log::info('🚀 [ONBOARDING-SIMPLE] Iniciando createBrokerSimplified', [
            'data' => $request->all()
        ]);

        try {
            $user = UnifiedAuthMiddleware::getAuthenticatedUser($request);
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }

            // Verificar si el usuario ya tiene un broker
            $existingBroker = $user->getPrimaryBroker();
            if ($existingBroker) {
                // Ya tiene broker, actualizar con los nuevos datos
                $updateData = [];
                
                if ($request->filled('phone')) {
                    $updateData['phone'] = $request->input('phone');
                }
                if ($request->filled('businessType')) {
                    $updateData['industry'] = $request->input('businessType');
                }
                if ($request->filled('employeeCount')) {
                    $employeeMap = [
                        '1' => 1, '2-5' => 5, '6-10' => 10,
                        '11-20' => 20, '21-50' => 50, '50+' => 100,
                    ];
                    $updateData['max_users'] = $employeeMap[$request->input('employeeCount')] ?? 5;
                }
                if ($request->filled('modules')) {
                    $updateData['features'] = $request->input('modules');
                    $updateData['plan'] = $this->inferPlanFromModules($request->input('modules'));
                }
                
                if (!empty($updateData)) {
                    $existingBroker->update($updateData);
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Broker actualizado',
                    'data' => [
                        'broker' => [
                            'id' => $existingBroker->id,
                            'name' => $existingBroker->name,
                        ]
                    ]
                ]);
            }

            // Validar datos mínimos
            $validator = Validator::make($request->all(), [
                'phone' => 'required|string|max:32',
                'businessType' => 'required|string|max:64',
                'employeeCount' => 'required|string|max:16',
                'modules' => 'required|array|min:1',
                'users_count' => 'nullable|integer|min:1',
                'storage_gb' => 'nullable|integer|min:1',
                'period' => 'nullable|string|in:monthly,annual',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos incompletos',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Usar users_count del pricing si viene, sino mapear employeeCount
            if ($request->filled('users_count')) {
                $maxUsers = (int) $request->input('users_count');
            } else {
                $employeeMap = [
                    '1' => 1, '2-5' => 5, '6-10' => 10,
                    '11-20' => 20, '21-50' => 50, '50+' => 100,
                ];
                $maxUsers = $employeeMap[$request->input('employeeCount')] ?? 5;
            }

            // Generar nombre del broker basado en el nombre del usuario
            $brokerName = $user->name ? $user->name . ' - Agencia' : 'Mi Agencia';
            
            // Generar subdominio único
            $baseSubdomain = Str::slug($brokerName);
            $subdomain = $baseSubdomain;
            $counter = 1;
            
            while (Broker::where('subdomain', $subdomain)->exists()) {
                $subdomain = $baseSubdomain . '-' . $counter;
                $counter++;
            }

            // Determinar plan basado en los módulos seleccionados
            $selectedModules = $request->input('modules', []);
            $plan = $this->inferPlanFromModules($selectedModules);

            DB::beginTransaction();

            try {
                $broker = Broker::create([
                    'name' => $brokerName,
                    'legal_name' => $brokerName,
                    'document_type' => 'NIT',
                    'document_number' => 'PENDIENTE-' . time(),
                    'email' => $user->email,
                    'phone' => $request->input('phone'),
                    'address' => 'Por definir',
                    'city' => 'Por definir',
                    'country' => 'Colombia',
                    'industry' => $request->input('businessType'),
                    'subdomain' => $subdomain,
                    'plan' => $plan,
                    'max_users' => $maxUsers,
                    'max_clients' => 999999,
                    'max_policies' => 999999,
                    'features' => $request->input('modules', []),
                    'status' => 'trial',
                    'trial_ends_at' => Carbon::now()->addDays(7),
                    'owner_id' => $user->id,
                    'settings' => [
                        'timezone' => 'America/Bogota',
                        'currency' => 'COP',
                        'language' => 'es',
                        'onboarding_completed' => false,
                        'storage_gb' => $request->input('storage_gb', 10),
                        'billing_period' => $request->input('period', 'monthly'),
                    ],
                    'brand_colors' => [
                        'primary' => '#3b82f6',
                        'secondary' => '#64748b',
                        'accent' => '#10b981'
                    ]
                ]);

                // Actualizar usuario
                $user->update([
                    'broker_id' => $broker->id,
                    'user_type' => 'MASTER',
                    'phone' => $request->input('phone'),
                ]);

                DB::commit();

                Log::info('🚀 [ONBOARDING-SIMPLE] Broker creado exitosamente', [
                    'broker_id' => $broker->id,
                    'user_id' => $user->id,
                ]);

                // Sembrar catálogos base
                try {
                    $this->seedCatalogsForBroker($broker);
                } catch (\Throwable $se) {
                    Log::warning('🚀 [ONBOARDING-SIMPLE] Seed de catálogos falló', [
                        'error' => $se->getMessage(),
                    ]);
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Broker creado exitosamente',
                    'data' => [
                        'broker' => [
                            'id' => $broker->id,
                            'name' => $broker->name,
                            'subdomain' => $broker->subdomain,
                            'status' => $broker->status,
                            'trial_ends_at' => $broker->trial_ends_at->toISOString(),
                        ]
                    ]
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('🚀 [ONBOARDING-SIMPLE] Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al crear el broker: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener perfil del broker (para verificar datos de onboarding)
     */
    public function getBrokerProfile(Request $request)
    {
        try {
            $user = UnifiedAuthMiddleware::getAuthenticatedUser($request);
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }

            // Support both User (getPrimaryBroker) and EmpleadoBroker (->broker)
            $broker = method_exists($user, 'getPrimaryBroker')
                ? $user->getPrimaryBroker()
                : ($user->broker ?? null);
            if (!$broker) {
                return response()->json([
                    'success' => false,
                    'message' => 'No tienes un broker asociado'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'name' => $broker->name,
                'legal_name' => $broker->legal_name,
                'document_type' => $broker->document_type ?? 'NIT',
                'document_number' => $broker->document_number,
                'phone' => $broker->phone,
                'address' => $broker->address,
                'city' => $broker->city,
                'email' => $broker->email,
                'logo_url' => $broker->getLogoUrl(),
            ]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo perfil del broker: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el perfil'
            ], 500);
        }
    }

    /**
     * Actualizar perfil del broker (para completar datos después del registro)
     */
    public function updateBrokerProfile(Request $request)
    {
        try {
            $user = UnifiedAuthMiddleware::getAuthenticatedUser($request);
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }

            // Support both User (getPrimaryBroker) and EmpleadoBroker (->broker)
            $broker = method_exists($user, 'getPrimaryBroker')
                ? $user->getPrimaryBroker()
                : ($user->broker ?? null);
            if (!$broker) {
                return response()->json([
                    'success' => false,
                    'message' => 'No tienes un broker asociado'
                ], 404);
            }

            // Validar datos
            $validator = Validator::make($request->all(), [
                'name' => 'nullable|string|max:255',
                'legal_name' => 'nullable|string|max:255',
                'document_type' => 'nullable|string|in:NIT,CC,CE',
                'document_number' => 'nullable|string|max:50',
                'phone' => 'nullable|string|max:32',
                'address' => 'nullable|string|max:500',
                'city' => 'nullable|string|max:100',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Actualizar solo los campos proporcionados
            $updateData = [];
            $fields = ['name', 'legal_name', 'document_type', 'document_number', 'phone', 'address', 'city'];
            
            foreach ($fields as $field) {
                if ($request->filled($field)) {
                    $updateData[$field] = $request->input($field);
                }
            }

            // Si se actualiza el document_number, verificar que no sea el placeholder
            if (isset($updateData['document_number']) && 
                strpos($broker->document_number, 'PENDIENTE-') === 0) {
                // Es el placeholder, permitir actualización
            }

            if (!empty($updateData)) {
                $broker->update($updateData);
                
                // Marcar onboarding como completado en settings
                $settings = $broker->settings ?? [];
                $settings['onboarding_completed'] = true;
                $broker->update(['settings' => $settings]);
            }

            Log::info('🚀 [BROKER-PROFILE] Perfil actualizado', [
                'broker_id' => $broker->id,
                'updated_fields' => array_keys($updateData),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Perfil actualizado correctamente',
                'data' => [
                    'broker' => [
                        'id' => $broker->id,
                        'name' => $broker->name,
                        'legal_name' => $broker->legal_name,
                        'document_number' => $broker->document_number,
                    ]
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('🚀 [BROKER-PROFILE] Error', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el perfil'
            ], 500);
        }
    }

    /**
     * Obtener características según el plan
     */
    private function getPlanFeatures(string $plan): array
    {
        $features = [
            'basic' => [
                'max_users' => 5,
                'max_clients' => 100,
                'max_policies' => 500,
                'features' => [
                    'client_management',
                    'policy_management',
                    'basic_reports',
                    'email_support'
                ]
            ],
            'professional' => [
                'max_users' => 20,
                'max_clients' => 500,
                'max_policies' => 2000,
                'features' => [
                    'client_management',
                    'policy_management',
                    'advanced_reports',
                    'claims_management',
                    'renewal_tracking',
                    'whatsapp_integration',
                    'email_support',
                    'phone_support'
                ]
            ],
            'enterprise' => [
                'max_users' => 100,
                'max_clients' => -1, // Sin límite
                'max_policies' => -1, // Sin límite
                'features' => [
                    'client_management',
                    'policy_management',
                    'advanced_reports',
                    'claims_management',
                    'renewal_tracking',
                    'whatsapp_integration',
                    'api_access',
                    'custom_branding',
                    'multi_office',
                    'advanced_security',
                    'email_support',
                    'phone_support',
                    'dedicated_support'
                ]
            ]
        ];

        return $features[$plan] ?? $features['basic'];
    }

    /**
     * Sembrar catálogos base para un broker nuevo
     */
    private function seedCatalogsForBroker(Broker $broker): void
    {
        $aseguradoras = [
            [ 'nombre' => 'SURA', 'nit' => '800220154-3', 'email' => 'contacto@sura.com.co', 'telefono' => '+57 1 437 8888', 'direccion' => 'Calle 100 # 11B-67, Bogotá', 'link_pago' => 'https://www.segurossura.com.co/' ],
            [ 'nombre' => 'MAPFRE', 'nit' => '800135679-1', 'email' => 'servicio.clientes@mapfre.com.co', 'telefono' => '+57 1 307 7022', 'direccion' => 'Cra. 7 #76-35, Bogotá', 'link_pago' => 'https://www.mapfre.com.co/' ],
            [ 'nombre' => 'Seguros Bolívar', 'nit' => '860013854-1', 'email' => 'servicioalcliente@segurosbolivar.com', 'telefono' => '+57 1 312 2210', 'direccion' => 'Av. El Dorado #68C-61, Bogotá', 'link_pago' => 'https://www.segurosbolivar.com/' ],
            [ 'nombre' => 'Allianz', 'nit' => '800220154-7', 'email' => 'servicioalcliente@allianz.co', 'telefono' => '+57 1 594 1170', 'direccion' => 'Calle 94 #13-11, Bogotá', 'link_pago' => 'https://www.allianz.co/' ],
            [ 'nombre' => 'AXA Colpatria', 'nit' => '860002471-3', 'email' => 'servicioalcliente@axacolpatria.co', 'telefono' => '+57 1 423 5757', 'direccion' => 'Cra. 7 #24-89, Bogotá', 'link_pago' => 'https://www.axacolpatria.co/' ],
            [ 'nombre' => 'Liberty Seguros', 'nit' => '860034594-6', 'email' => 'servicioalcliente@libertycolombia.com', 'telefono' => '+57 1 307 7050', 'direccion' => 'Calle 72 #10-07, Bogotá', 'link_pago' => 'https://www.libertycolombia.com.co/' ],
            [ 'nombre' => 'La Previsora', 'nit' => '899999063-2', 'email' => 'servicioalcliente@laprevisora.gov.co', 'telefono' => '+57 1 344 1444', 'direccion' => 'Av. 28 #66A-51, Bogotá', 'link_pago' => 'https://www.laprevisora.gov.co/' ],
            [ 'nombre' => 'La Equidad Seguros', 'nit' => '860006185-1', 'email' => 'servicioalcliente@laequidadseguros.coop', 'telefono' => '+57 1 307 7123', 'direccion' => 'Av. 28 #68B-51, Bogotá', 'link_pago' => 'https://www.laequidadseguros.coop/' ],
            [ 'nombre' => 'Seguros del Estado', 'nit' => '860002702-1', 'email' => 'servicioalcliente@segurosdelestado.com', 'telefono' => '+57 1 307 7020', 'direccion' => 'Calle 100 #19-54, Bogotá', 'link_pago' => 'https://www.segurosdelestado.com/' ],
            [ 'nombre' => 'HDI Seguros', 'nit' => '900475115-3', 'email' => 'servicioalcliente@hdi.com.co', 'telefono' => '+57 1 319 3000', 'direccion' => 'Cra. 9 #74-08, Bogotá', 'link_pago' => 'https://www.hdi.com.co/' ],
        ];

        $ramos = [
            [ 'nombre' => 'Automóvil', 'subramo' => 'Particulares' ],
            [ 'nombre' => 'Vida', 'subramo' => 'Individual' ],
            [ 'nombre' => 'Hogar', 'subramo' => 'Multirriesgo' ],
            [ 'nombre' => 'Salud', 'subramo' => 'Medicina Prepagada' ],
            [ 'nombre' => 'Empresarial', 'subramo' => 'PyME' ],
            [ 'nombre' => 'SOAT', 'subramo' => 'Obligatorio' ],
            [ 'nombre' => 'Responsabilidad Civil', 'subramo' => 'Extracontractual' ],
            [ 'nombre' => 'Todo Riesgo', 'subramo' => 'Daños Materiales' ],
            [ 'nombre' => 'Incendio', 'subramo' => 'Edificaciones' ],
            [ 'nombre' => 'Transporte', 'subramo' => 'Mercancías' ],
            [ 'nombre' => 'Accidentes Personales', 'subramo' => 'Colectivo' ],
        ];

        DB::transaction(function () use ($broker, $aseguradoras, $ramos) {
            $asegModels = [];
            foreach ($aseguradoras as $a) {
                $asegModels[] = Aseguradora::firstOrCreate([
                    'nombre' => $a['nombre'],
                    'broker_id' => $broker->id,
                ], [
                    'cuit' => $a['nit'] ?? null,
                    'email' => $a['email'] ?? null,
                    'telefono' => $a['telefono'] ?? null,
                    'direccion' => $a['direccion'] ?? null,
                    'link_pago' => $a['link_pago'] ?? null,
                    'retencion' => 0,
                    'iva' => 19,
                    'retencion_iva' => 0,
                ]);
            }

            $ramoModels = [];
            foreach ($ramos as $r) {
                $ramoModels[] = Ramo::firstOrCreate([
                    'nombre' => $r['nombre'],
                    'broker_id' => $broker->id,
                ], [
                    'subramo' => $r['subramo'],
                    'calcular_iva_pri_a_pre' => false,
                    'vista_mapa_oportunidad' => false,
                ]);
            }

            foreach ($ramoModels as $ramo) {
                foreach ($asegModels as $aseg) {
                    ComisionAseguradora::firstOrCreate([
                        'ramo_id' => $ramo->id,
                        'aseguradora_id' => $aseg->id,
                    ], [
                        'porcentaje_iva' => 0,
                        'porcentaje_comision' => 0,
                        'pri_a_pre_por_defecto' => 0,
                    ]);
                }
            }

            // Coberturas base
            $coberturas = [ 'Daños a terceros', 'Pérdida total por daños', 'Pérdida total por hurto', 'Asistencia en viaje', 'Responsabilidad civil', 'Incendio y rayo', 'Terremoto', 'Rotura de maquinaria' ];
            foreach ($coberturas as $c) {
                \App\Models\Cobertura::firstOrCreate([
                    'nombre' => $c,
                    'broker_id' => $broker->id,
                ]);
            }

            // Estados de siniestro base
            $estados = [
                ['nombre' => 'REGISTRADO', 'color' => '#64748B'],
                ['nombre' => 'EN PROCESO', 'color' => '#2563EB'],
                ['nombre' => 'ENVIADO A ASEGURADORA', 'color' => '#7C3AED'],
                ['nombre' => 'APROBADO', 'color' => '#16A34A'],
                ['nombre' => 'RECHAZADO', 'color' => '#DC2626'],
                ['nombre' => 'PENDIENTE DOCUMENTOS', 'color' => '#F59E0B'],
                ['nombre' => 'CERRADO', 'color' => '#111827'],
            ];
            foreach ($estados as $e) {
                \App\Models\EstadoSiniestro::firstOrCreate([
                    'nombre' => $e['nombre'],
                    'broker_id' => $broker->id,
                ], [
                    'color' => $e['color'],
                ]);
            }

            // Motivos de estado de póliza base
            $motivos = [
                ['nombre' => 'Falta de pago', 'cancelacion' => true, 'no_renovacion' => true, 'creacion_anexo' => false],
                ['nombre' => 'Ajuste de cobertura', 'cancelacion' => false, 'no_renovacion' => false, 'creacion_anexo' => true],
                ['nombre' => 'Cambio de aseguradora', 'cancelacion' => true, 'no_renovacion' => true, 'creacion_anexo' => false],
                ['nombre' => 'Actualización datos', 'cancelacion' => false, 'no_renovacion' => false, 'creacion_anexo' => true],
            ];
            foreach ($motivos as $m) {
                \App\Models\MotivoEstadoPoliza::firstOrCreate([
                    'nombre' => $m['nombre'],
                    'broker_id' => $broker->id,
                ], [
                    'cancelacion' => $m['cancelacion'],
                    'no_renovacion' => $m['no_renovacion'],
                    'creacion_anexo' => $m['creacion_anexo'],
                ]);
            }
        });
    }

    /**
     * Inferir el plan basado en los módulos seleccionados.
     * Coincide con PLAN_PRESETS del frontend.
     */
    private function inferPlanFromModules(array $modules): string
    {
        $starterModules = ['clientes','polizas','siniestros','renovaciones','automoviles','seguimiento','documentos','whatsapp','email','ia_callcenter','cartera','crm'];
        $professionalExtras = ['comisiones','reportes','miniweb','ia_chatbot','lector_pdf_ia'];
        $businessExtras = ['ia_chatbot_sura','marca_blanca','sitio_web','ia_predicciones','ia_ventas_cruzadas'];
        $enterpriseExtras = ['facturacion_electronica','nomina_electronica','app_movil'];

        $hasAll = function (array $keys) use ($modules) {
            foreach ($keys as $k) {
                if (!in_array($k, $modules)) return false;
            }
            return true;
        };

        // A tu medida (custom): tiene módulos exclusivos o todos
        if ($hasAll($enterpriseExtras) || count($modules) >= 25) {
            return 'custom';
        }

        // Business: tiene extras de business
        $businessHits = 0;
        foreach ($businessExtras as $k) {
            if (in_array($k, $modules)) $businessHits++;
        }
        if ($businessHits >= 2) {
            return 'business';
        }

        // Professional: tiene extras de professional
        $proHits = 0;
        foreach ($professionalExtras as $k) {
            if (in_array($k, $modules)) $proHits++;
        }
        if ($proHits >= 2) {
            return 'professional';
        }

        return 'starter';
    }
}
