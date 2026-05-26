<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Broker;
use App\Models\BrokerWebsite;
use App\Models\BrokerWebsitePage;
use App\Services\AIResponseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class BrokerWebsiteController extends Controller
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

    private function getOrCreateWebsite(Broker $broker): BrokerWebsite
    {
        $website = BrokerWebsite::where('broker_id', $broker->id)->first();
        if (!$website) {
            $baseSlug = Str::slug($broker->name ?: 'mi-sitio');
            $slug = $baseSlug;
            $i = 1;
            while (BrokerWebsite::where('slug', $slug)->exists()) {
                $slug = $baseSlug . '-' . $i++;
            }
            $website = BrokerWebsite::create([
                'broker_id' => $broker->id,
                'slug' => $slug,
                'site_title' => $broker->name,
                'status' => 'draft',
            ]);
        }
        return $website;
    }

    // ─── Website CRUD ────────────────────────────────────

    public function show(Request $request)
    {
        $broker = $this->currentBroker($request);
        $website = BrokerWebsite::where('broker_id', $broker->id)->with('pages')->first();

        if (!$website) {
            return response()->json(['data' => null]);
        }

        return response()->json([
            'data' => [
                'id' => $website->id,
                'slug' => $website->slug,
                'custom_domain' => $website->custom_domain,
                'site_title' => $website->site_title,
                'site_description' => $website->site_description,
                'favicon_url' => $website->favicon_url,
                'og_image_url' => $website->og_image_url,
                'google_analytics_id' => $website->google_analytics_id,
                'template_id' => $website->template_id,
                'template_route' => $website->template_route,
                'html_content' => $website->html_content,
                'settings' => $website->settings,
                'status' => $website->status,
                'published_at' => $website->published_at?->toISOString(),
                'updated_at' => $website->updated_at?->toISOString(),
                'public_url' => $this->getPublicUrl($website),
                'pages' => $website->pages->map(fn($p) => [
                    'id' => $p->id,
                    'slug' => $p->slug,
                    'title' => $p->title,
                    'is_homepage' => $p->is_homepage,
                    'sort_order' => $p->sort_order,
                    'show_in_nav' => $p->show_in_nav,
                    'template_id' => $p->template_id,
                    'template_route' => $p->template_route,
                    'html_content' => $p->html_content,
                    'seo_title' => $p->seo_title,
                    'seo_description' => $p->seo_description,
                    'seo_keywords' => $p->seo_keywords,
                    'og_image' => $p->og_image,
                    'status' => $p->status,
                    'updated_at' => $p->updated_at?->toISOString(),
                ]),
            ],
        ]);
    }

    public function saveSettings(Request $request)
    {
        $broker = $this->currentBroker($request);
        $website = $this->getOrCreateWebsite($broker);

        $validated = $request->validate([
            'slug' => 'nullable|string|max:80|regex:/^[a-z0-9\-]+$/',
            'custom_domain' => 'nullable|string|max:255',
            'site_title' => 'nullable|string|max:255',
            'site_description' => 'nullable|string|max:500',
            'favicon_url' => 'nullable|string|max:500',
            'og_image_url' => 'nullable|string|max:500',
            'google_analytics_id' => 'nullable|string|max:50',
        ]);

        if (!empty($validated['slug']) && $validated['slug'] !== $website->slug) {
            $exists = BrokerWebsite::where('slug', $validated['slug'])->where('id', '!=', $website->id)->exists();
            if ($exists) {
                return response()->json(['error' => 'Ese slug ya está en uso. Elige otro.'], 422);
            }
        }

        $website->fill($validated);
        $website->save();

        return response()->json([
            'success' => true,
            'message' => 'Configuración guardada',
            'data' => [
                'slug' => $website->slug,
                'public_url' => $this->getPublicUrl($website),
            ],
        ]);
    }

    // ─── Pages CRUD ──────────────────────────────────────

    public function savePage(Request $request)
    {
        $broker = $this->currentBroker($request);
        $website = $this->getOrCreateWebsite($broker);

        $validated = $request->validate([
            'page_id' => 'nullable|integer',
            'slug' => 'required|string|max:80|regex:/^[a-z0-9\-]+$/',
            'title' => 'required|string|max:255',
            'is_homepage' => 'boolean',
            'sort_order' => 'integer',
            'show_in_nav' => 'boolean',
            'template_id' => 'nullable|string|max:50',
            'template_route' => 'nullable|string|max:255',
            'html_content' => 'nullable|string',
            'seo_title' => 'nullable|string|max:255',
            'seo_description' => 'nullable|string|max:500',
            'seo_keywords' => 'nullable|string|max:500',
            'og_image' => 'nullable|string|max:500',
        ]);

        // If marking as homepage, unset other homepages
        if (!empty($validated['is_homepage'])) {
            $website->pages()->where('is_homepage', true)->update(['is_homepage' => false]);
        }

        if (!empty($validated['page_id'])) {
            $page = $website->pages()->where('id', $validated['page_id'])->firstOrFail();
            unset($validated['page_id']);
            $page->fill($validated);
            $page->save();
        } else {
            unset($validated['page_id']);
            $existingSlug = $website->pages()->where('slug', $validated['slug'])->exists();
            if ($existingSlug) {
                return response()->json(['error' => 'Ya existe una página con ese slug'], 422);
            }
            $validated['broker_website_id'] = $website->id;
            $page = BrokerWebsitePage::create($validated);
        }

        // Also update legacy fields on the website if this is homepage
        if ($page->is_homepage) {
            $website->update([
                'template_id' => $page->template_id,
                'template_route' => $page->template_route,
                'html_content' => $page->html_content,
            ]);
        }

        Log::info('🌐 Page saved', ['broker_id' => $broker->id, 'page' => $page->slug, 'html_size' => strlen($page->html_content ?? '')]);

        return response()->json([
            'success' => true,
            'message' => 'Página guardada',
            'data' => [
                'id' => $page->id,
                'slug' => $page->slug,
                'title' => $page->title,
                'is_homepage' => $page->is_homepage,
                'status' => $page->status,
                'updated_at' => $page->updated_at->toISOString(),
            ],
        ]);
    }

    public function deletePage(Request $request, int $pageId)
    {
        $broker = $this->currentBroker($request);
        $website = BrokerWebsite::where('broker_id', $broker->id)->firstOrFail();
        $page = $website->pages()->where('id', $pageId)->firstOrFail();

        if ($page->is_homepage) {
            return response()->json(['error' => 'No puedes eliminar la página principal'], 422);
        }

        $page->delete();

        return response()->json(['success' => true, 'message' => 'Página eliminada']);
    }

    // ─── Publish / Unpublish ─────────────────────────────

    public function publish(Request $request)
    {
        $broker = $this->currentBroker($request);
        $website = $this->getOrCreateWebsite($broker);

        // Optionally save page content along with publish
        if ($request->has('page_id') && $request->has('html_content')) {
            $page = $website->pages()->where('id', $request->input('page_id'))->first();
            if ($page) {
                $page->update([
                    'html_content' => $request->input('html_content'),
                    'template_id' => $request->input('template_id'),
                    'template_route' => $request->input('template_route'),
                    'status' => 'published',
                ]);
                if ($page->is_homepage) {
                    $website->update([
                        'html_content' => $request->input('html_content'),
                        'template_id' => $request->input('template_id'),
                        'template_route' => $request->input('template_route'),
                    ]);
                }
            }
        } elseif ($request->has('html_content')) {
            // Legacy: save directly on website
            $website->update([
                'template_id' => $request->input('template_id'),
                'template_route' => $request->input('template_route'),
                'html_content' => $request->input('html_content'),
            ]);
        }

        // Publish all pages that have content
        $website->pages()->whereNotNull('html_content')->update(['status' => 'published']);

        $website->update([
            'status' => 'published',
            'published_at' => now(),
        ]);

        Log::info('🌐 Website published', ['broker_id' => $broker->id, 'slug' => $website->slug]);

        return response()->json([
            'success' => true,
            'message' => 'Página web publicada',
            'data' => [
                'id' => $website->id,
                'status' => 'published',
                'public_url' => $this->getPublicUrl($website),
                'published_at' => $website->published_at->toISOString(),
                'updated_at' => $website->updated_at->toISOString(),
            ],
        ]);
    }

    public function unpublish(Request $request)
    {
        $broker = $this->currentBroker($request);
        $website = BrokerWebsite::where('broker_id', $broker->id)->first();
        if (!$website) {
            return response()->json(['error' => 'No hay página web configurada'], 404);
        }

        $website->update(['status' => 'draft']);
        $website->pages()->update(['status' => 'draft']);

        return response()->json(['success' => true, 'message' => 'Sitio despublicado', 'data' => ['status' => 'draft']]);
    }

    // ─── Legacy save (backward compat) ───────────────────

    public function save(Request $request)
    {
        $broker = $this->currentBroker($request);
        $website = $this->getOrCreateWebsite($broker);

        $validated = $request->validate([
            'template_id' => 'required|string|max:50',
            'template_route' => 'required|string|max:255',
            'html_content' => 'required|string',
            'settings' => 'nullable|array',
            'page_id' => 'nullable|integer',
        ]);

        // If page_id is provided, save to that page
        if (!empty($validated['page_id'])) {
            $page = $website->pages()->where('id', $validated['page_id'])->firstOrFail();
            $page->update([
                'template_id' => $validated['template_id'],
                'template_route' => $validated['template_route'],
                'html_content' => $validated['html_content'],
            ]);
            if ($page->is_homepage) {
                $website->update([
                    'template_id' => $validated['template_id'],
                    'template_route' => $validated['template_route'],
                    'html_content' => $validated['html_content'],
                    'settings' => $validated['settings'] ?? $website->settings,
                    'status' => 'draft',
                ]);
            }
        } else {
            $website->update([
                'template_id' => $validated['template_id'],
                'template_route' => $validated['template_route'],
                'html_content' => $validated['html_content'],
                'settings' => $validated['settings'] ?? $website->settings,
                'status' => 'draft',
            ]);
        }

        Log::info('🌐 Website saved', ['broker_id' => $broker->id, 'template' => $validated['template_id']]);

        return response()->json([
            'success' => true,
            'message' => 'Cambios guardados',
            'data' => [
                'id' => $website->id,
                'status' => $website->status,
                'updated_at' => $website->updated_at->toISOString(),
            ],
        ]);
    }

    // ─── Check slug availability ─────────────────────────

    public function checkSlug(Request $request)
    {
        $slug = $request->input('slug');
        $broker = $this->currentBroker($request);
        $website = BrokerWebsite::where('broker_id', $broker->id)->first();

        $taken = BrokerWebsite::where('slug', $slug)
            ->when($website, fn($q) => $q->where('id', '!=', $website->id))
            ->exists();

        return response()->json(['available' => !$taken]);
    }

    // ─── AI: personalize, SEO, suggest pages, free-form edit ─

    /**
     * Rewrites readable text inside `html` using broker profile + extra instructions.
     * Keeps tags/classes/attrs intact; only replaces text nodes.
     */
    public function aiPersonalize(Request $request)
    {
        $this->currentBroker($request);

        $validated = $request->validate([
            'html' => 'required|string',
            'profile' => 'required|array',
            'profile.business_name' => 'nullable|string|max:120',
            'profile.specialty' => 'nullable|string|max:120',
            'profile.city' => 'nullable|string|max:80',
            'profile.tone' => 'nullable|string|max:30',
            'profile.value_proposition' => 'nullable|string|max:400',
            'profile.phone' => 'nullable|string|max:30',
            'profile.email' => 'nullable|string|max:120',
            'profile.extra' => 'nullable|string|max:600',
        ]);

        $html = $validated['html'];
        $p = $validated['profile'];

        $profileText =
            'Nombre: ' . ($p['business_name'] ?? 'No especificado') . "\n" .
            'Especialidad: ' . ($p['specialty'] ?? 'Seguros generales') . "\n" .
            'Ciudad: ' . ($p['city'] ?? 'Colombia') . "\n" .
            'Tono: ' . ($p['tone'] ?? 'profesional cercano') . "\n" .
            'Propuesta de valor: ' . ($p['value_proposition'] ?? '') . "\n" .
            'Teléfono: ' . ($p['phone'] ?? '') . "\n" .
            'Email: ' . ($p['email'] ?? '') . "\n" .
            'Notas: ' . ($p['extra'] ?? '');

        $system = <<<SYS
Eres un copywriter experto para sitios web de corredores de seguros en Colombia. Recibes un HTML de una plantilla y un perfil de negocio. Tu tarea: reescribir SOLO los textos visibles (títulos, subtítulos, párrafos, labels de botones, listas, alt de imágenes) en español, adaptándolos al perfil. Reglas estrictas:
1. NO modifiques etiquetas, clases CSS, IDs, atributos data-*, ni la estructura.
2. NO añadas ni elimines nodos.
3. NO toques URLs (href, src) salvo mailto:/tel: que pueden actualizarse al email/teléfono provistos.
4. Conserva longitud aproximada por nodo de texto (±30%).
5. Mantén placeholders de Lorem reemplazándolos por copy real coherente con el perfil.
6. Tono: el indicado en el perfil. Usa lenguaje natural, sin spam.
7. Responde ÚNICAMENTE con el HTML completo modificado, sin explicaciones, sin code fences, sin texto extra.
SYS;

        $aiService = new AIResponseService();
        $result = $aiService->generateResponse(
            "Perfil del corredor:\n{$profileText}\n\nHTML original:\n{$html}",
            [],
            ['system_prompt' => $system, 'max_tokens' => 8000, 'temperature' => 0.4]
        );

        if (empty($result['success']) || empty($result['response'])) {
            return response()->json(['error' => $result['error'] ?? 'No se pudo generar contenido'], 500);
        }

        return response()->json(['success' => true, 'data' => ['html' => $this->cleanAiHtml($result['response'])]]);
    }

    /**
     * Generates SEO metadata for a given HTML page.
     */
    public function aiSeo(Request $request)
    {
        $this->currentBroker($request);

        $validated = $request->validate([
            'html' => 'required|string',
            'page_title' => 'nullable|string|max:120',
            'business_name' => 'nullable|string|max:120',
            'city' => 'nullable|string|max:80',
        ]);

        $text = strip_tags($validated['html']);
        if (mb_strlen($text) > 6000) {
            $text = mb_substr($text, 0, 6000);
        }

        $system = 'Eres un especialista SEO para sitios web de corredores de seguros en Colombia. Devuelve ÚNICAMENTE JSON válido con esta forma exacta: {"seo_title": "string max 60 chars", "seo_description": "string max 155 chars", "seo_keywords": "comma-separated max 8 keywords"}. Sin comentarios, sin texto extra, sin code fences.';

        $user = "Página: " . ($validated['page_title'] ?? 'Inicio') . "\n" .
                "Negocio: " . ($validated['business_name'] ?? 'Corredor de seguros') . "\n" .
                "Ciudad: " . ($validated['city'] ?? 'Colombia') . "\n\n" .
                "Contenido de la página:\n" . $text;

        $aiService = new AIResponseService();
        $result = $aiService->generateResponse($user, [], [
            'system_prompt' => $system, 'max_tokens' => 400, 'temperature' => 0.3,
        ]);

        if (empty($result['success']) || empty($result['response'])) {
            return response()->json(['error' => $result['error'] ?? 'No se pudo generar SEO'], 500);
        }

        $json = $this->extractJson($result['response']);
        if (!$json) {
            return response()->json(['error' => 'Respuesta de IA no interpretable'], 500);
        }

        return response()->json(['success' => true, 'data' => [
            'seo_title' => mb_substr((string)($json['seo_title'] ?? ''), 0, 70),
            'seo_description' => mb_substr((string)($json['seo_description'] ?? ''), 0, 200),
            'seo_keywords' => mb_substr((string)($json['seo_keywords'] ?? ''), 0, 300),
        ]]);
    }

    /**
     * Suggests additional pages to add to the site based on broker profile + existing slugs.
     */
    public function aiSuggestPages(Request $request)
    {
        $this->currentBroker($request);

        $validated = $request->validate([
            'profile' => 'nullable|array',
            'existing_slugs' => 'nullable|array',
        ]);

        $existing = implode(', ', $validated['existing_slugs'] ?? []);
        $p = $validated['profile'] ?? [];

        $system = 'Sugiere páginas adicionales para un sitio web de un corredor de seguros colombiano. Devuelve ÚNICAMENTE un JSON array (máx 6 elementos) con: [{"slug":"kebab-case","title":"Título","description":"Por qué es útil","icon":"solar:icon-name-bold-duotone"}]. Sin comentarios ni texto extra.';

        $user = "Perfil: " . json_encode($p, JSON_UNESCAPED_UNICODE) . "\n" .
                "Páginas existentes: " . ($existing ?: 'ninguna') . "\n" .
                "Sugiere páginas que NO estén ya en el sitio.";

        $aiService = new AIResponseService();
        $result = $aiService->generateResponse($user, [], [
            'system_prompt' => $system, 'max_tokens' => 600, 'temperature' => 0.5,
        ]);

        if (empty($result['success']) || empty($result['response'])) {
            return response()->json(['error' => $result['error'] ?? 'No se pudo sugerir páginas'], 500);
        }

        $json = $this->extractJson($result['response']);
        if (!is_array($json)) {
            return response()->json(['error' => 'Respuesta de IA no interpretable'], 500);
        }

        $suggestions = collect($json)->filter(fn($s) => !empty($s['slug']) && !empty($s['title']))
            ->take(6)->values()->all();

        return response()->json(['success' => true, 'data' => ['suggestions' => $suggestions]]);
    }

    /**
     * Applies a free-form instruction to the page HTML (used by the in-editor AI chat).
     */
    public function aiEdit(Request $request)
    {
        $this->currentBroker($request);

        $validated = $request->validate([
            'html' => 'required|string',
            'instruction' => 'required|string|max:600',
        ]);

        $system = <<<SYS
Eres un editor visual de HTML para sitios web. Recibes un HTML y una instrucción en español. Modifica el HTML aplicando la instrucción.
Reglas:
1. Conserva estructura, clases CSS, IDs y atributos data-* salvo que la instrucción los toque explícitamente.
2. Puedes añadir/eliminar nodos solo si la instrucción lo pide.
3. Cambios de color/estilo: usa style inline (style="...") sobre el elemento afectado.
4. Si la instrucción es ambigua, hazlo de forma conservadora.
5. Responde ÚNICAMENTE con el HTML completo final, sin explicaciones, sin code fences, sin texto extra.
SYS;

        $aiService = new AIResponseService();
        $result = $aiService->generateResponse(
            "Instrucción:\n{$validated['instruction']}\n\nHTML actual:\n{$validated['html']}",
            [],
            ['system_prompt' => $system, 'max_tokens' => 8000, 'temperature' => 0.3]
        );

        if (empty($result['success']) || empty($result['response'])) {
            return response()->json(['error' => $result['error'] ?? 'No se pudo aplicar la edición'], 500);
        }

        return response()->json(['success' => true, 'data' => ['html' => $this->cleanAiHtml($result['response'])]]);
    }

    // ─── Helper ──────────────────────────────────────────

    private function getPublicUrl(BrokerWebsite $website): string
    {
        if ($website->custom_domain) {
            return 'https://' . $website->custom_domain;
        }
        return 'https://guro.co/sitio/' . $website->slug;
    }

    private function cleanAiHtml(string $raw): string
    {
        $s = trim($raw);
        // Strip leading code fences (```html, ```)
        $s = preg_replace('/^```(?:html|HTML)?\s*\n?/', '', $s);
        $s = preg_replace('/\n?```\s*$/', '', $s);
        return trim($s);
    }

    private function extractJson(string $raw): mixed
    {
        $s = trim($raw);
        $s = preg_replace('/^```(?:json)?\s*\n?/', '', $s);
        $s = preg_replace('/\n?```\s*$/', '', $s);
        $decoded = json_decode($s, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $decoded;
        }
        // Fallback: extract first {...} or [...] block
        if (preg_match('/(\{.*\}|\[.*\])/s', $s, $m)) {
            $decoded = json_decode($m[1], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $decoded;
            }
        }
        return null;
    }
}
