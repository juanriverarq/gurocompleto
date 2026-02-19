<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class InformacionAgenciaController extends Controller
{
    private function currentBroker(Request $request): Broker
    {
        $user = $request->user();
        $broker = $user?->getPrimaryBroker();
        if (!$broker) {
            throw new \Exception('Broker no encontrado para el usuario');
        }
        return $broker;
    }

    public function show(Request $request)
    {
        $broker = $this->currentBroker($request)->fresh();

        // Normalizar branding y adjuntar URLs absolutas para el frontend
        $branding = is_array($broker->branding) ? $broker->branding : [];
        $branding['primary_color'] = $branding['primary_color'] ?? null;
        $branding['logo'] = method_exists($broker, 'getLogoUrl') ? $broker->getLogoUrl() : ($branding['logo'] ?? null);
        $branding['favicon'] = method_exists($broker, 'getFaviconUrl') ? $broker->getFaviconUrl() : ($branding['favicon'] ?? null);
        $branding['nombre_comercial'] = $branding['nombre_comercial'] ?? $broker->name;

        return response()->json([
            'success' => true,
            'data' => array_merge($broker->toArray(), [
                'logo_url' => $broker->getLogoUrl(),
                'favicon_url' => $broker->getFaviconUrl(),
                'branding' => $branding,
            ]),
        ]);
    }

    public function update(Request $request)
    {
        $broker = $this->currentBroker($request);

        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'legal_name' => 'nullable|string|max:255',
            'document_type' => 'nullable|string|max:50',
            'document_number' => 'nullable|string|max:100',
            'email' => 'nullable|email',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'website' => 'nullable|string|max:255',
            'brand_colors' => 'nullable|array',
            'theme_settings' => 'nullable|array',
            'features' => 'nullable|array',
            'settings' => 'nullable|array',
        ]);

        // Mezclar settings existentes con los nuevos (para no perder configuraciones)
        if (isset($validated['settings'])) {
            $existingSettings = is_array($broker->settings) ? $broker->settings : [];
            $validated['settings'] = array_merge($existingSettings, $validated['settings']);
        }
        
        $broker->fill($validated);
        $broker->save();

        return response()->json([
            'success' => true,
            'message' => 'Información de agencia actualizada',
            'data' => $broker->fresh(),
        ]);
    }

    public function uploadBranding(Request $request)
    {
        $broker = $this->currentBroker($request);

        $request->validate([
            'logo' => 'nullable|mimes:jpeg,png,jpg,gif,svg,webp|max:5120',
            'favicon' => 'nullable|mimes:jpeg,png,jpg,gif,svg,webp|max:1024',
            'primary_color' => 'nullable|string|max:7',
            'secondary_color' => 'nullable|string|max:7',
            'accent_color' => 'nullable|string|max:7',
            'reset_logo' => 'nullable|string',
        ]);

        // Manejar reset de logo (eliminar logo actual)
        if ($request->input('reset_logo') === 'true') {
            if ($broker->logo && Storage::disk('public')->exists($broker->logo)) {
                Storage::disk('public')->delete($broker->logo);
            }
            $broker->logo = null;
        }
        // Manejar subida de logo
        elseif ($request->hasFile('logo')) {
            // Eliminar logo anterior si existe
            if ($broker->logo && Storage::disk('public')->exists($broker->logo)) {
                Storage::disk('public')->delete($broker->logo);
            }
            $path = $request->file('logo')->store('branding', 'public');
            $broker->logo = $path;
        }

        // Manejar subida de favicon
        if ($request->hasFile('favicon')) {
            if ($broker->favicon && Storage::disk('public')->exists($broker->favicon)) {
                Storage::disk('public')->delete($broker->favicon);
            }
            $path = $request->file('favicon')->store('branding', 'public');
            $broker->favicon = $path;
        }

        // Manejar colores (primary, secondary, accent)
        $branding = $broker->branding ?? [];
        $colorsUpdated = false;
        
        if ($request->has('primary_color')) {
            $branding['primary_color'] = $request->input('primary_color');
            $colorsUpdated = true;
        }
        
        if ($request->has('secondary_color')) {
            $branding['secondary_color'] = $request->input('secondary_color');
            $colorsUpdated = true;
        }
        
        if ($request->has('accent_color')) {
            $branding['accent_color'] = $request->input('accent_color');
            $colorsUpdated = true;
        }
        
        // Always sync nombre_comercial from broker name
        $branding['nombre_comercial'] = $broker->name;

        if ($colorsUpdated || true) {
            $broker->branding = $branding;
        }

        $broker->save();

        return response()->json([
            'success' => true,
            'message' => 'Branding actualizado correctamente',
            'data' => [
                'logo_url' => $broker->getLogoUrl(),
                'favicon_url' => $broker->getFaviconUrl(),
                'branding' => [
                    'primary_color' => $broker->branding['primary_color'] ?? null,
                    'secondary_color' => $broker->branding['secondary_color'] ?? null,
                    'accent_color' => $broker->branding['accent_color'] ?? null,
                    'logo' => $broker->getLogoUrl(),
                    'favicon' => $broker->getFaviconUrl(),
                    'nombre_comercial' => $broker->name,
                ],
            ],
        ]);
    }
}


