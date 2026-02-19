// Freepik API Service
// Docs: https://docs.freepik.com/introduction

const FREEPIK_API_KEY = import.meta.env.VITE_FREEPIK_API_KEY || '';
const NANOBANANA_API_KEY = import.meta.env.VITE_NANOBANANA_API_KEY || 'df6f0d6396e6a253f7396cb89148c03e';
const NANOBANANA_BASE_URL = 'https://api.nanobananaapi.ai/api/v1/nanobanana';

// In dev, Vite proxy rewrites /freepik-api → https://api.freepik.com
// In production, Laravel proxies /api/freepik → https://api.freepik.com/v1
const isDev = import.meta.env.DEV;
const FREEPIK_BASE_URL = isDev ? '/freepik-api/v1' : '/api/freepik';

// ─── Types ───────────────────────────────────────────────────────────

export interface FreepikResource {
  id: number;
  title: string;
  url: string;
  filename: string;
  licenses: { type: string; url: string }[];
  meta: {
    published_at: string;
    is_new: boolean;
    available_formats: Record<string, { total: number; items: any[] }>;
  };
  image: {
    type: string; // 'photo' | 'vector' | 'psd'
    orientation: string;
    source: {
      url: string;
      key: string;
      size: string;
    };
  };
  stats: {
    downloads: number;
    likes: number;
  };
  author: {
    id: number;
    name: string;
    avatar: string;
    slug: string;
  };
}

