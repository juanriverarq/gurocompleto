 
 
 
import { useState } from "react";
import { Icon } from "@iconify/react";
import CustomerChart from "src/components/dashboards/Dashboard1/CustomerChart";
import SalesOverview from "src/components/dashboards/Dashboard1/SalesOverview";
import YourPerformance from "src/components/dashboards/Dashboard1/YourPerformance";
import AnnualProfit from "src/components/dashboards/Dashboard2/AnnualProfit";
import RevenueForcastChart from "src/components/dashboards/Dashboard2/RevenueForcastChart";
import ColorBoxes from "src/components/dashboards/dashboard3/ColorBoxes";
import EmailVerificationBanner from "src/components/EmailVerificationBanner";
import { usePageMeta } from "src/hooks/usePageMeta";
import { getPageMetadata } from "src/config/pageMetadata";
// Tooltip removed — using custom UI

const Dashboard3 = () => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Configurar metadatos de la página
  const metadata = getPageMetadata('dashboard3');
  usePageMeta(metadata);

  const handleQuickFilter = (filter: 'today' | 'week' | 'month' | 'year') => {
    const today = new Date();
    let start = new Date();
    
    switch (filter) {
      case 'today':
        start = new Date(today);
        break;
      case 'week':
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        break;
      case 'month':
        start = new Date(today);
        start.setMonth(today.getMonth() - 1);
        break;
      case 'year':
        start = new Date(today);
        start.setFullYear(today.getFullYear() - 1);
        break;
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  };

  const clearFilter = () => {
    setStartDate(null);
    setEndDate(null);
  };

  return (
    <>
      {/* Banner de verificación de email */}
      <EmailVerificationBanner />
      
      {/* Barra de herramientas del dashboard */}
      <div className="flex justify-end items-center gap-2 mb-4">
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className={`h-9 px-3 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
            startDate || endDate
              ? 'bg-[#573CFF]/10 text-[#573CFF]'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Icon icon="solar:calendar-linear" height={16} />
          <span className="hidden sm:inline">{startDate || endDate ? 'Filtro activo' : 'Filtrar'}</span>
        </button>
      </div>

      {/* Selector de fecha desplegable */}
      {showDatePicker && (
        <div className="mb-4 p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex flex-col gap-4">
            {/* Filtros rápidos */}
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-xs font-bold text-[#0d0d0d] dark:text-white uppercase tracking-wider mr-1">Rápido:</span>
              {[
                { label: 'Hoy', filter: 'today' as const },
                { label: 'Semana', filter: 'week' as const },
                { label: 'Mes', filter: 'month' as const },
                { label: 'Año', filter: 'year' as const },
              ].map(({ label, filter }) => (
                <button
                  key={filter}
                  onClick={() => handleQuickFilter(filter)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-[#f5f5f5] dark:bg-gray-700 text-gray-500 hover:bg-[#573CFF]/10 hover:text-[#573CFF]"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Selector de rango personalizado */}
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#0d0d0d] dark:text-white">Desde</label>
                <input
                  type="date"
                  value={startDate || ''}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-600 bg-[#fafafa] dark:bg-gray-700 text-[#0d0d0d] dark:text-white focus:border-[#573CFF] focus:ring-1 focus:ring-[#573CFF]/20 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#0d0d0d] dark:text-white">Hasta</label>
                <input
                  type="date"
                  value={endDate || ''}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-600 bg-[#fafafa] dark:bg-gray-700 text-[#0d0d0d] dark:text-white focus:border-[#573CFF] focus:ring-1 focus:ring-[#573CFF]/20 outline-none"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={clearFilter}
                  className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Indicador de filtro activo */}
            {(startDate || endDate) && (
              <div className="text-xs text-[#573CFF] font-medium">
                Filtrando datos {startDate && `desde ${startDate}`} {endDate && `hasta ${endDate}`}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-12 gap-5">
        {/* Primera fila: Métricas principales */}
        <div className="col-span-12">
          <ColorBoxes startDate={startDate} endDate={endDate} />
        </div>
        
        {/* Segunda fila: Primas por Mes y Análisis IA (misma altura) */}
        <div className="lg:col-span-8 col-span-12">
          <div className="w-full h-full [&>.card]:h-full [&>.card]:flex [&>.card]:flex-col">
            <RevenueForcastChart startDate={startDate} endDate={endDate} />
          </div>
        </div>
        <div className="lg:col-span-4 col-span-12">
          <div className="w-full h-full [&>.card]:h-full [&>.card]:flex [&>.card]:flex-col">
            <AnnualProfit startDate={startDate} endDate={endDate} />
          </div>
        </div>
        
        {/* Tercera fila: Rendimiento de Pólizas y gráficos de clientes/ventas */}
        <div className="lg:col-span-5 col-span-12">
          <div className="w-full h-full [&>.card]:h-full [&>.card]:flex [&>.card]:flex-col">
            <YourPerformance startDate={startDate} endDate={endDate} />
          </div>
        </div>
        <div className="lg:col-span-7 col-span-12">
          <div className="grid grid-cols-12 gap-5 h-full">
            <div className="md:col-span-6 col-span-12">
              <div className="w-full h-full [&>.card]:h-full [&>.card]:flex [&>.card]:flex-col">
                <CustomerChart startDate={startDate} endDate={endDate} />
              </div>
            </div>
            <div className="md:col-span-6 col-span-12">
              <div className="w-full h-full [&>.card]:h-full [&>.card]:flex [&>.card]:flex-col">
                <SalesOverview startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard3;