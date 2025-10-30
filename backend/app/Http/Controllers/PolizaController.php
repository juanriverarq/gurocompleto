<?php

namespace App\Http\Controllers;

use App\Models\Poliza;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class PolizaController extends Controller
{
    /**
     * Obtener lista de pólizas con filtros y paginación
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = Poliza::with('user:id,name,email');

            // Filtros de búsqueda
            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->buscarPoliza($search)
                      ->orWhere(function($subQ) use ($search) {
                          $subQ->buscarCliente($search);
                      });
                });
            }

            // Filtro por aseguradora
            if ($request->has('aseguradora') && $request->aseguradora) {
                $query->aseguradora($request->aseguradora);
            }

            // Filtro por ramo
            if ($request->has('ramo') && $request->ramo) {
                $query->ramo($request->ramo);
            }

            // Filtro por estado
            if ($request->has('estado') && $request->estado) {
                switch ($request->estado) {
                    case 'ACTIVA':
                        $query->activas();
                        break;
                    case 'VENCIDA':
                        $query->vencidas();
                        break;
                    case 'POR_VENCER':
                        $query->porVencer(30);
                        break;
                    default:
                        $query->where('estado', $request->estado);
                        break;
                }
            }

            // Filtro por rango de fechas
            if ($request->has('fecha_inicio') && $request->fecha_inicio) {
                $query->where('fecha_inicio', '>=', $request->fecha_inicio);
            }
            if ($request->has('fecha_fin') && $request->fecha_fin) {
                $query->where('fecha_fin', '<=', $request->fecha_fin);
            }

            // Ordenamiento
            $sortField = $request->get('sort_field', 'created_at');
            $sortDirection = $request->get('sort_direction', 'desc');
            $query->orderBy($sortField, $sortDirection);

            // Paginación
            $perPage = $request->get('per_page', 15);
            $polizas = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'data' => $polizas,
                'filters_applied' => [
                    'search' => $request->search,
                    'aseguradora' => $request->aseguradora,
                    'ramo' => $request->ramo,
                    'estado' => $request->estado,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error al obtener pólizas: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las pólizas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear nueva póliza
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                // Información básica
                'numero_poliza' => 'required|string|unique:polizas,numero_poliza',
                'aseguradora' => 'required|string|max:255',
                'ramo_principal' => 'required|string|max:255',
                'riesgo' => 'nullable|string|max:255',
                'valor_riesgo_asegurado' => 'nullable|numeric|min:0',
                'subramo' => 'nullable|string|max:255',
                'tipo_poliza' => 'nullable|string|max:255',
                
                // Información del cliente
                'nombres_cliente' => 'required|string|max:255',
                'apellidos_cliente' => 'required|string|max:255',
                'dni_cliente' => 'required|string|max:50',
                'tipo_documento' => 'nullable|string|max:10',
                'telefono_cliente' => 'nullable|string|max:20',
                'celular_cliente' => 'nullable|string|max:20',
                'fecha_expedicion_dni' => 'nullable|date',
                'fecha_nacimiento' => 'nullable|date',
                'domicilio' => 'nullable|string',
                'correo_cliente' => 'nullable|email|max:255',
                'correos_secundarios' => 'nullable|string',
                'observaciones_cliente' => 'nullable|string',
                
                // Información financiera
                'prima_neta' => 'required|numeric|min:0',
                'porcentaje_iva' => 'nullable|numeric|min:0|max:100',
                'iva' => 'nullable|numeric|min:0',
                'total' => 'nullable|numeric|min:0',
                'porcentaje_comision' => 'nullable|numeric|min:0|max:100',
                'comision' => 'nullable|numeric|min:0',
                'gastos_adicionales' => 'nullable|numeric|min:0',
                'gastos_adicionales_aplica_iva' => 'nullable|boolean',
                'forma_pago' => 'nullable|string|max:100',
                'periodicidad_pago' => 'nullable|string|max:100',
                'medio_pago' => 'nullable|string|max:100',
                
                // Información administrativa
                'vendedor' => 'nullable|string|max:255',
                'observaciones' => 'nullable|string',
                'observaciones_internas' => 'nullable|string',
                'fecha_expedicion' => 'required|date',
                'fecha_inicio' => 'required|date',
                'fecha_fin' => 'required|date|after:fecha_inicio',
                'estado' => 'nullable|in:ACTIVA,VENCIDA,CANCELADA,SUSPENDIDA',
                'sede' => 'nullable|string|max:255',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos de entrada inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            DB::beginTransaction();

            $polizaData = $request->all();
            $polizaData['user_id'] = $request->user() ? $request->user()->id : 1;
            
            // Establecer valores por defecto
            if (!isset($polizaData['porcentaje_iva'])) {
                $polizaData['porcentaje_iva'] = 19.00;
            }
            if (!isset($polizaData['estado'])) {
                $polizaData['estado'] = 'ACTIVA';
            }
            if (!isset($polizaData['tipo_documento'])) {
                $polizaData['tipo_documento'] = 'CC';
            }

            $poliza = Poliza::create($polizaData);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Póliza creada exitosamente',
                'data' => $poliza->load('user:id,name,email')
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error al crear póliza: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al crear la póliza',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener una póliza específica
     */
    public function show(string $id): JsonResponse
    {
        try {
            $poliza = Poliza::with('user:id,name,email')->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $poliza
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Póliza no encontrada',
                'error' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Actualizar una póliza
     */
    public function update(Request $request, string $id): JsonResponse
    {
        try {
            $poliza = Poliza::findOrFail($id);

            $validator = Validator::make($request->all(), [
                // Información básica
                'numero_poliza' => 'sometimes|string|unique:polizas,numero_poliza,' . $id,
                'aseguradora' => 'sometimes|string|max:255',
                'ramo_principal' => 'sometimes|string|max:255',
                'riesgo' => 'nullable|string|max:255',
                'valor_riesgo_asegurado' => 'nullable|numeric|min:0',
                'subramo' => 'nullable|string|max:255',
                'tipo_poliza' => 'nullable|string|max:255',
                
                // Información del cliente
                'nombres_cliente' => 'sometimes|string|max:255',
                'apellidos_cliente' => 'sometimes|string|max:255',
                'dni_cliente' => 'sometimes|string|max:50',
                'tipo_documento' => 'nullable|string|max:10',
                'telefono_cliente' => 'nullable|string|max:20',
                'celular_cliente' => 'nullable|string|max:20',
                'fecha_expedicion_dni' => 'nullable|date',
                'fecha_nacimiento' => 'nullable|date',
                'domicilio' => 'nullable|string',
                'correo_cliente' => 'nullable|email|max:255',
                'correos_secundarios' => 'nullable|string',
                'observaciones_cliente' => 'nullable|string',
                
                // Información financiera
                'prima_neta' => 'sometimes|numeric|min:0',
                'porcentaje_iva' => 'nullable|numeric|min:0|max:100',
                'iva' => 'nullable|numeric|min:0',
                'total' => 'nullable|numeric|min:0',
                'porcentaje_comision' => 'nullable|numeric|min:0|max:100',
                'comision' => 'nullable|numeric|min:0',
                'gastos_adicionales' => 'nullable|numeric|min:0',
                'gastos_adicionales_aplica_iva' => 'nullable|boolean',
                'forma_pago' => 'nullable|string|max:100',
                'periodicidad_pago' => 'nullable|string|max:100',
                'medio_pago' => 'nullable|string|max:100',
                
                // Información administrativa
                'vendedor' => 'nullable|string|max:255',
                'observaciones' => 'nullable|string',
                'observaciones_internas' => 'nullable|string',
                'fecha_expedicion' => 'sometimes|date',
                'fecha_inicio' => 'sometimes|date',
                'fecha_fin' => 'sometimes|date|after:fecha_inicio',
                'estado' => 'nullable|in:ACTIVA,VENCIDA,CANCELADA,SUSPENDIDA',
                'sede' => 'nullable|string|max:255',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos de entrada inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            DB::beginTransaction();

            $poliza->update($request->all());

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Póliza actualizada exitosamente',
                'data' => $poliza->load('user:id,name,email')
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error al actualizar póliza: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar la póliza',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar una póliza
     */
    public function destroy(string $id): JsonResponse
    {
        try {
            $poliza = Poliza::findOrFail($id);

            DB::beginTransaction();

            $poliza->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Póliza eliminada exitosamente'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error al eliminar póliza: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar la póliza',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener estadísticas de pólizas
     */
    public function estadisticas(): JsonResponse
    {
        try {
            $stats = [
                'total_polizas' => Poliza::count(),
                'polizas_activas' => Poliza::activas()->count(),
                'polizas_vencidas' => Poliza::vencidas()->count(),
                'polizas_por_vencer' => Poliza::porVencer(30)->count(),
                'polizas_canceladas' => Poliza::where('estado', 'CANCELADA')->count(),
                'polizas_suspendidas' => Poliza::where('estado', 'SUSPENDIDA')->count(),
                'valor_total_primas' => Poliza::activas()->sum('prima_neta'),
                'valor_total_iva' => Poliza::activas()->sum('iva'),
                'valor_total_facturado' => Poliza::activas()->sum('total'),
                'polizas_por_aseguradora' => Poliza::select('aseguradora', DB::raw('count(*) as total'))
                    ->groupBy('aseguradora')
                    ->orderBy('total', 'desc')
                    ->get(),
                'polizas_por_ramo' => Poliza::select('ramo_principal', DB::raw('count(*) as total'))
                    ->groupBy('ramo_principal')
                    ->orderBy('total', 'desc')
                    ->get(),
                'polizas_por_mes' => Poliza::select(
                        DB::raw('YEAR(fecha_expedicion) as año'),
                        DB::raw('MONTH(fecha_expedicion) as mes'),
                        DB::raw('count(*) as total')
                    )
                    ->whereYear('fecha_expedicion', Carbon::now()->year)
                    ->groupBy('año', 'mes')
                    ->orderBy('mes')
                    ->get()
            ];

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);

        } catch (\Exception $e) {
            Log::error('Error al obtener estadísticas: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Cambiar estado de una póliza
     */
    public function cambiarEstado(Request $request, string $id): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'estado' => 'required|in:ACTIVA,VENCIDA,CANCELADA,SUSPENDIDA',
                'motivo' => 'nullable|string|max:500'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Estado inválido',
                    'errors' => $validator->errors()
                ], 422);
            }

            $poliza = Poliza::findOrFail($id);

            DB::beginTransaction();

            $estadoAnterior = $poliza->estado;
            $poliza->update(['estado' => $request->estado]);

            // Log del cambio de estado
            Log::info("Cambio de estado de póliza {$poliza->numero_poliza}: {$estadoAnterior} -> {$request->estado}", [
                'user_id' => $request->user() ? $request->user()->id : 'guest',
                'motivo' => $request->motivo
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Estado de la póliza cambiado a {$request->estado}",
                'data' => $poliza->load('user:id,name,email')
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error al cambiar estado de póliza: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al cambiar el estado de la póliza',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Buscar pólizas por cliente
     */
    public function buscarPorCliente(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'dni' => 'required|string'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'DNI requerido',
                    'errors' => $validator->errors()
                ], 422);
            }

            $polizas = Poliza::with('user:id,name,email')
                ->where('dni_cliente', $request->dni)
                ->orderBy('fecha_expedicion', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $polizas,
                'total' => $polizas->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Error al buscar pólizas por cliente: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al buscar pólizas',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
