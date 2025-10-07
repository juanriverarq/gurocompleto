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
        $broker = $this->currentBroker($request);
        return response()->json([
            'success' => true,
            'data' => $broker->fresh(),
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
            'logo' => 'nullable|image|max:2048',
            'favicon' => 'nullable|image|max:1024',
        ]);

        if ($request->hasFile('logo')) {
            $path = $request->file('logo')->store('branding', 'public');
            $broker->logo = $path;
        }
        if ($request->hasFile('favicon')) {
            $path = $request->file('favicon')->store('branding', 'public');
            $broker->favicon = $path;
        }
        $broker->save();

        return response()->json([
            'success' => true,
            'message' => 'Branding actualizado',
            'data' => [
                'logo_url' => $broker->getLogoUrl(),
                'favicon_url' => $broker->getFaviconUrl(),
            ],
        ]);
    }
}


