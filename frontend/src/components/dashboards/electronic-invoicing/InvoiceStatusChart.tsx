import React from 'react';
import Chart from 'react-apexcharts';
import { Icon } from "@iconify/react";
import CardBox from "src/components/shared/CardBox";

const InvoiceStatusChart: React.FC = () => {
  const invoiceData = {
    aprobadas: 680,
    pendientes: 125,
    rechazadas: 45,
    anuladas: 25,
    total: 875,
    series: [680, 125, 45, 25],
    labels: ["Aprobadas", "Pendientes", "Rechazadas", "Anuladas"]
  };

  const ChartData: any = {
    series: invoiceData.series,
    labels: invoiceData.labels,
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
          return `${value} facturas`;
        }
      }
    },
    colors: [
      "var(--color-primary)",    // Aprobadas - azul
      "var(--color-warning)",    // Pendientes - amarillo
      "var(--color-error)",      // Rechazadas - rojo
      "var(--color-secondary)",  // Anuladas - púrpura
    ],
  };

  return (
    <CardBox>
      <div>
        <h5 className="card-title">Estado de Facturas</h5>
        <p className="card-subtitle">Distribución por estado DIAN</p>
      </div>
      <div className="mt-4">
        <Chart
          options={ChartData}
          series={ChartData.series}
          type="donut"
          height="300px"
          width="100%"
        />
      </div>
      
      {/* Status Summary */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }}></div>
            <span className="text-sm font-medium">Aprobadas</span>
          </div>
          <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{invoiceData.aprobadas}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-warning)' }}></div>
            <span className="text-sm font-medium">Pendientes</span>
          </div>
          <p className="text-lg font-bold" style={{ color: 'var(--color-warning)' }}>{invoiceData.pendientes}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-error)' }}></div>
            <span className="text-sm font-medium">Rechazadas</span>
          </div>
          <p className="text-lg font-bold" style={{ color: 'var(--color-error)' }}>{invoiceData.rechazadas}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-secondary)' }}></div>
            <span className="text-sm font-medium">Anuladas</span>
          </div>
          <p className="text-lg font-bold" style={{ color: 'var(--color-secondary)' }}>{invoiceData.anuladas}</p>
        </div>
      </div>
    </CardBox>
  );
};

export default InvoiceStatusChart;
