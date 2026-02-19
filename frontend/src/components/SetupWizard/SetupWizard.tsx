import { useState, useEffect, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { saasApi } from '../../services/saasApi';

// ─── Types ───────────────────────────────────────────────────────────
interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
  bgColor: string;
  borderColor: string;
  checkKey: string; // localStorage key to track completion
}

const STEPS: SetupStep[] = [
  {
    id: 'ramos',
    title: 'Configurar Ramos',
    description: 'Define los ramos de seguros que maneja tu agencia (Vida, Auto, Hogar, etc.)',
    icon: 'solar:shield-bold-duotone',
    href: '/apps/admin/ramos',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/20',
    checkKey: 'guro_setup_ramos',
  },
  {
    id: 'aseguradoras',
    title: 'Agregar Aseguradoras',
    description: 'Registra las compañías aseguradoras con las que trabajas y sus comisiones',
    icon: 'solar:buildings-bold-duotone',
    href: '/apps/admin/aseguradoras',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-500/10',
    borderColor: 'border-purple-200 dark:border-purple-500/20',
    checkKey: 'guro_setup_aseguradoras',
  },
  {
    id: 'clientes',
    title: 'Crear Clientes',
    description: 'Agrega tus primeros clientes para empezar a gestionar su información',
    icon: 'solar:users-group-two-rounded-bold-duotone',
    href: '/apps/seguros/clientes',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-500/20',
    checkKey: 'guro_setup_clientes',
  },
  {
    id: 'polizas',
    title: 'Registrar Pólizas',
    description: 'Crea tu primera póliza asociando cliente, aseguradora y ramo',
    icon: 'solar:document-bold-duotone',
    href: '/apps/seguros/polizas',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-500/20',
    checkKey: 'guro_setup_polizas',
  },
];

const LS_DISMISSED = 'guro_setup_wizard_dismissed';
const LS_COMPLETED = 'guro_setup_wizard_completed';

