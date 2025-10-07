import React, { useEffect, useMemo, useState } from 'react';
import { Card, Button, Alert, Spinner, Badge, Select, Tabs } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from '../../../layouts/full/shared/breadcrumb/BreadcrumbComp';
import reportesFinancierosService, {
  ReporteFinanciero as RF,
  ReportePorAseguradora as RPA,
  ReportePorAsesor as RPAse,
} from 'src/services/reportesFinancierosService';

const BCrumb = [
  {
    to: '/',
    title: 'Inicio',
  },
  {
    title: 'Comisiones y Cartera',
  },
  {
    title: 'Reportes Financieros',
  },
];

interface ReporteFinanciero {
  periodo: string;
  totalPrimas: number;
  totalComisiones: number;
  comisionesPagadas: number;
  comisionesPendientes: number;
  anticipos: number;
  ajustes: number;
  margenBruto: number;
  crecimiento: number;
}

interface ReportePorAsesor {
  asesor: string;
  comisionesGeneradas: number;
  comisionesPagadas: number;
  metaCumplida: number;
  porcentajeMeta: number;
  clientesActivos: number;
  polizasVendidas: number;
}

interface ReportePorAseguradora {
  aseguradora: string;
  primasTotal: number;
  comisiones: number;
  porcentajeParticipacion: number;
  polizasActivas: number;
  crecimientoMensual: number;
}

const mockReportesFinancieros: RF[] = [];

const mockReportesPorAsesor: RPAse[] = [];

const mockReportesPorAseguradora: RPA[] = [];

