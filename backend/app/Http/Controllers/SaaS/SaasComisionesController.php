<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Poliza;
use App\Models\ComisionAseguradora;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SaasComisionesController extends Controller
{
    /**
     * Get the broker ID for the current user
     */
    private function getBrokerId(Request $request)
    {
        // 1. Primero intentar obtener desde el middleware GlobalBrokerAuth
        if ($request->has('authenticated_broker_id')) {
            $brokerId = $request->get('authenticated_broker_id');
            return $brokerId;
        }

        // 2. Intentar obtener el usuario autenticado
        $user = $request->user();

        // 3. Si no hay usuario, intentar obtenerlo de Auth
        if (!$user) {
            $user = \Illuminate\Support\Facades\Auth::user();
        }

        if ($user && $user->broker_id) {
            return $user->broker_id;
        }

        throw new \Exception('Usuario no tiene un broker asignado');
    }

    /**
     * Display a listing of comisiones with filters and pagination
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // Construir query base con pólizas que tienen comisiones
            $query = Poliza::where('broker_id', $brokerId)
                ->where('status', 'active')
                ->where('commission_amount', '>', 0)
                ->with(['client', 'assignedUser']);

            // Aplicar filtros
            if ($request->has('search') && !empty($request->search)) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('policy_number', 'like', "%{$search}%")
                      ->orWhere('client_name', 'like', "%{$search}%")
                      ->orWhere('insurance_company', 'like', "%{$search}%");
                });
            }

            if ($request->has('aseguradora') && !empty($request->aseguradora)) {
                $query->where('insurance_company', $request->aseguradora);
            }

            if ($request->has('asesor') && !empty($request->asesor)) {
                $query->whereHas('assignedUser', function($q) use ($request) {
                    $q->where('name', 'like', "%{$request->asesor}%");
                });
            }

            if ($request->has('estado') && !empty($request->estado)) {
                // Por ahora, el estado se determina dinámicamente
                // En el futuro podría haber una tabla separada para estados de comisión
            }

            if ($request->has('fecha_desde') && !empty($request->fecha_desde)) {
                $query->where('created_at', '>=', $request->fecha_desde);
            }

            if ($request->has('fecha_hasta') && !empty($request->fecha_hasta)) {
                $query->where('created_at', '<=', $request->fecha_hasta);
            }

            // Ordenamiento
            $sortField = $request->get('sort_field', 'created_at');
            $sortDirection = $request->get('sort_direction', 'desc');

            $fieldMapping = [
                'numero_poliza' => 'policy_number',
                'cliente' => 'client_name',
                'aseguradora' => 'insurance_company',
                'prima' => 'premium_amount',
                'comision' => 'commission_amount',
                'fecha' => 'created_at'
            ];

            $dbField = $fieldMapping[$sortField] ?? $sortField;
            $query->orderBy($dbField, $sortDirection);

            // Paginación
            $perPage = $request->get('per_page', 15);
            $polizas = $query->paginate($perPage);

            // Transformar datos para el frontend
            $transformedData = $polizas->through(function ($poliza) {
                return $this->transformPolizaToComision($poliza);
            });

            $response = $transformedData->toArray();
            $response['success'] = true;
            $response['message'] = 'Comisiones obtenidas exitosamente';

            return response()->json($response);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las comisiones: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get comisiones statistics
     */
    public function estadisticas(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // Estadísticas básicas de comisiones
            $stats = Poliza::where('broker_id', $brokerId)
                ->where('status', 'active')
                ->where('commission_amount', '>', 0)
                ->selectRaw('
                    COUNT(*) as total_comisiones,
                    SUM(commission_amount) as total_monto_comisiones,
                    AVG(commission_percentage) as promedio_porcentaje,
                    SUM(premium_amount) as total_prima_asegurada
                ')
                ->first();

            // Estadísticas por asesor
            $comisionesPorAsesor = Poliza::where('broker_id', $brokerId)
                ->where('status', 'active')
                ->where('commission_amount', '>', 0)
                ->with('assignedUser')
                ->selectRaw('
                    assigned_user_id,
                    COUNT(*) as cantidad_polizas,
                    SUM(commission_amount) as total_comisiones,
                    SUM(premium_amount) as total_prima
                ')
                ->groupBy('assigned_user_id')
                ->get()
                ->map(function ($item) {
                    $user = $item->assignedUser;
                    return [
                        'asesor_id' => $item->assigned_user_id,
                        'asesor_nombre' => $user ? $user->name : 'Sin asignar',
                        'cantidad_polizas' => (int) $item->cantidad_polizas,
                        'total_comisiones' => (float) $item->total_comisiones,
                        'total_prima' => (float) $item->total_prima,
                    ];
                });

            // Estadísticas por aseguradora
            $comisionesPorAseguradora = Poliza::where('broker_id', $brokerId)
                ->where('status', 'active')
                ->where('commission_amount', '>', 0)
                ->selectRaw('
                    insurance_company,
                    COUNT(*) as cantidad_polizas,
                    SUM(commission_amount) as total_comisiones,
                    AVG(commission_percentage) as promedio_porcentaje
                ')
                ->groupBy('insurance_company')
                ->orderBy('total_comisiones', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'message' => 'Estadísticas obtenidas exitosamente',
                'data' => [
                    'total_comisiones' => (int) $stats->total_comisiones,
                    'total_monto_comisiones' => (float) $stats->total_monto_comisiones,
                    'promedio_porcentaje' => (float) $stats->promedio_porcentaje,
                    'total_prima_asegurada' => (float) $stats->total_prima_asegurada,
                    'comisiones_por_asesor' => $comisionesPorAsesor,
                    'comisiones_por_aseguradora' => $comisionesPorAseguradora,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Recalculate commissions for active policies
     */
    public function calcularComisiones(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // Obtener todas las pólizas activas
            $polizas = Poliza::where('broker_id', $brokerId)
                ->where('status', 'active')
                ->get();

            $actualizadas = 0;
            $errores = 0;

            foreach ($polizas as $poliza) {
                try {
                    $nuevaComision = $this->calcularComisionParaPoliza($poliza);

                    if ($nuevaComision != $poliza->commission_amount) {
                        $poliza->update([
                            'commission_amount' => $nuevaComision,
                            'updated_at' => now()
                        ]);
                        $actualizadas++;
                    }
                } catch (\Exception $e) {
                    $errores++;
                    \Log::warning("Error calculando comisión para póliza {$poliza->policy_number}: " . $e->getMessage());
                }
            }

            return response()->json([
                'success' => true,
                'message' => "Cálculo completado. {$actualizadas} comisiones actualizadas, {$errores} errores.",
                'data' => [
                    'actualizadas' => $actualizadas,
                    'errores' => $errores,
                    'total_procesadas' => $polizas->count()
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al calcular comisiones: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Export comisiones to CSV
     */
    public function exportar(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // Aplicar mismos filtros que en index
            $query = Poliza::where('broker_id', $brokerId)
                ->where('status', 'active')
                ->where('commission_amount', '>', 0)
                ->with(['client', 'assignedUser']);

            // Aplicar filtros (igual que en index)
            if ($request->has('search') && !empty($request->search)) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('policy_number', 'like', "%{$search}%")
                      ->orWhere('client_name', 'like', "%{$search}%")
                      ->orWhere('insurance_company', 'like', "%{$search}%");
                });
            }

            if ($request->has('aseguradora') && !empty($request->aseguradora)) {
                $query->where('insurance_company', $request->aseguradora);
            }

            if ($request->has('asesor') && !empty($request->asesor)) {
                $query->whereHas('assignedUser', function($q) use ($request) {
                    $q->where('name', 'like', "%{$request->asesor}%");
                });
            }

            $comisiones = $query->orderBy('created_at', 'desc')->get();

            // Generar CSV
            $csvData = [];
            $csvData[] = [
                'Número Póliza',
                'Cliente',
                'Aseguradora',
                'Ramo',
                'Prima Neta',
                '% Comisión',
                'Valor Comisión',
                'Asesor',
                'Fecha Creación'
            ];

            foreach ($comisiones as $poliza) {
                $csvData[] = [
                    $poliza->policy_number,
                    $poliza->client_name,
                    $poliza->insurance_company,
                    $this->mapTypeToFrontend($poliza->type),
                    number_format($poliza->premium_amount, 2),
                    number_format($poliza->commission_percentage, 2) . '%',
                    number_format($poliza->commission_amount, 2),
                    $poliza->assignedUser ? $poliza->assignedUser->name : 'Sin asignar',
                    $poliza->created_at->format('Y-m-d')
                ];
            }

            // Convertir a CSV
            $output = fopen('php://temp', 'r+');
            foreach ($csvData as $row) {
                fputcsv($output, $row, ';');
            }
            rewind($output);
            $csvContent = stream_get_contents($output);
            fclose($output);

            // Agregar BOM para UTF-8
            $csvContent = "\xEF\xBB\xBF" . $csvContent;

            return response($csvContent, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="comisiones_' . date('Y-m-d_H-i-s') . '.csv"',
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al exportar comisiones: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Calculate commission for a specific policy
     */
    private function calcularComisionParaPoliza(Poliza $poliza): float
    {
        // Por ahora, usar el porcentaje ya definido en la póliza
        // En el futuro, se podría consultar ComisionAseguradora para obtener porcentajes base
        if ($poliza->commission_percentage && $poliza->premium_amount) {
            return ($poliza->premium_amount * $poliza->commission_percentage) / 100;
        }

        return 0;
    }

    /**
     * Transform Poliza model to Comision format for frontend
     */
    private function transformPolizaToComision($poliza)
    {
        return [
            'id' => (string) $poliza->id,
            'numeroPoliza' => $poliza->policy_number,
            'cliente' => $poliza->client_name,
            'aseguradora' => $poliza->insurance_company,
            'ramo' => $this->mapTypeToFrontend($poliza->type),
            'prima' => (float) $poliza->premium_amount,
            'porcentajeComision' => (float) $poliza->commission_percentage,
            'valorComision' => (float) $poliza->commission_amount,
            'estado' => 'Pendiente', // Por ahora, estado fijo. En el futuro podría ser dinámico
            'fechaVencimiento' => $poliza->end_date ? $poliza->end_date->format('Y-m-d') : null,
            'asesor' => $poliza->assignedUser ? $poliza->assignedUser->name : 'Sin asignar',
            'fechaCreacion' => $poliza->created_at->format('Y-m-d'),
            'poliza_id' => $poliza->id,
        ];
    }

    /**
     * Map database type to frontend format
     */
    private function mapTypeToFrontend($type)
    {
        $mapping = [
            'autos' => 'Automóviles',
            'vida' => 'Vida',
            'hogar' => 'Hogar',
            'empresarial' => 'Empresarial',
            'salud' => 'Salud',
            'accidentes' => 'Accidentes Personales',
            'responsabilidad_civil' => 'Responsabilidad Civil',
            'otros' => 'Otros'
        ];

        return $mapping[$type] ?? 'Otros';
    }
}