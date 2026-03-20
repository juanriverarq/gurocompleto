import { lazy, ComponentType } from 'react';

/**
 * Wraps React.lazy() with automatic retry + page reload on chunk load failure.
 * 
 * After a deploy, old JS chunk hashes no longer exist on the server.
 * Users with a cached index.html will get "Failed to fetch dynamically imported module".
 * This utility catches that error and reloads the page once to get the fresh index.html.
 * 
 * A sessionStorage flag prevents infinite reload loops.
 */
export function lazyRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    importFn().catch((error: any) => {
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
          window.location.reload();
          // Return a never-resolving promise to prevent rendering while reloading
          return new Promise(() => {});
        } else {
          // Already reloaded once — clear flag and let the error propagate
          sessionStorage.removeItem(storageKey);
        }
      }

      throw error;
    }),
  );
}
