import React from 'react';
import { Icon } from "@iconify/react";
import CardBox from "src/components/shared/CardBox";

const TaxSummaryWidget: React.FC = () => {
  const taxData = [
    {
      name: "IVA Recaudado",
      amount: 912400,
      percentage: 19,
      icon: "solar:receipt-outline",
      colorVar: "var(--color-primary)",
      bgColorVar: "var(--color-primary-subtle)"
    },
    {
      name: "Retención en la Fuente",
      amount: 143700,
      percentage: 3,
      icon: "solar:bookmark-outline",
      colorVar: "var(--color-secondary)",
      bgColorVar: "var(--color-secondary-subtle)"
    },
    {
      name: "ICA",
      amount: 47800,
      percentage: 1,
      icon: "solar:city-outline",
      colorVar: "var(--color-warning)",
      bgColorVar: "var(--color-warning-subtle)"
    },
    {
      name: "Reteica",
      amount: 15930,
      percentage: 0.33,
      icon: "solar:buildings-outline",
      colorVar: "var(--color-success)",
      bgColorVar: "var(--color-success-subtle)"
    }
  ];

  return (
    <CardBox>
      <div>
        <h5 className="card-title">Resumen Tributario</h5>
        <p className="card-subtitle">Impuestos del período actual</p>
      </div>
      
      <div className="space-y-4 mt-6">
        {taxData.map((tax, index) => (
          <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: tax.bgColorVar }}>
                <Icon icon={tax.icon} height={20} style={{ color: tax.colorVar }} />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{tax.name}</p>
                <p className="text-sm text-gray-500">{tax.percentage}% del total</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg" style={{ color: tax.colorVar }}>
                ${tax.amount.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Total Tax Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-500">Total Impuestos</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              $1,119,830
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Del mes actual</p>
            <p className="text-sm" style={{ color: 'var(--color-success)' }}>23.4% del total facturado</p>
          </div>
        </div>
      </div>

      {/* DIAN Status */}
      <div className="mt-4 p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-success-subtle)', borderColor: 'var(--color-success)' }}>
        <div className="flex items-center gap-2">
          <Icon icon="solar:shield-check-outline" height={16} style={{ color: 'var(--color-success)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>
            Conexión DIAN activa
          </span>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--color-success)' }}>
          Última sincronización: Hace 2 minutos
        </p>
      </div>
    </CardBox>
  );
};

export default TaxSummaryWidget;