// ─── Component ───────────────────────────────────────────────────────
const SetupWizard = () => {
  const nav = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(LS_DISMISSED) === 'true'; } catch { return false; }
  });
  const [completed, setCompleted] = useState(false);
  const [stepsCompleted, setStepsCompleted] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    STEPS.forEach((s) => {
      try { map[s.id] = localStorage.getItem(s.checkKey) === 'true'; } catch { map[s.id] = false; }
    });
    return map;
  });
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [backendChecked, setBackendChecked] = useState(false);

  // Verify actual backend data on mount — override localStorage if data is missing
  useEffect(() => {
    let cancelled = false;
    const checkBackendData = async () => {
      try {
        const [ramosRes, asegRes, metricsRes] = await Promise.all([
          saasApi.getRamos(),
          saasApi.getAseguradoras(),
          saasApi.getDashboardMetrics(),
        ]);

        if (cancelled) return;

        const ramosCount = ramosRes?.success && ramosRes.data?.data ? ramosRes.data.data.length : 0;
        const asegCount = asegRes?.success && asegRes.data?.data ? asegRes.data.data.length : 0;
        const clientesCount = metricsRes?.success && metricsRes.data?.clientes ? metricsRes.data.clientes.total : 0;
        const polizasCount = metricsRes?.success && metricsRes.data?.polizas ? metricsRes.data.polizas.total : 0;

        const backendStatus: Record<string, boolean> = {
          ramos: ramosCount > 0,
          aseguradoras: asegCount > 0,
          clientes: clientesCount > 0,
          polizas: polizasCount > 0,
        };

        // Sync: if backend has data → mark done; if backend has NO data → unmark
        const updated: Record<string, boolean> = {};
        let anyIncomplete = false;
        STEPS.forEach((s) => {
          const hasBE = backendStatus[s.id] ?? false;
          updated[s.id] = hasBE;
          try {
            if (hasBE) localStorage.setItem(s.checkKey, 'true');
            else localStorage.removeItem(s.checkKey);
          } catch {}
          if (!hasBE) anyIncomplete = true;
        });

        setStepsCompleted(updated);

        if (anyIncomplete) {
          // Re-show wizard if there are incomplete steps
          setCompleted(false);
          try {
            localStorage.removeItem(LS_COMPLETED);
            localStorage.removeItem(LS_DISMISSED);
          } catch {}
          setDismissed(false);
        } else {
          setCompleted(true);
          try { localStorage.setItem(LS_COMPLETED, 'true'); } catch {}
        }
      } catch {
        // On error, fall back to localStorage state
        const lsCompleted = localStorage.getItem(LS_COMPLETED) === 'true';
        setCompleted(lsCompleted);
      } finally {
        if (!cancelled) setBackendChecked(true);
      }
    };

    checkBackendData();
    return () => { cancelled = true; };
  }, []);

  // Find the current (first incomplete) step
  const currentStepIndex = useMemo(() => {
    const idx = STEPS.findIndex((s) => !stepsCompleted[s.id]);
    return idx === -1 ? STEPS.length : idx;
  }, [stepsCompleted]);

  const completedCount = useMemo(
    () => STEPS.filter((s) => stepsCompleted[s.id]).length,
    [stepsCompleted],
  );

  const progress = (completedCount / STEPS.length) * 100;

  // Auto-expand current step
  useEffect(() => {
    if (currentStepIndex < STEPS.length) {
      setExpandedStep(STEPS[currentStepIndex].id);
    }
  }, [currentStepIndex]);

  // Check if all steps are done (after backend check)
  useEffect(() => {
    if (backendChecked && completedCount === STEPS.length && !completed) {
      setCompleted(true);
      try { localStorage.setItem(LS_COMPLETED, 'true'); } catch {}
    }
  }, [completedCount, completed, backendChecked]);

  const markStepDone = (stepId: string) => {
    const step = STEPS.find((s) => s.id === stepId);
    if (!step) return;
    try { localStorage.setItem(step.checkKey, 'true'); } catch {}
    setStepsCompleted((prev) => ({ ...prev, [stepId]: true }));
  };

  const handleGoToStep = (step: SetupStep) => {
    // Mark as done when user navigates (they're taking action)
    markStepDone(step.id);
    nav(`${step.href}?tour=true`);
  };

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(LS_DISMISSED, 'true'); } catch {}
  };

  const handleReopen = () => {
    setDismissed(false);
    try { localStorage.removeItem(LS_DISMISSED); } catch {}
  };

  // If fully completed, show a compact success state
  if (completed) {
    return null; // Don't show anything once all steps are done
  }

  // Collapsed pill when dismissed
  if (dismissed) {
    return (
      <button
        onClick={handleReopen}
        className="group flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-white/[0.04] border border-gray-200/70 dark:border-white/[0.06] hover:border-[#573CFF]/30 dark:hover:border-[#573CFF]/20 transition-all hover:shadow-md active:scale-[0.98] mb-6"
      >
        <div className="w-7 h-7 rounded-lg bg-[#573CFF]/10 flex items-center justify-center">
          <Icon icon="solar:checklist-minimalistic-bold-duotone" width={15} className="text-[#573CFF]" />
        </div>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          Configuración inicial
        </span>
        <span className="text-[10px] font-bold text-[#573CFF] bg-[#573CFF]/10 px-2 py-0.5 rounded-full">
          {completedCount}/{STEPS.length}
        </span>
        <Icon icon="solar:arrow-right-linear" width={14} className="text-gray-400 group-hover:text-[#573CFF] transition-colors" />
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-gray-200/70 dark:border-white/[0.06] bg-white dark:bg-white/[0.04] overflow-hidden transition-all">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07] dark:opacity-[0.04]"
          style={{
            backgroundImage: 'url(https://framerusercontent.com/images/jBUMVVFjKCBRw4l4EEvLSAq3ik4.png?width=2880&height=2190)',
            backgroundSize: '200%',
            backgroundPosition: 'center',
            transform: 'rotate(180deg)',
          }}
        />
        <div className="relative z-10 px-6 pt-5 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#573CFF]/10 dark:bg-[#573CFF]/20 flex items-center justify-center">
                <Icon icon="solar:rocket-2-bold-duotone" width={22} className="text-[#573CFF]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                  Configura tu agencia
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Sigue estos pasos para empezar a usar Guro
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Minimizar"
            >
              <Icon icon="solar:minimize-bold" width={14} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#573CFF] transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 tabular-nums">
              {completedCount}/{STEPS.length}
            </span>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 pb-4">
        <div className="space-y-2">
          {STEPS.map((step, idx) => {
            const isDone = stepsCompleted[step.id];
            const isCurrent = idx === currentStepIndex;
            const isLocked = idx > currentStepIndex && !isDone;
            const isExpanded = expandedStep === step.id;

            return (
              <div
                key={step.id}
                className={`rounded-xl border transition-all duration-200 ${
                  isDone
                    ? 'border-gray-100 dark:border-white/[0.04] bg-gray-50/50 dark:bg-white/[0.02]'
                    : isCurrent
                    ? `${step.borderColor} bg-white dark:bg-white/[0.03] shadow-sm`
                    : 'border-gray-100 dark:border-white/[0.04] bg-white dark:bg-white/[0.02]'
                } ${isLocked ? 'opacity-50' : ''}`}
              >
                {/* Step header */}
                <button
                  onClick={() => {
                    if (!isLocked) setExpandedStep(isExpanded ? null : step.id);
                  }}
                  disabled={isLocked}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  {/* Step number / check */}
                  {isDone ? (
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <Icon icon="solar:check-circle-bold" width={16} className="text-emerald-500" />
                    </div>
                  ) : (
                    <div className={`w-7 h-7 rounded-lg ${isCurrent ? step.bgColor : 'bg-gray-100 dark:bg-white/[0.06]'} flex items-center justify-center flex-shrink-0`}>
                      <span className={`text-[11px] font-bold ${isCurrent ? step.color : 'text-gray-400 dark:text-gray-600'}`}>
                        {idx + 1}
                      </span>
                    </div>
                  )}

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-semibold ${
                      isDone
                        ? 'text-gray-400 dark:text-gray-600 line-through'
                        : isCurrent
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-500'
                    }`}>
                      {step.title}
                    </span>
                    {isCurrent && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#573CFF]/10 text-[#573CFF]">
                        Actual
                      </span>
                    )}
                  </div>

                  {/* Expand arrow */}
                  {!isDone && !isLocked && (
                    <Icon
                      icon="solar:alt-arrow-down-linear"
                      width={14}
                      className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && !isDone && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="ml-10">
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                        {step.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleGoToStep(step)}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.97] shadow-lg ${
                            step.id === 'ramos' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20' :
                            step.id === 'aseguradoras' ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20' :
                            step.id === 'clientes' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' :
                            'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                          }`}
                        >
                          <Icon icon={step.icon} width={14} />
                          Ir a {step.title.replace('Configurar ', '').replace('Agregar ', '').replace('Crear ', '').replace('Registrar ', '')}
                        </button>
                        {!isCurrent && (
                          <button
                            onClick={() => markStepDone(step.id)}
                            className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-medium transition-colors"
                          >
                            Ya lo hice
                          </button>
                        )}
                        {isCurrent && (
                          <button
                            onClick={() => markStepDone(step.id)}
                            className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-medium transition-colors"
                          >
                            Omitir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Reset helper (for testing / re-triggering) ─────────────────────
export const resetSetupWizard = () => {
  try {
    localStorage.removeItem(LS_DISMISSED);
    localStorage.removeItem(LS_COMPLETED);
    STEPS.forEach((s) => localStorage.removeItem(s.checkKey));
  } catch {}
};

export default SetupWizard;
