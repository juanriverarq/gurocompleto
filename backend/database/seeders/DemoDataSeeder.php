<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Broker;
use App\Models\Aseguradora;
use App\Models\Ramo;
use App\Models\ComisionAseguradora;

class DemoDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('🚀 Iniciando creación de datos de demostración...');

        // 1) Seed de catálogos base: Aseguradoras y Ramos (con comisiones) para TODOS los brokers
        $brokers = Broker::all();
        if ($brokers->isEmpty()) {
            $this->command->warn('No hay brokers creados. Ejecuta BrokerSeeder primero.');
            return;
        }

        DB::transaction(function () use ($brokers) {
            $this->command->info('🏦 Creando aseguradoras base...');
            $aseguradoras = [
                [ 'nombre' => 'SURA', 'cuit' => '800220154-3', 'email' => 'contacto@sura.com.co', 'telefono' => '+57 1 437 8888', 'direccion' => 'Calle 100 # 11B-67, Bogotá', 'link_pago' => 'https://www.segurossura.com.co/' ],
                [ 'nombre' => 'MAPFRE', 'cuit' => '800135679-1', 'email' => 'servicio.clientes@mapfre.com.co', 'telefono' => '+57 1 307 7022', 'direccion' => 'Cra. 7 #76-35, Bogotá', 'link_pago' => 'https://www.mapfre.com.co/' ],
                [ 'nombre' => 'Seguros Bolívar', 'cuit' => '860013854-1', 'email' => 'servicioalcliente@segurosbolivar.com', 'telefono' => '+57 1 312 2210', 'direccion' => 'Av. El Dorado #68C-61, Bogotá', 'link_pago' => 'https://www.segurosbolivar.com/' ],
                [ 'nombre' => 'Allianz', 'cuit' => '800220154-7', 'email' => 'servicioalcliente@allianz.co', 'telefono' => '+57 1 594 1170', 'direccion' => 'Calle 94 #13-11, Bogotá', 'link_pago' => 'https://www.allianz.co/' ],
                [ 'nombre' => 'AXA Colpatria', 'cuit' => '860002471-3', 'email' => 'servicioalcliente@axacolpatria.co', 'telefono' => '+57 1 423 5757', 'direccion' => 'Cra. 7 #24-89, Bogotá', 'link_pago' => 'https://www.axacolpatria.co/' ],
                [ 'nombre' => 'Liberty Seguros', 'cuit' => '860034594-6', 'email' => 'servicioalcliente@libertycolombia.com', 'telefono' => '+57 1 307 7050', 'direccion' => 'Calle 72 #10-07, Bogotá', 'link_pago' => 'https://www.libertycolombia.com.co/' ],
                [ 'nombre' => 'La Previsora', 'cuit' => '899999063-2', 'email' => 'servicioalcliente@laprevisora.gov.co', 'telefono' => '+57 1 344 1444', 'direccion' => 'Av. 28 #66A-51, Bogotá', 'link_pago' => 'https://www.laprevisora.gov.co/' ],
                [ 'nombre' => 'La Equidad Seguros', 'cuit' => '860006185-1', 'email' => 'servicioalcliente@laequidadseguros.coop', 'telefono' => '+57 1 307 7123', 'direccion' => 'Av. 28 #68B-51, Bogotá', 'link_pago' => 'https://www.laequidadseguros.coop/' ],
                [ 'nombre' => 'Seguros del Estado', 'cuit' => '860002702-1', 'email' => 'servicioalcliente@segurosdelestado.com', 'telefono' => '+57 1 307 7020', 'direccion' => 'Calle 100 #19-54, Bogotá', 'link_pago' => 'https://www.segurosdelestado.com/' ],
                [ 'nombre' => 'HDI Seguros', 'cuit' => '900475115-3', 'email' => 'servicioalcliente@hdi.com.co', 'telefono' => '+57 1 319 3000', 'direccion' => 'Cra. 9 #74-08, Bogotá', 'link_pago' => 'https://www.hdi.com.co/' ],
            ];

            $this->command->info('📂 Creando ramos base...');
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

            foreach ($brokers as $broker) {
                $this->command->info("➡️ Broker: {$broker->name} (#{$broker->id})");

                // Crear/actualizar aseguradoras por broker
                $asegModels = [];
                foreach ($aseguradoras as $a) {
                    $asegModels[] = Aseguradora::firstOrCreate([
                        'nombre' => $a['nombre'],
                        'broker_id' => $broker->id,
                    ], [
                        'cuit' => $a['cuit'] ?? null,
                        'email' => $a['email'] ?? null,
                        'telefono' => $a['telefono'] ?? null,
                        'direccion' => $a['direccion'] ?? null,
                        'link_pago' => $a['link_pago'] ?? null,
                        'retencion' => 0,
                        'iva' => 19,
                        'retencion_iva' => 0,
                    ]);
                }

                // Crear/actualizar ramos por broker
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

                // Comisiones por defecto: 0% en todos, para editar luego
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
            }
        });

        // 2) Datos existentes
        $this->command->info('📝 Creando clientes...');
        $this->call(ClientesSeeder::class);
        $this->command->info('📋 Creando pólizas...');
        $this->call(PolizasSeeder::class);

        $this->command->info('✅ ¡Datos de demostración creados exitosamente!');
        $this->command->newLine();
    }
}
