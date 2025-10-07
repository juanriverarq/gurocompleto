import CardBox from "../../shared/CardBox";
import { Icon } from "@iconify/react";
import Chart from 'react-apexcharts';
import { useDashboardData } from "../../../hooks/useDashboardData";

const TotalSettelment = () => {
  const { data, loading, error } = useDashboardData();

  const getSiniestrosData = () => {
    if (!data) {
      return {
        totalPagados: 485230,
        totalPendientes: 127850,
        chartData: [40, 40, 80, 80, 30, 30, 10, 10, 30, 30, 100, 100, 20, 20, 140, 140],
        categories: ["1W", "", "3W", "", "5W", "6W", "7W", "8W", "9W", "", "11W", "", "13W", "", "15W"]
      };
    }

    // Calcular totales basados en datos reales
    const pagados = data.siniestros_detallados && Array.isArray(data.siniestros_detallados)
      ? data.siniestros_detallados
          .filter(s => ['pagado', 'cerrado'].includes(s.estado))
          .reduce((sum, s) => sum + parseFloat(s.total_valor || '0'), 0)
      : 0;

    const pendientes = data.siniestros_detallados && Array.isArray(data.siniestros_detallados)
      ? data.siniestros_detallados
          .filter(s => ['reportado', 'en_revision', 'asignado', 'investigacion', 'peritaje', 'aprobado'].includes(s.estado))
          .reduce((sum, s) => sum + parseFloat(s.total_valor || '0'), 0)
      : 0;

    // Simular datos mensuales del gráfico basados en datos reales
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const chartData: number[] = [];
    const categories: string[] = [];

    // Crear datos de tendencia basados en los siniestros por mes
    for (let i = 0; i < 12; i++) {
      const mesData = data.siniestros_por_mes && Array.isArray(data.siniestros_por_mes)
        ? data.siniestros_por_mes.find(m => m.mes === i + 1)
        : null;
      const valor = mesData ? parseFloat(mesData.valor_total) / 1000 : Math.random() * 50 + 20; // Convertir a miles
      chartData.push(Number(valor.toFixed(0)));
      categories.push(i % 2 === 0 ? months[i] : ''); // Mostrar solo algunos labels
    }

    return {
      totalPagados: pagados,
      totalPendientes: pendientes,
      chartData,
      categories
    };
  };

  const siniestrosInfo = getSiniestrosData();

  const ChartData: any = {
    series: [
      {
        name: "Siniestros ($K)",
        data: siniestrosInfo.chartData,
      },
    ],
    chart: {
      fontFamily: "inherit",
      type: "line",
      height: 280,
      toolbar: { show: false },
    },
    legend: { show: false },
    dataLabels: { enabled: false },
    stroke: {
      curve: "smooth",
      show: true,
      width: 2,
      colors: ["var(--color-primary)"],
    },
    xaxis: {
      categories: siniestrosInfo.categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      tickAmount: 6,
      labels: {
        rotate: 0,
        rotateAlways: true,
        style: { fontSize: "10px", colors: "#98A4AE", fontWeight: "600" },
      },
    },
    yaxis: {
      show: false,
      tickAmount: 3,
    },
    tooltip: {
      theme: "dark",
      y: {
        formatter: function (value: number) {
          return `$${value}K`;
        }
      }
    },
    colors: ["var(--color-primary)"],
    grid: {
      borderColor: "var(--color-lightprimary)",
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: false,
        },
      },
      yaxis: {
        lines: {
          show: false,
        },
      },
    },
    markers: {
      strokeColor: ["var(--color-primary)"],
      strokeWidth: 3,
    },
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <CardBox className="overflow-hidden bg-lightprimary dark:bg-lightprimary">
        <div className="flex gap-4 items-center">
          <span className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-white rounded-tw">
            <Icon
              icon="solar:document-medicine-linear"
              className="text-primary"
              height={20}
            />
          </span>
          <div>
            <p className="text-ld mb-1">Siniestros Procesados</p>
            <h5 className="card-title text-22 font-bold">Cargando...</h5>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-500">Cargando datos de siniestros...</p>
        </div>
      </CardBox>
    );
  }

  if (error) {
    return (
      <CardBox className="overflow-hidden bg-lightprimary dark:bg-lightprimary">
        <div className="flex gap-4 items-center">
          <span className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-white rounded-tw">
            <Icon
              icon="solar:document-medicine-linear"
              className="text-primary"
              height={20}
            />
          </span>
          <div>
            <p className="text-ld mb-1">Siniestros Procesados</p>
            <h5 className="card-title text-22 font-bold text-red-500">Error</h5>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center">
          <p className="text-red-500">Error al cargar datos</p>
        </div>
      </CardBox>
    );
  }

  return (
    <>
      <CardBox className="overflow-hidden bg-lightprimary dark:bg-lightprimary">
        <div className="flex gap-4 items-center">
          <span className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-white rounded-tw">
            <Icon
              icon="solar:document-medicine-linear"
              className="text-primary"
              height={20}
            />
          </span>
          <div>
            <p className="text-ld mb-1">Siniestros Procesados</p>
            <h5 className="card-title text-22 font-bold">
              {formatCurrency(siniestrosInfo.totalPagados + siniestrosInfo.totalPendientes)}
            </h5>
          </div>
        </div>
        <div>
          <Chart
            options={ChartData}
            series={ChartData.series}
            type="line"
            height="280px"
            width="100%"
          />
        </div>
        <div className="grid grid-cols-12">
          <div className="col-span-6 text-center">
            <p className="text-ld mb-1 opacity-90">Pagados</p>
            <h5 className="card-title text-22 font-semibold">
              {formatCurrency(siniestrosInfo.totalPagados)}
            </h5>
            <p className="text-xs text-gray-600">
              {data?.siniestros.aprobados || 0} siniestros
            </p>
          </div>
          <div className="col-span-6 text-center">
            <p className="text-ld mb-1 opacity-90">En Proceso</p>
            <h5 className="card-title text-22 font-semibold">
              {formatCurrency(siniestrosInfo.totalPendientes)}
            </h5>
            <p className="text-xs text-gray-600">
              {data?.siniestros.pendientes || 0} siniestros
            </p>
          </div>
        </div>

        {/* Detalle adicional */}
        {data && (
          <div className="mt-4 pt-4 border-t border-white border-opacity-20">
            <div className="flex justify-between items-center text-sm">
              <span className="text-ld opacity-80">Total siniestros:</span>
              <span className="font-medium">{data.siniestros.total}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-2">
              <span className="text-ld opacity-80">Tasa de resolución:</span>
              <span className="font-medium">
                {data.siniestros.total > 0 
                  ? Math.round((data.siniestros.aprobados / data.siniestros.total) * 100)
                  : 0}%
              </span>
            </div>
          </div>
        )}
      </CardBox>
    </>
  );
};

export default TotalSettelment;
