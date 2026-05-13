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
use Illuminate\Support\Facades\Auth;

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
                        $q->select('id', 'name', 'email', 'broker_id');
                    },
                    'assignedEmpleado' => function($q) {
                        $q->select('id', 'nombres', 'apellidos', 'email', 'broker_id');
                    },
                    'creator' => function($q) {
                        $q->select('id', 'name', 'email', 'broker_id');
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
                'reminder_at' => 'nullable|date|after:now',
                'assigned_company' => 'nullable|string|max:255',
                'assigned_financial_entity' => 'nullable|string|max:255',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $taskData = $validator->validated();
            $taskData['broker_id'] = $brokerId;
            // Resolver created_by de forma robusta (usuario Firebase o fallback a usuario del broker)
            $authUser = $request->get('authenticated_user') ?? Auth::user();
            $createdById = $authUser?->id;
            if (!$createdById) {
                // Fallback: usar cualquier usuario del broker para mantener integridad referencial (FK a users.id)
                $createdById = \App\Models\User::where('broker_id', $brokerId)->value('id');
            }
            if (!$createdById) {
                \Log::error('❌ [CommercialTasks@store] No se encontró usuario para created_by', [
                    'broker_id' => $brokerId,
                    'auth_type' => $request->get('auth_type'),
                    'has_authenticated_user' => (bool) $request->get('authenticated_user'),
                    'has_empleado' => (bool) $request->get('authenticated_empleado')
                ]);
                return response()->json([
                    'error' => 'Error al crear la tarea',
                    'message' => 'No existe un usuario asociado al broker para created_by. Cree al menos un usuario del broker.'
                ], 500);
            }
            $taskData['created_by'] = $createdById;
            
            // Si no se asigna a nadie, asignar al creador
            if (!isset($taskData['assigned_to'])) {
                // Si el autenticado es empleado, asignar al empleado para reflejar correctamente en UI (assignedEmpleado)
                $empleado = $request->get('authenticated_empleado');
                if ($empleado) {
                    $taskData['assigned_to'] = $empleado->id;
                } else {
                    $taskData['assigned_to'] = $createdById;
                }
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
                    $q->select('id', 'name', 'email', 'broker_id');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email', 'broker_id');
                },
                'creator' => function($q) {
                    $q->select('id', 'name', 'email', 'broker_id');
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
            \Log::error('Error al crear tarea comercial: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'error' => 'No se pudo crear la tarea. Inténtalo de nuevo.'
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
                    $q->select('id', 'name', 'email', 'broker_id');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email', 'broker_id');
                },
                'creator' => function($q) {
                    $q->select('id', 'name', 'email', 'broker_id');
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
                    $q->select('id', 'name', 'email', 'broker_id');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email', 'broker_id');
                },
                'creator' => function($q) {
                    $q->select('id', 'name', 'email', 'broker_id');
                }
            ]);

            return response()->json([
                'message' => 'Tarea actualizada exitosamente',
                'data' => new CommercialTaskResource($task)
            ]);

        } catch (\Exception $e) {
            \Log::error('Error al actualizar tarea comercial: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'error' => 'No se pudo actualizar la tarea. Inténtalo de nuevo.'
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
            \Log::error('Error al eliminar tarea comercial: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'error' => 'No se pudo eliminar la tarea. Inténtalo de nuevo.'
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
                    $q->select('id', 'name', 'email', 'broker_id');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email', 'broker_id');
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
                    $q->select('id', 'name', 'email', 'broker_id');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email', 'broker_id');
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
                    $q->select('id', 'name', 'email', 'broker_id');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email', 'broker_id');
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
                    $q->select('id', 'name', 'email', 'broker_id');
                },
                'assignedEmpleado' => function($q) {
                    $q->select('id', 'nombres', 'apellidos', 'email', 'broker_id');
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
                        $q->select('id', 'name', 'email', 'broker_id');
                    },
                    'assignedEmpleado' => function($q) {
                        $q->select('id', 'nombres', 'apellidos', 'email', 'broker_id');
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
     * Reasignar tarea a otro usuario/empleado
     */
    public function assign(Request $request, CommercialTask $task): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'assigned_to' => 'required|integer',
                'reason' => 'nullable|string|max:1000',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $data = $validator->validated();
            $previous = $task->assigned_to;

            $task->update(['assigned_to' => $data['assigned_to']]);

            $task->addActivity('Tarea reasignada', [
                'from' => $previous,
                'to' => $data['assigned_to'],
                'reason' => $data['reason'] ?? null,
            ]);

            $task->load([
                'client' => function($q) {
                    $q->select('id', 'first_name', 'last_name', 'document_number', 'email', 'phone');
                },
                'poliza' => function($q) {
                    $q->select('id', 'policy_number', 'type', 'status');
                },
                'assignedUser' => function($q) { $q->select('id', 'name', 'email', 'broker_id'); },
                'assignedEmpleado' => function($q) { $q->select('id', 'nombres', 'apellidos', 'email', 'broker_id'); },
            ]);

            return response()->json([
                'message' => 'Tarea reasignada',
                'data' => new CommercialTaskResource($task),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al reasignar la tarea',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Agregar una nota a la bitácora de la tarea
     */
    public function addNote(Request $request, CommercialTask $task): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'note' => 'required|string|max:5000',
                'is_private' => 'boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $data = $validator->validated();

            $task->addActivity('Nota agregada', [
                'note' => $data['note'],
                'is_private' => $data['is_private'] ?? false,
            ]);

            // Acumular en notes (texto libre) también, para retro-compatibilidad
            $stamp = now()->format('Y-m-d H:i');
            $task->update([
                'notes' => trim(($task->notes ?? '') . "\n[{$stamp}] " . $data['note']),
            ]);

            return response()->json([
                'message' => 'Nota agregada',
                'data' => $task->fresh()->activity_log,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al agregar la nota',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Pausar tarea
     */
    public function pause(Request $request, CommercialTask $task): JsonResponse
    {
        try {
            $reason = $request->input('reason');
            $task->pause($reason);
            $task->addActivity('Tarea pausada', ['reason' => $reason]);
            return response()->json(['message' => 'Tarea pausada', 'data' => $task->fresh()]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Cancelar tarea
     */
    public function cancel(Request $request, CommercialTask $task): JsonResponse
    {
        try {
            $reason = $request->input('reason');
            $task->cancel($reason);
            $task->addActivity('Tarea cancelada', ['reason' => $reason]);
            return response()->json(['message' => 'Tarea cancelada', 'data' => $task->fresh()]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error', 'message' => $e->getMessage()], 500);
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

            // Pre-cargar empleados del broker indexados por id para resolución rápida
            $empleadosById = \App\Models\EmpleadoBroker::where('broker_id', $brokerId)
                ->where('acceso_activo', true)
                ->get()
                ->keyBy('id');

            $resolvedEmpleadoIds = collect(); // IDs de empleados ya resueltos via shadow user

            $users = User::where('broker_id', $brokerId)
                ->select('id', 'name', 'email', 'user_type', 'firebase_uid')
                ->orderBy('name')
                ->get()
                ->map(function ($u) use ($empleadosById, &$resolvedEmpleadoIds) {
                    $rawName = trim((string) ($u->name ?? ''));
                    $rawEmail = (string) ($u->email ?? '');

                    // Detectar email sintético "empleado.<id>.broker.<n>@empleado.local"
                    $empleadoMatch = null;
                    if (str_ends_with($rawEmail, '@empleado.local')) {
                        if (preg_match('/empleado\.(\d+)/i', $rawEmail, $m)) {
                            $empleadoId = (int) $m[1];
                            $empleadoMatch = $empleadosById->get($empleadoId);
                        }
                    }
                    // Fallback: firebase_uid con patrón "empleado:<id>:..."
                    if (!$empleadoMatch && $u->firebase_uid && preg_match('/empleado:(\d+)/i', (string) $u->firebase_uid, $m2)) {
                        $empleadoMatch = $empleadosById->get((int) $m2[1]);
                    }

                    if ($empleadoMatch) {
                        $resolvedEmpleadoIds->push($empleadoMatch->id);
                        $fullName = trim(($empleadoMatch->nombres ?? '') . ' ' . ($empleadoMatch->apellidos ?? ''));
                        $realEmail = $empleadoMatch->email ?: $rawEmail;
                        return [
                            'id' => $u->id,
                            'name' => $fullName !== '' ? $fullName : ($realEmail ?: ('Empleado ' . $empleadoMatch->id)),
                            'email' => $realEmail,
                            'type' => 'empleado',
                        ];
                    }

                    $isPlaceholder = $rawName === ''
                        || in_array(strtolower($rawName), ['usuario', 'user', 'admin', 'administrador', 'empleado'], true);
                    $displayName = $isPlaceholder ? ($rawEmail ?: ('Usuario ' . $u->id)) : $rawName;
                    return [
                        'id' => $u->id,
                        'name' => $displayName,
                        'email' => $rawEmail,
                        'type' => 'user',
                    ];
                });

            // Agregar empleados que NO tienen shadow user (usando su empleado_brokers.id directamente)
            $empleadosSinShadow = $empleadosById->reject(fn($e) => $resolvedEmpleadoIds->contains($e->id));
            foreach ($empleadosSinShadow as $emp) {
                $fullName = trim(($emp->nombres ?? '') . ' ' . ($emp->apellidos ?? ''));
                $users->push([
                    'id' => $emp->id,
                    'name' => $fullName !== '' ? $fullName : ($emp->email ?: ('Empleado ' . $emp->id)),
                    'email' => $emp->email,
                    'type' => 'empleado',
                ]);
            }

            return response()->json(['data' => $users->values()]);

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

        // Filtros específicos (soportan valores separados por coma -> whereIn)
        if ($request->has('type') && $request->type) {
            $values = array_filter(array_map('trim', explode(',', (string) $request->type)));
            count($values) > 1 ? $query->whereIn('type', $values) : $query->where('type', $values[0] ?? $request->type);
        }

        if ($request->has('status') && $request->status) {
            $values = array_filter(array_map('trim', explode(',', (string) $request->status)));
            count($values) > 1 ? $query->whereIn('status', $values) : $query->where('status', $values[0] ?? $request->status);
        }

        if ($request->has('priority') && $request->priority) {
            $values = array_filter(array_map('trim', explode(',', (string) $request->priority)));
            count($values) > 1 ? $query->whereIn('priority', $values) : $query->where('priority', $values[0] ?? $request->priority);
        }

        if ($request->has('assigned_to') && $request->assigned_to) {
            $query->where('assigned_to', $request->assigned_to);
        }

        if ($request->has('client_id') && $request->client_id) {
            $query->where('client_id', $request->client_id);
        }

        if ($request->has('poliza_id') && $request->poliza_id) {
            $query->where('poliza_id', $request->poliza_id);
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
