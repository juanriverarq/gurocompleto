<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\SalesFunnel;
use App\Models\Broker;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SalesFunnelSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Limpiar datos existentes
        SalesFunnel::truncate();
        
        // Obtener broker y usuarios de prueba
        $broker = Broker::find(4); // Asumiendo que el broker 4 existe
        
        if (!$broker) {
            $this->command->error('No se encontró el broker con ID 4');
            return;
        }
        
        $users = User::where('broker_id', $broker->id)->get();
        
        if ($users->isEmpty()) {
            $this->command->error('No hay usuarios para el broker 4');
            return;
        }
        
        // Datos de prueba para leads
        $leadsData = [
            [
                'first_name' => 'Carlos',
                'last_name' => 'Mendoza',
                'email' => 'carlos.mendoza@email.com',
                'phone' => '3001234567',
                'company_name' => null,
                'stage' => 'proposal',
                'lead_source' => 'website',
                'insurance_type' => 'auto',
                'potential_value' => 2500000,
                'close_probability' => 75,
                'quality_rating' => 'hot',
                'lead_score' => 85,
                'city' => 'Bogotá',
                'department' => 'Cundinamarca',
                'expected_close_date' => now()->addDays(10),
                'next_follow_up_at' => now()->addDays(2),
                'preferred_contact_method' => 'phone',
                'preferred_contact_time' => 'morning',
                'notes' => 'Interesado en póliza de auto para vehículo 2022. Muy receptivo a la propuesta.',
                'qualifying_notes' => 'Cliente con buen historial crediticio, maneja vehículo nuevo.',
                'presentation_notes' => 'Presentación realizada exitosamente. Mostró interés en cobertura completa.',
                'days_in_current_stage' => 5,
                'stage_changed_at' => now()->subDays(5),
                'first_contact_at' => now()->subDays(12),
                'last_contact_at' => now()->subDays(1)
            ],
            [
                'first_name' => 'Ana Patricia',
                'last_name' => 'Silva',
                'email' => 'ana.silva@empresa.com',
                'phone' => '3009876543',
                'company_name' => 'Innovación Tecnológica SAS',
                'company_size' => 'medium',
                'industry' => 'Tecnología',
                'position' => 'Gerente General',
                'stage' => 'negotiation',
                'lead_source' => 'referral',
                'insurance_type' => 'business',
                'potential_value' => 15000000,
                'close_probability' => 90,
                'quality_rating' => 'hot',
                'lead_score' => 95,
                'city' => 'Medellín',
                'department' => 'Antioquia',
                'expected_close_date' => now()->addDays(7),
                'next_follow_up_at' => now()->addDays(1),
                'preferred_contact_method' => 'email',
                'preferred_contact_time' => 'afternoon',
                'notes' => 'Empresa tecnológica en expansión. Necesita cobertura completa para oficinas y equipos.',
                'qualifying_notes' => 'Empresa sólida con 50 empleados, facturación anual de 2.5B.',
                'presentation_notes' => 'Presentación detallada de coberturas empresariales. Muy interesados.',
                'negotiation_notes' => 'Negociando descuentos por volumen. Están comparando con la competencia.',
                'days_in_current_stage' => 3,
                'stage_changed_at' => now()->subDays(3),
                'first_contact_at' => now()->subDays(25),
                'last_contact_at' => now()->subHours(6)
            ],
            [
                'first_name' => 'Roberto',
                'last_name' => 'Fernández',
                'email' => 'roberto.fernandez@gmail.com',
                'phone' => '3157890123',
                'stage' => 'lead',
                'lead_source' => 'google_ads',
                'insurance_type' => 'home',
                'potential_value' => 1800000,
                'close_probability' => 30,
                'quality_rating' => 'warm',
                'lead_score' => 45,
                'city' => 'Cali',
                'department' => 'Valle del Cauca',
                'expected_close_date' => now()->addDays(30),
                'next_follow_up_at' => now()->addDays(1),
                'preferred_contact_method' => 'whatsapp',
                'preferred_contact_time' => 'evening',
                'notes' => 'Lead reciente de Google Ads. Solicitó cotización para seguro de hogar.',
                'days_in_current_stage' => 2,
                'stage_changed_at' => now()->subDays(2),
                'first_contact_at' => null,
                'last_contact_at' => null
            ],
            [
                'first_name' => 'María José',
                'last_name' => 'Ramírez',
                'email' => 'mariajose.ramirez@hotmail.com',
                'phone' => '3006789012',
                'stage' => 'contacted',
                'lead_source' => 'social_media',
                'insurance_type' => 'life',
                'potential_value' => 3500000,
                'close_probability' => 50,
                'quality_rating' => 'warm',
                'lead_score' => 60,
                'city' => 'Barranquilla',
                'department' => 'Atlántico',
                'expected_close_date' => now()->addDays(20),
                'next_follow_up_at' => now()->addDays(3),
                'preferred_contact_method' => 'phone',
                'preferred_contact_time' => 'morning',
                'notes' => 'Madre de familia joven interesada en seguro de vida. Contactada vía Facebook.',
                'days_in_current_stage' => 4,
                'stage_changed_at' => now()->subDays(4),
                'first_contact_at' => now()->subDays(4),
                'last_contact_at' => now()->subDays(2)
            ],
            [
                'first_name' => 'Diego',
                'last_name' => 'Morales',
                'email' => 'diego.morales@empresa.co',
                'phone' => '3123456789',
                'secondary_phone' => '3012345678',
                'stage' => 'qualified',
                'lead_source' => 'cold_call',
                'insurance_type' => 'motorcycle',
                'potential_value' => 800000,
                'close_probability' => 65,
                'quality_rating' => 'warm',
                'lead_score' => 70,
                'city' => 'Cartagena',
                'department' => 'Bolívar',
                'expected_close_date' => now()->addDays(15),
                'next_follow_up_at' => now()->addDays(2),
                'preferred_contact_method' => 'phone',
                'preferred_contact_time' => 'afternoon',
                'notes' => 'Joven profesional con motocicleta nueva. Calificado como buen prospecto.',
                'qualifying_notes' => 'Tiene moto 2023, historial de conducción limpio, ingresos estables.',
                'days_in_current_stage' => 6,
                'stage_changed_at' => now()->subDays(6),
                'first_contact_at' => now()->subDays(10),
                'last_contact_at' => now()->subDays(1)
            ],
            [
                'first_name' => 'Lucía',
                'last_name' => 'Herrera',
                'email' => 'lucia.herrera@gmail.com',
                'phone' => '3189876543',
                'stage' => 'closed_won',
                'lead_source' => 'referral',
                'insurance_type' => 'auto',
                'potential_value' => 2200000,
                'close_probability' => 100,
                'final_value' => 2200000,
                'policy_number' => 'POL-2025-001',
                'quality_rating' => 'hot',
                'lead_score' => 100,
                'city' => 'Bucaramanga',
                'department' => 'Santander',
                'expected_close_date' => now()->subDays(5),
                'preferred_contact_method' => 'email',
                'preferred_contact_time' => 'morning',
                'notes' => 'Cliente referido por Carlos Mendoza. Proceso de venta muy fluido.',
                'qualifying_notes' => 'Cliente con excelente perfil crediticio.',
                'presentation_notes' => 'Presentación exitosa, acepta propuesta inmediatamente.',
                'negotiation_notes' => 'Sin negociación necesaria, acepta condiciones.',
                'closing_notes' => 'Venta cerrada exitosamente. Cliente muy satisfecho.',
                'days_in_current_stage' => 10,
                'stage_changed_at' => now()->subDays(10),
                'first_contact_at' => now()->subDays(25),
                'last_contact_at' => now()->subDays(10),
                'closed_at' => now()->subDays(10)
            ],
            [
                'first_name' => 'Pedro',
                'last_name' => 'Castillo',
                'email' => 'pedro.castillo@yahoo.com',
                'phone' => '3145678901',
                'stage' => 'closed_lost',
                'lead_source' => 'email_campaign',
                'insurance_type' => 'health',
                'potential_value' => 4500000,
                'close_probability' => 0,
                'quality_rating' => 'cold',
                'lead_score' => 25,
                'city' => 'Pereira',
                'department' => 'Risaralda',
                'expected_close_date' => now()->subDays(2),
                'preferred_contact_method' => 'email',
                'preferred_contact_time' => 'afternoon',
                'notes' => 'Cliente potencial de campaña de email marketing para seguro de salud.',
                'qualifying_notes' => 'Mostró interés inicial pero con reservas sobre precios.',
                'presentation_notes' => 'Presentación realizada pero cliente no convencido.',
                'negotiation_notes' => 'Intentos de negociación fallidos, cliente muy sensible al precio.',
                'closing_notes' => 'No se pudo cerrar la venta.',
                'lost_reason' => 'Precio demasiado alto comparado con la competencia',
                'days_in_current_stage' => 15,
                'stage_changed_at' => now()->subDays(15),
                'first_contact_at' => now()->subDays(40),
                'last_contact_at' => now()->subDays(15),
                'closed_at' => now()->subDays(15)
            ],
            [
                'first_name' => 'Sandra',
                'last_name' => 'López',
                'email' => 'sandra.lopez@empresa.com',
                'phone' => '3198765432',
                'company_name' => 'Comercializadora del Norte',
                'company_size' => 'small',
                'industry' => 'Comercio',
                'position' => 'Propietaria',
                'stage' => 'presentation',
                'lead_source' => 'trade_show',
                'insurance_type' => 'business',
                'potential_value' => 5500000,
                'close_probability' => 60,
                'quality_rating' => 'warm',
                'lead_score' => 65,
                'city' => 'Manizales',
                'department' => 'Caldas',
                'expected_close_date' => now()->addDays(12),
                'next_follow_up_at' => now()->addDays(1),
                'preferred_contact_method' => 'in_person',
                'preferred_contact_time' => 'morning',
                'notes' => 'Conocida en feria comercial. Pequeña empresa familiar en crecimiento.',
                'qualifying_notes' => 'Empresa con 15 empleados, necesita cobertura integral.',
                'presentation_notes' => 'Presentación programada para la próxima semana.',
                'days_in_current_stage' => 3,
                'stage_changed_at' => now()->subDays(3),
                'first_contact_at' => now()->subDays(8),
                'last_contact_at' => now()->subDays(1)
            ],
            [
                'first_name' => 'Andrés',
                'last_name' => 'Vargas',
                'email' => 'andres.vargas@correo.com',
                'phone' => '3167890123',
                'stage' => 'lead',
                'lead_source' => 'facebook_ads',
                'insurance_type' => 'travel',
                'potential_value' => 650000,
                'close_probability' => 25,
                'quality_rating' => 'cold',
                'lead_score' => 35,
                'city' => 'Ibagué',
                'department' => 'Tolima',
                'expected_close_date' => now()->addDays(25),
                'next_follow_up_at' => now()->addDays(2),
                'preferred_contact_method' => 'whatsapp',
                'preferred_contact_time' => 'evening',
                'notes' => 'Lead de Facebook Ads interesado en seguro de viajes.',
                'days_in_current_stage' => 1,
                'stage_changed_at' => now()->subDays(1),
                'first_contact_at' => null,
                'last_contact_at' => null
            ],
            [
                'first_name' => 'Camila',
                'last_name' => 'Ruiz',
                'email' => 'camila.ruiz@gmail.com',
                'phone' => '3134567890',
                'stage' => 'qualified',
                'lead_source' => 'partner',
                'insurance_type' => 'pet',
                'potential_value' => 450000,
                'close_probability' => 55,
                'quality_rating' => 'warm',
                'lead_score' => 60,
                'city' => 'Villavicencio',
                'department' => 'Meta',
                'expected_close_date' => now()->addDays(18),
                'next_follow_up_at' => now()->addDays(3),
                'preferred_contact_method' => 'phone',
                'preferred_contact_time' => 'afternoon',
                'notes' => 'Referida por socio comercial. Dueña de mascotas, muy preocupada por su bienestar.',
                'qualifying_notes' => 'Tiene 2 perros y 1 gato. Historial de gastos veterinarios altos.',
                'days_in_current_stage' => 5,
                'stage_changed_at' => now()->subDays(5),
                'first_contact_at' => now()->subDays(8),
                'last_contact_at' => now()->subDays(2)
            ]
        ];
        
        foreach ($leadsData as $leadData) {
            // Asignar valores fijos
            $leadData['broker_id'] = $broker->id;
            $leadData['created_by'] = $users->random()->id;
            $leadData['assigned_agent_id'] = $users->random()->id;
            
            // Campos calculados
            $leadData['total_days_in_funnel'] = $leadData['stage_changed_at'] ? 
                max(1, Carbon::parse($leadData['stage_changed_at'])->diffInDays(now()) + $leadData['days_in_current_stage']) : 
                max(1, $leadData['days_in_current_stage']);
            
            // Crear activity log
            $activityLog = [];
            
            // Actividad de creación
            $activityLog[] = [
                'timestamp' => now()->subDays(max(1, $leadData['total_days_in_funnel']))->toISOString(),
                'activity' => 'lead_created',
                'data' => [
                    'source' => $leadData['lead_source'],
                    'stage' => 'lead',
                    'potential_value' => $leadData['potential_value']
                ],
                'user_id' => $leadData['created_by']
            ];
            
            // Actividades de cambio de etapa
            if ($leadData['stage'] !== 'lead') {
                $stages = ['lead', 'contacted', 'qualified', 'presentation', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
                $currentStageIndex = array_search($leadData['stage'], $stages);
                
                                 for ($i = 1; $i <= $currentStageIndex; $i++) {
                     $daysAgo = max(1, $leadData['total_days_in_funnel'] - ($i * 3));
                     $activityLog[] = [
                         'timestamp' => now()->subDays($daysAgo)->toISOString(),
                         'activity' => 'stage_changed',
                         'data' => [
                             'from_stage' => $stages[$i - 1],
                             'to_stage' => $stages[$i],
                             'notes' => 'Cambio automático de etapa'
                         ],
                         'user_id' => $leadData['assigned_agent_id']
                     ];
                 }
            }
            
            // Actividades de contacto
            if ($leadData['first_contact_at']) {
                $activityLog[] = [
                    'timestamp' => Carbon::parse($leadData['first_contact_at'])->toISOString(),
                    'activity' => 'contact_made',
                    'data' => [
                        'method' => $leadData['preferred_contact_method'],
                        'notes' => 'Primer contacto realizado',
                        'user_id' => $leadData['assigned_agent_id']
                    ],
                    'user_id' => $leadData['assigned_agent_id']
                ];
            }
            
            if ($leadData['last_contact_at'] && $leadData['last_contact_at'] !== $leadData['first_contact_at']) {
                $activityLog[] = [
                    'timestamp' => Carbon::parse($leadData['last_contact_at'])->toISOString(),
                    'activity' => 'contact_made',
                    'data' => [
                        'method' => $leadData['preferred_contact_method'],
                        'notes' => 'Último contacto realizado',
                        'user_id' => $leadData['assigned_agent_id']
                    ],
                    'user_id' => $leadData['assigned_agent_id']
                ];
            }
            
            // Actividad de cierre
            if (in_array($leadData['stage'], ['closed_won', 'closed_lost'])) {
                $activityLog[] = [
                    'timestamp' => Carbon::parse($leadData['closed_at'])->toISOString(),
                    'activity' => $leadData['stage'],
                    'data' => $leadData['stage'] === 'closed_won' ? 
                        [
                            'final_value' => $leadData['final_value'],
                            'policy_number' => $leadData['policy_number'],
                            'notes' => $leadData['closing_notes']
                        ] : 
                        [
                            'reason' => $leadData['lost_reason'],
                            'notes' => $leadData['closing_notes']
                        ],
                    'user_id' => $leadData['assigned_agent_id']
                ];
            }
            
            $leadData['activity_log'] = $activityLog;
            
            // Historial de contactos
            $contactHistory = [];
            if ($leadData['first_contact_at']) {
                $contactHistory[] = [
                    'datetime' => Carbon::parse($leadData['first_contact_at'])->toISOString(),
                    'method' => $leadData['preferred_contact_method'],
                    'notes' => 'Primer contacto establecido',
                    'details' => [],
                    'user_id' => $leadData['assigned_agent_id']
                ];
            }
            
            if ($leadData['last_contact_at'] && $leadData['last_contact_at'] !== $leadData['first_contact_at']) {
                $contactHistory[] = [
                    'datetime' => Carbon::parse($leadData['last_contact_at'])->toISOString(),
                    'method' => $leadData['preferred_contact_method'],
                    'notes' => 'Seguimiento realizado',
                    'details' => [],
                    'user_id' => $leadData['assigned_agent_id']
                ];
            }
            
            $leadData['contact_history'] = $contactHistory;
            
            // Timestamps
            $leadData['created_at'] = now()->subDays(max(1, $leadData['total_days_in_funnel']));
            $leadData['updated_at'] = now();
            
            SalesFunnel::create($leadData);
        }
        
        $this->command->info('Se crearon ' . count($leadsData) . ' leads de prueba para el broker ' . $broker->name);
    }
}
