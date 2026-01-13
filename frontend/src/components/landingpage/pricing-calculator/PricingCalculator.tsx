import { useState, useMemo, useContext } from 'react';
import { Icon } from '@iconify/react';
import { MODULES, calculateTotals, numberFormat } from './modules';
import { ModuleKey, BillingPeriod } from './modules';
import { UnifiedAuthContext } from 'src/context/UnifiedAuthContext';
import api from 'src/config/api';
// import VideoDemoModal from './VideoDemoModal';
// import ModuleInfoModal from './ModuleInfoModal';

interface Props {
  defaultUsers?: number;
  onCheckout?: (payload: {
    users: number;
    modules: ModuleKey[];
    totals: ReturnType<typeof calculateTotals>;
  }) => void;
}

const PricingCalculator = ({ defaultUsers = 1, onCheckout }: Props) => {
  // Usar useContext directamente para evitar error si no hay provider (landing page)
  const authContext = useContext(UnifiedAuthContext);
  const user = authContext?.user ?? null;
  const [users, setUsers] = useState(defaultUsers);
  // const [openVideo, setOpenVideo] = useState(false);
  // const [openInfo, setOpenInfo] = useState(false);
  // const [selectedModuleKey, setSelectedModuleKey] = useState<ModuleKey | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [showModuleLines, setShowModuleLines] = useState(false);
  const [storageGB, setStorageGB] = useState(10); // 10 GB incluidos
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  // Se removió comparación y buscador para simplificar la UI
  // Preseleccionar todos los módulos obligatorios
  const mandatoryKeys = useMemo(() => MODULES.filter((m) => m.mandatory).map((m) => m.key), []);
  const [selected, setSelected] = useState<Set<ModuleKey>>(new Set(mandatoryKeys));

  // Garantizar que los obligatorios siempre estén presentes (por seguridad)
  useMemo(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      mandatoryKeys.forEach((k) => next.add(k));
      return next;
    });
  }, [mandatoryKeys]);

  // Si se cambia a mensual, deseleccionar módulos solo-anual automáticamente
  useMemo(() => {
    if (period === 'monthly') {
      setSelected((prev) => {
        const next = new Set(prev);
        MODULES.filter((m) => m.annualOnly).forEach((m) => next.delete(m.key));
        return next;
      });
    }
  }, [period]);

  const totals = useMemo(() => calculateTotals(selected, users, period), [selected, users, period]);
  const tiers = [
    { label: '0 – 3', range: [1, 3] as [number, number], price: 25000 },
    { label: '4 – 10', range: [4, 10] as [number, number], price: 23000 },
    { label: '11 – 20', range: [11, 20] as [number, number], price: 20000 },
    { label: '20+', range: [21, Infinity] as [number, number], price: 18000 },
  ];
  const baseRef = 25000;
  const ahorroMensualTotal = useMemo(() => {
    const perUserMonthly = (totals as any).users.perUserMonthly;
    const billableUsers = (totals as any).users.billableUsers as number;
    const diff = Math.max(0, baseRef - perUserMonthly);
    return diff * billableUsers;
  }, [totals, baseRef]);

  // Módulos adicionales ordenados: primero los disponibles en mensual, al final los 'solo anual'
  const additionalModules = useMemo(() => {
    return MODULES.filter((m) => !m.mandatory)
      .slice()
      .sort((a, b) => (a.annualOnly ? 1 : 0) - (b.annualOnly ? 1 : 0)); // false(0) primero, true(1) al final
  }, []);

  const toggle = (key: ModuleKey) => {
    const mod = MODULES.find((m) => m.key === key);
    if (mod?.mandatory) return; // no se puede desactivar
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // const openModuleInfo = (key: ModuleKey) => {
  //   setSelectedModuleKey(key);
  //   setOpenInfo(true);
  // };

  const handleCheckout = async () => {
    const payload = { users, modules: Array.from(selected), totals, storageGB, period };
    if (onCheckout) onCheckout(payload);
    // Guardar selección localmente
    localStorage.setItem('guro_pricing_selection', JSON.stringify(payload));

    try {
      if (user) {
        // Crear intención de suscripción en backend (requiere Firebase Auth)
        try {
          const { auth } = await import('src/config/firebase');
          await auth.currentUser?.getIdToken(true);
        } catch {}
        await api.post('/pricing/subscription-intents', {
          users,
          period,
          storageGB,
          modules: Array.from(selected),
          totals,
          source: 'pricing_calculator',
        });
        // Ir directo al checkout
        window.location.href = '/checkout';
      } else {
        // Forzar registro antes de continuar
        const redirect = encodeURIComponent('/checkout');
        window.location.href = `/auth/register?redirect=${redirect}`;
      }
    } catch (e) {
      // Si falla por auth o red, enviar a registro como fallback
      const redirect = encodeURIComponent('/checkout');
      window.location.href = `/auth/register?redirect=${redirect}`;
    }
  };

  // Sin buscador: usamos la lista completa de módulos
  const filteredModules = MODULES;

  return (
    <section className="py-16 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        {/* Encabezado simplificado */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Personaliza tu suscripción</h1>
          <p className="text-gray-600">Selecciona los módulos y recursos que necesites</p>
          {/* Toggle de periodo centrado y llamativo */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <span
              className={`text-sm ${
                period === 'monthly' ? 'font-semibold text-primary' : 'text-gray-500'
              }`}
            >
              Mensual
            </span>
            <button
              type="button"
              onClick={() => setPeriod((p) => (p === 'monthly' ? 'annual' : 'monthly'))}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition shadow-sm ${
                period === 'annual' ? 'bg-primary' : 'bg-gray-300'
              }`}
              aria-label="Cambiar periodo de facturación"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                  period === 'annual' ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
            <span
              className={`text-sm ${
                period === 'annual' ? 'font-semibold text-primary' : 'text-gray-500'
              }`}
            >
              Anual
            </span>
            <span className="ml-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
              -12%
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Selector de módulos */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Configuración</h2>
              {/* Toggle movido al encabezado principal para mayor visibilidad */}
            </div>
            {/* Buscador de módulos removido para simplificar la UI */}

            {/* Operaciones incluidas */}
            <h4 className="mt-4 mb-2 text-sm font-semibold text-gray-700">Operaciones incluidas</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredModules
                .filter((m) => m.mandatory)
                .map((m) => {
                  const active = selected.has(m.key);
                  return (
                    <button
                      key={m.key}
                      onClick={() => toggle(m.key)}
                      disabled={!!m.mandatory}
                      className={`group rounded-xl border p-3 text-left transition shadow-sm hover:shadow-md bg-white relative overflow-hidden ${
                        active ? 'border-primary bg-primary/5' : 'border-gray-200'
                      } ${m.mandatory ? 'cursor-not-allowed opacity-95' : ''}`}
                    >
                      {/* Icono de fondo (estilo anterior) */}
                      <Icon
                        icon={m.icon}
                        className="absolute -right-4 -bottom-2 text-6xl opacity-10 pointer-events-none"
                      />
                      {/* Indicador 'Incluido' con botón info al lado */}
                      {m.mandatory && (
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-primary text-white font-semibold shadow-sm">
                            Incluido
                          </span>
                        </div>
                      )}
                      <span
                        className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${m.color} mb-1.5 relative z-[1]`}
                      >
                        <Icon icon={m.icon} className="text-xl text-gray-700" />
                      </span>
                      <div className="flex items-center justify-between gap-2 relative z-[1]">
                        <div className="font-medium text-sm leading-tight">{m.name}</div>
                      </div>
                      {/* Indicador por consumo removido para simplificar la UI */}
                      {active && !m.mandatory && (
                        <Icon
                          icon="solar:check-circle-bold"
                          className="text-primary absolute top-2 right-2"
                        />
                      )}
                    </button>
                  );
                })}
            </div>

            {/* Módulos adicionales */}
            <h4 className="mt-6 mb-2 text-sm font-semibold text-gray-700">Módulos adicionales</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {additionalModules.map((m) => {
                const active = selected.has(m.key);
                const disabledAnnualOnly = period === 'monthly' && !!m.annualOnly;
                return (
                  <button
                    key={m.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!disabledAnnualOnly) toggle(m.key);
                    }}
                    disabled={disabledAnnualOnly}
                    aria-disabled={disabledAnnualOnly}
                    className={`group rounded-xl border p-3 text-left transition shadow-sm hover:shadow-md bg-white relative overflow-hidden ${
                      active ? 'border-primary bg-primary/5' : 'border-gray-200'
                    } ${
                      disabledAnnualOnly ? 'opacity-60 cursor-not-allowed hover:shadow-none' : ''
                    }`}
                  >
                    {/* Icono de fondo (estilo anterior) */}
                    <Icon
                      icon={m.icon}
                      className="absolute -right-4 -bottom-2 text-6xl opacity-10 pointer-events-none"
                    />
                    {/* Badge Solo anual */}
                    {disabledAnnualOnly && (
                      <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium opacity-60">
                        Solo anual
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${m.color} mb-1.5 relative z-[1]`}
                    >
                      <Icon icon={m.icon} className="text-xl text-gray-700" />
                    </span>
                    <div className="flex items-center justify-between gap-2 relative z-[1]">
                      <div className="font-medium text-sm leading-tight">{m.name}</div>
                    </div>
                    {/* Mostrar valor solo cuando se cobra */}
                    <div className="relative z-[1] text-sm font-semibold text-primary">
                      {(() => {
                        if (m.annualOnly) {
                          if (period === 'annual' && m.annualPrice && m.annualPrice > 0)
                            return `${numberFormat(m.annualPrice)}/año`;
                          return '';
                        }
                        // no es solo anual
                        if (period === 'monthly') return `${numberFormat(m.pricePerUser)}/mes`;
                        // en anual, el cargo es anualizado
                        return `${numberFormat(m.pricePerUser * 12)}/año`;
                      })()}
                    </div>
                    {active && (
                      <Icon
                        icon="solar:check-circle-bold"
                        className="text-primary absolute top-2 right-2"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Configuración compacta */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Usuarios</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUsers((v) => Math.max(1, v - 1))}
                      className="w-8 h-8 rounded border hover:bg-gray-100 flex items-center justify-center"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={users}
                      onChange={(e) => setUsers(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 text-center border rounded py-1 text-sm"
                    />
                    <button
                      onClick={() => setUsers((v) => v + 1)}
                      className="w-8 h-8 rounded border hover:bg-gray-100 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Almacenamiento (GB)</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStorageGB((v) => Math.max(10, v - 1))}
                      className="w-8 h-8 rounded border hover:bg-gray-100 flex items-center justify-center"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={10}
                      value={storageGB}
                      onChange={(e) => setStorageGB(Math.max(10, Number(e.target.value) || 10))}
                      className="w-16 text-center border rounded py-1 text-sm"
                    />
                    <button
                      onClick={() => setStorageGB((v) => v + 1)}
                      className="w-8 h-8 rounded border hover:bg-gray-100 flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Cerrar primera columna */}
          </div>

          {/* Resumen - Sticky en desktop */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 h-fit lg:sticky lg:top-4">
            <h3 className="text-lg font-bold mb-3">Resumen</h3>
            {(() => {
              const billableUsers = (totals as any).users.billableUsers as number;
              const perUserMonthly = (totals as any).users.perUserMonthly as number;
              // almacenamiento extra
              const extraGB = Math.max(storageGB - 10, 0);
              const storageMonthly = extraGB * 2000;
              const storageAnnualBefore = storageMonthly * 12;
              const storageAnnualAfter = Math.round(storageAnnualBefore * 0.75);
              // Construcción de líneas tipo factura (compacto)
              type Line = { concepto: string; total: number };
              let lines: Line[] = [];
              if (period === 'monthly') {
                lines.push({ concepto: 'Base de plataforma', total: (totals as any).baseMonthly });
                if (billableUsers > 0)
                  lines.push({
                    concepto: `Usuarios adicionales (${billableUsers} × ${numberFormat(
                      perUserMonthly,
                    )}/mes)`,
                    total: (totals as any).users.usersMonthly,
                  });
                // Módulos cobrables en mensual (agregado)
                const monthlyModules = MODULES.filter(
                  (m) =>
                    (selected as any).has(m.key) &&
                    !m.mandatory &&
                    !m.annualOnly &&
                    m.pricePerUser > 0,
                );
                const modulesMonthlyTotal = monthlyModules.reduce((s, m) => s + m.pricePerUser, 0);
                if (modulesMonthlyTotal > 0)
                  lines.push({
                    concepto: `Módulos adicionales (${monthlyModules.length})`,
                    total: modulesMonthlyTotal,
                  });
                if (storageMonthly > 0)
                  lines.push({
                    concepto: `Almacenamiento extra (${extraGB} GB × ${numberFormat(2000)}/mes)`,
                    total: storageMonthly,
                  });
                // Render tabla
                const subtotal = ((totals as any).subtotalMonthly as number) + storageMonthly;
                return (
                  <div>
                    <div className="overflow-auto max-h-80 rounded-md border border-gray-200">
                      <div className="grid grid-cols-2 bg-gray-50 text-[11px] font-semibold text-gray-600">
                        <div className="px-3 py-2">Concepto</div>
                        <div className="px-3 py-2 text-right">Total</div>
                      </div>
                      {lines
                        .filter((l) => l.total > 0)
                        .map((l, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-2 text-[13px] border-t border-gray-100"
                          >
                            <div className="px-3 py-1.5 truncate" title={l.concepto}>
                              {l.concepto}
                            </div>
                            <div className="px-3 py-1.5 text-right" title={numberFormat(l.total)}>
                              {numberFormat(l.total)}
                            </div>
                          </div>
                        ))}
                    </div>
                    {/* Toggler detalle módulos */}
                    {(() => {
                      const monthlyModules = MODULES.filter(
                        (m) =>
                          (selected as any).has(m.key) &&
                          !m.mandatory &&
                          !m.annualOnly &&
                          m.pricePerUser > 0,
                      );
                      if (monthlyModules.length === 0) return null;
                      return (
                        <div className="mt-2">
                          <button
                            className="text-[11px] text-primary hover:underline"
                            onClick={() => setShowModuleLines((v) => !v)}
                          >
                            {showModuleLines
                              ? 'Ocultar detalle de módulos'
                              : 'Ver detalle de módulos'}
                          </button>
                          {showModuleLines && (
                            <ul className="mt-1 space-y-0.5 pl-3">
                              {monthlyModules.map((m) => (
                                <li
                                  key={m.key}
                                  className="flex justify-between text-[12px] text-gray-600"
                                >
                                  <span className="truncate" title={m.name}>
                                    {m.name}
                                  </span>
                                  <span title={`${numberFormat(m.pricePerUser)}/mes`}>
                                    {numberFormat(m.pricePerUser)}/mes
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex justify-end mt-3">
                      <div className="w-full sm:w-1/2">
                        <div className="flex justify-between text-[13px]">
                          <span className="text-gray-600">Ahorro mensual total</span>
                          <span className="text-green-700">
                            -{numberFormat(ahorroMensualTotal)}
                          </span>
                        </div>
                        <div className="border-t my-2"></div>
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total mensual</span>
                          <span>{numberFormat(subtotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } else {
                // anual
                lines.push({
                  concepto: 'Base de plataforma (año)',
                  total: (totals as any).baseAnnual,
                });
                if (billableUsers > 0) {
                  const usersAnnualUnit = perUserMonthly * 12;
                  lines.push({
                    concepto: `Usuarios adicionales (año) (${billableUsers} × ${numberFormat(
                      usersAnnualUnit,
                    )})`,
                    total: (totals as any).users.usersAnnualTotal,
                  });
                }
                const annualModules = MODULES.filter(
                  (m) => (selected as any).has(m.key) && !m.mandatory,
                );
                const modulesAnnualTotal = annualModules.reduce(
                  (s, m) => s + (m.annualOnly ? m.annualPrice || 0 : m.pricePerUser * 12),
                  0,
                );
                const modulesAnnualCount = annualModules.filter(
                  (m) => (m.annualOnly ? m.annualPrice || 0 : m.pricePerUser * 12) > 0,
                ).length;
                if (modulesAnnualTotal > 0)
                  lines.push({
                    concepto: `Módulos adicionales (año) (${modulesAnnualCount})`,
                    total: modulesAnnualTotal,
                  });
                if (storageAnnualBefore > 0)
                  lines.push({
                    concepto: `Almacenamiento extra (año) (${extraGB} GB × ${numberFormat(
                      2000 * 12,
                    )})`,
                    total: storageAnnualBefore,
                  });
                const subtotalAnnualBefore =
                  (totals as any).baseAnnual +
                  (totals as any).modulesAnnual +
                  (totals as any).users.usersAnnualTotal +
                  storageAnnualBefore;
                const discount =
                  ((totals as any).discountAnnual as number) +
                  (storageAnnualBefore - storageAnnualAfter);
                const totalAnnual = ((totals as any).subtotalAnnual as number) + storageAnnualAfter;
                return (
                  <div>
                    <div className="overflow-auto max-h-80 rounded-md border border-gray-200">
                      <div className="grid grid-cols-2 bg-gray-50 text-[11px] font-semibold text-gray-600">
                        <div className="px-3 py-2">Concepto</div>
                        <div className="px-3 py-2 text-right">Total</div>
                      </div>
                      {lines
                        .filter((l) => l.total > 0)
                        .map((l, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-2 text-[13px] border-t border-gray-100"
                          >
                            <div className="px-3 py-1.5 truncate">{l.concepto}</div>
                            <div className="px-3 py-1.5 text-right">{numberFormat(l.total)}</div>
                          </div>
                        ))}
                    </div>
                    {/* Toggler detalle módulos */}
                    {(() => {
                      const annualModulesDetailed = MODULES.filter(
                        (m) => (selected as any).has(m.key) && !m.mandatory,
                      );
                      const detail = annualModulesDetailed
                        .map((m) => ({
                          name: m.name,
                          unit: m.annualOnly ? m.annualPrice || 0 : m.pricePerUser * 12,
                        }))
                        .filter((x) => x.unit > 0);
                      if (detail.length === 0) return null;
                      return (
                        <div className="mt-2">
                          <button
                            className="text-[11px] text-primary hover:underline"
                            onClick={() => setShowModuleLines((v) => !v)}
                          >
                            {showModuleLines
                              ? 'Ocultar detalle de módulos'
                              : 'Ver detalle de módulos'}
                          </button>
                          {showModuleLines && (
                            <ul className="mt-1 space-y-0.5 pl-3">
                              {detail.map((d) => (
                                <li
                                  key={d.name}
                                  className="flex justify-between text-[12px] text-gray-600"
                                >
                                  <span className="truncate" title={d.name}>
                                    {d.name}
                                  </span>
                                  <span title={`${numberFormat(d.unit)}/año`}>
                                    {numberFormat(d.unit)}/año
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })()}
                    <div className="flex justify-end mt-3">
                      <div className="w-full sm:w-1/2">
                        <div className="flex justify-between text-[13px] text-gray-600">
                          <span>Subtotal anual</span>
                          <span>{numberFormat(subtotalAnnualBefore)}</span>
                        </div>
                        <div className="flex justify-between text-[13px] text-green-700">
                          <span>Descuento 12%</span>
                          <span>-{numberFormat(discount)}</span>
                        </div>
                        <div className="border-t my-2"></div>
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Total anual</span>
                          <span>{numberFormat(totalAnnual)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            })()}

            {/* CTAs mejorados */}
            <div className="mt-6 space-y-3">
              <button
                onClick={() => {
                  const payload = {
                    users,
                    modules: Array.from(selected),
                    totals,
                    storageGB,
                    period,
                  };
                  localStorage.setItem('guro_pricing_selection', JSON.stringify(payload));
                  window.location.href = '/auth/register';
                }}
                className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-semibold flex items-center justify-center gap-2"
              >
                <Icon icon="solar:calendar-bold" />
                Solicitar demo gratuita
              </button>
              <button
                onClick={handleCheckout}
                className="w-full px-6 py-3 border-2 border-primary text-primary rounded-lg hover:bg-primary/5 transition font-semibold flex items-center justify-center gap-2"
              >
                <Icon icon="solar:cart-large-bold" />
                Comprar ahora
              </button>
            </div>

            {/* Acciones adicionales */}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button
                onClick={() => {
                  const payload = {
                    users,
                    modules: Array.from(selected),
                    totals,
                    storageGB,
                    period,
                  };
                  const json = JSON.stringify(payload, null, 2);
                  const blob = new Blob([json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `cotizacion-guro-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                }}
                className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                <Icon icon="solar:download-bold" />
                Guardar cotización
              </button>
              <button
                onClick={() => {
                  const payload = {
                    users,
                    modules: Array.from(selected),
                    totals,
                    storageGB,
                    period,
                  };
                  const url = `${window.location.origin}${window.location.pathname}?config=${btoa(
                    JSON.stringify(payload),
                  )}`;
                  navigator.clipboard.writeText(url);
                  alert('Link copiado al portapapeles');
                }}
                className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                <Icon icon="solar:share-bold" />
                Compartir
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                <Icon icon="solar:printer-bold" />
                Imprimir
              </button>
            </div>

            <p className="text-[10px] text-gray-500 mt-2">
              Precios en COP. Sujetos a ajuste. IVA no incluido.
            </p>
          </div>
          {/* Cerrar grid */}
        </div>
      </div>
      {/* Botón flotante resumen móvil */}
      <button
        onClick={() => setShowMobileSummary(true)}
        className="lg:hidden fixed bottom-4 right-4 z-50 px-6 py-3 bg-primary text-white rounded-full shadow-lg flex items-center gap-2 font-semibold"
      >
        <Icon icon="solar:calculator-bold" />
        Ver resumen
      </button>

      {/* Modal resumen móvil */}
      {showMobileSummary && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-50 flex items-end"
          onClick={() => setShowMobileSummary(false)}
        >
          <div
            className="bg-white rounded-t-2xl p-6 w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Resumen</h3>
              <button
                onClick={() => setShowMobileSummary(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <Icon icon="solar:close-circle-bold" className="text-2xl" />
              </button>
            </div>
            {/* Aquí iría el mismo contenido del resumen */}
            <p className="text-sm text-gray-600 mb-4">
              Total:{' '}
              {numberFormat(
                period === 'monthly'
                  ? (totals as any).subtotalMonthly + Math.max(storageGB - 10, 0) * 2000
                  : (totals as any).subtotalAnnual +
                      Math.round(Math.max(storageGB - 10, 0) * 2000 * 12 * 0.75),
              )}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowMobileSummary(false);
                  const payload = {
                    users,
                    modules: Array.from(selected),
                    totals,
                    storageGB,
                    period,
                  };
                  localStorage.setItem('guro_pricing_selection', JSON.stringify(payload));
                  window.location.href = '/auth/register';
                }}
                className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-semibold flex items-center justify-center gap-2"
              >
                <Icon icon="solar:calendar-bold" />
                Solicitar demo gratuita
              </button>
              <button
                onClick={() => {
                  setShowMobileSummary(false);
                  handleCheckout();
                }}
                className="w-full px-6 py-3 border-2 border-primary text-primary rounded-lg hover:bg-primary/5 transition font-semibold flex items-center justify-center gap-2"
              >
                <Icon icon="solar:cart-large-bold" />
                Comprar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bloques de comparación y modales removidos para simplificación */}
    </section>
  );
};

export default PricingCalculator;
