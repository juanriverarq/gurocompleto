import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Spinner, Badge, Table, Tabs, Progress, Dropdown, Modal } from 'flowbite-react';
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

  // Estados para modal de cobro
  const [showCobroModal, setShowCobroModal] = useState(false);
  const [polizaSeleccionada, setPolizaSeleccionada] = useState<any>(null);
  const [montoCobro, setMontoCobro] = useState('');
  const [fechaCobro, setFechaCobro] = useState('');
  const [referenciaCobro, setReferenciaCobro] = useState('');
  const [observacionesCobro, setObservacionesCobro] = useState('');
  const [procesandoCobro, setProcesandoCobro] = useState(false);

  // Filtrar comisiones por cobrar (pendientes) - solo las que tienen comisión pendiente
  const comisionesPorCobrar = useMemo(() =>
    polizasComisiones.filter(p => {
      const pendiente = Number(p.comisionPendiente || 0);
      return pendiente > 0;
    }),
    [polizasComisiones]
  );

  // Filtrar comisiones cobradas - solo las que tienen algo cobrado
  const comisionesCobradas = useMemo(() =>
    polizasComisiones.filter(p => {
      const cobrada = Number(p.comisionCobrada || 0);
      return cobrada > 0;
    }),
    [polizasComisiones]
  );

  const estadisticasComisiones = useMemo(() => {
    // Aplicar el mismo filtro de búsqueda a las estadísticas
    const aplicaFiltro = (arr: any[]) => {
      if (!filtros.busqueda) return arr;
      const busqueda = filtros.busqueda.toLowerCase();
      return arr.filter(p =>
        (p.numero_poliza || '').toLowerCase().includes(busqueda) ||
        (p.nombres_cliente || '').toLowerCase().includes(busqueda) ||
        (p.apellidos_cliente || '').toLowerCase().includes(busqueda) ||
        (p.aseguradora_nombre || '').toLowerCase().includes(busqueda)
      );
    };
 
    const porCobrarFiltradas = aplicaFiltro(comisionesPorCobrar);
    const cobradasFiltradas = aplicaFiltro(comisionesCobradas);
 
    const pendiente = porCobrarFiltradas.reduce((sum, p) => sum + (p.comisionPendiente || 0), 0);
    const cobradas = cobradasFiltradas.reduce((sum, p) => sum + (p.comisionCobrada || 0), 0);
    const totalComisiones = pendiente + cobradas;
    const tasaCobro = totalComisiones > 0 ? (cobradas / totalComisiones) * 100 : 0;
 
    return {
      pendiente,
      cobradas,
      tasaCobro,
      cantidadPorCobrar: porCobrarFiltradas.length,
      cantidadCobradas: cobradasFiltradas.length,
      totalComisiones
    };
  }, [comisionesPorCobrar, comisionesCobradas, filtros.busqueda]);

  useEffect(() => {
    loadPolizasComisiones();
  }, []);

  const loadPolizasComisiones = async () => {
    try {
      setLoading(true);

      // OPTIMIZACIÓN: Usar endpoint específico que incluye información real de pagos y comisiones
      const response = await polizaService.getComisionesPolizas();

      if (response.success && response.data) {
        setPolizasComisiones(response.data);
      } else {
        setPolizasComisiones([]);
        toast({
          title: 'Sin datos',
          description: 'No se encontraron pólizas con pagos registrados',
          variant: 'default',
        });
      }
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

  const abrirModalCobro = (poliza: any) => {
    setPolizaSeleccionada(poliza);
    setMontoCobro((poliza.comisionPendiente || 0).toString());
    setFechaCobro(new Date().toISOString().split('T')[0]);
    setReferenciaCobro('');
    setObservacionesCobro('');
    setShowCobroModal(true);
  };

  const registrarCobro = async () => {
    if (!polizaSeleccionada || !montoCobro) return;

    try {
      setProcesandoCobro(true);
      const response = await polizaService.registrarCobroComision(
        polizaSeleccionada.id,
        parseFloat(montoCobro),
        referenciaCobro,
        observacionesCobro,
        fechaCobro
      );

      if (response.success) {
        toast({
          title: 'Cobro registrado',
          description: 'El cobro de comisión ha sido registrado exitosamente',
        });
        setShowCobroModal(false);
        // Recargar datos
        await loadPolizasComisiones();
      }
    } catch (error) {
      console.error('Error registrando cobro:', error);
      toast({
        title: 'Error',
        description: 'No se pudo registrar el cobro de comisión',
        variant: 'destructive',
      });
    } finally {
      setProcesandoCobro(false);
    }
  };

  const revertirCobro = async (poliza: any) => {
    if (!poliza.cobro_id) {
      toast({
        title: 'Error',
        description: 'No se puede revertir este cobro',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm('¿Está seguro de revertir este cobro de comisión? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setLoading(true);
      const response = await polizaService.revertirCobroComision(poliza.id, poliza.cobro_id);

      if (response.success) {
        toast({
          title: 'Cobro revertido',
          description: 'El cobro de comisión ha sido revertido exitosamente',
        });
        // Recargar datos
        await loadPolizasComisiones();
      }
    } catch (error) {
      console.error('Error revirtiendo cobro:', error);
      toast({
        title: 'Error',
        description: 'No se pudo revertir el cobro',
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

              <div className="guro-table-wrap">
                <table className="guro-table">
                  <thead>
                    <tr>
                      <th>Póliza</th>
                      <th>Cliente</th>
                      <th>Aseguradora</th>
                      <th className="text-right">Prima Neta</th>
                      <th className="text-right">% Comisión</th>
                      <th className="text-right">Comisión</th>
                      <th className="text-right">Pendiente</th>
                      <th>Vencimiento</th>
                      <th>Estado</th>
                      <th className="sticky-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comisionesPorCobrarPaginadas.map((poliza) => {
                      const porcentaje = poliza.prima_neta > 0 
                        ? ((poliza.comision / poliza.prima_neta) * 100).toFixed(1)
                        : '0';
                      
                      return (
                        <tr key={poliza.id} className="group">
                          <td className="font-medium">{poliza.numero_poliza}</td>
                          <td>
                            <div>
                              <div className="font-medium">
                                {poliza.nombres_cliente} {poliza.apellidos_cliente}
                              </div>
                              <div className="text-xs text-gray-500">{poliza.dni_cliente}</div>
                            </div>
                          </td>
                          <td>{poliza.aseguradora_nombre}</td>
                          <td className="text-right font-semibold">
                            {formatCurrency(poliza.prima_neta)}
                          </td>
                          <td className="text-right text-gray-600">
                            {porcentaje}%
                          </td>
                          <td className="text-right font-semibold text-green-600">
                            {formatCurrency(poliza.comision)}
                          </td>
                          <td className="text-right font-semibold text-blue-600">
                            {formatCurrency(poliza.comisionPendiente)}
                          </td>
                          <td>
                            {formatDate(poliza.fecha_fin)}
                          </td>
                          <td>
                            <Badge color="warning" size="sm">
                              Pendiente
                            </Badge>
                          </td>
                          <td className="sticky-right">
                            <div className="relative inline-block">
                              <Dropdown
                                label=""
                                dismissOnClick={false}
                                placement="left-start"
                                className="z-50"
                                style={{ minWidth: '220px' }}
                                renderTrigger={() => (
                                  <span className="h-8 w-8 flex justify-center items-center rounded-lg hover:bg-[#573CFF]/10 hover:text-[#573CFF] cursor-pointer transition-colors">
                                    <IconDots size={18} />
                                  </span>
                                )}
                              >
                                <Dropdown.Item
                                  className="flex gap-3 w-full justify-start text-left text-green-600"
                                  onClick={() => abrirModalCobro(poliza)}
                                >
                                  <Icon icon="solar:hand-money-bold-duotone" height={18} />
                                  <span>Registrar Cobro</span>
                                </Dropdown.Item>
                              </Dropdown>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {comisionesPorCobrarFiltradas.length === 0 && (
                  <div className="text-center py-12">
                    <Icon icon="solar:check-circle-bold-duotone" className="w-16 h-16 text-green-300 mx-auto mb-4" />
                    <p className="text-gray-500">No hay comisiones pendientes de cobrar</p>
                  </div>
                )}
              </div>

              {/* Paginación Por Cobrar */}
              {totalPaginasPorCobrar > 1 && (
                <div className="flex items-center justify-between p-4">
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

              <div className="guro-table-wrap">
                <table className="guro-table">
                  <thead>
                    <tr>
                      <th>Póliza</th>
                      <th>Cliente</th>
                      <th>Aseguradora</th>
                      <th className="text-right">Prima Neta</th>
                      <th className="text-right">% Comisión</th>
                      <th className="text-right">Comisión</th>
                      <th className="text-right">Cobrado</th>
                      <th>Fecha Cobro</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comisionesCobradasPaginadas.map((poliza) => {
                      const porcentaje = poliza.prima_neta > 0 
                        ? ((poliza.comision / poliza.prima_neta) * 100).toFixed(1)
                        : '0';
                      
                      return (
                        <tr key={poliza.id} className="group">
                          <td className="font-medium">{poliza.numero_poliza}</td>
                          <td>
                            <div>
                              <div className="font-medium">
                                {poliza.nombres_cliente} {poliza.apellidos_cliente}
                              </div>
                              <div className="text-xs text-gray-500">{poliza.dni_cliente}</div>
                            </div>
                          </td>
                          <td>{poliza.aseguradora_nombre}</td>
                          <td className="text-right font-semibold">
                            {formatCurrency(poliza.prima_neta)}
                          </td>
                          <td className="text-right text-gray-600">
                            {porcentaje}%
                          </td>
                          <td className="text-right font-semibold text-green-600">
                            {formatCurrency(poliza.comision)}
                          </td>
                          <td className="text-right font-semibold text-green-600">
                            {formatCurrency(poliza.comisionCobrada)}
                          </td>
                          <td>
                            {formatDate(poliza.fecha_fin)}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <Badge color="success" size="sm">
                                Cobrada
                              </Badge>
                              {poliza.cobro_id && (
                                <Button
                                  size="xs"
                                  color="gray"
                                  onClick={() => revertirCobro(poliza)}
                                  title="Revertir cobro"
                                >
                                  <Icon icon="solar:undo-left-bold-duotone" className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {comisionesCobradasFiltradas.length === 0 && (
                  <div className="text-center py-12">
                    <Icon icon="solar:inbox-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No hay comisiones cobradas aún</p>
                  </div>
                )}
              </div>

              {/* Paginación Cobradas */}
              {totalPaginasCobradas > 1 && (
                <div className="flex items-center justify-between p-4">
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

        {/* Modal Registrar Cobro de Comisión */}
        <Modal show={showCobroModal} onClose={() => setShowCobroModal(false)} size="md">
          <Modal.Header>
            Registrar Cobro de Comisión - {polizaSeleccionada?.numero_poliza}
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monto a Cobrar
                </label>
                <Input
                  type="number"
                  value={montoCobro}
                  onChange={(e) => setMontoCobro(e.target.value)}
                  placeholder="Monto de la comisión a cobrar"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comisión pendiente: {formatCurrency(polizaSeleccionada?.comisionPendiente || 0)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Referencia de Cobro
                </label>
                <Input
                  value={referenciaCobro}
                  onChange={(e) => setReferenciaCobro(e.target.value)}
                  placeholder="Número de recibo, comprobante, etc."
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observaciones
                </label>
                <textarea
                  value={observacionesCobro}
                  onChange={(e) => setObservacionesCobro(e.target.value)}
                  placeholder="Observaciones adicionales del cobro"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              color="gray"
              onClick={() => setShowCobroModal(false)}
              disabled={procesandoCobro}
            >
              Cancelar
            </Button>
            <Button
              color="green"
              onClick={registrarCobro}
              disabled={procesandoCobro || !montoCobro}
            >
              {procesandoCobro ? <Spinner size="sm" className="mr-2" /> : null}
              Registrar Cobro
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
  );
};

export default ComisionesPorPoliza;