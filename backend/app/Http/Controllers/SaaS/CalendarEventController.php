<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\CalendarEvent;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;

class CalendarEventController extends Controller
{
    /**
     * Obtener broker_id del usuario autenticado
     */
    private function getBrokerId(Request $request)
    {
        return $request->user()->broker_id;
    }

    /**
     * Listar eventos del calendario
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $query = CalendarEvent::forBroker($brokerId)
                ->manualEvents()
                ->with('creator')
                ->orderBy('start_date', 'asc');

            // Filtrar por rango de fechas si se proporciona
            if ($request->filled('start_date') && $request->filled('end_date')) {
                $query->betweenDates($request->start_date, $request->end_date);
            }

            $events = $query->get();

            return response()->json([
                'success' => true,
                'data' => $events,
                'message' => 'Eventos obtenidos exitosamente'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error al obtener eventos del calendario:', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al obtener eventos',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear un nuevo evento
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $validated = $request->validate([
                'title' => 'required|string|max:255',
                'description' => 'nullable|string',
                'start_date' => 'required|date',
                'end_date' => 'required|date|after_or_equal:start_date',
                'all_day' => 'nullable|boolean',
                'color' => 'nullable|string|in:primary,success,warning,error,default,red,green,azure',
            ]);

            $validated['broker_id'] = $brokerId;
            $validated['created_by'] = $request->user()->id;
            $validated['event_type'] = 'manual';
            $validated['all_day'] = $validated['all_day'] ?? false;
            $validated['color'] = $validated['color'] ?? 'primary';

            $event = CalendarEvent::create($validated);
            $event->load('creator');

            return response()->json([
                'success' => true,
                'data' => $event,
                'message' => 'Evento creado exitosamente'
            ], 201);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $e->errors()
            ], 422);

        } catch (\Exception $e) {
            \Log::error('Error al crear evento del calendario:', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al crear evento',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mostrar un evento específico
     */
    public function show(Request $request, $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $event = CalendarEvent::forBroker($brokerId)
                ->with('creator')
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $event
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Evento no encontrado'
            ], 404);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener evento',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar un evento
     */
    public function update(Request $request, $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $event = CalendarEvent::forBroker($brokerId)
                ->manualEvents()
                ->findOrFail($id);

            $validated = $request->validate([
                'title' => 'sometimes|required|string|max:255',
                'description' => 'nullable|string',
                'start_date' => 'sometimes|required|date',
                'end_date' => 'sometimes|required|date|after_or_equal:start_date',
                'all_day' => 'nullable|boolean',
                'color' => 'nullable|string|in:primary,success,warning,error,default,red,green,azure',
            ]);

            $event->update($validated);
            $event->load('creator');

            return response()->json([
                'success' => true,
                'data' => $event,
                'message' => 'Evento actualizado exitosamente'
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Evento no encontrado'
            ], 404);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error de validación',
                'errors' => $e->errors()
            ], 422);

        } catch (\Exception $e) {
            \Log::error('Error al actualizar evento del calendario:', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar evento',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar un evento
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $event = CalendarEvent::forBroker($brokerId)
                ->manualEvents()
                ->findOrFail($id);

            $event->delete();

            return response()->json([
                'success' => true,
                'message' => 'Evento eliminado exitosamente'
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Evento no encontrado'
            ], 404);

        } catch (\Exception $e) {
            \Log::error('Error al eliminar evento del calendario:', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar evento',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
