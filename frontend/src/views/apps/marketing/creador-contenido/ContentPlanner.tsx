import { useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { pdfProcessingConfig } from 'src/config/env';

// ─── Types ───────────────────────────────────────────────────────────
interface SlideImage {
  prompt: string;
  image?: string;
  generating?: boolean;
  status: 'pending' | 'generated' | 'error';
}

export interface PlannedPost {
  id: string;
  day: number;
  dayOfWeek: string;
  type: 'carousel' | 'story' | 'single';
  theme: string;
  caption: string;
  hashtags: string;
  imagePrompt: string;
  slides?: SlideImage[];
  generatedImage?: string;
  generating?: boolean;
  status: 'pending' | 'generated' | 'error';
}

export interface ContentPlan {
  month: string;
  year: number;
  agencyName: string;
  styleDirective?: string;
  posts: PlannedPost[];
  createdAt: number;
}

interface Props {
  agencyName: string;
  agencyColors: string[];
  agencyLogoBase64: string | null;
  onGenerateImage: (prompt: string, withLogo?: boolean) => Promise<string | null>;
  hasLogo?: boolean;
}

// ─── DeepSeek API call ───────────────────────────────────────────────
const callDeepSeek = async (systemPrompt: string, userPrompt: string): Promise<string> => {
  const { apiKey, endpoint, model } = pdfProcessingConfig.deepseek;
  if (!apiKey) throw new Error('DeepSeek API key no configurada. Agrega VITE_DEEPSEEK_API_KEY en tu .env');

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `DeepSeek error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
};

// ─── Months ──────────────────────────────────────────────────────────
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const POST_TYPE_ICONS: Record<string, string> = {
  carousel: 'solar:gallery-bold',
  story: 'solar:smartphone-bold',
  single: 'solar:gallery-minimalistic-bold',
};

const POST_TYPE_LABELS: Record<string, string> = {
  carousel: 'Carrusel',
  story: 'Historia',
  single: 'Post',
};

// ─── Persistence ─────────────────────────────────────────────────────
const PLAN_KEY = 'guro_studio_plans';
const loadPlans = (): ContentPlan[] => {
  try { return JSON.parse(localStorage.getItem(PLAN_KEY) || '[]'); } catch { return []; }
};
const savePlans = (plans: ContentPlan[]) => {
  try { localStorage.setItem(PLAN_KEY, JSON.stringify(plans)); } catch {}
};

// ═════════════════════════════════════════════════════════════════════
// CONTENT PLANNER COMPONENT
// ═════════════════════════════════════════════════════════════════════
const ContentPlanner = ({ agencyName, agencyColors, agencyLogoBase64: _logo, onGenerateImage, hasLogo = false }: Props) => {
  const [step, setStep] = useState<'form' | 'loading' | 'plan' | 'saved'>('form');
  const [plans, setPlans] = useState<ContentPlan[]>(loadPlans);
  const [activePlan, setActivePlan] = useState<ContentPlan | null>(null);
  const [selectedPost, setSelectedPost] = useState<PlannedPost | null>(null);
  const [error, setError] = useState('');
  const [generatingAll, setGeneratingAll] = useState(false);
  const [useLogo, setUseLogo] = useState(true);
  const abortRef = useRef(false);

  // Form fields
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [agencyDescription, setAgencyDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [specialDates, setSpecialDates] = useState('');
  const [tone, setTone] = useState('profesional y cercano');
  const [additionalInfo, setAdditionalInfo] = useState('');

  useEffect(() => {
    if (plans.length > 0 && step === 'form') setStep('saved');
  }, []);

  // ── Helper: persist plan to localStorage ──
  const persistPlan = useCallback((plan: ContentPlan) => {
    const all = loadPlans();
    const updated = [plan, ...all.filter(p => p.createdAt !== plan.createdAt)].slice(0, 12);
    savePlans(updated);
    setPlans(updated);
  }, []);

  // ── Generate plan via DeepSeek ──
  const generatePlan = useCallback(async () => {
    setStep('loading');
    setError('');

    const totalPosts = postsPerWeek * 4;
    const monthName = MONTHS[selectedMonth];
    const brandColors = agencyColors.length > 0 ? agencyColors.join(', ') : '#635BFF';

    const systemPrompt = `Eres un experto en marketing digital y community management para agencias de seguros en Latinoamérica. Generas planes de contenido para Instagram que son atractivos, educativos y generan engagement. Respondes SOLO en formato JSON válido, sin markdown ni texto adicional.`;

    const userPrompt = `Genera un plan de contenido para Instagram para el mes de ${monthName} ${selectedYear}.

INFORMACIÓN DE LA AGENCIA:
- Nombre: ${agencyName || 'Agencia de Seguros'}
- Descripción: ${agencyDescription || 'Agencia de seguros que ofrece protección integral'}
- Público objetivo: ${targetAudience || 'Familias, emprendedores y empresas'}
- Tono de comunicación: ${tone}
- Colores de marca: ${brandColors}
${specialDates ? `- Fechas especiales del mes: ${specialDates}` : ''}
${additionalInfo ? `- Información adicional: ${additionalInfo}` : ''}

REQUISITOS:
- Genera exactamente ${totalPosts} publicaciones distribuidas en el mes.
- Tipos disponibles: "single" (post normal 1 imagen), "carousel" (carrusel: 3-5 slides separados), "story" (historia vertical).
- NO uses tipo "reel" — solo single, carousel y story.
- Para "carousel": genera un array "slidePrompts" con un prompt de imagen EN INGLÉS para cada slide individual (3 a 5 slides). Cada slide debe tener contenido diferente pero mantener la misma línea gráfica.
- Para "single" y "story": genera un solo "imagePrompt" en inglés.
- Los captions deben ser en español, atractivos y con call-to-action y emojis.

LÍNEA GRÁFICA — MUY IMPORTANTE:
Incluye un campo "styleDirective" a nivel raíz del JSON. Esta directiva describe el estilo visual unificado que TODOS los prompts de imagen deben seguir para mantener coherencia visual (línea gráfica). Debe incluir: paleta de colores (${brandColors}), estilo de ilustración o fotografía, tipografía sugerida, elementos decorativos recurrentes, mood general. Escríbelo en inglés.

Responde SOLO con este formato JSON exacto (sin markdown, sin backticks):
{
  "styleDirective": "Unified visual style: modern flat design with soft gradients using brand colors...",
  "posts": [
    {
      "day": 2,
      "dayOfWeek": "Lun",
      "type": "single",
      "theme": "Breve descripción del tema",
      "caption": "Caption completo con emojis y CTA",
      "hashtags": "#hashtag1 #hashtag2 #hashtag3",
      "imagePrompt": "Professional insurance social media post..."
    },
    {
      "day": 5,
      "dayOfWeek": "Jue",
      "type": "carousel",
      "theme": "Tips de protección",
      "caption": "Caption para el carrusel...",
      "hashtags": "#hashtag1 #hashtag2",
      "slidePrompts": [
        "Slide 1: Cover slide...",
        "Slide 2: Tip about...",
        "Slide 3: Final CTA slide..."
      ]
    }
  ]
}`;

    try {
      const response = await callDeepSeek(systemPrompt, userPrompt);
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

      const parsed = JSON.parse(jsonStr);
      if (!parsed.posts || !Array.isArray(parsed.posts)) throw new Error('Respuesta inválida: no contiene publicaciones');

      const styleDir = parsed.styleDirective || '';

      const plan: ContentPlan = {
        month: monthName,
        year: selectedYear,
        agencyName: agencyName || 'Mi Agencia',
        styleDirective: styleDir,
        posts: parsed.posts.map((p: any, i: number) => {
          const postType = (p.type === 'carousel' || p.type === 'story') ? p.type : 'single';
          const base: PlannedPost = {
            id: `post_${Date.now()}_${i}`,
            day: p.day || i + 1,
            dayOfWeek: p.dayOfWeek || DAYS_OF_WEEK[i % 7],
            type: postType as PlannedPost['type'],
            theme: p.theme || '',
            caption: p.caption || '',
            hashtags: p.hashtags || '',
            imagePrompt: p.imagePrompt || (p.slidePrompts?.[0] || ''),
            status: 'pending',
          };
          if (postType === 'carousel' && Array.isArray(p.slidePrompts) && p.slidePrompts.length > 0) {
            base.slides = p.slidePrompts.map((sp: string) => ({
              prompt: sp,
              status: 'pending' as const,
            }));
          }
          return base;
        }),
        createdAt: Date.now(),
      };

      setActivePlan(plan);
      persistPlan(plan);
      setStep('plan');
    } catch (e: any) {
      console.error('Error generating plan:', e);
      setError(e.message || 'Error al generar el plan');
      setStep('form');
    }
  }, [selectedMonth, selectedYear, postsPerWeek, agencyDescription, targetAudience, specialDates, tone, additionalInfo, agencyName, agencyColors, plans, persistPlan]);

  // ── Generate image for a single-image post ──
  const generateImageForPost = useCallback(async (postId: string) => {
    if (!activePlan) return;
    const post = activePlan.posts.find(p => p.id === postId);
    if (!post) return;

    // For carousel posts, generate all slides
    if (post.type === 'carousel' && post.slides && post.slides.length > 0) {
      await generateCarouselSlides(postId);
      return;
    }

    if (post.status === 'generated') return;

    const stylePrefix = activePlan.styleDirective ? `${activePlan.styleDirective}. ` : '';
    const fullPrompt = `${stylePrefix}${post.imagePrompt}`;

    // Mark generating
    let updated = { ...activePlan, posts: activePlan.posts.map(p => p.id === postId ? { ...p, generating: true } : p) };
    setActivePlan(updated);

    try {
      const result = await onGenerateImage(fullPrompt, useLogo);
      updated = { ...updated, posts: updated.posts.map(p => p.id === postId ? { ...p, generating: false, generatedImage: result || undefined, status: result ? 'generated' as const : 'error' as const } : p) };
      setActivePlan(updated);
      persistPlan(updated);
      if (selectedPost?.id === postId) setSelectedPost(updated.posts.find(p => p.id === postId) || null);
    } catch {
      updated = { ...updated, posts: updated.posts.map(p => p.id === postId ? { ...p, generating: false, status: 'error' as const } : p) };
      setActivePlan(updated);
    }
  }, [activePlan, onGenerateImage, selectedPost, persistPlan, useLogo]);

  // ── Generate all slides for a carousel post ──
  const generateCarouselSlides = useCallback(async (postId: string) => {
    if (!activePlan) return;
    const postIdx = activePlan.posts.findIndex(p => p.id === postId);
    if (postIdx < 0) return;
    const post = activePlan.posts[postIdx];
    if (!post.slides) return;

    const stylePrefix = activePlan.styleDirective ? `${activePlan.styleDirective}. ` : '';
    let currentPlan = { ...activePlan };

    // Mark post as generating
    currentPlan = { ...currentPlan, posts: currentPlan.posts.map(p => p.id === postId ? { ...p, generating: true } : p) };
    setActivePlan(currentPlan);

    let allGenerated = true;
    for (let si = 0; si < post.slides.length; si++) {
      if (abortRef.current) { allGenerated = false; break; }
      const slide = post.slides[si];
      if (slide.status === 'generated') continue;

      // Mark this slide as generating
      const updSlides = [...(currentPlan.posts[postIdx].slides || [])];
      updSlides[si] = { ...updSlides[si], generating: true };
      currentPlan = { ...currentPlan, posts: currentPlan.posts.map((p, pi) => pi === postIdx ? { ...p, slides: updSlides } : p) };
      setActivePlan(currentPlan);

      try {
        const result = await onGenerateImage(`${stylePrefix}${slide.prompt}. This is slide ${si + 1} of ${post.slides.length} in a carousel.`, useLogo);
        const doneSlides = [...(currentPlan.posts[postIdx].slides || [])];
        doneSlides[si] = { ...doneSlides[si], generating: false, image: result || undefined, status: result ? 'generated' : 'error' };
        currentPlan = { ...currentPlan, posts: currentPlan.posts.map((p, pi) => pi === postIdx ? { ...p, slides: doneSlides } : p) };
        setActivePlan(currentPlan);
        if (!result) allGenerated = false;
      } catch {
        const errSlides = [...(currentPlan.posts[postIdx].slides || [])];
        errSlides[si] = { ...errSlides[si], generating: false, status: 'error' };
        currentPlan = { ...currentPlan, posts: currentPlan.posts.map((p, pi) => pi === postIdx ? { ...p, slides: errSlides } : p) };
        setActivePlan(currentPlan);
        allGenerated = false;
      }

      // Small delay between slides
      if (si < post.slides.length - 1) await new Promise(r => setTimeout(r, 1500));
    }

    // Set first slide as the main generatedImage for preview, mark post done
    const finalSlides = currentPlan.posts[postIdx].slides || [];
    const firstImg = finalSlides.find(s => s.image)?.image;
    currentPlan = { ...currentPlan, posts: currentPlan.posts.map(p => p.id === postId ? { ...p, generating: false, generatedImage: firstImg, status: allGenerated ? 'generated' : 'error' } : p) };
    setActivePlan(currentPlan);
    persistPlan(currentPlan);
    if (selectedPost?.id === postId) setSelectedPost(currentPlan.posts.find(p => p.id === postId) || null);
  }, [activePlan, onGenerateImage, selectedPost, persistPlan, useLogo]);

  // ── Generate all images sequentially ──
  const generateAllImages = useCallback(async () => {
    if (!activePlan) return;
    setGeneratingAll(true);
    abortRef.current = false;

    for (const post of activePlan.posts) {
      if (abortRef.current) break;
      if (post.status !== 'generated') {
        await generateImageForPost(post.id);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    setGeneratingAll(false);
  }, [activePlan, generateImageForPost]);

  const stopGenerating = () => { abortRef.current = true; };
  const openSavedPlan = (plan: ContentPlan) => { setActivePlan(plan); setStep('plan'); };
  const deletePlan = (plan: ContentPlan) => {
    const updated = plans.filter(p => p.createdAt !== plan.createdAt);
    setPlans(updated);
    savePlans(updated);
    if (updated.length === 0) setStep('form');
  };

  // ═════════════════════════════════════════════════════════════════════
  // RENDER: Form
  // ═════════════════════════════════════════════════════════════════════
  if (step === 'form') {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-500/20">
              <Icon icon="solar:calendar-bold" width={26} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Planificador de Contenido</h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">La IA creará tu plan mensual con copys y piezas gráficas para Instagram</p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3 text-[11px] text-red-600 dark:text-red-400">{error}</div>
          )}

          <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-5 space-y-4 shadow-sm">
            {/* Month & Year */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Mes</label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] text-[12px] text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 transition-all">
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Año</label>
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] text-[12px] text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 transition-all">
                  {[now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Posts per week */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Publicaciones por semana</label>
              <div className="flex gap-2">
                {[2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setPostsPerWeek(n)}
                    className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-all active:scale-95 ${postsPerWeek === n ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/30 text-purple-600 dark:text-purple-400' : 'bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] text-gray-500 hover:border-gray-300'}`}>
                    {n}x
                  </button>
                ))}
              </div>
            </div>

            {/* Agency description */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Sobre tu agencia</label>
              <textarea value={agencyDescription} onChange={(e) => setAgencyDescription(e.target.value)}
                placeholder="Ej: Somos una agencia de seguros especializada en seguros de vida y hogar, con 15 años de experiencia..."
                rows={2} className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] text-[11px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-purple-500/20 resize-none transition-all" />
            </div>

            {/* Target audience */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Público objetivo</label>
              <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Ej: Familias jóvenes, emprendedores, profesionales independientes..."
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] text-[11px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-purple-500/20 transition-all" />
            </div>

            {/* Tone */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Tono de comunicación</label>
              <div className="flex flex-wrap gap-1.5">
                {['profesional y cercano', 'formal y corporativo', 'casual y amigable', 'educativo y experto'].map(t => (
                  <button key={t} onClick={() => setTone(t)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-medium border transition-all active:scale-95 ${tone === t ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/30 text-purple-600 dark:text-purple-400' : 'bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] text-gray-500 hover:border-gray-300'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Special dates */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Fechas especiales del mes (opcional)</label>
              <input value={specialDates} onChange={(e) => setSpecialDates(e.target.value)}
                placeholder="Ej: 14 de febrero - Día del amor, 8 de marzo - Día de la mujer..."
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] text-[11px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-purple-500/20 transition-all" />
            </div>

            {/* Additional info */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">Información adicional (opcional)</label>
              <textarea value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)}
                placeholder="Ej: Queremos promocionar nuestro nuevo seguro de mascotas, tenemos una alianza con banco X..."
                rows={2} className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] text-[11px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:ring-2 focus:ring-purple-500/20 resize-none transition-all" />
            </div>
          </div>

          <button onClick={generatePlan}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-[12px] text-white font-bold transition-all active:scale-[0.98] shadow-lg shadow-purple-600/25">
            <Icon icon="solar:magic-stick-3-bold" width={16} />
            Generar plan de contenido
          </button>

          {plans.length > 0 && (
            <button onClick={() => setStep('saved')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.06] text-[11px] text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-all">
              <Icon icon="solar:folder-bold" width={14} />
              Ver planes guardados ({plans.length})
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // RENDER: Loading
  // ═════════════════════════════════════════════════════════════════════
  if (step === 'loading') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-purple-200 dark:border-purple-500/20 border-t-purple-600 dark:border-t-purple-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon icon="solar:calendar-bold" width={28} className="text-purple-600 dark:text-purple-400" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Generando plan de contenido</h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-600 animate-pulse">Guro está creando tu plan para {MONTHS[selectedMonth]} {selectedYear}...</p>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // RENDER: Saved plans
  // ═════════════════════════════════════════════════════════════════════
  if (step === 'saved') {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Planes guardados</h3>
            <button onClick={() => setStep('form')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-all active:scale-95">
              <Icon icon="solar:add-circle-bold" width={14} />
              Nuevo plan
            </button>
          </div>

          {plans.length === 0 ? (
            <div className="text-center py-10">
              <Icon icon="solar:folder-bold-duotone" width={40} className="text-gray-300 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-[11px] text-gray-400">No hay planes guardados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {plans.map((plan) => {
                const gen = plan.posts.filter(p => p.status === 'generated').length;
                return (
                  <div key={plan.createdAt} className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-white/[0.06] p-4 hover:border-purple-300 dark:hover:border-purple-500/20 transition-all group">
                    <div className="flex items-center justify-between">
                      <button onClick={() => openSavedPlan(plan)} className="flex-1 text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center shrink-0">
                            <Icon icon="solar:calendar-bold" width={20} className="text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <h4 className="text-[12px] font-bold text-gray-900 dark:text-white">{plan.month} {plan.year}</h4>
                            <p className="text-[10px] text-gray-400 dark:text-gray-600">{plan.posts.length} publicaciones · {gen} listas</p>
                          </div>
                        </div>
                      </button>
                      <button onClick={() => deletePlan(plan)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 active:scale-90">
                        <Icon icon="solar:trash-bin-trash-bold" width={14} />
                      </button>
                    </div>
                    <div className="mt-3 h-1 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${plan.posts.length > 0 ? (gen / plan.posts.length) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // RENDER: Plan view (post list + detail)
  // ═════════════════════════════════════════════════════════════════════
  if (step === 'plan' && activePlan) {
    const genCount = activePlan.posts.filter(p => p.status === 'generated').length;
    const total = activePlan.posts.length;

    // Helper to count slides for a carousel
    const slideInfo = (post: PlannedPost) => {
      if (post.type !== 'carousel' || !post.slides) return null;
      const done = post.slides.filter(s => s.status === 'generated').length;
      return `${done}/${post.slides.length} slides`;
    };

    return (
      <div className="flex h-full overflow-hidden">
        {/* Left: Post list */}
        <div className="w-[340px] shrink-0 border-r border-gray-200 dark:border-white/[0.04] overflow-y-auto bg-white dark:bg-[#111]">
          <div className="sticky top-0 z-10 bg-white dark:bg-[#111] border-b border-gray-200 dark:border-white/[0.04] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-gray-900 dark:text-white">{activePlan.month} {activePlan.year}</h3>
                <p className="text-[10px] text-gray-400">{genCount}/{total} publicaciones listas</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setStep('saved')} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all" title="Volver">
                  <Icon icon="solar:arrow-left-linear" width={15} />
                </button>
                {!generatingAll ? (
                  <button onClick={generateAllImages} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-[9px] font-bold text-white transition-all active:scale-95 shadow-md shadow-purple-600/20">
                    <Icon icon="solar:magic-stick-3-bold" width={12} />
                    Generar todas
                  </button>
                ) : (
                  <button onClick={stopGenerating} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-[9px] font-bold text-white transition-all active:scale-95">
                    <Icon icon="solar:stop-bold" width={12} />
                    Detener
                  </button>
                )}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-700" style={{ width: `${total > 0 ? (genCount / total) * 100 : 0}%` }} />
            </div>
            {/* Logo toggle */}
            <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.04]">
              <div className="flex items-center gap-1.5">
                <Icon icon="solar:shield-check-bold" width={12} className={useLogo && hasLogo ? 'text-purple-500' : 'text-gray-400'} />
                <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">Logo en imágenes</span>
              </div>
              {hasLogo ? (
                <button onClick={() => setUseLogo(!useLogo)}
                  className={`relative w-7 h-[16px] rounded-full transition-all duration-200 ${useLogo ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                  <div className={`absolute top-[2px] w-[12px] h-[12px] rounded-full bg-white shadow-sm transition-all duration-200 ${useLogo ? 'left-[13px]' : 'left-[2px]'}`} />
                </button>
              ) : (
                <span className="text-[8px] text-amber-500 dark:text-amber-400 font-medium">Sin logo</span>
              )}
            </div>
          </div>

          <div className="p-3 space-y-1.5">
            {activePlan.posts.map((post) => (
              <button key={post.id} onClick={() => setSelectedPost(post)}
                className={`w-full text-left p-3 rounded-xl border transition-all active:scale-[0.98] ${selectedPost?.id === post.id ? 'bg-purple-50 dark:bg-purple-500/5 border-purple-300 dark:border-purple-500/20' : 'bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.04] hover:border-gray-300 dark:hover:border-white/10'}`}>
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/[0.06] flex flex-col items-center justify-center shrink-0">
                    <span className="text-[7px] font-bold text-gray-400 dark:text-gray-600 uppercase leading-none">{post.dayOfWeek}</span>
                    <span className="text-[13px] font-bold text-gray-900 dark:text-white leading-none">{post.day}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon icon={POST_TYPE_ICONS[post.type] || 'solar:gallery-bold'} width={11} className="text-purple-500 shrink-0" />
                      <span className="text-[9px] font-semibold text-purple-600 dark:text-purple-400">{POST_TYPE_LABELS[post.type] || 'Post'}</span>
                      {slideInfo(post) && <span className="text-[8px] text-gray-400 dark:text-gray-600 ml-1">{slideInfo(post)}</span>}
                      {post.status === 'generated' && <Icon icon="solar:check-circle-bold" width={11} className="text-green-500 shrink-0 ml-auto" />}
                      {post.generating && <div className="w-3 h-3 border border-purple-500 border-t-transparent rounded-full animate-spin shrink-0 ml-auto" />}
                    </div>
                    <p className="text-[10px] font-medium text-gray-800 dark:text-gray-200 truncate">{post.theme}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Post detail */}
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#0a0a0a] p-6">
          {selectedPost ? (
            <div className="max-w-lg mx-auto space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Icon icon={POST_TYPE_ICONS[selectedPost.type] || 'solar:gallery-bold'} width={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold text-gray-900 dark:text-white">{selectedPost.theme}</h3>
                  <p className="text-[10px] text-gray-400">{selectedPost.dayOfWeek} {selectedPost.day} de {activePlan.month} · {POST_TYPE_LABELS[selectedPost.type]}</p>
                </div>
              </div>

              {/* ── Carousel slides ── */}
              {selectedPost.type === 'carousel' && selectedPost.slides && selectedPost.slides.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Slides del carrusel ({selectedPost.slides.filter(s => s.status === 'generated').length}/{selectedPost.slides.length})</span>
                    <button onClick={() => generateImageForPost(selectedPost.id)} disabled={selectedPost.generating}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-[9px] font-bold text-white transition-all active:scale-95">
                      <Icon icon="solar:magic-stick-3-bold" width={11} />
                      {selectedPost.generating ? 'Generando...' : 'Generar slides'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedPost.slides.map((slide, si) => (
                      <div key={si} className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-white/[0.06] overflow-hidden shadow-sm">
                        {slide.image ? (
                          <div className="relative group">
                            <img src={slide.image} alt={`Slide ${si + 1}`} className="w-full aspect-square object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <a href={slide.image} download={`${activePlan.month}_dia${selectedPost.day}_slide${si + 1}.png`}
                                className="px-3 py-1.5 rounded-lg bg-white/90 text-[9px] font-bold text-gray-900 hover:bg-white transition-all active:scale-95 shadow-lg">
                                <Icon icon="solar:download-bold" width={12} className="inline mr-1" />Descargar
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-square flex flex-col items-center justify-center bg-gray-100 dark:bg-white/[0.02]">
                            {slide.generating ? (
                              <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                            ) : (
                              <div className="text-center px-2">
                                <Icon icon="solar:gallery-add-bold-duotone" width={24} className="text-gray-300 dark:text-gray-700 mx-auto mb-1" />
                                <p className="text-[8px] text-gray-400">Slide {si + 1}</p>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="p-2">
                          <p className="text-[8px] text-gray-500 dark:text-gray-500 line-clamp-2 leading-relaxed">{slide.prompt.slice(0, 80)}...</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* ── Single/Story image ── */
                <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden shadow-sm">
                  {selectedPost.generatedImage ? (
                    <div className="relative group">
                      <img src={selectedPost.generatedImage} alt="" className={`w-full object-cover ${selectedPost.type === 'story' ? 'aspect-[9/16]' : 'aspect-square'}`} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <a href={selectedPost.generatedImage} download={`${activePlan.month}_dia${selectedPost.day}.png`}
                          className="px-4 py-2 rounded-lg bg-white/90 text-[10px] font-bold text-gray-900 hover:bg-white transition-all active:scale-95 shadow-lg">
                          <Icon icon="solar:download-bold" width={14} className="inline mr-1" />Descargar
                        </a>
                        <button onClick={() => generateImageForPost(selectedPost.id)}
                          className="px-4 py-2 rounded-lg bg-purple-600/90 text-[10px] font-bold text-white hover:bg-purple-500 transition-all active:scale-95 shadow-lg">
                          <Icon icon="solar:refresh-bold" width={14} className="inline mr-1" />Regenerar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`flex flex-col items-center justify-center bg-gray-100 dark:bg-white/[0.02] ${selectedPost.type === 'story' ? 'aspect-[9/16]' : 'aspect-square'}`}>
                      {selectedPost.generating ? (
                        <div className="text-center">
                          <div className="w-12 h-12 border-[3px] border-purple-200 dark:border-purple-500/20 border-t-purple-600 dark:border-t-purple-400 rounded-full animate-spin mx-auto mb-3" />
                          <p className="text-[11px] text-gray-400 animate-pulse">Generando imagen...</p>
                        </div>
                      ) : (
                        <>
                          <Icon icon="solar:gallery-add-bold-duotone" width={40} className="text-gray-300 dark:text-gray-700 mb-3" />
                          <button onClick={() => generateImageForPost(selectedPost.id)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-[11px] font-bold text-white transition-all active:scale-95 shadow-lg shadow-purple-600/20">
                            <Icon icon="solar:magic-stick-3-bold" width={14} />
                            Generar imagen
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Caption */}
              <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Icon icon="solar:text-bold" width={14} className="text-purple-500" />
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Caption para Instagram</span>
                  <button onClick={() => { navigator.clipboard.writeText(`${selectedPost.caption}\n\n${selectedPost.hashtags}`); }}
                    className="ml-auto text-[9px] text-purple-500 hover:text-purple-400 font-medium transition-colors flex items-center gap-1">
                    <Icon icon="solar:copy-bold" width={11} />Copiar
                  </button>
                </div>
                <p className="text-[12px] text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{selectedPost.caption}</p>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.04]">
                  <p className="text-[11px] text-blue-500 dark:text-blue-400 leading-relaxed">{selectedPost.hashtags}</p>
                </div>
              </div>

              {/* Prompt reference */}
              <details className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-sm">
                <summary className="px-4 py-3 cursor-pointer text-[10px] font-semibold text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors flex items-center gap-2">
                  <Icon icon="solar:code-bold" width={12} />
                  Prompt de imagen (referencia técnica)
                </summary>
                <div className="px-4 pb-3 space-y-2">
                  {activePlan.styleDirective && (
                    <div>
                      <p className="text-[9px] font-bold text-purple-500 mb-1">Línea gráfica:</p>
                      <p className="text-[9px] text-gray-400 font-mono leading-relaxed">{activePlan.styleDirective}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500 dark:text-gray-500 leading-relaxed font-mono">{selectedPost.imagePrompt}</p>
                </div>
              </details>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-200 dark:bg-white/5 flex items-center justify-center mb-4">
                <Icon icon="solar:hand-stars-bold-duotone" width={30} className="text-gray-400 dark:text-gray-700" />
              </div>
              <h3 className="text-[13px] font-bold text-gray-400 dark:text-gray-600 mb-1">Selecciona una publicación</h3>
              <p className="text-[10px] text-gray-300 dark:text-gray-700">Elige un post del panel izquierdo para ver su detalle, copy e imagen</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default ContentPlanner;
