<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Siniestro;
use App\Models\Broker;
use App\Models\Poliza;
use App\Models\Cliente;
use App\Models\User;
use Carbon\Carbon;

class SiniestroSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Buscar broker de prueba (ID 4 - "Mi Emprendimiento")
        $broker = Broker::find(4);
        if (!$broker) {
            $this->command->info('No se encontró el broker ID 4. Creando datos de prueba para el primer broker disponible.');
            $broker = Broker::first();
            if (!$broker) {
                $this->command->error('No hay brokers en la base de datos. Ejecuta primero los seeders de brokers.');
                return;
            }
        }

        // Obtener clientes y pólizas del broker
        $clientes = Cliente::where('broker_id', $broker->id)->get();
        $polizas = Poliza::where('broker_id', $broker->id)->get();
        $users = User::where('broker_id', $broker->id)->get();

        if ($clientes->isEmpty() || $polizas->isEmpty()) {
            $this->command->error('No hay clientes o pólizas para el broker. Ejecuta primero los seeders correspondientes.');
            return;
        }

        if ($users->isEmpty()) {
            $this->command->error('No hay usuarios para el broker. Creando usuario por defecto.');
            // Crear un usuario por defecto si no existe
            $defaultUser = User::create([
                'name' => 'Usuario Default',
                'email' => 'default@' . strtolower(str_replace(' ', '', $broker->nombre)) . '.com',
                'password' => bcrypt('password'),
                'broker_id' => $broker->id,
                'firebase_uid' => 'default_' . $broker->id,
                'email_verified_at' => now(),
                'is_active' => true,
            ]);
            $users = collect([$defaultUser]);
        }

        $this->command->info("Creando siniestros para el broker: {$broker->nombre}");

        // Datos de prueba para siniestros
        $siniestrosData = [
            [
                'tipo_seguro' => 'auto',
                'tipo_siniestro' => 'colision',
                'estado' => 'en_revision',
                'prioridad' => 'alta',
                'monto_reclamado' => 8500000,
                'descripcion_evento' => 'Colisión frontal en intersección de la Calle 72 con Carrera 15. El asegurado circulaba por la vía principal cuando otro vehículo se saltó el semáforo en rojo.',
                'lugar_ocurrencia' => 'Intersección Calle 72 con Carrera 15',
                'ciudad_ocurrencia' => 'Bogotá',
                'departamento_ocurrencia' => 'Cundinamarca',
                'aseguradora' => 'Seguros Bolívar',
                'fecha_ocurrencia' => Carbon::now()->subDays(3),
                'fecha_reporte' => Carbon::now()->subDays(2),
                'involucra_terceros' => true,
                'hay_heridos' => false,
                'hay_danos_materiales' => true,
                'datos_terceros' => 'Vehículo Chevrolet Spark 2018, Placa ABC123, Conductor: Juan Pérez, CC: 12345678',
                'danos_materiales' => 'Daños en parte frontal, parachoques, capó y faro derecho',
                'datos_vehiculo' => [
                    'marca' => 'Toyota',
                    'modelo' => 'Corolla',
                    'año' => 2020,
                    'placa' => 'XYZ789',
                    'color' => 'Blanco',
                    'cilindraje' => '1800cc'
                ],
                'testigos' => [
                    [
                        'nombre' => 'María González',
                        'telefono' => '3001234567',
                        'cedula' => '87654321'
                    ]
                ],
                'causa_siniestro' => 'Irrespeto a señal de tránsito por parte del tercero',
            ],
            [
                'tipo_seguro' => 'hogar',
                'tipo_siniestro' => 'incendio',
                'estado' => 'aprobado',
                'prioridad' => 'critica',
                'monto_reclamado' => 25000000,
                'monto_aprobado' => 22000000,
                'descripcion_evento' => 'Incendio en cocina causado por cortocircuito en electrodomésticos. El fuego se extendió a la sala y comedor antes de ser controlado por los bomberos.',
                'lugar_ocurrencia' => 'Apartamento 502, Edificio Torres del Parque',
                'ciudad_ocurrencia' => 'Medellín',
                'departamento_ocurrencia' => 'Antioquia',
                'aseguradora' => 'Suramericana',
                'fecha_ocurrencia' => Carbon::now()->subDays(15),
                'fecha_reporte' => Carbon::now()->subDays(15),
                'fecha_aprobacion' => Carbon::now()->subDays(2),
                'involucra_terceros' => false,
                'hay_heridos' => false,
                'hay_danos_materiales' => true,
                'danos_materiales' => 'Cocina completamente destruida, daños en sala y comedor, afectación en instalaciones eléctricas',
                'datos_inmueble' => [
                    'tipo' => 'Apartamento',
                    'area' => '120 m²',
                    'pisos' => 1,
                    'estrato' => 4,
                    'direccion' => 'Carrera 15 #45-30 Apt 502'
                ],
                'causa_siniestro' => 'Cortocircuito en microondas',
                'informe_investigacion' => 'La investigación determinó que el siniestro fue causado por un cortocircuito en el microondas, sin evidencia de negligencia por parte del asegurado.',
            ],
            [
                'tipo_seguro' => 'empresarial',
                'tipo_siniestro' => 'responsabilidad_civil',
                'estado' => 'pagado',
                'prioridad' => 'media',
                'monto_reclamado' => 45000000,
                'monto_aprobado' => 45000000,
                'monto_pagado' => 45000000,
                'descripcion_evento' => 'Accidente laboral en obra de construcción. Un trabajador sufrió caída desde andamio por falla en sistema de seguridad.',
                'lugar_ocurrencia' => 'Obra Constructora ABC, Proyecto Torres del Norte',
                'ciudad_ocurrencia' => 'Cali',
                'departamento_ocurrencia' => 'Valle del Cauca',
                'aseguradora' => 'Mapfre',
                'fecha_ocurrencia' => Carbon::now()->subDays(45),
                'fecha_reporte' => Carbon::now()->subDays(44),
                'fecha_aprobacion' => Carbon::now()->subDays(10),
                'fecha_pago' => Carbon::now()->subDays(5),
                'involucra_terceros' => true,
                'hay_heridos' => true,
                'hay_danos_materiales' => false,
                'datos_terceros' => 'Trabajador afectado: Carlos Ramírez, CC: 98765432, EPS: Sanitas',
                'informacion_heridos' => 'Fractura en pierna derecha, hospitalización por 15 días, incapacidad temporal de 2 meses',
                'datos_empresa' => [
                    'razon_social' => 'Constructora ABC S.A.S.',
                    'nit' => '900123456-1',
                    'actividad' => 'Construcción',
                    'num_empleados' => 150
                ],
                'causa_siniestro' => 'Falla en sistema de seguridad industrial - andamio defectuoso',
                'metodo_pago' => 'Transferencia bancaria',
                'beneficiario_pago' => 'Carlos Ramírez',
            ],
            [
                'tipo_seguro' => 'auto',
                'tipo_siniestro' => 'robo_total',
                'estado' => 'investigacion',
                'prioridad' => 'alta',
                'monto_reclamado' => 35000000,
                'descripcion_evento' => 'Hurto de vehículo en centro comercial. El asegurado reporta que dejó el vehículo en el parqueadero y al regresar ya no estaba.',
                'lugar_ocurrencia' => 'Centro Comercial Santafé, Parqueadero Nivel 3',
                'ciudad_ocurrencia' => 'Bogotá',
                'departamento_ocurrencia' => 'Cundinamarca',
                'aseguradora' => 'SURA',
                'fecha_ocurrencia' => Carbon::now()->subDays(8),
                'fecha_reporte' => Carbon::now()->subDays(7),
                'involucra_terceros' => false,
                'hay_heridos' => false,
                'hay_danos_materiales' => false,
                'datos_vehiculo' => [
                    'marca' => 'Mazda',
                    'modelo' => 'CX-5',
                    'año' => 2019,
                    'placa' => 'DEF456',
                    'color' => 'Negro',
                    'cilindraje' => '2000cc'
                ],
                'causa_siniestro' => 'Hurto en vía pública',
                'evaluacion_inicial' => 'Se requiere verificar las cámaras de seguridad del centro comercial y confirmar la denuncia ante las autoridades.',
            ],
            [
                'tipo_seguro' => 'salud',
                'tipo_siniestro' => 'hospitalizacion',
                'estado' => 'documentos_pendientes',
                'prioridad' => 'media',
                'monto_reclamado' => 12000000,
                'descripcion_evento' => 'Hospitalización de emergencia por apendicitis aguda. Cirugía laparoscópica realizada en Clínica Colombia.',
                'lugar_ocurrencia' => 'Clínica Colombia',
                'ciudad_ocurrencia' => 'Bogotá',
                'departamento_ocurrencia' => 'Cundinamarca',
                'aseguradora' => 'Colseguros',
                'fecha_ocurrencia' => Carbon::now()->subDays(12),
                'fecha_reporte' => Carbon::now()->subDays(10),
                'involucra_terceros' => false,
                'hay_heridos' => false,
                'hay_danos_materiales' => false,
                'datos_medicos' => [
                    'diagnostico' => 'Apendicitis aguda',
                    'procedimiento' => 'Apendicectomía laparoscópica',
                    'medico_tratante' => 'Dr. Roberto Silva',
                    'dias_hospitalizacion' => 3
                ],
                'causa_siniestro' => 'Enfermedad súbita',
                'documentos_pendientes' => [
                    'Historia clínica completa',
                    'Facturas de procedimientos',
                    'Epicrisis médica'
                ],
            ],
            [
                'tipo_seguro' => 'auto',
                'tipo_siniestro' => 'vandalismo',
                'estado' => 'rechazado',
                'prioridad' => 'baja',
                'monto_reclamado' => 3500000,
                'descripcion_evento' => 'Rayones en la pintura del vehículo y rotura de espejos laterales, presuntamente causados por vandalismo.',
                'lugar_ocurrencia' => 'Calle 85 con Carrera 20, frente a residencia',
                'ciudad_ocurrencia' => 'Bogotá',
                'departamento_ocurrencia' => 'Cundinamarca',
                'aseguradora' => 'AXA Colpatria',
                'fecha_ocurrencia' => Carbon::now()->subDays(20),
                'fecha_reporte' => Carbon::now()->subDays(18),
                'fecha_rechazo' => Carbon::now()->subDays(5),
                'involucra_terceros' => false,
                'hay_heridos' => false,
                'hay_danos_materiales' => true,
                'danos_materiales' => 'Rayones en pintura lateral izquierda, rotura de espejo lateral derecho',
                'causa_siniestro' => 'Presunto vandalismo',
                'motivo_rechazo' => 'No se pudo comprobar que los daños fueron causados por vandalismo. La investigación sugiere que podrían ser daños por uso normal.',
                'tipo_rechazo' => 'fuera_cobertura',
            ],
            [
                'tipo_seguro' => 'hogar',
                'tipo_siniestro' => 'daños_agua',
                'estado' => 'reportado',
                'prioridad' => 'media',
                'monto_reclamado' => 8000000,
                'descripcion_evento' => 'Filtración de agua desde apartamento superior causó daños en techos, paredes y mobiliario del apartamento asegurado.',
                'lugar_ocurrencia' => 'Apartamento 304, Conjunto Residencial Los Alcaparros',
                'ciudad_ocurrencia' => 'Bucaramanga',
                'departamento_ocurrencia' => 'Santander',
                'aseguradora' => 'Liberty Seguros',
                'fecha_ocurrencia' => Carbon::now()->subDays(1),
                'fecha_reporte' => Carbon::now(),
                'involucra_terceros' => true,
                'hay_heridos' => false,
                'hay_danos_materiales' => true,
                'datos_terceros' => 'Apartamento 404 - Propietario: Ana Martínez, CC: 45678901',
                'danos_materiales' => 'Daños en techo de cocina y sala, pared lateral, sofá y electrodomésticos',
                'causa_siniestro' => 'Rotura de tubería en apartamento superior',
            ],
            [
                'tipo_seguro' => 'vida',
                'tipo_siniestro' => 'muerte',
                'estado' => 'peritaje',
                'prioridad' => 'critica',
                'monto_reclamado' => 100000000,
                'descripcion_evento' => 'Fallecimiento del asegurado por muerte natural. Beneficiarios solicitan pago de póliza de vida.',
                'lugar_ocurrencia' => 'Hospital San Ignacio',
                'ciudad_ocurrencia' => 'Bogotá',
                'departamento_ocurrencia' => 'Cundinamarca',
                'aseguradora' => 'Seguros del Estado',
                'fecha_ocurrencia' => Carbon::now()->subDays(25),
                'fecha_reporte' => Carbon::now()->subDays(23),
                'involucra_terceros' => false,
                'hay_heridos' => false,
                'hay_danos_materiales' => false,
                'datos_medicos' => [
                    'causa_muerte' => 'Infarto agudo de miocardio',
                    'medico_tratante' => 'Dr. Luis Fernández',
                    'hospital' => 'Hospital San Ignacio'
                ],
                'causa_siniestro' => 'Muerte natural',
                'informe_peritaje' => 'En proceso de verificación de causa de muerte y validación de beneficiarios.',
            ],
            [
                'tipo_seguro' => 'auto',
                'tipo_siniestro' => 'granizo',
                'estado' => 'asignado',
                'prioridad' => 'media',
                'monto_reclamado' => 4500000,
                'descripcion_evento' => 'Daños en carrocería y vidrios causados por granizada intensa en la ciudad. Múltiples vehículos afectados en la zona.',
                'lugar_ocurrencia' => 'Zona Rosa, Chapinero',
                'ciudad_ocurrencia' => 'Bogotá',
                'departamento_ocurrencia' => 'Cundinamarca',
                'aseguradora' => 'HDI Seguros',
                'fecha_ocurrencia' => Carbon::now()->subDays(5),
                'fecha_reporte' => Carbon::now()->subDays(4),
                'fecha_asignacion' => Carbon::now()->subDays(1),
                'involucra_terceros' => false,
                'hay_heridos' => false,
                'hay_danos_materiales' => true,
                'danos_materiales' => 'Abolladuras en capó y techo, vidrio panorámico rajado',
                'datos_vehiculo' => [
                    'marca' => 'Nissan',
                    'modelo' => 'Sentra',
                    'año' => 2021,
                    'placa' => 'GHI789',
                    'color' => 'Azul',
                    'cilindraje' => '1600cc'
                ],
                'causa_siniestro' => 'Fenómeno natural - granizada',
            ],
            [
                'tipo_seguro' => 'empresarial',
                'tipo_siniestro' => 'incendio',
                'estado' => 'cerrado',
                'prioridad' => 'alta',
                'monto_reclamado' => 80000000,
                'monto_aprobado' => 75000000,
                'monto_pagado' => 75000000,
                'descripcion_evento' => 'Incendio en bodega de almacenamiento causó pérdida total de mercancía y daños estructurales en el edificio.',
                'lugar_ocurrencia' => 'Bodega Industrial, Zona Franca',
                'ciudad_ocurrencia' => 'Barranquilla',
                'departamento_ocurrencia' => 'Atlántico',
                'aseguradora' => 'QBE Seguros',
                'fecha_ocurrencia' => Carbon::now()->subDays(60),
                'fecha_reporte' => Carbon::now()->subDays(59),
                'fecha_aprobacion' => Carbon::now()->subDays(20),
                'fecha_pago' => Carbon::now()->subDays(15),
                'fecha_cierre' => Carbon::now()->subDays(10),
                'involucra_terceros' => false,
                'hay_heridos' => false,
                'hay_danos_materiales' => true,
                'danos_materiales' => 'Pérdida total de mercancía, daños estructurales en 60% del edificio',
                'datos_empresa' => [
                    'razon_social' => 'Distribuidora del Caribe Ltda.',
                    'nit' => '800987654-2',
                    'actividad' => 'Distribución de productos',
                    'area_afectada' => '2000 m²'
                ],
                'causa_siniestro' => 'Cortocircuito en sistema eléctrico',
                'metodo_pago' => 'Transferencia bancaria',
                'beneficiario_pago' => 'Distribuidora del Caribe Ltda.',
                'dictamen_final' => 'Siniestro procedente. Pago autorizado por $75,000,000 COP.',
                'cliente_satisfecho' => true,
                'calificacion_servicio' => 5,
            ]
        ];

        // Crear los siniestros
        foreach ($siniestrosData as $index => $data) {
            $cliente = $clientes->random();
            $poliza = $polizas->where('cliente_id', $cliente->id)->first() ?? $polizas->random();
            $createdBy = $users->first();
            $adjuster = $users->count() > 1 ? $users->where('id', '!=', $createdBy->id)->first() : $createdBy;

            // Generar número de siniestro
            $numeroSiniestro = 'SIN-2024-' . str_pad($index + 1, 3, '0', STR_PAD_LEFT);

            // Calcular días en trámite
            $fechaReporte = $data['fecha_reporte'];
            $diasTramite = $fechaReporte->diffInDays(now());

            // Crear historial de estados
            $historialEstados = [
                [
                    'estado_anterior' => '',
                    'nuevo_estado' => 'reportado',
                    'fecha' => $fechaReporte->toISOString(),
                    'observacion' => 'Siniestro reportado inicialmente',
                    'usuario_id' => $createdBy->id,
                ]
            ];

            // Agregar estados adicionales según el estado actual
            if (in_array($data['estado'], ['asignado', 'en_revision', 'investigacion', 'peritaje', 'aprobado', 'pagado', 'cerrado', 'rechazado'])) {
                $historialEstados[] = [
                    'estado_anterior' => 'reportado',
                    'nuevo_estado' => 'asignado',
                    'fecha' => $fechaReporte->addHours(2)->toISOString(),
                    'observacion' => 'Asignado a ajustador para revisión inicial',
                    'usuario_id' => $createdBy->id,
                ];
            }

            if (in_array($data['estado'], ['en_revision', 'investigacion', 'peritaje', 'aprobado', 'pagado', 'cerrado'])) {
                $historialEstados[] = [
                    'estado_anterior' => 'asignado',
                    'nuevo_estado' => 'en_revision',
                    'fecha' => $fechaReporte->addHours(6)->toISOString(),
                    'observacion' => 'Iniciada revisión de documentos',
                    'usuario_id' => $adjuster->id,
                ];
            }

            // Crear comunicaciones
            $comunicaciones = [
                [
                    'tipo' => 'llamada',
                    'contenido' => 'Contacto inicial con el asegurado para confirmar detalles del siniestro',
                    'fecha' => $fechaReporte->addHours(1)->toISOString(),
                    'usuario_id' => $createdBy->id,
                ],
                [
                    'tipo' => 'email',
                    'contenido' => 'Envío de formulario de reclamación y lista de documentos requeridos',
                    'fecha' => $fechaReporte->addHours(3)->toISOString(),
                    'usuario_id' => $createdBy->id,
                ]
            ];

            // Crear observaciones
            $observaciones = [
                [
                    'contenido' => 'Cliente colaborativo, aportó toda la información solicitada de manera oportuna',
                    'fecha' => $fechaReporte->addHours(4)->toISOString(),
                    'usuario_id' => $adjuster->id,
                ]
            ];

            $siniestro = Siniestro::create([
                'broker_id' => $broker->id,
                'poliza_id' => $poliza->id,
                'cliente_id' => $cliente->id,
                'assigned_adjuster_id' => in_array($data['estado'], ['asignado', 'en_revision', 'investigacion', 'peritaje', 'aprobado', 'pagado', 'cerrado']) ? $adjuster->id : null,
                'created_by' => $createdBy->id,
                'numero_siniestro' => $numeroSiniestro,
                'numero_poliza' => $poliza->numero_poliza ?? 'POL-2024-' . str_pad($poliza->id, 3, '0', STR_PAD_LEFT),
                'fecha_ultimo_estado' => isset($data['fecha_pago']) ? $data['fecha_pago'] : 
                                        (isset($data['fecha_aprobacion']) ? $data['fecha_aprobacion'] : 
                                        (isset($data['fecha_rechazo']) ? $data['fecha_rechazo'] : now())),
                'pais_ocurrencia' => 'Colombia',
                'total_documentos' => rand(3, 8),
                'dias_tramite' => $diasTramite,
                'dias_investigacion' => in_array($data['estado'], ['investigacion', 'peritaje']) ? rand(5, 15) : 0,
                'dias_aprobacion' => isset($data['fecha_aprobacion']) ? $fechaReporte->diffInDays($data['fecha_aprobacion']) : 0,
                'dias_pago' => isset($data['fecha_pago']) ? ($data['fecha_aprobacion'] ?? $fechaReporte)->diffInDays($data['fecha_pago']) : 0,
                'historial_estados' => $historialEstados,
                'comunicaciones' => $comunicaciones,
                'observaciones' => $observaciones,
                'porcentaje_aprobacion' => isset($data['monto_aprobado']) ? ($data['monto_aprobado'] / $data['monto_reclamado']) * 100 : null,
            ] + $data);

            $this->command->info("Creado siniestro: {$numeroSiniestro} - {$data['tipo_siniestro']} ({$data['estado']})");
        }

        $this->command->info("Se crearon " . count($siniestrosData) . " siniestros de prueba para el broker {$broker->nombre}");
    }
}
