import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Alert,
  Spinner,
  Badge,
  Table,
  TextInput,
  Select,
  Tabs,
} from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from '../../../layouts/full/shared/breadcrumb/BreadcrumbComp';
import estadosCuentaService from 'src/services/estadosCuentaService';

const BCrumb = [
  {
    to: '/',
    title: 'Inicio',
  },
  {
    title: 'Comisiones y Cartera',
  },
  {
    title: 'Estados de Cuenta',
  },
];

interface EstadoCuenta {
  id: string;
  asesor: string;
  periodo: string;
  comisionesGeneradas: number;
  comisionesPagadas: number;
  comisionesPendientes: number;
  anticipos: number;
  ajustes: number;
  descuentos: number;
  saldoFinal: number;
  polizasVendidas: number;
  metaCumplida: number;
  porcentajeMeta: number;
}

interface MovimientoDetalle {
  id: string;
  fecha: string;
  concepto: string;
  tipo: 'Comisión' | 'Anticipo' | 'Ajuste' | 'Descuento' | 'Pago';
  valor: number;
  saldo: number;
}

const mockEstados: EstadoCuenta[] = [];

const mockMovimientos: MovimientoDetalle[] = [];

const EstadosCuenta = () => {
  const [estados, setEstados] = useState<EstadoCuenta[]>(mockEstados);
  const [movimientos, setMovimientos] = useState<MovimientoDetalle[]>(mockMovimientos);
  const [loading, setLoading] = useState(false);
  const [asesorSeleccionadoId, setAsesorSeleccionadoId] = useState<number | null>(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );

  // Carga inicial y cuando cambia el período
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const agents = await estadosCuentaService.agents({ period: periodoSeleccionado });
        const mapped: EstadoCuenta[] = agents.map((a) => ({
          id: String(a.id),
          asesor: a.asesor,
          periodo: periodoSeleccionado,
          comisionesGeneradas: a.comisionesGeneradas,
          comisionesPagadas: a.comisionesPagadas,
          comisionesPendientes: a.comisionesPendientes,
          anticipos: 0,
          ajustes: 0,
          descuentos: 0,
          saldoFinal: a.saldoFinal,
          polizasVendidas: a.polizasVendidas,
          metaCumplida: a.metaCumplida,
          porcentajeMeta: a.porcentajeMeta,
        }));
        setEstados(mapped);
        const first = agents[0];
        if (first) {
          setAsesorSeleccionadoId(parseInt(String(first.id), 10));
        } else {
          setAsesorSeleccionadoId(null);
          setMovimientos([]);
        }
      } catch (e) {
        console.error('Error cargando estados de cuenta:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodoSeleccionado]);

  // Cargar movimientos cuando cambia asesor o período
  useEffect(() => {
    const loadMovs = async () => {
      if (!asesorSeleccionadoId) {
        setMovimientos([]);
        return;
      }
      try {
        setLoading(true);
        const movs = await estadosCuentaService.advisorMovements(asesorSeleccionadoId, {
          period: periodoSeleccionado,
        });
        setMovimientos(movs);
      } catch (e) {
        console.error('Error cargando movimientos:', e);
        setMovimientos([]);
      } finally {
        setLoading(false);
      }
    };
    loadMovs();
  }, [asesorSeleccionadoId, periodoSeleccionado]);

  const tipoColors = {
    Comisión: 'success',
    Anticipo: 'info',
    Ajuste: 'purple',
    Descuento: 'failure',
    Pago: 'warning',
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const estadoSeleccionado = estados.find((e) => Number(e.id) === asesorSeleccionadoId);

  const totalComisionesGeneradas = estados.reduce((sum, e) => sum + e.comisionesGeneradas, 0);
  const totalComisionesPendientes = estados.reduce((sum, e) => sum + e.comisionesPendientes, 0);
  const totalSaldos = estados.reduce((sum, e) => sum + e.saldoFinal, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <>
      <BreadcrumbComp title="Estados de Cuenta" items={BCrumb} />

      <div className="grid grid-cols-12 gap-6">
        {/* Estadísticas Generales */}
        <div className="col-span-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon
                    icon="solar:dollar-minimalistic-bold-duotone"
                    className="h-8 w-8 text-green-500"
                  />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Comisiones Generadas</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(totalComisionesGeneradas)}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon
                    icon="solar:clock-circle-bold-duotone"
                    className="h-8 w-8 text-yellow-500"
                  />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Pendientes</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(totalComisionesPendientes)}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon icon="solar:calculator-bold-duotone" className="h-8 w-8 text-blue-500" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Saldos Totales</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(totalSaldos)}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon
                    icon="solar:users-group-rounded-bold-duotone"
                    className="h-8 w-8 text-purple-500"
                  />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Asesores</p>
                  <p className="text-lg font-semibold text-gray-900">{estados.length}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Filtros */}
        <div className="col-span-12">
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Asesor</label>
                <Select
                  value={asesorSeleccionadoId ?? ''}
                  onChange={(e) =>
                    setAsesorSeleccionadoId(e.target.value ? parseInt(e.target.value, 10) : null)
                  }
                >
                  {estados.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.asesor}
                    </option>
                  ))}
                </Select>
              </div>
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
              <div className="flex items-end">
                <Button className="w-full">
                  <Icon icon="solar:printer-bold-duotone" className="mr-2 h-4 w-4" />
                  Generar Estado
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs de Información */}
        <div className="col-span-12">
          <Card>
            <Tabs aria-label="Estados de cuenta">
              <Tabs.Item active title="Resumen Individual" icon={Icon}>
                {estadoSeleccionado && (
                  <div className="space-y-6">
                    {/* Resumen del Asesor */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">
                          Información del Asesor
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Nombre:</span>
                            <span className="font-medium">{estadoSeleccionado.asesor}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Período:</span>
                            <span className="font-medium">{estadoSeleccionado.periodo}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Pólizas Vendidas:</span>
                            <span className="font-medium">
                              {estadoSeleccionado.polizasVendidas}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">% Meta Cumplida:</span>
                            <Badge
                              color={
                                estadoSeleccionado.porcentajeMeta >= 100 ? 'success' : 'warning'
                              }
                            >
                              {estadoSeleccionado.porcentajeMeta}%
                            </Badge>
                          </div>
                        </div>
                      </Card>

                      <Card>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Comisiones</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Generadas:</span>
                            <span className="font-medium text-green-600">
                              {formatCurrency(estadoSeleccionado.comisionesGeneradas)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Pagadas:</span>
                            <span className="font-medium">
                              {formatCurrency(estadoSeleccionado.comisionesPagadas)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Pendientes:</span>
                            <span className="font-medium text-yellow-600">
                              {formatCurrency(estadoSeleccionado.comisionesPendientes)}
                            </span>
                          </div>
                        </div>
                      </Card>

                      <Card>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Movimientos</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Anticipos:</span>
                            <span className="font-medium text-blue-600">
                              {formatCurrency(estadoSeleccionado.anticipos)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Ajustes:</span>
                            <span className="font-medium text-purple-600">
                              {formatCurrency(estadoSeleccionado.ajustes)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Descuentos:</span>
                            <span className="font-medium text-red-600">
                              {formatCurrency(estadoSeleccionado.descuentos)}
                            </span>
                          </div>
                          <hr />
                          <div className="flex justify-between text-lg font-semibold">
                            <span>Saldo Final:</span>
                            <span
                              className={
                                estadoSeleccionado.saldoFinal >= 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }
                            >
                              {formatCurrency(estadoSeleccionado.saldoFinal)}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Detalle de Movimientos */}
                    <Card>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">
                        Detalle de Movimientos
                      </h4>
                      <div className="overflow-x-auto">
                        <Table striped>
                          <Table.Head>
                            <Table.HeadCell>Fecha</Table.HeadCell>
                            <Table.HeadCell>Concepto</Table.HeadCell>
                            <Table.HeadCell>Tipo</Table.HeadCell>
                            <Table.HeadCell>Valor</Table.HeadCell>
                            <Table.HeadCell>Saldo</Table.HeadCell>
                          </Table.Head>
                          <Table.Body className="divide-y">
                            {movimientos.map((movimiento) => (
                              <Table.Row
                                key={movimiento.id}
                                className="bg-white dark:border-gray-700 dark:bg-gray-800"
                              >
                                <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                                  {movimiento.fecha}
                                </Table.Cell>
                                <Table.Cell>{movimiento.concepto}</Table.Cell>
                                <Table.Cell>
                                  <Badge color={tipoColors[movimiento.tipo]} size="sm">
                                    {movimiento.tipo}
                                  </Badge>
                                </Table.Cell>
                                <Table.Cell
                                  className={`font-semibold ${
                                    movimiento.valor < 0 ? 'text-red-600' : 'text-green-600'
                                  }`}
                                >
                                  {formatCurrency(movimiento.valor)}
                                </Table.Cell>
                                <Table.Cell className="font-semibold">
                                  {formatCurrency(movimiento.saldo)}
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table>
                      </div>
                    </Card>
                  </div>
                )}
              </Tabs.Item>

              <Tabs.Item title="Comparativo General" icon={Icon}>
                <Card>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Comparativo de Asesores
                  </h4>
                  <div className="overflow-x-auto">
                    <Table striped>
                      <Table.Head>
                        <Table.HeadCell>Asesor</Table.HeadCell>
                        <Table.HeadCell>Comisiones Generadas</Table.HeadCell>
                        <Table.HeadCell>Comisiones Pagadas</Table.HeadCell>
                        <Table.HeadCell>Pendientes</Table.HeadCell>
                        <Table.HeadCell>Saldo Final</Table.HeadCell>
                        <Table.HeadCell>Pólizas</Table.HeadCell>
                        <Table.HeadCell>% Meta</Table.HeadCell>
                      </Table.Head>
                      <Table.Body className="divide-y">
                        {estados.map((estado) => (
                          <Table.Row
                            key={estado.id}
                            className="bg-white dark:border-gray-700 dark:bg-gray-800"
                          >
                            <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                              {estado.asesor}
                            </Table.Cell>
                            <Table.Cell className="font-semibold text-green-600">
                              {formatCurrency(estado.comisionesGeneradas)}
                            </Table.Cell>
                            <Table.Cell>{formatCurrency(estado.comisionesPagadas)}</Table.Cell>
                            <Table.Cell className="font-semibold text-yellow-600">
                              {formatCurrency(estado.comisionesPendientes)}
                            </Table.Cell>
                            <Table.Cell
                              className={`font-semibold ${
                                estado.saldoFinal >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {formatCurrency(estado.saldoFinal)}
                            </Table.Cell>
                            <Table.Cell className="text-center font-semibold">
                              {estado.polizasVendidas}
                            </Table.Cell>
                            <Table.Cell>
                              <Badge
                                color={estado.porcentajeMeta >= 100 ? 'success' : 'warning'}
                                size="sm"
                              >
                                {estado.porcentajeMeta}%
                              </Badge>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
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

export default EstadosCuenta;
