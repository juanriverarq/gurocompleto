import { lazy, ComponentType } from 'react';

/**
 * Wraps React.lazy() with automatic retry + cache busting on chunk load failure.
 *
 * After a deploy, old JS chunk hashes no longer exist on the server. Users with
 * a cached index.html will hit "Failed to fetch dynamically imported module".
 * Esta utility:
 *   1) Limpia caches del navegador (Service Worker, Cache API)
 *   2) Recarga la página con cache-bust (`?_v=<timestamp>`) para forzar fresh
 *   3) Usa sessionStorage para evitar loops infinitos
 */
async function clearBrowserCaches() {
  try {
    // Service workers que puedan estar sirviendo HTML cacheado
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    // Cache API entries
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    /* ignore */
  }
}

function forceReloadWithBust() {
  // Agrega/actualiza un query param para que CF y el navegador re-pidan el HTML.
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString(36));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

export function lazyRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    importFn().catch(async (error: any) => {
      const isChunkError =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.name === 'ChunkLoadError';

      if (isChunkError) {
        const storageKey = 'lazyRetry_reloaded';
        const hasReloaded = sessionStorage.getItem(storageKey);

        if (!hasReloaded) {
          sessionStorage.setItem(storageKey, '1');
          await clearBrowserCaches();
          forceReloadWithBust();
          // Never-resolving promise para no renderizar mientras se recarga.
          return new Promise(() => {}) as never;
        } else {
          // Ya se intentó una vez — limpiar flag y propagar para que el
          // ErrorBoundary muestre algo legible.
          sessionStorage.removeItem(storageKey);
        }
      }

      throw error;
    }),
  );
}
