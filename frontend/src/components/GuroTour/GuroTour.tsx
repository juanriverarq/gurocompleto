import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

// ─── Types ───────────────────────────────────────────────────────────
export interface TourStep {
  /** CSS selector or data-tour="value" shorthand */
  target: string;
  title: string;
  content: string;
  /** Where to place the tooltip relative to the target */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** If true, clicking the highlighted element advances the tour */
  advanceOnClick?: boolean;
  /** Optional icon */
  icon?: string;
}

export interface TourConfig {
  id: string;
  steps: TourStep[];
}

interface TourContextValue {
  startTour: (config: TourConfig) => void;
  endTour: () => void;
  isActive: boolean;
  activeTourId: string | null;
}

const TourContext = createContext<TourContextValue>({
  startTour: () => {},
  endTour: () => {},
  isActive: false,
  activeTourId: null,
});

export const useGuroTour = () => useContext(TourContext);

// ─── localStorage keys ──────────────────────────────────────────────
const LS_PREFIX = 'guro_tour_done_';

export const isTourCompleted = (tourId: string) => {
  try { return localStorage.getItem(`${LS_PREFIX}${tourId}`) === 'true'; } catch { return false; }
};

const markTourCompleted = (tourId: string) => {
  try { localStorage.setItem(`${LS_PREFIX}${tourId}`, 'true'); } catch {}
};

export const resetTour = (tourId: string) => {
  try { localStorage.removeItem(`${LS_PREFIX}${tourId}`); } catch {}
};

// ─── Provider ────────────────────────────────────────────────────────
export const GuroTourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<TourConfig | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const startTour = useCallback((cfg: TourConfig) => {
    setConfig(cfg);
    setStepIndex(0);
  }, []);

  const endTour = useCallback(() => {
    if (config) markTourCompleted(config.id);
    setConfig(null);
    setStepIndex(0);
  }, [config]);

  const next = useCallback(() => {
    if (!config) return;
    if (stepIndex < config.steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      endTour();
    }
  }, [config, stepIndex, endTour]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  return (
    <TourContext.Provider value={{ startTour, endTour, isActive: !!config, activeTourId: config?.id || null }}>
      {children}
      {config && (
        <TourOverlay
          steps={config.steps}
          stepIndex={stepIndex}
          onNext={next}
          onPrev={prev}
          onClose={endTour}
          totalSteps={config.steps.length}
        />
      )}
    </TourContext.Provider>
  );
};

// ─── Helper: wait for a DOM element to appear ──────────────────────
const waitForElement = (selector: string, timeoutMs = 3000): Promise<HTMLElement | null> => {
  const sel = selector.startsWith('[') ? selector : `[data-tour="${selector}"]`;
  return new Promise((resolve) => {
    // Already in DOM?
    const existing = document.querySelector(sel) as HTMLElement | null;
    if (existing) { resolve(existing); return; }

    let resolved = false;
    const observer = new MutationObserver(() => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el && !resolved) {
        resolved = true;
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout fallback
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        observer.disconnect();
        resolve(document.querySelector(sel) as HTMLElement | null);
      }
    }, timeoutMs);
  });
};

// ─── Overlay ─────────────────────────────────────────────────────────
interface OverlayProps {
  steps: TourStep[];
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  totalSteps: number;
}

