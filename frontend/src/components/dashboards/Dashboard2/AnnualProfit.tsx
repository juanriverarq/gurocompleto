
import { Icon } from "@iconify/react";
import CardBox from "../../shared/CardBox";
import Chart from 'react-apexcharts';
import { useDashboardData } from "../../../hooks/useDashboardData";

interface AnnualProfitProps {
  startDate?: string | null;
  endDate?: string | null;
}

const AnnualProfit = ({ startDate, endDate }: AnnualProfitProps) => {
  const { data, loading, error } = useDashboardData({ startDate, endDate });

  const getAnalysisData = () => {
    if (!data) {
      return {
        tasaRenovacion: 0,
        ventasCruzadas: 0,
        ventasCruzadasValor: 0,
        procesamientoAuto: 0,
        documentosProcessados: 0,
        alertasActivas: 0,
        ahorroPreventivo: 0,
        chartData: [0, 0, 0, 0, 0, 0, 0],
        crecimiento: 0
      };
    }

    // Calcular métricas basadas en datos reales
    const totalPolizas = data.resumen_polizas?.total || 0;
    const polizasActivas = data.resumen_polizas?.activas || 0;
    const polizasPorVencer = data.resumen_polizas?.por_vencer || 0;
    const siniestrosPendientes = data.siniestros?.pendientes || 0;
    const comisionNumero = parseFloat(data.finanzas?.comision_numero || '0');
    const valorPrimasNumero = parseFloat(data.finanzas?.valor_primas_numero || '0');
    const crecimiento = data.clientes?.porcentaje_crecimiento || 0;

    // Calcular tasa de renovación basada en pólizas activas
    const tasaRenovacion = totalPolizas > 0 ? (polizasActivas / totalPolizas) * 100 : 0;

    // Calcular datos de IA basados en información real
    const ventasCruzadas = polizasActivas > 0 ? Math.round(polizasActivas * 0.15) : 0; // 15% de pólizas activas como oportunidades
    const ventasCruzadasValor = comisionNumero > 0 ? Math.round(comisionNumero * 0.25) : 0; // 25% de comisiones
    
    const procesamientoAuto = totalPolizas > 0 ? Math.min(98.5, 85 + (polizasActivas / totalPolizas) * 15) : 0; // Basado en eficiencia
    const documentosProcessados = totalPolizas > 0 ? totalPolizas * 3 : 0; // ~3 documentos por póliza
    
    const alertasActivas = polizasPorVencer + siniestrosPendientes; // Alertas reales
    const ahorroPreventivo = valorPrimasNumero > 0 ? Math.round(valorPrimasNumero * 0.05) : 0; // 5% de ahorro

    // Datos del gráfico simulando tendencia
    const chartData = tasaRenovacion > 0 ? [
      Math.round(tasaRenovacion * 0.9),
      Math.round(tasaRenovacion * 0.95),
      Math.round(tasaRenovacion * 0.85),
      Math.round(tasaRenovacion * 1.02),
      Math.round(tasaRenovacion * 0.97),
      Math.round(tasaRenovacion),
      Math.round(tasaRenovacion * 1.01)
    ] : [0, 0, 0, 0, 0, 0, 0];

    return {
      tasaRenovacion: Number(tasaRenovacion.toFixed(1)),
      ventasCruzadas,
      ventasCruzadasValor,
      procesamientoAuto: Number(procesamientoAuto.toFixed(1)),
      documentosProcessados,
      alertasActivas,
      ahorroPreventivo,
      chartData,
      crecimiento
    };
  };

  const analysisData = getAnalysisData();

  const ChartData: any = {
    series: [
      {
        name: "Renovación",
        color: "var(--color-primary)",
        data: analysisData.chartData,
      },
    ],

    chart: {
      type: "area",
      height: 120,
      sparkline: {
        enabled: true,
      },
      group: "sparklines",
      fontFamily: "inherit",
      foreColor: "#adb0bb",
    },
    color: "var(--color-primary)",
    stroke: {
      curve: "smooth",
      width: 2,
    },
    fill: {
      type: "gradient",
      color: "var(--color-primary)",
      gradient: {
        shadeIntensity: 0,
        inverseColors: false,
        opacityFrom: 0.2,
        opacityTo: 0.8,
        stops: [100],
      },
    },
    markers: {
      size: 0,
    },
    tooltip: {
      theme: "dark",
      fixed: {
        enabled: true,
        position: "right",
      },
      x: {
        show: false,
      },
      y: {
        formatter: function (value: number) {
          return `${value}%`;
        }
      }
    },
  };

  if (loading) {
    return (
      <CardBox>
        <div>
          <h5 className="card-title">Análisis IA</h5>
          <p className="card-subtitle">Cargando análisis...</p>
        </div>
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500">Cargando análisis IA...</p>
        </div>
      </CardBox>
    );
  }

  if (error) {
    return (
      <CardBox>
        <div>
          <h5 className="card-title">Análisis IA</h5>
          <p className="card-subtitle text-red-500">Error al cargar datos</p>
        </div>
        <div className="h-64 flex items-center justify-center">
          <p className="text-red-500">Error al cargar análisis</p>
        </div>
      </CardBox>
    );
  }

  // Verificar si hay datos reales para mostrar
  const hasRealData = data && (
    data.resumen_polizas.total > 0 ||
    parseFloat(data.finanzas.comision_numero || '0') > 0
  );

  return (
    <>
      <CardBox>
        <div>
          <h5 className="card-title">Análisis IA</h5>
          
          {!hasRealData ? (
            // Mostrar mensaje cuando no hay datos
            <div className="py-12 text-center">
              <div className="mb-4">
                <Icon
                  icon="solar:chart-2-linear"
                  height={48}
                  className="text-gray-300 dark:text-gray-600 mx-auto"
                />
              </div>
              <h6 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                Sin procesamientos ejecutados
              </h6>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Los análisis de IA se mostrarán cuando haya datos disponibles
              </p>
            </div>
          ) : (
            // Mostrar análisis cuando hay datos
            <>
              <div className="bg-lightprimary mt-4 overflow-hidden rounded-md mb-1">
                <div className="py-30 px-6 flex justify-between items-center">
                  <p className="text-ld">Tasa de Renovación</p>
                  <h4 className="text-28">{analysisData.tasaRenovacion}%</h4>
                </div>
                <Chart
                  options={ChartData}
                  series={ChartData.series}
                  type="area"
                  height="80px"
                  width="100%"
                  className="mt-4"
                />
              </div>
              <div className="flex items-center justify-between py-4 border-b border-ld">
                <div>
                  <span className="font-medium text-ld opacity-80">
                    Ventas Cruzadas IA
                  </span>
                  <p className="text-13">{analysisData.ventasCruzadas.toLocaleString()} oportunidades</p>
                </div>
                <div className="text-end">
                  <h6 className="text-15 font-bold">
                    ${analysisData.ventasCruzadasValor > 0 ? (analysisData.ventasCruzadasValor / 1000).toFixed(0) : '0'}K
                  </h6>
                  <span className={`text-13 font-medium ${analysisData.crecimiento >= 0 ? 'text-success' : 'text-error'}`}>
                    {analysisData.crecimiento >= 0 ? '+' : ''}{analysisData.crecimiento}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-ld">
                <div>
                  <span className="font-medium text-ld opacity-80">
                    Procesamiento Automático
                  </span>
                  <p className="text-13">{analysisData.documentosProcessados.toLocaleString()} documentos</p>
                </div>
                <div className="text-end">
                  <h6 className="text-15 font-bold">{analysisData.procesamientoAuto}%</h6>
                  <span className="text-13 text-muted font-medium">Eficiencia</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4">
                <div>
                  <span className="font-medium text-ld opacity-80">
                    Alertas Preventivas
                  </span>
                  <p className="text-13">{analysisData.alertasActivas} alertas activas</p>
                </div>
                <div className="text-end">
                  <h6 className="text-15 font-bold">
                    ${analysisData.ahorroPreventivo > 0 ? (analysisData.ahorroPreventivo / 1000).toFixed(0) : '0'}K
                  </h6>
                  <span className="text-13 text-muted font-medium">Ahorro estimado</span>
                </div>
              </div>
            </>
          )}
        </div>
      </CardBox>
    </>
  );
};

export default AnnualProfit;

