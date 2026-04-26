import { motion, useInView } from 'framer-motion';
import { useRef, useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { ModuleKey, BillingPeriod, MODULES, calculateTotals, BASE_PLATFORM_FEE, getMonthlyPricePerUser, numberFormat } from '../pricing-calculator/modules';
import CalendlyModal from './CalendlyModal';

/* ── Feature items matching /comenzar (modules.ts) exactly ── */

type FeatureItem = {
  name: string;
  /** Optional note shown in gray, e.g. "por consumo" or price */
  note?: string;
};

/* All features in display order — matches modules.ts keys */
const allFeatureNames = [
  'Clientes',
  'Pólizas',
  'Siniestros',
  'Renovaciones',
  'Automóviles',
  'Seguimiento',
  'Documentos',
  'WhatsApp Marketing',
  'Email Marketing',
  'IA Call Center',
  'Negocios (CRM)',
  'Cartera',
  'Comisiones',
  'Reportes Avanzados',
  'Mini Web',
  'Asistente IA',
  'Lector PDF con IA',
  'Chatbot WhatsApp',
  'Marca Blanca',
  'App Móvil',
  'Sitio Web',
  'Facturación electrónica',
  'Nómina electrónica',
  'IA Predicciones',
  'IA Ventas Cruzadas',
];

/* Per-plan: which features are included and with what note */
const starterFeatures: FeatureItem[] = [
  { name: 'Clientes' },
  { name: 'Pólizas' },
  { name: 'Siniestros' },
  { name: 'Renovaciones' },
  { name: 'Automóviles' },
  { name: 'Seguimiento' },
  { name: 'Documentos' },
  { name: 'Negocios (CRM)' },
  { name: 'Cartera' },
];
const starterSet = new Set(starterFeatures.map(f => f.name));

const professionalFeatures: FeatureItem[] = [
  ...starterFeatures,
  { name: 'WhatsApp Marketing', note: 'Envíos masivos · $70/envío' },
  { name: 'Email Marketing', note: '$80/email enviado' },
  { name: 'IA Call Center', note: '$1,200/min · baja según consumo' },
  { name: 'Comisiones' },
  { name: 'Reportes Avanzados' },
  { name: 'Mini Web' },
  { name: 'Asistente IA' },
  { name: 'Lector PDF con IA' },
];
const professionalSet = new Set(professionalFeatures.map(f => f.name));

const businessFeatures: FeatureItem[] = [
  ...professionalFeatures,
  { name: 'Chatbot WhatsApp' },
  { name: 'Marca Blanca' },
  { name: 'Sitio Web' },
  { name: 'IA Predicciones' },
  { name: 'IA Ventas Cruzadas' },
];
const businessSet = new Set(businessFeatures.map(f => f.name));

const customExtras: FeatureItem[] = [
  { name: 'App Móvil' },
  { name: 'Facturación electrónica' },
  { name: 'Nómina electrónica' },
];
const customFeatures: FeatureItem[] = [
  ...businessFeatures,
  ...customExtras,
];
const customSet = new Set(customFeatures.map(f => f.name));

const ANNUAL_DISCOUNT = 0.12; // 12%

/* Mandatory module keys (always included) */
const mandatoryKeys: ModuleKey[] = MODULES.filter(m => m.mandatory).map(m => m.key);

/* Keys excluded from Starter plan */
const starterExcluded: ModuleKey[] = ['whatsapp', 'email', 'ia_callcenter'];

/* Pre-configured module sets per plan */
const starterModules: ModuleKey[] = [
  ...mandatoryKeys.filter(k => !starterExcluded.includes(k)),
  'crm', 'cartera',
];
const professionalModules: ModuleKey[] = [
  ...mandatoryKeys,
  'crm', 'cartera', 'comisiones', 'reportes', 'miniweb', 'ia_chatbot', 'lector_pdf_ia',
];
const businessModules: ModuleKey[] = [
  ...professionalModules,
  'ia_chatbot_sura', 'marca_blanca', 'sitio_web', 'ia_predicciones', 'ia_ventas_cruzadas',
];

const plans = [
  {
    name: 'Starter',
    description: 'Para agentes independientes que quieren empezar.',
    popular: false,
    features: starterFeatures,
    includedSet: starterSet,
    cta: 'Comenzar',
    minUsers: 1,
    presetStorageGB: 10,
    presetModules: starterModules,
  },
  {
    name: 'Professional',
    description: 'Para agencias en crecimiento que necesitan más.',
    popular: true,
    features: professionalFeatures,
    includedSet: professionalSet,
    cta: 'Comenzar',
    minUsers: 3,
    presetStorageGB: 30,
    presetModules: professionalModules,
  },
  {
    name: 'Business',
    description: 'Para agencias consolidadas con operación completa.',
    popular: false,
    features: businessFeatures,
    includedSet: businessSet,
    cta: 'Comenzar',
    minUsers: 5,
    presetStorageGB: 50,
    presetModules: businessModules,
  },
  {
    name: 'A tu medida',
    description: 'Arma tu plan con las apps que necesites.',
    popular: false,
    features: customExtras,
    includedSet: customSet,
    isEnterprise: true,
    cta: 'Armar mi plan',
    minUsers: 1,
    presetStorageGB: 10,
    presetModules: businessModules,
  },
];

/** Compute monthly price for a plan given user count */
function computePlanPrice(plan: typeof plans[number], users: number): number {
  const selected = new Set<ModuleKey>(plan.presetModules);
  const totals = calculateTotals(selected, users, 'monthly');
  const extraGB = Math.max(plan.presetStorageGB - 10, 0);
  const storageCost = extraGB * 2000;
  return (totals as any).subtotalMonthly + storageCost;
}

const formatPrice = numberFormat;

const VISIBLE_COUNT = 5;

const PlanFeatures = ({ plan }: { plan: typeof plans[number] }) => {
  const [expanded, setExpanded] = useState(false);
  const isEnterprise = 'isEnterprise' in plan && plan.isEnterprise;
  const notIncluded = isEnterprise ? [] : allFeatureNames.filter(name => !plan.includedSet.has(name));

  const visibleFeatures = expanded ? plan.features : plan.features.slice(0, VISIBLE_COUNT);
  const visibleNotIncluded = expanded ? notIncluded : [];
  const hasMore = plan.features.length > VISIBLE_COUNT || notIncluded.length > 0;

  return (
    <>
      <div className="mb-2">
        <p className="text-xs font-bold text-white uppercase tracking-wider mb-3">
          {isEnterprise ? 'Todo lo de Professional +' : 'Incluye:'}
        </p>
        <ul className="space-y-2">
          {visibleFeatures.map((feature) => (
            <li key={feature.name} className="flex items-start gap-2">
              <Icon icon="solar:check-circle-bold" className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#573CFF]" />
              <div className="flex flex-col">
                <span className="text-sm text-white/80">{feature.name}</span>
                {!isEnterprise && feature.note && (
                  <span className="text-[11px] text-white/40">{feature.note}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {expanded && visibleNotIncluded.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">No incluye:</p>
          <ul className="space-y-2">
            {visibleNotIncluded.map((name) => (
              <li key={name} className="flex items-start gap-2">
                <Icon icon="solar:close-circle-bold" className="w-4 h-4 flex-shrink-0 mt-0.5 text-white/30" />
                <span className="text-sm text-white/40">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-medium text-[#573CFF] hover:text-[#7a63ff] transition-colors mt-2"
        >
          {expanded ? 'Ver menos' : 'Ver más'}
          <Icon
            icon={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
            className="w-3.5 h-3.5"
          />
        </button>
      )}
    </>
  );
};

const Pricing = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [isAnnual, setIsAnnual] = useState(true);
  const [showCalendly, setShowCalendly] = useState(false);
  const navigate = useNavigate();

  // Per-plan user counts (initialized to each plan's minimum)
  const [planUsers, setPlanUsers] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    plans.forEach(p => { init[p.name] = p.minUsers; });
    return init;
  });

  const setUsersForPlan = (planName: string, min: number, delta: number) => {
    setPlanUsers(prev => ({
      ...prev,
      [planName]: Math.max(min, (prev[planName] || min) + delta),
    }));
  };

  const handlePlanClick = (plan: typeof plans[number]) => {
    const users = planUsers[plan.name] || plan.minUsers;
    const period: BillingPeriod = isAnnual ? 'annual' : 'monthly';
    const selected = new Set<ModuleKey>(plan.presetModules);
    const totals = calculateTotals(selected, users, period);
    const payload = {
      users,
      modules: plan.presetModules,
      totals,
      storageGB: plan.presetStorageGB,
      period,
    };
    localStorage.setItem('guro_pricing_selection', JSON.stringify(payload));
    localStorage.setItem('guro_selected_apps', JSON.stringify(plan.presetModules));
    localStorage.removeItem('guro_sura_flow');
    navigate('/comenzar/registro');
  };

  return (
    <section ref={ref} id="precios" className="py-14 sm:py-28 bg-transparent">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-6"
        >
          <motion.h2
            initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
            animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white leading-[1.1] tracking-[-0.02em] mb-4"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
          >
            Elige un plan
            <span className="hidden sm:inline"><br /></span>{' '}
            <span className="landing-grad-text">para tu operación</span>
          </motion.h2>
          <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto">
            Planes para agentes, agencias y corredores de todos los tamaños.
          </p>
        </motion.div>

        {/* Toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-10 sm:mb-14"
        >
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-1">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                !isAnnual ? 'bg-white text-[#0d0d0d] shadow-sm' : 'text-white/50'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                isAnnual ? 'bg-white text-[#0d0d0d] shadow-sm' : 'text-white/50'
              }`}
            >
              Anual
            </button>
          </div>
          {isAnnual && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 text-[11px] font-bold text-[#573CFF] uppercase tracking-wider"
            >
              <Icon icon="solar:tag-price-bold" className="w-3.5 h-3.5" />
              Ahorra 12% en el plan anual
            </motion.span>
          )}
        </motion.div>

        {/* Cards */}
        <div className="grid lg:grid-cols-4 gap-0 border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]">
          {plans.map((plan, index) => {
            const isCustom = 'isEnterprise' in plan && plan.isEnterprise;
            const users = planUsers[plan.name] || plan.minUsers;
            const monthlyPrice = isCustom ? null : computePlanPrice(plan, users);
            const monthlyDisplay = monthlyPrice
              ? isAnnual
                ? Math.round(monthlyPrice * (1 - ANNUAL_DISCOUNT))
                : monthlyPrice
              : null;
            const annualTotal = monthlyPrice
              ? Math.round(monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT))
              : null;

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ duration: 0.6, delay: 0.1 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6, transition: { duration: 0.3 } }}
                className={`p-7 sm:p-8 flex flex-col transition-all duration-300 hover:bg-white/[0.04] ${
                  index < plans.length - 1 ? 'lg:border-r border-b lg:border-b-0 border-white/10' : ''
                }`}
              >
                {/* Name + badge */}
                <div className="flex items-center gap-2 mb-2">
                  <h3
                    className="text-lg font-bold text-white"
                    style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
                  >
                    {plan.name}
                  </h3>
                  {plan.popular && (
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 bg-[#573CFF] text-white rounded">
                      Más popular
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-white/50 mb-1 leading-relaxed">{plan.description}</p>

                {/* User selector */}
                {!isCustom && (
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      onClick={() => setUsersForPlan(plan.name, plan.minUsers, -1)}
                      disabled={users <= plan.minUsers}
                      className="w-7 h-7 rounded-lg border border-white/15 flex items-center justify-center text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <Icon icon="solar:minus-circle-linear" className="text-sm" />
                    </button>
                    <span className="text-sm font-semibold text-white min-w-[60px] text-center">
                      {users} {users === 1 ? 'usuario' : 'usuarios'}
                    </span>
                    <button
                      onClick={() => setUsersForPlan(plan.name, plan.minUsers, 1)}
                      className="w-7 h-7 rounded-lg border border-white/15 flex items-center justify-center text-white/60 hover:bg-white/10 transition"
                    >
                      <Icon icon="solar:add-circle-linear" className="text-sm" />
                    </button>
                    <span className="text-[10px] text-white/40 ml-1">· {plan.presetStorageGB} GB</span>
                  </div>
                )}
                {isCustom && (
                  <p className="text-xs text-white/50 mb-4">Usuarios y almacenamiento a tu medida</p>
                )}

                {/* Price */}
                <div className="mb-6">
                  {monthlyDisplay ? (
                    <>
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className="text-3xl sm:text-4xl font-bold text-white tracking-tight"
                          style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
                        >
                          {formatPrice(monthlyDisplay)}
                        </span>
                        <span className="text-sm text-white/50 font-medium">/mes</span>
                      </div>
                      {isAnnual && annualTotal && (
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-white/50">
                            {formatPrice(annualTotal)}/año
                          </p>
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                            -12%
                          </span>
                        </div>
                      )}
                      {!isAnnual && monthlyPrice && (
                        <p className="text-xs text-white/50 mt-1">
                          {formatPrice(monthlyPrice * 12)}/año sin descuento
                        </p>
                      )}
                    </>
                  ) : (
                    <div
                      className="text-3xl sm:text-4xl font-bold text-white tracking-tight"
                      style={{ fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', sans-serif" }}
                    >
                      A tu medida
                    </div>
                  )}
                </div>

                {/* CTA button */}
                {isCustom ? (
                  <button
                    onClick={() => navigate('/comenzar')}
                    className="block w-full py-3 rounded-xl font-bold text-center text-sm uppercase tracking-wider transition-colors mb-7 bg-white/10 border border-white/15 text-white hover:bg-white/15"
                  >
                    {plan.cta}
                  </button>
                ) : (
                  <button
                    onClick={() => handlePlanClick(plan)}
                    className={`block w-full py-3 rounded-xl font-bold text-center text-sm uppercase tracking-wider transition-colors mb-7 ${
                      plan.popular
                        ? 'bg-[#573CFF] text-white hover:bg-[#4530cc]'
                        : 'bg-white/10 border border-white/15 text-white hover:bg-white/15'
                    }`}
                  >
                    {plan.cta}
                  </button>
                )}

                <PlanFeatures plan={plan} />
              </motion.div>
            );
          })}
        </div>

        {/* Bottom link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="text-center mt-10"
        >
          <button
            onClick={() => setShowCalendly(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#573CFF] hover:gap-3 transition-all"
          >
            <Icon icon="solar:calendar-bold-duotone" className="w-4 h-4" />
            ¿Necesitas algo personalizado? Habla con ventas
            <Icon icon="solar:arrow-right-linear" className="w-4 h-4" />
          </button>
        </motion.div>
      </div>

      {/* Calendly Modal */}
      <CalendlyModal isOpen={showCalendly} onClose={() => setShowCalendly(false)} />
    </section>
  );
};

export default Pricing;
