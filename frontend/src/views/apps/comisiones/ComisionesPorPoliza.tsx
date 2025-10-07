import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Spinner, Badge, Table, Tabs, Progress, Dropdown } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { IconDots } from '@tabler/icons-react';
import { Input } from 'src/components/shadcn-ui/Default-Ui/input';
import { polizaService } from '../../../services/polizaService';
import { useToast } from 'src/hooks/use-toast';

const ComisionesPorPoliza = () => {
  const [polizasComisiones, setPolizasComisiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabActivo, setTabActivo] = useState<'porCobrar' | 'cobradas'>('porCobrar');
  const [paginaActual, setPaginaActual] = useState(1);
  const [elementosPorPagina, setElementosPorPagina] = useState(25);
  const [filtros, setFiltros] = useState({
    busqueda: '',
  });
  const { toast } = useToast();

  // Filtrar comisiones por cobrar (pendientes)
  const comisionesPorCobrar = useMemo(() =>
    polizasComisiones.filter(p => p.comisionPendiente > 0),
    [polizasComisiones]
  );

  // Filtrar comisiones cobradas
  const comisionesCobradas = useMemo(() =>
    polizasComisiones.filter(p => p.comisionCobrada > 0),
    [polizasComisiones]
  );

  const estadisticasComisiones = useMemo(() => {
    const pendiente = comisionesPorCobrar.reduce((sum, p) => sum + p.comisionPendiente, 0);
    const cobradas = comisionesCobradas.reduce((sum, p) => sum + p.comisionCobrada, 0);
    const totalComisiones = pendiente + cobradas;
    const tasaCobro = totalComisiones > 0 ? (cobradas / totalComisiones) * 100 : 0;

    return {
      pendiente,
      cobradas,
      tasaCobro,
      cantidadPorCobrar: comisionesPorCobrar.length,
      cantidadCobradas: comisionesCobradas.length,
      totalComisiones
    };
  }, [comisionesPorCobrar, comisionesCobradas]);

  useEffect(() => {
    loadPolizasComisiones();
  }, []);

  const loadPolizasComisiones = async () => {
    try {
      setLoading(true);
      let todasLasPolizas: any[] = [];
      let paginaActual = 1;
      let hayMasPaginas = true;

      while (hayMasPaginas) {
        const polizasRes = await polizaService.getPolizas({
          per_page: 100,
          page: paginaActual,
          sort_field: 'fecha_fin',
          sort_direction: 'asc'
        });

        if (polizasRes.success && polizasRes.data) {
          const datos = polizasRes.data;
          const polizasPagina = Array.isArray(datos) ? datos : (datos.data || []);
          todasLasPolizas = [...todasLasPolizas, ...polizasPagina];

          if (!Array.isArray(datos) && datos.current_page && datos.last_page) {
            hayMasPaginas = datos.current_page < datos.last_page;
            paginaActual++;
          } else {
            hayMasPaginas = false;
          }
        } else {
          hayMasPaginas = false;
        }
      }

      // Procesar pólizas para comisiones
      const polizasConComisiones = todasLasPolizas.map((poliza: any) => {
        const primaNeta = Number(poliza.prima_neta || 0);
        const comisionReal = Number(poliza.comision || 0);
        const porcentajeComision = Number(poliza.comision_agencia || poliza.porcentaje_comision || 15);
        const comision = comisionReal > 0 ? comisionReal : (primaNeta * porcentajeComision / 100);
        const estado = (poliza.estado || 'ACTIVA').toUpperCase();

        // Simular estado de cobro de comisiones
        const random = Math.random();
        const comisionPendiente = estado === 'ACTIVA' && random < 0.3 ? comision : 0;
        const comisionCobrada = estado === 'ACTIVA' && random >= 0.3 ? comision : 0;

        return {
          ...poliza,
          comision,
          comisionPendiente,
          comisionCobrada,
          estadoComision: comisionPendiente > 0 ? 'Pendiente' : 'Cobrada'
        };
      }).filter((p: any) => {
        const estado = (p.estado || '').toUpperCase();
        return estado === 'ACTIVA' || estado === 'POR_VENCER';
      });

      setPolizasComisiones(polizasConComisiones);
    } catch (error) {
      console.error('Error loading polizas comisiones:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las comisiones',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('es-CO');
    } catch {
      return '-';
    }
  };

  // Filtrar según búsqueda
  const comisionesPorCobrarFiltradas = useMemo(() => {
    if (!filtros.busqueda) return comisionesPorCobrar;
    const busqueda = filtros.busqueda.toLowerCase();
    return comisionesPorCobrar.filter(p =>
      (p.numero_poliza || '').toLowerCase().includes(busqueda) ||
      (p.nombres_cliente || '').toLowerCase().includes(busqueda) ||
      (p.apellidos_cliente || '').toLowerCase().includes(busqueda) ||
      (p.aseguradora_nombre || '').toLowerCase().includes(busqueda)
    );
  }, [comisionesPorCobrar, filtros.busqueda]);

  const comisionesCobradasFiltradas = useMemo(() => {
    if (!filtros.busqueda) return comisionesCobradas;
    const busqueda = filtros.busqueda.toLowerCase();
    return comisionesCobradas.filter(p =>
      (p.numero_poliza || '').toLowerCase().includes(busqueda) ||
      (p.nombres_cliente || '').toLowerCase().includes(busqueda) ||
      (p.apellidos_cliente || '').toLowerCase().includes(busqueda) ||
      (p.aseguradora_nombre || '').toLowerCase().includes(busqueda)
    );
  }, [comisionesCobradas, filtros.busqueda]);

  // Paginación para Por Cobrar
  const comisionesPorCobrarPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * elementosPorPagina;
    return comisionesPorCobrarFiltradas.slice(inicio, inicio + elementosPorPagina);
  }, [comisionesPorCobrarFiltradas, paginaActual, elementosPorPagina]);

  const totalPaginasPorCobrar = Math.ceil(comisionesPorCobrarFiltradas.length / elementosPorPagina);

  // Paginación para Cobradas
  const comisionesCobradasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * elementosPorPagina;
    return comisionesCobradasFiltradas.slice(inicio, inicio + elementosPorPagina);
  }, [comisionesCobradasFiltradas, paginaActual, elementosPorPagina]);

  const totalPaginasCobradas = Math.ceil(comisionesCobradasFiltradas.length / elementosPorPagina);

  // Resetear página al cambiar tab o filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [tabActivo, filtros]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="xl" />
        <span className="ml-3">Cargando comisiones...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Estadísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Total Comisiones</p>
                <p className="text-lg md:text-2xl font-bold text-blue-600">
                  {formatCurrency(estadisticasComisiones.totalComisiones)}
                </p>
              </div>
              <Icon icon="solar:dollar-minimalistic-bold-duotone" className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Por Cobrar</p>
                <p className="text-lg md:text-2xl font-bold text-orange-600">
                  {formatCurrency(estadisticasComisiones.pendiente)}
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-orange-500 rounded-full"></div>
              </div>
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Cobradas</p>
                <p className="text-lg md:text-2xl font-bold text-green-600">
                  {formatCurrency(estadisticasComisiones.cobradas)}
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </Card>

          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-600">Tasa de Cobro</p>
                <p className="text-lg md:text-2xl font-bold text-purple-600">
                  {estadisticasComisiones.tasaCobro.toFixed(1)}%
                </p>
              </div>
              <div className="w-6 h-6 md:w-8 md:h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold text-xs md:text-sm">%</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Header de Controles */}
        <div className="bg-white dark:bg-darkgray shadow-md dark:shadow-none rounded-[10px]">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Icon icon="solar:magnifer-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    placeholder="Buscar por póliza, cliente o aseguradora..."
                    value={filtros.busqueda || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFiltros({ ...filtros, busqueda: e.target.value })}
                    className="pl-10 h-10 text-sm rounded-[10px]"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  color="light"
                  onClick={() => loadPolizasComisiones()}
                  disabled={loading}
                  className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                  title="Actualizar"
                >
                  <Icon icon="solar:refresh-bold-duotone" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                
                <Button
                  color="light"
                  className="h-10 w-10 p-0 border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 rounded-[10px] flex items-center justify-center"
                  title="Exportar comisiones"
                >
                  <Icon icon="solar:download-bold-duotone" className="w-4 h-4" />
                </Button>

              </div>
            </div>
          </div>
        </div>

        {/* Tabs de Comisiones */}
        <Card>
          <Tabs>
            <Tabs.Item
              active={tabActivo === 'porCobrar'}
              title={`Comisiones por Cobrar (${comisionesPorCobrarFiltradas.length})`}
              icon={() => <Icon icon="solar:hand-money-bold-duotone" />}
              onClick={() => setTabActivo('porCobrar')}
            >
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Comisiones Pendientes</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(estadisticasComisiones.pendiente)}
                    </p>
                  </div>
                </Card>
                <Card>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Cantidad</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {estadisticasComisiones.cantidadPorCobrar}
                    </p>
                  </div>
                </Card>
                <Card>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Tasa de Cobro</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {estadisticasComisiones.tasaCobro.toFixed(1)}%
                    </p>
                    <div className="mt-2">
                      <Progress
                        progress={estadisticasComisiones.tasaCobro}
                        size="sm"
                        color="green"
                      />
                    </div>
                  </div>
                </Card>
              </div>

              <div className="overflow-x-auto">
                <Table hoverable>
                  <Table.Head>
                    <Table.HeadCell>Póliza</Table.HeadCell>
                    <Table.HeadCell>Cliente</Table.HeadCell>
                    <Table.HeadCell>Aseguradora</Table.HeadCell>
                    <Table.HeadCell className="text-right">Prima Neta</Table.HeadCell>
                    <Table.HeadCell className="text-right">% Comisión</Table.HeadCell>
                    <Table.HeadCell className="text-right">Comisión</Table.HeadCell>
                    <Table.HeadCell className="text-right">Pendiente</Table.HeadCell>
                    <Table.HeadCell>Vencimiento</Table.HeadCell>
                    <Table.HeadCell>Estado</Table.HeadCell>
                    <Table.HeadCell>Acciones</Table.HeadCell>
                  </Table.Head>
                  <Table.Body className="divide-y">
                    {comisionesPorCobrarPaginadas.map((poliza) => {
                      const porcentaje = poliza.prima_neta > 0 
                        ? ((poliza.comision / poliza.prima_neta) * 100).toFixed(1)
                        : '0';
                      
                      return (
                        <Table.Row key={poliza.id}>
                          <Table.Cell className="font-medium">{poliza.numero_poliza}</Table.Cell>
                          <Table.Cell>
                            <div>
                              <div className="font-medium">
                                {poliza.nombres_cliente} {poliza.apellidos_cliente}
                              </div>
                              <div className="text-xs text-gray-500">{poliza.dni_cliente}</div>
                            </div>
                          </Table.Cell>
                          <Table.Cell>{poliza.aseguradora_nombre}</Table.Cell>
                          <Table.Cell className="text-right font-semibold">
                            {formatCurrency(poliza.prima_neta)}
                          </Table.Cell>
                          <Table.Cell className="text-right text-gray-600">
                            {porcentaje}%
                          </Table.Cell>
                          <Table.Cell className="text-right font-semibold text-green-600">
                            {formatCurrency(poliza.comision)}
                          </Table.Cell>
                          <Table.Cell className="text-right font-semibold text-blue-600">
                            {formatCurrency(poliza.comisionPendiente)}
                          </Table.Cell>
                          <Table.Cell>
                            {formatDate(poliza.fecha_fin)}
                          </Table.Cell>
                          <Table.Cell>
                            <Badge color="warning" size="sm">
                              Pendiente
                            </Badge>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="relative inline-block">
                              <Dropdown
                                label=""
                                dismissOnClick={false}
                                placement="left-start"
                                className="z-50"
                                renderTrigger={() => (
                                  <span className="h-9 w-9 flex justify-center items-center rounded-full hover:bg-lightprimary hover:text-primary cursor-pointer">
                                    <IconDots size={22} />
                                  </span>
                                )}
                              >
                                <Dropdown.Item className="flex gap-3 w-full justify-start text-left">
                                  <Icon icon="solar:eye-bold-duotone" height={18} />
                                  <span>Ver Detalle</span>
                                </Dropdown.Item>
                                <Dropdown.Item className="flex gap-3 w-full justify-start text-left text-green-600">
                                  <Icon icon="solar:hand-money-bold-duotone" height={18} />
                                  <span>Registrar Cobro</span>
                                </Dropdown.Item>
                              </Dropdown>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>

                {comisionesPorCobrarFiltradas.length === 0 && (
                  <div className="text-center py-12">
                    <Icon icon="solar:check-circle-bold-duotone" className="w-16 h-16 text-green-300 mx-auto mb-4" />
                    <p className="text-gray-500">No hay comisiones pendientes de cobrar</p>
                  </div>
                )}
              </div>

              {/* Paginación Por Cobrar */}
              {totalPaginasPorCobrar > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <div className="text-sm text-gray-600">
                    Mostrando {((paginaActual - 1) * elementosPorPagina) + 1} a {Math.min(paginaActual * elementosPorPagina, comisionesPorCobrarFiltradas.length)} de {comisionesPorCobrarFiltradas.length} comisiones
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span>Por página:</span>
                      <select
                        className="border rounded-md px-2 py-1 text-sm dark:bg-darkgray"
                        value={elementosPorPagina}
                        onChange={(e) => {
                          setElementosPorPagina(Number(e.target.value));
                          setPaginaActual(1);
                        }}
                      >
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    <Button
                      size="sm"
                      color="gray"
                      disabled={paginaActual === 1}
                      onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                      className="rounded-[10px]"
                    >
                      <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-gray-600">
                      Página {paginaActual} de {totalPaginasPorCobrar}
                    </span>
                    <Button
                      size="sm"
                      color="gray"
                      disabled={paginaActual === totalPaginasPorCobrar}
                      onClick={() => setPaginaActual(p => Math.min(totalPaginasPorCobrar, p + 1))}
                      className="rounded-[10px]"
                    >
                      <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Tabs.Item>

            <Tabs.Item
              title={`Comisiones Cobradas (${comisionesCobradasFiltradas.length})`}
              icon={() => <Icon icon="solar:check-circle-bold-duotone" />}
              onClick={() => setTabActivo('cobradas')}
            >
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Total Cobrado</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(estadisticasComisiones.cobradas)}
                    </p>
                  </div>
                </Card>
                <Card>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Cantidad</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {estadisticasComisiones.cantidadCobradas}
                    </p>
                  </div>
                </Card>
                <Card>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Tasa de Cobro</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {estadisticasComisiones.tasaCobro.toFixed(1)}%
                    </p>
                    <div className="mt-2">
                      <Progress
                        progress={estadisticasComisiones.tasaCobro}
                        size="sm"
                        color="green"
                      />
                    </div>
                  </div>
                </Card>
              </div>

              <div className="overflow-x-auto">
                <Table hoverable>
                  <Table.Head>
                    <Table.HeadCell>Póliza</Table.HeadCell>
                    <Table.HeadCell>Cliente</Table.HeadCell>
                    <Table.HeadCell>Aseguradora</Table.HeadCell>
                    <Table.HeadCell className="text-right">Prima Neta</Table.HeadCell>
                    <Table.HeadCell className="text-right">% Comisión</Table.HeadCell>
                    <Table.HeadCell className="text-right">Comisión</Table.HeadCell>
                    <Table.HeadCell className="text-right">Cobrado</Table.HeadCell>
                    <Table.HeadCell>Fecha Cobro</Table.HeadCell>
                    <Table.HeadCell>Estado</Table.HeadCell>
                  </Table.Head>
                  <Table.Body className="divide-y">
                    {comisionesCobradasPaginadas.map((poliza) => {
                      const porcentaje = poliza.prima_neta > 0 
                        ? ((poliza.comision / poliza.prima_neta) * 100).toFixed(1)
                        : '0';
                      
                      return (
                        <Table.Row key={poliza.id}>
                          <Table.Cell className="font-medium">{poliza.numero_poliza}</Table.Cell>
                          <Table.Cell>
                            <div>
                              <div className="font-medium">
                                {poliza.nombres_cliente} {poliza.apellidos_cliente}
                              </div>
                              <div className="text-xs text-gray-500">{poliza.dni_cliente}</div>
                            </div>
                          </Table.Cell>
                          <Table.Cell>{poliza.aseguradora_nombre}</Table.Cell>
                          <Table.Cell className="text-right font-semibold">
                            {formatCurrency(poliza.prima_neta)}
                          </Table.Cell>
                          <Table.Cell className="text-right text-gray-600">
                            {porcentaje}%
                          </Table.Cell>
                          <Table.Cell className="text-right font-semibold text-green-600">
                            {formatCurrency(poliza.comision)}
                          </Table.Cell>
                          <Table.Cell className="text-right font-semibold text-green-600">
                            {formatCurrency(poliza.comisionCobrada)}
                          </Table.Cell>
                          <Table.Cell>
                            {formatDate(poliza.fecha_fin)}
                          </Table.Cell>
                          <Table.Cell>
                            <Badge color="success" size="sm">
                              Cobrada
                            </Badge>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table>

                {comisionesCobradasFiltradas.length === 0 && (
                  <div className="text-center py-12">
                    <Icon icon="solar:inbox-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No hay comisiones cobradas aún</p>
                  </div>
                )}
              </div>

              {/* Paginación Cobradas */}
              {totalPaginasCobradas > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <div className="text-sm text-gray-600">
                    Mostrando {((paginaActual - 1) * elementosPorPagina) + 1} a {Math.min(paginaActual * elementosPorPagina, comisionesCobradasFiltradas.length)} de {comisionesCobradasFiltradas.length} comisiones
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span>Por página:</span>
                      <select
                        className="border rounded-md px-2 py-1 text-sm dark:bg-darkgray"
                        value={elementosPorPagina}
                        onChange={(e) => {
                          setElementosPorPagina(Number(e.target.value));
                          setPaginaActual(1);
                        }}
                      >
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                    <Button
                      size="sm"
                      color="gray"
                      disabled={paginaActual === 1}
                      onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                      className="rounded-[10px]"
                    >
                      <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-gray-600">
                      Página {paginaActual} de {totalPaginasCobradas}
                    </span>
                    <Button
                      size="sm"
                      color="gray"
                      disabled={paginaActual === totalPaginasCobradas}
                      onClick={() => setPaginaActual(p => Math.min(totalPaginasCobradas, p + 1))}
                      className="rounded-[10px]"
                    >
                      <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Tabs.Item>
          </Tabs>
        </Card>
      </div>
  );
};

export default ComisionesPorPoliza;