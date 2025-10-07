import React from 'react';
import Chart from 'react-apexcharts';
import CardBox from "src/components/shared/CardBox";

const MonthlyRevenueChart: React.FC = () => {
  const ChartData: any = {
    series: [
      {
        name: 'Ingresos Brutos',
        data: [2800000, 3200000, 2900000, 3800000, 4200000, 3600000, 4780000, 4100000, 3700000, 4300000, 3900000, 5200000]
      },
      {
        name: 'Ingresos Netos',
        data: [2380000, 2720000, 2465000, 3230000, 3570000, 3060000, 4063000, 3485000, 3145000, 3655000, 3315000, 4420000]
      }
    ],
    options: {
      chart: {
        height: 350,
        type: 'area',
        fontFamily: 'inherit',
        toolbar: {
          show: false
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: 'smooth',
        width: 2
      },
      xaxis: {
        categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
      },
      yaxis: {
        labels: {
          formatter: function (value: number) {
            return `$${(value / 1000000).toFixed(1)}M`;
          }
        }
      },
      tooltip: {
        y: {
          formatter: function (value: number) {
            return `COP $${value.toLocaleString()}`;
          }
        }
      },
      colors: ['var(--color-primary)', 'var(--color-success)'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.3,
          opacityTo: 0.1,
          stops: [0, 90, 100]
        }
      },
      legend: {
        show: true,
        position: 'top'
      }
    }
  };

  return (
    <CardBox>
      <div>
        <h5 className="card-title">Ingresos Mensuales</h5>
        <p className="card-subtitle">Comparación de ingresos brutos vs netos</p>
      </div>
      <div className="mt-4">
        <Chart
          options={ChartData.options}
          series={ChartData.series}
          type="area"
          height="350px"
          width="100%"
        />
      </div>
      
      {/* Revenue Summary */}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">Ingresos Julio</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>$4.78M</p>
          <p className="text-sm" style={{ color: 'var(--color-success)' }}>+18% vs mes anterior</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">Promedio Mensual</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>$3.85M</p>
          <p className="text-sm text-gray-600">Últimos 12 meses</p>
        </div>
      </div>
    </CardBox>
  );
};

export default MonthlyRevenueChart;
