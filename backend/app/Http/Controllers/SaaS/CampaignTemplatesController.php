<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\CampaignTemplate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class CampaignTemplatesController extends Controller
{
    /**
     * Get the broker ID for the current user
     */
    private function getBrokerId(Request $request)
    {
        // 1) Usar broker_id proporcionado por autenticación unificada (empleado o firebase)
        if (method_exists(\App\Http\Middleware\UnifiedAuthMiddleware::class, 'getBrokerId')) {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request);
            if ($brokerId) {
                return $brokerId;
            }
        }

        // 2) Intentar obtener el usuario autenticado (Firebase middleware lo asigna)
        $user = $request->user();

        // 3) Fallback a Auth::user()
        if (!$user) {
            $user = Auth::user();
        }

        if ($user && $user->broker_id) {
            return $user->broker_id;
        }

        throw new \Exception('No se pudo determinar el broker para el usuario');
    }

    /**
     * Display a listing of campaign templates
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $query = CampaignTemplate::where('broker_id', $brokerId);

            // Filtros
            if ($request->has('category') && !empty($request->category)) {
                $query->where('category', $request->category);
            }

            if ($request->has('search') && !empty($request->search)) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('content', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%");
                });
            }

            if ($request->has('active') && $request->active !== null) {
                $query->where('is_active', (bool) $request->active);
            }

            $templates = $query->orderBy('created_at', 'desc')->get();

            $transformedTemplates = $templates->map(function ($template) {
                return $this->transformTemplateToFrontend($template);
            });

            return response()->json([
                'success' => true,
                'message' => 'Plantillas obtenidas exitosamente',
                'data' => $transformedTemplates
            ]);

        } catch (\Exception $e) {
            \Log::error('🚨 [ERROR] CampaignTemplatesController::index', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las plantillas: ' . $e->getMessage(),
                'data' => []
            ], 500);
        }
    }

    /**
     * Store a newly created campaign template
     */
    public function store(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $validatedData = $request->validate([
                'name' => 'required|string|max:255',
                'content' => 'required|string',
                'category' => 'required|string|max:100',
                'description' => 'nullable|string|max:500',
                'variables' => 'nullable|array',
                'variables.*' => 'string|max:255',
                'is_active' => 'boolean'
            ]);

            // Extraer variables del contenido si no se proporcionaron
            if (empty($validatedData['variables'])) {
                $validatedData['variables'] = $this->extractVariables($validatedData['content']);
            }

            // Convertir variables a JSON
            $validatedData['variables'] = json_encode($validatedData['variables'] ?? []);
            $validatedData['variables_list'] = json_encode(array_keys($this->extractVariables($validatedData['content'])));

            $validatedData['broker_id'] = $brokerId;
            $validatedData['usage_count'] = 0;

            $template = CampaignTemplate::create($validatedData);

            return response()->json([
                'success' => true,
                'message' => 'Plantilla creada exitosamente',
                'data' => $this->transformTemplateToFrontend($template)
            ], 201);

        } catch (\Exception $e) {
            \Log::error('🚨 [ERROR] CampaignTemplatesController::store', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al crear la plantilla: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified campaign template
     */
    public function show(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $template = CampaignTemplate::where('broker_id', $brokerId)->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $this->transformTemplateToFrontend($template)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Plantilla no encontrada',
            ], 404);
        }
    }

    /**
     * Update the specified campaign template
     */
    public function update(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $template = CampaignTemplate::where('broker_id', $brokerId)->findOrFail($id);

            $validatedData = $request->validate([
                'name' => 'sometimes|required|string|max:255',
                'content' => 'sometimes|required|string',
                'category' => 'sometimes|required|string|max:100',
                'description' => 'nullable|string|max:500',
                'variables' => 'nullable|array',
                'variables.*' => 'string|max:255',
                'is_active' => 'boolean'
            ]);

            // Actualizar variables si se proporcionaron
            if (isset($validatedData['variables'])) {
                $validatedData['variables'] = json_encode($validatedData['variables']);
            }

            // Actualizar lista de variables si cambió el contenido
            if (isset($validatedData['content'])) {
                $validatedData['variables_list'] = json_encode(array_keys($this->extractVariables($validatedData['content'])));
            }

            $template->update($validatedData);

            return response()->json([
                'success' => true,
                'message' => 'Plantilla actualizada exitosamente',
                'data' => $this->transformTemplateToFrontend($template)
            ]);

        } catch (\Exception $e) {
            \Log::error('🚨 [ERROR] CampaignTemplatesController::update', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar la plantilla: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified campaign template
     */
    public function destroy(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $template = CampaignTemplate::where('broker_id', $brokerId)->findOrFail($id);
            $template->delete();

            return response()->json([
                'success' => true,
                'message' => 'Plantilla eliminada exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar la plantilla: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Duplicate a campaign template
     */
    public function duplicate(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $originalTemplate = CampaignTemplate::where('broker_id', $brokerId)->findOrFail($id);

            $duplicatedData = $originalTemplate->toArray();
            unset($duplicatedData['id'], $duplicatedData['created_at'], $duplicatedData['updated_at']);

            $duplicatedData['name'] = $duplicatedData['name'] . ' (Copia)';
            $duplicatedData['usage_count'] = 0;

            $newTemplate = CampaignTemplate::create($duplicatedData);

            return response()->json([
                'success' => true,
                'message' => 'Plantilla duplicada exitosamente',
                'data' => $this->transformTemplateToFrontend($newTemplate)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al duplicar la plantilla: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get available categories
     */
    public function categories(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $categories = CampaignTemplate::where('broker_id', $brokerId)
                ->where('is_active', true)
                ->distinct()
                ->pluck('category')
                ->map(function ($category) {
                    return [
                        'key' => $category,
                        'label' => ucfirst($category)
                    ];
                })
                ->toArray();

            // Agregar categorías por defecto si no existen
            $defaultCategories = [
                ['key' => 'general', 'label' => 'General'],
                ['key' => 'marketing', 'label' => 'Marketing'],
                ['key' => 'recordatorios', 'label' => 'Recordatorios'],
                ['key' => 'promociones', 'label' => 'Promociones'],
                ['key' => 'notificaciones', 'label' => 'Notificaciones'],
                ['key' => 'seguimiento', 'label' => 'Seguimiento']
            ];

            $existingKeys = array_column($categories, 'key');
            foreach ($defaultCategories as $default) {
                if (!in_array($default['key'], $existingKeys)) {
                    $categories[] = $default;
                }
            }

            $categoriesMap = array_column($categories, 'label', 'key');

            return response()->json([
                'success' => true,
                'data' => $categoriesMap
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener categorías: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Preview template with sample data
     */
    public function preview(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $template = CampaignTemplate::where('broker_id', $brokerId)->findOrFail($id);

            // Generar datos de ejemplo
            $sampleData = $this->generateSampleData($template);

            // Reemplazar variables en el contenido
            $previewContent = $this->replaceVariables($template->content, $sampleData);

            return response()->json([
                'success' => true,
                'data' => [
                    'template' => $this->transformTemplateToFrontend($template),
                    'preview_content' => $previewContent,
                    'sample_data' => $sampleData
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al generar preview: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Extract variables from template content
     */
    private function extractVariables(string $content): array
    {
        $matches = [];
        preg_match_all('/\{\{(\w+)\}\}/', $content, $matches);
        return array_unique($matches[1] ?? []);
    }

    /**
     * Replace variables in content
     */
    private function replaceVariables(string $content, array $variables): string
    {
        $result = $content;
        foreach ($variables as $key => $value) {
            $result = str_replace("{{{$key}}}", $value, $result);
        }
        return $result;
    }

    /**
     * Generate sample data for preview
     */
    private function generateSampleData(CampaignTemplate $template): array
    {
        $sampleData = [
            'nombre' => 'Juan Pérez',
            'cliente' => 'Juan Pérez',
            'telefono' => '+57 300 123 4567',
            'email' => 'juan.perez@email.com',
            'empresa' => 'Empresa XYZ',
            'poliza' => 'POL-2024-001',
            'fecha' => date('d/m/Y'),
            'monto' => '$1,500,000',
            'aseguradora' => 'Seguros ABC',
            'vencimiento' => date('d/m/Y', strtotime('+30 days')),
            'recordatorio' => 'Recordatorio de pago',
            'promocion' => 'Descuento del 20%',
            'codigo' => 'ABC123',
            'enlace' => 'https://tu-sistema.com/pagar',
            'asesor' => 'María González'
        ];

        return $sampleData;
    }

    /**
     * Transform template model to frontend format
     */
    private function transformTemplateToFrontend(CampaignTemplate $template): array
    {
        $variables = json_decode($template->variables ?? '[]', true) ?: [];
        $variablesList = json_decode($template->variables_list ?? '[]', true) ?: [];

        return [
            'id' => $template->id,
            'name' => $template->name,
            'content' => $template->content,
            'category' => $template->category,
            'category_name' => ucfirst($template->category),
            'description' => $template->description,
            'variables' => $variables,
            'variables_list' => $variablesList,
            'is_active' => $template->is_active,
            'is_default' => $template->is_default,
            'created_at' => $template->created_at?->toISOString(),
            'updated_at' => $template->updated_at?->toISOString(),
            'usage_count' => $template->usage_count
        ];
    }
}
