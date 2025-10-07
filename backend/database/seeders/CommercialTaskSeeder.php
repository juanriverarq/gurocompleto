<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\CommercialTask;
use App\Models\Broker;
use App\Models\Cliente;
use App\Models\User;
use Carbon\Carbon;

class CommercialTaskSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Obtener datos necesarios
        $brokers = Broker::all();
        $users = User::all();
        
        if ($brokers->isEmpty() || $users->isEmpty()) {
            $this->command->info('Faltan brokers o usuarios para crear tareas comerciales');
            return;
        }

        foreach ($brokers as $broker) {
            $clientes = Cliente::where('broker_id', $broker->id)->get();
            
            if ($clientes->isEmpty()) {
                $this->command->info("No hay clientes para el broker {$broker->id}");
                continue;
            }

            $this->createTasksForBroker($broker, $clientes, $users);
        }
    }

    private function createTasksForBroker($broker, $clientes, $users)
    {
        $tasks = [
            // Tareas de seguimiento a clientes
            [
                'title' => 'Seguimiento renovación póliza vehículo',
                'description' => 'Contactar cliente para renovación de póliza próxima a vencer en 30 días',
                'type' => 'renovacion',
                'priority' => 'alta',
                'status' => 'en_progreso',
                'due_date' => Carbon::now()->addDays(5),
                'progress_percentage' => 60,
                'contact_method' => 'phone',
                'result' => 'interesado',
                'notes' => 'Cliente contactado, esperando documentos actualizados',
                'next_follow_up' => Carbon::now()->addDays(2),
                'follow_up_notes' => 'Revisar documentos recibidos'
            ],
            [
                'title' => 'Llamada seguimiento prospecto',
                'description' => 'Contactar prospecto interesado en seguro de vida',
                'type' => 'seguimiento_cliente',
                'priority' => 'media',
                'status' => 'pendiente',
                'due_date' => Carbon::now()->addDays(1),
                'progress_percentage' => 25,
                'contact_method' => 'phone',
                'scheduled_for' => Carbon::now()->addHours(2),
                'contact_notes' => 'Prefiere llamadas en horario de tarde',
                'estimated_duration_minutes' => 15
            ],
            [
                'title' => 'Inspección técnica vehículo comercial',
                'description' => 'Coordinar inspección técnica para nueva póliza de flota',
                'type' => 'inspeccion',
                'priority' => 'alta',
                'status' => 'en_progreso',
                'due_date' => Carbon::now()->addDays(7),
                'progress_percentage' => 40,
                'contact_method' => 'email',
                'scheduled_for' => Carbon::now()->addDays(3),
                'notes' => 'Empresa requiere inspección en horario específico',
                'estimated_duration_minutes' => 120
            ],
            [
                'title' => 'Documentación siniestro hogar',
                'description' => 'Recopilar documentación faltante para procesamiento de siniestro',
                'type' => 'siniestro',
                'priority' => 'critica',
                'status' => 'vencida',
                'due_date' => Carbon::now()->subDays(2),
                'progress_percentage' => 75,
                'contact_method' => 'whatsapp',
                'result' => 'sin_respuesta',
                'notes' => 'Cliente no responde, escalando a supervisor',
                'next_follow_up' => Carbon::now()->addHours(6)
            ],
            [
                'title' => 'Reunión cotización empresarial',
                'description' => 'Reunión presencial para presentar cotización de seguro empresarial',
                'type' => 'cotizacion',
                'priority' => 'alta',
                'status' => 'completada',
                'due_date' => Carbon::now()->subDays(1),
                'completed_at' => Carbon::now()->subHours(24),
                'progress_percentage' => 100,
                'contact_method' => 'in_person',
                'result' => 'exitoso',
                'notes' => 'Cotización presentada exitosamente, cliente muy interesado',
                'actual_duration_minutes' => 90,
                'estimated_duration_minutes' => 60
            ],
            [
                'title' => 'Email seguimiento cotización vida',
                'description' => 'Enviar email de seguimiento para cotización de seguro de vida',
                'type' => 'email',
                'priority' => 'media',
                'status' => 'pendiente',
                'due_date' => Carbon::now()->addDays(3),
                'progress_percentage' => 0,
                'contact_method' => 'email',
                'contact_email' => 'cliente@ejemplo.com',
                'estimated_duration_minutes' => 30
            ],
            [
                'title' => 'Visita técnica oficina cliente',
                'description' => 'Visita para evaluar riesgos y elaborar cotización de seguro empresarial',
                'type' => 'visita',
                'priority' => 'media',
                'status' => 'pausada',
                'due_date' => Carbon::now()->addDays(10),
                'progress_percentage' => 20,
                'contact_method' => 'in_person',
                'scheduled_for' => Carbon::now()->addDays(8),
                'notes' => 'Pausada por solicitud del cliente - reagendar',
                'estimated_duration_minutes' => 180
            ],
            [
                'title' => 'Documentación nueva póliza',
                'description' => 'Completar documentación para nueva póliza de responsabilidad civil',
                'type' => 'documentacion',
                'priority' => 'media',
                'status' => 'en_progreso',
                'due_date' => Carbon::now()->addDays(4),
                'progress_percentage' => 80,
                'notes' => 'Faltan solo 2 documentos por parte del cliente',
                'next_follow_up' => Carbon::now()->addDays(1)
            ],
            [
                'title' => 'Videollamada explicación cobertura',
                'description' => 'Explicar al cliente las coberturas de su nueva póliza',
                'type' => 'reunion',
                'priority' => 'baja',
                'status' => 'pendiente',
                'due_date' => Carbon::now()->addDays(6),
                'progress_percentage' => 0,
                'contact_method' => 'video_call',
                'scheduled_for' => Carbon::now()->addDays(5),
                'estimated_duration_minutes' => 45
            ],
            [
                'title' => 'Seguimiento post-venta',
                'description' => 'Llamada de seguimiento para evaluar satisfacción del cliente',
                'type' => 'seguimiento_cliente',
                'priority' => 'baja',
                'status' => 'completada',
                'due_date' => Carbon::now()->subDays(3),
                'completed_at' => Carbon::now()->subDays(2),
                'progress_percentage' => 100,
                'contact_method' => 'phone',
                'result' => 'exitoso',
                'notes' => 'Cliente muy satisfecho con el servicio recibido',
                'actual_duration_minutes' => 20
            ]
        ];

        foreach ($tasks as $index => $taskData) {
            $cliente = $clientes->random();
            $assignedUser = $users->random();
            $createdBy = $users->random();

            $task = CommercialTask::create([
                'broker_id' => $broker->id,
                'client_id' => $cliente->id,
                'assigned_to' => $assignedUser->id,
                'created_by' => $createdBy->id,
                'title' => $taskData['title'],
                'description' => $taskData['description'],
                'type' => $taskData['type'],
                'priority' => $taskData['priority'],
                'status' => $taskData['status'],
                'due_date' => $taskData['due_date'],
                'scheduled_for' => $taskData['scheduled_for'] ?? null,
                'completed_at' => $taskData['completed_at'] ?? null,
                'progress_percentage' => $taskData['progress_percentage'],
                'contact_method' => $taskData['contact_method'] ?? null,
                'contact_phone' => $taskData['contact_phone'] ?? $cliente->phone,
                'contact_email' => $taskData['contact_email'] ?? $cliente->email,
                'contact_notes' => $taskData['contact_notes'] ?? null,
                'result' => $taskData['result'] ?? null,
                'notes' => $taskData['notes'] ?? null,
                'next_follow_up' => $taskData['next_follow_up'] ?? null,
                'follow_up_notes' => $taskData['follow_up_notes'] ?? null,
                'estimated_duration_minutes' => $taskData['estimated_duration_minutes'] ?? null,
                'actual_duration_minutes' => $taskData['actual_duration_minutes'] ?? null,
                'has_reminder' => rand(0, 1) === 1,
                'reminder_at' => rand(0, 1) === 1 ? Carbon::now()->addHours(rand(1, 48)) : null,
                'created_at' => Carbon::now()->subDays(rand(1, 30)),
                'updated_at' => Carbon::now()->subHours(rand(1, 24))
            ]);

            // Agregar log de actividades
            $activities = [
                [
                    'timestamp' => $task->created_at->toISOString(),
                    'activity' => 'Tarea creada',
                    'data' => [
                        'title' => $task->title,
                        'type' => $task->type,
                        'priority' => $task->priority
                    ],
                    'user_id' => $createdBy->id
                ]
            ];

            if ($task->status === 'en_progreso') {
                $activities[] = [
                    'timestamp' => $task->created_at->addMinutes(rand(30, 180))->toISOString(),
                    'activity' => 'Tarea iniciada',
                    'data' => [],
                    'user_id' => $assignedUser->id
                ];
            }

            if ($task->status === 'completada') {
                $activities[] = [
                    'timestamp' => $task->completed_at->toISOString(),
                    'activity' => 'Tarea completada',
                    'data' => [
                        'result' => $task->result,
                        'notes' => $task->notes
                    ],
                    'user_id' => $assignedUser->id
                ];
            }

            $task->update(['activity_log' => $activities]);
        }

        $this->command->info("Creadas " . count($tasks) . " tareas comerciales para el broker {$broker->id}");
    }
}
