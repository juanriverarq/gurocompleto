/**
 * Google Analytics 4 — AI Traffic Attribution Utility
 *
 * Detecta y clasifica tráfico proveniente de LLMs y AI search engines
 * (ChatGPT, Perplexity, Google AI Overviews, Claude, Copilot, Gemini)
 * para medir visibilidad en motores generativos.
 *
 * Uso: importar y llamar `trackAIReferral()` una vez al cargar la app (e.g. en main.tsx o App.tsx).
 *
 * Requiere GA4 configurado con gtag() en index.html.
 */

// ─── Known AI referrer patterns ─────────────────────────────────────
const AI_REFERRERS: { pattern: RegExp; source: string; medium: string }[] = [
  // ChatGPT
  { pattern: /chat\.openai\.com/i, source: 'chatgpt', medium: 'ai-referral' },
  { pattern: /chatgpt\.com/i, source: 'chatgpt', medium: 'ai-referral' },

  // Perplexity
  { pattern: /perplexity\.ai/i, source: 'perplexity', medium: 'ai-referral' },

  // Google AI (Gemini, AI Overviews, SGE)
  { pattern: /gemini\.google\.com/i, source: 'gemini', medium: 'ai-referral' },
  { pattern: /bard\.google\.com/i, source: 'gemini', medium: 'ai-referral' },

  // Microsoft Copilot
  { pattern: /copilot\.microsoft\.com/i, source: 'copilot', medium: 'ai-referral' },
  { pattern: /bing\.com\/chat/i, source: 'copilot', medium: 'ai-referral' },

  // Claude
  { pattern: /claude\.ai/i, source: 'claude', medium: 'ai-referral' },

  // You.com
  { pattern: /you\.com/i, source: 'you-ai', medium: 'ai-referral' },

  // Phind
  { pattern: /phind\.com/i, source: 'phind', medium: 'ai-referral' },

  // Kagi
  { pattern: /kagi\.com/i, source: 'kagi', medium: 'ai-referral' },

  // Meta AI
  { pattern: /meta\.ai/i, source: 'meta-ai', medium: 'ai-referral' },
];

/**
 * Detecta si el referrer actual es un AI/LLM source y envía un evento a GA4.
 * También detecta UTM params con ai- prefix para campañas manuales.
 */
export function trackAIReferral(): void {
  if (typeof window === 'undefined') return;

  const gtag = (window as any).gtag;
  if (typeof gtag !== 'function') return;

  const referrer = document.referrer;
  const params = new URLSearchParams(window.location.search);

  // 1. Check referrer against known AI sources
  if (referrer) {
    for (const { pattern, source, medium } of AI_REFERRERS) {
      if (pattern.test(referrer)) {
        gtag('event', 'ai_referral', {
          ai_source: source,
          ai_medium: medium,
          ai_referrer_url: referrer,
          page_path: window.location.pathname,
        });

        // Also set user property for segmentation
        gtag('set', 'user_properties', {
          last_ai_source: source,
        });

        // Store in sessionStorage for conversion attribution
        try {
          sessionStorage.setItem('guro_ai_source', source);
          sessionStorage.setItem('guro_ai_referrer', referrer);
        } catch {
          // silent fail in private browsing
        }

        return;
      }
    }
  }

  // 2. Check UTM parameters for manual AI campaign tagging
  const utmSource = params.get('utm_source') || '';
  const utmMedium = params.get('utm_medium') || '';

  if (utmMedium === 'ai-referral' || utmSource.startsWith('ai-')) {
    gtag('event', 'ai_referral', {
      ai_source: utmSource || 'unknown-ai',
      ai_medium: utmMedium || 'ai-referral',
      ai_campaign: params.get('utm_campaign') || '',
      page_path: window.location.pathname,
    });

    try {
      sessionStorage.setItem('guro_ai_source', utmSource);
    } catch {
      // silent
    }
  }
}

/**
 * Envía un evento de conversión con atribución AI si el usuario llegó desde un LLM.
 * Llamar cuando el usuario completa una acción clave (registro, trial, etc.)
 */
export function trackAIConversion(conversionType: string, value?: number): void {
  if (typeof window === 'undefined') return;

  const gtag = (window as any).gtag;
  if (typeof gtag !== 'function') return;

  let aiSource = '';
  try {
    aiSource = sessionStorage.getItem('guro_ai_source') || '';
  } catch {
    // silent
  }

  if (aiSource) {
    gtag('event', 'ai_conversion', {
      ai_source: aiSource,
      conversion_type: conversionType,
      value: value || 0,
      page_path: window.location.pathname,
    });
  }
}

/**
 * Devuelve el AI source almacenado en la sesión (o '' si no hay).
 * Útil para mostrar en dashboards internos o enviar al backend.
 */
export function getAISource(): string {
  try {
    return sessionStorage.getItem('guro_ai_source') || '';
  } catch {
    return '';
  }
}
