import CardBox from "../../shared/CardBox";
import { Icon } from "@iconify/react";
import Chart from 'react-apexcharts';
import { useDashboardData } from "../../../hooks/useDashboardData";

interface YourPerformanceProps {
  startDate?: string | null;
  endDate?: string | null;
}

const YourPerformance = ({ startDate, endDate }: YourPerformanceProps) => {
  const { data, loading, error } = useDashboardData({ startDate, endDate });

  const getPerformanceData = () => {
    if (!data) {
      return {
        activas: 45,
        porVencer: 12,
        nuevasDelMes: 58,
        total: 58,
        series: [45, 12, 8, 5, 1],
        labels: ["Activas", "Por vencer", "Vencidas", "Canceladas", "Pendientes"]
      };
    }

    const activas = data.resumen_polizas.activas;
    const porVencer = data.resumen_polizas.por_vencer;
    const vencidas = data.resumen_polizas.vencidas;
    const total = data.resumen_polizas.total;
    const nuevasDelMes = data.ventas.del_mes;

    // Calcular otras categorías (estimadas)
    const canceladas = Math.max(0, total - activas - porVencer - vencidas);
    const pendientes = Math.max(0, 2); // Valor estimado

    return {
      activas,
      porVencer,
      nuevasDelMes,
      total,
      series: [activas, porVencer, vencidas, canceladas, pendientes],
      labels: ["Activas", "Por vencer", "Vencidas", "Canceladas", "Pendientes"]
    };
  };

  const performanceData = getPerformanceData();

  const ChartData: any = {
    series: performanceData.series,
    labels: performanceData.labels,
    chart: {
      height: 200,
      fontFamily: "inherit",
      type: "donut",
    },
    plotOptions: {
      pie: {
        startAngle: -90,
        endAngle: 90,
        offsetY: 10,
        donut: {
          size: "90%",
        },
      },
    },
    grid: {
      padding: {
        bottom: -80,
      },
    },
    legend: {
      show: false,
    },
    dataLabels: {
      enabled: false,
      name: {
        show: false,
      },
    },
    stroke: {
      width: 2,
      colors: "var(--color-surface-ld)",
    },
    tooltip: {
      fillSeriesColor: false,
      y: {
        formatter: function (value: number) {
          return `${value} pólizas`;
        }
      }
    },
    colors: [
      "var(--color-primary)",    // Activas - azul
      "var(--color-warning)",    // Por vencer - amarillo
      "var(--color-error)",      // Vencidas - rojo
      "var(--color-secondary)",  // Canceladas - púrpura
      "var(--color-muted)",      // Pendientes - gris
    ],
  };

  if (loading) {
    return (
      <CardBox>
        <div>
          <h5 className="card-title">Rendimiento de Pólizas</h5>
          <p className="card-subtitle">Cargando datos...</p>
        </div>
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500">Cargando rendimiento...</p>
        </div>
      </CardBox>
    );
  }

  if (error) {
    return (
      <CardBox>
        <div>
          <h5 className="card-title">Rendimiento de Pólizas</h5>
          <p className="card-subtitle text-red-500">Error al cargar datos</p>
        </div>
        <div className="h-64 flex items-center justify-center">
          <p className="text-red-500">Error al cargar rendimiento</p>
        </div>
      </CardBox>
    );
  }

  return (
    <>
      <CardBox>
        <div>
          <h5 className="card-title">Rendimiento de Pólizas</h5>
          <p className="card-subtitle">
            Estado actual de tus pólizas
          </p>
        </div>
        <div className="grid grid-cols-12 mt-6">
          <div className="md:col-span-6 col-span-12">
            <div className="flex flex-col gap-5">
              <div className="flex gap-4 items-center">
                <span className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-lightprimary rounded-tw">
                  <Icon
                    icon="solar:shield-check-linear"
                    className="text-primary"
                    height={20}
                  />
                </span>
                <div>
                  <h5 className="text-15">{performanceData.activas.toLocaleString()} pólizas</h5>
                  <p className="text-sm">Activas</p>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex gap-4 items-center">
                  <span className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-lightwarning rounded-tw">
                    <Icon
                      icon="solar:clock-circle-linear"
                      className="text-warning"
                      height={20}
                    />
                  </span>
                  <div>
                    <h5 className="text-15">{performanceData.porVencer.toLocaleString()} pólizas</h5>
                    <p className="text-sm">Por vencer (30 días)</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex gap-4 items-center">
                  <span className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-lightsuccess rounded-tw">
                    <Icon
                      icon="solar:document-add-linear"
                      className="text-success"
                      height={20}
                    />
                  </span>
                  <div>
                    <h5 className="text-15">{performanceData.nuevasDelMes.toLocaleString()} pólizas</h5>
                    <p className="text-sm">Nuevas este mes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="md:col-span-6 col-span-12 md:-mt-8 mt-4">
            <Chart
              options={ChartData}
              series={ChartData.series}
              type="donut"
              height="200px"
              width="100%"
            />
            <h4 className="text-center text-3xl md:mt-3">{performanceData.total.toLocaleString()}</h4>
            <p className="text-sm text-center mt-3">
              Total de pólizas gestionadas con Guro IA
            </p>
          </div>
        </div>
        
        {/* Leyenda detallada */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          {performanceData.labels.map((label, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ 
                  backgroundColor: ChartData.colors[index]?.replace('var(--color-', '').includes('primary') ? 'var(--color-primary)' :
                                 ChartData.colors[index]?.replace('var(--color-', '').includes('warning') ? 'var(--color-warning)' :
                                 ChartData.colors[index]?.replace('var(--color-', '').includes('error') ? 'var(--color-error)' :
                                 ChartData.colors[index]?.replace('var(--color-', '').includes('secondary') ? 'var(--color-secondary)' :
                                 'var(--color-muted)'
                }}
              ></div>
              <span className="text-gray-600">
                {label}: {performanceData.series[index]}
              </span>
            </div>
          ))}
        </div>
      </CardBox>
    </>
  );
};

export default YourPerformance;
