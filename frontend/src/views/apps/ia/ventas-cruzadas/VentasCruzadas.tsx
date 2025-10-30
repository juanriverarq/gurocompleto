import { useState, useContext, useEffect } from 'react';
import { useReactTable, createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, SortingState } from '@tanstack/react-table';
import { Badge, Button, Card, Progress, Spinner, Modal, Alert } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { CustomizerContext } from 'src/context/CustomizerContext';
import ventasCruzadasService, { OportunidadVentasCruzadas, EstadisticasVentasCruzadas } from 'src/services/ventasCruzadasService';
import { useToast } from 'src/hooks/use-toast';


export interface OportunidadType extends OportunidadVentasCruzadas {}

const oportunidadesData: OportunidadType[] = [];

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

  const handleIniciarContacto = async (op: OportunidadType) => {
    try {
      setActionLoadingId(op.id);
      const mensaje = op.mensaje_ia && op.mensaje_ia.trim().length > 0
        ? op.mensaje_ia
        : `Hola ${op.cliente}, te escribimos respecto a ${op.oportunidad}. ¿Deseas que te compartamos una propuesta?`;
      const res = await ventasCruzadasService.crearCampanaWhatsApp(op.id, { mensaje });
      if (res.success) {
        toast({ title: 'Contacto iniciado', description: `Se creó campaña de WhatsApp para ${op.cliente}` });
      } else {
        toast({ title: 'Error', description: res.message || 'No se pudo iniciar el contacto', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo iniciar el contacto', variant: 'destructive' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleGenerarPropuesta = async (op: OportunidadType) => {
    try {
      setActionLoadingId(op.id);
      const tipo = op.tipoOportunidad || 'general';
      const valor = Number(String(op.valorEstimado || '0').replace(/[^\d]/g, '')) || 0;
      const res = await ventasCruzadasService.generarCotizacion(op.id, { tipo_seguro: tipo, valor_asegurado: valor, observaciones: `Propuesta generada desde oportunidades para ${op.cliente}` });
      if (res.success) {
        toast({ title: 'Propuesta generada', description: `Se generó la cotización para ${op.cliente}` });
      } else {
        toast({ title: 'Error', description: res.message || 'No se pudo generar la propuesta', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo generar la propuesta', variant: 'destructive' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDescartar = async (op: OportunidadType) => {
    try {
      setActionLoadingId(op.id);
      const res = await ventasCruzadasService.ejecutarAccion(op.id, 'descartar_oportunidad', {});
      if (res.success) {
        setData(prev => prev.filter(x => x.id !== op.id));
        toast({ title: 'Oportunidad descartada', description: `${op.cliente} - ${op.oportunidad}` });
      } else {
        toast({ title: 'Error', description: res.message || 'No se pudo descartar la oportunidad', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo descartar la oportunidad', variant: 'destructive' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCampanaMasiva = async () => {
    try {
      setLoading(true);
      let ok = 0, fail = 0;
      for (const op of data) {
        const mensaje = op.mensaje_ia && op.mensaje_ia.trim().length > 0
          ? op.mensaje_ia
          : `Hola ${op.cliente}, te compartimos información sobre ${op.oportunidad}. ¿Deseas recibir una propuesta?`;
        try {
          const res = await ventasCruzadasService.crearCampanaWhatsApp(op.id, { mensaje });
          if (res.success) ok++; else fail++;
        } catch {
          fail++;
        }
      }
      toast({ title: 'Campaña masiva', description: `Enviadas: ${ok}. Fallidas: ${fail}.` });
    } finally {
      setLoading(false);
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
    columnHelper.accessor('estado', {
      cell: info => (
        <Badge color={info.row.original.estadoColor} className="capitalize">
          {info.getValue()}
        </Badge>
      ),
      header: () => <span>Prioridad</span>,
      meta: { sortType: 'alphanumeric' }
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
            <Button size="xs" color="success" title="Iniciar contacto" onClick={() => handleIniciarContacto(op)} disabled={disabled}>
              <Icon icon="solar:phone-bold" width={16} />
            </Button>
            <Button size="xs" color="info" title="Generar propuesta" onClick={() => handleGenerarPropuesta(op)} disabled={disabled}>
              <Icon icon="solar:document-text-bold" width={16} />
            </Button>
            <Button size="xs" color="light" className="!text-gray-500" title="Descartar" onClick={() => handleDescartar(op)} disabled={disabled}>
              <Icon icon="solar:close-circle-bold" width={16} />
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
  const altaPrioridad = estadisticas?.alta_prioridad || data.filter(o => o.estado === 'Alta Prioridad' || o.estado === 'Crítica').length;
  const valorTotal = estadisticas?.valor_total_estimado || data.reduce((acc, o) => acc + parseFloat(o.valorEstimado.replace(/[$,.]/g, '')), 0);
  const scoringPromedio = estadisticas?.scoring_promedio || (data.length > 0 ? data.reduce((acc, o) => acc + o.scoring, 0) / data.length : 0);

  return (
    <>
      
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
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
            <div className="p-3 bg-failure/10 rounded-lg">
              <Icon icon="solar:fire-bold" className="text-failure" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">
                {loading ? <Spinner size="sm" /> : altaPrioridad}
              </h3>
              <p className="text-sm text-gray-500">Alta Prioridad</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <Icon icon="solar:dollar-bold" className="text-success" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">
                {loading ? <Spinner size="sm" /> : `$${(valorTotal / 1000000).toFixed(1)}M`}
              </h3>
              <p className="text-sm text-gray-500">Valor Potencial</p>
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
          <Button
            color="success"
            size="sm"
            onClick={handleCampanaMasiva}
            disabled={loading || (data.length === 0)}
          >
            <Icon icon="solar:phone-calling-bold" className="mr-2" width={16} />
            Campaña Masiva
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
            {estadisticas?.estadisticas_ia && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-500">
                  <div>
                    <span className="font-semibold">Análisis vigentes:</span> {estadisticas.estadisticas_ia.analisis_vigentes}
                  </div>
                  <div>
                    <span className="font-semibold">Total consultas:</span> {estadisticas.estadisticas_ia.total_consultas}
                  </div>
                  <div>
                    <span className="font-semibold">Recomendaciones:</span> {estadisticas.estadisticas_ia.recomendaciones_generadas}
                  </div>
                  <div>
                    <span className="font-semibold">Último análisis:</span> {estadisticas.estadisticas_ia.ultimo_analisis ? new Date(estadisticas.estadisticas_ia.ultimo_analisis).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
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
            <Button onClick={() => window.location.reload()}>
              <Icon icon="solar:refresh-bold" className="mr-2" width={16} />
              Actualizar Análisis
            </Button>
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

      {/* Modal Detalle de Oportunidad */}
      <Modal show={showDetalle} onClose={() => setShowDetalle(false)}>
        <Modal.Header>Detalle de Oportunidad</Modal.Header>
        <Modal.Body>
          {selectedOp ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-gray-500">Cliente</div>
                  <div className="font-medium">{selectedOp.cliente}</div>
                </div>
                <div>
                  <div className="text-gray-500">Póliza</div>
                  <div className="font-medium">{selectedOp.polizaActual}</div>
                </div>
                <div>
                  <div className="text-gray-500">Tipo Actual</div>
                  <div className="font-medium uppercase">{selectedOp.tipoActual}</div>
                </div>
                <div>
                  <div className="text-gray-500">Oportunidad</div>
                  <div className="font-medium">{selectedOp.oportunidad}</div>
                </div>
                <div>
                  <div className="text-gray-500">Prioridad</div>
                  <Badge color={selectedOp.estadoColor}>{selectedOp.estado}</Badge>
                </div>
                <div>
                  <div className="text-gray-500">Scoring / Prob</div>
                  <div className="font-medium">{selectedOp.scoring}% / {selectedOp.probabilidad}%</div>
                </div>
                <div>
                  <div className="text-gray-500">Aseguradora Recomendada</div>
                  <div className="font-medium">{selectedOp.aseguradora_recomendada || '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Vendedor</div>
                  <div className="font-medium">{selectedOp.vendedor_nombre || '-'}</div>
                </div>
              </div>
              {selectedOp.mensaje_ia && (
                <div>
                  <div className="text-gray-500">Mensaje sugerido</div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">{selectedOp.mensaje_ia}</div>
                </div>
              )}
              {selectedOp.razonamiento && (
                <div>
                  <div className="text-gray-500">Motivo</div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">{selectedOp.razonamiento}</div>
                </div>
              )}
              {selectedOp.proteccion_complementaria && (
                <div>
                  <div className="text-gray-500">Protección complementaria</div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">{selectedOp.proteccion_complementaria}</div>
                </div>
              )}
            </div>
          ) : null}
        </Modal.Body>
      </Modal>
    </>
  );
};

export default VentasCruzadas;
