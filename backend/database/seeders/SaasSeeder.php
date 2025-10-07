<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\SaaS\BrokerTenant;
use App\Models\SaaS\SaasUsuario;
use App\Models\SaaS\SaasCliente;
use App\Models\SaaS\SaasRolPersonalizado;

class SaasSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Crear usuarios master (cuentas principales)
        $userMasters = [
            [
                'name' => 'Carlos Rodríguez',
                'email' => 'carlos@segurosintegrales.com',
                'password' => Hash::make('master123'),
                'status' => 'active',
                'email_verified_at' => now(),
            ],
            [
                'name' => 'Ana Martínez',
                'email' => 'ana@corredoresunidos.com',
                'password' => Hash::make('master123'),
                'status' => 'active',
                'email_verified_at' => now(),
            ],
            [
                'name' => 'Luis Pérez',
                'email' => 'luis@asesoraensegurosprez.com',
                'password' => Hash::make('master123'),
                'status' => 'active',
                'email_verified_at' => now(),
            ],
        ];

        $usuarios = [];
        foreach ($userMasters as $userData) {
            $usuarios[] = User::create($userData);
        }

        // 2. Crear brokers y conectarlos con usuarios master
        $brokers = [
            [
                'owner_user_id' => $usuarios[0]->id,
                'nombre' => 'Seguros Integrales',
                'nit' => '900123456-1',
                'email' => 'contacto@segurosintegrales.com',
                'telefono' => '+57 1 234 5678',
                'direccion' => 'Calle 100 # 15-20',
                'ciudad' => 'Bogotá',
                'pais' => 'Colombia',
                'dominio' => 'segurosintegrales.guro.app',
                'estado' => 'ACTIVO',
                'plan' => 'enterprise',
                'branding' => [
                    'logo' => null,
                    'favicon' => null,
                    'colores' => [
                        'primario' => '#2563EB',
                        'secundario' => '#64748B',
                        'acento' => '#059669'
                    ],
                    'nombre_comercial' => 'Seguros Integrales',
                    'slogan' => 'Tu seguridad, nuestra prioridad'
                ],
                'configuraciones' => [
                    'modulos_activos' => ['dashboard', 'clientes', 'polizas', 'siniestros', 'comisiones', 'reportes', 'usuarios', 'configuracion'],
                    'limites' => [
                        'usuarios' => -1,
                        'clientes' => -1,
                        'polizas_mes' => -1,
                        'almacenamiento_gb' => 500
                    ],
                    'integraciones' => [
                        'email' => true,
                        'sms' => true,
                        'sms' => true,
                        'apis_aseguradoras' => ['sura', 'bolivar', 'mapfre']
                    ]
                ],
                'facturacion' => [
                    'plan_actual' => 'enterprise',
                    'fecha_vencimiento' => now()->addMonth()->toDateString(),
                    'metodo_pago' => 'tarjeta_credito',
                    'estado_pago' => 'AL_DIA'
                ]
            ],
            [
                'owner_user_id' => $usuarios[1]->id,
                'nombre' => 'Corredores Unidos',
                'nit' => '900234567-2',
                'email' => 'info@corredoresunidos.com',
                'telefono' => '+57 4 567 8901',
                'direccion' => 'Carrera 70 # 45-30',
                'ciudad' => 'Medellín',
                'pais' => 'Colombia',
                'dominio' => 'corredoresunidos.guro.app',
                'estado' => 'ACTIVO',
                'plan' => 'professional',
                'branding' => [
                    'logo' => null,
                    'favicon' => null,
                    'colores' => [
                        'primario' => '#DC2626',
                        'secundario' => '#64748B',
                        'acento' => '#7C3AED'
                    ],
                    'nombre_comercial' => 'Corredores Unidos',
                    'slogan' => 'Unidos por tu tranquilidad'
                ],
                'configuraciones' => [
                    'modulos_activos' => ['dashboard', 'clientes', 'polizas', 'siniestros', 'comisiones', 'usuarios'],
                    'limites' => [
                        'usuarios' => 25,
                        'clientes' => 10000,
                        'polizas_mes' => 1000,
                        'almacenamiento_gb' => 50
                    ],
                    'integraciones' => [
                        'email' => true,
                        'sms' => false,
                        'apis_aseguradoras' => ['sura', 'bolivar']
                    ]
                ],
                'facturacion' => [
                    'plan_actual' => 'professional',
                    'fecha_vencimiento' => now()->addMonth()->toDateString(),
                    'metodo_pago' => 'transferencia',
                    'estado_pago' => 'AL_DIA'
                ]
            ],
            [
                'owner_user_id' => $usuarios[2]->id,
                'nombre' => 'Asesora en Seguros Pérez',
                'nit' => '900345678-3',
                'email' => 'contacto@asesoraensegurosprez.com',
                'telefono' => '+57 7 890 1234',
                'direccion' => 'Avenida 19 # 123-45',
                'ciudad' => 'Bucaramanga',
                'pais' => 'Colombia',
                'dominio' => 'asesoraensegurosprez.guro.app',
                'estado' => 'ACTIVO',
                'plan' => 'basic',
                'branding' => [
                    'logo' => null,
                    'favicon' => null,
                    'colores' => [
                        'primario' => '#059669',
                        'secundario' => '#64748B',
                        'acento' => '#F59E0B'
                    ],
                    'nombre_comercial' => 'Asesora en Seguros Pérez',
                    'slogan' => 'Asesoría personalizada'
                ],
                'configuraciones' => [
                    'modulos_activos' => ['dashboard', 'clientes', 'polizas', 'usuarios'],
                    'limites' => [
                        'usuarios' => 5,
                        'clientes' => 1000,
                        'polizas_mes' => 100,
                        'almacenamiento_gb' => 5
                    ],
                    'integraciones' => [
                        'email' => true,
                        'sms' => false,
                        'apis_aseguradoras' => ['sura']
                    ]
                ],
                'facturacion' => [
                    'plan_actual' => 'basic',
                    'fecha_vencimiento' => now()->addMonth()->toDateString(),
                    'metodo_pago' => 'efectivo',
                    'estado_pago' => 'AL_DIA'
                ]
            ]
        ];

        $brokerTenants = [];
        foreach ($brokers as $brokerData) {
            $brokerTenants[] = BrokerTenant::create($brokerData);
        }

        // 3. Crear usuarios SaaS (empleados de cada broker)
        $saasUsuarios = [
            // Seguros Integrales (Enterprise) - 7 usuarios
            [
                'broker_id' => $brokerTenants[0]->id,
                'email' => 'admin@segurosintegrales.com',
                'password' => Hash::make('password123'),
                'nombre' => 'María',
                'apellidos' => 'García',
                'telefono' => '+57 300 123 4567',
                'rol' => 'super_admin',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[0]->id,
                'email' => 'supervisor@segurosintegrales.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Juan',
                'apellidos' => 'López',
                'telefono' => '+57 300 234 5678',
                'rol' => 'supervisor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[0]->id,
                'email' => 'asesor1@segurosintegrales.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Ana',
                'apellidos' => 'Martínez',
                'telefono' => '+57 300 345 6789',
                'rol' => 'asesor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[0]->id,
                'email' => 'asesor2@segurosintegrales.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Pedro',
                'apellidos' => 'Hernández',
                'telefono' => '+57 300 456 7890',
                'rol' => 'asesor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[0]->id,
                'email' => 'asesor3@segurosintegrales.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Laura',
                'apellidos' => 'Gómez',
                'telefono' => '+57 300 567 8901',
                'rol' => 'asesor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[0]->id,
                'email' => 'vendedor@segurosintegrales.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Carlos',
                'apellidos' => 'Ruiz',
                'telefono' => '+57 300 678 9012',
                'rol' => 'vendedor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[0]->id,
                'email' => 'admin2@segurosintegrales.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Sofia',
                'apellidos' => 'Torres',
                'telefono' => '+57 300 789 0123',
                'rol' => 'admin',
                'estado' => 'ACTIVO',
            ],

            // Corredores Unidos (Professional) - 7 usuarios
            [
                'broker_id' => $brokerTenants[1]->id,
                'email' => 'admin@corredoresunidos.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Roberto',
                'apellidos' => 'Jiménez',
                'telefono' => '+57 310 123 4567',
                'rol' => 'super_admin',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[1]->id,
                'email' => 'supervisor@corredoresunidos.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Elena',
                'apellidos' => 'Vargas',
                'telefono' => '+57 310 234 5678',
                'rol' => 'supervisor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[1]->id,
                'email' => 'asesor1@corredoresunidos.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Miguel',
                'apellidos' => 'Castro',
                'telefono' => '+57 310 345 6789',
                'rol' => 'asesor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[1]->id,
                'email' => 'asesor2@corredoresunidos.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Lucía',
                'apellidos' => 'Morales',
                'telefono' => '+57 310 456 7890',
                'rol' => 'asesor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[1]->id,
                'email' => 'asesor3@corredoresunidos.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Diego',
                'apellidos' => 'Ramírez',
                'telefono' => '+57 310 567 8901',
                'rol' => 'asesor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[1]->id,
                'email' => 'vendedor@corredoresunidos.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Carmen',
                'apellidos' => 'Ortega',
                'telefono' => '+57 310 678 9012',
                'rol' => 'vendedor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[1]->id,
                'email' => 'admin2@corredoresunidos.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Andrés',
                'apellidos' => 'Mendoza',
                'telefono' => '+57 310 789 0123',
                'rol' => 'admin',
                'estado' => 'ACTIVO',
            ],

            // Asesora en Seguros Pérez (Basic) - 7 usuarios
            [
                'broker_id' => $brokerTenants[2]->id,
                'email' => 'admin@asesoraensegurosprez.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Patricia',
                'apellidos' => 'Pérez',
                'telefono' => '+57 320 123 4567',
                'rol' => 'super_admin',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[2]->id,
                'email' => 'supervisor@asesoraensegurosprez.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Fernando',
                'apellidos' => 'Silva',
                'telefono' => '+57 320 234 5678',
                'rol' => 'supervisor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[2]->id,
                'email' => 'asesor1@asesoraensegurosprez.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Gabriela',
                'apellidos' => 'Ramos',
                'telefono' => '+57 320 345 6789',
                'rol' => 'asesor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[2]->id,
                'email' => 'asesor2@asesoraensegurosprez.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Javier',
                'apellidos' => 'Aguilar',
                'telefono' => '+57 320 456 7890',
                'rol' => 'asesor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[2]->id,
                'email' => 'asesor3@asesoraensegurosprez.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Valeria',
                'apellidos' => 'Herrera',
                'telefono' => '+57 320 567 8901',
                'rol' => 'asesor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[2]->id,
                'email' => 'vendedor@asesoraensegurosprez.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Esteban',
                'apellidos' => 'Vega',
                'telefono' => '+57 320 678 9012',
                'rol' => 'vendedor',
                'estado' => 'ACTIVO',
            ],
            [
                'broker_id' => $brokerTenants[2]->id,
                'email' => 'admin2@asesoraensegurosprez.com',
                'password' => Hash::make('password123'),
                'nombre' => 'Camila',
                'apellidos' => 'Rojas',
                'telefono' => '+57 320 789 0123',
                'rol' => 'admin',
                'estado' => 'ACTIVO',
            ],
        ];

        $usuariosSaas = [];
        foreach ($saasUsuarios as $userData) {
            $usuariosSaas[] = SaasUsuario::create($userData);
        }

        // Crear clientes para cada broker
        foreach ($brokerTenants as $broker) {
            $this->crearClientes($broker);
            $this->crearRolesPersonalizados($broker);
        }
    }

    private function crearClientes(BrokerTenant $broker): void
    {
        $asesores = SaasUsuario::where('broker_id', $broker->id)
            ->whereIn('rol', ['asesor', 'vendedor'])
            ->get();

        // Clientes tipo PERSONA
        $personas = [
            [
                'email' => 'juan.perez@email.com',
                'telefono' => '+57 310 123 4567',
                'direccion' => 'Calle 45 # 12-34 Apto 501',
                'ciudad' => 'Bogotá',
                'departamento' => 'Cundinamarca',
                'origen' => 'REFERIDO',
                'persona' => [
                    'nombres' => 'Juan Carlos',
                    'apellidos' => 'Pérez González',
                    'tipo_documento' => 'CC',
                    'numero_documento' => '12345678',
                    'fecha_nacimiento' => '1985-03-15',
                    'genero' => 'M',
                    'estado_civil' => 'Casado',
                    'profesion' => 'Ingeniero',
                    'ingresos_mensuales' => 5000000
                ],
                'tags' => ['vip', 'referido']
            ],
            [
                'email' => 'maria.rodriguez@email.com',
                'telefono' => '+57 311 234 5678',
                'direccion' => 'Carrera 15 # 67-89 Casa 12',
                'ciudad' => 'Medellín',
                'departamento' => 'Antioquia',
                'origen' => 'WEB',
                'persona' => [
                    'nombres' => 'María Fernanda',
                    'apellidos' => 'Rodríguez Silva',
                    'tipo_documento' => 'CC',
                    'numero_documento' => '87654321',
                    'fecha_nacimiento' => '1990-07-22',
                    'genero' => 'F',
                    'estado_civil' => 'Soltera',
                    'profesion' => 'Abogada',
                    'ingresos_mensuales' => 4500000
                ],
                'tags' => ['prospecto']
            ]
        ];

        foreach ($personas as $personaData) {
            SaasCliente::create([
                'broker_id' => $broker->id,
                'tipo' => 'PERSONA',
                'estado' => 'ACTIVO',
                'email' => $personaData['email'],
                'telefono' => $personaData['telefono'],
                'direccion' => $personaData['direccion'],
                'ciudad' => $personaData['ciudad'],
                'departamento' => $personaData['departamento'],
                'pais' => 'Colombia',
                'asesor_asignado_id' => $asesores->random()->id,
                'fecha_asignacion' => now(),
                'origen' => $personaData['origen'],
                'persona' => $personaData['persona'],
                'tags' => $personaData['tags'],
                'fecha_ultima_actividad' => now()
            ]);
        }

        // Clientes tipo EMPRESA
        $empresas = [
            [
                'email' => 'contacto@techsolutions.com',
                'telefono' => '+57 1 234 5678',
                'direccion' => 'Zona Franca Bogotá Lote 15',
                'ciudad' => 'Bogotá',
                'departamento' => 'Cundinamarca',
                'origen' => 'PRESENCIAL',
                'empresa' => [
                    'razon_social' => 'Tech Solutions S.A.S.',
                    'nit' => '900111222-3',
                    'tipo_empresa' => 'PRIVADA',
                    'sector_economico' => 'Tecnología',
                    'actividad_economica' => 'Desarrollo de software',
                    'numero_empleados' => 50,
                    'ingresos_anuales' => 2000000000,
                    'representante_legal' => [
                        'nombres' => 'Roberto',
                        'apellidos' => 'Jiménez',
                        'documento' => '98765432',
                        'telefono' => '+57 312 345 6789',
                        'email' => 'roberto.jimenez@techsolutions.com'
                    ]
                ],
                'tags' => ['corporativo', 'tecnologia']
            ]
        ];

        foreach ($empresas as $empresaData) {
            SaasCliente::create([
                'broker_id' => $broker->id,
                'tipo' => 'EMPRESA',
                'estado' => 'ACTIVO',
                'email' => $empresaData['email'],
                'telefono' => $empresaData['telefono'],
                'direccion' => $empresaData['direccion'],
                'ciudad' => $empresaData['ciudad'],
                'departamento' => $empresaData['departamento'],
                'pais' => 'Colombia',
                'asesor_asignado_id' => $asesores->random()->id,
                'fecha_asignacion' => now(),
                'origen' => $empresaData['origen'],
                'empresa' => $empresaData['empresa'],
                'tags' => $empresaData['tags'],
                'fecha_ultima_actividad' => now()
            ]);
        }

        // Cliente tipo CONSORCIO
        SaasCliente::create([
            'broker_id' => $broker->id,
            'tipo' => 'CONSORCIO',
            'estado' => 'ACTIVO',
            'email' => 'info@consorcioobras.com',
            'telefono' => '+57 1 345 6789',
            'direccion' => 'Calle 80 # 10-20 Oficina 1001',
            'ciudad' => 'Bogotá',
            'departamento' => 'Cundinamarca',
            'pais' => 'Colombia',
            'asesor_asignado_id' => $asesores->random()->id,
            'fecha_asignacion' => now(),
            'origen' => 'TELEFONO',
            'consorcio' => [
                'nombre_consorcio' => 'Consorcio Obras Civiles 2024',
                'nit' => '900333444-5',
                'objeto_consorcio' => 'Construcción de infraestructura vial',
                'fecha_constitucion' => '2024-01-15',
                'plazo_duracion' => '24 meses',
                'empresas_miembro' => [
                    [
                        'razon_social' => 'Constructora ABC S.A.S.',
                        'nit' => '900111333-1',
                        'participacion' => 60
                    ],
                    [
                        'razon_social' => 'Ingeniería XYZ Ltda.',
                        'nit' => '800222444-2',
                        'participacion' => 40
                    ]
                ],
                'representante_legal' => [
                    'nombres' => 'Fernando',
                    'apellidos' => 'Vargas',
                    'documento' => '11223344',
                    'telefono' => '+57 313 456 7890',
                    'email' => 'fernando.vargas@consorcioobras.com'
                ]
            ],
            'tags' => ['consorcio', 'construccion', 'gobierno'],
            'fecha_ultima_actividad' => now()
        ]);
    }

    private function crearRolesPersonalizados(BrokerTenant $broker): void
    {
        // Rol personalizado: Asesor Senior
        SaasRolPersonalizado::create([
            'broker_id' => $broker->id,
            'nombre' => 'Asesor Senior',
            'descripcion' => 'Asesor con permisos extendidos para gestión de clientes corporativos',
            'permisos' => [
                'dashboard' => [
                    'ver_metricas_generales' => false,
                    'ver_metricas_equipo' => true,
                    'ver_metricas_propias' => true
                ],
                'clientes' => [
                    'ver_todos' => false,
                    'ver_propios' => true,
                    'ver_equipo' => true,
                    'crear' => true,
                    'editar' => true,
                    'eliminar' => false,
                    'exportar' => true,
                    'importar' => false
                ],
                'polizas' => [
                    'ver_todas' => false,
                    'ver_propias' => true,
                    'ver_equipo' => true,
                    'crear' => true,
                    'editar' => true,
                    'eliminar' => false,
                    'renovar' => true,
                    'cancelar' => false
                ],
                'siniestros' => [
                    'ver_todos' => false,
                    'ver_propios' => true,
                    'crear' => true,
                    'gestionar' => true
                ],
                'comisiones' => [
                    'ver_propias' => true,
                    'ver_equipo' => true,
                    'ver_todas' => false,
                    'gestionar' => false
                ],
                'reportes' => [
                    'generar' => true,
                    'ver_financieros' => false,
                    'exportar' => true
                ],
                'usuarios' => [
                    'ver' => false,
                    'crear' => false,
                    'editar' => false,
                    'eliminar' => false,
                    'gestionar_roles' => false
                ],
                'configuracion' => [
                    'empresa' => false,
                    'sistema' => false,
                    'integraciones' => false,
                    'facturacion' => false
                ]
            ],
            'es_predeterminado' => true
        ]);

        // Rol personalizado: Asistente Administrativo
        SaasRolPersonalizado::create([
            'broker_id' => $broker->id,
            'nombre' => 'Asistente Administrativo',
            'descripcion' => 'Rol para personal administrativo con acceso limitado',
            'permisos' => [
                'dashboard' => [
                    'ver_metricas_generales' => false,
                    'ver_metricas_equipo' => false,
                    'ver_metricas_propias' => true
                ],
                'clientes' => [
                    'ver_todos' => true,
                    'ver_propios' => true,
                    'ver_equipo' => true,
                    'crear' => false,
                    'editar' => false,
                    'eliminar' => false,
                    'exportar' => false,
                    'importar' => false
                ],
                'polizas' => [
                    'ver_todas' => true,
                    'ver_propias' => true,
                    'ver_equipo' => true,
                    'crear' => false,
                    'editar' => false,
                    'eliminar' => false,
                    'renovar' => false,
                    'cancelar' => false
                ],
                'siniestros' => [
                    'ver_todos' => true,
                    'ver_propios' => true,
                    'crear' => false,
                    'gestionar' => false
                ],
                'comisiones' => [
                    'ver_propias' => false,
                    'ver_equipo' => false,
                    'ver_todas' => false,
                    'gestionar' => false
                ],
                'reportes' => [
                    'generar' => false,
                    'ver_financieros' => false,
                    'exportar' => false
                ],
                'usuarios' => [
                    'ver' => false,
                    'crear' => false,
                    'editar' => false,
                    'eliminar' => false,
                    'gestionar_roles' => false
                ],
                'configuracion' => [
                    'empresa' => false,
                    'sistema' => false,
                    'integraciones' => false,
                    'facturacion' => false
                ]
            ],
            'es_predeterminado' => false
        ]);
    }

    private function generateEmailDomain(string $nombre): string
    {
        // Remover caracteres especiales y espacios
        $domain = strtolower($nombre);
        $domain = str_replace(['s.a.s.', 'ltda.', 'ltda', 's.a.s', '.'], '', $domain);
        $domain = preg_replace('/[^a-z0-9]/', '', $domain);
        
        return $domain . '.com';
    }
} 