const TourOverlay: React.FC<OverlayProps> = ({ steps, stepIndex, onNext, onPrev, onClose, totalSteps }) => {
  const step = steps[stepIndex];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [waitingForTarget, setWaitingForTarget] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // Resolve target selector
  const getSel = useCallback(() => {
    if (!step) return '';
    return step.target.startsWith('[') ? step.target : `[data-tour="${step.target}"]`;
  }, [step]);

  // Resolve target element
  const getTarget = useCallback(() => {
    const sel = getSel();
    if (!sel) return null;
    return document.querySelector(sel) as HTMLElement | null;
  }, [getSel]);

  // Track target position — with retry when element isn't in DOM yet (e.g. modal opening)
  useEffect(() => {
    let cancelled = false;
    cancelAnimationFrame(rafRef.current);

    const startTracking = () => {
      const update = () => {
        if (cancelled) return;
        const el = getTarget();
        if (el) {
          const r = el.getBoundingClientRect();
          setRect(r);
          setWaitingForTarget(false);
          // Scroll into view if needed
          const inView = r.top >= 0 && r.bottom <= window.innerHeight;
          if (!inView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          setRect(null);
        }
        rafRef.current = requestAnimationFrame(update);
      };
      rafRef.current = requestAnimationFrame(update);
    };

    // Check if target exists immediately
    const el = getTarget();
    if (el) {
      setWaitingForTarget(false);
      const timeout = setTimeout(startTracking, 100);
      return () => { cancelled = true; clearTimeout(timeout); cancelAnimationFrame(rafRef.current); };
    }

    // Target not in DOM yet — wait for it (modal opening, etc.)
    setWaitingForTarget(true);
    const sel = getSel();
    waitForElement(sel, 4000).then(() => {
      if (cancelled) return;
      setWaitingForTarget(false);
      // Extra delay for modal animation
      setTimeout(startTracking, 400);
    });

    return () => { cancelled = true; cancelAnimationFrame(rafRef.current); };
  }, [getTarget, getSel, stepIndex]);

  // Calculate tooltip position
  useEffect(() => {
    if (!rect || !tooltipRef.current) return;
    const tt = tooltipRef.current.getBoundingClientRect();
    const pad = 12;
    const placement = step?.placement || 'bottom';
    let top = 0, left = 0;

    switch (placement) {
      case 'bottom':
        top = rect.bottom + pad;
        left = rect.left + rect.width / 2 - tt.width / 2;
        break;
      case 'top':
        top = rect.top - tt.height - pad;
        left = rect.left + rect.width / 2 - tt.width / 2;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tt.height / 2;
        left = rect.right + pad;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tt.height / 2;
        left = rect.left - tt.width - pad;
        break;
    }

    // Clamp to viewport
    left = Math.max(12, Math.min(left, window.innerWidth - tt.width - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - tt.height - 12));

    setTooltipPos({ top, left });
  }, [rect, step?.placement, stepIndex]);

  // Advance on click: let the real click happen, then wait for next target before advancing
  useEffect(() => {
    if (!step?.advanceOnClick) return;
    const el = getTarget();
    if (!el) return;

    const handler = () => {
      // Check if there's a next step with a target we need to wait for
      const nextStep = steps[stepIndex + 1];
      if (nextStep) {
        const nextSel = nextStep.target.startsWith('[') ? nextStep.target : `[data-tour="${nextStep.target}"]`;
        // Wait for the next target to appear (e.g. modal content)
        waitForElement(nextSel, 4000).then(() => {
          // Small extra delay for animations
          setTimeout(onNext, 300);
        });
      } else {
        setTimeout(onNext, 300);
      }
    };

    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [step, steps, stepIndex, getTarget, onNext]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'Enter') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onNext, onPrev]);

  if (!step) return null;

  const spotPad = 8;

  // While waiting for target (modal opening), show a subtle loading state
  if (waitingForTarget) {
    return createPortal(
      <div className="fixed inset-0 z-[99999]">
        <div className="absolute inset-0 bg-black/40 transition-opacity" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#573CFF] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Abriendo...</p>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // Spotlight hole coordinates
  const holeTop = rect ? rect.top - spotPad : 0;
  const holeLeft = rect ? rect.left - spotPad : 0;
  const holeW = rect ? rect.width + spotPad * 2 : 0;
  const holeH = rect ? rect.height + spotPad * 2 : 0;
  const holeBottom = holeTop + holeH;
  const holeRight = holeLeft + holeW;

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    background: 'rgba(0,0,0,0.55)',
    pointerEvents: 'auto',
    cursor: 'default',
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999]" style={{ pointerEvents: 'none' }}>
      {/* 4 overlay panels around the spotlight hole — clicks pass through the hole to real DOM */}
      {rect ? (
        <>
          {/* Top */}
          <div onClick={onClose} style={{ ...overlayStyle, top: 0, left: 0, right: 0, height: Math.max(0, holeTop) }} />
          {/* Bottom */}
          <div onClick={onClose} style={{ ...overlayStyle, top: holeBottom, left: 0, right: 0, bottom: 0 }} />
          {/* Left */}
          <div onClick={onClose} style={{ ...overlayStyle, top: holeTop, left: 0, width: Math.max(0, holeLeft), height: holeH }} />
          {/* Right */}
          <div onClick={onClose} style={{ ...overlayStyle, top: holeTop, left: holeRight, right: 0, height: holeH }} />
        </>
      ) : (
        <div onClick={onClose} style={{ ...overlayStyle, inset: 0 }} />
      )}

      {/* Spotlight ring */}
      {rect && (
        <div
          className="absolute rounded-xl ring-2 ring-[#573CFF] ring-offset-2 ring-offset-transparent transition-all duration-300 ease-out"
          style={{
            top: holeTop,
            left: holeLeft,
            width: holeW,
            height: holeH,
            pointerEvents: 'none',
            boxShadow: '0 0 0 4px rgba(87,60,255,0.15), 0 0 30px rgba(87,60,255,0.1)',
          }}
        >
          {/* Pulse animation */}
          <div className="absolute inset-0 rounded-xl animate-ping opacity-20 bg-[#573CFF]" style={{ animationDuration: '2s' }} />
        </div>
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute transition-all duration-300 ease-out"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          pointerEvents: 'auto',
          zIndex: 2,
        }}
      >
        <div
          className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/50 border border-gray-200/80 dark:border-white/10 w-[320px] overflow-hidden"
          style={{ fontFamily: "'General Sans', sans-serif" }}
        >
          {/* Header accent */}
          <div className="h-1 bg-gradient-to-r from-[#573CFF] via-[#a25dae] to-[#fa8e5b]" />

          <div className="p-4">
            {/* Step counter */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {step.icon && (
                  <div className="w-6 h-6 rounded-lg bg-[#573CFF]/10 flex items-center justify-center">
                    <Icon icon={step.icon} width={13} className="text-[#573CFF]" />
                  </div>
                )}
                <span className="text-[10px] font-bold text-[#573CFF] uppercase tracking-wider">
                  Paso {stepIndex + 1} de {totalSteps}
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-6 h-6 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <Icon icon="solar:close-circle-bold" width={14} />
              </button>
            </div>

            {/* Content */}
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1 tracking-tight">
              {step.title}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
              {step.content}
            </p>

            {/* Progress dots */}
            <div className="flex items-center gap-1 mb-3">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === stepIndex
                      ? 'w-5 bg-[#573CFF]'
                      : i < stepIndex
                      ? 'w-2 bg-[#573CFF]/40'
                      : 'w-2 bg-gray-200 dark:bg-white/10'
                  }`}
                />
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={onPrev}
                disabled={stepIndex === 0}
                className="text-[11px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                  Saltar tour
                </button>
                <button
                  onClick={onNext}
                  className="px-4 py-1.5 rounded-lg bg-[#573CFF] hover:bg-[#4a32d9] text-white text-[11px] font-bold transition-all active:scale-95 shadow-lg shadow-[#573CFF]/20"
                >
                  {stepIndex === totalSteps - 1 ? '¡Listo!' : 'Siguiente →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default GuroTourProvider;
