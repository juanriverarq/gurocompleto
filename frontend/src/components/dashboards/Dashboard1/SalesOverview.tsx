
import CardBox from "../../shared/CardBox";
import Chart from 'react-apexcharts';
import { useDashboardData } from "../../../hooks/useDashboardData";

const SalesOverview = () => {
  const { data, loading, error } = useDashboardData();

  const getChartData = () => {
    // Validar que polizas_por_tipo existe y es un array
    if (!data?.polizas_por_tipo || !Array.isArray(data.polizas_por_tipo) || data.polizas_por_tipo.length === 0) {
      return {
        series: [50, 30, 20],
        labels: ["Vida", "Autos", "Hogar"],
      };
    }

    // Tomar los 3 tipos más comunes
    const topTypes = data.polizas_por_tipo
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    const total = data.resumen_polizas.total;
    
    return {
      series: topTypes.map(type => Math.round((type.total / total) * 100)),
      labels: topTypes.map(type => {
        const typeNames: { [key: string]: string } = {
          'vida': 'Vida',
          'autos': 'Autos',
          'hogar': 'Hogar',
          'empresarial': 'Empresarial',
          'salud': 'Salud',
          'accidentes': 'Accidentes',
          'responsabilidad_civil': 'Resp. Civil',
          'otros': 'Otros'
        };
        const percentage = Math.round((type.total / total) * 100);
        return `${typeNames[type.type] || type.type} (${percentage}%)`;
      })
    };
  };

  const chartInfo = getChartData();

  const ChartData: any = {
    series: chartInfo.series,
    labels: chartInfo.labels,
    chart: {
      type: "radialBar",
      height: 200,
      fontFamily: "inherit",
      foreColor: "#c6d1e9",
    },
    plotOptions: {
      radialBar: {
        inverseOrder: false,
        startAngle: 0,
        endAngle: 270,
        hollow: {
          margin: 1,
          size: "40%",
        },
        dataLabels: {
          show: false,
        },
      },
    },
    legend: {
      show: false,
    },
    stroke: { width: 1, lineCap: "round" },
    tooltip: {
      enabled: true,
      fillSeriesColor: false,
    },
    colors: [
      "var(--color-primary)",
      "var(--color-secondary)",
      "var(--color-error)",
    ],
  };

  if (loading) {
    return (
      <CardBox>
        <div>
          <h5 className="card-title">Tipos de Pólizas</h5>
          <p className="card-subtitle">Cargando distribución...</p>
        </div>
        <div className="h-48 flex items-center justify-center">
          <p>Cargando datos...</p>
        </div>
      </CardBox>
    );
  }

  if (error) {
    return (
      <CardBox>
        <div>
          <h5 className="card-title">Tipos de Pólizas</h5>
          <p className="card-subtitle text-red-500">Error al cargar datos</p>
        </div>
        <div className="h-48 flex items-center justify-center">
          <p className="text-red-500">Error</p>
        </div>
      </CardBox>
    );
  }

  return (
    <>
      <CardBox>
        <div>
          <h5 className="card-title">Tipos de Pólizas</h5>
          <p className="card-subtitle">Distribución actual ({data?.resumen_polizas.total || 0} total)</p>
        </div>
        <div className="relative">
          <Chart
            options={ChartData}
            series={ChartData.series}
            type="radialBar"
            height="200px"
            width="100%"
          />
          <span className="absolute text-nowrap top-0 mx-auto left-0 right-0 w-5 text-ld opacity-90 text-13">0%</span>      
          <span className="absolute text-nowrap top-1/2 right-0 w-5 text-ld opacity-90 text-13">25%</span> 
          <span className="absolute text-nowrap bottom-0 mx-auto left-1 right-0 w-5 text-ld opacity-90 text-13">50%</span>   
          <span className="absolute text-nowrap top-1/2 2xl:left-0 -left-2  w-5 text-ld opacity-90 text-13">75%</span>   
        </div>
        {/* Leyenda personalizada */}
        <div className="mt-4 space-y-2">
          {chartInfo.labels.map((label, index) => (
            <div key={index} className="flex items-center text-sm">
              <div 
                className="w-3 h-3 rounded-full mr-2"
                style={{ 
                  backgroundColor: index === 0 ? 'var(--color-primary)' : 
                                 index === 1 ? 'var(--color-secondary)' : 
                                 'var(--color-error)'
                }}
              ></div>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </CardBox>
    </>
  );
};

export default SalesOverview;