const ReportesFinancieros = () => {
  const [loading, setLoading] = useState(false);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );
  const [monthly, setMonthly] = useState<RF[]>(mockReportesFinancieros);
  const [byAdvisor, setByAdvisor] = useState<RPAse[]>(mockReportesPorAsesor);
  const [byInsurer, setByInsurer] = useState<RPA[]>(mockReportesPorAseguradora);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [m, a, i] = await Promise.all([
          reportesFinancierosService.monthly({ period: periodoSeleccionado, months: 3 }),
          reportesFinancierosService.byAdvisor({ period: periodoSeleccionado }),
          reportesFinancierosService.byInsurer({ period: periodoSeleccionado }),
        ]);
        setMonthly(m);
        setByAdvisor(a);
        setByInsurer(i);
      } catch (e) {
        console.error('Error cargando reportes financieros:', e);
        setMonthly([]);
        setByAdvisor([]);
        setByInsurer([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodoSeleccionado]);

  const reporteActual = useMemo(
    () => monthly.find((r) => r.periodo === periodoSeleccionado),
    [monthly, periodoSeleccionado],
  );
  const reporteAnterior = useMemo(() => {
    if (!reporteActual || monthly.length === 0) return undefined;
    const idx = monthly.findIndex((r) => r.periodo === reporteActual.periodo);
    return idx > 0 ? monthly[idx - 1] : undefined;
  }, [monthly, reporteActual]);

  const calcularVariacion = (actual: number, anterior: number) => {
    if (anterior === 0) return 0;
    return ((actual - anterior) / anterior) * 100;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <>
      <BreadcrumbComp title="Reportes Financieros" items={BCrumb} />

      <div className="grid grid-cols-12 gap-6">
        {/* Filtros */}
        <div className="col-span-12">
          <Card>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
                  <Select
                    value={periodoSeleccionado}
                    onChange={(e) => setPeriodoSeleccionado(e.target.value)}
                  >
                    <option value="2024-06">Junio 2024</option>
                    <option value="2024-05">Mayo 2024</option>
                    <option value="2024-04">Abril 2024</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Reporte
                  </label>
                  <Select>
                    <option value="mensual">Mensual</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="anual">Anual</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Formato</label>
                  <Select>
                    <option value="detallado">Detallado</option>
                    <option value="resumen">Resumen</option>
                    <option value="ejecutivo">Ejecutivo</option>
                  </Select>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button color="light">
                  <Icon icon="solar:export-bold-duotone" className="mr-2 h-4 w-4" />
                  Exportar PDF
                </Button>
                <Button color="light">
                  <Icon icon="solar:document-bold-duotone" className="mr-2 h-4 w-4" />
                  Exportar Excel
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Indicadores Principales */}
        {reporteActual && (
          <div className="col-span-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Primas</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reporteActual.totalPrimas)}
                    </p>
                    {reporteAnterior && (
                      <p
                        className={`text-sm ${
                          calcularVariacion(
                            reporteActual.totalPrimas,
                            reporteAnterior.totalPrimas,
                          ) >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {calcularVariacion(
                          reporteActual.totalPrimas,
                          reporteAnterior.totalPrimas,
                        ) >= 0
                          ? '↗'
                          : '↘'}
                        {formatPercentage(
                          Math.abs(
                            calcularVariacion(
                              reporteActual.totalPrimas,
                              reporteAnterior.totalPrimas,
                            ),
                          ),
                        )}
                      </p>
                    )}
                  </div>
                  <Icon
                    icon="solar:dollar-minimalistic-bold-duotone"
                    className="h-8 w-8 text-green-500"
                  />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Comisiones Generadas</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reporteActual.totalComisiones)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Margen: {formatPercentage(reporteActual.margenBruto)}
                    </p>
                  </div>
                  <Icon icon="solar:calculator-bold-duotone" className="h-8 w-8 text-blue-500" />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Comisiones Pendientes</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reporteActual.comisionesPendientes)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatPercentage(
                        (reporteActual.comisionesPendientes / reporteActual.totalComisiones) * 100,
                      )}{' '}
                      del total
                    </p>
                  </div>
                  <Icon
                    icon="solar:clock-circle-bold-duotone"
                    className="h-8 w-8 text-yellow-500"
                  />
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Crecimiento</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatPercentage(reporteActual.crecimiento)}
                    </p>
                    <p className="text-sm text-green-600">vs mes anterior</p>
                  </div>
                  <Icon
                    icon="solar:chart-square-bold-duotone"
                    className="h-8 w-8 text-purple-500"
                  />
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Tabs de Reportes */}
        <div className="col-span-12">
          <Card>
            <Tabs aria-label="Reportes financieros">
              <Tabs.Item active title="Resumen Ejecutivo" icon={Icon}>
                <div className="space-y-6">
                  {/* Evolución Mensual */}
                  <Card>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Evolución Mensual</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                          <tr>
                            <th className="px-6 py-3">Período</th>
                            <th className="px-6 py-3">Primas</th>
                            <th className="px-6 py-3">Comisiones</th>
                            <th className="px-6 py-3">Pagadas</th>
                            <th className="px-6 py-3">Pendientes</th>
                            <th className="px-6 py-3">Margen</th>
                            <th className="px-6 py-3">Crecimiento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthly.map((reporte) => (
                            <tr key={reporte.periodo} className="bg-white border-b">
                              <td className="px-6 py-4 font-medium">{reporte.periodo}</td>
                              <td className="px-6 py-4">{formatCurrency(reporte.totalPrimas)}</td>
                              <td className="px-6 py-4 text-green-600 font-semibold">
                                {formatCurrency(reporte.totalComisiones)}
                              </td>
                              <td className="px-6 py-4">
                                {formatCurrency(reporte.comisionesPagadas)}
                              </td>
                              <td className="px-6 py-4 text-yellow-600">
                                {formatCurrency(reporte.comisionesPendientes)}
                              </td>
                              <td className="px-6 py-4">{formatPercentage(reporte.margenBruto)}</td>
                              <td className="px-6 py-4">
                                <Badge color={reporte.crecimiento >= 0 ? 'success' : 'failure'}>
                                  {formatPercentage(reporte.crecimiento)}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Análisis de Flujo de Caja */}
                  {reporteActual && (
                    <Card>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">
                        Análisis de Flujo de Caja
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-green-50 p-4 rounded-lg">
                          <h5 className="font-semibold text-green-800 mb-2">Ingresos</h5>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(reporteActual.comisionesPagadas)}
                          </p>
                          <p className="text-sm text-green-700">Comisiones cobradas</p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h5 className="font-semibold text-blue-800 mb-2">Anticipos</h5>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(reporteActual.anticipos)}
                          </p>
                          <p className="text-sm text-blue-700">Adelantos otorgados</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <h5 className="font-semibold text-purple-800 mb-2">Ajustes</h5>
                          <p className="text-2xl font-bold text-purple-600">
                            {formatCurrency(reporteActual.ajustes)}
                          </p>
                          <p className="text-sm text-purple-700">Correcciones aplicadas</p>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              </Tabs.Item>

              <Tabs.Item title="Por Asesor" icon={Icon}>
                <Card>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Rendimiento por Asesor
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th className="px-6 py-3">Asesor</th>
                          <th className="px-6 py-3">Comisiones Generadas</th>
                          <th className="px-6 py-3">Comisiones Pagadas</th>
                          <th className="px-6 py-3">% Meta</th>
                          <th className="px-6 py-3">Clientes</th>
                          <th className="px-6 py-3">Pólizas</th>
                          <th className="px-6 py-3">Promedio por Póliza</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byAdvisor.map((reporte) => (
                          <tr key={reporte.asesor} className="bg-white border-b">
                            <td className="px-6 py-4 font-medium">{reporte.asesor}</td>
                            <td className="px-6 py-4 text-green-600 font-semibold">
                              {formatCurrency(reporte.comisionesGeneradas)}
                            </td>
                            <td className="px-6 py-4">
                              {formatCurrency(reporte.comisionesPagadas)}
                            </td>
                            <td className="px-6 py-4">
                              <Badge color={reporte.porcentajeMeta >= 100 ? 'success' : 'warning'}>
                                {formatPercentage(reporte.porcentajeMeta)}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-center">{reporte.clientesActivos}</td>
                            <td className="px-6 py-4 text-center">{reporte.polizasVendidas}</td>
                            <td className="px-6 py-4 font-semibold">
                              {formatCurrency(
                                reporte.comisionesGeneradas / reporte.polizasVendidas,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </Tabs.Item>

              <Tabs.Item title="Por Aseguradora" icon={Icon}>
                <Card>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Participación por Aseguradora
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th className="px-6 py-3">Aseguradora</th>
                          <th className="px-6 py-3">Primas Total</th>
                          <th className="px-6 py-3">Comisiones</th>
                          <th className="px-6 py-3">% Participación</th>
                          <th className="px-6 py-3">Pólizas Activas</th>
                          <th className="px-6 py-3">Crecimiento</th>
                          <th className="px-6 py-3">Prima Promedio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byInsurer.map((reporte) => (
                          <tr key={reporte.aseguradora} className="bg-white border-b">
                            <td className="px-6 py-4 font-medium">{reporte.aseguradora}</td>
                            <td className="px-6 py-4 font-semibold">
                              {formatCurrency(reporte.primasTotal)}
                            </td>
                            <td className="px-6 py-4 text-green-600 font-semibold">
                              {formatCurrency(reporte.comisiones)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full"
                                    style={{ width: `${reporte.porcentajeParticipacion}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium">
                                  {formatPercentage(reporte.porcentajeParticipacion)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">{reporte.polizasActivas}</td>
                            <td className="px-6 py-4">
                              <Badge
                                color={reporte.crecimientoMensual >= 0 ? 'success' : 'failure'}
                              >
                                {formatPercentage(reporte.crecimientoMensual)}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 font-semibold">
                              {formatCurrency(reporte.primasTotal / reporte.polizasActivas)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </Tabs.Item>
            </Tabs>
          </Card>
        </div>
      </div>
    </>
  );
};

export default ReportesFinancieros;