export interface FreepikSearchResponse {
  data: FreepikResource[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface FreepikSearchParams {
  term?: string;
  page?: number;
  limit?: number;
  order?: 'relevance' | 'recent';
  filters?: {
    orientation?: { landscape?: boolean; portrait?: boolean; square?: boolean };
    content_type?: { photo?: boolean; psd?: boolean; vector?: boolean };
    license?: { freemium?: boolean; premium?: boolean };
  };
}

export type ImageSize =
  | 'square_1_1'
  | 'portrait_3_4'
  | 'portrait_4_5'
  | 'portrait_9_16'
  | 'landscape_4_3'
  | 'landscape_5_4'
  | 'landscape_16_9'
  | 'widescreen_3_1';

export type ImageStyle =
  | 'photo'
  | 'digital-art'
  | 'anime'
  | '3d'
  | 'painting'
  | 'cartoon'
  | 'fantasy'
  | 'cyberpunk'
  | 'sketch'
  | 'watercolor'
  | 'comic'
  | 'none';

export interface TextToImageParams {
  prompt: string;
  negative_prompt?: string;
  guidance_scale?: number;
  seed?: number;
  num_images?: number;
  image?: {
    size?: ImageSize;
  };
  styling?: {
    style?: ImageStyle;
    effects?: {
      color?: 'warm' | 'cold' | 'pastel' | 'vibrant' | 'bw';
      lightning?: 'warm' | 'cold' | 'golden_hour' | 'studio' | 'dramatic';
      framing?: 'portrait' | 'landscape' | 'close_up' | 'wide_angle';
    };
    colors?: { color: string; weight: number }[];
  };
  filter_nsfw?: boolean;
}

export interface GeneratedImage {
  base64: string;
  has_nsfw: boolean;
}

export interface AsyncTaskResponse {
  data: {
    task_id?: string;
    status?: string;
    generated?: { url: string; base64?: string }[];
    result_url?: string;
    [key: string]: any;
  };
}

export interface TextToImageResponse {
  data: GeneratedImage[];
  meta: {
    image: {
      size: string;
      width: number;
      height: number;
    };
    seed: number;
    guidance_scale: number;
    prompt: string;
    num_inference_steps: number;
  };
}

// ─── Social Media Format Presets ─────────────────────────────────────

export interface SocialFormat {
  id: string;
  name: string;
  platform: string;
  icon: string;
  size: ImageSize;
  width: number;
  height: number;
  description: string;
}

export const SOCIAL_FORMATS: SocialFormat[] = [
  {
    id: 'ig-post',
    name: 'Post',
    platform: 'Instagram',
    icon: 'mdi:instagram',
    size: 'square_1_1',
    width: 1080,
    height: 1080,
    description: '1080 × 1080 px',
  },
  {
    id: 'ig-story',
    name: 'Historia',
    platform: 'Instagram',
    icon: 'mdi:instagram',
    size: 'portrait_9_16',
    width: 1080,
    height: 1920,
    description: '1080 × 1920 px',
  },
  {
    id: 'ig-reel',
    name: 'Reel Cover',
    platform: 'Instagram',
    icon: 'mdi:instagram',
    size: 'portrait_9_16',
    width: 1080,
    height: 1920,
    description: '1080 × 1920 px',
  },
  {
    id: 'fb-post',
    name: 'Post',
    platform: 'Facebook',
    icon: 'mdi:facebook',
    size: 'landscape_16_9',
    width: 1200,
    height: 630,
    description: '1200 × 630 px',
  },
  {
    id: 'fb-cover',
    name: 'Portada',
    platform: 'Facebook',
    icon: 'mdi:facebook',
    size: 'widescreen_3_1',
    width: 820,
    height: 312,
    description: '820 × 312 px',
  },
  {
    id: 'fb-story',
    name: 'Historia',
    platform: 'Facebook',
    icon: 'mdi:facebook',
    size: 'portrait_9_16',
    width: 1080,
    height: 1920,
    description: '1080 × 1920 px',
  },
  {
    id: 'wa-status',
    name: 'Estado',
    platform: 'WhatsApp',
    icon: 'mdi:whatsapp',
    size: 'portrait_9_16',
    width: 1080,
    height: 1920,
    description: '1080 × 1920 px',
  },
  {
    id: 'linkedin-post',
    name: 'Post',
    platform: 'LinkedIn',
    icon: 'mdi:linkedin',
    size: 'landscape_4_3',
    width: 1200,
    height: 627,
    description: '1200 × 627 px',
  },
  {
    id: 'x-post',
    name: 'Post',
    platform: 'X (Twitter)',
    icon: 'ri:twitter-x-fill',
    size: 'landscape_16_9',
    width: 1600,
    height: 900,
    description: '1600 × 900 px',
  },
  {
    id: 'tiktok-cover',
    name: 'Cover',
    platform: 'TikTok',
    icon: 'ic:baseline-tiktok',
    size: 'portrait_9_16',
    width: 1080,
    height: 1920,
    description: '1080 × 1920 px',
  },
];

// ─── Prompt Templates for Social Media ───────────────────────────────

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  icon: string;
  promptBase: string;
  description: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'promo',
    name: 'Promoción / Oferta',
    category: 'Ventas',
    icon: 'solar:tag-price-bold-duotone',
    promptBase: 'Professional social media promotional post design, modern and clean layout, bold typography, eye-catching sale banner',
    description: 'Ideal para descuentos, ofertas y promociones',
  },
  {
    id: 'info',
    name: 'Informativo / Tips',
    category: 'Educativo',
    icon: 'solar:lightbulb-bolt-bold-duotone',
    promptBase: 'Clean informative social media post design, modern infographic style, professional layout with icons and bullet points',
    description: 'Comparte tips, datos y contenido educativo',
  },
  {
    id: 'testimonial',
    name: 'Testimonio',
    category: 'Social Proof',
    icon: 'solar:chat-round-like-bold-duotone',
    promptBase: 'Elegant testimonial social media post, quote design with professional photography background, modern typography',
    description: 'Muestra testimonios de clientes satisfechos',
  },
  {
    id: 'announcement',
    name: 'Anuncio / Novedad',
    category: 'Noticias',
    icon: 'solar:bell-bold-duotone',
    promptBase: 'Bold announcement social media post design, exciting news layout, modern and dynamic composition with vibrant colors',
    description: 'Anuncia novedades, eventos o lanzamientos',
  },
  {
    id: 'motivational',
    name: 'Motivacional / Frase',
    category: 'Engagement',
    icon: 'solar:star-bold-duotone',
    promptBase: 'Inspirational quote social media post, beautiful background, elegant typography, motivational design',
    description: 'Frases inspiradoras para conectar con tu audiencia',
  },
  {
    id: 'product',
    name: 'Producto / Servicio',
    category: 'Ventas',
    icon: 'solar:box-bold-duotone',
    promptBase: 'Professional product showcase social media post, clean minimalist design, premium feel, product photography style',
    description: 'Destaca tus productos o servicios',
  },
  {
    id: 'team',
    name: 'Equipo / Cultura',
    category: 'Branding',
    icon: 'solar:users-group-rounded-bold-duotone',
    promptBase: 'Corporate team social media post, professional and friendly design, modern office environment, warm colors',
    description: 'Muestra tu equipo y cultura empresarial',
  },
  {
    id: 'event',
    name: 'Evento / Invitación',
    category: 'Eventos',
    icon: 'solar:calendar-bold-duotone',
    promptBase: 'Event invitation social media post design, elegant and modern layout, date and location highlighted, professional',
    description: 'Invita a eventos, webinars o conferencias',
  },
];

