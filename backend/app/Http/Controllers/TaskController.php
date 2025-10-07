<?php

namespace App\Http\Controllers;

use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class TaskController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            // Simulamos un usuario para pruebas
            $userId = 9; // Usar ID de usuario fijo temporalmente
            
            $query = Task::with('user')
                        ->where('usuario_id', $userId)
                        ->orderBy('fecha_vencimiento', 'asc');

            // Filtros
            if ($request->filled('busqueda')) {
                $query->search($request->busqueda);
            }

            if ($request->filled('estado')) {
                $query->byEstado($request->estado);
            }

            if ($request->filled('tipo')) {
                $query->byTipo($request->tipo);
            }

            if ($request->filled('prioridad')) {
                $query->byPrioridad($request->prioridad);
            }

            if ($request->filled('asignado')) {
                $query->byAsignado($request->asignado);
            }

            if ($request->filled('fecha_vencimiento')) {
                switch ($request->fecha_vencimiento) {
                    case 'hoy':
                        $query->vencenHoy();
                        break;
                    case 'semana':
                        $query->vencenEstaSemana();
                        break;
                }
            }

            // Paginación
            $perPage = $request->get('per_page', 15);
            $tasks = $query->paginate($perPage);

            // Actualizar tareas vencidas
            Task::actualizarTareasVencidas();

            return response()->json([
                'success' => true,
                'data' => $tasks,
                'message' => 'Tareas obtenidas correctamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las tareas: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'titulo' => 'required|string|max:255',
            'descripcion' => 'required|string',
            'tipo' => 'required|in:' . implode(',', Task::TIPOS),
            'prioridad' => 'required|in:' . implode(',', Task::PRIORIDADES),
            'fecha_vencimiento' => 'required|date|after_or_equal:today',
            'asignado_a' => 'required|string|max:255',
            'cliente' => 'required|string|max:255',
            'numero_poliza' => 'nullable|string|max:255',
            'observaciones' => 'nullable|string'
        ], [
            'titulo.required' => 'El título es obligatorio',
            'descripcion.required' => 'La descripción es obligatoria',
            'tipo.required' => 'El tipo es obligatorio',
            'tipo.in' => 'El tipo seleccionado no es válido',
            'prioridad.required' => 'La prioridad es obligatoria',
            'prioridad.in' => 'La prioridad seleccionada no es válida',
            'fecha_vencimiento.required' => 'La fecha de vencimiento es obligatoria',
            'fecha_vencimiento.date' => 'La fecha de vencimiento debe ser una fecha válida',
            'fecha_vencimiento.after_or_equal' => 'La fecha de vencimiento no puede ser anterior a hoy',
            'asignado_a.required' => 'El campo asignado a es obligatorio',
            'cliente.required' => 'El cliente es obligatorio'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $task = Task::create([
                'titulo' => $request->titulo,
                'descripcion' => $request->descripcion,
                'tipo' => $request->tipo,
                'prioridad' => $request->prioridad,
                'fecha_vencimiento' => $request->fecha_vencimiento,
                'asignado_a' => $request->asignado_a,
                'cliente' => $request->cliente,
                'numero_poliza' => $request->numero_poliza,
                'observaciones' => $request->observaciones,
                'usuario_id' => 9 // Usar ID de usuario fijo temporalmente
            ]);

            return response()->json([
                'success' => true,
                'data' => $task->load('user'),
                'message' => 'Tarea creada correctamente'
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear la tarea: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        try {
            $task = Task::with('user')
                       ->where('usuario_id', 9) // Usar ID de usuario fijo temporalmente
                       ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $task,
                'message' => 'Tarea obtenida correctamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Tarea no encontrada'
            ], 404);
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        try {
            $task = Task::where('usuario_id', 9)->findOrFail($id);

            $validator = Validator::make($request->all(), [
                'titulo' => 'sometimes|required|string|max:255',
                'descripcion' => 'sometimes|required|string',
                'tipo' => 'sometimes|required|in:' . implode(',', Task::TIPOS),
                'prioridad' => 'sometimes|required|in:' . implode(',', Task::PRIORIDADES),
                'estado' => 'sometimes|required|in:' . implode(',', Task::ESTADOS),
                'fecha_vencimiento' => 'sometimes|required|date',
                'asignado_a' => 'sometimes|required|string|max:255',
                'cliente' => 'sometimes|required|string|max:255',
                'numero_poliza' => 'nullable|string|max:255',
                'progreso' => 'sometimes|integer|min:0|max:100',
                'observaciones' => 'nullable|string'
            ], [
                'titulo.required' => 'El título es obligatorio',
                'descripcion.required' => 'La descripción es obligatoria',
                'tipo.in' => 'El tipo seleccionado no es válido',
                'prioridad.in' => 'La prioridad seleccionada no es válida',
                'estado.in' => 'El estado seleccionado no es válido',
                'fecha_vencimiento.date' => 'La fecha de vencimiento debe ser una fecha válida',
                'asignado_a.required' => 'El campo asignado a es obligatorio',
                'cliente.required' => 'El cliente es obligatorio',
                'progreso.integer' => 'El progreso debe ser un número entero',
                'progreso.min' => 'El progreso no puede ser menor a 0',
                'progreso.max' => 'El progreso no puede ser mayor a 100'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos de validación incorrectos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $task->update($request->only([
                'titulo',
                'descripcion',
                'tipo',
                'prioridad',
                'estado',
                'fecha_vencimiento',
                'asignado_a',
                'cliente',
                'numero_poliza',
                'progreso',
                'observaciones'
            ]));

            return response()->json([
                'success' => true,
                'data' => $task->load('user'),
                'message' => 'Tarea actualizada correctamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar la tarea: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        try {
            $task = Task::where('usuario_id', 9)->findOrFail($id);
            $task->delete();

            return response()->json([
                'success' => true,
                'message' => 'Tarea eliminada correctamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar la tarea: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Marcar tarea como completada
     */
    public function marcarCompletada(string $id): JsonResponse
    {
        try {
            $task = Task::where('usuario_id', 9)->findOrFail($id);
            $task->marcarCompletada();

            return response()->json([
                'success' => true,
                'data' => $task->load('user'),
                'message' => 'Tarea marcada como completada'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al completar la tarea: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener estadísticas de tareas
     */
    public function estadisticas(): JsonResponse
    {
        try {
            $userId = 9; // Usar ID de usuario fijo temporalmente
            
            $stats = [
                'total' => Task::where('usuario_id', $userId)->count(),
                'pendientes' => Task::where('usuario_id', $userId)->byEstado('Pendiente')->count(),
                'en_progreso' => Task::where('usuario_id', $userId)->byEstado('En Progreso')->count(),
                'completadas' => Task::where('usuario_id', $userId)->byEstado('Completada')->count(),
                'vencidas' => Task::where('usuario_id', $userId)->vencidas()->count(),
                'vencen_hoy' => Task::where('usuario_id', $userId)->vencenHoy()->count(),
                'vencen_semana' => Task::where('usuario_id', $userId)->vencenEstaSemana()->count()
            ];

            return response()->json([
                'success' => true,
                'data' => $stats,
                'message' => 'Estadísticas obtenidas correctamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener opciones para formularios
     */
    public function opciones(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'tipos' => Task::TIPOS,
                'prioridades' => Task::PRIORIDADES,
                'estados' => Task::ESTADOS
            ],
            'message' => 'Opciones obtenidas correctamente'
        ]);
    }

    /**
     * Exportar tareas a CSV
     */
    public function export(Request $request)
    {
        try {
            $query = Task::where('usuario_id', 9)->orderBy('fecha_vencimiento', 'asc');

            // Aplicar filtros
            if ($request->has('busqueda') && !empty($request->busqueda)) {
                $query->where(function ($q) use ($request) {
                    $q->where('titulo', 'like', '%' . $request->busqueda . '%')
                      ->orWhere('descripcion', 'like', '%' . $request->busqueda . '%')
                      ->orWhere('cliente', 'like', '%' . $request->busqueda . '%')
                      ->orWhere('numero_poliza', 'like', '%' . $request->busqueda . '%');
                });
            }

            if ($request->has('tipo') && !empty($request->tipo)) {
                $query->where('tipo', $request->tipo);
            }

            if ($request->has('estado') && !empty($request->estado)) {
                $query->where('estado', $request->estado);
            }

            if ($request->has('prioridad') && !empty($request->prioridad)) {
                $query->where('prioridad', $request->prioridad);
            }

            if ($request->has('asignado') && !empty($request->asignado)) {
                $query->where('asignado_a', $request->asignado);
            }

            $tasks = $query->get();

            $csvHeader = ['ID', 'Título', 'Descripción', 'Tipo', 'Prioridad', 'Estado', 'Cliente', 'Asignado A', 'Fecha Vencimiento', 'Progreso', 'Observaciones', 'Número Póliza'];

            $csvData = [];
            foreach ($tasks as $task) {
                $csvData[] = [
                    $task->id,
                    $task->titulo,
                    $task->descripcion,
                    $task->tipo,
                    $task->prioridad,
                    $task->estado,
                    $task->cliente,
                    $task->asignado_a,
                    $task->fecha_vencimiento,
                    $task->progreso . '%',
                    $task->observaciones ?? '',
                    $task->numero_poliza ?? ''
                ];
            }

            $filename = 'tareas_' . date('Y-m-d_H-i-s') . '.csv';
            
            $handle = fopen('php://memory', 'r+');
            fputcsv($handle, $csvHeader);
            foreach ($csvData as $row) {
                fputcsv($handle, $row);
            }
            rewind($handle);
            $csv = stream_get_contents($handle);
            fclose($handle);

            return response($csv, 200, [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                'Expires' => '0'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al exportar las tareas: ' . $e->getMessage()
            ], 500);
        }
    }
}
