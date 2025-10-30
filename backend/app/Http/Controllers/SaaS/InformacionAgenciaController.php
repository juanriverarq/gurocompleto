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
            'logo' => 'nullable|image|max:5120',
            'favicon' => 'nullable|image|max:1024',
            'primary_color' => 'nullable|string|max:7',
        ]);

        // Manejar subida de logo
        if ($request->hasFile('logo')) {
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

        // Manejar color primario
        if ($request->has('primary_color')) {
            $branding = $broker->branding ?? [];
            $branding['primary_color'] = $request->input('primary_color');
            $broker->branding = $branding;
        }

        $broker->save();

        return response()->json([
            'success' => true,
            'message' => 'Branding actualizado',
            'data' => [
                'logo_url' => $broker->getLogoUrl(),
                'favicon_url' => $broker->getFaviconUrl(),
                'primary_color' => $broker->branding['primary_color'] ?? null,
            ],
        ]);
    }
}


