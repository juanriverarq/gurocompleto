<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\SaaS\SaasPoliza;
use App\Models\SaaS\BrokerTenant;
use App\Models\SaaS\SaasUsuario;
use App\Models\SaaS\SaasCliente;
use Carbon\Carbon;

class SaasPolizasSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Obtener todos los brokers
        $brokers = BrokerTenant::all();
        
        if ($brokers->isEmpty()) {
            echo "❌ No hay brokers. Ejecuta primero: php artisan db:seed --class=SaasSeeder\n";
            return;
        }

        // Datos base para pólizas
        $aseguradoras = [
            'Seguros Sura', 'Mapfre', 'Bolívar Seguros', 'La Previsora', 
            'AXA Colpatria', 'Allianz', 'Liberty Seguros', 'Solidaria', 
            'La Equidad', 'Mundial'
        ];

        $ramos = [
            'Vida', 'Automóvil', 'Hogar', 'Salud', 'Empresarial', 'SOAT',
            'Responsabilidad Civil', 'Todo Riesgo', 'Incendio', 'Transporte',
            'Accidentes Personales'
        ];

        $estados = ['ACTIVA', 'VENCIDA', 'CANCELADA', 'SUSPENDIDA'];
        $tiposDocumento = ['CC', 'CE', 'NIT', 'TI', 'PP'];

        $totalPolizasCreadas = 0;

        foreach ($brokers as $broker) {
            echo "🏢 Creando pólizas para {$broker->nombre}...\n";
            
            // Obtener usuarios del broker
            $usuarios = SaasUsuario::where('broker_id', $broker->id)->get();
            if ($usuarios->isEmpty()) {
                echo "⚠️  No hay usuarios para {$broker->nombre}\n";
                continue;
            }

            // Obtener clientes del broker
            $clientes = SaasCliente::where('broker_id', $broker->id)->get();

            // Crear entre 5-15 pólizas por broker
            $numPolizas = rand(5, 15);
            
            for ($i = 1; $i <= $numPolizas; $i++) {
                $fechaExpedicion = Carbon::now()->subDays(rand(1, 365));
                $fechaInicio = $fechaExpedicion->copy()->addDays(rand(1, 30));
                $fechaFin = $fechaInicio->copy()->addYear();

                // Determinar estado basado en fechas
                $estado = 'ACTIVA';
                if ($fechaFin->isPast()) {
                    $estado = rand(1, 10) > 8 ? 'VENCIDA' : 'ACTIVA';
                }
                if (rand(1, 20) === 1) {
                    $estado = 'CANCELADA';
                }

                $primaNeta = rand(100000, 5000000);
                $porcentajeIva = 19.00;
                $iva = ($primaNeta * $porcentajeIva) / 100;
                $total = $primaNeta + $iva;

                // Seleccionar cliente aleatorio o crear datos independientes
                $clienteId = null;
                $nombresCliente = collect(['Juan', 'María', 'Carlos', 'Ana', 'Luis', 'Carmen', 'José', 'Laura', 'Miguel', 'Patricia'])->random();
                $apellidosCliente = collect(['García López', 'Martínez Silva', 'Rodríguez Pérez', 'González Ruiz', 'Hernández Castro'])->random();
                $dniCliente = str_pad(rand(10000000, 99999999), 8, '0', STR_PAD_LEFT);

                if ($clientes->isNotEmpty() && rand(1, 3) === 1) {
                    // 33% de probabilidad de vincular con cliente existente
                    $cliente = $clientes->random();
                    $clienteId = $cliente->id;
                    
                    // Obtener datos según el tipo de cliente
                    switch ($cliente->tipo) {
                        case 'PERSONA':
                            $persona = $cliente->persona;
                            $nombresCliente = $persona['nombres'] ?? 'Cliente';
                            $apellidosCliente = $persona['apellidos'] ?? '';
                            $dniCliente = $persona['numero_documento'] ?? str_pad(rand(10000000, 99999999), 8, '0', STR_PAD_LEFT);
                            break;
                        case 'EMPRESA':
                            $empresa = $cliente->empresa;
                            $nombresCliente = $empresa['razon_social'] ?? 'Empresa';
                            $apellidosCliente = '';
                            $dniCliente = $empresa['nit'] ?? str_pad(rand(800000000, 999999999), 9, '0', STR_PAD_LEFT);
                            break;
                        case 'CONSORCIO':
                            $consorcio = $cliente->consorcio;
                            $nombresCliente = $consorcio['nombre_consorcio'] ?? 'Consorcio';
                            $apellidosCliente = '';
                            $dniCliente = $consorcio['nit'] ?? str_pad(rand(800000000, 999999999), 9, '0', STR_PAD_LEFT);
                            break;
                        default:
                            $nombresCliente = 'Cliente';
                            $apellidosCliente = '';
                            $dniCliente = str_pad(rand(10000000, 99999999), 8, '0', STR_PAD_LEFT);
                    }
                }

                SaasPoliza::create([
                    // CRÍTICO: Asignar broker y usuario
                    'broker_id' => $broker->id,
                    'usuario_id' => $usuarios->random()->id,
                    'cliente_id' => $clienteId,
                    
                    // Información básica
                    'numero_poliza' => SaasPoliza::generarCodigoPoliza($broker->id),
                    'riesgo' => collect(['Vehículo particular', 'Vivienda familiar', 'Oficina comercial', 'Local comercial', 'Bodega industrial'])->random(),
                    'valor_riesgo_asegurado' => rand(10000000, 500000000),
                    'aseguradora' => collect($aseguradoras)->random(),
                    'ramo_principal' => collect($ramos)->random(),
                    'subramo' => collect(['Básico', 'Intermedio', 'Premium', 'Completo'])->random(),
                    'tipo_poliza' => collect(['Individual', 'Familiar', 'Empresarial', 'Colectiva'])->random(),
                    
                    // Información del cliente
                    'nombres_cliente' => $nombresCliente,
                    'apellidos_cliente' => $apellidosCliente,
                    'dni_cliente' => $dniCliente,
                    'tipo_documento' => collect($tiposDocumento)->random(),
                    'telefono_cliente' => '(01) ' . rand(200, 999) . '-' . rand(1000, 9999),
                    'celular_cliente' => '3' . rand(10, 99) . ' ' . rand(100, 999) . ' ' . rand(1000, 9999),
                    'fecha_expedicion_dni' => Carbon::now()->subYears(rand(18, 50))->subDays(rand(1, 365)),
                    'fecha_nacimiento' => Carbon::now()->subYears(rand(18, 80))->subDays(rand(1, 365)),
                    'domicilio' => collect(['Calle 123 #45-67', 'Carrera 89 #12-34', 'Avenida 56 #78-90'])->random() . ', ' . collect(['Bogotá', 'Medellín', 'Cali', 'Barranquilla'])->random(),
                    'correo_cliente' => strtolower($nombresCliente) . '.' . strtolower(explode(' ', $apellidosCliente)[0]) . '@ejemplo.com',
                    'observaciones_cliente' => rand(1, 5) === 1 ? 'Cliente preferencial' : null,
                    
                    // Información financiera
                    'prima_neta' => $primaNeta,
                    'porcentaje_iva' => $porcentajeIva,
                    'iva' => $iva,
                    'total' => $total,
                    'porcentaje_comision' => rand(5, 15),
                    'comision' => ($primaNeta * rand(5, 15)) / 100,
                    'forma_pago' => collect(['Mensual', 'Trimestral', 'Semestral', 'Anual'])->random(),
                    'periodicidad_pago' => collect(['Mensual', 'Trimestral', 'Semestral', 'Anual'])->random(),
                    'medio_pago' => collect(['Efectivo', 'Transferencia', 'Tarjeta de Crédito', 'Débito Automático'])->random(),
                    
                    // Información administrativa
                    'vendedor' => $usuarios->random()->nombre . ' ' . $usuarios->random()->apellidos,
                    'observaciones' => rand(1, 10) === 1 ? 'Póliza con descuento especial' : null,
                    'observaciones_internas' => rand(1, 15) === 1 ? 'Revisar renovación' : null,
                    'fecha_expedicion' => $fechaExpedicion,
                    'fecha_inicio' => $fechaInicio,
                    'fecha_fin' => $fechaFin,
                    'estado' => $estado,
                    'sede' => collect(['Sede Principal', 'Sucursal Norte', 'Sucursal Sur', 'Oficina Centro'])->random(),
                ]);

                $totalPolizasCreadas++;
            }

            echo "   ✅ {$numPolizas} pólizas creadas para {$broker->nombre}\n";
        }

        echo "\n🎉 Total: {$totalPolizasCreadas} pólizas SaaS creadas con aislamiento por broker\n";
        echo "📊 Cada broker tiene sus propias pólizas aisladas\n";
    }
}
