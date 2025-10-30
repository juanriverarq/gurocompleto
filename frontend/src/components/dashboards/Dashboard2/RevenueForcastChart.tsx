import CardBox from "../../shared/CardBox";
import { Icon } from "@iconify/react";
import Chart from 'react-apexcharts';
import { useDashboardData } from "../../../hooks/useDashboardData";
import React from 'react';
import { saasApi } from "src/services/saasApi";

interface RevenueForcastChartProps {
  startDate?: string | null;
  endDate?: string | null;
}

const RevenueForcastChart = ({ startDate, endDate }: RevenueForcastChartProps) => {
  const { data, loading, error } = useDashboardData({ startDate, endDate });
  const [labels, setLabels] = React.useState<string[]>([]);
  const [values, setValues] = React.useState<number[]>([]);
  const [loadingPrimas, setLoadingPrimas] = React.useState(true);
  const [errorPrimas, setErrorPrimas] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchPrimas = async () => {
      try {
        setLoadingPrimas(true);
        setErrorPrimas(null);
        // Usar el filtro de fecha del contexto si está disponible
        const res = await saasApi.getPrimasChart('month', startDate, endDate);
        if (res.success && res.data) {
          setLabels(res.data.labels || []);
          setValues((res.data.data || []).map((v) => Number(v)));
        } else {
          setErrorPrimas('No se pudieron cargar las primas');
        }
      } catch (e: any) {
        setErrorPrimas(e?.message || 'Error al cargar primas');
      } finally {
        setLoadingPrimas(false);
      }
    };
    fetchPrimas();
  }, [startDate, endDate]);

  const getChartData = () => {
    // Convertir a millones para coincidir con el formato del eje Y
    const seriesDataInMillions = values.map((v) => Number((v / 1_000_000).toFixed(1)));

    const totalPrimasM = Number((values.reduce((a, b) => a + b, 0) / 1_000_000).toFixed(1));
    const comisionValueM = data ? Number((parseFloat(data.finanzas.comision_numero) / 1_000_000).toFixed(1)) : 0;
    const crecimiento = data ? data.clientes.porcentaje_crecimiento : 0;

    return {
      categories: labels,
      series: [
        {
          name: "Primas",
          data: seriesDataInMillions,
        }
      ],
      totalPrimas: `$${totalPrimasM}M`,
      comisiones: `$${comisionValueM}M`,
      crecimiento: `${crecimiento >= 0 ? '+' : ''}${crecimiento}%`
    };
  };

  const chartInfo = getChartData();

  const ChartData: any = {
    series: chartInfo.series,
    chart: {
      toolbar: {
        show: false,
      },
      type: "bar",
      fontFamily: "inherit",
      foreColor: "#adb0bb",
      height: 250,
      stacked: false,
      offsetX: -15,
    },
    colors: ["var(--color-primary)", "var(--color-secondary)"],
    plotOptions: {
      bar: {
        horizontal: false,
        barHeight: "60%",
        columnWidth: "50%",
        borderRadius: [6],
        borderRadiusApplication: "end",
        borderRadiusWhenStacked: "all",
      },
    },
    dataLabels: {
      enabled: false,
    },
    legend: {
      show: false,
    },
    grid: {
      show: true,
      padding: {
        top: 0,
        bottom: 0,
        right: 0,
      },
      borderColor: "rgba(0,0,0,0.05)",
      xaxis: {
        lines: {
          show: true,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    yaxis: {
      min: 0,
      labels: {
        formatter: function (value: number) {
          return `$${value.toFixed(1)}M`;
        }
      }
    },
    xaxis: {
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      categories: chartInfo.categories,
      labels: {
        style: { fontSize: "13px", colors: "#adb0bb", fontWeight: "400" },
      },
    },
    tooltip: {
      theme: "dark",
      y: {
        formatter: function (value: number) {
          return `$${value.toFixed(1)}M`;
        }
      }
    },
  };

  if (loading || loadingPrimas) {
    return (
      <CardBox>
        <div className="md:flex justify-between items-center">
          <div>
            <h5 className="card-title">Prima de Pólizas</h5>
            <p className="card-subtitle">Cargando datos...</p>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center">
          <p className="text-gray-500">Cargando gráfico de primas...</p>
        </div>
      </CardBox>
    );
  }

  if (error || errorPrimas) {
    return (
      <CardBox>
        <div className="md:flex justify-between items-center">
          <div>
            <h5 className="card-title">Prima de Pólizas</h5>
            <p className="card-subtitle text-red-500">Error al cargar datos</p>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center">
          <p className="text-red-500">{errorPrimas || 'Error al cargar datos de primas'}</p>
        </div>
      </CardBox>
    );
  }

  return (
    <>
      <CardBox>
        <div className="md:flex justify-between items-center mb-4">
          <div>
            <h5 className="card-title">Prima de Pólizas</h5>
            <p className="card-subtitle">Ingresos por Primas de Seguros</p>
          </div>
        </div>
        <div className="rounded-bars">
          <Chart
            options={ChartData}
            series={ChartData.series}
            type="bar"
            height="295px"
            width="100%"
          />
        </div>
        <div className="flex md:flex-row flex-col gap-3">
          <div className="md:basis-1/3 basis-full">
            <div className="flex gap-3 items-center">
              <span className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-muted dark:bg-dark rounded-tw">
                <Icon
                  icon="solar:shield-check-linear"
                  className="text-ld"
                  height={20}
                />
              </span>
              <div>
                <p>Total Primas</p>
                <h5 className="font-medium text-lg">{chartInfo.totalPrimas}</h5>
              </div>
            </div>
          </div>
          <div className="md:basis-1/3 basis-full">
            <div className="flex gap-3 items-center">
              <span className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-lightprimary rounded-tw">
                <Icon
                  icon="solar:dollar-minimalistic-linear"
                  className="text-primary"
                  height={20}
                />
              </span>
              <div>
                <p>Comisiones</p>
                <h5 className="font-medium text-lg">{chartInfo.comisiones}</h5>
              </div>
            </div>
          </div>
          <div className="md:basis-1/3 basis-full">
            <div className="flex gap-3 items-center">
              <span className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-lightsuccess rounded-tw">
                <Icon
                  icon="solar:chart-2-linear"
                  className="text-success"
                  height={20}
                />
              </span>
              <div>
                <p>Crecimiento</p>
                <h5 className="font-medium text-lg">{chartInfo.crecimiento}</h5>
              </div>
            </div>
          </div>
        </div>
      </CardBox>
    </>
  );
};

export default RevenueForcastChart;
