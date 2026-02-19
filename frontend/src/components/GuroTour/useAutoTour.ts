import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGuroTour, isTourCompleted } from './GuroTour';
import type { TourConfig } from './GuroTour';

/**
 * Auto-starts a tour on a page if:
 * 1. The URL has ?tour=true (coming from SetupWizard), OR
 * 2. The tour hasn't been completed yet (first visit)
 *
 * Waits for the page to render before starting.
 */
export const useAutoTour = (config: TourConfig, opts?: { delayMs?: number; onlyFromWizard?: boolean }) => {
  const { startTour, isActive } = useGuroTour();
  const [searchParams, setSearchParams] = useSearchParams();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || isActive) return;

    const fromWizard = searchParams.get('tour') === 'true';
    const alreadyDone = isTourCompleted(config.id);

    // If onlyFromWizard is true, only start when explicitly triggered
    const shouldStart = opts?.onlyFromWizard ? fromWizard : (fromWizard || !alreadyDone);

    if (!shouldStart) return;

    const delay = opts?.delayMs ?? 800;
    const timer = setTimeout(() => {
      // Clean the ?tour param from URL without navigation
      if (fromWizard) {
        searchParams.delete('tour');
        setSearchParams(searchParams, { replace: true });
      }
      started.current = true;
      startTour(config);
    }, delay);

    return () => clearTimeout(timer);
  }, [config, isActive, searchParams, setSearchParams, startTour, opts?.delayMs, opts?.onlyFromWizard]);
};