// ─── Style Presets ───────────────────────────────────────────────────

export interface StylePreset {
  id: ImageStyle;
  name: string;
  icon: string;
  preview?: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  { id: 'photo', name: 'Fotografía', icon: 'solar:camera-bold-duotone' },
  { id: 'digital-art', name: 'Arte Digital', icon: 'solar:palette-bold-duotone' },
  { id: '3d', name: '3D Render', icon: 'solar:box-bold-duotone' },
  { id: 'cartoon', name: 'Cartoon', icon: 'solar:emoji-funny-circle-bold-duotone' },
  { id: 'watercolor', name: 'Acuarela', icon: 'solar:paint-roller-bold-duotone' },
  { id: 'fantasy', name: 'Fantasía', icon: 'solar:magic-stick-3-bold-duotone' },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: 'solar:bolt-bold-duotone' },
  { id: 'sketch', name: 'Boceto', icon: 'solar:pen-bold-duotone' },
  { id: 'comic', name: 'Cómic', icon: 'solar:chat-square-bold-duotone' },
  { id: 'none', name: 'Sin estilo', icon: 'solar:minimize-bold-duotone' },
];

// ─── API Service ─────────────────────────────────────────────────────

class FreepikService {
  private headers() {
    return {
      'x-freepik-api-key': FREEPIK_API_KEY,
      'Content-Type': 'application/json',
    };
  }

  // Search resources (photos, vectors, PSDs)
  async searchResources(params: FreepikSearchParams): Promise<FreepikSearchResponse> {
    const query = new URLSearchParams();
    if (params.term) query.append('term', params.term);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.order) query.append('order', params.order);

    // Filters
    if (params.filters?.orientation) {
      Object.entries(params.filters.orientation).forEach(([key, val]) => {
        if (val) query.append(`filters[orientation][${key}]`, '1');
      });
    }
    if (params.filters?.content_type) {
      Object.entries(params.filters.content_type).forEach(([key, val]) => {
        if (val) query.append(`filters[content_type][${key}]`, '1');
      });
    }
    if (params.filters?.license) {
      Object.entries(params.filters.license).forEach(([key, val]) => {
        if (val) query.append(`filters[license][${key}]`, '1');
      });
    }

    const response = await fetch(`${FREEPIK_BASE_URL}/resources?${query.toString()}`, {
      headers: this.headers(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.message || `Freepik API error: ${response.status}`);
    }

    return response.json();
  }

  // ─── Improve Prompt (auto-enhance before generating) ────────────
  async improvePrompt(prompt: string): Promise<string> {
    const response = await fetch(`${FREEPIK_BASE_URL}/ai/improve-prompt`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) return prompt; // fallback to original
    const data = await response.json();
    return data?.data?.improved_prompt || data?.data?.prompt || prompt;
  }

