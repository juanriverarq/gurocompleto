import { useState, useContext, useEffect } from 'react';
import { useReactTable, createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, SortingState } from '@tanstack/react-table';
import { Button, Card, Progress, Spinner, Modal, Label, TextInput, Textarea, Select } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { CustomizerContext } from 'src/context/CustomizerContext';
import ventasCruzadasService, { OportunidadVentasCruzadas, EstadisticasVentasCruzadas } from 'src/services/ventasCruzadasService';
import { seguimientoService, CreateSeguimientoData } from 'src/services/seguimientoService';
import { useToast } from 'src/hooks/use-toast';


export interface OportunidadType extends OportunidadVentasCruzadas {}

const getTipoIcon = (tipo: string) => {
  switch (tipo) {
    case 'vida':
      return 'solar:heart-bold-duotone';
    case 'auto':
      return 'solar:car-bold-duotone';
    case 'hogar':
      return 'solar:home-bold-duotone';
    case 'salud':
      return 'solar:medical-kit-bold-duotone';
    case 'empresarial':
      return 'solar:buildings-bold-duotone';
    default:
      return 'solar:shield-check-bold-duotone';
  }
};

const getTipoColor = (tipo: string) => {
  switch (tipo) {
    case 'vida':
      return 'text-error';
    case 'auto':
      return 'text-primary';
    case 'hogar':
      return 'text-success';
    case 'salud':
      return 'text-info';
    case 'empresarial':
      return 'text-warning';
    default:
      return 'text-gray-500';
  }
};

const columnHelper = createColumnHelper<OportunidadType>();

