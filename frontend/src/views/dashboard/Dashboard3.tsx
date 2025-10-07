 
 
 
import CustomerChart from "src/components/dashboards/Dashboard1/CustomerChart";
import SalesOverview from "src/components/dashboards/Dashboard1/SalesOverview";
import YourPerformance from "src/components/dashboards/Dashboard1/YourPerformance";
import AnnualProfit from "src/components/dashboards/Dashboard2/AnnualProfit";
import RevenueForcastChart from "src/components/dashboards/Dashboard2/RevenueForcastChart";
import ColorBoxes from "src/components/dashboards/dashboard3/ColorBoxes";
import EmailVerificationBanner from "src/components/EmailVerificationBanner";
import { usePageMeta } from "src/hooks/usePageMeta";
import { getPageMetadata } from "src/config/pageMetadata";

const Dashboard3 = () => {

  // Configurar metadatos de la página
  const metadata = getPageMetadata('dashboard3');
  usePageMeta(metadata);

  

  return (
    <>
      {/* Banner de verificación de email */}
      <EmailVerificationBanner />
      
      <div className="grid grid-cols-12 gap-30">
        {/* Primera fila: Métricas principales */}
        <div className="col-span-12">
          <ColorBoxes />
        </div>
        
        {/* Segunda fila: Primas por Mes y Análisis IA (misma altura) */}
        <div className="lg:col-span-8 col-span-12 flex">
          <div className="w-full">
            <RevenueForcastChart />
          </div>
        </div>
        <div className="lg:col-span-4 col-span-12 flex">
          <div className="w-full">
            <AnnualProfit />
          </div>
        </div>

        
        
        {/* Tercera fila: Rendimiento de Pólizas y gráficos de clientes/ventas */}
        <div className="lg:col-span-5 col-span-12 flex">
          <div className="w-full">
            <YourPerformance />
          </div>
        </div>
        <div className="lg:col-span-7 col-span-12">
          <div className="grid grid-cols-12 gap-30 h-full">
            <div className="md:col-span-6 col-span-12 flex">
              <div className="w-full">
                <CustomerChart />
              </div>
            </div>
            <div className="md:col-span-6 col-span-12 flex">
              <div className="w-full">
                <SalesOverview />
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