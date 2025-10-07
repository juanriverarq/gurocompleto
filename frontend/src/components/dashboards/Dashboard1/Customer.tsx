
import CardBox from "../../shared/CardBox";
import Chart from 'react-apexcharts';
import { useDashboardData } from "../../../hooks/useDashboardData";

const Customer = () => {
  const { data, loading, error } = useDashboardData();

  const ChartData: any = {
    series: [
      {
        name: "clientes",
        data: [25, 30, 28, 35, 32, data?.clientes.total || 15],
        color: "var(--color-secondary)",
      },
    ],

    chart: {
      type: "area",
      height: 70,
      sparkline: {
        enabled: true,
      },
      group: "sparklines",
      fontFamily: "inherit",
      foreColor: "#adb0bb",
    },
    color: "var(--color-secondary)",
    stroke: {
      curve: "smooth",
      width: 2,
    },
    fill: {
      type: "gradient",
      color: "var(--color-secondary)",
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
    },
  };

  if (loading) {
    return (
      <div>
        <CardBox className="shadow-none p-0 overflow-hidden">
          <div className="bg-lightsecondary">
            <div className="p-6">
              <p className="text-ld">Clientes</p>
              <div className="flex gap-3 align-self">
                <h5 className="text-2xl">Cargando...</h5>
              </div>
            </div>
          </div>
        </CardBox>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <CardBox className="shadow-none p-0 overflow-hidden">
          <div className="bg-lightsecondary">
            <div className="p-6">
              <p className="text-ld">Clientes</p>
              <div className="flex gap-3 align-self">
                <h5 className="text-2xl text-red-500">Error</h5>
              </div>
            </div>
          </div>
        </CardBox>
      </div>
    );
  }

  return (
    <div>
      <CardBox className="shadow-none p-0 overflow-hidden">
        <div className="bg-lightsecondary">
          <div className="p-6">
            <p className="text-ld">Clientes</p>
            <div className="flex gap-3 align-self">
              <h5 className="text-2xl">{data?.clientes.total.toLocaleString() || '0'}</h5>
              <span className="text-13 text-ld font-semibold pt-1">
                +{data?.clientes.porcentaje_crecimiento || 0}%
              </span>
            </div>
          </div>
          <Chart
            options={ChartData}
            series={ChartData.series}
            type="area"
            height="70px"
            width="100%"
          />
        </div>
      </CardBox>
    </div>
  );
};

export default Customer;