  // ─── Generic async model caller ───────────────────────────────────
  private async callAsyncModel(endpoint: string, body: Record<string, any>): Promise<AsyncTaskResponse> {
    const response = await fetch(`${FREEPIK_BASE_URL}/ai/${endpoint}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.message || `Error (${endpoint}): ${response.status}`);
    }
    return response.json();
  }

  // ─── NanoBanana Pro API (nano-banana-pro model, 2K resolution) ──
  private nanoBananaHeaders() {
    return {
      'Authorization': `Bearer ${NANOBANANA_API_KEY}`,
      'Content-Type': 'application/json',
    };
  }

  private async nanoBananaGenerate(prompt: string, aspectRatio: string, imageUrls?: string[]): Promise<string> {
    const body: Record<string, any> = {
      prompt,
      resolution: '2K',
      aspectRatio,
    };
    if (imageUrls?.length) body.imageUrls = imageUrls;

    const response = await fetch(`${NANOBANANA_BASE_URL}/generate-pro`, {
      method: 'POST',
      headers: this.nanoBananaHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.msg || err?.message || `NanoBanana Pro error: ${response.status}`);
    }
    const result = await response.json();
    const taskId = result?.data?.taskId;
    if (!taskId) throw new Error('No se recibió taskId de NanoBanana Pro');
    return taskId;
  }

  private async nanoBananaPoll(taskId: string, maxWaitMs = 180000): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const response = await fetch(`${NANOBANANA_BASE_URL}/record-info?taskId=${taskId}`, {
        headers: this.nanoBananaHeaders(),
      });
      if (!response.ok) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      const result = await response.json();
      const flag = result?.data?.successFlag;
      if (flag === 1) {
        // Success — return the result image URL
        const imgUrl = result?.data?.response?.resultImageUrl || result?.data?.response?.originImageUrl;
        if (imgUrl) return imgUrl;
        throw new Error('Imagen generada pero sin URL');
      }
      if (flag === 2 || flag === 3) {
        throw new Error(result?.data?.errorMessage || 'La generación falló. Intenta de nuevo.');
      }
      // flag === 0 → still generating
      await new Promise((r) => setTimeout(r, 2500));
    }
    throw new Error('Tiempo de espera agotado. Intenta de nuevo.');
  }

  // ─── Model configs (legacy Freepik-based) ─────────────────────
  private modelConfigs: Record<string, {
    endpoint: string;
    pollEndpoint: string;
    buildBody: (prompt: string, aspect: string, refImage?: string) => Record<string, any>;
  }> = {
    'flux-kontext': {
      endpoint: 'text-to-image/flux-kontext-pro',
      pollEndpoint: 'text-to-image/flux-kontext-pro',
      buildBody: (prompt, aspect, refImageUrl) => {
        const body: Record<string, any> = {
          prompt,
          aspect_ratio: aspect,
          guidance: 7,
          steps: 50,
          output_format: 'png',
          safety_tolerance: 4,
        };
        if (refImageUrl) body.input_image = refImageUrl;
        return body;
      },
    },
  };

  // ─── Unified generate: picks model, improves prompt, polls ─────
  async generateImage(params: TextToImageParams & {
    aiModel?: string;
    autoImprovePrompt?: boolean;
    referenceImage?: string;
    referenceImageUrl?: string;
  }): Promise<TextToImageResponse> {
    // Map ImageSize to NanoBanana aspect ratio format
    const sizeToNanoBanana: Record<string, string> = {
      'square_1_1': '1:1',
      'portrait_3_4': '3:4',
      'portrait_4_5': '4:5',
      'portrait_9_16': '9:16',
      'landscape_4_3': '4:3',
      'landscape_5_4': '5:4',
      'landscape_16_9': '16:9',
      'widescreen_3_1': '21:9',
    };
    const nanoBananaSize = sizeToNanoBanana[params.image?.size || 'square_1_1'] || '1:1';

    // Optionally improve the prompt with AI
    let finalPrompt = params.prompt;
    if (params.autoImprovePrompt) {
      try { finalPrompt = await this.improvePrompt(params.prompt); } catch { /* use original */ }
    }

    // Use NanoBanana API (Gemini latest) as default
    const useNanoBanana = (params.aiModel || 'gemini') !== 'flux-kontext';

    if (useNanoBanana) {
      const imageUrls = params.referenceImageUrl ? [params.referenceImageUrl] : undefined;
      const taskId = await this.nanoBananaGenerate(finalPrompt, nanoBananaSize, imageUrls);
      const imageUrl = await this.nanoBananaPoll(taskId);

      // Fetch the image and convert to base64
      try {
        const resp = await fetch(imageUrl);
        const blob = await resp.blob();
        const b64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });

        return {
          data: [{ base64: b64, has_nsfw: false }],
          meta: {
            image: { size: params.image?.size || 'square_1_1', width: 1024, height: 1024 },
            seed: 0, guidance_scale: 0, prompt: finalPrompt, num_inference_steps: 0,
          },
        };
      } catch {
        // If base64 conversion fails, return the URL directly as base64 field
        // The UI will handle it
        return {
          data: [{ base64: imageUrl, has_nsfw: false }],
          meta: {
            image: { size: params.image?.size || 'square_1_1', width: 1024, height: 1024 },
            seed: 0, guidance_scale: 0, prompt: finalPrompt, num_inference_steps: 0,
          },
        };
      }
    }

    // Fallback: Freepik-based models (flux-kontext)
    const sizeToAspect: Record<string, string> = {
      'square_1_1': 'square_1_1',
      'portrait_3_4': 'traditional_3_4',
      'portrait_4_5': 'social_post_4_5',
      'portrait_9_16': 'social_story_9_16',
      'landscape_4_3': 'classic_4_3',
      'landscape_5_4': 'social_5_4',
      'landscape_16_9': 'widescreen_16_9',
      'widescreen_3_1': 'widescreen_16_9',
    };
    const aspect = sizeToAspect[params.image?.size || 'square_1_1'] || 'square_1_1';

    const config = this.modelConfigs['flux-kontext'];
    if (!config) throw new Error('Modelo flux-kontext no disponible');

    const refForModel = params.referenceImageUrl || params.referenceImage;
    const body = config.buildBody(finalPrompt, aspect, refForModel);
    const taskRes = await this.callAsyncModel(config.endpoint, body);

    const taskId = taskRes.data?.task_id;
    if (!taskId) throw new Error('No se recibió task_id del servidor');

    const final = await this.waitForTask(taskId, config.pollEndpoint);

    // Convert to unified response format
    const generated = final.data?.generated || [];
    const images: GeneratedImage[] = await Promise.all(
      generated.map(async (g: any) => {
        if (g.base64) return { base64: g.base64, has_nsfw: false };
        if (g.url || typeof g === 'string') {
          const url = g.url || g;
          try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            const b64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(blob);
            });
            return { base64: b64, has_nsfw: false };
          } catch { return { base64: '', has_nsfw: false }; }
        }
        return { base64: '', has_nsfw: false };
      }),
    );

    return {
      data: images.filter((i) => i.base64),
      meta: {
        image: { size: params.image?.size || 'square_1_1', width: 1024, height: 1024 },
        seed: 0, guidance_scale: 0, prompt: finalPrompt, num_inference_steps: 0,
      },
    };
  }

  // Download a resource
  async downloadResource(resourceId: number): Promise<{ url: string }> {
    const response = await fetch(`${FREEPIK_BASE_URL}/resources/${resourceId}/download`, {
      headers: this.headers(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.message || `Download error: ${response.status}`);
    }

    return response.json();
  }

  // Get resource details
  async getResourceDetail(resourceId: number): Promise<{ data: FreepikResource }> {
    const response = await fetch(`${FREEPIK_BASE_URL}/resources/${resourceId}`, {
      headers: this.headers(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.message || `Detail error: ${response.status}`);
    }

    return response.json();
  }

  // Poll async task status
  async getTaskStatus(taskId: string, endpoint: string): Promise<AsyncTaskResponse> {
    const response = await fetch(`${FREEPIK_BASE_URL}/ai/${endpoint}/${taskId}`, {
      headers: this.headers(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.message || `Task status error: ${response.status}`);
    }

    return response.json();
  }

  // Poll until task completes (with timeout)
  async waitForTask(taskId: string, endpoint: string, maxWaitMs = 120000): Promise<AsyncTaskResponse> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const result = await this.getTaskStatus(taskId, endpoint);
      if (result.data?.status === 'COMPLETED' || (result.data?.generated?.length ?? 0) > 0) {
        return result;
      }
      if (result.data?.status === 'FAILED') {
        throw new Error('La tarea falló. Intenta de nuevo.');
      }
      // Wait 2 seconds before polling again
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('Tiempo de espera agotado. Intenta de nuevo.');
  }

  // Helper: check if API key is configured
  isConfigured(): boolean {
    return !!FREEPIK_API_KEY && FREEPIK_API_KEY.length > 10;
  }
}

export const freepikService = new FreepikService();
export default freepikService;
