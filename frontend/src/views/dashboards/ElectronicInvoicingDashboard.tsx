import React from 'react';
import { Icon } from "@iconify/react";
import InvoiceStatusChart from "src/components/dashboards/electronic-invoicing/InvoiceStatusChart";
import MonthlyRevenueChart from "src/components/dashboards/electronic-invoicing/MonthlyRevenueChart";
import TaxSummaryWidget from "src/components/dashboards/electronic-invoicing/TaxSummaryWidget";
import CardBox from "src/components/shared/CardBox";

const ElectronicInvoicingDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Summary and Main Chart */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Main Summary */}
          <CardBox>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Resumen de Facturación</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Facturas Totales</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>1,245</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Ventas del Mes</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>COP $4,780,000</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Documentos Pendientes</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>8</p>
              </div>
            </div>
          </CardBox>

          {/* Main Chart */}
          <MonthlyRevenueChart />
        </div>

        {/* Additional Widgets */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <InvoiceStatusChart />
          <TaxSummaryWidget />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Actividad Reciente
        </h4>
        <CardBox>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            <li className="py-4 flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Factura #123
                </p>
                <p className="text-sm text-gray-500">Emitida el 01/07/2025</p>
              </div>
              <p className="font-medium" style={{ color: 'var(--color-success)' }}>
                COP $500,000
              </p>
            </li>
            <li className="py-4 flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Factura #124
                </p>
                <p className="text-sm text-gray-500">Emitida el 03/07/2025</p>
              </div>
              <p className="font-medium" style={{ color: 'var(--color-success)' }}>
                COP $800,000
              </p>
            </li>
            <li className="py-4 flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Factura #125
                </p>
                <p className="text-sm text-gray-500">Emitida el 05/07/2025</p>
              </div>
              <p className="font-medium" style={{ color: 'var(--color-error)' }}>
                Pendiente
              </p>
            </li>
          </ul>
        </CardBox>
      </div>
    </div>
  );
};

export default ElectronicInvoicingDashboard;
