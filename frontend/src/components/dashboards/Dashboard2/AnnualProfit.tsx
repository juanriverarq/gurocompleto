
import CardBox from "../../shared/CardBox";
import Chart from 'react-apexcharts';
import { useDashboardData } from "../../../hooks/useDashboardData";

const AnnualProfit = () => {
  const { data, loading, error } = useDashboardData();

  const getAnalysisData = () => {
    if (!data) {
      return {
        tasaRenovacion: 92.3,
        ventasCruzadas: 12,
        ventasCruzadasValor: 45200,
        procesamientoAuto: 95.8,
        documentosProcessados: 247,
        alertasActivas: 12,
        ahorroPreventivo: 115400,
        chartData: [85, 92, 78, 95, 88, 92, 90]
      };
    }

    // Calcular métricas basadas en datos reales
    const totalPolizas = data.resumen_polizas.total;
    const polizasActivas = data.resumen_polizas.activas;
    const polizasPorVencer = data.resumen_polizas.por_vencer;
    const siniestrosPendientes = data.siniestros.pendientes;
    const tareasActivas = data.tareas_comerciales.activas;

    // Calcular tasa de renovación basada en pólizas activas
    const tasaRenovacion = totalPolizas > 0 ? (polizasActivas / totalPolizas) * 100 : 0;

    // Simular datos de IA basados en información real
    const ventasCruzadas = Math.round(polizasActivas * 0.15); // 15% de pólizas activas como oportunidades
    const ventasCruzadasValor = Math.round(parseFloat(data.finanzas.comision_numero) * 0.25); // 25% de comisiones
    
    const procesamientoAuto = Math.min(98.5, 85 + (polizasActivas / totalPolizas) * 15); // Basado en eficiencia
    const documentosProcessados = totalPolizas * 3; // ~3 documentos por póliza
    
    const alertasActivas = polizasPorVencer + siniestrosPendientes; // Alertas reales
    const ahorroPreventivo = Math.round(parseFloat(data.finanzas.valor_primas_numero) * 0.05); // 5% de ahorro

    // Datos del gráfico simulando tendencia
    const chartData = [
      Math.round(tasaRenovacion * 0.9),
      Math.round(tasaRenovacion * 0.95),
      Math.round(tasaRenovacion * 0.85),
      Math.round(tasaRenovacion * 1.02),
      Math.round(tasaRenovacion * 0.97),
      Math.round(tasaRenovacion),
      Math.round(tasaRenovacion * 1.01)
    ];

    return {
      tasaRenovacion: Number(tasaRenovacion.toFixed(1)),
      ventasCruzadas,
      ventasCruzadasValor,
      procesamientoAuto: Number(procesamientoAuto.toFixed(1)),
      documentosProcessados,
      alertasActivas,
      ahorroPreventivo,
      chartData
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

  return (
    <>
      <CardBox>
        <div>
          <h5 className="card-title">Análisis IA</h5>
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
                ${(analysisData.ventasCruzadasValor / 1000).toFixed(0)}K
              </h6>
              <span className="text-13 text-success font-medium">+{data?.clientes.porcentaje_crecimiento || 25}%</span>
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
              <span className="text-13 text-success font-medium">+2.3%</span>
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
                ${(analysisData.ahorroPreventivo / 1000).toFixed(0)}K
              </h6>
              <span className="text-13 text-success font-medium">+15.2%</span>
            </div>
          </div>
        </div>
      </CardBox>
    </>
  );
};

export default AnnualProfit;

