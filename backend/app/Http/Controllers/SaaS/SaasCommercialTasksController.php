<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Http\Resources\CommercialTaskResource;
use App\Models\CommercialTask;
use App\Models\Cliente;
use App\Models\Poliza;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class SaasCommercialTasksController extends Controller
{
    /**
     * Display a listing of commercial tasks
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $query = CommercialTask::forBroker($brokerId)
                ->with([
                    'client' => function($q) {
                        $q->select('id', 'first_name', 'last_name', 'document_number', 'email', 'phone');
                    },
                    'poliza' => function($q) {
                        $q->select('id', 'policy_number', 'type', 'status');
                    },
                    'assignedUser' => function($q) {
                        $q->select('id', 'name', 'email');
                    },
                    'assignedEmpleado' => function($q) {
                        $q->select('id', 'nombres', 'apellidos', 'email');
                    },
                    'creator' => function($q) {
                        $q->select('id', 'name', 'email');
                    }
                ]);

            // Aplicar filtros
            $this->applyFilters($query, $request);

            // Ordenamiento
            $sortField = $request->get('sort_field', 'created_at');
            $sortDirection = $request->get('sort_direction', 'desc');
            $query->orderBy($sortField, $sortDirection);

            // Paginación
            $perPage = min($request->get('per_page', 15), 100);
            $tasks = $query->paginate($perPage);

            // Debug: Log para verificar la carga de usuarios asignados
            \Log::info('🔍 [DEBUG] Commercial Tasks cargadas', [
                'total' => $tasks->total(),
                'first_task_assigned_to' => $tasks->items()[0]->assigned_to ?? null,
                'first_task_has_assigned_user' => isset($tasks->items()[0]) && $tasks->items()[0]->relationLoaded('assignedUser'),
                'first_task_assigned_user_data' => isset($tasks->items()[0]) && $tasks->items()[0]->assignedUser ? [
                    'id' => $tasks->items()[0]->assignedUser->id,
                    'name' => $tasks->items()[0]->assignedUser->name,
                ] : 'NO LOADED'
            ]);

            return response()->json([
                'data' => CommercialTaskResource::collection($tasks->items()),
                'current_page' => $tasks->currentPage(),
                'last_page' => $tasks->lastPage(),
                'per_page' => $tasks->perPage(),
                'total' => $tasks->total(),
                'from' => $tasks->firstItem(),
                'to' => $tasks->lastItem()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al cargar tareas',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created task
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $validator = Validator::make($request->all(), [
                'title' => 'required|string|max:255',
                'description' => 'nullable|string',
                'type' => 'required|in:' . implode(',', array_keys(CommercialTask::TYPES)),
                'priority' => 'required|in:' . implode(',', array_keys(CommercialTask::PRIORITIES)),
                'client_id' => 'nullable|exists:clientes,id',
                'poliza_id' => 'nullable|exists:polizas,id',
                'assigned_to' => 'nullable|integer',
                'due_date' => 'nullable|date|after:now',
                'scheduled_for' => 'nullable|date',
                'contact_method' => 'nullable|in:' . implode(',', array_keys(CommercialTask::CONTACT_METHODS)),
                'contact_phone' => 'nullable|string|max:20',
                'contact_email' => 'nullable|email|max:255',
                'estimated_duration_minutes' => 'nullable|integer|min:1',
                'has_reminder' => 'boolean',
                'reminder_at' => 'nullable|date|after:now'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $taskData = $validator->validated();
            $taskData['broker_id'] = $brokerId;
            $taskData['created_by'] = auth()->id();
            
            // Si no se asigna a nadie, asignar al creador
            if (!isset($taskData['assigned_to'])) {
                $taskData['assigned_to'] = auth()->id();
            }

            $task = CommercialTask::create($taskData);
            $task->load([
                'client' => function($q) {
                    $q->select('id', 'first_name', 'last_name', 'document_number', 'email', 'phone');
                },
                'poliza' => function($q) {
                    $q->select('id', 'policy_number', 'type', 'status');
                },
                'assignedUser' => function($q) {
                    $q->select('id', 'name', 'email');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email');
                },
                'creator' => function($q) {
                    $q->select('id', 'name', 'email');
                }
            ]);

            $task->addActivity('Tarea creada', [
                'title' => $task->title,
                'type' => $task->type,
                'priority' => $task->priority
            ]);

            return response()->json([
                'message' => 'Tarea creada exitosamente',
                'data' => new CommercialTaskResource($task)
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al crear la tarea',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified task
     */
    public function show(Request $request, CommercialTask $task): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            if ($task->broker_id !== $brokerId) {
                return response()->json(['error' => 'Acceso denegado'], 403);
            }

            $task->load([
                'client' => function($q) {
                    $q->select('id', 'first_name', 'last_name', 'document_number', 'email', 'phone');
                },
                'poliza' => function($q) {
                    $q->select('id', 'policy_number', 'type', 'status');
                },
                'assignedUser' => function($q) {
                    $q->select('id', 'name', 'email');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email');
                },
                'creator' => function($q) {
                    $q->select('id', 'name', 'email');
                }
            ]);

            return response()->json(['data' => new CommercialTaskResource($task)]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al cargar la tarea',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified task
     */
    public function update(Request $request, CommercialTask $task): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            if ($task->broker_id !== $brokerId) {
                return response()->json(['error' => 'Acceso denegado'], 403);
            }

            $validator = Validator::make($request->all(), [
                'title' => 'sometimes|required|string|max:255',
                'description' => 'nullable|string',
                'type' => 'sometimes|required|in:' . implode(',', array_keys(CommercialTask::TYPES)),
                'priority' => 'sometimes|required|in:' . implode(',', array_keys(CommercialTask::PRIORITIES)),
                'status' => 'sometimes|required|in:' . implode(',', array_keys(CommercialTask::STATUSES)),
                'client_id' => 'nullable|exists:clientes,id',
                'poliza_id' => 'nullable|exists:polizas,id',
                'assigned_to' => 'nullable|integer',
                'due_date' => 'nullable|date',
                'scheduled_for' => 'nullable|date',
                'progress_percentage' => 'sometimes|integer|min:0|max:100',
                'notes' => 'nullable|string',
                'contact_method' => 'nullable|in:' . implode(',', array_keys(CommercialTask::CONTACT_METHODS)),
                'contact_phone' => 'nullable|string|max:20',
                'contact_email' => 'nullable|email|max:255',
                'contact_notes' => 'nullable|string',
                'result' => 'nullable|in:' . implode(',', array_keys(CommercialTask::RESULTS)),
                'estimated_duration_minutes' => 'nullable|integer|min:1',
                'actual_duration_minutes' => 'nullable|integer|min:1',
                'has_reminder' => 'boolean',
                'reminder_at' => 'nullable|date'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $oldStatus = $task->status;
            $task->update($validator->validated());

            // Log cambio de estado
            if (isset($validator->validated()['status']) && $oldStatus !== $task->status) {
                $task->addActivity('Estado cambiado', [
                    'from' => $oldStatus,
                    'to' => $task->status
                ]);
            }

            $task->load([
                'client' => function($q) {
                    $q->select('id', 'first_name', 'last_name', 'document_number', 'email', 'phone');
                },
                'poliza' => function($q) {
                    $q->select('id', 'policy_number', 'type', 'status');
                },
                'assignedUser' => function($q) {
                    $q->select('id', 'name', 'email');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email');
                },
                'creator' => function($q) {
                    $q->select('id', 'name', 'email');
                }
            ]);

            return response()->json([
                'message' => 'Tarea actualizada exitosamente',
                'data' => new CommercialTaskResource($task)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar la tarea',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified task
     */
    public function destroy(Request $request, CommercialTask $task): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            if ($task->broker_id !== $brokerId) {
                return response()->json(['error' => 'Acceso denegado'], 403);
            }

            $task->delete();

            return response()->json([
                'message' => 'Tarea eliminada exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al eliminar la tarea',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get tasks statistics
     */
    public function statistics(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $stats = CommercialTask::getStatistics($brokerId);

            return response()->json(['data' => $stats]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al cargar estadísticas',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Start a task
     */
    public function start(Request $request, CommercialTask $task): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            if ($task->broker_id !== $brokerId) {
                return response()->json(['error' => 'Acceso denegado'], 403);
            }

            $task->start();
            $task->addActivity('Tarea iniciada');

            $task->load([
                'client' => function($q) {
                    $q->select('id', 'first_name', 'last_name', 'document_number', 'email', 'phone');
                },
                'poliza' => function($q) {
                    $q->select('id', 'numero_poliza', 'tipo_seguro', 'estado');
                },
                'assignedUser' => function($q) {
                    $q->select('id', 'name', 'email');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email');
                }
            ]);

            return response()->json([
                'message' => 'Tarea iniciada exitosamente',
                'data' => new CommercialTaskResource($task)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al iniciar la tarea',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Complete a task
     */
    public function complete(Request $request, CommercialTask $task): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            if ($task->broker_id !== $brokerId) {
                return response()->json(['error' => 'Acceso denegado'], 403);
            }

            $validator = Validator::make($request->all(), [
                'result' => 'nullable|in:' . implode(',', array_keys(CommercialTask::RESULTS)),
                'notes' => 'nullable|string',
                'actual_duration_minutes' => 'nullable|integer|min:1'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $data = $validator->validated();
            
            $task->complete($data['result'] ?? null, $data['notes'] ?? null);
            
            if (isset($data['actual_duration_minutes'])) {
                $task->update(['actual_duration_minutes' => $data['actual_duration_minutes']]);
            }

            $task->addActivity('Tarea completada', $data);

            $task->load([
                'client' => function($q) {
                    $q->select('id', 'first_name', 'last_name', 'document_number', 'email', 'phone');
                },
                'poliza' => function($q) {
                    $q->select('id', 'policy_number', 'type', 'status');
                },
                'assignedUser' => function($q) {
                    $q->select('id', 'name', 'email');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email');
                }
            ]);

            return response()->json([
                'message' => 'Tarea completada exitosamente',
                'data' => new CommercialTaskResource($task)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al completar la tarea',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update task progress
     */
    public function updateProgress(Request $request, CommercialTask $task): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            if ($task->broker_id !== $brokerId) {
                return response()->json(['error' => 'Acceso denegado'], 403);
            }

            $validator = Validator::make($request->all(), [
                'progress_percentage' => 'required|integer|min:0|max:100',
                'notes' => 'nullable|string'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $data = $validator->validated();
            $task->updateProgress($data['progress_percentage'], $data['notes'] ?? null);
            
            $task->addActivity('Progreso actualizado', [
                'progress' => $data['progress_percentage'],
                'notes' => $data['notes'] ?? null
            ]);

            $task->load([
                'client' => function($q) {
                    $q->select('id', 'first_name', 'last_name', 'document_number', 'email', 'phone');
                },
                'poliza' => function($q) {
                    $q->select('id', 'policy_number', 'type', 'status');
                },
                'assignedUser' => function($q) {
                    $q->select('id', 'name', 'email');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email');
                }
            ]);

            return response()->json([
                'message' => 'Progreso actualizado exitosamente',
                'data' => new CommercialTaskResource($task)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar el progreso',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Schedule follow-up
     */
    public function scheduleFollowUp(Request $request, CommercialTask $task): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            if ($task->broker_id !== $brokerId) {
                return response()->json(['error' => 'Acceso denegado'], 403);
            }

            $validator = Validator::make($request->all(), [
                'follow_up_date' => 'required|date|after:now',
                'notes' => 'nullable|string'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $data = $validator->validated();
            $followUpDate = Carbon::parse($data['follow_up_date']);
            
            $task->scheduleFollowUp($followUpDate, $data['notes'] ?? null);
            $task->addActivity('Seguimiento programado', [
                'follow_up_date' => $followUpDate->toISOString(),
                'notes' => $data['notes'] ?? null
            ]);

            $task->load([
                'client' => function($q) {
                    $q->select('id', 'first_name', 'last_name', 'document_number', 'email', 'phone');
                },
                'poliza' => function($q) {
                    $q->select('id', 'policy_number', 'type', 'status');
                },
                'assignedUser' => function($q) {
                    $q->select('id', 'name', 'email');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email');
                }
            ]);

            return response()->json([
                'message' => 'Seguimiento programado exitosamente',
                'data' => new CommercialTaskResource($task)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al programar seguimiento',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get tasks needing attention
     */
    public function needingAttention(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $tasks = CommercialTask::getTasksNeedingAttention($brokerId)
                ->with([
                    'client' => function($q) {
                        $q->select('id', 'first_name', 'last_name', 'document_number', 'email', 'phone');
                    },
                    'poliza' => function($q) {
                        $q->select('id', 'numero_poliza', 'tipo_seguro', 'estado');
                    },
                    'assignedUser' => function($q) {
                        $q->select('id', 'name', 'email');
                    },
                    'assignedEmpleado' => function($q) {
                        $q->select('id', 'nombres', 'apellidos', 'email');
                    }
                ])
                ->get();

            return response()->json(['data' => CommercialTaskResource::collection($tasks)]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al cargar tareas que requieren atención',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get available clients for tasks
     */
    public function getClients(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $query = Cliente::where('broker_id', $brokerId)
                ->select('id', 'first_name', 'last_name', 'document_number', 'email', 'phone');

            // Búsqueda si se proporciona un término
            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                      ->orWhere('last_name', 'like', "%{$search}%")
                      ->orWhere('document_number', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%");
                });
            }

            // Paginación para evitar cargar miles de clientes
            $perPage = min($request->get('per_page', 50), 100);
            $clients = $query->orderBy('first_name')
                ->limit($perPage)
                ->get()
                ->map(function ($client) {
                    return [
                        'id' => $client->id,
                        'name' => $client->first_name . ' ' . $client->last_name,
                        'document' => $client->document_number,
                        'email' => $client->email,
                        'phone' => $client->phone
                    ];
                });

            return response()->json(['data' => $clients]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al cargar clientes',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get available users for assignment
     */
    public function getUsers(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $users = User::where('broker_id', $brokerId)
                ->select('id', 'name', 'email')
                ->orderBy('name')
                ->get();

            return response()->json(['data' => $users]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al cargar usuarios',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Private methods
     */
    private function getBrokerId(Request $request): int
    {
        // Desarrollo: usar header X-Dev-Broker-Id
        if (app()->environment(['local', 'testing'])) {
            $devBrokerId = $request->header('X-Dev-Broker-Id');
            if ($devBrokerId) {
                return (int) $devBrokerId;
            }
        }

        // Obtener de usuario autenticado
        $user = auth()->user();
        if ($user && $user->broker_id) {
            return $user->broker_id;
        }

        // Fallback: intentar obtener del request
        if ($request->has('broker_id')) {
            return (int) $request->broker_id;
        }

        // Último fallback para desarrollo
        \Log::warning('🔥 getBrokerId - No se pudo obtener broker_id, usando fallback', [
            'user' => $user ? $user->id : null,
            'has_broker_id' => $user ? isset($user->broker_id) : false
        ]);
        
        return 21; // Fallback al broker con datos
    }

    private function applyFilters($query, Request $request): void
    {
        // Búsqueda general
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhereHas('client', function ($clientQuery) use ($search) {
                      $clientQuery->where('first_name', 'like', "%{$search}%")
                                  ->orWhere('last_name', 'like', "%{$search}%")
                                  ->orWhere('document_number', 'like', "%{$search}%");
                  });
            });
        }

        // Filtros específicos
        if ($request->has('type') && $request->type) {
            $query->where('type', $request->type);
        }

        if ($request->has('status') && $request->status) {
            $query->where('status', $request->status);
        }

        if ($request->has('priority') && $request->priority) {
            $query->where('priority', $request->priority);
        }

        if ($request->has('assigned_to') && $request->assigned_to) {
            $query->where('assigned_to', $request->assigned_to);
        }

        if ($request->has('client_id') && $request->client_id) {
            $query->where('client_id', $request->client_id);
        }

        // Filtros de fecha
        if ($request->has('due_date_from') && $request->due_date_from) {
            $query->where('due_date', '>=', $request->due_date_from);
        }

        if ($request->has('due_date_to') && $request->due_date_to) {
            $query->where('due_date', '<=', $request->due_date_to);
        }

        // Filtros especiales
        if ($request->has('overdue') && $request->overdue) {
            $query->overdue();
        }

        if ($request->has('due_today') && $request->due_today) {
            $query->dueToday();
        }

        if ($request->has('due_this_week') && $request->due_this_week) {
            $query->dueThisWeek();
        }

        if ($request->has('needing_follow_up') && $request->needing_follow_up) {
            $query->needingFollowUp();
        }
    }
}
