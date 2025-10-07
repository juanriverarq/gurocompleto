
import CardBox from "../../shared/CardBox";
import Chart from 'react-apexcharts';
import { useDashboardData } from "../../../hooks/useDashboardData";

const Project = () => {
  const { data, loading, error } = useDashboardData();

  const ChartData: any = {
    series: [
      {
        name: "Pólizas",
        data: [28, 32, 24, 40, 35, 42, 38, 45, data?.resumen_polizas.activas || 45],
        labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep"],
      },
    ],

    chart: {
      fontFamily: "inherit",
      height: 55,
      type: "bar",
      offsetX: -3,
      toolbar: {
        show: false,
      },
      sparkline: {
        enabled: true,
      },
    },
    colors: ["#fff"],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        endingShape: "flat",
        borderRadius: 4,
      },
    },
    tooltip: {
      theme: "dark",
      followCursor: true,
    },
  };

  if (loading) {
    return (
      <div>
        <CardBox className="shadow-none p-0 overflow-hidden">
          <div className="bg-lighterror p-6">
            <p className="text-ld">Pólizas Activas</p>
            <div className="flex gap-3 align-self mb-4">
              <h5 className="text-2xl">Cargando...</h5>
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
          <div className="bg-lighterror p-6">
            <p className="text-ld">Pólizas Activas</p>
            <div className="flex gap-3 align-self mb-4">
              <h5 className="text-2xl text-red-500">Error</h5>
            </div>
          </div>
        </CardBox>
      </div>
    );
  }

  const porcentajeActivas = data?.resumen_polizas.total ? 
    Math.round(((data.resumen_polizas.activas / data.resumen_polizas.total) * 100)) : 0;

  return (
    <div>
      <CardBox className="shadow-none p-0 overflow-hidden">
        <div className="bg-lighterror p-6">
          <p className="text-ld">Pólizas Activas</p>
          <div className="flex gap-3 align-self mb-4">
            <h5 className="text-2xl">{data?.resumen_polizas.activas.toLocaleString() || '0'}</h5>
            <span className="text-13 text-ld font-semibold pt-1">
              {porcentajeActivas}% del total
            </span>
          </div>
          <Chart
            options={ChartData}
            series={ChartData.series}
            type="bar"
            height="55px"
            width="100%"
          />
        </div>
      </CardBox>
    </div>
  );
};

export default Project;
