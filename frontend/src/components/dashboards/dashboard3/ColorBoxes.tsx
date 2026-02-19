import { Icon } from "@iconify/react";
import { Link } from "react-router";
import { useDashboardData } from "../../../hooks/useDashboardData";

interface ColorBoxesProps {
  startDate?: string | null;
  endDate?: string | null;
}

const CARD_STYLES: Record<string, { iconBg: string; iconColor: string; accent: string; valueColor: string }> = {
  polizas:     { iconBg: 'bg-[#573CFF]/10 dark:bg-[#573CFF]/20', iconColor: 'text-[#573CFF]', accent: 'hover:border-[#573CFF]/30', valueColor: 'text-[#573CFF]' },
  siniestros:  { iconBg: 'bg-amber-500/10 dark:bg-amber-500/20', iconColor: 'text-amber-500', accent: 'hover:border-amber-500/30', valueColor: 'text-amber-600 dark:text-amber-400' },
  clientes:    { iconBg: 'bg-[#573CFF]/10 dark:bg-[#573CFF]/20', iconColor: 'text-[#573CFF]', accent: 'hover:border-[#573CFF]/30', valueColor: 'text-[#573CFF]' },
  vencer:      { iconBg: 'bg-rose-500/10 dark:bg-rose-500/20',   iconColor: 'text-rose-500',  accent: 'hover:border-rose-500/30', valueColor: 'text-rose-600 dark:text-rose-400' },
  primas:      { iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20', iconColor: 'text-emerald-500', accent: 'hover:border-emerald-500/30', valueColor: 'text-emerald-600 dark:text-emerald-400' },
  comisiones:  { iconBg: 'bg-violet-500/10 dark:bg-violet-500/20', iconColor: 'text-violet-500', accent: 'hover:border-violet-500/30', valueColor: 'text-violet-600 dark:text-violet-400' },
};

const ColorBoxes = ({ startDate, endDate }: ColorBoxesProps) => {
  const { data, loading, error } = useDashboardData({ startDate, endDate });

  const formatMoney = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  const primasCobradas = data?.recaudos?.primas_cobradas || 0;
  const comisionesCobradas = data?.recaudos?.comisiones_cobradas || 0;
  const comisionesPendientes = data?.recaudos?.comisiones_pendientes || 0;

  const cards = [
    {
      id: 'polizas',
      icon: 'solar:shield-check-bold-duotone',
      title: 'Pólizas Activas',
      value: data ? data.resumen_polizas.activas.toLocaleString() : '—',
      link: '/apps/seguros/polizas',
    },
    {
      id: 'siniestros',
      icon: 'solar:document-text-bold-duotone',
      title: 'Siniestros Pendientes',
      value: data ? data.siniestros.pendientes.toLocaleString() : '—',
      link: '/apps/seguros/siniestros',
    },
    {
      id: 'clientes',
      icon: 'solar:users-group-rounded-bold-duotone',
      title: 'Clientes Activos',
      value: data ? data.clientes.activos.toLocaleString() : '—',
      link: '/apps/seguros/clientes',
    },
    {
      id: 'vencer',
      icon: 'solar:danger-triangle-bold-duotone',
      title: 'Por Vencer',
      value: data ? data.resumen_polizas.por_vencer.toLocaleString() : '—',
      link: '/apps/seguros/renovaciones',
    },
    {
      id: 'primas',
      icon: 'solar:dollar-minimalistic-bold-duotone',
      title: 'Primas Cobradas',
      value: data ? formatMoney(primasCobradas) : '—',
      subtitle: data ? `${data.recaudos?.polizas_recaudadas || 0} pólizas` : '',
      link: '/apps/cartera/clientes',
    },
    {
      id: 'comisiones',
      icon: 'solar:wallet-money-bold-duotone',
      title: 'Comisiones Cobradas',
      value: data ? formatMoney(comisionesCobradas) : '—',
      subtitle: data ? `Pendiente: ${formatMoney(comisionesPendientes)}` : '',
      link: '/apps/cartera/clientes',
    },
  ];

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-50 flex items-center justify-center">
          <Icon icon="solar:danger-triangle-bold" className="text-red-500 text-xl" />
        </div>
        <p className="text-sm font-semibold text-[#0d0d0d] dark:text-white">Error al cargar datos</p>
        <p className="text-xs text-gray-400 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => {
        const style = CARD_STYLES[card.id];
        return (
          <Link
            key={card.id}
            to={card.link}
            className={`group bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 transition-all duration-200 hover:shadow-md dark:hover:shadow-none ${style.accent}`}
          >
            {/* Icon */}
            <div className={`w-11 h-11 rounded-xl ${style.iconBg} flex items-center justify-center mb-4`}>
              <Icon icon={card.icon} className={`text-xl ${style.iconColor}`} />
            </div>

            {/* Title */}
            <p className="text-xs font-medium text-gray-400 mb-1">{card.title}</p>

            {/* Value */}
            <h3 className={`text-xl font-bold tracking-[-0.02em] ${style.valueColor}`}>
              {loading ? (
                <span className="inline-block w-16 h-6 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
              ) : (
                card.value
              )}
            </h3>

            {/* Subtitle */}
            {card.subtitle && (
              <p className="text-[11px] text-gray-400 mt-1">{card.subtitle}</p>
            )}

            {/* Arrow */}
            <div className="mt-3 flex items-center gap-1 text-gray-300 group-hover:text-[#573CFF] transition-colors">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Ver</span>
              <Icon icon="solar:arrow-right-linear" className="text-xs" />
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default ColorBoxes;
