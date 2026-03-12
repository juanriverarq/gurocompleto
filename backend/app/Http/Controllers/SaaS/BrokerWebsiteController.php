<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Broker;
use App\Models\BrokerWebsite;
use App\Models\BrokerWebsitePage;
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

    // ─── Helper ──────────────────────────────────────────

    private function getPublicUrl(BrokerWebsite $website): string
    {
        if ($website->custom_domain) {
            return 'https://' . $website->custom_domain;
        }
        return 'https://guro.co/sitio/' . $website->slug;
    }
}
