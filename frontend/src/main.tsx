import { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/css/globals.css'
import App from './App.tsx'
import Spinner from './views/spinner/Spinner.tsx'
import { CustomizerContextProvider } from './context/CustomizerContext.tsx'
import './utils/i18n';
import { DashboardContextProvider } from './context/DashboardContext/DashboardContext.tsx'
import { trackAIReferral } from './utils/analytics'

/**
 * Fuerza que los tooltips (Flowbite/Tippy/Floating-UI) se rendericen fuera de contenedores
 * con stacking context/overflow, reubicándolos bajo document.body con z-index máximo.
 */
function setupGlobalTooltipPortal() {
  const SELECTOR = '[role="tooltip"],[data-testid="flowbite-tooltip"],.tippy-box,.tooltip,[id^="tooltip"]';
  const applyPortal = (node: Element) => {
    try {
      if (!(node instanceof HTMLElement)) return;
      if (node.classList.contains('guro-tooltip-portal')) return;
      document.body.appendChild(node);
      node.classList.add('guro-tooltip-portal');
      node.style.position = 'fixed';
      node.style.zIndex = '2147483647';
      // Evitar clipping en algunos navegadores
      node.style.transform = 'translateZ(0)';
      node.style.pointerEvents = 'auto';
    } catch {}
  };

  // Inicial: portalizar si ya existen
  document.querySelectorAll(SELECTOR).forEach(applyPortal);

  // Observer para elementos agregados dinámicamente
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.matches(SELECTOR)) {
            applyPortal(n);
          } else {
            n.querySelectorAll?.(SELECTOR).forEach(applyPortal);
          }
        });
      }
      if (m.type === 'attributes' && m.target instanceof Element && m.target.matches(SELECTOR)) {
        applyPortal(m.target);
      }
    }
  });
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'data-testid', 'role', 'id'],
  });

  // Fallback periódico (por si algún framework reinyecta sin mutación detectable)
  const interval = window.setInterval(() => {
    try {
      document.querySelectorAll(SELECTOR).forEach(applyPortal);
    } catch {}
  }, 1500);

  // Limpieza cuando la página se descarga
  window.addEventListener('beforeunload', () => clearInterval(interval));
}

/**
 * Forzar que los dropdowns (Flowbite) se rendericen fuera de contenedores con overflow/stacking,
 * anclándolos al trigger y re-posicionándolos on-scroll/on-resize para evitar drift y clipping.
 * - Evita que queden "fijos" al viewport cuando se hace scroll.
 * - Evita que se corten detrás del contenedor cuando hay pocas filas en la tabla.
 */
async function deferRender(){
  // Habilitar MSW solo en desarrollo (opcional)
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MSW === 'true') {
    const {worker} = await import("./api/mocks/browser.ts");
    return worker.start({
      onUnhandledRequest() {
        return 'bypass';
      },
    });
  }
  return Promise.resolve();
}

deferRender().then(() => {
  // Asegurar tooltips por delante de todo en toda la app
  setupGlobalTooltipPortal();
  if (typeof window !== 'undefined') (window as any).__GURO_BUILD__ = '20260306v2';

  // Detectar y registrar tráfico proveniente de LLMs/AI search (ChatGPT, Perplexity, etc.)
  trackAIReferral();

  createRoot(document.getElementById('root')!).render(
    <DashboardContextProvider>
      <CustomizerContextProvider>
        <Suspense fallback={<Spinner />}>
          <App />
        </Suspense>
      </CustomizerContextProvider>
    </DashboardContextProvider>,
  )
})
