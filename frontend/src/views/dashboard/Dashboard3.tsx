 
 
 
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
import { Tooltip } from "flowbite-react";

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
        <Tooltip content="Filtrar por fecha" placement="bottom">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`h-10 w-10 hover:text-primary hover:bg-lightprimary dark:hover:bg-darkminisidebar dark:hover:text-primary focus:ring-0 rounded-full flex justify-center items-center cursor-pointer ${
              startDate || endDate ? 'text-primary bg-lightprimary' : 'text-darklink dark:text-white'
            }`}
          >
            <Icon icon="solar:calendar-linear" height={20} />
          </button>
        </Tooltip>
      </div>

      {/* Selector de fecha desplegable */}
      {showDatePicker && (
        <div className="mb-4 p-4 bg-white dark:bg-darkgray rounded-md shadow-md">
          <div className="flex flex-col gap-4">
            {/* Filtros rápidos */}
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-sm font-medium text-darklink dark:text-white mr-2">Filtros rápidos:</span>
              <button
                onClick={() => handleQuickFilter('today')}
                className="px-3 py-1 rounded-md text-sm transition-colors bg-muted dark:bg-dark text-ld hover:bg-lightprimary hover:text-primary"
              >
                Hoy
              </button>
              <button
                onClick={() => handleQuickFilter('week')}
                className="px-3 py-1 rounded-md text-sm transition-colors bg-muted dark:bg-dark text-ld hover:bg-lightprimary hover:text-primary"
              >
                Última Semana
              </button>
              <button
                onClick={() => handleQuickFilter('month')}
                className="px-3 py-1 rounded-md text-sm transition-colors bg-muted dark:bg-dark text-ld hover:bg-lightprimary hover:text-primary"
              >
                Último Mes
              </button>
              <button
                onClick={() => handleQuickFilter('year')}
                className="px-3 py-1 rounded-md text-sm transition-colors bg-muted dark:bg-dark text-ld hover:bg-lightprimary hover:text-primary"
              >
                Último Año
              </button>
            </div>

            {/* Selector de rango personalizado */}
            <div className="flex gap-4 items-center flex-wrap">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-darklink dark:text-white">Fecha inicio:</label>
                <input
                  type="date"
                  value={startDate || ''}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 rounded-md text-sm border border-border dark:border-darkborder bg-white dark:bg-dark text-darklink dark:text-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-darklink dark:text-white">Fecha fin:</label>
                <input
                  type="date"
                  value={endDate || ''}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 rounded-md text-sm border border-border dark:border-darkborder bg-white dark:bg-dark text-darklink dark:text-white"
                />
              </div>
              <button
                onClick={clearFilter}
                className="px-4 py-2 rounded-md text-sm transition-colors bg-error text-white hover:bg-red-700 mt-auto"
              >
                Limpiar Filtro
              </button>
            </div>

            {/* Indicador de filtro activo */}
            {(startDate || endDate) && (
              <div className="text-sm text-primary font-medium">
                Filtrando datos {startDate && `desde ${startDate}`} {endDate && `hasta ${endDate}`}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-12 gap-30">
        {/* Primera fila: Métricas principales */}
        <div className="col-span-12">
          <ColorBoxes startDate={startDate} endDate={endDate} />
        </div>
        
        {/* Segunda fila: Primas por Mes y Análisis IA (misma altura) */}
        <div className="lg:col-span-8 col-span-12 flex">
          <div className="w-full">
            <RevenueForcastChart startDate={startDate} endDate={endDate} />
          </div>
        </div>
        <div className="lg:col-span-4 col-span-12 flex">
          <div className="w-full">
            <AnnualProfit startDate={startDate} endDate={endDate} />
          </div>
        </div>

        
        
        {/* Tercera fila: Rendimiento de Pólizas y gráficos de clientes/ventas */}
        <div className="lg:col-span-5 col-span-12 flex">
          <div className="w-full">
            <YourPerformance startDate={startDate} endDate={endDate} />
          </div>
        </div>
        <div className="lg:col-span-7 col-span-12">
          <div className="grid grid-cols-12 gap-30 h-full">
            <div className="md:col-span-6 col-span-12 flex">
              <div className="w-full">
                <CustomerChart startDate={startDate} endDate={endDate} />
              </div>
            </div>
            <div className="md:col-span-6 col-span-12 flex">
              <div className="w-full">
                <SalesOverview startDate={startDate} endDate={endDate} />
              </div>
            </div>
          </div>
        </div>
        
        {/* Cuarta fila eliminada: Rendimiento por Tipo de Seguro y Siniestros Procesados */}
      </div>
    </>
  );
};

export default Dashboard3;