const VentasCruzadas = () => {

  const [data, setData] = useState<OportunidadType[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasVentasCruzadas | null>(null);
  const { isBorderRadius } = useContext(CustomizerContext);
  const { toast } = useToast();

  // Estado para acciones
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedOp, setSelectedOp] = useState<OportunidadType | null>(null);
  const [showDetalle, setShowDetalle] = useState(false);
  
  // Estado para modal de crear tarea de seguimiento
  const [showModalSeguimiento, setShowModalSeguimiento] = useState(false);
  const [seguimientoLoading, setSeguimientoLoading] = useState(false);
  const [seguimientoForm, setSeguimientoForm] = useState<{
    title: string;
    description: string;
    type: string;
    priority: string;
    due_date: string;
    contact_method: string;
  }>({
    title: '',
    description: '',
    type: 'seguimiento_cliente',
    priority: 'media',
    due_date: '',
    contact_method: 'whatsapp'
  });

  // Paginación estilo Pólizas
  const [pagination, setPagination] = useState<{ current_page: number; last_page: number; per_page: number; total: number; from: number; to: number } | null>(null);
  const [perPage, setPerPage] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Cargar oportunidades reales (paginado)
  const cargarOportunidades = async () => {
    try {
      setLoading(true);
      const [oportunidadesRes, estadisticasRes] = await Promise.all([
        ventasCruzadasService.getOportunidades({ per_page: perPage, page: currentPage }),
        ventasCruzadasService.getEstadisticas()
      ]);

      if (oportunidadesRes.success) {
        setData(oportunidadesRes.data);
        setPagination({
          current_page: oportunidadesRes.current_page || 1,
          last_page: oportunidadesRes.last_page || 1,
          per_page: oportunidadesRes.per_page || perPage,
          total: oportunidadesRes.total || (oportunidadesRes.data?.length || 0),
          from: oportunidadesRes.from || ((oportunidadesRes.data?.length || 0) ? ((currentPage - 1) * perPage + 1) : 0),
          to: oportunidadesRes.to || ((currentPage - 1) * perPage + (oportunidadesRes.data?.length || 0)),
        });
      } else {
        toast({
          title: 'Error',
          description: oportunidadesRes.message || 'No se pudieron cargar las oportunidades',
          variant: 'destructive'
        });
        setData([]);
        setPagination(null);
      }

      if (estadisticasRes.success) {
        setEstadisticas(estadisticasRes.data || null);
      }
    } catch (error) {
      console.error('Error cargando oportunidades:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar las oportunidades de ventas cruzadas',
        variant: 'destructive'
      });
      setData([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarOportunidades();
  }, [perPage, currentPage]);

  // Handlers de acciones
  const handleVerAnalisis = (op: OportunidadType) => {
    setSelectedOp(op);
    setShowDetalle(true);
  };

  const handleEliminar = async (op: OportunidadType) => {
    try {
      setActionLoadingId(op.id);
      const res = await ventasCruzadasService.ejecutarAccion(op.id, 'descartar_oportunidad', {});
      if (res.success) {
        setData(prev => prev.filter(x => x.id !== op.id));
        toast({ title: 'Oportunidad eliminada', description: `${op.cliente} - ${op.oportunidad}` });
      } else {
        toast({ title: 'Error', description: res.message || 'No se pudo eliminar la oportunidad', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo eliminar la oportunidad', variant: 'destructive' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAbrirModalSeguimiento = (op: OportunidadType) => {
    setSelectedOp(op);
    // Pre-llenar el formulario con datos de la oportunidad
    const prioridad = op.estado.includes('Alta') ? 'alta' : op.estado.includes('Media') ? 'media' : 'baja';
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 7); // Por defecto 7 días
    
    setSeguimientoForm({
      title: `Venta cruzada: ${op.oportunidad}`,
      description: `Cliente: ${op.cliente}\nProducto actual: ${op.tipoActual} - ${op.polizaActual}\nOportunidad: ${op.oportunidad}\n\nRazonamiento: ${op.razonamiento}`,
      type: 'seguimiento_cliente',
      priority: prioridad,
      due_date: fechaVencimiento.toISOString().split('T')[0],
      contact_method: 'whatsapp'
    });
    setShowModalSeguimiento(true);
  };

  const handleCrearTareaSeguimiento = async () => {
    if (!selectedOp) return;
    
    try {
      setSeguimientoLoading(true);
      
      const data: CreateSeguimientoData = {
        title: seguimientoForm.title,
        description: seguimientoForm.description,
        type: seguimientoForm.type as CreateSeguimientoData['type'],
        priority: seguimientoForm.priority as CreateSeguimientoData['priority'],
        client_id: selectedOp.cliente_id,
        due_date: seguimientoForm.due_date,
        contact_method: seguimientoForm.contact_method as CreateSeguimientoData['contact_method'],
        has_reminder: true,
        reminder_at: seguimientoForm.due_date
      };

      const result = await seguimientoService.createSeguimiento(data);
      
      if (result) {
        toast({
          title: 'Tarea creada',
          description: `Se creó la tarea de seguimiento para ${selectedOp.cliente}`
        });
        setShowModalSeguimiento(false);
        setSelectedOp(null);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear la tarea de seguimiento',
        variant: 'destructive'
      });
    } finally {
      setSeguimientoLoading(false);
    }
  };


  // Columnas (definidas aquí para acceder a handlers)
  const columns = [
    columnHelper.accessor('cliente', {
      cell: info => (
        <div>
          <h6 className="text-base font-semibold text-dark dark:text-white">
            {info.getValue()}
          </h6>
          <p className="text-sm text-darklink dark:text-bodytext">
            {info.row.original.tipoActual} • {info.row.original.polizaActual}
          </p>
        </div>
      ),
      header: () => <span>Cliente</span>,
      meta: { sortType: 'alphanumeric' }
    }),
    columnHelper.accessor('oportunidad', {
      cell: info => (
        <div className="flex items-center gap-2">
          <Icon
            icon={getTipoIcon(info.row.original.tipoOportunidad)}
            className={getTipoColor(info.row.original.tipoOportunidad)}
            width={20}
          />
          <div>
            <span className="font-medium text-dark dark:text-white">
              {info.getValue()}
            </span>
            <div className="text-xs text-gray-500">
              {info.row.original.valorEstimado}
            </div>
          </div>
        </div>
      ),
      header: () => <span>Oportunidad</span>,
      meta: { sortType: 'alphanumeric' }
    }),
    columnHelper.accessor('scoring', {
      cell: info => (
        <div className="w-full">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-dark dark:text-white">
              {info.getValue()}%
            </span>
            <span className="text-xs text-gray-500">
              {info.row.original.probabilidad}% prob.
            </span>
          </div>
          <Progress
            progress={info.getValue()}
            color={info.getValue() >= 90 ? "red" : info.getValue() >= 80 ? "yellow" : "blue"}
            size="sm"
          />
        </div>
      ),
      header: () => <span>Scoring IA</span>,
      meta: { sortType: 'numeric' }
    }),
    columnHelper.accessor('fechaDeteccion', {
      cell: info => (
        <div>
          <span className="text-sm text-darklink dark:text-bodytext">
            {info.getValue()}
          </span>
          <div className="text-xs text-gray-500">
            {info.row.original.accionRecomendada}
          </div>
        </div>
      ),
      header: () => <span>Detección</span>,
    }),
    columnHelper.accessor('id', {
      id: 'actions',
      cell: (info) => {
        const op = info.row.original;
        const disabled = actionLoadingId === op.id || loading;
        return (
          <div className="flex gap-2">
            <Button size="xs" color="primary" title="Ver análisis completo" onClick={() => handleVerAnalisis(op)} disabled={disabled}>
              <Icon icon="solar:eye-bold" width={16} />
            </Button>
            <Button size="xs" color="success" title="Crear tarea de seguimiento" onClick={() => handleAbrirModalSeguimiento(op)} disabled={disabled}>
              <Icon icon="solar:clipboard-check-bold" width={16} />
            </Button>
            <Button size="xs" color="failure" title="Eliminar" onClick={() => handleEliminar(op)} disabled={disabled}>
              <Icon icon="solar:trash-bin-trash-bold" width={16} />
            </Button>
          </div>
        );
      },
      header: () => <span>Acciones</span>,
    }),
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
  });

  const handleDownload = () => {
    const headers = ["Cliente", "Póliza Actual", "Oportunidad", "Aseguradora", "Scoring", "Probabilidad", "Valor", "Estado", "Mensaje IA"];
    const rows = data.map(item => [
      item.cliente,
      item.polizaActual,
      item.oportunidad,
      item.aseguradora_recomendada || '',
      item.scoring,
      item.probabilidad,
      item.valorEstimado,
      item.estado,
      item.mensaje_ia || ''
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "oportunidades-ventas-cruzadas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleActualizarIA = async () => {
    try {
      setLoading(true);
      const result = await ventasCruzadasService.forzarReanalisis();

      if (result.success) {
        await cargarOportunidades();
        toast({
          title: 'Análisis actualizado',
          description: 'Se han generado nuevas recomendaciones con IA',
        });
      } else {
        toast({
          title: 'Error',
          description: result.message || 'No se pudo actualizar el análisis',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error actualizando análisis:', error);
      toast({
        title: 'Error',
        description: 'Error al actualizar el análisis con IA',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Estadísticas
  const totalOportunidades = estadisticas?.total_oportunidades || pagination?.total || data.length;
  const scoringPromedio = estadisticas?.scoring_promedio || (data.length > 0 ? data.reduce((acc, o) => acc + o.scoring, 0) / data.length : 0);

  return (
    <>
      
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon icon="solar:target-bold" className="text-primary" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">
                {loading ? <Spinner size="sm" /> : totalOportunidades}
              </h3>
              <p className="text-sm text-gray-500">Oportunidades Detectadas</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-lg">
              <Icon icon="solar:chart-bold" className="text-info" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">
                {loading ? <Spinner size="sm" /> : `${scoringPromedio.toFixed(1)}%`}
              </h3>
              <p className="text-sm text-gray-500">Scoring Promedio</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Header con botones */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-dark dark:text-white">Oportunidades de Ventas Cruzadas</h2>
        <div className="flex gap-3">
          <Button
            color="light"
            size="sm"
            onClick={handleDownload}
          >
            <Icon icon="solar:download-minimalistic-bold-duotone" className="mr-2" width={16} />
            Exportar
          </Button>
          <Button
            color="info"
            size="sm"
            onClick={handleActualizarIA}
            disabled={loading}
          >
            <Icon icon="solar:refresh-bold" className="mr-2" width={16} />
            {loading ? 'Analizando...' : 'Actualizar IA'}
          </Button>
        </div>
      </div>

      {/* Información de IA */}
      <Card className="mb-6 p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Icon icon="solar:cpu-bolt-bold" className="text-primary" width={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-dark dark:text-white mb-2">
              Análisis Inteligente con IA
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-3">
              Sistema de IA avanzado que analiza automáticamente cada póliza y cliente para generar recomendaciones
              personalizadas de ventas cruzadas. Los análisis se almacenan en caché por 30 días para optimizar el rendimiento.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold" className="text-success" width={16} />
                <span>Análisis con IA</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold" className="text-success" width={16} />
                <span>Caché inteligente (30 días)</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold" className="text-success" width={16} />
                <span>Mensajes personalizados</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold" className="text-success" width={16} />
                <span>Datos reales del cliente</span>
              </div>
            </div>
            {estadisticas?.estadisticas_ia?.ultimo_analisis && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500">
                  <Icon icon="solar:calendar-bold" className="inline mr-1" width={14} />
                  Último análisis: {new Date(estadisticas.estadisticas_ia.ultimo_analisis).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>
      
      {loading ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center">
            <Spinner size="xl" />
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              Analizando oportunidades de ventas cruzadas...
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Nuestro algoritmo de IA está procesando los datos de tus clientes
            </p>
          </div>
        </Card>
      ) : data.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Icon icon="solar:target-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No se encontraron oportunidades
            </h3>
            <p className="text-gray-500 mb-4">
              No hay oportunidades de ventas cruzadas detectadas en este momento.
            </p>
            <div className="flex justify-center">
              <Button onClick={() => window.location.reload()}>
                <Icon icon="solar:refresh-bold" className="mr-2" width={16} />
                Actualizar Análisis
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card
          className="p-0"
          style={{
            borderRadius: `${isBorderRadius}px`,
          }}
        >
          <div
            className="overflow-hidden"
            style={{
              borderRadius: `${isBorderRadius}px`,
            }}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id} className="bg-gray-50 dark:bg-darkgray">
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <div className="flex items-center gap-2">
                            {header.isPlaceholder ? null : (
                              <>
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {{
                                  asc: <Icon icon="solar:alt-arrow-up-linear" width={16} />,
                                  desc: <Icon icon="solar:alt-arrow-down-linear" width={16} />,
                                }[header.column.getIsSorted() as string] ?? (
                                  header.column.getCanSort() ? (
                                    <Icon icon="solar:sort-vertical-linear" width={16} className="opacity-50" />
                                  ) : null
                                )}
                              </>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white dark:bg-dark divide-y divide-gray-200 dark:divide-gray-700">
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-darkgray transition-colors">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {pagination && (
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-gray-600">
                Mostrando {pagination.from} a {pagination.to} de {pagination.total} oportunidades
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <span>Por página:</span>
                  <select
                    className="border rounded-md px-2 py-1 text-sm dark:bg-darkgray"
                    value={perPage}
                    onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  >
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <Button
                  size="sm"
                  color="gray"
                  disabled={(pagination.current_page || 1) === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="rounded-[10px]"
                >
                  <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  Página {pagination.current_page} de {pagination.last_page}
                </span>
                <Button
                  size="sm"
                  color="gray"
                  disabled={pagination.current_page === pagination.last_page}
                  onClick={() => setCurrentPage((p) => Math.min(pagination?.last_page || 1, p + 1))}
                  className="rounded-[10px]"
                >
                  <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Modal Crear Tarea de Seguimiento */}
      <Modal show={showModalSeguimiento} onClose={() => setShowModalSeguimiento(false)} size="lg">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:clipboard-check-bold-duotone" className="text-green-500" width={24} />
            Crear Tarea de Seguimiento Comercial
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            {selectedOp && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Cliente:</strong> {selectedOp.cliente} | <strong>Oportunidad:</strong> {selectedOp.oportunidad}
                </div>
              </div>
            )}
            
            <div>
              <Label htmlFor="seg-title" value="Título de la tarea" className="mb-2 block" />
              <TextInput
                id="seg-title"
                value={seguimientoForm.title}
                onChange={(e) => setSeguimientoForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Título de la tarea"
              />
            </div>

            <div>
              <Label htmlFor="seg-description" value="Descripción" className="mb-2 block" />
              <Textarea
                id="seg-description"
                value={seguimientoForm.description}
                onChange={(e) => setSeguimientoForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                placeholder="Descripción detallada..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="seg-type" value="Tipo de tarea" className="mb-2 block" />
                <Select
                  id="seg-type"
                  value={seguimientoForm.type}
                  onChange={(e) => setSeguimientoForm(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="seguimiento_cliente">Seguimiento Cliente</option>
                  <option value="llamada">Llamada</option>
                  <option value="reunion">Reunión</option>
                  <option value="cotizacion">Cotización</option>
                  <option value="email">Email</option>
                  <option value="visita">Visita</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="seg-priority" value="Prioridad" className="mb-2 block" />
                <Select
                  id="seg-priority"
                  value={seguimientoForm.priority}
                  onChange={(e) => setSeguimientoForm(prev => ({ ...prev, priority: e.target.value }))}
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="seg-due-date" value="Fecha límite" className="mb-2 block" />
                <TextInput
                  id="seg-due-date"
                  type="date"
                  value={seguimientoForm.due_date}
                  onChange={(e) => setSeguimientoForm(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="seg-contact" value="Método de contacto" className="mb-2 block" />
                <Select
                  id="seg-contact"
                  value={seguimientoForm.contact_method}
                  onChange={(e) => setSeguimientoForm(prev => ({ ...prev, contact_method: e.target.value }))}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Teléfono</option>
                  <option value="email">Email</option>
                  <option value="in_person">Presencial</option>
                  <option value="video_call">Videollamada</option>
                </Select>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-end gap-3 w-full">
            <Button color="gray" onClick={() => setShowModalSeguimiento(false)}>
              Cancelar
            </Button>
            <Button 
              color="success" 
              onClick={handleCrearTareaSeguimiento}
              disabled={seguimientoLoading || !seguimientoForm.title}
            >
              {seguimientoLoading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Creando...
                </>
              ) : (
                <>
                  <Icon icon="solar:clipboard-check-bold" className="mr-2" width={16} />
                  Crear Tarea
                </>
              )}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Modal Detalle de Oportunidad - Mejorado */}
      <Modal show={showDetalle} onClose={() => setShowDetalle(false)} size="xl">
        <Modal.Header>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon icon={getTipoIcon(selectedOp?.tipoOportunidad || 'otro')} className="text-primary" width={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Oportunidad de Venta Cruzada</h3>
              <p className="text-sm text-gray-500">{selectedOp?.oportunidad}</p>
            </div>
          </div>
        </Modal.Header>
        <Modal.Body>
          {selectedOp ? (
            <div className="space-y-6">
              {/* Información del Cliente */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-3">
                  <Icon icon="solar:user-bold" className="text-blue-600" width={20} />
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200">Información del Cliente</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Nombre</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{selectedOp.cliente}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Póliza Actual</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{selectedOp.polizaActual}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Producto Actual</div>
                    <div className="font-semibold text-gray-900 dark:text-white uppercase">{selectedOp.tipoActual}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Vendedor Asignado</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{selectedOp.vendedor_nombre || 'Sin asignar'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Scoring de Conversión</div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-primary">{selectedOp.scoring}%</span>
                      <Progress progress={selectedOp.scoring} color={selectedOp.scoring >= 80 ? "green" : selectedOp.scoring >= 60 ? "yellow" : "blue"} size="sm" className="w-20" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Producto Recomendado */}
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-3">
                  <Icon icon="solar:gift-bold" className="text-green-600" width={20} />
                  <h4 className="font-semibold text-green-800 dark:text-green-200">Producto Recomendado</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Producto a Ofrecer</div>
                    <div className="font-bold text-lg text-green-700 dark:text-green-300">{selectedOp.oportunidad}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Aseguradora Sugerida</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{selectedOp.aseguradora_recomendada || 'Cualquiera disponible'}</div>
                  </div>
                </div>
              </div>

              {/* Por qué este producto - Argumentos de venta */}
              {selectedOp.razonamiento && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon icon="solar:lightbulb-bolt-bold" className="text-amber-600" width={20} />
                    <h4 className="font-semibold text-amber-800 dark:text-amber-200">¿Por qué este producto? - Argumentos de Venta</h4>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{selectedOp.razonamiento}</p>
                </div>
              )}

              {/* Protección Complementaria */}
              {selectedOp.proteccion_complementaria && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon icon="solar:shield-check-bold" className="text-purple-600" width={20} />
                    <h4 className="font-semibold text-purple-800 dark:text-purple-200">Beneficios para el Cliente</h4>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{selectedOp.proteccion_complementaria}</p>
                </div>
              )}

              {/* Mensaje Sugerido para Contacto */}
              {selectedOp.mensaje_ia && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:chat-round-dots-bold" className="text-gray-600 dark:text-gray-400" width={20} />
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200">Mensaje Sugerido para WhatsApp</h4>
                    </div>
                    <Button 
                      size="xs" 
                      color="light"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedOp.mensaje_ia || '');
                        toast({ title: 'Copiado', description: 'Mensaje copiado al portapapeles' });
                      }}
                    >
                      <Icon icon="solar:copy-bold" width={14} className="mr-1" />
                      Copiar
                    </Button>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                    <p className="text-gray-700 dark:text-gray-300 italic">"{selectedOp.mensaje_ia}"</p>
                  </div>
                </div>
              )}

              {/* Tips de Venta */}
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center gap-2 mb-3">
                  <Icon icon="solar:star-bold" className="text-indigo-600" width={20} />
                  <h4 className="font-semibold text-indigo-800 dark:text-indigo-200">Tips para el Contacto</h4>
                </div>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex items-start gap-2">
                    <Icon icon="solar:check-circle-bold" className="text-indigo-500 mt-0.5" width={16} />
                    <span>Menciona que ya es cliente y que valoras su confianza</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon icon="solar:check-circle-bold" className="text-indigo-500 mt-0.5" width={16} />
                    <span>Explica cómo el nuevo producto complementa su cobertura actual</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon icon="solar:check-circle-bold" className="text-indigo-500 mt-0.5" width={16} />
                    <span>Ofrece una cotización sin compromiso para que compare</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon icon="solar:check-circle-bold" className="text-indigo-500 mt-0.5" width={16} />
                    <span>Pregunta si tiene alguna necesidad específica de protección</span>
                  </li>
                </ul>
              </div>

              {/* Acción Recomendada */}
              <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <Icon icon="solar:phone-calling-bold" className="text-success" width={24} />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">Acción Recomendada</div>
                    <div className="text-sm text-gray-500">{selectedOp.accionRecomendada || 'Contactar por WhatsApp'}</div>
                  </div>
                </div>
                <Button color="success" size="sm" onClick={() => { setShowDetalle(false); handleAbrirModalSeguimiento(selectedOp); }}>
                  <Icon icon="solar:clipboard-check-bold" className="mr-2" width={16} />
                  Crear Tarea
                </Button>
              </div>
            </div>
          ) : null}
        </Modal.Body>
      </Modal>
    </>
  );
};

export default VentasCruzadas;
